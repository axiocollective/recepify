import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";
import { PRIVACY_POLICY_TEXT, PRIVACY_POLICY_TITLE, TERMS_OF_USE_TEXT, TERMS_OF_USE_TITLE } from "../content/legal";
import { LANGUAGE_OPTIONS, type LanguageValue } from "../data/languages";

interface ProfileProps {
  name: string;
  email: string;
  language: LanguageValue;
  country: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onLanguageChange: (value: LanguageValue) => void;
  onCountryChange: (value: string) => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onOpenPlans: () => void;
  subscriptionStatus?: "active" | "canceled" | "expired";
  subscriptionEndsAt?: string | null;
}

type StatusMessage = {
  type: "success" | "error";
  text: string;
};

type EditableField = "name" | "email" | null;

export const Profile: React.FC<ProfileProps> = ({
  name,
  email,
  language,
  country,
  onNameChange,
  onEmailChange,
  onLanguageChange,
  onCountryChange,
  onLogout,
  onDeleteAccount,
  onOpenPlans,
  subscriptionStatus = "active",
  subscriptionEndsAt = null,
}) => {
  const [pendingName, setPendingName] = useState(name);
  const [pendingEmail, setPendingEmail] = useState(email);
  const [isEditing, setIsEditing] = useState<EditableField>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<"terms" | "privacy" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");

  const languageOptions = LANGUAGE_OPTIONS.map((option) => option.value);
  const countryOptions = [
    "Austria",
    "Belgium",
    "Brazil",
    "Canada",
    "China",
    "Denmark",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "India",
    "Indonesia",
    "Ireland",
    "Italy",
    "Japan",
    "Mexico",
    "Netherlands",
    "Norway",
    "Poland",
    "Portugal",
    "Spain",
    "Sweden",
    "Switzerland",
    "Thailand",
    "Turkey",
    "United Kingdom",
    "United States",
  ];

  const filteredCountries = countryOptions.filter((item) =>
    item.toLowerCase().includes(countryQuery.trim().toLowerCase())
  );


  useEffect(() => {
    setPendingName(name);
  }, [name]);

  useEffect(() => {
    setPendingEmail(email);
  }, [email]);

  const handleEditToggle = (field: EditableField) => {
    setIsEditing(field);
    if (field === "name") {
      setPendingName(name);
    }
    if (field === "email") {
      setPendingEmail(email);
    }
  };

  const handlePasswordSubmit = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatusMessage({ type: "error", text: "Please fill in all password fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: "error", text: "New passwords must match." });
      return;
    }
    setStatusMessage({ type: "success", text: "Password updated successfully." });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsPasswordModalOpen(false);
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setStatusMessage(null);
    try {
      await onDeleteAccount();
      setIsDeleteModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete account.";
      setStatusMessage({ type: "error", text: message });
      setIsDeleting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Account</Text>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.content}>
        {statusMessage && (
          <View
            style={[
              styles.statusCard,
              statusMessage.type === "success" ? styles.statusSuccess : styles.statusError,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                statusMessage.type === "success" ? styles.statusTextSuccess : styles.statusTextError,
              ]}
            >
              {statusMessage.text}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account details</Text>
          <ProfileRow
            icon="person-outline"
            label="Name"
            value={pendingName || "Your name"}
            onPress={() => handleEditToggle("name")}
          />
          <ProfileRow
            icon="mail-outline"
            label="Email"
            value={pendingEmail || "you@example.com"}
            onPress={() => handleEditToggle("email")}
          />
          <ProfileRow
            icon="lock-closed-outline"
            label="Password"
            value="••••••••"
            onPress={() => setIsPasswordModalOpen(true)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Preferences</Text>
          <ProfileRow
            icon="globe-outline"
            label="Language"
            value={language}
            onPress={() => setIsLanguageModalOpen(true)}
          />
          <ProfileRow
            icon="location-outline"
            label="Location"
            value={country}
            onPress={() => setIsCountryModalOpen(true)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Support</Text>
          <ProfileRow
            icon="help-circle-outline"
            label="Help & Support"
            value="Get help or contact us"
            onPress={() => setIsSupportModalOpen(true)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Plan & usage</Text>
          <View style={styles.planRowWrap}>
            <ProfileRow
              icon="card-outline"
              label="Plan, subscription & usage"
              value="View limits, manage, or upgrade."
              onPress={onOpenPlans}
            />
            {subscriptionStatus !== "active" && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {subscriptionStatus === "expired"
                    ? "Expired"
                    : subscriptionEndsAt
                      ? `Canceled · ends ${new Date(subscriptionEndsAt).toLocaleDateString("en-US", {
                          day: "2-digit",
                          month: "short",
                        })}`
                      : "Canceled"}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Legal</Text>
          <ProfileRow
            icon="document-text-outline"
            label="Terms of Use"
            value="Review terms of use"
            onPress={() => setLegalDoc("terms")}
          />
          <ProfileRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            value="Review data privacy policy"
            onPress={() => setLegalDoc("privacy")}
          />
        </View>

        <Pressable onPress={onLogout} style={styles.logoutCard}>
          <View style={styles.logoutLeft}>
            <View style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={18} color="#dc2626" />
            </View>
            <View>
              <Text style={styles.logoutTitle}>Log out</Text>
              <Text style={styles.logoutSubtitle}>Sign out of your account</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#f87171" />
        </Pressable>

        <Pressable onPress={() => setIsDeleteModalOpen(true)} style={styles.deleteCard}>
          <View style={styles.deleteLeft}>
            <View style={styles.deleteIcon}>
              <Ionicons name="trash-outline" size={18} color="#b91c1c" />
            </View>
            <View>
              <Text style={styles.deleteTitle}>Delete account</Text>
              <Text style={styles.deleteSubtitle}>Permanently remove your profile and data</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fca5a5" />
        </Pressable>
      </View>

      {isPasswordModalOpen && (
        <Overlay title="Change password" onClose={() => setIsPasswordModalOpen(false)}>
          <View style={styles.modalBody}>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Current password</Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                style={styles.modalInput}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>New password</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                style={styles.modalInput}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Confirm new password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={styles.modalInput}
              />
            </View>
            <Pressable onPress={handlePasswordSubmit} style={styles.modalPrimary}>
              <Text style={styles.modalPrimaryText}>Update password</Text>
            </Pressable>
          </View>
        </Overlay>
      )}

      {isSupportModalOpen && (
        <Overlay title="Help & Support" onClose={() => setIsSupportModalOpen(false)}>
          <View style={styles.modalBody}>
            <Text style={styles.supportText}>
              Need help with Recipefy? Reach out to our team anytime.
            </Text>
            <View style={styles.supportCard}>
              <Text style={styles.supportTitle}>Email</Text>
              <Text style={styles.supportValue}>support@recipefy.app</Text>
            </View>
            <View style={styles.supportCard}>
              <Text style={styles.supportTitle}>Response time</Text>
              <Text style={styles.supportValue}>We typically respond within 24 hours on business days.</Text>
            </View>
            <Pressable
              onPress={() => {
                setIsSupportModalOpen(false);
                setStatusMessage({ type: "success", text: "Support request sent." });
              }}
              style={styles.modalPrimary}
            >
              <Text style={styles.modalPrimaryText}>Send message</Text>
            </Pressable>
          </View>
        </Overlay>
      )}

      {isEditing === "name" && (
        <Overlay title="Update name" onClose={() => setIsEditing(null)}>
          <View style={styles.modalBody}>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                value={pendingName}
                onChangeText={setPendingName}
                placeholder="Enter your name"
                placeholderTextColor={colors.gray400}
                style={styles.modalInput}
              />
            </View>
            <Pressable
              onPress={() => {
                const next = pendingName.trim();
                if (!next) {
                  setStatusMessage({ type: "error", text: "Name cannot be empty." });
                  return;
                }
                onNameChange(next);
                setPendingName(next);
                setIsEditing(null);
                setStatusMessage({ type: "success", text: "Name updated." });
              }}
              style={styles.modalPrimary}
            >
              <Text style={styles.modalPrimaryText}>Save changes</Text>
            </Pressable>
          </View>
        </Overlay>
      )}

      {isEditing === "email" && (
        <Overlay title="Update email" onClose={() => setIsEditing(null)}>
          <View style={styles.modalBody}>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Email</Text>
              <TextInput
                value={pendingEmail}
                onChangeText={setPendingEmail}
                placeholder="Enter your email"
                placeholderTextColor={colors.gray400}
                style={styles.modalInput}
                autoCapitalize="none"
              />
            </View>
            <Pressable
              onPress={() => {
                const next = pendingEmail.trim();
                if (!next.includes("@")) {
                  setStatusMessage({ type: "error", text: "Please enter a valid email." });
                  return;
                }
                onEmailChange(next);
                setPendingEmail(next);
                setIsEditing(null);
                setStatusMessage({ type: "success", text: "Email updated." });
              }}
              style={styles.modalPrimary}
            >
              <Text style={styles.modalPrimaryText}>Save changes</Text>
            </Pressable>
          </View>
        </Overlay>
      )}

      {isLanguageModalOpen && (
        <Overlay title="Select language" onClose={() => setIsLanguageModalOpen(false)}>
          <View style={styles.modalBody}>
            {languageOptions.map((option) => {
              const isSelected = option === language;
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    onLanguageChange(option);
                    setIsLanguageModalOpen(false);
                  }}
                  style={[styles.choiceRow, isSelected && styles.choiceRowSelected]}
                >
                  <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>{option}</Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={colors.purple600} />}
                </Pressable>
              );
            })}
          </View>
        </Overlay>
      )}

      {isCountryModalOpen && (
        <Overlay title="Select location" onClose={() => setIsCountryModalOpen(false)}>
          <View style={styles.modalBody}>
            <TextInput
              value={countryQuery}
              onChangeText={setCountryQuery}
              placeholder="Search for a country..."
              placeholderTextColor={colors.gray400}
              style={styles.searchInput}
              autoCapitalize="words"
            />
            <ScrollView style={styles.choiceList}>
              {filteredCountries.map((option) => {
                const isSelected = option === country;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      onCountryChange(option);
                      setIsCountryModalOpen(false);
                      setCountryQuery("");
                    }}
                    style={[styles.choiceRow, isSelected && styles.choiceRowSelected]}
                  >
                    <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>{option}</Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.purple600} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Overlay>
      )}

      {isDeleteModalOpen && (
        <Overlay title="Delete account" onClose={() => setIsDeleteModalOpen(false)}>
          <View style={styles.modalBody}>
            <Text style={styles.deleteWarning}>
              This will permanently delete your account, recipes, and saved data. This action cannot be undone.
            </Text>
            <Pressable
              onPress={handleDeleteAccount}
              style={styles.modalDanger}
              disabled={isDeleting}
            >
              <Text style={styles.modalDangerText}>
                {isDeleting ? "Deleting..." : "Delete account"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setIsDeleteModalOpen(false)}
              style={styles.modalSecondary}
              disabled={isDeleting}
            >
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </Overlay>
      )}

      {legalDoc && (
        <Overlay
          title={legalDoc === "terms" ? TERMS_OF_USE_TITLE : PRIVACY_POLICY_TITLE}
          onClose={() => setLegalDoc(null)}
        >
          <View style={styles.modalBody}>
            <ScrollView style={styles.legalScroll}>
              <Text style={styles.legalText}>
                {legalDoc === "terms" ? TERMS_OF_USE_TEXT : PRIVACY_POLICY_TEXT}
              </Text>
            </ScrollView>
          </View>
        </Overlay>
      )}
    </ScrollView>
  );
};

interface ProfileRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  onPress: () => void;
}

const ProfileRow: React.FC<ProfileRowProps> = ({ icon, label, value, onPress }) => (
  <Pressable onPress={onPress} style={[styles.rowCard, shadow.md]}>
    <View style={styles.rowLeft}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.gray700} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
  </Pressable>
);

