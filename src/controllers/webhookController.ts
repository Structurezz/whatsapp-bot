import { Request, Response, NextFunction } from 'express';
import { handleIncomingMessage } from '../services/conversationService';
import logger from '../utils/logger';

// ── Meta webhook verification (GET) ───────────────────────────────────────────
export const whatsappWebhookVerify = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    logger.info('Meta webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn(`Webhook verification failed — token mismatch`);
    res.sendStatus(403);
  }
};

// ── Incoming message handler (POST) ───────────────────────────────────────────
export const whatsappWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // ── Meta Cloud API format ──────────────────────────────────────────────
    if (req.body?.object === 'whatsapp_business_account') {
      // Acknowledge immediately — Meta retries if it doesn't get 200 fast
      res.sendStatus(200);

      const entry = req.body.entry?.[0];
      const change = entry?.changes?.[0]?.value;

      if (!change?.messages?.length) return; // status update, not a message

      const msg = change.messages[0];

      // Only handle text messages for now
      if (msg.type !== 'text') return;

      const from: string = msg.from;                          // e.g. 2347089224054
      const body: string = msg.text?.body || '';
      const profileName: string = change.contacts?.[0]?.profile?.name || '';

      if (!from || !body) return;

      logger.info(`Meta WhatsApp from +${from}: "${body}"`);

      handleIncomingMessage(`+${from}`, body, profileName).catch((err) => {
        logger.error(`Error handling Meta message: ${err}`);
      });

      return;
    }

    // ── Twilio format (URL-encoded) ────────────────────────────────────────
    const from: string = req.body.From || '';
    const body: string = req.body.Body || '';
    const profileName: string = req.body.ProfileName || '';

    if (!from || !body) {
      res.status(200).send('<Response></Response>');
      return;
    }

    logger.info(`Twilio WhatsApp from ${from}: "${body}"`);

    handleIncomingMessage(from, body, profileName).catch((err) => {
      logger.error(`Error handling Twilio message: ${err}`);
    });

    res.set('Content-Type', 'text/xml');
    res.status(200).send('<Response></Response>');
  } catch (error) {
    next(error);
  }
};

export const webhookStatus = (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'Webhook endpoint active' });
};
