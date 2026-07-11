const mongoose = require('mongoose');

const InterviewEventSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewAttempt', required: true },
    type: { type: String, required: true }, // e.g., questionAsked, answerReceived, aiFeedback, networkIssue
    timestamp: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed }, // any additional data
  },
  { timestamps: true }
);

module.exports = mongoose.model('InterviewEvent', InterviewEventSchema);
