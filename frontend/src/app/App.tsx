import { Route, Routes } from "react-router";

import { DashboardLayout } from "../components/layout/DashboardLayout";
import { PublicLayout } from "../components/layout/PublicLayout";
import { SEO } from "../components/SEO";
import { ProtectedRoute } from "../features/auth/pages/ProtectedRoute";
import { PermissionRoute } from "../features/auth/pages/PermissionRoute";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../features/auth/pages/ResetPasswordPage";
import { NotFoundPage } from "../features/auth/pages/NotFoundPage";
import { DashboardHomePage } from "../features/dashboard/pages/DashboardHomePage";
import { PublicAppointmentRequestPage } from "../features/appointments/pages/PublicAppointmentRequestPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { PublicBlogPage } from "../features/blog/pages/PublicBlogPage";
import { PublicBlogPostPage } from "../features/blog/pages/PublicBlogPostPage";
import { PublicStorePage } from "../features/cart-checkout/pages/PublicStorePage";
import { PublicStoreItemPage } from "../features/cart-checkout/pages/PublicStoreItemPage";
import { PublicCartPage } from "../features/cart-checkout/pages/PublicCartPage";
import { PublicCheckoutPage } from "../features/cart-checkout/pages/PublicCheckoutPage";
import { PublicContactPage } from "../features/contact-messages/pages/PublicContactPage";
import { AcceptInvitationPage } from "../features/invitations/pages/AcceptInvitationPage";
import { HomePage } from "../features/public/pages/HomePage";
import { AboutPage } from "../features/public/pages/AboutPage";
import { PublicAvailabilityRedirect } from "../features/public/pages/PublicAvailabilityRedirect";
import { PublicLegalPage } from "../features/public/pages/PublicLegalPage";
import { PublicServicesPage } from "../features/services/pages/PublicServicesPage";
import { PublicServiceDetailPage } from "../features/services/pages/PublicServiceDetailPage";
import { PublicTherapistProfilesPage } from "../features/therapist-profiles/pages/PublicTherapistProfilesPage";
import { PublicTherapistProfileDetailPage } from "../features/therapist-profiles/pages/PublicTherapistProfileDetailPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { AppointmentsWorkspacePage } from "../features/appointments/pages/AppointmentsWorkspacePage";
import { AvailabilityPage } from "../features/availability/pages/AvailabilityPage";
import { BlogAdminPage } from "../features/blog/pages/BlogAdminPage";
import { MyBlogArticlesPage } from "../features/blog/pages/MyBlogArticlesPage";
import { BookingHoldsPage } from "../features/booking-engine/pages/BookingHoldsPage";
import { BookingSettingsPage } from "../features/booking-engine/pages/BookingSettingsPage";
import { ClientRecordsPage } from "../features/client-records/pages/ClientRecordsPage";
import { CommerceCorePage } from "../features/commerce-core/pages/CommerceCorePage";
import { ContactMessagesPage } from "../features/contact-messages/pages/ContactMessagesPage";
import { EmailTemplatesPage } from "../features/email-templates/pages/EmailTemplatesPage";
import { EmailLogsPage } from "../features/email/pages/EmailLogsPage";
import { FilesPage } from "../features/files/pages/FilesPage";
import { FulfillmentPage } from "../features/fulfillment/pages/FulfillmentPage";
import { TeamPage } from "../features/invitations/pages/TeamPage";
import { ContentPage } from "../features/content/pages/ContentPage";
import { MpesaPaymentsPage } from "../features/mpesa-payments/pages/MpesaPaymentsPage";
import { PaymentAttemptsPage } from "../features/payment-attempts/pages/PaymentAttemptsPage";
import { PaymentRequestsPage } from "../features/payment-requests/pages/PaymentRequestsPage";
import { ReceiptsPage } from "../features/receipts/pages/ReceiptsPage";
import { PublicReceiptPage } from "../features/receipts/pages/PublicReceiptPage";
import { ServicesPage } from "../features/services/pages/ServicesPage";
import { TherapistProfilesPage } from "../features/therapist-profiles/pages/TherapistProfilesPage";
import { TherapistProfileReviewPage } from "../features/therapist-profiles/pages/TherapistProfileReviewPage";
import { MyTherapistProfilePage } from "../features/therapist-profiles/pages/MyTherapistProfilePage";

