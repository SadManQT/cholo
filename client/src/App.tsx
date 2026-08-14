import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from './components/ui';
import { FullScreenSpinner } from './components/layout/FullScreenSpinner';
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

const BookRidePage = lazy(() => import('./pages/passenger/BookRidePage').then((module) => ({ default: module.BookRidePage })));
const LiveTripPage = lazy(() => import('./pages/passenger/LiveTripPage').then((module) => ({ default: module.LiveTripPage })));
const TripHistoryPage = lazy(() => import('./pages/passenger/TripHistoryPage').then((module) => ({ default: module.TripHistoryPage })));
const TripDetailPage = lazy(() => import('./pages/passenger/TripDetailPage').then((module) => ({ default: module.TripDetailPage })));
const DriverHomePage = lazy(() => import('./pages/driver/DriverHomePage').then((module) => ({ default: module.DriverHomePage })));
const DriverActiveTripPage = lazy(() => import('./pages/driver/DriverActiveTripPage').then((module) => ({ default: module.DriverActiveTripPage })));
const WalletPage = lazy(() => import('./pages/passenger/WalletPage').then((module) => ({ default: module.WalletPage })));
const EarningsPage = lazy(() => import('./pages/driver/EarningsPage').then((module) => ({ default: module.EarningsPage })));
const WithdrawalsPage = lazy(() => import('./pages/driver/WithdrawalsPage').then((module) => ({ default: module.WithdrawalsPage })));
const PayoutsPage = lazy(() => import('./pages/admin/PayoutsPage').then((module) => ({ default: module.PayoutsPage })));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const DriverApprovalsPage = lazy(() => import('./pages/admin/DriverApprovalsPage').then((module) => ({ default: module.DriverApprovalsPage })));
const UsersPage = lazy(() => import('./pages/admin/UsersPage').then((module) => ({ default: module.UsersPage })));
const PricingPage = lazy(() => import('./pages/admin/PricingPage').then((module) => ({ default: module.PricingPage })));
const DisputesPage = lazy(() => import('./pages/admin/DisputesPage').then((module) => ({ default: module.DisputesPage })));
const SosBoardPage = lazy(() => import('./pages/admin/SosBoardPage').then((module) => ({ default: module.SosBoardPage })));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage').then((module) => ({ default: module.AuditLogPage })));
const SupportQueuePage = lazy(() => import('./pages/admin/SupportQueuePage').then((module) => ({ default: module.SupportQueuePage })));
const SupportPage = lazy(() => import('./pages/shared/SupportPage').then((module) => ({ default: module.SupportPage })));
const ProfilePage = lazy(() => import('./pages/shared/ProfilePage').then((module) => ({ default: module.ProfilePage })));

// doc 12 §3-7's full page catalog, as code (doc 11 §8: "the sitemap as
// code"). Auth, marketplace, money, and M8 operations routes are real;
// only explicitly later/out-of-scope catalog items remain placeholders.
function App() {
  return (
    <>
      <Suspense fallback={<FullScreenSpinner />}>
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
          <Route path="/" element={<BookRidePage />} />
          <Route path="/trips/:code/live" element={<LiveTripPage />} />
          <Route path="/trips" element={<TripHistoryPage />} />
          <Route path="/trips/:code" element={<TripDetailPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/wallet/methods" element={<PlaceholderPage title="Payment methods" />} />
          <Route path="/promos" element={<PlaceholderPage title="Promos" />} />
          <Route path="/account/places" element={<PlaceholderPage title="Saved places" />} />
          <Route path="/account" element={<ProfilePage />} />
          <Route path="/support" element={<SupportPage />} />
        </Route>

        <Route
          path="/driver"
          element={
            <ProtectedRoute roles={['DRIVER']}>
              <DriverLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DriverHomePage />} />
          <Route path="documents" element={<PlaceholderPage title="Documents" />} />
          <Route path="vehicles" element={<PlaceholderPage title="Vehicles" />} />
          <Route path="trip" element={<DriverActiveTripPage />} />
          <Route path="earnings" element={<EarningsPage />} />
          <Route path="withdrawals" element={<WithdrawalsPage />} />
          <Route path="trips" element={<TripHistoryPage driverMode />} />
          <Route path="trips/:code" element={<TripDetailPage driverMode />} />
          <Route path="account" element={<ProfilePage driverMode />} />
          <Route path="support" element={<SupportPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="drivers" element={<DriverApprovalsPage />} />
          <Route path="documents" element={<DriverApprovalsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="zones" element={<PlaceholderPage title="Zones" />} />
          <Route path="payouts" element={<PayoutsPage />} />
          <Route path="disputes" element={<DisputesPage />} />
          <Route path="sos" element={<SosBoardPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="support" element={<SupportQueuePage />} />
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}

export default App;
