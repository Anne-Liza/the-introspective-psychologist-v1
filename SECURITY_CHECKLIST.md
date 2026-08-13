# Security Checklist — The Introspective Psychologist

This checklist was generated from the selected app modules.
Review it before deploying the app to production.

## Phase 1 production safety gates

Before production deployment, confirm the following:

- Set `APP_ENV=production` and `DEPLOYMENT_TARGET=production` only after production values are ready.
- Set `API_DOCS_ENABLED=false` in production.
- Do not expose `/docs`, `/redoc`, or `/openapi.json` publicly in production.
- Set `BACKEND_CORS_ORIGINS` to the exact trusted `https://` frontend domain or domains.
- Do not use wildcard CORS (`*`) in production.
- Do not use `localhost`, `127.0.0.1`, or `0.0.0.0` in production CORS origins.
- Set `FRONTEND_BASE_URL` to the production `https://` frontend URL.
- Replace `JWT_SECRET_KEY` with a strong production secret.
- Replace `JWT_REFRESH_SECRET_KEY` with a different strong production secret.
- Generate and protect `DATA_ENCRYPTION_KEY` for encrypted app settings.
- Do not reuse access-token and refresh-token secrets.
- Change `SUPER_DEVELOPER_PASSWORD` before production deployment.
- Change `SUPER_DEVELOPER_EMAIL` to a real admin email before production deployment.
- Keep real secrets in production environment variables, not in Git.
- Treat `.env.example` as documentation only. It should contain placeholders, not real secrets.
- Do not expose PostgreSQL publicly.
- Do not expose Mailpit publicly.
- Treat the generated `docker-compose.yml` as local-development infrastructure unless separately hardened.

The backend includes startup validation for these production safety rules. Unsafe production settings should stop the app from starting.

## Phase 2 rate limiting and abuse prevention

The backend includes application-level rate limiting:

- Global per-IP API request limits.
- Stricter authentication limits for login and registration.
- Identifier-aware authentication limits to slow attacks against one email address.
- Contact form submission limits.
- Upload limits by user and IP.
- `429 Too Many Requests` responses with a `Retry-After` header.
- The limiter does not use server-side sleep; blocked requests return immediately.
- The default in-memory limiter is suitable for local development and single-instance deployments only.
- For multi-instance production, use Redis-backed rate limiting and edge protection such as Cloudflare or another WAF.

## Security headers

