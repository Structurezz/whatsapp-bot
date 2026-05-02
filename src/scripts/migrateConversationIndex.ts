import 'dotenv/config';
import mongoose from 'mongoose';
import logger from '../utils/logger';

const migrate = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-booking';
  await mongoose.connect(uri);
  logger.info('Connected to MongoDB');

  const db = mongoose.connection.db!;
  const collection = db.collection('conversations');

  // List existing indexes
  const indexes = await collection.indexes();
  logger.info(`Existing indexes: ${indexes.map((i) => i.name).join(', ')}`);

  // Drop the old single-field phone index if it exists
  const hasOldIndex = indexes.some((i) => i.name === 'phone_1');
  if (hasOldIndex) {
    await collection.dropIndex('phone_1');
    logger.info('Dropped old phone_1 unique index');
  } else {
    logger.info('Old phone_1 index not found — skipping');
  }

  // Also clear any stale conversations so fresh ones can be created cleanly
  const count = await collection.countDocuments();
  if (count > 0) {
    await collection.deleteMany({});
    logger.info(`Cleared ${count} stale conversation(s)`);
  }

  await mongoose.disconnect();
  logger.info('Migration complete');
};

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
