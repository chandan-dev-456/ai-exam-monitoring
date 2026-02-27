import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Exam = () => {
  const navigate = useNavigate();
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const handleStartExam = () => {
    if (agreeTerms) {
      navigate('/register-face')
    } else {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3000);
    }
  };

  return (
    <div className="container py-4">
      <div className="card shadow-lg border-0 rounded-4">
        <div className="card-body p-4 p-md-5">

          {/* Header */}
          <div className="text-center mb-5">
            <h1 className="display-5 fw-bold text-primary mb-3">
              📋 Online Exam Rules
            </h1>
            <p className="text-secondary fs-5">
              Please read all rules carefully before starting the exam
            </p>
          </div>

          {/* Warning Message */}
          {showWarning && (
            <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center mb-4" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>⚠️ You must agree to the terms before starting the exam</strong>
            </div>
          )}

          {/* Rules Grid */}
          <div className="row g-4 mb-5">
            {/* Time Rules */}
            <div className="col-md-6 col-lg-4">
              <div className="card h-100 border-0 bg-light">
                <div className="card-body">
                  <div className="display-4 mb-3">⏰</div>
                  <h5 className="card-title fw-bold mb-3">Time & Duration</h5>
                  <ul className="list-unstyled">
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Total exam duration: 60 minutes</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Timer starts when you click "Start"</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Cannot pause the timer</li>
                    <li className="mb-2">• Auto-submit when time expires</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Navigation Rules */}
            <div className="col-md-6 col-lg-4">
              <div className="card h-100 border-0 bg-light">
                <div className="card-body">
                  <div className="display-4 mb-3">🖱️</div>
                  <h5 className="card-title fw-bold mb-3">Navigation Rules</h5>
                  <ul className="list-unstyled">
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Navigate between questions freely</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Mark questions for review</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Answer in any order</li>
                    <li className="mb-2">• Track progress with question palette</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Technical Rules */}
            <div className="col-md-6 col-lg-4">
              <div className="card h-100 border-0 bg-light">
                <div className="card-body">
                  <div className="display-4 mb-3">💻</div>
                  <h5 className="card-title fw-bold mb-3">Technical Guidelines</h5>
                  <ul className="list-unstyled">
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Ensure stable internet connection</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Do not refresh browser</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Use Chrome, Firefox, or Edge</li>
                    <li className="mb-2">• Keep device charged</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Prohibited Actions */}
            <div className="col-md-6 col-lg-4">
              <div className="card h-100 border-0 bg-light">
                <div className="card-body">
                  <div className="display-4 mb-3">🚫</div>
                  <h5 className="card-title fw-bold mb-3">Prohibited Actions</h5>
                  <ul className="list-unstyled">
                    <li className="mb-2 pb-2 border-bottom border-secondary">• No switching tabs/windows</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• No copy-paste from external sources</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• No other devices during exam</li>
                    <li className="mb-2">• No screenshots of questions</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Answer Guidelines */}
            <div className="col-md-6 col-lg-4">
              <div className="card h-100 border-0 bg-light">
                <div className="card-body">
                  <div className="display-4 mb-3">✏️</div>
                  <h5 className="card-title fw-bold mb-3">Answer Guidelines</h5>
                  <ul className="list-unstyled">
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Read questions carefully</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• All questions are mandatory</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Multiple choice: select best answer</li>
                    <li className="mb-2">• Review before final submit</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Scoring Rules */}
            <div className="col-md-6 col-lg-4">
              <div className="card h-100 border-0 bg-light">
                <div className="card-body">
                  <div className="display-4 mb-3">📊</div>
                  <h5 className="card-title fw-bold mb-3">Scoring Rules</h5>
                  <ul className="list-unstyled">
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Each correct: +1 point</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• No negative marking</li>
                    <li className="mb-2 pb-2 border-bottom border-secondary">• Unanswered = zero</li>
                    <li className="mb-2">• Score shown after submission</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="card bg-warning bg-opacity-25 border-warning mb-4">
            <div className="card-body">
              <h5 className="card-title text-warning-emphasis fw-bold mb-3">
                📌 Important Notes
              </h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="d-flex align-items-center gap-2 p-2 bg-white rounded">
                    <span className="fs-4">🔴</span>
                    <span>No browser back button during exam</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center gap-2 p-2 bg-white rounded">
                    <span className="fs-4">🟡</span>
                    <span>Auto-save every 30 seconds</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center gap-2 p-2 bg-white rounded">
                    <span className="fs-4">🟢</span>
                    <span>Contact support for technical issues</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center gap-2 p-2 bg-white rounded">
                    <span className="fs-4">🔵</span>
                    <span>Keep student ID ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Exam Summary */}
          <div className="card bg-dark text-white mb-4">
            <div className="card-body">
              <h5 className="card-title mb-4">📊 Exam Summary</h5>
              <div className="row g-3">
                <div className="col-6 col-md-4">
                  <div className="bg-white bg-opacity-10 p-3 rounded text-center">
                    <div className="small opacity-75">Total Questions</div>
                    <div className="h3 mb-0">50</div>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="bg-white bg-opacity-10 p-3 rounded text-center">
                    <div className="small opacity-75">Total Marks</div>
                    <div className="h3 mb-0">50</div>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="bg-white bg-opacity-10 p-3 rounded text-center">
                    <div className="small opacity-75">Duration</div>
                    <div className="h3 mb-0">60m</div>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="bg-white bg-opacity-10 p-3 rounded text-center">
                    <div className="small opacity-75">Question Type</div>
                    <div className="h3 mb-0">MCQ</div>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="bg-white bg-opacity-10 p-3 rounded text-center">
                    <div className="small opacity-75">Passing %</div>
                    <div className="h3 mb-0">40%</div>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="bg-white bg-opacity-10 p-3 rounded text-center">
                    <div className="small opacity-75">Attempts</div>
                    <div className="h3 mb-0">1</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Agreement Section */}
          <div className="card bg-light border-0 mb-4">
            <div className="card-body p-4">
              <div className="form-check mb-4">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="agreeCheck"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <label className="form-check-label fw-bold" htmlFor="agreeCheck">
                  I have read and agree to all the exam rules and guidelines
                </label>
              </div>

              <div className="d-flex gap-3 mb-3">
                <button
                  className="btn btn-primary flex-grow-1 py-3 fw-bold"
                  onClick={handleStartExam}
                >
                  🚀 Start Exam
                </button>
                {/* <button className="btn btn-outline-primary flex-grow-1 py-3 fw-bold">
                  📝 Practice Test
                </button> */}
              </div>

              <p className="text-secondary text-center small mb-0 fst-italic">
                By starting the exam, you confirm that you will follow all rules and regulations.
                Any violation may result in disqualification.
              </p>
            </div>
          </div>

          {/* Support Section */}
          <div className="text-center">
            <h6 className="fw-bold mb-3">Need Help?</h6>
            <p className="text-secondary mb-3">If you face any issues, contact exam support:</p>
            <div className="d-flex justify-content-center gap-4 flex-wrap">
              <span className="text-primary">📧 support@exam.com</span>
              <span className="text-primary">📞 1-800-123-4567</span>
              <span className="text-primary">💬 Live Chat</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Exam;