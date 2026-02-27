import sys
import json
from face_utils import FaceComparer

comparer = FaceComparer()

for line in sys.stdin:
    try:
        data = json.loads(line)
        
        if data.get('action') == 'compare_faces':
            percentage = comparer.compare(
                data.get('data', {}).get('photo1'),
                data.get('data', {}).get('photo2')
            )
            
            result = {
                'success': True,
                'match_percentage': percentage,
                'message': f'Face match: {percentage}%'
            }
            print(json.dumps(result))
            sys.stdout.flush()
            
    except Exception as e:
        print(json.dumps({'success': False, 'message': str(e)}))
        sys.stdout.flush()