import asyncio
import uuid
import base64
from celery_config import celery_app
from typing import List, Optional, Dict, Any

# Import services
from app.agents.llm_agent import llm_agent
from app.services.kie_service import kie_service
from app.services.video_service import VideoService
from app.services.s3_service import s3_service
from app.services.tts_service import SupertoneTTSService

# Initialize services
video_service = VideoService(s3_service)
tts_service = SupertoneTTSService()

print("✅ celery_tasks.py loaded successfully")


@celery_app.task(bind=True, name="tasks.generate_story_script")
def generate_story_script_task(
    self,
    character_name: str,
    character_type: str,
    personality: str,
    character_prompt: str,
    themes: List[str],
    custom_theme: str,
    num_scenes: int,
    style: str
):
    """
    Background task for story script generation
    Updates progress as it runs
    """
    try:
        # Update progress: Starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 2, "status": "Starting story generation..."}
        )

        # Prepare theme information
        # custom_theme = user's specific story idea (PRIORITY)
        # themes = generic theme suggestions (secondary)
        if custom_theme:
            themes_str = f"User's story idea: {custom_theme}"
            if themes:
                themes_str += f" | Generic theme: {', '.join(themes)}"
        else:
            themes_str = ", ".join(themes) if themes else "모험"

        blueprint_language = "English"
        narration_language = "Korean"

        # Update progress: Agent 0.5
        self.update_state(
            state="PROGRESS",
            meta={"current": 1, "total": 3, "status": "Story Planner creating complete story overview..."}
        )

        # AGENT 0.5: Create complete story summary first
        story_summary = llm_agent.create_story_summary(
            character_name=character_name,
            character_type=character_type,
            personality=personality,
            themes=themes_str,
            num_scenes=num_scenes
        )

        print(f"✅ Story summary created: {story_summary.get('story_summary', 'N/A')[:100]}...")

        # Update progress: Agent 1
        self.update_state(
            state="PROGRESS",
            meta={"current": 2, "total": 3, "status": "Story Director breaking story into scenes..."}
        )

        # AGENT 1: Create story blueprint based on the summary
        blueprint = llm_agent.create_story_blueprint(
            character_name=character_name,
            character_type=character_type,
            character_prompt=character_prompt,
            personality=personality,
            themes=themes_str,
            num_scenes=num_scenes,
            story_summary=story_summary,
            language=blueprint_language
        )

        print(f"✅ Blueprint created with {len(blueprint.get('scene_blueprints', []))} scenes")

        # Update progress: Agent 2
        self.update_state(
            state="PROGRESS",
            meta={"current": 3, "total": 3, "status": "Script Writer creating narration..."}
        )

        # AGENT 2: Write narration based on blueprint
        script_data = llm_agent.write_scene_narrations(
            blueprint=blueprint,
            character_name=character_name,
            character_type=character_type,
            character_prompt=character_prompt,
            personality=personality,
            language=narration_language
        )

        print(f"✅ Narration completed: {script_data.get('story_title', 'Untitled')}")

        # Format response
        scenes = [
            {
                "scene_number": scene.get("scene_number"),
                "scene_type": scene.get("scene_type", "character"),
                "script_text": scene.get("narration_text", "")
            }
            for scene in script_data.get("scenes", [])
        ]

        return {
            "story_title": script_data.get("story_title", "Untitled Story"),
            "scenes": scenes,
            "blueprint": blueprint,
            "status": f"Multi-agent narration: {len(scenes)} scenes with meaningful arc"
        }

    except Exception as e:
        print(f"❌ Error in story generation task: {e}")
        raise


@celery_app.task(bind=True, name="tasks.generate_single_video")
def generate_single_video_task(
    self,
    image_url: str,
    prompt: str,
    scene_number: int
):
    """
    Background task for generating a single video
    Returns the video URL when complete
    """
    try:
        print(f"🎬 Starting single video generation for scene {scene_number}...")
        print(f"🎥 Image: {image_url}")
        print(f"🎥 Prompt: {prompt}")

        # Update progress: Starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 1, "status": f"Generating video for scene {scene_number}..."}
        )

        # Generate video
        async def generate():
            return await kie_service.generate_video(
                image_url=image_url,
                prompt=prompt,
                duration="5",
                negative_prompt="blur, distort, low quality, static, frozen",
                cfg_scale=0.5
            )

        video_url = asyncio.run(generate())

        print(f"✅ Video generated successfully: {video_url}")

        return {
            "video_url": video_url,
            "scene_number": scene_number,
            "status": f"Scene {scene_number} video generated successfully"
        }

    except Exception as e:
        print(f"❌ Error generating video for scene {scene_number}: {e}")
        raise


