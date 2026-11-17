const clientId = "afec5ed606f54c1a9a0d6b82360168ac";
const redirectUri = "http://127.0.0.1:5500/music.html"; // Make sure this matches your Spotify app settings
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

let spotifyPlayer;
let deviceId;
let currentAccessToken;

console.log("=== Spotify Auth Debug ===");
console.log("Current URL:", window.location.href);
console.log("Authorization code:", code);

// Define the SDK ready callback BEFORE loading the SDK
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log("Spotify SDK Ready");
    if (currentAccessToken) {
        initializeSpotifyPlayer(currentAccessToken);
    }
};

if (!code) {
    console.log("No authorization code found, redirecting to auth flow");
    // Only clear verifier when starting fresh auth flow
    localStorage.removeItem("verifier");
    redirectToAuthCodeFlow(clientId);
} else {
    console.log("Authorization code found, attempting to get access token");
    (async () => {
        try {
            const accessToken = await getAccessToken(clientId, code);
            currentAccessToken = accessToken;
            console.log("Access token obtained successfully");
            
            const profile = await fetchProfile(accessToken);
            populateUI(profile);
            
            // Initialize player if SDK is already loaded
            if (window.Spotify) {
                initializeSpotifyPlayer(accessToken);
            }
            // Otherwise, wait for onSpotifyWebPlaybackSDKReady callback
            // Fetch and display playlists once authenticated
            await fetchAndDisplayPlaylists(accessToken);
            fetchAndDisplayFirstPlaylistTracks(accessToken);

        } catch (error) {
            console.error("Auth flow failed:", error);
            // If auth fails, clear storage and restart
            localStorage.removeItem("verifier");
            alert("Authentication failed. Redirecting to login...");
            redirectToAuthCodeFlow(clientId);
        }
    })();
}

