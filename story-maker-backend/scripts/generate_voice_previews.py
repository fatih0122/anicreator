"""
Script to generate TTS voice previews using Supertone API
and upload them to S3 in the voice_previews folder
"""

import os
import sys
import asyncio
import base64
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config.voices import VOICE_LIBRARY
from app.services.tts_service import SupertoneTTSService
from app.services.s3_service import s3_service


async def generate_preview(tts_service, voice_id, display_name, preview_script):
    """Generate a single voice preview"""
    try:
        print(f"🎙️  Generating preview for {display_name} ({voice_id})...")

        # Generate speech
        result = await tts_service.generate_speech(
            text=preview_script,
            language="ko",
            voice_id=voice_id,
            output_format="mp3"
        )

        # Decode base64 audio
        audio_data = base64.b64decode(result["audio_base64"])

        print(f"✅ Generated {len(audio_data)} bytes for {display_name}")
        return audio_data

    except Exception as e:
        print(f"❌ Error generating preview for {display_name}: {e}")
        return None


async def upload_to_s3(audio_data, display_name):
    """Upload audio file to S3"""
    try:
        # Create filename
        filename = f"{display_name}.mp3"

        # Upload to S3 in voice_previews folder
        print(f"📤 Uploading {filename} to S3...")
        url = s3_service.upload_audio_data(
            audio_data=audio_data,
            filename=filename,
            folder="voice_previews"
        )

        print(f"✅ Uploaded to: {url}")
        return url

    except Exception as e:
        print(f"❌ Error uploading {display_name}: {e}")
        return None


async def generate_all_previews():
    """Generate and upload all voice previews"""
    print("=" * 60)
    print("Starting Voice Preview Generation")
    print("=" * 60)

    # Initialize TTS service
    print("\n🔧 Initializing Supertone TTS service...")
    tts_service = SupertoneTTSService()

    results = []

    # Generate preview for each voice
    for name, config in VOICE_LIBRARY.items():
        print(f"\n📢 Processing: {config['display_name']}")
        print(f"   Voice ID: {config['voice_id']}")
        print(f"   Script: {config['preview_script'][:50]}...")

        # Generate TTS
        audio_data = await generate_preview(
            tts_service=tts_service,
            voice_id=config["voice_id"],
            display_name=config["display_name"],
            preview_script=config["preview_script"]
        )

        if audio_data:
            # Upload to S3
            url = await upload_to_s3(audio_data, config["display_name"])

            if url:
                results.append({
                    "name": name,
                    "display_name": config["display_name"],
                    "voice_id": config["voice_id"],
                    "url": url
                })

        # Small delay to avoid rate limiting
        await asyncio.sleep(1)

    # Print summary
    print("\n" + "=" * 60)
    print("Generation Complete!")
    print("=" * 60)
    print(f"\n✅ Successfully generated {len(results)} voice previews:\n")

    for result in results:
        print(f"   {result['display_name']:10} -> {result['url']}")

    print("\n" + "=" * 60)

    return results


if __name__ == "__main__":
    # Run the async function
    asyncio.run(generate_all_previews())
