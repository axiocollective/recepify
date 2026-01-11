export const LANGUAGE_OPTIONS = [
  { label: "English", value: "English", code: "en" },
  { label: "German", value: "German", code: "de" },
] as const;

export type LanguageValue = (typeof LANGUAGE_OPTIONS)[number]["value"];
export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["code"];

export const getLanguageCode = (value?: string): LanguageCode => {
  const match = LANGUAGE_OPTIONS.find((option) => option.value === value);
  return match?.code ?? "en";
};

export const getLanguageValue = (code?: string): LanguageValue => {
  const match = LANGUAGE_OPTIONS.find((option) => option.code === code);
  return match?.value ?? "English";
};
