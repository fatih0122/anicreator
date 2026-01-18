#!/usr/bin/env python3
"""
Test script for the complete story generation pipeline
Tests all agents: Story Director → Script Writer → Visual Blueprint → Visual Prompts → Video Prompts
"""

import json
from app.agents.llm_agent import llm_agent

def print_separator(title):
    """Print a nice separator for readability"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80 + "\n")

def test_complete_pipeline():
    """Test the complete multi-agent pipeline"""

    # Test configuration
    character_name = "루나"
    character_type = "rabbit"
    character_prompt = "curious white rabbit with long ears, wearing a small blue backpack, expressive eyes"
    personality = "brave and curious, loves exploring new places"
    themes = "User's story idea: a rabbit who climbs a mountain to see the sunrise | Generic theme: adventure, courage"
    num_scenes = 6
    style = "Pixar 3D animation style"
    language = "Korean"

    print_separator("TEST CONFIGURATION")
    print(f"Character Name: {character_name}")
    print(f"Character Type: {character_type}")
    print(f"Personality: {personality}")
    print(f"Themes: {themes}")
    print(f"Number of Scenes: {num_scenes}")
    print(f"Art Style: {style}")
    print(f"Language: {language}")

    try:
        # ===== AGENT 1: Story Director =====
        print_separator("AGENT 1: STORY DIRECTOR")
        print("Creating story blueprint with scene-by-scene breakdown...")

        blueprint = llm_agent.create_story_blueprint(
            character_name=character_name,
            character_type=character_type,
            character_prompt=character_prompt,
            personality=personality,
            themes=themes,
            num_scenes=num_scenes,
            language="English"
        )

        print(f"✅ Blueprint created!")
        print(f"Story Summary: {blueprint.get('story_summary', 'N/A')}")
        print(f"Number of scenes: {len(blueprint.get('scene_blueprints', []))}")
        print(f"Side characters: {len(blueprint.get('side_characters', []))}")

        # Print scene blueprints
        for scene in blueprint.get('scene_blueprints', []):
            scene_num = scene.get('scene_number')
            scene_type = scene.get('scene_type')
            what_happens = scene.get('what_happens', '')
            word_count = len(what_happens.split())
            side_chars = scene.get('characters_in_scene', [])

            print(f"\n  Scene {scene_num} ({scene_type}) - {word_count} words:")
            print(f"    {what_happens}")
            if side_chars:
                print(f"    Side characters: {', '.join(side_chars)}")

        # Print side characters
        if blueprint.get('side_characters'):
            print("\n  Side Characters:")
            for char in blueprint['side_characters']:
                print(f"    - {char['name']}: {char['type']} - {char['description']}")

        # ===== AGENT 2: Script Writer =====
        print_separator("AGENT 2: SCRIPT WRITER")
        print("Converting blueprint into Korean narration...")

        script_data = llm_agent.write_scene_narrations(
            blueprint=blueprint,
            character_name=character_name,
            character_type=character_type,
            character_prompt=character_prompt,
            personality=personality,
            language=language
        )

        print(f"✅ Narration created!")
        print(f"Story Title: {script_data.get('story_title', 'N/A')}")
        print(f"Number of scenes: {len(script_data.get('scenes', []))}")

        # Print narrations with character counts
        scenes_with_narration = []
        for scene in script_data.get('scenes', []):
            scene_num = scene.get('scene_number')
            scene_type = scene.get('scene_type')
            narration = scene.get('narration_text', '')
            char_count = len(narration)

            # Build scene data for next agents
            scenes_with_narration.append({
                "scene_number": scene_num,
                "scene_type": scene_type,
                "narration_text": narration
            })

            # Check character count
            status = "✅" if 25 <= char_count <= 30 else "⚠️" if char_count < 25 or char_count > 35 else "❌"
            print(f"\n  Scene {scene_num} ({scene_type}) - {char_count} chars {status}:")
            print(f"    {narration}")

        # ===== AGENT 2.5: Visual Blueprint Director =====
        print_separator("AGENT 2.5: VISUAL BLUEPRINT DIRECTOR")
        print("Creating visual asset library (locations & objects)...")

        visual_blueprint = llm_agent.create_visual_blueprint(
            story_blueprint=blueprint,
            style=style
        )

        print(f"✅ Visual blueprint created!")
        print(f"Locations: {len(visual_blueprint.get('locations', []))}")
        print(f"Objects: {len(visual_blueprint.get('objects', []))}")

        # Print locations
        for location in visual_blueprint.get('locations', []):
            loc_id = location.get('location_id')
            loc_name = location.get('location_name')
            appears_in = location.get('appears_in_scenes', [])
            description = location.get('description', '')[:100] + "..."

            print(f"\n  Location: {loc_name} ({loc_id})")
            print(f"    Appears in scenes: {appears_in}")
            print(f"    Description: {description}")

        # Print objects
        for obj in visual_blueprint.get('objects', []):
            obj_id = obj.get('object_id')
            obj_name = obj.get('object_name')
            appears_in = obj.get('appears_in_scenes', [])
            description = obj.get('description', '')[:100] + "..."

            print(f"\n  Object: {obj_name} ({obj_id})")
            print(f"    Appears in scenes: {appears_in}")
            print(f"    Description: {description}")

        # Print visual notes
        visual_notes = visual_blueprint.get('visual_notes', {})
        print(f"\n  Visual Notes:")
        print(f"    Time progression: {visual_notes.get('time_of_day_progression', 'N/A')}")
        print(f"    Weather: {visual_notes.get('weather', 'N/A')}")
        print(f"    Color palette: {visual_notes.get('color_palette', 'N/A')}")
        print(f"    Mood: {visual_notes.get('overall_mood', 'N/A')}")

        # ===== AGENT 3: Visual Prompt Composer =====
        print_separator("AGENT 3: VISUAL PROMPT COMPOSER")
        print("Composing image prompts using visual asset library...")

        visual_data = llm_agent.create_visual_prompts(
            blueprint=blueprint,
            visual_blueprint=visual_blueprint,
            scenes_with_narration=scenes_with_narration,
            character_name=character_name,
            character_type=character_type,
            character_prompt=character_prompt,
            style=style
        )

        print(f"✅ Image prompts created!")
        print(f"Number of prompts: {len(visual_data.get('image_prompts', []))}")

        # Print image prompts
        image_prompts = []
        for prompt_data in visual_data.get('image_prompts', []):
            scene_num = prompt_data.get('scene_number')
            scene_type = prompt_data.get('scene_type')
            prompt = prompt_data.get('prompt', '')

            image_prompts.append(prompt_data)

            print(f"\n  Scene {scene_num} ({scene_type}):")
            print(f"    {prompt[:150]}...")

        # ===== AGENT 4: Motion Director =====
        print_separator("AGENT 4: MOTION DIRECTOR")
        print("Creating video animation prompts...")

        video_data = llm_agent.create_video_prompts(
            blueprint=blueprint,
            scenes_with_narration=scenes_with_narration,
            image_prompts=image_prompts,
            character_prompt=character_prompt,
            style=style
        )

        print(f"✅ Video prompts created!")
        print(f"Number of prompts: {len(video_data.get('video_prompts', []))}")

        # Print video prompts
        for prompt_data in video_data.get('video_prompts', []):
            scene_num = prompt_data.get('scene_number')
            prompt = prompt_data.get('prompt', '')

            print(f"\n  Scene {scene_num} motion:")
            print(f"    {prompt[:150]}...")

        # ===== SUMMARY =====
        print_separator("PIPELINE TEST COMPLETE ✅")
        print(f"✅ Agent 1: Created {len(blueprint.get('scene_blueprints', []))} scene blueprints")
        print(f"✅ Agent 2: Generated {len(script_data.get('scenes', []))} Korean narrations")
        print(f"✅ Agent 2.5: Created visual library with {len(visual_blueprint.get('locations', []))} locations, {len(visual_blueprint.get('objects', []))} objects")
        print(f"✅ Agent 3: Composed {len(visual_data.get('image_prompts', []))} image prompts")
        print(f"✅ Agent 4: Created {len(video_data.get('video_prompts', []))} video prompts")
        print(f"\nAll agents working correctly! 🎉")

        # Save results to file for inspection
        results = {
            "blueprint": blueprint,
            "script": script_data,
            "visual_blueprint": visual_blueprint,
            "image_prompts": visual_data,
            "video_prompts": video_data
        }

        with open('test_pipeline_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        print(f"\n📄 Full results saved to: test_pipeline_results.json")

        return True

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print_separator("STORY GENERATION PIPELINE TEST")
    print("Testing all agents in the multi-agent pipeline...")

    success = test_complete_pipeline()

    if success:
        print("\n✅ All tests passed!")
    else:
        print("\n❌ Tests failed!")

    exit(0 if success else 1)
