# Authorization Report

Profile: `therapy_practice`

This report documents the route-level authorization contract used when this app was generated.

Generation is blocked unless `scripts/validate_authorization.py` passes in the Launch Kit factory.

## Included modules

- `public_site`
- `landing_sections`
- `blog`
- `health`
- `auth`
- `users`
- `roles`
- `files`
- `email`
- `email_templates`
- `invitations`
- `app_settings`
- `contact_messages`
- `therapist_profiles`
- `services`
- `availability`
- `appointments`
- `client_records`
- `booking_engine`
- `commerce_core`
- `payment_requests`
- `cart_checkout`
- `payment_attempts`
- `mpesa_payments`
- `receipts`
- `fulfillment`

## Route access contract

### `public_site`

No backend route metadata declared. This is expected for frontend-only modules.

### `landing_sections`

#### `GET /landing-sections`

- Access: `permission`
- Permission: `landing_sections.read`
- Reason: Admin landing section list.

#### `GET /landing-sections/public/{page}`

- Access: `public`
- Reason: Public page content.

#### `POST /landing-sections`

- Access: `permission`
- Permission: `landing_sections.create`
- Reason: Admin landing section creation.

#### `PATCH /landing-sections/{item_id}`

- Access: `permission`
- Permission: `landing_sections.update`
- Reason: Admin landing section update.

### `blog`

#### `GET /blog/public`

- Access: `public`
- Reason: Public list of published blog posts.

#### `GET /blog/public/{slug}`

- Access: `public`
- Reason: Public published blog post detail.

#### `GET /blog`

- Access: `permission`
- Permission: `blog.read`
- Reason: Editorial list including drafts.

#### `POST /blog`

- Access: `permission`
- Permission: `blog.create`
- Reason: Create a blog post.

#### `PATCH /blog/{post_id}`

- Access: `permission`
- Permission: `blog.update`
- Reason: Update or publish a blog post.

#### `DELETE /blog/{post_id}`

- Access: `permission`
- Permission: `blog.delete`
- Reason: Delete a blog post.

### `health`

#### `GET /health`

- Access: `public`
- Reason: Public liveness check.

#### `GET /health/deep`

- Access: `public`
- Reason: Public deep health check without secrets.

### `auth`

#### `POST /auth/verify-email`

- Access: `public`
- Rate limit: `auth`
- Reason: Public email verification endpoint.

#### `POST /auth/forgot-password`

- Access: `public`
- Rate limit: `auth`
- Reason: Public password reset request endpoint.

#### `POST /auth/reset-password`

- Access: `public`
- Rate limit: `auth`
- Reason: Public password reset completion endpoint.

#### `POST /auth/login`

- Access: `public`
- Rate limit: `auth`
- Reason: Public login endpoint.

#### `POST /auth/refresh`

- Access: `public`
- Rate limit: `auth`
- Reason: Refresh token exchange endpoint.

#### `POST /auth/logout`

- Access: `public`
- Rate limit: `auth`
- Reason: Refresh token revocation endpoint.

#### `GET /auth/me`

- Access: `authenticated`
- Reason: Current authenticated user profile.

### `users`

#### `GET /users`

- Access: `permission`
- Permission: `users.read`
- Reason: Admin user list.

#### `PATCH /users/{user_id}`

- Access: `permission`
- Permission: `users.update`
- Reason: Admin user update.

#### `PATCH /users/{user_id}/team-role`

- Access: `permission`
- Permissions: `users.update`, `invitations.manage`
- Reason: Change an existing team member to a role managed by the current actor under the invitation staffing policy.

### `roles`

#### `GET /roles`

- Access: `permission`
- Permission: `roles.read`
- Reason: Admin role list.

### `files`

#### `GET /files`

- Access: `permission`
- Permission: `files.read`
- Reason: Admin file list.

#### `GET /files/public/{file_id}`

- Access: `public`
- Reason: Public file serving endpoint.

#### `POST /files`

- Access: `permission`
- Permission: `files.upload`
- Reason: Protected file metadata creation.

