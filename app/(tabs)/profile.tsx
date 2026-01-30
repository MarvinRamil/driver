import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, TextInput, TouchableOpacity, Alert, Switch, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/shared/hooks/use-theme';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile';
import { useDriverStatusContext } from '@/features/driver/context/DriverStatusContext';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { biometricAuth } from '@/shared/services/biometricAuth';
import { biometricStorage } from '@/shared/services/biometricStorage';

/**
 * Profile screen
 * Matches prepared design with profile picture, stats, and detailed sections
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isLoading, error, updateProfile, changePassword, uploadProfilePicture } = useProfile();
  const { isOnline, toggleOnlineStatus, isLoading: statusLoading } = useDriverStatusContext();
  const [profileImageUri, setProfileImageUri] = useState<string | null>(
    user?.profilePictureUrl || null
  );

  // Update profile image when user changes
  React.useEffect(() => {
    setProfileImageUri(user?.profilePictureUrl || null);
  }, [user?.profilePictureUrl]);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '+1 555-0123');
  const [licenseExpiry, setLicenseExpiry] = useState('12/2025');
  const [vehicle, setVehicle] = useState('Toyota Prius (Yellow)');
  const [licensePlate, setLicensePlate] = useState('BEE-425');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [isCheckingBiometric, setIsCheckingBiometric] = useState(true);

  const isSoloDriver = user?.role === 'Driver';

  // Check biometric status on mount
  React.useEffect(() => {
    const checkBiometric = async () => {
      try {
        const available = await biometricAuth.isAvailable();
        const hasCredentials = await biometricStorage.hasStoredCredentials();
        const type = await biometricAuth.getBiometricTypeName();
        
        setBiometricAvailable(available);
        setBiometricEnabled(available && hasCredentials);
        setBiometricType(type);
      } catch (error) {
        console.warn('[ProfileScreen] Error checking biometric:', error);
        setBiometricAvailable(false);
        setBiometricEnabled(false);
      } finally {
        setIsCheckingBiometric(false);
      }
    };

    checkBiometric();
  }, []);

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Enable biometric - need to store credentials
      // This should prompt user to login again to store credentials
      Alert.alert(
        'Enable Biometric Login',
        `To enable ${biometricType}, please logout and login again. Your credentials will be securely stored for biometric login.`,
        [{ text: 'OK' }]
      );
    } else {
      // Disable biometric - clear stored credentials
      try {
        await biometricStorage.clearCredentials();
        setBiometricEnabled(false);
        Alert.alert('Success', 'Biometric login has been disabled.');
      } catch (error) {
        Alert.alert('Error', 'Failed to disable biometric login. Please try again.');
      }
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await updateProfile({
        fullName,
        email,
      });
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Success', 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  const handlePickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to upload your profile picture.');
        return;
      }

      // Show action sheet to choose between camera and library
      Alert.alert(
        'Select Profile Picture',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Take Photo',
            onPress: async () => {
              const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
              if (cameraStatus !== 'granted') {
                Alert.alert('Permission Required', 'Please grant camera access to take a photo.');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                await handleUploadImage(result.assets[0].uri);
              }
            },
          },
          {
            text: 'Choose from Library',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                await handleUploadImage(result.assets[0].uri);
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to pick image');
    }
  };

  const handleUploadImage = async (uri: string) => {
    try {
      setProfileImageUri(uri); // Optimistically update UI
      const imageUrl = await uploadProfilePicture(uri);
      setProfileImageUri(imageUrl);
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (err) {
      // Revert to previous image on error
      setProfileImageUri(user?.profilePictureUrl || null);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload profile picture');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Top App Bar */}
        <View style={[styles.topBar, { backgroundColor: theme.background + 'E6' }]}>
          <ThemedText type="title" style={[styles.topBarTitle, { color: theme.text }]}>
            My Profile
          </ThemedText>
          <TouchableOpacity>
            <Ionicons name="settings-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity
            style={styles.profileImageContainer}
            onPress={handlePickImage}
            disabled={isLoading}>
            {profileImageUri ? (
              <Image
                source={{ uri: profileImageUri }}
                style={[styles.profileImage, { borderColor: theme.surface }]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.profileImage, { borderColor: theme.surface }]}>
                <Ionicons name="person" size={48} color={theme.primary} />
              </View>
            )}
            <View style={[styles.editImageButton, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={16} color="#111" />
            </View>
            {isSoloDriver && (
              <View style={[styles.soloBadge, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.soloBadgeText, { color: '#111' }]}>SOLO</ThemedText>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <ThemedText style={[styles.profileName, { color: theme.text }]}>
              {user?.fullName || 'John "Buzz" Doe'}
            </ThemedText>
            <ThemedText style={[styles.profileSubtitle, { color: theme.textSecondary }]}>
              Member since 2023
            </ThemedText>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.statContent}>
              <Ionicons name="star" size={28} color={theme.primary} />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>4.9</ThemedText>
            </View>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Driver Rating
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.statContent}>
              <Ionicons name="cube-outline" size={28} color={theme.primary} />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>1,240</ThemedText>
            </View>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Total Trips
            </ThemedText>
          </View>
        </View>

        {/* Online Status Toggle */}
        <View style={[styles.onlineStatusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.onlineStatusLeft}>
            <View style={[styles.onlineIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="flash" size={20} color={theme.primary} />
            </View>
            <View>
              <ThemedText style={[styles.onlineStatusTitle, { color: theme.text }]}>
                Online Status
              </ThemedText>
              <ThemedText style={[styles.onlineStatusSubtitle, { color: theme.textSecondary }]}>
                {isOnline ? 'Accepting new bookings' : 'Currently offline'}
              </ThemedText>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={toggleOnlineStatus}
            trackColor={{ false: theme.toggleOffTrack, true: theme.toggleOnTrack }}
            thumbColor={isOnline ? theme.toggleOnKnob : theme.toggleOffKnob}
            disabled={statusLoading}
          />
        </View>

        {/* Biometric Settings */}
        {biometricAvailable && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
              Security Settings
            </ThemedText>
            <View style={[styles.onlineStatusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.onlineStatusLeft}>
                <View style={[styles.onlineIcon, { backgroundColor: theme.primary + '20' }]}>
                  <Ionicons name="fingerprint-outline" size={20} color={theme.primary} />
                </View>
                <View>
                  <ThemedText style={[styles.onlineStatusTitle, { color: theme.text }]}>
                    {biometricType} Login
                  </ThemedText>
                  <ThemedText style={[styles.onlineStatusSubtitle, { color: theme.textSecondary }]}>
                    {biometricEnabled ? `Use ${biometricType} to login quickly` : 'Enable quick login with biometric'}
                  </ThemedText>
                </View>
              </View>
              {isCheckingBiometric ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: theme.toggleOffTrack, true: theme.toggleOnTrack }}
                  thumbColor={biometricEnabled ? theme.toggleOnKnob : theme.toggleOffKnob}
                />
              )}
            </View>
          </View>
        )}

        {/* Personal Details Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            Personal Details
          </ThemedText>
          <View style={[styles.detailsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Phone */}
            <TouchableOpacity style={[styles.detailItem, { borderBottomColor: theme.border }]}>
              <View style={[styles.detailIcon, { backgroundColor: theme.border }]}>
                <Ionicons name="call-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.detailContent}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Phone Number
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                  {phone}
                </ThemedText>
              </View>
              <TouchableOpacity>
                <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Email */}
            <View style={[styles.detailItem, { borderBottomColor: theme.border }]}>
              <View style={[styles.detailIcon, { backgroundColor: theme.border }]}>
                <Ionicons name="mail-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.detailContent}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Email
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>
                  {email || user?.email || 'john.buzz.doe@bee.com'}
                </ThemedText>
              </View>
            </View>

            {/* License */}
            <View style={styles.detailItem}>
              <View style={[styles.detailIcon, { backgroundColor: theme.border }]}>
                <Ionicons name="card-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.detailContent}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  License Expiry
                </ThemedText>
                <View style={styles.licenseRow}>
                  <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                    {licenseExpiry}
                  </ThemedText>
                  <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Vehicle Information Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            Vehicle Information
          </ThemedText>
          <View style={[styles.detailsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Vehicle */}
            <View style={[styles.detailItem, { borderBottomColor: theme.border }]}>
              <View style={[styles.detailIcon, { backgroundColor: theme.border }]}>
                <Ionicons name="cube-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.detailContent}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Vehicle
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                  {vehicle}
                </ThemedText>
              </View>
            </View>

            {/* License Plate */}
            <View style={[styles.detailItem, { borderBottomColor: theme.border }]}>
              <View style={[styles.detailIcon, { backgroundColor: theme.border }]}>
                <Ionicons name="location-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.detailContent}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  License Plate
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                  {licensePlate}
                </ThemedText>
              </View>
            </View>

            {/* Inspection Status */}
            <View style={styles.detailItem}>
              <View style={[styles.detailIcon, { backgroundColor: theme.border }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.detailContent}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Inspection Status
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.success }]}>
                  Verified
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: theme.primary }]}
          onPress={handleUpdateProfile}
          disabled={isLoading}>
          <Ionicons name="create-outline" size={20} color="#111" />
          <ThemedText style={[styles.editButtonText, { color: '#111' }]}>
            Edit Profile
          </ThemedText>
        </TouchableOpacity>

        {/* Support Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            Support
          </ThemedText>
          <TouchableOpacity
            style={[styles.supportButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/support')}>
            <View style={[styles.supportIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="help-circle-outline" size={20} color={theme.primary} />
            </View>
            <View style={styles.supportContent}>
              <ThemedText style={[styles.supportTitle, { color: theme.text }]}>
                Support & Help
              </ThemedText>
              <ThemedText style={[styles.supportSubtitle, { color: theme.textSecondary }]}>
                Get help, chat with support, or report issues
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.error + '20' }]}
          onPress={handleLogout}>
          <ThemedText style={[styles.logoutButtonText, { color: theme.error }]}>
            Logout
          </ThemedText>
        </TouchableOpacity>

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.error + '20' }]}>
            <ThemedText style={[styles.errorText, { color: theme.error }]}>
              {error}
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  soloBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  soloBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  profileInfo: {
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
  },
  profileSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  onlineStatusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  onlineStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  onlineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineStatusTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  onlineStatusSubtitle: {
    fontSize: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  detailsCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    gap: 12,
  },
  supportIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportContent: {
    flex: 1,
    gap: 4,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  supportSubtitle: {
    fontSize: 12,
  },
});
