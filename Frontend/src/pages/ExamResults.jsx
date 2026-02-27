import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ExamResults() {
    const location = useLocation();
    const navigate = useNavigate();
    const { 
        terminated, 
        completed, 
        reason, 
        violations, 
        counts, 
        regNo, 
        fullname,
        sessionId 
    } = location.state || {};

    const [showReport, setShowReport] = useState(false);

    // ========== EXIT FULLSCREEN ON RESULTS PAGE ==========
    useEffect(() => {
        // Exit fullscreen when results page loads
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => {
                console.log('Exit fullscreen error:', err);
            });
        }

        // Allow back navigation on results page
        // No need to block anything
    }, []);

    // Calculate stats
    const totalViolations = violations?.length || 0;
    const violationSummary = counts || {
        fullscreen: 0,
        tabSwitch: 0,
        multipleFaces: 0,
        wrongPerson: 0,
        noFace: 0
    };

    // Format date
    const examDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-12">
                    {/* Main Card */}
                    <div className="card shadow">
                        {/* Header */}
                        <div className={`card-header text-white text-center py-3 ${
                            terminated ? 'bg-danger' : 'bg-success'
                        }`}>
                            {terminated ? (
                                <>
                                    <i className="bi bi-exclamation-triangle-fill fs-1"></i>
                                    <h3 className="mt-2">Exam Terminated</h3>
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check-circle-fill fs-1"></i>
                                    <h3 className="mt-2">Exam Completed!</h3>
                                </>
                            )}
                        </div>

                        {/* Body */}
                        <div className="card-body p-4">
                            {/* Student Info */}
                            <div className="text-center mb-4">
                                <h5 className="mb-1">{fullname || 'Student'}</h5>
                                <p className="text-muted mb-0">Reg No: {regNo || 'N/A'}</p>
                                <small className="text-muted">{examDate}</small>
                            </div>

                            {/* Status Message */}
                            <div className={`alert ${terminated ? 'alert-danger' : 'alert-success'} text-center py-2`}>
                                <i className={`bi ${terminated ? 'bi-exclamation-circle' : 'bi-check-circle'} me-2`}></i>
                                {terminated ? reason : 'Exam submitted successfully'}
                            </div>

                            {/* Toggle Report Button */}
                            <button 
                                className="btn btn-outline-secondary w-100 mb-3"
                                onClick={() => setShowReport(!showReport)}
                            >
                                <i className={`bi ${showReport ? 'bi-eye-slash' : 'bi-eye'} me-2`}></i>
                                {showReport ? 'Hide' : 'View'} Report
                            </button>

                            {/* Report */}
                            {showReport && (
                                <div className="bg-light p-3 rounded mb-3">
                                    <h6 className="mb-3">Violation Summary</h6>
                                    
                                    <div className="mb-2">
                                        <div className="d-flex justify-content-between small">
                                            <span>Fullscreen Exits:</span>
                                            <span className={violationSummary.fullscreen >= 5 ? 'text-danger' : ''}>
                                                {violationSummary.fullscreen}/5
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mb-2">
                                        <div className="d-flex justify-content-between small">
                                            <span>Tab Switches:</span>
                                            <span className={violationSummary.tabSwitch >= 5 ? 'text-danger' : ''}>
                                                {violationSummary.tabSwitch}/5
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mb-2">
                                        <div className="d-flex justify-content-between small">
                                            <span>Multiple Faces:</span>
                                            <span className={violationSummary.multipleFaces >= 3 ? 'text-danger' : ''}>
                                                {violationSummary.multipleFaces}/3
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mb-2">
                                        <div className="d-flex justify-content-between small">
                                            <span>Wrong Person:</span>
                                            <span className={violationSummary.wrongPerson >= 3 ? 'text-danger' : ''}>
                                                {violationSummary.wrongPerson}/3
                                            </span>
                                        </div>
                                    </div>

                                    {violations && violations.length > 0 && (
                                        <div className="mt-3">
                                            <hr />
                                            <h6 className="mb-2">Violation Log</h6>
                                            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                                {violations.map((v, i) => (
                                                    <div key={i} className="small text-secondary border-bottom py-1">
                                                        <i className="bi bi-record-circle text-warning me-2 small"></i>
                                                        {v.type} - {v.time}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="d-grid gap-2">
                                <button 
                                    className="btn btn-primary"
                                    onClick={() => {
                                        if (sessionId) {
                                            localStorage.removeItem(`exam_violations_${sessionId}`);
                                        }
                                        navigate('/', { replace: true });
                                    }}
                                >
                                    <i className="bi bi-house-door me-2"></i>
                                    Return Home
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}