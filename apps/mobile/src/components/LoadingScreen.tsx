import React, { useEffect, useRef } from "react";
import { Animated, Image, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/theme";

export const LoadingScreen: React.FC = () => {
  const dotAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(
        120,
        dotAnims.map((anim) =>
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
          ])
        )
      )
    );
    loop.start();
    return () => loop.stop();
  }, [dotAnims]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logo}>
        <View style={styles.logoImageWrap}>
          <Image source={require("../../assets/logo.png")} style={styles.logoImage} resizeMode="contain" />
        </View>
      </View>
      <Text style={styles.text}>Loading...</Text>
      <View style={styles.dotsRow}>
        {dotAnims.map((anim, index) => (
          <Animated.View
            key={`dot-${index}`}
            style={[
              styles.dot,
              {
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
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
  logoImageWrap: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  text: {
    ...typography.body,
    color: colors.gray500,
  },
  dotsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.purple600,
  },
});
