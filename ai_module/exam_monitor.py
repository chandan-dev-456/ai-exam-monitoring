import sys
import json
import base64
import cv2
import numpy as np
import mediapipe as mp

class ExamMonitor:
    def __init__(self):
        # Initialize MediaPipe Face Detection
        self.mp_face_detection = mp.solutions.face_detection
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=0,
            min_detection_confidence=0.5
        )
        
        # Store registered faces (in production, load from DB)
        self.registered_faces = {}
        print("✅ Exam Monitor initialized", file=sys.stderr)
    
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
    
    def analyze_frame(self, frame, registered_face=None):
        """Analyze frame for violations"""
        if frame is None:
            return {'violation': 'no_frame', 'details': {}}
        
        # Convert to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Detect faces
        results = self.face_detection.process(rgb_frame)
        
        # Case 1: No face detected
        if not results.detections:
            return {
                'violation': 'no_face',
                'details': {'message': 'No face detected in frame'}
            }
        
        # Count faces
        face_count = len(results.detections)
        
        # Case 2: Multiple faces detected
        if face_count > 1:
            return {
                'violation': 'multiple_faces',
                'details': {
                    'count': face_count,
                    'message': f'{face_count} faces detected'
                }
            }
        
        # Case 3: Single face - could check if it's the registered person
        # This would require face recognition model
        # For now, just return success
        
        return {
            'success': True,
            'face_count': face_count,
            'details': {}
        }

# Main processing
monitor = ExamMonitor()

for line in sys.stdin:
    try:
        data = json.loads(line.strip())
        
        if data.get('task') == 'analyze_frame':
            frame = monitor.decode_frame(data.get('frame'))
            result = monitor.analyze_frame(frame)
            
            # Check if violation count exceeds threshold
            if 'violation' in result:
                print(json.dumps(result))
            else:
                print(json.dumps({'success': True}))
            
            sys.stdout.flush()
            
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.stdout.flush()