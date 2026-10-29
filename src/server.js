
require('dotenv').config();

const connectDB = require('./config/db');

const PORT = process.env.PORT || 5500;

const startServer = async () => {
  try {
    await connectDB();

    const app = require('./app');

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    server.on('error', (error) => {
      console.error('HTTP server error:', error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