async function redirectToAuthCodeFlow(clientId) {
    console.log("Starting auth flow...");
    
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    console.log("Generated verifier:", verifier);
    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", redirectUri);
    // Updated scopes for Web Playback SDK
    params.append("scope", "user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    console.log("Redirecting to:", authUrl);
    
    document.location = authUrl;
}

function generateCodeVerifier(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function getAccessToken(clientId, code) {
    const verifier = localStorage.getItem("verifier");
    
    console.log("=== Token Exchange ===");
    console.log("Retrieved verifier:", verifier);
    
    if (!verifier) {
        console.error("No verifier found in localStorage!");
        throw new Error("No verifier found - please restart the auth flow");
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);
    params.append("code_verifier", verifier);

    console.log("Token request params:", Object.fromEntries(params));

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    console.log("Token response status:", result.status);

    if (!result.ok) {
        const errorData = await result.json();
        console.error("Token request failed:", errorData);
        throw new Error(`Token request failed: ${result.status} - ${errorData.error_description}`);
    }

    const tokenData = await result.json();
    console.log("Token obtained successfully");
    
    // Clear the verifier after successful token exchange
    localStorage.removeItem("verifier");
    
    return tokenData.access_token;
}

async function fetchProfile(token) {
    console.log("Fetching profile...");
    
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET", 
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!result.ok) {
        const errorData = await result.json();
        console.error("Profile request failed:", errorData);
        throw new Error(`Profile request failed: ${result.status}`);
    }

    const profile = await result.json();
    console.log("Profile loaded:", profile.display_name);
    return profile;
}

function populateUI(profile) {
    console.log("Populating UI...");
    
    const displayName = document.getElementById("displayName");
    if (displayName) displayName.innerText = `Welcome, ${profile.display_name}!`;
    
    if (profile.images && profile.images[0]) {
        const avatar = document.getElementById("avatar");
        if (avatar) {
            avatar.innerHTML = ''; // Clear existing content
            const profileImage = new Image(100, 100);
            profileImage.src = profile.images[0].url;
            profileImage.style.borderRadius = '50%';
            avatar.appendChild(profileImage);
        }
    }
    
    const id = document.getElementById("id");
    if (id) id.innerText = `ID: ${profile.id}`;
    
    const email = document.getElementById("email");
    if (email) email.innerText = `Email: ${profile.email || 'Not available'}`;
    
    const uri = document.getElementById("uri");
    if (uri) {
        uri.innerText = `Profile: ${profile.uri}`;
        if (profile.external_urls && profile.external_urls.spotify) {
            uri.style.cursor = 'pointer';
            uri.onclick = () => window.open(profile.external_urls.spotify, '_blank');
        }
    }
}

////////////////////////////////////////////////////
// --- New Functions for Playlists and Tracks --- //
////////////////////////////////////////////////////

// FIXED: Playlists and Tracks Functions
async function fetchAndDisplayPlaylists(token) {
    try {
        const response = await fetch('https://api.spotify.com/v1/me/playlists', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to fetch playlists:', errorData);
            throw new Error(`Failed to fetch playlists: ${response.status}`);
        }

        const data = await response.json();
        const playlists = data.items;
        currentPlaylists = playlists; // Store globally

        const playlistsList = document.getElementById('playlists-list');
        if (!playlistsList) {
            console.error('playlists-list element not found');
            return;
        }

        playlistsList.innerHTML = '';

        if (playlists.length === 0) {
            playlistsList.innerHTML = '<li>No playlists found.</li>';
            return;
        }

        playlists.forEach(playlist => {
            const listItem = document.createElement('li');
            listItem.classList.add('playlist-item');
            listItem.dataset.playlistId = playlist.id;
            listItem.dataset.playlistUri = playlist.uri;

            // Create playlist item content
            const playlistDiv = document.createElement('div');
            playlistDiv.style.display = 'flex';
            playlistDiv.style.alignItems = 'center';
            playlistDiv.style.padding = '8px';
            playlistDiv.style.cursor = 'pointer';

            const img = document.createElement('img');
            img.src = playlist.images.length > 0 ? playlist.images[0].url : 'images/default_playlist_art.png';
            img.alt = `Cover for ${playlist.name}`;
            img.style.width = '40px';
            img.style.height = '40px';
            img.style.marginRight = '10px';
            img.style.borderRadius = '3px';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = playlist.name;
            nameSpan.style.fontSize = '11px';

            playlistDiv.appendChild(img);
            playlistDiv.appendChild(nameSpan);
            listItem.appendChild(playlistDiv);

            playlistsList.appendChild(listItem);

            // Add click event listener
            listItem.addEventListener('click', () => {
                updateCurrentPlaylistName(playlist.name);
                fetchAndDisplayPlaylistTracks(token, playlist.id, playlist.name);
                // Hide dropdown after selection
                const dropdown = document.getElementById('playlists-list');
                if (dropdown) dropdown.style.display = 'none';
            });
        });

        console.log('Playlists loaded successfully');

    } catch (error) {
        console.error('Error fetching playlists:', error);
        const playlistsList = document.getElementById('playlists-list');
        if (playlistsList) {
            playlistsList.innerHTML = `<li>Error loading playlists: ${error.message}</li>`;
        }
    }
}

// FIXED: Auto-load first playlist tracks
async function fetchAndDisplayFirstPlaylistTracks(token) {
    if (currentPlaylists.length > 0) {
        const firstPlaylist = currentPlaylists[0];
        updateCurrentPlaylistName(firstPlaylist.name);
        await fetchAndDisplayPlaylistTracks(token, firstPlaylist.id, firstPlaylist.name, true);
    }
}

// FIXED: Display playlist tracks in the main playlist area
async function fetchAndDisplayPlaylistTracks(token, playlistId, playlistName, renderToMainList = false) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`Failed to fetch tracks for playlist ${playlistId}:`, errorData);
            throw new Error(`Failed to fetch tracks: ${response.status}`);
        }

        const data = await response.json();
        const tracks = data.items;

        // Target the correct playlist container
        const targetList = document.querySelector('.playlist-list');
        if (!targetList) {
            console.error('playlist-list element not found');
            return;
        }

        targetList.innerHTML = '';

        if (tracks.length === 0) {
            targetList.innerHTML = '<li>No songs in this playlist.</li>';
            return;
        }

        tracks.forEach(item => {
            if (!item.track) return;
            const track = item.track;
            
            const listItem = document.createElement('li');
            listItem.classList.add('playlist-item');
            listItem.dataset.trackUri = track.uri;
            listItem.style.cursor = 'pointer';

            // Create track display
            const trackDiv = document.createElement('div');
            trackDiv.style.padding = '5px';
            
            const titleDiv = document.createElement('div');
            titleDiv.classList.add('song-title');
            titleDiv.textContent = track.name;
            
            const artistDiv = document.createElement('div');
            artistDiv.classList.add('song-artist');
            artistDiv.textContent = track.artists.map(artist => artist.name).join(', ');
            
            const durationDiv = document.createElement('div');
            durationDiv.classList.add('song-duration');
            durationDiv.textContent = formatDuration(track.duration_ms);

            trackDiv.appendChild(titleDiv);
            trackDiv.appendChild(artistDiv);
            trackDiv.appendChild(durationDiv);
            listItem.appendChild(trackDiv);

            // Add click event to play track
            listItem.addEventListener('click', async () => {
                if (currentAccessToken && deviceId) {
                    await playTrack(currentAccessToken, deviceId, track.uri);
                }
            });

            targetList.appendChild(listItem);
        });

        // Calculate total playlist time
        const totalMs = tracks.reduce((sum, item) => sum + (item.track?.duration_ms || 0), 0);
        const playlistStats = document.querySelector('.playlist-stats');
        if (playlistStats) {
            playlistStats.textContent = `Total time: ${formatDuration(totalMs)}`;
        }

        console.log(`Loaded ${tracks.length} tracks for ${playlistName}`);

    } catch (error) {
        console.error('Error fetching playlist tracks:', error);
        const targetList = document.querySelector('.playlist-list');
        if (targetList) {
            targetList.innerHTML = `<li>Error loading songs: ${error.message}</li>`;
        }
    }
}

