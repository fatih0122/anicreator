"""
Optimize and Upload Style Preview Images to S3

This script takes the selected preview images, optimizes them for web use,
and uploads them to S3 for use in the frontend.

Usage:
    python scripts/optimize_and_upload_previews.py
"""

import os
from pathlib import Path
from PIL import Image
import boto3
from botocore.exceptions import NoCredentialsError

# Load .env file
try:
    env_file = Path(__file__).parent.parent / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    if not os.getenv(key):
                        os.environ[key] = value.strip()
except Exception:
    pass

# Selected preview images (the ones you liked)
SELECTED_PREVIEWS = {
    "3d": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/3d/3d_preview_3.png",
    "cartoon": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/cartoon/cartoon_preview_3.png",
    "cyberpunk": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/cyberpunk/cyberpunk_preview_4.png",
    "ghibli": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/ghibli/ghibli_preview_5.png",
    "micro-world": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/micro-world/micro-world_preview_5.png",
    "photorealistic": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/photorealistic/photorealistic_preview_4.png",
    "pixel": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/pixel/pixel_preview_4.png",
}

# You'll need to add anime when it's generated
# "anime": "/path/to/anime_preview.png"

# Output settings
OPTIMIZED_DIR = Path(__file__).parent.parent / "optimized_previews"
TARGET_WIDTH = 400  # Width for thumbnail (height will be auto-scaled to maintain aspect ratio)
JPEG_QUALITY = 85   # JPEG quality (0-100, 85 is good balance)
S3_FOLDER = "style_previews"  # Folder in S3 bucket


def optimize_image(input_path: Path, output_path: Path, target_width: int = 400, quality: int = 85):
    """
    Optimize image for web use - resize and compress

    Args:
        input_path: Path to original image
        output_path: Path to save optimized image
        target_width: Target width in pixels (height auto-scaled)
        quality: JPEG quality (0-100)
    """
    print(f"📸 Optimizing: {input_path.name}")

    # Open image
    img = Image.open(input_path)

    # Convert to RGB if needed (for PNG with transparency)
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background

    # Calculate new dimensions (maintain aspect ratio)
    original_width, original_height = img.size
    aspect_ratio = original_height / original_width
    new_width = target_width
    new_height = int(target_width * aspect_ratio)

    # Resize with high-quality resampling
    img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Save as JPEG with compression
    img_resized.save(output_path, 'JPEG', quality=quality, optimize=True)

    # Print file size reduction
    original_size = input_path.stat().st_size / 1024  # KB
    optimized_size = output_path.stat().st_size / 1024  # KB
    reduction = ((original_size - optimized_size) / original_size) * 100

    print(f"   Original: {original_size:.1f} KB")
    print(f"   Optimized: {optimized_size:.1f} KB")
    print(f"   Reduction: {reduction:.1f}%")
    print()


def upload_to_s3(file_path: Path, bucket_name: str, s3_key: str, region: str):
    """
    Upload file to S3 bucket

    Args:
        file_path: Path to file to upload
        bucket_name: S3 bucket name
        s3_key: S3 object key (path in bucket)
        region: AWS region

    Returns:
        Public URL of uploaded file
    """
    # Get AWS credentials from environment
    access_key = os.getenv('S3_ACCESS_KEY_ID')
    secret_key = os.getenv('S3_SECRET_ACCESS_KEY')

    if not access_key or not secret_key:
        raise ValueError("AWS credentials not found in environment variables")

    # Create S3 client
    s3_client = boto3.client(
        's3',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region
    )

    try:
        # Upload file without ACL (bucket should have public access configured)
        s3_client.upload_file(
            str(file_path),
            bucket_name,
            s3_key,
            ExtraArgs={
                'ContentType': 'image/jpeg'
            }
        )

        # Generate public URL
        url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"
        return url

    except NoCredentialsError:
        raise Exception("AWS credentials not available")
    except Exception as e:
        raise Exception(f"S3 upload failed: {str(e)}")


def main():
    print("="*60)
    print("🎨 Style Preview Optimizer & S3 Uploader")
    print("="*60)
    print(f"\nOptimizing {len(SELECTED_PREVIEWS)} preview images")
    print(f"Target size: {TARGET_WIDTH}px width, JPEG quality {JPEG_QUALITY}")
    print(f"S3 bucket: {os.getenv('BUCKET_NAME', 'Not set')}")
    print(f"S3 folder: {S3_FOLDER}")
    print("\n" + "="*60 + "\n")

    # Check AWS credentials
    bucket_name = os.getenv('BUCKET_NAME')
    region = os.getenv('AWS_REGION', 'us-east-2')

    if not bucket_name:
        print("❌ Error: BUCKET_NAME not set in environment")
        print("\nMake sure your .env file has:")
        print("  BUCKET_NAME=your-bucket-name")
        print("  S3_ACCESS_KEY_ID=your-access-key")
        print("  S3_SECRET_ACCESS_KEY=your-secret-key")
        print("  AWS_REGION=us-east-2")
        return

    # Create output directory
    OPTIMIZED_DIR.mkdir(exist_ok=True)

    # Process each image
    results = {}

    for style_id, image_path in SELECTED_PREVIEWS.items():
        input_path = Path(image_path)

        if not input_path.exists():
            print(f"⚠️  Warning: {style_id} - File not found: {image_path}")
            continue

        # Optimize
        output_filename = f"{style_id}_preview.jpg"
        output_path = OPTIMIZED_DIR / output_filename

        try:
            optimize_image(input_path, output_path, TARGET_WIDTH, JPEG_QUALITY)
        except Exception as e:
            print(f"❌ Error optimizing {style_id}: {str(e)}\n")
            continue

        # Upload to S3
        s3_key = f"{S3_FOLDER}/{output_filename}"

        try:
            print(f"📤 Uploading {output_filename} to S3...")
            url = upload_to_s3(output_path, bucket_name, s3_key, region)
            results[style_id] = url
            print(f"✅ Uploaded: {url}\n")
        except Exception as e:
            print(f"❌ Upload failed for {style_id}: {str(e)}\n")
            continue

    # Print summary
    print("="*60)
    print("📊 SUMMARY")
    print("="*60)
    print(f"\n✅ Successfully processed {len(results)}/{len(SELECTED_PREVIEWS)} images")
    print(f"📁 Optimized files saved to: {OPTIMIZED_DIR}")
    print(f"☁️  Uploaded to S3: {bucket_name}/{S3_FOLDER}/")

    print("\n📋 S3 URLs for each style:")
    print("-" * 60)
    for style_id, url in results.items():
        print(f"{style_id:15} -> {url}")

    # Generate code snippet for frontend
    print("\n" + "="*60)
    print("📝 CODE TO UPDATE IN StoryTheme.tsx")
    print("="*60)
    print("\nReplace the image URLs with:\n")

    style_labels = {
        "ghibli": "지브리",
        "anime": "애니메이션",
        "photorealistic": "포토리얼리스틱",
        "micro-world": "마이크로 월드",
        "cartoon": "애니메이션",
        "3d": "3D 렌더링",
        "pixel": "픽셀 아트",
        "cyberpunk": "사이버펑크"
    }

    for style_id in ["ghibli", "anime", "photorealistic", "micro-world", "cartoon", "3d", "pixel", "cyberpunk"]:
        if style_id in results:
            print(f'''  {{
    id: "{style_id}",
    label: "{style_labels.get(style_id, style_id)}",
    image: "{results[style_id]}"
  }},''')
        else:
            print(f'  // {style_id}: Not processed yet')

    print("\n" + "="*60)
    print("✅ Done!")
    print("="*60)


if __name__ == "__main__":
    main()
