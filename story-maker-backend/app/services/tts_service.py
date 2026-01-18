"""
Supertone TTS Service
Handles text-to-speech conversion using Supertone API
"""

import os
import asyncio
import httpx
import base64
from typing import Optional, Dict, Any

SUPERTONE_API_URL = "https://supertoneapi.com"
SUPERTONE_API_KEY = os.getenv("SUPERTONE_API_KEY")
SUPERTONE_DEFAULT_VOICE_ID = os.getenv("SUPERTONE_VOICE_ID", "default_voice_id")


class SupertoneTTSService:
    """Service for converting text to speech using Supertone API"""

    def __init__(self):
        if not SUPERTONE_API_KEY:
            raise ValueError("SUPERTONE_API_KEY environment variable is not set")
        self.api_key = SUPERTONE_API_KEY
        self.default_voice_id = SUPERTONE_DEFAULT_VOICE_ID

    async def generate_speech(
        self,
        text: str,
        language: str = "ko",
        voice_id: Optional[str] = None,
        style: Optional[str] = None,
        voice_settings: Optional[Dict[str, Any]] = None,
        output_format: str = "mp3",
        include_phonemes: bool = False
    ) -> Dict[str, Any]:
        """
        Generate speech from text using Supertone API

        Args:
            text: The text to convert to speech (max 300 characters)
            language: Language code ('en', 'ko', 'ja')
            voice_id: Voice ID to use (defaults to SUPERTONE_DEFAULT_VOICE_ID)
            style: Style of character for TTS conversion
            voice_settings: Optional voice settings (pitch_shift, speed, etc.)
            output_format: Output format ('wav' or 'mp3')
            include_phonemes: Whether to include phoneme timing data for subtitles

        Returns:
            Dict containing:
            - audio_base64: Base64 encoded audio data
            - content_type: MIME type of the audio
            - format: Output format
            - phonemes: (optional) Phoneme timing data if include_phonemes=True
        """
        if not voice_id:
            voice_id = self.default_voice_id

        # Validate text length
        if len(text) > 300:
            raise ValueError(f"Text length ({len(text)}) exceeds maximum of 300 characters")

        # Default voice settings
        default_settings = {
            "pitch_shift": 0,
            "pitch_variance": 1,
            "speed": 1,
            "duration": 0,
            "similarity": 3,
            "text_guidance": 1,
            "subharmonic_amplitude_control": 1
        }

        # Merge with provided settings
        if voice_settings:
            default_settings.update(voice_settings)

        # Prepare request body
        request_body = {
            "text": text,
            "language": language,
            "model": "sona_speech_1",
            "output_format": output_format,
            "voice_settings": default_settings,
            "include_phonemes": include_phonemes
        }

        # Add style if provided
        if style:
            request_body["style"] = style

        # Make API request
        url = f"{SUPERTONE_API_URL}/v1/text-to-speech/{voice_id}"
        headers = {
            "x-sup-api-key": self.api_key,
            "Content-Type": "application/json"
        }

        # Retry logic for handling temporary API failures
        max_retries = 3
        retry_delay = 2  # seconds

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(url, json=request_body, headers=headers)

                    if response.status_code == 200:
                        # Get content type
                        content_type = response.headers.get("content-type", "audio/mpeg")

                        # If phonemes requested, response will be JSON with audio_base64 and phonemes
                        if include_phonemes:
                            response_data = response.json()
                            return {
                                "audio_base64": response_data.get("audio_base64"),
                                "content_type": "audio/mpeg" if output_format == "mp3" else "audio/wav",
                                "format": output_format,
                                "phonemes": response_data.get("phonemes")
                            }
                        else:
                            # Binary audio response
                            audio_data = response.content
                            audio_base64 = base64.b64encode(audio_data).decode('utf-8')

                            return {
                                "audio_base64": audio_base64,
                                "content_type": content_type,
                                "format": output_format
                            }
                    elif response.status_code >= 500:
                        # Server error - retry
                        error_detail = response.text
                        print(f"❌ Supertone API server error on attempt {attempt + 1}/{max_retries}: {response.status_code}")

                        if attempt < max_retries - 1:
                            print(f"🔄 Retrying in {retry_delay} seconds...")
                            await asyncio.sleep(retry_delay)
                            retry_delay *= 2  # Exponential backoff
                            continue
                        else:
                            raise Exception(f"Supertone API error ({response.status_code}): {error_detail}")
                    else:
                        # Client error (4xx) - don't retry
                        error_detail = response.text
                        raise Exception(f"Supertone API error ({response.status_code}): {error_detail}")

            except httpx.TimeoutException:
                print(f"❌ Supertone API timeout on attempt {attempt + 1}/{max_retries}")

                if attempt < max_retries - 1:
                    print(f"🔄 Retrying in {retry_delay} seconds...")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                else:
                    raise Exception("Supertone API timeout after multiple retries")

            except Exception as e:
                # For other exceptions, only retry if it's a network/connection error
                if "connection" in str(e).lower() or "network" in str(e).lower():
                    print(f"❌ Network error on attempt {attempt + 1}/{max_retries}: {str(e)}")

                    if attempt < max_retries - 1:
                        print(f"🔄 Retrying in {retry_delay} seconds...")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                        continue

                # Re-raise if not retryable or last attempt
                raise

    async def generate_narrations_for_scenes(
        self,
        scenes: list,
        language: str = "ko",
        voice_id: Optional[str] = None,
        style: Optional[str] = None
    ) -> list:
        """
        Generate narrations for multiple scenes

        Args:
            scenes: List of scene objects with 'script_text'
            language: Language code
            voice_id: Voice ID to use
            style: Style for TTS

        Returns:
            List of dicts with audio_base64 for each scene
        """
        narrations = []

        for scene in scenes:
            text = scene.get("script_text", "")
            if not text:
                narrations.append(None)
                continue

            try:
                result = await self.generate_speech(
                    text=text,
                    language=language,
                    voice_id=voice_id,
                    style=style,
                    output_format="mp3"
                )
                narrations.append(result)
            except Exception as e:
                print(f"❌ Error generating narration for scene: {e}")
                narrations.append(None)

        return narrations
