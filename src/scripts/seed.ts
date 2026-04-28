import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User';
import Booking from '../models/Booking';
import logger from '../utils/logger';

const seed = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-booking';
  await mongoose.connect(uri);
  logger.info('Connected to MongoDB for seeding');

  // Create admin user
  const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL || 'admin@example.com' });
  if (!existingAdmin) {
    await User.create({
      name: 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123456',
      role: 'admin',
    });
    logger.info('Admin user created');
  } else {
    logger.info('Admin user already exists — skipping');
  }

  // Seed sample bookings
  const count = await Booking.countDocuments();
  if (count === 0) {
    const services = ['House Cleaning', 'Deep Cleaning', 'Office Cleaning', 'Carpet Cleaning'];
    const statuses = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
    const bookings = Array.from({ length: 20 }, (_, i) => ({
      customerPhone: `+234800000${String(i).padStart(4, '0')}`,
      customerName: `Customer ${i + 1}`,
      service: services[i % services.length],
      bookingDate: new Date(Date.now() + (i - 5) * 86400000),
      address: `${i + 1} Sample Street, Lagos, Nigeria`,
      status: statuses[i % statuses.length],
    }));
    await Booking.insertMany(bookings);
    logger.info('Sample bookings seeded');
  } else {
    logger.info('Bookings already exist — skipping');
  }

  await mongoose.disconnect();
  logger.info('Seeding complete');
};

seed().catch((err) => {
  logger.error(`Seed error: ${err}`);
  process.exit(1);
});
