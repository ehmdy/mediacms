/**
 * MediaCMS Track Buttons Enabler
 * Ensures audio and subtitle track buttons are visible when tracks are available
 */

(function() {
    'use strict';
    
    console.log('Track Buttons Enabler: Loading...');
    
    function enableTrackButtons() {
        // Add CSS to ensure menus are always on top, especially in fullscreen
        const style = document.createElement('style');
        style.textContent = `
            .custom-audio-menu,
            .custom-subtitle-menu {
                z-index: 2147483647 !important;
                position: fixed !important;
            }
            
            .custom-audio-tracks-button,
            .custom-subtitles-button {
                z-index: 2147483647 !important;
                font-size: 24px !important;
            }
            
            /* Ensure menus are visible in fullscreen */
            .vjs-fullscreen .custom-audio-menu,
            .vjs-fullscreen .custom-subtitle-menu {
                z-index: 2147483647 !important;
            }
            
            .vjs-fullscreen .custom-audio-tracks-button,
            .vjs-fullscreen .custom-subtitles-button {
                z-index: 2147483647 !important;
                font-size: 24px !important;
            }
            
            /* Additional fullscreen support */
            .vjs-fullscreen .vjs-control-bar .custom-audio-tracks-button,
            .vjs-fullscreen .vjs-control-bar .custom-subtitles-button {
                z-index: 2147483647 !important;
                font-size: 24px !important;
            }
            
            /* Ensure menus work in fullscreen container */
            .vjs-fullscreen .custom-audio-menu,
            .vjs-fullscreen .custom-subtitle-menu {
                position: fixed !important;
                z-index: 2147483647 !important;
                pointer-events: auto !important;
            }
        `;
        document.head.appendChild(style);
        
        // Wait for the MediaCMS player to be fully loaded
        const checkPlayer = setInterval(() => {
            // Try to find the player by different methods
            let player = null;
            
            // Method 1: Look for video element with vjs class
            const videoElement = document.querySelector('video.vjs-tech');
            if (videoElement && window.videojs) {
                const playerId = videoElement.parentElement.id;
                if (playerId) {
                    try {
                        player = window.videojs.getPlayer(playerId);
                    } catch (e) {
                        console.log('Could not get player by parent ID:', playerId);
                    }
                }
            }
            
            // Method 2: Try to find any Video.js player
            if (!player && window.videojs && window.videojs.getPlayers) {
                const players = window.videojs.getPlayers();
                const playerIds = Object.keys(players);
                if (playerIds.length > 0) {
                    player = players[playerIds[0]];
                    console.log('Track Buttons Enabler: Found player with ID:', playerIds[0]);
                }
            }
            
            // Method 3: Try common player IDs
            if (!player && window.videojs && window.videojs.getPlayer) {
                const commonIds = ['vjs_video_3', 'video-player', 'player'];
                for (const id of commonIds) {
                    try {
                        player = window.videojs.getPlayer(id);
                        if (player) {
                            console.log('Track Buttons Enabler: Found player with common ID:', id);
                            break;
                        }
                    } catch (e) {
                        // Ignore errors for non-existent players
                    }
                }
            }
            
            // Method 4: Try to find player by video element ID
            if (!player) {
                const anyVideoElement = document.querySelector('video');
                if (anyVideoElement && anyVideoElement.id && window.videojs) {
                    try {
                        player = window.videojs.getPlayer(anyVideoElement.id);
                        console.log('Track Buttons Enabler: Found player by video element ID:', anyVideoElement.id);
                    } catch (e) {
                        console.log('Could not get player by video element ID');
                    }
                }
            }
            
            if (player && player.ready) {
                console.log('Track Buttons Enabler: Player found with ID:', player.id());
                clearInterval(checkPlayer);
                
                // Intercept player source to force master playlist
                interceptPlayerSource(player);
                
                // Always show buttons regardless of track data status
                console.log('🎯 Configuring track buttons...');
                
                // Check if we have track data from the backend
                if (window.MediaCMS && window.MediaCMS.trackData) {
                    const { audioTracks, subtitleTracks } = window.MediaCMS.trackData;
                    console.log('🔍 DEBUG: window.MediaCMS.trackData:', window.MediaCMS.trackData);
                    console.log('🔍 DEBUG: audioTracks:', audioTracks);
                    console.log('🔍 DEBUG: audioTracks length:', audioTracks?.length);
                    console.log('🔍 DEBUG: currentSrc:', player.src());
                    
                    // Since we're intercepting the source, just configure tracks directly
                    console.log('🎯 Configuring tracks with intercepted master playlist...');
                    
                    // Configure tracks in Video.js
                    configureVideoJsTracks(player, audioTracks, subtitleTracks);
                    
                    // Listen for when audio tracks are actually loaded and ready
                    player.one('loadeddata', () => {
                        console.log('🎵 Audio tracks should be loaded now, reconfiguring...');
                        
                        // Wait for HLS audio tracks to be available
                        waitForHLSAudioTracks(player, (hls) => {
                            if (hls) {
                                console.log('✅ HLS audio tracks configured successfully');
                                // Also configure subtitle tracks
                                configureVideoJsTracks(player, audioTracks, subtitleTracks);
                            } else {
                                console.log('⚠️ Falling back to manual track configuration');
                                configureVideoJsTracks(player, audioTracks, subtitleTracks);
                            }
                        });
                    });
                    
                    // Listen for audio track changes
                    player.audioTracks().on('change', () => {
                        console.log('🎵 Audio track change detected');
                    });
                    
                    // Start persistent audio track enforcement
                    startAudioTrackEnforcement(player);
                } else {
                    console.log('⚠️ No track data available, showing buttons anyway');
                }
                
                // Always show audio button regardless of track status
                showAudioTracksButton(player);
                
                // Always show subtitle button regardless of track status
                showSubtitlesButton(player);
                
                // Clean up when player is disposed
                player.one('dispose', () => {
                    stopAudioTrackEnforcement();
                });
            }
        }, 500);
        
        // Stop checking after 30 seconds
        setTimeout(() => {
            clearInterval(checkPlayer);
        }, 30000);
    }

    // Create a custom HLS master playlist with selected audio track as default
    function createCustomMasterPlaylist(selectedTrack, trackIndex, baseUrl) {
        console.log('Creating custom master playlist for track:', selectedTrack.label, 'index:', trackIndex);
        console.log('Base URL for absolute paths:', baseUrl);
        
        // Get all available tracks
        const audioTracks = window.MediaCMS.trackData.audioTracks;
        const subtitleTracks = window.MediaCMS.trackData.subtitleTracks;
        
        let manifest = '';
        
        // Add audio tracks with the selected one as default
        audioTracks.forEach((track, index) => {
            const isDefault = index === trackIndex;
            const isAutoSelect = index === trackIndex;
            
            manifest += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${track.label}"`;
            
            if (track.srclang) {
                manifest += `,LANGUAGE="${track.srclang}"`;
            }
            
            if (isDefault) {
                manifest += ',DEFAULT=YES';
            }
            
            if (isAutoSelect) {
                manifest += ',AUTOSELECT=YES';
            } else {
                manifest += ',AUTOSELECT=NO';
            }
            
            // Use absolute URL for audio files
            const audioFileName = track.src.split('/').pop();
            manifest += `,URI="${baseUrl}/${audioFileName}"\n`;
        });
        
        // Add subtitle tracks
        if (subtitleTracks && subtitleTracks.length > 0) {
            subtitleTracks.forEach((track, index) => {
                manifest += `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitles",NAME="${track.label}"`;
                
                if (track.srclang) {
                    manifest += `,LANGUAGE="${track.srclang}"`;
                }
                
                // Use absolute URL for subtitle files
                const subtitleFileName = track.src.split('/').pop();
                manifest += `,AUTOSELECT=NO,URI="${baseUrl}/${subtitleFileName}"\n`;
            });
        }
        
        // Add standard HLS headers
        manifest += `#EXTM3U\n`;
        manifest += `# Created with Bento4 mp4-hls.py version 1.2.0r637\n\n`;
        manifest += `#EXT-X-VERSION:4\n\n`;
        manifest += `# Media Playlists\n`;
        
        // Add video stream entries with absolute URLs
        manifest += `#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1617234,BANDWIDTH=1908359,CODECS="avc1.4D402A,mp4a.40.2",RESOLUTION=852x480,AUDIO="audio",SUBTITLES="subtitles"\n`;
        manifest += `${baseUrl}media-1/stream.m3u8\n`;
        manifest += `#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3156724,BANDWIDTH=4093930,CODECS="avc1.4D402A,mp4a.40.2",RESOLUTION=1280x720,AUDIO="audio",SUBTITLES="subtitles"\n`;
        manifest += `${baseUrl}media-2/stream.m3u8\n`;
        
        console.log('Generated custom master playlist:', manifest);
        return manifest;
    }
    
    function showAudioTracksButton(player) {
        console.log('Track Buttons Enabler: Enabling audio tracks button');
        
        // Try to find and show existing audio button
        const audioButton = player.controlBar.audioTrackButton;
        if (audioButton) {
            audioButton.show();
            console.log('Track Buttons Enabler: Audio button shown');
        } else {
            // Create custom audio button if needed
            console.log('Track Buttons Enabler: Creating custom audio button');
            addCustomAudioButton(player);
        }
    }
    
    function showSubtitlesButton(player) {
        console.log('Track Buttons Enabler: Enabling subtitles button');
        
        // Try to find and show existing subtitles button
        const subtitlesButton = player.controlBar.subtitlesButton;
        if (subtitlesButton) {
            subtitlesButton.show();
            console.log('Track Buttons Enabler: Subtitles button shown');
        } else {
            // Create custom subtitles button if needed
            console.log('Track Buttons Enabler: Creating custom subtitles button');
            addCustomSubtitlesButton(player);
        }
    }
    
    function addCustomAudioButton(player) {
        // Find the control bar in the DOM
        let controlBar = null;
        
        // Try multiple methods to find control bar
        if (player.controlBar && player.controlBar.el) {
            controlBar = player.controlBar.el();
        }
        
        if (!controlBar) {
            // Fallback: find by class name
            controlBar = document.querySelector('.vjs-control-bar');
        }
        
        if (!controlBar) {
            // Another fallback: find inside player element
            const playerEl = document.getElementById(player.id());
            if (playerEl) {
                controlBar = playerEl.querySelector('[class*="control"]');
            }
        }
        
        if (!controlBar) {
            console.log('Track Buttons Enabler: Could not find control bar for audio button');
            return;
        }
        
        const rightControls = controlBar.querySelector('.vjs-right-controls') || 
                             controlBar.querySelector('[class*="right"]') || 
                             controlBar;
        
        // Look for settings button within the rightControls
        const settingsButton = rightControls.querySelector('[class*="settings"]') || 
                               rightControls.querySelector('[title*="Settings"]') ||
                               rightControls.querySelector('.vjs-settings-menu-button') ||
                               rightControls.querySelector('[class*="menu"]');
        
        const audioButton = document.createElement('button');
        audioButton.className = 'vjs-control vjs-button custom-audio-tracks-button';
        audioButton.innerHTML = '<span class="vjs-icon-placeholder" aria-hidden="true">♫</span>';
        audioButton.title = 'Audio Tracks';
        audioButton.setAttribute('aria-label', 'Audio Tracks');
        audioButton.style.cssText = `
            color: white; 
            font-size: 24px; 
            font-weight: bold;
            padding: 10px 12px; 
            margin: 0 2px; 
            position: relative;
            background: transparent;
            border: none;
            border-radius: 4px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 40px;
            height: 36px;
            cursor: pointer;
            z-index: 2147483647;
            pointer-events: auto;
        `;
        
        // Create dropdown menu
        const audioMenu = document.createElement('div');
        audioMenu.className = 'custom-audio-menu';
        audioMenu.style.cssText = `
            display: none;
            position: fixed;
            background: #1C1C1C;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            min-width: 160px;
            max-width: 200px;
            z-index: 2147483647;
            padding: 8px 0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            white-space: nowrap;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;
        
        // Populate audio menu
        const audioTracks = window.MediaCMS.trackData?.audioTracks || [];
        
        if (audioTracks.length > 0) {
            audioTracks.forEach((track, index) => {
                const menuItem = document.createElement('div');
                menuItem.className = 'audio-menu-item';
                menuItem.textContent = track.label;
                menuItem.style.cssText = `
                    padding: 10px 16px;
                    color: #ffffff;
                    cursor: pointer;
                    font-size: 14px;
                    line-height: 1.4;
                    transition: background-color 0.2s ease;
                    border-bottom: none;
                `;
                
                menuItem.addEventListener('mouseenter', () => {
                    menuItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                });
                
                menuItem.addEventListener('mouseleave', () => {
                    menuItem.style.backgroundColor = 'transparent';
                });
                
                menuItem.addEventListener('click', () => {
                    switchToAudioTrack(index, track);
                    audioMenu.style.display = 'none';
                });
                
                audioMenu.appendChild(menuItem);
            });
        } else {
            // Show "No audio tracks available" message
            const menuItem = document.createElement('div');
            menuItem.className = 'audio-menu-item';
            menuItem.textContent = 'No audio tracks available';
            menuItem.style.cssText = `
                padding: 10px 16px;
                color: #cccccc;
                font-size: 14px;
                line-height: 1.4;
                font-style: italic;
                border-bottom: none;
            `;
            audioMenu.appendChild(menuItem);
        }
        
        // Append menu to the correct container (handle fullscreen mode)
        const appendToContainer = () => {
            // Check if we're in fullscreen mode
            const isFullscreen = player.isFullscreen() || 
                                document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement || 
                                document.msFullscreenElement ||
                                document.querySelector('.vjs-fullscreen');
            
            if (isFullscreen) {
                // In fullscreen, try multiple selectors for the fullscreen container
                let fullscreenContainer = document.querySelector('.vjs-fullscreen') ||
                                        document.querySelector('.vjs-tech') ||
                                        document.querySelector('video').parentElement;
                
                if (fullscreenContainer) {
                    fullscreenContainer.appendChild(audioMenu);
                    console.log('Audio menu appended to fullscreen container');
                } else {
        document.body.appendChild(audioMenu);
                    console.log('Audio menu appended to body (fullscreen container not found)');
                }
            } else {
                // Normal mode, append to body
                document.body.appendChild(audioMenu);
                console.log('Audio menu appended to body (normal mode)');
            }
        };
        
        appendToContainer();
        
        // Handle fullscreen changes for audio menu
        player.on('fullscreenchange', () => {
            // Move menu to correct container when fullscreen changes
            setTimeout(() => {
                const isFullscreen = player.isFullscreen() || 
                                    document.fullscreenElement || 
                                    document.webkitFullscreenElement || 
                                    document.mozFullScreenElement || 
                                    document.msFullscreenElement ||
                                    document.querySelector('.vjs-fullscreen');
                
                const currentContainer = audioMenu.parentNode;
                let targetContainer;
                
                if (isFullscreen) {
                    targetContainer = document.querySelector('.vjs-fullscreen') ||
                                    document.querySelector('.vjs-tech') ||
                                    document.querySelector('video').parentElement ||
                                    document.body;
                } else {
                    targetContainer = document.body;
                }
                
                if (currentContainer !== targetContainer && targetContainer) {
                    // Remove from current container
                    if (currentContainer) {
                        currentContainer.removeChild(audioMenu);
                    }
                    // Add to target container
                    targetContainer.appendChild(audioMenu);
                    console.log('Audio menu moved to:', targetContainer.className || 'body', 'Fullscreen:', isFullscreen);
                }
            }, 100);
        });
        
        // Add hover effects
        audioButton.addEventListener('mouseenter', () => {
            audioButton.style.background = 'rgba(255, 255, 255, 0.1)';
            audioButton.style.transform = 'scale(1.05)';
        });
        
        audioButton.addEventListener('mouseleave', () => {
            audioButton.style.background = 'transparent';
            audioButton.style.transform = 'scale(1)';
        });
        
        audioButton.addEventListener('click', (e) => {
            console.log('Audio button clicked!');
            e.preventDefault();
            e.stopPropagation();
            
            // Hide subtitle menu if open
            const subtitleMenu = document.querySelector('.custom-subtitle-menu');
            if (subtitleMenu) {
                subtitleMenu.style.display = 'none';
                console.log('Subtitle menu hidden');
            }
            
            // Toggle audio menu
            const currentDisplay = audioMenu.style.display;
            console.log('Current audio menu display:', currentDisplay);
            
            if (currentDisplay === 'none' || currentDisplay === '') {
                // Calculate position relative to button
                const buttonRect = audioButton.getBoundingClientRect();
                audioMenu.style.left = (buttonRect.left + buttonRect.width / 2) + 'px';
                audioMenu.style.top = (buttonRect.top - 8) + 'px';
                audioMenu.style.transform = 'translate(-50%, -100%)';
                
                audioMenu.style.display = 'block';
                console.log('Audio menu opened');
                console.log('Button position:', buttonRect);
                console.log('Audio menu position:', audioMenu.getBoundingClientRect());
                console.log('Audio menu parent:', audioMenu.parentElement);
                console.log('Audio menu visibility:', window.getComputedStyle(audioMenu).visibility);
                
            } else {
                audioMenu.style.display = 'none';
                console.log('Audio menu closed');
            }
        });
        
        // Insert before settings button if found, otherwise append
        try {
            if (settingsButton && settingsButton.parentNode === rightControls) {
                rightControls.insertBefore(audioButton, settingsButton);
                console.log('Track Buttons Enabler: Audio button inserted before settings');
            } else {
                rightControls.appendChild(audioButton);
                console.log('Track Buttons Enabler: Audio button appended to controls');
            }
        } catch (error) {
            console.error('Error inserting audio button:', error);
            rightControls.appendChild(audioButton);
        }
        console.log('Track Buttons Enabler: Custom audio button added to:', rightControls.className);
        console.log('Track Buttons Enabler: Audio button element:', audioButton);
        console.log('Track Buttons Enabler: Audio button has click listener:', audioButton.onclick !== null);
        
        // Test if button is actually clickable
        setTimeout(() => {
            console.log('Track Buttons Enabler: Testing audio button clickability...');
            const testEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            console.log('Track Buttons Enabler: Dispatching test click on audio button');
            audioButton.dispatchEvent(testEvent);
        }, 1000);
    }
    
    function addCustomSubtitlesButton(player) {
        // Find the control bar in the DOM (same robust approach as audio)
        let controlBar = null;
        
        if (player.controlBar && player.controlBar.el) {
            controlBar = player.controlBar.el();
        }
        
        if (!controlBar) {
            controlBar = document.querySelector('.vjs-control-bar');
        }
        
        if (!controlBar) {
            const playerEl = document.getElementById(player.id());
            if (playerEl) {
                controlBar = playerEl.querySelector('[class*="control"]');
            }
        }
        
        if (!controlBar) {
            console.log('Track Buttons Enabler: Could not find control bar for subtitles button');
            return;
        }
        
        const rightControls = controlBar.querySelector('.vjs-right-controls') || 
                             controlBar.querySelector('[class*="right"]') || 
                             controlBar;
        
        // Look for settings button within the rightControls
        const settingsButton = rightControls.querySelector('[class*="settings"]') || 
                               rightControls.querySelector('[title*="Settings"]') ||
                               rightControls.querySelector('.vjs-settings-menu-button') ||
                               rightControls.querySelector('[class*="menu"]');
        
        const subtitlesButton = document.createElement('button');
        subtitlesButton.className = 'vjs-control vjs-button custom-subtitles-button';
        subtitlesButton.innerHTML = '<span class="vjs-icon-placeholder" aria-hidden="true">CC</span>';
        subtitlesButton.title = 'Subtitles';
        subtitlesButton.setAttribute('aria-label', 'Subtitles');
        subtitlesButton.style.cssText = `
            color: white; 
            font-size: 10px; 
            font-weight: bold;
            padding: 10px 12px; 
            margin: 0 2px; 
            position: relative;
            background: transparent;
            border: none;
            border-radius: 4px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 40px;
            height: 36px;
            cursor: pointer;
            z-index: 2147483647;
            pointer-events: auto;
        `;
        
        // Create dropdown menu
        const subtitleMenu = document.createElement('div');
        subtitleMenu.className = 'custom-subtitle-menu';
        subtitleMenu.style.cssText = `
            display: none;
            position: fixed;
            background: #1C1C1C;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            min-width: 160px;
            max-width: 200px;
            z-index: 2147483647;
            padding: 8px 0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            white-space: nowrap;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;
        
        // Add "Off" option first
        const offItem = document.createElement('div');
        offItem.className = 'subtitle-menu-item';
        offItem.textContent = 'Off';
        offItem.style.cssText = `
            padding: 10px 16px;
            color: #ffffff;
            cursor: pointer;
            font-size: 14px;
            line-height: 1.4;
            transition: background-color 0.2s ease;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        `;
        
        offItem.addEventListener('mouseenter', () => {
            offItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });
        
        offItem.addEventListener('mouseleave', () => {
            offItem.style.backgroundColor = 'transparent';
        });
        
        offItem.addEventListener('click', () => {
            switchToSubtitleTrack(-1, null); // -1 means off
            subtitleMenu.style.display = 'none';
        });
        
        subtitleMenu.appendChild(offItem);
        
        // Populate subtitle menu
        const subtitleTracks = window.MediaCMS.trackData?.subtitleTracks || [];
        
        if (subtitleTracks.length > 0) {
            subtitleTracks.forEach((track, index) => {
                const menuItem = document.createElement('div');
                menuItem.className = 'subtitle-menu-item';
                menuItem.textContent = track.label;
                menuItem.style.cssText = `
                    padding: 10px 16px;
                    color: #ffffff;
                    cursor: pointer;
                    font-size: 14px;
                    line-height: 1.4;
                    transition: background-color 0.2s ease;
                    border-bottom: none;
                `;
                
                menuItem.addEventListener('mouseenter', () => {
                    menuItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                });
                
                menuItem.addEventListener('mouseleave', () => {
                    menuItem.style.backgroundColor = 'transparent';
                });
                
                menuItem.addEventListener('click', () => {
                    switchToSubtitleTrack(index, track);
                    subtitleMenu.style.display = 'none';
                });
                
                subtitleMenu.appendChild(menuItem);
            });
        } else {
            // Show "No subtitle tracks available" message
            const menuItem = document.createElement('div');
            menuItem.className = 'subtitle-menu-item';
            menuItem.textContent = 'No subtitle tracks available';
            menuItem.style.cssText = `
                padding: 10px 16px;
                color: #cccccc;
                font-size: 14px;
                line-height: 1.4;
                font-style: italic;
                border-bottom: none;
            `;
            subtitleMenu.appendChild(menuItem);
        }
        
        // Append menu to the correct container (handle fullscreen mode)
        const appendToContainer = () => {
            // Check if we're in fullscreen mode
            const isFullscreen = player.isFullscreen() || 
                                document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement || 
                                document.msFullscreenElement ||
                                document.querySelector('.vjs-fullscreen');
            
            if (isFullscreen) {
                // In fullscreen, try multiple selectors for the fullscreen container
                let fullscreenContainer = document.querySelector('.vjs-fullscreen') ||
                                        document.querySelector('.vjs-tech') ||
                                        document.querySelector('video').parentElement;
                
                if (fullscreenContainer) {
                    fullscreenContainer.appendChild(subtitleMenu);
                    console.log('Subtitle menu appended to fullscreen container');
                } else {
        document.body.appendChild(subtitleMenu);
                    console.log('Subtitle menu appended to body (fullscreen container not found)');
                }
            } else {
                // Normal mode, append to body
                document.body.appendChild(subtitleMenu);
                console.log('Subtitle menu appended to body (normal mode)');
            }
        };
        
        appendToContainer();
        
        // Handle fullscreen changes for subtitle menu
        player.on('fullscreenchange', () => {
            // Move menu to correct container when fullscreen changes
            setTimeout(() => {
                const isFullscreen = player.isFullscreen() || 
                                    document.fullscreenElement || 
                                    document.webkitFullscreenElement || 
                                    document.mozFullScreenElement || 
                                    document.msFullscreenElement ||
                                    document.querySelector('.vjs-fullscreen');
                
                const currentContainer = subtitleMenu.parentNode;
                let targetContainer;
                
                if (isFullscreen) {
                    targetContainer = document.querySelector('.vjs-fullscreen') ||
                                    document.querySelector('.vjs-tech') ||
                                    document.querySelector('video').parentElement ||
                                    document.body;
                } else {
                    targetContainer = document.body;
                }
                
                if (currentContainer !== targetContainer && targetContainer) {
                    // Remove from current container
                    if (currentContainer) {
                        currentContainer.removeChild(subtitleMenu);
                    }
                    // Add to target container
                    targetContainer.appendChild(subtitleMenu);
                    console.log('Subtitle menu moved to:', targetContainer.className || 'body', 'Fullscreen:', isFullscreen);
                }
            }, 100);
        });
        
        // Add hover effects
        subtitlesButton.addEventListener('mouseenter', () => {
            subtitlesButton.style.background = 'rgba(255, 255, 255, 0.1)';
            subtitlesButton.style.transform = 'scale(1.05)';
        });
        
        subtitlesButton.addEventListener('mouseleave', () => {
            subtitlesButton.style.background = 'transparent';
            subtitlesButton.style.transform = 'scale(1)';
        });
        
        subtitlesButton.addEventListener('click', (e) => {
            console.log('Subtitles button clicked!');
            e.preventDefault();
            e.stopPropagation();
            
            // Hide audio menu if open
            const audioMenu = document.querySelector('.custom-audio-menu');
            if (audioMenu) {
                audioMenu.style.display = 'none';
                console.log('Audio menu hidden');
            }
            
            // Toggle subtitle menu
            const currentDisplay = subtitleMenu.style.display;
            console.log('Current subtitle menu display:', currentDisplay);
            
            if (currentDisplay === 'none' || currentDisplay === '') {
                // Calculate position relative to button
                const buttonRect = subtitlesButton.getBoundingClientRect();
                subtitleMenu.style.left = (buttonRect.left + buttonRect.width / 2) + 'px';
                subtitleMenu.style.top = (buttonRect.top - 8) + 'px';
                subtitleMenu.style.transform = 'translate(-50%, -100%)';
                
                subtitleMenu.style.display = 'block';
                console.log('Subtitle menu opened');
                console.log('Button position:', buttonRect);
                console.log('Subtitle menu position:', subtitleMenu.getBoundingClientRect());
                console.log('Subtitle menu parent:', subtitleMenu.parentElement);
                console.log('Subtitle menu visibility:', window.getComputedStyle(subtitleMenu).visibility);
                
            } else {
                subtitleMenu.style.display = 'none';
                console.log('Subtitle menu closed');
            }
        });
        
        // Insert before settings button if found, otherwise append
        try {
            if (settingsButton && settingsButton.parentNode === rightControls) {
                rightControls.insertBefore(subtitlesButton, settingsButton);
                console.log('Track Buttons Enabler: Subtitles button inserted before settings');
            } else {
                rightControls.appendChild(subtitlesButton);
                console.log('Track Buttons Enabler: Subtitles button appended to controls');
            }
        } catch (error) {
            console.error('Error inserting subtitles button:', error);
            rightControls.appendChild(subtitlesButton);
        }
        console.log('Track Buttons Enabler: Custom subtitles button added to:', rightControls.className);
        console.log('Track Buttons Enabler: Subtitles button element:', subtitlesButton);
        console.log('Track Buttons Enabler: Subtitles button has click listener:', subtitlesButton.onclick !== null);
        
        // Add global click handler to close menus when clicking outside
        document.addEventListener('click', (e) => {
            const audioMenu = document.querySelector('.custom-audio-menu');
            const subtitleMenu = document.querySelector('.custom-subtitle-menu');
            
            // If click is not on a button or menu, close all menus
            if (!e.target.closest('.custom-audio-tracks-button') && 
                !e.target.closest('.custom-audio-menu')) {
                if (audioMenu) {
                    audioMenu.style.display = 'none';
                }
            }
            
            if (!e.target.closest('.custom-subtitles-button') && 
                !e.target.closest('.custom-subtitle-menu')) {
                if (subtitleMenu) {
                    subtitleMenu.style.display = 'none';
                }
            }
        });
    }
    
    // Intercept player source setting to force master playlist
    function interceptPlayerSource(player) {
        console.log('🎯 Intercepting player source to force master playlist...');
        
        // Override the src method to always use master playlist
        const originalSrc = player.src;
        player.src = function(src) {
            console.log('🔍 Player.src() called with:', src);
            
            if (src && typeof src === 'string' && src.includes('.m3u8') && !src.includes('master.m3u8')) {
                // Convert media stream to master playlist
                let masterUrl = src;
                if (src.includes('/media-')) {
                    masterUrl = src.replace(/\/media-[^\/]*\/[^\/]*\.m3u8.*$/, '/master.m3u8');
                } else {
                    masterUrl = src.replace(/\/[^\/]*\.m3u8.*$/, '/master.m3u8');
                }
                
                console.log('🔄 Converting media stream to master playlist:', masterUrl);
                return originalSrc.call(this, masterUrl);
            }
            
            return originalSrc.call(this, src);
        };
        
        // Also override the load method
        const originalLoad = player.load;
        player.load = function() {
            console.log('🔍 Player.load() called');
            return originalLoad.call(this);
        };
    }
    
    // Persistent audio track enforcement
    let selectedAudioTrackIndex = 0; // Track the currently selected audio track
    let audioTrackEnforcementInterval = null;
    
    function startAudioTrackEnforcement(player) {
        console.log('🎯 Starting persistent audio track enforcement...');
        
        // Clear any existing interval
        if (audioTrackEnforcementInterval) {
            clearInterval(audioTrackEnforcementInterval);
        }
        
        // Enforce audio track every 2 seconds
        audioTrackEnforcementInterval = setInterval(() => {
            const audioTracks = player.audioTracks();
            if (audioTracks && audioTracks.length > selectedAudioTrackIndex) {
                const currentTrack = audioTracks[selectedAudioTrackIndex];
                if (!currentTrack.enabled) {
                    console.log(`🔄 Enforcing audio track ${selectedAudioTrackIndex}: ${currentTrack.label}`);
                    
                    // Disable all tracks first
                    for (let i = 0; i < audioTracks.length; i++) {
                        audioTracks[i].enabled = false;
                    }
                    
                    // Enable the selected track
                    audioTracks[selectedAudioTrackIndex].enabled = true;
                    
                    // Trigger change event
                    audioTracks.trigger('change');
                }
            }
        }, 2000);
    }
    
    function stopAudioTrackEnforcement() {
        if (audioTrackEnforcementInterval) {
            clearInterval(audioTrackEnforcementInterval);
            audioTrackEnforcementInterval = null;
            console.log('🛑 Stopped audio track enforcement');
        }
    }
    function forceMasterPlaylist(player) {
        console.log('🎯 Forcing master playlist for proper audio track switching...');
        
        try {
            const currentSrc = player.src();
            console.log('📺 Current source:', currentSrc);
            
            // Check if we're using a specific media stream instead of master playlist
            if (currentSrc && currentSrc.includes('/media-') && !currentSrc.includes('master.m3u8')) {
                console.log('🔄 Switching from media stream to master playlist...');
                
                // Extract base URL and switch to master playlist
                let baseUrl = currentSrc;
                if (currentSrc.includes('/media-')) {
                    baseUrl = currentSrc.replace(/\/media-[^\/]*\/[^\/]*\.m3u8.*$/, '');
                } else {
                    baseUrl = currentSrc.replace(/\/[^\/]*\.m3u8.*$/, '');
                }
                
                const masterUrl = baseUrl + '/master.m3u8';
                console.log('🎯 Master playlist URL:', masterUrl);
                
                // Store current playback state
                const currentTime = player.currentTime();
                const wasPlaying = !player.paused();
                console.log(`⏱️ Storing state - time: ${currentTime}, playing: ${wasPlaying}`);
                
                // Test if master playlist is accessible first
                fetch(masterUrl, { method: 'HEAD' })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        console.log('✅ Master playlist is accessible, proceeding...');
                
                // Switch to master playlist
                player.src(masterUrl);
                
                        // Wait for master playlist to load, then restore state
                player.one('loadedmetadata', () => {
                            console.log('✅ Master playlist loaded successfully');
                    
                    // Wait a bit for the video to stabilize
                    setTimeout(() => {
                    // Restore playback state
                    if (currentTime > 0) {
                        player.currentTime(currentTime);
                    }
                    if (wasPlaying) {
                        player.play().catch(e => console.log('Auto-play prevented:', e));
                    }
                    
        // Wait for HLS to fully initialize and parse audio tracks
                    setTimeout(() => {
            console.log('🎯 Checking HLS initialization...');
            const tech = player.tech();
            let hls = null;
            
            if (tech.vhs && tech.vhs.hls) {
                hls = tech.vhs.hls;
            } else if (tech.hls) {
                hls = tech.hls;
            }
            
            if (hls) {
                console.log('🔍 HLS instance after master playlist load:');
                console.log('HLS audioTracks:', hls.audioTracks);
                console.log('HLS audioTracks length:', hls.audioTracks ? hls.audioTracks.length : 'undefined');
                console.log('HLS levels:', hls.levels ? hls.levels.length : 'no levels');
                
                // If audio tracks are available, log them for debugging
                if (hls.audioTracks && hls.audioTracks.length > 0) {
                    console.log('🎵 Available HLS audio tracks:');
                    hls.audioTracks.forEach((track, index) => {
                        console.log(`  ${index}: ${track.name || track.lang || 'Unknown'} (enabled: ${track.enabled})`);
                    });
                } else {
                    console.log('⚠️ HLS audio tracks not available, checking Video.js tracks...');
                    const audioTracks = player.audioTracks();
                    console.log(`📊 Video.js audio tracks after master playlist: ${audioTracks.length}`);
                    if (audioTracks.length > 0) {
                        for (let i = 0; i < audioTracks.length; i++) {
                            const track = audioTracks[i];
                            console.log(`  ${i}: ${track.label} (enabled: ${track.enabled})`);
                        }
                    }
                }
            } else {
                console.log('⚠️ No HLS instance found after master playlist load');
            }
        }, 2000);
                    }, 500);
                });
                    })
                    .catch(error => {
                        console.log('❌ Master playlist not accessible:', error.message);
                        console.log('🔄 Skipping master playlist switch, using current source...');
                        // Don't switch to master playlist if it's not accessible
                        // Just configure tracks with current source
                        setTimeout(() => {
                            configureVideoJsTracks();
                        }, 1000);
                    });
                
                // Also listen for errors
                player.one('error', (error) => {
                    console.error('❌ Error loading master playlist:', error);
                    // Fallback: try to restore original source
                    console.log('🔄 Fallback: Restoring original source...');
                    player.src(currentSrc);
                });
                
                // Add a timeout to prevent infinite loading
                setTimeout(() => {
                    if (player.paused() && wasPlaying) {
                        console.log('⚠️ Video still paused after master playlist load, attempting to restore...');
                        player.src(currentSrc);
                        setTimeout(() => {
                            if (currentTime > 0) {
                                player.currentTime(currentTime);
                            }
                            player.play().catch(e => console.log('Auto-play prevented:', e));
                        }, 500);
                    }
                }, 5000);
                
                return true;
            } else if (currentSrc && currentSrc.includes('master.m3u8')) {
                console.log('✅ Already using master playlist');
                return true;
            } else {
                console.log('⚠️ No HLS source detected, skipping master playlist switch');
                return false;
            }
        } catch (error) {
            console.error('❌ Error forcing master playlist:', error);
            return false;
        }
    }

    // HLS Audio Track Detection and Configuration
    function waitForHLSAudioTracks(player, callback) {
        console.log('🎯 Waiting for HLS audio tracks to be available...');
        
        let attempts = 0;
        const maxAttempts = 20;
        const interval = setInterval(() => {
            attempts++;
            console.log(`🔍 Checking for HLS audio tracks (attempt ${attempts}/${maxAttempts})...`);
            
            const tech = player.tech();
            let hls = null;
            
            // Try to get HLS instance
            if (tech.vhs && tech.vhs.hls) {
                hls = tech.vhs.hls;
            } else if (tech.hls) {
                hls = tech.hls;
            } else if (tech.vhs && tech.vhs.masterPlaylistController_ && tech.vhs.masterPlaylistController_.hls_) {
                hls = tech.vhs.masterPlaylistController_.hls_;
            }
            
            if (hls && hls.audioTracks && hls.audioTracks.length > 0) {
                console.log(`✅ HLS audio tracks found: ${hls.audioTracks.length}`);
                clearInterval(interval);
                
                // Create Video.js audio tracks based on HLS audio tracks
                const videoJsAudioTracks = player.audioTracks();
                console.log('Current Video.js audio tracks:', videoJsAudioTracks.length);
                
                // Clear existing tracks
                while (videoJsAudioTracks.length > 0) {
                    videoJsAudioTracks.removeTrack(videoJsAudioTracks[0]);
                }
                
                // Add each HLS audio track to Video.js
                hls.audioTracks.forEach((hlsTrack, index) => {
                    const audioTrack = new window.videojs.AudioTrack({
                        id: hlsTrack.id || `audio-${index}`,
                        kind: 'main',
                        label: hlsTrack.name || `Track ${index + 1}`,
                        language: hlsTrack.lang || '',
                        enabled: hlsTrack.enabled || index === 0
                    });
                    
                    videoJsAudioTracks.addTrack(audioTrack);
                    console.log(`Added audio track: ${audioTrack.label} (${audioTrack.language})`);
                });
                
                console.log('Final Video.js audio tracks:', videoJsAudioTracks.length);
                
                // Trigger change event
                videoJsAudioTracks.trigger('change');
                
                if (callback) callback(hls);
                        return;
                    }
            
            if (attempts >= maxAttempts) {
                console.log('⚠️ HLS audio tracks not found after maximum attempts');
                clearInterval(interval);
                if (callback) callback(null);
            }
        }, 500);
    }

    // Track switching functions
    // Direct HLS audio track switching with source manipulation
    function switchToAudioTrackDirect(trackIndex, track) {
        console.log(`🎵 DIRECT HLS SWITCHING: ${trackIndex} ${track.label}`);
        
        const player = window.videojs.getPlayer('vjs_video_3');
        if (!player) {
            console.log('❌ No player found for direct switching');
            return false;
        }
        
        try {
            // Store current state
            const currentTime = player.currentTime();
            const wasPlaying = !player.paused();
            
            // Store current subtitle track state
            const textTracks = player.textTracks();
            let activeSubtitleTrack = null;
            for (let i = 0; i < textTracks.length; i++) {
                if (textTracks[i].mode === 'showing') {
                    activeSubtitleTrack = i;
                    break;
                }
            }
            console.log(`📝 Current subtitle track: ${activeSubtitleTrack !== null ? activeSubtitleTrack : 'none'}`);
            
            // Get the base URL from current source
            const currentSrc = player.src();
            console.log('📺 Current source:', currentSrc);
            
            if (!currentSrc || !currentSrc.includes('master.m3u8')) {
                console.log('❌ Not using master playlist, cannot switch audio tracks');
                return false;
            }
            
            // Get track data
            if (!window.MediaCMS || !window.MediaCMS.trackData || !window.MediaCMS.trackData.audioTracks) {
                console.log('❌ No audio track data available');
                return false;
            }
            
            const audioTracks = window.MediaCMS.trackData.audioTracks;
            if (!audioTracks[trackIndex]) {
                console.log(`❌ Audio track ${trackIndex} not found`);
                return false;
            }
            
            const selectedTrack = audioTracks[trackIndex];
            console.log(`🎵 Switching to: ${selectedTrack.label}`);
            
            // Instead of switching to individual audio playlists, 
            // we'll use HLS.js audio track manipulation if available
            const tech = player.tech();
            let hls = null;
            
            // Try different ways to access HLS instance
            if (tech.vhs && tech.vhs.hls) {
                hls = tech.vhs.hls;
            } else if (tech.hls) {
                hls = tech.hls;
            } else if (tech.vhs && tech.vhs.masterPlaylistController_ && tech.vhs.masterPlaylistController_.hls_) {
                hls = tech.vhs.masterPlaylistController_.hls_;
            }
            
            if (hls && hls.audioTracks && hls.audioTracks.length > 0) {
                console.log(`🎯 Found ${hls.audioTracks.length} HLS audio tracks, using HLS.js control`);
                
                // Disable all audio tracks first
                for (let i = 0; i < hls.audioTracks.length; i++) {
                    hls.audioTracks[i].enabled = false;
                }
                
                // Enable the target track
                if (trackIndex < hls.audioTracks.length) {
                    hls.audioTracks[trackIndex].enabled = true;
                    
                    // Trigger the audio track switched event
                    hls.trigger('hlsAudioTrackSwitched', {
                        id: trackIndex,
                        name: track.label,
                        lang: track.srclang || '',
                        enabled: true
                    });
                    
                    // Force HLS to reload
                    hls.startLoad();
                    
                    selectedAudioTrackIndex = trackIndex;
                    console.log(`✅ Successfully switched HLS audio track to: ${track.label}`);
                    
                    // Restore subtitle track if it was active
                    setTimeout(() => {
                        restoreSubtitleTrack(player, activeSubtitleTrack);
                    }, 500);
                    
                    return true;
                }
            }
            
            // Fallback: Create a modified master playlist URL with the selected audio track
            console.log('⚠️ HLS audio tracks not available, using source switching fallback');
            const baseUrl = currentSrc.replace('/master.m3u8', '');
            const audioTrackUrl = baseUrl + '/' + selectedTrack.src.split('/').pop();
            
            console.log(`🔄 Switching to audio track URL: ${audioTrackUrl}`);
            
            // Switch to the audio track playlist directly
            player.src(audioTrackUrl);
            
            // Restore state after a delay
            setTimeout(() => {
                if (currentTime > 0) {
                    player.currentTime(currentTime);
                }
                if (wasPlaying) {
                    player.play().catch(e => console.log('Auto-play prevented:', e));
                }
                
                selectedAudioTrackIndex = trackIndex;
                console.log(`✅ Successfully switched to audio track: ${track.label}`);
                
                // Restore subtitle track if it was active
                setTimeout(() => {
                    restoreSubtitleTrack(player, activeSubtitleTrack);
                }, 1000);
            }, 1000);
            
            return true;
            
        } catch (error) {
            console.log('❌ Error in direct audio track switching:', error);
            return false;
        }
    }
    
    function switchToAudioTrack(trackIndex, track) {
        console.log(`🎵 SWITCHING AUDIO TRACK: ${trackIndex} ${track.label}`);
        
        // Try direct HLS switching first
        if (switchToAudioTrackDirect(trackIndex, track)) {
            showAudioTrackChangeMessage(window.videojs.getPlayer('vjs_video_3'), track.label);
                                return;
                            }
                            
        console.log('⚠️ Direct switching failed, trying fallback methods...');
        
        // Get player
        let player = null;
        try {
            player = window.videojs.getPlayer('vjs_video_3');
        } catch (e) {
            const players = window.videojs.getPlayers();
            const playerIds = Object.keys(players);
            if (playerIds.length > 0) {
                player = players[playerIds[0]];
            }
        }
        
        if (!player) {
            console.error('❌ No player found');
                                return;
                            }
                            
        try {
            console.log('🎵 Attempting HLS audio track switching...');
            
            // Store current playback state
            const currentTime = player.currentTime();
            const wasPlaying = !player.paused();
            console.log(`⏱️ Current state - time: ${currentTime}, playing: ${wasPlaying}`);
            
            // Method 1: Direct HLS.js audio track manipulation
            console.log('🎯 Method 1: Direct HLS.js audio track manipulation...');
            
            const tech = player.tech();
            let hls = null;
            
            // Try different ways to access HLS instance
            if (tech.vhs && tech.vhs.hls) {
                hls = tech.vhs.hls;
                console.log('✅ Found HLS via tech.vhs.hls');
            } else if (tech.hls) {
                hls = tech.hls;
                console.log('✅ Found HLS via tech.hls');
            } else if (tech.vhs && tech.vhs.masterPlaylistController_ && tech.vhs.masterPlaylistController_.hls_) {
                hls = tech.vhs.masterPlaylistController_.hls_;
                console.log('✅ Found HLS via masterPlaylistController');
            }
            
            if (hls && hls.audioTracks && hls.audioTracks.length > 0) {
                console.log(`🎯 Found ${hls.audioTracks.length} HLS audio tracks`);
                
                // Disable all audio tracks first
                for (let i = 0; i < hls.audioTracks.length; i++) {
                    hls.audioTracks[i].enabled = false;
                }
                
                // Enable the target track
                if (trackIndex < hls.audioTracks.length) {
                    hls.audioTracks[trackIndex].enabled = true;
                    console.log(`✅ Enabled HLS audio track ${trackIndex}: ${track.label}`);
                    
                    // Trigger HLS audio track switched event
                    if (hls.trigger) {
                        hls.trigger('hlsAudioTrackSwitched', {
                            id: trackIndex,
                            name: track.label,
                            groupId: 'audio'
                        });
                    }
                    
                    // Force HLS to reload segments
                    if (hls.startLoad) {
                        hls.startLoad();
                    }
                    
                    // Force a seek to trigger audio reload
                    console.log('🎯 Forcing seek to trigger audio track change...');
                    const seekTime = currentTime + 0.1;
                    player.currentTime(seekTime);
                    
                    setTimeout(() => {
                        player.currentTime(currentTime);
                        console.log(`⏱️ Restored to original time: ${currentTime}`);
                        
                        // Resume playback if it was playing
                        if (wasPlaying) {
                            setTimeout(() => {
                                player.play().catch(e => console.log('Auto-play prevented:', e));
                            }, 200);
                        }
                    }, 300);
                    
                    // Show success message
                        showAudioTrackChangeMessage(player, track.label);
                        return;
                } else {
                    console.log(`❌ HLS audio track index ${trackIndex} not available (only ${hls.audioTracks.length} tracks)`);
                }
            } else {
                console.log('⚠️ No HLS audio tracks available, trying Video.js fallback...');
                
                // Try to wait for HLS audio tracks
                waitForHLSAudioTracks(player, (hls) => {
                    if (hls && hls.audioTracks && hls.audioTracks.length > trackIndex) {
                        console.log(`🎯 HLS audio tracks now available: ${hls.audioTracks.length}`);
                        
                        // Disable all audio tracks first
                        for (let i = 0; i < hls.audioTracks.length; i++) {
                            hls.audioTracks[i].enabled = false;
                        }
                        
                        // Enable the target track
                        hls.audioTracks[trackIndex].enabled = true;
                        console.log(`✅ Enabled HLS audio track ${trackIndex}: ${track.label}`);
                        
                        // Trigger HLS audio track switched event
                        if (hls.trigger) {
                            hls.trigger('hlsAudioTrackSwitched', {
                                id: trackIndex,
                                name: track.label,
                                groupId: 'audio'
                            });
                        }
                        
                        // Force HLS to reload segments
                        if (hls.startLoad) {
                            hls.startLoad();
                        }
                        
                        // Force a seek to trigger audio reload
                        console.log('🎯 Forcing seek to trigger audio track change...');
                        const seekTime = currentTime + 0.1;
                        player.currentTime(seekTime);
                        
                        setTimeout(() => {
                            player.currentTime(currentTime);
                            console.log(`⏱️ Restored to original time: ${currentTime}`);
                            
                            // Resume playback if it was playing
                            if (wasPlaying) {
                                setTimeout(() => {
                                    player.play().catch(e => console.log('Auto-play prevented:', e));
                                }, 200);
                            }
                        }, 300);
                        
                        // Show success message
                        showAudioTrackChangeMessage(player, track.label);
                        return;
                    } else {
                        console.log('⚠️ Still no HLS audio tracks available, trying Video.js fallback...');
                    }
                });
            }
            
            // Method 2: Video.js Audio Track API fallback
            console.log('🎯 Method 2: Video.js Audio Track API fallback...');
            
            const audioTracks = player.audioTracks();
            console.log(`📊 Found ${audioTracks.length} Video.js audio tracks`);
            
            if (audioTracks.length > trackIndex) {
                // Disable all tracks first
                for (let i = 0; i < audioTracks.length; i++) {
                    audioTracks[i].enabled = false;
                }
                
                // Enable the target track
                audioTracks[trackIndex].enabled = true;
                console.log(`✅ Enabled Video.js audio track ${trackIndex}: ${track.label}`);
                
                // Update the selected track index for enforcement
                selectedAudioTrackIndex = trackIndex;
                
                // Trigger change event
                audioTracks.trigger('change');
                
                // Force a seek to trigger audio reload
                console.log('🎯 Forcing seek to trigger audio track change...');
                const seekTime = currentTime + 0.1;
                player.currentTime(seekTime);
                
                setTimeout(() => {
                        player.currentTime(currentTime);
                    console.log(`⏱️ Restored to original time: ${currentTime}`);
                    
                    // Resume playback if it was playing
                        if (wasPlaying) {
                        setTimeout(() => {
                            player.play().catch(e => console.log('Auto-play prevented:', e));
                        }, 200);
                        }
                }, 300);
                        
                // Show success message
                        showAudioTrackChangeMessage(player, track.label);
                        
            } else {
                console.log(`❌ Audio track index ${trackIndex} not available (only ${audioTracks.length} tracks)`);
                console.log('🔍 Available tracks:');
                for (let i = 0; i < audioTracks.length; i++) {
                    const track = audioTracks[i];
                    console.log(`  ${i}: ${track.label} (enabled: ${track.enabled})`);
                }
                showAudioTrackChangeMessage(player, track.label);
            }
            
        } catch (error) {
            console.error('❌ Error switching audio track:', error);
            showAudioTrackChangeMessage(player, track.label);
        }
    }
    
    // Helper function to restore subtitles after audio track switching
    function restoreSubtitleTrack(player, activeSubtitleTrack) {
        if (activeSubtitleTrack !== null) {
            console.log(`📝 Restoring subtitle track: ${activeSubtitleTrack}`);
            const textTracks = player.textTracks();
            if (textTracks[activeSubtitleTrack]) {
                textTracks[activeSubtitleTrack].mode = 'showing';
            }
        }
    }
    
    function switchToSubtitleTrack(trackIndex, track) {
        console.log('Switching to subtitle track:', trackIndex, track);
        
        // Get the player - try multiple methods
        let player = null;
        
        // Method 1: Try the known player ID
        try {
            player = window.videojs.getPlayer('vjs_video_3');
        } catch (e) {
            console.log('Player vjs_video_3 not found, trying other methods');
        }
        
        // Method 2: Try to find any Video.js player
        if (!player && window.videojs && window.videojs.getPlayers) {
            const players = window.videojs.getPlayers();
            const playerIds = Object.keys(players);
            if (playerIds.length > 0) {
                player = players[playerIds[0]];
                console.log('Found player with ID:', playerIds[0]);
            }
        }
        
        // Method 3: Try to find player by video element
        if (!player) {
            const videoElement = document.querySelector('video');
            if (videoElement && videoElement.id && window.videojs) {
                try {
                    player = window.videojs.getPlayer(videoElement.id);
                    console.log('Found player by video element ID:', videoElement.id);
                } catch (e) {
                    console.log('Could not get player by video element ID');
                }
            }
        }
        
        if (!player) {
            console.error('No Video.js player found for subtitle switching');
            return;
        }
        
        try {
            // Video.js text tracks API
            const textTracks = player.textTracks();
            console.log('Available text tracks:', textTracks.length);
            
            if (textTracks) {
                // List all available tracks
                for (let i = 0; i < textTracks.length; i++) {
                    const track = textTracks[i];
                    console.log(`Text track ${i}:`, track.kind, track.label, track.language, track.mode);
                }
                
                // Disable all subtitle tracks
                for (let i = 0; i < textTracks.length; i++) {
                    const track = textTracks[i];
                    if (track.kind === 'subtitles' || track.kind === 'captions') {
                        track.mode = 'disabled';
                    }
                }
                
                // Enable selected track (if not "Off")
                if (trackIndex >= 0) {
                    // Find the correct subtitle track (skip non-subtitle tracks)
                    let subtitleTrackIndex = 0;
                    for (let i = 0; i < textTracks.length; i++) {
                        const track = textTracks[i];
                        if (track.kind === 'subtitles' || track.kind === 'captions') {
                            if (subtitleTrackIndex === trackIndex) {
                                track.mode = 'showing';
                                console.log('✅ Subtitle track enabled:', track.label, track.language);
                                
                                // Debug subtitle track details
                                console.log(`📝 Subtitle track details:`, {
                                    label: track.label,
                                    language: track.language,
                                    kind: track.kind,
                                    mode: track.mode,
                                    src: track.src,
                                    readyState: track.readyState,
                                    cues: track.cues?.length || 0
                                });
                                
                                // Check if track has cues after a delay
                                setTimeout(() => {
                                    console.log(`📝 Track ${trackIndex} cues after delay:`, track.cues?.length || 0);
                                    if (track.cues && track.cues.length > 0) {
                                        console.log(`📝 First cue:`, track.cues[0].text);
                                    } else {
                                        console.log('⚠️ No cues found in subtitle track');
                                    }
                                }, 1000);
                                
                                break;
                            }
                            subtitleTrackIndex++;
                        }
                    }
                } else {
                    console.log('✅ Subtitles turned off');
                }
                
                console.log('Subtitle switching completed for track:', track ? track.label : 'Off');
            }
            
        } catch (error) {
            console.error('Error switching subtitle track:', error);
        }
    }
    
    // Configure Video.js tracks from HLS metadata
    function configureVideoJsTracks(player, audioTracks, subtitleTracks) {
        console.log('Configuring Video.js tracks...');
        
        // Add audio tracks to Video.js
        if (audioTracks && audioTracks.length > 0) {
            const videoJsAudioTracks = player.audioTracks();
            console.log('Current Video.js audio tracks:', videoJsAudioTracks.length);
            
            // Clear existing tracks
            while (videoJsAudioTracks.length > 0) {
                videoJsAudioTracks.removeTrack(videoJsAudioTracks[0]);
            }
            
            // Add each audio track
            audioTracks.forEach((track, index) => {
                const audioTrack = new window.videojs.AudioTrack({
                    id: track.label || `audio-${index}`,
                    kind: index === 0 ? 'main' : 'alternative',
                    label: track.label,
                    language: track.srclang || '',
                    enabled: index === 0
                });
                
                videoJsAudioTracks.addTrack(audioTrack);
                console.log(`Added audio track: ${track.label} (${track.srclang})`);
            });
            
            console.log('Final Video.js audio tracks:', videoJsAudioTracks.length);
            
            // Force Video.js to recognize the audio tracks by triggering a track change event
            setTimeout(() => {
                if (videoJsAudioTracks.length > 0) {
                    console.log('Triggering audio track change event to activate tracks');
                    videoJsAudioTracks.trigger('change');
                }
            }, 500);
        }
        
        // Add subtitle tracks to Video.js
        if (subtitleTracks && subtitleTracks.length > 0) {
            const videoJsTextTracks = player.textTracks();
            console.log('Current Video.js text tracks:', videoJsTextTracks.length);
            
            // Clear existing subtitle tracks first to avoid duplicates
            const tracksToRemove = [];
                for (let i = 0; i < videoJsTextTracks.length; i++) {
                const track = videoJsTextTracks[i];
                if (track.kind === 'subtitles' && track.label && track.label !== 'segment-metadata') {
                    tracksToRemove.push(track);
                }
            }
            
            // Remove existing subtitle tracks
            tracksToRemove.forEach(track => {
                player.removeRemoteTextTrack(track);
            });
            
            console.log(`Cleared ${tracksToRemove.length} existing subtitle tracks`);
            
            // Add each subtitle track with proper indexing
            subtitleTracks.forEach((track, index) => {
                    const textTrack = player.addRemoteTextTrack({
                        kind: 'subtitles',
                        src: track.src,
                        srclang: track.srclang || '',
                        label: track.label,
                        mode: 'disabled'
                    }, false);
                    
                console.log(`Added subtitle track ${index}: ${track.label} (${track.srclang}) - ${track.src}`);
                
                // Add event listeners to track subtitle loading
                textTrack.addEventListener('loadstart', () => {
                    console.log(`📝 Subtitle track loading started: ${track.label}`);
                });
                
                textTrack.addEventListener('loadeddata', () => {
                    console.log(`📝 Subtitle track loaded: ${track.label}, cues: ${textTrack.cues?.length || 0}`);
                });
                
                textTrack.addEventListener('error', (e) => {
                    console.log(`❌ Subtitle track error: ${track.label}`, e);
                });
            });
            
            console.log('Final Video.js text tracks:', player.textTracks().length);
        }
        
        // Wait a bit for tracks to be processed
        setTimeout(() => {
            console.log('Track configuration complete');
            console.log('Audio tracks available:', player.audioTracks().length);
            console.log('Text tracks available:', player.textTracks().length);
        }, 1000);
    }
    
    // Create a custom HLS master playlist with selected audio track as default
    function createCustomMasterPlaylist(selectedTrack, trackIndex, baseUrl) {
        console.log('Creating custom master playlist for track:', selectedTrack.label, 'index:', trackIndex);
        console.log('Base URL for absolute paths:', baseUrl);
        
        // Get all available tracks
        const audioTracks = window.MediaCMS.trackData.audioTracks;
        const subtitleTracks = window.MediaCMS.trackData.subtitleTracks;
        
        let manifest = '';
        
        // Add audio tracks with the selected one as default
        audioTracks.forEach((track, index) => {
            const isDefault = index === trackIndex;
            const isAutoSelect = index === trackIndex;
            
            manifest += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${track.label}"`;
            
            if (track.srclang) {
                manifest += `,LANGUAGE="${track.srclang}"`;
            }
            
            if (isDefault) {
                manifest += ',DEFAULT=YES';
            }
            
            if (isAutoSelect) {
                manifest += ',AUTOSELECT=YES';
            } else {
                manifest += ',AUTOSELECT=NO';
            }
            
            // Use absolute URL for audio files
            const audioFileName = track.src.split('/').pop();
            manifest += `,URI="${baseUrl}/${audioFileName}"\n`;
        });
        
        // Add subtitle tracks
        if (subtitleTracks && subtitleTracks.length > 0) {
            subtitleTracks.forEach((track, index) => {
                manifest += `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitles",NAME="${track.label}"`;
                
                if (track.srclang) {
                    manifest += `,LANGUAGE="${track.srclang}"`;
                }
                
                // Use absolute URL for subtitle files
                const subtitleFileName = track.src.split('/').pop();
                manifest += `,AUTOSELECT=NO,URI="${baseUrl}/${subtitleFileName}"\n`;
            });
        }
        
        // Add standard HLS headers
        manifest += `#EXTM3U\n`;
        manifest += `# Created with Bento4 mp4-hls.py version 1.2.0r637\n\n`;
        manifest += `#EXT-X-VERSION:4\n\n`;
        manifest += `# Media Playlists\n`;
        
        // Add video stream entries with absolute URLs
        manifest += `#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1617234,BANDWIDTH=1908359,CODECS="avc1.4D402A,mp4a.40.2",RESOLUTION=852x480,AUDIO="audio",SUBTITLES="subtitles"\n`;
        manifest += `${baseUrl}/media-1/stream.m3u8\n`;
        manifest += `#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3156724,BANDWIDTH=4093930,CODECS="avc1.4D402A,mp4a.40.2",RESOLUTION=1280x720,AUDIO="audio",SUBTITLES="subtitles"\n`;
        manifest += `${baseUrl}/media-2/stream.m3u8\n\n`;
        
        // Add I-Frame playlists with absolute URLs
        manifest += `# I-Frame Playlists\n`;
        manifest += `#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=131418,BANDWIDTH=221618,CODECS="avc1.4D402A",RESOLUTION=852x480,URI="${baseUrl}/media-1/iframes.m3u8"\n`;
        manifest += `#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=250643,BANDWIDTH=533386,CODECS="avc1.4D402A",RESOLUTION=1280x720,URI="${baseUrl}/media-2/iframes.m3u8"\n`;
        
        console.log('Generated custom manifest with absolute URLs:', manifest);
        return manifest;
    }
    
    // Show visual feedback for audio track changes
    function showAudioTrackChangeMessage(player, trackLabel) {
        console.log('Showing audio track change message:', trackLabel);
        
        // Create a temporary overlay message
        const message = document.createElement('div');
        message.textContent = `Audio: ${trackLabel}`;
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            z-index: 999999;
            pointer-events: none;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(message);
        
        // Fade out and remove after 2 seconds
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 300);
        }, 2000);
    }
    
    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-audio-tracks-button')) {
            const audioMenu = document.querySelector('.custom-audio-menu');
            if (audioMenu) audioMenu.style.display = 'none';
        }
        
        if (!e.target.closest('.custom-subtitles-button')) {
            const subtitleMenu = document.querySelector('.custom-subtitle-menu');
            if (subtitleMenu) subtitleMenu.style.display = 'none';
        }
    });
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enableTrackButtons);
    } else {
        enableTrackButtons();
    }
    
})();
