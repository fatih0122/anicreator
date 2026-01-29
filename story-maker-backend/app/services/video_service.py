"""
Video Processing Service
Handles video composition, subtitle generation, and final video rendering
"""

import os
import subprocess
import tempfile
from typing import List, Dict, Any, Optional
import httpx
import uuid


class VideoService:
    """Service for processing and combining videos with narration and subtitles"""

    def __init__(self, s3_service):
        self.s3_service = s3_service

    async def download_file(self, url: str, local_path: str):
        """Download a file from URL to local path"""
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            with open(local_path, 'wb') as f:
                f.write(response.content)

    def create_srt_subtitles(self, text: str, phonemes: Optional[Dict[str, Any]], duration: float, fade_in_duration: float = 0.0, time_offset: float = 0.0) -> str:
        """
        Create SRT subtitle file from phonemes or simple timing

        Args:
            text: The full text to subtitle
            phonemes: Optional phoneme timing data from TTS
            duration: Duration of the audio in seconds
            fade_in_duration: Fade-in duration to offset subtitle timing (default 0.0)
            time_offset: Cumulative time offset for concatenated videos (default 0.0)

        Returns:
            Path to the generated .srt file
        """
        srt_path = tempfile.mktemp(suffix='.srt')

        with open(srt_path, 'w', encoding='utf-8') as f:
            # If we have phoneme data with timing information, use it for word-level subtitles
            if phonemes and isinstance(phonemes, dict):
                symbols = phonemes.get("symbols", [])
                start_times = phonemes.get("start_times_seconds", [])
                durations = phonemes.get("durations_seconds", [])

                if symbols and start_times and durations and len(symbols) == len(start_times) == len(durations):
                    # Create word-by-word subtitles based on phoneme timing
                    print(f"📝 Creating word-level subtitles with {len(symbols)} segments")

                    # Adjust timing to account for:
                    # 1. Cumulative offset from previous segments
                    # 2. Fade-in duration of current segment
                    start_time = time_offset + start_times[0] + fade_in_duration
                    end_time = time_offset + start_times[-1] + durations[-1] + fade_in_duration

                    f.write("1\n")
                    f.write(f"{self._seconds_to_srt_time(start_time)} --> {self._seconds_to_srt_time(end_time)}\n")
                    f.write(f"{text}\n\n")

                    print(f"✅ Created subtitle: {start_time:.2f}s - {end_time:.2f}s (offset: {time_offset:.2f}s)")
                    return srt_path

            # Fallback: Simple subtitle showing full text for entire duration
            # Offset by cumulative time + fade-in duration
            start_time = time_offset + fade_in_duration
            end_time = time_offset + duration
            print(f"📝 Creating simple subtitle: {start_time:.2f}s - {end_time:.2f}s (offset: {time_offset:.2f}s)")
            f.write("1\n")
            f.write(f"{self._seconds_to_srt_time(start_time)} --> {self._seconds_to_srt_time(end_time)}\n")
            f.write(f"{text}\n\n")

        return srt_path

    def _seconds_to_srt_time(self, seconds: float) -> str:
        """Convert seconds to SRT timestamp format (HH:MM:SS,mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    async def combine_videos_with_narration(
        self,
        video_urls: List[str],
        narration_urls: List[str],
        subtitle_texts: List[str],
        phonemes_list: List[Optional[Dict[str, Any]]],
        durations: List[float]
    ) -> str:
        """
        Combine multiple video clips with narration and subtitles into a single video

        Args:
            video_urls: List of video URLs to combine
            narration_urls: List of narration audio URLs (one per video)
            subtitle_texts: List of subtitle texts (one per video)
            phonemes_list: List of phoneme data for subtitle timing
            durations: List of audio durations

        Returns:
            S3 URL of the final combined video
        """
        temp_dir = tempfile.mkdtemp()

        try:
            # Download all videos and audio files
            video_paths = []
            audio_paths = []
            subtitle_paths = []

            print(f"📥 Downloading {len(video_urls)} videos and audio files in parallel...")

            # Define fade transition durations and pause between segments (in seconds)
            FADE_IN_DURATION = 0.5
            FADE_OUT_DURATION = 0.5
            PAUSE_BETWEEN_SEGMENTS = 1.5  # Pause between segments for natural pacing and breathing room

            # Track cumulative time for subtitle timing in final concatenated video
            cumulative_time = 0.0
            segment_durations = []  # Store actual segment durations for later

            # Prepare download tasks for parallel execution
            download_tasks = []
            for i, (video_url, audio_url, subtitle_text, phonemes, duration) in enumerate(
                zip(video_urls, narration_urls, subtitle_texts, phonemes_list, durations)
            ):
                video_path = os.path.join(temp_dir, f"video_{i}.mp4")
                audio_path = os.path.join(temp_dir, f"audio_{i}.mp3")

                video_paths.append(video_path)
                audio_paths.append(audio_path)

                # Store subtitle data for later (we'll create subtitles after calculating segment durations)
                subtitle_paths.append((subtitle_text, phonemes, duration))

                # Add download tasks to list (will run in parallel)
                download_tasks.append(self.download_file(video_url, video_path))
                download_tasks.append(self.download_file(audio_url, audio_path))

            # Download ALL files in parallel for maximum speed
            import asyncio
            await asyncio.gather(*download_tasks)
            print(f"✅ All {len(video_urls)} videos and audio files downloaded")

            # Create segments with video + audio + fade (NO subtitles yet)
            print(f"🎬 Creating {len(video_paths)} video segments with narration...")
            segment_paths = []
            subtitle_data_list = subtitle_paths  # Rename for clarity
            actual_audio_durations = []  # Store ACTUAL probed audio durations for subtitle timing
            cumulative_time = 0.0

            for i, (video_path, audio_path, (subtitle_text, phonemes, passed_audio_duration)) in enumerate(
                zip(video_paths, audio_paths, subtitle_data_list)
            ):
                segment_path = os.path.join(temp_dir, f"segment_{i}.mp4")

                # Get video duration using ffprobe
                probe_cmd = [
                    'ffprobe',
                    '-v', 'error',
                    '-show_entries', 'format=duration',
                    '-of', 'default=noprint_wrappers=1:nokey=1',
                    video_path
                ]
                try:
                    result = subprocess.run(probe_cmd, check=True, capture_output=True, text=True)
                    video_duration = float(result.stdout.strip())
                except:
                    video_duration = 5.0  # Fallback if probe fails
                    print(f"⚠️ Could not probe video duration, using fallback")

                # CRITICAL: Probe ACTUAL audio duration - don't trust passed value!
                # The passed duration might be wrong (e.g., defaulting to 5s)
                audio_probe_cmd = [
                    'ffprobe',
                    '-v', 'error',
                    '-show_entries', 'format=duration',
                    '-of', 'default=noprint_wrappers=1:nokey=1',
                    audio_path
                ]
                try:
                    audio_result = subprocess.run(audio_probe_cmd, check=True, capture_output=True, text=True)
                    audio_duration = float(audio_result.stdout.strip())
                    if abs(audio_duration - passed_audio_duration) > 0.5:
                        print(f"⚠️  Audio duration mismatch! Passed: {passed_audio_duration:.2f}s, Actual: {audio_duration:.2f}s - USING ACTUAL")
                except:
                    audio_duration = passed_audio_duration  # Fallback to passed value
                    print(f"⚠️ Could not probe audio duration, using passed value: {audio_duration:.2f}s")

                print(f"📹 Segment {i+1}: Video={video_duration:.2f}s, Audio={audio_duration:.2f}s (passed: {passed_audio_duration:.2f}s)")

                # Store actual audio duration for subtitle timing later
                actual_audio_durations.append(audio_duration)

                # Determine final duration: use longer of video or audio + safety buffer
                # This ensures audio has enough time to play completely
                # IMPORTANT: TTS must NEVER be cut - video must extend to match audio
                AUDIO_SAFETY_BUFFER = 0.5  # Extra time to ensure audio doesn't get cut off
                base_duration = max(video_duration, audio_duration + AUDIO_SAFETY_BUFFER)
                print(f"   📊 Base duration: {base_duration:.2f}s (video={video_duration:.2f}s, audio={audio_duration:.2f}s + {AUDIO_SAFETY_BUFFER}s buffer)")

                # Build video filter chain (NO subtitles - we'll add them to the final concatenated video)
                video_filters = []

                # Handle video/audio duration mismatch using hybrid approach
                # CRITICAL: Video MUST extend to match audio - TTS should NEVER be cut!
                # Always ensure video is at least as long as base_duration (audio + safety buffer)
                if base_duration > video_duration:
                    print(f"   ⚠️  Audio ({audio_duration:.2f}s) longer than video ({video_duration:.2f}s) - EXTENDING VIDEO to preserve TTS")
                    # Calculate how much we need to extend
                    extend_duration = base_duration - video_duration
                    slowdown_factor = base_duration / video_duration

                    if slowdown_factor <= 1.10:
                        # ≤10% slowdown: Simple setpts (fast, looks fine)
                        video_filters.append(f"setpts=PTS*{slowdown_factor:.4f}")
                        print(f"   🎬 Simple slowdown by {(slowdown_factor-1)*100:.1f}% ({video_duration:.2f}s → {base_duration:.2f}s)")
                    elif base_duration <= 7.0:
                        # >10% slowdown AND target ≤ 7s: Use frame blending for smooth slow motion
                        video_filters.append(f"tblend=all_mode=average,setpts=PTS*{slowdown_factor:.4f}")
                        print(f"   🎬 Smooth slowdown with frame blending: extending by {extend_duration:.2f}s ({video_duration:.2f}s → {base_duration:.2f}s, {(slowdown_factor-1)*100:.1f}% slower)")
                    else:
                        # Target > 7 seconds: Use freeze frame at the end
                        video_filters.append(f"tpad=stop_mode=clone:stop_duration={extend_duration}")
                        print(f"   🎬 Extending video by {extend_duration:.2f}s with freeze frame to match audio + buffer")

                # Add fade transitions (within base_duration)
                video_filters.append(f"fade=t=in:st=0:d={FADE_IN_DURATION}")
                video_filters.append(f"fade=t=out:st={base_duration-FADE_OUT_DURATION}:d={FADE_OUT_DURATION}")

                # Determine if we need to add pause (not for last segment)
                is_last_segment = (i == len(video_paths) - 1)

                # Calculate the natural gap if audio is shorter than video
                natural_gap = video_duration - audio_duration if video_duration > audio_duration else 0

                # Only add explicit pause if needed and not last segment
                if not is_last_segment:
                    # If there's already a natural gap >= PAUSE_BETWEEN_SEGMENTS, don't add more
                    if natural_gap >= PAUSE_BETWEEN_SEGMENTS:
                        # Natural gap is enough, no need to add extra pause
                        additional_pause = 0
                        segment_duration_with_pause = base_duration
                        print(f"   ⏸️  Natural gap of {natural_gap:.2f}s is sufficient (no extra pause needed)")
                    else:
                        # Add pause after both streams finish
                        additional_pause = PAUSE_BETWEEN_SEGMENTS
                        video_filters.append(f"tpad=stop_mode=add:stop_duration={additional_pause}:color=black")
                        segment_duration_with_pause = base_duration + additional_pause
                        print(f"   ⏸️  Adding {additional_pause:.2f}s pause after both streams finish")
                else:
                    additional_pause = 0
                    segment_duration_with_pause = base_duration

                video_filter = ",".join(video_filters)

                # Apply audio filters to match video timing
                #
                # Logic:
                # 1. If audio < base_duration: pad audio with silence
                # 2. Apply gentle fade-in only (NO fade-out - TTS must play completely!)
                # 3. If additional_pause > 0: add extra silence for pause between scenes
                audio_filters = []

                # Step 1: Pad audio to match base_duration if it's shorter
                if audio_duration < base_duration:
                    pad_to_base = base_duration - audio_duration
                    audio_filters.append(f"apad=pad_dur={pad_to_base}")
                    print(f"   🔇 Padding audio with {pad_to_base:.2f}s silence to match base duration")

                # Step 2: Add gentle audio fade-in only (NO fade-out to preserve TTS)
                audio_filters.append(f"afade=t=in:st=0:d=0.1")
                print(f"   🔊 Adding gentle audio fade-in (no fade-out to preserve TTS)")

                # Step 3: Add additional pause if needed
                if additional_pause > 0:
                    audio_filters.append(f"apad=pad_dur={additional_pause}")
                    print(f"   ⏸️  Adding {additional_pause:.2f}s silence for pause between scenes")

                audio_filter = ",".join(audio_filters)

                combine_cmd = [
                    'ffmpeg',
                    '-i', video_path,
                    '-i', audio_path,
                    '-vf', video_filter,
                    '-af', audio_filter,
                    '-c:v', 'libx264',
                    '-c:a', 'aac',
                    '-y',
                    segment_path
                ]

                try:
                    result = subprocess.run(combine_cmd, check=True, capture_output=True, text=True)
                    segment_paths.append(segment_path)

                    # CRITICAL: Probe the ACTUAL duration of the created segment
                    # Don't rely on calculated duration - use what FFmpeg actually created
                    probe_segment_cmd = [
                        'ffprobe',
                        '-v', 'error',
                        '-show_entries', 'format=duration',
                        '-of', 'default=noprint_wrappers=1:nokey=1',
                        segment_path
                    ]

                    try:
                        probe_result = subprocess.run(probe_segment_cmd, check=True, capture_output=True, text=True)
                        actual_segment_duration = float(probe_result.stdout.strip())

                        # Compare calculated vs actual
                        if abs(actual_segment_duration - segment_duration_with_pause) > 0.01:
                            print(f"⚠️  Duration mismatch! Calculated: {segment_duration_with_pause:.3f}s, Actual: {actual_segment_duration:.3f}s")

                        # Use ACTUAL duration for timing calculations
                        segment_durations.append(actual_segment_duration)
                        print(f"✅ Segment {i+1} created (actual duration: {actual_segment_duration:.3f}s, cumulative: {cumulative_time:.3f}s)")
                        cumulative_time += actual_segment_duration

                    except Exception as probe_error:
                        print(f"⚠️  Could not probe segment duration, using calculated: {segment_duration_with_pause:.3f}s")
                        segment_durations.append(segment_duration_with_pause)
                        cumulative_time += segment_duration_with_pause

                except subprocess.CalledProcessError as e:
                    print(f"❌ FFmpeg error creating segment {i}:")
                    print(f"Command: {' '.join(combine_cmd)}")
                    print(f"stderr: {e.stderr}")
                    raise

            # Concatenate all segments (WITHOUT subtitles)
            print(f"🔗 Concatenating {len(segment_paths)} segments...")
            concat_file = os.path.join(temp_dir, 'concat_list.txt')
            with open(concat_file, 'w') as f:
                for segment_path in segment_paths:
                    f.write(f"file '{segment_path}'\n")

            concatenated_video = os.path.join(temp_dir, 'concatenated_no_subs.mp4')
            concat_cmd = [
                'ffmpeg',
                '-f', 'concat',
                '-safe', '0',
                '-i', concat_file,
                '-c', 'copy',
                '-y',
                concatenated_video
            ]

            subprocess.run(concat_cmd, check=True, capture_output=True)
            print(f"✅ Segments concatenated")

            # Create master SRT file with correct cumulative timings
            print(f"📝 Creating master subtitle file with cumulative timings...")
            master_srt = os.path.join(temp_dir, 'master_subtitles.srt')
            cumulative_offset = 0.0

            with open(master_srt, 'w', encoding='utf-8') as f:
                for i, (subtitle_text, phonemes, _passed_duration) in enumerate(subtitle_data_list):
                    segment_duration = segment_durations[i]
                    # Use ACTUAL probed audio duration, not passed value
                    audio_duration = actual_audio_durations[i]

                    # Calculate subtitle timing for this segment
                    # Start: cumulative_offset + fade_in_duration
                    # End: cumulative_offset + segment_duration (or end of audio if shorter)
                    if phonemes and isinstance(phonemes, dict):
                        symbols = phonemes.get("symbols", [])
                        start_times = phonemes.get("start_times_seconds", [])
                        durations_list = phonemes.get("durations_seconds", [])

                        if symbols and start_times and durations_list:
                            # Use phoneme timing
                            start_time = cumulative_offset + start_times[0] + FADE_IN_DURATION
                            end_time = cumulative_offset + start_times[-1] + durations_list[-1] + FADE_IN_DURATION
                        else:
                            # Fallback
                            start_time = cumulative_offset + FADE_IN_DURATION
                            end_time = cumulative_offset + audio_duration
                    else:
                        # Simple timing
                        start_time = cumulative_offset + FADE_IN_DURATION
                        end_time = cumulative_offset + audio_duration

                    # Write SRT entry
                    f.write(f"{i+1}\n")
                    f.write(f"{self._seconds_to_srt_time(start_time)} --> {self._seconds_to_srt_time(end_time)}\n")
                    f.write(f"{subtitle_text}\n\n")

                    print(f"   Subtitle {i+1}: {start_time:.2f}s - {end_time:.2f}s")

                    # Update cumulative offset for next segment
                    cumulative_offset += segment_duration

            print(f"✅ Master subtitle file created")

            # Use custom Korean font (양진체)
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            custom_font_path = os.path.join(base_dir, 'fonts', '양진체v0.93.otf')

            if os.path.exists(custom_font_path):
                font_param = f":fontfile={custom_font_path}"
                print(f"🎨 Using custom Korean font: 양진체")
            elif os.path.exists('/System/Library/Fonts/AppleSDGothicNeo.ttc'):
                font_param = ":fontfile=/System/Library/Fonts/AppleSDGothicNeo.ttc"
                print(f"📝 Using system font: AppleSDGothicNeo")
            else:
                font_param = ":font='Arial Unicode MS'"
                print(f"⚠️ Using fallback font")

            # Burn master subtitles into final video using drawtext (subtitles filter not available)
            print(f"🔥 Burning subtitles into final video...")

            # Build drawtext filter chain from SRT entries
            drawtext_filters = []
            cumulative_offset = 0.0

            for i, (subtitle_text, phonemes, _passed_duration) in enumerate(subtitle_data_list):
                segment_duration = segment_durations[i]
                # Use ACTUAL probed audio duration, not passed value
                audio_duration = actual_audio_durations[i]

                # Calculate timing (same as SRT creation)
                if phonemes and isinstance(phonemes, dict):
                    symbols = phonemes.get("symbols", [])
                    start_times = phonemes.get("start_times_seconds", [])
                    durations_list = phonemes.get("durations_seconds", [])

                    if symbols and start_times and durations_list:
                        start_time = cumulative_offset + start_times[0] + FADE_IN_DURATION
                        end_time = cumulative_offset + start_times[-1] + durations_list[-1] + FADE_IN_DURATION
                    else:
                        start_time = cumulative_offset + FADE_IN_DURATION
                        end_time = cumulative_offset + audio_duration
                else:
                    start_time = cumulative_offset + FADE_IN_DURATION
                    end_time = cumulative_offset + audio_duration

                # Escape subtitle text for drawtext
                subtitle_escaped = subtitle_text.replace("'", "'\\\\\\''").replace(":", "\\:")

                # Create drawtext filter with timing
                # enable='between(t,start,end)' shows text only during specified time range
                drawtext_filter = (
                    f"drawtext=text='{subtitle_escaped}'{font_param}:"
                    f"fontsize=56:fontcolor=white:"
                    f"shadowcolor=black@0.7:shadowx=3:shadowy=3:"
                    f"x=(w-text_w)/2:y=h-120:"
                    f"enable='between(t,{start_time},{end_time})'"
                )
                drawtext_filters.append(drawtext_filter)

                cumulative_offset += segment_duration

            # Combine all drawtext filters
            video_filter = ",".join(drawtext_filters)

            final_output = os.path.join(temp_dir, 'final_video.mp4')
            burn_subs_cmd = [
                'ffmpeg',
                '-i', concatenated_video,
                '-vf', video_filter,
                '-c:v', 'libx264',
                '-c:a', 'copy',
                '-y',
                final_output
            ]

            try:
                subprocess.run(burn_subs_cmd, check=True, capture_output=True, text=True)
                print(f"✅ Final video with subtitles created")
            except subprocess.CalledProcessError as e:
                print(f"❌ FFmpeg error burning subtitles:")
                print(f"Command: {' '.join(burn_subs_cmd)}")
                print(f"stderr: {e.stderr}")
                raise

            # Upload to S3
            with open(final_output, 'rb') as f:
                video_data = f.read()

            final_filename = f"final_video_{uuid.uuid4()}.mp4"
            final_url = self.s3_service.upload_video_data(
                video_data=video_data,
                filename=final_filename,
                folder="final_videos",
                content_type="video/mp4"
            )

            print(f"✅ Final video uploaded to S3: {final_url}")
            return final_url

        finally:
            # Cleanup temp files
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