export function App() {
  return (
    <>
      <SEO />
      <Routes>
        <Route path="/receipt/:paymentRequestId" element={<PublicReceiptPage />} />
        <Route element={<PublicLayout />}>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/book" element={<PublicAppointmentRequestPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/blog" element={<PublicBlogPage />} />
        <Route path="/blog/:slug" element={<PublicBlogPostPage />} />
        <Route path="/store" element={<PublicStorePage />} />
        <Route path="/store/:slug" element={<PublicStoreItemPage />} />
        <Route path="/cart" element={<PublicCartPage />} />
        <Route path="/checkout" element={<PublicCheckoutPage />} />
        <Route path="/contact" element={<PublicContactPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/availability" element={<PublicAvailabilityRedirect />} />
        <Route path="/privacy" element={<PublicLegalPage />} />
        <Route path="/terms" element={<PublicLegalPage />} />
        <Route path="/accessibility" element={<PublicLegalPage />} />
        <Route path="/cancellations" element={<PublicLegalPage />} />
        <Route path="/shipping-returns" element={<PublicLegalPage />} />
        <Route path="/services" element={<PublicServicesPage />} />
        <Route path="/services/:slug" element={<PublicServiceDetailPage />} />
        <Route path="/therapists" element={<PublicTherapistProfilesPage />} />
        <Route path="/therapists/:slug" element={<PublicTherapistProfileDetailPage />} />
      </Route>

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHomePage />} />
        <Route path="settings" element={<PermissionRoute permission="settings.read"><SettingsPage /></PermissionRoute>} />
        <Route
          path="appointments"
          element={
            <PermissionRoute
              permission={[
                "appointments.read",
                "appointments.own.read",
              ]}
            >
              <AppointmentsWorkspacePage />
            </PermissionRoute>
          }
        />
        <Route path="availability" element={<PermissionRoute permission="availability.own.read"><AvailabilityPage /></PermissionRoute>} />
        <Route path="blog" element={<PermissionRoute permission="blog.read"><BlogAdminPage /></PermissionRoute>} />
        <Route
          path="my-articles"
          element={
            <PermissionRoute permission="blog.own.read">
              <MyBlogArticlesPage />
            </PermissionRoute>
          }
        />
        <Route path="booking-holds" element={<PermissionRoute permission="booking_engine.read"><BookingHoldsPage /></PermissionRoute>} />
        <Route path="booking-settings" element={<PermissionRoute permission="booking_engine.read"><BookingSettingsPage /></PermissionRoute>} />
        <Route path="client-records" element={<PermissionRoute permission="client_records.read"><ClientRecordsPage /></PermissionRoute>} />
        <Route path="commerce" element={<PermissionRoute permission="commerce_core.read"><CommerceCorePage view="products" /></PermissionRoute>} />
        <Route path="products" element={<PermissionRoute permission="commerce_core.read"><CommerceCorePage view="products" /></PermissionRoute>} />
        <Route path="orders" element={<PermissionRoute permission="commerce_core.read"><CommerceCorePage view="orders" /></PermissionRoute>} />
        <Route path="contact-messages" element={<PermissionRoute permission="contact_messages.read"><ContactMessagesPage /></PermissionRoute>} />
        <Route path="email-templates" element={<PermissionRoute permission="email_templates.read"><EmailTemplatesPage /></PermissionRoute>} />
        <Route
          path="email-logs"
          element={
            <PermissionRoute permission="email_logs.read">
              <EmailLogsPage />
            </PermissionRoute>
          }
        />
        <Route path="files" element={<PermissionRoute permission="files.read"><FilesPage /></PermissionRoute>} />
        <Route path="fulfillment" element={<PermissionRoute permission="fulfillment.read"><FulfillmentPage /></PermissionRoute>} />
        <Route path="team" element={<PermissionRoute permission="users.read"><TeamPage /></PermissionRoute>} />
        <Route path="content" element={<PermissionRoute permission="landing_sections.update"><ContentPage /></PermissionRoute>} />
        <Route path="mpesa-payments" element={<PermissionRoute permission="mpesa_payments.read"><MpesaPaymentsPage /></PermissionRoute>} />
        <Route path="payment-attempts" element={<PermissionRoute permission="payment_attempts.read"><PaymentAttemptsPage /></PermissionRoute>} />
        <Route path="payment-requests" element={<PermissionRoute permission="payment_requests.read"><PaymentRequestsPage /></PermissionRoute>} />
        <Route path="receipts" element={<PermissionRoute permission="receipts.read"><ReceiptsPage /></PermissionRoute>} />
        <Route path="services" element={<PermissionRoute permission="services.read"><ServicesPage /></PermissionRoute>} />
        <Route
          path="therapist-profiles/reviews/:revisionId"
          element={
            <PermissionRoute permission="therapist_profiles.review">
              <TherapistProfileReviewPage />
            </PermissionRoute>
          }
        />
        <Route path="therapist-profiles" element={<PermissionRoute permission="therapist_profiles.read"><TherapistProfilesPage /></PermissionRoute>} />
        <Route path="my-profile" element={<PermissionRoute permission="therapist_profiles.own.read"><MyTherapistProfilePage /></PermissionRoute>} />
      </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
