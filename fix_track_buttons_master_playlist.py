#!/usr/bin/env python3
"""
Fix track-buttons-enabler.js to force master playlist usage when audio tracks are available
"""

import os
import re

def fix_track_buttons_enabler():
    track_js_path = "/home/mediacms.io/mediacms/static/js/track-buttons-enabler.js"
    
    print("🔧 Fixing track-buttons-enabler.js to force master playlist usage...")
    
    # Read the current file
    with open(track_js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the section that checks for master playlist
    pattern = r'if \(!currentSrc \|\| !currentSrc\.includes\(\'master\.m3u8\'\)\) \{\s*console\.log\(\'❌ Not using master playlist, cannot switch audio tracks\'\);\s*return false;\s*\}'
    
    # Replace with logic that forces master playlist when audio tracks are available
    replacement = r'''// Check if we have audio tracks and force master playlist usage
            if (!currentSrc || !currentSrc.includes('master.m3u8')) {
                console.log('❌ Not using master playlist, checking if we should force it...');
                
                // If we have audio tracks, try to force master playlist usage
                if (window.MediaCMS && window.MediaCMS.trackData && window.MediaCMS.trackData.audioTracks && window.MediaCMS.trackData.audioTracks.length > 0) {
                    console.log('🎵 Audio tracks available, forcing master playlist usage...');
                    
                    // Extract the base path from current source
                    const basePath = currentSrc.replace(/\\/media-\\d+\\/stream\\.m3u8$/, '');
                    const masterPlaylistUrl = basePath + '/master.m3u8';
                    
                    console.log('🎯 Switching to master playlist:', masterPlaylistUrl);
                    
                    // Switch to master playlist
                    player.src(masterPlaylistUrl);
                    
                    // Wait a bit for the source to load
                    setTimeout(() => {
                        console.log('✅ Switched to master playlist, retrying audio track switch...');
                        // Retry the audio track switch
                        switchToAudioTrackDirect(trackIndex);
                    }, 1000);
                    
                    return true; // Indicate we're handling the switch
                } else {
                    console.log('❌ No audio tracks available, cannot switch audio tracks');
                    return false;
                }
            }'''
    
    # Apply the fix
    new_content = re.sub(pattern, replacement, content)
    
    if new_content == content:
        print("❌ Pattern not found in track-buttons-enabler.js")
        return False
    
    # Write the fixed content
    with open(track_js_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("✅ Successfully fixed track-buttons-enabler.js to force master playlist usage")
    return True

if __name__ == "__main__":
    fix_track_buttons_enabler()
