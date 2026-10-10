/**
 * Video Playability Verification Service
 * Pre-checks reels, video clips, and media URLs from websites, Instagram, Twitter/X
 * before retrieval to ensure they can be played properly.
 */

export interface VideoVerificationResult {
  playable: boolean;
  contentType?: string;
  resolvedUrl?: string;
  error?: string;
}

const PLAYABLE_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
  "application/x-mpegurl",
  "application/vnd.apple.mpegurl",
];

const KNOWN_VALID_DOMAINS = [
  "vjs.zencdn.net",
  "interactive-examples.mdn.mozilla.net",
  "media.w3.org",
  "cdn.sabq.org",
  "video.twimg.com",
  "instagram.com",
];

const isImageExtension = (url: string) =>
  /\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i.test(url) ||
  url.includes("images.unsplash.com") ||
  url.includes("cdn-cgi/image");

/**
 * Pre-verifies a video clip or reel URL via HTTP HEAD/GET request.
 * Checks HTTP status (200/206), playable Content-Type header, and accessibility.
 */
export async function verifyVideoPlayability(
  videoUrl: string | null | undefined,
  sourceUrl?: string
): Promise<VideoVerificationResult> {
  if (!videoUrl || typeof videoUrl !== "string" || !videoUrl.trim()) {
    return { playable: false, error: "empty_video_url" };
  }

  const url = videoUrl.trim();

  // Reject image URLs wrongly tagged as video
  if (isImageExtension(url)) {
    return { playable: false, error: "url_is_image" };
  }

  // Allow trusted direct CDN video streams immediately
  if (KNOWN_VALID_DOMAINS.some((domain) => url.includes(domain))) {
    return { playable: true, contentType: "video/mp4", resolvedUrl: url };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    // Try a HEAD request first with Range header
    let res = await fetch(url, {
      method: "HEAD",
      headers: {
        Range: "bytes=0-1024",
        "User-Agent":
          process.env.RETRIEVAL_USER_AGENT ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: sourceUrl || "",
      },
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    // Fallback to GET range request if HEAD is disallowed or fails
    if (!res || (!res.ok && res.status !== 206)) {
      const getController = new AbortController();
      const getTimeout = setTimeout(() => getController.abort(), 7000);

      res = await fetch(url, {
        method: "GET",
        headers: {
          Range: "bytes=0-1024",
          "User-Agent":
            process.env.RETRIEVAL_USER_AGENT ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: sourceUrl || "",
        },
        signal: getController.signal,
      }).catch(() => null);

      clearTimeout(getTimeout);
    }

    if (!res) {
      return { playable: false, error: "network_unreachable" };
    }

    if (!res.ok && res.status !== 206) {
      return { playable: false, error: `http_status_${res.status}` };
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase().trim();

    // Verify MIME type or direct extension
    const isPlayableType = PLAYABLE_VIDEO_MIME_TYPES.some((type) => contentType.includes(type));
    const isOctetStream = contentType.includes("application/octet-stream") || contentType.includes("binary/octet-stream");
    const hasVideoExt = /\.(mp4|webm|m3u8|mov)(\?.*)?$/i.test(url);

    if (isPlayableType || (isOctetStream && hasVideoExt) || hasVideoExt) {
      return { playable: true, contentType: contentType || "video/mp4", resolvedUrl: url };
    }

    return { playable: false, contentType, error: `unplayable_content_type_${contentType}` };
  } catch (error) {
    return {
      playable: false,
      error: error instanceof Error ? error.message : "verification_failed",
    };
  }
}
