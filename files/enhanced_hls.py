# Enhanced HLS Generation with Multi-Audio and Subtitle Support

import os
import json
import logging
import subprocess
import tempfile
from django.conf import settings
from files.models import Media
from files import helpers

logger = logging.getLogger(__name__)

def get_audio_track_name(audio_file):
    """Generate a proper name for an audio track based on language"""
    language = audio_file.get('language', '').lower()
    title = audio_file.get('title', '').strip()
    
    # Language name mapping
    language_names = {
        'eng': 'English',
        'en': 'English',
        'ara': 'Arabic',
        'ar': 'Arabic',
        'fre': 'French',
        'fr': 'French',
        'fra': 'French',
        'deu': 'German',
        'de': 'German',
        'spa': 'Spanish',
        'es': 'Spanish',
        'ita': 'Italian',
        'it': 'Italian',
        'por': 'Portuguese',
        'pt': 'Portuguese',
        'rus': 'Russian',
        'ru': 'Russian',
        'jpn': 'Japanese',
        'ja': 'Japanese',
        'kor': 'Korean',
        'ko': 'Korean',
        'zho': 'Chinese',
        'chi': 'Chinese',
        'zh': 'Chinese',
        'hin': 'Hindi',
        'ben': 'Bengali',
        'ind': 'Indonesian',
        'pol': 'Polish'
    }
    
    # Use language name if available
    if language in language_names:
        return language_names[language]
    
    # Use title if it's meaningful
    if title and len(title) > 2 and not title.startswith('Audio Track'):
        return title
    
    # Fallback to language code
    if language:
        return language.upper()
    
    # Final fallback
    return 'Audio Track'

def get_subtitle_track_name(subtitle_file):
    """Generate a proper name for a subtitle track based on language"""
    language = subtitle_file.get('language', '').lower()
    title = subtitle_file.get('title', '').strip()
    
    # Language name mapping
    language_names = {
        'eng': 'English',
        'en': 'English',
        'ara': 'Arabic',
        'ar': 'Arabic',
        'fre': 'French',
        'fr': 'French',
        'fra': 'French',
        'deu': 'German',
        'de': 'German',
        'spa': 'Spanish',
        'es': 'Spanish',
        'ita': 'Italian',
        'it': 'Italian',
        'por': 'Portuguese',
        'pt': 'Portuguese',
        'rus': 'Russian',
        'ru': 'Russian',
        'jpn': 'Japanese',
        'ja': 'Japanese',
        'kor': 'Korean',
        'ko': 'Korean',
        'zho': 'Chinese',
        'chi': 'Chinese',
        'zh': 'Chinese',
        'hin': 'Hindi',
        'ben': 'Bengali',
        'ind': 'Indonesian',
        'pol': 'Polish'
    }
    
    # Use language name if available
    if language in language_names:
        return language_names[language]
    
    # Use title if it's meaningful
    if title and len(title) > 2 and not title.startswith('Subtitle'):
        return title
    
    # Fallback to language code
    if language:
        return language.upper()
    
    # Final fallback
    return 'Subtitle'

def ffprobe_list_streams(media_file_path):
    """Detect all streams in the media file using ffprobe"""
    cmd = [
        settings.FFPROBE_COMMAND,
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        media_file_path
    ]
    
    try:
        result = helpers.run_command(cmd)
        if result.get("out"):
            data = json.loads(result["out"])
            return data.get("streams", [])
    except Exception as e:
        logger.error(f"Error detecting streams: {e}")
    
    return []

def detect_audio_streams(streams):
    """Extract audio stream information"""
    audio_streams = []
    for i, stream in enumerate(streams):
        if stream.get("codec_type") == "audio":
            audio_info = {
                "index": stream.get("index", i),
                "codec": stream.get("codec_name", "unknown"),
                "language": stream.get("tags", {}).get("language", "unknown"),
                "title": stream.get("tags", {}).get("title", ""),
                "channels": stream.get("channels", 2),
                "sample_rate": stream.get("sample_rate", "48000")
            }
            # Use the proper naming function
            audio_info["display_name"] = get_audio_track_name(audio_info)
            audio_streams.append(audio_info)
    
    return audio_streams

