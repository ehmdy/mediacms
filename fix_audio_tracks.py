#!/usr/bin/env python3
"""
Fix audio tracks for MediaCMS video
"""

import os
import sys
import django

# Setup Django
sys.path.append('/home/mediacms.io/mediacms')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cms.settings')
django.setup()

from files.models import Media

def fix_audio_tracks(friendly_token):
    """Fix audio tracks for a specific media"""
    
    try:
        media = Media.objects.get(friendly_token=friendly_token)
        print(f"Processing media: {media.title}")
        
        # Get the HLS directory (use the actual hash from hls_file)
        hls_path = media.hls_file
        if hls_path.startswith('hls/'):
            hls_dir = hls_path.replace('hls/', '').replace('/master.m3u8', '')
            output_dir = f'/home/mediacms.io/mediacms/media_files/hls/{hls_dir}'
        else:
            output_dir = f'/home/mediacms.io/mediacms/media_files/hls/{media.friendly_token}'
        master_playlist_path = os.path.join(output_dir, 'master.m3u8')
        
        if not os.path.exists(master_playlist_path):
            print(f"Master playlist not found: {master_playlist_path}")
            return False
        
        # Read current master playlist
        with open(master_playlist_path, 'r') as f:
            content = f.read()
        
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
        
        # Create audio track definitions
        audio_lines = []
        for i, track in enumerate(media.mkv_audio_tracks.all()):
            language = track.language or 'eng'
            # Use proper language name instead of generic title
            language_name = language_names.get(language.lower(), language.upper())
            audio_lines.append(f'#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="{language_name}",LANGUAGE="{language}",AUTOSELECT=NO,URI="audio_{i}_segments.m3u8"')
        
        # Insert audio definitions after subtitle definitions
        lines = content.split('\n')
        enhanced_lines = []
        in_subtitle_section = False
        audio_added = False
        
        for line in lines:
            enhanced_lines.append(line)
            
            # Check if we're in the subtitle section
            if line.startswith('#EXT-X-MEDIA:TYPE=SUBTITLES'):
                in_subtitle_section = True
            elif line.startswith('#EXTM3U') and in_subtitle_section and not audio_added:
                # Add audio definitions before #EXTM3U
                enhanced_lines.insert(-1, '')  # Add empty line
                for audio_line in audio_lines:
                    enhanced_lines.insert(-1, audio_line)
                enhanced_lines.insert(-1, '')  # Add empty line
                audio_added = True
                in_subtitle_section = False
        
        # Write enhanced master playlist
        enhanced_content = '\n'.join(enhanced_lines)
        with open(master_playlist_path, 'w') as f:
            f.write(enhanced_content)
        
        print(f"✅ Updated master playlist with {len(audio_lines)} audio tracks")
        
        # Update the media's HLS audio tracks info
        audio_tracks_info = []
        for i, track in enumerate(media.mkv_audio_tracks.all()):
            language = track.language or 'eng'
            language_name = language_names.get(language.lower(), language.upper())
            audio_tracks_info.append({
                'file': f'audio_{i}.m4a',
                'language': track.language,
                'title': language_name,
                'index': i
            })
        
        # Update the media object
        media.hls_audio_tracks_info = audio_tracks_info
        media.save()
        
        print(f"✅ Updated media object with audio tracks info")
        print(f"Audio tracks: {len(audio_tracks_info)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python fix_audio_tracks.py <friendly_token>")
        sys.exit(1)
    
    friendly_token = sys.argv[1]
    success = fix_audio_tracks(friendly_token)
    
    if success:
        print("🎉 Audio tracks fixed successfully!")
    else:
        print("💥 Failed to fix audio tracks")
        sys.exit(1)
