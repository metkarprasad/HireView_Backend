// socket/socketHandler.js
// Handles Socket.io events for real-time interview sessions
// Requires JWT authentication on connection as per user preference.

const jwt = require('jsonwebtoken');
const { emitToRoom } = require('../services/socketService');
const Interview = require('../models/Interview');
const groqService = require('../services/groqService');
const progressionService = require('../services/interviewProgression');

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
      try {
        const interview = await Interview.findById(interviewId);
        if (interview) {
          emitToRoom(io, interviewId, 'attemptCreated', { 
            id: interview._id,
            endsAt: interview.endsAt,
            interviewerConfig: interview.interviewerConfig 
          });
        }
      } catch (err) {
        console.error('Error joining interview:', err);
      }
    });

    // Start interview – typically triggered after join
    socket.on('startInterview', async ({ interviewId }) => {
      if (!interviewId) return;
      try {
        const interview = await Interview.findById(interviewId);
        if (interview && interview.questions.length > 0) {
          const firstQuestion = interview.questions[0];
          emitToRoom(io, interviewId, 'question', firstQuestion);
        }
      } catch (err) {
        console.error('Error starting interview:', err);
      }
    });

    // Submit answer from client
    socket.on('submitAnswer', async ({ interviewId, attemptId, answer }) => {
      // NOTE: LiveInterview.jsx passes { interviewId, attemptId, answer }
      if (!interviewId || !answer) return;
      
      try {
        const interview = await Interview.findById(interviewId);
        if (!interview || interview.status === 'completed') return;

        const currentQuestionIndex = interview.questions.length - 1;
        const currentQuestion = interview.questions[currentQuestionIndex];

        // Process answer via AI evaluator
        let feedback;
        if (interview.interviewType === 'HR') {
          feedback = await groqService.evaluateHRAnswer(
            currentQuestion.questionText,
            answer,
            interview.difficulty
          );
        } else {
          feedback = await groqService.evaluateAnswer(
            { 
              questionText: currentQuestion.questionText, 
              expectedAnswer: currentQuestion.expectedAnswer 
            }, 
            answer, 
            interview.technology, 
            interview.difficulty
          );
        }

        currentQuestion.answerText = answer;
        currentQuestion.feedback = feedback;

        emitToRoom(io, interviewId, 'feedback', feedback);

        // Calculate next phase
        let nextPhase;
        if (interview.interviewType === 'HR') {
          nextPhase = progressionService.calculateNextHRPhase(
            interview.currentPhase || 'greeting',
            feedback.score || 0,
            interview.questions.length,
            16
          );
        } else {
          nextPhase = progressionService.calculateNextPhase(
            interview.currentPhase || 'fundamentals',
            feedback.score || 0,
            interview.questions.length,
            interview.difficulty,
            5
          );
        }
        interview.currentPhase = nextPhase;

        const currentTime = new Date();
        const timeRemainingMs = (interview.endsAt ? interview.endsAt.getTime() : (interview.startedAt || interview.createdAt).getTime() + (interview.duration || 1) * 60 * 60 * 1000) - currentTime.getTime();
        const timeRemaining = Math.max(0, timeRemainingMs / 60000); // in minutes

        if (timeRemaining > 0) {
          // Get next adaptive question
          let nextQuestionData;
          if (interview.interviewType === 'HR') {
            nextQuestionData = await groqService.generateHRQuestion(
              interview.difficulty,
              interview.experience || 0,
              interview.currentPhase,
              interview.questions,
              timeRemaining,
              0, // retryCount
              interview.interviewerConfig?.style || 'Professional'
            );
          } else {
            nextQuestionData = await groqService.generateQuestion(
              interview.technology,
              interview.difficulty,
              interview.experience || 0,
              interview.currentPhase,
              interview.questions,
              0, // retryCount
              timeRemaining,
              interview.interviewerConfig?.style || 'Professional'
            );
          }

          interview.questions.push({
            phase: interview.currentPhase,
            questionText: nextQuestionData.questionText || nextQuestionData,
            expectedAnswer: nextQuestionData.expectedAnswer || '',
            difficulty: nextQuestionData.difficulty || interview.difficulty,
            topic: nextQuestionData.topic || '',
            skillsTested: nextQuestionData.skillsTested || [],
            questionType: nextQuestionData.questionType || 'conceptual',
            answerText: '',
          });

          await interview.save();
          // Emit the full object so frontend can check questionType
          emitToRoom(io, interviewId, 'question', interview.questions[interview.questions.length - 1]);
        } else {
          // Interview completed
          interview.status = 'completed';
          let report;
          if (interview.interviewType === 'HR') {
            report = await groqService.generateOverallHRReport(
              interview.difficulty,
              interview.questions
            );
          } else {
            report = await groqService.generateOverallReport(
              interview.technology,
              interview.difficulty,
              interview.questions
            );
          }
          
          interview.overallFeedback = report;
          await interview.save();
          
          emitToRoom(io, interviewId, 'interviewCompleted', report);
        }
      } catch (err) {
        console.error('Socket submitAnswer error:', err);
      }
    });

    // Skip question from client
    socket.on('skipQuestion', async ({ interviewId, attemptId }) => {
      if (!interviewId) return;
      
      try {
        const interview = await Interview.findById(interviewId);
        if (!interview || interview.status === 'completed') return;

        const currentQuestionIndex = interview.questions.length - 1;
        const currentQuestion = interview.questions[currentQuestionIndex];

        // Mark as skipped
        currentQuestion.answerText = '[SKIPPED]';
        currentQuestion.feedback = {
          correctness: 0,
          technicalAccuracy: 0,
          completeness: 0,
          score: 0,
          comments: "Candidate skipped this question.",
          strengths: "N/A",
          weakAreas: "Question was skipped."
        };

        const currentTime = new Date();
        const timeRemainingMs = (interview.endsAt ? interview.endsAt.getTime() : (interview.startedAt || interview.createdAt).getTime() + (interview.duration || 1) * 60 * 60 * 1000) - currentTime.getTime();
        const timeRemaining = Math.max(0, timeRemainingMs / 60000); // in minutes

        if (timeRemaining > 0) {
          let nextQuestionData;
          if (interview.interviewType === 'HR') {
            nextQuestionData = await groqService.generateHRQuestion(
              interview.difficulty,
              interview.experience || 0,
              interview.currentPhase || 'greeting',
              interview.questions,
              timeRemaining,
              0, // retryCount
              interview.interviewerConfig?.style || 'Professional'
            );
          } else {
            nextQuestionData = await groqService.generateQuestion(
              interview.technology,
              interview.difficulty,
              interview.experience || 0,
              interview.currentPhase || 'fundamentals',
              interview.questions,
              0, // retryCount
              timeRemaining,
              interview.interviewerConfig?.style || 'Professional'
            );
          }

          interview.questions.push({
            phase: interview.currentPhase || (interview.interviewType === 'HR' ? 'greeting' : 'fundamentals'),
            questionText: nextQuestionData.questionText || nextQuestionData,
            expectedAnswer: nextQuestionData.expectedAnswer || '',
            difficulty: nextQuestionData.difficulty || interview.difficulty,
            topic: nextQuestionData.topic || '',
            skillsTested: nextQuestionData.skillsTested || [],
            questionType: nextQuestionData.questionType || 'conceptual',
            answerText: '',
          });

          await interview.save();
          // Emit the full object
          emitToRoom(io, interviewId, 'question', interview.questions[interview.questions.length - 1]);
        } else {
          interview.status = 'completed';
          let report;
          if (interview.interviewType === 'HR') {
            report = await groqService.generateOverallHRReport(
              interview.difficulty,
              interview.questions
            );
          } else {
            report = await groqService.generateOverallReport(
              interview.technology,
              interview.difficulty,
              interview.questions
            );
          }
          
          interview.overallFeedback = report;
          await interview.save();
          
          emitToRoom(io, interviewId, 'interviewCompleted', report);
        }
      } catch (err) {
        console.error('Socket skipQuestion error:', err);
      }
    });
    
    // New handler for real-time candidate transcript
    socket.on('answerCandidate', async ({ interviewId, transcript }) => {
      if (!interviewId) return;
      // Generate next question using AI service based on transcript
      const nextQuestion = await require('../services/groqService').generateQuestion('General', 'Intermediate', [{ questionText: transcript }]);
      emitToRoom(io, interviewId, 'question', nextQuestion);
    });
    
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};
