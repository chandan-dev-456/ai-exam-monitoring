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

    // Refs
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const wsRef = useRef(null);
    const violationCounts = useRef({
        fullscreen: 0,
        tabSwitch: 0,
        multipleFaces: 0
    });

    // ========== INITIAL SETUP ==========
    useEffect(() => {
        // Redirect if no session data
        if (!sessionId || !regNo) {
            navigate('/');
            return;
        }

        console.log('📝 Exam started for:', fullname, regNo);
        console.log('🔑 Session ID:', sessionId);

        // Enter fullscreen on start
        enterFullscreen();

        // Set up event listeners
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Prevent context menu (right click)
        document.addEventListener('contextmenu', preventContextMenu);
        
        // Prevent copy/paste shortcuts
        document.addEventListener('keydown', preventShortcuts);

        // Start timer
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

        // Start camera for face detection
        startCamera();

        // Start face detection loop
        startFaceDetection();

        // Cleanup
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('contextmenu', preventContextMenu);
            document.removeEventListener('keydown', preventShortcuts);
            
            // Exit fullscreen on unmount
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
            }
        } catch (error) {
            console.log('Camera access not available:', error);
            setFaceStatus('Camera unavailable');
        }
    };

    // ========== FACE DETECTION ==========
    const startFaceDetection = () => {
        // Load OpenCV.js for face detection
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.5.5/opencv.js';
        script.onload = () => {
            console.log('OpenCV loaded');
            detectFaces();
        };
        document.body.appendChild(script);
    };

    const detectFaces = () => {
        if (!examActive || !videoRef.current || !videoRef.current.srcObject) {
            setTimeout(detectFaces, 1000);
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Load face cascade classifier
            const faceCascade = new cv.CascadeClassifier();
            faceCascade.load('haarcascade_frontalface_default.xml');
            
            // Convert canvas to mat
            const src = cv.imread(canvas);
            const gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            
            // Detect faces
            const faces = new cv.RectVector();
            faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0);
            
            const faceCount = faces.size();
            
            // Check for multiple faces
            if (faceCount > 1) {
                // Multiple faces detected - violation!
                violationCounts.current.multipleFaces += 1;
                
                const newViolation = {
                    type: 'multiple_faces',
                    count: violationCounts.current.multipleFaces,
                    time: new Date().toLocaleTimeString(),
                    details: { faceCount }
                };
                
                setViolations(prev => [...prev, newViolation]);
                setFaceStatus(`⚠️ ${faceCount} faces detected!`);
                
                // Log to backend
                logViolationToBackend('multiple_faces', violationCounts.current.multipleFaces, { faceCount });
                
                // Show warning
                const remaining = 3 - violationCounts.current.multipleFaces;
                setWarning(`⚠️ Warning ${violationCounts.current.multipleFaces}/3: Multiple faces detected! ${remaining} more and exam will terminate`);
                setShowWarning(true);
                
                // Auto hide warning after 3 seconds
                setTimeout(() => setShowWarning(false), 3000);

                // Check if exceeded limit (3 violations)
                if (violationCounts.current.multipleFaces >= 3) {
                    terminateExam('Multiple faces detected too many times (3 times)');
                }
            } else if (faceCount === 1) {
                setFaceStatus('✅ One face detected');
            } else {
                setFaceStatus('❌ No face detected');
            }
            
            // Cleanup
            src.delete();
            gray.delete();
            faces.delete();
        }
        
        // Check again after 2 seconds
        setTimeout(detectFaces, 2000);
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
            // Log fullscreen exit violation
            violationCounts.current.fullscreen += 1;
            
            const newViolation = {
                type: 'fullscreen_exit',
                count: violationCounts.current.fullscreen,
                time: new Date().toLocaleTimeString()
            };
            
            setViolations(prev => [...prev, newViolation]);
            
            // Log to backend
            logViolationToBackend('fullscreen_exit', violationCounts.current.fullscreen);
            
            // Show warning
            const remaining = 5 - violationCounts.current.fullscreen;
            setWarning(`⚠️ Warning ${violationCounts.current.fullscreen}/5: Do not exit fullscreen! ${remaining} more and exam will terminate`);
            setShowWarning(true);
            
            // Auto re-enter fullscreen after 1 second
            setTimeout(() => {
                if (!document.fullscreenElement && examActive) {
                    enterFullscreen();
                }
            }, 1000);

            // Check if exceeded limit (5 violations)
            if (violationCounts.current.fullscreen >= 5) {
                terminateExam('Exited fullscreen too many times (5 times)');
            }
        }
    };

    // ========== TAB SWITCHING HANDLING ==========
    const handleVisibilityChange = () => {
        if (document.hidden && examActive) {
            // Log tab switch violation
            violationCounts.current.tabSwitch += 1;
            
            const newViolation = {
                type: 'tab_switch',
                count: violationCounts.current.tabSwitch,
                time: new Date().toLocaleTimeString()
            };
            
            setViolations(prev => [...prev, newViolation]);
            
            // Log to backend
            logViolationToBackend('tab_switch', violationCounts.current.tabSwitch);
            
            // Show warning
            const remaining = 5 - violationCounts.current.tabSwitch;
            setWarning(`⚠️ Warning ${violationCounts.current.tabSwitch}/5: Do not switch tabs! ${remaining} more and exam will terminate`);
            setShowWarning(true);

            // Check if exceeded limit (5 violations)
            if (violationCounts.current.tabSwitch >= 5) {
                terminateExam('Switched tabs too many times (5 times)');
            }
        }
    };

    // ========== PREVENT CHEATING ==========
    const preventContextMenu = (e) => {
        e.preventDefault();
        return false;
    };

    const preventShortcuts = (e) => {
        // Prevent Ctrl+C, Ctrl+V, Ctrl+P, etc.
        if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'p', 's', 'u'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            
            // Log cheating attempt
            const newViolation = {
                type: 'cheating_attempt',
                key: e.key,
                time: new Date().toLocaleTimeString()
            };
            
            setViolations(prev => [...prev, newViolation]);
            logViolationToBackend('cheating_attempt', 0, { key: e.key });
            
            setWarning(`⚠️ Copy/Paste is not allowed during exam`);
            setShowWarning(true);
            
            // Auto hide warning after 3 seconds
            setTimeout(() => setShowWarning(false), 3000);
        }
    };

    // ========== BACKEND LOGGING ==========
    const logViolationToBackend = (type, count, details = {}) => {
        // Send to your backend API
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
        
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        
        // Send termination to backend
        fetch('http://localhost:5000/api/end-exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionId,
                reason,
                violations,
                counts: violationCounts.current
            })
        }).catch(err => console.error('Failed to notify backend:', err));
        
        // Redirect after 3 seconds
        setTimeout(() => {
            navigate('/exam-results', { 
                state: { 
                    terminated: true,
                    reason,
                    violations,
                    counts: violationCounts.current,
                    regNo,
                    fullname
                } 
            });
        }, 3000);
    };

    const endExam = () => {
        setExamActive(false);
        
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        
        // Send to backend
        fetch('http://localhost:5000/api/end-exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionId, 
                violations,
                counts: violationCounts.current
            })
        }).catch(err => console.error('Failed to notify backend:', err));
        
        // Redirect
        navigate('/exam-results', { 
            state: { 
                completed: true,
                violations,
                counts: violationCounts.current,
                regNo,
                fullname
            } 
        });
    };

    // Format time
    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Auto-hide warning after 5 seconds
    useEffect(() => {
        if (showWarning) {
            const timer = setTimeout(() => setShowWarning(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [showWarning]);

    // If exam terminated
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
                                <p className="text-muted mt-3">Violations: {violations.length}</p>
                                <ul className="list-unstyled mt-3">
                                    <li>Fullscreen exits: {violationCounts.current.fullscreen}/5</li>
                                    <li>Tab switches: {violationCounts.current.tabSwitch}/5</li>
                                    <li>Multiple faces: {violationCounts.current.multipleFaces}/3</li>
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
            {/* Hidden canvas for face detection */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Header with status */}
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
                                {violationCounts.current.fullscreen + violationCounts.current.tabSwitch + violationCounts.current.multipleFaces} violations
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Warning message */}
            {showWarning && warning && (
                <div className="alert alert-warning text-center m-3 animate__animated animate__pulse">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {warning}
                </div>
            )}

            {/* Main exam content */}
            <div className="container mt-4">
                <div className="row">
                    {/* Camera feed */}
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
                                <small>
                                    <strong>Status:</strong>{' '}
                                    <span className={
                                        faceStatus.includes('✅') ? 'text-success' :
                                        faceStatus.includes('⚠️') ? 'text-warning' :
                                        faceStatus.includes('❌') ? 'text-danger' : ''
                                    }>
                                        {faceStatus}
                                    </span>
                                </small>
                            </div>
                        </div>
                        
                        {/* Violation stats */}
                        <div className="card">
                            <div className="card-header bg-warning">
                                <h6 className="mb-0">Violation Tracker</h6>
                            </div>
                            <div className="card-body p-3">
                                <div className="mb-2">
                                    <div className="d-flex justify-content-between">
                                        <span>Fullscreen exits:</span>
                                        <span className={`badge ${violationCounts.current.fullscreen >= 5 ? 'bg-danger' : 'bg-warning'}`}>
                                            {violationCounts.current.fullscreen}/5
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '5px' }}>
                                        <div 
                                            className="progress-bar bg-warning" 
                                            style={{ width: `${(violationCounts.current.fullscreen / 5) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                                
                                <div className="mb-2">
                                    <div className="d-flex justify-content-between">
                                        <span>Tab switches:</span>
                                        <span className={`badge ${violationCounts.current.tabSwitch >= 5 ? 'bg-danger' : 'bg-warning'}`}>
                                            {violationCounts.current.tabSwitch}/5
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '5px' }}>
                                        <div 
                                            className="progress-bar bg-warning" 
                                            style={{ width: `${(violationCounts.current.tabSwitch / 5) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <div className="d-flex justify-content-between">
                                        <span>Multiple faces:</span>
                                        <span className={`badge ${violationCounts.current.multipleFaces >= 3 ? 'bg-danger' : 'bg-warning'}`}>
                                            {violationCounts.current.multipleFaces}/3
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '5px' }}>
                                        <div 
                                            className="progress-bar bg-warning" 
                                            style={{ width: `${(violationCounts.current.multipleFaces / 3) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Exam questions */}
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

                    {/* Info panel */}
                    <div className="col-md-3">
                        <div className="card">
                            <div className="card-header bg-info text-white">
                                <h6 className="mb-0">Exam Info</h6>
                            </div>
                            <div className="card-body p-3">
                                <p className="small mb-1"><strong>Session:</strong> {sessionId?.substring(0, 8)}...</p>
                                <p className="small mb-1"><strong>Rules:</strong></p>
                                <ul className="small text-muted ps-3">
                                    <li>Stay in fullscreen (5 exits = termination)</li>
                                    <li>Don't switch tabs (5 switches = termination)</li>
                                    <li>Only one face allowed (3 violations = termination)</li>
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
                        
                        {/* Recent violations */}
                        {violations.length > 0 && (
                            <div className="card mt-3">
                                <div className="card-header bg-danger text-white">
                                    <h6 className="mb-0">Recent Violations</h6>
                                </div>
                                <div className="card-body p-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {violations.slice(-3).map((v, i) => (
                                        <div key={i} className="small text-danger border-bottom pb-1 mb-1">
                                            ⚠️ {v.type} at {v.time} {v.details?.faceCount ? `(${v.details.faceCount} faces)` : ''}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fullscreen overlay when not in fullscreen */}
            {!fullscreen && examActive && (
                <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex align-items-center justify-content-center" style={{ zIndex: 9999 }}>
                    <div className="bg-white p-5 rounded-3 text-center">
                        <i className="bi bi-exclamation-triangle-fill text-warning" style={{ fontSize: '4rem' }}></i>
                        <h3 className="mt-3">Fullscreen Mode Required</h3>
                        <p className="text-muted">Please click the button below to enter fullscreen</p>
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