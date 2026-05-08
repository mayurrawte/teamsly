import { avatarColor, avatarInitials } from "@/lib/utils/avatar";

type AvatarSize = 18 | 20 | 24 | 36;

interface AvatarProps {
  userId: string;
  displayName: string;
  size?: AvatarSize;
  photoUrl?: string;
  className?: string;
}

const FONT_SIZE: Record<AvatarSize, number> = {
  18: 9,
  20: 10,
  24: 11,
  36: 14,
};

const RADIUS: Record<AvatarSize, number> = {
  18: 3,
  20: 3,
  24: 4,
  36: 4,
};

export function Avatar({ userId, displayName, size = 36, photoUrl, className }: AvatarProps) {
  const bg = avatarColor(userId);
  const initials = avatarInitials(displayName);
  const px = `${size}px`;
  const radius = `${RADIUS[size]}px`;
  const font = `${FONT_SIZE[size]}px`;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={displayName}
        width={size}
        height={size}
        style={{ width: px, height: px, borderRadius: radius }}
        className={`flex-shrink-0 object-cover ${className ?? ""}`}
      />
    );
  }

  return (
    <div
      aria-label={displayName}
      role="img"
      style={{
        width: px,
        height: px,
        borderRadius: radius,
        background: bg,
        fontSize: font,
      }}
      className={`flex flex-shrink-0 items-center justify-center font-bold text-white select-none ${className ?? ""}`}
    >
      {initials}
    </div>
  );
}
