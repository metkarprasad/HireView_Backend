// server.js - Updated with Socket.io integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

// Connect to Database
connectDB();

const app = express();

// Body Parser
app.use(express.json());

// Enable CORS for REST endpoints
app.use(cors());

// Mount Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/interviews', require('./routes/interviewRoutes'));

// Root path handler
app.get('/', (req, res) => {
    res.send('HireView AI Interview Platform API is running...');
});

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Initialize HTTP server and Socket.io
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

// Load socket handlers (will register events)
require('./socket/socketHandler')(io);

// Start background reminder scheduler
const { startReminderScheduler } = require('./services/scheduler');

httpServer.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    // Start background reminders scheduler
    startReminderScheduler();
});

// Export io for other modules if needed
module.exports = { io };

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    httpServer.close(() => process.exit(1));
});