#### `POST /files/upload`

- Access: `permission`
- Permission: `files.upload`
- Rate limit: `upload`
- Reason: Protected file upload endpoint.

#### `DELETE /files/{file_id}`

- Access: `permission`
- Permission: `files.delete`
- Reason: Protected file deletion.

### `email`

#### `GET /email/logs`

- Access: `permission`
- Permission: `email_logs.read`
- Reason: Admin email delivery logs.

### `email_templates`

#### `GET /email-templates`

- Access: `permission`
- Permission: `email_templates.read`
- Reason: Admin email template list.

#### `POST /email-templates`

- Access: `permission`
- Permission: `email_templates.create`
- Reason: Create a transactional email template.

#### `PATCH /email-templates/{item_id}`

- Access: `permission`
- Permission: `email_templates.update`
- Reason: Update a transactional email template.

### `invitations`

#### `GET /invitations`

- Access: `permission`
- Permission: `invitations.read`
- Reason: List paginated staff invitations for authorized administrators.

#### `GET /invitations/options`

- Access: `permission`
- Permission: `invitations.manage`
- Reason: List only the invitation roles the current actor may assign, with live capacity information.

#### `POST /invitations`

- Access: `permission`
- Permission: `invitations.manage`
- Rate limit: `invitation_manage`
- Reason: Create and deliver a policy-authorized staff invitation.

#### `POST /invitations/{invitation_id}/revoke`

- Access: `permission`
- Permission: `invitations.manage`
- Rate limit: `invitation_manage`
- Reason: Revoke a pending invitation managed by the actor's role.

#### `POST /invitations/{invitation_id}/resend`

- Access: `permission`
- Permission: `invitations.manage`
- Rate limit: `invitation_manage`
- Reason: Rotate and resend a pending invitation token.

#### `POST /invitations/accept`

- Access: `public`
- Rate limit: `auth`
- Reason: Accept a signed, expiring, single-use invitation and create a new staff account.

### `app_settings`

#### `GET /app-settings`

- Access: `permission`
- Permission: `settings.read`
- Reason: Admin settings list.

#### `POST /app-settings`

- Access: `permission`
- Permission: `settings.manage`
- Reason: Admin settings creation.

### `contact_messages`

#### `POST /contact-messages`

- Access: `public`
- Rate limit: `contact_submission`
- Reason: Public contact form submission.

#### `GET /contact-messages`

- Access: `permission`
- Permission: `contact_messages.read`
- Reason: Admin contact message list.

#### `PATCH /contact-messages/{message_id}`

- Access: `permission`
- Permission: `contact_messages.update`
- Reason: Admin contact message update.

#### `DELETE /contact-messages/{message_id}`

- Access: `permission`
- Permission: `contact_messages.delete`
- Reason: Admin contact message deletion.

### `therapist_profiles`

#### `GET /therapist-profiles/public`

- Access: `public`
- Reason: Public therapist profile listing.

#### `GET /therapist-profiles/public/{slug}`

- Access: `public`
- Reason: Public therapist profile detail.

#### `GET /therapist-profiles/me`

- Access: `permission`
- Permission: `therapist_profiles.own.read`
- Reason: Therapist reads the professional profile linked to the authenticated account.

#### `POST /therapist-profiles/me`

- Access: `permission`
- Permission: `therapist_profiles.own.create`
- Reason: Therapist creates the profile and initial working revision for the authenticated account.

#### `PATCH /therapist-profiles/me`

- Access: `permission`
- Permission: `therapist_profiles.own.update`
- Reason: Therapist edits only the current account's working professional-profile revision.

#### `POST /therapist-profiles/me/submit`

- Access: `permission`
- Permission: `therapist_profiles.own.submit`
- Reason: Therapist submits the current account's working revision for practice review.

#### `GET /therapist-profiles/review-queue`

- Access: `permission`
- Permission: `therapist_profiles.review`
- Reason: Practice Admin lists therapist profile revisions awaiting review.

#### `GET /therapist-profiles/revisions/{revision_id}`

