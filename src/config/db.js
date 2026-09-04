const mongoose = require('mongoose');
const { MONGODB_URI } = require('./config');

/**
 * Connect to MongoDB database via Mongoose.
 */
async function connectDB() {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 // Fast timeout if MongoDB is not running locally
    });
    console.log(`  🍃 MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return true;
  } catch (err) {
    console.warn(`  ⚠️ MongoDB connection failed: ${err.message}`);
    if (process.env.NODE_ENV === 'production') {
      console.error(`  ❌ Production mode: JSON fallback disabled. Database status: DISCONNECTED.\n`);
    } else {
      console.warn(`  ℹ️ Development mode: Falling back to local JSON file storage automatically.\n`);
    }
    return false;
  }
}

module.exports = { connectDB };
