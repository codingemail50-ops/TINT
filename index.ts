// Must be the very first thing that runs, before anything (including this
// file's own other imports) touches @supabase/supabase-js — Hermes (React
// Native's JS engine) has no `crypto` or `URL` globals by default, and
// GoTrue (supabase-js's auth client) uses both internally. Without these,
// calls like getSession()/signInAnonymously() can throw inside code that
// silently swallows the error and falls back to "no session" — which reads
// as a returning user randomly being treated as brand-new, and never shows
// up in a browser-based dev preview since browsers already have both
// globals natively. Order matters: get-random-values before url-polyfill.
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
