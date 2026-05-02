import logger from '../utils/logger';

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

export const sendMetaWhatsAppMessage = async (
  to: string,
  body: string
): Promise<void> => {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    logger.error('META_PHONE_NUMBER_ID or META_ACCESS_TOKEN not configured');
    return;
  }

  // Normalise — strip leading + if present, Meta wants plain digits
  const toFormatted = to.replace(/^\+/, '');

  const payload = {
    messaging_product: 'whatsapp',
    to: toFormatted,
    type: 'text',
    text: { body },
  };

  try {
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error(`Meta API error ${res.status}: ${err}`);
      return;
    }

    const data = await res.json() as { messages?: { id: string }[] };
    logger.info(`Meta message sent to ${toFormatted}: ${data.messages?.[0]?.id}`);
  } catch (err) {
    logger.error(`Failed to send Meta WhatsApp message: ${err}`);
    throw err;
  }
};
