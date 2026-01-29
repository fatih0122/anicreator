import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Compass, Heart, Wand2, Users, Dog, Sparkles, RefreshCw, Home } from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import UnicornOnly from "../imports/UnicornOnly";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useStory } from "../context/StoryContext";
import { api } from "../services/api";

interface StoryIdea {
  id: string;
  title: string;
  themes: string[];
  style: string;
  preview: string;
}

interface StoryThemeProps {
  onNext?: () => void;
}

export function StoryTheme({ onNext }: StoryThemeProps) {
  const router = useRouter();
  const story = useStory();
  // Only use local state for UI-only state (not persistent)
  const [generatedIdeas, setGeneratedIdeas] = useState<StoryIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);

  const handleStartOver = () => {
    story.reset();
    router.push('/create/start');
  };

  // Style ID to full prompt mapping
  const stylePrompts: Record<string, string> = {
    "ghibli": "Studio Ghibli animation style",
    "anime": "anime art style",
    "photorealistic": "photorealistic style",
    "micro-world": "micro world style",
    "animation": "Disney Pixar animation style",
    "3d": "3D rendered style",
    "pixel": "pixel art style",
    "cyberpunk": "cyberpunk style"
  };

  const styles = [
    {
      id: "ghibli",
      label: "지브리",
      image: "https://stobee.s3.us-east-2.amazonaws.com/style_previews/ghibli_preview.png"
    },
    {
      id: "anime",
      label: "아니메",
      image: "https://stobee.s3.us-east-2.amazonaws.com/style_previews/anime_preview.png"
    },
    {
      id: "photorealistic",
      label: "포토리얼리스틱",
      image: "https://stobee.s3.us-east-2.amazonaws.com/style_previews/photorealistic_preview.png"
    },
    {
      id: "micro-world",
      label: "마이크로 월드",
      image: "https://stobee.s3.us-east-2.amazonaws.com/style_previews/micro-world_preview.png"
    },
    {
      id: "animation",
      label: "디즈니 애니메이션",
      image: "https://stobee.s3.us-east-2.amazonaws.com/style_previews/animation_preview.png"
    },
    {
      id: "3d",
      label: "3D 렌더링",
      image: "https://stobee.s3.us-east-2.amazonaws.com/style_previews/3d_preview.png"
    },
    {
      id: "pixel",
      label: "픽셀 아트",
      image: "https://stobee.s3.us-east-2.amazonaws.com/style_previews/pixel_preview.png"
    },
    {
      id: "cyberpunk",
      label: "사이버펑크",
      image: "https://stobee.s3.us-east-2.amazonaws.com/style_previews/cyberpunk_preview.png"
    },
  ];

  // Get the selected style ID from the full prompt stored in context
  const getSelectedStyleId = () => {
    const fullPrompt = story.selectedStyle;
    const entry = Object.entries(stylePrompts).find(([_, prompt]) => prompt === fullPrompt);
    return entry ? entry[0] : "";
  };

  const handleStyleSelect = (styleId: string) => {
    // Convert style ID to full prompt and save to context immediately
    const fullStylePrompt = stylePrompts[styleId] || styleId;
    story.setSelectedStyle(fullStylePrompt);
  };

  const generateStoryIdeas = () => {
    // Simulate AI generation with mock data
    const mockIdeas: StoryIdea[] = [
      {
        id: "1",
        title: "토토의 숲속 모험",
        themes: story.selectedThemes.length > 0 ? story.selectedThemes : ["모험", "우정"],
        style: story.selectedStyle || "몽환적인",
        preview: "작은 토끼가 숲속에서 길을 잃고 새로운 친구들을 만나며 집으로 돌아가는 여정을 시작해요...",
      },
      {
        id: "2",
        title: "마법의 정원 이야기",
        themes: story.selectedThemes.length > 0 ? story.selectedThemes : ["판타지"],
        style: story.selectedStyle || "몽환적인",
        preview: "평범한 정원이 밤이 되면 마법의 세계로 변해요. 작은 소녀가 이 비밀을 발견하게 되는데...",
      },
      {
        id: "3",
        title: "용감한 강아지 루피",
        themes: story.selectedThemes.length > 0 ? story.selectedThemes : ["동물 이야기", "가족"],
        style: story.selectedStyle || "따뜻한",
        preview: "길 잃은 강아지가 가족을 찾기 위해 용감한 여정을 떠나요. 그 과정에서 많은 것을 배우게 돼요...",
      },
      {
        id: "4",
        title: "별빛 친구들",
        themes: story.selectedThemes.length > 0 ? story.selectedThemes : ["우정", "신비/마법"],
        style: story.selectedStyle || "신나는",
        preview: "하늘의 별들이 내려와 아이와 친구가 되어 함께 특별한 모험을 떠나는 이야기예요...",
      },
    ];
    setGeneratedIdeas(mockIdeas);
  };

  const selectedStyleId = getSelectedStyleId();

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
              <span className="text-gray-500">1 / 5</span>
            </div>
          </div>
          <Progress value={20} className="h-2 [&>div]:bg-[#6D14EC]" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-8 py-6 bg-white">

        {/* Style Selection */}
        <div className="mb-8 flex justify-center">
          <div className="w-full max-w-3xl">
            <h2 className="text-[#6D14EC] font-medium mb-4">이야기 스타일</h2>
            <div className="grid grid-cols-4 gap-4">
              {styles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleStyleSelect(style.id)}
                  className={`
                    relative rounded-xl overflow-hidden transition-all
                    ${selectedStyleId === style.id
                      ? 'ring-2 ring-[#6D14EC] ring-offset-2'
                      : 'hover:scale-105'
                    }
                  `}
                >
                  <div className="flex flex-col">
                    <div className="aspect-square relative rounded-lg overflow-hidden">
                      <ImageWithFallback
                        src={style.image}
                        alt={style.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-2 text-center">
                      <span className={`text-sm font-medium ${selectedStyleId === style.id ? 'text-[#6D14EC]' : 'text-gray-700'}`}>
                        {style.label}
                      </span>
                    </div>
                  </div>
                  {selectedStyleId === style.id && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#6D14EC] flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" strokeWidth="2.5" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>


        {/* Output Section - Generated Story Ideas */}
        {generatedIdeas.length > 0 && (
          <div className="mt-12 pt-8 border-t">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[#6D14EC] font-medium">생성된 이야기</h2>
                <p className="text-sm text-gray-500">마음에 드는 이야기를 선택하세요</p>
              </div>
              <Button
                onClick={generateStoryIdeas}
                className="bg-white text-gray-700 hover:bg-[#6D14EC]/5 rounded-full shadow-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                다시 생성
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {generatedIdeas.map((idea) => (
                <div
                  key={idea.id}
                  onClick={() => setSelectedIdea(idea.id)}
                  className={`p-5 rounded-xl cursor-pointer transition-all ${
                    selectedIdea === idea.id
                      ? 'bg-[#6D14EC]/5 ring-2 ring-[#6D14EC]'
                      : 'bg-white hover:bg-[#6D14EC]/5 shadow-sm'
                  }`}
                >
                  <div className="space-y-3">
                    <h3 className="text-[#6D14EC]">{idea.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {idea.themes.map((theme) => (
                        <span
                          key={theme}
                          className="px-3 py-1 bg-white rounded-full text-xs text-gray-600"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {idea.preview}
                    </p>
                    {selectedIdea === idea.id && (
                      <div className="pt-2">
                        <span className="text-sm text-[#6D14EC]">✓ 선택됨</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 bg-white">
        <div className="px-8 py-4 flex justify-center items-center" style={{ gap: '400px' }}>
          <Button
            variant="outline"
            disabled
            style={{ width: '200px' }}
            className="py-3 rounded-full border-gray-300 text-gray-700 disabled:opacity-30"
          >
            이전
          </Button>
          <Button
            onClick={async () => {
              if (!story.selectedStyle) return;

              // Save to backend
              try {
                await api.saveStyleTheme(story.selectedStyle, [], "");
                console.log('✅ Style saved to backend:', story.selectedStyle);
              } catch (error) {
                console.error('❌ Failed to save style:', error);
              }

              // Navigate to next page
              if (onNext) onNext();
            }}
            disabled={!story.selectedStyle}
            style={{ width: '200px' }}
            className="py-3 rounded-full bg-[#6D14EC] hover:bg-[#5A0FCC] text-white disabled:bg-[#6D14EC] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            다음
          </Button>
        </div>
      </div>
    </div>
  );
}
