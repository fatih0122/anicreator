'use client';

import { StoryNarration } from "@/app/components/StoryNarration";
import { useRouter } from "next/navigation";
import { useStory } from "@/app/context/StoryContext";
import { useEffect } from "react";

export default function CategoryPage() {
  const router = useRouter();
  const story = useStory();

  // Track this page as the last visited and current step
  useEffect(() => {
    story.setLastVisitedPage('/create/category');
    story.setCurrentStep('category');
  }, [story.setLastVisitedPage, story.setCurrentStep]);

  return (
    <StoryNarration
      onBack={() => router.push('/create/style')}
      onNext={() => router.push('/create/character')}
    />
  );
}
