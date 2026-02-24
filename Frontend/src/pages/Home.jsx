import { useNavigate } from 'react-router-dom';

export default function Home() {
    const navigate = useNavigate();

    return (
        <div className="container mt-5">
            <div className="row">
                <div className="col-md-12 text-center">
                    <h1 className="display-4 mb-4">Welcome to Face Recognition System</h1>
                    <p className="lead mb-5">
                        Please register your face before starting the exam
                    </p>
                    
                    {/* Start Exam Button */}
                    <button 
                        className=""
                        onClick={() => navigate('/face-register')}
                    >
                        <i className="bi bi-pencil-square me-2"></i>
                        Start Exam
                    </button>
                    
                    <p className="text-muted mt-4">
                        <small>
                            <i className="bi bi-info-circle me-2"></i>
                            You'll need to capture your face for verification
                        </small>
                    </p>
                </div>
            </div>
        </div>
    );
}