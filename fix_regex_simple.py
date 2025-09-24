#!/usr/bin/env python3
"""
Fix the regex pattern in track-buttons-enabler.js for master playlist URL extraction
"""

def fix_regex_pattern():
    track_js_path = "/home/mediacms.io/mediacms/static/js/track-buttons-enabler.js"
    
    print("🔧 Fixing regex pattern in track-buttons-enabler.js...")
    
    # Read the current file
    with open(track_js_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Find and replace the problematic line
    for i, line in enumerate(lines):
        if 'const basePath = currentSrc.replace(' in line and 'media-' in line:
            print(f"Found line {i+1}: {line.strip()}")
            lines[i] = "                    const basePath = currentSrc.replace(/\\/media-\\d+\\/stream\\.m3u8$/, '');\n"
            print(f"Replaced with: {lines[i].strip()}")
            break
    else:
        print("❌ Could not find the line to fix")
        return False
    
    # Write the fixed content
    with open(track_js_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print("✅ Successfully fixed regex pattern in track-buttons-enabler.js")
    return True

if __name__ == "__main__":
    fix_regex_pattern()

