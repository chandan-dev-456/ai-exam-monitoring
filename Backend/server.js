const express = require('express');
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

const app = express();

// Middleware
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Path to Python script
const PYTHON_SCRIPT_PATH = path.join(__dirname, '../ai_module/face_match.py');
// Create temp directory for images
const TEMP_DIR = path.join(os.tmpdir(), 'face_comparison');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

console.log('Temp directory:', TEMP_DIR);
console.log('Python script path:', PYTHON_SCRIPT_PATH);
console.log('Script exists:', fs.existsSync(PYTHON_SCRIPT_PATH));

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Server is running',
        pythonScript: {
            path: PYTHON_SCRIPT_PATH,
            exists: fs.existsSync(PYTHON_SCRIPT_PATH)
        }
    });
});

function saveBase64ToFile(base64String, prefix) {
    try {
        // Remove header if present
        if (base64String.includes(',')) {
            base64String = base64String.split(',')[1];
        }
        
        // Generate unique filename
        const filename = path.join(TEMP_DIR, `${prefix}_${Date.now()}.jpg`);
        
        // Convert base64 to buffer and save
        const buffer = Buffer.from(base64String, 'base64');
        fs.writeFileSync(filename, buffer);
        
        return filename;
    } catch (error) {
        console.error('Error saving file:', error);
        return null;
    }
}

// Main endpoint
app.post('/api/register-face', async (req, res) => {
    console.log('Received request to /api/register-face');
    
    const { fullname, registrationNo, capturedPhoto, uploadedPhoto } = req.body;
    
    console.log('Form data:', { fullname, registrationNo });

    if (!capturedPhoto || !uploadedPhoto) {
        return res.json({
            success: false,
            message: 'Missing photos'
        });
    }

    try {
        // Save images to temporary files
        console.log('Saving images to temp files...');
        const capturedPath = saveBase64ToFile(capturedPhoto, 'captured');
        const uploadedPath = saveBase64ToFile(uploadedPhoto, 'uploaded');

        if (!capturedPath || !uploadedPath) {
            return res.json({
                success: false,
                message: 'Failed to save images'
            });
        }

        console.log('Saved:', capturedPath);
        console.log('Saved:', uploadedPath);

        // Call Python script with file paths
        const python = spawn('python', [PYTHON_SCRIPT_PATH, capturedPath, uploadedPath]);
        
        let result = '';
        let error = '';

        python.stdout.on('data', (data) => {
            result += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
            console.error('Python error:', data.toString());
        });

        python.on('close', (code) => {
            console.log(`Python process exited with code ${code}`);
            
            // Clean up temp files
            try {
                fs.unlinkSync(capturedPath);
                fs.unlinkSync(uploadedPath);
                console.log('Temp files cleaned up');
            } catch (cleanError) {
                console.error('Error cleaning temp files:', cleanError);
            }
            
            if (code !== 0) {
                return res.json({ 
                    success: false, 
                    message: 'Error in face comparison',
                    error: error 
                });
            }

            try {
                const faceResult = JSON.parse(result.trim());
                console.log('Face comparison result:', faceResult);
                
                faceResult.userData = { fullname, registrationNo };
                res.json(faceResult);
            } catch (e) {
                console.error('Parse error:', e);
                res.json({ 
                    success: false, 
                    message: 'Invalid response from Python',
                    raw: result 
                });
            }
        });

    } catch (error) {
        console.error('Server error:', error);
        res.json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});