- Access: `permission`
- Permission: `therapist_profiles.review`
- Reason: Practice Admin inspects a submitted therapist profile revision and its current public profile.

#### `PATCH /therapist-profiles/revisions/{revision_id}`

- Access: `permission`
- Permission: `therapist_profiles.review`
- Reason: Practice Admin corrects professional content on a pending therapist profile revision without changing live public content.

#### `POST /therapist-profiles/revisions/{revision_id}/review`

- Access: `permission`
- Permission: `therapist_profiles.review`
- Reason: Practice Admin approves a pending revision or requests changes with reviewer feedback.

#### `GET /therapist-profiles`

- Access: `permission`
- Permission: `therapist_profiles.read`
- Reason: Admin therapist profile list.

#### `POST /therapist-profiles`

- Access: `permission`
- Permission: `therapist_profiles.create`
- Reason: Admin therapist profile creation.

#### `POST /therapist-profiles/{profile_id}/revisions`

- Access: `permission`
- Permission: `therapist_profiles.review`
- Reason: Practice Admin starts a new professional-content revision for an existing therapist profile.

#### `GET /therapist-profiles/publication-queue`

- Access: `permission`
- Permission: `therapist_profiles.publish`
- Reason: Practice Admin lists approved therapist revisions awaiting explicit publication.

#### `POST /therapist-profiles/revisions/{revision_id}/publish`

- Access: `permission`
- Permission: `therapist_profiles.publish`
- Reason: Practice Admin explicitly publishes an approved therapist profile revision.

#### `POST /therapist-profiles/{profile_id}/unpublish`

- Access: `permission`
- Permission: `therapist_profiles.publish`
- Reason: Practice Admin removes a therapist profile from public visibility without destroying publication history.

#### `GET /therapist-profiles/account-options`

- Access: `permission`
- Permission: `therapist_profiles.update`
- Reason: Admin lists active Therapist-role accounts eligible for profile linking.

#### `PATCH /therapist-profiles/{profile_id}/account`

- Access: `permission`
- Permission: `therapist_profiles.update`
- Reason: Admin links or unlinks a therapist login account from its therapist profile.

#### `PATCH /therapist-profiles/{profile_id}`

- Access: `permission`
- Permission: `therapist_profiles.update`
- Reason: Admin therapist profile update.

#### `DELETE /therapist-profiles/{profile_id}`

- Access: `permission`
- Permission: `therapist_profiles.delete`
- Reason: Admin therapist profile deletion.

### `services`

#### `GET /services/public`

- Access: `public`
- Reason: Public service listing.

#### `GET /services/public/{slug}`

- Access: `public`
- Reason: Public service detail.

#### `GET /services`

- Access: `permission`
- Permission: `services.read`
- Reason: Admin service list.

#### `POST /services`

- Access: `permission`
- Permission: `services.create`
- Reason: Admin service creation.

#### `PATCH /services/{service_id}`

- Access: `permission`
- Permission: `services.update`
- Reason: Admin service update.

#### `DELETE /services/{service_id}`

- Access: `permission`
- Permission: `services.delete`
- Reason: Admin service deletion.

### `availability`

#### `GET /availability/rules`

- Access: `permission`
- Permission: `availability.read`
- Reason: Admin availability rule list.

#### `POST /availability/rules`

- Access: `permission`
- Permission: `availability.create`
- Reason: Admin availability rule creation.

#### `PATCH /availability/rules/{rule_id}`

- Access: `permission`
- Permission: `availability.update`
- Reason: Admin availability rule update.

#### `DELETE /availability/rules/{rule_id}`

- Access: `permission`
- Permission: `availability.delete`
- Reason: Admin availability rule deletion.

#### `GET /availability/exceptions`

- Access: `permission`
- Permission: `availability.read`
- Reason: Admin availability exception list.

#### `POST /availability/exceptions`

- Access: `permission`
- Permission: `availability.create`
- Reason: Admin availability exception creation.

#### `PATCH /availability/exceptions/{exception_id}`

- Access: `permission`
- Permission: `availability.update`
- Reason: Admin availability exception update.

