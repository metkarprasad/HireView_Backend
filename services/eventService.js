// services/eventService.js
// Minimal placeholder service for handling interview events.
// Currently only supports saving answer events; can be expanded later.

const InterviewEvent = require('../models/InterviewEvent');

/**
 * Save an answer event for a given attempt.
 * @param {string} attemptId - Mongo ObjectId of the InterviewAttempt.
 * @param {string} answer - Textual answer provided by the user.
 * @returns {Promise<Object>} The created InterviewEvent document.
 */
async function saveAnswerEvent(attemptId, answer) {
  if (!attemptId || !answer) {
    throw new Error('attemptId and answer are required');
  }
  const event = await InterviewEvent.create({
    attempt: attemptId,
    type: 'answer',
    payload: { answer },
    timestamp: Date.now(),
  });
  return event;
}

module.exports = {
  saveAnswerEvent,
};
