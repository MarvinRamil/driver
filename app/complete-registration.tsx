import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { BeeColors } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { apiClient } from '@/shared/services/apiClient';
import { setDriverApplicationSubmitted } from '@/shared/services/driverApplicationStorage';
import * as ImagePicker from 'expo-image-picker';

type Step = 'profile' | 'vehicle' | 'documents' | 'review';

const VEHICLE_TYPES = ['Motorcycle', 'Sedan', 'SUV', 'Van', 'Truck'] as const;

interface DocumentState {
  uri: string | null;
  name: string;
  label: string;
}

interface MyApplicationData {
  id?: string;
  fullName?: string;
  email?: string;
  phone?: string | null;
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  status?: string;
  createdAt?: string;
  /** Admin rejection reason — absent on older responses */
  notes?: string | null;
  submissionCount?: number;
}

/**
 * Complete Registration screen
 * Shown after login when driver needs to complete registration
 * Flow: Profile details -> Documents upload -> Review -> Submit
 */
export default function CompleteRegistrationScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [currentStep, setCurrentStep] = useState<Step>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingApplication, setIsCheckingApplication] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resubmission state (existing application was rejected)
  const [isResubmission, setIsResubmission] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState<string | null>(null);
  const [showRejectionBanner, setShowRejectionBanner] = useState(false);

  // Profile data
  const [phone, setPhone] = useState('');
  const [facebookProfileUrl, setFacebookProfileUrl] = useState('');

  // Vehicle data
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');

  // If the driver already submitted an application, show the pending screen instead —
  // unless it was rejected, in which case they stay here to resubmit.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data?: MyApplicationData }>(
          'api/driver-applications/my-application',
          { requiresAuth: true }
        );
        const application = response.success ? response.data?.data : undefined;
        if (mounted && application) {
          if (application.status === 'Rejected') {
            // Rejected — allow resubmission: stay on the form, prefill known fields
            setIsResubmission(true);
            setRejectionNotes(application.notes ?? null);
            setShowRejectionBanner(true);
            if (application.phone) setPhone(application.phone);
            if (application.vehicleType) setVehicleType(application.vehicleType);
            if (application.vehiclePlate) setVehiclePlate(application.vehiclePlate);
          } else {
            await setDriverApplicationSubmitted();
            router.replace('/welcome');
            return;
          }
        }
      } catch {
        // 404 = no application yet — stay on this screen
      }
      if (mounted) {
        setIsCheckingApplication(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  // Documents (all optional for now)
  const [documents, setDocuments] = useState<Record<string, DocumentState>>({
    driversLicense: { uri: null, name: 'driversLicense', label: "Driver's License" },
    clearance: { uri: null, name: 'clearance', label: 'Clearance' },
    orCr: { uri: null, name: 'orCr', label: 'OR/CR' },
    ltfrbPa: { uri: null, name: 'ltfrbPa', label: 'LTFRB PA' },
    insurance: { uri: null, name: 'insurance', label: 'Insurance' },
  });

  const validateProfile = (): string | null => {
    if (!phone || phone.trim().length < 10) {
      return 'Please enter a valid phone number';
    }
    return null;
  };

  const handleProfileSubmit = () => {
    const validationError = validateProfile();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setCurrentStep('vehicle');
  };

  const handleVehicleSubmit = () => {
    if (!vehicleType) {
      setError('Please select your vehicle type');
      return;
    }
    setError(null);
    setCurrentStep('documents');
  };

  const handlePickDocument = async (docKey: string) => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to upload documents.');
        return;
      }

      // Show action sheet
      Alert.alert(
        `Select ${documents[docKey].label}`,
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
                allowsEditing: false, // Disable editing for documents - use photo as-is
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                setDocuments((prev) => ({
                  ...prev,
                  [docKey]: { ...prev[docKey], uri: result.assets[0].uri },
                }));
                setError(null); // Clear error when document is uploaded
              }
            },
          },
          {
            text: 'Choose from Library',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false, // Disable editing for documents - use photo as-is
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                setDocuments((prev) => ({
                  ...prev,
                  [docKey]: { ...prev[docKey], uri: result.assets[0].uri },
                }));
                setError(null); // Clear error when document is uploaded
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to pick image');
    }
  };

  const handleRemoveDocument = (docKey: string) => {
    setDocuments((prev) => {
      const updated = {
        ...prev,
        [docKey]: { ...prev[docKey], uri: null },
      };
      // Clear error if there are still documents uploaded
      const hasAnyDocument = Object.values(updated).some((doc) => doc.uri !== null);
      if (hasAnyDocument) {
        setError(null);
      }
      return updated;
    });
  };

  const handleCompleteRegistration = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!user?.email || !user?.fullName) {
        throw new Error('User information not found. Please login again.');
      }

      // Validate that at least one document is provided (should already be validated, but double-check).
      // On resubmission, previously uploaded documents are kept server-side unless replaced,
      // so uploading none is allowed.
      const hasAnyDocument = Object.values(documents).some((doc) => doc.uri !== null);
      if (!hasAnyDocument && !isResubmission) {
        throw new Error('Please upload at least one document');
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('fullName', user.fullName);
      formData.append('phone', phone.trim());

      if (facebookProfileUrl.trim()) {
        formData.append('facebookProfileUrl', facebookProfileUrl.trim());
      }

      // Vehicle information
      if (vehicleType) {
        formData.append('vehicleType', vehicleType);
      }
      if (vehiclePlate.trim()) {
        formData.append('vehiclePlate', vehiclePlate.trim());
      }
      if (vehicleModel.trim()) {
        formData.append('vehicleModel', vehicleModel.trim());
      }
      if (vehicleColor.trim()) {
        formData.append('vehicleColor', vehicleColor.trim());
      }

      // Add documents (only if provided)
      Object.entries(documents).forEach(([key, doc]) => {
        if (doc.uri) {
          const file = {
            uri: doc.uri,
            type: 'image/jpeg',
            name: `${doc.name}.jpg`,
          } as any;
          formData.append(doc.name, file);
        }
      });

      // Submit driver application
      const response = await apiClient.post<{
        message?: string;
        existingApplicationId?: string;
        data?: unknown;
      }>('api/driver-applications', {
        body: formData,
        requiresAuth: true, // User is logged in
      });

      if (!response.success) {
        // Check if it's an existing application error
        if (response.data?.existingApplicationId) {
          Alert.alert(
            'Application Already Exists',
            response.message || 'A driver application already exists for this account. Please wait for review or contact support if you need to update your application.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setDriverApplicationSubmitted().catch(() => {});
                  router.replace('/welcome');
                },
              },
            ]
          );
          return;
        }
        throw new Error(response.message || 'Failed to submit driver application');
      }

      // Mark submission locally so the guard routes to the welcome screen
      await setDriverApplicationSubmitted();

      // Refresh user data
      await refreshUser();

      Alert.alert(
        'Application Submitted',
        'Your driver application has been submitted successfully!\n\nPlease wait for admin review. You will be notified once your application is approved.',
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/welcome'),
          },
        ]
      );
    } catch (err) {
      // apiClient throws plain ApiError objects (not Error instances) for HTTP failures,
      // so read `message` structurally to surface backend messages (e.g. submission cap).
      const rawMessage = (err as { message?: unknown } | null)?.message;
      const errorMessage =
        typeof rawMessage === 'string' && rawMessage.trim()
          ? rawMessage
          : 'Failed to submit application. Please try again.';
      setError(errorMessage);
      console.error('[CompleteRegistration] Error:', errorMessage, err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingApplication) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
        ]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Vehicle step
  if (currentStep === 'vehicle') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.headerContainer}>
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('profile')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Vehicle Details</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                Tell us about the vehicle you will use for deliveries
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Vehicle Type *</Text>
                <View style={styles.vehicleTypeGrid}>
                  {VEHICLE_TYPES.map((type) => {
                    const selected = vehicleType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.vehicleTypeChip,
                          {
                            backgroundColor: selected ? theme.primary : theme.surface,
                            borderColor: selected ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => {
                          setVehicleType(type);
                          setError(null);
                        }}>
                        <Text
                          style={[
                            styles.vehicleTypeChipText,
                            { color: selected ? theme.primaryText : theme.text },
                          ]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Plate Number (Optional)</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="e.g. ABC 1234"
                    placeholderTextColor={theme.placeholder}
                    value={vehiclePlate}
                    onChangeText={setVehiclePlate}
                    autoCapitalize="characters"
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Model (Optional)</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="e.g. Toyota HiAce 2020"
                    placeholderTextColor={theme.placeholder}
                    value={vehicleModel}
                    onChangeText={setVehicleModel}
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Color (Optional)</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="e.g. White"
                    placeholderTextColor={theme.placeholder}
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    editable={!isLoading}
                  />
                </View>
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: theme.primary }]}
                onPress={handleVehicleSubmit}>
                <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Documents step
  if (currentStep === 'documents') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.headerContainer}>
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('vehicle')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Upload Documents</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                Upload your documents (all optional for now)
              </Text>
            </View>

            {isResubmission && (
              <View style={[styles.resubmitHint, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
                <Text style={[styles.resubmitHintText, { color: theme.textSecondary }]}>
                  Your previously uploaded documents are kept unless you replace them here. You can
                  continue without uploading new ones.
                </Text>
              </View>
            )}

            <View style={styles.documentsContainer}>
              {Object.entries(documents).map(([key, doc]) => (
                <View key={key} style={styles.documentItem}>
                  <View style={styles.documentInfo}>
                    <Text style={[styles.documentLabel, { color: theme.text }]}>{doc.label}</Text>
                    {doc.uri ? (
                      <View style={styles.documentPreview}>
                        <Image source={{ uri: doc.uri }} style={styles.documentImage} />
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleRemoveDocument(key)}>
                          <Ionicons name="close-circle" size={24} color={BeeColors.red[600]} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.uploadButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        onPress={() => handlePickDocument(key)}>
                        <Ionicons name="cloud-upload-outline" size={24} color={theme.primary} />
                        <Text style={[styles.uploadButtonText, { color: theme.text }]}>Upload</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                // Validate that at least one document is uploaded.
                // On resubmission, previous documents are kept server-side unless replaced,
                // so no new upload is required.
                const hasAnyDocument = Object.values(documents).some((doc) => doc.uri !== null);
                if (!hasAnyDocument && !isResubmission) {
                  setError('Please upload at least one document before continuing');
                  return;
                }
                setError(null);
                setCurrentStep('review');
              }}>
              <Text style={[styles.continueButtonText, { color: theme.primaryText }]}>Continue to Review</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Review step
  if (currentStep === 'review') {
    const uploadedDocuments = Object.entries(documents).filter(([_, doc]) => doc.uri !== null);

    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.headerContainer}>
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('documents')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Review & Submit</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                Please review your information before submitting
              </Text>
            </View>

            <View style={styles.reviewContainer}>
              <View style={[styles.reviewSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Profile Information</Text>
                <View style={styles.reviewItem}>
                  <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Full Name</Text>
                  <Text style={[styles.reviewValue, { color: theme.text }]}>{user?.fullName}</Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Email</Text>
                  <Text style={[styles.reviewValue, { color: theme.text }]}>{user?.email}</Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Phone</Text>
                  <Text style={[styles.reviewValue, { color: theme.text }]}>{phone}</Text>
                </View>
                {facebookProfileUrl && (
                  <View style={styles.reviewItem}>
                    <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Facebook Profile</Text>
                    <Text style={[styles.reviewValue, { color: theme.text }]}>{facebookProfileUrl}</Text>
                  </View>
                )}
              </View>

              <View style={[styles.reviewSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Vehicle</Text>
                <View style={styles.reviewItem}>
                  <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Type</Text>
                  <Text style={[styles.reviewValue, { color: theme.text }]}>{vehicleType}</Text>
                </View>
                {vehiclePlate.trim() !== '' && (
                  <View style={styles.reviewItem}>
                    <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Plate Number</Text>
                    <Text style={[styles.reviewValue, { color: theme.text }]}>{vehiclePlate}</Text>
                  </View>
                )}
                {vehicleModel.trim() !== '' && (
                  <View style={styles.reviewItem}>
                    <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Model</Text>
                    <Text style={[styles.reviewValue, { color: theme.text }]}>{vehicleModel}</Text>
                  </View>
                )}
                {vehicleColor.trim() !== '' && (
                  <View style={styles.reviewItem}>
                    <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Color</Text>
                    <Text style={[styles.reviewValue, { color: theme.text }]}>{vehicleColor}</Text>
                  </View>
                )}
              </View>

              {isResubmission && uploadedDocuments.length === 0 && (
                <View style={[styles.reviewSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Documents</Text>
                  <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>
                    No new documents uploaded — your previously submitted documents will be kept.
                  </Text>
                </View>
              )}

              {uploadedDocuments.length > 0 && (
                <View style={[styles.reviewSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Documents ({uploadedDocuments.length})</Text>
                  {uploadedDocuments.map(([key, doc]) => (
                    <View key={key} style={styles.reviewItem}>
                      <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>{doc.label}</Text>
                      {doc.uri && <Image source={{ uri: doc.uri }} style={styles.reviewImage} />}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled, { backgroundColor: theme.primary }]}
              onPress={handleCompleteRegistration}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.primaryText} />
              ) : (
                <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>
                  {isResubmission ? 'Resubmit Application' : 'Submit Application'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Profile form step (default)
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {isResubmission && showRejectionBanner && (
            <View style={styles.rejectionBanner}>
              <Ionicons name="alert-circle" size={20} color={BeeColors.red[600]} style={styles.rejectionBannerIcon} />
              <View style={styles.rejectionBannerBody}>
                <Text style={styles.rejectionBannerTitle}>
                  Your previous application was rejected
                </Text>
                {rejectionNotes ? (
                  <Text style={styles.rejectionBannerReason}>Reason: {rejectionNotes}</Text>
                ) : null}
                <Text style={styles.rejectionBannerText}>
                  Please update your details below and resubmit your application.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowRejectionBanner(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Dismiss">
                <Ionicons name="close" size={18} color={BeeColors.red[600]} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.headerContainer}>
            <Text style={[styles.headline, { color: theme.text }]}>
              {isResubmission ? 'Resubmit Your Application' : 'Complete Your Registration'}
            </Text>
            <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
              Please provide the following information to complete your driver application
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Phone Number *</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter your phone number"
                  placeholderTextColor={theme.placeholder}
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    setError(null);
                  }}
                  keyboardType="phone-pad"
                  editable={!isLoading}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Facebook Profile URL (Optional)</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="https://facebook.com/yourprofile"
                  placeholderTextColor={theme.placeholder}
                  value={facebookProfileUrl}
                  onChangeText={(text) => {
                    setFacebookProfileUrl(text);
                    setError(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="url"
                  editable={!isLoading}
                />
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled, { backgroundColor: theme.primary }]}
              onPress={handleProfileSubmit}
              disabled={isLoading}>
              <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>Continue</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  headerContainer: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headline: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginTop: 24,
  },
  inputGroup: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    minHeight: 56,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    minHeight: 56,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BeeColors.red[50],
    borderWidth: 1,
    borderColor: BeeColors.red[200],
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: BeeColors.red[700],
  },
  submitButton: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  documentsContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginTop: 24,
  },
  documentItem: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  documentInfo: {
    gap: 8,
  },
  documentLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    minHeight: 56,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  documentPreview: {
    position: 'relative',
  },
  documentImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  continueButton: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  reviewContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginTop: 24,
  },
  reviewSection: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  reviewItem: {
    marginBottom: 12,
  },
  reviewLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  reviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
    marginTop: 8,
  },
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleTypeChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 96,
    alignItems: 'center',
  },
  vehicleTypeChipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  rejectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: BeeColors.red[50],
    borderWidth: 1,
    borderColor: BeeColors.red[200],
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  rejectionBannerIcon: {
    marginTop: 1,
  },
  rejectionBannerBody: {
    flex: 1,
    gap: 4,
  },
  rejectionBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BeeColors.red[700],
  },
  rejectionBannerReason: {
    fontSize: 14,
    fontWeight: '600',
    color: BeeColors.red[700],
  },
  rejectionBannerText: {
    fontSize: 13,
    color: BeeColors.red[700],
  },
  resubmitHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  resubmitHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
