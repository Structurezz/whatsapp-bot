import { Router } from 'express';
import { whatsappWebhook, whatsappWebhookVerify } from '../controllers/webhookController';
import { voiceIncoming, voiceRespond, voiceNoInput } from '../controllers/voiceController';

const router = Router();

// ── WhatsApp — Meta GET verification + POST messages ──────────────────────────
router.get('/whatsapp', whatsappWebhookVerify);
router.post('/whatsapp', whatsappWebhook);

// ── Voice calls ────────────────────────────────────────────────────────────────
router.post('/voice', voiceIncoming);
router.post('/voice/respond', voiceRespond);
router.post('/voice/noinput', voiceNoInput);

export default router;