#### `DELETE /availability/exceptions/{exception_id}`

- Access: `permission`
- Permission: `availability.delete`
- Reason: Admin availability exception deletion.

#### `GET /availability/my/rules`

- Access: `permission`
- Permission: `availability.own.read`
- Reason: A therapist reads recurring availability assigned to their linked therapist profile.

#### `POST /availability/my/rules`

- Access: `permission`
- Permission: `availability.own.create`
- Reason: A therapist creates recurring availability assigned to their linked therapist profile.

#### `PATCH /availability/my/rules/{rule_id}`

- Access: `permission`
- Permission: `availability.own.update`
- Reason: A therapist updates recurring availability assigned to their linked therapist profile.

#### `DELETE /availability/my/rules/{rule_id}`

- Access: `permission`
- Permission: `availability.own.delete`
- Reason: A therapist deletes recurring availability assigned to their linked therapist profile.

#### `GET /availability/my/exceptions`

- Access: `permission`
- Permission: `availability.own.read`
- Reason: A therapist reads schedule exceptions assigned to their linked therapist profile.

#### `POST /availability/my/exceptions`

- Access: `permission`
- Permission: `availability.own.create`
- Reason: A therapist creates schedule exceptions assigned to their linked therapist profile.

#### `PATCH /availability/my/exceptions/{exception_id}`

- Access: `permission`
- Permission: `availability.own.update`
- Reason: A therapist updates schedule exceptions assigned to their linked therapist profile.

#### `DELETE /availability/my/exceptions/{exception_id}`

- Access: `permission`
- Permission: `availability.own.delete`
- Reason: A therapist deletes schedule exceptions assigned to their linked therapist profile.

### `appointments`

#### `GET /appointments`

- Access: `permission`
- Permission: `appointments.read`
- Reason: Admin appointment list.

#### `POST /appointments`

- Access: `permission`
- Permission: `appointments.create`
- Reason: Admin appointment creation.

#### `GET /appointments/{appointment_id}`

- Access: `permission`
- Permission: `appointments.read`
- Reason: Admin appointment detail.

#### `PATCH /appointments/{appointment_id}`

- Access: `permission`
- Permission: `appointments.update`
- Reason: Admin appointment update.

#### `DELETE /appointments/{appointment_id}`

- Access: `permission`
- Permission: `appointments.delete`
- Reason: Admin appointment deletion.

### `client_records`

#### `GET /client-records`

- Access: `permission`
- Permission: `client_records.read`
- Reason: Admin client record list.

#### `POST /client-records`

- Access: `permission`
- Permission: `client_records.create`
- Reason: Create a non-clinical client record manually.

#### `POST /client-records/from-appointment`

- Access: `permission`
- Permission: `client_records.create`
- Reason: Create or link a client record from an appointment.

#### `POST /client-records/from-commerce-order`

- Access: `permission`
- Permission: `client_records.create`
- Reason: Create or link a client record from a commerce order.

#### `GET /client-records/{client_record_id}`

- Access: `permission`
- Permission: `client_records.read`
- Reason: Admin client record detail.

#### `PATCH /client-records/{client_record_id}`

- Access: `permission`
- Permission: `client_records.update`
- Reason: Update non-clinical client record metadata.

### `booking_engine`

#### `GET /booking-engine/public/config`

- Access: `public`
- Reason: Public profile-compiled booking formats, locations, and workflow settings.

#### `GET /booking-engine/public/available-dates`

- Access: `public`
- Reason: Public privacy-safe list of dates containing at least one bookable slot for the selected service and booking preferences.

#### `GET /booking-engine/public/slots`

- Access: `public`
- Reason: Public privacy-safe aggregated bookable slots; raw therapist schedules and allocation candidates remain private.

#### `POST /booking-engine/public/bookings`

- Access: `public`
- Rate limit: `appointment_request`
- Reason: Atomically create a no-advance-payment booking using the configured confirmation mode.

#### `POST /booking-engine/public/holds`

