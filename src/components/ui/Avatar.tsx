"use client";

import { useState } from "react";
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
  const [imageError, setImageError] = useState(false);

  const bg = avatarColor(userId);
  const initials = avatarInitials(displayName);
  const px = `${size}px`;
  const radius = `${RADIUS[size]}px`;
  const font = `${FONT_SIZE[size]}px`;

  const initialsEl = (
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

  // photoUrl prop takes priority (legacy support)
  if (photoUrl && !imageError) {
    return (
      <img
        src={photoUrl}
        alt={displayName}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: px, height: px, borderRadius: radius }}
        className={`flex-shrink-0 object-cover ${className ?? ""}`}
        onError={() => setImageError(true)}
      />
    );
  }

  if (photoUrl && imageError) {
    return initialsEl;
  }

  // Use proxy route when userId looks like a Graph object id (non-empty, not an email)
  const photoUserId = userId === "you" ? "me" : userId;
  const isGraphId = photoUserId && !photoUserId.includes("@") && !photoUserId.includes(" ");

  if (isGraphId && !imageError) {
    return (
      <>
        <img
          src={`/api/users/${encodeURIComponent(photoUserId)}/photo`}
          alt={displayName}
          width={size}
          height={size}
          loading="lazy"
          style={{ width: px, height: px, borderRadius: radius }}
          className={`flex-shrink-0 object-cover ${className ?? ""}`}
          onError={() => setImageError(true)}
        />
      </>
    );
  }

  return initialsEl;
}