@celery_app.task(bind=True, name="tasks.generate_videos")
def generate_videos_task(
    self,
    scene_images: List[str],
    video_prompts: List[Dict[str, Any]]
):
    """
    Background task for video generation
    Generates all videos in parallel for maximum speed
    """
    try:
        if len(scene_images) != len(video_prompts):
            raise ValueError("Number of scene images must match number of video prompts")

        total_videos = len(scene_images)

        # Update progress: Starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": total_videos, "status": "Starting video generation..."}
        )

        print(f"🎬 Generating {total_videos} videos in parallel with Kling 2.1 Pro...")

        async def generate_single_video(i: int, image_url: str, video_prompt_data: Dict[str, Any]):
            """Generate a single video"""
            try:
                print(f"🎬 Starting video {i+1}/{total_videos}...")
                print(f"🎥 Prompt: {video_prompt_data.get('prompt')}")

                video_url = await kie_service.generate_video(
                    image_url=image_url,
                    prompt=video_prompt_data.get("prompt"),
                    duration="5",
                    negative_prompt="blur, distort, low quality, static, frozen",
                    cfg_scale=0.5
                )

                print(f"✅ Video {i+1} generated successfully: {video_url}")
                return (i, video_url)  # Return index and URL

            except Exception as e:
                print(f"❌ Error generating video {i+1}: {e}")
                return (i, None)  # Return index and None for failed

        # Generate all videos in parallel and collect results as they complete
        async def generate_all_videos():
            # Initialize results array with None
            results = [None] * total_videos
            completed = 0

            # Create tasks
            tasks = [
                generate_single_video(i, image_url, video_prompt_data)
                for i, (image_url, video_prompt_data) in enumerate(zip(scene_images, video_prompts))
            ]

            # Process results as they complete
            for coro in asyncio.as_completed(tasks):
                index, video_url = await coro
                results[index] = video_url
                completed += 1

                # Update progress with partial results after each completion
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": completed,
                        "total": total_videos,
                        "status": f"Generated video {completed}/{total_videos}",
                        "partial_results": {"videos": results}  # Send partial results!
                    }
                )
                print(f"📊 Progress update: {completed}/{total_videos} videos completed")

            return results

        video_urls = asyncio.run(generate_all_videos())

        successful_count = len([v for v in video_urls if v])
        print(f"✅ All videos generated: {successful_count}/{total_videos} successful")

        return {
            "videos": video_urls,
            "status": f"Generated {successful_count}/{total_videos} videos using Kling 2.1 Pro"
        }

    except Exception as e:
        print(f"❌ Error in video generation task: {e}")
        raise


@celery_app.task(bind=True, name="tasks.generate_final_video")
def generate_final_video_task(
    self,
    scenes: List[Dict[str, Any]]
):
    """
    Background task for final video combining
    Updates progress as it processes
    """
    try:
        # Update progress: Starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 1, "status": "Combining videos with narration and subtitles..."}
        )

        print(f"🎬 Generating final video from {len(scenes)} scenes...")

        # Extract data from scenes
        video_urls = [scene["video_url"] for scene in scenes]
        narration_urls = [scene["narration_url"] for scene in scenes]
        subtitle_texts = [scene["subtitle_text"] for scene in scenes]
        phonemes_list = [scene.get("phonemes") for scene in scenes]
        durations = [scene["duration"] for scene in scenes]

        # Combine videos using async function in sync context
        async def combine_videos():
            return await video_service.combine_videos_with_narration(
                video_urls=video_urls,
                narration_urls=narration_urls,
                subtitle_texts=subtitle_texts,
                phonemes_list=phonemes_list,
                durations=durations
            )
        final_url = asyncio.run(combine_videos())

        total_duration = sum(durations)

        return {
            "final_video_url": final_url,
            "status": f"Final video generated successfully from {len(scenes)} scenes",
            "duration": total_duration
        }

    except Exception as e:
        print(f"❌ Error in final video generation task: {e}")
        raise


