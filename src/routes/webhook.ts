import { Router } from 'express';
import { whatsappWebhook, webhookStatus } from '../controllers/webhookController';

const router = Router();

// Twilio sends POST to this endpoint
router.post('/whatsapp', whatsappWebhook);

// Health check for the webhook endpoint
router.get('/whatsapp', webhookStatus);

export default router;
