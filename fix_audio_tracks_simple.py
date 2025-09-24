#!/usr/bin/env python3
"""
Fix audio tracks for video l2CzccbmS by creating proper metadata
"""

import os
import json
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cms.settings')
django.setup()

from files.models import Media
from files.enhanced_hls import ffprobe_list_streams, detect_audio_streams

def fix_audio_tracks_simple():
    """Fix audio tracks using a simple approach"""
    
    try:
        # Get the video
        video = Media.objects.get(friendly_token='l2CzccbmS')
        hls_dir = f'/home/mediacms.io/mediacms/media_files/hls/{video.uid.hex}'
        
        print(f"Fixing audio tracks for: {video.title}")
        
        # Get original file path
        original_file_path = video.media_file.path
        if not os.path.exists(original_file_path):
            print("❌ Original file not found")
            return False
        
        # Detect audio streams from original file
        streams = ffprobe_list_streams(original_file_path)
        audio_streams = detect_audio_streams(streams)
        
        print(f"Detected {len(audio_streams)} audio streams")
        for i, stream in enumerate(audio_streams):
            print(f"  Audio {i}: {stream['display_name']} ({stream['language']})")
        
        # Check if audio files exist
        audio_files = []
        for i in range(len(audio_streams)):
            audio_file = os.path.join(hls_dir, f'audio_{i}.m4a')
            if os.path.exists(audio_file):
                audio_files.append(audio_file)
                print(f"✅ Found audio file: audio_{i}.m4a")
        
        if not audio_files:
            print("❌ No audio files found")
            return False
        
        # Create audio metadata
        audio_metadata = []
        for i, audio_stream in enumerate(audio_streams):
            if i < len(audio_files):
                audio_metadata.append({
                    "file": f"audio_{i}.m4a",
                    "language": audio_stream["language"],
                    "title": audio_stream["display_name"],
                    "index": i
                })
                print(f"  ✅ Added audio track: {audio_stream['display_name']} ({audio_stream['language']})")
        
        # Save audio metadata
        audio_metadata_path = os.path.join(hls_dir, 'audio_metadata.json')
        with open(audio_metadata_path, 'w') as f:
            json.dump(audio_metadata, f, indent=2)
        
        print(f"✅ Updated audio metadata with {len(audio_metadata)} tracks")
        
        # Fix master playlist
        master_playlist_path = os.path.join(hls_dir, 'master.m3u8')
        if os.path.exists(master_playlist_path):
            with open(master_playlist_path, 'r') as f:
                lines = f.readlines()
            
            # Create new master playlist with audio tracks
            new_lines = []
            
            # Add audio track entries
            for i, track in enumerate(audio_metadata):
                audio_line = f'#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="{track["title"]}",LANGUAGE="{track["language"]}",AUTOSELECT={"YES" if i == 0 else "NO"},DEFAULT={"YES" if i == 0 else "NO"},URI="{track["file"]}"\n'
                new_lines.append(audio_line)
                print(f"  ✅ Added audio track to master playlist: {track['title']}")
            
            # Add subtitle entries (keep existing ones)
            subtitle_started = False
            for line in lines:
                if line.startswith('#EXT-X-MEDIA:TYPE=SUBTITLES'):
                    if not subtitle_started:
                        new_lines.append('\n')
                        subtitle_started = True
                    new_lines.append(line)
                elif line.startswith('#EXT-X-STREAM-INF:'):
                    # Add AUDIO="audio" to stream info
                    if 'AUDIO=' not in line:
                        line = line.rstrip() + ',AUDIO="audio"\n'
                    new_lines.append(line)
                elif line.startswith('#EXTM3U') or line.startswith('#EXT-X-VERSION') or line.startswith('media-') or line.startswith('#EXT-X-I-FRAME'):
                    new_lines.append(line)
            
            # Write updated master playlist
            with open(master_playlist_path, 'w') as f:
                f.writelines(new_lines)
            
            print(f"✅ Updated master playlist with audio tracks")
            
            # Show preview of updated master playlist
            with open(master_playlist_path, 'r') as f:
                content = f.read()
                print(f"\nMaster playlist preview:")
                print(content[:500] + "..." if len(content) > 500 else content)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = fix_audio_tracks_simple()
    if success:
        print("\n🎉 Audio tracks fixed successfully!")
    else:
        print("\n❌ Failed to fix audio tracks")

