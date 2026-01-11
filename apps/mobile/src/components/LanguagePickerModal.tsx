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
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.subtitle}>Choose a target language</Text>

          <View style={styles.options}>
            {LANGUAGE_OPTIONS.map((option) => {
              const isSelected = option.value === selected;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={colors.gray900} />}
                </Pressable>
              );
            })}
          </View>

          {isSameLanguage && (
            <Text style={styles.helperText}>This recipe is already in this language.</Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, isSameLanguage && styles.confirmButtonDisabled]}
              onPress={() => onConfirm(targetCode)}
              disabled={isSameLanguage}
            >
              <Text style={styles.confirmText}>Translate</Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray100,
  },
  closeText: {
    fontSize: 20,
    color: colors.gray500,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  options: {
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  optionRowSelected: {
    borderColor: colors.gray900,
    backgroundColor: colors.gray100,
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
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  cancelText: {
    ...typography.bodySmall,
    color: colors.gray700,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    backgroundColor: colors.gray900,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  confirmText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
});