@celery_app.task(bind=True, name="tasks.generate_character_images")
def generate_character_images_task(
    self,
    character_description: str,
    style: str,
    themes: List[str],
    custom_theme: str
):
    """
    Background task for character image generation (2 options)
    Updates progress as it generates
    """
    try:
        # Update progress: Starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 2, "status": "Creating character prompts..."}
        )

        # Create 2 character prompts
        char_prompts = llm_agent.create_character_image_prompts(
            character_description,
            style,
            themes,
            custom_theme
        )

        # Update progress: Generating images
        self.update_state(
            state="PROGRESS",
            meta={"current": 1, "total": 2, "status": "Generating character images..."}
        )

        # Generate images concurrently
        async def generate_images():
            return await asyncio.gather(*[
                kie_service.generate_image_txt2img(
                    prompt=prompt,
                    output_format="png",
                    image_size="1:1"
                )
                for prompt in char_prompts
            ])

        image_urls = asyncio.run(generate_images())

        # Format as character options
        characters = [
            {"id": i+1, "url": image_urls[i], "prompt": char_prompts[i]}
            for i in range(len(image_urls))
        ]

        return {
            "characters": characters,
            "status": "2 character options generated successfully"
        }

    except Exception as e:
        print(f"❌ Error in character generation task: {e}")
        raise


@celery_app.task(bind=True, name="tasks.generate_character_from_upload")
def generate_character_from_upload_task(
    self,
    image_url: str,
    style: str,
    character_type: str,
    character_name: str,
    personality: str,
    themes: List[str],
    custom_theme: str
):
    """
    Background task for generating character variations from uploaded image
    """
    try:
        # Update progress: Analyzing
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 3, "status": "Analyzing uploaded image..."}
        )

        # Analyze uploaded image with GPT-4 Vision
        character_description = llm_agent.describe_uploaded_character(image_url)

        # Update progress: Creating prompts
        self.update_state(
            state="PROGRESS",
            meta={"current": 1, "total": 3, "status": "Creating style conversion prompts..."}
        )

        # Generate 2 character prompts
        char_prompts = llm_agent.create_style_conversion_prompts(style, character_description)

        # Update progress: Generating images
        self.update_state(
            state="PROGRESS",
            meta={"current": 2, "total": 3, "status": "Generating character variations..."}
        )

        # Generate images concurrently using img2img
        async def generate_variations():
            return await asyncio.gather(*[
                kie_service.generate_image_img2img(
                    prompt=prompt,
                    image_url=image_url,
                    output_format="png",
                    image_size="1:1"
                )
                for prompt in char_prompts
            ])

        image_urls = asyncio.run(generate_variations())

        # Format as character options
        characters = [
            {"id": i+1, "url": image_urls[i], "prompt": char_prompts[i]}
            for i in range(len(image_urls))
        ]

        return {
            "characters": characters,
            "status": f"Generated 2 character variations from uploaded image in {style} style"
        }

    except Exception as e:
        print(f"❌ Error in character variation generation task: {e}")
        raise


@celery_app.task(bind=True, name="tasks.generate_single_scene_image")
def generate_single_scene_image_task(
    self,
    scene_number: int,
    scene_type: str,
    prompt: str,
    character_image_url: str,
    characters_in_scene: List[str],
    side_character_images: List[Dict[str, str]]
):
    """
    Background task for generating a single scene image
    Returns the image URL when complete
    """
    try:
        print(f"📸 Starting single scene image generation for scene {scene_number}...")
        print(f"🎨 Prompt: {prompt}")
        print(f"🎭 Side characters in scene: {characters_in_scene}")

        # Update progress: Starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 1, "status": f"Generating image for scene {scene_number}..."}
        )

        # Create side character mapping
        side_char_map = {char["name"]: char["image_url"] for char in side_character_images}

        # Generate the image
        async def generate():
            if scene_type == "character":
                # Build list of reference images based on who's in the scene
                # characters_in_scene contains ALL characters (main + side)
                reference_images = []

                # Check if the scene only has side characters (no main character)
                all_are_side_characters = all(char_name in side_char_map for char_name in characters_in_scene)

                if not all_are_side_characters or len(characters_in_scene) == 0:
                    # Main character is in this scene (or scene has no characters specified)
                    # Include main character image for visual style consistency
                    reference_images.append(character_image_url)
                    print(f"🎭 Including main character in scene {scene_number}")

                # Add side character images if they appear in this scene
                for char_name in characters_in_scene:
                    if char_name in side_char_map and side_char_map[char_name]:
                        reference_images.append(side_char_map[char_name])
                        print(f"🎭 Adding side character '{char_name}' to scene {scene_number}")

                # Use img2img with character reference(s)
                return await kie_service.generate_image_img2img(
                    prompt=prompt,
                    image_urls=reference_images,
                    output_format="png",
                    image_size="16:9"
                )
            else:
                # Use txt2img for scenery (no character)
                return await kie_service.generate_image_txt2img(
                    prompt=prompt,
                    output_format="png",
                    image_size="16:9"
                )

        image_url = asyncio.run(generate())

        print(f"✅ Scene {scene_number} image generated successfully: {image_url}")

        return {
            "image_url": image_url,
            "scene_number": scene_number,
            "status": f"Scene {scene_number} image generated successfully"
        }

    except Exception as e:
        print(f"❌ Error generating image for scene {scene_number}: {e}")
        raise


