import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, Wand2, Image as ImageIcon, Home, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import UnicornOnly from "../imports/UnicornOnly";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useStory } from "../context/StoryContext";
import { api } from "../services/api";

interface CharacterCreationProps {
  onNext?: () => void;
  onSkipSelection?: () => void;
  onBack?: () => void;
}

export function CharacterCreation({ onNext, onSkipSelection, onBack }: CharacterCreationProps) {
  const router = useRouter();
  const story = useStory();

  const handleStartOver = () => {
    story.reset();
    router.push('/create/start');
  };

  // Use context directly for step - NO local state to avoid sync issues
  // This is the key fix: context is the single source of truth
  type Step = 'method' | 'form' | 'selection';
  const currentStep = (story.characterCreationStep || 'method') as Step;

  // Helper to change step - updates context directly
  const setCurrentStep = (step: Step) => {
    story.setCharacterCreationStep(step);
  };

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(story.selectedCharacterId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use uploaded image from context for persistence across navigation
  const uploadedImage = story.uploadedImagePreview || story.uploadedCharacterUrl;

  // Debug: Log uploaded image state on mount and changes
  useEffect(() => {
    console.log('📸 CharacterCreation mounted/updated:', {
      uploadedImagePreview: story.uploadedImagePreview,
      uploadedCharacterUrl: story.uploadedCharacterUrl,
      uploadedImage,
      characterCreationMethod: story.characterCreationMethod,
      characterCreationStep: story.characterCreationStep,
      currentStep,
    });
  }, [story.uploadedImagePreview, story.uploadedCharacterUrl, story.characterCreationMethod, story.characterCreationStep]);

  // Sync selected character from context
  useEffect(() => {
    if (story.selectedCharacterId !== null) {
      setSelectedCharacter(story.selectedCharacterId);
    }
  }, [story.selectedCharacterId]);

  // Handler to set method and save to context, then move to form step
  const handleMethodSelection = (method: "upload" | "generate") => {
    story.setCharacterCreationMethod(method);
    story.setCharacterCreationStep('form');
  };

  // Helper to get personalities array from context
  const getPersonalities = (): string[] => {
    return story.personality ? story.personality.split(", ") : [];
  };

  const characterTypes = [
    { id: "human", label: "사람", icon: "👧" },
    { id: "animal", label: "동물", icon: "🐻" },
    { id: "robot", label: "로봇 / 외계인", icon: "🤖" },
    { id: "fantasy", label: "요정 / 판타지", icon: "🧚‍♀️" },
  ];

  const personalities = [
    { id: "kind", label: "친절한" },
    { id: "brave", label: "용감한" },
    { id: "curious", label: "호기심 많은" },
    { id: "funny", label: "웃긴" },
    { id: "caring", label: "배려심 있는" },
    { id: "clever", label: "똑똑한" },
  ];

  const togglePersonality = (personalityId: string) => {
    const currentPersonalities = getPersonalities();
    let newPersonalities: string[];

    if (currentPersonalities.includes(personalityId)) {
      newPersonalities = currentPersonalities.filter(p => p !== personalityId);
    } else if (currentPersonalities.length < 3) {
      newPersonalities = [...currentPersonalities, personalityId];
    } else {
      return; // Already at max
    }

    // Save back to context immediately
    story.setPersonality(newPersonalities.join(", "));
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);

      // Show preview immediately using data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        story.setUploadedImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to S3 immediately so URL is persisted to database
      setIsUploading(true);
      try {
        const uploadResponse = await api.uploadCharacter(file);
        console.log('✅ Character uploaded to S3 immediately:', uploadResponse);

        const s3Url = uploadResponse.character_url;

        // Save S3 URL to context
        story.setUploadedCharacterUrl(s3Url);
        story.setIsCharacterUploaded(true);
        // Also update preview to S3 URL for consistency
        story.setUploadedImagePreview(s3Url);

        // Force immediate save to database with override (don't wait for debounce)
        // Pass URL directly to avoid stale closure issue
        await story.saveToDatabase({ uploadedCharacterUrl: s3Url, isCharacterUploaded: true });
        console.log('✅ Uploaded character URL saved to database:', s3Url);
      } catch (error) {
        console.error('❌ Failed to upload character to S3:', error);
        // Keep the local preview but warn user
        alert('이미지 업로드에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const generateCharacters = async () => {
    if (!story.characterName || !story.characterType || !story.personality) return;

    setIsGenerating(true);

    try {
      // Character details are already in context from direct updates

      // Step 2: Save character details to backend
      const detailsResponse = await api.saveCharacterDetails(
        story.characterName,
        story.characterType,
        story.personality,
        story.selectedStyle
      );

      console.log('✅ Character details saved:', detailsResponse);
      story.setCharacterDescription(detailsResponse.character_description);

      // Step 3: Generate 2 character options with story context
      const genResponse = await api.generateCharacter(
        detailsResponse.character_description,
        story.selectedStyle,
        story.selectedThemes,
        story.customTheme
      );

      console.log('✅ Characters generated:', genResponse);
      story.setCharacterOptions(genResponse.characters);

      // Move to selection step
      setCurrentStep('selection');
    } catch (error) {
      console.error('❌ Failed to generate characters:', error);
      alert('Failed to generate characters. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const proceedWithUpload = async () => {
    // Image should already be uploaded to S3 (done immediately on file select)
    // Just need the S3 URL to generate variations
    const characterUrl = story.uploadedCharacterUrl;

    if (!characterUrl || !story.characterType) return;

    // Don't proceed if still uploading
    if (isUploading) return;

    setIsGenerating(true);

    try {
      // Ensure personality is set
      if (!story.personality) {
        story.setPersonality("friendly");
      }

      console.log('✅ Using uploaded character URL:', characterUrl);

      // Generate 2 variations from uploaded image with style conversion
      // This creates character options just like AI generation
      const variationsResponse = await api.generateCharacterVariationsFromUpload(
        characterUrl,
        story.selectedStyle,
        story.characterType,
        story.characterName || "Character",
        story.personality,
        story.selectedThemes,
        story.customTheme
      );
      console.log('✅ Character variations generated:', variationsResponse);

      // Save character options (just like AI generation path)
      story.setCharacterOptions(variationsResponse.characters);
      story.setIsCharacterUploaded(true);

      // Move to selection step
      setCurrentStep('selection');
    } catch (error) {
      console.error('❌ Failed to process uploaded character:', error);
      alert('Failed to process uploaded character. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Character selection handlers
  const handleCharacterClick = (id: number) => {
    setSelectedCharacter(id);
    story.setSelectedCharacterId(id);
  };

  const handleSelectCharacter = () => {
    if (selectedCharacter === null) return;

    // Find the selected character and save both URL and PROMPT to context
    const selected = story.characterOptions.find(c => c.id === selectedCharacter);
    if (selected) {
      story.setSelectedCharacterId(selectedCharacter);
      story.setCharacterImageUrl(selected.url);
      story.setCharacterPrompt(selected.prompt);
      console.log('✅ Character selected:', selected.url);
      console.log('✅ Character prompt:', selected.prompt);
      if (onNext) onNext();
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);

    try {
      // Check which method was used and regenerate accordingly
      if (story.characterCreationMethod === 'upload' && story.uploadedCharacterUrl) {
        // Regenerate from uploaded image
        console.log('🔄 Regenerating from uploaded image...');
        const variationsResponse = await api.generateCharacterVariationsFromUpload(
          story.uploadedCharacterUrl,
          story.selectedStyle,
          story.characterType,
          story.characterName || "Character",
          story.personality,
          story.selectedThemes,
          story.customTheme
        );
        console.log('✅ Character variations regenerated:', variationsResponse);
        story.setCharacterOptions(variationsResponse.characters);
      } else if (story.characterCreationMethod === 'generate' && story.characterDescription) {
        // Regenerate with AI
        console.log('🔄 Regenerating with AI...');
        const genResponse = await api.generateCharacter(
          story.characterDescription,
          story.selectedStyle,
          story.selectedThemes,
          story.customTheme
        );
        console.log('✅ Characters regenerated:', genResponse);
        story.setCharacterOptions(genResponse.characters);
      } else {
        throw new Error('Missing required data for regeneration');
      }

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

  const handleBackFromSelection = () => {
    // Just go back to form step - don't clear anything
    // This allows free navigation without regenerating
    setCurrentStep('form');
  };

  const creationMethod = story.characterCreationMethod;
  const hasGeneratedCharacters = story.characterOptions && story.characterOptions.length > 0;
  const isFormValid = creationMethod === "generate" && story.characterType && story.personality;
  // Upload is valid when S3 URL is set (uploaded immediately on file select) and not currently uploading
  const isUploadValid = creationMethod === "upload" && story.uploadedCharacterUrl && story.characterType && !isUploading;

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
                <p className="text-gray-500">{currentStep === 'selection' ? "캐릭터 선택" : "캐릭터 생성"}</p>
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
        <div className="px-8 py-6 bg-white flex justify-center">

        {currentStep === 'selection' ? (
          // Step 3: Character selection
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <h2 className="text-xl text-[#6D14EC] font-medium mb-2">생성된 캐릭터</h2>
              <p className="text-sm text-gray-500 mb-12">마음에 드는 캐릭터를 선택해주세요</p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              {story.characterOptions.map((character) => (
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
        ) : currentStep === 'method' ? (
          // Step 1: Method selection
          <div className="w-full max-w-3xl">
            <div className="text-center mb-8">
              <h2 className="text-xl text-[#6D14EC] font-medium mb-2">캐릭터 생성 방법을 선택하세요</h2>
              <p className="text-sm text-gray-500">사진을 업로드하거나 AI로 생성할 수 있습니다</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <Card
                  className={`p-6 cursor-pointer transition-all duration-200 border-2 ${
                    creationMethod === "upload"
                      ? 'border-[#6D14EC] shadow-lg shadow-[#6D14EC]/30 bg-[#6D14EC]/5'
                      : 'border-gray-200 hover:border-[#6D14EC] hover:shadow-lg hover:shadow-[#6D14EC]/20'
                  }`}
                  onClick={() => handleMethodSelection("upload")}
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#6D14EC] flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-[#6D14EC] font-medium mb-1">사진 업로드</h3>
                      <p className="text-sm text-gray-600">
                        아이의 사진을 업로드하여<br />
                        캐릭터로 만들어보세요
                      </p>
                    </div>
                  </div>
                </Card>

                <Card
                  className={`p-6 cursor-pointer transition-all duration-200 border-2 ${
                    creationMethod === "generate"
                      ? 'border-[#6D14EC] shadow-lg shadow-[#6D14EC]/30 bg-[#6D14EC]/5'
                      : 'border-gray-200 hover:border-[#6D14EC] hover:shadow-lg hover:shadow-[#6D14EC]/20'
                  }`}
                  onClick={() => handleMethodSelection("generate")}
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#6D14EC] flex items-center justify-center">
                      <Wand2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-[#6D14EC] font-medium mb-1">AI 생성</h3>
                      <p className="text-sm text-gray-600">
                        AI가 캐릭터를<br />
                        자동으로 생성해드립니다
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
          </div>
        ) : currentStep === 'form' && creationMethod === "upload" ? (
          // Step 2: Upload form
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h2 className="text-xl text-[#6D14EC] font-medium mb-2">사진 업로드</h2>
              <p className="text-sm text-gray-500">아이의 사진을 업로드해주세요</p>
            </div>

            <div>
              <div className="mb-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed border-[#6D14EC]/30 rounded-xl py-6 px-6 text-center transition-all ${
                    isUploading ? 'cursor-wait opacity-70' : 'cursor-pointer hover:border-[#6D14EC] hover:bg-[#6D14EC]/5'
                  }`}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-9 h-9 text-[#6D14EC] animate-spin" />
                      <p className="text-sm text-[#6D14EC]">이미지 업로드 중...</p>
                    </div>
                  ) : uploadedImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <ImageWithFallback
                        src={uploadedImage}
                        alt="Uploaded character"
                        className="w-28 h-28 object-cover rounded-lg"
                      />
                      <p className="text-xs text-gray-600">클릭하여 다른 이미지로 변경</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <Upload className="w-9 h-9 text-gray-400" />
                      <p className="text-sm text-gray-600">클릭하여 이미지 업로드</p>
                      <p className="text-xs text-gray-400">📎 이미지는 생성 과정에만 사용됩니다.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-sm text-gray-700">캐릭터 이름 (선택사항)</label>
                <Input
                  placeholder="예: 민지, 토토"
                  value={story.characterName}
                  onChange={(e) => story.setCharacterName(e.target.value)}
                />
              </div>

              <div className="mb-8">
                <label className="block mb-3 text-sm text-gray-700">캐릭터 종류 *</label>
                <div className="grid grid-cols-2 gap-3">
                  {characterTypes.map((type) => (
                    <Card
                      key={type.id}
                      className={`p-4 cursor-pointer transition-all border-0 shadow-sm ${
                        story.characterType === type.id
                          ? 'bg-[#6D14EC] text-white shadow-md'
                          : 'bg-white hover:shadow-md'
                      }`}
                      onClick={() => story.setCharacterType(type.id)}
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-2">{type.icon}</div>
                        <div className={`text-sm ${story.characterType === type.id ? 'text-white' : 'text-gray-700'}`}>{type.label}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : currentStep === 'form' && creationMethod === "generate" ? (
          // Step 2: AI generate form
          <div className="w-full max-w-3xl">
            <div className="text-center mb-8">
              <h2 className="text-[#6D14EC] font-medium mb-2">AI 캐릭터 생성</h2>
              <p className="text-sm text-gray-500">캐릭터의 특징을 선택해주세요</p>
            </div>

            <div className="mb-6">
              <h2 className="text-[#6D14EC] font-medium mb-2">캐릭터 이름</h2>
              <Input
                placeholder="예: 민지, 토토"
                value={story.characterName}
                onChange={(e) => story.setCharacterName(e.target.value)}
              />
            </div>

            <div className="mb-6">
              <h2 className="text-[#6D14EC] font-medium mb-3">캐릭터 종류</h2>
              <div className="grid grid-cols-4 gap-3">
                {characterTypes.map((type) => (
                  <Card
                    key={type.id}
                    className={`p-4 cursor-pointer transition-all border-0 shadow-sm ${
                      story.characterType === type.id
                        ? 'bg-[#6D14EC] text-white shadow-md'
                        : 'bg-white hover:shadow-md'
                    }`}
                    onClick={() => story.setCharacterType(type.id)}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">{type.icon}</div>
                      <div className={`text-sm ${story.characterType === type.id ? 'text-white' : 'text-gray-700'}`}>{type.label}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-[#6D14EC] font-medium mb-3">
                성격 (최대 3개)
                {getPersonalities().length > 0 && (
                  <span className="ml-2">
                    {getPersonalities().length}/3 선택됨
                  </span>
                )}
              </h2>
              <div className="flex flex-wrap gap-2">
                {personalities.map((personality) => {
                  const isSelected = getPersonalities().includes(personality.id);
                  return (
                    <button
                      key={personality.id}
                      onClick={() => togglePersonality(personality.id)}
                      className={`px-6 py-1.5 rounded-full transition-all shadow-sm text-sm ${
                        isSelected
                          ? 'bg-[#6D14EC] text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {personality.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          // Fallback - shouldn't reach here
          <div>Unexpected state</div>
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
              onClick={() => {
                if (currentStep === 'selection') {
                  // Step 3 → Step 2: Back to form
                  setCurrentStep('form');
                } else if (currentStep === 'form') {
                  // Step 2 → Step 1: Back to method selection
                  setCurrentStep('method');
                } else {
                  // Step 1 → Previous route
                  onBack?.();
                }
              }}
              disabled={isGenerating || isRegenerating}
              variant="outline"
              style={{ width: '200px' }}
              className="py-3 rounded-full border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              이전
            </Button>
            <Button
              onClick={() => {
                if (currentStep === 'selection') {
                  // Step 3 → Next route: Select character and proceed
                  handleSelectCharacter();
                } else if (currentStep === 'form') {
                  // Step 2 → Step 3: Generate/upload OR just navigate if already have characters
                  if (hasGeneratedCharacters) {
                    // Already have characters, just navigate forward
                    setCurrentStep('selection');
                  } else {
                    // No characters yet, generate new ones
                    if (creationMethod === "upload") {
                      proceedWithUpload();
                    } else if (creationMethod === "generate") {
                      generateCharacters();
                    }
                  }
                } else if (currentStep === 'method') {
                  // Step 1 → Step 2: Move to form (enabled if method already selected)
                  if (creationMethod) {
                    setCurrentStep('form');
                  }
                }
              }}
              disabled={
                (currentStep === 'method' && !creationMethod) ||
                (currentStep === 'form' && !creationMethod) ||
                (currentStep === 'form' && creationMethod === "upload" && !isUploadValid) ||
                (currentStep === 'form' && creationMethod === "generate" && !isFormValid) ||
                (currentStep === 'selection' && selectedCharacter === null) ||
                isGenerating
              }
              style={{ width: '200px' }}
              className="py-3 rounded-full bg-[#6D14EC] hover:bg-[#5A0FCC] text-white disabled:bg-[#6D14EC] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{creationMethod === "upload" ? "업로드 중..." : "생성 중..."}</span>
                </div>
              ) : (
                "다음"
              )}
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
