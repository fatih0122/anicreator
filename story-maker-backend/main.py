import os
import time
import uuid
import shutil
import asyncio
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
import requests

from app.agents.llm_agent import llm_agent
from app.services.kie_service import kie_service
from app.services.s3_service import s3_service
from app.services.tts_service import SupertoneTTSService
from app.services.video_service import VideoService

# Import Celery app and tasks
from celery_config import celery_app
from celery import states
from celery.result import AsyncResult

# Import database and routers
from app.database import init_db, close_db
from app.routers.projects import router as projects_router

# --- CONSTANTS ---
TEMP_VIDEO_DIR = "temp_videos"
TEMP_UPLOAD_DIR = "temp_uploads"
os.makedirs(TEMP_VIDEO_DIR, exist_ok=True)
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)
VIDEO_TTL_SECONDS = 24 * 60 * 60
CLEANUP_INTERVAL_SECONDS = 60 * 60

# --- Pydantic Models for API ---

# Step 1: Style & Theme Selection
class StyleThemeRequest(BaseModel):
    style: str
    themes: List[str]
    custom_theme: Optional[str] = ""

class StyleThemeResponse(BaseModel):
    status: str
    message: str

# Step 2: Character Details Collection
class CharacterDetailsRequest(BaseModel):
    name: str
    character_type: str  # e.g., "동물", "사람", "로봇", etc.
    personality: str
    style: str

class CharacterDetailsResponse(BaseModel):
    status: str
    character_description: str

# Step 3: Character Generation (AI) - 2 options
class CharacterGenerateRequest(BaseModel):
    character_description: str
    style: str
    themes: Optional[List[str]] = []
    custom_theme: Optional[str] = ""

class CharacterOption(BaseModel):
    id: int
    url: str
    prompt: str

class CharacterGenerateResponse(BaseModel):
    characters: List[CharacterOption]
    status: str

# Step 4: Character Selection or Upload
class CharacterSelectRequest(BaseModel):
    character_url: str
    character_prompt: Optional[str] = ""
    is_uploaded: bool = False

# Step 5: Story Script Generation
class StoryScriptRequest(BaseModel):
    character_name: str
    character_type: str
    personality: str
    character_prompt: Optional[str] = ""  # Visual description used to generate character
    themes: List[str]
    custom_theme: Optional[str] = ""
    num_scenes: int
    style: str

class SceneLine(BaseModel):
    scene_number: int
    scene_type: str  # "main_character" or "scenery"
    script_text: str  # Max 30 Korean characters

class StoryScriptResponse(BaseModel):
    story_title: str
    scenes: List[SceneLine]
    blueprint: dict  # Pass blueprint to frontend for later agents
    status: str

# Step 6: Image Prompt Generation
class ImagePromptRequest(BaseModel):
    scenes: List[SceneLine]
    character_name: str
    character_type: str  # Type of character (animal, human, fairy, etc.)
    character_prompt: Optional[str] = ""  # Visual description used to generate character
    style: str
    blueprint: dict  # Contains scene_blueprints and side_characters (summary and arc removed for efficiency)

class ImagePrompt(BaseModel):
    scene_number: int
    prompt: str
    scene_type: str
    characters_in_scene: List[str] = []  # Names of side characters in this scene

class ImagePromptResponse(BaseModel):
    prompts: List[ImagePrompt]
    blueprint: dict  # Legacy field - kept for backwards compatibility, will contain scene_blueprints
    status: str

# Step 7: Video Prompt Generation
class VideoPromptRequest(BaseModel):
    scenes: List[SceneLine]
    character_prompt: Optional[str] = ""  # Visual description used to generate character
    style: str
    blueprint: dict  # Contains scene_blueprints and side_characters
    image_prompts: List[ImagePrompt]  # Receive image prompts for context

class VideoPrompt(BaseModel):
    scene_number: int
    prompt: str

