import cv2
import numpy as np
import mediapipe as mp
import base64

class FaceComparer:
    def __init__(self):
        # Initialize MediaPipe
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_face_mesh = mp.solutions.face_mesh
        
        # Face detection
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=0,
            min_detection_confidence=0.5
        )
        
        # Face mesh (468 landmarks)
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )
        
        print("✅ FaceComparer initialized")
    
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
            print(f"❌ Decode error: {e}")
            return None
    
    def get_face_encoding(self, image):
        """Get face encoding using MediaPipe mesh"""
        if image is None:
            return None
        
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_image)
        
        if not results.multi_face_landmarks:
            return None
        
        face_landmarks = results.multi_face_landmarks[0]
        
        # Convert 468 landmarks to array (1404 features)
        encoding = []
        for lm in face_landmarks.landmark:
            encoding.extend([lm.x, lm.y, lm.z])
        
        return np.array(encoding)
    
    def compare_faces(self, photo1_base64, photo2_base64, threshold=70):
        """Compare two faces and return match percentage"""
        image1 = self.decode_image(photo1_base64)
        image2 = self.decode_image(photo2_base64)
        
        if image1 is None or image2 is None:
            return {
                'success': False,
                'message': 'Failed to decode images',
                'match_percentage': 0
            }
        
        encoding1 = self.get_face_encoding(image1)
        encoding2 = self.get_face_encoding(image2)
        
        if encoding1 is None:
            return {
                'success': False,
                'message': 'No face detected in first image',
                'match_percentage': 0
            }
        
        if encoding2 is None:
            return {
                'success': False,
                'message': 'No face detected in second image',
                'match_percentage': 0
            }
        
        # Normalize and calculate similarity
        norm1 = encoding1 / np.linalg.norm(encoding1)
        norm2 = encoding2 / np.linalg.norm(encoding2)
        similarity = np.dot(norm1, norm2)
        match_percentage = round(similarity * 100, 2)
        
        return {
            'success': True,
            'match': match_percentage >= threshold,
            'match_percentage': match_percentage,
            'message': f'Face match: {match_percentage}%'
        }