"""
Generate Style Preview Images Script

This script generates 5 preview images for each story style using KIE Nano Banana.
The images are saved locally and can be uploaded to your image hosting service.

Usage:
    python scripts/generate_style_previews.py
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

# Style configurations with prompts
STYLES = {
    "ghibli": {
        "label": "Studio Ghibli",
        "prompt": "Studio Ghibli animation style",
        "example": "A peaceful countryside scene with rolling green hills, a young character standing under a large tree, soft clouds in a blue sky, hand-drawn animation style, warm and nostalgic atmosphere, detailed background art, whimsical and dreamlike quality"
    },
    "anime": {
        "label": "Anime",
        "prompt": "anime art style",
        "example": "A dynamic anime character with expressive eyes and colorful hair, action pose, vibrant colors, clean line art, cel-shaded style, detailed character design, energetic composition, modern anime aesthetic"
    },
    "photorealistic": {
        "label": "Photorealistic",
        "prompt": "photorealistic style",
        "example": "A highly detailed photorealistic portrait, natural lighting, sharp focus, professional photography quality, realistic skin texture, depth of field, cinematic composition, lifelike details, 8K quality"
    },
    "micro-world": {
        "label": "Micro World",
        "prompt": "micro world style",
        "example": "A miniature world scene with a tiny character exploring a giant garden, macro photography style with extreme depth of field, small scale environment, oversized everyday objects, tilt-shift effect, vibrant colors, detailed textures, whimsical miniature perspective"
    },
    "cartoon": {
        "label": "Animation",
        "prompt": "Disney Pixar animation style",
        "example": "A charming Disney-Pixar style 3D animated character with expressive eyes and personality, vibrant colors, soft lighting, detailed textures, high-quality CGI animation, heartwarming and magical atmosphere, cinematic quality, appealing character design"
    },
    "3d": {
        "label": "3D Rendered",
        "prompt": "3D rendered style",
        "example": "A normal person, 3D rendered"
    },
    "pixel": {
        "label": "Pixel Art",
        "prompt": "pixel art style",
        "example": "A retro pixel art character in a colorful environment, 16-bit style graphics, limited color palette, crisp pixels, nostalgic gaming aesthetic, detailed sprite work, charming retro design"
    },
    "cyberpunk": {
        "label": "Cyberpunk",
        "prompt": "cyberpunk style",
        "example": "A futuristic character in a neon-lit cyberpunk city at night, rain-soaked streets reflecting holographic advertisements, high-tech urban environment, dramatic lighting with pink and blue neon colors, dystopian atmosphere, detailed mechanical elements, cinematic composition"
    }
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


async def generate_style_previews(style_id: str, style_config: dict, kie_service: KIEService):
    """Generate 5 preview images for a single style"""
    print(f"\n{'='*60}")
    print(f"📸 Generating previews for: {style_config['label']} ({style_id})")
    print(f"{'='*60}")

    # Create output directory for this style
    style_dir = OUTPUT_DIR / style_id
    style_dir.mkdir(parents=True, exist_ok=True)

    # Generate the full prompt combining style prompt and example
    full_prompt = f"{style_config['example']}, {style_config['prompt']}"

    print(f"\n📝 Prompt: {full_prompt}\n")

    # Generate 5 variations
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
                filename = f"{style_id}_preview_{i}.png"
                filepath = style_dir / filename
                download_tasks.append(download_image(session, url, filepath))

            results = await asyncio.gather(*download_tasks)
            success_count = sum(results)

            print(f"\n✅ Downloaded {success_count}/{len(results)} images to: {style_dir}")

            # Print all URLs for reference
            print(f"\n🔗 Generated URLs:")
            for i, url in enumerate(image_urls, 1):
                print(f"   {i}. {url}")

            return image_urls

    except Exception as e:
        print(f"\n❌ Error generating images: {str(e)}")
        return []


async def main():
    """Main function to generate all style previews"""
    print("="*60)
    print("🎨 Style Preview Generator")
    print("="*60)
    print(f"\nThis script will generate 5 preview images for each of the {len(STYLES)} styles.")
    print(f"Total images to generate: {len(STYLES) * 5}")
    print(f"\nOutput directory: {OUTPUT_DIR}")
    print("\n" + "="*60)

    # Initialize KIE service
    try:
        kie_service = KIEService()
        print("✅ KIE Service initialized")
    except Exception as e:
        print(f"❌ Failed to initialize KIE Service: {str(e)}")
        print("\nMake sure KIE_API_KEY is set in your environment variables.")
        return

    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Track results
    all_results = {}
    start_time = datetime.now()

    # Generate previews for each style
    for style_id, style_config in STYLES.items():
        try:
            urls = await generate_style_previews(style_id, style_config, kie_service)
            all_results[style_id] = {
                "label": style_config["label"],
                "urls": urls,
                "local_dir": str(OUTPUT_DIR / style_id)
            }
        except Exception as e:
            print(f"\n❌ Failed to generate previews for {style_id}: {str(e)}")
            all_results[style_id] = {
                "label": style_config["label"],
                "urls": [],
                "error": str(e)
            }

    # Print final summary
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print("\n" + "="*60)
    print("📊 GENERATION SUMMARY")
    print("="*60)

    total_generated = sum(len(result["urls"]) for result in all_results.values())
    print(f"\n✅ Successfully generated: {total_generated}/{len(STYLES) * 5} images")
    print(f"⏱️  Total time: {duration:.1f} seconds")
    print(f"📁 Output directory: {OUTPUT_DIR}")

    print("\n📋 Results by style:")
    for style_id, result in all_results.items():
        if result["urls"]:
            print(f"\n  ✅ {result['label']} ({style_id}): {len(result['urls'])} images")
            print(f"     📁 {result['local_dir']}")
        else:
            error_msg = result.get('error', 'Unknown error')
            print(f"\n  ❌ {result['label']} ({style_id}): Failed - {error_msg}")

    print("\n" + "="*60)
    print("✅ Script completed!")
    print("="*60)

    # Create a summary file
    summary_file = OUTPUT_DIR / "generation_summary.txt"
    with open(summary_file, 'w') as f:
        f.write(f"Style Preview Generation Summary\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"="*60 + "\n\n")

        for style_id, result in all_results.items():
            f.write(f"{result['label']} ({style_id})\n")
            f.write(f"{'-'*40}\n")
            if result["urls"]:
                for i, url in enumerate(result["urls"], 1):
                    f.write(f"{i}. {url}\n")
            else:
                f.write(f"Failed: {result.get('error', 'Unknown error')}\n")
            f.write("\n")

    print(f"\n📄 Summary saved to: {summary_file}")


if __name__ == "__main__":
    asyncio.run(main())
