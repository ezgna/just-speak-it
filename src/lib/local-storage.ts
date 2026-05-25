import { createMMKV } from 'react-native-mmkv';

const appStorage = createMMKV({
  id: 'just-speak-it',
});

export function getLocalString(key: string) {
  try {
    return appStorage.getString(key) ?? null;
  } catch {
    return null;
  }
}

export function setLocalString(key: string, value: string) {
  try {
    appStorage.set(key, value);
  } catch {
    return;
  }
}

export function removeLocalValue(key: string) {
  try {
    appStorage.remove(key);
  } catch {
    return;
  }
}

export const supabaseAuthStorage = {
  getItem: getLocalString,
  setItem: setLocalString,
  removeItem: removeLocalValue,
};
