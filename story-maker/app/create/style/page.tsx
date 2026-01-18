'use client';

import { StoryTheme } from "@/app/components/StoryTheme";
import { useRouter } from "next/navigation";
import { useStory } from "@/app/context/StoryContext";
import { useEffect } from "react";

export default function StylePage() {
  const router = useRouter();
  const story = useStory();

  // Track this page as the last visited
  useEffect(() => {
    story.setLastVisitedPage('/create/style');
  }, [story.setLastVisitedPage]);

  return (
    <StoryTheme onNext={() => router.push('/create/category')} />
  );
}
