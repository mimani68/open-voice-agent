import os
from flask import Flask, render_template, request, jsonify
import boto3
import base64
import tempfile
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

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process-audio', methods=['POST'])
def process_audio():
    try:
        # Get audio data from request
        audio_data = request.json.get('audio')
        audio_binary = base64.b64decode(audio_data.split(',')[1])
        
        # Save audio to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio:
            temp_audio.write(audio_binary)
            temp_audio_path = temp_audio.name
        
        # Send audio to OpenAI for transcription
        with open(temp_audio_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        
        # Get text from transcription
        transcribed_text = transcript.text
        
        # Send transcribed text to OpenAI for processing
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful virtual assistant."},
                {"role": "user", "content": transcribed_text}
            ]
        )
        
        # Get response text
        ai_response = response.choices[0].message.content
        
        # Convert text to speech using AWS Polly
        polly_response = polly_client.synthesize_speech(
            Engine=polly_engine,
            Text=ai_response,
            OutputFormat='mp3',
            VoiceId=polly_voice_id,
            SampleRate=polly_sample_rate,
            TextType='text'
        )
        
        # Get audio stream from Polly response
        audio_stream = polly_response['AudioStream'].read()
        
        # Encode audio for sending to client
        encoded_audio = base64.b64encode(audio_stream).decode('utf-8')
        
        # Clean up temporary file
        os.unlink(temp_audio_path)
        
        return jsonify({
            'success': True,
            'transcribed_text': transcribed_text,
            'response_text': ai_response,
            'audio': f'data:audio/mp3;base64,{encoded_audio}'
        })
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True) 