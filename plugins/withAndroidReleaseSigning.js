const { withAppBuildGradle } = require('@expo/config-plugins');

// Expo's default generated android/app/build.gradle signs BOTH debug and
// release build types with the same throwaway debug keystore -- there is no
// built-in mechanism for a real release signing key at all (the template
// even leaves a "Caution! In production, you need to generate your own
// keystore file" comment in place of one). Since android/ is never
// committed here (Expo regenerates it fresh on every prebuild), any manual
// edit to build.gradle itself would be silently wiped out the next time
// prebuild runs -- a config plugin is the only way to make this change
// durable.
//
// The real upload keystore's path/passwords are read from environment
// variables at Gradle-build time, not baked in here or committed anywhere.
// When they're not set (a plain local `expo run:android`, or anyone
// building without the real credentials configured), this quietly falls
// back to the same debug-keystore behaviour the template ships with, so
// nothing breaks for a casual build -- only a build that's deliberately
// given the real credentials produces a release APK signed with them.
const DEBUG_SIGNING_BLOCK = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const REPLACEMENT = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (System.getenv('TINT_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('TINT_UPLOAD_STORE_FILE'))
                storePassword System.getenv('TINT_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('TINT_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('TINT_UPLOAD_KEY_PASSWORD')
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Real upload key when TINT_UPLOAD_STORE_FILE etc. are set (see
            // signingConfigs.release above and .github/workflows/build-android.yml);
            // falls back to the debug keystore otherwise.
            signingConfig signingConfigs.release`;

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const { contents } = config.modResults;
    if (!contents.includes(DEBUG_SIGNING_BLOCK)) {
      // Fail loudly rather than silently shipping a debug-signed "release"
      // build with no one noticing -- this means Expo's template changed
      // and the string match above needs updating to match it.
      throw new Error(
        'withAndroidReleaseSigning: expected debug signingConfig block not found in ' +
        'android/app/build.gradle -- the Expo template has likely changed shape ' +
        '(check plugins/withAndroidReleaseSigning.js against the new generated file).'
      );
    }
    config.modResults.contents = contents.replace(DEBUG_SIGNING_BLOCK, REPLACEMENT);
    return config;
  });
}

module.exports = withAndroidReleaseSigning;
