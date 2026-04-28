import { Router } from 'express';
import { login, loginValidation, getMe } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);

export default router;
