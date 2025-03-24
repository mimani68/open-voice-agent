class VoiceAssistant {
    constructor() {
        this.assistantCircle = document.getElementById('assistantCircle');
        this.micIcon = document.getElementById('micIcon');
        this.waveIcon = document.getElementById('waveIcon');
        this.loadingIcon = document.getElementById('loadingIcon');
        this.statusText = document.getElementById('statusText');
        this.transcriptContainer = document.getElementById('transcriptContainer');
        this.transcriptText = document.getElementById('transcriptText');
        this.responseText = document.getElementById('responseText');
        this.repeatButton = document.getElementById('repeatButton');
        this.pausePlayButton = document.getElementById('pausePlayButton');
        this.skipBackwardButton = document.getElementById('skipBackwardButton');
        this.skipForwardButton = document.getElementById('skipForwardButton');
        this.pauseIcon = document.getElementById('pauseIcon');
        this.playIcon = document.getElementById('playIcon');
        this.toastContainer = document.getElementById('toastContainer');
        
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            sanitize: true
        });

        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isProcessing = false;
        this.stream = null;
        this.lastAudioData = null;
        this.audioPlayer = null;
        this.isReplaying = false;
        this.isPaused = false;

        this.toastIcons = {
            error: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>`,
            warning: `<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"></path></svg>`,
            success: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>`,
            info: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path></svg>`
        };

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.assistantCircle.addEventListener('click', this.handleAssistantClick.bind(this));
        this.repeatButton.addEventListener('click', this.handleRepeatClick.bind(this));
        this.pausePlayButton.addEventListener('click', this.handlePausePlayClick.bind(this));
        this.skipBackwardButton.addEventListener('click', this.handleSkipBackward.bind(this));
        this.skipForwardButton.addEventListener('click', this.handleSkipForward.bind(this));
    }

    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${this.toastIcons[type]}</div>
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

        this.toastContainer.appendChild(toast);
        const progressBar = toast.querySelector('.toast-progress-bar');
        progressBar.style.animation = `shrink ${duration}ms linear forwards`;
        progressBar.style.transformOrigin = 'left';
        void toast.offsetWidth;
        toast.classList.add('show');

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

        toast.addEventListener('click', () => this.removeToast(toast));
        const timeoutId = setTimeout(() => this.removeToast(toast), duration);
        toast.timeoutId = timeoutId;

        const closeButton = toast.querySelector('.toast-close');
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeToast(toast);
        });

        return toast;
    }

    removeToast(toast) {
        if (toast.timeoutId) clearTimeout(toast.timeoutId);
        toast.classList.remove('show');
        setTimeout(() => toast.parentNode?.removeChild(toast), 300);
    }

    handlePausePlayClick() {
        if (!this.audioPlayer) return;

        if (this.isPaused) {
            this.audioPlayer.play();
            this.isPaused = false;
            this.pauseIcon.classList.remove('hidden');
            this.playIcon.classList.add('hidden');
            this.pausePlayButton.classList.remove('paused');
            this.statusText.textContent = this.isReplaying ? 'Replaying...' : 'Speaking...';
        } else {
            this.audioPlayer.pause();
            this.isPaused = true;
            this.pauseIcon.classList.add('hidden');
            this.playIcon.classList.remove('hidden');
            this.pausePlayButton.classList.add('paused');
            this.statusText.textContent = 'Paused';
        }
    }

    handleSkipForward() {
        if (!this.audioPlayer) return;
        const newTime = Math.min(this.audioPlayer.currentTime + 10, this.audioPlayer.duration);
        this.audioPlayer.currentTime = newTime;
        if (this.isPaused) {
            this.statusText.textContent = `Paused (${this.formatTime(newTime)}/${this.formatTime(this.audioPlayer.duration)})`;
        }
    }

    handleSkipBackward() {
        if (!this.audioPlayer) return;
        const newTime = Math.max(this.audioPlayer.currentTime - 10, 0);
        this.audioPlayer.currentTime = newTime;
        if (this.isPaused) {
            this.statusText.textContent = `Paused (${this.formatTime(newTime)}/${this.formatTime(this.audioPlayer.duration)})`;
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    handleAssistantClick() {
        if (this.isProcessing) return;
        if (!this.isRecording) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    handleRepeatClick() {
        if (this.isReplaying || !this.lastAudioData) return;
        this.playAudioResponse(this.lastAudioData, true);
    }

    async startRecording() {
        try {
            this.showLoadingState("Requesting microphone...");
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.isRecording = true;
            this.isProcessing = false;
            this.assistantCircle.classList.remove('processing');
            this.assistantCircle.classList.add('listening');
            this.micIcon.classList.add('hidden');
            this.loadingIcon.classList.add('hidden');
            this.waveIcon.classList.remove('hidden');
            this.statusText.textContent = 'Listening...';

            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];
            this.mediaRecorder.addEventListener('dataavailable', event => {
                this.audioChunks.push(event.data);
            });
            this.mediaRecorder.addEventListener('stop', () => this.processAudio());
            this.mediaRecorder.start();

            setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                    this.showToast("Maximum recording time reached (45 seconds). Processing your request.", "info");
                }
            }, 45000);
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.showToast('Error accessing microphone. Please ensure your microphone is connected and you have granted permission.', 'error');
            this.statusText.textContent = 'Error accessing microphone. Please try again.';
            this.resetUI();
        }
    }

    stopRecording() {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;
        this.mediaRecorder.stop();
        this.stream.getTracks().forEach(track => track.stop());
        this.showLoadingState("Processing your request...");
    }

    showLoadingState(message) {
        this.isRecording = false;
        this.isProcessing = true;
        this.assistantCircle.classList.remove('listening', 'speaking');
        this.assistantCircle.classList.add('processing');
        this.waveIcon.classList.add('hidden');
        this.micIcon.classList.add('hidden');
        this.loadingIcon.classList.remove('hidden');
        this.statusText.textContent = message || 'Processing...';
    }

    async processAudio() {
        try {
            this.showLoadingState("Converting speech to text...");
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

            if (audioBlob.size < 1000) {
                this.showToast("The recording was too short. Please try again and speak clearly.", "warning");
                this.resetUI();
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);

            reader.onloadend = async () => {
                try {
                    const base64Audio = reader.result;
                    this.statusText.textContent = 'Sending to AI...';

                    const response = await fetch('/process-audio', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ audio: base64Audio })
                    });

                    this.statusText.textContent = 'Getting AI response...';

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Server error: ${response.status} ${errorText}`);
                    }

                    const data = await response.json();
                    
                    if (data.success) {
                        this.transcriptText.textContent = data.transcribed_text;
                        this.responseText.innerHTML = marked.parse(data.response_text);
                        this.transcriptContainer.classList.remove('hidden');
                        this.statusText.textContent = 'Preparing to speak...';
                        this.lastAudioData = data.audio;
                        this.repeatButton.disabled = false;
                        this.playAudioResponse(data.audio, false);
                        this.enablePlaybackControls();
                    } else {
                        throw new Error(data.error || 'Unknown error processing audio');
                    }
                } catch (error) {
                    console.error('Error processing audio:', error);
                    this.showToast(`Error: ${error.message}`, 'error');
                    this.statusText.textContent = 'Error processing your speech. Please try again.';
                    this.resetUI();
                }
            };
        } catch (error) {
            console.error('Error processing audio:', error);
            this.showToast(`Error: ${error.message}`, 'error');
            this.statusText.textContent = 'Error processing your speech. Please try again.';
            this.resetUI();
        }
    }

    playAudioResponse(audioData, isReplay = false) {
        try {
            if (this.audioPlayer) {
                this.audioPlayer.pause();
                this.audioPlayer.currentTime = 0;
            }

            this.isPaused = false;
            this.pauseIcon.classList.remove('hidden');
            this.playIcon.classList.add('hidden');
            this.pausePlayButton.classList.remove('paused');
            this.assistantCircle.classList.remove('processing');
            this.assistantCircle.classList.add('speaking');
            this.loadingIcon.classList.add('hidden');
            this.waveIcon.classList.remove('hidden');
            this.statusText.textContent = isReplay ? 'Replaying...' : 'Speaking...';

            if (isReplay) {
                this.isReplaying = true;
                this.repeatButton.classList.add('playing');
                this.repeatButton.disabled = true;
            }

            this.audioPlayer = new Audio(audioData);

            this.audioPlayer.addEventListener('error', (e) => {
                console.error('Audio playback error:', e);
                this.showToast('Error playing audio response. Please try again.', 'error');
                this.resetUI();
            });

            this.audioPlayer.addEventListener('timeupdate', () => {
                if (!this.isPaused && this.audioPlayer.duration) {
                    const currentTime = this.formatTime(this.audioPlayer.currentTime);
                    const duration = this.formatTime(this.audioPlayer.duration);
                    this.statusText.textContent = `${isReplay ? 'Replaying' : 'Speaking'}... (${currentTime}/${duration})`;
                }
            });

            this.enablePlaybackControls();
            const playPromise = this.audioPlayer.play();

            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('Error playing audio:', error);
                    this.showToast('Error playing audio. Auto-play might be blocked by your browser.', 'warning');
                });
            }

            this.audioPlayer.onended = () => {
                if (isReplay) {
                    this.isReplaying = false;
                    this.repeatButton.classList.remove('playing');
                    this.repeatButton.disabled = false;
                    this.statusText.textContent = 'Click to speak';
                    this.assistantCircle.classList.remove('speaking');
                    this.waveIcon.classList.add('hidden');
                    this.micIcon.classList.remove('hidden');
                    this.disablePlaybackControls();
                } else {
                    this.showToast('Response complete. Click microphone to speak again.', 'success');
                    this.resetUI();
                }
                this.audioPlayer = null;
            };
        } catch (error) {
            console.error('Error setting up audio playback:', error);
            this.showToast('Error preparing audio playback. Please try again.', 'error');
            this.resetUI();
        }
    }

    enablePlaybackControls() {
        this.pausePlayButton.disabled = false;
        this.skipBackwardButton.disabled = false;
        this.skipForwardButton.disabled = false;
    }

    disablePlaybackControls() {
        this.pausePlayButton.disabled = true;
        this.skipBackwardButton.disabled = true;
        this.skipForwardButton.disabled = true;
    }

    resetUI() {
        this.assistantCircle.classList.remove('listening', 'processing', 'speaking');
        this.waveIcon.classList.add('hidden');
        this.loadingIcon.classList.add('hidden');
        this.micIcon.classList.remove('hidden');
        this.statusText.textContent = 'Click to speak';
        this.isProcessing = false;
        this.isPaused = false;
        if (this.lastAudioData) this.repeatButton.disabled = false;
        this.disablePlaybackControls();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VoiceAssistant();
});