The backend adds baseline security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` in production

## Phase 4 authentication and session hardening

The generated backend inherits Launch Kit authentication and session protections:

- Access and refresh tokens use separate secrets.
- Refresh tokens rotate and old refresh tokens cannot be reused.
- Logout revokes refresh tokens.
- Inactive users cannot continue authenticating.
- Reserved JWT claims cannot be overwritten by caller-supplied extra claims.
- Password strength is enforced through the shared password policy.
- Email verification and password reset flows use dedicated token models.
- Time-sensitive auth values use UTC-safe helpers where Launch Kit controls the code path.

## Phase 5 data protection and encryption

The generated backend inherits Launch Kit data-protection helpers:

- Sensitive email and log payloads are redacted before logging.
- App setting secrets can be encrypted at rest.
- Generated runtime environment files include a generated `DATA_ENCRYPTION_KEY`.
- Payment and audit payloads are sanitized before persistence.
- Real secrets must still be supplied through production environment variables.

## Phase 6 file, URL, storage, and content safety

The generated app inherits Launch Kit runtime safety for files, URLs, storage, and text content:

- Uploaded files are validated through `app.core.file_safety`.
- Local stored files are resolved through safe path helpers.
- Dangerous file extensions are blocked.
- Upload MIME types and extensions are checked together.
- URL fields are validated through `app.core.url_safety`.
- Unsafe URL schemes such as `javascript:`, `data:`, `file:`, and `ftp:` are blocked.
- Localhost, private, reserved, and embedded-credential URLs are blocked for external URL fields.
- Public and admin text should remain rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Generated apps do not carry the factory `module_registry`; Launch Kit validates safety inheritance during ejection.

## Phase 9 dependency and supply-chain safety

The generated app inherits Launch Kit supply-chain safety checks:

- `package-lock.json` is kept aligned with the generated frontend package name.
- Generated frontend dependencies are installed with `npm ci` during validation.
- Generated app validation runs supply-chain safety checks before handover.
- `npm audit` must not report moderate, high, or critical vulnerabilities before handover.
- Frontend lockfiles must be committed and must match `package.json`.
- Do not mix package managers unless the dependency policy is updated intentionally.
- Backend requirements must stay pinned with exact `==` versions.
- Review dependency updates before accepting major-version changes.

## App Settings

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Restrict this module to admin or trusted staff roles.
- Review setting changes carefully because they may affect the whole app.

## Appointments

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Authentication

- Configure required environment variables: JWT_SECRET_KEY, JWT_REFRESH_SECRET_KEY.
- Confirm passwords are hashed using a secure password hashing method.
- Never log passwords, access tokens, or refresh tokens.
- Never log: password, access_token, refresh_token.
- Set strong authentication secrets and never commit them to Git.

## Availability

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.

## Blog

- Block unsafe schemes, private hosts, and embedded credentials in URL fields.
- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep URL validators enabled for public and external URL fields.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Booking Engine

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Store, Cart, and Checkout

- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.

## Client Records

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Commerce Core

- Block unsafe schemes, private hosts, and embedded credentials in URL fields.
- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep URL validators enabled for public and external URL fields.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Contact Messages

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Never log: email, message.
- Restrict access to authorized staff only.
- Treat this module as handling personal/user data.

## Email

- Add rate limiting before production.
- Configure required environment variables: EMAIL_PROVIDER, EMAIL_FROM.
- Never log: access_token, refresh_token, smtp_password.
- Use verified sender details.

## Email Templates

- Add rate limiting before production.
- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.
- Use verified sender details.

## Files

- Block file types: .bat, .cmd, .com, .dll, .exe, .html, .htm, .js, .mjs, .php, .ps1, .scr, .sh, .svg, .vbs.
- Configure required environment variables: STORAGE_PROVIDER, LOCAL_UPLOAD_DIR, MAX_UPLOAD_SIZE_MB, ALLOWED_UPLOAD_TYPES.
- Confirm the configured storage provider and upload limits before production.
- Keep uploaded file storage private unless public access is intentionally required.
- Restrict executable file types.
- Restrict this module to admin or trusted staff roles.
- Set file size limits before production.
- Validate uploaded files before storage.

## Fulfillment

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Health Check

- Do not expose secrets, database details, or internal stack traces.
- Keep public responses minimal.

## Staff Invitations

- Add rate limiting before production.
- Configure required environment variables: INVITATION_TOKEN_SECRET.
- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Never log passwords, access tokens, or refresh tokens.
- Never log: email, password, token, token_hash, pending_email_key.
- Set strong authentication secrets and never commit them to Git.
- Use verified sender details.

## Content Sections

- Block unsafe schemes, private hosts, and embedded credentials in URL fields.
- Keep URL validators enabled for public and external URL fields.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.

## M-Pesa Payments

- Configure required environment variables: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_ENVIRONMENT, MPESA_CALLBACK_URL, MPESA_TRANSACTION_TYPE, MPESA_ACCOUNT_REFERENCE.
- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Payment Attempts

- Block unsafe schemes, private hosts, and embedded credentials in URL fields.
- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep URL validators enabled for public and external URL fields.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Payment Requests

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Public Site

- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.

## Receipts

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Roles

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Restrict this module to admin or trusted staff roles.

## Services

- Block unsafe schemes, private hosts, and embedded credentials in URL fields.
- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep URL validators enabled for public and external URL fields.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.
- Restrict this module to admin or trusted staff roles.

## Therapist Profiles

- Block unsafe schemes, private hosts, and embedded credentials in URL fields.
- Consider audit logging create, update, delete, and permission-sensitive actions.
- Keep URL validators enabled for public and external URL fields.
- Keep editable text rendered as escaped text unless rich text is explicitly reviewed and sanitized.

## Users

- Consider audit logging create, update, delete, and permission-sensitive actions.
- Never log: password_hash, access_token, refresh_token.
- Restrict access to authorized staff only.
- Restrict this module to admin or trusted staff roles.
- Treat this module as handling personal/user data.

## Final production checks

- Run backend tests and frontend build checks before deployment.
- Confirm CORS only allows trusted frontend domains.
- Confirm all production URLs use HTTPS.
- Confirm database credentials are stored only in environment variables.
- Confirm no real secrets appear in `.env.example`, README files, frontend code, or committed files.
- Confirm all admin-only routes require authentication and authorization.
- Review all role and permission assignments before handover.
- Confirm public endpoints do not expose secrets, internal errors, stack traces, or database details.
- Confirm backups are configured before accepting real client data.
- Confirm monitoring/logging is configured for production incidents.


## Phase 3 authorization and access control

- Route-level authorization metadata is declared in `module_registry/*.json`.
- App generation is blocked unless `scripts/validate_authorization.py` passes in the factory.
- Public write routes must declare a rate-limit policy.
- Permission-protected routes must use seeded permissions.
- App profiles must only reference modules that exist in `module_registry`.
- Backend modules must declare route-level authorization metadata.
- User role assignment requires `roles.manage`.
- Factory app generation endpoints require `developer_console.manage`.
- Review `AUTHORIZATION_REPORT.md` before deploying this generated app.