import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Home from './pages/Home'
import RegisterFace from './pages/RegisterFace'
import Exam from './pages/ExamGuide'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/face-register" element={<RegisterFace />} />
        <Route path="/exam-guidelines" element={<Exam />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App