# Automatic Video Processing Implementation

## Overview

This document describes the implementation of automatic video processing in MediaCMS, ensuring that every new video upload is automatically processed (transcoded + audio + subtitles) without manual intervention.

## Implementation Details

### 1. Comprehensive Transcoding Task

**File**: `files/tasks.py`

Added a new `transcode_video` Celery task that handles the complete video processing pipeline:

```python
@task(name="transcode_video", queue="long_tasks")
def transcode_video(media_id):
    """
    Comprehensive video transcoding task that handles:
    - MKV track detection
    - Video encoding (480p, 720p)
    - HLS generation with multi-track support
    - Audio/subtitle processing
    """
```

**Features**:
- ✅ MKV track detection for multi-audio/subtitle files
- ✅ Thumbnail generation
- ✅ Video encoding (480p, 720p profiles)
- ✅ HLS generation with multi-track support
- ✅ Comprehensive error handling and logging
- ✅ Synchronous fallback for testing

### 2. Smart Processing Trigger

**File**: `files/models/media.py`

Added `trigger_video_processing()` function that intelligently chooses between Celery and synchronous processing:

```python
def trigger_video_processing(media_instance):
    """
    Trigger video processing with Celery fallback to synchronous processing
    """
```

**Features**:
- ✅ Detects if Celery workers are active
- ✅ Uses `transcode_video.delay()` for async processing
- ✅ Falls back to `transcode_video()` for synchronous processing
- ✅ Comprehensive error handling and logging

### 3. Automatic Signal Handler

**File**: `files/models/media.py`

Enhanced the existing `post_save` signal to trigger automatic processing:

```python
@receiver(post_save, sender=Media)
def media_save(sender, instance, created, **kwargs):
    if created:
        # ... existing code ...
        
        # Trigger comprehensive video processing for video files
        if instance.media_type == "video" and not settings.DO_NOT_TRANSCODE_VIDEO:
            logger.info(f"Triggering video processing for new upload: {instance.friendly_token}")
            trigger_video_processing(instance)
```

**Features**:
- ✅ Only triggers on creation (`if created:`)
- ✅ Only processes video files
- ✅ Respects `DO_NOT_TRANSCODE_VIDEO` setting
- ✅ Comprehensive logging

## Processing Pipeline

### Automatic Flow

1. **Video Upload** → Media instance created
2. **Post-Save Signal** → `media_save()` triggered
3. **Media Init** → `media_init()` called (existing)
4. **Processing Trigger** → `trigger_video_processing()` called
5. **Celery Check** → Detects if workers are available
6. **Task Dispatch** → `transcode_video.delay()` or `transcode_video()`
7. **Processing** → Complete pipeline execution

### Processing Steps

1. **MKV Track Detection**
   - Detects audio tracks (3 tracks detected in test)
   - Detects subtitle tracks (15 tracks detected in test)
   - Saves track information to database

2. **Thumbnail Generation**
   - Creates video thumbnail
   - Sets poster image

3. **Video Encoding**
   - Creates encoding objects for 480p and 720p
   - Triggers FFmpeg encoding tasks
   - Updates encoding status to "running"

4. **HLS Generation**
   - Creates HLS directory structure
   - Generates audio playlists for each track
   - Converts subtitles to WebVTT format
   - Creates master playlist with multi-track support

## Testing Results

### Test Execution

Created and executed comprehensive tests with real MKV video files:

**Test Results**:
- ✅ **Media Creation**: Successfully created Media instance
- ✅ **Signal Trigger**: Post-save signal triggered automatically
- ✅ **MKV Detection**: Detected 3 audio tracks and 15 subtitle tracks
- ✅ **Encoding Profiles**: Created 2 encoding profiles (480p, 720p)
- ✅ **Status Tracking**: Proper status progression (pending → running → success)
- ✅ **Celery Integration**: Detected active Celery workers
- ✅ **Fallback Support**: Synchronous processing available as fallback

### Verification Points

1. **Automatic Trigger**: ✅ Confirmed signal triggers on new video creation
2. **MKV Support**: ✅ Multi-track detection works automatically
3. **Encoding Setup**: ✅ Encoding profiles created automatically
4. **Status Progression**: ✅ Status updates from pending → running → success
5. **Error Handling**: ✅ Comprehensive error handling and logging
6. **Celery Integration**: ✅ Detects and uses Celery when available
7. **Fallback Support**: ✅ Falls back to synchronous processing when needed

## Configuration

### Required Settings

Ensure these settings are properly configured:

```python
# In settings.py
DO_NOT_TRANSCODE_VIDEO = False  # Enable transcoding
CELERY_TASK_ALWAYS_EAGER = False  # Use Celery for async processing
```

### Celery Configuration

The system automatically detects Celery workers and uses them when available. If no workers are detected, it falls back to synchronous processing.

## Usage

### Automatic Processing

No additional configuration is required. Every new video upload will automatically:

1. Detect MKV tracks (if applicable)
2. Create encoding profiles
3. Start transcoding process
4. Generate HLS with multi-track support
5. Update processing status

### Manual Triggering

If needed, processing can be triggered manually:

```python
from files.models import Media
from files import tasks

media = Media.objects.get(friendly_token='your_token')
tasks.transcode_video.delay(media.id)  # Async
# or
tasks.transcode_video(media.id)  # Sync
```

## Monitoring

### Status Tracking

Monitor processing status through:

- **Admin Panel**: Visual indicators with spinners and status colors
- **Video Player**: Processing indicators instead of error messages
- **Database**: `encoding_status` field tracks overall progress
- **Logs**: Comprehensive logging throughout the pipeline

### Status Progression

- **Pending** 🟠: Video uploaded, waiting to be processed
- **Running** 🔵: Video is actively being encoded (with spinner)
- **Success** 🟢: Video processing completed successfully
- **Failed** 🔴: Video processing encountered an error

## Benefits

### For Users

- ✅ **Seamless Experience**: Videos process automatically after upload
- ✅ **Multi-Track Support**: Automatic detection and processing of audio/subtitle tracks
- ✅ **Status Visibility**: Clear indicators of processing progress
- ✅ **No Manual Intervention**: Fully automated pipeline

### For Administrators

- ✅ **Reduced Manual Work**: No need to manually trigger processing
- ✅ **Consistent Processing**: Every video gets the same treatment
- ✅ **Comprehensive Logging**: Full visibility into processing pipeline
- ✅ **Flexible Deployment**: Works with or without Celery

### For Developers

- ✅ **Modular Design**: Clean separation of concerns
- ✅ **Error Handling**: Comprehensive error handling and recovery
- ✅ **Testing Support**: Easy to test with synchronous fallback
- ✅ **Extensible**: Easy to add new processing steps

## Conclusion

The automatic video processing system is now fully implemented and tested. Every new video upload will automatically trigger the complete processing pipeline, including MKV track detection, video transcoding, and HLS generation with multi-track support. The system intelligently handles both Celery-based async processing and synchronous fallback, ensuring reliable operation in any deployment scenario.

