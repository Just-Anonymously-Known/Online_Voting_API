
const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured');
  }

  const conn = await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000
  });

  console.log(`MongoDB Connected: ${conn.connection.host}`);

  return conn;
};

module.exports = connectDB;
