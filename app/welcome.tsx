import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Linking,
  Text,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { BRAND_YELLOW, BeeColors } from '@/constants/theme';

const logo = require('../assets/images/adaptive-icon.png');

/**
 * Pre-login welcome screen (entry point for unauthenticated users).
 * Matches design: hero with logo, app name, headline, Sign In / Create Account, footer.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner (matches login screen) */}
        <View style={styles.headerImageContainer}>
          <View style={[styles.headerImage, { backgroundColor: BRAND_YELLOW }]}>
            <View style={styles.heroContent}>
              <Image source={logo} style={styles.heroLogo} contentFit="contain" />
              <Text style={styles.heroText}>BEE ON-DEMAND</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <ThemedText style={[styles.subtext, { color: theme.textSecondary }]}>
          Delivers anything you need, anywhere in the city. Fast, reliable, and trackable logistics right at your fingertips.
          </ThemedText>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={() => router.push('/login')}
              activeOpacity={0.9}
            >
              <ThemedText style={[styles.primaryButtonText, { color: theme.primaryText }]}>
                Sign In
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/signup')}
              activeOpacity={0.9}
            >
              <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>
                Create Account
              </ThemedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.exploreLink}
           
          >
            <ThemedText style={[styles.exploreLinkText, { color: theme.textSecondary }]}>
              Explore first
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Decorative bar */}
        <View style={[styles.bar, { backgroundColor: theme.primary }]} />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity onPress={() => Linking.openURL('https://example.com/support').catch(() => {})}>
          <ThemedText style={[styles.footerLink, { color: theme.textSecondary }]}>Support</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL('https://example.com/terms').catch(() => {})}>
          <ThemedText style={[styles.footerLink, { color: theme.textSecondary }]}>Terms</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL('https://example.com/privacy').catch(() => {})}>
          <ThemedText style={[styles.footerLink, { color: theme.textSecondary }]}>Privacy</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  headerImageContainer: {
    width: '100%',
    marginTop: 16,
    marginBottom: 24,
  },
  headerImage: {
    width: '100%',
    minHeight: 260,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  heroLogo: {
    width: 120,
    height: 120,
  },
  heroText: {
    fontSize: 28,
    fontWeight: '700',
    color: BeeColors.gray[900],
    letterSpacing: 2,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: 'center',
  },
  subtext: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 8,
    marginBottom: 32,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  exploreLink: {
    marginTop: 32,
    paddingVertical: 8,
  },
  exploreLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bar: {
    width: '100%',
    height: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 16,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '500',
  },
});
