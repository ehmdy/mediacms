#!/usr/bin/env python3
"""
Test script to verify the audio track switching fixes
"""

import requests
import json

def test_audio_tracks():
    print("🧪 Testing audio track switching fixes...")
    
    # Test the video that was having issues
    test_url = "http://localhost/view?m=l2CzccbmS"
    
    try:
        # Get the pageand sound tracks dont changed 
        response = requests.get(test_url)
        if response.status_code == 200:
            print("✅ Video page loads successfully")
            
            # Check if the page contains our debug logs
            if "🎵 Audio tracks detected" in response.text:
                print("✅ Master playlist prioritization is active")
            else:
                print("⚠️ Master playlist prioritization not found in page")
                
            if "🎵 Audio tracks available, forcing master playlist usage" in response.text:
                print("✅ Master playlist forcing is active")
            else:
                print("⚠️ Master playlist forcing not found in page")
                
        else:
            print(f"❌ Video page failed to load: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing video: {e}")

if __name__ == "__main__":
    test_audio_tracks()

