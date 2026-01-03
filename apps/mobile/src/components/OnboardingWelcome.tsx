import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useApp } from "../data/AppContext";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

interface OnboardingWelcomeProps {
  onContinue: () => void;
}

const LANGUAGES = ["English", "Deutsch"] as const;
const COUNTRIES = [
  "United States",
  "Germany",
  "United Kingdom",
  "Spain",
  "France",
  "Italy",
  "Portugal",
  "Netherlands",
  "Poland",
  "Austria",
  "Switzerland",
  "Belgium",
  "Sweden",
  "Denmark",
  "Norway",
  "Finland",
  "Ireland",
  "Greece",
  "Czech Republic",
  "Hungary",
  "Romania",
];

export const OnboardingWelcome: React.FC<OnboardingWelcomeProps> = ({ onContinue }) => {
  const { updateProfile } = useApp();
  const [name, setName] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<(typeof LANGUAGES)[number]>("English");
  const [selectedCountry, setSelectedCountry] = useState("United States");
  const [activeMenu, setActiveMenu] = useState<"language" | "country" | null>(null);
  const [countrySearch, setCountrySearch] = useState("");

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return COUNTRIES;
    return COUNTRIES.filter((country) => country.toLowerCase().includes(query));
  }, [countrySearch]);

  const closeMenus = () => {
    setActiveMenu(null);
    setCountrySearch("");
  };

  const handleContinue = () => {
    const languageValue = selectedLanguage === "Deutsch" ? "German" : "English";
    updateProfile({ name: name.trim(), language: languageValue, country: selectedCountry });
    onContinue();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="chef-hat" size={64} color={colors.white} />
        </View>
        <Text style={styles.title}>Welcome to Recipefy</Text>
        <Text style={styles.subtitle}>Let&apos;s personalize your experience</Text>

        <View style={styles.field}>
          <Text style={styles.label}>How should I call you?</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={20} color={colors.gray400} style={styles.inputIcon} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colors.gray400}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Preferred Language</Text>
          <View style={styles.dropdownWrap}>
            <Pressable
              style={({ pressed }) => [styles.dropdownButton, pressed && styles.dropdownPressed]}
              onPress={() => setActiveMenu("language")}
            >
              <View style={styles.dropdownLeft}>
                <Ionicons name="globe-outline" size={20} color={colors.gray400} />
                <Text style={styles.dropdownText}>{selectedLanguage}</Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.gray400} />
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Your Location</Text>
          <View style={styles.dropdownWrap}>
            <Pressable
              style={({ pressed }) => [styles.dropdownButton, pressed && styles.dropdownPressed]}
              onPress={() => setActiveMenu("country")}
            >
              <View style={styles.dropdownLeft}>
                <Ionicons name="location-outline" size={20} color={colors.gray400} />
                <Text style={styles.dropdownText}>{selectedCountry}</Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.gray400} />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}
          onPress={handleContinue}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
        <Text style={styles.helperText}>You can change these settings anytime</Text>
      </View>

      <Modal visible={activeMenu !== null} transparent animationType="fade" onRequestClose={closeMenus}>
        <Pressable style={styles.backdrop} onPress={closeMenus}>
          <Pressable style={styles.menuCard} onPress={() => undefined}>
            {activeMenu === "country" ? (
              <>
                <Text style={styles.menuTitle}>Choose your country</Text>
                <View style={styles.searchRow}>
                  <Ionicons name="search" size={16} color={colors.gray400} style={styles.searchIcon} />
                  <TextInput
                    value={countrySearch}
                    onChangeText={setCountrySearch}
                    placeholder="Search countries..."
                    placeholderTextColor={colors.gray400}
                    style={styles.searchInput}
                  />
                </View>
                <ScrollView style={styles.countryList}>
                  {filteredCountries.map((country) => (
                    <Pressable
                      key={country}
                      onPress={() => {
                        setSelectedCountry(country);
                        closeMenus();
                      }}
                      style={[
                        styles.dropdownItem,
                        selectedCountry === country && styles.dropdownItemActive,
                      ]}
                    >
                      <Text style={styles.dropdownItemText}>{country}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.menuTitle}>Choose your language</Text>
                {LANGUAGES.map((language) => (
                  <Pressable
                    key={language}
                    onPress={() => {
                      setSelectedLanguage(language);
                      closeMenus();
                    }}
                    style={[
                      styles.dropdownItem,
                      selectedLanguage === language && styles.dropdownItemActive,
                    ]}
                  >
                    <Text style={styles.dropdownItemText}>{language}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </Pressable>
        </Pressable>
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    alignItems: "center",
    gap: spacing.lg,
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
  },
  logo: {
    width: 128,
    height: 128,
    borderRadius: 40,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.gray900,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  title: {
    ...typography.h1,
    color: colors.gray900,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.gray500,
    textAlign: "center",
  },
  field: {
    width: "100%",
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.gray500,
    fontWeight: "500",
    paddingHorizontal: 4,
  },
  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  inputIcon: {
    position: "absolute",
    left: 16,
  },
  input: {
    minHeight: 56,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.gray200,
    paddingLeft: 48,
    paddingRight: 16,
    ...typography.body,
    color: colors.gray900,
  },
  dropdownWrap: {
    width: "100%",
  },
  dropdownButton: {
    minHeight: 56,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
  },
  dropdownPressed: {
    backgroundColor: colors.gray50,
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dropdownText: {
    ...typography.body,
    color: colors.gray900,
  },
  menuCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    ...shadow.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  menuTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
    textAlign: "center",
  },
  dropdownItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dropdownItemActive: {
    backgroundColor: colors.purple100,
    borderLeftWidth: 4,
    borderLeftColor: colors.purple600,
  },
  dropdownItemText: {
    ...typography.bodySmall,
    color: colors.gray900,
  },
  searchRow: {
    paddingTop: spacing.sm,
  },
  searchIcon: {
    position: "absolute",
    left: spacing.md,
    top: spacing.sm + 6,
  },
  searchInput: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.gray200,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.xxl,
    paddingRight: spacing.md,
    backgroundColor: colors.white,
    ...typography.bodySmall,
    color: colors.gray900,
  },
  countryList: {
    maxHeight: 256,
  },
  primaryButton: {
    minHeight: 56,
    width: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    ...shadow.lg,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  primaryPressed: {
    transform: [{ scale: 0.98 }],
  },
  helperText: {
    ...typography.caption,
    color: colors.gray400,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