- Access: `public`
- Rate limit: `booking_hold`
- Reason: Public temporary booking hold creation.

#### `POST /booking-engine/public/holds/{hold_id}/payment-request`

- Access: `public`
- Rate limit: `checkout_payment`
- Reason: Idempotently create a server-priced payment request from a valid advance-payment booking hold.

#### `POST /booking-engine/public/holds/{hold_id}/confirm`

- Access: `public`
- Rate limit: `appointment_request`
- Reason: Convert a capability-scoped active booking hold into an appointment request.

#### `GET /booking-engine/settings`

- Access: `permission`
- Permission: `booking_engine.read`
- Reason: Read saved practice-wide booking payment and confirmation defaults, with profile defaults used when no database settings row exists.

#### `PUT /booking-engine/settings`

- Access: `permission`
- Permission: `booking_engine.update`
- Reason: Create or update practice-wide booking payment and confirmation defaults.

#### `GET /booking-engine/holds`

- Access: `permission`
- Permission: `booking_engine.read`
- Reason: Admin booking hold list.

#### `PATCH /booking-engine/holds/{hold_id}`

- Access: `permission`
- Permission: `booking_engine.update`
- Reason: Admin booking hold update.

#### `DELETE /booking-engine/holds/{hold_id}`

- Access: `permission`
- Permission: `booking_engine.delete`
- Reason: Admin booking hold deletion.

### `commerce_core`

#### `GET /commerce-core/public/items`

- Access: `public`
- Reason: Public commerce item catalog.

#### `GET /commerce-core/public/items/{slug}`

- Access: `public`
- Reason: Public commerce item detail.

#### `POST /commerce-core/public/orders`

- Access: `public`
- Rate limit: `checkout_order`
- Reason: Public checkout order creation from server-priced published catalog items before payment.

#### `GET /commerce-core/items`

- Access: `permission`
- Permission: `commerce_core.read`
- Reason: Admin commerce item list.

#### `POST /commerce-core/items`

- Access: `permission`
- Permission: `commerce_core.create`
- Reason: Admin commerce item creation.

#### `PATCH /commerce-core/items/{item_id}`

- Access: `permission`
- Permission: `commerce_core.update`
- Reason: Admin commerce item update.

#### `DELETE /commerce-core/items/{item_id}`

- Access: `permission`
- Permission: `commerce_core.delete`
- Reason: Admin commerce item deletion.

#### `GET /commerce-core/orders`

- Access: `permission`
- Permission: `commerce_core.read`
- Reason: Admin commerce order list.

#### `POST /commerce-core/orders`

- Access: `permission`
- Permission: `commerce_core.create`
- Reason: Admin commerce order creation.

#### `GET /commerce-core/orders/{order_id}`

- Access: `permission`
- Permission: `commerce_core.read`
- Reason: Admin commerce order detail.

#### `PATCH /commerce-core/orders/{order_id}`

- Access: `permission`
- Permission: `commerce_core.update`
- Reason: Admin commerce order update.

#### `DELETE /commerce-core/orders/{order_id}`

- Access: `permission`
- Permission: `commerce_core.delete`
- Reason: Admin commerce order deletion.

### `payment_requests`

#### `POST /payment-requests/public/from-order`

- Access: `public`
- Rate limit: `checkout_payment`
- Reason: Public creation of a pending payment request from a commerce order.

#### `GET /payment-requests`

- Access: `permission`
- Permission: `payment_requests.read`
- Reason: Admin payment request list.

#### `POST /payment-requests/from-order`

- Access: `permission`
- Permission: `payment_requests.create`
- Reason: Admin payment request creation from a commerce order.

#### `GET /payment-requests/{payment_request_id}`

- Access: `permission`
- Permission: `payment_requests.read`
- Reason: Admin payment request detail.

#### `PATCH /payment-requests/{payment_request_id}`

- Access: `permission`
- Permission: `payment_requests.update`
- Reason: Admin payment request status and reference update.

### `cart_checkout`

### `payment_attempts`

#### `GET /payment-attempts`

- Access: `permission`
- Permission: `payment_attempts.read`
- Reason: Admin payment attempt list.

