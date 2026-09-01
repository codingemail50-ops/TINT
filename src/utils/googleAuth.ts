// Guarded access to @react-native-google-signin/google-signin.
//
// That package's native binding uses TurboModuleRegistry.getEnforcing,
// which throws SYNCHRONOUSLY at import time when the native module isn't
// linked — true everywhere except a real Android build (Expo Go, web
// preview, iOS all hit this). A plain top-level `import` of the package
// would crash the whole module graph of anything that imports it in those
// environments, which includes the web dev server used for this project's
// usual Playwright/tsc QA loop — so the require is deferred behind a
// Platform check and wrapped in try/catch instead of statically imported.

import { Platform } from 'react-native';
import type * as GoogleSigninPkg from '@react-native-google-signin/google-signin';

let pkg: typeof GoogleSigninPkg | null = null;

if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    pkg = require('@react-native-google-signin/google-signin');
  } catch {
    pkg = null;
  }
}

export const GoogleSignin = pkg?.GoogleSignin ?? null;
export const isSuccessResponse = pkg?.isSuccessResponse ?? null;
export const isErrorWithCode = pkg?.isErrorWithCode ?? null;
export const statusCodes = pkg?.statusCodes ?? null;

export function isGoogleSignInAvailable(): boolean {
  return pkg !== null;
}
