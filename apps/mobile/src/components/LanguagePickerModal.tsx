import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography, shadow } from "../theme/theme";
import { LANGUAGE_OPTIONS, type LanguageCode, type LanguageValue, getLanguageCode } from "../data/languages";

interface LanguagePickerModalProps {
  visible: boolean;
  title?: string;
  selected: LanguageValue;
  currentLanguageCode: LanguageCode;
  onSelect: (value: LanguageValue) => void;
  onConfirm: (target: LanguageCode) => void;
  onClose: () => void;
}

export const LanguagePickerModal: React.FC<LanguagePickerModalProps> = ({
  visible,
  title = "Translate recipe",
  selected,
  currentLanguageCode,
  onSelect,
  onConfirm,
  onClose,
}) => {
  const targetCode = getLanguageCode(selected);
  const isSameLanguage = targetCode === currentLanguageCode;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, shadow.lg]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="language-outline" size={18} color={colors.gray500} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <Text style={styles.subtitle}>Choose a target language</Text>
          </View>

          <View style={styles.options}>
            {LANGUAGE_OPTIONS.map((option, index) => {
              const isSelected = option.value === selected;
              const isLast = index === LANGUAGE_OPTIONS.length - 1;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  style={[
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                    isLast && styles.optionRowLast,
                  ]}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={colors.blue600} />}
                </Pressable>
              );
            })}
          </View>

          {isSameLanguage && (
            <Text style={styles.helperText}>This recipe is already in this language.</Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={onClose}>
              <Text style={[styles.actionText, styles.cancelText]}>Cancel</Text>
            </Pressable>
            <View style={styles.actionDivider} />
            <Pressable
              style={styles.actionButton}
              onPress={() => onConfirm(targetCode)}
              disabled={isSameLanguage}
            >
              <Text style={[styles.actionText, isSameLanguage && styles.actionTextDisabled]}>
                Translate
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 0,
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  options: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  optionRowLast: {
    borderBottomWidth: 0,
  },
  optionRowSelected: {
    backgroundColor: colors.gray50,
  },
  optionText: {
    ...typography.body,
    color: colors.gray700,
  },
  optionTextSelected: {
    color: colors.gray900,
    fontWeight: "600",
  },
  helperText: {
    ...typography.caption,
    color: colors.gray500,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray200,
  },
  actionText: {
    ...typography.bodySmall,
    color: colors.blue600,
    fontWeight: "600",
  },
  cancelText: {
    color: colors.gray700,
    fontWeight: "500",
  },
  actionTextDisabled: {
    color: colors.gray400,
  },
});