def detect_subtitle_streams(streams):
    """Extract subtitle stream information"""
    subtitle_streams = []
    for i, stream in enumerate(streams):
        if stream.get("codec_type") == "subtitle":
            subtitle_info = {
                "index": stream.get("index", i),
                "codec": stream.get("codec_name", "unknown"),
                "language": stream.get("tags", {}).get("language", "unknown"),
                "title": stream.get("tags", {}).get("title", ""),
                "format": stream.get("codec_name", "unknown")
            }
            # Use the proper naming function
            subtitle_info["display_name"] = get_subtitle_track_name(subtitle_info)
            subtitle_streams.append(subtitle_info)
    
    return subtitle_streams

def convert_subtitle_to_webvtt(media_file_path, subtitle_index, output_path):
    """Convert subtitle stream to WebVTT format"""
    cmd = [
        settings.FFMPEG_COMMAND,
        "-i", media_file_path,
        "-map", f"0:{subtitle_index}",
        "-c:s", "webvtt",
        "-y",  # Overwrite output file
        output_path
    ]
    
    try:
        result = helpers.run_command(cmd)
        # Check if the output file was created successfully
        return os.path.exists(output_path) and os.path.getsize(output_path) > 0
    except Exception as e:
        logger.error(f"Error converting subtitle to WebVTT: {e}")
        return False

def create_audio_rendition(media_file_path, audio_index, output_path):
    """Create AAC audio rendition from specific audio stream with proper synchronization"""
    cmd = [
        settings.FFMPEG_COMMAND,
        "-i", media_file_path,
        "-map", f"0:{audio_index}",  # Map specific audio track
        "-c:a", "aac",               # Convert to AAC
        "-b:a", "128k",             # 128k bitrate
        "-ac", "2",                 # Stereo output
        "-ar", "48000",             # 48kHz sample rate
        "-avoid_negative_ts", "make_zero",  # Fix timing issues
        "-fflags", "+genpts",       # Generate presentation timestamps
        "-y",                       # Overwrite output file
        output_path
    ]
    
    try:
        result = helpers.run_command(cmd)
        # Check if the output file was created successfully
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            logger.info(f"Successfully created audio rendition: {output_path}")
            return True
        else:
            logger.error(f"Audio rendition creation failed: {output_path}")
            return False
    except Exception as e:
        logger.error(f"Error creating audio rendition: {e}")
        return False

def create_hls_with_audio_tracks(original_file_path, output_dir, audio_streams, video_files):
    """Create HLS with embedded audio tracks using FFmpeg"""
    logger.info("Creating HLS with embedded audio tracks...")
    
    try:
        # Create video segments with embedded audio tracks
        for i, video_file in enumerate(video_files):
            # Get video file info to determine resolution
            cmd = [
                settings.FFPROBE_COMMAND,
                "-v", "quiet",
                "-print_format", "json",
                "-show_streams",
                video_file
            ]
            
            result = helpers.run_command(cmd)
            if not result.get("out"):
                logger.error(f"Failed to get video info for {video_file}")
                continue
                
            video_info = json.loads(result["out"])
            video_stream = next((s for s in video_info.get("streams", []) if s.get("codec_type") == "video"), None)
            
            if not video_stream:
                logger.error(f"No video stream found in {video_file}")
                continue
                
            height = video_stream.get("height", 480)
            resolution = f"media-{i+1}"
            
            # Create directory for this resolution
            resolution_dir = os.path.join(output_dir, resolution)
            os.makedirs(resolution_dir, exist_ok=True)
            
            # Create HLS segments with embedded audio tracks
            for j, audio_stream in enumerate(audio_streams):
                output_segments = os.path.join(resolution_dir, f"audio_{j}_%03d.ts")
                output_playlist = os.path.join(resolution_dir, f"audio_{j}.m3u8")
                
                cmd = [
                    settings.FFMPEG_COMMAND,
                    "-i", original_file_path,
                    "-map", f"0:v",  # Map video stream
                    "-map", f"0:{audio_stream['index']}",  # Map specific audio track
                    "-c:v", "libx264",  # Video codec
                    "-c:a", "aac",      # Audio codec
                    "-b:a", "128k",     # Audio bitrate
                    "-preset", "fast",   # Encoding preset
                    "-hls_time", "4",    # Segment duration
                    "-hls_list_size", "0",  # Keep all segments
                    "-hls_segment_filename", output_segments,
                    "-f", "hls",
                    "-y",
                    output_playlist
                ]
                
                logger.info(f"Creating HLS segments for {resolution} with audio track {j}")
                result = helpers.run_command(cmd)
                
                if result.get("error"):
                    logger.error(f"Failed to create HLS segments for {resolution} audio {j}: {result.get('error')}")
                else:
                    logger.info(f"Successfully created HLS segments for {resolution} audio {j}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error creating HLS with audio tracks: {e}")
        return False

