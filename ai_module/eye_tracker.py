import cv2
import dlib
import numpy as np

class EyeTracker:
    def __init__(self):
        self.detector = dlib.get_frontal_face_detector()
        self.predictor = dlib.shape_predictor('models/shape_predictor_68_face_landmarks.dat')
        
        # Eye landmarks indices
        self.LEFT_EYE = list(range(42, 48))
        self.RIGHT_EYE = list(range(36, 42))
        
        self.looking_away_threshold = 0.25
        self.blink_threshold = 0.2
        
    def track_eyes(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.detector(gray)
        
        result = {
            'looking_away': False,
            'blinking': False,
            'gaze_direction': 'center',
            'eye_contact': False
        }
        
        if len(faces) == 0:
            return result
        
        face = faces[0]
        landmarks = self.predictor(gray, face)
        
        # Calculate eye aspect ratio for blinking
        left_ear = self.eye_aspect_ratio(landmarks, self.LEFT_EYE)
        right_ear = self.eye_aspect_ratio(landmarks, self.RIGHT_EYE)
        
        # Check for blinking
        if left_ear < self.blink_threshold or right_ear < self.blink_threshold:
            result['blinking'] = True
        
        # Calculate gaze direction
        gaze = self.calculate_gaze(landmarks, frame)
        result['gaze_direction'] = gaze
        
        # Check if looking away
        if gaze != 'center':
            result['looking_away'] = True
        
        # Check eye contact
        result['eye_contact'] = gaze == 'center' and not result['blinking']
        
        return result
    
    def eye_aspect_ratio(self, landmarks, eye_points):
        """Calculate eye aspect ratio for blink detection"""
        points = []
        for i in eye_points:
            points.append((landmarks.part(i).x, landmarks.part(i).y))
        
        # Vertical distances
        v1 = np.linalg.norm(np.array(points[1]) - np.array(points[5]))
        v2 = np.linalg.norm(np.array(points[2]) - np.array(points[4]))
        
        # Horizontal distance
        h = np.linalg.norm(np.array(points[0]) - np.array(points[3]))
        
        if h == 0:
            return 0
        
        return (v1 + v2) / (2 * h)
    
    def calculate_gaze(self, landmarks, frame):
        """Calculate where the person is looking"""
        # Get eye regions
        left_eye = self.get_eye_region(landmarks, self.LEFT_EYE, frame)
        right_eye = self.get_eye_region(landmarks, self.RIGHT_EYE, frame)
        
        # Simple gaze detection based on pupil position
        # (Replace with actual gaze tracking model)
        
        # For demo, return random direction
        import random
        return random.choice(['center', 'left', 'right', 'up', 'down'])
    
    def get_eye_region(self, landmarks, eye_points, frame):
        """Extract eye region from frame"""
        points = []
        for i in eye_points:
            points.append((landmarks.part(i).x, landmarks.part(i).y))
        
        points = np.array(points, dtype=np.int32)
        
        # Get bounding box
        x, y, w, h = cv2.boundingRect(points)
        
        # Extract eye region
        eye_region = frame[y:y+h, x:x+w]
        
        return eye_region