import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Card } from "./ui/card";
import UnicornOnly from "../imports/UnicornOnly";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useStory } from "../context/StoryContext";
import { api } from "../services/api";

interface CharacterSelectionProps {
  onNext?: () => void;
  onBack?: () => void;
}

export function CharacterSelection({ onNext, onBack }: CharacterSelectionProps) {
  const router = useRouter();
  const story = useStory();

  const handleStartOver = () => {
    story.reset();
    router.push('/create/start');
  };

  // Use local state initialized from context
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(story.selectedCharacterId);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Sync local state with context on mount or when context changes
  useEffect(() => {
    if (story.selectedCharacterId !== null) {
      setSelectedCharacter(story.selectedCharacterId);
    }
  }, [story.selectedCharacterId]);

  // Get generated characters from context
  const generatedCharacters = story.characterOptions;

  const handleSelectCharacter = () => {
    if (selectedCharacter === null) return;

    // Find the selected character and save both URL and PROMPT to context
    const selected = generatedCharacters.find(c => c.id === selectedCharacter);
    if (selected) {
      story.setSelectedCharacterId(selectedCharacter); // Save the selected ID
      story.setCharacterImageUrl(selected.url);
      story.setCharacterPrompt(selected.prompt); // ✅ Save the character generation prompt!
      console.log('✅ Character selected:', selected.url);
      console.log('✅ Character prompt:', selected.prompt);
      if (onNext) onNext();
    }
  };

  // Also update local selection and save to context when clicking on a character
  const handleCharacterClick = (id: number) => {
    setSelectedCharacter(id);
    story.setSelectedCharacterId(id);
  };

  // Regenerate characters using existing settings
  const handleRegenerate = async () => {
    setIsRegenerating(true);

    try {
      // Regenerate 2 new character options using the existing character description and settings
      const genResponse = await api.generateCharacter(
        story.characterDescription,
        story.selectedStyle,
        story.selectedThemes,
        story.customTheme
      );

      console.log('✅ Characters regenerated:', genResponse);
      story.setCharacterOptions(genResponse.characters);

      // Reset selection since we have new characters
      setSelectedCharacter(null);
      story.setSelectedCharacterId(null);
    } catch (error) {
      console.error('❌ Failed to regenerate characters:', error);
      alert('Failed to regenerate characters. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handle going back to character creation form (NOT method selection)
  const handleGoBack = () => {
    // Clear character options but keep the method and other character details
    // This allows users to go back to the form to edit character details
    story.setCharacterOptions([]);
    story.setSelectedCharacterId(null);
    setSelectedCharacter(null);
    // Note: We're NOT clearing characterCreationMethod, so they stay in their chosen method
    if (onBack) onBack();
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
                <p className="text-gray-500">캐릭터 선택</p>
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
              <span className="text-gray-500">3 / 5</span>
            </div>
          </div>
          <Progress value={60} className="h-2 [&>div]:bg-[#6D14EC]" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-8 py-6 bg-white">
        <div className="space-y-8">

          {/* Generated Characters Grid */}
          <div>
            <h2 className="text-[#6D14EC] mb-3 text-lg text-center">생성된 캐릭터</h2>
            <p className="text-sm text-gray-500 mb-12 text-center">마음에 드는 캐릭터를 선택해주세요</p>

            <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
              {generatedCharacters.map((character) => (
                <Card
                  key={character.id}
                  className={`overflow-hidden cursor-pointer transition-all duration-200 border-2 ${
                    selectedCharacter === character.id
                      ? 'border-[#6D14EC] shadow-lg shadow-[#6D14EC]/30 scale-105'
                      : 'border-gray-200 hover:border-[#6D14EC]/50 hover:shadow-md'
                  }`}
                  onClick={() => handleCharacterClick(character.id)}
                >
                  <div className="relative aspect-square">
                    <ImageWithFallback
                      src={character.url}
                      alt={`Character ${character.id}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedCharacter === character.id && (
                      <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#6D14EC] flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="none" strokeWidth="2.5" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Regenerate Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              variant="outline"
              className="border-[#6D14EC] text-[#6D14EC] hover:bg-[#6D14EC]/5 min-w-[150px]"
            >
              {isRegenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#6D14EC] border-t-transparent rounded-full animate-spin mr-2"></div>
                  생성 중...
                </>
              ) : (
                '다시 생성하기'
              )}
            </Button>
          </div>

        </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 bg-white">
        <div className="px-8 py-4 flex justify-center items-center" style={{ gap: '400px' }}>
          <Button
            onClick={handleGoBack}
            variant="outline"
            style={{ width: '200px' }}
            className="py-3 rounded-full border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
          >
            이전
          </Button>
          <Button
            onClick={handleSelectCharacter}
            disabled={selectedCharacter === null}
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