def create_synchronized_audio_tracks(original_file_path, output_dir, audio_streams):
    """Create synchronized audio tracks for HLS playback"""
    logger.info("Creating synchronized audio tracks...")
    
    audio_files = []
    
    for i, audio_stream in enumerate(audio_streams):
        audio_output_path = os.path.join(output_dir, f"audio_{i}.m4a")
        
        # Create synchronized audio track with proper timing
        if create_audio_rendition(original_file_path, audio_stream["index"], audio_output_path):
            # Create segmented audio stream playlist for HLS compatibility
            audio_playlist_path = os.path.join(output_dir, f"audio_{i}.m3u8")
            if create_audio_stream_playlist(audio_output_path, audio_playlist_path):
                # Use segmented playlist instead of single audio file
                audio_name = os.path.splitext(os.path.basename(audio_output_path))[0]
                segmented_playlist = f"{audio_name}_segments.m3u8"
                segmented_playlist_path = os.path.join(output_dir, segmented_playlist)
                
                audio_files.append({
                    "file": audio_output_path,
                    "playlist": segmented_playlist_path if os.path.exists(segmented_playlist_path) else audio_playlist_path,
                    "language": audio_stream["language"],
                    "title": get_audio_track_name({"language": audio_stream["language"], "title": audio_stream["title"]}),
                    "index": i,
                    "original_index": audio_stream["index"]
                })
                logger.info(f"Created synchronized audio track {i}: {audio_files[-1]['title']}")
            else:
                logger.error(f"Failed to create audio playlist for track {i}")
        else:
            logger.error(f"Failed to create audio rendition for track {i}")
    
    logger.info(f"Successfully created {len(audio_files)} synchronized audio tracks")
    return audio_files

def create_audio_stream_playlist(audio_file_path, playlist_path):
    """Create segmented HLS audio stream playlist for proper audio track switching"""
    try:
        # Get the directory of the audio file
        audio_dir = os.path.dirname(audio_file_path)
        audio_filename = os.path.basename(audio_file_path)
        audio_name = os.path.splitext(audio_filename)[0]
        
        # Create segmented audio stream using FFmpeg
        segment_pattern = os.path.join(audio_dir, f"{audio_name}_%03d.ts")
        segment_playlist = os.path.join(audio_dir, f"{audio_name}_segments.m3u8")
        
        # Use FFmpeg to create segmented audio stream
        cmd = [
            settings.FFMPEG_COMMAND,
            "-i", audio_file_path,
            "-c:a", "aac",  # Ensure AAC codec
            "-b:a", "128k",  # Audio bitrate
            "-ac", "2",  # Stereo
            "-ar", "48000",  # Sample rate
            "-hls_time", "4",  # 4-second segments
            "-hls_list_size", "0",  # Keep all segments
            "-hls_segment_filename", segment_pattern,
            "-f", "hls",
            "-y",  # Overwrite output
            segment_playlist
        ]
        
        logger.info(f"Creating segmented audio stream: {audio_filename}")
        result = helpers.run_command(cmd)
        
        if result.get("error"):
            logger.error(f"Failed to create segmented audio stream: {result.get('error')}")
            return False
        
        # Check if the segmented playlist was created
        if os.path.exists(segment_playlist):
            logger.info(f"Successfully created segmented audio playlist: {segment_playlist}")
            return True
        else:
            logger.error(f"Segmented audio playlist not created: {segment_playlist}")
            return False
        
    except Exception as e:
        logger.error(f"Error creating segmented audio stream playlist: {e}")
        return False

