import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Controls from './pages/Controls'
import ControlDetail from './pages/ControlDetail'
import RaiseRequest from './pages/RaiseRequest'
import MyRequests from './pages/MyRequests'
import Approvals from './pages/Approvals'
import AdminLayout from './pages/admin/AdminLayout'
import AdminUsers from './pages/admin/AdminUsers'
import AdminRequests from './pages/admin/AdminRequests'
import AdminControls from './pages/admin/AdminControls'

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
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminUsers />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="controls" element={<AdminControls />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/controls" replace />} />
    </Routes>
  )
}
