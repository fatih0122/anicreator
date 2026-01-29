'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { SceneLine, ImagePrompt, VideoPrompt, CharacterOption, VisualBlueprint, Project, ProjectScene } from '../services/api';
import api from '../services/api';

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

  // Current step tracking (for project resume)
  currentStep: string;
  setCurrentStep: (step: string) => void;

  // Helper to clear generated content when inputs change
  clearGeneratedContent: () => void;

  // Project persistence
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  loadFromProject: (project: Project) => void;
  saveToDatabase: (overrides?: { uploadedCharacterUrl?: string; isCharacterUploaded?: boolean }) => Promise<void>;
  isLoadingProject: boolean;  // Flag to indicate project is being loaded (skip regeneration)

  // Reset function
  reset: () => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export function StoryProvider({ children }: { children: ReactNode }) {
  // Hydration flag to prevent SSR issues
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

  // Current step tracking (for project resume)
  const [currentStep, setCurrentStep] = useState<string>('style');

  // Project persistence
  const [projectId, setProjectId] = useState<string | null>(null);

  // Flag to prevent cascade invalidation during project load
  const isLoadingProjectRef = useRef(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

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

  // Mark as hydrated on mount - database is the single source of truth
  useEffect(() => {
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
    if (!isHydrated || isLoadingProjectRef.current) return; // Skip during initial load or project load

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
    if (!isHydrated || isLoadingProjectRef.current) return; // Skip during project load

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
    if (!isHydrated || isLoadingProjectRef.current) return; // Skip during project load

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
    if (!isHydrated || isLoadingProjectRef.current) return; // Skip during project load

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
    if (!isHydrated || isLoadingProjectRef.current) return; // Skip during project load

    // Character changed → clear all story generation
    if (prevCharacterPromptRef.current && prevCharacterPromptRef.current !== characterPrompt) {
      console.log('🔄 Character changed - invalidating story generation');
      clearGeneratedContent();
    }
    prevCharacterPromptRef.current = characterPrompt;
  }, [characterPrompt, isHydrated]);

  useEffect(() => {
    if (!isHydrated || isLoadingProjectRef.current) return; // Skip during project load

    // Scene count changed → clear story generation
    if (prevSceneCountRef.current && prevSceneCountRef.current !== sceneCount) {
      console.log('🔄 Scene count changed - invalidating story generation');
      clearGeneratedContent();
    }
    prevSceneCountRef.current = sceneCount;
  }, [sceneCount, isHydrated]);

  // Load project data from database
  const loadFromProject = useCallback((project: Project) => {
    console.log('📂 Loading project from database:', project.id);

    // PREVENT cascade invalidation during project load
    isLoadingProjectRef.current = true;
    setIsLoadingProject(true);

    // FULL STATE RESET before loading new project data
    // This prevents any mixing between projects
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
    setSceneCount(6);
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
    setCurrentStep('style');

    // Now load the project data
    setProjectId(project.id);
    setSelectedStyle(project.style || '');
    setSelectedThemes(project.themes || []);
    setCustomTheme(project.custom_theme || '');
    setCharacterName(project.character_name || '');
    setCharacterType(project.character_type || '');
    setPersonality(project.personality || '');
    setCharacterDescription(project.character_description || '');
    setCharacterImageUrl(project.character_image_url || '');
    setSceneCount(project.scene_count || 6);
    setNarrationVoice(project.narration_voice || 'auto');
    setStoryTitle(project.title || '');
    setFinalVideoUrl(project.final_video_url || '');
    setCurrentStep(project.current_step || 'style');

    // Load scenes
    if (project.scenes && project.scenes.length > 0) {
      // Sort scenes by scene_number first to ensure consistent ordering
      const sortedScenes = [...project.scenes].sort((a, b) => a.scene_number - b.scene_number);

      // Convert ProjectScene to SceneLine format
      const sceneLines: SceneLine[] = sortedScenes.map(s => ({
        scene_number: s.scene_number,
        scene_type: (s.scene_type as 'character' | 'scenery') || 'character',
        script_text: s.script_text || '',
        narration_url: s.narration_url || null,
      }));
      setScenes(sceneLines);

      // Load scene images (using sorted array for consistent indexing)
      const images = sortedScenes.map(s => s.image_url || '');
      setSceneImages(images);
      console.log('📷 Loaded scene images from database:', images.filter(img => img).length, 'of', images.length);

      // Load scene videos (using sorted array for consistent indexing)
      const vids = sortedScenes.map(s => s.video_url || '');
      setVideos(vids);
      console.log('🎬 Loaded scene videos from database:', vids.filter(v => v).length, 'of', vids.length);

      // Load image prompts
      const imgPrompts: ImagePrompt[] = sortedScenes
        .filter(s => s.image_prompt)
        .map(s => ({
          scene_number: s.scene_number,
          prompt: s.image_prompt || '',
          scene_type: s.scene_type || 'character',
        }));
      setImagePrompts(imgPrompts);

      // Load video prompts
      const vidPrompts: VideoPrompt[] = sortedScenes
        .filter(s => s.video_prompt)
        .map(s => ({
          scene_number: s.scene_number,
          prompt: s.video_prompt || '',
        }));
      setVideoPrompts(vidPrompts);
    }

    // Load character creation state - ALWAYS set values to prevent stale state
    // Use explicit values or defaults, don't skip with conditions
    setCharacterCreationMethod(project.character_creation_method || null);
    setCharacterOptions(project.character_options || []);
    setCharacterPrompt(project.character_prompt || '');
    setSelectedCharacterId(project.selected_character_id ?? null);

    // Load character uploaded state - ALWAYS set to ensure clean state
    setIsCharacterUploaded(project.is_character_uploaded || false);
    setUploadedCharacterUrl(project.uploaded_character_url || '');
    setUploadedImagePreview(project.uploaded_character_url || '');

    // Debug log for uploaded character
    console.log('📸 Loading uploaded character state:', {
      is_character_uploaded: project.is_character_uploaded,
      uploaded_character_url: project.uploaded_character_url,
      character_creation_method: project.character_creation_method,
      character_creation_step: project.character_creation_step,
    });

    // Set character creation step - use saved value or infer for backward compatibility
    if (project.character_creation_step) {
      setCharacterCreationStep(project.character_creation_step);
    } else {
      // Fallback: infer from state for backward compatibility
      if (project.character_image_url) {
        setCharacterCreationStep('selection');
      } else if (project.character_options && project.character_options.length > 0) {
        setCharacterCreationStep('selection');
      } else if (project.uploaded_character_url) {
        // If there's an uploaded image URL, user was on the upload form
        setCharacterCreationStep('form');
      } else if (project.character_name) {
        setCharacterCreationStep('form');
      } else if (project.character_creation_method) {
        setCharacterCreationStep('form');
      } else {
        setCharacterCreationStep('method');
      }
    }

    // SYNC refs to loaded values to prevent false invalidation when flag clears
    prevStyleRef.current = project.style || '';
    prevThemesRef.current = project.themes || [];
    prevCustomThemeRef.current = project.custom_theme || '';
    prevCharacterCreationMethodRef.current = project.character_creation_method || null;
    prevCharacterNameRef.current = project.character_name || '';
    prevCharacterTypeRef.current = project.character_type || '';
    prevPersonalityRef.current = project.personality || '';
    prevCharacterPromptRef.current = project.character_prompt || '';
    prevSceneCountRef.current = project.scene_count || 6;

    // CRITICAL: Compute and set the story signature from loaded project data
    // This prevents SceneGeneration from detecting a false "input change" and clearing content
    const loadedSignature = JSON.stringify({
      characterName: project.character_name || '',
      characterType: project.character_type || '',
      personality: project.personality || '',
      characterDescription: project.character_description || '',
      characterPrompt: project.character_prompt || '',
      characterImageUrl: project.character_image_url || '',
      selectedStyle: project.style || '',
      selectedThemes: project.themes || [],
      customTheme: project.custom_theme || '',
      sceneCount: project.scene_count || 6,
    });
    setStorySignature(loadedSignature);
    console.log('📝 Set story signature from loaded project');

    // RE-ENABLE invalidation after state settles
    queueMicrotask(() => {
      isLoadingProjectRef.current = false;
      console.log('✅ Project loaded, invalidation re-enabled');
    });

    // Clear the loading state after a short delay to allow components to read it
    setTimeout(() => {
      setIsLoadingProject(false);
      console.log('✅ isLoadingProject cleared');
    }, 500);
  }, []);

  // Save current state to database
  // Accepts optional overrides for values that may have just been set (to avoid stale closure)
  const saveToDatabase = useCallback(async (overrides?: { uploadedCharacterUrl?: string; isCharacterUploaded?: boolean }) => {
    try {
      // Use overrides if provided (for immediate saves after state updates)
      const finalUploadedCharacterUrl = overrides?.uploadedCharacterUrl ?? uploadedCharacterUrl;
      const finalIsCharacterUploaded = overrides?.isCharacterUploaded ?? isCharacterUploaded;

      const projectData = {
        title: storyTitle || (characterName ? `${characterName}의 이야기` : undefined),
        style: selectedStyle,
        themes: selectedThemes,
        custom_theme: customTheme,
        character_name: characterName,
        character_type: characterType,
        personality: personality,
        character_description: characterDescription,
        character_image_url: characterImageUrl,
        character_creation_method: characterCreationMethod,
        character_creation_step: characterCreationStep,
        character_options: characterOptions.length > 0 ? characterOptions : undefined,
        character_prompt: characterPrompt || undefined,
        selected_character_id: selectedCharacterId,
        is_character_uploaded: finalIsCharacterUploaded,
        uploaded_character_url: finalUploadedCharacterUrl || undefined,
        scene_count: sceneCount,
        narration_voice: narrationVoice,
        final_video_url: finalVideoUrl,
        status: finalVideoUrl ? 'completed' : 'draft',
        current_step: currentStep,
      };

      console.log('📤 Saving to database with uploaded_character_url:', finalUploadedCharacterUrl);

      let savedProjectId = projectId;

      if (projectId) {
        // Update existing project
        await api.updateProject(projectId, projectData);
        console.log('📤 Updated project in database:', projectId);
      } else {
        // Create new project
        const response = await api.createProject(projectData);
        savedProjectId = response.id;
        setProjectId(response.id);
        console.log('📤 Created new project in database:', response.id);
      }

      // Save scenes if we have any
      if (savedProjectId && scenes.length > 0) {
        const scenesData: ProjectScene[] = scenes.map((scene, index) => ({
          scene_number: scene.scene_number,
          scene_type: scene.scene_type,
          script_text: scene.script_text,
          image_prompt: imagePrompts.find(p => p.scene_number === scene.scene_number)?.prompt || '',
          video_prompt: videoPrompts.find(p => p.scene_number === scene.scene_number)?.prompt || '',
          image_url: sceneImages[index] || '',
          video_url: videos[index] || '',
          narration_url: scene.narration_url || '',
        }));
        await api.saveScenes(savedProjectId, scenesData);
        console.log('📤 Saved scenes to database:', scenesData.length);
      }
    } catch (error) {
      console.error('Failed to save to database:', error);
    }
  }, [
    projectId,
    storyTitle,
    characterName,
    selectedStyle,
    selectedThemes,
    customTheme,
    characterType,
    personality,
    characterDescription,
    characterImageUrl,
    characterCreationMethod,
    characterCreationStep,
    characterOptions,
    characterPrompt,
    selectedCharacterId,
    isCharacterUploaded,
    uploadedCharacterUrl,
    sceneCount,
    narrationVoice,
    finalVideoUrl,
    currentStep,
    scenes,
    imagePrompts,
    videoPrompts,
    sceneImages,
    videos,
  ]);

  // Auto-save to database (debounced, only when we have meaningful data)
  const dbSaveTimeoutRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    if (!isHydrated) return;
    // Only save if we have at least a style selected (meaning user has started)
    if (!selectedStyle) return;

    if (dbSaveTimeoutRef.current) {
      clearTimeout(dbSaveTimeoutRef.current);
    }

    dbSaveTimeoutRef.current = setTimeout(() => {
      saveToDatabase();
    }, 2000); // 2 second debounce for database saves

    return () => {
      if (dbSaveTimeoutRef.current) {
        clearTimeout(dbSaveTimeoutRef.current);
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
    characterImageUrl,
    characterCreationMethod,
    characterCreationStep,
    characterOptions,
    characterPrompt,
    selectedCharacterId,
    isCharacterUploaded,
    uploadedCharacterUrl,
    storyTitle,
    scenes,
    sceneImages,
    videos,
    finalVideoUrl,
    saveToDatabase,
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
    setCurrentStep('style');
    setProjectId(null);
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
        currentStep,
        setCurrentStep,
        clearGeneratedContent,
        projectId,
        setProjectId,
        loadFromProject,
        saveToDatabase,
        isLoadingProject,
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