interface OverlayProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Overlay: React.FC<OverlayProps> = ({ title, onClose, children }) => (
  <Modal transparent animationType="fade">
    <View style={styles.overlayBackdrop}>
      <View style={styles.overlayCard}>
        <View style={styles.overlayHeader}>
          <View style={styles.overlayTitleRow}>
            <Ionicons name="sparkles-outline" size={18} color={colors.gray400} />
            <Text style={styles.overlayTitle}>{title}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.overlayClose}>
            <Text style={styles.overlayCloseText}>×</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  headerLabel: {
    ...typography.caption,
    color: colors.gray500,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.gray900,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
    paddingTop: spacing.xl,
  },
  statusCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadow.md,
  },
  statusSuccess: {
    backgroundColor: "#ecfdf3",
  },
  statusError: {
    backgroundColor: "#fef2f2",
  },
  statusText: {
    ...typography.bodySmall,
  },
  statusTextSuccess: {
    color: "#15803d",
  },
  statusTextError: {
    color: "#dc2626",
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.gray500,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  planList: {
    gap: spacing.md,
  },
  planCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: spacing.lg,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  planCardSelected: {
    borderColor: colors.purple600,
    backgroundColor: colors.purple100,
  },
  planCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  planTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.gray900,
  },
  planTitleSelected: {
    color: colors.purple600,
  },
  planPrice: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
    marginTop: 2,
  },
  planSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
  },
  planIncludes: {
    gap: spacing.xs,
  },
  planIncludeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  planIncludeText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray700,
  },
  planUpgradeButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  planUpgradeText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.white,
  },
  currentPlanCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  currentPlanHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  currentPlanLabel: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.gray500,
  },
  currentPlanName: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.gray900,
  },
  currentPlanPrice: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.gray700,
  },
  currentPlanSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
  },
  currentPlanIncludes: {
    gap: spacing.xs,
  },
  currentPlanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  currentPlanItem: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray700,
  },
  currentPlanActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  planActionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignItems: "center",
    backgroundColor: colors.gray900,
  },
  planActionSecondary: {
    backgroundColor: colors.gray100,
  },
  planActionPrimaryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.white,
  },
  planActionSecondaryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.gray900,
  },
  rowCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 80,
    backgroundColor: colors.white,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    ...typography.caption,
    color: colors.gray500,
  },
  rowValue: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  planRowWrap: {
    gap: spacing.sm,
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.gray600,
  },
  logoutCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "rgba(254,242,242,0.7)",
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 80,
    ...shadow.md,
  },
  logoutLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  logoutIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutTitle: {
    ...typography.bodyBold,
    color: "#dc2626",
  },
  logoutSubtitle: {
    ...typography.caption,
    color: "#f87171",
  },
  deleteCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "rgba(254,242,242,0.7)",
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 80,
    ...shadow.md,
  },
  deleteLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  deleteIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteTitle: {
    ...typography.bodyBold,
    color: "#b91c1c",
  },
  deleteSubtitle: {
    ...typography.caption,
    color: "#f87171",
  },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  overlayCard: {
    width: "100%",
    borderRadius: 32,
    backgroundColor: colors.white,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  overlayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overlayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  overlayTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    color: colors.gray900,
  },
  overlayClose: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayCloseText: {
    fontSize: 20,
    color: colors.gray500,
  },
  modalBody: {
    gap: spacing.md,
  },
  legalScroll: {
    maxHeight: 360,
  },
  legalText: {
    ...typography.bodySmall,
    color: colors.gray700,
    lineHeight: 20,
  },
  modalField: {
    gap: spacing.sm,
  },
  modalLabel: {
    ...typography.bodySmall,
    color: colors.gray700,
    fontWeight: "600",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    ...typography.body,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    ...typography.body,
  },
  choiceList: {
    maxHeight: 320,
  },
  toggleCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTitle: {
    ...typography.bodyMedium,
    color: colors.gray900,
  },
  toggleSubtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
  },
  choiceRow: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  choiceRowSelected: {
    borderColor: colors.purple200,
    backgroundColor: colors.purple50,
  },
  choiceText: {
    ...typography.body,
    color: colors.gray900,
  },
  choiceTextSelected: {
    color: colors.purple700,
    fontWeight: "600",
  },
  modalPrimary: {
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 44,
  },
  modalPrimaryText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  modalSecondary: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 44,
  },
  modalSecondaryText: {
    ...typography.bodySmall,
    color: colors.gray700,
  },
  modalDanger: {
    borderRadius: radius.full,
    backgroundColor: "#b91c1c",
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 44,
  },
  modalDangerText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  deleteWarning: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  supportText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  supportCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: spacing.lg,
  },
  supportTitle: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  supportValue: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
});
