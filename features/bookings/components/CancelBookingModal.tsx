import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useTheme } from '@/shared/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import {
  CancellationReason,
  CancellationReasonLabels,
} from '@/shared/types/booking';

interface CancelBookingModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: CancellationReason, customReason?: string) => Promise<void>;
  bookingNumber?: string;
}

export function CancelBookingModal({
  visible,
  onClose,
  onConfirm,
  bookingNumber,
}: CancelBookingModalProps) {
  const theme = useTheme();
  const [selectedReason, setSelectedReason] = useState<CancellationReason | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selectedReason) {
      Alert.alert('Required', 'Please select a cancellation reason');
      return;
    }

    if (selectedReason === CancellationReason.Other && !customReason.trim()) {
      Alert.alert('Required', 'Please provide a custom reason');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(
        selectedReason,
        selectedReason === CancellationReason.Other ? customReason.trim() : undefined
      );
      // Reset form
      setSelectedReason(null);
      setCustomReason('');
      onClose();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to cancel booking'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason(null);
      setCustomReason('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <ThemedView style={[styles.modal, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={[styles.title, { color: theme.text }]}>
              Cancel Booking
            </ThemedText>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {bookingNumber && (
            <ThemedText style={[styles.bookingNumber, { color: theme.textSecondary }]}>
              Booking: {bookingNumber}
            </ThemedText>
          )}

          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Please select a reason for cancellation:
          </ThemedText>

          {/* Reason Selection */}
          <ScrollView style={styles.reasonsList} showsVerticalScrollIndicator={false}>
            {Object.entries(CancellationReasonLabels).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.reasonItem,
                  {
                    backgroundColor:
                      selectedReason === key ? theme.primary + '20' : theme.surface,
                    borderColor: selectedReason === key ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setSelectedReason(key as CancellationReason)}
                disabled={isSubmitting}
              >
                <View style={styles.reasonContent}>
                  <ThemedText
                    style={[
                      styles.reasonText,
                      {
                        color:
                          selectedReason === key ? theme.primary : theme.text,
                        fontWeight: selectedReason === key ? '600' : '400',
                      },
                    ]}
                  >
                    {label}
                  </ThemedText>
                  {selectedReason === key && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Custom Reason Input */}
          {selectedReason === CancellationReason.Other && (
            <View style={styles.customReasonContainer}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                Please specify:
              </ThemedText>
              <TextInput
                style={[
                  styles.customReasonInput,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                placeholder="Enter cancellation reason..."
                placeholderTextColor={theme.textSecondary}
                value={customReason}
                onChangeText={setCustomReason}
                multiline
                numberOfLines={3}
                editable={!isSubmitting}
              />
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <ThemedText style={[styles.buttonText, { color: theme.text }]}>
                Back
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                {
                  backgroundColor: theme.error,
                  opacity: isSubmitting || !selectedReason ? 0.5 : 1,
                },
              ]}
              onPress={handleConfirm}
              disabled={isSubmitting || !selectedReason}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={[styles.buttonText, { color: '#fff' }]}>
                  Cancel Booking
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  bookingNumber: {
    fontSize: 14,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  reasonsList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  reasonItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  reasonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reasonText: {
    fontSize: 16,
    flex: 1,
  },
  customReasonContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  customReasonInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelButton: {},
  confirmButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
