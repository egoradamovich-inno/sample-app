import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ActiveContextProvider } from './nav/ActiveContextContext'
import { ImpersonationHistoryPage } from './pages/admin/ImpersonationHistoryPage'
import { UsersListPage } from './pages/admin/UsersListPage'
import { CoachPublicProfilePage } from './pages/coach/CoachPublicProfilePage'
import { MyTimesPage } from './pages/coach/MyTimesPage'
import { JoinLandingPage } from './pages/JoinLandingPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { BestTimesPage } from './pages/player/BestTimesPage'
import { PendingApprovalsPage } from './pages/player/PendingApprovalsPage'
import { PlayerProfilesPage } from './pages/player/PlayerProfilesPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { TrainerBrandingPage } from './pages/trainer/TrainerBrandingPage'
import { TrainerRosterPage } from './pages/trainer/TrainerRosterPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { AppShell } from './layout/AppShell'
import { PrivateRoute } from './routes/PrivateRoute'
import { RoleDashboardRedirect } from './routes/RoleDashboardRedirect'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ActiveContextProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/join/:code" element={<JoinLandingPage />} />
            <Route path="/coach/public/:slug" element={<CoachPublicProfilePage />} />

            <Route element={<PrivateRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<RoleDashboardRedirect />} />
                <Route path="/profile" element={<ProfileEditPage />} />
                <Route path="/players" element={<PlayerProfilesPage />} />
                <Route path="/players/approvals" element={<PendingApprovalsPage />} />
                <Route path="/players/best-times" element={<BestTimesPage />} />
                <Route path="/coach/my-times" element={<MyTimesPage />} />
                <Route path="/admin/users" element={<UsersListPage />} />
                <Route path="/admin/impersonation/history" element={<ImpersonationHistoryPage />} />
                <Route path="/trainer/roster" element={<TrainerRosterPage />} />
                <Route path="/trainer/branding" element={<TrainerBrandingPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ActiveContextProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
