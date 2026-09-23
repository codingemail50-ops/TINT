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
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PixelFormat
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.RemoteViews
import android.widget.TextView
import androidx.core.app.NotificationCompat

// Exact pixel data for the bonfire's stage-3 flame (see
// pixelBonfireStages.ts) — ported once to a Node script and hardcoded here
// rather than re-deriving the mask math natively. Used to draw a real,
// full-color bitmap for the notification's large icon.
private data class FlameCell(val x: Int, val y: Int, val color: Int)

/**
 * V1 app-blocking engine. Deliberately minimal:
 *  - polls UsageStatsManager every POLL_INTERVAL_MS for the current
 *    foreground package (there is no push/callback API for this — polling
 *    recent usage events is the standard, Play-accepted approach)
 *  - shows a full-screen WindowManager overlay when a blocked package is
 *    in front, with a single "Return to TINT" action
 *  - stops itself the moment it's explicitly told to (ACTION_STOP, or its
 *    own endAtMs safety check firing) — deliberately does NOT stop just
 *    because TINT's own task was swiped from recents (stopWithTask="false"
 *    in the manifest): the user hasn't ended their session or taken a
 *    break, so blocking has to keep working with TINT fully closed.
 *
 * No AccessibilityService, no boot receiver, no persistence beyond the
 * lifetime of one focus session — on purpose, per the approved V1 scope.
 */
class BlockingForegroundService : Service() {