// Helper function to format duration
function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// FIXED: Update current playlist name
function updateCurrentPlaylistName(name) {
    const currentPlaylistName = document.getElementById('current-playlist-name');
    if (currentPlaylistName) {
        currentPlaylistName.textContent = name;
    }
}

// Play track function
async function playTrack(token, deviceId, trackUri) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                uris: [trackUri]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to play track:', errorData);
            if (response.status === 404) {
                 console.error("Device not found. Make sure your Spotify app is open and playing.");
                 alert("Device not found. Please open your Spotify app and ensure playback is active, then refresh the page.");
            } else if (response.status === 403) {
                 console.error("Forbidden. Check your OAuth scopes.");
                 alert("Access denied. Please check your Spotify app permissions and refresh the page.");
            }
            throw new Error(`Failed to play track: ${response.status}`);
        }
        console.log(`Playing track: ${trackUri}`);
    } catch (error) {
        console.error('Error in playTrack:', error);
    }
}

// FIXED: Dropdown functionality
document.addEventListener('DOMContentLoaded', function() {
    const playlistDropdownBtn = document.getElementById('playlistDropdownBtn');
    const playlistsList = document.getElementById('playlists-list');

    if (playlistDropdownBtn && playlistsList) {
        playlistDropdownBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isVisible = playlistsList.style.display === 'block';
            playlistsList.style.display = isVisible ? 'none' : 'block';
            playlistDropdownBtn.classList.toggle('active', !isVisible);
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!playlistDropdownBtn.contains(e.target) && !playlistsList.contains(e.target)) {
                playlistsList.style.display = 'none';
                playlistDropdownBtn.classList.remove('active');
            }
        });
    }
});

// New function to play a track by URI using the Web API (more reliable than SDK's togglePlay for specific tracks)
async function playTrack(token, deviceId, trackUri) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                uris: [trackUri] // Play a single track by its URI
                // You could also add 'context_uri' (e.g., playlist URI) and 'offset' to play from context
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to play track:', errorData);
            // Handle specific errors like device not found (404), invalid scope (403)
            if (response.status === 404) {
                 console.error("Device not found. Make sure your Spotify app is open and playing.");
                 alert("Device not found. Please open your Spotify app and ensure playback is active, then refresh the page.");
            } else if (response.status === 403) {
                 console.error("Forbidden. Check your OAuth scopes.");
                 alert("Access denied. Please check your Spotify app permissions and refresh the page.");
            }
            throw new Error(`Failed to play track: ${response.status}`);
        }
        console.log(`Playing track: ${trackUri}`);
    } catch (error) {
        console.error('Error in playTrack:', error);
    }
};

