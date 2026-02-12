import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { BeeColors } from '@/constants/theme';
import * as ImagePicker from 'expo-image-picker';

interface SelfieCaptureProps {
  onSelfieCaptured: (imageUri: string) => void;
  onBack: () => void;
}

/**
 * Selfie capture component
 * Allows user to capture a selfie photo
 */
export function SelfieCapture({ onSelfieCaptured, onBack }: SelfieCaptureProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo?.uri) {
        setCapturedImage(photo.uri);
      }
    } catch (error) {
      console.error('[SelfieCapture] Error capturing photo:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[SelfieCapture] Error picking image:', error);
    }
  };

  const handleUsePhoto = () => {
    if (capturedImage) {
      onSelfieCaptured(capturedImage);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.permissionTitle, { color: theme.text }]}>
            Camera Permission Required
          </Text>
          <Text style={[styles.permissionText, { color: theme.textSecondary }]}>
            We need access to your camera to take your selfie.
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: theme.primary }]}
            onPress={requestPermission}>
            <Text style={[styles.permissionButtonText, { color: theme.primaryText }]}>
              Grant Permission
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Take Selfie</Text>
        <View style={styles.headerSpacer} />
      </View>

      {capturedImage ? (
        /* Preview captured image */
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={handleRetake}>
              <Ionicons name="refresh-outline" size={24} color={theme.text} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={handleUsePhoto}>
              <Ionicons name="checkmark-circle-outline" size={24} color={theme.primaryText} />
              <Text style={[styles.actionButtonText, { color: theme.primaryText }]}>
                Use This Photo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Camera view */
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing={facing} mode="picture">
            {/* Overlay guide */}
            <View style={styles.overlay}>
              <View style={[styles.guideFrame, { borderColor: theme.primary }]} />
              <Text style={[styles.guideText, { color: theme.primaryText }]}>
                Position your face within the frame
              </Text>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: theme.surface + 'CC' }]}
                onPress={handlePickFromGallery}>
                <Ionicons name="images-outline" size={24} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureButton, { backgroundColor: theme.primary }]}
                onPress={handleCapture}
                disabled={isCapturing}>
                {isCapturing ? (
                  <ActivityIndicator size="small" color={theme.primaryText} />
                ) : (
                  <View style={[styles.captureButtonInner, { backgroundColor: theme.primaryText }]} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: theme.surface + 'CC' }]}
                onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}>
                <Ionicons name="camera-reverse-outline" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BeeColors.yellow[500],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideFrame: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 3,
  },
  guideText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  previewActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
