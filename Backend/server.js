const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();

// 👇 FIXED CORS - Allow all origins
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));



const server = app.listen(5000, '0.0.0.0', () => {
    console.log('✅ Backend running on http://localhost:5000');
    console.log('📡 Server listening on all interfaces');
});

// Log violation
app.post('/api/log-violation', (req, res) => {
    const { sessionId, type, count, details, timestamp } = req.body;
    console.log(`📝 Violation [${sessionId}]: ${type} (${count})`, details);
    res.json({ success: true });
});

// ==================== FACE COMPARISON API ====================
app.post('/api/compare-faces', async (req, res) => {
    const { capturedPhoto, uploadedPhoto } = req.body;
    
    console.log('📸 Received comparison request');
    
    if (!capturedPhoto || !uploadedPhoto) {
        return res.status(400).json({
            success: false,
            message: 'Both photos are required'
        });
    }
    
    try {
        // Call Python script
        const pythonScript = path.join(__dirname, '../ai_module/face_utils.py');
        
        // 👇 Check if Python script exists
        const fs = require('fs');
        if (!fs.existsSync(pythonScript)) {
            console.error('❌ Python script not found:', pythonScript);
            return res.status(500).json({
                success: false,
                message: 'Python script not found'
            });
        }
        
        const pythonProcess = spawn('python', [pythonScript]);
        
        let result = '';
        let error = '';
        
        // Send data to Python
        const inputData = JSON.stringify({ 
            task: 'compare',
            photo1: capturedPhoto,
            photo2: uploadedPhoto 
        });
        
        pythonProcess.stdin.write(inputData + '\n');
        pythonProcess.stdin.end();
        
        // Get result from Python
        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
            console.error('🐍 Python error:', data.toString());
        });
        
        pythonProcess.on('close', (code) => {
            console.log('🔚 Python process closed with code:', code);
            
            if (code !== 0) {
                return res.json({  // 👈 Send 200 even on error, with error message
                    success: false,
                    message: 'Face comparison failed',
                    error: error,
                    match_percentage: 0
                });
            }
            
            try {
                const matchResult = JSON.parse(result);
                console.log('✅ Python result:', matchResult);
                
                // 70% threshold
                if (matchResult.match_percentage >= 70) {
                    res.json({
                        success: true,
                        match: true,
                        match_percentage: matchResult.match_percentage,
                        message: `✅ Face match: ${matchResult.match_percentage}%`
                    });
                } else {
                    res.json({
                        success: true,
                        match: false,
                        match_percentage: matchResult.match_percentage,
                        message: `❌ Face match too low: ${matchResult.match_percentage}% (need 70%)`
                    });
                }
            } catch (e) {
                console.error('❌ Parse error:', e);
                res.json({
                    success: false,
                    message: 'Invalid response from Python',
                    match_percentage: 0
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// ==================== REGISTER FACE ====================
app.post('/api/register-face', (req, res) => {
    const { fullname, regNo } = req.body;
    console.log(`📝 Registering: ${fullname} (${regNo})`);
    
    res.json({
        success: true,
        message: `✅ ${fullname} registered successfully`
    });
});

// ==================== START EXAM ====================
app.post('/api/start-exam', (req, res) => {
    const { regNo } = req.body;
    const sessionId = 'exam_' + Date.now();
    
    console.log(`🎯 Starting exam for: ${regNo}, Session: ${sessionId}`);
    
    res.json({
        success: true,
        sessionId: sessionId,
        message: '✅ Exam started'
    });
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// 👇 Add a test endpoint
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Test endpoint works!' });
});

console.log('🚀 Server ready!');
console.log('📡 Endpoints:');
console.log('   - GET  /api/health');
console.log('   - GET  /api/test');
console.log('   - POST /api/compare-faces');
console.log('   - POST /api/register-face');
console.log('   - POST /api/start-exam');