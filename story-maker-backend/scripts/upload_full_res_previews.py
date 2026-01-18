"""
Upload Full Resolution Style Preview Images to S3

This script uploads the full resolution preview images to S3 without any optimization.

Usage:
    python scripts/upload_full_res_previews.py
"""

import os
from pathlib import Path
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

# Selected preview images (full resolution)
SELECTED_PREVIEWS = {
    "3d": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/3d/3d_preview_3.png",
    "animation": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/cartoon/cartoon_preview_3.png",
    "cyberpunk": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/cyberpunk/cyberpunk_preview_4.png",
    "ghibli": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/ghibli/ghibli_preview_5.png",
    "micro-world": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/micro-world/micro-world_preview_5.png",
    "photorealistic": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/photorealistic/photorealistic_preview_4.png",
    "pixel": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/pixel/pixel_preview_4.png",
    "anime": "/Users/fatihwolf/Documents/story-maker-backend/generated_previews/anime/anime_preview_2.png",
}

# S3 settings
S3_FOLDER = "style_previews"


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
        # Upload file without ACL
        s3_client.upload_file(
            str(file_path),
            bucket_name,
            s3_key,
            ExtraArgs={
                'ContentType': 'image/png'
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
    print("🎨 Full Resolution Preview Uploader")
    print("="*60)
    print(f"\nUploading {len(SELECTED_PREVIEWS)} full resolution images")
    print(f"S3 bucket: {os.getenv('BUCKET_NAME', 'Not set')}")
    print(f"S3 folder: {S3_FOLDER}")
    print("\n" + "="*60 + "\n")

    # Check AWS credentials
    bucket_name = os.getenv('BUCKET_NAME')
    region = os.getenv('AWS_REGION', 'us-east-2')

    if not bucket_name:
        print("❌ Error: BUCKET_NAME not set in environment")
        return

    # Process each image
    results = {}

    for style_id, image_path in SELECTED_PREVIEWS.items():
        input_path = Path(image_path)

        if not input_path.exists():
            print(f"⚠️  Warning: {style_id} - File not found: {image_path}")
            continue

        # Get file size
        file_size_mb = input_path.stat().st_size / (1024 * 1024)
        print(f"📸 {style_id}: {file_size_mb:.2f} MB")

        # Upload to S3
        output_filename = f"{style_id}_preview.png"
        s3_key = f"{S3_FOLDER}/{output_filename}"

        try:
            print(f"📤 Uploading {output_filename} to S3...")
            url = upload_to_s3(input_path, bucket_name, s3_key, region)
            results[style_id] = url
            print(f"✅ Uploaded: {url}\n")
        except Exception as e:
            print(f"❌ Upload failed for {style_id}: {str(e)}\n")
            continue

    # Print summary
    print("="*60)
    print("📊 SUMMARY")
    print("="*60)
    print(f"\n✅ Successfully uploaded {len(results)}/{len(SELECTED_PREVIEWS)} images")
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
        "anime": "아니메",
        "photorealistic": "포토리얼리스틱",
        "micro-world": "마이크로 월드",
        "animation": "디즈니 애니메이션",
        "3d": "3D 렌더링",
        "pixel": "픽셀 아트",
        "cyberpunk": "사이버펑크"
    }

    for style_id in ["ghibli", "anime", "photorealistic", "micro-world", "animation", "3d", "pixel", "cyberpunk"]:
        if style_id in results:
            print(f'''  {{
    id: "{style_id}",
    label: "{style_labels.get(style_id, style_id)}",
    image: "{results[style_id]}"
  }},''')
        else:
            print(f'  // {style_id}: Not uploaded')

    print("\n" + "="*60)
    print("✅ Done!")
    print("="*60)


if __name__ == "__main__":
    main()
