import sys
import json
import base64
import cv2
import numpy as np

class FaceDetector:
    def __init__(self):
        # Use OpenCV's face detector
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        # Write to stderr WITHOUT emojis
        print("FaceDetector initialized with OpenCV", file=sys.stderr)
    
    def decode_frame(self, base64_string):
        """Convert base64 to image"""
        try:
            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]
            
            img_data = base64.b64decode(base64_string)
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            print(f"Decode error: {e}", file=sys.stderr)
            return None
    
    def detect_faces(self, frame):
        """Detect faces in frame and return count"""
        if frame is None:
            return 0
        
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(50, 50)
        )
        
        return len(faces)

if __name__ == "__main__":
    try:
        detector = FaceDetector()
        
        for line in sys.stdin:
            try:
                data = json.loads(line.strip())
                
                frame_data = data.get('frame', data)
                frame = detector.decode_frame(frame_data)
                face_count = detector.detect_faces(frame)
                
                result = {
                    'faceCount': face_count,
                    'success': True
                }
                print(json.dumps(result))
                sys.stdout.flush()
                
            except Exception as e:
                print(json.dumps({'faceCount': 0, 'error': str(e)}))
                sys.stdout.flush()
                
    except Exception as e:
        print(json.dumps({'faceCount': 0, 'error': str(e)}))
        sys.stdout.flush()