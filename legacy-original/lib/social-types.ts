export const socialPlatforms = ["X", "YouTube", "Instagram", "Facebook", "LinkedIn", "TikTok", "Threads", "Telegram", "Snapchat"] as const;
export type SocialPlatform = typeof socialPlatforms[number];

export type SocialMetric = { label:string; value:string };
export type SocialTrend = {
  id:string; platform:SocialPlatform; account:string; handle:string; verified:boolean; text:string; topic:string;
  publishedAt:string|null; metrics:SocialMetric[]; url:string; source:string; retrievedAt:string; normalized?:Record<string,unknown>;
};

export type SocialPlatformStatus = {
  platform:SocialPlatform; status:"updated"|"failed"|"unconfigured"|"empty";
  message:string; itemCount:number; startedAt:string|null; finishedAt:string|null;
};