@celery_app.task(bind=True, name="tasks.generate_scene_images")
def generate_scene_images_task(
    self,
    image_prompts: List[Dict[str, Any]],
    character_image_url: str,
    style: str,
    side_character_images: List[Dict[str, str]]
):
    """
    Background task for scene image generation
    Updates progress as each image completes
    """
    try:
        total_images = len(image_prompts)

        # Update progress: Starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": total_images, "status": "Starting scene image generation..."}
        )

        # Create a mapping of side character names to image URLs
        side_char_map = {char["name"]: char["image_url"] for char in side_character_images}

        print(f"📸 Generating {total_images} scene images in parallel")
        print(f"🎭 Side character image mapping: {list(side_char_map.keys())}")

        # Generate all images in parallel for speed
        async def generate_single_scene(index: int, prompt_data: Dict[str, Any]):
            try:
                scene_type = prompt_data.get("scene_type", "character")
                prompt = prompt_data.get("prompt", "")
                side_chars_in_scene = prompt_data.get("characters_in_scene", [])

                if scene_type == "character":
                    # Build list of reference images based on who's in the scene
                    # characters_in_scene contains ALL characters (main + side)
                    reference_images = []

                    # Check if the scene only has side characters (no main character)
                    all_are_side_characters = all(char_name in side_char_map for char_name in side_chars_in_scene)

                    if not all_are_side_characters or len(side_chars_in_scene) == 0:
                        # Main character is in this scene (or scene has no characters specified)
                        # Include main character image for visual style consistency
                        reference_images.append(character_image_url)
                        print(f"🎭 Including main character in scene {index+1}")

                    # Add side character images if they appear in this scene
                    for char_name in side_chars_in_scene:
                        if char_name in side_char_map and side_char_map[char_name]:
                            reference_images.append(side_char_map[char_name])
                            print(f"🎭 Adding side character '{char_name}' to scene {index+1}")
                        elif char_name in side_char_map:
                            print(f"⚠️ Skipping side character '{char_name}' in scene {index+1} - empty URL")

                    # Use img2img with character reference(s)
                    image_url = await kie_service.generate_image_img2img(
                        prompt=prompt,
                        image_urls=reference_images,
                        output_format="png",
                        image_size="16:9"
                    )
                else:
                    # Use txt2img for scenery (no character)
                    image_url = await kie_service.generate_image_txt2img(
                        prompt=prompt,
                        output_format="png",
                        image_size="16:9"
                    )

                print(f"✅ Scene {index+1} generated successfully")
                return (index, image_url)  # Return index and URL

            except Exception as e:
                print(f"❌ Error generating scene {index+1}: {e}")
                return (index, None)  # Return index and None for failed

        # Generate all images in parallel and send results as they complete
        async def generate_all_scenes():
            # Initialize results array with None
            results = [None] * total_images
            completed = 0

            # Create tasks
            tasks = [generate_single_scene(i, prompt_data) for i, prompt_data in enumerate(image_prompts)]

            # Process results as they complete
            for coro in asyncio.as_completed(tasks):
                index, image_url = await coro
                results[index] = image_url
                completed += 1

                # Update progress with partial results after each completion
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": completed,
                        "total": total_images,
                        "status": f"Generated {completed}/{total_images} scenes",
                        "partial_results": {"scene_images": results}  # Send partial results!
                    }
                )
                print(f"📊 Progress update: {completed}/{total_images} scene images completed")

            return results

        image_urls = asyncio.run(generate_all_scenes())

        return {
            "scene_images": image_urls,
            "status": f"Generated {len([url for url in image_urls if url])}/{total_images} scene images"
        }

    except Exception as e:
        print(f"❌ Error in scene image generation task: {e}")
        raise


