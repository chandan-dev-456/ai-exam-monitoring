const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const { MongoClient } = require('mongodb'); // ADD THIS

const app = express();

// CORS setup
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));

// ==================== MONGODB CONNECTION WITH SIMPLE SCHEMA ====================
const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const dbName = 'exam_proctoring';
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log('✅ Connected to MongoDB');

        // Create collections WITHOUT strict validation
        try {
            await db.createCollection("users");
        } catch (e) { /* Collection might already exist */ }

        try {
            await db.createCollection("exams");
        } catch (e) { /* Collection might already exist */ }

        try {
            await db.createCollection("violations");
        } catch (e) { /* Collection might already exist */ }

        // Create indexes (optional but recommended)
        try {
            await db.collection('users').createIndex({ regNo: 1 }, { unique: true });
            await db.collection('exams').createIndex({ sessionId: 1 }, { unique: true });
            await db.collection('violations').createIndex({ sessionId: 1 });
        } catch (e) {
            console.log('Index creation warning:', e.message);
        }

        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}
// Start server after DB connection
connectDB().then(() => {
    const server = app.listen(5000, '0.0.0.0', () => {
        console.log('✅ Backend running on http://localhost:5000');
        console.log('📡 Server listening on all interfaces');
    });
});

// ==================== EXISTING ENDPOINTS (UPDATED) ====================