def create_enhanced_hls(friendly_token):
    """Enhanced HLS creation with multi-audio and subtitle support"""
    
    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except Media.DoesNotExist:
        logger.error(f"Media with token {friendly_token} not found")
        return False

    # Get original file path
    original_file_path = media.media_file.path
    if not os.path.exists(original_file_path):
        logger.error(f"Original file not found: {original_file_path}")
        return False

    # Detect all streams
    streams = ffprobe_list_streams(original_file_path)
    audio_streams = detect_audio_streams(streams)
    subtitle_streams = detect_subtitle_streams(streams)
    
    logger.info(f"Detected {len(audio_streams)} audio streams and {len(subtitle_streams)} subtitle streams")

    # Create HLS directory
    p = media.uid.hex
    output_dir = os.path.join(settings.HLS_DIR, p)
    os.makedirs(output_dir, exist_ok=True)

    # Get encoded renditions (720p and 480p) - include running ones too
    encodings = media.encodings.filter(
        profile__extension="mp4", 
        status__in=["success", "running"], 
        chunk=False, 
        profile__codec="h264"
    ).order_by('profile__resolution')

    # Prepare files for Bento4 (only encoded MP4 renditions)
    files_for_hls = []
    
    # Add encoded renditions (only MP4 files work with Bento4)
    for encoding in encodings:
        if encoding.media_file and os.path.exists(encoding.media_file.path):
            files_for_hls.append(encoding.media_file.path)

    if not files_for_hls:
        logger.error("No files available for HLS generation")
        return False

    # Create HLS using Bento4
    cmd = [
        settings.MP4HLS_COMMAND, 
        '--segment-duration=4', 
        f'--output-dir={output_dir}',
        '--force',  # Allow output to existing directory
        *files_for_hls
    ]
    
    result = helpers.run_command(cmd)
    if result.get("error"):
        logger.error(f"Bento4 HLS generation failed: {result.get('error', 'Unknown error')}")
        return False

    # Process audio streams with proper synchronization
    audio_files = create_synchronized_audio_tracks(original_file_path, output_dir, audio_streams)

    # Process subtitle streams
    subtitle_files = []
    subtitle_metadata = []
    for i, subtitle_stream in enumerate(subtitle_streams):
        subtitle_output_path = os.path.join(output_dir, f"subtitle_{i}.vtt")
        if convert_subtitle_to_webvtt(original_file_path, subtitle_stream["index"], subtitle_output_path):
            # Use proper naming function for subtitle tracks
            subtitle_name = get_subtitle_track_name(subtitle_stream)
            
            subtitle_files.append({
                "file": subtitle_output_path,
                "language": subtitle_stream["language"],
                "title": subtitle_name,
                "index": i
            })
            # Store metadata in a JSON file for the Media model to read
            subtitle_metadata.append({
                "file": f"subtitle_{i}.vtt",
                "language": subtitle_stream["language"],
                "title": subtitle_name,
                "index": i
            })

    # Generate enhanced master.m3u8
    master_playlist_path = os.path.join(output_dir, "master.m3u8")
    if os.path.exists(master_playlist_path):
        # Read existing master playlist
        with open(master_playlist_path, 'r') as f:
            content = f.read()
        
        # Add audio and subtitle references
        enhanced_content = enhance_master_playlist(content, audio_files, subtitle_files)
        
        # Write enhanced master playlist
        with open(master_playlist_path, 'w') as f:
            f.write(enhanced_content)
        
        # Update media object with relative path
        relative_hls_path = os.path.relpath(master_playlist_path, settings.MEDIA_ROOT)
        Media.objects.filter(pk=media.pk).update(hls_file=relative_hls_path)
        
        # Save subtitle metadata to JSON file
        metadata_file = os.path.join(output_dir, "subtitle_metadata.json")
        with open(metadata_file, 'w') as f:
            json.dump(subtitle_metadata, f, indent=2)

        # Save audio metadata to JSON file
        audio_metadata_file = os.path.join(output_dir, "audio_metadata.json")
        with open(audio_metadata_file, 'w') as f:
            json.dump(audio_files, f, indent=2)
        
        # Note: Using audio stream playlists for proper HLS audio switching
        
        logger.info(f"Enhanced HLS created successfully for {friendly_token}")
        logger.info(f"Audio files: {len(audio_files)}, Subtitle files: {len(subtitle_files)}")
        return True
    
    return False

