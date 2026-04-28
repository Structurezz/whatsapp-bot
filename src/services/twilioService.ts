import twilio from 'twilio';
import logger from '../utils/logger';

let client: twilio.Twilio | null = null;

const getClient = (): twilio.Twilio => {
  if (!client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }
    client = twilio(accountSid, authToken);
  }
  return client;
};

export const sendWhatsAppMessage = async (
  to: string,
  body: string
): Promise<void> => {
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!from) {
    logger.error('TWILIO_WHATSAPP_NUMBER not configured');
    return;
  }

  // Normalize phone format
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  try {
    const twilioClient = getClient();
    const message = await twilioClient.messages.create({
      from,
      to: toFormatted,
      body,
    });
    logger.info(`WhatsApp message sent to ${toFormatted}: SID ${message.sid}`);
  } catch (error) {
    logger.error(`Failed to send WhatsApp message to ${toFormatted}: ${error}`);
    throw error;
  }
};
