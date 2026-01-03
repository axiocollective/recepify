import React, { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../services/supabaseClient";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

interface LoginScreenProps {
  onBack: () => void;
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onBack, onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!password.trim()) {
      setErrorMessage("Please enter your password.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: password.trim(),
        });
        if (error) throw error;
        if (data.session) {
          onLogin();
        } else {
          setInfoMessage("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: password.trim(),
        });
        if (error) throw error;
        onLogin();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in right now.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={20} color={colors.gray900} />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="chef-hat" size={64} color={colors.white} />
        </View>
        <Text style={styles.title}>{isSignUp ? "Create Account" : "Sign In"}</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? "Create your Recipefy account with email" : "Enter your credentials to continue"}
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Username or Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color={colors.gray400} style={styles.inputIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={colors.gray400}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color={colors.gray400} style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.gray400}
                secureTextEntry
                style={styles.input}
              />
            </View>
          </View>

          {infoMessage && <Text style={styles.infoText}>{infoMessage}</Text>}
          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.submit,
              pressed && styles.buttonPressed,
              isSubmitting && styles.submitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? "Working..." : isSignUp ? "Create account" : "Sign In"}
            </Text>
          </Pressable>

          {isSignUp ? (
            <Pressable onPress={() => setIsSignUp(false)}>
              <Text style={styles.toggleText}>Already have an account? Sign in</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setIsSignUp(true)}>
              <Text style={styles.toggleText}>No account yet? Create one</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
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
    marginBottom: spacing.md,
  },
  form: {
    width: "100%",
    gap: spacing.lg,
    maxWidth: 360,
    alignSelf: "center",
  },
  field: {
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
  submit: {
    minHeight: 56,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    ...shadow.lg,
  },
  submitDisabled: {
    backgroundColor: colors.gray400,
  },
  submitText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  forgotText: {
    ...typography.bodySmall,
    color: colors.purple600,
    textAlign: "center",
  },
  errorText: {
    ...typography.caption,
    color: colors.red500,
    textAlign: "center",
  },
  infoText: {
    ...typography.caption,
    color: colors.gray500,
    textAlign: "center",
  },
  toggleText: {
    ...typography.bodySmall,
    color: colors.purple600,
    textAlign: "center",
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
});
