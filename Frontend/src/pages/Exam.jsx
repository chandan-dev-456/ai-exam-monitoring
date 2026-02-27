import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Exam() {
    const location = useLocation();
    const navigate = useNavigate();
    const { sessionId, regNo, fullname } = location.state || {};

    const [timeLeft, setTimeLeft] = useState(3600); // 1 hour
    const [violations, setViolations] = useState([]);
    const [examActive, setExamActive] = useState(true);
    const [fullscreen, setFullscreen] = useState(true);
    const [warning, setWarning] = useState('');
    const [showWarning, setShowWarning] = useState(false);
    const [faceStatus, setFaceStatus] = useState('Initializing...');
    const [verificationStatus, setVerificationStatus] = useState('Verifying...');

    // Timers
    const noFaceTimerRef = useRef(null);
    const lastFaceDetectedRef = useRef(Date.now());
    
    // Store registered face encoding
    const [registeredEncoding, setRegisteredEncoding] = useState(null);

    // Refs for counts - use state for UI updates
    const [fullscreenCount, setFullscreenCount] = useState(0);
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [multipleFacesCount, setMultipleFacesCount] = useState(0);
    const [wrongPersonCount, setWrongPersonCount] = useState(0);
    const [noFaceCount, setNoFaceCount] = useState(0);

    // Track last detection time to prevent multiple counts for same event
    const lastMultipleFacesTime = useRef(0);
    const lastWrongPersonTime = useRef(0);
    const lastNoFaceTime = useRef(0);

    // Store ALL violations in localStorage
    useEffect(() => {
        const savedViolations = localStorage.getItem(`exam_violations_${sessionId}`);
        if (savedViolations) {
            const parsed = JSON.parse(savedViolations);
            setViolations(parsed);
            
            // Restore counts
            parsed.forEach(v => {
                if (v.type === 'fullscreen_exit') setFullscreenCount(v.count);
                if (v.type === 'tab_switch') setTabSwitchCount(v.count);
                if (v.type === 'multiple_faces') setMultipleFacesCount(v.count);
                if (v.type === 'no_face') setNoFaceCount(v.count);
                if (v.type === 'wrong_person') setWrongPersonCount(v.count);
            });
        }
    }, [sessionId]);

    // Save violations to localStorage
    useEffect(() => {
        if (violations.length > 0) {
            localStorage.setItem(`exam_violations_${sessionId}`, JSON.stringify(violations));
        }
    }, [violations, sessionId]);

    // Video and canvas refs
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // ========== FETCH REGISTERED FACE ENCODING ==========
    useEffect(() => {
        const fetchRegisteredEncoding = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/get-user-encoding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ regNo })
                });
                
                const data = await res.json();
                if (data.success && data.encoding) {
                    setRegisteredEncoding(data.encoding);
                    console.log('✅ Registered face encoding loaded');
                    setVerificationStatus('Ready');
                } else {
                    console.error('❌ Could not load registered face');
                    setVerificationStatus('No reference');
                }
            } catch (error) {
                console.error('❌ Error fetching registered face:', error);
                setVerificationStatus('Unavailable');
            }
        };
        
        if (regNo) {
            fetchRegisteredEncoding();
        }
    }, [regNo]);

    // ========== INITIAL SETUP ==========
    useEffect(() => {
        if (!sessionId || !regNo) {
            navigate('/');
            return;
        }

        console.log('📝 Exam started for:', fullname, regNo);
        console.log('🔑 Session ID:', sessionId);

        enterFullscreen();

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('contextmenu', preventContextMenu);
        document.addEventListener('keydown', preventShortcuts);

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    endExam();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        startCamera();
        startFaceDetection();

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('contextmenu', preventContextMenu);
            document.removeEventListener('keydown', preventShortcuts);
            
            if (noFaceTimerRef.current) {
                clearTimeout(noFaceTimerRef.current);
            }
            
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        };
    }, []);

    // ========== CAMERA SETUP ==========
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    width: 640,
                    height: 480
                },
                audio: false 
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setFaceStatus('Camera active');
                lastFaceDetectedRef.current = Date.now();
            }
        } catch (error) {
            console.log('Camera access not available:', error);
            setFaceStatus('Camera unavailable');
        }
    };

    // ========== ADD VIOLATION HELPER ==========
    const addViolation = (type, details = {}) => {
        const now = Date.now();
        
        // Update appropriate count based on type
        if (type === 'multiple_faces') {
            // Check if this is a new detection (at least 5 seconds apart)
            if (now - lastMultipleFacesTime.current < 5000) {
                return; // Skip if too soon
            }
            lastMultipleFacesTime.current = now;
            
            setMultipleFacesCount(prev => {
                const newCount = prev + 1;
                
                const newViolation = {
                    type: 'multiple_faces',
                    count: newCount,
                    time: new Date().toLocaleString(),
                    timestamp: now,
                    details
                };
                
                setViolations(prevViolations => {
                    const updated = [...prevViolations, newViolation];
                    localStorage.setItem(`exam_violations_${sessionId}`, JSON.stringify(updated));
                    logViolationToBackend('multiple_faces', newCount, details);
                    return updated;
                });
                
                // Show warning
                const remaining = 3 - newCount;
                setWarning(`⚠️ Warning ${newCount}/3: Multiple faces detected!`);
                setShowWarning(true);
                setTimeout(() => setShowWarning(false), 3000);

                // Check termination
                if (newCount >= 3) {
                    terminateExam('Multiple faces detected too many times (3 times)');
                }
                
                return newCount;
            });
            
        } else if (type === 'wrong_person') {
            // Check if this is a new detection (at least 5 seconds apart)
            if (now - lastWrongPersonTime.current < 5000) {
                return;
            }
            lastWrongPersonTime.current = now;
            
            setWrongPersonCount(prev => {
                const newCount = prev + 1;
                
                const newViolation = {
                    type: 'wrong_person',
                    count: newCount,
                    time: new Date().toLocaleString(),
                    timestamp: now,
                    details
                };
                
                setViolations(prevViolations => {
                    const updated = [...prevViolations, newViolation];
                    localStorage.setItem(`exam_violations_${sessionId}`, JSON.stringify(updated));
                    logViolationToBackend('wrong_person', newCount, details);
                    return updated;
                });
                
                const remaining = 3 - newCount;
                setWarning(`⚠️ Warning ${newCount}/3: Wrong person detected!`);
                setShowWarning(true);
                setTimeout(() => setShowWarning(false), 3000);

                if (newCount >= 3) {
                    terminateExam('Wrong person detected too many times (3 times)');
                }
                
                return newCount;
            });
        }
    };

    // ========== FACE DETECTION ==========
    const startFaceDetection = () => {
        const detectFrame = async () => {
            if (!examActive || !videoRef.current || !videoRef.current.srcObject) {
                setTimeout(detectFrame, 2000);
                return;
            }

            const video = videoRef.current;
            const canvas = canvasRef.current;
            
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const frame = canvas.toDataURL('image/jpeg', 0.5);
                
                try {
                    // First detect faces
                    const detectRes = await fetch('http://localhost:5000/api/detect-faces', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId, frame })
                    });
                    
                    const detectData = await detectRes.json();
                    
                    if (detectData.faceCount > 1) {
                        // Multiple faces detected
                        setFaceStatus(`⚠️ ${detectData.faceCount} faces`);
                        addViolation('multiple_faces', { faceCount: detectData.faceCount });
                        
                    } else if (detectData.faceCount === 1) {
                        setFaceStatus('✅ Face detected');
                        lastFaceDetectedRef.current = Date.now();
                        
                        if (noFaceTimerRef.current) {
                            clearTimeout(noFaceTimerRef.current);
                            noFaceTimerRef.current = null;
                        }
                        
                        // Verify face if we have registered encoding
                        if (registeredEncoding) {
                            try {
                                const verifyRes = await fetch('http://localhost:5000/api/verify-face', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        frame,
                                        storedEncoding: registeredEncoding
                                    })
                                });
                                
                                const verifyData = await verifyRes.json();
                                
                                if (verifyData.match) {
                                    setVerificationStatus(`✅ ${verifyData.confidence}%`);
                                } else {
                                    setVerificationStatus(`❌ ${verifyData.confidence}%`);
                                    addViolation('wrong_person', { confidence: verifyData.confidence });
                                }
                            } catch (error) {
                                console.error('Verification error:', error);
                                setVerificationStatus('Error');
                            }
                        }
                        
                    } else {
                        // No face
                        setFaceStatus('❌ No face');
                        
                        if (!noFaceTimerRef.current) {
                            noFaceTimerRef.current = setTimeout(() => {
                                if (examActive) {
                                    terminateExam('No face detected for 10 seconds');
                                }
                            }, 10000);
                        }
                    }
                    
                } catch (error) {
                    console.error('Face detection error:', error);
                }
            }
            
            setTimeout(detectFrame, 2000);
        };
        
        setTimeout(detectFrame, 3000);
    };

    // ========== FULLSCREEN HANDLING ==========
    const enterFullscreen = () => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => {
                console.log('Fullscreen error:', err);
            });
        }
    };

    const handleFullscreenChange = () => {
        const isFullscreen = !!document.fullscreenElement;
        setFullscreen(isFullscreen);

        if (!isFullscreen && examActive) {
            setFullscreenCount(prev => {
                const newCount = prev + 1;
                
                const newViolation = {
                    type: 'fullscreen_exit',
                    count: newCount,
                    time: new Date().toLocaleString(),
                    timestamp: Date.now()
                };
                
                setViolations(prevViolations => {
                    const updated = [...prevViolations, newViolation];
                    localStorage.setItem(`exam_violations_${sessionId}`, JSON.stringify(updated));
                    logViolationToBackend('fullscreen_exit', newCount);
                    return updated;
                });
                
                const remaining = 5 - newCount;
                setWarning(`⚠️ Warning ${newCount}/5: Do not exit fullscreen!`);
                setShowWarning(true);
                
                setTimeout(() => {
                    if (!document.fullscreenElement && examActive) {
                        enterFullscreen();
                    }
                }, 1000);

                if (newCount >= 5) {
                    terminateExam('Exited fullscreen too many times (5 times)');
                }
                
                return newCount;
            });
        }
    };

    // ========== TAB SWITCHING ==========
    const handleVisibilityChange = () => {
        if (document.hidden && examActive) {
            setTabSwitchCount(prev => {
                const newCount = prev + 1;
                
                const newViolation = {
                    type: 'tab_switch',
                    count: newCount,
                    time: new Date().toLocaleString(),
                    timestamp: Date.now()
                };
                
                setViolations(prevViolations => {
                    const updated = [...prevViolations, newViolation];
                    localStorage.setItem(`exam_violations_${sessionId}`, JSON.stringify(updated));
                    logViolationToBackend('tab_switch', newCount);
                    return updated;
                });
                
                const remaining = 5 - newCount;
                setWarning(`⚠️ Warning ${newCount}/5: Do not switch tabs!`);
                setShowWarning(true);

                if (newCount >= 5) {
                    terminateExam('Switched tabs too many times (5 times)');
                }
                
                return newCount;
            });
        }
    };

    // ========== PREVENT CHEATING ==========
    const preventContextMenu = (e) => e.preventDefault();
    
    const preventShortcuts = (e) => {
        if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'p', 's', 'u'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            
            const newViolation = {
                type: 'cheating_attempt',
                key: e.key,
                time: new Date().toLocaleString(),
                timestamp: Date.now()
            };
            
            setViolations(prev => {
                const updated = [...prev, newViolation];
                localStorage.setItem(`exam_violations_${sessionId}`, JSON.stringify(updated));
                logViolationToBackend('cheating_attempt', 0, { key: e.key });
                return updated;
            });
            
            setWarning('⚠️ Copy/Paste is not allowed');
            setShowWarning(true);
            setTimeout(() => setShowWarning(false), 3000);
        }
    };

    // ========== BACKEND LOGGING ==========
    const logViolationToBackend = (type, count, details = {}) => {
        fetch('http://localhost:5000/api/log-violation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                type,
                count,
                details,
                timestamp: new Date().toISOString()
            })
        }).catch(err => console.error('Failed to log violation:', err));
    };

    // ========== EXAM CONTROL ==========
    const terminateExam = (reason) => {
        setExamActive(false);
        setWarning(`❌ Exam Terminated: ${reason}`);
        
        if (noFaceTimerRef.current) {
            clearTimeout(noFaceTimerRef.current);
        }
        
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        
        fetch('http://localhost:5000/api/end-exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionId,
                reason,
                violations
            })
        }).catch(err => console.error('Failed to notify backend:', err));
        
        setTimeout(() => {
            navigate('/exam-results', { 
                state: { 
                    terminated: true,
                    reason,
                    violations,
                    counts: {
                        fullscreen: fullscreenCount,
                        tabSwitch: tabSwitchCount,
                        multipleFaces: multipleFacesCount,
                        wrongPerson: wrongPersonCount
                    },
                    regNo,
                    fullname
                } 
            });
        }, 3000);
    };

    const endExam = () => {
        setExamActive(false);
        
        if (noFaceTimerRef.current) {
            clearTimeout(noFaceTimerRef.current);
        }
        
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        
        fetch('http://localhost:5000/api/end-exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionId, 
                violations
            })
        }).catch(err => console.error('Failed to notify backend:', err));
        
        navigate('/exam-results', { 
            state: { 
                completed: true,
                violations,
                counts: {
                    fullscreen: fullscreenCount,
                    tabSwitch: tabSwitchCount,
                    multipleFaces: multipleFacesCount,
                    wrongPerson: wrongPersonCount
                },
                regNo,
                fullname
            } 
        });
    };

    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (showWarning) {
            const timer = setTimeout(() => setShowWarning(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [showWarning]);

    if (!examActive) {
        return (
            <div className="container mt-5">
                <div className="row justify-content-center">
                    <div className="col-md-6">
                        <div className="card border-danger shadow">
                            <div className="card-header bg-danger text-white">
                                <h4 className="mb-0">⚠️ Exam Terminated</h4>
                            </div>
                            <div className="card-body text-center p-5">
                                <i className="bi bi-exclamation-triangle-fill text-danger" style={{ fontSize: '5rem' }}></i>
                                <h5 className="mt-4">{warning}</h5>
                                <p className="text-muted mt-3">Total Violations: {violations.length}</p>
                                <ul className="list-unstyled mt-3">
                                    <li>Fullscreen exits: {fullscreenCount}/5</li>
                                    <li>Tab switches: {tabSwitchCount}/5</li>
                                    <li>Multiple faces: {multipleFacesCount}/3</li>
                                    <li>Wrong person: {wrongPersonCount}/3</li>
                                </ul>
                                <div className="spinner-border text-danger mt-4"></div>
                                <p className="mt-2">Redirecting to results...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-vh-100 bg-light">
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div className={`${fullscreen ? 'bg-dark' : 'bg-danger'} text-white py-3 px-4 sticky-top`}>
                <div className="container-fluid">
                    <div className="row align-items-center">
                        <div className="col-md-3">
                            <h5 className="mb-0">
                                <i className="bi bi-person-circle me-2"></i>
                                {fullname} ({regNo})
                            </h5>
                        </div>
                        <div className="col-md-2 text-center">
                            <h4 className="mb-0">
                                <i className="bi bi-clock me-2"></i>
                                {formatTime(timeLeft)}
                            </h4>
                        </div>
                        <div className="col-md-4 text-center">
                            {!fullscreen && (
                                <span className="badge bg-warning text-dark p-2">
                                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                    NOT IN FULLSCREEN!
                                </span>
                            )}
                            {fullscreen && (
                                <span className="badge bg-success p-2">
                                    <i className="bi bi-check-circle-fill me-1"></i>
                                    Fullscreen Mode
                                </span>
                            )}
                        </div>
                        <div className="col-md-3 text-end">
                            <span className="text-white-50">
                                <i className="bi bi-exclamation-triangle me-1"></i>
                                Violations: {violations.length}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {showWarning && warning && (
                <div className="alert alert-warning text-center m-3">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {warning}
                </div>
            )}

            <div className="container mt-4">
                <div className="row">
                    <div className="col-md-3">
                        <div className="card mb-3">
                            <div className="card-header bg-secondary text-white py-2">
                                <small>Proctoring Camera</small>
                            </div>
                            <div className="card-body p-1 bg-dark">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-100"
                                    style={{ 
                                        transform: 'scaleX(-1)',
                                        height: '150px',
                                        objectFit: 'cover'
                                    }}
                                />
                            </div>
                            <div className="card-footer p-2">
                                <div className="d-flex justify-content-between">
                                    <small><strong>Face:</strong> {faceStatus}</small>
                                    <small><strong>ID:</strong> {verificationStatus}</small>
                                </div>
                            </div>
                        </div>
                        
                        <div className="card">
                            <div className="card-header bg-warning">
                                <h6 className="mb-0">Violation Tracker</h6>
                            </div>
                            <div className="card-body p-3">
                                <div className="mb-2">
                                    <div className="d-flex justify-content-between">
                                        <span>Fullscreen exits:</span>
                                        <span className={`badge ${fullscreenCount >= 5 ? 'bg-danger' : 'bg-warning'}`}>
                                            {fullscreenCount}/5
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '5px' }}>
                                        <div className="progress-bar bg-warning" style={{ width: `${(fullscreenCount / 5) * 100}%` }}></div>
                                    </div>
                                </div>
                                
                                <div className="mb-2">
                                    <div className="d-flex justify-content-between">
                                        <span>Tab switches:</span>
                                        <span className={`badge ${tabSwitchCount >= 5 ? 'bg-danger' : 'bg-warning'}`}>
                                            {tabSwitchCount}/5
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '5px' }}>
                                        <div className="progress-bar bg-warning" style={{ width: `${(tabSwitchCount / 5) * 100}%` }}></div>
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <div className="d-flex justify-content-between">
                                        <span>Multiple faces:</span>
                                        <span className={`badge ${multipleFacesCount >= 3 ? 'bg-danger' : 'bg-warning'}`}>
                                            {multipleFacesCount}/3
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '5px' }}>
                                        <div className="progress-bar bg-warning" style={{ width: `${(multipleFacesCount / 3) * 100}%` }}></div>
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <div className="d-flex justify-content-between">
                                        <span>Wrong person:</span>
                                        <span className={`badge ${wrongPersonCount >= 3 ? 'bg-danger' : 'bg-warning'}`}>
                                            {wrongPersonCount}/3
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '5px' }}>
                                        <div className="progress-bar bg-warning" style={{ width: `${(wrongPersonCount / 3) * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-header bg-primary text-white">
                                <h5 className="mb-0">Exam Questions</h5>
                            </div>
                            <div className="card-body">
                                <div className="mb-4">
                                    <h6>1. What is React?</h6>
                                    <div className="form-check">
                                        <input className="form-check-input" type="radio" name="q1" id="q1a" />
                                        <label className="form-check-label" htmlFor="q1a">A JavaScript library for building UIs</label>
                                    </div>
                                    <div className="form-check">
                                        <input className="form-check-input" type="radio" name="q1" id="q1b" />
                                        <label className="form-check-label" htmlFor="q1b">A programming language</label>
                                    </div>
                                </div>
                                
                                <div className="mb-4">
                                    <h6>2. What is useState?</h6>
                                    <div className="form-check">
                                        <input className="form-check-input" type="radio" name="q2" id="q2a" />
                                        <label className="form-check-label" htmlFor="q2a">A hook for state management</label>
                                    </div>
                                    <div className="form-check">
                                        <input className="form-check-input" type="radio" name="q2" id="q2b" />
                                        <label className="form-check-label" htmlFor="q2b">A routing library</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-3">
                        <div className="card">
                            <div className="card-header bg-info text-white">
                                <h6 className="mb-0">Exam Info</h6>
                            </div>
                            <div className="card-body p-3">
                                <p className="small mb-1"><strong>Session:</strong> {sessionId?.substring(0, 8)}...</p>
                                <p className="small mb-1"><strong>Rules:</strong></p>
                                <ul className="small text-muted ps-3">
                                    <li>Fullscreen: 5 exits = termination</li>
                                    <li>Tab switch: 5 switches = termination</li>
                                    <li>Multiple faces: 3 counts = termination</li>
                                    <li>Wrong person: 3 counts = termination</li>
                                    <li>No face: 10 seconds = termination</li>
                                </ul>
                                
                                <button 
                                    className="btn btn-outline-danger w-100 mt-3"
                                    onClick={endExam}
                                >
                                    <i className="bi bi-stop-circle me-2"></i>
                                    End Exam
                                </button>
                            </div>
                        </div>
                        
                        {violations.length > 0 && (
                            <div className="card mt-3">
                                <div className="card-header bg-danger text-white">
                                    <h6 className="mb-0">Violation History ({violations.length})</h6>
                                </div>
                                <div className="card-body p-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {violations.slice(-5).map((v, i) => (
                                        <div key={i} className="small text-danger border-bottom pb-1 mb-1">
                                            ⚠️ {v.type} {v.details?.faceCount ? `(${v.details.faceCount} faces)` : ''}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!fullscreen && examActive && (
                <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex align-items-center justify-content-center" style={{ zIndex: 9999 }}>
                    <div className="bg-white p-5 rounded-3 text-center">
                        <i className="bi bi-exclamation-triangle-fill text-warning" style={{ fontSize: '4rem' }}></i>
                        <h3 className="mt-3">Fullscreen Mode Required</h3>
                        <p className="text-muted">Please click the button below to enter fullscreen</p>
                        <p className="text-danger">Warning: {fullscreenCount}/5 exits</p>
                        <button className="btn btn-primary btn-lg mt-3" onClick={enterFullscreen}>
                            <i className="bi bi-arrows-fullscreen me-2"></i>
                            Enter Fullscreen
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}