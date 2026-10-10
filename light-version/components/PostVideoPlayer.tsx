"use client";

import { useState } from "react";
import NewsImage from "@/components/NewsImage";

interface PostVideoPlayerProps {
  videoUrl?: string | null;
  posterUrl: string;
  alt?: string;
  category?: string;
  title?: string;
  className?: string;
}

const DEFAULT_VIDEO_FALLBACKS: Record<string, string> = {
  energy: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  tech: "https://vjs.zencdn.net/v/oceans.mp4",
  default: "https://media.w3.org/2010/05/sintel/trailer.mp4",
};

const isImageFile = (url: string) =>
  /\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i.test(url) ||
  url.includes("images.unsplash.com") ||
  url.includes("cdn-cgi/image") ||
  url.includes("media.sabq.org") ||
  url.includes("cdn.ajel.sa");

const isDirectVideo = (url: string) =>
  /\.(mp4|webm|m3u8|ogv|mov)(\?.*)?$/i.test(url) ||
  url.includes("vjs.zencdn.net") ||
  url.includes("interactive-examples.mdn.mozilla.net") ||
  url.includes("w3.org");

function resolveVideoUrl(rawUrl?: string | null): string {
  if (rawUrl && typeof rawUrl === "string" && rawUrl.trim() !== "") {
    const trimmed = rawUrl.trim();
    if (!isImageFile(trimmed)) {
      return trimmed;
    }
  }
  return "";
}

export default function PostVideoPlayer({
  videoUrl,
  posterUrl,
  alt = "",
  category = "عام",
  title = "تشغيل مقطع الفيديو",
  className = "",
}: PostVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasVideoError, setHasVideoError] = useState<boolean>(false);

  const cleanVideoUrl = resolveVideoUrl(videoUrl);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cleanVideoUrl) {
      setIsPlaying(true);
    } else {
      setHasVideoError(true);
    }
  };

  if (isPlaying && cleanVideoUrl && !hasVideoError) {
    return (
      <div
        className={`post-video-container playing ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <video
          src={cleanVideoUrl}
          controls
          autoPlay
          playsInline
          poster={posterUrl}
          className="post-video-element"
          onError={() => {
            setHasVideoError(true);
            setIsPlaying(false);
          }}
        >
          <source src={cleanVideoUrl} type="video/mp4" />
          متصفحك لا يدعم تشغيل الفيديو المباشر.
        </video>
      </div>
    );
  }

  return (
    <div className={`post-video-container ${className}`} onClick={handlePlayClick}>
      <NewsImage
        src={posterUrl}
        alt={alt}
        width={500}
        height={260}
        loading="lazy"
        category={category}
        fallbackSrc="/api/media/fallback/منصات"
        style={{ objectFit: "cover", width: "100%", height: "100%" }}
      />
      <button
        type="button"
        className="post-video-play-btn"
        onClick={handlePlayClick}
        title={title}
        aria-label="تشغيل المقطع"
      >
        <span className="play-icon" aria-hidden="true">
          ▶
        </span>
        <span className="play-label">تشغيل المقطع</span>
      </button>
      <span className="media-type-tag video-tag">▶ فيديو / ريلز</span>
    </div>
  );
}
