# AI Voice Agent

A virtual voice assistant application that allows users to interact using their voice. The application uses:

- **OpenAI's Whisper API** for speech-to-text conversion
- **OpenAI's GPT models** for generating responses
- **Amazon Polly** for converting text responses back to speech

## Features

- Real-time voice recording
- Speech-to-text transcription
- AI-generated responses with Markdown formatting
- Text-to-speech conversion
- Visual feedback with loading animations
- Toast notifications for errors and status updates
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

## Usage

1. Open the application in your browser
2. Click on the microphone icon to start speaking
3. The application will:
   - Transcribe your speech
   - Generate an AI response with Markdown formatting
   - Convert the response to speech (stripping Markdown for natural narration)
   - Display both the transcription and formatted response text
4. Audio playback controls:
   - Use the play/pause button to control audio playback
   - Skip forward or backward 10 seconds using skip controls
   - Click "Replay Voice" to restart the audio response from the beginning
   - Audio progress and duration are displayed during playback

## Markdown Support

The assistant's responses are formatted using Markdown, providing better readability and organization with:

- **Headings** for structured information
- **Lists** (bulleted and numbered) for sequential information
- **Emphasis** (bold and italic) for important points
- **Code blocks** for code examples or commands
- **Links** for references to web resources
- **Tables** for tabular data
- **Blockquotes** for quotations or callouts

## Error Handling

The application provides comprehensive error handling with visual toast notifications:

- **Error notifications** (red): Display when critical errors occur, such as microphone access issues, API failures, or audio playback problems
- **Warning notifications** (yellow): Show for non-critical issues like short recordings or auto-play restrictions
- **Success notifications** (green): Appear when processes complete successfully
- **Info notifications** (blue): Provide helpful information about application state

Notifications automatically dismiss after 5 seconds but can also be closed manually. All errors are also logged to the browser console for debugging.

## License

MIT 