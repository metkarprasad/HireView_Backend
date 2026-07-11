const mongoose = require('mongoose');

const InterviewCodeSubmissionSchema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewAttempt', required: true },
  questionIndex: { type: Number, required: true },
  language: { type: String, required: true },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('InterviewCodeSubmission', InterviewCodeSubmissionSchema);
