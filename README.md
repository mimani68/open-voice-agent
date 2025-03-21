# AI Voice Agent

A virtual voice assistant application that allows users to interact using their voice. The application uses:

- **OpenAI's Whisper API** for speech-to-text conversion
- **OpenAI's GPT models** for generating responses
- **Amazon Polly** for converting text responses back to speech

## Features

- Real-time voice recording
- Speech-to-text transcription
- AI-generated responses
- Text-to-speech conversion
- Visual feedback with loading animations
- Audio playback controls:
  - Play/pause audio playback
  - Skip forward 10 seconds
  - Skip backward 10 seconds
  - Replay entire response

## Prerequisites

- Python 3.9+
- OpenAI API key
- AWS credentials with access to Amazon Polly
- Docker and Docker Compose (for containerized deployment)

## Setup

### Local Development

1. Clone the repository
2. Create a `.env` file based on the example below
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the application:
   ```bash
   flask run
   ```

### Docker Deployment

1. Clone the repository
2. Create a `.env` file with your API keys
3. Build and run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# OpenAI API Key
OPENAI_API_KEY=your-openai-api-key

# AWS Credentials
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Polly Configuration
POLLY_ENGINE=neural
POLLY_VOICE_ID=Joanna
POLLY_SAMPLE_RATE=24000
```

## Usage

1. Open the application in your browser
2. Click on the microphone icon to start speaking
3. The application will:
   - Transcribe your speech
   - Generate an AI response
   - Convert the response to speech
   - Display both the transcription and response text
4. Audio playback controls:
   - Use the play/pause button to control audio playback
   - Skip forward or backward 10 seconds using skip controls
   - Click "Replay Voice" to restart the audio response from the beginning
   - Audio progress and duration are displayed during playback

## License

MIT 