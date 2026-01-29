// API client for story-maker backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ===== Type Definitions =====

// Job management types
export interface JobResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface JobStatusResponse {
  job_id: string;
  state: 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE';
  status: string;
  progress?: {
    current: number;
    total: number;
  };
  partial_results?: any;  // Incremental results as tasks complete
  result?: any;
  error?: string;
}

export interface SceneLine {
  scene_number: number;
  scene_type: 'character' | 'scenery';
  script_text: string;
  narration_url?: string | null;  // S3 URL for the narration audio
  narration_duration?: number;     // Duration in seconds
  phonemes?: any;                  // Phoneme timing data for word-level subtitles
}

export interface ImagePrompt {
  scene_number: number;
  prompt: string;
  scene_type: string;
  characters_in_scene?: string[];  // Names of ALL characters in this scene (main + side)
}

export interface VideoPrompt {
  scene_number: number;
  prompt: string;
}

export interface VisualBlueprintLocation {
  location_id: string;
  location_name: string;
  description: string;
  appears_in_scenes: number[];
}

export interface VisualBlueprintObject {
  object_id: string;
  object_name: string;
  description: string;
  appears_in_scenes: number[];
}

export interface VisualBlueprint {
  locations: VisualBlueprintLocation[];
  objects: VisualBlueprintObject[];
  visual_notes?: {
    time_of_day_progression?: string;
    weather?: string;
    color_palette?: string;
    overall_mood?: string;
  };
}

export interface CharacterOption {
  id: number;
  url: string;
  prompt: string;
}

// Project types
export interface ProjectScene {
  id?: string;
  project_id?: string;
  scene_number: number;
  scene_type?: string;
  script_text?: string;
  image_prompt?: string;
  video_prompt?: string;
  image_url?: string;
  video_url?: string;
  narration_url?: string;
  created_at?: string;
}

export interface Project {
  id: string;
  title?: string;
  style?: string;
  themes?: string[];
  custom_theme?: string;
  character_name?: string;
  character_type?: string;
  personality?: string;
  character_description?: string;
  character_image_url?: string;
  character_creation_method?: 'upload' | 'generate' | null;
  character_options?: CharacterOption[];
  character_prompt?: string;
  selected_character_id?: number | null;
  scene_count?: number;
  narration_voice?: string;
  final_video_url?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  scenes?: ProjectScene[];
}

export interface ProjectCreate {
  title?: string;
  style?: string;
  themes?: string[];
  custom_theme?: string;
  character_name?: string;
  character_type?: string;
  personality?: string;
  character_description?: string;
  character_image_url?: string;
  character_creation_method?: 'upload' | 'generate' | null;
  character_options?: CharacterOption[];
  character_prompt?: string;
  selected_character_id?: number | null;
  scene_count?: number;
  narration_voice?: string;
  final_video_url?: string;
  status?: string;
}

// ===== API Client =====

