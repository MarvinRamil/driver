import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/features/auth";
import { useTheme } from "@/shared/hooks/use-theme";
import { useWallet } from "@/features/wallet";
import { useWalletTransactions } from "@/features/wallet";
import {
  useCashEligibility,
  useTopUp,
  useTopUpHistory,
  useWalletTopUpEvents,
  walletService,
  useWithdrawals,
} from "@/features/wallet";
import { ThemedView } from "@/shared/components/themed-view";
import { ThemedText } from "@/shared/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useEarningsHistory } from "@/features/earnings";

// In-app browser options for top-up invoice (match customer app payment flow)
const TOP_UP_BROWSER_OPTIONS: WebBrowser.WebBrowserOpenOptions = {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
  enableBarCollapsing: false,
  showTitle: true,
  toolbarColor: "#ffcd36",
  controlsColor: "#000000",
};

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { user } = useAuth();
  const { wallet, isLoading, error, refresh } = useWallet();
  const { transactions } = useWalletTransactions();
  const { data: cashEligibility, refresh: refreshEligibility } =
    useCashEligibility();
  const { topUps, refresh: refreshTopUps } = useTopUpHistory();
  const { createTopUp, isSubmitting: topUpSubmitting } = useTopUp();
  const {
    requests: withdrawals,
    refresh: refreshWithdrawals,
    requestWithdrawal,
  } = useWithdrawals();
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("200");
  const [transferAmount, setTransferAmount] = useState("100");
  const [withdrawAmount, setWithdrawAmount] = useState("500");
  const [bankName, setBankName] = useState("BPI");
  const [bankAccount, setBankAccount] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [transferFrom, setTransferFrom] = useState<"Personal" | "TopUp">(
    "Personal",
  );

  const { history, refresh: refreshHistory } = useEarningsHistory(
    user?.id ?? "",
  );

  const onRefreshAll = useCallback(async () => {
    await Promise.all([
      refresh(),
      refreshEligibility(),
      refreshTopUps(),
      refreshWithdrawals(),
      refreshHistory(),
    ]);
  }, [
    refresh,
    refreshEligibility,
    refreshTopUps,
    refreshWithdrawals,
    refreshHistory,
  ]);

  // Real-time: when webhook marks top-up as paid, backend pushes TopUpPaid via SignalR; refresh wallet and history
  useWalletTopUpEvents(user?.id, () => {
    onRefreshAll();
  });

  // Must be called unconditionally (before any early return) to satisfy Rules of Hooks
  const topUpStatusText = useMemo(() => {
    if (!cashEligibility) return "";
    const threshold = Number.isFinite(cashEligibility.blockThreshold)
      ? cashEligibility.blockThreshold
      : 0;
    const current = Number.isFinite(cashEligibility.currentTopUpBalance)
      ? cashEligibility.currentTopUpBalance
      : 0;
    return `Threshold: ₱${threshold.toFixed(2)} | Current: ₱${current.toFixed(2)}`;
  }, [cashEligibility]);

  const canAccessWallet = user?.role === "Driver";

  if (!canAccessWallet) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.accessDenied}>
          <Ionicons
            name="lock-closed-outline"
            size={64}
            color={theme.textMuted}
          />
          <ThemedText
            type="title"
            style={[styles.accessDeniedTitle, { color: theme.text }]}
          >
            Access Restricted
          </ThemedText>
          <ThemedText
            style={[styles.accessDeniedText, { color: theme.textSecondary }]}
          >
            Wallet access is only available for solo drivers and operators.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const personalBalance = wallet?.personalBalance ?? 0;
  const topUpBalance = wallet?.topUpBalance ?? 0;
  const canAcceptCashJobs = wallet?.canAcceptCashJobs ?? true;
  const effectiveCashEligibility =
    cashEligibility?.canAcceptCashJobs ?? canAcceptCashJobs;

  // Earnings computations from history (assuming backend returns PayOnline for cashless and Cash for cash)
  const totalGross = history?.totalGross ?? 0;
  const totalNet = history?.totalNet ?? 0;
  const totalPlatformFee = history?.totalPlatformFee ?? 0;

  const cashlessEarnings = useMemo(() => {
    if (!history?.items) return 0;
    return history.items
      .filter((item) => item.paymentMethod === "PayOnline")
      .reduce((sum, item) => sum + item.netAmount, 0);
  }, [history?.items]);

  const cashEarnings = useMemo(() => {
    if (!history?.items) return 0;
    return history.items
      .filter((item) => item.paymentMethod === "Cash")
      .reduce((sum, item) => sum + item.netAmount, 0);
  }, [history?.items]);

  const handleCancelTopUp = (topUpId: string) => {
    if (!user?.id) return;
    Alert.alert(
      "Cancel top-up",
      "Are you sure you want to cancel this top-up? You will need to create a new one to pay.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await walletService.cancelTopUp(user.id, topUpId);
              await refreshTopUps();
            } catch (e) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Failed to cancel top-up",
              );
            }
          },
        },
      ],
    );
  };

  const handleCreateTopUp = async () => {
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid top-up amount.");
      return;
    }

    try {
      const topUp = await createTopUp(
        amount,
        undefined,
        "Driver top-up wallet funding",
      );
      setTopUpModalVisible(false);
      if (topUp.xenditInvoiceUrl) {
        try {
          await WebBrowser.openBrowserAsync(
            topUp.xenditInvoiceUrl,
            TOP_UP_BROWSER_OPTIONS,
          );
        } catch {
          try {
            const canOpen = await Linking.canOpenURL(topUp.xenditInvoiceUrl);
            if (canOpen) {
              await Linking.openURL(topUp.xenditInvoiceUrl);
            } else {
              Alert.alert(
                "Top-up Created",
                "Invoice was created, but your device cannot open the payment link.",
              );
            }
          } catch {
            Alert.alert(
              "Top-up Created",
              "Invoice created, but failed to open link automatically.",
            );
          }
        }
      } else {
        Alert.alert(
          "Top-up Created",
          "Top-up request created. You can open it from Top-up History.",
        );
      }
      await onRefreshAll();
    } catch (err) {
      Alert.alert(
        "Top-up Failed",
        err instanceof Error ? err.message : "Unable to create top-up",
      );
    }
  };

  const handleTransfer = async () => {
    if (!user?.id) return;
    const amount = Number(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid transfer amount.");
      return;
    }

    const to = transferFrom === "Personal" ? "TopUp" : "Personal";
    try {
      await walletService.transferWalletBalance(
        user.id,
        transferFrom,
        to,
        amount,
      );
      setTransferModalVisible(false);
      Alert.alert(
        "Transfer Complete",
        `Moved ₱${amount.toFixed(2)} from ${transferFrom} to ${to}.`,
      );
      await onRefreshAll();
    } catch (err) {
      Alert.alert(
        "Transfer Failed",
        err instanceof Error ? err.message : "Unable to transfer funds",
      );
    }
  };

  const handleWithdrawal = async () => {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    if (!bankAccount || !accountHolder) {
      Alert.alert("Missing Details", "Please fill in all bank details.");
      return;
    }

    setIsWithdrawing(true);
    try {
      await requestWithdrawal(amount, bankAccount, bankName, accountHolder);
      setWithdrawModalVisible(false);
      Alert.alert(
        "Request Sent",
        "Your withdrawal request has been submitted.",
      );
      await onRefreshAll();
    } catch (err) {
      Alert.alert(
        "Withdrawal Failed",
        err instanceof Error ? err.message : "Unable to request withdrawal",
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  const openTopUpLink = async (url?: string | null) => {
    if (!url) {
      Alert.alert("No Link", "This top-up has no invoice URL.");
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(url, TOP_UP_BROWSER_OPTIONS);
    } catch {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          Alert.alert("Cannot Open Link", "Your device cannot open this URL.");
          return;
        }
        await Linking.openURL(url);
      } catch {
        Alert.alert("Open Failed", "Failed to open invoice URL.");
      }
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefreshAll} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.profileImage, { borderColor: theme.primary }]}>
              <Ionicons name="person" size={20} color={theme.primary} />
            </View>
            <View>
              <ThemedText
                style={[styles.welcomeText, { color: theme.textSecondary }]}
              >
                Welcome back,
              </ThemedText>
              <ThemedText style={[styles.userName, { color: theme.text }]}>
                {user?.fullName || "Driver"}
              </ThemedText>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              { backgroundColor: theme.surface },
            ]}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={theme.text}
            />
            <View
              style={[
                styles.notificationBadge,
                { backgroundColor: theme.error },
              ]}
            />
          </TouchableOpacity>
        </View>

        {/* Wallet Card */}
        <View style={styles.walletCardContainer}>
          <View style={[styles.walletCard, { backgroundColor: "#111111" }]}>
            {/* Decorative background elements */}
            <View style={styles.walletCardBg1} />
            <View style={styles.walletCardBg2} />

            <View style={styles.walletCardContent}>
              <View style={styles.walletCardHeader}>
                <ThemedText
                  style={[styles.walletCardLabel, { color: "#9ca3af" }]}
                >
                  Personal Wallet (Net Earnings)
                </ThemedText>
                <View
                  style={[styles.verifiedBadge, { backgroundColor: "#1f2937" }]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={12}
                    color={theme.primary}
                  />
                  <ThemedText
                    style={[styles.verifiedText, { color: theme.primary }]}
                  >
                    VERIFIED
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={[styles.walletBalance, { color: "#fff" }]}>
                ₱
                {personalBalance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </ThemedText>

              <View style={styles.walletCardFooter}>
                <View>
                  <ThemedText style={[styles.beeIdLabel, { color: "#9ca3af" }]}>
                    Bee ID
                  </ThemedText>
                  <ThemedText style={[styles.beeIdValue, { color: "#fff" }]}>
                    **** {user?.id?.slice(-4) || "8924"}
                  </ThemedText>
                </View>
                <View style={styles.chipIcon}>
                  <Ionicons name="card-outline" size={32} color="#fff" />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Earnings & Fees Breakdown */}
        <View style={styles.earningsBreakdownSection}>
          <ThemedText
            style={[
              styles.sectionTitle,
              { color: theme.text, paddingHorizontal: 24, marginBottom: 12 },
            ]}
          >
            Earnings & Fees Breakdown
          </ThemedText>
          <View
            style={[
              styles.earningsCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.earningsRow}>
              <View style={styles.earningsRowLeft}>
                <Ionicons
                  name="bar-chart-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.earningsRowLabel,
                    { color: theme.textSecondary },
                  ]}
                >
                  Total Gross (Fare)
                </ThemedText>
              </View>
              <ThemedText
                style={[styles.earningsRowValue, { color: theme.text }]}
              >
                ₱
                {totalGross.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </ThemedText>
            </View>

            <View style={styles.earningsRow}>
              <View style={styles.earningsRowLeft}>
                <Ionicons name="cut-outline" size={20} color={theme.error} />
                <ThemedText
                  style={[styles.earningsRowLabel, { color: theme.error }]}
                >
                  System Commission
                </ThemedText>
              </View>
              <ThemedText
                style={[styles.earningsRowValue, { color: theme.error }]}
              >
                -₱
                {totalPlatformFee.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.earningsRow}>
              <View style={styles.earningsRowLeft}>
                <Ionicons
                  name="wallet-outline"
                  size={20}
                  color={theme.success}
                />
                <ThemedText
                  style={[
                    styles.earningsRowLabelGross,
                    { color: theme.success },
                  ]}
                >
                  Total Net Take-Home
                </ThemedText>
              </View>
              <ThemedText
                style={[styles.earningsRowValueGross, { color: theme.success }]}
              >
                ₱
                {totalNet.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </ThemedText>
            </View>

            <View style={styles.earningsPillsRow}>
              <View
                style={[
                  styles.earningPill,
                  { backgroundColor: theme.primary + "20" },
                ]}
              >
                <ThemedText
                  style={[
                    styles.earningPillLabel,
                    { color: theme.textSecondary },
                  ]}
                >
                  Cashless
                </ThemedText>
                <ThemedText
                  style={[styles.earningPillValue, { color: theme.text }]}
                >
                  ₱
                  {cashlessEarnings.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </ThemedText>
              </View>
              <View
                style={[styles.earningPill, { backgroundColor: theme.surface }]}
              >
                <ThemedText
                  style={[
                    styles.earningPillLabel,
                    { color: theme.textSecondary },
                  ]}
                >
                  Cash
                </ThemedText>
                <ThemedText
                  style={[styles.earningPillValue, { color: theme.text }]}
                >
                  ₱
                  {cashEarnings.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Top-up wallet status */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>
            Top-up Wallet
          </ThemedText>
          <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
            ₱
            {topUpBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </ThemedText>
          <ThemedText
            style={[
              styles.summarySubtext,
              { color: effectiveCashEligibility ? theme.success : theme.error },
            ]}
          >
            {effectiveCashEligibility
              ? "Eligible for cash jobs"
              : "Cash jobs temporarily blocked"}
          </ThemedText>
          {!!topUpStatusText && (
            <ThemedText
              style={[styles.summarySubtext, { color: theme.textSecondary }]}
            >
              {topUpStatusText}
            </ThemedText>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => setTopUpModalVisible(true)}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: theme.primary },
              ]}
            >
              <Ionicons name="add" size={24} color="#111" />
            </View>
            <ThemedText
              style={[styles.quickActionLabel, { color: theme.textSecondary }]}
            >
              Top Up
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => setTransferModalVisible(true)}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons name="arrow-up-outline" size={24} color={theme.text} />
            </View>
            <ThemedText
              style={[styles.quickActionLabel, { color: theme.textSecondary }]}
            >
              Transfer
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => setWithdrawModalVisible(true)}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons name="cash-outline" size={24} color={theme.text} />
            </View>
            <ThemedText
              style={[styles.quickActionLabel, { color: theme.textSecondary }]}
            >
              Withdraw
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="ellipsis-horizontal-outline"
                size={24}
                color={theme.text}
              />
            </View>
            <ThemedText
              style={[styles.quickActionLabel, { color: theme.textSecondary }]}
            >
              More
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <ThemedText
              type="subtitle"
              style={[styles.activityTitle, { color: theme.text }]}
            >
              Recent Activity
            </ThemedText>
            <TouchableOpacity>
              <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>
                See All
              </ThemedText>
            </TouchableOpacity>
          </View>

          {error ? (
            <View
              style={[styles.errorCard, { backgroundColor: theme.surface }]}
            >
              <ThemedText style={[styles.errorText, { color: theme.error }]}>
                {error}
              </ThemedText>
            </View>
          ) : transactions.length === 0 ? (
            <View
              style={[styles.emptyState, { backgroundColor: theme.surface }]}
            >
              <ThemedText
                style={[styles.emptyText, { color: theme.textSecondary }]}
              >
                No recent transactions
              </ThemedText>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.slice(0, 10).map((transaction) => {
                const isCredit = [
                  "Earning",
                  "TopUp",
                  "WalletTransferIn",
                  "Refund",
                ].includes(transaction.type);
                const iconName = isCredit
                  ? "car-outline"
                  : transaction.type === "Withdrawal"
                    ? "arrow-down-outline"
                    : "card-outline";
                const iconColor = isCredit ? theme.success : theme.error;
                const iconBg = isCredit
                  ? theme.success + "20"
                  : theme.error + "20";

                return (
                  <View
                    key={transaction.id}
                    style={[
                      styles.transactionCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.transactionLeft}>
                      <View
                        style={[
                          styles.transactionIcon,
                          { backgroundColor: iconBg },
                        ]}
                      >
                        <Ionicons name={iconName} size={20} color={iconColor} />
                      </View>
                      <View style={styles.transactionInfo}>
                        <ThemedText
                          style={[
                            styles.transactionTitle,
                            { color: theme.text },
                          ]}
                        >
                          {transaction.description}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.transactionDate,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {new Date(transaction.date).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText
                      style={[
                        styles.transactionAmount,
                        { color: isCredit ? theme.success : theme.text },
                      ]}
                    >
                      {isCredit ? "+" : "-"}₱
                      {Math.abs(transaction.amount ?? 0).toLocaleString(
                        "en-US",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Top-up History */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <ThemedText
              type="subtitle"
              style={[styles.activityTitle, { color: theme.text }]}
            >
              Top-up History
            </ThemedText>
          </View>
          {topUps.length === 0 ? (
            <View
              style={[styles.emptyState, { backgroundColor: theme.surface }]}
            >
              <ThemedText
                style={[styles.emptyText, { color: theme.textSecondary }]}
              >
                No top-up records yet
              </ThemedText>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {topUps.slice(0, 8).map((topUp) => {
                const statusColor =
                  topUp.status === "Paid"
                    ? theme.success
                    : topUp.status === "Pending"
                      ? theme.primary
                      : topUp.status === "Expired" ||
                          topUp.status === "Cancelled"
                        ? theme.textSecondary
                        : theme.error;
                const statusBg = `${statusColor}20`;
                const statusIcon =
                  topUp.status === "Paid"
                    ? "checkmark-circle-outline"
                    : topUp.status === "Pending"
                      ? "time-outline"
                      : topUp.status === "Expired" ||
                          topUp.status === "Cancelled"
                        ? "ban-outline"
                        : "close-circle-outline";
                const isPending = topUp.status === "Pending";
                const isPaid = topUp.status === "Paid";

                return (
                  <View
                    key={topUp.id}
                    style={[
                      styles.transactionCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.transactionLeft}>
                      <View
                        style={[
                          styles.transactionIcon,
                          { backgroundColor: statusBg },
                        ]}
                      >
                        <Ionicons
                          name={statusIcon}
                          size={20}
                          color={statusColor}
                        />
                      </View>
                      <View style={styles.transactionInfo}>
                        <ThemedText
                          style={[
                            styles.transactionTitle,
                            { color: theme.text },
                          ]}
                        >
                          Top-up #{topUp.externalId.slice(-8)}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.transactionDate,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {new Date(topUp.createdAt).toLocaleString()}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.transactionDate,
                            { color: statusColor },
                          ]}
                        >
                          {topUp.status}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 8 }}>
                      <ThemedText
                        style={[
                          styles.transactionAmount,
                          { color: theme.text },
                        ]}
                      >
                        ₱
                        {(topUp.amount ?? 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </ThemedText>
                      {isPending && !!topUp.xenditInvoiceUrl && (
                        <TouchableOpacity
                          onPress={() => openTopUpLink(topUp.xenditInvoiceUrl!)}
                          style={[
                            styles.linkButton,
                            { borderColor: theme.border },
                          ]}
                        >
                          <ThemedText
                            style={{
                              color: theme.primary,
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            Pay now
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                      {isPaid && !!topUp.xenditInvoiceUrl && (
                        <TouchableOpacity
                          onPress={() => openTopUpLink(topUp.xenditInvoiceUrl!)}
                          style={[
                            styles.linkButton,
                            { borderColor: theme.border },
                          ]}
                        >
                          <ThemedText
                            style={{
                              color: theme.primary,
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            Open receipt
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                      {isPending && user?.id && (
                        <TouchableOpacity
                          onPress={() => handleCancelTopUp(topUp.id)}
                          style={[
                            styles.linkButton,
                            { borderColor: theme.error },
                          ]}
                        >
                          <ThemedText
                            style={{
                              color: theme.error,
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            Cancel
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Withdrawal History */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <ThemedText
              type="subtitle"
              style={[styles.activityTitle, { color: theme.text }]}
            >
              Withdrawals
            </ThemedText>
          </View>
          {withdrawals.length === 0 ? (
            <View
              style={[styles.emptyState, { backgroundColor: theme.surface }]}
            >
              <ThemedText
                style={[styles.emptyText, { color: theme.textSecondary }]}
              >
                No withdrawal requests
              </ThemedText>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {withdrawals.slice(0, 5).map((req) => {
                const statusColor =
                  req.status === "Approved"
                    ? theme.success
                    : req.status === "Pending"
                      ? theme.primary
                      : req.status === "Failed" || req.status === "Rejected"
                        ? theme.error
                        : theme.textSecondary;
                const statusBg = `${statusColor}20`;
                const statusIcon =
                  req.status === "Approved"
                    ? "checkmark-circle-outline"
                    : req.status === "Pending"
                      ? "time-outline"
                      : "close-circle-outline";

                return (
                  <View
                    key={req.id}
                    style={[
                      styles.transactionCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.transactionLeft}>
                      <View
                        style={[
                          styles.transactionIcon,
                          { backgroundColor: statusBg },
                        ]}
                      >
                        <Ionicons
                          name={statusIcon}
                          size={20}
                          color={statusColor}
                        />
                      </View>
                      <View style={styles.transactionInfo}>
                        <ThemedText
                          style={[
                            styles.transactionTitle,
                            { color: theme.text },
                          ]}
                        >
                          Withdrawal to {req.bankName}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.transactionDate,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {new Date(req.requestedAt).toLocaleDateString()}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.transactionDate,
                            { color: statusColor },
                          ]}
                        >
                          {req.status}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText
                      style={[styles.transactionAmount, { color: theme.text }]}
                    >
                      ₱
                      {req.amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={topUpModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTopUpModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <ThemedText type="subtitle" style={{ color: theme.text }}>
              Create Top-up
            </ThemedText>
            <TextInput
              value={topUpAmount}
              onChangeText={setTopUpAmount}
              keyboardType="numeric"
              style={[
                styles.input,
                { borderColor: theme.border, color: theme.text },
              ]}
              placeholder="Amount"
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setTopUpModalVisible(false)}
                style={[styles.modalBtn, { borderColor: theme.border }]}
              >
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateTopUp}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#111" }}>
                  {topUpSubmitting ? "Creating..." : "Create"}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={transferModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTransferModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <ThemedText type="subtitle" style={{ color: theme.text }}>
              Transfer Wallet Balance
            </ThemedText>
            <View style={styles.transferToggle}>
              <TouchableOpacity
                onPress={() => setTransferFrom("Personal")}
                style={[
                  styles.pill,
                  {
                    backgroundColor:
                      transferFrom === "Personal"
                        ? theme.primary
                        : theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    color: transferFrom === "Personal" ? "#111" : theme.text,
                  }}
                >
                  From Personal
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTransferFrom("TopUp")}
                style={[
                  styles.pill,
                  {
                    backgroundColor:
                      transferFrom === "TopUp" ? theme.primary : theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    color: transferFrom === "TopUp" ? "#111" : theme.text,
                  }}
                >
                  From Top-up
                </ThemedText>
              </TouchableOpacity>
            </View>
            <TextInput
              value={transferAmount}
              onChangeText={setTransferAmount}
              keyboardType="numeric"
              style={[
                styles.input,
                { borderColor: theme.border, color: theme.text },
              ]}
              placeholder="Amount"
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setTransferModalVisible(false)}
                style={[styles.modalBtn, { borderColor: theme.border }]}
              >
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleTransfer}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#111" }}>Transfer</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={withdrawModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <ThemedText type="subtitle" style={{ color: theme.text }}>
              Request Withdrawal
            </ThemedText>

            <ThemedText style={{ color: theme.textSecondary, marginBottom: 4 }}>
              Amount
            </ThemedText>
            <TextInput
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="numeric"
              style={[
                styles.input,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  marginBottom: 16,
                },
              ]}
              placeholder="Amount"
              placeholderTextColor={theme.textMuted}
            />

            <ThemedText style={{ color: theme.textSecondary, marginBottom: 4 }}>
              Bank Name
            </ThemedText>
            <TextInput
              value={bankName}
              onChangeText={setBankName}
              style={[
                styles.input,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  marginBottom: 16,
                },
              ]}
              placeholder="e.g. BPI, BDO, GCASH"
              placeholderTextColor={theme.textMuted}
            />

            <ThemedText style={{ color: theme.textSecondary, marginBottom: 4 }}>
              Account Number
            </ThemedText>
            <TextInput
              value={bankAccount}
              onChangeText={setBankAccount}
              keyboardType="numeric"
              style={[
                styles.input,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  marginBottom: 16,
                },
              ]}
              placeholder="Account Number"
              placeholderTextColor={theme.textMuted}
            />

            <ThemedText style={{ color: theme.textSecondary, marginBottom: 4 }}>
              Account Holder Name
            </ThemedText>
            <TextInput
              value={accountHolder}
              onChangeText={setAccountHolder}
              style={[
                styles.input,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  marginBottom: 24,
                },
              ]}
              placeholder="Account Name"
              placeholderTextColor={theme.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setWithdrawModalVisible(false)}
                style={[styles.modalBtn, { borderColor: theme.border }]}
              >
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleWithdrawal}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#111" }}>
                  {isWithdrawing ? "Submitting..." : "Withdraw"}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  earningsBreakdownSection: {
    marginBottom: 24,
  },
  earningsCard: {
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  earningsRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  earningsRowLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  earningsRowValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  earningsRowLabelGross: {
    fontSize: 15,
    fontWeight: "700",
  },
  earningsRowValueGross: {
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#374151",
    opacity: 0.3,
    marginVertical: 8,
  },
  earningsPillsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  earningPill: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  earningPillLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  earningPillValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: "500",
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  walletCardContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  walletCard: {
    borderRadius: 24,
    padding: 24,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  walletCardBg1: {
    position: "absolute",
    top: -64,
    right: -64,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: "#FFD700",
    opacity: 0.1,
  },
  walletCardBg2: {
    position: "absolute",
    bottom: -64,
    left: -64,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: "#FFD700",
    opacity: 0.05,
  },
  walletCardContent: {
    position: "relative",
    zIndex: 10,
  },
  walletCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  walletCardLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: "700",
  },
  walletBalance: {
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 32,
  },
  walletCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  beeIdLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  beeIdValue: {
    fontSize: 14,
    fontFamily: "monospace",
    letterSpacing: 2,
  },
  chipIcon: {
    opacity: 0.8,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  quickAction: {
    alignItems: "center",
    gap: 8,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  activitySection: {
    paddingHorizontal: 24,
    gap: 16,
  },
  summaryCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  summarySubtext: {
    fontSize: 12,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  transactionsList: {
    gap: 12,
  },
  transactionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionInfo: {
    flex: 1,
    gap: 4,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  transactionDate: {
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  accessDenied: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  transferToggle: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