  companion object {
    const val ACTION_START = "expo.modules.tintappblocker.action.START"
    const val ACTION_STOP = "expo.modules.tintappblocker.action.STOP"
    const val ACTION_SET_PAUSED = "expo.modules.tintappblocker.action.SET_PAUSED"
    // Tapped from the notification's own action buttons — these PendingIntents
    // target this same Service (the only component a notification action can
    // reliably reach), which forwards the tap to JS via actionListener below.
    const val ACTION_NOTIF_TOGGLE_PAUSE = "expo.modules.tintappblocker.action.NOTIF_TOGGLE_PAUSE"
    const val ACTION_NOTIF_END = "expo.modules.tintappblocker.action.NOTIF_END"
    const val EXTRA_PACKAGES = "expo.modules.tintappblocker.extra.PACKAGES"
    const val EXTRA_END_AT_MS = "expo.modules.tintappblocker.extra.END_AT_MS"
    const val EXTRA_TITLE = "expo.modules.tintappblocker.extra.TITLE"
    const val EXTRA_DURATION_MINS = "expo.modules.tintappblocker.extra.DURATION_MINS"
    const val EXTRA_PAUSED = "expo.modules.tintappblocker.extra.PAUSED"
    private const val CHANNEL_ID = "tint_focus_blocking"
    private const val NOTIFICATION_ID = 8421
    // Was 1500ms — a blocked app (YouTube, Instagram, ...) could sit fully
    // visible for up to that long before the overlay appeared, which read
    // as the block not working. UsageStatsManager.queryEvents over a short
    // 10s lookback is a cheap call, so polling this much more often is a
    // fine trade for the overlay actually feeling instant.
    private const val POLL_INTERVAL_MS = 300L
    private const val LOOKBACK_MS = 10_000L
    // How many consecutive polls (900ms at the interval above) have to agree
    // "no blocked app in front" before the overlay actually comes down. Fast
    // app-switching (recents/gesture nav, split-screen, a share sheet) can
    // make UsageStatsManager briefly report a transient launcher/system
    // package as the foreground app for a poll cycle or two even while the
    // blocked app is what's actually on screen (or about to be again the
    // instant that transient surface closes) — this was the reported bypass:
    // switch screens fast enough and the overlay would drop for a beat.
    // Showing the overlay stays instant (one poll, no debounce) — only
    // hiding it is debounced, so the only failure mode this can cause is the
    // overlay lingering an extra beat after a genuine exit, never a gap that
    // exposes the blocked app.
    private const val REQUIRED_CLEAR_POLLS = 3

    // In-process only (no android:process split in the manifest, confirmed)
    // — a plain static callback is enough to hand a notification-button tap
    // to TintAppBlockerModule, which re-emits it as a JS event. Not for any
    // cross-process use; set by the module's OnCreate, read here.
    var actionListener: ((String) -> Unit)? = null

    // One picked at random each time the block overlay is shown (see
    // showOverlay()) — deliberately friendlier than a rigid "blocked"
    // notice, per the approved copy.
    private val BLOCK_SCREEN_LINES = listOf(
      "Stay locked in. You're making progress.",
      "You don't need this right now. Keep going.",
      "Keep going. You're closer than you think.",
      "The urge will pass. The progress stays.",
      "You didn't come this far to scroll now.",
      "You didn't come this far just to come this far."
    )

    // Exact pixel-cell data for the bonfire's stage-3 flame, cropped to its
    // bounding box (see pixelBonfireStages.ts / the Node port used to
    // generate this). Drawn once into a bitmap for the notification's large
    // icon so the notification carries the app's real pixel-art flame
    // instead of a generic icon.
    private const val FLAME_GRID_W = 27
    private const val FLAME_GRID_H = 14
    private val FLAME_CELLS: List<FlameCell> = listOf(
      FlameCell(8, 10, 0xFF5C5A56.toInt()),
      FlameCell(9, 10, 0xFF5C5A56.toInt()),
      FlameCell(10, 10, 0xFF5C5A56.toInt()),
      FlameCell(11, 10, 0xFFFF6A00.toInt()),
      FlameCell(12, 10, 0xFFFF6A00.toInt()),
      FlameCell(13, 10, 0xFFFF6A00.toInt()),
      FlameCell(14, 10, 0xFFFF6A00.toInt()),
      FlameCell(15, 10, 0xFFFF6A00.toInt()),
      FlameCell(16, 10, 0xFF5C5A56.toInt()),
      FlameCell(17, 10, 0xFF5C5A56.toInt()),
      FlameCell(18, 10, 0xFF5C5A56.toInt()),
      FlameCell(2, 11, 0xFF0A0908.toInt()),
      FlameCell(3, 11, 0xFF0A0908.toInt()),
      FlameCell(4, 11, 0xFF0A0908.toInt()),
      FlameCell(5, 11, 0xFF0A0908.toInt()),
      FlameCell(6, 11, 0xFF0A0908.toInt()),
      FlameCell(7, 11, 0xFF0A0908.toInt()),
      FlameCell(8, 11, 0xFF0A0908.toInt()),
      FlameCell(9, 11, 0xFF0A0908.toInt()),
      FlameCell(10, 11, 0xFF0A0908.toInt()),
      FlameCell(11, 11, 0xFF0A0908.toInt()),
      FlameCell(12, 11, 0xFF0A0908.toInt()),
      FlameCell(13, 11, 0xFF0A0908.toInt()),
      FlameCell(14, 11, 0xFF0A0908.toInt()),
      FlameCell(15, 11, 0xFF0A0908.toInt()),
      FlameCell(16, 11, 0xFF0A0908.toInt()),
      FlameCell(17, 11, 0xFF0A0908.toInt()),
      FlameCell(18, 11, 0xFF0A0908.toInt()),
      FlameCell(19, 11, 0xFF0A0908.toInt()),
      FlameCell(20, 11, 0xFF0A0908.toInt()),
      FlameCell(21, 11, 0xFF0A0908.toInt()),
      FlameCell(22, 11, 0xFF0A0908.toInt()),
      FlameCell(23, 11, 0xFF0A0908.toInt()),
      FlameCell(24, 11, 0xFF0A0908.toInt()),
      FlameCell(0, 12, 0xFF0A0908.toInt()),
      FlameCell(1, 12, 0xFF0A0908.toInt()),
      FlameCell(2, 12, 0xFF0A0908.toInt()),
      FlameCell(3, 12, 0xFF0A0908.toInt()),
      FlameCell(4, 12, 0xFF0A0908.toInt()),
      FlameCell(5, 12, 0xFF0A0908.toInt()),
      FlameCell(6, 12, 0xFF0A0908.toInt()),
      FlameCell(7, 12, 0xFF0A0908.toInt()),
      FlameCell(8, 12, 0xFF0A0908.toInt()),
      FlameCell(9, 12, 0xFF0A0908.toInt()),
      FlameCell(10, 12, 0xFF0A0908.toInt()),
      FlameCell(11, 12, 0xFF0A0908.toInt()),
      FlameCell(12, 12, 0xFF0A0908.toInt()),
      FlameCell(13, 12, 0xFF0A0908.toInt()),
      FlameCell(14, 12, 0xFF0A0908.toInt()),
      FlameCell(15, 12, 0xFF0A0908.toInt()),
      FlameCell(16, 12, 0xFF0A0908.toInt()),
      FlameCell(17, 12, 0xFF0A0908.toInt()),
      FlameCell(18, 12, 0xFF0A0908.toInt()),
      FlameCell(19, 12, 0xFF0A0908.toInt()),
      FlameCell(20, 12, 0xFF0A0908.toInt()),
      FlameCell(21, 12, 0xFF0A0908.toInt()),
      FlameCell(22, 12, 0xFF0A0908.toInt()),
      FlameCell(23, 12, 0xFF0A0908.toInt()),
      FlameCell(24, 12, 0xFF0A0908.toInt()),
      FlameCell(25, 12, 0xFF0A0908.toInt()),
      FlameCell(26, 12, 0xFF0A0908.toInt()),
      FlameCell(2, 13, 0xFF0A0908.toInt()),
      FlameCell(3, 13, 0xFF0A0908.toInt()),
      FlameCell(4, 13, 0xFF0A0908.toInt()),
      FlameCell(5, 13, 0xFF0A0908.toInt()),
      FlameCell(6, 13, 0xFF0A0908.toInt()),
      FlameCell(7, 13, 0xFF0A0908.toInt()),
      FlameCell(8, 13, 0xFF0A0908.toInt()),
      FlameCell(9, 13, 0xFF0A0908.toInt()),
      FlameCell(10, 13, 0xFF0A0908.toInt()),
      FlameCell(11, 13, 0xFF0A0908.toInt()),
      FlameCell(12, 13, 0xFF0A0908.toInt()),
      FlameCell(13, 13, 0xFF0A0908.toInt()),
      FlameCell(14, 13, 0xFF0A0908.toInt()),
      FlameCell(15, 13, 0xFF0A0908.toInt()),
      FlameCell(16, 13, 0xFF0A0908.toInt()),
      FlameCell(17, 13, 0xFF0A0908.toInt()),
      FlameCell(18, 13, 0xFF0A0908.toInt()),
      FlameCell(19, 13, 0xFF0A0908.toInt()),
      FlameCell(20, 13, 0xFF0A0908.toInt()),
      FlameCell(21, 13, 0xFF0A0908.toInt()),
      FlameCell(22, 13, 0xFF0A0908.toInt()),
      FlameCell(23, 13, 0xFF0A0908.toInt()),
      FlameCell(24, 13, 0xFF0A0908.toInt()),
      FlameCell(4, 8, 0xFF5C5A56.toInt()),
      FlameCell(5, 8, 0xFF5C5A56.toInt()),
      FlameCell(6, 8, 0xFF5C5A56.toInt()),
      FlameCell(4, 9, 0xFF5C5A56.toInt()),
      FlameCell(5, 9, 0xFF5C5A56.toInt()),
      FlameCell(6, 9, 0xFF5C5A56.toInt()),
      FlameCell(4, 10, 0xFF5C5A56.toInt()),
      FlameCell(5, 10, 0xFF5C5A56.toInt()),
      FlameCell(6, 10, 0xFF5C5A56.toInt()),
      FlameCell(3, 8, 0xFF3A3936.toInt()),
      FlameCell(4, 7, 0xFF3A3936.toInt()),
      FlameCell(3, 7, 0xFF3A3936.toInt()),
      FlameCell(5, 7, 0xFF3A3936.toInt()),
      FlameCell(3, 9, 0xFF3A3936.toInt()),
      FlameCell(6, 7, 0xFF3A3936.toInt()),
      FlameCell(7, 8, 0xFF3A3936.toInt()),
      FlameCell(7, 7, 0xFF3A3936.toInt()),
      FlameCell(7, 9, 0xFF3A3936.toInt()),
      FlameCell(3, 10, 0xFF3A3936.toInt()),
      FlameCell(7, 10, 0xFF3A3936.toInt()),
      FlameCell(8, 8, 0xFF5C5A56.toInt()),
      FlameCell(9, 8, 0xFFFFA352.toInt()),
      FlameCell(10, 8, 0xFFFFA352.toInt()),
      FlameCell(8, 9, 0xFF5C5A56.toInt()),
      FlameCell(9, 9, 0xFFFF6A00.toInt()),
      FlameCell(10, 9, 0xFFFFA352.toInt()),
      FlameCell(8, 7, 0xFFFF6A00.toInt()),
      FlameCell(9, 7, 0xFFFFA352.toInt()),
      FlameCell(10, 7, 0xFFFFA352.toInt()),
      FlameCell(11, 8, 0xFFFFA352.toInt()),
      FlameCell(11, 7, 0xFFFFD9B3.toInt()),
      FlameCell(11, 9, 0xFFFFA352.toInt()),
      FlameCell(16, 8, 0xFFFF6A00.toInt()),
      FlameCell(17, 8, 0xFFFF6A00.toInt()),
      FlameCell(18, 8, 0xFF5C5A56.toInt()),
      FlameCell(16, 9, 0xFFFF6A00.toInt()),
      FlameCell(17, 9, 0xFFFF6A00.toInt()),
      FlameCell(18, 9, 0xFF5C5A56.toInt()),
      FlameCell(15, 8, 0xFFFFA352.toInt()),
      FlameCell(16, 7, 0xFFFF6A00.toInt()),
      FlameCell(15, 7, 0xFFFFA352.toInt()),
      FlameCell(17, 7, 0xFFFF6A00.toInt()),
      FlameCell(15, 9, 0xFFFF6A00.toInt()),
      FlameCell(18, 7, 0xFFFF6A00.toInt()),
      FlameCell(19, 8, 0xFF3A3936.toInt()),
      FlameCell(19, 7, 0xFF3A3936.toInt()),
      FlameCell(19, 9, 0xFF3A3936.toInt()),
      FlameCell(19, 10, 0xFF3A3936.toInt()),
      FlameCell(20, 8, 0xFF5C5A56.toInt()),
      FlameCell(21, 8, 0xFF5C5A56.toInt()),
      FlameCell(22, 8, 0xFF5C5A56.toInt()),
      FlameCell(20, 9, 0xFF5C5A56.toInt()),
      FlameCell(21, 9, 0xFF5C5A56.toInt()),
      FlameCell(22, 9, 0xFF5C5A56.toInt()),
      FlameCell(20, 10, 0xFF5C5A56.toInt()),
      FlameCell(21, 10, 0xFF5C5A56.toInt()),
      FlameCell(22, 10, 0xFF5C5A56.toInt()),
      FlameCell(20, 7, 0xFF3A3936.toInt()),
      FlameCell(21, 7, 0xFF3A3936.toInt()),
      FlameCell(22, 7, 0xFF3A3936.toInt()),
      FlameCell(23, 8, 0xFF3A3936.toInt()),
      FlameCell(23, 7, 0xFF3A3936.toInt()),
      FlameCell(23, 9, 0xFF3A3936.toInt()),
      FlameCell(23, 10, 0xFF3A3936.toInt()),
      FlameCell(12, 1, 0xFFFF6A00.toInt()),
      FlameCell(12, 2, 0xFFFF6A00.toInt()),
      FlameCell(13, 2, 0xFFFF6A00.toInt()),
      FlameCell(11, 3, 0xFFFFA352.toInt()),
      FlameCell(12, 3, 0xFFFFA352.toInt()),
      FlameCell(13, 3, 0xFFFFA352.toInt()),
      FlameCell(11, 4, 0xFFFFA352.toInt()),
      FlameCell(12, 4, 0xFFFFA352.toInt()),
      FlameCell(13, 4, 0xFFFFA352.toInt()),
      FlameCell(14, 4, 0xFFFFA352.toInt()),
      FlameCell(15, 4, 0xFFFFA352.toInt()),
      FlameCell(9, 5, 0xFFFFA352.toInt()),
      FlameCell(10, 5, 0xFFFFA352.toInt()),
      FlameCell(11, 5, 0xFFFFD9B3.toInt()),
      FlameCell(12, 5, 0xFFFFD9B3.toInt()),
      FlameCell(13, 5, 0xFFFFD9B3.toInt()),
      FlameCell(14, 5, 0xFFFFA352.toInt()),
      FlameCell(15, 5, 0xFFFFA352.toInt()),
      FlameCell(16, 5, 0xFFFF6A00.toInt()),
      FlameCell(17, 5, 0xFFFF6A00.toInt()),
      FlameCell(9, 6, 0xFFFFA352.toInt()),
      FlameCell(10, 6, 0xFFFFA352.toInt()),
      FlameCell(11, 6, 0xFFFFD9B3.toInt()),
      FlameCell(12, 6, 0xFFFFD9B3.toInt()),
      FlameCell(13, 6, 0xFFFFD9B3.toInt()),
      FlameCell(14, 6, 0xFFFFA352.toInt()),
      FlameCell(15, 6, 0xFFFFA352.toInt()),
      FlameCell(16, 6, 0xFFFF6A00.toInt()),
      FlameCell(17, 6, 0xFFFF6A00.toInt()),
      FlameCell(12, 7, 0xFFFFD9B3.toInt()),
      FlameCell(13, 7, 0xFFFFD9B3.toInt()),
      FlameCell(14, 7, 0xFFFFA352.toInt()),
      FlameCell(12, 8, 0xFFFFA352.toInt()),
      FlameCell(13, 8, 0xFFFFA352.toInt()),
      FlameCell(14, 8, 0xFFFFA352.toInt()),
      FlameCell(12, 9, 0xFFFFA352.toInt()),
      FlameCell(13, 9, 0xFFFFA352.toInt()),
      FlameCell(14, 9, 0xFFFFA352.toInt()),
      FlameCell(11, 1, 0xFF2B0E00.toInt()),
      FlameCell(13, 1, 0xFF2B0E00.toInt()),
      FlameCell(12, 0, 0xFF2B0E00.toInt()),
      FlameCell(11, 0, 0xFF2B0E00.toInt()),
      FlameCell(13, 0, 0xFF2B0E00.toInt()),
      FlameCell(11, 2, 0xFF2B0E00.toInt()),
      FlameCell(14, 2, 0xFF2B0E00.toInt()),
      FlameCell(14, 1, 0xFF2B0E00.toInt()),
      FlameCell(14, 3, 0xFF2B0E00.toInt()),
      FlameCell(10, 3, 0xFF2B0E00.toInt()),
      FlameCell(10, 2, 0xFF2B0E00.toInt()),
      FlameCell(10, 4, 0xFF2B0E00.toInt()),
      FlameCell(15, 3, 0xFF2B0E00.toInt()),
      FlameCell(16, 4, 0xFF2B0E00.toInt()),
      FlameCell(16, 3, 0xFF2B0E00.toInt()),
      FlameCell(8, 5, 0xFF2B0E00.toInt()),
      FlameCell(9, 4, 0xFF2B0E00.toInt()),
      FlameCell(8, 4, 0xFF2B0E00.toInt()),
      FlameCell(8, 6, 0xFF2B0E00.toInt()),
      FlameCell(17, 4, 0xFF2B0E00.toInt()),
      FlameCell(18, 5, 0xFF2B0E00.toInt()),
      FlameCell(18, 4, 0xFF2B0E00.toInt()),
      FlameCell(18, 6, 0xFF2B0E00.toInt()),
      FlameCell(7, 6, 0xFF2B0E00.toInt()),
      FlameCell(19, 6, 0xFF2B0E00.toInt())
    )
  }