// --- Spotify Web Playback SDK Integration ---
let progressInterval; // Declare at the top

async function initializeSpotifyPlayer(accessToken) {
    console.log("Initializing Spotify Player...");
    
    if (!window.Spotify) {
        console.error("Spotify SDK not loaded");
        return;
    }

    spotifyPlayer = new Spotify.Player({
        name: 'Charlie\'s Custom Web Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });

    // Error handling
    spotifyPlayer.addListener('initialization_error', ({ message }) => { 
        console.error('Initialization Error:', message); 
    });
    
    spotifyPlayer.addListener('authentication_error', ({ message }) => { 
        console.error('Authentication Error:', message);
        // Token might be expired, restart auth flow
        localStorage.removeItem("verifier");
        redirectToAuthCodeFlow(clientId);
    });
    
    spotifyPlayer.addListener('account_error', ({ message }) => { 
        console.error('Account Error:', message); 
    });
    
    spotifyPlayer.addListener('playback_error', ({ message }) => { 
        console.error('Playback Error:', message); 
    });

    // Ready
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Player Ready with Device ID:', device_id);
        deviceId = device_id;
        const deviceElement = document.getElementById('device-id');
        if (deviceElement) {
            deviceElement.innerText = device_id;
        }
        
        // Show success message
        const playerDiv = document.getElementById('spotify-player');
        if (playerDiv) {
            playerDiv.style.display = 'block';
            playerDiv.style.backgroundColor = '#1db954';
            playerDiv.style.color = 'white';
            playerDiv.style.padding = '20px';
            playerDiv.style.borderRadius = '10px';
        }
    });

    // Not Ready
    spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline:', device_id);
    });

    // Playback State Changed
    spotifyPlayer.addListener('player_state_changed', state => {
        console.log('Player state changed:', state);
        
        if (!state || !state.track_window.current_track) {
            return;
        }

        const { current_track } = state.track_window;
        
        const albumArt = document.getElementById('album-art');
        const trackTitle = document.getElementById('track-title');
        const trackArtist = document.getElementById('track-artist');
        const playButton = document.getElementById('play-button');
        const pauseButton = document.getElementById('pause-button');
        
        if (albumArt && current_track.album.images[0]) {
            albumArt.src = current_track.album.images[0].url;
            albumArt.style.display = 'block';
        }
        
        if (trackTitle) {
            trackTitle.innerText = current_track.name;
            document.getElementById('controls-track-title').textContent = current_track.name;
        }
        
        if (trackArtist) {
            trackArtist.innerText = current_track.artists.map(artist => artist.name).join(', ');
        }

        if (playButton && pauseButton) {
            if (state.paused) {
                playButton.style.display = 'inline-block';
                pauseButton.style.display = 'none';
            } else {
                playButton.style.display = 'none';
                pauseButton.style.display = 'inline-block';
            }
        }
    });

    // Connect to the player
    const success = await spotifyPlayer.connect();
    if (success) {
        console.log('Successfully connected to Spotify!');
        setupPlayerControls(accessToken);

        // Start progress bar updates
        if (progressInterval) clearInterval(progressInterval);
        progressInterval = setInterval(updateProgressBar, 1000);
    } else {
        console.error('Failed to connect to Spotify');
    }
}

function setupPlayerControls(accessToken) {
    // Play button
    const playButton = document.getElementById('play-button');
    if (playButton) {
        playButton.addEventListener('click', async () => {
            if (spotifyPlayer && deviceId) {
                try {
                    // First, try to resume current playback
                    await spotifyPlayer.resume();
                } catch (e) {
                    // If no current track, start with a default track
                    console.log('No current playback, starting new track...');
                    const trackUri = 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh'; // "Never Gonna Give You Up" - Rick Astley
                    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({ uris: [trackUri] })
                    });
                }
            }
        });
    }

    // Pause button
    const pauseButton = document.getElementById('pause-button');
    if (pauseButton) {
        pauseButton.addEventListener('click', async () => {
            if (spotifyPlayer) {
                await spotifyPlayer.pause();
            }
        });
    }

    // Next button
    const nextButton = document.getElementById('next-button');
    if (nextButton) {
        nextButton.addEventListener('click', async () => {
            if (spotifyPlayer) {
                await spotifyPlayer.nextTrack();
            }
        });
    }

    // Previous button
    const prevButton = document.getElementById('prev-button');
    if (prevButton) {
        prevButton.addEventListener('click', async () => {
            if (spotifyPlayer) {
                await spotifyPlayer.previousTrack();
            }
        });
    }
