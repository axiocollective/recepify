export const colors = {
  white: "#ffffff",
  black: "#030213",
  gray900: "#1a1d29",
  gray800: "#2b2f3a",
  gray700: "#4b5563",
  gray600: "#6b7280",
  gray500: "#9ca3af",
  gray400: "#d1d5db",
  gray200: "#e5e7eb",
  gray100: "#f3f4f6",
  gray50: "#f9fafb",
  purple600: "#9333ea",
  purple500: "#a855f7",
  purple100: "#f3e8ff",
  red500: "#ef4444",
  green500: "#22c55e",
  yellow500: "#eab308",
};

export const typography = {
  h1: { fontSize: 34, lineHeight: 41, fontWeight: "700" as const },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400" as const },
  bodyBold: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  bodySmall: { fontSize: 15, lineHeight: 20, fontWeight: "400" as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  captionBold: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 28,
  full: 999,
};

export const shadow = {
  md: {
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  lg: {
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
};
