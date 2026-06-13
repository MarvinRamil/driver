import * as SecureStore from 'expo-secure-store';

const KEY_EMAIL = 'last_login_email';
const KEY_FULL_NAME = 'last_login_name';

export interface LastLoginUser {
  email: string;
  fullName: string;
}

export async function getLastLoginUser(): Promise<LastLoginUser | null> {
  try {
    const email = await SecureStore.getItemAsync(KEY_EMAIL);
    const fullName = await SecureStore.getItemAsync(KEY_FULL_NAME);
    if (email && fullName) return { email, fullName };
    return null;
  } catch {
    return null;
  }
}

export async function setLastLoginUser(user: LastLoginUser): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY_EMAIL, user.email);
    await SecureStore.setItemAsync(KEY_FULL_NAME, user.fullName);
  } catch {
    // ignore
  }
}

export async function clearLastLoginUser(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_EMAIL);
    await SecureStore.deleteItemAsync(KEY_FULL_NAME);
  } catch {
    // ignore
  }
}
