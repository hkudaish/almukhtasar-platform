"use client";

import { useState, useEffect } from "react";
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
  const getFallback = () =>
    fallbackSrc || `/api/media/fallback/${encodeURIComponent(category || "عام")}`;

  const cleanSrc = (url?: string | null) => {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (
      !trimmed ||
      trimmed === "null" ||
      trimmed === "undefined" ||
      trimmed === "none"
    ) {
      return null;
    }
    return trimmed;
  };

  const validInitial = cleanSrc(src) || getFallback();

  const [imgSrc, setImgSrc] = useState<string>(validInitial);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    const nextValid = cleanSrc(src) || getFallback();
    setImgSrc(nextValid);
    setHasError(false);
  }, [src, category, fallbackSrc]);

  const handleError = () => {
    const fallback = getFallback();
    if (imgSrc !== fallback) {
      setHasError(true);
      setImgSrc(fallback);
    } else if (imgSrc !== "/images/placeholder.svg") {
      setImgSrc("/images/placeholder.svg");
    }
  };

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      unoptimized={
        imgSrc.startsWith("http") ||
        imgSrc.endsWith(".svg") ||
        imgSrc.includes("/api/media/") ||
        imgSrc === "/images/placeholder.svg"
      }
      referrerPolicy="no-referrer"
    />
  );
}

