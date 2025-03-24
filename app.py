import os
from flask import Flask, render_template, request, jsonify, session
import boto3
import base64
import tempfile
import re
import traceback
from botocore.exceptions import ClientError
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(24))

openai_api_key = os.environ.get("OPENAI_API_KEY", "your-openai-api-key")
client = OpenAI(api_key=openai_api_key)

aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID", "your-aws-access-key")
aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "your-aws-secret-key")
aws_region = os.environ.get("AWS_REGION", "us-east-1")

polly_engine = os.environ.get("POLLY_ENGINE", "neural")
polly_voice_id = os.environ.get("POLLY_VOICE_ID", "Joanna")
polly_sample_rate = os.environ.get("POLLY_SAMPLE_RATE", "24000")

polly_client = boto3.client(
    'polly',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name=aws_region
)

def strip_markdown(text):
    text = re.sub(r'```[\s\S]*?```', 'Code block removed for speech.', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'#{1,6}\s+(.*)', r'\1', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    text = re.sub(r'_([^_]+)_', r'\1', text)
    text = re.sub(r'$$([^$$]+)$$$$[^$$]+$$', r'\1', text)
    text = re.sub(r'!$$([^$$]*)$$$$[^$$]+$$', r'Image: \1', text)
    text = re.sub(r'---|\*\*\*|___', ' ', text)
    text = re.sub(r'^\s*[-*+]\s+', 'Bullet point: ', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', 'Point: ', text, flags=re.MULTILINE)
    return text

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process-audio', methods=['POST'])
def process_audio():
    temp_audio_path = None
    
    try:
        if not request.json or 'audio' not in request.json:
            return jsonify({
                'success': False,
                'error': 'Missing audio data in request'
            }), 400
            
        audio_data = request.json.get('audio')
        
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
            
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio:
            temp_audio.write(audio_binary)
            temp_audio_path = temp_audio.name
        
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
        
        transcribed_text = transcript.text
        
        if not transcribed_text or transcribed_text.strip() == "":
            return jsonify({
                'success': False,
                'error': 'No speech detected. Please try again and speak clearly.'
            }), 400
        
        try:
            conversation_history = session.get('conversation_history', [])
            
            messages = [{
                "role": "system", 
                "content": "You are a helpful virtual voice assistant. Format your responses using Markdown syntax for better readability. The answer must be straight forward and to the point and like a person talking fluently and naturally. It should not be a question. It should be a single sentence or a few sentences. Answers must be concise and based on real and valid statistics."
            }]
            messages.extend(conversation_history)
            messages.append({"role": "user", "content": transcribed_text})

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages
            )
        except Exception as e:
            print(f"OpenAI API error: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'AI processing failed: {str(e)}'
            }), 500
        
        ai_response = response.choices[0].message.content
        
        conversation_history.extend([
            {"role": "user", "content": transcribed_text},
            {"role": "assistant", "content": ai_response}
        ])
        
        session['conversation_history'] = conversation_history[-20:]
        
        speech_text = strip_markdown(ai_response)
        
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
        
        audio_stream = polly_response['AudioStream'].read()
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
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.unlink(temp_audio_path)
            except Exception as e:
                print(f"Error removing temporary file: {str(e)}")

if __name__ == '__main__':
    app.run(debug=True)
