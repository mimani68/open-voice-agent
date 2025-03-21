import os
from flask import Flask, render_template, request, jsonify
import boto3
import base64
import tempfile
import re
import traceback
from botocore.exceptions import ClientError
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Configure OpenAI API
openai_api_key = os.environ.get("OPENAI_API_KEY", "your-openai-api-key")
# Initialize OpenAI client
client = OpenAI(api_key=openai_api_key)

# Configure AWS credentials
aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID", "your-aws-access-key")
aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "your-aws-secret-key")
aws_region = os.environ.get("AWS_REGION", "us-east-1")

# Configure Polly settings
polly_engine = os.environ.get("POLLY_ENGINE", "neural")
polly_voice_id = os.environ.get("POLLY_VOICE_ID", "Joanna")
polly_sample_rate = os.environ.get("POLLY_SAMPLE_RATE", "24000")

# Initialize Polly client
polly_client = boto3.client(
    'polly',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name=aws_region
)

# Function to strip Markdown syntax for speech synthesis
def strip_markdown(text):
    # Remove code blocks
    text = re.sub(r'```[\s\S]*?```', 'Code block removed for speech.', text)
    # Remove inline code
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Remove headers
    text = re.sub(r'#{1,6}\s+(.*)', r'\1', text)
    # Remove bold/italic
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    text = re.sub(r'_([^_]+)_', r'\1', text)
    # Remove links
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove images
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', r'Image: \1', text)
    # Remove horizontal rules
    text = re.sub(r'---|\*\*\*|___', ' ', text)
    # Convert bullet points to natural language
    text = re.sub(r'^\s*[-*+]\s+', 'Bullet point: ', text, flags=re.MULTILINE)
    # Convert numbered lists to natural language
    text = re.sub(r'^\s*\d+\.\s+', 'Point: ', text, flags=re.MULTILINE)
    
    return text

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process-audio', methods=['POST'])
def process_audio():
    temp_audio_path = None
    
    try:
        # Validate input
        if not request.json or 'audio' not in request.json:
            return jsonify({
                'success': False,
                'error': 'Missing audio data in request'
            }), 400
            
        audio_data = request.json.get('audio')
        
        # Validate audio data format
        if not audio_data.startswith('data:'):
            return jsonify({
                'success': False,
                'error': 'Invalid audio data format'
            }), 400
            
        try:
            audio_binary = base64.b64decode(audio_data.split(',')[1])
        except Exception as e:
            return jsonify({
                'success': False,
                'error': 'Could not decode audio data'
            }), 400
            
        # Save audio to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio:
            temp_audio.write(audio_binary)
            temp_audio_path = temp_audio.name
        
        # Send audio to OpenAI for transcription
        try:
            with open(temp_audio_path, "rb") as audio_file:
                transcript = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
        except Exception as e:
            print(f"Transcription error: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Transcription failed: {str(e)}'
            }), 500
        
        # Get text from transcription
        transcribed_text = transcript.text
        
        if not transcribed_text or transcribed_text.strip() == "":
            return jsonify({
                'success': False,
                'error': 'No speech detected. Please try again and speak clearly.'
            }), 400
        
        # Send transcribed text to OpenAI for processing
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful virtual assistant. Format your responses using Markdown syntax for better readability. Use headings, bullet points, emphasis, links, and code blocks where appropriate to present information clearly. The answer must be straight forward and to the point. It should not be a question. It should be a single sentence or a few sentences. Answers must be consise and have be accordign real and valid statistics. The answer should be based on the transcribed text."},
                    {"role": "user", "content": transcribed_text}
                ]
            )
        except Exception as e:
            print(f"OpenAI API error: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'AI processing failed: {str(e)}'
            }), 500
        
        # Get response text
        ai_response = response.choices[0].message.content
        
        # Strip markdown for speech synthesis
        speech_text = strip_markdown(ai_response)
        
        # Convert text to speech using AWS Polly
        try:
            polly_response = polly_client.synthesize_speech(
                Engine=polly_engine,
                Text=speech_text,
                OutputFormat='mp3',
                VoiceId=polly_voice_id,
                SampleRate=polly_sample_rate,
                TextType='text'
            )
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_message = e.response.get('Error', {}).get('Message')
            print(f"Polly error: {error_code} - {error_message}")
            return jsonify({
                'success': False,
                'error': f'Text-to-speech failed: {error_message}'
            }), 500
        
        # Get audio stream from Polly response
        audio_stream = polly_response['AudioStream'].read()
        
        # Encode audio for sending to client
        encoded_audio = base64.b64encode(audio_stream).decode('utf-8')
        
        return jsonify({
            'success': True,
            'transcribed_text': transcribed_text,
            'response_text': ai_response,
            'audio': f'data:audio/mp3;base64,{encoded_audio}'
        })
        
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': f'An unexpected error occurred: {str(e)}'
        }), 500
    finally:
        # Clean up temporary file
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.unlink(temp_audio_path)
            except Exception as e:
                print(f"Error removing temporary file: {str(e)}")

if __name__ == '__main__':
    app.run(debug=True) 