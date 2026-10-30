
import { Navigate, Route, Routes } from 'react-router-dom'

import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import Dashboard from './pages/Dashboard'
import ElectionDetails from './pages/ElectionDetails'
import AdminDashboard from './pages/AdminDashboard'
import AdminElectionDetails from './pages/AdminElectionDetails'
import CandidateManagement from './pages/CandidateManagement'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Voter routes */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route
        path="/elections/:electionId"
        element={<ElectionDetails />}
      />

      {/* Admin routes */}
      <Route
        path="/admin/dashboard"
        element={<AdminDashboard />}
      />
      <Route
        path="/admin/elections/:electionId"
        element={<AdminElectionDetails />}
      />
      <Route
        path="/admin/elections/:electionId/positions/:positionId/candidates"
        element={<CandidateManagement />}
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
