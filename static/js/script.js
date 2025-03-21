document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const assistantCircle = document.getElementById('assistantCircle');
    const micIcon = document.getElementById('micIcon');
    const waveIcon = document.getElementById('waveIcon');
    const loadingIcon = document.getElementById('loadingIcon');
    const statusText = document.getElementById('statusText');
    const transcriptContainer = document.getElementById('transcriptContainer');
    const transcriptText = document.getElementById('transcriptText');
    const responseText = document.getElementById('responseText');
    const repeatButton = document.getElementById('repeatButton');
    const pausePlayButton = document.getElementById('pausePlayButton');
    const skipBackwardButton = document.getElementById('skipBackwardButton');
    const skipForwardButton = document.getElementById('skipForwardButton');
    const pauseIcon = document.getElementById('pauseIcon');
    const playIcon = document.getElementById('playIcon');
    const toastContainer = document.getElementById('toastContainer');
    
    // Configure marked options for safety
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        sanitize: true
    });
    
    // Variables
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let isProcessing = false;
    let stream;
    let lastAudioData = null;
    let audioPlayer = null;
    let isReplaying = false;
    let isPaused = false;
    
    // Toast notification functions
    const toastIcons = {
        error: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>`,
        warning: `<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"></path></svg>`,
        success: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>`,
        info: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path></svg>`
    };
    
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - The type of toast (error, warning, success, info)
     * @param {number} duration - Duration in milliseconds
     */
    function showToast(message, type = 'info', duration = 5000) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Create toast content
        toast.innerHTML = `
            <div class="toast-icon">${toastIcons[type]}</div>
            <div class="toast-message">${message}</div>
            <div class="toast-close">
                <svg viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
                </svg>
            </div>
            <div class="toast-progress">
                <div class="toast-progress-bar"></div>
            </div>
        `;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Create animation for progress bar
        const progressBar = toast.querySelector('.toast-progress-bar');
        progressBar.style.animation = `shrink ${duration}ms linear forwards`;
        progressBar.style.transformOrigin = 'left';
        
        // Trigger animation (important to trigger reflow)
        void toast.offsetWidth;
        toast.classList.add('show');
        
        // Set up animation
        progressBar.animate(
            [
                { transform: 'scaleX(1)' },
                { transform: 'scaleX(0)' }
            ],
            {
                duration: duration,
                fill: 'forwards',
                easing: 'linear'
            }
        );
        
        // Set up click to dismiss
        toast.addEventListener('click', () => {
            removeToast(toast);
        });
        
        // Set up auto dismiss
        const timeoutId = setTimeout(() => {
            removeToast(toast);
        }, duration);
        
        // Store the timeout ID on the toast element
        toast.timeoutId = timeoutId;
        
        // Add close button functionality
        const closeButton = toast.querySelector('.toast-close');
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            removeToast(toast);
        });
        
        return toast;
    }
    
    /**
     * Remove a toast element with animation
     * @param {HTMLElement} toast - The toast element to remove
     */
    function removeToast(toast) {
        // Clear the timeout to prevent double removals
        if (toast.timeoutId) {
            clearTimeout(toast.timeoutId);
        }
        
        // Start exit animation
        toast.classList.remove('show');
        
        // Remove after animation completes
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300); // Match the CSS transition duration
    }
    
    // Event listeners
    assistantCircle.addEventListener('click', handleAssistantClick);
    repeatButton.addEventListener('click', handleRepeatClick);
    pausePlayButton.addEventListener('click', handlePausePlayClick);
    skipBackwardButton.addEventListener('click', handleSkipBackward);
    skipForwardButton.addEventListener('click', handleSkipForward);
    
    // Audio control functions
    function handlePausePlayClick() {
        if (!audioPlayer) return;
        
        if (isPaused) {
            // Resume playback
            audioPlayer.play();
            isPaused = false;
            pauseIcon.classList.remove('hidden');
            playIcon.classList.add('hidden');
            pausePlayButton.classList.remove('paused');
            
            // Update UI
            if (isReplaying) {
                statusText.textContent = 'Replaying...';
            } else {
                statusText.textContent = 'Speaking...';
            }
        } else {
            // Pause playback
            audioPlayer.pause();
            isPaused = true;
            pauseIcon.classList.add('hidden');
            playIcon.classList.remove('hidden');
            pausePlayButton.classList.add('paused');
            
            // Update UI
            statusText.textContent = 'Paused';
        }
    }
    
    function handleSkipForward() {
        if (!audioPlayer) return;
        
        // Skip forward 10 seconds, but don't exceed audio duration
        const newTime = Math.min(audioPlayer.currentTime + 10, audioPlayer.duration);
        audioPlayer.currentTime = newTime;
        
        // If paused, we still want to update the UI
        if (isPaused) {
            statusText.textContent = `Paused (${formatTime(newTime)}/${formatTime(audioPlayer.duration)})`;
        }
    }
    
    function handleSkipBackward() {
        if (!audioPlayer) return;
        
        // Skip backward 10 seconds, but don't go below 0
        const newTime = Math.max(audioPlayer.currentTime - 10, 0);
        audioPlayer.currentTime = newTime;
        
        // If paused, we still want to update the UI
        if (isPaused) {
            statusText.textContent = `Paused (${formatTime(newTime)}/${formatTime(audioPlayer.duration)})`;
        }
    }
    
    // Helper function to format time in MM:SS format
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }
    
    // Functions
    function handleAssistantClick() {
        if (isProcessing) return;
        
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    }
    
    function handleRepeatClick() {
        if (isReplaying || !lastAudioData) return;
        
        playAudioResponse(lastAudioData, true);
    }
    
    async function startRecording() {
        try {
            // Show loading state while requesting microphone permission
            showLoadingState("Requesting microphone...");
            
            // Request microphone permission
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Update UI for recording
            isRecording = true;
            isProcessing = false;
            assistantCircle.classList.remove('processing');
            assistantCircle.classList.add('listening');
            micIcon.classList.add('hidden');
            loadingIcon.classList.add('hidden');
            waveIcon.classList.remove('hidden');
            statusText.textContent = 'Listening...';
            
            // Set up media recorder
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });
            
            mediaRecorder.addEventListener('stop', processAudio);
            
            // Start recording
            mediaRecorder.start();
            
            // Set a maximum recording time (45 seconds)
            setTimeout(() => {
                if (isRecording) {
                    stopRecording();
                    showToast("Maximum recording time reached (45 seconds). Processing your request.", "info");
                }
            }, 45 * 1000);
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            showToast('Error accessing microphone. Please ensure your microphone is connected and you have granted permission.', 'error');
            statusText.textContent = 'Error accessing microphone. Please try again.';
            resetUI();
        }
    }
    
    function stopRecording() {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
        
        // Stop recording
        mediaRecorder.stop();
        
        // Stop microphone access
        stream.getTracks().forEach(track => track.stop());
        
        // Update UI to show processing state
        showLoadingState("Processing your request...");
    }
    
    // Helper function to show loading state
    function showLoadingState(message) {
        isRecording = false;
        isProcessing = true;
        assistantCircle.classList.remove('listening', 'speaking');
        assistantCircle.classList.add('processing');
        waveIcon.classList.add('hidden');
        micIcon.classList.add('hidden');
        loadingIcon.classList.remove('hidden');
        statusText.textContent = message || 'Processing...';
    }
    
    async function processAudio() {
        try {
            // Show loading state
            showLoadingState("Converting speech to text...");
            
            // Create audio blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // Check if audio is too short
            if (audioBlob.size < 1000) { // approx 1KB
                showToast("The recording was too short. Please try again and speak clearly.", "warning");
                resetUI();
                return;
            }
            
            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            
            reader.onloadend = async () => {
                try {
                    const base64Audio = reader.result;
                    
                    // Update status before sending to backend
                    statusText.textContent = 'Sending to AI...';
                    
                    // Send to backend
                    const response = await fetch('/process-audio', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ audio: base64Audio })
                    });
                    
                    // Update status while processing response
                    statusText.textContent = 'Getting AI response...';
                    
                    if (!response.ok) {
                        // Handle HTTP errors
                        const errorText = await response.text();
                        throw new Error(`Server error: ${response.status} ${errorText}`);
                    }
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Show transcript and response
                        transcriptText.textContent = data.transcribed_text;
                        // Parse markdown for response text
                        responseText.innerHTML = marked.parse(data.response_text);
                        transcriptContainer.classList.remove('hidden');
                        
                        // Update status before playing audio
                        statusText.textContent = 'Preparing to speak...';
                        
                        // Store the audio data for replay
                        lastAudioData = data.audio;
                        
                        // Enable replay button
                        repeatButton.disabled = false;
                        
                        // Play audio response
                        playAudioResponse(data.audio, false);
                        
                        // Enable control buttons
                        enablePlaybackControls();
                    } else {
                        throw new Error(data.error || 'Unknown error processing audio');
                    }
                } catch (error) {
                    console.error('Error processing audio:', error);
                    showToast(`Error: ${error.message}`, 'error');
                    statusText.textContent = 'Error processing your speech. Please try again.';
                    resetUI();
                }
            };
        } catch (error) {
            console.error('Error processing audio:', error);
            showToast(`Error: ${error.message}`, 'error');
            statusText.textContent = 'Error processing your speech. Please try again.';
            resetUI();
        }
    }
    
    function playAudioResponse(audioData, isReplay = false) {
        try {
            // Stop any currently playing audio
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
            }
            
            // Reset pause state
            isPaused = false;
            pauseIcon.classList.remove('hidden');
            playIcon.classList.add('hidden');
            pausePlayButton.classList.remove('paused');
            
            // Update UI for speaking or replaying
            assistantCircle.classList.remove('processing');
            assistantCircle.classList.add('speaking');
            loadingIcon.classList.add('hidden');
            waveIcon.classList.remove('hidden');
            statusText.textContent = isReplay ? 'Replaying...' : 'Speaking...';
            
            // If this is a replay, update button state
            if (isReplay) {
                isReplaying = true;
                repeatButton.classList.add('playing');
                repeatButton.disabled = true;
            }
            
            // Create audio element
            audioPlayer = new Audio(audioData);
            
            // Add error handler for audio playback
            audioPlayer.addEventListener('error', (e) => {
                console.error('Audio playback error:', e);
                showToast('Error playing audio response. Please try again.', 'error');
                resetUI();
            });
            
            // Add timeupdate event to update UI with current time
            audioPlayer.addEventListener('timeupdate', () => {
                if (!isPaused && audioPlayer.duration) {
                    const currentTime = formatTime(audioPlayer.currentTime);
                    const duration = formatTime(audioPlayer.duration);
                    if (isReplaying) {
                        statusText.textContent = `Replaying... (${currentTime}/${duration})`;
                    } else {
                        statusText.textContent = `Speaking... (${currentTime}/${duration})`;
                    }
                }
            });
            
            // Enable playback controls
            enablePlaybackControls();
            
            // Play audio
            const playPromise = audioPlayer.play();
            
            // Handle play() promise (required for Chrome)
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('Error playing audio:', error);
                    showToast('Error playing audio. Auto-play might be blocked by your browser.', 'warning');
                });
            }
            
            // Handle audio end
            audioPlayer.onended = () => {
                if (isReplay) {
                    // Reset replay state
                    isReplaying = false;
                    repeatButton.classList.remove('playing');
                    repeatButton.disabled = false;
                    statusText.textContent = 'Click to speak';
                    assistantCircle.classList.remove('speaking');
                    waveIcon.classList.add('hidden');
                    micIcon.classList.remove('hidden');
                    
                    // Disable playback controls on end
                    disablePlaybackControls();
                } else {
                    // Show success message when audio completes
                    showToast('Response complete. Click microphone to speak again.', 'success');
                    
                    // Reset UI normally
                    resetUI();
                }
                
                // Reset audio player
                audioPlayer = null;
            };
        } catch (error) {
            console.error('Error setting up audio playback:', error);
            showToast('Error preparing audio playback. Please try again.', 'error');
            resetUI();
        }
    }
    
    function enablePlaybackControls() {
        pausePlayButton.disabled = false;
        skipBackwardButton.disabled = false;
        skipForwardButton.disabled = false;
    }
    
    function disablePlaybackControls() {
        pausePlayButton.disabled = true;
        skipBackwardButton.disabled = true;
        skipForwardButton.disabled = true;
    }
    
    function resetUI() {
        // Reset UI elements
        assistantCircle.classList.remove('listening', 'processing', 'speaking');
        waveIcon.classList.add('hidden');
        loadingIcon.classList.add('hidden');
        micIcon.classList.remove('hidden');
        statusText.textContent = 'Click to speak';
        isProcessing = false;
        isPaused = false;
        
        // Make sure the repeat button is enabled if we have audio
        if (lastAudioData) {
            repeatButton.disabled = false;
        }
        
        // Disable playback controls
        disablePlaybackControls();
    }
}); 