@celery_app.task(bind=True, name="tasks.generate_side_character_images")
def generate_side_character_images_task(
    self,
    side_characters: List[Dict[str, str]],
    style: str,
    main_character_image_url: str,
    main_character_prompt: str
):
    """
    Background task for side character image generation
    Updates progress as each character completes
    """
    try:
        total_characters = len(side_characters)

        # Update progress: Starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": total_characters, "status": "Starting side character generation..."}
        )

        print(f"🎭 Generating images for {total_characters} side characters in parallel...")

        # Generate all side character images in parallel
        async def generate_single_character(index: int, character: Dict[str, str]):
            try:
                print(f"👤 Generating image for {character['name']} ({character['type']})...")

                # Use LLM agent to create detailed prompt
                prompt = llm_agent.create_side_character_image_prompt(
                    character_name=character["name"],
                    character_type=character["type"],
                    character_description=character["description"],
                    style=style,
                    main_character_prompt=main_character_prompt or ""
                )

                print(f"🎨 Side character prompt: {prompt}")

                # Generate using txt2img (1:1 square for character portraits)
                image_url = await kie_service.generate_image_txt2img(
                    prompt=prompt,
                    output_format="png",
                    image_size="1:1"
                )

                print(f"✅ Generated image for {character['name']}: {image_url}")

                # Update progress after each character completes
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": index + 1,
                        "total": total_characters,
                        "status": f"Generated {character['name']} ({index+1}/{total_characters})"
                    }
                )

                return {
                    "name": character["name"],
                    "type": character["type"],
                    "image_url": image_url
                }

            except Exception as e:
                print(f"❌ Error generating {character['name']}: {e}")
                return {
                    "name": character["name"],
                    "type": character["type"],
                    "image_url": ""
                }

        # Generate all characters in parallel
        async def generate_all_characters():
            tasks = [generate_single_character(i, char) for i, char in enumerate(side_characters)]
            return await asyncio.gather(*tasks)

        character_images = asyncio.run(generate_all_characters())

        return {
            "character_images": character_images,
            "status": f"Generated {len([c for c in character_images if c['image_url']])}/{total_characters} side character images"
        }

    except Exception as e:
        print(f"❌ Error in side character image generation task: {e}")
        raise


print("🎨 Registering tasks.generate_image_prompts")

