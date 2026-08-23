import express from 'express';
import axios from 'axios';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// TEMPORARY, isolated diagnostic — not wired into any cron/webhook/startup
// path. Exists only to answer one question: can this Railway container
// reach MXroute over HTTPS (port 443) when direct SMTP (port 587) is
// timing out (ETIMEDOUT/CONN — see the production incident this is
// investigating)? Does not touch emailService.js's transporter, the
// confirmation-email claim/retry system, or any customer-facing send path.
// Safe to delete this whole file once the test has answered that question.
const MXROUTE_API_URL = 'https://smtpapi.mxroute.com/';

// Hardcoded, not read from the request — this must never be pointable at
// any other address, per the explicit constraint this diagnostic was
// authorized under.
const TEST_RECIPIENT = 'quimpo.charles@gmail.com';

router.post('/mxroute-api-test', authenticate, isAdmin, async (req, res) => {
  const server = process.env.EMAIL_HOST;
  const username = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASSWORD;

  if (!server || !username || !password) {
    return res.status(500).json({
      success: false,
      message: 'EMAIL_HOST, EMAIL_USER, or EMAIL_PASSWORD is not configured in this environment.',
    });
  }

  const payload = {
    server,
    username,
    password,
    from: username, // support@pusostore.com — same sender as the existing SMTP path
    to: TEST_RECIPIENT,
    subject: 'PusoStore MXroute API Test',
    body: '<p>This is a one-time transactional email delivery test from PusoStore, verifying MXroute\'s HTTP API as an alternate delivery path. No action is needed.</p>',
  };

  const startedAt = Date.now();
  try {
    const response = await axios.post(MXROUTE_API_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true, // inspect any status ourselves, never throw on 4xx/5xx
    });

    const durationMs = Date.now() - startedAt;
    // Never log/return the request payload (it carries the mailbox
    // password) — only the provider's own response, which contains none
    // of our secrets.
    logger.info(
      { httpStatus: response.status, providerSuccess: response.data?.success, durationMs },
      'MXroute API diagnostic test completed'
    );

    return res.status(200).json({
      success: true, // the diagnostic itself ran to completion — see apiSuccess for delivery outcome
      apiConnection: 'reached',
      httpStatus: response.status,
      apiSuccess: response.data?.success ?? null,
      providerMessage: response.data?.message ?? null,
      // MXroute's documented response shape has no separate request/message
      // id field — reporting the full body (already secret-free) for
      // completeness in case one is present in practice.
      providerResponse: response.data ?? null,
      durationMs,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
    const isNetworkFailure = !error.response;

    logger.error(
      { err: { message: error.message, code: error.code }, durationMs },
      'MXroute API diagnostic test failed to connect'
    );
    Sentry.captureException(error);

    return res.status(200).json({
      success: false,
      apiConnection: isNetworkFailure ? 'unreachable' : 'reached',
      httpStatus: error.response?.status ?? null,
      errorCode: error.code ?? null,
      errorMessage: error.message,
      isTimeout,
      durationMs,
    });
  }
});

export default router;
