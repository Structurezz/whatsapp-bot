import { Router } from 'express';
import {
  login,
  loginValidation,
  register,
  registerValidation,
  getMe,
} from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);

export default router;
