// socket/socketHandler.js
// Handles Socket.io events for real-time interview sessions
// Requires JWT authentication on connection as per user preference.

const jwt = require('jsonwebtoken');
const { emitToRoom } = require('../services/socketService');
const interviewService = require('../services/interviewService'); // placeholder service
const eventService = require('../services/eventService'); // placeholder service

module.exports = (io) => {
  // Authenticate each socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // attach user info to socket
      next();
    } catch (err) {
      console.error('Socket auth failed', err.message);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user ${socket.user?.id || 'unknown'})`);

    // Join an interview room
    socket.on('joinInterview', async ({ interviewId }) => {
      if (!interviewId) return;
      socket.join(interviewId);
      console.log(`Socket ${socket.id} joined interview ${interviewId}`);
      // Optionally load prior state
      const attempt = await interviewService.createOrGetActiveAttempt(interviewId, socket.user.id);
      emitToRoom(io, interviewId, 'attemptCreated', attempt);
    });

    // Start interview – typically triggered after join
    socket.on('startInterview', async ({ interviewId }) => {
      if (!interviewId) return;
      // Create a new attempt and emit first question
      const attempt = await interviewService.startAttempt(interviewId, socket.user.id);
      const firstQuestion = await interviewService.getNextQuestion(attempt.id);
      emitToRoom(io, interviewId, 'question', firstQuestion);
    });

    // Submit answer from client (audio/transcript already processed client‑side)
    socket.on('submitAnswer', async ({ interviewId, attemptId, answer }) => {
      if (!interviewId || !attemptId) return;
      // Save answer as an event
      await eventService.saveAnswerEvent(attemptId, answer);
      // Process answer via AI (placeholder) and emit feedback
      const feedback = await interviewService.evaluateAnswer(attemptId, answer);
      emitToRoom(io, interviewId, 'feedback', feedback);
      // Get next question or finish
      const next = await interviewService.getNextQuestion(attemptId);
      if (next) {
        emitToRoom(io, interviewId, 'question', next);
      } else {
        // Interview completed
        const report = await interviewService.generateReport(attemptId);
        emitToRoom(io, interviewId, 'interviewCompleted', report);
      }
    });
    
    // New handler for real-time candidate transcript
    socket.on('answerCandidate', async ({ interviewId, transcript }) => {
      if (!interviewId) return;
      // Generate next question using AI service based on transcript
      const nextQuestion = await require('../services/aiService').generateQuestion(transcript);
      emitToRoom(io, interviewId, 'question', nextQuestion);
    });
    
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};
