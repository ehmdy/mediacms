#!/usr/bin/env python3
"""
Fix the compiled media.js file to prioritize master playlist when audio tracks are available
"""

import os
import re

def fix_media_js():
    media_js_path = "/home/mediacms.io/mediacms/static/js/media.js"
    
    print("🔧 Fixing media.js to prioritize master playlist for audio tracks...")
    
    # Read the current file
    with open(media_js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the section where video sources are built
    # Look for the pattern where individual streams are added
    pattern = r'(for\("Auto"===r&&void 0!==o\.Auto&&n\.push\(\{src:o\.Auto\.url\[0\]\}\)),i=0;i<o\[l\]\.format\.length;\)\{if\("hls"===o\[l\]\.format\[i\]\)\{n\.push\(\{src:o\[l\]\.url\[i\]\}\);break\}i\+\=1\}'
    
    # Replace with logic that checks for audio tracks first
    replacement = r'''\1
      // Check if we have audio tracks - if so, prioritize master playlist for audio switching
      const hasAudioTracks = N.hls_audio_tracks_info && N.hls_audio_tracks_info.length > 0;
      
      if (hasAudioTracks) {
        console.log('🎵 Audio tracks detected, using master playlist only');
        // Skip individual streams when audio tracks are available
      } else {
        console.log('🎵 No audio tracks, using individual stream URLs');
        i=0;
        while(i<o[l].format.length){
          if("hls"===o[l].format[i]){
            console.log('🎯 Using individual stream:', o[l].url[i]);
            n.push({src:o[l].url[i]});
            break;
          }
          i+=1;
        }
      }'''
    
    # Apply the fix
    new_content = re.sub(pattern, replacement, content)
    
    if new_content == content:
        print("❌ Pattern not found in media.js")
        return False
    
    # Write the fixed content
    with open(media_js_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("✅ Successfully fixed media.js to prioritize master playlist for audio tracks")
    return True

if __name__ == "__main__":
    fix_media_js()

