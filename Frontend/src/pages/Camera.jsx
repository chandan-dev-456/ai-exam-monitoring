import { useEffect, useRef, useState } from "react";

function Camera({ onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [preview, setPreview] = useState(null);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = 400;
    const height = (400 * video.videoHeight) / video.videoWidth;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    // un-mirror for real image
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);

    const image = canvas.toDataURL("image/jpeg", 0.8);
    setPreview(image);
    onCapture(image); // 🔥 send to parent
  };

  const retake = () => {
    setPreview(null);
    onCapture(null);
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Camera error:", err);
        alert("Unable to access camera. Please check permissions.");
      });
  }, []);

  return (
    <div className="d-flex flex-column align-items-center w-100">
      {/* Camera Container */}
      <div className="position-relative d-flex justify-content-center" 
           style={{ 
             minHeight: '300px', 
             width: '100%',
             backgroundColor: '#f8f9fa',
             borderRadius: '10px',
             overflow: 'hidden'
           }}>
        
        {/* Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="img-fluid"
          style={{
            maxWidth: "400px",
            width: "100%",
            borderRadius: "10px",
            display: preview ? "none" : "block",
            transform: "scaleX(-1)"
          }}
        />

        {/* Preview Image */}
        {preview && (
          <div className="text-center w-100">
            <img 
              src={preview} 
              alt="Captured" 
              className="img-fluid rounded shadow-sm"
              style={{ maxWidth: "400px", width: "100%" }}
            />
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="mt-3 d-flex gap-2">
        {!preview ? (
          <button 
            onClick={capture} 
            className="btn btn-primary"
          >
            <i className="bi bi-camera me-2"></i>
            Capture Photo
          </button>
        ) : (
          <button 
            onClick={retake} 
            className="btn btn-outline-secondary"
          >
            <i className="bi bi-arrow-repeat me-2"></i>
            Retake Photo
          </button>
        )}
      </div>

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

export default Camera;