// services/interviewService.js
// Core interview business logic used by REST controllers and Socket.io handlers.
// This implementation provides minimal placeholder functionality to enable real‑time flow.
// Replace with full AI integration and detailed question management later.

const InterviewAttempt = require('../models/InterviewAttempt');
const Interview = require('../models/Interview');
const InterviewEvent = require('../models/InterviewEvent');
const InterviewAnalytics = require('../models/InterviewAnalytics');

/**
 * Find an active attempt for a user and interview, or create a new one.
 * @param {string} interviewId
 * @param {string} userId
 * @returns {Promise<Object>} The attempt document.
 */
async function createOrGetActiveAttempt(interviewId, userId) {
  let attempt = await InterviewAttempt.findOne({ interview: interviewId, user: userId, status: 'inProgress' });
  if (!attempt) {
    attempt = await InterviewAttempt.create({ interview: interviewId, user: userId, status: 'inProgress', startedAt: Date.now() });
  }
  return attempt;
}

/**
 * Start a fresh attempt (used when a user explicitly begins an interview).
 */
async function startAttempt(interviewId, userId) {
  // Close any existing in‑progress attempts first
  await InterviewAttempt.updateMany({ interview: interviewId, user: userId, status: 'inProgress' }, { status: 'completed', endedAt: Date.now() });
  const attempt = await InterviewAttempt.create({ interview: interviewId, user: userId, status: 'inProgress', startedAt: Date.now() });
  return attempt;
}

/**
 * Retrieve the next question for the given attempt.
 * For now this returns a static mock question. Replace with DB‑driven logic later.
 */
async function getNextQuestion(attemptId) {
  // In a full implementation you would look up the interview's question list and progress.
  // Here we simply return a placeholder.
  return {
    questionId: 'placeholder-1',
    text: 'Explain the difference between let and const in JavaScript.',
    order: 1,
  };
}

/**
 * Evaluate a submitted answer.
 * Placeholder returns generic feedback. Hook into LLM later.
 */
async function evaluateAnswer(attemptId, answer) {
  // Store the answer as an event for audit.
  await InterviewEvent.create({ attempt: attemptId, type: 'answer', payload: { answer }, createdAt: Date.now() });
  // Mock feedback
  return {
    score: 8,
    comments: 'Good explanation, but you could mention hoisting.',
  };
}

/**
 * Generate a final interview report/analytics.
 * Returns a basic summary; extend with real analytics later.
 */
async function generateReport(attemptId) {
  // Aggregate events for a very simple report.
  const events = await InterviewEvent.find({ attempt: attemptId });
  const totalAnswers = events.filter(e => e.type === 'answer').length;
  return {
    attemptId,
    totalAnswers,
    overallScore: totalAnswers * 8, // placeholder calculation
    message: 'Interview completed. Review detailed analytics in the dashboard.',
  };
}

module.exports = {
  createOrGetActiveAttempt,
  startAttempt,
  getNextQuestion,
  evaluateAnswer,
  generateReport,
};
