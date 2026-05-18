import { Platform } from 'react-native';

const noop = async () => {};

export const useHaptics = () => {
  if (Platform.OS === 'web') {
    return { taskComplete: noop, taskUncomplete: noop, allComplete: noop, buttonPress: noop };
  }

  // Dynamically import so web bundle never tries to execute native haptics
  const run = async (fn: () => Promise<void>) => {
    try { await fn(); } catch {}
  };

  return {
    taskComplete: () => run(async () => {
      const H = await import('expo-haptics');
      await H.notificationAsync(H.NotificationFeedbackType.Success);
    }),
    taskUncomplete: () => run(async () => {
      const H = await import('expo-haptics');
      await H.impactAsync(H.ImpactFeedbackStyle.Light);
    }),
    allComplete: () => run(async () => {
      const H = await import('expo-haptics');
      await H.notificationAsync(H.NotificationFeedbackType.Success);
      setTimeout(() => H.impactAsync(H.ImpactFeedbackStyle.Heavy), 150);
      setTimeout(() => H.impactAsync(H.ImpactFeedbackStyle.Heavy), 300);
    }),
    buttonPress: () => run(async () => {
      const H = await import('expo-haptics');
      await H.impactAsync(H.ImpactFeedbackStyle.Medium);
    }),
  };
};
