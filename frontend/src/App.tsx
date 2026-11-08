import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import JobDetailsPage from './pages/JobDetailsPage'
import ProcessEmailPage from './pages/ProcessEmailPage'
import ReportsPage from './pages/ReportsPage'
import ReviewQueuePage from './pages/ReviewQueuePage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/process" element={<ProcessEmailPage />} />
          <Route path="/review" element={<ReviewQueuePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
