/**
 * Saving a BeeWallet QR out of the app, so a driver can print it, stick it on the bike, or send it
 * to a customer.
 *
 * The two native modules are loaded lazily rather than imported at the top of the file, and that
 * is deliberate. Expo modules resolve their native counterpart when the JS module is first
 * evaluated, so a static import throws on any binary built before these packages were added —
 * and this app ships JS-only updates over expo-updates, so older binaries running newer JS is the
 * normal case, not an edge case. Loading on demand turns "old binary" into a hidden button
 * instead of a crash on opening the wallet.
 */

type SharingModule = typeof import('expo-sharing');
type FileSystemModule = typeof import('expo-file-system');

let cached: { sharing: SharingModule; fs: FileSystemModule } | null | undefined;

/** Resolves the native modules once, or null if this binary does not carry them. */
function loadModules() {
  if (cached !== undefined) return cached;
  try {
    cached = {
      sharing: require('expo-sharing') as SharingModule,
      fs: require('expo-file-system') as FileSystemModule,
    };
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Whether saving is possible at all: the native modules are present *and* the OS exposes a share
 * sheet. Both have to hold, and neither is guaranteed — the Android share sheet is absent on some
 * stripped builds.
 */
export async function canSaveQrImage(): Promise<boolean> {
  const modules = loadModules();
  if (!modules) return false;
  try {
    return await modules.sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

export type SaveQrResult = { ok: true } | { ok: false; reason: string };

/**
 * Writes the QR to a cache file and opens the OS share sheet, which is where both "Save to
 * Photos" and "send to a customer" live.
 *
 * @param dataUri The `data:image/png;base64,...` the backend renders. PayMongo returns only the
 *   QR *payload* string, never an image, so this PNG is ours and is the only thing there is to
 *   save.
 */
export async function saveQrImage(dataUri: string, fileName = 'beewallet-qr.png'): Promise<SaveQrResult> {
  const modules = loadModules();
  if (!modules) return { ok: false, reason: 'Saving needs a newer version of the app.' };

  const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
  if (!base64 || base64 === dataUri) {
    // Not a data URI we produced. Writing it would save a file of garbage bytes that fails to
    // open later, well away from anything that would point back here.
    return { ok: false, reason: 'That QR image cannot be saved.' };
  }

  try {
    if (!(await modules.sharing.isAvailableAsync())) {
      return { ok: false, reason: 'Sharing is not available on this device.' };
    }

    // Cache, not documents: this is a re-derivable copy of a QR the backend will hand us again,
    // so letting the OS reclaim it under storage pressure costs nothing.
    const file = new modules.fs.File(modules.fs.Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(base64, { encoding: 'base64' });

    await modules.sharing.shareAsync(file.uri, {
      mimeType: 'image/png',
      dialogTitle: 'Save or share your BeeWallet QR',
      UTI: 'public.png',
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Could not save the QR.' };
  }
}
