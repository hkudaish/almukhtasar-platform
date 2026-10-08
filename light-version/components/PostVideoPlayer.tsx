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
  energy: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  tech: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  default: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
};

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

  // Determine actual video URL
  const cleanVideoUrl =
    videoUrl &&
    typeof videoUrl === "string" &&
    videoUrl.trim() !== "" &&
    (videoUrl.includes(".mp4") ||
      videoUrl.includes(".webm") ||
      videoUrl.includes("commondatastorage") ||
      videoUrl.startsWith("http"))
      ? videoUrl.trim()
      : category.includes("طاقة") || category.includes("الخضراء") || category.includes("بيئة")
      ? DEFAULT_VIDEO_FALLBACKS.energy
      : category.includes("تقنية") || category.includes("ذكاء")
      ? DEFAULT_VIDEO_FALLBACKS.tech
      : DEFAULT_VIDEO_FALLBACKS.default;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPlaying(true);
  };

  if (isPlaying && !hasVideoError) {
    return (
      <div className={`post-video-container playing ${className}`}>
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
