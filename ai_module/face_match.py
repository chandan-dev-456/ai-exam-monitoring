import sys
import json
import cv2
import numpy as np
import os

def load_image(filepath):
    """Load image from file"""
    try:
        img = cv2.imread(filepath)
        if img is None:
            return None
        return img
    except Exception as e:
        print(f"Error loading image: {e}", file=sys.stderr)
        return None

def detect_face(img):
    """Detect face using OpenCV's Haar Cascade"""
    # Load face detector
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
    
    if len(faces) == 0:
        return None
    
    # Return first face
    (x, y, w, h) = faces[0]
    return img[y:y+h, x:x+w]

def compare_faces(img1_path, img2_path):
    """Compare two faces from file paths"""
    
    # Load images
    img1 = load_image(img1_path)
    img2 = load_image(img2_path)
    
    if img1 is None or img2 is None:
        return {
            'success': False,
            'match': False,
            'message': 'Failed to load images'
        }
    
    # Detect faces
    face1 = detect_face(img1)
    face2 = detect_face(img2)
    
    if face1 is None or face2 is None:
        return {
            'success': False,
            'match': False,
            'message': 'Could not detect face in one or both images'
        }
    
    # Resize faces to same size
    face1 = cv2.resize(face1, (100, 100))
    face2 = cv2.resize(face2, (100, 100))
    
    # Convert to grayscale
    gray1 = cv2.cvtColor(face1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(face2, cv2.COLOR_BGR2GRAY)
    
    # Calculate histograms
    hist1 = cv2.calcHist([gray1], [0], None, [256], [0, 256])
    hist2 = cv2.calcHist([gray2], [0], None, [256], [0, 256])
    
    # Normalize histograms
    hist1 = cv2.normalize(hist1, hist1).flatten()
    hist2 = cv2.normalize(hist2, hist2).flatten()
    
    # Compare histograms
    correlation = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
    
    # Convert to percentage (correlation ranges from -1 to 1)
    similarity = (correlation + 1) * 50
    
    # Determine if match (threshold 70%)
    is_match = similarity >= 70
    
    return {
        'success': True,
        'match': is_match,
        'similarity': round(similarity, 2),
        'message': f"Faces {'MATCH' if is_match else 'DO NOT MATCH'} ({similarity:.1f}% similar)"
    }

if __name__ == "__main__":
    # Check arguments
    if len(sys.argv) < 3:
        print(json.dumps({'success': False, 'message': 'Not enough arguments'}))
        sys.exit(1)
    
    # Get file paths
    img1_path = sys.argv[1]
    img2_path = sys.argv[2]
    
    # Check if files exist
    if not os.path.exists(img1_path) or not os.path.exists(img2_path):
        print(json.dumps({'success': False, 'message': 'Image files not found'}))
        sys.exit(1)
    
    # Compare faces
    result = compare_faces(img1_path, img2_path)
    
    # Output JSON
    print(json.dumps(result))