package expo.modules.tintappblocker

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import org.json.JSONObject
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// JS-facing bridge only — all the actual blocking logic (polling,
// foreground service, overlay) lives in BlockingForegroundService. Keeping
// this module a thin dispatcher makes the two independently readable and
// keeps the JS surface tiny and stable.
class TintAppBlockerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TintAppBlocker")

    Events("onFocusNotificationAction")

    // The notification's Pause/Resume/End buttons can't call back into JS
    // directly — they PendingIntent back into this same Service (the only
    // component the OS will actually deliver a notification-action tap to).
    // The service forwards each tap through this in-process static callback
    // (safe: confirmed no android:process split in the manifest, so this is
    // a same-process, same-classloader call) and this module re-emits it as
    // a normal JS event.
    OnCreate {
      BlockingForegroundService.actionListener = { action ->
        sendEvent("onFocusNotificationAction", mapOf("action" to action))
      }
    }

    // Fire-and-forget: starts (or updates) the foreground service, which
    // always shows a persistent, live-counting-down notification for the
    // session (endAtMs drives it) and additionally polls+blocks anything in
    // packageNames when that list isn't empty. Safe to call repeatedly —
    // e.g. on every focus-session resume. title/durationMins are shown on
    // the notification itself.
    Function("startBlocking") { packageNames: List<String>, endAtMs: Double, title: String, durationMins: Double ->
      val context = appContext.reactContext ?: return@Function Unit
      val intent = Intent(context, BlockingForegroundService::class.java).apply {
        action = BlockingForegroundService.ACTION_START
        putStringArrayListExtra(BlockingForegroundService.EXTRA_PACKAGES, ArrayList(packageNames))
        putExtra(BlockingForegroundService.EXTRA_END_AT_MS, endAtMs.toLong())
        putExtra(BlockingForegroundService.EXTRA_TITLE, title)
        putExtra(BlockingForegroundService.EXTRA_DURATION_MINS, durationMins.toInt())
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      Unit
    }

    // 7-day challenge: same blocking engine, but saved so it survives kills
    // and reboots, with a "6d 23h" notification and no pause button. Runs
    // from startAtMs (0 = now) until endAtMs (or stopBlocking).
    Function("startChallengeBlocking") { packageNames: List<String>, startAtMs: Double, endAtMs: Double, title: String ->
      val context = appContext.reactContext ?: return@Function Unit
      val intent = Intent(context, BlockingForegroundService::class.java).apply {
        action = BlockingForegroundService.ACTION_START
        putStringArrayListExtra(BlockingForegroundService.EXTRA_PACKAGES, ArrayList(packageNames))
        putExtra(BlockingForegroundService.EXTRA_END_AT_MS, endAtMs.toLong())
        putExtra(BlockingForegroundService.EXTRA_TITLE, title)
        putExtra(BlockingForegroundService.EXTRA_CHALLENGE, true)
        putExtra(BlockingForegroundService.EXTRA_START_AT_MS, startAtMs.toLong())
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      Unit
    }

    // Challenge emergency button: lifts blocking for durationMs, then it
    // resumes by itself.
    Function("emergencyPause") { durationMs: Double ->
      val context = appContext.reactContext ?: return@Function Unit
      val intent = Intent(context, BlockingForegroundService::class.java).apply {
        action = BlockingForegroundService.ACTION_EMERGENCY_PAUSE
        putExtra(BlockingForegroundService.EXTRA_PAUSE_MS, durationMs.toLong())
      }
      try {
        context.startService(intent)
      } catch (e: Exception) {
        // Service not running -- nothing is blocking, so nothing to lift.
      }
      Unit
    }

    // Per-day counts of how many times a blocked app was opened during a
    // challenge: {"20261010": {"com.instagram.android": 12, ...}, ...}.
    Function("getChallengeBlockStats") {
      val context = appContext.reactContext ?: return@Function "{}"
      readChallengeBlockStats(context)
    }

    // Real usage of the given apps between two times, from Android's own
    // usage log (it only keeps about a week, so the challenge takes the
    // "before" snapshot when it starts): {"pkg": {"opens": n, "foregroundMs": ms}}.
    Function("getUsageSummary") { packageNames: List<String>, fromMs: Double, toMs: Double ->
      val context = appContext.reactContext ?: return@Function "{}"
      computeUsageSummary(context, packageNames.toSet(), fromMs.toLong(), toMs.toLong())
    }

    Function("stopBlocking") {
      val context = appContext.reactContext ?: return@Function Unit
      val intent = Intent(context, BlockingForegroundService::class.java).apply {
        action = BlockingForegroundService.ACTION_STOP
      }
      // startService (not startForegroundService) for the stop signal — the
      // service is already running in the foreground state at this point
      // (or isn't running at all, in which case this is a harmless no-op
      // once onStartCommand sees ACTION_STOP with no prior startForeground).
      try {
        context.startService(intent)
      } catch (e: Exception) {
        // Service already gone (process killed, task swiped) — nothing to stop.
      }
      Unit
    }

    // A focus session ended (finished, ended early, left). Unlike
    // stopBlocking this never ends a running 7 Day Lock In: the service only
    // drops the session's own apps, and stops itself only if no challenge is
    // running. Use stopBlocking for the things that really end everything
    // (leaving or finishing a challenge, logging out, deleting the account).
    Function("stopSessionBlocking") {
      val context = appContext.reactContext ?: return@Function Unit
      val intent = Intent(context, BlockingForegroundService::class.java).apply {
        action = BlockingForegroundService.ACTION_STOP_SESSION
      }
      try {
        context.startService(intent)
      } catch (e: Exception) {
        // Service already gone (process killed, task swiped) — nothing to stop.
      }
      Unit
    }

    // Reflects a JS-driven pause/resume into the notification (icon, label,
    // chronometer) — the JS side remains the source of truth for session
    // state, this just forwards it to update what's on-screen.
    Function("setPaused") { paused: Boolean, endAtMs: Double ->
      val context = appContext.reactContext ?: return@Function Unit
      val intent = Intent(context, BlockingForegroundService::class.java).apply {
        action = BlockingForegroundService.ACTION_SET_PAUSED
        putExtra(BlockingForegroundService.EXTRA_PAUSED, paused)
        putExtra(BlockingForegroundService.EXTRA_END_AT_MS, endAtMs.toLong())
      }
      try {
        context.startService(intent)
      } catch (e: Exception) {
        // Service not running — nothing to update.
      }
      Unit
    }

    // Real, OS-reported grant state — replaces the old self-reported flag
    // for anything running this native module.
    Function("hasUsageAccess") {
      val context = appContext.reactContext ?: return@Function false
      hasUsageAccessPermission(context)
    }

    Function("hasOverlayPermission") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Settings.canDrawOverlays(context)
      } else {
        true
      }
    }
  }
}

