import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, RefreshCw, Sparkles, CheckCircle2, Loader2, Video, ChevronRight, Download, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ImageWithFallback } from './figma/ImageWithFallback';
import UnicornOnly from '../imports/UnicornOnly';
import { useStory } from '../context/StoryContext';
import { api } from '../services/api';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import dynamic from 'next/dynamic';
import 'plyr-react/plyr.css';
import '../create/final/plyr-custom.css';

// Dynamically import Plyr to avoid SSR issues
const Plyr = dynamic(() => import('plyr-react'), { ssr: false });

interface Scene {
  id: string;
  sceneNumber: number;
  sceneType: string;
  text: string;
  imagePrompt: string;
  videoPrompt: string;
  narrationUrl: string | null;
  narrationStatus: 'idle' | 'generating' | 'ready' | 'error';
  narrationDuration: number;
  narrationCurrentTime: number;
  imageUrl: string | null;
  imageStatus: 'idle' | 'generating' | 'ready' | 'error';
  videoUrl: string | null;
  videoStatus: 'idle' | 'generating' | 'ready' | 'error';
  isPlayingNarration: boolean;
  charactersInScene: string[];  // Names of side characters in this scene
}

interface SceneGenerationProps {
  onNext: () => void;
  onBack: () => void;
}

// Helper function to convert English style to Korean label
const getStyleLabel = (stylePrompt: string): string => {
  const styleMap: Record<string, string> = {
    "Studio Ghibli animation style": "지브리",
    "anime art style": "아니메",
    "photorealistic style": "포토리얼리스틱",
    "micro world style": "마이크로 월드",
    "Disney Pixar animation style": "디즈니 애니메이션",
    "3D rendered style": "3D 렌더링",
    "pixel art style": "픽셀 아트",
    "cyberpunk style": "사이버펑크",
  };
  return styleMap[stylePrompt] || stylePrompt;
};

