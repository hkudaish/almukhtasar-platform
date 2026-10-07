import type { QueueName } from "@/types/news";
import { PIPELINE_QUEUES } from "@/config/defaults";

export const queueConfiguration:Record<QueueName,{attempts:number;backoffMs:number;concurrency:number}>=Object.fromEntries(
  PIPELINE_QUEUES.map((queue)=>[queue,{attempts:queue==="image-resolution"?2:3,backoffMs:5000,concurrency:queue==="article-hydration"?4:2}])
) as Record<QueueName,{attempts:number;backoffMs:number;concurrency:number}>;
