import * as SecureStore from 'expo-secure-store';

const KEY_EMAIL = 'last_login_email';
const KEY_FULL_NAME = 'last_login_name';
const KEY_PHOTO_URL = 'last_login_photo';

export interface LastLoginUser {
  email: string;
  fullName: string;
  /** Optional profile picture URL; the welcome-back screen shows it if present, else initials. */
  photoUrl?: string;
}

export async function getLastLoginUser(): Promise<LastLoginUser | null> {
  try {
    const email = await SecureStore.getItemAsync(KEY_EMAIL);
    const fullName = await SecureStore.getItemAsync(KEY_FULL_NAME);
    const photoUrl = await SecureStore.getItemAsync(KEY_PHOTO_URL);
    if (email && fullName) return { email, fullName, photoUrl: photoUrl ?? undefined };
    return null;
  } catch {
    return null;
  }
}

export async function setLastLoginUser(user: LastLoginUser): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY_EMAIL, user.email);
    await SecureStore.setItemAsync(KEY_FULL_NAME, user.fullName);
    if (user.photoUrl) {
      await SecureStore.setItemAsync(KEY_PHOTO_URL, user.photoUrl);
    } else {
      await SecureStore.deleteItemAsync(KEY_PHOTO_URL);
    }
  } catch {
    // ignore
  }
}

export async function clearLastLoginUser(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_EMAIL);
    await SecureStore.deleteItemAsync(KEY_FULL_NAME);
    await SecureStore.deleteItemAsync(KEY_PHOTO_URL);
  } catch {
    // ignore
  }
}
