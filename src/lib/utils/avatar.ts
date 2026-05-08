export const AVATAR_COLORS = [
  "#4a154b", // Slack purple
  "#350d36", // dark purple
  "#1264a3", // blue
  "#0b6e99", // teal
  "#007a5a", // green
  "#3d8e2f", // lime
  "#cd5b45", // coral
  "#bb6918", // amber
] as const;

export function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === "") return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
