import { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { handleIncomingMessage } from '../services/conversationService';
import logger from '../utils/logger';

export const whatsappWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate Twilio signature in production
    if (process.env.NODE_ENV === 'production') {
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (!authToken) {
        res.status(500).send('Twilio auth token not configured');
        return;
      }

      const signature = req.headers['x-twilio-signature'] as string;
      const url =
        process.env.WEBHOOK_URL || `${req.protocol}://${req.get('host')}${req.originalUrl}`;

      const isValid = twilio.validateRequest(authToken, signature, url, req.body);
      if (!isValid) {
        logger.warn(`Invalid Twilio signature from ${req.ip}`);
        res.status(403).send('Forbidden');
        return;
      }
    }

    const from: string = req.body.From || '';
    const body: string = req.body.Body || '';
    const profileName: string = req.body.ProfileName || '';

    if (!from || !body) {
      res.status(200).send('<Response></Response>');
      return;
    }

    logger.info(`Incoming WhatsApp from ${from}: "${body}"`);

    // Process async — respond immediately with empty TwiML so Twilio doesn't retry
    handleIncomingMessage(from, body, profileName).catch((err) => {
      logger.error(`Error handling WhatsApp message: ${err}`);
    });

    // Return empty TwiML (we use Twilio REST API to send replies, not TwiML)
    res.set('Content-Type', 'text/xml');
    res.status(200).send('<Response></Response>');
  } catch (error) {
    next(error);
  }
};

export const webhookStatus = (
  _req: Request,
  res: Response
): void => {
  res.status(200).json({ success: true, message: 'Webhook endpoint active' });
};
