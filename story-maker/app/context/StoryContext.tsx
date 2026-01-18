'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { SceneLine, ImagePrompt, VideoPrompt, CharacterOption, VisualBlueprint } from '../services/api';

interface StoryContextType {
  // Step 1: Style & Theme
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;
  selectedThemes: string[];
  setSelectedThemes: (themes: string[]) => void;
  customTheme: string;
  setCustomTheme: (theme: string) => void;

  // Step 2: Character Details
  characterName: string;
  setCharacterName: (name: string) => void;
  characterType: string;
  setCharacterType: (type: string) => void;
  personality: string;
  setPersonality: (personality: string) => void;
  characterDescription: string;
  setCharacterDescription: (desc: string) => void;

  // Step 3: Character Image
  characterCreationMethod: 'upload' | 'generate' | null;
  setCharacterCreationMethod: (method: 'upload' | 'generate' | null) => void;
  characterCreationStep: 'method' | 'form' | 'selection';
  setCharacterCreationStep: (step: 'method' | 'form' | 'selection') => void;
  characterImageUrl: string;
  setCharacterImageUrl: (url: string) => void;
  characterPrompt: string;
  setCharacterPrompt: (prompt: string) => void;
  isCharacterUploaded: boolean;
  setIsCharacterUploaded: (uploaded: boolean) => void;
  uploadedCharacterUrl: string;
  setUploadedCharacterUrl: (url: string) => void;
  uploadedImagePreview: string;
  setUploadedImagePreview: (preview: string) => void;
  characterOptions: CharacterOption[];
  setCharacterOptions: (options: CharacterOption[]) => void;
  selectedCharacterId: number | null;
  setSelectedCharacterId: (id: number | null) => void;

  // Step 4: Story Script
  storyTitle: string;
  setStoryTitle: (title: string) => void;
  scenes: SceneLine[];
  setScenes: (scenes: SceneLine[]) => void;
  sceneCount: number;
  setSceneCount: (count: number) => void;

  // Step 5-6: Prompts
  imagePrompts: ImagePrompt[];
  setImagePrompts: (prompts: ImagePrompt[]) => void;
  videoPrompts: VideoPrompt[];
  setVideoPrompts: (prompts: VideoPrompt[]) => void;
  visualBlueprint: VisualBlueprint | null;
  setVisualBlueprint: (blueprint: VisualBlueprint | null) => void;

  // Step 7-8: Generated Assets
  sceneImages: string[];
  setSceneImages: (images: string[] | ((prev: string[]) => string[])) => void;
  videos: string[];
  setVideos: (videos: string[] | ((prev: string[]) => string[])) => void;
  sideCharacterImages: Array<{name: string; type: string; image_url: string}>;
  setSideCharacterImages: (images: Array<{name: string; type: string; image_url: string}>) => void;

  // Narration voice
  narrationVoice: string;
  setNarrationVoice: (voice: string) => void;

  // Story generation signature (to detect changes)
  storySignature: string;
  setStorySignature: (signature: string) => void;

  // Final video
  finalVideoUrl: string;
  setFinalVideoUrl: (url: string) => void;

  // Navigation tracking
  lastVisitedPage: string;
  setLastVisitedPage: (page: string) => void;

  // Helper to clear generated content when inputs change
  clearGeneratedContent: () => void;

  // Force immediate save to localStorage (bypasses debounce)
  forceSave: () => void;

  // Reset function
  reset: () => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

const STORAGE_KEY = 'story-maker-data';

export function StoryProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage
  const [isHydrated, setIsHydrated] = useState(false);

  // Step 1: Style & Theme
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [customTheme, setCustomTheme] = useState('');

  // Step 2: Character Details
  const [characterName, setCharacterName] = useState('');
  const [characterType, setCharacterType] = useState('');
  const [personality, setPersonality] = useState('');
  const [characterDescription, setCharacterDescription] = useState('');