export const api = {
  // Health Check
  async healthCheck(): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  },

  // ===== Job Management =====
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await fetch(`${API_BASE_URL}/api/job/${jobId}`);
    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Poll a job until it completes or fails
   * @param jobId - The job ID to poll
   * @param onProgress - Callback function called on each progress update (includes partial results)
   * @param pollInterval - Interval between polls in milliseconds (default: 2000ms)
   * @returns The final result when job completes
   */
  async pollJobUntilComplete<T = any>(
    jobId: string,
    onProgress?: (progress: { current: number; total: number; status: string; partialResults?: any }) => void,
    pollInterval: number = 2000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getJobStatus(jobId);

          if (status.state === 'PROGRESS' || status.state === 'STARTED') {
            // Job is still running, call progress callback if provided
            if (onProgress && status.progress) {
              onProgress({
                current: status.progress.current,
                total: status.progress.total,
                status: status.status,
                partialResults: status.partial_results  // Include partial results!
              });
            }
            // Continue polling
            setTimeout(poll, pollInterval);
          } else if (status.state === 'SUCCESS') {
            // Job completed successfully
            resolve(status.result as T);
          } else if (status.state === 'FAILURE') {
            // Job failed
            reject(new Error(status.error || 'Job failed'));
          } else {
            // PENDING or unknown state, continue polling
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };

      // Start polling
      poll();
    });
  },

  // ===== Get Available Voices =====
  async getVoices(): Promise<{ voices: Array<{
    voice_id: string;
    original_name: string;
    display_name: string;
    preview_script: string;
    preview_url: string;
  }>; status: string }> {
    const response = await fetch(`${API_BASE_URL}/api/voices`);
    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.statusText}`);
    }
    return response.json();
  },

  // ===== STEP 1: Style & Theme Selection =====
  async saveStyleTheme(
    style: string,
    themes: string[],
    customTheme: string = ''
  ): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/style-theme/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ style, themes, custom_theme: customTheme }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save style/theme: ${response.statusText}`);
    }

    return response.json();
  },

  // ===== STEP 1B: Category Data (Themes, Voice, Scene Count) =====
  async saveCategoryData(
    themes: string[],
    customTheme: string,
    voice: string,
    numScenes: number
  ): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/category/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        themes,
        custom_theme: customTheme,
        voice,
        num_scenes: numScenes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save category data: ${response.statusText}`);
    }

    return response.json();
  },

  // ===== STEP 2: Character Details =====
  async saveCharacterDetails(
    name: string,
    characterType: string,
    personality: string,
    style: string
  ): Promise<{ status: string; character_description: string }> {
    const response = await fetch(`${API_BASE_URL}/api/character/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        character_type: characterType,
        personality,
        style,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save character details: ${response.statusText}`);
    }

    return response.json();
  },

  // ===== STEP 3A: Generate Character (AI) - Background Job =====
  async generateCharacter(
    characterDescription: string,
    style: string,
    themes: string[] = [],
    customTheme: string = '',
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{ characters: CharacterOption[]; status: string }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/character/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        character_description: characterDescription,
        style,
        themes,
        custom_theme: customTheme
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start character generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // ===== STEP 3B: Upload Character =====
  async uploadCharacter(file: File): Promise<{ character_url: string; status: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/character/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload character: ${response.statusText}`);
    }

    return response.json();
  },

  // ===== STEP 3C: Generate Character Variations from Upload (Background Job) =====
  async generateCharacterVariationsFromUpload(
    imageUrl: string,
    style: string,
    characterType: string,
    characterName: string,
    personality: string,
    themes: string[] = [],
    customTheme: string = '',
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{ characters: CharacterOption[]; status: string }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/character/generate-from-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        style,
        character_type: characterType,
        character_name: characterName,
        personality,
        themes,
        custom_theme: customTheme
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start character variation generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // ===== STEP 4: Generate Story Script (Background Job) =====
  async generateStoryScript(
    characterName: string,
    characterType: string,
    characterPrompt: string,
    personality: string,
    themes: string[],
    customTheme: string,
    numScenes: number,
    style: string,
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{ story_title: string; scenes: SceneLine[]; blueprint: any; status: string }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/story/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        character_name: characterName,
        character_type: characterType,
        character_prompt: characterPrompt,
        personality,
        themes,
        custom_theme: customTheme,
        num_scenes: numScenes,
        style,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start story script generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // ===== STEP 5: Generate Image Prompts =====
  async generateImagePrompts(
    scenes: SceneLine[],
    characterName: string,
    characterType: string,
    characterPrompt: string,
    style: string,
    blueprint: { scene_blueprints: any[]; side_characters: any[] },
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{ prompts: ImagePrompt[]; blueprint: any; visual_blueprint: VisualBlueprint; status: string }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/prompts/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes, character_name: characterName, character_type: characterType, character_prompt: characterPrompt, style, blueprint }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start image prompt generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // ===== STEP 6: Generate Video Prompts (Background Job) =====
  async generateVideoPrompts(
    scenes: SceneLine[],
    characterPrompt: string,
    style: string,
    blueprint: { scene_blueprints: any[]; side_characters: any[] },
    imagePrompts: ImagePrompt[],
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{ prompts: VideoPrompt[]; status: string }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/prompts/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenes,
        character_prompt: characterPrompt,
        style,
        blueprint,
        image_prompts: imagePrompts
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start video prompt generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // ===== STEP 7: Generate Scene Images (Background Job) =====
  // Generate a single scene image (for regenerate)
  async generateSingleSceneImage(
    sceneNumber: number,
    sceneType: string,
    prompt: string,
    characterImageUrl: string,
    charactersInScene: string[] = [],
    sideCharacterImages: Array<{name: string; type: string; image_url: string}> = [],
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{ image_url: string; scene_number: number; status: string }> {
    const response = await fetch(`${API_BASE_URL}/api/scene/generate-single-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_number: sceneNumber,
        scene_type: sceneType,
        prompt: prompt,
        character_image_url: characterImageUrl,
        characters_in_scene: charactersInScene,
        side_character_images: sideCharacterImages
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start single scene image generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  async generateSceneImages(
    imagePrompts: ImagePrompt[],
    characterImageUrl: string,
    style: string,
    sideCharacterImages: Array<{name: string; type: string; image_url: string}> = [],
    onProgress?: (progress: { current: number; total: number; status: string; partialResults?: any }) => void
  ): Promise<{ scene_images: string[]; status: string }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/scenes/generate-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_prompts: imagePrompts,
        character_image_url: characterImageUrl,
        style,
        side_character_images: sideCharacterImages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start scene image generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // ===== STEP 8B: Generate Side Character Images (Background Job) =====
  async generateSideCharacterImages(
    sideCharacters: Array<{name: string; type: string; description: string}>,
    style: string,
    mainCharacterImageUrl: string,
    mainCharacterPrompt?: string,
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{
    character_images: Array<{name: string; type: string; image_url: string}>;
    status: string;
  }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/side-characters/generate-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        side_characters: sideCharacters,
        style,
        main_character_image_url: mainCharacterImageUrl,
        main_character_prompt: mainCharacterPrompt
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start side character image generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // ===== STEP 8: Generate Videos (Background Job) =====
  // Generate a single video (for regenerate)
  async generateSingleVideo(
    imageUrl: string,
    prompt: string,
    sceneNumber: number,
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{ video_url: string; scene_number: number; status: string }> {
    const response = await fetch(`${API_BASE_URL}/api/video/generate-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: prompt,
        scene_number: sceneNumber
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start single video generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  async generateVideos(
    sceneImages: string[],
    videoPrompts: VideoPrompt[],
    onProgress?: (progress: { current: number; total: number; status: string; partialResults?: any }) => void
  ): Promise<{ videos: string[]; status: string }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/videos/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_images: sceneImages, video_prompts: videoPrompts }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start video generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // ===== Narration =====
  async generateNarration(
    sceneText: string,
    language: string = 'ko',
    voiceId?: string,
    style?: string,
    includePhonemes: boolean = false
  ): Promise<{
    audio_url: string;
    audio_base64?: string;
    content_type: string;
    format: string;
    status: string;
    duration_seconds?: number;
    phonemes?: {
      symbols: string[];
      start_times_seconds: number[];
      durations_seconds: number[];
    };
  }> {
    const response = await fetch(`${API_BASE_URL}/api/narration/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_text: sceneText,
        language,
        voice_id: voiceId,
        style,
        include_phonemes: includePhonemes
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate narration: ${response.statusText}`);
    }

    return response.json();
  },

  // ===== Batch Narration =====
  async generateBatchNarrations(
    scenes: SceneLine[],
    language: string = 'ko',
    voiceId?: string,
    style?: string,
    includePhonemes: boolean = false,
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{
    narrations: Array<{
      audio_url: string;
      audio_base64?: string;
      content_type: string;
      format: string;
      status: string;
      duration_seconds?: number;
      phonemes?: {
        symbols: string[];
        start_times_seconds: number[];
        durations_seconds: number[];
      };
    }>;
    status: string;
  }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/narration/generate-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenes,
        language,
        voice_id: voiceId,
        style,
        include_phonemes: includePhonemes
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start narration generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // Generate single narration for a scene
  async generateSingleNarration(
    sceneText: string,
    sceneNumber: number,
    language: string = 'ko',
    voiceId?: string,
    style?: string,
    includePhonemes: boolean = false,
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{
    audio_url: string;
    content_type: string;
    format: string;
    status: string;
    duration_seconds?: number;
    scene_number: number;
    phonemes?: {
      symbols: string[];
      start_times_seconds: number[];
      durations_seconds: number[];
    };
  }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/narration/generate-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_text: sceneText,
        scene_number: sceneNumber,
        language,
        voice_id: voiceId,
        style,
        include_phonemes: includePhonemes
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start single narration generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // Generate final video by combining all scenes with narration and subtitles (Background Job)
  async generateFinalVideo(
    scenes: {
      video_url: string;
      narration_url: string;
      subtitle_text: string;
      phonemes?: any;
      duration: number;
    }[],
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{
    final_video_url: string;
    status: string;
    duration: number;
  }> {
    // Start the job
    const response = await fetch(`${API_BASE_URL}/api/video/generate-final`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start final video generation: ${response.statusText}`);
    }

    const jobResponse: JobResponse = await response.json();

    // Poll the job until completion
    return this.pollJobUntilComplete(jobResponse.job_id, onProgress);
  },

  // ===== Projects API =====

  async createProject(data: ProjectCreate): Promise<{ id: string; status: string; project: Project }> {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to create project: ${response.statusText}`);
    }
    return response.json();
  },

  async getProjects(): Promise<{ projects: Project[] }> {
    const response = await fetch(`${API_BASE_URL}/api/projects`);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    return response.json();
  },

  async getProject(projectId: string): Promise<{ project: Project }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch project: ${response.statusText}`);
    }
    return response.json();
  },

  async updateProject(projectId: string, data: Partial<ProjectCreate>): Promise<{ id: string; status: string; project: Project }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to update project: ${response.statusText}`);
    }
    return response.json();
  },

  async deleteProject(projectId: string): Promise<{ id: string; status: string }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete project: ${response.statusText}`);
    }
    return response.json();
  },

  async saveScenes(projectId: string, scenes: ProjectScene[]): Promise<{ id: string; status: string; project: Project }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes }),
    });
    if (!response.ok) {
      throw new Error(`Failed to save scenes: ${response.statusText}`);
    }
    return response.json();
  },

  async updateScene(projectId: string, sceneNumber: number, data: Partial<ProjectScene>): Promise<{ scene_number: number; status: string; scene: ProjectScene }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/scenes/${sceneNumber}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to update scene: ${response.statusText}`);
    }
    return response.json();
  },
};

export default api;
