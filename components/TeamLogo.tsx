"use client";

import { useState } from "react";

interface TeamLogoProps {
  src: string;
  alt: string;
  size?: number;
}

export default function TeamLogo({ src, alt, size = 48 }: TeamLogoProps) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground"
        style={{ width: size, height: size }}
      >
        {alt.substring(0, 3)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setError(true)}
      className="object-contain"
    />
  );
}
