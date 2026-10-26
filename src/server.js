
require('dotenv').config();

const connectDB = require('./config/db');

const PORT = process.env.PORT || 5500;

const startServer = async () => {
  try {
    await connectDB();

    const app = require('./app');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
