import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

function subscribe(onStoreChange: () => void) {
  const frame = requestAnimationFrame(onStoreChange);

  return () => cancelAnimationFrame(frame);
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
