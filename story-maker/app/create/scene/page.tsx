'use client';

import dynamic from 'next/dynamic';
import { useRouter } from "next/navigation";
import { useStory } from "@/app/context/StoryContext";
import { useEffect } from "react";

// Dynamically import SceneGeneration to reduce initial bundle size
const SceneGeneration = dynamic(() => import("@/app/components/SceneGeneration"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#6D14EC] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading scene editor...</p>
      </div>
    </div>
  ),
});

export default function ScenePage() {
  const router = useRouter();
  const story = useStory();

  // Track this page as the last visited
  useEffect(() => {
    story.setLastVisitedPage('/create/scene');
  }, [story.setLastVisitedPage]);

  return (
    <SceneGeneration
      onBack={() => router.push('/create/character')}
      onNext={() => router.push('/create/final')}
    />
  );
}
