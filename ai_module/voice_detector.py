import speech_recognition as sr
import numpy as np
import threading

class VoiceDetector:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        self.is_listening = False
        self.voice_detected = False
        
        # Calibrate for ambient noise
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source, duration=1)
    
    def detect_voice(self):
        """Detect if voice is present"""
        try:
            with self.microphone as source:
                audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=1)
                
                # Try to recognize speech
                try:
                    text = self.recognizer.recognize_google(audio)
                    self.voice_detected = True
                    return True
                except:
                    # Check if there's any sound (could be noise)
                    audio_data = np.frombuffer(audio.get_raw_data(), dtype=np.int16)
                    volume = np.abs(audio_data).mean()
                    
                    if volume > 500:  # Threshold for voice
                        self.voice_detected = True
                        return True
                    
        except sr.WaitTimeoutError:
            pass
        except Exception as e:
            print(f"Voice detection error: {e}")
        
        self.voice_detected = False
        return False
    
    def start_listening(self, callback):
        """Start continuous listening in background"""
        def listen_loop():
            self.is_listening = True
            while self.is_listening:
                if self.detect_voice():
                    callback({'voice_detected': True})
        
        thread = threading.Thread(target=listen_loop)
        thread.daemon = True
        thread.start()
    
    def stop_listening(self):
        self.is_listening = False