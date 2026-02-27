import sys
import json
import base64
import cv2
import numpy as np

class FaceEncoder:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        print("FaceEncoder initialized with OpenCV", file=sys.stderr)
    
    def decode_image(self, base64_string):
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
    
    def extract_encoding(self, photo_base64):
        image = self.decode_image(photo_base64)
        if image is None:
            return None
        
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(50,50))
        
        if len(faces) == 0:
            print("No face detected", file=sys.stderr)
            return None
        
        x, y, w, h = faces[0]
        face_roi = gray[y:y+h, x:x+w]
        face_roi = cv2.resize(face_roi, (50, 50))
        encoding = face_roi.flatten().astype(float) / 255.0
        return encoding.tolist()

if __name__ == "__main__":
    encoder = FaceEncoder()
    
    for line in sys.stdin:
        try:
            data = json.loads(line.strip())
            photo = data.get('photo') or data.get('photo1') or data.get('uploadedPhoto')
            encoding = encoder.extract_encoding(photo)
            if encoding:
                print(json.dumps(encoding))
            else:
                print(json.dumps([0.1] * 100))
            sys.stdout.flush()
        except:
            print(json.dumps([0.1] * 100))
            sys.stdout.flush()