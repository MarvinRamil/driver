import * as SecureStore from 'expo-secure-store';

const KEY_SUBMITTED = 'driver_application_submitted';

export async function setDriverApplicationSubmitted(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY_SUBMITTED, 'true');
  } catch {
    // ignore
  }
}

export async function getDriverApplicationSubmitted(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(KEY_SUBMITTED);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function clearDriverApplicationSubmitted(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_SUBMITTED);
  } catch {
    // ignore
  }
}