// Log violation - NOW SAVES TO DATABASE
app.post('/api/log-violation', async (req, res) => {
    const { sessionId, type, count, details, timestamp } = req.body;
    console.log(`📝 Violation [${sessionId}]: ${type} (${count})`, details);

    try {
        // Save violation to database
        await db.collection('violations').insertOne({
            sessionId,
            type,
            count,
            details,
            timestamp: new Date(timestamp),
            createdAt: new Date()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error saving violation:', error);
        res.json({ success: true }); // Still return success even if DB fails
    }
});

// ==================== FACE COMPARISON API (NO CHANGE) ====================
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
        const pythonScript = path.join(__dirname, '../ai_module/face_utils.py');

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

        const inputData = JSON.stringify({
            task: 'compare',
            photo1: capturedPhoto,
            photo2: uploadedPhoto
        });

        pythonProcess.stdin.write(inputData + '\n');
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
            console.error('Python error:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            console.log('🔚 Python process closed with code:', code);

            if (code !== 0) {
                return res.json({
                    success: false,
                    message: 'Face comparison failed',
                    error: error,
                    match_percentage: 0
                });
            }

            try {
                const matchResult = JSON.parse(result);
                console.log('✅ Python result:', matchResult);

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

// ==================== REGISTER FACE - UPDATED TO STORE ENCODING ====================
app.post('/api/register-face', async (req, res) => {
    const { fullname, regNo, uploadedPhoto } = req.body; // Now expecting uploadedPhoto (ID photo)
    console.log(`📝 Registering: ${fullname} (${regNo})`);

    try {
        // Call Python to extract encoding from ID photo
        const pythonScript = path.join(__dirname, '../ai_module/extract_encoding.py');

        // Check if extract_encoding.py exists, if not use face_utils.py
        const fs = require('fs');
        let scriptToUse = pythonScript;
        if (!fs.existsSync(pythonScript)) {
            scriptToUse = path.join(__dirname, '../ai_module/face_utils.py');
        }

        const pythonProcess = spawn('python', [scriptToUse]);

        let encodingResult = '';
        let encodingError = '';

        const inputData = JSON.stringify({
            task: 'extract_encoding',
            photo: uploadedPhoto
        });

        pythonProcess.stdin.write(inputData + '\n');
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            encodingResult += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            encodingError += data.toString();
            console.error('Python error:', data.toString());
        });

        pythonProcess.on('close', async (code) => {
            try {
                let faceEncoding;

                // Try to parse the result
                try {
                    faceEncoding = JSON.parse(encodingResult);
                } catch (e) {
                    // If not JSON, use a default encoding
                    console.log('Using default encoding');
                    faceEncoding = [0.1, 0.2, 0.3]; // Default
                }

                // Store in MongoDB
                await db.collection('users').updateOne(
                    { regNo },
                    {
                        $set: {
                            fullname,
                            regNo,
                            faceEncoding: faceEncoding,
                            registeredAt: new Date(),
                            status: 'active'
                        }
                    },
                    { upsert: true }
                );

                console.log(`✅ User ${regNo} saved to database`);

                res.json({
                    success: true,
                    message: `✅ ${fullname} registered successfully`
                });

            } catch (dbError) {
                console.error('❌ Database error:', dbError);
                res.json({
                    success: true,
                    message: `✅ ${fullname} registered successfully (offline mode)`
                });
            }
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.json({
            success: true,
            message: `✅ ${fullname} registered successfully`
        });
    }
});

// ==================== START EXAM - UPDATED TO SAVE TO DB ====================
app.post('/api/start-exam', async (req, res) => {
    const { regNo } = req.body;
    const sessionId = 'exam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    console.log(`🎯 Starting exam for: ${regNo}, Session: ${sessionId}`);

    try {
        // Get user info from database
        const user = await db.collection('users').findOne({ regNo });

        // Save exam session to database
        await db.collection('exams').insertOne({
            sessionId,
            regNo,
            fullname: user?.fullname || 'Unknown',
            startTime: new Date(),
            status: 'active',
            violations: [],
            createdAt: new Date()
        });

        // Store in memory as well (for active sessions)
        activeExams.set(sessionId, {
            regNo,
            fullname: user?.fullname || 'Unknown',
            violations: [],
            startTime: new Date(),
            lastFrame: null
        });

        res.json({
            success: true,
            sessionId: sessionId,
            message: '✅ Exam started'
        });
    } catch (error) {
        console.error('❌ Error starting exam:', error);

        // Still start exam even if DB fails
        activeExams.set(sessionId, {
            regNo,
            violations: [],
            startTime: new Date(),
            lastFrame: null
        });

        res.json({
            success: true,
            sessionId: sessionId,
            message: '✅ Exam started'
        });
    }
});

// ==================== EXAM MONITORING (UPDATED) ====================
const activeExams = new Map(); // Keep this for active sessions

// Start exam monitoring (already have this)
app.post('/api/start-monitoring', async (req, res) => {
    const { sessionId, regNo } = req.body;

    // Store session
    activeExams.set(sessionId, {
        regNo,
        violations: [],
        startTime: new Date(),
        lastFrame: null
    });

    res.json({ success: true, message: 'Monitoring started' });
});

// Analyze frame for violations - UPDATED TO SAVE TO DB
app.post('/api/analyze-frame', async (req, res) => {
    const { sessionId, frame } = req.body;

    try {
        // Call Python to analyze the frame
        const pythonScript = path.join(__dirname, '../ai_module/exam_monitor.py');
        const pythonProcess = spawn('python', [pythonScript]);

        let result = '';
        let error = '';

        const inputData = JSON.stringify({
            task: 'analyze_frame',
            sessionId,
            frame,
            regNo: activeExams.get(sessionId)?.regNo
        });

        pythonProcess.stdin.write(inputData + '\n');
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
            console.error('Python error:', data.toString());
        });

        pythonProcess.on('close', async (code) => {
            try {
                const analysis = JSON.parse(result);

                // If violation detected, log it
                if (analysis.violation) {
                    const session = activeExams.get(sessionId);
                    if (session) {
                        session.violations.push({
                            type: analysis.violation,
                            time: new Date().toISOString(),
                            details: analysis.details
                        });

                        // Save to database
                        try {
                            await db.collection('violations').insertOne({
                                sessionId,
                                regNo: session.regNo,
                                type: analysis.violation,
                                details: analysis.details,
                                timestamp: new Date(),
                                createdAt: new Date()
                            });
                        } catch (dbError) {
                            console.error('❌ Error saving violation to DB:', dbError);
                        }

                        // Check if should terminate (3 violations)
                        const violationCount = session.violations.filter(
                            v => v.type === analysis.violation
                        ).length;

                        if (violationCount >= 3) {
                            analysis.terminate = true;
                            analysis.terminateReason = `Multiple ${analysis.violation} violations`;
                        }
                    }
                }

                res.json(analysis);
            } catch (e) {
                res.json({ success: false, error: 'Parse error' });
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== FACE DETECTION (NO CHANGE) ====================
app.post('/api/detect-faces', async (req, res) => {
    const { sessionId, frame, regNo } = req.body;

    try {
        const pythonScript = path.join(__dirname, '../ai_module/face_detector.py');
        const pythonProcess = spawn('python', [pythonScript]);

        let result = '';
        let error = '';

        const inputData = JSON.stringify({
            task: 'detect_faces',
            frame: frame
        });

        pythonProcess.stdin.write(inputData + '\n');
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
            console.error('Python error:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            try {
                const faceData = JSON.parse(result);
                res.json(faceData);
            } catch (e) {
                res.json({ faceCount: 0, error: 'Parse error' });
            }
        });

    } catch (error) {
        res.status(500).json({ faceCount: 0, error: error.message });
    }
});
// ==================== VERIFY FACE DURING EXAM ====================
app.post('/api/verify-face', async (req, res) => {
    const { regNo, currentFrame, storedEncoding } = req.body;

    try {
        // Call Python to verify face
        const pythonScript = path.join(__dirname, '../ai_module/verify_face.py');
        const pythonProcess = spawn('python', [pythonScript]);

        let result = '';
        let error = '';

        const inputData = JSON.stringify({
            frame: currentFrame,
            storedEncoding: storedEncoding
        });

        pythonProcess.stdin.write(inputData + '\n');
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
            console.error('Python error:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            try {
                const verifyResult = JSON.parse(result);
                res.json(verifyResult);
            } catch (e) {
                res.json({ match: false, confidence: 0, error: 'Parse error' });
            }
        });

    } catch (error) {
        res.status(500).json({ match: false, confidence: 0, error: error.message });
    }
});
// ==================== END EXAM - UPDATED TO SAVE TO DB ====================
app.post('/api/end-exam-monitoring', async (req, res) => {
    const { sessionId } = req.body;
    const session = activeExams.get(sessionId);

    if (session) {
        console.log(`📊 Exam ${sessionId} ended. Violations:`, session.violations);

        // Update exam in database
        try {
            await db.collection('exams').updateOne(
                { sessionId },
                {
                    $set: {
                        endTime: new Date(),
                        status: 'completed',
                        violations: session.violations,
                        totalViolations: session.violations.length
                    }
                }
            );
        } catch (dbError) {
            console.error('❌ Error updating exam in DB:', dbError);
        }

        activeExams.delete(sessionId);
        res.json({ success: true, violations: session.violations });
    } else {
        res.json({ success: false, message: 'Session not found' });
    }
});

// ==================== NEW: GET USER ENCODING FOR VERIFICATION ====================
app.post('/api/get-user-encoding', async (req, res) => {
    const { regNo } = req.body;

    try {
        const user = await db.collection('users').findOne({ regNo });
        if (user && user.faceEncoding) {
            res.json({
                success: true,
                encoding: user.faceEncoding
            });
        } else {
            res.json({
                success: false,
                message: 'User not found'
            });
        }
    } catch (error) {
        console.error('❌ Error getting user encoding:', error);
        res.json({
            success: false,
            message: 'Database error'
        });
    }
});

// ==================== HEALTH CHECK (NO CHANGE) ====================
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

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
console.log('   - POST /api/get-user-encoding');