export default function SceneGeneration({ onNext, onBack }: SceneGenerationProps) {
  const router = useRouter();
  const story = useStory();

  const handleStartOver = () => {
    story.reset();
    router.push('/create/start');
  };

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [completedImagesCount, setCompletedImagesCount] = useState(0);
  const [completedNarrationsCount, setCompletedNarrationsCount] = useState(0);
  const [isGeneratingScript, setIsGeneratingScript] = useState(true);
  const [scriptGenerated, setScriptGenerated] = useState(false);
  const [isGeneratingNarrations, setIsGeneratingNarrations] = useState(false);
  const [narrationsGenerated, setNarrationsGenerated] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const hasGeneratedRef = useRef(false);
  const narrationsGeneratedRef = useRef(false);
  const imagesGeneratedRef = useRef(false);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const sideCharacterImagesRef = useRef<Array<{name: string; type: string; image_url: string}>>([]);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState<string>('');
  const [voiceName, setVoiceName] = useState<string>('라이언');

  // Progress tracking for background jobs
  const [imageGenerationProgress, setImageGenerationProgress] = useState<{current: number; total: number; status: string} | null>(null);
  const [videoGenerationProgress, setVideoGenerationProgress] = useState<{current: number; total: number; status: string} | null>(null);
  const [sideCharacterProgress, setSideCharacterProgress] = useState<{current: number; total: number; status: string} | null>(null);
  const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);
  const [isGeneratingVideoPrompts, setIsGeneratingVideoPrompts] = useState(false);
  const [areVideoPromptsReady, setAreVideoPromptsReady] = useState(false);

  // Fetch voice name on mount
  useEffect(() => {
    const fetchVoiceName = async () => {
      if (story.narrationVoice) {
        try {
          const response = await api.getVoices();
          const voice = response.voices.find(v => v.voice_id === story.narrationVoice);
          if (voice) {
            setVoiceName(voice.display_name);
          }
        } catch (error) {
          console.error('Failed to fetch voice name:', error);
        }
      }
    };
    fetchVoiceName();
  }, [story.narrationVoice]);

  // Check for input changes and invalidate cached content if needed
  useEffect(() => {
    // Generate a signature from the current character inputs
    const currentSignature = JSON.stringify({
      characterName: story.characterName,
      characterType: story.characterType,
      personality: story.personality,
      characterDescription: story.characterDescription,
      characterPrompt: story.characterPrompt,
      characterImageUrl: story.characterImageUrl,
      selectedStyle: story.selectedStyle,
      selectedThemes: story.selectedThemes,
      customTheme: story.customTheme,
      sceneCount: story.sceneCount,
    });

    // If signature exists and is different from current inputs, clear generated content
    if (story.storySignature && story.storySignature !== currentSignature) {
      console.log('🔄 Character inputs changed, clearing generated content');
      story.clearGeneratedContent();
      // Reset local state as well
      setScenes([]);
      setScriptGenerated(false);
      setIsGeneratingScript(true);
      setCompletedImagesCount(0);
      setIsGeneratingImages(false);
      hasGeneratedRef.current = false;
      imagesGeneratedRef.current = false;
      // Update the signature after clearing
      story.setStorySignature(currentSignature);
    } else if (!story.storySignature) {
      // First time - just set the signature without clearing
      story.setStorySignature(currentSignature);
    }
    // If signatures match, do nothing (don't update unnecessarily)
  }, [
    story.characterName,
    story.characterType,
    story.personality,
    story.characterDescription,
    story.characterPrompt,
    story.characterImageUrl,
    story.selectedStyle,
    story.selectedThemes,
    story.customTheme,
    story.sceneCount,
  ]);

  // Step 1: Generate story script on mount (only if not already loaded from localStorage)
  useEffect(() => {
    // Check if we already have scenes from localStorage
    if (story.scenes && story.scenes.length > 0 && !hasGeneratedRef.current) {
      console.log('✅ Scenes already exist in localStorage, loading them');
      console.log('📊 StoryContext state on mount:');
      console.log('  - story.videos.length:', story.videos.length);
      console.log('  - story.videos:', JSON.stringify(story.videos));
      console.log('  - story.sceneImages.length:', story.sceneImages.length);
      console.log('  - story.scenes.length:', story.scenes.length);

      // Map existing scenes to the local Scene type with status
      const mappedScenes = story.scenes.map((scene, idx) => {
        console.log(`  Scene ${idx + 1}: videoUrl=${story.videos[idx] || 'null'}, imageUrl=${story.sceneImages[idx] || 'null'}`);
        return {
          id: String(idx + 1),
          sceneNumber: scene.scene_number,
          sceneType: scene.scene_type,
          text: scene.script_text,
          imagePrompt: story.imagePrompts[idx]?.prompt || '',
          videoPrompt: story.videoPrompts[idx]?.prompt || '',
          narrationUrl: scene.narration_url || null,
          narrationStatus: scene.narration_url ? 'ready' as const : 'idle' as const,
          narrationDuration: scene.narration_duration || 0,
          narrationCurrentTime: 0,
          imageUrl: story.sceneImages[idx] || null,
          imageStatus: story.sceneImages[idx] ? 'ready' as const : 'idle' as const,
          videoUrl: story.videos[idx] || null,
          videoStatus: story.videos[idx] ? 'ready' as const : 'idle' as const,
          isPlayingNarration: false,
          charactersInScene: story.imagePrompts[idx]?.characters_in_scene || [],
        };
      });

      // Restore side character images to ref from localStorage
      if (story.sideCharacterImages && story.sideCharacterImages.length > 0) {
        sideCharacterImagesRef.current = story.sideCharacterImages;
        console.log('✅ Restored side character images from localStorage:', story.sideCharacterImages);
      }

      setScenes(mappedScenes);
      setScriptGenerated(true);
      setIsGeneratingScript(false);
      hasGeneratedRef.current = true;

      // Ensure videos and sceneImages arrays have correct length
      if (story.videos.length !== story.scenes.length) {
        console.log(`⚠️ Videos array length mismatch! Fixing: ${story.videos.length} → ${story.scenes.length}`);
        const fixedVideos = Array(story.scenes.length).fill('').map((_, idx) => story.videos[idx] || '');
        story.setVideos(fixedVideos);
      }
      if (story.sceneImages.length !== story.scenes.length) {
        console.log(`⚠️ SceneImages array length mismatch! Fixing: ${story.sceneImages.length} → ${story.scenes.length}`);
        const fixedImages = Array(story.scenes.length).fill('').map((_, idx) => story.sceneImages[idx] || '');
        story.setSceneImages(fixedImages);
      }

      // If narrations exist, mark them as generated
      if (story.scenes.some(scene => scene.narration_url)) {
        narrationsGeneratedRef.current = true;
        setNarrationsGenerated(true);
        setCompletedNarrationsCount(story.scenes.filter(scene => scene.narration_url).length);
        console.log('✅ Narrations already exist in localStorage, skipping generation');
      }

      // If images exist, mark them as generated
      if (story.sceneImages.some(img => img)) {
        imagesGeneratedRef.current = true;
      }

      // If video prompts exist, mark them as ready
      if (story.videoPrompts && story.videoPrompts.length > 0 && story.videoPrompts.every(vp => vp?.prompt)) {
        setAreVideoPromptsReady(true);
        console.log('✅ Video prompts already exist in localStorage, marking as ready');
      }

      return;
    }

    // Generate if we don't have scenes and haven't generated yet
    if (!hasGeneratedRef.current && story.characterPrompt) {
      hasGeneratedRef.current = true;
      generateScript();
    }
  }, [story.scenes.length]); // Re-run when scenes are cleared

  const generateScript = async () => {
    try {
      setIsGeneratingScript(true);

      // STEP 1: Generate story script with AGENT 1 & 2
      const response = await api.generateStoryScript(
        story.characterName,
        story.characterType,
        story.characterPrompt,
        story.personality,
        story.selectedThemes,
        story.customTheme,
        story.sceneCount,
        story.selectedStyle
      );

      console.log('✅ Story script generated:', response);
      console.log('📘 Blueprint:', response.blueprint);

      story.setStoryTitle(response.story_title);
      story.setScenes(response.scenes);

      // Initialize videos and sceneImages arrays with correct length if needed
      // IMPORTANT: Preserve existing values, only extend/shrink array
      if (story.videos.length !== response.scenes.length) {
        console.log(`📐 Adjusting videos array: ${story.videos.length} → ${response.scenes.length}`);
        const adjustedVideos = Array(response.scenes.length).fill('').map((_, idx) => story.videos[idx] || '');
        console.log(`   Preserved videos:`, adjustedVideos.filter(v => v).length);
        story.setVideos(adjustedVideos);
      }
      if (story.sceneImages.length !== response.scenes.length) {
        console.log(`📐 Adjusting sceneImages array: ${story.sceneImages.length} → ${response.scenes.length}`);
        const adjustedImages = Array(response.scenes.length).fill('').map((_, idx) => story.sceneImages[idx] || '');
        console.log(`   Preserved images:`, adjustedImages.filter(img => img).length);
        story.setSceneImages(adjustedImages);
      }

      // STEP 2: Show scenes immediately with script text
      const initialScenes: Scene[] = response.scenes.map((scene, idx) => ({
        id: String(idx + 1),
        sceneNumber: scene.scene_number,
        sceneType: scene.scene_type,
        text: scene.script_text,
        imagePrompt: '', // Will be filled when prompts are ready
        videoPrompt: '', // Will be filled when prompts are ready
        narrationUrl: scene.narration_url || null,
        narrationStatus: scene.narration_url ? 'ready' as const : 'idle' as const,
        narrationDuration: scene.narration_duration || 0,
        narrationCurrentTime: 0,
        imageUrl: null,
        imageStatus: 'idle' as const,
        videoUrl: null,
        videoStatus: 'idle' as const,
        isPlayingNarration: false,
        charactersInScene: [], // Will be filled when image prompts are ready
      }));

      setScenes(initialScenes);
      setIsGeneratingScript(false);
      setScriptGenerated(true);

      // STEP 3: Start narrations immediately (in parallel)
      setTimeout(() => {
        setScriptGenerated(false);
        generateAllNarrations(response.scenes);
      }, 2000);

      // STEP 4: Generate prompts in background (don't block UI)
      const simplifiedBlueprint = {
        scene_blueprints: response.blueprint.scene_blueprints,
        side_characters: response.blueprint.side_characters || []
      };

      // Start all background tasks in parallel
      (async () => {
        try {
          // STEP 1: Start side character images and image prompts in parallel
          const [sideCharResult, imagePromptsResponse] = await Promise.all([
            // Generate side character images
            (async () => {
              const sideCharacters = simplifiedBlueprint.side_characters || [];
              if (sideCharacters.length > 0) {
                console.log(`🎭 Generating images for ${sideCharacters.length} side characters...`);
                try {
                  const sideCharResponse = await api.generateSideCharacterImages(
                    sideCharacters,
                    story.selectedStyle,
                    story.characterImageUrl,
                    story.characterPrompt,
                    (progress) => {
                      setSideCharacterProgress(progress);
                      console.log(`🎭 Side character generation progress: ${progress.status} (${progress.current}/${progress.total})`);
                    }
                  );
                  setSideCharacterProgress(null);
                  story.setSideCharacterImages(sideCharResponse.character_images);
                  sideCharacterImagesRef.current = sideCharResponse.character_images;
                  console.log('✅ Side character images generated:', sideCharResponse.character_images);
                  return sideCharResponse;
                } catch (error) {
                  console.error('❌ Failed to generate side character images:', error);
                  return null;
                }
              }
              return null;
            })(),

            // Generate image prompts (AGENT 3)
            (async () => {
              try {
                const imgPromptsResponse = await api.generateImagePrompts(
                  response.scenes,
                  story.characterName,
                  story.characterType,
                  story.characterPrompt,
                  story.selectedStyle,
                  simplifiedBlueprint,
                  (progress) => {
                    console.log('📸 Image prompt generation progress:', progress);
                  }
                );
                console.log('✅ Image prompts generated:', imgPromptsResponse);
                story.setImagePrompts(imgPromptsResponse.prompts);

                // Store visual blueprint for asset tracking
                if (imgPromptsResponse.visual_blueprint) {
                  console.log('🏗️ Visual blueprint received:', imgPromptsResponse.visual_blueprint);
                  story.setVisualBlueprint(imgPromptsResponse.visual_blueprint);
                }

                // Update scenes with image prompts (but don't generate images yet)
                setScenes(prev => prev.map((scene, idx) => ({
                  ...scene,
                  imagePrompt: imgPromptsResponse.prompts[idx]?.prompt || '',
                  charactersInScene: imgPromptsResponse.prompts[idx]?.characters_in_scene || []
                })));

                return imgPromptsResponse;
              } catch (error) {
                console.error('❌ Failed to generate image prompts:', error);
                return null;
              }
            })()
          ]);

          // STEP 2: Now that we have BOTH image prompts AND side character images, generate scene images
          if (imagePromptsResponse) {
            console.log('🎬 Both image prompts and side characters ready, starting scene image generation...');

            // Wait a bit for state to update, then start image generation
            setTimeout(() => {
              setScenes(currentScenes => {
                console.log('🚀 Starting image generation with scenes:', currentScenes.map(s => ({
                  sceneNumber: s.sceneNumber,
                  hasPrompt: !!s.imagePrompt,
                  promptLength: s.imagePrompt?.length,
                  sideChars: s.charactersInScene
                })));
                generateAllImages(currentScenes);
                return currentScenes;
              });
            }, 300);

            // STEP 3: Generate video prompts in parallel (doesn't block scene images)
            try {
              setIsGeneratingVideoPrompts(true);
              console.log('🎥 Starting video prompt generation...');

              const videoPromptsResponse = await api.generateVideoPrompts(
                response.scenes,
                story.characterPrompt,
                story.selectedStyle,
                simplifiedBlueprint,
                imagePromptsResponse.prompts,
                (progress) => {
                  console.log('🎥 Video prompt generation progress:', progress);
                }
              );
              console.log('✅ Video prompts generated:', videoPromptsResponse);
              story.setVideoPrompts(videoPromptsResponse.prompts);

              // Update scenes with video prompts (but don't generate videos yet)
              setScenes(prev => prev.map((scene, idx) => ({
                ...scene,
                videoPrompt: videoPromptsResponse.prompts[idx]?.prompt || ''
              })));

              setAreVideoPromptsReady(true);
              setIsGeneratingVideoPrompts(false);
            } catch (error) {
              console.error('❌ Failed to generate video prompts:', error);
              setIsGeneratingVideoPrompts(false);
            }
          }
        } catch (error) {
          console.error('❌ Error in background tasks:', error);
        }
      })();
    } catch (error) {
      console.error('❌ Failed to generate script:', error);
      setIsGeneratingScript(false);
      alert('스크립트 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const generateAllNarrations = async (scenesData: typeof story.scenes) => {
    // Prevent double generation
    if (narrationsGeneratedRef.current) {
      console.log('⏭️ Narrations already being generated, skipping...');
      return;
    }

    narrationsGeneratedRef.current = true;
    setIsGeneratingNarrations(true);
    setCompletedNarrationsCount(0);

    setScenes(prev => prev.map(scene => ({
      ...scene,
      narrationStatus: 'generating' as const
    })));

    try {
      console.log('🎙️ Generating narrations in batch with voice:', story.narrationVoice);

      const response = await api.generateBatchNarrations(
        scenesData,
        'ko',
        story.narrationVoice || undefined,
        undefined, // style
        true, // includePhonemes - request phoneme timing data for subtitles
        (progress) => {
          console.log(`🎙️ Narration generation progress: ${progress.status} (${progress.current}/${progress.total})`);
          setCompletedNarrationsCount(progress.current);
        }
      );

      console.log('✅ All narrations generated:', response);

      // Update scenes with narration URLs
      setScenes(prev => prev.map((scene, idx) => ({
        ...scene,
        narrationUrl: response.narrations[idx].audio_url || null,
        narrationStatus: response.narrations[idx].audio_url ? 'ready' as const : 'error' as const
      })));

      // Save narration URLs and phonemes to StoryContext for persistence
      const updatedScenesWithNarrations = scenesData.map((scene, idx) => ({
        ...scene,
        narration_url: response.narrations[idx].audio_url || null,
        narration_duration: response.narrations[idx].duration_seconds,
        phonemes: response.narrations[idx].phonemes || null
      }));
      story.setScenes(updatedScenesWithNarrations);
      console.log('💾 Saved narration URLs and phonemes to StoryContext/localStorage');

      setCompletedNarrationsCount(response.narrations.filter(n => n.audio_url).length);
      setIsGeneratingNarrations(false);
      setNarrationsGenerated(true);

      // Just clear the "narrations generated" message after a delay
      // Images will auto-generate when image prompts are ready (from AGENT 3)
      setTimeout(() => {
        setNarrationsGenerated(false);
      }, 1500);

    } catch (error) {
      console.error('❌ Failed to generate narrations:', error);
      setIsGeneratingNarrations(false);
      alert('내레이션 생성에 실패했습니다. 계속 진행하시겠습니까?');

      // Mark all as error but don't trigger image generation
      // Images will be generated when prompts are ready
      setScenes(prev => prev.map(scene => ({
        ...scene,
        narrationStatus: 'error' as const
      })));
    }
  };

  const generateAllImages = async (scenesToGenerate: Scene[]) => {
    // Prevent double generation
    if (imagesGeneratedRef.current) {
      console.log('⏭️ Images already being generated, skipping...');
      return;
    }

    imagesGeneratedRef.current = true;
    setIsGeneratingImages(true);
    setCompletedImagesCount(0);

    setScenes(prev => prev.map(scene => ({
      ...scene,
      imageStatus: 'generating' as const
    })));

    try {
      const imagePrompts = scenesToGenerate.map(scene => ({
        scene_number: scene.sceneNumber,
        scene_type: scene.sceneType,
        prompt: scene.imagePrompt,
        characters_in_scene: scene.charactersInScene
      }));

      console.log('📸 Generating images with:', {
        imagePrompts,
        characterImageUrl: story.characterImageUrl,
        style: story.selectedStyle,
        sideCharacterImages: sideCharacterImagesRef.current,
        sideCharacterImagesCount: sideCharacterImagesRef.current.length
      });

      // Log which scenes have side characters
      imagePrompts.forEach(prompt => {
        if (prompt.characters_in_scene && prompt.characters_in_scene.length > 0) {
          console.log(`🎭 Frontend: Scene ${prompt.scene_number} has side characters:`, prompt.characters_in_scene);
        }
      });

      const response = await api.generateSceneImages(
        imagePrompts,
        story.characterImageUrl,
        story.selectedStyle,
        sideCharacterImagesRef.current,
        (progress) => {
          setImageGenerationProgress(progress);
          console.log(`📸 Image generation progress: ${progress.status} (${progress.current}/${progress.total})`);

          // Handle partial results - show images as they complete!
          if (progress.partialResults && progress.partialResults.scene_images) {
            const partialImages = progress.partialResults.scene_images;
            console.log(`🖼️ Got partial image results:`, partialImages);

            setScenes(prev => prev.map((scene, idx) => {
              if (partialImages[idx]) {
                // This scene's image is ready! Show it immediately
                return {
                  ...scene,
                  imageUrl: partialImages[idx],
                  imageStatus: 'ready' as const
                };
              }
              return scene;
            }));

            // Also update context for persistence
            const updatedImages = [...story.sceneImages];
            partialImages.forEach((imageUrl, idx) => {
              if (imageUrl) {
                updatedImages[idx] = imageUrl;
              }
            });
            story.setSceneImages(updatedImages);
          }
        }
      );

      console.log('✅ All images generated:', response);
      setImageGenerationProgress(null); // Clear progress when done

      setScenes(prev => prev.map((scene, idx) => ({
        ...scene,
        imageUrl: response.scene_images[idx],
        imageStatus: 'ready' as const
      })));

      // Save images to context for persistence
      story.setSceneImages(response.scene_images);

      setCompletedImagesCount(scenesToGenerate.length);
      setIsGeneratingImages(false);
    } catch (error) {
      console.error('❌ Failed to generate images:', error);
      setIsGeneratingImages(false);
      setScenes(prev => prev.map(scene => ({
        ...scene,
        imageStatus: 'error' as const
      })));
      alert('이미지 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const generateSingleImage = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setScenes(prev => prev.map(s =>
      s.id === sceneId
        ? { ...s, imageStatus: 'generating' as const }
        : s
    ));

    try {
      console.log(`🖼️ Generating image for scene ${scene.sceneNumber} (individual)`);
      const response = await api.generateSingleSceneImage(
        scene.sceneNumber,
        scene.sceneType,
        scene.imagePrompt,
        story.characterImageUrl,
        scene.charactersInScene,
        story.sideCharacterImages
      );

      console.log(`✅ Image generated for scene ${scene.sceneNumber}:`, response.image_url);

      setScenes(prev => prev.map(s =>
        s.id === sceneId
          ? {
              ...s,
              imageUrl: response.image_url,
              imageStatus: 'ready' as const,
              // Clear video since image changed - video no longer matches
              videoUrl: null,
              videoStatus: 'idle' as const
            }
          : s
      ));

      // Save image to context for persistence
      const sceneIndex = scenes.findIndex(s => s.id === sceneId);
      console.log(`💾 Saving image for scene ${scene.sceneNumber} - sceneIndex: ${sceneIndex}`);
      console.log(`🗑️ Clearing video for this scene (image changed)`);

      if (sceneIndex !== -1) {
        // Use functional updates to avoid race conditions
        story.setSceneImages(prevImages => {
          const updated = [...prevImages];
          updated[sceneIndex] = response.image_url;
          console.log(`🔍 Functional update (images):`, updated.map((v, i) => v ? `[${i}]:✓` : `[${i}]:✗`).join(' '));
          return updated;
        });

        // Clear the video for this scene since image changed
        story.setVideos(prevVideos => {
          const updated = [...prevVideos];
          updated[sceneIndex] = '';
          console.log(`🔍 Functional update (cleared video):`, updated.map((v, i) => v ? `[${i}]:✓` : `[${i}]:✗`).join(' '));
          return updated;
        });

        console.log('💾 Called story.setSceneImages() and cleared video with functional updates');
      }
    } catch (error) {
      console.error('❌ Failed to generate image:', error);
      setScenes(prev => prev.map(s =>
        s.id === sceneId
          ? { ...s, imageStatus: 'error' as const }
          : s
      ));
      alert('이미지 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const retryImage = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setScenes(prev => prev.map(s =>
      s.id === sceneId
        ? { ...s, imageStatus: 'generating' as const, imageUrl: null }
        : s
    ));

    try {
      console.log(`🔄 Regenerating image for scene ${scene.sceneNumber}`);
      const response = await api.generateSingleSceneImage(
        scene.sceneNumber,
        scene.sceneType,
        scene.imagePrompt,
        story.characterImageUrl,
        scene.charactersInScene,
        story.sideCharacterImages
      );

      setScenes(prev => prev.map(s =>
        s.id === sceneId
          ? {
              ...s,
              imageUrl: response.image_url,
              imageStatus: 'ready' as const,
              // Clear video since image changed - video no longer matches
              videoUrl: null,
              videoStatus: 'idle' as const
            }
          : s
      ));

      // Save updated image to context for persistence
      const sceneIndex = scenes.findIndex(s => s.id === sceneId);
      console.log(`✅ Regenerated image for scene ${scene.sceneNumber} - sceneIndex: ${sceneIndex}`);
      console.log(`🗑️ Clearing video for this scene (image regenerated)`);
      if (sceneIndex !== -1) {
        // Use functional updates to avoid race conditions
        story.setSceneImages(prevImages => {
          const updated = [...prevImages];
          updated[sceneIndex] = response.image_url;
          console.log(`🔍 Functional update (images):`, updated.map((v, i) => v ? `[${i}]:✓` : `[${i}]:✗`).join(' '));
          return updated;
        });

        // Clear the video for this scene since image changed
        story.setVideos(prevVideos => {
          const updated = [...prevVideos];
          updated[sceneIndex] = '';
          console.log(`🔍 Functional update (cleared video):`, updated.map((v, i) => v ? `[${i}]:✓` : `[${i}]:✗`).join(' '));
          return updated;
        });

        console.log('💾 Saved regenerated image and cleared video with functional updates');
      }
    } catch (error) {
      console.error('❌ Failed to regenerate image:', error);
      setScenes(prev => prev.map(s =>
        s.id === sceneId
          ? { ...s, imageStatus: 'error' as const }
          : s
      ));
    }
  };

  const animateScene = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || !scene.imageUrl) return;

    // Validate video prompt exists
    if (!scene.videoPrompt) {
      console.error('❌ Cannot generate video: Video prompt not ready for scene', scene.sceneNumber);
      alert('비디오 프롬프트가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setScenes(prev => prev.map(s =>
      s.id === sceneId
        ? { ...s, videoStatus: 'generating' as const }
        : s
    ));

    try {
      console.log(`🎬 Generating video for scene ${scene.sceneNumber} (individual)`);
      console.log(`🔍 Video prompt ready: "${scene.videoPrompt.substring(0, 50)}..."`);
      const response = await api.generateSingleVideo(
        scene.imageUrl,
        scene.videoPrompt,
        scene.sceneNumber
      );

      console.log(`✅ Video generated for scene ${scene.sceneNumber}:`, response.video_url);

      setScenes(prev => prev.map(s =>
        s.id === sceneId
          ? { ...s, videoUrl: response.video_url, videoStatus: 'ready' as const }
          : s
      ));

      // Save video to context for persistence
      const sceneIndex = scenes.findIndex(s => s.id === sceneId);
      console.log(`💾 Saving video for scene ${scene.sceneNumber} - sceneIndex: ${sceneIndex}`);
      console.log(`🔍 Video URL: ${response.video_url}`);

      if (sceneIndex !== -1) {
        console.log(`🔍 Updating video at index ${sceneIndex} with URL: ${response.video_url.substring(0, 50)}...`);

        // Use functional update to avoid race conditions when multiple videos generate simultaneously
        story.setVideos(prevVideos => {
          const updated = [...prevVideos];
          updated[sceneIndex] = response.video_url;
          console.log(`🔍 Functional update:`, updated.map((v, i) => v ? `[${i}]:✓` : `[${i}]:✗`).join(' '));
          return updated;
        });

        console.log('💾 Called story.setVideos() with functional update - avoids race conditions');

        // Verify the context was updated
        setTimeout(() => {
          console.log('🔍 After 100ms, story.videos[' + sceneIndex + ']:', story.videos[sceneIndex] ? '✓ SAVED' : '✗ LOST');
        }, 100);

        // Clear final video since we have a new scene video - needs regeneration
        story.setFinalVideoUrl('');
        console.log('🔄 Cleared final video - needs regeneration with new scene video');
      }
    } catch (error) {
      console.error('❌ Failed to generate video:', error);
      setScenes(prev => prev.map(s =>
        s.id === sceneId
          ? { ...s, videoStatus: 'error' as const }
          : s
      ));
      alert('영상 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const generateAllVideos = async () => {
    const scenesWithImages = scenes.filter(s => s.imageUrl && s.videoStatus === 'idle');
    if (scenesWithImages.length === 0) return;

    // Validate that all scenes have video prompts
    const scenesWithoutPrompts = scenesWithImages.filter(s => !s.videoPrompt);
    if (scenesWithoutPrompts.length > 0) {
      console.error('❌ Cannot generate videos: Some scenes are missing video prompts', scenesWithoutPrompts);
      alert('비디오 프롬프트가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    console.log('🎬 Generating videos for scenes:', scenesWithImages.map(s => ({
      sceneNumber: s.sceneNumber,
      hasPrompt: !!s.videoPrompt,
      promptPreview: s.videoPrompt?.substring(0, 50)
    })));

    setIsGeneratingVideos(true);
    setScenes(prev => prev.map(scene =>
      scene.imageUrl && scene.videoStatus === 'idle'
        ? { ...scene, videoStatus: 'generating' as const }
        : scene
    ));

    try {
      const imageUrls = scenesWithImages.map(s => s.imageUrl!);
      const videoPrompts = scenesWithImages.map(s => ({
        scene_number: s.sceneNumber,
        prompt: s.videoPrompt
      }));

      const response = await api.generateVideos(
        imageUrls,
        videoPrompts,
        (progress) => {
          setVideoGenerationProgress(progress);
          console.log(`🎥 Batch video generation progress: ${progress.status} (${progress.current}/${progress.total})`);

          // Handle partial results - show videos as they complete!
          if (progress.partialResults && progress.partialResults.videos) {
            const partialVideos = progress.partialResults.videos;
            console.log(`📹 Got partial video results:`, partialVideos);

            setScenes(prev => prev.map((scene) => {
              const sceneWithImageIndex = scenesWithImages.findIndex(s => s.id === scene.id);
              if (sceneWithImageIndex !== -1 && partialVideos[sceneWithImageIndex]) {
                // Only update if this is a NEW video URL (prevents re-renders while playing)
                if (scene.videoUrl !== partialVideos[sceneWithImageIndex]) {
                  console.log(`🆕 New video URL for scene ${scene.sceneNumber}`);
                  return {
                    ...scene,
                    videoUrl: partialVideos[sceneWithImageIndex],
                    videoStatus: 'ready' as const
                  };
                }
              }
              return scene;
            }));

            // Also update context for persistence (only if there are changes)
            setScenes(currentScenes => {
              const updatedVideos = currentScenes.map((scene) => {
                const sceneWithImageIndex = scenesWithImages.findIndex(s => s.id === scene.id);
                if (sceneWithImageIndex !== -1 && partialVideos[sceneWithImageIndex]) {
                  return partialVideos[sceneWithImageIndex];
                }
                return story.videos[currentScenes.indexOf(scene)] || '';
              });

              // Only update context if videos actually changed
              const hasChanges = updatedVideos.some((url, idx) => url !== story.videos[idx]);
              if (hasChanges) {
                story.setVideos(updatedVideos);
              }

              return currentScenes;
            });
          }
        }
      );

      console.log('✅ All videos generated:', response);
      setVideoGenerationProgress(null); // Clear progress when done
      setIsGeneratingVideos(false);

      setScenes(prev => prev.map((scene) => {
        const sceneIndex = scenesWithImages.findIndex(s => s.id === scene.id);
        if (sceneIndex !== -1) {
          return {
            ...scene,
            videoUrl: response.videos[sceneIndex],
            videoStatus: 'ready' as const
          };
        }
        return scene;
      }));

      // Save all videos to context for persistence
      const updatedVideos = scenes.map((scene, idx) => {
        const generatedIndex = scenesWithImages.findIndex(s => s.id === scene.id);
        if (generatedIndex !== -1) {
          return response.videos[generatedIndex];
        }
        return story.videos[idx] || '';
      });
      story.setVideos(updatedVideos);

      // Clear final video since we have new scene videos - needs regeneration
      story.setFinalVideoUrl('');
    } catch (error) {
      console.error('❌ Failed to generate videos:', error);
      setVideoGenerationProgress(null);
      setIsGeneratingVideos(false);
      setScenes(prev => prev.map(scene =>
        scene.videoStatus === 'generating'
          ? { ...scene, videoStatus: 'error' as const }
          : scene
      ));
      alert('영상 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const retryAnimation = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || !scene.imageUrl) return;

    setScenes(prev => prev.map(s =>
      s.id === sceneId
        ? { ...s, videoStatus: 'generating' as const, videoUrl: null }
        : s
    ));

    try {
      console.log(`🔄 Regenerating video for scene ${scene.sceneNumber}`);
      const response = await api.generateSingleVideo(
        scene.imageUrl,
        scene.videoPrompt,
        scene.sceneNumber
      );

      setScenes(prev => prev.map(s =>
        s.id === sceneId
          ? { ...s, videoUrl: response.video_url, videoStatus: 'ready' as const }
          : s
      ));

      // Save updated video to context for persistence
      const sceneIndex = scenes.findIndex(s => s.id === sceneId);
      console.log(`✅ Regenerated video for scene ${scene.sceneNumber} - sceneIndex: ${sceneIndex}`);
      console.log(`🔍 New video URL: ${response.video_url}`);

      if (sceneIndex !== -1) {
        // Use functional update to avoid race conditions
        story.setVideos(prevVideos => {
          const updated = [...prevVideos];
          updated[sceneIndex] = response.video_url;
          console.log(`🔍 Functional update (retry):`, updated.map((v, i) => v ? `[${i}]:✓` : `[${i}]:✗`).join(' '));
          return updated;
        });

        console.log('💾 Called story.setVideos() with functional update');

        // Verify the context was updated
        setTimeout(() => {
          console.log('🔍 After 100ms, story.videos[' + sceneIndex + ']:', story.videos[sceneIndex] ? '✓ SAVED' : '✗ LOST');
        }, 100);

        // Clear final video since we have a new scene video - needs regeneration
        story.setFinalVideoUrl('');
        console.log('🔄 Cleared final video - needs regeneration with new scene video');
      }
    } catch (error) {
      console.error('❌ Failed to regenerate video:', error);
      setScenes(prev => prev.map(s =>
        s.id === sceneId
          ? { ...s, videoStatus: 'error' as const }
          : s
      ));
    }
  };

  const generateSingleNarration = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setScenes(prev => prev.map(s =>
      s.id === sceneId ? { ...s, narrationStatus: 'generating' as const } : s
    ));

    try {
      console.log(`🎙️ Generating narration for scene ${scene.sceneNumber} (individual)`);
      const response = await api.generateSingleNarration(
        scene.text,
        scene.sceneNumber,
        'ko',
        story.narrationVoice || undefined,
        undefined,
        true // includePhonemes
      );

      console.log(`✅ Narration generated for scene ${scene.sceneNumber}:`, response.audio_url);

      setScenes(prev => prev.map(s =>
        s.id === sceneId ? {
          ...s,
          narrationUrl: response.audio_url,
          narrationStatus: 'ready' as const,
          narrationDuration: response.duration_seconds || 0
        } : s
      ));

      // Save to context
      const sceneIndex = scenes.findIndex(s => s.id === sceneId);
      console.log(`💾 Saving narration for scene ${scene.sceneNumber} - sceneIndex: ${sceneIndex}`);
      console.log(`🔍 Narration URL: ${response.audio_url}`);

      if (sceneIndex !== -1) {
        const updatedScenes = [...story.scenes];
        updatedScenes[sceneIndex] = {
          ...updatedScenes[sceneIndex],
          narration_url: response.audio_url,
          narration_duration: response.duration_seconds,
          phonemes: response.phonemes || null
        };
        console.log(`🔍 Before update, scenes[${sceneIndex}].narration_url:`, story.scenes[sceneIndex]?.narration_url);
        story.setScenes(updatedScenes);
        console.log('💾 Called story.setScenes() - should trigger localStorage save');

        // Verify the context was updated
        setTimeout(() => {
          console.log('🔍 After React state update, story.scenes[' + sceneIndex + '].narration_url:', story.scenes[sceneIndex]?.narration_url);
        }, 100);

        // Clear final video since we have new narration - needs regeneration
        story.setFinalVideoUrl('');
        console.log('🔄 Cleared final video - needs regeneration with new narration');
      }
    } catch (error) {
      console.error('❌ Failed to generate narration:', error);
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, narrationStatus: 'error' as const } : s
      ));
      alert('나레이션 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const retryNarration = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setScenes(prev => prev.map(s =>
      s.id === sceneId ? { ...s, narrationStatus: 'generating' as const, narrationUrl: null } : s
    ));

    try {
      console.log(`🔄 Retrying narration for scene ${scene.sceneNumber}`);
      const response = await api.generateSingleNarration(
        scene.text,
        scene.sceneNumber,
        'ko',
        story.narrationVoice || undefined,
        undefined,
        true // includePhonemes
      );

      console.log(`✅ Narration regenerated for scene ${scene.sceneNumber}`);

      setScenes(prev => prev.map(s =>
        s.id === sceneId ? {
          ...s,
          narrationUrl: response.audio_url,
          narrationStatus: 'ready' as const,
          narrationDuration: response.duration_seconds || 0
        } : s
      ));

      // Save to context
      const sceneIndex = scenes.findIndex(s => s.id === sceneId);
      if (sceneIndex !== -1) {
        const updatedScenes = [...story.scenes];
        updatedScenes[sceneIndex] = {
          ...updatedScenes[sceneIndex],
          narration_url: response.audio_url,
          narration_duration: response.duration_seconds,
          phonemes: response.phonemes || null
        };
        story.setScenes(updatedScenes);

        // Clear final video since we have new narration - needs regeneration
        story.setFinalVideoUrl('');
        console.log('🔄 Cleared final video - needs regeneration with new narration');
      }
    } catch (error) {
      console.error('❌ Failed to regenerate narration:', error);
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, narrationStatus: 'error' as const } : s
      ));
    }
  };

  const handleEditScript = (sceneId: string, currentText: string) => {
    setEditingSceneId(sceneId);
    setEditedText(currentText);
  };

  const handleCancelEdit = () => {
    setEditingSceneId(null);
    setEditedText('');
  };

  const handleSaveScript = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Update local scene text
    setScenes(prev => prev.map(s =>
      s.id === sceneId ? { ...s, text: editedText, narrationStatus: 'generating' as const } : s
    ));

    // Update StoryContext scenes
    const sceneIndex = scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex !== -1) {
      const updatedScenes = [...story.scenes];
      updatedScenes[sceneIndex] = {
        ...updatedScenes[sceneIndex],
        script_text: editedText
      };
      story.setScenes(updatedScenes);
    }

    setEditingSceneId(null);
    setEditedText('');

    // Regenerate narration with the new text
    try {
      console.log(`🎙️ Regenerating narration for scene ${sceneIndex + 1} with new text...`);

      const response = await api.generateNarration(
        editedText,
        'ko',
        story.narrationVoice || undefined,
        undefined,
        true // includePhonemes
      );

      console.log(`✅ Narration regenerated for scene ${sceneIndex + 1}`);

      // Update scene with new narration
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? {
          ...s,
          narrationUrl: response.audio_url,
          narrationStatus: 'ready' as const,
          narrationDuration: response.duration_seconds || 0
        } : s
      ));

      // Update StoryContext with new narration
      if (sceneIndex !== -1) {
        const updatedScenes = [...story.scenes];
        updatedScenes[sceneIndex] = {
          ...updatedScenes[sceneIndex],
          script_text: editedText,
          narration_url: response.audio_url,
          narration_duration: response.duration_seconds,
          phonemes: response.phonemes || null
        };
        story.setScenes(updatedScenes);

        // Clear final video since we have new narration - needs regeneration
        story.setFinalVideoUrl('');
        console.log('🔄 Cleared final video - needs regeneration with new narration');
      }
    } catch (error) {
      console.error(`❌ Failed to regenerate narration:`, error);
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, narrationStatus: 'error' as const } : s
      ));
    }
  };

  const togglePlayNarration = (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene?.narrationUrl) return;

    const audio = audioRefs.current[sceneId];

    if (scene.isPlayingNarration) {
      // Pause
      audio?.pause();
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, isPlayingNarration: false } : s
      ));
    } else {
      // Stop all other audios
      Object.values(audioRefs.current).forEach(a => a?.pause());

      // Create or get audio element
      if (!audio) {
        const newAudio = new Audio(scene.narrationUrl);
        audioRefs.current[sceneId] = newAudio;

        // Setup event listeners
        newAudio.addEventListener('loadedmetadata', () => {
          setScenes(prev => prev.map(s =>
            s.id === sceneId ? { ...s, narrationDuration: newAudio.duration } : s
          ));
        });

        newAudio.addEventListener('timeupdate', () => {
          setScenes(prev => prev.map(s =>
            s.id === sceneId ? { ...s, narrationCurrentTime: newAudio.currentTime } : s
          ));
        });

        newAudio.addEventListener('ended', () => {
          setScenes(prev => prev.map(s =>
            s.id === sceneId ? { ...s, isPlayingNarration: false, narrationCurrentTime: 0 } : s
          ));
        });

        newAudio.play();
      } else {
        audio.play();
      }

      // Update state
      setScenes(prev => prev.map(s =>
        s.id === sceneId
          ? { ...s, isPlayingNarration: true }
          : { ...s, isPlayingNarration: false }
      ));
    }
  };

  const seekNarration = (sceneId: string, time: number) => {
    const audio = audioRefs.current[sceneId];
    if (audio) {
      audio.currentTime = time;
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, narrationCurrentTime: time } : s
      ));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const allImagesReady = scenes.length > 0 && scenes.every(scene => scene.imageStatus === 'ready');
  const hasVideosToGenerate = scenes.some(s => s.imageUrl && s.videoStatus === 'idle');
  const progressPercentage = scenes.length > 0 ? (completedImagesCount / scenes.length) * 100 : 0;

  // Check if ALL required content is ready for final video generation
  const allVideosReady = scenes.length > 0 && scenes.every(scene => scene.videoUrl !== null && scene.videoStatus === 'ready');
  const allNarrationsReady = scenes.length > 0 && scenes.every(scene => scene.narrationUrl !== null && scene.narrationStatus === 'ready');
  const canProceedToFinal = allVideosReady && allNarrationsReady && story.videos.length > 0 && story.videos.every(v => v);

  // Check if any operations are in progress - disable back button to prevent navigation during active requests
  const hasActiveOperations = isGeneratingScript ||
                               isGeneratingNarrations ||
                               isGeneratingImages ||
                               scenes.some(s => s.narrationStatus === 'generating' || s.imageStatus === 'generating' || s.videoStatus === 'generating');

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
                <p className="text-gray-500">장면 생성</p>
              </div>
            </div>
            {/* Right side: button + step */}
            <div className="flex items-center gap-4">
              <Button
                onClick={handleStartOver}
                variant="outline"
                className="text-[#6D14EC] border-[#6D14EC] hover:bg-[#6D14EC] hover:text-white rounded-full px-4 py-2"
              >
                처음부터 시작
              </Button>
              <span className="text-gray-500">4 / 5</span>
            </div>
          </div>
          <Progress value={80} className="h-2 [&>div]:bg-[#6D14EC]" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-8 py-6 bg-white">
          <div className="max-w-4xl mx-auto space-y-8">

            {/* Selection Summary */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-[#6D14EC] mb-1">스타일</div>
                <div className="text-sm text-gray-900">{getStyleLabel(story.selectedStyle)}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-[#6D14EC] mb-1">주제</div>
                <div className="text-sm text-gray-900">{story.selectedThemes.join(', ') || '모험, 우정'}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-[#6D14EC] mb-1">나레이션</div>
                <div className="text-sm text-gray-900">{voiceName}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-[#6D14EC] mb-1">장면 수</div>
                <div className="text-sm text-gray-900">{story.sceneCount}개</div>
              </div>
            </div>

            {/* Script Generation State */}
            {isGeneratingScript && (
              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <div className="flex items-start gap-3">
                  <Loader2 className="w-5 h-5 text-[#6D14EC] shrink-0 mt-0.5 animate-spin" />
                  <div>
                    <h3 className="text-[#6D14EC] mb-1">스토리 스크립트 생성 중</h3>
                    <p className="text-sm text-gray-600">
                      선택하신 캐릭터와 테마를 바탕으로 이야기를 만들고 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Single Dynamic Status Box */}
            {scenes.length > 0 && (
              <div className="bg-white rounded-xl p-5 border-2 border-[#6D14EC]">
                <div className="flex items-start gap-3">
                  {(isGeneratingNarrations || isGeneratingImages || isGeneratingVideos) ? (
                    <Loader2 className="w-5 h-5 text-[#6D14EC] shrink-0 mt-0.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-[#6D14EC] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    {isGeneratingNarrations ? (
                      <>
                        <h3 className="text-[#6D14EC] mb-1">내레이션을 생성 중입니다</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {completedNarrationsCount} / {scenes.length} 장면 완료
                        </p>
                        <Progress value={(completedNarrationsCount / scenes.length) * 100} className="h-2 [&>div]:bg-[#6D14EC]" />
                      </>
                    ) : isGeneratingImages ? (
                      <>
                        <h3 className="text-[#6D14EC] mb-1">이미지를 생성 중입니다</h3>
                        {sideCharacterProgress ? (
                          <>
                            <p className="text-sm text-gray-600 mb-3">
                              🎭 조연 캐릭터: {sideCharacterProgress.status}
                            </p>
                            <Progress value={(sideCharacterProgress.current / sideCharacterProgress.total) * 100} className="h-2 [&>div]:bg-[#6D14EC]" />
                          </>
                        ) : imageGenerationProgress ? (
                          <>
                            <p className="text-sm text-gray-600 mb-3">
                              {imageGenerationProgress.status}
                            </p>
                            <Progress value={(imageGenerationProgress.current / imageGenerationProgress.total) * 100} className="h-2 [&>div]:bg-[#6D14EC]" />
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-gray-600 mb-3">
                              {completedImagesCount} / {scenes.length} 장면 완료
                            </p>
                            <Progress value={progressPercentage} className="h-2 [&>div]:bg-[#6D14EC]" />
                          </>
                        )}
                      </>
                    ) : isGeneratingVideos ? (
                      <>
                        <h3 className="text-[#6D14EC] mb-1">영상을 생성 중입니다</h3>
                        {videoGenerationProgress ? (
                          <>
                            <p className="text-sm text-gray-600 mb-3">
                              {videoGenerationProgress.status}
                            </p>
                            <Progress value={(videoGenerationProgress.current / videoGenerationProgress.total) * 100} className="h-2 [&>div]:bg-[#6D14EC]" />
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-gray-600 mb-3">
                              영상 생성을 시작하는 중...
                            </p>
                            <Progress value={0} className="h-2 [&>div]:bg-[#6D14EC]" />
                          </>
                        )}
                      </>
                    ) : canProceedToFinal ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-[#6D14EC] mb-1">모든 장면이 완성되었습니다!</h3>
                          <p className="text-sm text-gray-600">
                            모든 비디오와 나레이션이 준비되었습니다. 다음 버튼을 클릭하여 최종 영상을 생성하세요!
                          </p>
                        </div>
                      </div>
                    ) : isGeneratingVideoPrompts ? (
                      <>
                        <h3 className="text-[#6D14EC] mb-1">영상 프롬프트를 생성 중입니다</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          이미지 생성이 완료되었습니다. 영상 프롬프트를 생성하고 있습니다...
                        </p>
                        <Progress value={50} className="h-2 [&>div]:bg-[#6D14EC]" />
                      </>
                    ) : allImagesReady ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-[#6D14EC] mb-1">이미지가 완성되었습니다!</h3>
                          <p className="text-sm text-gray-600">
                            {areVideoPromptsReady ? '비디오를 생성해주세요.' : '영상 프롬프트를 준비하는 중...'}
                          </p>
                        </div>
                        {hasVideosToGenerate && areVideoPromptsReady && (
                          <Button
                            onClick={generateAllVideos}
                            className="bg-[#6D14EC] hover:bg-[#5A0FCC] text-white rounded-lg ml-4"
                          >
                            <Video className="w-4 h-4 mr-2" />
                            모든 영상 생성하기
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <h3 className="text-[#6D14EC] mb-1">스토리가 성공적으로 생성되었습니다!</h3>
                        <p className="text-sm text-gray-600">
                          {story.storyTitle && `"${story.storyTitle}" - `}
                          {scenes.length}개의 장면으로 구성된 이야기입니다.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Scene Cards */}
            {scenes.length > 0 && (
              <div className="space-y-8">
                {scenes.map((scene, index) => (
                <div
                  key={scene.id}
                  className="bg-white rounded-xl overflow-hidden transition-all duration-500 opacity-100 translate-y-0"
                  style={{
                    transitionDelay: `${index * 100}ms`,
                  }}
                >
                  {/* Script Section - Full Width */}
                  <div className="p-6 pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#6D14EC] text-white flex items-center justify-center text-sm shrink-0">
                              {index + 1}
                            </div>
                            <h3 className="text-sm text-[#6D14EC]">스크립트</h3>
                          </div>
                          {editingSceneId === scene.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCancelEdit()}
                                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
                              >
                                취소
                              </button>
                              <button
                                onClick={() => handleSaveScript(scene.id)}
                                className="px-3 py-1 text-xs text-white bg-[#6D14EC] hover:bg-[#5A0FCC] rounded-md"
                                disabled={!editedText.trim() || editedText === scene.text}
                              >
                                저장
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditScript(scene.id, scene.text)}
                              className="px-3 py-1 text-xs text-[#6D14EC] hover:bg-[#6D14EC]/5 border border-[#6D14EC] rounded-md"
                            >
                              수정
                            </button>
                          )}
                        </div>
                        {editingSceneId === scene.id ? (
                          <div className="relative">
                            <input
                              type="text"
                              value={editedText}
                              onChange={(e) => {
                                const newText = e.target.value;
                                const charCount = newText.replace(/\s/g, '').length;
                                if (charCount <= 30) {
                                  setEditedText(newText);
                                }
                              }}
                              className="w-full text-gray-700 leading-relaxed border border-gray-300 rounded-md p-2 pr-20 outline-none focus:outline-none focus:ring-0 focus:border-gray-300"
                              autoFocus
                            />
                            <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${editedText.replace(/\s/g, '').length >= 30 ? 'text-red-500' : 'text-gray-500'}`}>
                              {editedText.replace(/\s/g, '').length}/30
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-700 leading-relaxed">
                            {scene.text}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Audio Player or Loading */}
                  {scene.narrationStatus === 'idle' && (
                    <div className="px-6 pb-4" style={{ paddingLeft: '22px' }}>
                      <Button
                        onClick={() => generateSingleNarration(scene.id)}
                        size="sm"
                        className="bg-[#6D14EC] hover:bg-[#5A0FCC] text-white rounded-lg"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        나레이션 생성
                      </Button>
                    </div>
                  )}
                  {scene.narrationStatus === 'generating' && (
                    <div className="px-6 pb-4" style={{ paddingLeft: '22px' }}>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-4 h-4 border-2 border-[#6D14EC] border-t-transparent rounded-full animate-spin"></div>
                        <span>나레이션 재생성 중...</span>
                      </div>
                    </div>
                  )}
                  {scene.narrationStatus === 'error' && (
                    <div className="px-6 pb-4" style={{ paddingLeft: '22px' }}>
                      <div className="flex items-center justify-between gap-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <AlertCircle className="w-4 h-4" />
                          <span>나레이션 생성에 실패했습니다</span>
                        </div>
                        <Button
                          onClick={() => retryNarration(scene.id)}
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          재시도
                        </Button>
                      </div>
                    </div>
                  )}
                  {scene.narrationUrl && scene.narrationStatus === 'ready' && (
                    <div className="px-6 pb-4" style={{ paddingLeft: '22px' }}>
                      <div className="max-w-md">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <AudioPlayer
                              src={scene.narrationUrl}
                              showJumpControls={false}
                              customAdditionalControls={[]}
                              customVolumeControls={[]}
                              layout="horizontal"
                              style={{
                                backgroundColor: 'white',
                                boxShadow: 'none',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontSize: '14px'
                              }}
                            />
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(scene.narrationUrl, {
                                  mode: 'cors',
                                  credentials: 'omit'
                                });
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${story.storyTitle || '스토리'}_장면${index + 1}_나레이션.mp3`;
                                document.body.appendChild(a);
                                a.click();
                                setTimeout(() => {
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);
                                }, 100);
                              } catch (error) {
                                console.error('Download failed:', error);
                                window.open(scene.narrationUrl, '_blank');
                              }
                            }}
                            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition-all shadow-sm shrink-0 active:bg-[#6D14EC] active:scale-95"
                            title="나레이션 다운로드"
                          >
                            <Download className="w-4 h-4 text-gray-700 transition-colors [button:active>&]:text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image and Video Section - Side by Side */}
                  <div className="p-6 pt-3">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">
                      {/* Image Section */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm text-[#6D14EC]">이미지</h3>
                          {scene.imageStatus === 'ready' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#10B981]/10 text-[#10B981] rounded-full text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              완료
                            </span>
                          )}
                        </div>

                        {/* Image Preview */}
                        <div className="relative aspect-video bg-[#F5F3FF] rounded-xl overflow-hidden">
                          {scene.imageStatus === 'idle' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <Sparkles className="w-8 h-8 text-gray-300 mb-2" />
                              <span className="text-sm text-gray-400">이미지 대기 중</span>
                            </div>
                          )}

                          {scene.imageStatus === 'generating' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <Loader2 className="w-8 h-8 text-[#6D14EC] animate-spin mb-2" />
                              <span className="text-sm text-gray-500">이미지 생성 중...</span>
                            </div>
                          )}

                          {scene.imageStatus === 'ready' && scene.imageUrl && (
                            <ImageWithFallback
                              src={scene.imageUrl}
                              alt={`Scene ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>

                        {/* Image Action Buttons */}
                        {scene.imageStatus === 'idle' && scene.imagePrompt && (
                          <Button
                            onClick={() => generateSingleImage(scene.id)}
                            className="w-full bg-[#6D14EC] hover:bg-[#5A0FCC] text-white rounded-lg"
                            size="sm"
                          >
                            <Sparkles className="w-4 h-4" />
                            이미지 생성
                          </Button>
                        )}
                        {(scene.imageStatus === 'ready' || scene.imageStatus === 'error') && (
                          <Button
                            onClick={() => retryImage(scene.id)}
                            variant="outline"
                            size="sm"
                            className="w-full border-gray-200 hover:border-[#6D14EC] hover:text-[#6D14EC] rounded-lg"
                          >
                            <RefreshCw className="w-4 h-4" />
                            이미지 다시 생성
                          </Button>
                        )}
                      </div>

                      {/* Arrow Separator */}
                      <div className="hidden lg:flex items-center justify-center h-full pt-12">
                        <ChevronRight className="w-6 h-6 text-gray-300" />
                      </div>

                      {/* Video Section */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm text-[#6D14EC]">영상</h3>
                          <div className="flex items-center gap-2">
                            {scene.videoStatus === 'ready' && scene.videoUrl && (
                              <button
                                onClick={async () => {
                                  try {
                                    const response = await fetch(scene.videoUrl, {
                                      mode: 'cors',
                                      credentials: 'omit'
                                    });
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${story.storyTitle || '스토리'}_장면${index + 1}.mp4`;
                                    document.body.appendChild(a);
                                    a.click();
                                    setTimeout(() => {
                                      window.URL.revokeObjectURL(url);
                                      document.body.removeChild(a);
                                    }, 100);
                                  } catch (error) {
                                    console.error('Download failed:', error);
                                    window.open(scene.videoUrl, '_blank');
                                  }
                                }}
                                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition-all shadow-sm active:bg-[#6D14EC] active:scale-95"
                                title="영상 다운로드"
                              >
                                <Download className="w-3.5 h-3.5 text-gray-700 transition-colors [button:active>&]:text-white" />
                              </button>
                            )}
                            {scene.videoStatus === 'ready' && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#6D14EC]/10 text-[#6D14EC] rounded-full text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                완료
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Video Preview */}
                        {scene.videoStatus === 'ready' && scene.videoUrl && (
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                            <Plyr
                              key={scene.videoUrl}
                              source={{
                                type: 'video',
                                sources: [
                                  {
                                    src: scene.videoUrl,
                                    type: 'video/mp4',
                                  },
                                ],
                              }}
                              options={{
                                controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
                                color: '#6D14EC',
                                hideControls: false,
                                resetOnEnd: true,
                              }}
                            />
                          </div>
                        )}

                        {/* Generating State */}
                        {scene.videoStatus === 'generating' && (
                          <div className="relative aspect-video bg-[#F5F3FF] rounded-xl overflow-hidden flex flex-col items-center justify-center p-4">
                            <Loader2 className="w-8 h-8 text-[#6D14EC] animate-spin mb-2" />
                            <span className="text-sm text-gray-500">영상 생성 중...</span>
                          </div>
                        )}

                        {/* Idle State */}
                        {scene.videoStatus === 'idle' && (
                          <div className="relative aspect-video bg-[#F5F3FF] rounded-xl overflow-hidden flex flex-col items-center justify-center border-2 border-dashed border-gray-200">
                            <Sparkles className="w-8 h-8 text-gray-300 mb-2" />
                            <span className="text-sm text-gray-400">
                              {scene.imageStatus === 'ready' && !scene.videoPrompt
                                ? '영상 프롬프트 준비 중...'
                                : '영상 대기 중'}
                            </span>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {scene.videoStatus === 'idle' && scene.imageStatus === 'ready' && scene.videoPrompt && (
                            <Button
                              onClick={() => animateScene(scene.id)}
                              className="flex-1 bg-[#6D14EC] hover:bg-[#5A0FCC] text-white rounded-lg"
                            >
                              <Sparkles className="w-4 h-4" />
                              애니메이션 생성
                            </Button>
                          )}

                          {scene.videoStatus === 'ready' && (
                            <Button
                              onClick={() => retryAnimation(scene.id)}
                              variant="outline"
                              className="flex-1 border-gray-200 hover:border-[#6D14EC] hover:text-[#6D14EC] rounded-lg"
                            >
                              <RefreshCw className="w-4 h-4" />
                              다시 생성
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 bg-white">
        <div className="px-8 py-4 flex justify-center items-center" style={{ gap: '400px' }}>
          <Button
            onClick={onBack}
            disabled={hasActiveOperations}
            variant="outline"
            style={{ width: '200px' }}
            className="py-3 rounded-full border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            이전
          </Button>
          <Button
            onClick={() => {
              // Force save to localStorage before navigation to prevent data loss
              console.log('🔒 Force saving to localStorage before navigation...');
              story.forceSave();
              console.log('✅ Data saved, proceeding to next page');
              onNext();
            }}
            disabled={!canProceedToFinal}
            style={{ width: '200px' }}
            className="py-3 rounded-full bg-[#6D14EC] hover:bg-[#5A0FCC] text-white disabled:bg-[#6D14EC] disabled:opacity-30 disabled:cursor-not-allowed"
            title={!canProceedToFinal ? '모든 장면의 비디오와 나레이션이 필요합니다' : '최종 비디오 페이지로 이동'}
          >
            다음
          </Button>
        </div>
      </div>
    </div>
  );
}
