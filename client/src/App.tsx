import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from './components/ui';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminLayout } from './layouts/AdminLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { DriverLayout } from './layouts/DriverLayout';
import { PassengerLayout } from './layouts/PassengerLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { OtpVerifyPage } from './pages/auth/OtpVerifyPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { NotFoundPage } from './pages/shared/NotFoundPage';
import { PlaceholderPage } from './pages/shared/PlaceholderPage';

// doc 12 §3-7's full page catalog, as code (doc 11 §8: "the sitemap as
// code"). Register/Verify/Login are real (roadmap step 17) — everything
// else is the shell (doc 13-14 M5's goal) that later steps fill in.
function App() {
  return (
    <>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/welcome" element={<PlaceholderPage title="Welcome" />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<OtpVerifyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset" element={<PlaceholderPage title="Reset password" />} />
        </Route>

        {/* doc 08-09-10 §6: POST /driver/apply is auth-only (any logged-in
            user) — a passenger applying for the DRIVER role doesn't have it
            yet, so this can't sit inside the DRIVER-gated group below. No
            DriverLayout chrome either: a wizard isn't the persistent app shell. */}
        <Route
          path="/driver/apply"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Become a driver" />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute roles={['PASSENGER']}>
              <PassengerLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<PlaceholderPage title="Book a ride" />} />
          <Route path="/trips/:code/live" element={<PlaceholderPage title="Live trip" />} />
          <Route path="/trips" element={<PlaceholderPage title="Trip history" />} />
          <Route path="/trips/:code" element={<PlaceholderPage title="Trip detail" />} />
          <Route path="/wallet" element={<PlaceholderPage title="Wallet" />} />
          <Route path="/wallet/methods" element={<PlaceholderPage title="Payment methods" />} />
          <Route path="/promos" element={<PlaceholderPage title="Promos" />} />
          <Route path="/account/places" element={<PlaceholderPage title="Saved places" />} />
          <Route path="/account" element={<PlaceholderPage title="Account" />} />
          <Route path="/support" element={<PlaceholderPage title="Support" />} />
        </Route>

        <Route
          path="/driver"
          element={
            <ProtectedRoute roles={['DRIVER']}>
              <DriverLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<PlaceholderPage title="Driver home" />} />
          <Route path="documents" element={<PlaceholderPage title="Documents" />} />
          <Route path="vehicles" element={<PlaceholderPage title="Vehicles" />} />
          <Route path="trip" element={<PlaceholderPage title="Active trip" />} />
          <Route path="earnings" element={<PlaceholderPage title="Earnings" />} />
          <Route path="withdrawals" element={<PlaceholderPage title="Withdrawals" />} />
          <Route path="trips" element={<PlaceholderPage title="Trip history" />} />
          <Route path="account" element={<PlaceholderPage title="Account" />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<PlaceholderPage title="Dashboard" />} />
          <Route path="drivers" element={<PlaceholderPage title="Driver approvals" />} />
          <Route path="documents" element={<PlaceholderPage title="Document review" />} />
          <Route path="users" element={<PlaceholderPage title="Users" />} />
          <Route path="pricing" element={<PlaceholderPage title="Pricing & surge" />} />
          <Route path="zones" element={<PlaceholderPage title="Zones" />} />
          <Route path="payouts" element={<PlaceholderPage title="Withdrawals" />} />
          <Route path="disputes" element={<PlaceholderPage title="Disputes & reports" />} />
          <Route path="sos" element={<PlaceholderPage title="SOS board" />} />
          <Route path="audit" element={<PlaceholderPage title="Audit log" />} />
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