const customVolumeBar = document.getElementById('custom-volume-bar');
const customVolumeFill = document.getElementById('custom-volume-fill');

function setCustomVolumeBar(volume) {
    if (customVolumeFill) customVolumeFill.style.width = `${volume * 100}%`;
    if (spotifyPlayer) spotifyPlayer.setVolume(volume);
}


// Handle click and drag
let isDragging = false;

function handleVolumeEvent(e) {
    const rect = customVolumeBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let volume = (clientX - rect.left) / rect.width;
    volume = Math.max(0, Math.min(1, volume));
    setCustomVolumeBar(volume);
}
customVolumeBar.addEventListener('mousedown', e => {
    isDragging = true;
    handleVolumeEvent(e);
});
document.addEventListener('mousemove', e => {
    if (isDragging) handleVolumeEvent(e);
});
document.addEventListener('mouseup', () => {
    isDragging = false;
});

// Touch support
customVolumeBar.addEventListener('touchstart', e => {
    isDragging = true;
    handleVolumeEvent(e);
    e.preventDefault();
});
document.addEventListener('touchmove', e => {
    if (isDragging) handleVolumeEvent(e);
});
document.addEventListener('touchend', () => {
    isDragging = false;
});
}
// Replace your progress bar event listener with this corrected version
document.addEventListener('DOMContentLoaded', () => {
    const progressBar = document.getElementById('progress-bar');
    
    if (progressBar) {
        progressBar.addEventListener('click', async (event) => {
            try {
                if (!spotifyPlayer || !deviceId || !currentAccessToken) {
                    console.error('Spotify player, device ID, or access token not available');
                    return;
                }

                const clickX = event.offsetX;
                const width = progressBar.clientWidth;
                const clickRatio = clickX / width;

                const state = await spotifyPlayer.getCurrentState();
                if (!state || !state.duration) {
                    console.error('No current state or duration available');
                    return;
                }

                const seekPosition = Math.round(state.duration * clickRatio);
                
                // Use currentAccessToken instead of accessToken
                const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${seekPosition}&device_id=${deviceId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentAccessToken}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.text(); // Use text() for empty responses
                    console.error('Seek failed:', response.status, errorData);
                }
            } catch (error) {
                console.error('Error during seek:', error);
            }
        });
    } else {
        console.error('Progress bar element not found');
    }
});
/////////////////////////////////////////////////////////
// Add this function to update the progress bar visually
////////////////////////////////////////////////////////

function updateProgressBar() {
    if (!spotifyPlayer) return;

    spotifyPlayer.getCurrentState().then(state => {
        if (!state || !state.track_window.current_track) return;

        const progressBar = document.getElementById('progress-bar');
        const progressFill = progressBar ? progressBar.querySelector('.progress-fill') : null;
        const currentTimeElement = document.getElementById('current-time');
        const durationElement = document.getElementById('duration');

        if (progressBar && progressFill && state.duration > 0) {
            const progress = (state.position / state.duration) * 100;
            progressFill.style.width = `${progress}%`;
        }

        if (currentTimeElement) {
            currentTimeElement.textContent = formatTime(state.position);
        }
        if (durationElement) {
            durationElement.textContent = formatTime(state.duration);
        }
    }).catch(error => {
        console.error('Error updating progress bar:', error);
    });
}

