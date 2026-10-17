package expo.modules.tintappblocker

// The rules for how a focus session and a 7 Day Lock In share the one blocking
// service. No Android classes in here on purpose: it can be unit-tested on a
// plain JVM, and BlockingForegroundService just asks it.
//
// The bug this exists for: the service has a single set of settings (apps, end
// time, mode). A focus session used to OVERWRITE them, so starting, pausing or
// ending a focus session while a challenge was running replaced the challenge's
// apps and end time, and the session ending then stopped the whole service and
// wiped the saved challenge. The challenge silently stopped blocking, with
// days still left. A running challenge now always wins: a session only adds its
// own apps on top for as long as it lasts, and never ends the challenge.
internal object ChallengeGuard {

  /**
   * True for a focus-session start: the START action (or none), without the
   * challenge flag. Restore, stop, pause and the other actions are not starts.
   */
  fun isSessionStart(
    hasIntent: Boolean,
    action: String?,
    challengeExtra: Boolean,
    startAction: String,
  ): Boolean = hasIntent && (action == null || action == startAction) && !challengeExtra

  /**
   * The apps that must be covered right now.
   *
   * - Not a challenge: just [mainPackages] (the session's apps).
   * - A challenge: [mainPackages] are the challenge's apps, covered once it has
   *   started and outside an emergency window. Apps added by a focus session
   *   are covered until that session's end, even before a delayed challenge
   *   starts or during the challenge's emergency window (the person started
   *   that session on purpose).
   */
  fun effectiveBlocked(
    mainPackages: Set<String>,
    challengeMode: Boolean,
    startAtMs: Long,
    emergencyUntilMs: Long,
    sessionPackages: Set<String>,
    sessionEndAtMs: Long,
    now: Long,
  ): Set<String> {
    if (!challengeMode) return mainPackages
    val challengeOn = now >= startAtMs && now >= emergencyUntilMs
    val sessionOn = sessionEndAtMs > now
    return when {
      challengeOn && sessionOn -> mainPackages + sessionPackages
      challengeOn -> mainPackages
      sessionOn -> sessionPackages
      else -> emptySet()
    }
  }
}
