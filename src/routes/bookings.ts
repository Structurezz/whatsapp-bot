import { Router } from 'express';
import {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
  getAnalytics,
  createBookingValidation,
  updateBookingValidation,
} from '../controllers/bookingController';
import { protect } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(protect);

router.get('/analytics', getAnalytics);
router.get('/', getBookings);
router.get('/:id', getBooking);
router.post('/', createBookingValidation, createBooking);
router.put('/:id', updateBookingValidation, updateBooking);
router.delete('/:id', deleteBooking);

export default router;
