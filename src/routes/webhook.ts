import { Router } from 'express';
import { whatsappWebhook, webhookStatus } from '../controllers/webhookController';
import { voiceIncoming, voiceRespond, voiceNoInput } from '../controllers/voiceController';

const router = Router();

// ── WhatsApp (Twilio Messaging) ────────────────────────────────────────────────
router.post('/whatsapp', whatsappWebhook);
router.get('/whatsapp', webhookStatus);

// ── Voice calls ────────────────────────────────────────────────────────────────
router.post('/voice', voiceIncoming);
router.post('/voice/respond', voiceRespond);
router.post('/voice/noinput', voiceNoInput);

export default router;
