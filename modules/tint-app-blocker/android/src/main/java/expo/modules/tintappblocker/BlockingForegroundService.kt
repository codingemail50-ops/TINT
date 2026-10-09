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
 * No AccessibilityService. Focus sessions have no persistence beyond their
 * own lifetime. A 7-day challenge ("challengeMode") is the one exception: its
 * config is saved so the service can come back after the OS kills it or the
 * phone reboots (see BootReceiver), and it runs until its endAtMs.
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
    // Challenge mode: bring a persisted challenge back after a reboot / kill.
    const val ACTION_RESTORE = "expo.modules.tintappblocker.action.RESTORE"
    // Challenge mode: lift blocking for a fixed number of ms, then resume.
    const val ACTION_EMERGENCY_PAUSE = "expo.modules.tintappblocker.action.EMERGENCY_PAUSE"
    const val EXTRA_CHALLENGE = "expo.modules.tintappblocker.extra.CHALLENGE"
    const val EXTRA_PAUSE_MS = "expo.modules.tintappblocker.extra.PAUSE_MS"
    private const val PREFS_NAME = "tint_challenge_blocking"
    private const val KEY_ACTIVE = "active"
    private const val KEY_PACKAGES = "packages"
    private const val KEY_END_AT = "end_at_ms"
    private const val KEY_TITLE = "title"
    private const val KEY_EMERGENCY_UNTIL = "emergency_until_ms"
    private const val NOTIFICATION_REFRESH_MS = 60_000L
    // Separate file from the challenge config above: that one is wiped when a
    // challenge stops, but the per-day "blocked app opened" counts are what
    // the end-of-challenge report is built from, so they must outlive it.
    const val STATS_PREFS_NAME = "tint_challenge_stats"
    const val STATS_KEY_PREFIX = "opens_"

    /** True if a 7-day challenge is saved and hasn't ended yet. */
    fun hasActiveChallenge(context: Context): Boolean {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      return prefs.getBoolean(KEY_ACTIVE, false) &&
        prefs.getLong(KEY_END_AT, 0L) > System.currentTimeMillis()
    }
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
    // Was 300ms. A fast swipe into the recents switcher and straight back
    // into a blocked app could land inside the gap between two checks; at
    // 100ms that gap is a third the size. Going much lower buys little and
    // starts costing real battery, and Android doesn't guarantee a
    // background timer fires any tighter than this anyway.
    private const val POLL_INTERVAL_MS = 100L
    private const val LOOKBACK_MS = 10_000L
    private const val QUERY_OVERLAP_MS = 3_000L
    private const val CHALLENGE_REPLAY_MS = 30 * 60_000L
    // How long the overlay holds after a blocked app was last seen in front,
    // while what's in front now is the launcher/recents switcher or system
    // UI (see transitPackages). On gesture-nav phones the recents switcher
    // and the home screen are the same launcher app, so this can't tell
    // "flicked into recents and back" from "went home" -- it only holds
    // briefly, which covers the out-and-back swipe, then lets go if the
    // user really stayed on the home screen. Any other, real app in front
    // drops the overlay immediately, with no hold at all.
    private const val TRANSIT_HOLD_MS = 1_500L
    // After "Return to TINT", Android can keep reporting the blocked app in
    // front for a moment before TINT actually opens; without this, a 100ms
    // poll would throw the overlay straight back up in that gap. Ends early
    // the moment TINT itself is seen in front.
    private const val RETURN_TO_TINT_GRACE_MS = 1_000L

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
  // 7-day challenge: no pause button, "6d 23h" style countdown, persisted so
  // it survives kills/reboots. See the class comment.
  private var challengeMode: Boolean = false
  // Blocking is lifted until this time (the challenge's emergency button).
  private var emergencyUntilMs: Long = 0L
  private var lastNotificationRefreshMs: Long = 0L
  // Which blocked package the overlay being shown is for (challenge stats).
  private var overlayForPackage: String? = null
  private var overlayView: View? = null
  private var windowManager: WindowManager? = null
  private var ownPackageName: String = ""
  private var pollRunnable: Runnable? = null
  private val flameBitmap: Bitmap by lazy { buildFlameBitmap() }
  // When a blocked app was last confirmed in front — see TRANSIT_HOLD_MS.
  private var lastBlockedSeenAtMs = 0L
  // Remaining time frozen at the moment of pausing, shown as static text
  // in the notification while paused.
  private var pausedRemainingMs = 0L
  private val logoBitmap: Bitmap? by lazy { buildLogoBitmap() }
  // See RETURN_TO_TINT_GRACE_MS.
  private var returningToTintUntilMs = 0L
  // Launcher(s) — which on gesture-nav phones also host the recents
  // switcher — plus system UI (notification shade, older recents). Being
  // "in front" here right after a blocked app is treated as passing
  // through, not as leaving. Resolved once in onCreate().
  private var transitPackages: Set<String> = setOf("com.android.systemui")

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
    transitPackages = transitPackages + resolveLauncherPackages()
  }

  // Every installed home-screen app (needs the HOME-intent <queries> entry
  // in this module's manifest to be visible on Android 11+). Failure just
  // leaves system UI as the only transit package — blocking still works,
  // only the recents-switcher hold is lost.
  private fun resolveLauncherPackages(): Set<String> {
    return try {
      val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
      packageManager.queryIntentActivities(homeIntent, 0)
        .mapNotNull { it.activityInfo?.packageName }
        .filter { it != ownPackageName }
        .toSet()
    } catch (e: Exception) {
      emptySet()
    }
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
        if (isPaused) pausedRemainingMs = (endAtMs - System.currentTimeMillis()).coerceAtLeast(0L)
        updateNotification()
        return START_STICKY
      }
      // User tapped Pause/Resume ON the notification itself. Flip the local
      // display flag immediately (so the notification reacts with no visible
      // lag) and forward the tap to JS, which drives the actual session
      // pause logic and will confirm back via ACTION_SET_PAUSED.
      ACTION_NOTIF_TOGGLE_PAUSE -> {
        isPaused = !isPaused
        val nowMs = System.currentTimeMillis()
        if (isPaused) {
          pausedRemainingMs = (endAtMs - nowMs).coerceAtLeast(0L)
        } else {
          // Resume from where it was paused until JS confirms the real
          // end time via ACTION_SET_PAUSED a moment later.
          endAtMs = nowMs + pausedRemainingMs
        }
        updateNotification()
        actionListener?.invoke(if (isPaused) "pause" else "resume")
        return START_STICKY
      }
      // User tapped End on the notification — forward to JS (which runs its
      // normal end-session flow) and tear down the service/notification
      // right away rather than waiting on the JS round trip.
      // Challenge emergency button: stop blocking for a fixed window, then
      // the normal polling picks blocking back up on its own.
      ACTION_EMERGENCY_PAUSE -> {
        val ms = intent?.getLongExtra(EXTRA_PAUSE_MS, 0L) ?: 0L
        emergencyUntilMs = System.currentTimeMillis() + ms
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
          .putLong(KEY_EMERGENCY_UNTIL, emergencyUntilMs).apply()
        removeOverlay()
        return START_STICKY
      }
      ACTION_NOTIF_END -> {
        actionListener?.invoke("end")
        stopBlockingAndSelf()
        return START_NOT_STICKY
      }
    }

    resumedActivities.clear()
    lastQueryEndMs = 0L
    lastBlockedSeenAtMs = 0L
    // After a reboot (BootReceiver) or an OS kill + restart (null intent),
    // bring a saved challenge back. Nothing saved and an explicit RESTORE
    // means there's nothing to do. A null intent with nothing saved falls
    // through to the old behavior, unchanged.
    val restoring = intent == null || intent.action == ACTION_RESTORE
    val restored = restoring && loadPersistedChallenge()
    if (intent?.action == ACTION_RESTORE && !restored) {
      stopSelf()
      return START_NOT_STICKY
    }
    if (!restored) {
      val packages = intent?.getStringArrayListExtra(EXTRA_PACKAGES) ?: arrayListOf()
      blockedPackages = packages.toSet()
      endAtMs = intent?.getLongExtra(EXTRA_END_AT_MS, 0L) ?: 0L
      title = intent?.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotBlank() } ?: "Focus session active"
      durationMins = intent?.getIntExtra(EXTRA_DURATION_MINS, 0) ?: 0
      isPaused = false
      challengeMode = intent?.getBooleanExtra(EXTRA_CHALLENGE, false) ?: false
      emergencyUntilMs = 0L
      if (challengeMode) persistChallenge()
    }
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

    // Custom minimal layout (see notification_focus.xml) instead of the
    // default template's title/body text pair -- that read as a generic
    // system notice (light card, plain black text) rather than Tint's own
    // thing. DecoratedCustomViewStyle keeps the OS chrome (small icon, app
    // name, timestamp, the action buttons below) and lets this content
    // area have its own dark gradient background.
    val views = RemoteViews(packageName, R.layout.notification_focus)
    views.setImageViewBitmap(R.id.notif_flame_icon, logoBitmap ?: flameBitmap)
    views.setImageViewResource(
      R.id.notif_toggle,
      if (isPaused) android.R.drawable.ic_media_play else android.R.drawable.ic_media_pause
    )
    views.setInt(R.id.notif_toggle, "setColorFilter", 0xFFFFFFFF.toInt())
    views.setOnClickPendingIntent(R.id.notif_toggle, togglePausePendingIntent)
    // A challenge can't be paused from the notification.
    if (challengeMode) views.setViewVisibility(R.id.notif_toggle, View.GONE)

    // Chronometer is elapsedRealtime-based (SystemClock.elapsedRealtime()),
    // not wall-clock epoch millis -- endAtMs is epoch millis (it's compared
    // against System.currentTimeMillis() elsewhere for the actual block
    // logic), so it has to be converted to an elapsedRealtime reference
    // point here or the countdown would show the wrong time entirely.
    if (challengeMode) {
      views.setTextViewText(R.id.notif_timer, formatChallengeTimeLeft())
    } else if (!isPaused && endAtMs > 0L) {
      val base = SystemClock.elapsedRealtime() + (endAtMs - System.currentTimeMillis())
      views.setChronometer(R.id.notif_timer, base, null, true)
      views.setChronometerCountDown(R.id.notif_timer, true)
    } else if (isPaused) {
      val totalSec = pausedRemainingMs / 1000
      // Stop any ticking from a previous update before writing static text.
      views.setChronometer(R.id.notif_timer, SystemClock.elapsedRealtime(), null, false)
      views.setTextViewText(R.id.notif_timer, String.format("%02d:%02d", totalSec / 60, totalSec % 60))
    } else {
      // Chronometer extends TextView, so this just overwrites its displayed
      // text with a static label -- safe because setChronometer (and the
      // start() call it makes internally) is only invoked in the branch
      // above, never here, so nothing is ticking to overwrite on the next
      // tick (endAtMs itself isn't adjusted on pause -- a pre-existing,
      // accepted gap).
      views.setTextViewText(R.id.notif_timer, "")
    }

    // Pause/resume lives inside the custom layout now (notif_toggle), so no
    // addAction buttons -- keeps the card to logo + timer + one control.
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(contentIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCustomContentView(views)
      .setCustomBigContentView(views)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())

    return builder.build()
  }

  // "6d 23h 59m" while there are days left, "5h 12m" on the last day.
  private fun formatChallengeTimeLeft(): String {
    val remaining = (endAtMs - System.currentTimeMillis()).coerceAtLeast(0L)
    val days = remaining / 86_400_000L
    val hours = (remaining % 86_400_000L) / 3_600_000L
    val mins = (remaining % 3_600_000L) / 60_000L
    return if (days > 0) "${days}d ${hours}h ${mins}m" else "${hours}h ${mins}m"
  }

  // The app's own launcher icon (the TINT logo) as a bitmap for the
  // notification's left image. Null if it can't be read -- caller falls
  // back to the pixel flame.
  private fun buildLogoBitmap(): Bitmap? {
    return try {
      val drawable = packageManager.getApplicationIcon(ownPackageName)
      val size = 144
      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      drawable.setBounds(0, 0, size, size)
      drawable.draw(canvas)
      bitmap
    } catch (e: Exception) {
      null
    }
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
        // Challenge countdown is plain text ("6d 23h"), not a ticking
        // chronometer, so it needs an occasional refresh.
        if (challengeMode &&
          System.currentTimeMillis() - lastNotificationRefreshMs >= NOTIFICATION_REFRESH_MS
        ) {
          lastNotificationRefreshMs = System.currentTimeMillis()
          try { updateNotification() } catch (e: Exception) { }
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

  // One tap on a blocked app = one more "urge" for that day, counted only
  // when a fresh block screen actually goes up (not on every poll).
  private fun recordBlockedOpen(pkg: String?) {
    if (pkg == null) return
    try {
      val day = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US).format(java.util.Date())
      val prefs = getSharedPreferences(STATS_PREFS_NAME, Context.MODE_PRIVATE)
      val key = STATS_KEY_PREFIX + day + "_" + pkg
      prefs.edit().putInt(key, prefs.getInt(key, 0) + 1).apply()
    } catch (e: Exception) {
      // Stats are best-effort; never let them affect blocking.
    }
  }

  private fun persistChallenge() {
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
      .putBoolean(KEY_ACTIVE, true)
      .putStringSet(KEY_PACKAGES, blockedPackages)
      .putLong(KEY_END_AT, endAtMs)
      .putString(KEY_TITLE, title)
      .putLong(KEY_EMERGENCY_UNTIL, 0L)
      .apply()
  }

  private fun clearPersistedChallenge() {
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
  }

  // Returns false (and clears) when nothing valid is saved.
  private fun loadPersistedChallenge(): Boolean {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    if (!prefs.getBoolean(KEY_ACTIVE, false)) return false
    val end = prefs.getLong(KEY_END_AT, 0L)
    if (end <= System.currentTimeMillis()) {
      clearPersistedChallenge()
      return false
    }
    blockedPackages = prefs.getStringSet(KEY_PACKAGES, emptySet())?.toSet() ?: emptySet()
    endAtMs = end
    title = prefs.getString(KEY_TITLE, null)?.takeIf { it.isNotBlank() } ?: "7 Day Lock In"
    durationMins = 0
    isPaused = false
    challengeMode = true
    emergencyUntilMs = prefs.getLong(KEY_EMERGENCY_UNTIL, 0L)
    return true
  }

  private fun stopBlockingAndSelf() {
    clearPersistedChallenge()
    stopPolling()
    lastBlockedSeenAtMs = 0L
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

    // Query failed -- an inconclusive reading. Do nothing rather than
    // guess; the next poll gets a real one.
    if (!updateForegroundState()) return
    val now = System.currentTimeMillis()

    // Emergency window: state above keeps tracking, but nothing is covered.
    if (now < emergencyUntilMs) {
      removeOverlay()
      return
    }

    if (lastResumedPackage == ownPackageName) returningToTintUntilMs = 0L
    val blockedAppOpen = resumedActivities.values.any { blockedPackages.contains(it) }

    when {
      // Just tapped "Return to TINT" and TINT hasn't come up yet — don't
      // re-cover the blocked app in the meantime.
      blockedAppOpen && now < returningToTintUntilMs -> {
      }
      blockedAppOpen -> {
        lastBlockedSeenAtMs = now
        overlayForPackage = resumedActivities.values.firstOrNull { blockedPackages.contains(it) }
        showOverlay()
      }
      // The blocked app really went away (home screen, another app):
      // drop the overlay right away, no lingering.
      else -> removeOverlay()
    }
  }

  // UsageStatsManager has no "what's in front right now" call, only a log of
  // activities coming to the front (resumed) and going away (paused /
  // stopped). An activity counts as open from its resume until its pause.
  //
  // Only looking at "which app resumed last" was the bypass: a quick flick
  // toward recents and back logs the launcher/recents resuming, but the
  // blocked app never actually paused, so it never logs a fresh resume
  // either -- the newest entry said "recents" while the blocked app was on
  // screen. Tracking pauses too means the blocked app stays "open" through
  // that flick and stays covered; actually leaving it logs a pause, which
  // drops the block immediately.
  //
  // Keyed by package/activity, valued by package.
  private val resumedActivities = HashMap<String, String>()
  private var lastResumedPackage: String? = null
  private var lastQueryEndMs = 0L

  // Reads new events since the last read and updates resumedActivities.
  // Returns false only if the query itself failed.
  private fun updateForegroundState(): Boolean {
    val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return false
    val end = System.currentTimeMillis()
    // Read from just before the last read (overlap catches events Android
    // logs late) rather than a fixed window, so state never ages out just
    // because nothing new happened for a while. Re-reading the overlap is
    // harmless: replaying the same events in order lands on the same state.
    // First read after (re)start: a challenge replays further back, so after
    // the phone kills and restarts the service it can rebuild which app is
    // open instead of waiting for that app's next event.
    val firstLookback = if (challengeMode) CHALLENGE_REPLAY_MS else LOOKBACK_MS
    val begin = if (lastQueryEndMs > 0L) lastQueryEndMs - QUERY_OVERLAP_MS else end - firstLookback
    val events = try {
      usm.queryEvents(begin, end)
    } catch (e: Exception) {
      return false
    }
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val pkg = event.packageName ?: continue
      val key = pkg + "/" + (event.className ?: "")
      val isQ = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
      val resumed = if (isQ) {
        event.eventType == UsageEvents.Event.ACTIVITY_RESUMED
      } else {
        @Suppress("DEPRECATION")
        event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
      }
      val gone = if (isQ) {
        event.eventType == UsageEvents.Event.ACTIVITY_PAUSED ||
          event.eventType == UsageEvents.Event.ACTIVITY_STOPPED
      } else {
        @Suppress("DEPRECATION")
        event.eventType == UsageEvents.Event.MOVE_TO_BACKGROUND
      }
      if (resumed) {
        // A real app (or TINT) coming to the front means anything else is
        // no longer in front -- this also clears an entry whose pause
        // Android never logged, so the overlay can't get stuck. The
        // launcher/recents/system UI don't clear: that's the flick.
        if (!transitPackages.contains(pkg)) {
          resumedActivities.entries.removeAll { it.value != pkg }
        }
        resumedActivities[key] = pkg
        lastResumedPackage = pkg
      } else if (gone) {
        resumedActivities.remove(key)
      }
    }
    lastQueryEndMs = end
    return true
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
        returningToTintUntilMs = System.currentTimeMillis() + RETURN_TO_TINT_GRACE_MS
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
      if (challengeMode) recordBlockedOpen(overlayForPackage)
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
