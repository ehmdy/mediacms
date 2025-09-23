
# Automatic Processing Pipeline for New Video Uploads

## 🚀 **Automatic Processing Flow**

When a new video is uploaded to MediaCMS, the following enhanced processing happens automatically:

### 1. **Upload Detection**
- User uploads video file through MediaCMS interface
- Django `post_save` signal detects new media creation
- `media_init()` method is automatically called

### 2. **Track Detection**
- `detect_and_save_mkv_tracks()` is called automatically
- FFprobe analyzes the video file for audio and subtitle tracks
- Track information is stored in the database
- Works with MKV, MP4, and other supported formats

### 3. **Video Encoding**
- `encode()` method is called automatically
- Video is encoded to 720p and 480p resolutions
- H.264 codec is used for browser compatibility
- Encoding tasks are queued in Celery

### 4. **Enhanced HLS Generation**
- After successful encoding, `post_encode_actions()` is called
- `create_hls.delay()` task is triggered automatically
- Enhanced HLS generation with multi-track support
- Audio tracks are converted to AAC format
- Subtitle tracks are converted to WebVTT format

### 5. **Master Playlist Enhancement**
- Master playlist is enhanced with audio and subtitle track references
- `#EXT-X-MEDIA` tags are added for each track
- `AUDIO="audio"` and `SUBTITLES="subtitles"` attributes are added
- Cross-browser compatibility is ensured

### 6. **Metadata Creation**
- Audio metadata is saved to `audio_metadata.json`
- Subtitle metadata is saved to `subtitle_metadata.json`
- Track information is available to the frontend player

### 7. **Player Integration**
- Enhanced player features are automatically available
- Audio and subtitle track buttons are always visible
- Track switching functionality is enabled
- All enhanced features work out of the box

## 🔧 **Technical Implementation**

### **Automatic Triggers**
1. **Post-Save Signal**: `@receiver(post_save, sender=Media)`
2. **Media Initialization**: `media_init()` method
3. **Track Detection**: `detect_and_save_mkv_tracks()` method
4. **Video Encoding**: `encode()` method
5. **HLS Generation**: `post_encode_actions()` method
6. **Enhanced Processing**: `create_enhanced_hls()` function

### **Processing Pipeline**
```
Upload → Post-Save Signal → media_init() → Track Detection → Video Encoding → HLS Generation → Enhanced Features
```

### **File Structure Created**
```
/media/hls/{media_uid}/
├── master.m3u8 (enhanced with track references)
├── audio_0.m4a, audio_1.m4a, audio_2.m4a (AAC audio tracks)
├── audio_0_segments.m3u8, audio_1_segments.m3u8, audio_2_segments.m3u8
├── audio_metadata.json
├── subtitle_0.vtt, subtitle_1.vtt, subtitle_2.vtt (WebVTT subtitles)
├── subtitle_metadata.json
└── media-1/, media-2/ (video segments)
```

## ✅ **Verification Checklist**

- [ ] Post-save signal triggers media_init
- [ ] Track detection works automatically
- [ ] Video encoding is triggered
- [ ] Enhanced HLS generation is called
- [ ] Audio tracks are converted to AAC
- [ ] Subtitle tracks are converted to WebVTT
- [ ] Master playlist is enhanced
- [ ] Metadata files are created
- [ ] Player features are available
- [ ] Track buttons are always visible

## 🎯 **Benefits**

1. **Zero Configuration**: No manual setup required
2. **Automatic Processing**: All features work out of the box
3. **Cross-Browser Compatibility**: AAC and WebVTT formats
4. **Enhanced User Experience**: Rich track switching functionality
5. **Future-Proof**: Works with all new uploads automatically

## 📝 **Notes**

- Processing happens automatically in the background
- No user intervention required
- All enhanced features are available immediately after processing
- Works with existing and new video uploads
- Backward compatible with existing media
