import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Camera from "../compnents/Camera";

export default function RegisterFace() {
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [uploadedPreview, setUploadedPreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [cameraPermission, setCameraPermission] = useState(null);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [matchResult, setMatchResult] = useState(null);

    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    // Check camera permission on component mount
    useEffect(() => {
        checkCameraPermission();
    }, []);

    const checkCameraPermission = async () => {
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const permissionStatus = await navigator.permissions.query({ name: 'camera' });

                if (permissionStatus.state === 'granted') {
                    setCameraPermission(true);
                } else if (permissionStatus.state === 'denied') {
                    setCameraPermission(false);
                    setCameraError('Camera access was denied. Please enable camera access in your browser settings.');
                }

                permissionStatus.onchange = () => {
                    if (permissionStatus.state === 'granted') {
                        setCameraPermission(true);
                        setShowPermissionModal(false);
                        setCameraError(null);
                    } else if (permissionStatus.state === 'denied') {
                        setCameraPermission(false);
                        setCameraError('Camera access was denied. Please enable camera access in your browser settings.');
                    }
                };
            }
        } catch (error) {
            console.error('Error checking camera permission:', error);
        }
    };

    const requestCameraPermission = async () => {
        setShowPermissionModal(true);
        setCameraError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            setCameraPermission(true);
            setShowPermissionModal(false);
            setCameraError(null);
        } catch (error) {
            console.error('Camera permission denied:', error);

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                setCameraPermission(false);
                setCameraError('Camera access was denied. Please allow camera access and refresh the page.');
            } else if (error.name === 'NotFoundError') {
                setCameraError('No camera found on your device. Please connect a camera and try again.');
            } else if (error.name === 'NotReadableError') {
                setCameraError('Camera is already in use by another application.');
            } else {
                setCameraError('Unable to access camera. Please check your camera connection.');
            }
        }
    };

    const handleCapture = (photo) => {
        setCapturedPhoto(photo);
        setResult(null);
        setMatchResult(null);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setUploadedPreview(reader.result);
            setResult(null);
            setMatchResult(null);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const fullname = e.target.fullname.value;
        const regNo = e.target.RegNo.value;

        if (!capturedPhoto || !uploadedPreview) {
            alert('Please capture and upload photos');
            return;
        }

        setIsSubmitting(true);
        setResult(null);
        setMatchResult(null);

        try {
            console.log('📤 Sending comparison request...');

            // 1. Compare faces (this stays the same)
            const compareRes = await fetch('http://localhost:5000/api/compare-faces', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    capturedPhoto: capturedPhoto,
                    uploadedPhoto: uploadedPreview
                })
            });

            if (!compareRes.ok) {
                throw new Error(`HTTP error! status: ${compareRes.status}`);
            }

            const compareData = await compareRes.json();
            console.log('📊 Comparison result:', compareData);

            // Set match result for display
            setMatchResult({
                match_percentage: compareData.match_percentage || 0,
                message: compareData.message || `Face match: ${compareData.match_percentage}%`
            });

            if (compareData.success && compareData.match) {
                // ========== UPDATED: Send ID photo to store encoding ==========
                const registerRes = await fetch('http://localhost:5000/api/register-face', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // 👇 Send uploadedPreview (ID photo) to store encoding
                    body: JSON.stringify({
                        fullname,
                        regNo,
                        uploadedPhoto: uploadedPreview  // This gets encoded and stored
                    })
                });

                const registerData = await registerRes.json();
                console.log('📝 Register result:', registerData);

                // 3. Start exam (this stays the same)
                const examRes = await fetch('http://localhost:5000/api/start-exam', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ regNo })
                });

                const examData = await examRes.json();
                console.log('🎯 Exam result:', examData);

                // Show success message
                setResult({
                    success: true,
                    message: `✅ Verified! Match: ${compareData.match_percentage}%`
                });

                // Navigate to exam page after short delay
                setTimeout(() => {
                    navigate('/exam', { 
                        state: {
                            sessionId: examData.sessionId,
                            regNo: regNo,
                            fullname: fullname
                        }
                    });
                }, 2000);

            } else {
                // Show failure message
                setResult({
                    success: false,
                    message: `❌ Verification failed: ${compareData.match_percentage}% match (need 70%)`
                });
            }

        } catch (error) {
            console.error('❌ Error:', error);
            setResult({
                success: false,
                message: 'Error: ' + error.message + '\nMake sure backend is running on port 5000'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const clearAll = () => {
        setCapturedPhoto(null);
        setUploadedPreview(null);
        setResult(null);
        setMatchResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Camera Permission Modal
    const PermissionModal = () => (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => !cameraPermission && setShowPermissionModal(false)}>
            <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
                <div className="modal-content">
                    <div className="modal-header bg-primary text-white">
                        <h5 className="modal-title">
                            <i className="bi bi-camera-video-fill me-2"></i>
                            Camera Access Required
                        </h5>
                        <button type="button" className="btn-close btn-close-white" onClick={() => setShowPermissionModal(false)}></button>
                    </div>
                    <div className="modal-body text-center p-4">
                        <div className="mb-4">
                            <i className="bi bi-camera-fill" style={{ fontSize: '4rem', color: '#0d6efd' }}></i>
                        </div>

                        {cameraError ? (
                            <div className="alert alert-danger">
                                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                {cameraError}
                            </div>
                        ) : (
                            <>
                                <h5 className="mb-3">Camera access is required for face verification</h5>
                                <p className="text-muted mb-4">
                                    To complete the registration process, we need access to your camera.
                                    This allows us to capture your photo for face verification.
                                </p>
                                <div className="bg-light p-3 rounded mb-4 text-start">
                                    <h6 className="mb-3"><i className="bi bi-shield-lock-fill me-2 text-success"></i>Privacy Note:</h6>
                                    <ul className="list-unstyled small">
                                        <li className="mb-2">
                                            <i className="bi bi-check-circle-fill text-success me-2"></i>
                                            Photos are used only for verification
                                        </li>
                                        <li className="mb-2">
                                            <i className="bi bi-check-circle-fill text-success me-2"></i>
                                            No photos are stored permanently
                                        </li>
                                        <li className="mb-2">
                                            <i className="bi bi-check-circle-fill text-success me-2"></i>
                                            Camera access can be revoked anytime
                                        </li>
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="modal-footer justify-content-center border-0 pt-0 pb-4">
                        {cameraError ? (
                            <>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPermissionModal(false)}>
                                    <i className="bi bi-x-circle me-2"></i>Close
                                </button>
                                <button type="button" className="btn btn-primary" onClick={requestCameraPermission}>
                                    <i className="bi bi-arrow-repeat me-2"></i>Try Again
                                </button>
                            </>
                        ) : (
                            <>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPermissionModal(false)}>
                                    <i className="bi bi-x-circle me-2"></i>Not Now
                                </button>
                                <button type="button" className="btn btn-primary" onClick={requestCameraPermission}>
                                    <i className="bi bi-camera-video me-2"></i>Allow Camera Access
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // Match Result Component
    const MatchResult = ({ result }) => {
        if (!result) return null;

        const getColor = () => {
            if (result.match_percentage >= 70) return 'success';
            if (result.match_percentage >= 50) return 'warning';
            return 'danger';
        };

        return (
            <div className={`alert alert-${getColor()} text-center`}>
                <h4 className="mb-3">
                    {result.match_percentage >= 70 ? '✅ Verified!' : '❌ Failed'}
                </h4>
                <div className="mb-3">
                    <div className="progress" style={{ height: '20px' }}>
                        <div
                            className={`progress-bar bg-${getColor()}`}
                            style={{ width: `${result.match_percentage}%` }}
                        >
                            {result.match_percentage}%
                        </div>
                    </div>
                </div>
                <p>{result.message}</p>
                {result.match_percentage < 70 && (
                    <button className="btn btn-warning mt-2" onClick={clearAll}>
                        Try Again
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="container mt-4">
            {/* Permission Modal */}
            {showPermissionModal && <PermissionModal />}

            {/* Camera Access Denied Alert */}
            {cameraPermission === false && !showPermissionModal && (
                <div className="alert alert-warning alert-dismissible fade show mb-4" role="alert">
                    <div className="d-flex align-items-center">
                        <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
                        <div>
                            <strong>Camera access is blocked!</strong>
                            <p className="mb-0">{cameraError || 'Please enable camera access in your browser settings.'}</p>
                        </div>
                        <button type="button" className="btn btn-outline-warning ms-auto" onClick={() => setShowPermissionModal(true)}>
                            <i className="bi bi-gear me-2"></i>Fix Camera Access
                        </button>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setCameraError(null)}></button>
                </div>
            )}

            {/* Header */}
            <div className="bg-primary text-white p-4 rounded-3 shadow-sm mb-4 text-center">
                <h2 className="mb-0">
                    <i className="bi bi-shield-lock-fill me-2"></i>
                    Face Verification System
                </h2>
                <p className="mb-0 mt-2 opacity-75">Secure exam proctoring with face recognition</p>
            </div>

            {/* Match Result Display */}
            {matchResult && <MatchResult result={matchResult} />}

            {/* Error Result Display */}
            {result && !result.success && (
                <div className="alert alert-danger text-center mb-4">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {result.message}
                </div>
            )}

            <div className="row">
                {/* Left - Camera */}
                <div className="col-lg-6 mb-4">
                    <div className="card shadow-sm h-100">
                        <div className="card-header bg-primary text-white py-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <h5 className="mb-0">
                                    <i className="bi bi-camera me-2"></i>
                                    Step 1: Take Live Photo
                                </h5>
                                {cameraPermission === false && (
                                    <span className="badge bg-warning text-dark">
                                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                        Camera Blocked
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="card-body">
                            {cameraPermission === false ? (
                                <div className="text-center py-5">
                                    <i className="bi bi-camera-video-off-fill" style={{ fontSize: '4rem', color: '#dc3545' }}></i>
                                    <h5 className="mt-3 text-danger">Camera Access Denied</h5>
                                    <p className="text-muted mb-4">Please allow camera access to take photos</p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowPermissionModal(true)}
                                    >
                                        <i className="bi bi-gear me-2"></i>
                                        Enable Camera Access
                                    </button>
                                </div>
                            ) : cameraPermission === true ? (
                                <Camera onCapture={handleCapture} />
                            ) : (
                                <div className="text-center py-5">
                                    <i className="bi bi-camera-video" style={{ fontSize: '4rem', color: '#6c757d' }}></i>
                                    <h5 className="mt-3">Camera access required</h5>
                                    <p className="text-muted mb-4">Click the button below to enable camera access</p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={requestCameraPermission}
                                    >
                                        <i className="bi bi-camera-video me-2"></i>
                                        Request Camera Access
                                    </button>
                                </div>
                            )}

                            {capturedPhoto && (
                                <div className="alert alert-success mt-3 text-center">
                                    <i className="bi bi-check-circle-fill me-2"></i>
                                    Live photo captured successfully!
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right - Upload & Form */}
                <div className="col-lg-6 mb-4">
                    <div className="card shadow-sm">
                        <div className="card-header bg-success text-white py-3">
                            <h5 className="mb-0 text-center">
                                <i className="bi bi-cloud-upload me-2"></i>
                                Step 2: Upload ID Photo & Details
                            </h5>
                        </div>
                        <div className="card-body">
                            {/* Photo Previews */}
                            <div className="row mb-4">
                                <div className="col-6 text-center">
                                    <div className={`p-2 rounded ${capturedPhoto ? 'bg-light' : ''}`}>
                                        <h6 className="text-muted mb-2">
                                            <i className="bi bi-camera me-1"></i>
                                            Live Photo
                                        </h6>
                                        {capturedPhoto ? (
                                            <img src={capturedPhoto} alt="Captured"
                                                className="img-fluid rounded border shadow-sm"
                                                style={{ maxHeight: '120px', width: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div className="border rounded p-4 bg-light text-muted">
                                                <i className="bi bi-camera" style={{ fontSize: '2rem' }}></i>
                                                <p className="small mb-0">No photo taken</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="col-6 text-center">
                                    <div className={`p-2 rounded ${uploadedPreview ? 'bg-light' : ''}`}>
                                        <h6 className="text-muted mb-2">
                                            <i className="bi bi-image me-1"></i>
                                            ID Photo
                                        </h6>
                                        {uploadedPreview ? (
                                            <img src={uploadedPreview} alt="Uploaded"
                                                className="img-fluid rounded border shadow-sm"
                                                style={{ maxHeight: '120px', width: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div className="border rounded p-4 bg-light text-muted">
                                                <i className="bi bi-cloud-upload" style={{ fontSize: '2rem' }}></i>
                                                <p className="small mb-0">No photo uploaded</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">
                                        <i className="bi bi-person-circle me-2"></i>
                                        Full Name <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control form-control-lg"
                                        name="fullname"
                                        placeholder="Enter your full name"
                                        required
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="form-label fw-semibold">
                                        <i className="bi bi-qr-code me-2"></i>
                                        Registration Number <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control form-control-lg"
                                        name="RegNo"
                                        placeholder="e.g., STU2024001"
                                        required
                                    />
                                </div>

                                {/* Upload Button */}
                                <div className="mb-4">
                                    <label className="form-label fw-bold">
                                        <i className="bi bi-cloud-arrow-up me-2"></i>
                                        Upload ID Photo:
                                    </label>
                                    <div className="border border-2 border-dashed rounded-3 p-4 text-center bg-light">
                                        <input
                                            type="file"
                                            className="d-none"
                                            ref={fileInputRef}
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            id="photoUpload"
                                        />
                                        <label
                                            htmlFor="photoUpload"
                                            className="btn btn-outline-primary btn-lg mb-3 px-4"
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <i className="bi bi-cloud-upload me-2"></i>
                                            Choose Photo
                                        </label>
                                        <p className="text-muted small mb-0">
                                            <i className="bi bi-info-circle me-1"></i>
                                            Supported: JPG, PNG (Max 5MB)
                                        </p>
                                    </div>
                                </div>

                                {/* Buttons */}
                                <div className="d-grid gap-2">
                                    <button
                                        type="submit"
                                        className="btn btn-success btn-lg"
                                        disabled={!capturedPhoto || !uploadedPreview || isSubmitting || cameraPermission === false}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>
                                                Verifying Face...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-shield-check me-2"></i>
                                                Verify Identity & Continue
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={clearAll}
                                        disabled={isSubmitting}
                                    >
                                        <i className="bi bi-x-circle me-2"></i>
                                        Clear All
                                    </button>
                                </div>
                            </form>

                            {/* Progress Steps */}
                            <div className="mt-4">
                                <div className="d-flex justify-content-between">
                                    <div className={`text-center ${capturedPhoto ? 'text-success' : 'text-muted'}`}>
                                        <div className={`rounded-circle p-2 d-inline-block ${capturedPhoto ? 'bg-success text-white' : 'bg-light'}`}>
                                            <i className="bi bi-camera"></i>
                                        </div>
                                        <p className="small mt-1">Take Photo</p>
                                    </div>
                                    <div className={`text-center ${uploadedPreview ? 'text-success' : 'text-muted'}`}>
                                        <div className={`rounded-circle p-2 d-inline-block ${uploadedPreview ? 'bg-success text-white' : 'bg-light'}`}>
                                            <i className="bi bi-cloud-upload"></i>
                                        </div>
                                        <p className="small mt-1">Upload ID</p>
                                    </div>
                                    <div className="text-center text-muted">
                                        <div className="rounded-circle p-2 d-inline-block bg-light">
                                            <i className="bi bi-shield-check"></i>
                                        </div>
                                        <p className="small mt-1">Verify</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .border-dashed { border-style: dashed !important; }
                .modal { background-color: rgba(0,0,0,0.5); }
                .progress { border-radius: 10px; }
                .bg-success { background-color: #198754 !important; }
                .bg-warning { background-color: #ffc107 !important; }
                .bg-danger { background-color: #dc3545 !important; }
            `}</style>
        </div>
    );
}