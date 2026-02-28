import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { supportService } from '@/features/support';
import type { SupportTicket, ZammadArticle } from '@/features/support';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

/** Strip HTML tags for plain text display */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Ticket detail screen — view a single support ticket with Zammad updates.
 */
export default function TicketDetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const loadTicket = useCallback(async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await supportService.getTicket(id);
      setTicket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTicket(false);
    setRefreshing(false);
  }, [loadTicket]);

  const handleAddComment = useCallback(async () => {
    const body = commentText.trim();
    if (!body || !id || !ticket) return;
    const canComment = ticket.status !== 'Closed' && ticket.status !== 'Resolved';
    if (!canComment) return;
    setSendingComment(true);
    setCommentError(null);
    try {
      await supportService.addComment(id, body);
      setCommentText('');
      await loadTicket(false);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSendingComment(false);
    }
  }, [id, ticket, commentText, loadTicket]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

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

  if (!id) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Invalid ticket</ThemedText>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={{ color: theme.primary }}>Go back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {ticket?.ticketNumber ?? 'Ticket'}
        </ThemedText>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : error || !ticket ? (
        <View style={[styles.centered, styles.errorBlock]}>
          <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>{error || 'Ticket not found'}</ThemedText>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backLink, { borderColor: theme.primary }]}>
            <ThemedText style={{ color: theme.primary }}>Go back</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={insets.top + 60}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
            }>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Ticket #</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.ticketNumber}</ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Status</ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) + '20' }]}>
                <ThemedText style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>
                  {ticket.status}
                </ThemedText>
              </View>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Category</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.category}</ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Priority</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.priority}</ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Created</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>
                {new Date(ticket.createdAt).toLocaleString()}
              </ThemedText>
            </View>
            {ticket.updatedAt && (
              <View style={styles.cardRow}>
                <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Updated</ThemedText>
                <ThemedText style={[styles.value, { color: theme.text }]}>
                  {new Date(ticket.updatedAt).toLocaleString()}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[styles.label, { color: theme.textSecondary, marginBottom: 4 }]}>Subject</ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.subject}</ThemedText>
          </View>

          {ticket.description ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText style={[styles.label, { color: theme.textSecondary, marginBottom: 4 }]}>Description</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.description}</ThemedText>
            </View>
          ) : null}

          {ticket.resolution ? (
            <View style={[styles.card, styles.resolutionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText style={[styles.label, { color: theme.textSecondary, marginBottom: 4 }]}>Resolution</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.resolution}</ThemedText>
              {ticket.resolvedAt && (
                <ThemedText style={[styles.resolvedAt, { color: theme.textSecondary }]}>
                  Resolved {new Date(ticket.resolvedAt).toLocaleString()}
                </ThemedText>
              )}
            </View>
          ) : null}

          {ticket.zammadArticles && ticket.zammadArticles.length > 0 ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Support Updates</ThemedText>
              <ThemedText style={[styles.label, { color: theme.textSecondary, marginBottom: 12 }]}>
                Updates from support team
              </ThemedText>
              {ticket.zammadArticles
                .filter((a) => !a.internal)
                .map((article: ZammadArticle, idx: number) => (
                  <View
                    key={idx}
                    style={[
                      styles.articleCard,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        borderLeftColor: article.sender === 'Agent' ? theme.info : theme.textSecondary,
                      },
                    ]}>
                    <View style={styles.articleHeader}>
                      <ThemedText style={[styles.articleSender, { color: theme.text }]}>
                        {article.from || article.sender}
                      </ThemedText>
                      <ThemedText style={[styles.articleDate, { color: theme.textSecondary }]}>
                        {article.createdAt ? new Date(article.createdAt).toLocaleString() : ''}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.articleBody, { color: theme.text }]}>
                      {stripHtml(article.body || '')}
                    </ThemedText>
                  </View>
                ))}
            </View>
          ) : null}

          {(() => {
            return (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Add Comment</ThemedText>
                {!ticket.zammadTicketId ? (
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                    Comments will be available once this ticket is synced with support.
                  </ThemedText>
                ) : ticket.status === 'Closed' || ticket.status === 'Resolved' ? (
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                    This ticket is closed. No further comments can be added.
                  </ThemedText>
                ) : (
                  <>
                    <TextInput
                      style={[
                        styles.commentInput,
                        {
                          backgroundColor: theme.background,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder="Type your response..."
                      placeholderTextColor={theme.textSecondary}
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                      editable={!sendingComment}
                      maxLength={2000}
                    />
                    {commentError ? (
                      <ThemedText style={[styles.commentError, { color: theme.error }]}>{commentError}</ThemedText>
                    ) : null}
                    <TouchableOpacity
                      style={[
                        styles.sendButton,
                        {
                          backgroundColor: commentText.trim() && !sendingComment ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={handleAddComment}
                      disabled={!commentText.trim() || sendingComment}>
                      {sendingComment ? (
                        <ActivityIndicator size="small" color={theme.text} />
                      ) : (
                        <ThemedText
                          style={[
                            styles.sendButtonText,
                            {
                              color: commentText.trim() ? (theme.primaryText || '#fff') : theme.textSecondary,
                            },
                          ]}>
                          Send
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          })()}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </ThemedView>
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
    borderBottomWidth: 1,
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
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBlock: {
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  backLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resolutionCard: {
    marginBottom: 0,
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resolvedAt: {
    fontSize: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  articleCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  articleSender: {
    fontSize: 14,
    fontWeight: '600',
  },
  articleDate: {
    fontSize: 12,
  },
  articleBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  commentError: {
    fontSize: 13,
    marginTop: 8,
  },
  sendButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