internal fun readChallengeBlockStats(context: Context): String {
  val result = JSONObject()
  try {
    val prefs = context.getSharedPreferences(
      BlockingForegroundService.STATS_PREFS_NAME, Context.MODE_PRIVATE
    )
    val prefix = BlockingForegroundService.STATS_KEY_PREFIX
    for ((key, value) in prefs.all) {
      if (!key.startsWith(prefix) || value !is Int) continue
      val rest = key.substring(prefix.length)
      val sep = rest.indexOf('_')
      if (sep <= 0) continue
      val day = rest.substring(0, sep)
      val pkg = rest.substring(sep + 1)
      val perDay = result.optJSONObject(day) ?: JSONObject().also { result.put(day, it) }
      perDay.put(pkg, value)
    }
  } catch (e: Exception) {
    // Best-effort.
  }
  return result.toString()
}

// Event types by their fixed Android values (the named constants differ by
// API level but the numbers are the same): 1 = came to front, 2 = went to
// background / paused, 23 = stopped.
internal fun computeUsageSummary(
  context: Context,
  packages: Set<String>,
  fromMs: Long,
  toMs: Long
): String {
  val opens = HashMap<String, Int>()
  val foreground = HashMap<String, Long>()
  try {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
    val events = usm?.queryEvents(fromMs, toMs)
    if (events != null) {
      val event = UsageEvents.Event()
      val resumedAt = HashMap<String, Long>()
      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        val pkg = event.packageName ?: continue
        if (!packages.contains(pkg)) continue
        val key = pkg + "/" + (event.className ?: "")
        when (event.eventType) {
          1 -> {
            if (resumedAt.keys.none { it.startsWith("$pkg/") }) {
              opens[pkg] = (opens[pkg] ?: 0) + 1
            }
            resumedAt[key] = event.timeStamp
          }
          2, 23 -> {
            val start = resumedAt.remove(key)
            if (start != null) {
              foreground[pkg] = (foreground[pkg] ?: 0L) + (event.timeStamp - start).coerceAtLeast(0L)
            }
          }
        }
      }
      for ((key, start) in resumedAt) {
        val pkg = key.substringBefore("/")
        foreground[pkg] = (foreground[pkg] ?: 0L) + (toMs - start).coerceAtLeast(0L)
      }
    }
  } catch (e: Exception) {
    // Best-effort: fall through with whatever was gathered.
  }
  val result = JSONObject()
  for (pkg in packages) {
    result.put(pkg, JSONObject().put("opens", opens[pkg] ?: 0).put("foregroundMs", foreground[pkg] ?: 0L))
  }
  return result.toString()
}

internal fun hasUsageAccessPermission(context: Context): Boolean {
  val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
  val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
  } else {
    @Suppress("DEPRECATION")
    appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
  }
  return mode == AppOpsManager.MODE_ALLOWED
}
