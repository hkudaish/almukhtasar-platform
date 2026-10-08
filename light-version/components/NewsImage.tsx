"use client";

import { useState } from "react";
import Image, { ImageProps } from "next/image";

interface NewsImageProps extends Omit<ImageProps, "src" | "alt" | "onError"> {
  src?: string | null;
  alt?: string;
  category?: string;
  fallbackSrc?: string;
}

export default function NewsImage({
  src,
  alt = "",
  category = "عام",
  fallbackSrc,
  className,
  ...props
}: NewsImageProps) {
  const defaultFallback = fallbackSrc || `/api/media/fallback/${encodeURIComponent(category || "عام")}`;
  const initialSrc = src && src.trim() !== "" ? src : defaultFallback;

  const [imgSrc, setImgSrc] = useState<string>(initialSrc);
  const [hasError, setHasError] = useState<boolean>(false);

  const handleError = () => {
    if (!hasError && imgSrc !== defaultFallback) {
      setHasError(true);
      setImgSrc(defaultFallback);
    }
  };

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      unoptimized={imgSrc.startsWith("http") || imgSrc.endsWith(".svg") || imgSrc.includes("/api/media/")}
      referrerPolicy="no-referrer"
    />
  );
}
