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
  'EMAIL_HOST',         // nodemailer transporter host
  'EMAIL_PORT',         // transporter port (defaults to 587 if unset)
  'EMAIL_USER',         // SMTP auth user / from-address
  'EMAIL_PASSWORD',     // SMTP auth password
  'XENDIT_SECRET_KEY',  // Xendit API auth (primary gateway)
  'XENDIT_WEBHOOK_TOKEN', // Xendit webhook signature verification
];

export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return { ok: true, missing: [] };

  const missing = PRODUCTION_REQUIRED.filter((name) => {
    const value = env[name];
    return value === undefined || value === null || value.trim() === '' || value === 'your-...-value';
  });

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
