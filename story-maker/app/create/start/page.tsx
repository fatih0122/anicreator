'use client';

import { CreateStart } from "@/app/components/CreateStart";
import { useRouter } from "next/navigation";
import { useStory } from "@/app/context/StoryContext";
import { useEffect } from "react";

export default function StartPage() {
  const router = useRouter();
  const story = useStory();

  // Reset all story state when user lands on start page (fresh start)
  useEffect(() => {
    story.reset();
  }, []);

  // Track this page as the last visited
  useEffect(() => {
    story.setLastVisitedPage('/create/start');
  }, [story.setLastVisitedPage]);

  return (
    <CreateStart onStart={() => router.push('/create/style')} />
  );
}
