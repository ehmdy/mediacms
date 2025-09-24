#!/usr/bin/env python3
"""
Fix the regex pattern in track-buttons-enabler.js for master playlist URL extraction
"""

import os
import re

def fix_regex_pattern():
    track_js_path = "/home/mediacms.io/mediacms/static/js/track-buttons-enabler.js"
    
    print("🔧 Fixing regex pattern in track-buttons-enabler.js...")
    
    # Read the current file
    with open(track_js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the incorrect regex pattern and fix it
    pattern = r'const basePath = currentSrc\.replace\(/\\/media-\\d\+\\/stream\\.m3u8\$/, \'\'\);'
    
    # Replace with correct regex pattern (properly escaped)
    replacement = r"const basePath = currentSrc.replace(/\/media-\d+\/stream\.m3u8$/, '');"
    
    # Apply the fix
    new_content = re.sub(pattern, replacement, content)
    
    if new_content == content:
        print("❌ Pattern not found, trying alternative approach...")
        # Try a different approach - find the line and replace it directly
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'const basePath = currentSrc.replace(' in line and 'media-' in line:
                print(f"Found line {i+1}: {line}")
                lines[i] = "                    const basePath = currentSrc.replace(/\/media-\d+\/stream\.m3u8$/, '');"
                new_content = '\n'.join(lines)
                break
        else:
            print("❌ Could not find the line to fix")
            return False
    
    # Write the fixed content
    with open(track_js_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("✅ Successfully fixed regex pattern in track-buttons-enabler.js")
    return True

if __name__ == "__main__":
    fix_regex_pattern()