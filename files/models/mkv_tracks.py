from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class MKVAudioTrack(models.Model):
    """Model to store MKV audio track information"""
    media = models.ForeignKey('Media', on_delete=models.CASCADE, related_name='mkv_audio_tracks')
    track_index = models.PositiveIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(99)],
        help_text="Track index in the MKV file"
    )
    codec = models.CharField(max_length=20, help_text="Audio codec (aac, ac3, dts, etc.)")
    language = models.CharField(max_length=10, blank=True, help_text="Language code")
    title = models.CharField(max_length=200, blank=True, help_text="Track title")
    channels = models.PositiveIntegerField(help_text="Number of audio channels")
    sample_rate = models.PositiveIntegerField(help_text="Sample rate in Hz")
    bitrate = models.PositiveIntegerField(help_text="Bitrate in bps")
    is_default = models.BooleanField(default=False, help_text="Whether this is the default audio track")
    
    class Meta:
        unique_together = ['media', 'track_index']
        ordering = ['track_index']
    
    def __str__(self):
        return f"{self.media.title} - Audio Track {self.track_index} ({self.language or 'Unknown'})"


class MKVSubtitleTrack(models.Model):
    """Model to store MKV subtitle track information"""
    media = models.ForeignKey('Media', on_delete=models.CASCADE, related_name='mkv_subtitle_tracks')
    track_index = models.PositiveIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(99)],
        help_text="Track index in the MKV file"
    )
    codec = models.CharField(max_length=20, help_text="Subtitle codec (srt, ass, vobsub, etc.)")
    language = models.CharField(max_length=10, blank=True, help_text="Language code")
    title = models.CharField(max_length=200, blank=True, help_text="Track title")
    is_forced = models.BooleanField(default=False, help_text="Whether this is a forced subtitle track")
    is_default = models.BooleanField(default=False, help_text="Whether this is the default subtitle track")
    
    class Meta:
        unique_together = ['media', 'track_index']
        ordering = ['track_index']
    
    def __str__(self):
        return f"{self.media.title} - Subtitle Track {self.track_index} ({self.language or 'Unknown'})"


class TrackCombination(models.Model):
    """Model to store pre-processed track combinations"""
    media = models.ForeignKey('Media', on_delete=models.CASCADE, related_name='track_combinations')
    audio_track_index = models.PositiveIntegerField(help_text="Selected audio track index")
    subtitle_track_index = models.PositiveIntegerField(null=True, blank=True, help_text="Selected subtitle track index")
    cache_key = models.CharField(max_length=100, unique=True, help_text="Unique cache key for this combination")
    video_file_path = models.CharField(max_length=500, help_text="Path to the pre-processed video file")
    file_size = models.BigIntegerField(help_text="File size in bytes")
    duration = models.FloatField(help_text="Video duration in seconds")
    is_processed = models.BooleanField(default=False, help_text="Whether this combination has been processed")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['media', 'audio_track_index', 'subtitle_track_index']
        ordering = ['audio_track_index', 'subtitle_track_index']
    
    def __str__(self):
        subtitle_info = f" + Sub {self.subtitle_track_index}" if self.subtitle_track_index is not None else ""
        return f"{self.media.title} - Audio {self.audio_track_index}{subtitle_info}"

