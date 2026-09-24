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
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { HomePage } from './pages/shared/HomePage';
import { NotFoundPage } from './pages/shared/NotFoundPage';

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
const NotificationsPage = lazy(() => import('./pages/shared/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const SavedPlacesPage = lazy(() => import('./pages/passenger/SavedPlacesPage').then((module) => ({ default: module.SavedPlacesPage })));
const PromosPage = lazy(() => import('./pages/passenger/PromosPage').then((module) => ({ default: module.PromosPage })));
const DriverApplyPage = lazy(() => import('./pages/driver/DriverApplyPage').then((module) => ({ default: module.DriverApplyPage })));
const DriverDocumentsPage = lazy(() => import('./pages/driver/DriverDocumentsPage').then((module) => ({ default: module.DriverDocumentsPage })));
const DriverVehiclesPage = lazy(() => import('./pages/driver/DriverVehiclesPage').then((module) => ({ default: module.DriverVehiclesPage })));
const PaymentResultPage = lazy(() => import('./pages/passenger/PaymentResultPage').then((module) => ({ default: module.PaymentResultPage })));
const ZonesPage = lazy(() => import('./pages/admin/ZonesPage').then((module) => ({ default: module.ZonesPage })));

function App() {
  return (
    <>
      <Suspense fallback={<FullScreenSpinner />}>
        <Routes>
        {}
        <Route path="/welcome" element={<HomePage />} />

        <Route element={<AuthLayout />}>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<OtpVerifyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset" element={<Navigate to="/forgot-password" replace />} />
        </Route>

        {}
        <Route
          path="/driver/apply"
          element={
            <ProtectedRoute>
              <DriverApplyPage />
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
          <Route path="/payments/:publicId" element={<PaymentResultPage />} />
          <Route path="/promos" element={<PromosPage />} />
          <Route path="/account/places" element={<SavedPlacesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
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
          <Route path="documents" element={<DriverDocumentsPage />} />
          <Route path="vehicles" element={<DriverVehiclesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
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
          <Route path="documents" element={<DriverApprovalsPage documentsOnly />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="zones" element={<ZonesPage />} />
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
