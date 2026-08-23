import { isDevHost } from './appUrl.js';

// Startup validation for production config. Fail fast with the VARIABLE NAME
// only — never the value — so a misconfigured deployment stops loudly instead
// of booting into a half-working state (e.g. marking orders paid it can't
// email about, or signing JWTs with an empty secret).
//
// Only variables the running code genuinely depends on are required. Not
// every key in .env.example belongs here: optional integrations (Maya
// transition keys, Fit Check Replicate/WaveSpeed, Redis, Sentry, Cloudinary)
// have safe fallbacks or are provider-specific and are NOT required to start.
// This module is imported once at the top of server.js before anything else
// bootstraps, so missing config is reported before the HTTP server binds.
const PRODUCTION_REQUIRED = [
  'DATABASE_URL',       // Prisma datasource — no default
  'JWT_SECRET',         // jwt.sign/verify — no default
  'FRONTEND_URL',       // CORS allowlist + Xendit return URLs + email links
  // MXroute HTTP API Transport Migration — EMAIL_HOST/USER/PASSWORD are now
  // primarily the MXroute HTTP API's server/username/password fields
  // (emailTransport.js), reached over HTTPS instead of raw SMTP. EMAIL_PORT
  // is genuinely still used too — sendScheduledReportEmail (real file
  // attachments, which the API doesn't support) still sends over SMTP via
  // the same four variables, so none of these became dead configuration.
  'EMAIL_HOST',         // MXroute API `server` field / SMTP host (attachments only)
  'EMAIL_PORT',         // SMTP port for the attachment-only path (defaults to 587 if unset)
  'EMAIL_USER',         // MXroute API `username`/`from` / SMTP auth user
  'EMAIL_PASSWORD',     // MXroute API `password` / SMTP auth password
  'XENDIT_SECRET_KEY',  // Xendit API auth (primary gateway)
  'XENDIT_WEBHOOK_TOKEN', // Xendit webhook signature verification
];

export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return { ok: true, missing: [] };

  const missing = PRODUCTION_REQUIRED.filter((name) => {
    const value = env[name];
    return value === undefined || value === null || value.trim() === '' || value === 'your-...-value';
  });

  // FRONTEND_URL is what every email link, the pass QR/logo assets, the
  // sitemap, and the gateway return URLs are built from. A production value
  // pointing at localhost or an ngrok tunnel would send customers to a dev
  // host — fail fast (naming only the variable) rather than ship it, same
  // reason the missing-variable check above refuses to start.
  if (!missing.includes('FRONTEND_URL') && isDevHost(env.FRONTEND_URL)) {
    missing.push('FRONTEND_URL');
    const err = new Error(
      'FRONTEND_URL in production points at a development host (localhost/ngrok). ' +
      'Set it to the production storefront domain before deploying. ' +
      'Values are not shown here.'
    );
    err.missing = ['FRONTEND_URL'];
    throw err;
  }

  if (missing.length > 0) {
    const names = missing.join(', ');
    const err = new Error(
      `Missing required production environment variable${missing.length > 1 ? 's' : ''}: ${names}. ` +
      'Refusing to start — set these in Railway before deploying. Values are not shown here.'
    );
    err.missing = missing;
    throw err;
  }

  return { ok: true, missing: [] };
}

export default { validateProductionConfig };