@celery_app.task(bind=True, name="tasks.generate_image_prompts")
def generate_image_prompts_task(
    self,
    scenes_with_narration: List[Dict[str, Any]],
    character_name: str,
    character_type: str,
    character_prompt: str,
    style: str,
    blueprint: Dict[str, Any]
):
    """
    Background task for image prompt generation (AGENT 2.5 + AGENT 3)
    Agent 2.5: Creates visual asset library
    Agent 3: Composes prompts using asset library
    Updates progress as it processes
    """
    print(f"🎨 Image prompts task called with {len(scenes_with_narration)} scenes")
    try:
        total_scenes = len(scenes_with_narration)

        # Update progress: Agent 2.5 starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": total_scenes, "status": "Visual Blueprint Director analyzing story..."}
        )

        print(f"🏗️ AGENT 2.5: Visual Blueprint Director creating asset library...")

        # AGENT 2.5: Create visual blueprint (asset library)
        visual_blueprint = llm_agent.create_visual_blueprint(
            story_blueprint=blueprint,
            style=style
        )

        locations_count = len(visual_blueprint.get('locations', []))
        objects_count = len(visual_blueprint.get('objects', []))
        print(f"✅ Visual blueprint created: {locations_count} locations, {objects_count} objects")

        # Log asset library for debugging
        for loc in visual_blueprint.get('locations', []):
            print(f"📍 Location: {loc['location_name']} (scenes {loc['appears_in_scenes']})")
        for obj in visual_blueprint.get('objects', []):
            print(f"🎯 Object: {obj['object_name']} (scenes {obj['appears_in_scenes']})")

        # Update progress: Agent 3 starting
        self.update_state(
            state="PROGRESS",
            meta={"current": total_scenes // 2, "total": total_scenes, "status": "Visual Prompt Composer creating prompts..."}
        )

        print(f"🎨 AGENT 3: Visual Prompt Composer using asset library...")

        # AGENT 3: Create visual prompts using visual blueprint
        visual_data = llm_agent.create_visual_prompts(
            blueprint=blueprint,
            visual_blueprint=visual_blueprint,
            scenes_with_narration=scenes_with_narration,
            character_name=character_name,
            character_type=character_type,
            character_prompt=character_prompt,
            style=style
        )

        print(f"✅ Visual prompts created: {len(visual_data.get('image_prompts', []))} scenes")

        # Format prompts
        image_prompt_objects = visual_data.get("image_prompts", [])
        scene_blueprints = blueprint.get("scene_blueprints", [])

        prompts = []
        for i, prompt_obj in enumerate(image_prompt_objects):
            prompts.append({
                "scene_number": prompt_obj.get("scene_number", i + 1),
                "prompt": prompt_obj.get("prompt", ""),
                "scene_type": prompt_obj.get("scene_type", scenes_with_narration[i].get("scene_type", "character")),
                "characters_in_scene": scene_blueprints[i].get("characters_in_scene", []) if i < len(scene_blueprints) else []
            })

        # Debug: Log which scenes have side characters
        for prompt in prompts:
            if prompt.get("characters_in_scene"):
                print(f"🎭 Scene {prompt['scene_number']} includes side characters: {prompt['characters_in_scene']}")

        return {
            "prompts": prompts,
            "blueprint": blueprint,
            "visual_blueprint": visual_blueprint,  # Include asset library for frontend
            "status": f"Multi-agent visual prompts: {len(prompts)} scenes with {locations_count} locations, {objects_count} objects"
        }

    except Exception as e:
        print(f"❌ Error in image prompt generation task: {e}")
        raise


print("🎥 Registering tasks.generate_video_prompts")

@celery_app.task(bind=True, name="tasks.generate_video_prompts")
def generate_video_prompts_task(
    self,
    scenes_with_narration: List[Dict[str, Any]],
    character_prompt: str,
    style: str,
    blueprint: Dict[str, Any],
    image_prompts_data: List[Dict[str, Any]]
):
    """
    Background task for video prompt generation (AGENT 4)
    Updates progress as it processes
    """
    try:
        total_scenes = len(scenes_with_narration)

        # Update progress: Starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": total_scenes, "status": "Cinematographer creating video prompts..."}
        )

        print(f"🎥 AGENT 4: Cinematographer creating video prompts...")

        # AGENT 4: Create video prompts with full context
        video_data = llm_agent.create_video_prompts(
            blueprint=blueprint,
            scenes_with_narration=scenes_with_narration,
            image_prompts=image_prompts_data,
            character_prompt=character_prompt,
            style=style
        )

        print(f"✅ Video prompts created: {len(video_data.get('video_prompts', []))} camera movements")

        # Format prompts
        video_prompt_objects = video_data.get("video_prompts", [])
        prompts = [
            {
                "scene_number": prompt_obj.get("scene_number", i + 1),
                "prompt": prompt_obj.get("prompt", "")
            }
            for i, prompt_obj in enumerate(video_prompt_objects)
        ]

        return {
            "prompts": prompts,
            "status": f"Multi-agent video prompts: {len(prompts)} emotion-driven camera movements"
        }

    except Exception as e:
        print(f"❌ Error in video prompt generation task: {e}")
        raise


