'use client';

import { CharacterCreation } from "@/app/components/CharacterCreation";
import { useRouter } from "next/navigation";
import { useStory } from "@/app/context/StoryContext";
import { useEffect } from "react";

export default function CharacterPage() {
  const router = useRouter();
  const story = useStory();

  // Track this page as the last visited and current step
  useEffect(() => {
    story.setLastVisitedPage('/create/character');
    story.setCurrentStep('character');
  }, [story.setLastVisitedPage, story.setCurrentStep]);

  return (
    <CharacterCreation
      onBack={() => router.push('/create/category')}
      onNext={() => router.push('/create/scene')}
      onSkipSelection={() => router.push('/create/scene')}
    />
  );
}
