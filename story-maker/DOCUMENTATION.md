# Stobee Story Maker - Project Documentation

## Overview

**Stobee Story Maker** is an AI-powered animated story generation platform for children. It allows users to create personalized animated stories by selecting visual styles, creating custom characters, and generating AI-powered scripts, images, videos, and narration.

**Live Backend:** https://stobee-v1.up.railway.app

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Project Structure](#project-structure)
3. [User Flow / Steps](#user-flow--steps)
4. [Key Features](#key-features)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [Authentication](#authentication)
8. [Component Reference](#component-reference)

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.5.6 | React framework with App Router |
| **React** | 18.3.1 | UI library |
| **TypeScript** | 5.9.3 | Type safety |
| **Tailwind CSS** | 4.1.15 | Utility-first styling |
| **Radix UI** | Various | Accessible UI components |
| **shadcn/ui** | - | Pre-built component library |
| **Lucide React** | 0.487.0 | Icon library |

### Media & Video

| Technology | Purpose |
|------------|---------|
| **Plyr React** | Video player |
| **React H5 Audio Player** | Audio player |
| **Remotion** | Programmatic video composition |
| **Embla Carousel** | Image/video carousels |

### Backend (Separate Repository)

| Technology | Purpose |
|------------|---------|
| **Python** | Backend language |
| **FastAPI** | API framework |
| **Celery** | Background task queue |
| **Redis** | Task broker |
| **Railway** | Cloud deployment |
| **AWS S3** | Asset storage |

### AI Services (Backend)

| Service | Purpose |
|---------|---------|
| **OpenAI GPT** | Story script generation |
| **Kling AI** | Video generation |
| **Image Generation AI** | Scene image generation |
| **Text-to-Speech** | Narration generation |

---

## Project Structure

```
story-maker/
├── app/
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components (60+)
│   │   ├── Header.tsx       # App header with auth
│   │   ├── AppSidebar.tsx   # Navigation sidebar
│   │   ├── Login.tsx        # Login form
│   │   ├── StoryTheme.tsx   # Style selection
│   │   ├── StoryNarration.tsx # Theme & voice selection
│   │   ├── CharacterCreation.tsx # Character creator
│   │   └── SceneGeneration.tsx # Scene editor
│   │
│   ├── context/             # React Context
│   │   ├── AuthContext.tsx  # Authentication state
│   │   └── StoryContext.tsx # Story creation state
│   │
│   ├── create/              # Story creation pages
│   │   ├── start/           # Step 0: Start
│   │   ├── style/           # Step 1: Select style
│   │   ├── category/        # Step 2: Theme & voice
│   │   ├── character/       # Step 3: Create character
│   │   ├── scene/           # Step 4: Generate scenes
│   │   └── final/           # Step 5: Final video
│   │
│   ├── services/
│   │   └── api.ts           # Backend API client (721 lines)
│   │
│   ├── imports/             # SVG assets
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page
│   ├── page-content.tsx     # Home content
│   └── providers.tsx        # Global providers
│
├── lib/                     # Utility functions
├── middleware.ts            # Route protection
├── .env.local               # Environment variables
├── next.config.js           # Next.js config
├── package.json             # Dependencies
└── tsconfig.json            # TypeScript config
```

---

## User Flow / Steps

### Step 0: Landing & Authentication

**Route:** `/`

1. User visits the landing page
2. Sees video examples and hero section
3. Clicks "만들기" (Create) or "로그인" (Login)
4. Enters admin credentials
5. Gets redirected to create flow

### Step 1: Select Visual Style

**Route:** `/create/style`

**Component:** `StoryTheme.tsx`

1. User sees 8 visual style options:
   - Ghibli (지브리)
   - Anime (애니메이션)
   - Photorealistic (실사)
   - Micro World (마이크로월드)
   - Disney Animation (디즈니 애니메이션)
   - 3D Rendering (3D 렌더링)
   - Pixel Art (픽셀아트)
   - Cyberpunk (사이버펑크)

2. Each style shows preview images
3. User selects one style
4. Clicks "다음" (Next)

### Step 2: Configure Story

**Route:** `/create/category`

**Component:** `StoryNarration.tsx`

1. **Select Themes** (multiple choice):
   - Adventure (모험)
   - Friendship (우정)
   - Magic (마법)
   - Nature (자연)
   - Space (우주)
   - Mystery (미스터리)
   - Custom theme option

2. **Configure Scene Count**:
   - Slider: 3-10 scenes
   - Default: 5 scenes

3. **Select Narrator Voice**:
   - Multiple voice options
   - Preview button to hear samples
   - Default: "라이언" (Ryan)

4. Clicks "다음" (Next)

### Step 3: Create Character

**Route:** `/create/character`

**Component:** `CharacterCreation.tsx`

**Sub-step 3.1: Choose Method**
- AI Generation (AI 생성)
- Upload Image (이미지 업로드)

**Sub-step 3.2: Enter Details**
- Character Name (캐릭터 이름)
- Character Type (캐릭터 유형):
  - Human (인간)
  - Animal (동물)
  - Robot (로봇)
  - Fantasy (판타지)
- Personality Traits (성격 특성) - up to 3:
  - Brave (용감한)
  - Kind (친절한)
  - Curious (호기심 많은)
  - Funny (유머러스한)
  - Smart (똑똑한)
  - Creative (창의적인)

**Sub-step 3.3: Select Character**
- View 2 AI-generated character options
- Or view variations from uploaded image
- Select favorite character
- Clicks "다음" (Next)

### Step 4: Generate & Edit Scenes

**Route:** `/create/scene`

**Component:** `SceneGeneration.tsx`

**Automatic Generation Pipeline:**
1. Generate story script (AI creates title + scene scripts)
2. Generate image prompts (for each scene)
3. Generate side character images (if any)
4. Generate scene images (incremental, shows as completed)
5. Generate video prompts
6. Generate videos (incremental, shows as completed)
7. Generate narration audio with phonemes

**User Can Edit:**
- Scene text/script
- Regenerate individual images
- Regenerate individual videos
- Regenerate individual narrations
- Play/preview any scene

**Progress Tracking:**
- Real-time status updates
- Progress bar
- Partial results display immediately

### Step 5: Final Video

**Route:** `/create/final`

1. Auto-combines all scenes into final video
2. Adds narration audio tracks
3. Adds word-level subtitles (from phoneme data)
4. Displays complete video player
5. **Download** button to save MP4
6. (Coming soon) **Share** button

---

## Key Features

### 1. AI-Powered Story Generation
- Complete story scripts generated by AI
- Context-aware (uses themes, character details)
- Visual blueprint tracking for consistency

### 2. Character Creation
- AI generation with style matching
- Upload custom images with AI variations
- 2 options per generation for user choice

### 3. Incremental Asset Generation
- Scenes appear as they're completed
- Non-blocking UI during generation
- Real-time progress updates

### 4. Scene Editing
- Edit any scene's text
- Regenerate individual assets
- Preview audio and video inline

### 5. Multi-Voice Narration
- Multiple Korean voice options
- Voice preview before selection
- Word-level phoneme data for subtitles

### 6. Visual Consistency
- Visual blueprint tracks:
  - Locations
  - Important objects
  - Side characters
- Ensures consistency across scenes

### 7. State Persistence
- All progress saved to localStorage
- Resume where you left off
- Survives page refreshes

### 8. Protected Routes
- Authentication required for creation
- Single admin account
- Session persists across browser sessions

---

## State Management

### AuthContext

**Purpose:** Manages user authentication

```typescript
interface AuthContextType {
  isAuthenticated: boolean;
  user: { email: string } | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}
```

**Storage:** localStorage
- `story-maker-auth`: "true" | null
- `story-maker-user`: email string

### StoryContext

**Purpose:** Manages entire story creation state

**Major State Categories:**

1. **Style & Theme**
   - `selectedStyle`: Full style prompt
   - `selectedThemes`: Array of theme IDs
   - `customTheme`: User's custom theme

2. **Narration**
   - `narrationVoice`: Voice ID
   - `sceneCount`: Number of scenes (3-10)

3. **Character**
   - `characterName`, `characterType`, `personality`
   - `characterOptions`: Generated options
   - `characterImageUrl`: Selected character
   - `characterCreationStep`: Current sub-step

4. **Story**
   - `storyTitle`: Generated title
   - `scenes`: Array of scene data
   - `visualBlueprint`: Locations & objects

5. **Generated Assets**
   - `sceneImages`: Image URLs
   - `videos`: Video URLs
   - `finalVideoUrl`: Combined video

**Features:**
- Auto-invalidation of downstream data
- Debounced saves (300ms)
- localStorage persistence
- Resume from `lastVisitedPage`

---

## API Integration

### Base URL

```
Production: https://stobee-v1.up.railway.app
Development: http://localhost:8000
```

### Background Job Pattern

All long-running operations use background jobs:

```typescript
// 1. Start job
const { job_id } = await api.generateCharacter(...);

// 2. Poll until complete
const result = await api.pollJobUntilComplete(
  job_id,
  (progress) => {
    // Update UI with progress
    console.log(`${progress.current}/${progress.total}`);
    // Use progress.partialResults for incremental updates
  }
);
```

### Main API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/voices` | GET | Get available narrator voices |
| `/api/category/save` | POST | Save theme & voice selection |
| `/api/character/details` | POST | Save character details |
| `/api/character/generate` | POST | Generate character (job) |
| `/api/character/upload` | POST | Upload character image |
| `/api/story/generate-script` | POST | Generate story script (job) |
| `/api/story/generate-images` | POST | Generate scene images (job) |
| `/api/story/generate-videos` | POST | Generate videos (job) |
| `/api/narration/generate-batch` | POST | Generate narrations (job) |
| `/api/video/generate-final` | POST | Generate final video (job) |
| `/api/job/{job_id}` | GET | Get job status |

---

## Authentication

### Configuration

**Environment Variables** (`.env.local`):

```env
NEXT_PUBLIC_API_URL=https://stobee-v1.up.railway.app
NEXT_PUBLIC_ADMIN_EMAIL=admin@stobee.com
NEXT_PUBLIC_ADMIN_PASSWORD=Stobee2025!
```

### How It Works

1. User enters email and password
2. Credentials validated against environment variables
3. On success:
   - `isAuthenticated` set to `true`
   - User info stored in localStorage
   - Redirect to `/create/start`

4. On page load:
   - Check localStorage for auth status
   - Auto-restore authentication

5. Protected routes:
   - Middleware checks auth status
   - Layout redirects if not authenticated

### Changing Credentials

Edit `.env.local`:

```env
NEXT_PUBLIC_ADMIN_EMAIL=your-email@example.com
NEXT_PUBLIC_ADMIN_PASSWORD=YourSecurePassword123!
```

Restart the development server after changes.

---

## Component Reference

### Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Header | `/app/components/Header.tsx` | App header with auth |
| AppSidebar | `/app/components/AppSidebar.tsx` | Navigation sidebar |
| Login | `/app/components/Login.tsx` | Login form |
| CreateStart | `/app/components/CreateStart.tsx` | Start screen |
| StoryTheme | `/app/components/StoryTheme.tsx` | Style selection |
| StoryNarration | `/app/components/StoryNarration.tsx` | Theme/voice selection |
| CharacterCreation | `/app/components/CharacterCreation.tsx` | Character creator |
| SceneGeneration | `/app/components/SceneGeneration.tsx` | Scene editor |

### UI Components

Located in `/app/components/ui/`:

- Button, Input, Label, Checkbox
- Dialog, Sheet, Drawer
- Select, Slider, Switch
- Card, Tabs, Accordion
- Progress, Toast, Alert
- And 50+ more from shadcn/ui

---

## Running the Project

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Environment Setup

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://stobee-v1.up.railway.app
NEXT_PUBLIC_ADMIN_EMAIL=admin@stobee.com
NEXT_PUBLIC_ADMIN_PASSWORD=Stobee2025!
```

---

## Troubleshooting

### API Not Connecting

1. Check if backend is running: https://stobee-v1.up.railway.app
2. Verify `NEXT_PUBLIC_API_URL` in `.env.local`
3. Restart development server after env changes
4. Check browser console for CORS errors

### Login Not Working

1. Check credentials in `.env.local`
2. Clear localStorage: `localStorage.clear()`
3. Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)

### Generation Tasks Stuck

1. Backend worker queue may be full
2. Check backend logs for errors
3. Long-running video tasks (9+ minutes) may timeout
4. Try regenerating individual scenes

---

## Summary

**Stobee Story Maker** is a comprehensive AI-powered story creation platform that:

- Uses **Next.js 15** with **React 18** and **TypeScript**
- Styled with **Tailwind CSS** and **shadcn/ui** components
- Connects to a **FastAPI** backend with **Celery** task queue
- Stores assets on **AWS S3**
- Generates stories through a 5-step workflow
- Features AI-powered character, image, video, and narration generation
- Provides real-time progress updates with incremental results
- Persists all state to localStorage for seamless resumption

**Languages Used:**
- TypeScript/JavaScript (Frontend)
- Python (Backend)
- CSS/Tailwind (Styling)

**Total Lines of Code:**
- API Service: ~721 lines
- Story Context: ~635 lines
- Scene Generation: ~1000+ lines
- 60+ UI components