@celery_app.task(bind=True, name="tasks.generate_single_narration")
def generate_single_narration_task(
    self,
    scene_text: str,
    scene_number: int,
    language: str = "ko",
    voice_id: Optional[str] = None,
    style: Optional[str] = None,
    include_phonemes: bool = False
):
    """Background task for generating a single narration"""
    try:
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 1, "status": f"Generating narration for scene {scene_number}..."}
        )

        async def generate():
            # Generate speech using Supertone
            result = await tts_service.generate_speech(
                text=scene_text,
                language=language,
                voice_id=voice_id,
                style=style,
                output_format="mp3",
                include_phonemes=include_phonemes
            )

            # Decode base64 to bytes for S3 upload
            audio_bytes = base64.b64decode(result["audio_base64"])

            # Upload to S3
            audio_filename = f"narration_scene{scene_number}_{uuid.uuid4()}.mp3"
            audio_url = s3_service.upload_audio_data(
                audio_data=audio_bytes,
                filename=audio_filename,
                folder="narrations",
                content_type="audio/mpeg"
            )

            print(f"✅ Scene {scene_number} narration uploaded to S3: {audio_url}")

            # Calculate duration from phonemes if available
            duration = None
            if "phonemes" in result and result["phonemes"]:
                phonemes = result["phonemes"]
                if phonemes.get("start_times_seconds") and phonemes.get("durations_seconds"):
                    duration = phonemes["start_times_seconds"][-1] + phonemes["durations_seconds"][-1]

            # Build response
            response_data = {
                "audio_url": audio_url,
                "content_type": result["content_type"],
                "format": result["format"],
                "status": f"Scene {scene_number} narration generated successfully",
                "duration_seconds": duration,
                "scene_number": scene_number
            }

            if "phonemes" in result and result["phonemes"]:
                response_data["phonemes"] = result["phonemes"]

            return response_data

        result = asyncio.run(generate())

        return result

    except Exception as e:
        print(f"❌ Error generating narration for scene {scene_number}: {e}")
        raise


@celery_app.task(bind=True, name="tasks.generate_narrations")
def generate_narrations_task(
    self,
    scenes: List[Dict[str, Any]],
    language: str,
    voice_id: Optional[str] = None,
    style: Optional[str] = None,
    include_phonemes: bool = False
):
    """
    Background task for batch narration generation
    Updates progress as each narration completes
    """
    try:
        total_scenes = len(scenes)

        # Update progress: Starting
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": total_scenes, "status": "Starting narration generation..."}
        )

        print(f"🎙️ Generating {total_scenes} narrations in batch...")

        async def generate_single_narration(scene_data: Dict[str, Any], index: int):
            """Generate narration for a single scene"""
            try:
                scene_number = scene_data.get("scene_number", index + 1)
                script_text = scene_data.get("script_text", "")

                # Generate speech using Supertone
                result = await tts_service.generate_speech(
                    text=script_text,
                    language=language,
                    voice_id=voice_id,
                    style=style,
                    output_format="mp3",
                    include_phonemes=include_phonemes
                )

                # Decode base64 to bytes for S3 upload
                audio_bytes = base64.b64decode(result["audio_base64"])

                # Upload to S3
                audio_filename = f"narration_scene{scene_number}_{uuid.uuid4()}.mp3"
                audio_url = s3_service.upload_audio_data(
                    audio_data=audio_bytes,
                    filename=audio_filename,
                    folder="narrations",
                    content_type="audio/mpeg"
                )

                print(f"✅ Scene {scene_number} narration uploaded to S3")

                # Update progress
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": index + 1,
                        "total": total_scenes,
                        "status": f"Generated narration {index + 1}/{total_scenes}"
                    }
                )

                # Calculate duration from phonemes if available
                duration = None
                if "phonemes" in result and result["phonemes"]:
                    phonemes = result["phonemes"]
                    if phonemes.get("start_times_seconds") and phonemes.get("durations_seconds"):
                        duration = phonemes["start_times_seconds"][-1] + phonemes["durations_seconds"][-1]

                # Build response
                response_data = {
                    "audio_url": audio_url,
                    "content_type": result["content_type"],
                    "format": result["format"],
                    "status": f"Scene {scene_number} narration generated",
                    "duration_seconds": duration
                }

                if "phonemes" in result and result["phonemes"]:
                    response_data["phonemes"] = result["phonemes"]

                return response_data

            except Exception as e:
                print(f"❌ Error generating narration for scene {scene_data.get('scene_number', index + 1)}: {e}")
                return {
                    "audio_url": "",
                    "content_type": "audio/mpeg",
                    "format": "mp3",
                    "status": f"Failed: {str(e)}"
                }

        # Generate all narrations
        async def generate_all():
            tasks = [generate_single_narration(scene, idx) for idx, scene in enumerate(scenes)]
            return await asyncio.gather(*tasks)

        narrations = asyncio.run(generate_all())

        successful_count = sum(1 for n in narrations if n.get("audio_url"))
        print(f"✅ Batch narration complete: {successful_count}/{total_scenes} successful")

        return {
            "narrations": narrations,
            "status": f"Generated {successful_count}/{total_scenes} narrations"
        }

    except Exception as e:
        print(f"❌ Error in batch narration generation task: {e}")
        raise
