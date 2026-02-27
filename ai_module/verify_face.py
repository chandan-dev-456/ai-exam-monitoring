import sys
import json
import base64
import cv2
import numpy as np

class FaceVerifier:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        print("FaceVerifier initialized with OpenCV", file=sys.stderr)
    
    def decode_image(self, base64_string):
        try:
            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]
            img_data = base64.b64decode(base64_string)
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except:
            return None
    
    def extract_encoding(self, image):
        if image is None:
            return None
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(50,50))
        if len(faces) == 0:
            return None
        x, y, w, h = faces[0]
        face_roi = gray[y:y+h, x:x+w]
        face_roi = cv2.resize(face_roi, (50, 50))
        return face_roi.flatten().astype(float) / 255.0
    
    def verify(self, frame_base64, stored_encoding_list):
        try:
            stored_encoding = np.array(stored_encoding_list)
            image = self.decode_image(frame_base64)
            if image is None:
                return {'match': False, 'confidence': 0}
            
            current = self.extract_encoding(image)
            if current is None:
                return {'match': False, 'confidence': 0}
            
            # Simple similarity (normalized dot product)
            norm1 = current / (np.linalg.norm(current) + 1e-10)
            norm2 = stored_encoding / (np.linalg.norm(stored_encoding) + 1e-10)
            similarity = np.dot(norm1, norm2)
            confidence = round(max(0, min(100, similarity * 100)), 2)
            
            return {
                'match': confidence >= 60,
                'confidence': confidence
            }
        except Exception as e:
            return {'match': False, 'confidence': 0}

if __name__ == "__main__":
    verifier = FaceVerifier()
    for line in sys.stdin:
        try:
            data = json.loads(line.strip())
            result = verifier.verify(data.get('frame'), data.get('storedEncoding'))
            print(json.dumps(result))
            sys.stdout.flush()
        except:
            print(json.dumps({'match': False, 'confidence': 0}))
            sys.stdout.flush()