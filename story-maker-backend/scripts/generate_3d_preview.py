"""
Generate 3D Rendered Style Preview Images

This script generates 5 preview images for the 3D Rendered style only.

Usage:
    python scripts/generate_3d_preview.py
"""

import os
import asyncio
import aiohttp
import json
from pathlib import Path
from datetime import datetime
from typing import List

# Try to load .env file if it exists
try:
    env_file = Path(__file__).parent.parent / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    if key == "KIE_API_KEY" and not os.getenv("KIE_API_KEY"):
                        os.environ[key] = value.strip()
except Exception:
    pass  # If .env loading fails, just use environment variables

# 3D Rendered style configuration
THREED_STYLE = {
    "id": "3d",
    "label": "3D Rendered",
    "prompt": "3D rendered style",
    "example": "A normal person, 3D rendered"
}

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "generated_previews"


class KIEService:
    """Standalone KIE Service for image generation"""

    def __init__(self):
        self.api_key = os.getenv("KIE_API_KEY")
        if not self.api_key:
            raise ValueError("KIE_API_KEY environment variable not set")

        self.base_url = "https://api.kie.ai/api/v1/jobs"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def create_task(self, model: str, input_params: dict) -> str:
        """Create a generation task"""
        payload = {
            "model": model,
            "input": input_params
        }

        print(f"📤 Creating task with model: {model}")

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

                if result.get("code") != 200:
                    raise Exception(f"KIE API returned error: {result.get('msg')}")

                task_id = result["data"]["taskId"]
                return task_id

    async def poll_task(
        self,
        task_id: str,
        max_attempts: int = 120,
        poll_interval: int = 5
    ) -> List[str]:
        """Poll for task completion"""
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
                        return result_urls

                    elif state == "fail":
                        fail_msg = data.get("failMsg", "Unknown error")
                        fail_code = data.get("failCode", "Unknown")
                        raise Exception(f"KIE task failed: {fail_code} - {fail_msg}")

                    # Still waiting
                    if attempt % 6 == 0:  # Print every 30 seconds
                        print(f"   ⏳ Still processing... ({attempt * poll_interval}s elapsed)")
                    await asyncio.sleep(poll_interval)

            raise Exception(f"KIE task {task_id} timed out after {max_attempts * poll_interval} seconds")

    async def generate_image_txt2img(
        self,
        prompt: str,
        output_format: str = "png",
        image_size: str = "1:1"
    ) -> str:
        """Generate image from text using Nano Banana"""
        input_params = {
            "prompt": prompt,
            "output_format": output_format,
            "image_size": image_size
        }

        task_id = await self.create_task("google/nano-banana", input_params)
        result_urls = await self.poll_task(task_id)
        return result_urls[0]


async def download_image(session: aiohttp.ClientSession, url: str, filepath: Path):
    """Download an image from URL and save to filepath"""
    try:
        async with session.get(url) as response:
            if response.status == 200:
                content = await response.read()
                with open(filepath, 'wb') as f:
                    f.write(content)
                print(f"   ✅ Saved: {filepath.name}")
                return True
            else:
                print(f"   ❌ Failed to download: HTTP {response.status}")
                return False
    except Exception as e:
        print(f"   ❌ Error downloading: {str(e)}")
        return False


async def main():
    """Generate previews for 3D Rendered style"""
    print("="*60)
    print("🎨 3D Rendered Style Preview Generator")
    print("="*60)
    print(f"\nGenerating 5 preview images for 3D Rendered style")
    print(f"(Geometric, minimalist, architectural aesthetic)")
    print(f"\nOutput directory: {OUTPUT_DIR / THREED_STYLE['id']}")
    print("\n" + "="*60)

    # Initialize KIE service
    try:
        kie_service = KIEService()
        print("✅ KIE Service initialized\n")
    except Exception as e:
        print(f"❌ Failed to initialize KIE Service: {str(e)}")
        print("\nMake sure KIE_API_KEY is set in your .env file or environment variables.")
        return

    # Create output directory
    style_dir = OUTPUT_DIR / THREED_STYLE['id']
    style_dir.mkdir(parents=True, exist_ok=True)

    # Generate the full prompt
    full_prompt = f"{THREED_STYLE['example']}, {THREED_STYLE['prompt']}"

    print(f"📝 Prompt: {full_prompt}\n")

    # Generate 5 variations
    start_time = datetime.now()
    tasks = []

    for i in range(1, 6):
        print(f"🎨 Starting generation {i}/5...")
        tasks.append(
            kie_service.generate_image_txt2img(
                prompt=full_prompt,
                output_format="png",
                image_size="1:1"
            )
        )

    # Wait for all generations to complete
    try:
        image_urls = await asyncio.gather(*tasks)
        print(f"\n✅ All {len(image_urls)} images generated successfully!")

        # Download all images
        print(f"\n📥 Downloading images...")
        async with aiohttp.ClientSession() as session:
            download_tasks = []
            for i, url in enumerate(image_urls, 1):
                filename = f"{THREED_STYLE['id']}_preview_{i}.png"
                filepath = style_dir / filename
                download_tasks.append(download_image(session, url, filepath))

            results = await asyncio.gather(*download_tasks)
            success_count = sum(results)

            print(f"\n✅ Downloaded {success_count}/{len(results)} images to: {style_dir}")

            # Print all URLs for reference
            print(f"\n🔗 Generated URLs:")
            for i, url in enumerate(image_urls, 1):
                print(f"   {i}. {url}")

    except Exception as e:
        print(f"\n❌ Error generating images: {str(e)}")
        return

    # Print summary
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)
    print(f"\n✅ Successfully generated: {len(image_urls)} images")
    print(f"⏱️  Total time: {duration:.1f} seconds")
    print(f"📁 Output directory: {style_dir}")
    print("\n" + "="*60)
    print("✅ Generation complete!")
    print("="*60)

    # Create a summary file
    summary_file = style_dir / f"{THREED_STYLE['id']}_urls.txt"
    with open(summary_file, 'w') as f:
        f.write(f"3D Rendered Style Preview URLs\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"="*60 + "\n\n")
        for i, url in enumerate(image_urls, 1):
            f.write(f"{i}. {url}\n")

    print(f"\n📄 URLs saved to: {summary_file}")


if __name__ == "__main__":
    asyncio.run(main())
