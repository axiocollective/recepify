import React, { useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";
import { PRIVACY_POLICY_TEXT, PRIVACY_POLICY_TITLE, TERMS_OF_USE_TEXT, TERMS_OF_USE_TITLE } from "../content/legal";

interface OnboardingConsentProps {
  onContinue: () => void;
}

export const OnboardingConsent: React.FC<OnboardingConsentProps> = ({ onContinue }) => {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [activeDoc, setActiveDoc] = useState<"terms" | "privacy" | null>(null);

  const canContinue = acceptedTerms && acceptedPrivacy;

  const openTerms = () => setActiveDoc("terms");
  const openPrivacy = () => setActiveDoc("privacy");
  const closeDoc = () => setActiveDoc(null);

  const docTitle = activeDoc === "terms" ? TERMS_OF_USE_TITLE : PRIVACY_POLICY_TITLE;
  const docText = activeDoc === "terms" ? TERMS_OF_USE_TEXT : PRIVACY_POLICY_TEXT;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark-outline" size={24} color={colors.purple600} />
        </View>
        <Text style={styles.title}>Before you start</Text>
        <Text style={styles.subtitle}>
          Please review and accept our Terms of Use and Privacy Policy to continue.
        </Text>

        <View style={styles.consentList}>
          <Pressable style={styles.consentRow} onPress={() => setAcceptedTerms((prev) => !prev)}>
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms && <Ionicons name="checkmark" size={16} color={colors.white} />}
            </View>
            <Text style={styles.consentText}>
              I agree to the{" "}
              <Text style={styles.linkText} onPress={openTerms}>
                Terms of Use
              </Text>
            </Text>
          </Pressable>

          <Pressable style={styles.consentRow} onPress={() => setAcceptedPrivacy((prev) => !prev)}>
            <View style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}>
              {acceptedPrivacy && <Ionicons name="checkmark" size={16} color={colors.white} />}
            </View>
            <Text style={styles.consentText}>
              I agree to the{" "}
              <Text style={styles.linkText} onPress={openPrivacy}>
                Privacy Policy
              </Text>
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            !canContinue && styles.primaryButtonDisabled,
            pressed && canContinue && styles.primaryPressed,
          ]}
          onPress={onContinue}
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>

      <Modal visible={activeDoc !== null} transparent animationType="slide" onRequestClose={closeDoc}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{docTitle}</Text>
              <Pressable onPress={closeDoc} style={styles.modalClose}>
                <Ionicons name="close" size={18} color={colors.gray600} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalText}>{docText}</Text>
            </ScrollView>
            <Pressable style={styles.modalButton} onPress={closeDoc}>
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  card: {
    alignItems: "center",
    gap: spacing.lg,
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.purple100,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.medium,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.gray900,
    textAlign: "center",
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: "center",
  },
  consentList: {
    gap: spacing.md,
    width: "100%",
    marginTop: spacing.sm,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gray300,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.purple600,
    borderColor: colors.purple600,
  },
  consentText: {
    ...typography.bodySmall,
    color: colors.gray700,
  },
  linkText: {
    color: colors.purple600,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: spacing.lg,
    width: "100%",
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  primaryPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray100,
  },
  modalBody: {
    marginBottom: spacing.md,
  },
  modalText: {
    ...typography.bodySmall,
    color: colors.gray700,
    lineHeight: 20,
  },
  modalButton: {
    alignSelf: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
  },
  modalButtonText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
});