#### `POST /payment-attempts/from-request`

- Access: `permission`
- Permission: `payment_attempts.create`
- Reason: Admin creation of a payment attempt from a payment request.

#### `GET /payment-attempts/{attempt_id}`

- Access: `permission`
- Permission: `payment_attempts.read`
- Reason: Admin payment attempt detail.

#### `POST /payment-attempts/provider-events`

- Access: `permission`
- Permission: `payment_attempts.verify`
- Reason: Admin or verified provider event recording.

#### `POST /payment-attempts/public/provider-events`

- Access: `public`
- Rate limit: `provider_callback`
- Reason: Public provider callback intake. Events are forced unverified until provider-specific verification exists.

#### `POST /payment-attempts/provider-events/{provider_event_id}/verify`

- Access: `permission`
- Permission: `payment_attempts.verify`
- Reason: Admin verification of a stored payment provider event.

### `mpesa_payments`

#### `POST /mpesa-payments/stk-push/prepare`

- Access: `permission`
- Permission: `mpesa_payments.initiate`
- Reason: Prepare an M-Pesa STK Push payment attempt without sending a live Daraja request in V2.4.

#### `POST /mpesa-payments/public/payment-requests/{payment_request_id}/stk-push/prepare`

- Access: `public`
- Rate limit: `checkout_payment`
- Reason: Prepare an idempotent M-Pesa payment attempt from a capability-scoped booking payment request. The amount, currency, provider, reference, and description remain server controlled.

#### `POST /mpesa-payments/public/payment-requests/{payment_request_id}/stk-push/initiate`

- Access: `public`
- Rate limit: `checkout_payment`
- Reason: Submit an idempotent M-Pesa STK Push using the amount, currency, provider, target, reference, and description stored server-side.

#### `POST /mpesa-payments/callbacks/stk`

- Access: `public`
- Rate limit: `provider_callback`
- Reason: Receive sanitized M-Pesa STK callbacks, verify matched callbacks against Daraja query evidence, settle eligible bookings, and issue one idempotent receipt for successful payments.

#### `POST /mpesa-payments/callbacks/{provider_event_id}/verify`

- Access: `permission`
- Permission: `payment_attempts.verify`
- Reason: Admin verification of a stored M-Pesa callback event.

### `receipts`

#### `GET /receipts`

- Access: `permission`
- Permission: `receipts.read`
- Reason: Admin receipt list.

#### `POST /receipts/from-payment-request`

- Access: `permission`
- Permission: `receipts.create`
- Reason: Generate or return the single receipt for a paid commerce or booking payment request.

#### `GET /receipts/{receipt_id}`

- Access: `permission`
- Permission: `receipts.read`
- Reason: Admin receipt detail.

#### `PATCH /receipts/{receipt_id}`

- Access: `permission`
- Permission: `receipts.update`
- Reason: Void or update a receipt record.

### `fulfillment`

#### `GET /fulfillment`

- Access: `permission`
- Permission: `fulfillment.read`
- Reason: Admin fulfillment list.

#### `POST /fulfillment/from-receipt`

- Access: `permission`
- Permission: `fulfillment.create`
- Reason: Create a fulfillment record from an issued receipt.

#### `GET /fulfillment/{fulfillment_id}`

- Access: `permission`
- Permission: `fulfillment.read`
- Reason: Admin fulfillment detail.

#### `PATCH /fulfillment/{fulfillment_id}`

- Access: `permission`
- Permission: `fulfillment.update`
- Reason: Update fulfillment status or metadata.

## Summary

- Total declared routes: `145`
- Public routes: `33`
- Public write routes: `18`
- Authenticated routes: `1`
- Permission-protected routes: `111`

## Safety notes

- Public write routes must declare a rate limit.
- Permission-protected routes must use seeded permissions.
- App profiles must only reference modules that exist in `module_registry`.
- Backend modules must declare route-level authorization metadata.
- Role assignment requires `roles.manage`.
- App generation requires `developer_console.manage` in the factory app.
