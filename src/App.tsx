import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Controls from './pages/Controls'
import ControlDetail from './pages/ControlDetail'
import RaiseRequest from './pages/RaiseRequest'
import MyRequests from './pages/MyRequests'
import Approvals from './pages/Approvals'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/controls" element={<Controls />} />
        <Route path="/controls/:id" element={<ControlDetail />} />
        <Route path="/controls/:id/request" element={<RaiseRequest />} />
        <Route path="/my-requests" element={<MyRequests />} />
        <Route
          path="/approvals"
          element={
            <ProtectedRoute requireApprover>
              <Approvals />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/controls" replace />} />
    </Routes>
  )
}
