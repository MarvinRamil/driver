import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

export default function RatingScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }
    // TODO: Submit rating to backend
    Alert.alert('Success', 'Thank you for your feedback!', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <TouchableOpacity onPress={() => router.back()}>
            <ThemedText style={[styles.skipText, { color: theme.text }]}>Skip</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <ThemedText type="title" style={[styles.title, { color: theme.text }]}>
            How was your delivery?
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your feedback helps us improve.
          </ThemedText>
        </View>

        {/* Driver Profile */}
        <View style={styles.profileSection}>
          <View style={[styles.avatar, { borderColor: theme.primary }]}>
            <Ionicons name="person" size={32} color={theme.primary} />
          </View>
          <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
            <Ionicons name="cube-outline" size={18} color={theme.primaryText} />
          </View>
          <ThemedText style={[styles.driverName, { color: theme.text }]}>John Driver</ThemedText>
          <ThemedText style={[styles.driverInfo, { color: theme.textSecondary }]}>
            Professional Driver • 4.9 ⭐
          </ThemedText>
        </View>

        {/* Rating Stars */}
        <View style={styles.ratingSection}>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                style={styles.starButton}>
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={48}
                  color={star <= rating ? theme.primary : theme.border}
                />
              </TouchableOpacity>
            ))}
          </View>
          <ThemedText style={[styles.ratingLabel, { color: theme.textSecondary }]}>
            {rating === 0
              ? 'Tap to rate'
              : rating === 5
              ? 'Excellent!'
              : rating === 4
              ? 'Great!'
              : rating === 3
              ? 'Good'
              : rating === 2
              ? 'Fair'
              : 'Poor'}
          </ThemedText>
        </View>

        {/* Feedback Input */}
        <View style={styles.feedbackSection}>
          <ThemedText style={[styles.feedbackLabel, { color: theme.text }]}>
            Tell us more (optional)
          </ThemedText>
          <TextInput
            style={[
              styles.feedbackInput,
              { backgroundColor: theme.border, color: theme.text, borderColor: theme.border },
            ]}
            placeholder="What made this delivery great?"
            placeholderTextColor={theme.textSecondary}
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSubmit}>
          <ThemedText style={[styles.submitButtonText, { color: theme.primaryText }]}>Submit Feedback</ThemedText>
        </TouchableOpacity>
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '700',
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingBottom: 32,
    gap: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  driverInfo: {
    fontSize: 14,
  },
  ratingSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  feedbackSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  feedbackInput: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 120,
    fontSize: 16,
  },
  submitButton: {
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
});

