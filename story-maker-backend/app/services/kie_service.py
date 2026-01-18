"""
KIE AI API Service
Supports multiple models:
- Nano Banana (text-to-image)
- Nano Banana Edit (image-to-image)
- Kling v2-1-pro (image-to-video)
"""

import os
import asyncio
import aiohttp
import json
from typing import Optional, List

class KIEService:
    def __init__(self):
        self.api_key = os.getenv("KIE_API_KEY")
        if not self.api_key:
            raise ValueError("KIE_API_KEY environment variable not set")

        self.base_url = "https://api.kie.ai/api/v1/jobs"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    # ===== Generic Task Management =====

    async def create_task(self, model: str, input_params: dict) -> str:
        """
        Create a generation task

        Args:
            model: Model identifier (e.g., "google/nano-banana")
            input_params: Model-specific input parameters

        Returns:
            taskId: The task ID for polling results
        """
        payload = {
            "model": model,
            "input": input_params
        }

        print(f"📤 Sending request to KIE API:")
        print(f"   Model: {model}")
        print(f"   Payload: {json.dumps(payload, indent=2)}")

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/createTask",
                headers=self.headers,
                json=payload
            ) as response:
                response_text = await response.text()

                if response.status != 200:
                    print(f"❌ KIE API HTTP Error {response.status}: {response_text}")
                    raise Exception(f"KIE API error: {response.status} - {response_text}")

                try:
                    result = json.loads(response_text)
                except json.JSONDecodeError:
                    print(f"❌ Invalid JSON response: {response_text}")
                    raise Exception(f"Invalid JSON response from KIE API")

                print(f"📥 KIE API Response: {json.dumps(result, indent=2)}")

                if result.get("code") != 200:
                    raise Exception(f"KIE API returned error: {result.get('msg')}")

                task_id = result["data"]["taskId"]
                print(f"✅ KIE task created ({model}): {task_id}")
                return task_id

    async def poll_task(
        self,
        task_id: str,
        max_attempts: int = 120,
        poll_interval: int = 5
    ) -> List[str]:
        """
        Poll for task completion

        Args:
            task_id: The task ID to poll
            max_attempts: Maximum number of polling attempts
            poll_interval: Seconds between polls

        Returns:
            result_urls: List of generated file URLs
        """
        async with aiohttp.ClientSession() as session:
            for attempt in range(max_attempts):
                async with session.get(
                    f"{self.base_url}/recordInfo",
                    headers=self.headers,
                    params={"taskId": task_id}
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"KIE poll error: {response.status} - {error_text}")

                    result = await response.json()

                    if result.get("code") != 200:
                        raise Exception(f"KIE poll returned error: {result.get('msg')}")

                    data = result["data"]
                    state = data["state"]

                    if state == "success":
                        result_json = json.loads(data["resultJson"])
                        result_urls = result_json["resultUrls"]
                        print(f"✅ KIE task completed: {len(result_urls)} results")
                        return result_urls

                    elif state == "fail":
                        fail_msg = data.get("failMsg", "Unknown error")
                        fail_code = data.get("failCode", "Unknown")
                        print(f"❌ KIE task failed - Code: {fail_code}, Message: {fail_msg}")
                        print(f"Full error data: {json.dumps(data, indent=2)}")
                        raise Exception(f"KIE task failed: {fail_code} - {fail_msg}")

                    # Still waiting
                    print(f"⏳ KIE task {task_id} processing... (attempt {attempt + 1}/{max_attempts})")
                    await asyncio.sleep(poll_interval)

            raise Exception(f"KIE task {task_id} timed out after {max_attempts * poll_interval} seconds")

    # ===== Nano Banana (Text-to-Image) =====

    async def generate_image_txt2img(
        self,
        prompt: str,
        output_format: str = "png",
        image_size: str = "1:1"
    ) -> str:
        """
        Generate image from text using Nano Banana

        Args:
            prompt: Text description of the image
            output_format: "png" or "jpeg"
            image_size: Aspect ratio (e.g., "1:1", "16:9", "9:16")

        Returns:
            image_url: URL of the generated image
        """
        input_params = {
            "prompt": prompt,
            "output_format": output_format,
            "image_size": image_size
        }

        task_id = await self.create_task("google/nano-banana", input_params)
        result_urls = await self.poll_task(task_id)
        return result_urls[0]

    # ===== Nano Banana Edit (Image-to-Image) =====

    async def generate_image_img2img(
        self,
        prompt: str,
        image_url: str = None,
        image_urls: List[str] = None,
        output_format: str = "png",
        image_size: str = "1:1"
    ) -> str:
        """
        Generate image from image(s) using Nano Banana Edit

        Args:
            prompt: Text description of desired modifications
            image_url: URL of the source image (single image - legacy)
            image_urls: List of image URLs (for multi-character scenes)
            output_format: "png" or "jpeg"
            image_size: Aspect ratio

        Returns:
            image_url: URL of the generated image
        """
        # Support both single image_url and multiple image_urls
        if image_urls is None:
            if image_url is None:
                raise ValueError("Either image_url or image_urls must be provided")
            image_urls = [image_url]

        input_params = {
            "prompt": prompt,
            "image_urls": image_urls,
            "output_format": output_format,
            "image_size": image_size
        }

        task_id = await self.create_task("google/nano-banana-edit", input_params)
        result_urls = await self.poll_task(task_id)
        return result_urls[0]

    # ===== Kling v2-1-pro (Image-to-Video) =====

    async def generate_video(
        self,
        image_url: str,
        prompt: str,
        duration: str = "5",
        negative_prompt: str = "blur, distort, and low quality",
        cfg_scale: float = 0.5,
        tail_image_url: str = ""
    ) -> str:
        """
        Generate video from image using Kling 2.1 Pro

        Args:
            image_url: URL of the image to animate
            prompt: Text prompt describing the video motion
            duration: Video duration ("5" or "10" seconds)
            negative_prompt: Terms to avoid in the video
            cfg_scale: CFG scale (0-1)
            tail_image_url: Optional end frame image URL

        Returns:
            video_url: URL of the generated video
        """
        input_params = {
            "prompt": prompt,
            "image_url": image_url,
            "duration": duration,
            "negative_prompt": negative_prompt,
            "cfg_scale": cfg_scale
        }

        # Only add tail_image_url if it's provided
        if tail_image_url:
            input_params["tail_image_url"] = tail_image_url

        task_id = await self.create_task("kling/v2-1-pro", input_params)
        result_urls = await self.poll_task(task_id, max_attempts=120, poll_interval=5)
        return result_urls[0]


# Global instance
kie_service = KIEService()
