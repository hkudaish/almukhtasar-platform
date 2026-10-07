import HomeClient from "@/components/HomeClient";
import { getHomepageStories } from "@/lib/public-content";

export const dynamic="force-dynamic";

export default function HomePage() {
  const imported=getHomepageStories(20);
  return <HomeClient stories={imported} />;
}
