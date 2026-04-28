import Booking, { IBooking, BookingStatus } from '../models/Booking';
import { createError } from '../middleware/errorHandler';

export interface BookingFilters {
  status?: BookingStatus;
  startDate?: string;
  endDate?: string;
  customerPhone?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedBookings {
  bookings: IBooking[];
  total: number;
  page: number;
  pages: number;
}

export const getAllBookings = async (
  filters: BookingFilters
): Promise<PaginatedBookings> => {
  const { status, startDate, endDate, customerPhone, page = 1, limit = 20 } = filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};

  if (status) query.status = status;
  if (customerPhone) query.customerPhone = { $regex: customerPhone, $options: 'i' };
  if (startDate || endDate) {
    query.bookingDate = {};
    if (startDate) query.bookingDate.$gte = new Date(startDate);
    if (endDate) query.bookingDate.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  const [bookings, total] = await Promise.all([
    Booking.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Booking.countDocuments(query),
  ]);

  return { bookings, total, page, pages: Math.ceil(total / limit) };
};

export const getBookingById = async (id: string): Promise<IBooking> => {
  const booking = await Booking.findById(id);
  if (!booking) throw createError('Booking not found', 404);
  return booking;
};

export interface CreateBookingInput {
  customerPhone: string;
  customerName?: string;
  service: string;
  bookingDate: Date;
  address: string;
  notes?: string;
}

export const createBooking = async (
  data: CreateBookingInput
): Promise<IBooking> => {
  return Booking.create(data);
};

export interface UpdateBookingInput {
  customerName?: string;
  service?: string;
  bookingDate?: Date;
  address?: string;
  status?: BookingStatus;
  notes?: string;
}

export const updateBooking = async (
  id: string,
  data: UpdateBookingInput
): Promise<IBooking> => {
  const booking = await Booking.findById(id);
  if (!booking) throw createError('Booking not found', 404);

  // Set timestamps on status transitions
  if (data.status === 'confirmed' && booking.status !== 'confirmed') {
    (data as IBooking).confirmedAt = new Date();
  }
  if (data.status === 'completed' && booking.status !== 'completed') {
    (data as IBooking).completedAt = new Date();
  }

  Object.assign(booking, data);
  await booking.save();
  return booking;
};

export const deleteBooking = async (id: string): Promise<void> => {
  const booking = await Booking.findByIdAndDelete(id);
  if (!booking) throw createError('Booking not found', 404);
};

export const getAnalytics = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    totalBookings,
    pendingBookings,
    confirmedBookings,
    completedBookings,
    cancelledBookings,
    thisMonthBookings,
    lastMonthBookings,
    recentBookings,
    serviceBreakdown,
    dailyBookings,
  ] = await Promise.all([
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({ status: 'confirmed' }),
    Booking.countDocuments({ status: 'completed' }),
    Booking.countDocuments({ status: 'cancelled' }),
    Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Booking.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    }),
    Booking.find().sort({ createdAt: -1 }).limit(5),
    Booking.aggregate([
      { $group: { _id: '$service', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Booking.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const growthRate =
    lastMonthBookings > 0
      ? (((thisMonthBookings - lastMonthBookings) / lastMonthBookings) * 100).toFixed(1)
      : '0';

  return {
    summary: {
      total: totalBookings,
      pending: pendingBookings,
      confirmed: confirmedBookings,
      completed: completedBookings,
      cancelled: cancelledBookings,
      thisMonth: thisMonthBookings,
      lastMonth: lastMonthBookings,
      growthRate: parseFloat(growthRate),
    },
    recentBookings,
    serviceBreakdown,
    dailyBookings,
  };
};
