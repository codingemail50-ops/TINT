package expo.modules.tintappblocker

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// JS-facing bridge only — all the actual blocking logic (polling,
// foreground service, overlay) lives in BlockingForegroundService. Keeping
// this module a thin dispatcher makes the two independently readable and
// keeps the JS surface tiny and stable.
class TintAppBlockerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TintAppBlocker")

    // Fire-and-forget: starts (or updates the block list of) the foreground
    // service. Safe to call repeatedly — e.g. on every focus-session resume.
    Function("startBlocking") { packageNames: List<String> ->
      // Expo Modules' Function {} blocks are typed to return Any? regardless
      // of body — a bare `return@Function` (no value) is only legal when the
      // enclosing function type is Unit, so every early exit here needs an
      // explicit value.
      val context = appContext.reactContext ?: return@Function Unit
      val intent = Intent(context, BlockingForegroundService::class.java).apply {
        action = BlockingForegroundService.ACTION_START
        putStringArrayListExtra(BlockingForegroundService.EXTRA_PACKAGES, ArrayList(packageNames))
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      Unit
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
