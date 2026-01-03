export const formatDuration = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (normalized.match(/[a-z]/)) {
    return trimmed;
  }
  if (normalized.match(/^\d+$/)) {
    return `${trimmed} min`;
  }
  return trimmed;
};
