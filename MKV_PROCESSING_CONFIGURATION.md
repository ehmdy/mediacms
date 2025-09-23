# MediaCMS MKV Multi-Track Processing Configuration

## 🎬 Overview

This document describes the complete configuration for processing MKV files with multiple audio tracks and subtitles in MediaCMS. The system automatically detects, processes, and makes available multiple audio and subtitle tracks for seamless switching in the video player.

## ✅ Current Status: FULLY CONFIGURED

All components are properly configured and verified. The system is ready for production use with MKV files containing multiple tracks.

## 🔧 Key Components

### 1. Enhanced HLS Generation (`files/enhanced_hls.py`)
- **Audio Stream Detection**: Automatically detects all audio tracks in MKV files
- **Subtitle Stream Detection**: Identifies subtitle tracks and converts them to WebVTT
- **Segmented Audio Playlists**: Creates proper HLS audio segments for track switching
- **Master Playlist Enhancement**: Adds EXT-X-MEDIA tags for audio and subtitle tracks
- **Metadata Generation**: Creates JSON files with track information

### 2. Task Integration (`files/tasks.py`)
- **Enhanced HLS Task**: `create_hls` task uses enhanced HLS generation
- **Automatic Triggering**: HLS generation triggered after successful H.264 encoding
- **Celery Integration**: Background processing for large files

### 3. Media Model (`files/models/media.py`)
- **HLS Properties**: `hls_audio_tracks_info` and `hls_subtitles_info` properties
- **Track Detection**: `is_mkv_with_multiple_tracks` property for MKV detection
- **Automatic Processing**: HLS generation triggered on successful encoding

### 4. Frontend Integration (`static/js/track-buttons-enabler.js`)
- **Audio Track Switching**: Seamless switching between audio tracks
- **Subtitle Track Switching**: Enable/disable subtitle tracks
- **Persistent Enforcement**: Maintains selected audio track across segments
- **Source Interception**: Ensures master playlist is loaded from start
- **Direct HLS Control**: Fallback mechanisms for reliable track switching

### 5. Player Template (`templates/cms/media.html`)
- **Track Data Injection**: Passes track information to frontend
- **Script Loading**: Loads track switching functionality
- **Video.js Integration**: Works with Video.js player

## 🚀 Processing Flow

### 1. Upload Phase
```
MKV File Upload → Media Model Created → Track Detection Triggered
```

### 2. Encoding Phase
```
Video Encoding (H.264) → Audio Track Detection → Subtitle Detection
```

### 3. HLS Generation Phase
```
Enhanced HLS Creation → Audio Segmentation → Subtitle Conversion → Master Playlist Enhancement
```

### 4. Frontend Phase
```
Track Data Loading → Player Initialization → Track Switching Enabled
```

## 📋 Detailed Processing Steps

### Step 1: MKV Upload
- User uploads MKV file through MediaCMS interface
- System detects file type and initiates processing
- Track detection begins automatically

### Step 2: Track Detection
- FFprobe analyzes the MKV file
- Audio streams detected and catalogued
- Subtitle streams identified and processed
- Track metadata stored in database

### Step 3: Video Encoding
- Video encoded to H.264 MP4 format
- Multiple resolutions generated (480p, 720p)
- Encoding profiles ensure HLS compatibility

### Step 4: Audio Processing
- Each audio track extracted separately
- Audio tracks converted to AAC format
- Segmented HLS playlists created for each track
- Audio metadata stored in JSON file

### Step 5: Subtitle Processing
- Subtitle tracks extracted from MKV
- Converted to WebVTT format
- Subtitle metadata stored in JSON file

### Step 6: HLS Generation
- Bento4 creates video segments
- Master playlist enhanced with track references
- EXT-X-MEDIA tags added for audio/subtitle tracks
- All files organized in HLS directory structure

### Step 7: Frontend Integration
- Track data passed to video player
- Track switching buttons enabled
- Audio and subtitle switching functional
- Persistent track selection maintained

## 🎯 Supported Features

### Audio Track Switching
- ✅ Multiple audio tracks preserved
- ✅ Seamless switching between tracks
- ✅ Track language and title display
- ✅ Persistent selection across segments
- ✅ Fallback mechanisms for reliability

### Subtitle Track Switching
- ✅ Multiple subtitle tracks supported
- ✅ WebVTT format conversion
- ✅ Enable/disable subtitle tracks
- ✅ Language and title display
- ✅ Proper cue loading and display

### Video Quality
- ✅ Multiple resolution support (480p, 720p)
- ✅ H.264 codec for broad compatibility
- ✅ Adaptive bitrate streaming
- ✅ HLS format for reliable playback

## 🔍 Verification

The system includes a comprehensive verification script (`verify_mkv_pipeline.py`) that checks:

- Enhanced HLS module configuration
- Task integration
- Media model properties
- Frontend integration
- Encoding configuration

Run the verification script to ensure all components are properly configured:

```bash
python verify_mkv_pipeline.py
```

## 📊 Expected Results

### For Each MKV Upload:
1. **Audio Tracks**: All audio tracks preserved and accessible
2. **Subtitle Tracks**: All subtitles converted to WebVTT
3. **Track Switching**: Functional audio and subtitle switching
4. **Metadata**: Proper track information displayed
5. **Playback**: Smooth playback with track switching

### File Structure:
```
media/hls/{media_id}/
├── master.m3u8 (enhanced with track references)
├── audio_0_segments.m3u8 (English audio)
├── audio_1_segments.m3u8 (Arabic audio)
├── audio_2_segments.m3u8 (French audio)
├── subtitle_0.vtt (Arabic subtitles)
├── subtitle_1.vtt (English subtitles)
├── audio_metadata.json
├── subtitle_metadata.json
└── video segments...
```

## 🚨 Troubleshooting

### Common Issues:
1. **Database Connection**: Ensure PostgreSQL is running
2. **Celery Workers**: Verify Celery workers are processing tasks
3. **File Permissions**: Check HLS directory permissions
4. **FFmpeg/Bento4**: Ensure tools are installed and accessible

### Debug Steps:
1. Check Celery logs for task processing
2. Verify HLS files are generated
3. Check browser console for JavaScript errors
4. Verify track metadata files exist

## 🔧 Configuration Files

### Key Files Modified:
- `files/enhanced_hls.py` - Enhanced HLS generation
- `files/tasks.py` - Task integration
- `files/models/media.py` - Media model properties
- `static/js/track-buttons-enabler.js` - Frontend track switching
- `templates/cms/media.html` - Player template

### Verification Scripts:
- `verify_mkv_pipeline.py` - Pipeline verification
- `configure_encoding_profiles.py` - Profile configuration

## 🎉 Production Readiness

The MKV multi-track processing system is **fully configured and production-ready**. All components have been verified and tested. The system will automatically process any MKV file with multiple tracks and provide seamless track switching functionality.

### What's Guaranteed:
- ✅ Automatic processing of MKV files with multiple tracks
- ✅ Preservation of all audio and subtitle tracks
- ✅ Functional track switching in the video player
- ✅ Consistent results across all uploads
- ✅ Production-ready reliability

### Next Steps:
1. Upload MKV files with multiple tracks
2. Wait for processing to complete
3. Enjoy seamless track switching functionality
4. Monitor system performance and logs

---

**Status**: ✅ **PRODUCTION READY**  
**Last Updated**: September 2024  
**Configuration**: Complete and Verified

