import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/useAuth'
import { tenantSideEnabledForEmail } from './lib/featureFlags'
import { MetaPixelTracker } from './components/MetaPixelTracker'
import { RecoveryLinkHandler } from './components/RecoveryLinkHandler'
import { AdminLayout } from './components/AdminLayout'
import { Layout } from './components/Layout'
import { OnboardingLayout } from './components/OnboardingLayout'
import { PostLoginRedirect } from './components/PostLoginRedirect'
import { TenantLayout } from './components/TenantLayout'
import { HomePage } from './pages/HomePage'
import { AccountPage } from './pages/AccountPage'
import { AccountSettingsPage } from './pages/AccountSettingsPage'
import { ChangeEmailPage } from './pages/ChangeEmailPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { EditProfilePage } from './pages/EditProfilePage'
import { EditBioPage } from './pages/EditBioPage'
import { EditRentalHistoryPage } from './pages/EditRentalHistoryPage'
import { EditEmploymentHistoryPage } from './pages/EditEmploymentHistoryPage'
import { EditIncomePage } from './pages/EditIncomePage'
import { EditLeasePreferencesPage } from './pages/EditLeasePreferencesPage'
import { LegalPage } from './pages/LegalPage'
import { PaymentMethodPage } from './pages/PaymentMethodPage'
import { PaymentHistoryPage } from './pages/PaymentHistoryPage'
import { SupportPage } from './pages/SupportPage'
import { TenantsPage } from './pages/TenantsPage'
import { WelcomePage } from './pages/WelcomePage'
import { RoleSelectionPage } from './pages/RoleSelectionPage'
import { RentalNeedsPage } from './pages/RentalNeedsPage'
import { ProfileCreationPage } from './pages/ProfileCreationPage'
import { MessagingPage } from './pages/MessagingPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SignupPage } from './pages/SignupPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { VerifyEmailSuccessPage } from './pages/VerifyEmailSuccessPage'
import { YourMatchesPage } from './pages/YourMatchesPage'
import { LandlordMatchPage } from './pages/LandlordMatchPage'
import { LeasePreferencesPage } from './pages/LeasePreferencesPage'
import { TenantQuestionnairePage } from './pages/TenantQuestionnairePage'
import { IdentityVerificationPage } from './pages/IdentityVerificationPage'
import { DocusignReturnPage } from './pages/DocusignReturnPage'
import { CompatibilitySurveyPage } from './pages/CompatibilitySurveyPage'
import { ApplicationDetailsPage } from './pages/ApplicationDetailsPage'
import { ReviewSubmittedPage } from './pages/ReviewSubmittedPage'
import { UniversalApplicationPage } from './pages/UniversalApplicationPage'
import { PropertyDetailsPage } from './pages/PropertyDetailsPage'
import { LandlordProfilePreviewPage } from './pages/LandlordProfilePreviewPage'
import { LandlordPropertyDetailsPage } from './pages/LandlordPropertyDetailsPage'
import { PropertiesPage } from './pages/PropertiesPage'
import { PropertyPublishedPage } from './pages/PropertyPublishedPage'
import { LandlordTenantProfilePage } from './pages/LandlordTenantProfilePage'
import { TenantLandlordProfilePage } from './pages/TenantLandlordProfilePage'
import { LandlordTenantReviewsPage } from './pages/LandlordTenantReviewsPage'
import { AddPropertyIntroPage } from './pages/AddPropertyIntroPage'
import { AddPropertyBasicInfoPage } from './pages/AddPropertyBasicInfoPage'
import { AddPropertyCommunityPage } from './pages/AddPropertyCommunityPage'
import { AddPropertyAmenitiesPage } from './pages/AddPropertyAmenitiesPage'
import { AddPropertyPhotosPage } from './pages/AddPropertyPhotosPage'
import { AddPropertyPreviewPage } from './pages/AddPropertyPreviewPage'
import { AboutPage } from './pages/AboutPage'
import { PublicLegalPage } from './pages/PublicLegalPage'
import { PublicSupportPage } from './pages/PublicSupportPage'
import { RentalApplicationPage } from './pages/RentalApplicationPage'
import { TenantInviteLandingPage } from './pages/TenantInviteLandingPage'
import { TenantAccountReviewsPage } from './pages/TenantAccountReviewsPage'
import { LandlordRatingsGivenPage } from './pages/LandlordRatingsGivenPage'
import { LandlordRatingsReceivedPage } from './pages/LandlordRatingsReceivedPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage'
import { AdminPropertiesPage } from './pages/admin/AdminPropertiesPage'
import { AdminPropertyDetailPage } from './pages/admin/AdminPropertyDetailPage'
import { AdminIssuesPage } from './pages/admin/AdminIssuesPage'
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'
import { AdminProfilePage } from './pages/admin/AdminProfilePage'
import { ListFromReportPage } from './pages/ListFromReportPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-500">Loading...</span>
        <RecoveryLinkHandler />
      </div>
    )
  }

  return (
    <>
    <MetaPixelTracker />
    <RecoveryLinkHandler />
    <Routes>
      <Route path="/" element={user ? <TenantLayout /> : <Layout />}>
        <Route index element={user ? <HomePage /> : <WelcomePage />} />
        <Route path="notifications" element={user ? <NotificationsPage /> : <Navigate to="/login" replace />} />
        <Route path="matches" element={user ? <YourMatchesPage /> : <Navigate to="/login" replace />} />
        <Route path="matches/tenant/:id/reviews" element={user ? <LandlordTenantReviewsPage /> : <Navigate to="/login" replace />} />
        <Route path="matches/tenant/:id" element={user ? <LandlordTenantProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="matches/landlord/:id" element={user ? <TenantLandlordProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="matches/landlord/:id/ratings" element={user ? <LandlordRatingsReceivedPage /> : <Navigate to="/login" replace />} />
        <Route path="rental-needs" element={user ? <RentalNeedsPage /> : <Navigate to="/login" replace />} />
        <Route path="lease-preferences" element={user ? <LeasePreferencesPage /> : <Navigate to="/login" replace />} />
        <Route path="tenant-questionnaire" element={user ? <TenantQuestionnairePage /> : <Navigate to="/login" replace />} />
        <Route path="applications" element={user ? <Navigate to="/matches?tab=applied" replace /> : <Navigate to="/login" replace />} />
        <Route
          path="applications/apply"
          element={user && tenantSideEnabledForEmail(user.email) ? <UniversalApplicationPage /> : <Navigate to="/login" replace />}
        />
        <Route path="list-from-report" element={<ListFromReportPage />} />
        <Route path="property/:id" element={user ? <PropertyDetailsPage /> : <Navigate to="/login" replace />} />
        <Route path="properties" element={user ? <PropertiesPage /> : <Navigate to="/login" replace />} />
        <Route path="properties/:id" element={user ? <LandlordPropertyDetailsPage /> : <Navigate to="/login" replace />} />
        <Route path="properties/published" element={user ? <PropertyPublishedPage /> : <Navigate to="/login" replace />} />
        <Route path="messages" element={user ? <MessagingPage /> : <Navigate to="/login" replace />} />
        <Route path="account" element={user ? <AccountPage /> : <Navigate to="/login" replace />} />
        <Route path="account/reviews" element={user ? <TenantAccountReviewsPage /> : <Navigate to="/login" replace />} />
        <Route path="account/ratings-given" element={user ? <LandlordRatingsGivenPage /> : <Navigate to="/login" replace />} />
        <Route path="account/rental-application" element={user ? <RentalApplicationPage /> : <Navigate to="/login" replace />} />
        <Route path="account/tenants" element={user ? <TenantsPage /> : <Navigate to="/login" replace />} />
        <Route path="account/application/:id" element={user ? <ApplicationDetailsPage /> : <Navigate to="/login" replace />} />
        <Route path="account/application/:id/review-submitted" element={user ? <ReviewSubmittedPage /> : <Navigate to="/login" replace />} />
        <Route path="account/edit" element={user ? <EditProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="account/edit/bio" element={user ? <EditBioPage /> : <Navigate to="/login" replace />} />
        <Route path="account/edit/rental-history" element={user ? <EditRentalHistoryPage /> : <Navigate to="/login" replace />} />
        <Route path="account/edit/employment" element={user ? <EditEmploymentHistoryPage /> : <Navigate to="/login" replace />} />
        <Route path="account/edit/income" element={user ? <EditIncomePage /> : <Navigate to="/login" replace />} />
        <Route path="account/edit/lease-preferences" element={user ? <EditLeasePreferencesPage /> : <Navigate to="/login" replace />} />
        <Route path="account/profile-preview" element={user ? <LandlordProfilePreviewPage /> : <Navigate to="/login" replace />} />
        <Route path="account/settings" element={user ? <AccountSettingsPage /> : <Navigate to="/login" replace />} />
        <Route path="account/settings/support" element={user ? <SupportPage /> : <Navigate to="/login" replace />} />
        <Route path="account/settings/legal" element={user ? <Navigate to="/account/settings/legal/terms" replace /> : <Navigate to="/login" replace />} />
        <Route path="account/settings/legal/:tab" element={user ? <LegalPage /> : <Navigate to="/login" replace />} />
        <Route path="account/settings/payment-method" element={user ? <PaymentMethodPage /> : <Navigate to="/login" replace />} />
        <Route path="account/settings/payment-history" element={user ? <PaymentHistoryPage /> : <Navigate to="/login" replace />} />
        <Route path="account/settings/change-email" element={user ? <ChangeEmailPage /> : <Navigate to="/login" replace />} />
        <Route path="account/settings/change-password" element={user ? <ChangePasswordPage /> : <Navigate to="/login" replace />} />
        <Route path="survey" element={user ? <Navigate to="/onboarding/survey" replace /> : <Navigate to="/login" replace />} />
        <Route path="survey/intro" element={user ? <Navigate to="/onboarding/survey/intro" replace /> : <Navigate to="/login" replace />} />
      </Route>
      <Route path="/welcome" element={<Navigate to="/" replace />} />
      <Route path="/onboarding" element={user ? <OnboardingLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<RoleSelectionPage />} />
        <Route path="role" element={<RoleSelectionPage />} />
        <Route path="rental-needs" element={<Navigate to="/rental-needs" replace />} />
        <Route path="lease-preferences" element={<Navigate to="/lease-preferences" replace />} />
        <Route path="tenant-questionnaire" element={<Navigate to="/tenant-questionnaire" replace />} />
        <Route path="identity-verification" element={<IdentityVerificationPage />} />
        <Route path="profile" element={<ProfileCreationPage />} />
        <Route path="survey" element={<CompatibilitySurveyPage />} />
        <Route path="survey/intro" element={<LandlordMatchPage />} />
        <Route path="property/intro" element={<AddPropertyIntroPage />} />
        <Route path="property/basic-info" element={<AddPropertyBasicInfoPage />} />
        <Route path="property/community" element={<AddPropertyCommunityPage />} />
        <Route path="property/amenities" element={<AddPropertyAmenitiesPage />} />
        <Route path="property/photos" element={<AddPropertyPhotosPage />} />
        <Route path="property/preview" element={<AddPropertyPreviewPage />} />
      </Route>
      <Route path="/login" element={<Layout />}>
        <Route index element={user ? <PostLoginRedirect /> : <LoginPage />} />
        <Route path="forgot-password" element={user ? <PostLoginRedirect /> : <ForgotPasswordPage />} />
      </Route>
      <Route path="/reset-password" element={<Layout />}>
        <Route index element={<ResetPasswordPage />} />
      </Route>
      <Route path="/signup" element={<Layout />}>
        <Route index element={user ? <PostLoginRedirect /> : <SignupPage />} />
        <Route path="verify" element={<VerifyEmailPage />} />
        <Route path="verified" element={<VerifyEmailSuccessPage />} />
      </Route>
      <Route path="/about" element={<Layout />}>
        <Route index element={<AboutPage />} />
      </Route>
      <Route path="/privacy" element={<Layout />}>
        <Route index element={<PublicLegalPage tab="privacy" />} />
      </Route>
      <Route path="/terms" element={<Layout />}>
        <Route index element={<PublicLegalPage tab="terms" />} />
      </Route>
      <Route path="/support" element={<Layout />}>
        <Route index element={<PublicSupportPage />} />
      </Route>
        <Route path="/invite" element={<Layout />}>
          <Route
            path=":token"
            element={tenantSideEnabledForEmail(user?.email) ? <TenantInviteLandingPage /> : <Navigate to="/" replace />}
          />
      </Route>
      <Route path="/admin" element={user ? <AdminLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:id" element={<AdminUserDetailPage />} />
        <Route path="properties" element={<AdminPropertiesPage />} />
        <Route path="properties/:id" element={<AdminPropertyDetailPage />} />
        <Route path="issues" element={<AdminIssuesPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="profile" element={<AdminProfilePage />} />
        <Route path="change-password" element={<ChangePasswordPage />} />
      </Route>
      <Route path="/docusign/return" element={<DocusignReturnPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
