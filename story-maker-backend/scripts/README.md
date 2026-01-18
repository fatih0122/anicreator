# Scripts Directory

This directory contains utility scripts for generating preview content.

## 1. Voice Preview Generation Script

This script generates TTS voice previews for all available voices using Supertone API and uploads them to S3.

## Prerequisites

1. **Environment Variables** - Make sure your `.env` file has:
   ```bash
   SUPERTONE_API_KEY=e710d06c1cac650e2bfcbca99f635194
   BUCKET_NAME=your-s3-bucket-name
   S3_ACCESS_KEY_ID=your-aws-access-key
   S3_SECRET_ACCESS_KEY=your-aws-secret-key
   AWS_REGION=us-east-2
   ```

2. **Python Dependencies** - Install required packages:
   ```bash
   pip install httpx boto3
   ```

## Usage

Run the script from the backend directory:

```bash
cd /Users/fatihwolf/Documents/story-maker-backend
python scripts/generate_voice_previews.py
```

## What It Does

1. **Reads voice configuration** from `app/config/voices.py`
2. **Generates TTS audio** for each voice using their preview script
3. **Uploads to S3** in the `voice_previews/` folder
4. **Prints results** with URLs for each voice

## Output

The script will create files in S3:
- `voice_previews/준호.mp3`
- `voice_previews/소피아.mp3`
- `voice_previews/민석.mp3`
- `voice_previews/엠마.mp3`
- `voice_previews/지아.mp3`
- `voice_previews/라이언.mp3`
- `voice_previews/태민.mp3`
- `voice_previews/제임스.mp3`
- `voice_previews/채원.mp3`
- `voice_previews/우진.mp3`

## Example Output

```
============================================================
Starting Voice Preview Generation
============================================================

🔧 Initializing Supertone TTS service...

📢 Processing: 준호
   Voice ID: ab7cd18e645b54d7536e0f
   Script: 어느 화창한 아침, 모모는 창가에 앉아 밖을 바라보았어요...

🎙️  Generating preview for 준호 (ab7cd18e645b54d7536e0f)...
✅ Generated 45231 bytes for 준호
📤 Uploading 준호.mp3 to S3...
✅ Uploaded to: https://your-bucket.s3.us-east-2.amazonaws.com/voice_previews/준호.mp3

...

============================================================
Generation Complete!
============================================================

✅ Successfully generated 10 voice previews:

   준호         -> https://your-bucket.s3.us-east-2.amazonaws.com/voice_previews/준호.mp3
   소피아       -> https://your-bucket.s3.us-east-2.amazonaws.com/voice_previews/소피아.mp3
   ...
```

## Troubleshooting

**Error: "SUPERTONE_API_KEY environment variable is not set"**
- Make sure your `.env` file contains the API key

**Error: "BUCKET_NAME environment variable is not set"**
- Add your S3 bucket name to `.env`

**Error: 422 from Supertone API**
- Check if voice_id is correct
- Verify API key is valid
- Ensure text is under 300 characters

**Error: S3 upload failed**
- Verify AWS credentials in `.env`
- Check bucket permissions (needs PutObject access)
- Ensure bucket exists in the specified region

---

## 2. Style Preview Generation Script

Automatically generates 5 preview image variations for each of the 8 story styles using KIE Nano Banana.

### Features

- ✅ Generates 5 variations per style (40 images total)
- ✅ Downloads images automatically to local folders
- ✅ Organizes by style (one folder per style)
- ✅ Creates a summary file with all URLs
- ✅ Parallel generation for faster processing
- ✅ Progress tracking and error handling

### Prerequisites

1. **Set the KIE API key** - You have two options:

   **Option A: Environment variable (temporary - for current terminal session)**
   ```bash
   export KIE_API_KEY="your-api-key-here"
   ```

   **Option B: Add to .env file (permanent - recommended)**
   ```bash
   # In /Users/fatihwolf/Documents/story-maker-backend/.env
   KIE_API_KEY=your-api-key-here
   ```

2. Install dependencies (if not already installed):
   ```bash
   pip install aiohttp
   ```

   Note: The script is standalone and doesn't require importing the main app, so it won't conflict with other services.

### Usage

From the backend directory, run:

```bash
python scripts/generate_style_previews.py
```

### Output Structure

```
story-maker-backend/
└── generated_previews/
    ├── generation_summary.txt          # Summary with all URLs
    ├── ghibli/
    │   ├── ghibli_preview_1.png
    │   ├── ghibli_preview_2.png
    │   ├── ghibli_preview_3.png
    │   ├── ghibli_preview_4.png
    │   └── ghibli_preview_5.png
    ├── anime/
    │   ├── anime_preview_1.png
    │   └── ...
    ├── photorealistic/
    ├── micro-world/
    ├── cartoon/
    ├── 3d/
    ├── pixel/
    └── cyberpunk/
```

### Styles Generated

1. **ghibli** (지브리) - Studio Ghibli animation style
2. **anime** (애니메이션) - Anime art style
3. **photorealistic** (포토리얼리스틱) - Photorealistic style
4. **micro-world** (마이크로 월드) - Micro world/miniature style
5. **cartoon** (카툰) - Cartoon illustration style
6. **3d** (3D 렌더링) - 3D rendered style
7. **pixel** (픽셀 아트) - Pixel art style
8. **cyberpunk** (사이버펑크) - Cyberpunk style

### What Happens Next?

After running the script:

1. Review the generated images in `generated_previews/` folders
2. Choose your favorite preview for each style
3. Upload the selected images to your image hosting service (e.g., Unsplash, Imgur, S3)
4. Update the `image` URLs in `app/components/StoryTheme.tsx` with the hosted URLs

### Example: Updating StoryTheme.tsx

```typescript
const styles = [
  {
    id: "ghibli",
    label: "지브리",
    image: "https://your-host.com/ghibli_preview_3.png"  // Update this
  },
  // ... rest of the styles
];
```

### Troubleshooting

**Error: KIE_API_KEY not set**
- Make sure you've exported the KIE_API_KEY environment variable
- Check: `echo $KIE_API_KEY`

**Error: Module not found**
- Make sure you're running from the backend directory
- Install dependencies: `pip install aiohttp`

**Generation fails for some styles**
- The script will continue even if some styles fail
- Check the error messages in the output
- Failed styles can be regenerated individually

### Estimated Time

- Each image takes approximately 10-20 seconds to generate
- 5 images per style = ~1-2 minutes per style
- Total for 8 styles = ~10-15 minutes

The script generates all images in parallel per style, so it's optimized for speed.
