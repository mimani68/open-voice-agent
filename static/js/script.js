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
            
            // Set a maximum recording time (15 seconds)
            setTimeout(() => {
                if (isRecording) {
                    stopRecording();
                }
            }, 15000);
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
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
            
            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            
            reader.onloadend = async () => {
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
                
                const data = await response.json();
                
                if (data.success) {
                    // Show transcript and response
                    transcriptText.textContent = data.transcribed_text;
                    responseText.textContent = data.response_text;
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
                    console.error('Error processing audio:', data.error);
                    statusText.textContent = 'Error processing your speech. Please try again.';
                    resetUI();
                }
            };
        } catch (error) {
            console.error('Error processing audio:', error);
            statusText.textContent = 'Error processing your speech. Please try again.';
            resetUI();
        }
    }
    
    function playAudioResponse(audioData, isReplay = false) {
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
        audioPlayer.play();
        
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
                // Reset UI normally
                resetUI();
            }
            
            // Reset audio player
            audioPlayer = null;
        };
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