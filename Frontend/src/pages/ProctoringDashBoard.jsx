// ProctoringDashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { 
  Camera, 
  AlertTriangle, 
  User, 
  Volume2, 
  Globe, 
  Activity,
  XCircle,
  Maximize2,
  Lock,
  LogOut,
  Shield,
  Move,
  Mic,
  Eye
} from 'react-feather';
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Alert,
  ProgressBar,
  ListGroup,
  Button,
  Modal
} from 'react-bootstrap';

const ProctoringDashboard = () => {
  // State management
  const [faceDetected, setFaceDetected] = useState(true);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const [headMovement, setHeadMovement] = useState('normal');
  const [browserFocus, setBrowserFocus] = useState(true);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [violationScore, setViolationScore] = useState(0);
  const [violations, setViolations] = useState([]);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [examCompleted, setExamCompleted] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showFullScreenWarning, setShowFullScreenWarning] = useState(false);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const containerRef = useRef(null);
  const violationTimeoutsRef = useRef({});
  const lastDetectionRef = useRef({
    face: true,
    multipleFaces: false,
    voice: false,
    headPosition: { x: 0, y: 0 },
    headMovement: 'normal'
  });

  // Initialize monitoring when exam starts
  useEffect(() => {
    if (examStarted) {
      initializeMonitoring();
      enterFullScreen();
    }
    return () => {
      cleanup();
    };
  }, [examStarted]);

  const cleanup = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  // Full screen management
  const enterFullScreen = async () => {
    try {
      const element = containerRef.current;
      if (element.requestFullscreen && !document.fullscreenElement) {
        await element.requestFullscreen();
        setFullScreenMode(true);
        setShowFullScreenWarning(false);
      }
    } catch (error) {
      console.error('Full screen error:', error);
      addViolation('fullscreen', 'Failed to enter full screen mode', 1);
    }
  };

  // Handle full screen change
  useEffect(() => {
    const handleFullScreenChange = () => {
      const isFullScreen = !!document.fullscreenElement;
      setFullScreenMode(isFullScreen);
      
      if (!isFullScreen && examStarted && !examCompleted) {
        setShowFullScreenWarning(true);
        addViolation('fullscreen', 'Exited full screen mode', 2);
        
        // Auto re-enter full screen after 3 seconds
        setTimeout(() => {
          if (!document.fullscreenElement && examStarted && !examCompleted) {
            enterFullScreen();
          }
        }, 3000);
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, [examStarted, examCompleted]);

  // Tab switching prevention
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && examStarted && !examCompleted) {
        setTabSwitches(prev => {
          const newCount = prev + 1;
          addViolation('tab_switch', `Tab switch detected (${newCount}/3)`, 2);
          
          if (newCount >= 3) {
            setShowTerminateModal(true);
            setExamStarted(false);
          }
          
          return newCount;
        });
      }
    };

    const handleBlur = () => {
      if (examStarted && !examCompleted) {
        setBrowserFocus(false);
      }
    };

    const handleFocus = () => {
      if (examStarted && !examCompleted) {
        setBrowserFocus(true);
      }
    };

    // Prevent keyboard shortcuts
    const handleKeyDown = (e) => {
      if (examStarted && !examCompleted) {
        if (
          (e.altKey && e.key === 'Tab') ||
          (e.ctrlKey && e.key === 'Tab') ||
          (e.altKey && e.key === 'F4') ||
          (e.key === 'Escape') ||
          (e.ctrlKey && e.key === 'w') ||
          (e.ctrlKey && e.key === 'W')
        ) {
          e.preventDefault();
          addViolation('keyboard', 'Forbidden keyboard shortcut attempted', 1);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [examStarted, examCompleted]);

  const initializeMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }, 
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        mediaStreamRef.current = stream;
      }

      // Initialize audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Start detection
      startDetection();
      
    } catch (error) {
      console.error('Error accessing media devices:', error);
      addViolation('error', 'Failed to access camera or microphone', 3);
    }
  };

  const startDetection = () => {
    const detect = async () => {
      await detectFacesAndHead();
      detectVoice();
      animationFrameRef.current = requestAnimationFrame(detect);
    };
    detect();
  };

  // Face and head movement detection
  const detectFacesAndHead = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data for analysis
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Face detection using skin tone and facial features
    let skinPixels = 0;
    let totalPixels = canvas.width * canvas.height;
    let faceCenter = { x: 0, y: 0 };
    let facePixels = [];
    
    for (let y = 0; y < canvas.height; y += 2) { // Sample every 2 pixels for performance
      for (let x = 0; x < canvas.width; x += 2) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Improved skin color detection
        if (r > 60 && g > 40 && b > 20 && 
            r > g && r > b && 
            Math.abs(r - g) > 15 &&
            r - g < 50 && // Additional skin tone constraints
            g - b < 30) {
          skinPixels++;
          facePixels.push({ x, y });
        }
      }
    }
    
    const skinPercentage = (skinPixels / (totalPixels / 4)) * 100;
    const hasFace = skinPercentage > 3; // Lower threshold for better detection
    
    // Calculate face center if face detected
    if (hasFace && facePixels.length > 0) {
      const centerX = facePixels.reduce((sum, p) => sum + p.x, 0) / facePixels.length;
      const centerY = facePixels.reduce((sum, p) => sum + p.y, 0) / facePixels.length;
      faceCenter = { x: centerX, y: centerY };
    }
    
    // Multiple face detection based on skin clusters
    const hasMultipleFaces = skinPercentage > 12 && facePixels.length > 1000; // More skin and pixels indicates multiple faces
    
    // Head movement detection
    if (hasFace && lastDetectionRef.current.headPosition.x !== 0) {
      const movementX = Math.abs(faceCenter.x - lastDetectionRef.current.headPosition.x);
      const movementY = Math.abs(faceCenter.y - lastDetectionRef.current.headPosition.y);
      const totalMovement = Math.sqrt(movementX * movementX + movementY * movementY);
      
      // Determine head movement level
      let newHeadMovement = 'normal';
      if (totalMovement > 50) {
        newHeadMovement = 'excessive';
        addViolation('head_movement', 'Sudden head movement detected', 1);
      } else if (totalMovement > 20) {
        newHeadMovement = 'moderate';
      }
      
      setHeadMovement(newHeadMovement);
      lastDetectionRef.current.headMovement = newHeadMovement;
    }
    
    // Update face position for next comparison
    lastDetectionRef.current.headPosition = faceCenter;
    
    // Update face detection states with debouncing
    if (hasFace !== lastDetectionRef.current.face) {
      setFaceDetected(hasFace);
      if (!hasFace && examStarted) {
        addViolation('face_absence', 'Face not detected', 2);
      }
    }
    
    if (hasMultipleFaces !== lastDetectionRef.current.multipleFaces && hasMultipleFaces) {
      setMultipleFaces(hasMultipleFaces);
      if (hasMultipleFaces && examStarted) {
        addViolation('multiple_faces', 'Multiple faces detected', 3);
      }
    }
    
    lastDetectionRef.current.face = hasFace;
    lastDetectionRef.current.multipleFaces = hasMultipleFaces;
  };

  // Voice detection
  const detectVoice = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume with sensitivity adjustment
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const maxVolume = Math.max(...dataArray);
    
    // More sensitive voice detection
    const hasVoice = average > 25 || maxVolume > 100;
    
    if (hasVoice !== lastDetectionRef.current.voice && hasVoice) {
      setVoiceDetected(hasVoice);
      if (examStarted) {
        addViolation('voice', 'Voice or sound detected', 1);
      }
    } else if (!hasVoice) {
      setVoiceDetected(false);
    }
    
    lastDetectionRef.current.voice = hasVoice;
  };

  // Violation handling with score calculation
  const addViolation = (type, message, severity) => {
    // Check cooldown
    if (violationTimeoutsRef.current[type]) {
      return;
    }

    const violation = {
      id: Date.now(),
      type,
      message,
      severity,
      timestamp: new Date().toLocaleTimeString()
    };

    setViolations(prev => {
      const newViolations = [violation, ...prev].slice(0, 50);
      
      // Calculate score based on recent violations (last 10 minutes)
      const now = Date.now();
      const recentViolations = newViolations.filter(v => {
        const [hours, minutes, seconds] = v.timestamp.split(':').map(Number);
        const vTime = new Date().setHours(hours, minutes, seconds);
        return (now - vTime) < 600000; // 10 minutes
      });

      // Weighted scoring
      const score = recentViolations.reduce((acc, v) => {
        switch(v.severity) {
          case 3: return acc + 15; // Multiple faces
          case 2: return acc + 10; // Tab switch, face absence
          case 1: return acc + 5;  // Voice, head movement, keyboard
          default: return acc + 2;
        }
      }, 0);

      const newScore = Math.min(score, 100);
      setViolationScore(newScore);

      // Check for termination
      if (newScore >= 100) {
        setShowTerminateModal(true);
        setExamStarted(false);
      }

      return newViolations;
    });

    // Set cooldown
    violationTimeoutsRef.current[type] = setTimeout(() => {
      delete violationTimeoutsRef.current[type];
    }, getCooldown(type));
  };

  const getCooldown = (type) => {
    switch(type) {
      case 'multiple_faces': return 60000; // 1 minute
      case 'tab_switch': return 30000; // 30 seconds
      case 'face_absence': return 20000; // 20 seconds
      case 'voice': return 15000; // 15 seconds
      case 'head_movement': return 10000; // 10 seconds
      default: return 10000; // 10 seconds
    }
  };

  // Start exam
  const startExam = () => {
    setExamStarted(true);
    setTabSwitches(0);
    setViolations([]);
    setViolationScore(0);
    setShowExitWarning(false);
  };

  // Finish exam
  const finishExam = () => {
    setExamCompleted(true);
    setExamStarted(false);
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  // Handle exit attempt
  const handleExitAttempt = () => {
    if (examStarted && !examCompleted) {
      setShowExitWarning(true);
    }
  };

  // Get score color
  const getScoreColor = () => {
    if (violationScore < 30) return 'success';
    if (violationScore < 60) return 'warning';
    return 'danger';
  };

  return (
    <div ref={containerRef} className="min-vh-100 bg-dark">
      {!examStarted && !examCompleted ? (
        // Start Screen
        <Container className="d-flex align-items-center justify-content-center min-vh-100">
          <Card className="shadow-lg border-0" style={{ maxWidth: '500px' }}>
            <Card.Body className="p-5 text-center">
              <Shield size={64} className="text-primary mb-4" />
              <h2 className="mb-3">Secure Exam Proctoring</h2>
              <p className="text-muted mb-4">
                This exam will be monitored with:
                <br />• Full-screen enforcement
                <br />• Tab switching detection (max 3 attempts)
                <br />• Face presence monitoring
                <br />• Voice and sound detection
                <br />• Head movement tracking
                <br />• Multiple face detection
              </p>
              <Button 
                variant="primary" 
                size="lg" 
                onClick={startExam}
                className="px-5"
              >
                <Lock className="me-2" size={20} />
                Start Secure Exam
              </Button>
            </Card.Body>
          </Card>
        </Container>
      ) : examCompleted ? (
        // Completion Screen
        <Container className="d-flex align-items-center justify-content-center min-vh-100">
          <Card className="shadow-lg border-0" style={{ maxWidth: '500px' }}>
            <Card.Body className="p-5 text-center">
              <div className="mb-4">
                <div className="bg-success bg-opacity-10 rounded-circle p-3 d-inline-block">
                  <Activity size={48} className="text-success" />
                </div>
              </div>
              <h2 className="mb-3">Exam Completed</h2>
              <p className="text-muted mb-4">
                Your exam has been successfully submitted.
                <br />
                <small>Final violation score: {violationScore}%</small>
                <br />
                <small>Tab switches: {tabSwitches}/3</small>
              </p>
              <Button 
                variant="outline-primary" 
                onClick={() => window.location.reload()}
              >
                Return to Dashboard
              </Button>
            </Card.Body>
          </Card>
        </Container>
      ) : (
        // Active Exam Screen
        <Container fluid className="p-0">
          {/* Header Bar */}
          <div className="bg-primary text-white p-3 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
              <Camera className="me-2" size={20} />
              <span className="fw-bold">Secure Exam Mode Active</span>
            </div>
            
            <div className="d-flex align-items-center gap-3">
              <Badge bg={fullScreenMode ? 'success' : 'danger'} className="p-2">
                <Maximize2 size={14} className="me-1" />
                {fullScreenMode ? 'Full Screen' : 'Not Full Screen'}
              </Badge>
              
              <Badge bg={browserFocus ? 'success' : 'danger'} className="p-2">
                <Globe size={14} className="me-1" />
                {browserFocus ? 'Focused' : 'Unfocused'}
              </Badge>
              
              <Badge bg="warning" className="p-2">
                Tab Switches: {tabSwitches}/3
              </Badge>
              
              <div className={`bg-${getScoreColor()} px-3 py-2 rounded`}>
                Score: {violationScore}%
              </div>
              
              <Button 
                variant="light" 
                size="sm"
                onClick={handleExitAttempt}
              >
                <LogOut size={16} className="me-1" />
                Finish Exam
              </Button>
            </div>
          </div>

          {/* Full Screen Warning */}
          {showFullScreenWarning && (
            <Alert variant="warning" className="m-3 text-center">
              <Maximize2 className="me-2" size={20} />
              You have exited full screen mode. Returning to full screen in 3 seconds...
              <Button variant="outline-warning" size="sm" className="ms-3" onClick={enterFullScreen}>
                Return Now
              </Button>
            </Alert>
          )}

          {/* Main Content */}
          <Row className="g-0">
            {/* Video Feed */}
            <Col md={9}>
              <div className="position-relative bg-black" style={{ height: 'calc(100vh - 70px)' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-100 h-100"
                  style={{ objectFit: 'cover' }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {/* Detection Overlays */}
                {faceDetected && !multipleFaces && (
                  <div className="position-absolute top-0 start-0 w-100 h-100 border border-success border-3"
                       style={{ pointerEvents: 'none', boxShadow: 'inset 0 0 30px rgba(40, 167, 69, 0.3)' }} />
                )}
                
                {multipleFaces && (
                  <div className="position-absolute top-0 start-0 w-100 h-100 border border-danger border-5"
                       style={{ pointerEvents: 'none', boxShadow: 'inset 0 0 50px rgba(220, 53, 69, 0.5)' }} />
                )}

                {/* Status Overlay */}
                <div className="position-absolute bottom-0 start-0 p-4">
                  <div className="d-flex gap-2 flex-wrap">
                    <Badge bg={faceDetected ? 'success' : 'danger'} className="p-3">
                      <User size={18} className="me-2" />
                      {faceDetected ? 'Face Detected' : 'No Face'}
                    </Badge>
                    
                    <Badge bg={!voiceDetected ? 'success' : 'warning'} className="p-3">
                      <Mic size={18} className="me-2" />
                      {voiceDetected ? 'Sound Detected' : 'Silent'}
                    </Badge>
                    
                    <Badge bg={headMovement === 'normal' ? 'success' : headMovement === 'moderate' ? 'warning' : 'danger'} className="p-3">
                      <Move size={18} className="me-2" />
                      Head: {headMovement}
                    </Badge>
                    
                    {multipleFaces && (
                      <Badge bg="danger" className="p-3">
                        <AlertTriangle size={18} className="me-2" />
                        Multiple Faces!
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Violation Score */}
                <div className="position-absolute top-0 end-0 p-4">
                  <div className={`bg-${getScoreColor()} bg-opacity-75 text-white p-3 rounded text-center`} style={{ minWidth: '120px' }}>
                    <div className="small">Violation Score</div>
                    <div className="h2 mb-0">{violationScore}%</div>
                    <ProgressBar 
                      now={violationScore} 
                      variant={getScoreColor()}
                      className="mt-2"
                      style={{ height: '5px' }}
                    />
                  </div>
                </div>
              </div>
            </Col>

            {/* Sidebar */}
            <Col md={3} className="bg-light" style={{ height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
              <div className="p-3">
                <h5 className="mb-3 d-flex justify-content-between align-items-center">
                  Security Log
                  <Badge bg={getScoreColor()}>
                    {violations.length} events
                  </Badge>
                </h5>
                
                <ListGroup variant="flush">
                  {violations.length === 0 ? (
                    <ListGroup.Item className="text-center text-muted py-4">
                      <Activity size={32} className="mb-2" />
                      <p className="mb-0">No violations detected</p>
                      <small>All systems normal</small>
                    </ListGroup.Item>
                  ) : (
                    violations.map(v => (
                      <ListGroup.Item key={v.id} className="border-0 bg-transparent px-0">
                        <div className="d-flex">
                          <Badge 
                            bg={v.severity === 3 ? 'danger' : v.severity === 2 ? 'warning' : 'info'}
                            className="me-2 mt-1"
                            style={{ width: '10px', height: '10px', padding: 0, borderRadius: '50%' }}
                          />
                          <div className="flex-grow-1">
                            <div className="d-flex justify-content-between">
                              <small className="text-muted">{v.timestamp}</small>
                              <small className={`text-${v.severity === 3 ? 'danger' : v.severity === 2 ? 'warning' : 'info'}`}>
                                +{v.severity === 3 ? 15 : v.severity === 2 ? 10 : 5} pts
                              </small>
                            </div>
                            <span>{v.message}</span>
                          </div>
                        </div>
                      </ListGroup.Item>
                    ))
                  )}
                </ListGroup>
              </div>
            </Col>
          </Row>

          {/* Exit Warning Modal */}
          <Modal show={showExitWarning} onHide={() => setShowExitWarning(false)} centered>
            <Modal.Header closeButton className="bg-warning">
              <Modal.Title>Finish Exam?</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>Are you sure you want to finish the exam?</p>
              <p className="text-muted mb-0">
                Current violation score: {violationScore}%
                <br />
                Tab switches: {tabSwitches}/3
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowExitWarning(false)}>
                Continue Exam
              </Button>
              <Button variant="primary" onClick={finishExam}>
                Yes, Finish Exam
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Termination Modal */}
          <Modal show={showTerminateModal} onHide={() => {}} backdrop="static" keyboard={false} centered>
            <Modal.Header className="bg-danger text-white">
              <Modal.Title>
                <XCircle className="me-2" size={24} />
                Exam Terminated
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>This exam has been terminated due to security violations.</p>
              <p className="text-muted small mb-0">
                Final violation score: {violationScore}%
                <br />
                Tab switches: {tabSwitches}/3
                <br />
                • Multiple security protocols violated
                <br />• Please contact your proctor
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Return to Dashboard
              </Button>
            </Modal.Footer>
          </Modal>
        </Container>
      )}
    </div>
  );
};

export default ProctoringDashboard;