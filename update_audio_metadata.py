#!/usr/bin/env python3
"""
Update audio metadata with proper language names
"""

import json
import os
import sys
import django

# Setup Django
sys.path.append('/home/mediacms.io/mediacms')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cms.settings')
django.setup()

from files.models import Media

def update_audio_metadata(friendly_token):
    """Update audio metadata with proper language names"""
    
    try:
        media = Media.objects.get(friendly_token=friendly_token)
        print(f"Updating audio metadata for: {media.title}")
        
        # Get the HLS directory
        hls_path = media.hls_file
        if hls_path.startswith('hls/'):
            hls_dir = hls_path.replace('hls/', '').replace('/master.m3u8', '')
            output_dir = f'/home/mediacms.io/mediacms/media_files/hls/{hls_dir}'
        else:
            output_dir = f'/home/mediacms.io/mediacms/media_files/hls/{media.friendly_token}'
        
        # Language name mapping
        language_names = {
            'eng': 'English', 'en': 'English',
            'ara': 'Arabic', 'ar': 'Arabic',
            'fre': 'French', 'fr': 'French', 'fra': 'French',
            'deu': 'German', 'de': 'German',
            'spa': 'Spanish', 'es': 'Spanish',
            'ita': 'Italian', 'it': 'Italian',
            'por': 'Portuguese', 'pt': 'Portuguese',
            'rus': 'Russian', 'ru': 'Russian',
            'jpn': 'Japanese', 'ja': 'Japanese',
            'kor': 'Korean', 'ko': 'Korean',
            'zho': 'Chinese', 'chi': 'Chinese', 'zh': 'Chinese',
            'hin': 'Hindi', 'ben': 'Bengali', 'ind': 'Indonesian', 'pol': 'Polish'
        }
        
        # Create audio metadata with proper language names
        audio_metadata = []
        for i, track in enumerate(media.mkv_audio_tracks.all()):
            language = track.language or 'eng'
            language_name = language_names.get(language.lower(), language.upper())
            audio_metadata.append({
                'file': f'audio_{i}.m4a',
                'language': track.language,
                'title': language_name,
                'index': i
            })
        
        # Write audio metadata
        audio_metadata_file = os.path.join(output_dir, 'audio_metadata.json')
        with open(audio_metadata_file, 'w') as f:
            json.dump(audio_metadata, f, indent=2)
        
        print(f'✅ Updated audio metadata with proper language names: {len(audio_metadata)} tracks')
        for track in audio_metadata:
            print(f'  - {track["title"]} ({track["language"]})')
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python update_audio_metadata.py <friendly_token>")
        sys.exit(1)
    
    friendly_token = sys.argv[1]
    success = update_audio_metadata(friendly_token)
    
    if success:
        print("🎉 Audio metadata updated successfully!")
    else:
        print("💥 Failed to update audio metadata")
        sys.exit(1)
