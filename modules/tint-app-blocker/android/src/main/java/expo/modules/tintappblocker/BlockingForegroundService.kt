package expo.modules.tintappblocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat

/**
 * V1 app-blocking engine. Deliberately minimal:
 *  - polls UsageStatsManager every POLL_INTERVAL_MS for the current
 *    foreground package (there is no push/callback API for this — polling
 *    recent usage events is the standard, Play-accepted approach)
 *  - shows a full-screen WindowManager overlay when a blocked package is
 *    in front, with a single "Return to TINT" action
 *  - stops itself (and removes any overlay) the moment it's told to, or
 *    when Android tears down TINT's task (default stopWithTask behavior —
 *    see the manifest fragment)
 *
 * No AccessibilityService, no boot receiver, no persistence beyond the
 * lifetime of one focus session — on purpose, per the approved V1 scope.
 */
class BlockingForegroundService : Service() {

  companion object {
    const val ACTION_START = "expo.modules.tintappblocker.action.START"
    const val ACTION_STOP = "expo.modules.tintappblocker.action.STOP"
    const val EXTRA_PACKAGES = "expo.modules.tintappblocker.extra.PACKAGES"
    const val EXTRA_END_AT_MS = "expo.modules.tintappblocker.extra.END_AT_MS"
    private const val CHANNEL_ID = "tint_focus_blocking"
    private const val NOTIFICATION_ID = 8421
    private const val POLL_INTERVAL_MS = 1500L
    private const val LOOKBACK_MS = 10_000L
  }

  private val handler = Handler(Looper.getMainLooper())
  private var blockedPackages: Set<String> = emptySet()
  // Drives the notification's chronometer — 0 means "unknown," in which
  // case the notification falls back to a plain (non-counting) message.
  private var endAtMs: Long = 0L
  private var overlayView: View? = null
  private var windowManager: WindowManager? = null
  private var ownPackageName: String = ""
  private var pollRunnable: Runnable? = null

  private var audioManager: AudioManager? = null
  private var audioFocusRequest: AudioFocusRequest? = null
  // No-op — TINT never plays anything itself. Holding audio focus is the
  // whole point: it's the sanctioned way to make a well-behaved app like
  // YouTube pause its own playback without needing any special permission.
  private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { }

  override fun onCreate() {
    super.onCreate()
    ownPackageName = packageName
    windowManager = getSystemService(Context.WINDOW_SERVICE) as? WindowManager
    audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopPolling()
      removeOverlay()
      @Suppress("DEPRECATION")
      stopForeground(true)
      stopSelf()
      return START_NOT_STICKY
    }

