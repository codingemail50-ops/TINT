import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily', {
      name: 'Daily Reminder',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🔥 Don't break your streak!",
      body: "Your tasks are waiting. Open TINT and get it done.",
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });
}

export async function notifySkippedTasks(taskNames: string[]) {
  if (taskNames.length === 0) return;
  const list = taskNames.slice(0, 3).join(', ');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Repeatedly skipped tasks',
      body: `You keep skipping: ${list}. Don't let these slip!`,
      sound: 'default',
    },
    trigger: null,
  });
}
