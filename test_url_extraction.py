#!/usr/bin/env python3
"""
Test the URL extraction logic
"""

import re

def test_url_extraction():
    # Test the URL extraction logic
    test_url = "http://localhost/media/hls/bc97ae25e7134add9923f2471c72705c/media-1/stream.m3u8"
    
    # This is the regex pattern we're using
    pattern = r'/media-\d+/stream\.m3u8$'
    
    # Extract base path
    base_path = re.sub(pattern, '', test_url)
    master_playlist_url = base_path + '/master.m3u8'
    
    print(f"Original URL: {test_url}")
    print(f"Base path: {base_path}")
    print(f"Master playlist URL: {master_playlist_url}")
    
    # Expected result
    expected = "http://localhost/media/hls/bc97ae25e7134add9923f2471c72705c/master.m3u8"
    
    if master_playlist_url == expected:
        print("✅ URL extraction works correctly!")
        return True
    else:
        print(f"❌ URL extraction failed. Expected: {expected}")
        return False

if __name__ == "__main__":
    test_url_extraction()

