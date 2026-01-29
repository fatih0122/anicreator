import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Volume2, RefreshCw, Play, Pause, Trash2, Wand2, Heart, Compass, Mic2, ChevronDown, ChevronLeft, ChevronRight, Users, Dog, Sparkles, Home } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import UnicornOnly from "../imports/UnicornOnly";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Progress } from "./ui/progress";
import { useStory } from "../context/StoryContext";
import { api, SceneLine } from "../services/api";

interface Scene {
  id: string;
  title: string;
  text: string;
  voice: string;
  narrationGenerated: boolean;
  isPlaying: boolean;
}

interface Voice {
  voice_id: string;
  original_name: string;
  display_name: string;
  preview_script: string;
  preview_url: string;
}

interface StoryNarrationProps {
  onNext?: () => void;
  onBack?: () => void;
}

export function StoryNarration({ onNext, onBack }: StoryNarrationProps) {
  const router = useRouter();
  const story = useStory();

  const handleStartOver = () => {
    story.reset();
    router.push('/create/start');
  };

  const [selectedThemes, setSelectedThemes] = useState<string[]>(story.selectedThemes);
  const [customTheme, setCustomTheme] = useState(story.customTheme);
  const [sceneCount, setSceneCount] = useState(story.sceneCount);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [storyGenerated, setStoryGenerated] = useState(false);
  const [globalVoice, setGlobalVoice] = useState(story.narrationVoice || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [voicePopoverOpen, setVoicePopoverOpen] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync local state with context when it changes (after hydration from localStorage)
  useEffect(() => {
    setSelectedThemes(story.selectedThemes);
    setCustomTheme(story.customTheme);
    setSceneCount(story.sceneCount);
    setGlobalVoice(story.narrationVoice || "");
  }, [story.selectedThemes, story.customTheme, story.sceneCount, story.narrationVoice]);

  // Fetch voices from backend
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await api.getVoices();
        setVoices(response.voices);

        // Set default voice to "라이언" (Ryan) if not already set or if invalid
        const defaultVoice = response.voices.find(v => v.display_name === "라이언") || response.voices[0];

        // Always set default if globalVoice is empty or not valid
        if ((!globalVoice || !response.voices.find(v => v.voice_id === globalVoice)) && response.voices.length > 0) {
          setGlobalVoice(defaultVoice.voice_id);
          story.setNarrationVoice(defaultVoice.voice_id);
          console.log('🎤 Default voice set to:', defaultVoice.display_name);
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
      }
    };
    fetchVoices();
  }, []);

  // Handle audio playback for voice previews
  const handlePlayVoice = (voice: Voice) => {
    if (playingVoice === voice.voice_id) {
      // Stop current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingVoice(null);
    } else {
      // Stop previous audio
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // Play new audio
      const audio = new Audio(voice.preview_url);
      audioRef.current = audio;

      audio.play().catch(error => {
        console.error('Error playing audio:', error);
      });

      audio.onended = () => {
        setPlayingVoice(null);
      };

      setPlayingVoice(voice.voice_id);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const themes = [
    { id: "모험", label: "모험", icon: Compass },
    { id: "우정", label: "우정", icon: Heart },
    { id: "판타지", label: "판타지", icon: Wand2 },
    { id: "가족", label: "가족", icon: Users },
    { id: "동물 이야기", label: "동물 이야기", icon: Dog },
    { id: "신비/마법", label: "신비/마법", icon: Sparkles },
  ];

  // Helper function to get gradient color for voice (based on index)
  const getVoiceGradient = (index: number) => {
    const gradients = [
      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
      "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
      "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
      "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
      "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)",
      "linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)",
    ];
    return gradients[index % gradients.length];
  };

  const toggleTheme = (themeId: string) => {
    let updatedThemes: string[];
    if (selectedThemes.includes(themeId)) {
      updatedThemes = selectedThemes.filter(t => t !== themeId);
    } else if (selectedThemes.length < 2) {
      updatedThemes = [...selectedThemes, themeId];
    } else {
      return;
    }
    setSelectedThemes(updatedThemes);
    story.setSelectedThemes(updatedThemes);
  };

  const generateStory = async () => {
    setIsGenerating(true);

    try {
      // Call backend to generate story script
      const response = await api.generateStoryScript(
        story.characterName,
        story.characterType,
        story.characterPrompt,
        story.personality,
        selectedThemes,
        customTheme,
        sceneCount,
        story.selectedStyle
      );

      console.log('✅ Story script generated:', response);

      // Save to context
      story.setStoryTitle(response.story_title);
      story.setScenes(response.scenes);
      story.setSceneCount(sceneCount);

      // Convert SceneLine[] to Scene[] for local state
      const generatedScenes: Scene[] = response.scenes.map((scene) => ({
        id: `scene-${scene.scene_number}`,
        title: `장면 ${scene.scene_number}`,
        text: scene.script_text,
        voice: globalVoice,
        narrationGenerated: true,
        isPlaying: false,
      }));

      setScenes(generatedScenes);
      setStoryGenerated(true);
    } catch (error) {
      console.error('❌ Failed to generate story:', error);
      alert('이야기 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateNarration = (sceneId: string) => {
    setScenes(scenes.map(scene => 
      scene.id === sceneId 
        ? { ...scene, narrationGenerated: true }
        : scene
    ));
  };

  const generateAllNarrations = () => {
    setScenes(scenes.map(scene => ({
      ...scene,
      narrationGenerated: true
    })));
  };

  const togglePlayPause = (sceneId: string) => {
    setScenes(scenes.map(scene => 
      scene.id === sceneId 
        ? { ...scene, isPlaying: !scene.isPlaying }
        : { ...scene, isPlaying: false }
    ));
  };

  const regenerateScene = (sceneId: string) => {
    setScenes(scenes.map(scene => 
      scene.id === sceneId 
        ? { ...scene, text: scene.text + " (새로 생성됨)", narrationGenerated: false }
        : scene
    ));
  };

  const deleteNarration = (sceneId: string) => {
    setScenes(scenes.map(scene => 
      scene.id === sceneId 
        ? { ...scene, narrationGenerated: false, isPlaying: false }
        : scene
    ));
  };

  const updateSceneTitle = (sceneId: string, newTitle: string) => {
    setScenes(scenes.map(scene => 
      scene.id === sceneId ? { ...scene, title: newTitle } : scene
    ));
  };

  const updateSceneText = (sceneId: string, newText: string) => {
    setScenes(scenes.map(scene => 
      scene.id === sceneId ? { ...scene, text: newText, narrationGenerated: false } : scene
    ));
  };

  const updateSceneVoice = (sceneId: string, newVoice: string) => {
    setScenes(scenes.map(scene => 
      scene.id === sceneId ? { ...scene, voice: newVoice, narrationGenerated: false } : scene
    ));
  };

  const allNarrationsGenerated = scenes.length > 0 && scenes.every(scene => scene.narrationGenerated);

  return (
    <div className="h-[calc(100vh-90px)] bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white">
        <div className="max-w-4xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between mb-3">
            {/* Home button + Unicorn + title */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => router.push('/projects')}
                variant="ghost"
                className="p-2 text-[#6D14EC] hover:bg-[#6D14EC]/10 rounded-full"
                title="내 프로젝트"
              >
                <Home className="w-6 h-6" />
              </Button>
              <UnicornOnly size={60} />
              <div>
                <h1 className="text-2xl text-[#6D14EC] font-medium">이야기 만들기</h1>
                <p className="text-gray-500">주제 선택</p>
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
              <span className="text-gray-500">2 / 5</span>
            </div>
          </div>
          <Progress value={40} className="h-2 [&>div]:bg-[#6D14EC]" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-8 py-6 bg-white flex justify-center">

        {!storyGenerated && (
          <div className="space-y-6 w-full max-w-3xl">

            {/* Custom Theme Input - Top */}
            <div>
              <h2 className="text-[#6D14EC] font-medium mb-1">직접 입력</h2>
              <p className="text-sm text-gray-500 mb-4">특별한 이야기 주제 (선택사항)</p>
              <Textarea
                placeholder="예: 우주에서 친구를 찾는 외계인 이야기"
                value={customTheme}
                onChange={(e) => {
                  setCustomTheme(e.target.value);
                  story.setCustomTheme(e.target.value);
                }}
                className="w-full max-w-3xl min-h-[120px] text-sm resize-none rounded-xl bg-white border border-gray-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-gray-200"
              />
            </div>

            {/* Categories and Narration Voice - Side by Side */}
            <div className="grid grid-cols-2 gap-6">

              {/* Categories */}
              <div>
                <h2 className="text-[#6D14EC] font-medium mb-1">카테고리</h2>
                <p className="text-sm text-gray-500 mb-4">최대 2개 선택</p>
                <div className="grid grid-cols-3 gap-3">
                  {themes.map((theme) => {
                    const Icon = theme.icon;
                    const isSelected = selectedThemes.includes(theme.id);
                    return (
                      <button
                        key={theme.id}
                        onClick={() => toggleTheme(theme.id)}
                        className={`
                          flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-all shadow-sm
                          ${isSelected
                            ? 'bg-[#6D14EC] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-sm whitespace-nowrap">{theme.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Voice Selection */}
              <div>
                <h2 className="text-[#6D14EC] font-medium mb-1">나레이션 음성</h2>
                <p className="text-sm text-gray-500 mb-4">&nbsp;</p>
                <Popover open={voicePopoverOpen} onOpenChange={setVoicePopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center justify-between gap-3 px-4 py-3 rounded-full bg-white hover:bg-gray-100 transition-colors shadow-sm w-80">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full shrink-0"
                          style={{ background: getVoiceGradient(voices.findIndex(v => v.voice_id === globalVoice)) }}
                        />
                        <span className="text-sm text-gray-700">
                          {voices.find(v => v.voice_id === globalVoice)?.display_name || '목소리 선택'}
                        </span>
                      </div>
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-80 p-2 rounded-xl z-[100]"
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    avoidCollisions={true}
                    sticky="always"
                  >
                    <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '252px' }}>
                      {voices.map((voice, index) => (
                        <div
                          key={voice.voice_id}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                            globalVoice === voice.voice_id
                              ? 'bg-gray-100'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div
                            onClick={() => {
                              setGlobalVoice(voice.voice_id);
                              story.setNarrationVoice(voice.voice_id);
                              setVoicePopoverOpen(false);
                            }}
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                          >
                            <div
                              className="w-8 h-8 rounded-full shrink-0"
                              style={{ background: getVoiceGradient(index) }}
                            />
                            <span className="text-sm text-gray-700">
                              {voice.display_name}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayVoice(voice);
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 bg-gray-100 hover:bg-gray-200"
                          >
                            {playingVoice === voice.voice_id ? (
                              <Pause className="w-3.5 h-3.5 text-[#6D14EC]" fill="#6D14EC" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-[#6D14EC]" fill="#6D14EC" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

            </div>

            {/* Scene Count */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-[#6D14EC] font-medium">장면 개수</h2>
                <span className="text-2xl font-bold text-[#6D14EC]">{sceneCount}</span>
                <span className="text-sm text-gray-500">장면</span>
              </div>
              <div className="w-full max-w-md">
                <style jsx global>{`
                  .purple-slider [data-slot="slider-track"] {
                    background: #f3f4f6 !important;
                    border: 1px solid #d1d5db !important;
                    height: 8px !important;
                    border-radius: 9999px !important;
                  }
                  .purple-slider [data-slot="slider-range"] {
                    background: #6D14EC !important;
                    height: 100% !important;
                    border-radius: 9999px !important;
                  }
                  .purple-slider [data-slot="slider-thumb"] {
                    border: 2px solid #6D14EC !important;
                    background: #6D14EC !important;
                    width: 20px !important;
                    height: 20px !important;
                    box-shadow: none !important;
                    border-radius: 50% !important;
                  }
                  .purple-slider [data-slot="slider-thumb"]:hover {
                    box-shadow: 0 0 0 4px rgba(109, 20, 236, 0.2) !important;
                  }
                `}</style>
                <Slider
                  value={[sceneCount]}
                  onValueChange={(value) => {
                    setSceneCount(value[0]);
                    story.setSceneCount(value[0]);
                  }}
                  min={3}
                  max={15}
                  step={1}
                  className="mb-3 purple-slider"
                />
                <div className="relative text-xs text-gray-500" style={{ paddingLeft: '2px', paddingRight: '2px' }}>
                  <span className="absolute" style={{ left: 'calc(0% - 4px)' }}>3</span>
                  <span className="absolute" style={{ left: 'calc(25% - 4px)' }}>6</span>
                  <span className="absolute" style={{ left: 'calc(50% - 4px)' }}>9</span>
                  <span className="absolute" style={{ left: 'calc(75% - 4px)' }}>12</span>
                  <span className="absolute" style={{ left: 'calc(100% - 8px)' }}>15</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Scene Blocks */}
        {storyGenerated && scenes.length > 0 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-[#6D14EC] mb-1">생성된 스크립트</h2>
              <p className="text-sm text-gray-500 mb-6">각 장면의 내용을 확인하세요</p>
            </div>

            {/* Scene Cards */}
            <div className="space-y-0">
              {scenes.map((scene, index) => (
                <div key={scene.id}>
                  <div className="flex items-start gap-4 py-6">
                    {/* Scene Text Content */}
                    <div className="flex-1 pt-1">
                      <p className="text-gray-700 leading-relaxed">
                        {scene.text}
                      </p>
                    </div>

                    {/* Play Button */}
                    <button
                      onClick={() => togglePlayPause(scene.id)}
                      className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center transition-colors mt-1 ${
                        scene.isPlaying 
                          ? 'bg-[#6D14EC] text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {scene.isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Dotted Separator */}
                  {index < scenes.length - 1 && (
                    <div className="border-b border-dotted border-gray-300" />
                  )}
                </div>
              ))}
            </div>

            {/* Hidden section for editing - show on demand */}
            <div className="hidden">
              {scenes.map((scene, index) => (
                <div key={scene.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#6D14EC]/30 transition-colors">
                  <div className="space-y-4">
                    {/* Scene Header */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#6D14EC] text-white flex items-center justify-center shrink-0 text-sm mt-1">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <Input
                          value={scene.title}
                          onChange={(e) => updateSceneTitle(scene.id, e.target.value)}
                          className="border-0 bg-transparent px-0 focus-visible:ring-0 mb-3"
                        />
                        
                        {/* Scene Text */}
                        <Textarea
                          value={scene.text}
                          onChange={(e) => updateSceneText(scene.id, e.target.value)}
                          className="min-h-[100px] resize-none bg-[#FCFCFF]"
                          placeholder="장면 설명을 입력하세요..."
                        />
                      </div>
                    </div>

                    {/* Voice Selection & Controls */}
                    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center pt-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="w-5 h-5 rounded-full shrink-0"
                          style={{ background: getVoiceGradient(voices.findIndex(v => v.voice_id === scene.voice)) }}
                        />
                        <Select
                          value={scene.voice}
                          onValueChange={(value) => updateSceneVoice(scene.id, value)}
                        >
                          <SelectTrigger className="flex-1 bg-white border-gray-200 h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {voices.map((voice, idx) => (
                              <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ background: getVoiceGradient(idx) }}
                                  />
                                  <span className="text-sm">{voice.display_name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2 w-full md:w-auto">
                        <Button
                          onClick={() => regenerateScene(scene.id)}
                          variant="outline"
                          size="sm"
                          className="flex-1 md:flex-initial rounded-lg"
                        >
                          <RefreshCw className="w-4 h-4" />
                          다시 생성
                        </Button>
                        
                        {!scene.narrationGenerated ? (
                          <Button
                            onClick={() => generateNarration(scene.id)}
                            size="sm"
                            className="bg-[#FF6B9D] hover:bg-[#FF5089] text-white flex-1 md:flex-initial rounded-lg"
                          >
                            <Volume2 className="w-4 h-4" />
                            나레이션 생성
                          </Button>
                        ) : (
                          <>
                            <Button
                              onClick={() => togglePlayPause(scene.id)}
                              size="sm"
                              className="bg-[#6D14EC] hover:bg-[#5A0FCC] text-white rounded-lg"
                            >
                              {scene.isPlaying ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              onClick={() => deleteNarration(scene.id)}
                              size="sm"
                              variant="outline"
                              className="text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Audio Waveform */}
                    {scene.narrationGenerated && (
                      <div className="bg-gradient-to-r from-[#6D14EC]/5 to-[#FF6B9D]/5 rounded-lg p-4 mt-2">
                        <div className="flex items-center gap-1 h-10">
                          {Array.from({ length: 50 }).map((_, i) => (
                            <div
                              key={i}
                              className={`flex-1 rounded-full transition-all ${
                                scene.isPlaying ? 'bg-[#6D14EC]' : 'bg-gray-300'
                              }`}
                              style={{
                                height: `${20 + Math.random() * 80}%`,
                                opacity: scene.isPlaying ? 0.4 + Math.random() * 0.6 : 0.5,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Regenerate All Button */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={generateStory}
                variant="outline"
                className="border-[#6D14EC] text-[#6D14EC] hover:bg-[#6D14EC]/5 rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
                이야기 전체 다시 생성하기
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100">
        <div className="px-8 py-4 flex justify-between items-center">
          {/* Left: Back Arrow */}
          <button
            onClick={() => onBack?.()}
            className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="이전 단계"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>

          {/* Center: Main Buttons */}
          <div className="flex items-center" style={{ gap: '400px' }}>
            <Button
              onClick={onBack}
              variant="outline"
              style={{ width: '200px' }}
              className="py-3 rounded-full border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
            >
              이전
            </Button>
            <Button
              onClick={async () => {
                if (selectedThemes.length === 0 && !customTheme) return;

                // Save category data to context
                story.setSelectedThemes(selectedThemes);
                story.setCustomTheme(customTheme);
                story.setNarrationVoice(globalVoice);
                story.setSceneCount(sceneCount);

                // Save to backend
                try {
                  await api.saveCategoryData(selectedThemes, customTheme, globalVoice, sceneCount);
                  console.log('✅ Category data saved to backend');
                } catch (error) {
                  console.error('❌ Failed to save category data:', error);
                }

                // Navigate to character creation (script will be generated later after character is selected)
                if (onNext) onNext();
              }}
              disabled={selectedThemes.length === 0 && !customTheme}
              style={{ width: '200px' }}
              className="py-3 rounded-full bg-[#6D14EC] hover:bg-[#5A0FCC] text-white disabled:bg-[#6D14EC] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              다음
            </Button>
          </div>

          {/* Right: Forward Arrow */}
          <button
            onClick={() => onNext?.()}
            className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="다음 단계"
          >
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