class VideoPromptResponse(BaseModel):
    prompts: List[VideoPrompt]
    status: str

# Step 8: Scene Image Generation
class SceneImageGenerateRequest(BaseModel):
    image_prompts: List[ImagePrompt]
    character_image_url: str
    style: str
    side_character_images: List[dict] = []  # [{name: str, image_url: str}, ...]

class SceneImageResponse(BaseModel):
    scene_images: List[str]
    status: str

# Step 9: Video Generation
class VideoGenerateRequest(BaseModel):
    scene_images: List[str]
    video_prompts: List[VideoPrompt]

class VideoGenerateResponse(BaseModel):
    videos: List[str]
    status: str

# Narration
class NarrationRequest(BaseModel):
    scene_text: str
    language: str = "ko"  # 'ko', 'en', 'ja'
    voice_id: Optional[str] = None
    style: Optional[str] = None
    include_phonemes: bool = False  # Request phoneme timing for subtitles

class PhonemesData(BaseModel):
    symbols: List[str]
    start_times_seconds: List[float]
    durations_seconds: List[float]

class NarrationResponse(BaseModel):
    audio_url: str  # S3 URL for the audio file
    audio_base64: Optional[str] = None  # Optional: Include base64 for immediate playback
    content_type: str
    format: str
    status: str
    duration_seconds: Optional[float] = None  # Audio duration
    phonemes: Optional[PhonemesData] = None  # Phoneme timing data for subtitles

# --- Cleanup Task ---
async def periodic_cleanup():
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        print(f"--- Running periodic cleanup ---")
        now = time.time()
        try:
            for directory in [TEMP_VIDEO_DIR, TEMP_UPLOAD_DIR]:
                if not os.path.exists(directory):
                    continue
                for session_id in os.listdir(directory):
                    session_path = os.path.join(directory, session_id)
                    if os.path.isdir(session_path):
                        try:
                            if (now - os.path.getmtime(session_path)) > VIDEO_TTL_SECONDS:
                                shutil.rmtree(session_path)
                        except Exception as e:
                            print(f"Error cleaning {session_path}: {e}")
        except Exception as e:
            print(f"Error in cleanup task: {e}")

# --- FastAPI App Setup ---
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting up...")
    await init_db()
    print("✅ Database initialized")
    asyncio.create_task(periodic_cleanup())
    yield
    # Shutdown
    print("🛑 Shutting down...")
    await close_db()
    print("✅ Database connection closed")

app = FastAPI(lifespan=lifespan, title="Story Maker API")

# Initialize TTS service
try:
    tts_service = SupertoneTTSService()
    print("✅ Supertone TTS service initialized")
except Exception as e:
    print(f"⚠️  Supertone TTS service not available: {e}")
    tts_service = None

# Initialize Video service
video_service = VideoService(s3_service)

# CORS middleware
# Get allowed origins from environment variable or use defaults
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,https://stobee2222-v1.vercel.app"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects_router)

# --- API Endpoints ---

