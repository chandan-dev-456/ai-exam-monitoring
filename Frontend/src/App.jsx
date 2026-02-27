import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Home from './pages/Home'
import RegisterFace from './pages/RegisterFace'
import Exam from './pages/Exam'
import NotFound from './pages/NotFound'

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          {/* Home Page - Landing page with Start Exam button */}
          <Route path="/" element={<Home />} />
          
          {/* Face Registration Page - Capture face before exam */}
          <Route path="/register-face" element={<RegisterFace />} />
          
          {/* Main Exam Page - Proctoring happens here */}
          <Route path="/start-exam" element={<Exam />} />
          
          {/* Exam Results Page - Show report after exam
          <Route path="/exam-results" element={<ExamResults />} /> */}
          
          {/* 404 Page - Catch all unmatched routes */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App