def enhance_master_playlist(content, audio_files, subtitle_files):
    """Enhance master.m3u8 with audio and subtitle references"""
    
    lines = content.split('\n')
    enhanced_lines = []
    
    # Add audio group definitions
    if audio_files:
        # Use audio stream playlists for proper HLS audio switching
        first_audio = audio_files[0]
        first_name = get_audio_track_name(first_audio)
        audio_playlist = os.path.basename(first_audio.get('playlist', first_audio['file']))
        enhanced_lines.append(f"#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"audio\",NAME=\"{first_name}\",LANGUAGE=\"{first_audio['language']}\",DEFAULT=YES,AUTOSELECT=YES,URI=\"{audio_playlist}\"")
        
        for audio_file in audio_files[1:]:
            track_name = get_audio_track_name(audio_file)
            audio_playlist = os.path.basename(audio_file.get('playlist', audio_file['file']))
            enhanced_lines.append(f"#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"audio\",NAME=\"{track_name}\",LANGUAGE=\"{audio_file['language']}\",AUTOSELECT=NO,URI=\"{audio_playlist}\"")
    
    # Add subtitle group definitions
    if subtitle_files:
        for subtitle_file in subtitle_files:
            enhanced_lines.append(f"#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subtitles\",NAME=\"{subtitle_file['title']}\",LANGUAGE=\"{subtitle_file['language']}\",AUTOSELECT=NO,URI=\"{os.path.basename(subtitle_file['file'])}\"")
    
    # Process original content and update stream infos
    for line in lines:
        if line.startswith('#EXT-X-STREAM-INF:'):
            # Add AUDIO and SUBTITLES parameters to stream infos
            if audio_files:
                line += ',AUDIO="audio"'
            if subtitle_files:
                line += ',SUBTITLES="subtitles"'
        enhanced_lines.append(line)
    
    return '\n'.join(enhanced_lines)

def create_audio_stream_playlists(output_dir, audio_files):
    """Create HLS audio stream playlists for each audio track"""
    
    for i, audio_file in enumerate(audio_files):
        audio_filename = os.path.basename(audio_file['file'])
        audio_playlist_path = os.path.join(output_dir, f"audio_{i}.m3u8")
        
        # Create proper HLS audio stream playlist with multiple segments
        # For now, we'll create a simple playlist that references the audio file directly
        # In a real implementation, we'd need to segment the audio file into multiple chunks
        
        audio_playlist_content = f"""#EXTM3U
#EXT-X-VERSION:4
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:7
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:42.676,
{audio_filename}
#EXT-X-ENDLIST
"""
        
        # Write audio stream playlist
        with open(audio_playlist_path, 'w') as f:
            f.write(audio_playlist_content)
        
        logger.info(f"Created audio stream playlist: audio_{i}.m3u8")
