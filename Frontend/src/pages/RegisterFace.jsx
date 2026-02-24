import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Camera from "./Camera";

export default function RegisterFace() {
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [uploadedPreview, setUploadedPreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [cameraPermission, setCameraPermission] = useState(null); // null: unknown, false: denied, true: granted
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    // Check camera permission on component mount
    useEffect(() => {
        checkCameraPermission();
    }, []);

    const checkCameraPermission = async () => {
        try {
            // Check if browser supports permissions API
            if (navigator.permissions && navigator.permissions.query) {
                const permissionStatus = await navigator.permissions.query({ name: 'camera' });
                
                if (permissionStatus.state === 'granted') {
                    setCameraPermission(true);
                } else if (permissionStatus.state === 'denied') {
                    setCameraPermission(false);
                    setCameraError('Camera access was denied. Please enable camera access in your browser settings.');
                } else {
                    // Prompt state - need to request
                    setCameraPermission(null);
                }

                // Listen for permission changes
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
            } else {
                // Fallback for browsers that don't support permissions API
                setCameraPermission(null);
            }
        } catch (error) {
            console.error('Error checking camera permission:', error);
            setCameraPermission(null);
        }
    };

    const requestCameraPermission = async () => {
        setShowPermissionModal(true);
        setCameraError(null);
        
        try {
            // Attempt to get camera access
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            // Stop all tracks immediately - we just wanted permission
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
                setCameraError('Camera is already in use by another application. Please close other apps using camera.');
            } else {
                setCameraError('Unable to access camera. Please check your camera connection.');
            }
        }
    };

    const handleCapture = (photo) => {
        setCapturedPhoto(photo);
        setResult(null);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onloadend = () => {
            setUploadedPreview(reader.result);
            setResult(null);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const fullname = e.target.fullname.value;
        const regNo = e.target.RegNo.value;

        // Centered validation alerts
        if (!capturedPhoto) {
            setResult({
                success: false,
                message: 'Please capture a photo first'
            });
            return;
        }
        
        if (!uploadedPreview) {
            setResult({
                success: false,
                message: 'Please upload a photo first'
            });
            return;
        }

        if (!fullname || !regNo) {
            setResult({
                success: false,
                message: 'Please fill in all fields'
            });
            return;
        }

        setIsSubmitting(true);
        setResult(null);

        try {
            const response = await fetch('http://localhost:5000/api/register-face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullname, registrationNo: regNo, capturedPhoto, uploadedPhoto: uploadedPreview })
            });

            const data = await response.json();
            setResult(data);
            
            if (data.success && data.match) {
                localStorage.setItem('examUser', JSON.stringify({ fullname, registrationNo: regNo, verified: true }));
                setTimeout(() => navigate('/exam-guidelines'), 2000);
            }
        } catch (error) {
            setResult({ 
                success: false, 
                message: 'Failed to connect to server. Make sure server is running on port 5000.' 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const clearAll = () => {
        setCapturedPhoto(null);
        setUploadedPreview(null);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getResultStyle = () => {
        if (!result) return '';
        if (result.success && result.match) return 'alert-success';
        if (result.success && !result.match) return 'alert-warning';
        return 'alert-danger';
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
                                    <i className="bi bi-x-circle me-2"></i>
                                    Close
                                </button>
                                <button type="button" className="btn btn-primary" onClick={requestCameraPermission}>
                                    <i className="bi bi-arrow-repeat me-2"></i>
                                    Try Again
                                </button>
                            </>
                        ) : (
                            <>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPermissionModal(false)}>
                                    <i className="bi bi-x-circle me-2"></i>
                                    Not Now
                                </button>
                                <button type="button" className="btn btn-primary" onClick={requestCameraPermission}>
                                    <i className="bi bi-camera-video me-2"></i>
                                    Allow Camera Access
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

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
                            <p className="mb-0">{cameraError || 'Please enable camera access in your browser settings to use the camera feature.'}</p>
                        </div>
                        <button type="button" className="btn btn-outline-warning ms-auto" onClick={() => setShowPermissionModal(true)}>
                            <i className="bi bi-gear me-2"></i>
                            Fix Camera Access
                        </button>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setCameraError(null)}></button>
                </div>
            )}

            {/* Header */}
            <div className="bg-light p-4 rounded-3 shadow-sm mb-4 text-center">
                <h2 className="mb-0"><i className="bi bi-person-badge me-2"></i>Face Registration</h2>
            </div>

            {/* Centered Result Display */}
            {result && (
                <div className="row mb-4">
                    <div className="col-12">
                        <div className={`alert ${getResultStyle()} shadow-sm text-center`}>
                            <div className="d-flex flex-column align-items-center">
                                <i className={`bi ${result.success && result.match ? 'bi-check-circle-fill text-success' : 
                                    result.success && !result.match ? 'bi-exclamation-triangle-fill text-warning' : 
                                    'bi-x-circle-fill text-danger'} fs-1 mb-3`}></i>
                                <div>
                                    <h5 className="mb-2">
                                        {result.success && result.match ? '✅ Verification Successful' : 
                                         result.success && !result.match ? '⚠️ Verification Failed' : '❌ Error'}
                                    </h5>
                                    <p className="mb-0">{result.message}</p>
                                    {result.similarity && (
                                        <div className="mt-2">
                                            <strong>Similarity:</strong> {result.similarity.toFixed(1)}% 
                                            {result.quality && <span> • Quality: {result.quality}</span>}
                                        </div>
                                    )}
                                    {result.success && result.match && (
                                        <div className="mt-2 text-success">
                                            <i className="bi bi-arrow-right-circle-fill me-1"></i>
                                            Redirecting to exam page in 2 seconds...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="row">
                {/* Left - Camera */}
                <div className="col-lg-6 mb-4">
                    <div className="card shadow-sm h-100">
                        <div className="card-header bg-primary text-white py-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <h5 className="mb-0"><i className="bi bi-camera me-2"></i>Take Photo</h5>
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
                                    <i className="bi bi-check-circle-fill me-2"></i>Photo captured successfully!
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right - Upload & Form */}
                <div className="col-lg-6 mb-4">
                    <div className="card shadow-sm">
                        <div className="card-header bg-success text-white py-3 text-center">
                            <h5 className="mb-0"><i className="bi bi-cloud-upload me-2"></i>Upload Photo & Details</h5>
                        </div>
                        <div className="card-body">
                            {/* Previews */}
                            <div className="row mb-4 text-center">
                                {capturedPhoto && (
                                    <div className="col-6">
                                        <h6 className="text-muted">Camera Photo</h6>
                                        <img src={capturedPhoto} alt="Captured" className="img-fluid rounded border" 
                                            style={{ maxHeight: '120px', width: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                                {uploadedPreview && (
                                    <div className="col-6">
                                        <h6 className="text-muted">Uploaded Photo</h6>
                                        <img src={uploadedPreview} alt="Uploaded" className="img-fluid rounded border" 
                                            style={{ maxHeight: '120px', width: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Full Name <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control text-center" name="fullname" placeholder="Enter your full name" required />
                                </div>

                                <div className="mb-4">
                                    <label className="form-label fw-semibold">Registration Number <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control text-center" name="RegNo" placeholder="e.g., STU2024001" required />
                                </div>
                                
                                {/* Upload */}
                                <div className="mb-4">
                                    <label className="form-label fw-bold">Upload Photo:</label>
                                    <div className="border border-2 border-dashed rounded p-4 text-center bg-light">
                                        <input type="file" className="d-none" ref={fileInputRef} accept="image/*" 
                                            onChange={handleFileUpload} id="photoUpload" />
                                        <label htmlFor="photoUpload" className="btn btn-outline-primary mb-3" style={{ cursor: 'pointer' }}>
                                            <i className="bi bi-cloud-upload me-2"></i>Choose Photo
                                        </label>
                                        <p className="text-muted small mb-0">*Please upload recent photo for verification* Supported: JPG, PNG</p>
                                    </div>
                                </div>
                                
                                {/* Buttons */}
                                <div className="d-grid gap-2">
                                    <button 
                                        type="submit" 
                                        className="btn btn-success btn-lg" 
                                        disabled={!capturedPhoto || !uploadedPreview || isSubmitting || cameraPermission === false}
                                        title={cameraPermission === false ? "Camera access is required for verification" : ""}
                                    >
                                        {isSubmitting ? (
                                            <><span className="spinner-border spinner-border-sm me-2"></span>Comparing Faces...</>
                                        ) : (
                                            <><i className="bi bi-check-circle me-2"></i>Verify & Register</>
                                        )}
                                    </button>
                                    <button type="button" className="btn btn-outline-secondary" onClick={clearAll} disabled={isSubmitting}>
                                        <i className="bi bi-x-circle me-2"></i>Clear All
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .border-dashed { border-style: dashed !important; }
                .modal { background-color: rgba(0,0,0,0.5); }
            `}</style>
        </div>
    );
}