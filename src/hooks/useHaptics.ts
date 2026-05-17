import * as Haptics from 'expo-haptics';

export const useHaptics = () => {
  const taskComplete = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const taskUncomplete = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const allComplete = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
  };

  const buttonPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return { taskComplete, taskUncomplete, allComplete, buttonPress };
};
