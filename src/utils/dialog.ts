// One place for every message box in the app, in TINT's own look.
//
// tintAlert() takes the same arguments as React Native's Alert.alert, so a call
// site only changes its name. It hands the box to <DialogHost /> (mounted once in
// App.tsx), which draws it in TINT's black, grey and orange instead of Android's
// plain grey system dialog. If the host is not mounted yet, it falls back to the
// system alert, so a message is never lost.

import { Alert, AlertButton } from 'react-native';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
}

export interface DialogSpec {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

type Host = (spec: DialogSpec) => void;
let host: Host | null = null;

/** Called by <DialogHost />. Returns the function that unregisters it. */
export function registerDialogHost(fn: Host): () => void {
  host = fn;
  return () => { if (host === fn) host = null; };
}

export function tintAlert(title: string, message?: string, buttons?: DialogButton[]): void {
  const spec: DialogSpec = {
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
  };
  if (host) host(spec);
  else Alert.alert(title, message, spec.buttons as AlertButton[]);
}
