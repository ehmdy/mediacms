import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import urlParse from 'url-parse';

import MediaPlayer from 'mediacms-player/dist/mediacms-player.js';
import 'mediacms-player/dist/mediacms-player.css';

import './VideoPlayer.scss';
import './EnhancedVideoPlayer.scss';

export function formatInnerLink(url, baseUrl) {
  let link = urlParse(url, {});

  if ('' === link.origin || 'null' === link.origin || !link.origin) {
    link = urlParse(baseUrl + '/' + url.replace(/^\//g, ''), {});
  }

  return link.toString();
}

export function VideoPlayerError(props) {
  const isProcessing = props.errorType === 'encodingRunning' || props.errorType === 'encodingPending';
  
  return (
    <div className={`error-container ${isProcessing ? 'processing-container' : ''}`}>
      <div className="error-container-inner">
        <span className="icon-wrap">
          {isProcessing ? (
            <div className="processing-spinner">
              <div className="spinner"></div>
            </div>
          ) : (
            <i className="material-icons">error_outline</i>
          )}
        </span>
        <span className="msg-wrap">{props.errorMessage}</span>
        {isProcessing && (
          <div className="processing-status">
            <div className="status-indicator">
              <span className="status-text">
                {props.errorType === 'encodingRunning' ? 'Processing...' : 'Queued for processing...'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

VideoPlayerError.propTypes = {
  errorMessage: PropTypes.string.isRequired,
  errorType: PropTypes.string,
};

export function VideoPlayer(props) {
  const videoElemRef = useRef(null);
  const [aspectRatio, setAspectRatio] = React.useState('16:9');
  const [doubleTapSeekEnabled, setDoubleTapSeekEnabled] = React.useState(true);
  const [seekAmount, setSeekAmount] = React.useState(10); // seconds

  let player = null;

  const playerStates = {
    playerVolume: props.playerVolume,
    playerSoundMuted: props.playerSoundMuted,
    videoQuality: props.videoQuality,
    videoPlaybackSpeed: props.videoPlaybackSpeed,
    inTheaterMode: props.inTheaterMode,
  };

  playerStates.playerVolume =
    null === playerStates.playerVolume ? 1 : Math.max(Math.min(Number(playerStates.playerVolume), 1), 0);
  playerStates.playerSoundMuted = null !== playerStates.playerSoundMuted ? playerStates.playerSoundMuted : !1;
  playerStates.videoQuality = null !== playerStates.videoQuality ? playerStates.videoQuality : 'Auto';
  playerStates.videoPlaybackSpeed = null !== playerStates.videoPlaybackSpeed ? playerStates.videoPlaybackSpeed : !1;
  playerStates.inTheaterMode = null !== playerStates.inTheaterMode ? playerStates.inTheaterMode : !1;

  // Quality mapping for temporary hiding of 1080p
  const mapQualityLabels = (sources) => {
    if (!props.hide1080pQuality) return sources;
    
    return sources.map(source => {
      if (source.label === '1080p') {
        return { ...source, label: '1080p', mappedTo: '720p' };
      } else if (source.label === '720p') {
        return { ...source, label: '720p', mappedTo: '480p' };
      }
      return source;
    });
  };

  // Double-tap seek functionality
  const setupDoubleTapSeek = (playerElement) => {
    if (!doubleTapSeekEnabled) return;

    let lastTap = 0;
    let tapCount = 0;
    let tapTimeout;

    const handleTouchStart = (e) => {
      const currentTime = Date.now();
      const tapLength = currentTime - lastTap;
      
      if (tapLength < 500 && tapLength > 0) {
        tapCount++;
        clearTimeout(tapTimeout);
        
        if (tapCount === 2) {
          // Double tap detected
          const rect = playerElement.getBoundingClientRect();
          const tapX = e.touches[0].clientX - rect.left;
          const centerX = rect.width / 2;
          
          if (tapX < centerX) {
            // Left side - seek backward
            const currentTime = player.currentTime();
            const newTime = Math.max(0, currentTime - seekAmount);
            player.currentTime(newTime);
            showSeekIndicator('backward', seekAmount);
          } else {
            // Right side - seek forward
            const currentTime = player.currentTime();
            const duration = player.duration();
            const newTime = Math.min(duration, currentTime + seekAmount);
            player.currentTime(newTime);
            showSeekIndicator('forward', seekAmount);
          }
          
          tapCount = 0;
        }
      } else {
        tapCount = 1;
      }
      
      lastTap = currentTime;
      
      tapTimeout = setTimeout(() => {
        tapCount = 0;
      }, 500);
    };

    playerElement.addEventListener('touchstart', handleTouchStart);
    
    return () => {
      playerElement.removeEventListener('touchstart', handleTouchStart);
    };
  };

  // Show seek indicator
  const showSeekIndicator = (direction, amount) => {
    const indicator = document.createElement('div');
    indicator.className = `seek-indicator seek-${direction}`;
    indicator.innerHTML = `
      <div class="seek-icon">
        <i class="material-icons">${direction === 'forward' ? 'fast_forward' : 'fast_rewind'}</i>
      </div>
      <div class="seek-amount">${amount}s</div>
    `;
    
    const playerContainer = videoElemRef.current?.parentElement;
    if (playerContainer) {
      playerContainer.appendChild(indicator);
      
      setTimeout(() => {
        indicator.classList.add('show');
      }, 10);
      
      setTimeout(() => {
        indicator.classList.remove('show');
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 300);
      }, 1000);
    }
  };

  // Aspect ratio control
  const applyAspectRatio = (ratio) => {
    if (!videoElemRef.current) return;
    
    const playerElement = videoElemRef.current;
    const container = playerElement.parentElement;
    
    // Remove existing aspect ratio classes
    container.classList.remove('aspect-4-3', 'aspect-16-9', 'aspect-fullscreen');
    
    switch (ratio) {
      case '4:3':
        container.classList.add('aspect-4-3');
        break;
      case '16:9':
        container.classList.add('aspect-16-9');
        break;
      case 'fullscreen':
        container.classList.add('aspect-fullscreen');
        break;
      default:
        container.classList.add('aspect-16-9');
    }
  };

  function onClickNext() {
    if (void 0 !== props.onClickNextCallback) {
      props.onClickNextCallback();
    }
  }

  function onClickPrevious() {
    if (void 0 !== props.onClickPreviousCallback) {
      props.onClickPreviousCallback();
    }
  }

  function onPlayerStateUpdate(newState) {
    if (playerStates.playerVolume !== newState.volume) {
      playerStates.playerVolume = newState.volume;
    }

    if (playerStates.playerSoundMuted !== newState.soundMuted) {
      playerStates.playerSoundMuted = newState.soundMuted;
    }

    if (playerStates.videoQuality !== newState.quality) {
      playerStates.videoQuality = newState.quality;
    }

    if (playerStates.videoPlaybackSpeed !== newState.playbackSpeed) {
      playerStates.videoPlaybackSpeed = newState.playbackSpeed;
    }

    if (playerStates.inTheaterMode !== newState.theaterMode) {
      playerStates.inTheaterMode = newState.theaterMode;
    }

    if (void 0 !== props.onStateUpdateCallback) {
      props.onStateUpdateCallback(newState);
    }
  }

  function initPlayer() {
    if (null !== player || null !== props.errorMessage) {
      return;
    }

    if (!props.inEmbed) {
      window.removeEventListener('focus', initPlayer);
      document.removeEventListener('visibilitychange', initPlayer);
    }

    if (!videoElemRef.current) {
      return;
    }

    if (!props.inEmbed) {
      videoElemRef.current.focus(); // Focus on player before instance init.
    }

    const subtitles = {
      on: false,
    };

    // Combine both manual subtitles and HLS-generated subtitles
    const allSubtitles = [];
    
    // Add manual subtitles
    if (void 0 !== props.subtitlesInfo && null !== props.subtitlesInfo && props.subtitlesInfo.length) {
      let i = 0;
      while (i < props.subtitlesInfo.length) {
        if (
          void 0 !== props.subtitlesInfo[i].src &&
          void 0 !== props.subtitlesInfo[i].srclang &&
          void 0 !== props.subtitlesInfo[i].label
        ) {
          allSubtitles.push({
            src: formatInnerLink(props.subtitlesInfo[i].src, props.siteUrl),
            srclang: props.subtitlesInfo[i].srclang,
            label: props.subtitlesInfo[i].label,
            type: 'manual'
          });
        }
        i += 1;
      }
    }

    // Add HLS-generated subtitles
    if (void 0 !== props.hlsSubtitlesInfo && null !== props.hlsSubtitlesInfo && props.hlsSubtitlesInfo.length) {
      let i = 0;
      while (i < props.hlsSubtitlesInfo.length) {
        if (
          void 0 !== props.hlsSubtitlesInfo[i].src &&
          void 0 !== props.hlsSubtitlesInfo[i].srclang &&
          void 0 !== props.hlsSubtitlesInfo[i].label
        ) {
          allSubtitles.push({
            src: formatInnerLink(props.hlsSubtitlesInfo[i].src, props.siteUrl),
            srclang: props.hlsSubtitlesInfo[i].srclang,
            label: props.hlsSubtitlesInfo[i].label,
            type: 'hls'
          });
        }
        i += 1;
      }
    }

    if (allSubtitles.length) {
      subtitles.languages = allSubtitles;
      subtitles.on = true;
      console.log('DEBUG: Subtitles configured for MediaCMS player:', subtitles);
    } else {
      console.log('DEBUG: No subtitles found. HLS subtitles:', props.hlsSubtitlesInfo);
    }

    // Configure audio tracks
    const audioTracks = {
      on: false,
    };

    // Add HLS-generated audio tracks
    if (void 0 !== props.hlsAudioTracksInfo && null !== props.hlsAudioTracksInfo && props.hlsAudioTracksInfo.length) {
      audioTracks.languages = props.hlsAudioTracksInfo.map(track => ({
        src: formatInnerLink(track.src, props.siteUrl),
        srclang: track.srclang,
        label: track.label,
        type: 'hls'
      }));
      audioTracks.on = true;
      console.log('DEBUG: Audio tracks configured for MediaCMS player:', audioTracks);
    } else {
      console.log('DEBUG: No HLS audio tracks found:', props.hlsAudioTracksInfo);
    }

    // Map quality labels if needed
    const mappedSources = mapQualityLabels(props.sources);

    player = new MediaPlayer(
      videoElemRef.current,
      {
        enabledTouchControls: true,
        sources: mappedSources,
        poster: props.poster,
        autoplay: props.enableAutoplay,
        bigPlayButton: true,
        controlBar: {
          theaterMode: props.hasTheaterMode,
          pictureInPicture: false,
          next: props.hasNextLink ? true : false,
          previous: props.hasPreviousLink ? true : false,
          audioTracksButton: true,
          subtitlesButton: true,
        },
        subtitles: subtitles,
        audioTracks: audioTracks,
        cornerLayers: props.cornerLayers,
        videoPreviewThumb: props.previewSprite,
      },
      {
        volume: playerStates.playerVolume,
        soundMuted: playerStates.playerSoundMuted,
        theaterMode: playerStates.inTheaterMode,
        theSelectedQuality: void 0, // @note: Allow auto resolution selection by sources order.
        theSelectedPlaybackSpeed: playerStates.videoPlaybackSpeed || 1,
      },
      props.info,
      [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      onPlayerStateUpdate,
      onClickNext,
      onClickPrevious
    );

    // Setup enhanced features
    if (videoElemRef.current) {
      // Apply initial aspect ratio
      applyAspectRatio(aspectRatio);
      
      // Setup double-tap seek
      const cleanupDoubleTap = setupDoubleTapSeek(videoElemRef.current);
      
      // Store cleanup function
      if (cleanupDoubleTap) {
        player._cleanupDoubleTap = cleanupDoubleTap;
      }
    }

    if (void 0 !== props.onPlayerInitCallback) {
      props.onPlayerInitCallback(player, videoElemRef.current);
    }
  }

  function unsetPlayer() {
    if (null === player) {
      return;
    }
    
    // Cleanup double-tap event listener
    if (player._cleanupDoubleTap) {
      player._cleanupDoubleTap();
    }
    
    videojs(videoElemRef.current).dispose();
    player = null;
  }

  useEffect(() => {
    if (props.inEmbed || document.hasFocus() || 'visible' === document.visibilityState) {
      initPlayer();
    } else {
      window.addEventListener('focus', initPlayer);
      document.addEventListener('visibilitychange', initPlayer);
    }

    /*
      // We don't need this because we have a custom function in frontend/src/static/js/components/media-viewer/VideoViewer/index.js:617
      player && player.player.one('loadedmetadata', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paramT = Number(urlParams.get('t'));
      const timestamp = !isNaN(paramT) ? paramT : 0;
      player.player.currentTime(timestamp);
    }); */

    return () => {
      unsetPlayer();

      if (void 0 !== props.onUnmountCallback) {
        props.onUnmountCallback();
      }
    };
  }, []);

  // Update aspect ratio when it changes
  useEffect(() => {
    applyAspectRatio(aspectRatio);
  }, [aspectRatio]);

  return null === props.errorMessage ? (
    <div className="enhanced-video-player">
      <video ref={videoElemRef} className="video-js vjs-mediacms native-dimensions"></video>
      
      {/* Aspect Ratio Controls */}
      <div className="aspect-ratio-controls">
        <button 
          className={`aspect-btn ${aspectRatio === '4:3' ? 'active' : ''}`}
          onClick={() => setAspectRatio('4:3')}
          title="4:3 Aspect Ratio"
        >
          4:3
        </button>
        <button 
          className={`aspect-btn ${aspectRatio === '16:9' ? 'active' : ''}`}
          onClick={() => setAspectRatio('16:9')}
          title="16:9 Aspect Ratio"
        >
          16:9
        </button>
        <button 
          className={`aspect-btn ${aspectRatio === 'fullscreen' ? 'active' : ''}`}
          onClick={() => setAspectRatio('fullscreen')}
          title="Fullscreen by Screen Size"
        >
          <i className="material-icons">fullscreen</i>
        </button>
      </div>
      
      {/* Double-tap Seek Controls */}
      <div className="seek-controls">
        <label>
          <input 
            type="checkbox" 
            checked={doubleTapSeekEnabled}
            onChange={(e) => setDoubleTapSeekEnabled(e.target.checked)}
          />
          Double-tap Seek
        </label>
        <select 
          value={seekAmount} 
          onChange={(e) => setSeekAmount(Number(e.target.value))}
          disabled={!doubleTapSeekEnabled}
        >
          <option value={5}>5s</option>
          <option value={10}>10s</option>
          <option value={15}>15s</option>
          <option value={30}>30s</option>
        </select>
      </div>
    </div>
  ) : (
    <div className="error-container">
      <div className="error-container-inner">
        <span className="icon-wrap">
          <i className="material-icons">error_outline</i>
        </span>
        <span className="msg-wrap">{props.errorMessage}</span>
      </div>
    </div>
  );
}

VideoPlayer.propTypes = {
  playerVolume: PropTypes.string,
  playerSoundMuted: PropTypes.bool,
  videoQuality: PropTypes.string,
  videoPlaybackSpeed: PropTypes.number,
  inTheaterMode: PropTypes.bool,
  siteId: PropTypes.string.isRequired,
  siteUrl: PropTypes.string.isRequired,
  errorMessage: PropTypes.string,
  cornerLayers: PropTypes.object,
  subtitlesInfo: PropTypes.array.isRequired,
  hlsSubtitlesInfo: PropTypes.array.isRequired,
  hlsAudioTracksInfo: PropTypes.array.isRequired,
  inEmbed: PropTypes.bool.isRequired,
  sources: PropTypes.array.isRequired,
  info: PropTypes.object.isRequired,
  enableAutoplay: PropTypes.bool.isRequired,
  hasTheaterMode: PropTypes.bool.isRequired,
  hasNextLink: PropTypes.bool.isRequired,
  hasPreviousLink: PropTypes.bool.isRequired,
  poster: PropTypes.string,
  previewSprite: PropTypes.object,
  onClickPreviousCallback: PropTypes.func,
  onClickNextCallback: PropTypes.func,
  onPlayerInitCallback: PropTypes.func,
  onStateUpdateCallback: PropTypes.func,
  onUnmountCallback: PropTypes.func,
  hide1080pQuality: PropTypes.bool, // New prop for quality mapping
};

VideoPlayer.defaultProps = {
  hide1080pQuality: false,
  errorMessage: null,
  cornerLayers: {},
};