    val packages = intent?.getStringArrayListExtra(EXTRA_PACKAGES) ?: arrayListOf()
    blockedPackages = packages.toSet()
    endAtMs = intent?.getLongExtra(EXTRA_END_AT_MS, 0L) ?: 0L
    try {
      startForeground(NOTIFICATION_ID, buildNotification())
    } catch (e: Exception) {
      // Foreground promotion can fail on some OEMs under battery-saver
      // restrictions — fail safe rather than crash the host app.
      stopSelf()
      return START_NOT_STICKY
    }
    startPolling()
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    stopPolling()
    removeOverlay()
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // android:stopWithTask="true" already stops this service when TINT's
    // task is swiped from recents. This override is just a belt-and-braces
    // guarantee that the overlay window never outlives the service.
    removeOverlay()
    super.onTaskRemoved(rootIntent)
  }

  private fun buildNotification(): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(
          CHANNEL_ID, "Focus session blocking", NotificationManager.IMPORTANCE_LOW
        )
        channel.description = "Shown while TINT is blocking distracting apps during an active focus session."
        channel.setShowBadge(false)
        manager.createNotificationChannel(channel)
      }
    }

    val launchIntent = packageManager.getLaunchIntentForPackage(ownPackageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this, 0, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Focus session active")
      .setContentText(
        if (blockedPackages.isNotEmpty()) "TINT is blocking distracting apps until your session ends."
        else "Your TINT focus session is running."
      )
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setContentIntent(contentIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)

    // A live-counting-down chronometer, driven by the OS itself — no need
    // for the app to keep re-posting this every second. Falls back to the
    // plain content text above if the caller didn't supply a real end time.
    if (endAtMs > 0L) {
      builder.setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setWhen(endAtMs)
    }

    return builder.build()
  }

  private fun startPolling() {
    stopPolling()
    val runnable = object : Runnable {
      override fun run() {
        checkForegroundApp()
        handler.postDelayed(this, POLL_INTERVAL_MS)
      }
    }
    pollRunnable = runnable
    handler.post(runnable)
  }

  private fun stopPolling() {
    pollRunnable?.let { handler.removeCallbacks(it) }
    pollRunnable = null
  }

  private fun checkForegroundApp() {
    // Screen off (or between checks) — nothing is actually visible to the
    // user right now, so skip the query and any overlay churn to save battery.
    val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
    if (powerManager != null && !powerManager.isInteractive) return

    if (blockedPackages.isEmpty()) {
      removeOverlay()
      return
    }

    val foregroundPackage = currentForegroundPackage() ?: return
    if (foregroundPackage == ownPackageName) {
      removeOverlay()
      return
    }
    if (blockedPackages.contains(foregroundPackage)) {
      showOverlay()
    } else {
      removeOverlay()
    }
  }

  // UsageStatsManager has no "what's in front right now" call — querying
  // recent foreground-transition events and taking the latest one is the
  // documented, standard way to approximate it.
  private fun currentForegroundPackage(): String? {
    val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
    val end = System.currentTimeMillis()
    val begin = end - LOOKBACK_MS
    val events = try {
      usm.queryEvents(begin, end)
    } catch (e: Exception) {
      return null
    }
    var lastPackage: String? = null
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val isForegroundEvent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        event.eventType == UsageEvents.Event.ACTIVITY_RESUMED
      } else {
        @Suppress("DEPRECATION")
        event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
      }
      if (isForegroundEvent) {
        lastPackage = event.packageName
      }
    }
    return lastPackage
  }

  // Plain LinearLayout doesn't consume the back button — unhandled, it falls
  // through to whatever's behind our window (the blocked app), letting the
  // user navigate it despite the overlay visually covering the screen. This
  // swallows BACK so the overlay is actually modal, not just a picture on top.
  private inner class BlockOverlayLayout(context: Context) : LinearLayout(context) {
    init {
      isFocusable = true
      isFocusableInTouchMode = true
    }
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
      if (event.keyCode == KeyEvent.KEYCODE_BACK) return true
      return super.dispatchKeyEvent(event)
    }
  }

  private fun requestAudioFocus() {
    val am = audioManager ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
        .setContentType(AudioAttributes.CONTENT_TYPE_UNKNOWN)
        .build()
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(attrs)
        .setOnAudioFocusChangeListener(audioFocusChangeListener)
        .build()
      audioFocusRequest = request
      am.requestAudioFocus(request)
    } else {
      @Suppress("DEPRECATION")
      am.requestAudioFocus(audioFocusChangeListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
    }
  }

  private fun abandonAudioFocus() {
    val am = audioManager ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      audioFocusRequest?.let { am.abandonAudioFocusRequest(it) }
      audioFocusRequest = null
    } else {
      @Suppress("DEPRECATION")
      am.abandonAudioFocus(audioFocusChangeListener)
    }
  }

  private fun showOverlay() {
    if (overlayView != null) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !android.provider.Settings.canDrawOverlays(this)) {
      // No overlay permission — nothing we can draw. The foreground-app
      // detection still ran (harmless), we just can't show the block screen.
      return
    }
    val wm = windowManager ?: return

    val layout = BlockOverlayLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(0xFF080810.toInt())
      setPadding(64, 64, 64, 64)
    }
    layout.addView(TextView(this).apply {
      text = "Blocked during your focus session"
      textSize = 20f
      setTextColor(0xFFF5F5F5.toInt())
      gravity = Gravity.CENTER
    })
    layout.addView(TextView(this).apply {
      text = "This app is off-limits until your TINT session ends."
      textSize = 14f
      setTextColor(0xFFAAAAAA.toInt())
      gravity = Gravity.CENTER
      setPadding(0, 24, 0, 48)
    })
    layout.addView(Button(this).apply {
      text = "Return to TINT"
      setOnClickListener {
        removeOverlay()
        val launchIntent = packageManager.getLaunchIntentForPackage(ownPackageName)
        launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        launchIntent?.let { startActivity(it) }
      }
    })

    val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
    }
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      overlayType,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.OPAQUE
    )
    try {
      wm.addView(layout, params)
      overlayView = layout
      layout.requestFocus()
      requestAudioFocus()
    } catch (e: Exception) {
      // Some OEMs revoke the overlay permission silently or restrict this
      // window type — fail safe, skip this cycle rather than crash.
    }
  }

  private fun removeOverlay() {
    val view = overlayView ?: return
    try {
      windowManager?.removeView(view)
    } catch (e: Exception) {
      // Already removed / window gone — nothing to do.
    }
    overlayView = null
    abandonAudioFocus()
  }
}
