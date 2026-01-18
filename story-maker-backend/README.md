# Story Maker Backend

FastAPI backend for the Story Maker application. Provides REST API endpoints for AI-powered story generation, character creation, scene image generation, and video generation.

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure your API keys:

```env
# OpenAI for story/prompt generation
OPENAI_API_KEY=your_openai_api_key

# KIE AI for all image and video generation
# Get API key from: https://kie.ai/api-key
# Powers:
#   - Nano Banana (text-to-image)
#   - Nano Banana Edit (image-to-image)
#   - Kling v2-1-pro (image-to-video)
KIE_API_KEY=your_kie_api_key
```

### 3. Run the Server

**Development:**
```bash
uvicorn main:app --reload
```

**Production:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## User Flow & API Endpoints

The API follows a step-by-step workflow:cc

**User selects:** Style → Theme → (Optional) Additional details → Narration voice → Scene count

### Step 1: Style & Theme Selection
- `POST /api/style-theme/save` - Save user's style and theme selections
  - Request: `{ style: string, themes: string[], custom_theme?: string }`
  - Response: `{ status, message }`

**User chooses:** Upload image OR Generate with AI

### Step 2: Character Details (For AI Generation)
- `POST /api/character/details` - Process character details
  - Request: `{ name: string, character_type: string, personality: string, style: string }`
  - Response: `{ status, character_description }`

### Step 3A: Character Generation (AI) - 2 Options
- `POST /api/character/generate` - Generate 2 character options using **Nano Banana**
  - Request: `{ character_description: string, style: string }`
  - Response: `{ characters: [{ id, url, prompt }], status }`
  - **Model**: Nano Banana (text-to-image)

### Step 3B: Character Upload (Alternative)
- `POST /api/character/upload` - Upload character image
  - Request: FormData with file
  - Response: `{ character_url, status }`

- `POST /api/character/convert-style` - **Style Conversion for Uploaded Images**
  - Request: `{ image_url: string, style: string }`
  - Response: `{ converted_image_url, status }`
  - **Model**: Nano Banana Edit (image-to-image)
  - **Purpose**: Converts uploaded photos to match the selected art style
  - **Example**: User uploads realistic photo but selected "ghibli animation" → converts photo to Ghibli style
  - **Critical**: Prevents style mismatch between character (realistic) and backgrounds (animated)
  - **When to use**: ALWAYS call after upload if style differs from uploaded image

- `GET /uploads/{session_id}/{filename}` - Serve uploaded images

### Step 4: Story Script Generation
- `POST /api/story/generate-script` - Generate cohesive narration script with third-person narrator
  - Request: `{ character_name, character_type, personality, themes, custom_theme?, num_scenes, style }`
  - Response: `{ story_title, scenes: [{ scene_number, scene_type, script_text }], status }`
  - **Note**: Third-person narrator voice, all lines flow together as one continuous story
  - **Scene Types**:
    - `main_character` - Character appears (uses img2img)
    - `scenery` - Environment only (uses txt2img)

### Step 5: Image Prompt Generation
- `POST /api/prompts/image` - Generate image prompts for all scenes
  - Request: `{ scenes: SceneLine[], character_name, style }`
  - Response: `{ prompts: [{ scene_number, prompt, scene_type }], status }`
  - **Note**: All prompts include user-selected style for consistency

### Step 6: Video Prompt Generation
- `POST /api/prompts/video` - Generate video motion prompts
  - Request: `{ scenes: SceneLine[], style }`
  - Response: `{ prompts: [{ scene_number, prompt }], status }`

### Step 7: Scene Image Generation
- `POST /api/scenes/generate-images` - Generate scene images
  - Request: `{ image_prompts: ImagePrompt[], character_image_url, style }`
  - Response: `{ scene_images: string[], status }`
  - **Models**:
    - Main character scenes → **Nano Banana Edit** (img2img with character reference)
    - Scenery scenes → **Nano Banana** (txt2img, no character)

### Step 8: Video Generation
- `POST /api/videos/generate` - Generate videos from scene images using **Kling 2.1 Pro**
  - Request: `{ scene_images: string[], video_prompts: VideoPrompt[] }`
  - Response: `{ videos: string[], status }`
  - **Model**: Kling v2-1-pro (image-to-video)
  - **Duration**: 5 seconds per scene
  - **Features**:
    - High-quality image-to-video generation
    - Motion consistency with character reference
    - Automatic scene transitions

### Narration (To Be Implemented)
- `POST /api/narration/generate` - Generate TTS audio for scene
  - Request: `{ scene_text: string, voice: string }`
  - Response: `{ narration_url, status }`
  - **Note**: Each scene is ~30 Korean chars (~5 seconds of audio)

### Utility
- `GET /health` - Health check endpoint
- `GET /video/{session_id}/{filename}` - Serve generated video files

## Architecture

```
story-maker-backend/
├── main.py                 # FastAPI app with all endpoints
├── app/
│   ├── agents/
│   │   └── llm_agent.py   # OpenAI GPT-4 story generation
│   ├── services/
│   │   └── runpod_service.py  # RunPod image/video generation
│   └── core/
│       └── config.py      # Environment configuration
├── temp_videos/           # Temporary video storage (auto-cleanup)
├── temp_uploads/          # Temporary uploaded images
├── .env                   # Environment variables
└── requirements.txt       # Python dependencies
```

## Key Features

### Scene Classification
- **Main Character Scenes**: Character appears → uses img2img with character reference
- **Scenery Scenes**: Environment only → uses txt2img without character

### Style Consistency
- All image and video prompts include user-selected style
- Ensures consistent visual output across all scenes

### Script Constraints
- Each scene limited to ~30 Korean characters
- Fits within ~5 seconds of narration audio

### Character Options
- User can either:
  1. Upload their own character image, OR
  2. Generate 2 AI character options and choose one

## Technical Details

- **CORS Enabled**: Configured for `localhost:3000` and `localhost:3001`
- **Automatic Cleanup**: Files deleted after 24 hours
- **Async Operations**: Concurrent API calls for better performance
- **Error Handling**: Comprehensive error responses
- **File Uploads**: Supports character image uploads

## TODO

- [ ] Implement TTS (Text-to-Speech) for narration generation
- [ ] Add authentication/API keys for production
- [ ] Implement rate limiting
- [ ] Add request validation and input sanitization
- [ ] Add logging and monitoring
- [ ] Deploy to production (Railway/Heroku)
- [ ] Add progress tracking for long-running operations
- [ ] Implement webhooks for async completion notifications

## Development Notes

This backend is based on the `animation-creator` project, refactored to:
1. Work as a REST API instead of Gradio interface
2. Support step-by-step user workflow
3. Handle both uploaded and AI-generated characters
4. Enforce 30-character script limit for narration compatibility
5. Distinguish between main character and scenery scenes
