import { ThemedText } from '@/shared/components/themed-text';
import { useTheme } from '@/shared/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface QrScannerModalProps {
  visible: boolean;
  /** Receives the raw QR payload. It is never parsed here — the backend validates it. */
  onScanned: (qrString: string) => void;
  onClose: () => void;
}

/**
 * Camera scanner for QR Ph withdrawal.
 *
 * The scanned string is passed through untouched: QR Ph is an EMVCo TLV payload whose
 * fields PayMongo validates server-side, and a client-side parse would only add a second
 * place for the format to be misread.
 */
export function QrScannerModal({ visible, onScanned, onClose }: QrScannerModalProps) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [isRequesting, setIsRequesting] = useState(false);
  // The camera fires repeatedly for a QR held in frame; one scan per open is enough.
  const handled = useRef(false);

  useEffect(() => {
    if (visible) handled.current = false;
  }, [visible]);

  if (!visible) return null;

  if (!permission?.granted) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <Ionicons name="camera-outline" size={48} color={theme.textSecondary} />
        <ThemedText style={{ color: theme.text, marginTop: 16, fontWeight: '600' }}>
          Camera access needed
        </ThemedText>
        <ThemedText
          style={{ color: theme.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}
        >
          Allow camera access to scan the recipient&apos;s QR Ph code.
        </ThemedText>
        <TouchableOpacity
          disabled={isRequesting}
          onPress={async () => {
            setIsRequesting(true);
            try {
              await requestPermission();
            } finally {
              setIsRequesting(false);
            }
          }}
          style={[styles.button, { backgroundColor: theme.primary }]}
        >
          <ThemedText style={{ color: theme.primaryText, fontWeight: '700' }}>
            {isRequesting ? 'Requesting…' : 'Allow camera'}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
          <ThemedText style={{ color: theme.textSecondary }}>Cancel</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current || !data) return;
          handled.current = true;
          onScanned(data);
        }}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.reticle} />

        <ThemedText style={styles.hint}>Point the camera at the QR Ph code</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  center: { alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  closeButton: { position: 'absolute', top: 56, left: 20 },
  reticle: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: { color: '#fff', marginTop: 24, fontSize: 14 },
  button: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
});