  private val handler = Handler(Looper.getMainLooper())
  private var blockedPackages: Set<String> = emptySet()
  // Drives the notification's chronometer — 0 means "unknown," in which
  // case the notification falls back to a plain (non-counting) message.
  private var endAtMs: Long = 0L
  private var title: String = "Focus session active"
  private var durationMins: Int = 0
  // Purely a display flag — this service never re-derives session/pause
  // logic itself. JS remains the source of truth; this only reflects the
  // current state into the notification (icon/label/chronometer) and
  // forwards notification-button taps back to JS to act on.
  private var isPaused: Boolean = false
  private var overlayView: View? = null
  private var windowManager: WindowManager? = null
  private var ownPackageName: String = ""
  private var pollRunnable: Runnable? = null
  private val flameBitmap: Bitmap by lazy { buildFlameBitmap() }
  // See REQUIRED_CLEAR_POLLS — counts consecutive polls in a row that found
  // no blocked app in front; reset to 0 the moment any poll finds one.
  private var consecutiveClearPolls = 0

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
    when (intent?.action) {
      ACTION_STOP -> {
        stopBlockingAndSelf()
        return START_NOT_STICKY
      }
      // JS-driven pause/resume (from togglePause()) — just refresh what the
      // notification shows, nothing about polling/blocking changes.
      ACTION_SET_PAUSED -> {
        isPaused = intent?.getBooleanExtra(EXTRA_PAUSED, false) ?: false
        endAtMs = intent?.getLongExtra(EXTRA_END_AT_MS, endAtMs) ?: endAtMs
        updateNotification()
        return START_STICKY
      }
      // User tapped Pause/Resume ON the notification itself. Flip the local
      // display flag immediately (so the notification reacts with no visible
      // lag) and forward the tap to JS, which drives the actual session
      // pause logic and will confirm back via ACTION_SET_PAUSED.
      ACTION_NOTIF_TOGGLE_PAUSE -> {
        isPaused = !isPaused
        updateNotification()
        actionListener?.invoke(if (isPaused) "pause" else "resume")
        return START_STICKY
      }
      // User tapped End on the notification — forward to JS (which runs its
      // normal end-session flow) and tear down the service/notification
      // right away rather than waiting on the JS round trip.
      ACTION_NOTIF_END -> {
        actionListener?.invoke("end")
        stopBlockingAndSelf()
        return START_NOT_STICKY
      }
    }

