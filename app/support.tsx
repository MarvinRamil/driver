import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Linking, Alert, TextInput, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useSupport, supportService } from '@/features/support';
import { useAuth } from '@/features/auth';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

/**
 * Support screen
 * Matches prepared design with quick contact, tickets, FAQ, and chat
 */
export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { tickets, faq, conversations, isLoading, error, refresh, refreshConversations } = useSupport();

  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');

  const handleCall = () => {
    Linking.openURL('tel:+1234567890');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@beeapp.com');
  };

  const handleLiveChat = async () => {
    try {
      // Create or get support conversation
      const supportConversations = conversations.filter((c) => c.type === 'Support');
      let conversationId: string;

      if (supportConversations.length > 0) {
        // Use existing support conversation
        conversationId = supportConversations[0].id;
      } else {
        // Create new support conversation
        const newConversation = await supportService.createSupportConversation('Support Chat');
        conversationId = newConversation.id;
        await refreshConversations();
      }

      router.push(`/support/chat?conversationId=${conversationId}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to start chat');
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketSubject.trim() || !ticketDescription.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await supportService.createTicket({
        subject: ticketSubject,
        description: ticketDescription,
        category: 'General',
        priority: 'Normal',
      });
      Alert.alert('Success', 'Ticket created successfully');
      setShowCreateTicket(false);
      setTicketSubject('');
      setTicketDescription('');
      refresh();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create ticket');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return theme.success;
      case 'InProgress':
        return theme.info;
      case 'Open':
        return theme.warning;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusBg = (status: string) => {
    const color = getStatusColor(status);
    return color + '20';
  };

  const isSupportOpen = () => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    // Mon-Fri: 8 AM - 8 PM, Sat-Sun: 9 AM - 5 PM
    if (day >= 1 && day <= 5) {
      return hour >= 8 && hour < 20;
    } else {
      return hour >= 9 && hour < 17;
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.title, { color: theme.text }]}>
            Support
          </ThemedText>
          <View style={styles.headerRight}>
            <View style={[styles.profileImage, { borderColor: theme.primary }]}>
              <Ionicons name="person" size={16} color={theme.primary} />
            </View>
          </View>
        </View>

        {/* Greeting */}
        <View style={styles.greeting}>
          <ThemedText style={[styles.greetingTitle, { color: theme.text }]}>
            Hello Driver,
          </ThemedText>
          <ThemedText style={[styles.greetingSubtitle, { color: theme.textSecondary }]}>
            how can we help you?
          </ThemedText>
        </View>

        {/* Quick Contact Grid */}
        <View style={styles.quickContactGrid}>
          <TouchableOpacity
            style={[styles.quickContactButton, { backgroundColor: theme.primary }]}
            onPress={handleCall}>
            <View style={[styles.quickContactIcon, { backgroundColor: theme.primaryText + '1A' }]}>
              <Ionicons name="call" size={24} color={theme.primaryText} />
            </View>
            <ThemedText style={[styles.quickContactLabel, { color: theme.primaryText }]}>
              Call Us
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickContactButton, { backgroundColor: theme.primary }]}
            onPress={handleLiveChat}>
            <View style={[styles.quickContactIcon, { backgroundColor: theme.primaryText + '1A' }]}>
              <Ionicons name="chatbubble" size={24} color={theme.primaryText} />
            </View>
            <ThemedText style={[styles.quickContactLabel, { color: theme.primaryText }]}>
              Live Chat
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickContactButton, { backgroundColor: theme.primary }]}
            onPress={handleEmail}>
            <View style={[styles.quickContactIcon, { backgroundColor: theme.primaryText + '1A' }]}>
              <Ionicons name="mail" size={24} color={theme.primaryText} />
            </View>
            <ThemedText style={[styles.quickContactLabel, { color: theme.primaryText }]}>
              Email
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Support Hours */}
        <View style={[styles.hoursCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.hoursContent}>
            <View style={[styles.hoursIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="time-outline" size={20} color={theme.primary} />
            </View>
            <View style={styles.hoursText}>
              <ThemedText style={[styles.hoursTitle, { color: theme.text }]}>
                Support Hours
              </ThemedText>
              <ThemedText style={[styles.hoursDetail, { color: theme.textSecondary }]}>
                Mon - Fri: 8:00 AM - 8:00 PM{'\n'}
                Sat - Sun: 9:00 AM - 5:00 PM
              </ThemedText>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isSupportOpen() ? theme.success + '20' : theme.textSecondary + '20',
                },
              ]}>
              <ThemedText
                style={[
                  styles.statusBadgeText,
                  { color: isSupportOpen() ? theme.success : theme.textSecondary },
                ]}>
                {isSupportOpen() ? 'Open Now' : 'Closed'}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Recent Tickets */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
              Recent Tickets
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/support/tickets')}>
              <ThemedText style={[styles.viewAllText, { color: theme.primary }]}>
                View All
              </ThemedText>
            </TouchableOpacity>
          </View>
          {tickets.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No tickets yet
              </ThemedText>
            </View>
          ) : (
            tickets.slice(0, 2).map((ticket) => (
              <TouchableOpacity
                key={ticket.id}
                style={[styles.ticketCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.ticketLeft}>
                  <View
                    style={[
                      styles.ticketIcon,
                      {
                        backgroundColor:
                          ticket.category === 'Payment'
                            ? theme.info + '20'
                            : theme.textSecondary + '20',
                      },
                    ]}>
                    <Ionicons
                      name={ticket.category === 'Payment' ? 'card-outline' : 'car-outline'}
                      size={20}
                      color={ticket.category === 'Payment' ? theme.info : theme.textSecondary}
                    />
                  </View>
                  <View style={styles.ticketInfo}>
                    <ThemedText style={[styles.ticketTitle, { color: theme.text }]}>
                      {ticket.subject}
                    </ThemedText>
                    <ThemedText style={[styles.ticketTime, { color: theme.textSecondary }]}>
                      Updated {new Date(ticket.updatedAt || ticket.createdAt).toLocaleString()}
                    </ThemedText>
                  </View>
                </View>
                <View
                  style={[
                    styles.ticketStatus,
                    {
                      backgroundColor: getStatusBg(ticket.status),
                    },
                  ]}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: getStatusColor(ticket.status) },
                    ]}
                  />
                  <ThemedText
                    style={[styles.ticketStatusText, { color: getStatusColor(ticket.status) }]}>
                    {ticket.status}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            Common Questions
          </ThemedText>
          {faq.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No FAQ available
              </ThemedText>
            </View>
          ) : (
            faq.slice(0, 3).map((article) => (
              <TouchableOpacity
                key={article.id}
                style={[styles.faqItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setExpandedFAQ(expandedFAQ === article.id ? null : article.id)}>
                <View style={styles.faqHeader}>
                  <View style={styles.faqHeaderLeft}>
                    <Ionicons name="help-circle-outline" size={20} color={theme.textSecondary} />
                    <ThemedText style={[styles.faqQuestion, { color: theme.text }]}>
                      {article.title}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name={expandedFAQ === article.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.textSecondary}
                  />
                </View>
                {expandedFAQ === article.id && (
                  <ThemedText style={[styles.faqAnswer, { color: theme.textSecondary }]}>
                    {article.content}
                  </ThemedText>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Report Issue Button */}
        <TouchableOpacity
          style={[styles.reportButton, { backgroundColor: theme.text }]}
          onPress={() => setShowCreateTicket(true)}>
          <Ionicons name="warning-outline" size={20} color={theme.surface} />
          <ThemedText style={[styles.reportButtonText, { color: theme.surface }]}>
            Report an Issue
          </ThemedText>
        </TouchableOpacity>
        <ThemedText style={[styles.reportNote, { color: theme.textSecondary }]}>
          Ticket response time is usually within 24 hours.
        </ThemedText>
      </ScrollView>

      {/* Create Ticket Modal */}
      {showCreateTicket && (
        <View style={[styles.modalOverlay, { backgroundColor: '#000' + '80' }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={[styles.modalTitle, { color: theme.text }]}>
                Report an Issue
              </ThemedText>
              <TouchableOpacity onPress={() => setShowCreateTicket(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.border, color: theme.text }]}
              placeholder="Subject"
              placeholderTextColor={theme.textSecondary}
              value={ticketSubject}
              onChangeText={setTicketSubject}
            />
            <TextInput
              style={[
                styles.modalTextArea,
                { backgroundColor: theme.border, color: theme.text },
              ]}
              placeholder="Describe your issue..."
              placeholderTextColor={theme.textSecondary}
              value={ticketDescription}
              onChangeText={setTicketDescription}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.border }]}
                onPress={() => setShowCreateTicket(false)}>
                <ThemedText style={[styles.modalButtonText, { color: theme.text }]}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleCreateTicket}>
                <ThemedText style={[styles.modalButtonText, { color: theme.primaryText }]}>
                  Submit
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  greetingTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  greetingSubtitle: {
    fontSize: 16,
  },
  quickContactGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickContactButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  quickContactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickContactLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  hoursCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  hoursContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  hoursIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursText: {
    flex: 1,
    gap: 4,
  },
  hoursTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  hoursDetail: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  ticketCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  ticketLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  ticketIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketInfo: {
    flex: 1,
    gap: 4,
  },
  ticketTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  ticketTime: {
    fontSize: 12,
  },
  ticketStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ticketStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  faqItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    paddingLeft: 32,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  reportButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  reportNote: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  modalTextArea: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

