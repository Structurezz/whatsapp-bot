import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import connectDB from './config/database';
import logger from './utils/logger';
import { errorHandler, notFound } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import bookingRoutes from './routes/bookings';
import webhookRoutes from './routes/webhook';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Twilio webhooks need raw body for signature validation
app.use('/api/webhook', express.urlencoded({ extended: false }));

// ─── General Middleware ────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'WhatsApp Booking API is running',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/webhook', webhookRoutes);

// ─── Legal Pages ──────────────────────────────────────────────────────────────
app.get('/privacy-policy', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — Orizu</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           max-width: 800px; margin: 0 auto; padding: 40px 24px;
           color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 2rem; margin-bottom: 4px; }
    h2 { font-size: 1.2rem; margin-top: 36px; color: #111; }
    p, li { color: #444; }
    a { color: #16a34a; }
    .updated { color: #888; font-size: 0.9rem; margin-bottom: 32px; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: ${new Date().toDateString()}</p>

  <p>This privacy policy describes how Orizu ("I", "me") handles information
  collected through this WhatsApp assistant and related services.</p>

  <h2>1. Information I Collect</h2>
  <p>When you interact with this WhatsApp assistant, I may collect:</p>
  <ul>
    <li>Your WhatsApp phone number and display name</li>
    <li>Messages you send and the context of your conversation</li>
    <li>Booking details you provide (name, preferred date, project description)</li>
  </ul>

  <h2>2. How I Use Your Information</h2>
  <p>The information collected is used solely to:</p>
  <ul>
    <li>Respond to your messages and provide assistance</li>
    <li>Schedule and manage consultation bookings</li>
    <li>Send you relevant notifications about your bookings</li>
  </ul>

  <h2>3. Data Storage</h2>
  <p>Conversation data is stored temporarily to maintain context during an active
  session and is automatically deleted after 2 hours of inactivity.
  Booking information is retained for business record purposes.</p>

  <h2>4. Data Sharing</h2>
  <p>I do not sell, trade, or share your personal information with third parties,
  except as required to deliver the service (e.g. WhatsApp message delivery via
  Twilio or Meta infrastructure).</p>

  <h2>5. Your Rights</h2>
  <p>You may request deletion of your data at any time by messaging the assistant
  directly or contacting me at the details below.</p>

  <h2>6. Contact</h2>
  <p>For any privacy concerns, contact me on WhatsApp or via email.</p>

  <h2>7. Changes</h2>
  <p>This policy may be updated from time to time. Continued use of the service
  constitutes acceptance of the updated policy.</p>
</body>
</html>`);
});

app.get('/terms', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms of Service — Orizu</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           max-width: 800px; margin: 0 auto; padding: 40px 24px;
           color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 2rem; margin-bottom: 4px; }
    h2 { font-size: 1.2rem; margin-top: 36px; color: #111; }
    p, li { color: #444; }
    .updated { color: #888; font-size: 0.9rem; margin-bottom: 32px; }
  </style>
</head>
<body>
  <h1>Terms of Service</h1>
  <p class="updated">Last updated: ${new Date().toDateString()}</p>

  <p>By using this WhatsApp assistant, you agree to these terms.</p>

  <h2>1. Use of Service</h2>
  <p>This assistant is provided for the purpose of booking consultations and
  communicating with Orizu regarding software engineering services.
  You agree to use it only for lawful purposes.</p>

  <h2>2. Service Availability</h2>
  <p>The service is provided as-is. I do not guarantee uninterrupted availability.</p>

  <h2>3. Intellectual Property</h2>
  <p>All software, content, and systems associated with this service are the
  intellectual property of Orizu.</p>

  <h2>4. Limitation of Liability</h2>
  <p>To the extent permitted by law, I am not liable for any indirect or
  consequential damages arising from the use of this service.</p>

  <h2>5. Contact</h2>
  <p>Questions about these terms? Message the assistant directly.</p>
</body>
</html>`);
});

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
  });
};

start().catch((err) => {
  logger.error(`Failed to start server: ${err}`);
  process.exit(1);
});

export default app;