@app.get("/")
def root():
    return {"message": "Story Maker API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# ===== Job Management Endpoints =====

class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str

@app.get("/api/job/{job_id}")
def get_job_status(job_id: str):
    """
    Get the status of a background job
    States: PENDING, STARTED, PROGRESS, SUCCESS, FAILURE
    """
    try:
        task_result = AsyncResult(job_id, app=celery_app)

        if task_result.state == states.PENDING:
            response = {
                "job_id": job_id,
                "state": "PENDING",
                "status": "Job is waiting to start...",
                "progress": {"current": 0, "total": 1}
            }
        elif task_result.state == states.STARTED:
            response = {
                "job_id": job_id,
                "state": "STARTED",
                "status": "Job has started...",
                "progress": {"current": 0, "total": 1}
            }
        elif task_result.state == "PROGRESS":
            response = {
                "job_id": job_id,
                "state": "PROGRESS",
                "status": task_result.info.get("status", "Processing..."),
                "progress": {
                    "current": task_result.info.get("current", 0),
                    "total": task_result.info.get("total", 1)
                },
                "partial_results": task_result.info.get("partial_results", None)  # Include incremental results
            }
        elif task_result.state == states.SUCCESS:
            response = {
                "job_id": job_id,
                "state": "SUCCESS",
                "status": "Job completed successfully",
                "result": task_result.result
            }
        elif task_result.state == states.FAILURE:
            # Handle failed tasks - task_result.info contains the exception
            error_message = "Job failed"
            try:
                if isinstance(task_result.info, Exception):
                    error_message = f"{type(task_result.info).__name__}: {str(task_result.info)}"
                else:
                    error_message = str(task_result.info)
            except Exception:
                error_message = "Job failed with unknown error"

            response = {
                "job_id": job_id,
                "state": "FAILURE",
                "status": "Job failed",
                "error": error_message
            }
        else:
            response = {
                "job_id": job_id,
                "state": task_result.state,
                "status": "Unknown state"
            }

        return response
    except Exception as e:
        print(f"❌ Error getting job status for {job_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ===== Voices List =====
@app.get("/api/voices")
def get_voices():
    """Get list of all available TTS voices with preview URLs"""
    from app.config.voices import get_all_voices
    voices = get_all_voices()
    return {"voices": voices, "status": "success"}

# ===== STEP 1: Style & Theme Selection =====
@app.post("/api/style-theme/save", response_model=StyleThemeResponse)
async def save_style_theme(request: StyleThemeRequest):
    """Save user's style and theme selections"""
    try:
        # Just validate and acknowledge - we'll use this data in later steps
        return StyleThemeResponse(
            status="success",
            message=f"Style '{request.style}' and themes saved successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 1B: Category Data (Themes, Voice, Scene Count) =====
class CategoryDataRequest(BaseModel):
    themes: List[str]
    custom_theme: Optional[str] = ""
    voice: str = "auto"
    num_scenes: int = 5

class CategoryDataResponse(BaseModel):
    status: str
    message: str

@app.post("/api/category/save", response_model=CategoryDataResponse)
async def save_category_data(request: CategoryDataRequest):
    """Save category selections: themes, voice, and scene count"""
    try:
        return CategoryDataResponse(
            status="success",
            message=f"Category data saved: {len(request.themes)} themes, {request.num_scenes} scenes"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 2: Character Details Collection =====
@app.post("/api/character/details", response_model=CharacterDetailsResponse)
async def save_character_details(request: CharacterDetailsRequest):
    """Process character details and create description for generation"""
    try:
        # Create a structured character description
        character_description = f"A {request.character_type} named {request.name} with a {request.personality} personality"

        return CharacterDetailsResponse(
            status="success",
            character_description=character_description
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 3: Character Generation (2 options) - Background Job =====
@app.post("/api/character/generate", response_model=JobResponse)
async def generate_character_options(request: CharacterGenerateRequest):
    """Generate 2 character options based on description (Background Job)"""
    try:
        # Import the task
        from celery_tasks import generate_character_images_task

        # Start background job
        task = generate_character_images_task.delay(
            character_description=request.character_description,
            style=request.style,
            themes=request.themes or [],
            custom_theme=request.custom_theme or ""
        )

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message="Character generation started. Poll /api/job/{job_id} for progress."
        )
    except Exception as e:
        print(f"❌ Error starting character generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 4: Character Upload =====
@app.post("/api/character/upload")
async def upload_character_image(file: UploadFile = File(...)):
    """Upload a character image to S3"""
    try:
        # Read file content
        content = await file.read()

        # Generate unique filename
        session_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1] or ".png"
        s3_filename = f"uploads/characters/{session_id}{file_extension}"

        # Determine content type
        content_type = file.content_type or "image/png"

        # Upload to S3
        character_url = s3_service.upload_image(
            file_bytes=content,
            file_name=s3_filename,
            content_type=content_type
        )

        return {
            "character_url": character_url,
            "status": "Character image uploaded to S3 successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Note: Uploaded images are now served directly from S3, no local serving needed

# ===== STEP 4B: Generate Character Variations from Uploaded Image =====
class CharacterVariationRequest(BaseModel):
    image_url: str
    style: str
    character_type: str
    character_name: str
    personality: str
    themes: Optional[List[str]] = []
    custom_theme: Optional[str] = ""

class CharacterVariationResponse(BaseModel):
    characters: List[CharacterOption]
    status: str

@app.post("/api/character/generate-from-upload", response_model=JobResponse)
async def generate_character_variations_from_upload(request: CharacterVariationRequest):
    """
    Generate 2 character variations from an uploaded image (Background Job).
    Uses GPT-4 Vision to analyze the uploaded image, then creates clean character images.
    """
    try:
        # Import the task
        from celery_tasks import generate_character_from_upload_task

        # Start background job
        task = generate_character_from_upload_task.delay(
            image_url=request.image_url,
            style=request.style,
            character_type=request.character_type,
            character_name=request.character_name,
            personality=request.personality,
            themes=request.themes or [],
            custom_theme=request.custom_theme or ""
        )

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message="Character variation generation started. Poll /api/job/{job_id} for progress."
        )
    except Exception as e:
        print(f"❌ Error starting character variation generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 4C: Style Conversion (Legacy - kept for compatibility) =====
class StyleConversionRequest(BaseModel):
    image_url: str
    style: str

class StyleConversionResponse(BaseModel):
    converted_image_url: str
    status: str

@app.post("/api/character/convert-style", response_model=StyleConversionResponse)
async def convert_uploaded_image_style(request: StyleConversionRequest):
    """
    Convert an uploaded character image to match the selected art style.
    This ensures consistency between uploaded photos and AI-generated backgrounds.
    """
    try:
        # Generate style conversion prompt using LLM
        conversion_prompt = llm_agent.create_style_conversion_prompt(request.style)

        print(f"🎨 Style conversion prompt: {conversion_prompt}")

        # Use Nano Banana Edit (img2img) to convert the uploaded image to the selected style
        converted_image_url = await kie_service.generate_image_img2img(
            prompt=conversion_prompt,
            image_url=request.image_url,
            output_format="png",
            image_size="1:1"
        )

        return StyleConversionResponse(
            converted_image_url=converted_image_url,
            status=f"Character image converted to {request.style} style"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 5: Story Script Generation =====
@app.post("/api/story/generate-script", response_model=JobResponse)
async def generate_story_script(request: StoryScriptRequest):
    """
    Generate cohesive narration script using MULTI-AGENT SYSTEM (Background Job)
    Returns job_id immediately, poll /api/job/{job_id} for results
    Agent 1 (Story Director) → Agent 2 (Script Writer)
    """
    try:
        # Import the task
        from celery_tasks import generate_story_script_task

        # Start background job
        task = generate_story_script_task.delay(
            character_name=request.character_name,
            character_type=request.character_type,
            personality=request.personality,
            character_prompt=request.character_prompt or "",
            themes=request.themes,
            custom_theme=request.custom_theme or "",
            num_scenes=request.num_scenes,
            style=request.style
        )

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message="Story script generation started. Poll /api/job/{job_id} for progress."
        )
    except Exception as e:
        print(f"❌ Error starting story generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 6: Image Prompt Generation (Background Job) =====
@app.post("/api/prompts/image", response_model=JobResponse)
async def generate_image_prompts(request: ImagePromptRequest):
    """
    Generate image prompts using MULTI-AGENT SYSTEM (Background Job)
    Agent 3 (Visual Director) creates prompts with full story context
    """
    try:
        # Import the task
        from celery_tasks import generate_image_prompts_task

        # Format scenes for Agent 3
        scenes_with_narration = [
            {
                "scene_number": scene.scene_number,
                "scene_type": scene.scene_type,
                "narration_text": scene.script_text
            }
            for scene in request.scenes
        ]

        # Start background job
        task = generate_image_prompts_task.delay(
            scenes_with_narration=scenes_with_narration,
            character_name=request.character_name,
            character_type=request.character_type,
            character_prompt=request.character_prompt or "",
            style=request.style,
            blueprint=request.blueprint
        )

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message="Image prompt generation started. Poll /api/job/{job_id} for progress."
        )
    except Exception as e:
        print(f"❌ Error starting image prompt generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 7: Video Prompt Generation (Background Job) =====
@app.post("/api/prompts/video", response_model=JobResponse)
async def generate_video_prompts(request: VideoPromptRequest):
    """
    Generate video prompts using MULTI-AGENT SYSTEM (Background Job)
    Agent 4 (Cinematographer) creates camera movements with full context
    """
    try:
        from celery_tasks import generate_video_prompts_task

        print(f"🎥 AGENT 4: Starting video prompt generation job...")

        # Format scenes for Agent 4
        scenes_with_narration = [
            {
                "scene_number": scene.scene_number,
                "scene_type": scene.scene_type,
                "narration_text": scene.script_text
            }
            for scene in request.scenes
        ]

        # Format image prompts for Agent 4
        image_prompts_data = [
            {
                "scene_number": prompt.scene_number,
                "scene_type": prompt.scene_type,
                "image_prompt": prompt.prompt
            }
            for prompt in request.image_prompts
        ]

        # Start background task for video prompt generation
        task = generate_video_prompts_task.delay(
            scenes_with_narration=scenes_with_narration,
            character_prompt=request.character_prompt or "",
            style=request.style,
            blueprint=request.blueprint,
            image_prompts_data=image_prompts_data
        )

        print(f"✅ Video prompt generation job started: {task.id}")

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message="Video prompt generation started. Poll /api/job/{job_id} for progress."
        )
    except Exception as e:
        print(f"❌ Error starting video prompt generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 8: Scene Image Generation (Background Job) =====
class SingleSceneImageRequest(BaseModel):
    scene_number: int
    scene_type: str
    prompt: str
    character_image_url: str
    characters_in_scene: List[str] = []
    side_character_images: List[Dict[str, str]] = []

@app.post("/api/scene/generate-single-image", response_model=JobResponse)
async def generate_single_scene_image(request: SingleSceneImageRequest):
    """Generate a single scene image (Background Job)"""
    try:
        from celery_tasks import generate_single_scene_image_task

        print(f"📸 Starting single scene image generation job for scene {request.scene_number}...")

        # Start background job for single scene image
        task = generate_single_scene_image_task.delay(
            scene_number=request.scene_number,
            scene_type=request.scene_type,
            prompt=request.prompt,
            character_image_url=request.character_image_url,
            characters_in_scene=request.characters_in_scene,
            side_character_images=request.side_character_images
        )

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message=f"Scene {request.scene_number} image generation started. Poll /api/job/{{job_id}} for progress."
        )
    except Exception as e:
        print(f"❌ Error starting single scene image generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scenes/generate-images", response_model=JobResponse)
async def generate_scene_images(request: SceneImageGenerateRequest):
    """
    Generate scene images using (Background Job - DEPRECATED: Use /api/scene/generate-single-image for better UX):
    - Nano Banana Edit (img2img) for main_character scenes
    - Nano Banana (txt2img) for scenery scenes
    """
    try:
        # Import the task
        from celery_tasks import generate_scene_images_task

        # Convert ImagePrompt objects to dicts for serialization
        image_prompts_data = [
            {
                "scene_number": prompt.scene_number,
                "prompt": prompt.prompt,
                "scene_type": prompt.scene_type,
                "characters_in_scene": prompt.characters_in_scene or []
            }
            for prompt in request.image_prompts
        ]

        # Start background job
        task = generate_scene_images_task.delay(
            image_prompts=image_prompts_data,
            character_image_url=request.character_image_url,
            style=request.style,
            side_character_images=request.side_character_images or []
        )

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message="Scene image generation started. Poll /api/job/{job_id} for progress."
        )
    except Exception as e:
        print(f"❌ Error starting scene image generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 8B: Side Character Image Generation =====
class SideCharacter(BaseModel):
    name: str
    type: str
    description: str

class SideCharacterImageRequest(BaseModel):
    side_characters: List[SideCharacter]
    style: str
    main_character_image_url: str  # Use main character as style reference
    main_character_prompt: Optional[str] = ""  # Main character's visual description for style matching

class SideCharacterImageResponse(BaseModel):
    character_images: List[dict]  # [{name: str, image_url: str}, ...]
    status: str

@app.post("/api/side-characters/generate-images", response_model=JobResponse)
async def generate_side_character_images(request: SideCharacterImageRequest):
    """
    Generate images for side characters using txt2img (Background Job)
    Uses main character image as style reference via prompt
    """
    try:
        # Import the task
        from celery_tasks import generate_side_character_images_task

        # Convert SideCharacter Pydantic models to dicts for serialization
        side_characters_data = [
            {
                "name": char.name,
                "type": char.type,
                "description": char.description
            }
            for char in request.side_characters
        ]

        # Start background job
        task = generate_side_character_images_task.delay(
            side_characters=side_characters_data,
            style=request.style,
            main_character_image_url=request.main_character_image_url,
            main_character_prompt=request.main_character_prompt or ""
        )

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message="Side character generation started. Poll /api/job/{job_id} for progress."
        )
    except Exception as e:
        print(f"❌ Error starting side character generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== STEP 9: Video Generation =====
class SingleVideoRequest(BaseModel):
    image_url: str
    prompt: str
    scene_number: int

@app.post("/api/video/generate-single", response_model=JobResponse)
async def generate_single_video(request: SingleVideoRequest):
    """Generate a single video from an image with a motion prompt using Kling 2.1 Pro (Background Job)"""
    try:
        from celery_tasks import generate_single_video_task

        print(f"🎥 Starting single video generation job for scene {request.scene_number}...")

        # Start background job for single video
        task = generate_single_video_task.delay(
            image_url=request.image_url,
            prompt=request.prompt,
            scene_number=request.scene_number
        )

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message=f"Video generation started for scene {request.scene_number}. Poll /api/job/{{job_id}} for progress."
        )
    except Exception as e:
        print(f"❌ Error starting single video generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/videos/generate", response_model=JobResponse)
async def generate_videos(request: VideoGenerateRequest):
    """Generate videos from scene images with motion prompts using Kling 2.1 Pro (Background Job - DEPRECATED: Use /api/video/generate-single for better UX)"""
    try:
        if len(request.scene_images) != len(request.video_prompts):
            raise HTTPException(
                status_code=400,
                detail="Number of scene images must match number of video prompts"
            )

        # Import the task
        from celery_tasks import generate_videos_task

        # Convert VideoPrompt objects to dicts for serialization
        video_prompts_data = [
            {"scene_number": vp.scene_number, "prompt": vp.prompt}
            for vp in request.video_prompts
        ]

        # Start background job
        task = generate_videos_task.delay(
            scene_images=request.scene_images,
            video_prompts=video_prompts_data
        )

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message="Video generation started. Poll /api/job/{job_id} for progress."
        )
    except Exception as e:
        print(f"❌ Error starting video generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Narration Generation =====
@app.post("/api/narration/generate", response_model=NarrationResponse)
async def generate_narration(request: NarrationRequest):
    """Generate audio narration for a scene using Supertone TTS"""
    try:
        if not tts_service:
            raise HTTPException(
                status_code=503,
                detail="TTS service is not available. Please configure SUPERTONE_API_KEY."
            )

        print(f"🎙️  Generating narration for text: {request.scene_text[:50]}...")

        # Generate speech using Supertone
        result = await tts_service.generate_speech(
            text=request.scene_text,
            language=request.language,
            voice_id=request.voice_id,
            style=request.style,
            output_format="mp3",
            include_phonemes=request.include_phonemes
        )

        print(f"✅ Narration generated successfully")

        # Decode base64 to bytes for S3 upload
        import base64
        audio_bytes = base64.b64decode(result["audio_base64"])

        # Upload to S3
        audio_filename = f"narration_{uuid.uuid4()}.mp3"
        audio_url = s3_service.upload_audio_data(
            audio_data=audio_bytes,
            filename=audio_filename,
            folder="narrations",
            content_type="audio/mpeg"
        )

        print(f"✅ Narration uploaded to S3: {audio_url}")

        # Calculate duration from phonemes if available
        duration = None
        if "phonemes" in result and result["phonemes"]:
            phonemes = result["phonemes"]
            # Duration = last start_time + last duration
            if phonemes.get("start_times_seconds") and phonemes.get("durations_seconds"):
                duration = phonemes["start_times_seconds"][-1] + phonemes["durations_seconds"][-1]

        # Build response with S3 URL (not base64 for smaller payload)
        response_data = {
            "audio_url": audio_url,
            "content_type": result["content_type"],
            "format": result["format"],
            "status": "Narration generated successfully",
            "duration_seconds": duration
        }

        # Add phonemes if included in result
        if "phonemes" in result and result["phonemes"]:
            response_data["phonemes"] = result["phonemes"]

        return NarrationResponse(**response_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Error generating narration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Batch Narration Generation =====
class BatchNarrationRequest(BaseModel):
    scenes: List[SceneLine]
    language: str = "ko"
    voice_id: Optional[str] = None
    style: Optional[str] = None
    include_phonemes: bool = False

class BatchNarrationResponse(BaseModel):
    narrations: List[NarrationResponse]
    status: str

@app.post("/api/narration/generate-batch", response_model=JobResponse)
async def generate_batch_narrations(request: BatchNarrationRequest):
    """Generate audio narrations for multiple scenes in parallel (Background Job)"""
    try:
        from celery_tasks import generate_narrations_task

        if not tts_service:
            raise HTTPException(
                status_code=503,
                detail="TTS service is not available. Please configure SUPERTONE_API_KEY."
            )

        print(f"🎙️ Starting narration generation job for {len(request.scenes)} scenes...")

        # Format scenes for task
        scenes_data = [
            {
                "scene_number": scene.scene_number,
                "script_text": scene.script_text
            }
            for scene in request.scenes
        ]

        # Start background task
        task = generate_narrations_task.delay(
            scenes=scenes_data,
            language=request.language,
            voice_id=request.voice_id,
            style=request.style,
            include_phonemes=request.include_phonemes
        )

        print(f"✅ Narration generation job started: {task.id}")

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message="Narration generation started. Poll /api/job/{job_id} for progress."
        )

    except Exception as e:
        print(f"❌ Error starting narration generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Single Narration Generation =====
class SingleNarrationRequest(BaseModel):
    scene_text: str
    scene_number: int
    language: str = "ko"
    voice_id: Optional[str] = None
    style: Optional[str] = None
    include_phonemes: bool = False

@app.post("/api/narration/generate-single", response_model=JobResponse)
async def generate_single_narration(request: SingleNarrationRequest):
    """Generate audio narration for a single scene (Background Job)"""
    try:
        from celery_tasks import generate_single_narration_task

        if not tts_service:
            raise HTTPException(
                status_code=503,
                detail="TTS service is not available. Please configure SUPERTONE_API_KEY."
            )

        print(f"🎙️ Starting narration generation for scene {request.scene_number}...")

        # Start background task
        task = generate_single_narration_task.delay(
            scene_text=request.scene_text,
            scene_number=request.scene_number,
            language=request.language,
            voice_id=request.voice_id,
            style=request.style,
            include_phonemes=request.include_phonemes
        )

        print(f"✅ Single narration generation job started: {task.id}")

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message=f"Narration generation started for scene {request.scene_number}. Poll /api/job/{{job_id}} for progress."
        )

    except Exception as e:
        print(f"❌ Error starting single narration generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Video Serving =====
@app.get("/video/{session_id}/{filename}")
async def serve_video(session_id: str, filename: str):
    """Serve generated video files"""
    file_path = os.path.join(TEMP_VIDEO_DIR, session_id, filename)
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="video/mp4",
            headers={
                "Cache-Control": "no-cache",
                "Accept-Ranges": "bytes"
            }
        )
    raise HTTPException(status_code=404, detail="Video not found")

# ===== Final Video Generation =====
class VideoScene(BaseModel):
    video_url: str
    narration_url: str
    subtitle_text: str
    phonemes: Optional[dict] = None
    duration: float

class FinalVideoRequest(BaseModel):
    scenes: List[VideoScene]

class FinalVideoResponse(BaseModel):
    final_video_url: str
    status: str
    duration: float

@app.post("/api/video/generate-final", response_model=JobResponse)
async def generate_final_video(request: FinalVideoRequest):
    """Combine all scene videos with narration and subtitles into a single final video (Background Job)"""
    try:
        # Import the task
        from celery_tasks import generate_final_video_task

        # Convert VideoScene objects to dicts for serialization
        scenes_data = [
            {
                "video_url": scene.video_url,
                "narration_url": scene.narration_url,
                "subtitle_text": scene.subtitle_text,
                "phonemes": scene.phonemes,
                "duration": scene.duration
            }
            for scene in request.scenes
        ]

        # Start background job
        task = generate_final_video_task.delay(scenes=scenes_data)

        return JobResponse(
            job_id=task.id,
            status="PENDING",
            message="Final video generation started. Poll /api/job/{job_id} for progress."
        )

    except Exception as e:
        print(f"❌ Error starting final video generation job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Admin / Debug Endpoints =====
@app.get("/api/admin/check-tasks")
async def check_registered_tasks():
    """
    Check which Celery tasks are currently registered.
    Useful for debugging NotRegistered errors.
    """
    try:
        from celery_config import celery_app
        import celery_tasks  # Force import to ensure tasks are registered

        # Get all registered tasks
        all_tasks = sorted(celery_app.tasks.keys())

        # Filter out built-in Celery tasks
        user_tasks = [task for task in all_tasks if not task.startswith('celery.')]

        # Check for required tasks
        required_tasks = [
            "tasks.generate_story_script",
            "tasks.generate_image_prompts",
            "tasks.generate_video_prompts",
            "tasks.generate_side_character_images",
            "tasks.generate_scene_images",
            "tasks.generate_narrations",
            "tasks.generate_videos",
            "tasks.generate_final_video"
        ]

        task_status = {}
        for task_name in required_tasks:
            task_status[task_name] = task_name in celery_app.tasks

        return {
            "status": "success",
            "total_tasks": len(user_tasks),
            "user_tasks": user_tasks,
            "required_tasks_status": task_status,
            "all_required_registered": all(task_status.values())
        }
    except Exception as e:
        print(f"❌ Error checking tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/flush-redis")
async def flush_redis():
    """
    Flush Redis to clear all job queues and worker registrations.
    Use this to fix worker registration issues.
    """
    try:
        import redis
        from celery_config import REDIS_URL

        # Connect to Redis
        r = redis.from_url(REDIS_URL)

        # Flush all data
        r.flushall()

        print("✅ Redis flushed successfully")

        return {
            "status": "success",
            "message": "Redis flushed successfully. All job queues and worker registrations cleared. Restart backend to reconnect workers."
        }
    except Exception as e:
        print(f"❌ Error flushing Redis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