  // Step 3: Character Image
  const [characterCreationMethod, setCharacterCreationMethod] = useState<'upload' | 'generate' | null>(null);
  const [characterCreationStep, setCharacterCreationStep] = useState<'method' | 'form' | 'selection'>('method');
  const [characterImageUrl, setCharacterImageUrl] = useState('');
  const [characterPrompt, setCharacterPrompt] = useState('');
  const [isCharacterUploaded, setIsCharacterUploaded] = useState(false);
  const [uploadedCharacterUrl, setUploadedCharacterUrl] = useState('');
  const [uploadedImagePreview, setUploadedImagePreview] = useState('');
  const [characterOptions, setCharacterOptions] = useState<CharacterOption[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

  // Step 4: Story Script
  const [storyTitle, setStoryTitle] = useState('');
  const [scenes, setScenes] = useState<SceneLine[]>([]);
  const [sceneCount, setSceneCount] = useState(6);

  // Step 5-6: Prompts
  const [imagePrompts, setImagePrompts] = useState<ImagePrompt[]>([]);
  const [videoPrompts, setVideoPrompts] = useState<VideoPrompt[]>([]);
  const [visualBlueprint, setVisualBlueprint] = useState<VisualBlueprint | null>(null);

  // Step 7-8: Generated Assets
  const [sceneImages, setSceneImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [sideCharacterImages, setSideCharacterImages] = useState<Array<{name: string; type: string; image_url: string}>>([]);

  // Narration voice
  const [narrationVoice, setNarrationVoice] = useState('auto');

  // Story generation signature
  const [storySignature, setStorySignature] = useState('');

  // Final video
  const [finalVideoUrl, setFinalVideoUrl] = useState('');

  // Navigation tracking
  const [lastVisitedPage, setLastVisitedPage] = useState('/create/start');

  // Helper to clear generated content when inputs change
  const clearGeneratedContent = () => {
    setStoryTitle('');
    setScenes([]);
    setImagePrompts([]);
    setVideoPrompts([]);
    setVisualBlueprint(null);
    setSceneImages([]);
    setVideos([]);
    setSideCharacterImages([]);
    setStorySignature('');
    setFinalVideoUrl('');
  };

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setSelectedStyle(data.selectedStyle || '');
        setSelectedThemes(data.selectedThemes || []);
        setCustomTheme(data.customTheme || '');
        setCharacterName(data.characterName || '');
        setCharacterType(data.characterType || '');
        setPersonality(data.personality || '');
        setCharacterDescription(data.characterDescription || '');
        setCharacterCreationMethod(data.characterCreationMethod ?? null);
        setCharacterCreationStep(data.characterCreationStep || 'method');
        setCharacterImageUrl(data.characterImageUrl || '');
        setCharacterPrompt(data.characterPrompt || '');
        setIsCharacterUploaded(data.isCharacterUploaded || false);
        setUploadedCharacterUrl(data.uploadedCharacterUrl || '');
        setUploadedImagePreview(data.uploadedImagePreview || '');
        setCharacterOptions(data.characterOptions || []);
        setSelectedCharacterId(data.selectedCharacterId ?? null);
        setStoryTitle(data.storyTitle || '');
        setScenes(data.scenes || []);
        setSceneCount(data.sceneCount || 5);
        setImagePrompts(data.imagePrompts || []);
        setVideoPrompts(data.videoPrompts || []);
        setVisualBlueprint(data.visualBlueprint || null);
        setSceneImages(data.sceneImages || []);
        setVideos(data.videos || []);
        setSideCharacterImages(data.sideCharacterImages || []);
        console.log('📂 Loaded from localStorage:');
        console.log('  - sceneImages:', data.sceneImages?.length || 0, JSON.stringify(data.sceneImages));
        console.log('  - videos:', data.videos?.length || 0, JSON.stringify(data.videos));
        console.log('  - scenes:', data.scenes?.length || 0);
        setNarrationVoice(data.narrationVoice || 'auto');
        setStorySignature(data.storySignature || '');
        setFinalVideoUrl(data.finalVideoUrl || '');
        setLastVisitedPage(data.lastVisitedPage || '/create/start');
      } catch (error) {
        console.error('Error loading saved story data:', error);
      }
    }
    setIsHydrated(true);
  }, []);

  // Dependency watchers - auto-invalidate downstream data when upstream changes
  // Initialize refs with current state to avoid false triggers on hydration
  const prevStyleRef = useRef(selectedStyle);
  const prevThemesRef = useRef(selectedThemes);
  const prevCustomThemeRef = useRef(customTheme);
  const prevCharacterCreationMethodRef = useRef(characterCreationMethod);
  const prevCharacterNameRef = useRef(characterName);
  const prevCharacterTypeRef = useRef(characterType);
  const prevPersonalityRef = useRef(personality);
  const prevCharacterPromptRef = useRef(characterPrompt);
  const prevSceneCountRef = useRef(sceneCount);

  // Update refs after hydration to prevent false invalidation triggers
  useEffect(() => {
    if (isHydrated) {
      prevStyleRef.current = selectedStyle;
      prevThemesRef.current = selectedThemes;
      prevCustomThemeRef.current = customTheme;
      prevCharacterCreationMethodRef.current = characterCreationMethod;
      prevCharacterNameRef.current = characterName;
      prevCharacterTypeRef.current = characterType;
      prevPersonalityRef.current = personality;
      prevCharacterPromptRef.current = characterPrompt;
      prevSceneCountRef.current = sceneCount;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]); // Run once after hydration completes - intentionally omit state deps

  useEffect(() => {
    if (!isHydrated) return; // Skip during initial load

    // Style changed → clear character and all generated content
    if (prevStyleRef.current && prevStyleRef.current !== selectedStyle) {
      console.log('🔄 Style changed - invalidating character and story');
      setCharacterOptions([]);
      setCharacterImageUrl('');
      setCharacterPrompt('');
      setSelectedCharacterId(null);
      clearGeneratedContent();
    }
    prevStyleRef.current = selectedStyle;
  }, [selectedStyle, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;

    // Theme changed → clear character and all generated content
    const themesChanged = JSON.stringify(prevThemesRef.current) !== JSON.stringify(selectedThemes);
    const customThemeChanged = prevCustomThemeRef.current !== customTheme;

    // Clear character if themes changed AND character exists
    if (themesChanged && characterImageUrl) {
      console.log('🔄 Themes changed - invalidating character and story');
      setCharacterOptions([]);
      setCharacterImageUrl('');
      setCharacterPrompt('');
      setSelectedCharacterId(null);
      setCharacterCreationMethod(null);
      setCharacterCreationStep('method');
      clearGeneratedContent();
    }

    // Clear character if custom theme changed AND character exists
    if (customThemeChanged && characterImageUrl) {
      console.log('🔄 Custom theme changed - invalidating character and story');
      setCharacterOptions([]);
      setCharacterImageUrl('');
      setCharacterPrompt('');
      setSelectedCharacterId(null);
      setCharacterCreationMethod(null);
      setCharacterCreationStep('method');
      clearGeneratedContent();
    }

    prevThemesRef.current = selectedThemes;
    prevCustomThemeRef.current = customTheme;
  }, [selectedThemes, customTheme, isHydrated, characterImageUrl]);

  useEffect(() => {
    if (!isHydrated) return;

    // Character creation method changed → clear character options and method-specific data
    if (prevCharacterCreationMethodRef.current !== null && prevCharacterCreationMethodRef.current !== characterCreationMethod) {
      console.log('🔄 Character creation method changed - invalidating character options');
      setCharacterOptions([]);
      setCharacterImageUrl('');
      setCharacterPrompt('');
      setSelectedCharacterId(null);
      setUploadedCharacterUrl('');  // Clear uploaded image URL
      setUploadedImagePreview('');  // Clear uploaded image preview
      setIsCharacterUploaded(false);  // Clear upload flag
      setCharacterDescription('');  // Clear AI generation description
    }

    prevCharacterCreationMethodRef.current = characterCreationMethod;
  }, [characterCreationMethod, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;

    // Character details changed → clear character options (but keep character creation method)
    const nameChanged = prevCharacterNameRef.current !== characterName;
    const typeChanged = prevCharacterTypeRef.current !== characterType;
    const personalityChanged = prevPersonalityRef.current !== personality;

    if (prevCharacterNameRef.current && nameChanged) {
      console.log('🔄 Character name changed - invalidating character options');
      setCharacterOptions([]);
      setCharacterImageUrl('');
      setCharacterPrompt('');
      setSelectedCharacterId(null);
    }

    if (prevCharacterTypeRef.current && typeChanged) {
      console.log('🔄 Character type changed - invalidating character options');
      setCharacterOptions([]);
      setCharacterImageUrl('');
      setCharacterPrompt('');
      setSelectedCharacterId(null);
    }

    if (prevPersonalityRef.current && personalityChanged) {
      console.log('🔄 Character personality changed - invalidating character options');
      setCharacterOptions([]);
      setCharacterImageUrl('');
      setCharacterPrompt('');
      setSelectedCharacterId(null);
    }

    prevCharacterNameRef.current = characterName;
    prevCharacterTypeRef.current = characterType;
    prevPersonalityRef.current = personality;
  }, [characterName, characterType, personality, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;

    // Character changed → clear all story generation
    if (prevCharacterPromptRef.current && prevCharacterPromptRef.current !== characterPrompt) {
      console.log('🔄 Character changed - invalidating story generation');
      clearGeneratedContent();
    }
    prevCharacterPromptRef.current = characterPrompt;
  }, [characterPrompt, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;

    // Scene count changed → clear story generation
    if (prevSceneCountRef.current && prevSceneCountRef.current !== sceneCount) {
      console.log('🔄 Scene count changed - invalidating story generation');
      clearGeneratedContent();
    }
    prevSceneCountRef.current = sceneCount;
  }, [sceneCount, isHydrated]);

  // Debounced save to localStorage
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!isHydrated) return; // Don't save during initial hydration

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce localStorage writes for better performance
    saveTimeoutRef.current = setTimeout(() => {
      const data = {
        selectedStyle,
        selectedThemes,
        customTheme,
        characterName,
        characterType,
        personality,
        characterDescription,
        characterCreationMethod,
        characterCreationStep,
        characterImageUrl,
        characterPrompt,
        isCharacterUploaded,
        uploadedCharacterUrl,
        uploadedImagePreview,
        characterOptions,
        selectedCharacterId,
        storyTitle,
        scenes,
        sceneCount,
        imagePrompts,
        videoPrompts,
        visualBlueprint,
        sceneImages,
        videos,
        sideCharacterImages,
        narrationVoice,
        storySignature,
        finalVideoUrl,
        lastVisitedPage,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('💾 Saved to localStorage');
    }, 300); // 300ms debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    isHydrated,
    selectedStyle,
    selectedThemes,
    customTheme,
    characterName,
    characterType,
    personality,
    characterDescription,
    characterCreationMethod,
    characterCreationStep,
    characterImageUrl,
    characterPrompt,
    isCharacterUploaded,
    uploadedCharacterUrl,
    uploadedImagePreview,
    characterOptions,
    selectedCharacterId,
    storyTitle,
    scenes,
    sceneCount,
    imagePrompts,
    videoPrompts,
    visualBlueprint,
    sceneImages,
    videos,
    sideCharacterImages,
    narrationVoice,
    storySignature,
    finalVideoUrl,
    lastVisitedPage,
  ]);

  // Force immediate save to localStorage (bypasses debounce)
  const forceSave = useCallback(() => {
    const data = {
      selectedStyle,
      selectedThemes,
      customTheme,
      characterName,
      characterType,
      personality,
      characterDescription,
      characterCreationMethod,
      characterCreationStep,
      characterImageUrl,
      characterPrompt,
      isCharacterUploaded,
      uploadedCharacterUrl,
      uploadedImagePreview,
      characterOptions,
      selectedCharacterId,
      storyTitle,
      scenes,
      sceneCount,
      imagePrompts,
      videoPrompts,
      sceneImages,
      videos,
      sideCharacterImages,
      narrationVoice,
      storySignature,
      finalVideoUrl,
      lastVisitedPage,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('💾 Force saved to localStorage - videos:', videos.length, 'sceneImages:', sceneImages.length);
  }, [
    selectedStyle,
    selectedThemes,
    customTheme,
    characterName,
    characterType,
    personality,
    characterDescription,
    characterCreationMethod,
    characterCreationStep,
    characterImageUrl,
    characterPrompt,
    isCharacterUploaded,
    uploadedCharacterUrl,
    uploadedImagePreview,
    characterOptions,
    selectedCharacterId,
    storyTitle,
    scenes,
    sceneCount,
    imagePrompts,
    videoPrompts,
    visualBlueprint,
    sceneImages,
    videos,
    sideCharacterImages,
    narrationVoice,
    storySignature,
    finalVideoUrl,
    lastVisitedPage,
  ]);

  const reset = () => {
    setSelectedStyle('');
    setSelectedThemes([]);
    setCustomTheme('');
    setCharacterName('');
    setCharacterType('');
    setPersonality('');
    setCharacterDescription('');
    setCharacterCreationMethod(null);
    setCharacterCreationStep('method');
    setCharacterImageUrl('');
    setCharacterPrompt('');
    setIsCharacterUploaded(false);
    setUploadedCharacterUrl('');
    setUploadedImagePreview('');
    setCharacterOptions([]);
    setSelectedCharacterId(null);
    setStoryTitle('');
    setScenes([]);
    setSceneCount(5);
    setImagePrompts([]);
    setVideoPrompts([]);
    setVisualBlueprint(null);
    setSceneImages([]);
    setVideos([]);
    setSideCharacterImages([]);
    setNarrationVoice('auto');
    setStorySignature('');
    setFinalVideoUrl('');
    setLastVisitedPage('/create/start');

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <StoryContext.Provider
      value={{
        selectedStyle,
        setSelectedStyle,
        selectedThemes,
        setSelectedThemes,
        customTheme,
        setCustomTheme,
        characterName,
        setCharacterName,
        characterType,
        setCharacterType,
        personality,
        setPersonality,
        characterDescription,
        setCharacterDescription,
        characterCreationMethod,
        setCharacterCreationMethod,
        characterCreationStep,
        setCharacterCreationStep,
        characterImageUrl,
        setCharacterImageUrl,
        characterPrompt,
        setCharacterPrompt,
        isCharacterUploaded,
        setIsCharacterUploaded,
        uploadedCharacterUrl,
        setUploadedCharacterUrl,
        uploadedImagePreview,
        setUploadedImagePreview,
        characterOptions,
        setCharacterOptions,
        selectedCharacterId,
        setSelectedCharacterId,
        storyTitle,
        setStoryTitle,
        scenes,
        setScenes,
        sceneCount,
        setSceneCount,
        imagePrompts,
        setImagePrompts,
        videoPrompts,
        setVideoPrompts,
        visualBlueprint,
        setVisualBlueprint,
        sceneImages,
        setSceneImages,
        videos,
        setVideos,
        sideCharacterImages,
        setSideCharacterImages,
        narrationVoice,
        setNarrationVoice,
        storySignature,
        setStorySignature,
        finalVideoUrl,
        setFinalVideoUrl,
        lastVisitedPage,
        setLastVisitedPage,
        clearGeneratedContent,
        forceSave,
        reset,
      }}
    >
      {children}
    </StoryContext.Provider>
  );
}

export function useStory() {
  const context = useContext(StoryContext);
  if (context === undefined) {
    throw new Error('useStory must be used within a StoryProvider');
  }
  return context;
}
