package expo.modules.tintappblocker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

// Brings an active 7-day challenge's blocking back after a phone reboot or an
// app update. Does nothing unless a challenge is saved and still running --
// ordinary focus sessions never persist, so they're never restarted here.
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (!BlockingForegroundService.hasActiveChallenge(context)) return
    val serviceIntent = Intent(context, BlockingForegroundService::class.java).apply {
      this.action = BlockingForegroundService.ACTION_RESTORE
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
      } else {
        context.startService(serviceIntent)
      }
    } catch (e: Exception) {
      // OEM background-start restrictions -- the next app open re-arms it.
    }
  }
}