    val packages = intent?.getStringArrayListExtra(EXTRA_PACKAGES) ?: arrayListOf()
    blockedPackages = packages.toSet()
    consecutiveClearPolls = 0
    endAtMs = intent?.getLongExtra(EXTRA_END_AT_MS, 0L) ?: 0L
    title = intent?.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotBlank() } ?: "Focus session active"
    durationMins = intent?.getIntExtra(EXTRA_DURATION_MINS, 0) ?: 0
    isPaused = false
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

  // No onTaskRemoved override — deliberately. It used to call removeOverlay()
  // as a "belt-and-braces" cleanup, back when stopWithTask="true" meant the
  // whole service died with TINT's task anyway. Now that the service is
  // meant to keep blocking after TINT itself is swiped from recents (see
  // the class doc), clearing the overlay here would do exactly the opposite
  // of that — it'd expose whatever blocked app the overlay was covering the
  // moment the user swiped TINT away, which is the bypass this exists to
  // prevent. The overlay is only ever removed by checkForegroundApp() (the
  // blocked app is no longer in front) or stopBlockingAndSelf() (the session
  // actually ended).

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

    val togglePauseIntent = Intent(this, BlockingForegroundService::class.java).apply {
      action = ACTION_NOTIF_TOGGLE_PAUSE
    }
    val togglePausePendingIntent = PendingIntent.getService(
      this, 1, togglePauseIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val endIntent = Intent(this, BlockingForegroundService::class.java).apply {
      action = ACTION_NOTIF_END
    }
    val endPendingIntent = PendingIntent.getService(
      this, 2, endIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // Custom minimal layout (see notification_focus.xml) instead of the
    // default template's title/body text pair -- that read as a generic
    // system notice (light card, plain black text) rather than Tint's own
    // thing. DecoratedCustomViewStyle keeps the OS chrome (small icon, app
    // name, timestamp, the action buttons below) and lets this content
    // area have its own dark gradient background.
    val views = RemoteViews(packageName, R.layout.notification_focus)
    views.setImageViewBitmap(R.id.notif_flame_icon, flameBitmap)
    views.setTextViewText(R.id.notif_task_name, title)

    // Chronometer is elapsedRealtime-based (SystemClock.elapsedRealtime()),
    // not wall-clock epoch millis -- endAtMs is epoch millis (it's compared
    // against System.currentTimeMillis() elsewhere for the actual block
    // logic), so it has to be converted to an elapsedRealtime reference
    // point here or the countdown would show the wrong time entirely.
    if (!isPaused && endAtMs > 0L) {
      val base = SystemClock.elapsedRealtime() + (endAtMs - System.currentTimeMillis())
      views.setChronometer(R.id.notif_timer, base, null, true)
    } else {
      // Chronometer extends TextView, so this just overwrites its displayed
      // text with a static label -- safe because setChronometer (and the
      // start() call it makes internally) is only invoked in the branch
      // above, never here, so nothing is ticking to overwrite on the next
      // tick (endAtMs itself isn't adjusted on pause -- a pre-existing,
      // accepted gap).
      views.setTextViewText(R.id.notif_timer, if (isPaused) "Paused" else "")
    }

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setSmallIcon(applicationInfo.icon)
      .setLargeIcon(flameBitmap)
      .setOngoing(true)
      .setContentIntent(contentIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCustomContentView(views)
      .setCustomBigContentView(views)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .addAction(
        if (isPaused) android.R.drawable.ic_media_play else android.R.drawable.ic_media_pause,
        if (isPaused) "Resume" else "Pause",
        togglePausePendingIntent
      )
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End", endPendingIntent)

    return builder.build()
  }

  private fun updateNotification() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification())
  }

  // Draws FLAME_CELLS (the real bonfire's stage-3 pixel data) into a small
  // bitmap once per service instance, for use as the notification's large
  // icon — a real, full-color rendering of the app's own pixel-art flame
  // rather than a generic icon.
  private fun buildFlameBitmap(): Bitmap {
    val cellSize = 8
    val bitmap = Bitmap.createBitmap(
      FLAME_GRID_W * cellSize, FLAME_GRID_H * cellSize, Bitmap.Config.ARGB_8888
    )
    val canvas = Canvas(bitmap)
    val paint = Paint().apply { isAntiAlias = false }
    for (cell in FLAME_CELLS) {
      paint.color = cell.color
      val left = (cell.x * cellSize).toFloat()
      val top = (cell.y * cellSize).toFloat()
      canvas.drawRect(left, top, left + cellSize, top + cellSize, paint)
    }
    return bitmap
  }

  private fun startPolling() {
    stopPolling()
    val runnable = object : Runnable {
      override fun run() {
        // Belt-and-braces: this service only ever hears about a session
        // ending via an explicit ACTION_STOP from the JS side (finishSession/
        // exitSession). If the app gets killed, crashes, or its timer just
        // doesn't fire exactly when expected, nothing was ever telling this
        // service to stop — it would keep blocking apps indefinitely past
        // the session's actual end time, with no way to notice short of
        // force-clearing the app. Checked here (not inside
        // checkForegroundApp(), which skips its own work while the screen
        // is off) so it still fires on schedule even with the screen off.
        if (endAtMs > 0L && System.currentTimeMillis() >= endAtMs) {
          stopBlockingAndSelf()
          return
        }
        // A single bad poll must never kill the whole loop. checkForegroundApp()
        // reads a live UsageEvents cursor, and a burst of foreground-transition
        // events in quick succession (e.g. home -> recents -> straight back
        // into a blocked app, all within about a second) is exactly the kind
        // of rapid churn that can make that read throw mid-iteration. Before
        // this try/catch, an uncaught exception here aborted this Runnable
        // before it reached the postDelayed call below -- permanently
        // stopping polling for the rest of the session, silently, with no
        // crash and no way to notice short of ending and restarting the
        // session. This was the real cause behind "block the app once, then
        // it never blocks again this session" reports.
        try {
          checkForegroundApp()
        } catch (e: Exception) {
        }
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

  private fun stopBlockingAndSelf() {
    stopPolling()
    consecutiveClearPolls = 0
    removeOverlay()
    @Suppress("DEPRECATION")
    stopForeground(true)
    stopSelf()
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

    // No qualifying event in the lookback window (or the query itself
    // failed) — an inconclusive reading, not a confident "nothing blocked is
    // in front." Do nothing rather than guess: if a blocked app is genuinely
    // still up, the overlay (already showing) simply stays; if it's
    // genuinely gone, one of the next polls will get a real reading and
    // resolve it through the debounce below.
    val foregroundPackage = currentForegroundPackage() ?: return

    if (blockedPackages.contains(foregroundPackage)) {
      consecutiveClearPolls = 0
      showOverlay()
    } else {
      consecutiveClearPolls++
      if (consecutiveClearPolls >= REQUIRED_CLEAR_POLLS) {
        removeOverlay()
      }
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
    overlayView?.let { existing ->
      if (existing.isAttachedToWindow) return
      // The OS can silently detach this overlay window on its own (seen
      // around recents/gesture-navigation transitions) without ever going
      // through our own removeOverlay() -- our bookkeeping never learns
      // about it, so overlayView keeps pointing at a view that isn't really
      // on screen anymore. Every subsequent poll's showOverlay() call was
      // hitting the early-return above and silently doing nothing, forever,
      // because it trusted a stale reference instead of checking reality.
      // That's the exact "block it once, then it never blocks again" bug:
      // no crash, no error, just a permanently-stuck belief that the block
      // screen is already showing when it isn't. Clear the stale reference
      // so a real, freshly-attached view gets added below instead.
      overlayView = null
    }
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
      text = BLOCK_SCREEN_LINES.random()
      textSize = 20f
      setTextColor(0xFFF5F5F5.toInt())
      gravity = Gravity.CENTER
    })
    layout.addView(TextView(this).apply {
      text = "This app is paused until your session ends."
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
