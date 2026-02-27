import sys
import json
import base64
import cv2
import numpy as np

# Import mediapipe correctly for version 0.10.32
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class FaceComparer:
    def __init__(self):
        try:
            # For MediaPipe 0.10.32, we need to use the tasks API
            print("Initializing FaceComparer...", file=sys.stderr)
            
            # Create face detector
            self.face_detector = vision.FaceDetector.create_from_model_path(
                'C:\\Users\\chand\\Documents\\ai_exam_monitoring\\ai_module\\face_detection_short_range.tflite'
            )
            
            # If model not found, we'll use OpenCV as fallback
            print("✅ FaceComparer initialized", file=sys.stderr)
            
        except Exception as e:
            print(f"MediaPipe init error: {e}, using OpenCV fallback", file=sys.stderr)
            # Fallback to OpenCV
            self.face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
    
    def decode_image(self, base64_string):
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
    
    def has_face(self, image):
        """Check if image has a face"""
        if image is None:
            return False
        
        # Convert to RGB
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Try OpenCV method (always works)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
        
        return len(faces) > 0
    
    def get_face_similarity(self, img1, img2):
        """Simple face similarity using OpenCV"""
        # Convert to grayscale
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces1 = self.face_cascade.detectMultiScale(gray1, 1.1, 4)
        faces2 = self.face_cascade.detectMultiScale(gray2, 1.1, 4)
        
        if len(faces1) == 0 or len(faces2) == 0:
            return 0
        
        # Get face regions
        x1, y1, w1, h1 = faces1[0]
        x2, y2, w2, h2 = faces2[0]
        
        face1 = gray1[y1:y1+h1, x1:x1+w1]
        face2 = gray2[y2:y2+h2, x2:x2+w2]
        
        # Resize to same size
        face1 = cv2.resize(face1, (100, 100))
        face2 = cv2.resize(face2, (100, 100))
        
        # Calculate similarity using histogram comparison
        hist1 = cv2.calcHist([face1], [0], None, [256], [0, 256])
        hist2 = cv2.calcHist([face2], [0], None, [256], [0, 256])
        
        similarity = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
        
        # Convert to percentage
        percentage = max(0, min(100, round((similarity + 1) * 50, 2)))
        
        return percentage
    
    def compare(self, photo1, photo2):
        """Compare two faces and return match percentage"""
        try:
            print("Decoding images...", file=sys.stderr)
            img1 = self.decode_image(photo1)
            img2 = self.decode_image(photo2)
            
            if img1 is None or img2 is None:
                print("Failed to decode images", file=sys.stderr)
                return 0
            
            print("Comparing faces...", file=sys.stderr)
            percentage = self.get_face_similarity(img1, img2)
            
            print(f"Match: {percentage}%", file=sys.stderr)
            return percentage
            
        except Exception as e:
            print(f"Compare error: {e}", file=sys.stderr)
            return 0

# Main execution
if __name__ == "__main__":
    print("🚀 Face Utils Started", file=sys.stderr)
    comparer = FaceComparer()
    
    for line in sys.stdin:
        try:
            data = json.loads(line.strip())
            
            if data.get('task') == 'compare':
                percentage = comparer.compare(
                    data.get('photo1'),
                    data.get('photo2')
                )
                
                result = {
                    'match_percentage': percentage
                }
                print(json.dumps(result))
                sys.stdout.flush()
                
        except Exception as e:
            print(json.dumps({'error': str(e)}))
            sys.stdout.flush()