// Helper function to format time in mm:ss
function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Update your player_state_changed listener to include progress updates
// Replace the existing player_state_changed listener with this:
spotifyPlayer.addListener('player_state_changed', state => {
    console.log('Player state changed:', state);
    
    if (!state || !state.track_window.current_track) {
        return;
    }

    const { current_track } = state.track_window;
    
    const albumArt = document.getElementById('album-art');
    const trackTitle = document.getElementById('track-title');
    const trackArtist = document.getElementById('track-artist');
    const playButton = document.getElementById('play-button');
    const pauseButton = document.getElementById('pause-button');
    
    if (albumArt && current_track.album.images[0]) {
        albumArt.src = current_track.album.images[0].url;
        albumArt.style.display = 'block';
    }
    
    if (trackTitle) {
        trackTitle.innerText = current_track.name;
        document.getElementById('controls-track-title').textContent = current_track.name;
    }
    
    if (trackArtist) {
        trackArtist.innerText = current_track.artists.map(artist => artist.name).join(', ');
    }

    if (playButton && pauseButton) {
        if (state.paused) {
            playButton.style.display = 'inline-block';
            pauseButton.style.display = 'none';
        } else {
            playButton.style.display = 'none';
            pauseButton.style.display = 'inline-block';
        }
    }
    
    // Update progress bar
    updateProgressBar();
});


// Start progress updates when player is ready
spotifyPlayer.addListener('ready', ({ device_id }) => {
    console.log('Player Ready with Device ID:', device_id);
    deviceId = device_id;
    const deviceElement = document.getElementById('device-id');
    if (deviceElement) {
        deviceElement.innerText = device_id;
    }
    
    // Show success message
    const playerDiv = document.getElementById('spotify-player');
    if (playerDiv) {
        playerDiv.style.display = 'block';
        playerDiv.style.backgroundColor = '#1db954';
        playerDiv.style.color = 'white';
        playerDiv.style.padding = '20px';
        playerDiv.style.borderRadius = '10px';
    }
    
    // Start progress bar updates
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(updateProgressBar, 1000);

    
    // Transfer playback to this device to ensure it's active
    if (currentAccessToken) {
        transferPlayback(currentAccessToken, device_id);
    }
});

// Clean up interval when player goes offline
spotifyPlayer.addListener('not_ready', ({ device_id }) => {
    console.log('Device ID has gone offline:', device_id);
    if (progressInterval) clearInterval(progressInterval);
});

// Updated transferPlayback function to make device active
async function transferPlayback(token, deviceId) {
    try {
        const response = await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false // Don't auto-play when transferring
            })
        });
        
        if (response.ok) {
            console.log('Playback transferred to web player');
        } else {
            console.error('Failed to transfer playback:', response.status);
        }
    } catch (error) {
        console.error('Failed to transfer playback:', error);
    }
}
/////////////////////////////////////////////////////////////
// Optional: Function to transfer playback to your web player
async function transferPlayback(token, deviceId) {
    try {
        await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false // Don't auto-play when transferring
            })
        });
        console.log('Playback transferred to web player');
    } catch (error) {
        console.error('Failed to transfer playback:', error);
    }
}
/////////////////////////////////////////////////
// --- Playlist Dropdown List of Playlists --- //
/////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', function() {
    const PlaylistMenu = document.getElementById('playlistDropdownBtn');
    const PlaylistDropdown = document.getElementById('playlist-dropdown');
    const PlaylistsList = document.getElementById('playlists-list');
    const CurrentPlaylistName = document.getElementById('current-playlist-name');

    if (PlaylistMenu && PlaylistDropdown) {
        PlaylistMenu.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = PlaylistDropdown.style.display === 'block';
            PlaylistDropdown.style.display = isOpen ? 'none' : 'block';
            PlaylistMenu.classList.toggle('active', !isOpen);
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', function() {
            PlaylistDropdown.style.display = 'none';
            PlaylistMenu.classList.remove('active');
        });

        // Handle option selection
        PlaylistsList.addEventListener('click', function(e) {
            if (e.target.classList.contains('dropdown-item')) {
                // Set the selected playlist name (optional)
                if (CurrentPlaylistName) {
                    CurrentPlaylistName.textContent = e.target.textContent;
                }
                // Hide the dropdown
                PlaylistDropdown.style.display = 'none';
                PlaylistMenu.classList.remove('active');
                // You can add more logic here to actually load the playlist
            }
        });
    }
});