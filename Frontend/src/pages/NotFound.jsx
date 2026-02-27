// pages/NotFound.jsx
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="container-fluid min-vh-100 d-flex align-items-center bg-light">
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-md-8 col-lg-6">
                        <div className="card border-0 shadow-lg">
                            <div className="card-body p-5 text-center">
                                {/* Emoji Animation */}
                                <div className="mb-4">
                                    <span className="display-1 d-block animate-emoji">🔍</span>
                                    <span className="display-1 d-block mt-n3 animate-emoji-delay">😕</span>
                                </div>
                                
                                <h1 className="display-1 fw-bold text-primary mb-0">404</h1>
                                <div className="w-25 mx-auto bg-warning" style={{ height: '4px' }}></div>
                                
                                <h2 className="h3 mb-4 mt-3">Page Not Found</h2>
                                
                                <p className="text-muted mb-4">
                                    We searched everywhere, but this page seems to have disappeared.
                                    Maybe it's studying for an exam? 📚
                                </p>
                                
                                {/* Quick Links */}
                                <div className="row g-2 mb-4">
                                    <div className="col-6">
                                        <div className="p-3 bg-light rounded cursor-pointer" 
                                             onClick={() => navigate('/')}
                                             style={{ cursor: 'pointer' }}>
                                            <i className="bi bi-house-door fs-2 text-primary"></i>
                                            <p className="mb-0 mt-2">Home</p>
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="p-3 bg-light rounded cursor-pointer"
                                             onClick={() => navigate('/exam')}
                                             style={{ cursor: 'pointer' }}>
                                            <i className="bi bi-pencil-square fs-2 text-success"></i>
                                            <p className="mb-0 mt-2">Take Exam</p>
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="p-3 bg-light rounded cursor-pointer"
                                             onClick={() => navigate('/face-register')}
                                             style={{ cursor: 'pointer' }}>
                                            <i className="bi bi-camera fs-2 text-info"></i>
                                            <p className="mb-0 mt-2">Register</p>
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="p-3 bg-light rounded cursor-pointer"
                                             onClick={() => window.location.reload()}
                                             style={{ cursor: 'pointer' }}>
                                            <i className="bi bi-arrow-repeat fs-2 text-warning"></i>
                                            <p className="mb-0 mt-2">Refresh</p>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Contact Support */}
                                <p className="small text-muted">
                                    Still lost? <a href="/support" className="text-decoration-none">Contact Support</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                    100% { transform: translateY(0px); }
                }
                .animate-emoji {
                    animation: float 3s ease-in-out infinite;
                }
                .animate-emoji-delay {
                    animation: float 3s ease-in-out infinite;
                    animation-delay: 0.5s;
                }
                .cursor-pointer {
                    transition: all 0.3s;
                }
                .cursor-pointer:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }
            `}</style>
        </div>
    );
}