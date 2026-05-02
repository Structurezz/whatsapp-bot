import { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import * as bookingService from '../services/bookingService';
import { BookingStatus } from '../models/Booking';
import { notifyCustomer } from '../services/notificationService';

export const createBookingValidation = [
  body('customerPhone').notEmpty().withMessage('Customer phone is required'),
  body('service').notEmpty().withMessage('Service is required'),
  body('bookingDate').isISO8601().withMessage('Valid booking date required'),
  body('address').notEmpty().withMessage('Address is required'),
];

export const updateBookingValidation = [
  body('status')
    .optional()
    .isIn(['pending', 'confirmed', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('bookingDate').optional().isISO8601().withMessage('Valid date required'),
];

export const getBookings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filters: bookingService.BookingFilters = {
      status: req.query.status as BookingStatus,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      customerPhone: req.query.customerPhone as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    };

    const result = await bookingService.getAllBookings(filters);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const booking = await bookingService.getBookingById(req.params.id);
    res.status(200).json({ success: true, data: { booking } });
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const booking = await bookingService.createBooking(req.body);
    res.status(201).json({ success: true, data: { booking } });
  } catch (error) {
    next(error);
  }
};

export const updateBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    // Capture old status before update for change detection
    const existing = await bookingService.getBookingById(req.params.id);
    const oldStatus = existing.status;

    const booking = await bookingService.updateBooking(req.params.id, req.body);

    // Fire WhatsApp notification if status changed
    if (req.body.status && req.body.status !== oldStatus) {
      notifyCustomer(booking, req.body.status as BookingStatus, oldStatus).catch(() => {});
    }

    res.status(200).json({ success: true, data: { booking } });
  } catch (error) {
    next(error);
  }
};

export const deleteBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await bookingService.deleteBooking(req.params.id);
    res.status(200).json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getAnalytics = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const analytics = await bookingService.getAnalytics();
    res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
};
