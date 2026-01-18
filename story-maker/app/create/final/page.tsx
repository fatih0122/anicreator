'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStory } from '@/app/context/StoryContext';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { ArrowLeft, Loader2, CheckCircle2, Download, Share2 } from 'lucide-react';
import UnicornOnly from '@/app/imports/UnicornOnly';
import api from '@/app/services/api';
import dynamic from 'next/dynamic';
import 'plyr-react/plyr.css';
import './plyr-custom.css';

// Dynamically import Plyr to avoid SSR issues
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });

export default function FinalVideoPage() {
  const router = useRouter();
  const story = useStory();
  const [isRendering, setIsRendering] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(story.finalVideoUrl || null);
  const hasGeneratedRef = useRef(false);

  const totalDuration = story.scenes.reduce((sum, scene) => sum + (scene.narration_duration || 5), 0);

  // Track this page as the last visited
  useEffect(() => {
    story.setLastVisitedPage('/create/final');
  }, [story.setLastVisitedPage]);

  // Sync finalVideoUrl with context when it changes (after localStorage hydration)
  useEffect(() => {
    if (story.finalVideoUrl && story.finalVideoUrl !== finalVideoUrl) {
      setFinalVideoUrl(story.finalVideoUrl);
    }
  }, [story.finalVideoUrl]);

  // Auto-generate final video on mount if not already generated
  useEffect(() => {
    // Only generate if we don't have a final video URL yet and we have videos to combine
    if (!finalVideoUrl && !story.finalVideoUrl && story.videos.length > 0 && !hasGeneratedRef.current) {
      hasGeneratedRef.current = true;
      handleGenerateFinalVideo();
    }
  }, [finalVideoUrl, story.finalVideoUrl, story.videos]);

  const handleGenerateFinalVideo = async () => {
    setIsRendering(true);
    try {
      console.log('🎬 Generating final video...');
      console.log('📹 Videos:', story.videos);
      console.log('🎭 Scenes:', story.scenes);

      // Prepare scene data for backend
      const scenes = story.scenes.map((scene, idx) => {
        console.log(`🔍 Final video - Scene ${idx + 1}:`, {
          scene_number: scene.scene_number,
          video_url: story.videos[idx],
          script: scene.script_text
        });
        return {
          video_url: story.videos[idx],
          narration_url: scene.narration_url || '',
          subtitle_text: scene.script_text,
          phonemes: scene.phonemes || null,
          duration: scene.narration_duration || 5,
        };
      });

      // Call backend API to combine all videos with narration and subtitles
      const result = await api.generateFinalVideo(scenes);

      console.log('✅ Final video generated:', result);
      setFinalVideoUrl(result.final_video_url);

      // Save to StoryContext for persistence
      story.setFinalVideoUrl(result.final_video_url);
    } catch (error) {
      console.error('❌ Failed to generate final video:', error);
      alert('최종 비디오 생성에 실패했습니다.');
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="h-[calc(100vh-90px)] bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white">
        <div className="max-w-4xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between mb-3">
            {/* Unicorn + title */}
            <div className="flex items-center gap-2">
              <UnicornOnly size={60} />
              <div>
                <h1 className="text-2xl text-[#6D14EC] font-medium">이야기 만들기</h1>
                <p className="text-gray-500">최종 비디오 생성</p>
              </div>
            </div>
            {/* Right side: button + step */}
            <div className="flex items-center gap-4">
              <Button
                onClick={() => {
                  story.reset();
                  router.push('/create/start');
                }}
                variant="outline"
                className="text-[#6D14EC] border-[#6D14EC] hover:bg-[#6D14EC] hover:text-white rounded-full px-4 py-2"
              >
                처음부터 시작
              </Button>
              <span className="text-gray-500">5 / 5</span>
            </div>
          </div>
          <Progress value={100} className="h-2 [&>div]:bg-[#6D14EC]" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-8 py-6 bg-white">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button onClick={() => router.push('/create/scene')} variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                이전
              </Button>
            </div>

            {/* No manual button - auto-generates on page load */}

            {/* Rendering Status - Purple border while loading */}
            {isRendering && (
              <div className="bg-white rounded-xl p-6 border-2 border-[#6D14EC]">
                <div className="flex items-start gap-3">
                  <Loader2 className="w-5 h-5 text-[#6D14EC] shrink-0 mt-0.5 animate-spin" />
                  <div>
                    <h3 className="text-[#6D14EC] mb-1 font-medium">최종 비디오 생성 중...</h3>
                    <p className="text-sm text-gray-600">
                      모든 장면을 하나의 비디오로 합치고, 나레이션과 자막을 추가하고 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Result */}
            {finalVideoUrl && (
              <>
                {/* Success message with purple border */}
                <div className="bg-white rounded-xl p-6 border-2 border-[#6D14EC] mb-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#6D14EC] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-[#6D14EC] mb-1 font-medium">최종 비디오가 완성되었습니다!</h3>
                      <p className="text-sm text-gray-600">
                        모든 장면이 하나의 비디오로 합쳐졌습니다
                      </p>
                    </div>
                  </div>
                </div>

                {/* Video player - outside the border */}
                <div className="w-full rounded-lg mb-4 overflow-hidden">
                  <Plyr
                    source={{
                      type: 'video',
                      sources: [
                        {
                          src: finalVideoUrl,
                          type: 'video/mp4',
                        },
                      ],
                    }}
                    options={{
                      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
                      ratio: '16:9',
                      color: '#6D14EC',
                    }}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      try {
                        // Use story title as filename, fallback to generic name
                        const filename = story.storyTitle
                          ? `${story.storyTitle}.mp4`
                          : '스토리비_비디오.mp4';

                        // Fetch the video with CORS mode
                        const response = await fetch(finalVideoUrl, {
                          mode: 'cors',
                          credentials: 'omit'
                        });

                        if (!response.ok) {
                          throw new Error('Failed to fetch video');
                        }

                        const blob = await response.blob();

                        // Create a download link
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;

                        document.body.appendChild(a);
                        a.click();

                        // Cleanup
                        setTimeout(() => {
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                        }, 100);
                      } catch (error) {
                        console.error('Download failed, opening in new tab:', error);
                        // Fallback to opening in new tab
                        window.open(finalVideoUrl, '_blank');
                      }
                    }}
                    className="flex-1 bg-[#6D14EC] hover:bg-[#5810BD] flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    다운로드
                  </Button>
                  <Button
                    onClick={() => alert('공유 기능 준비 중입니다')}
                    variant="outline"
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    공유하기
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
