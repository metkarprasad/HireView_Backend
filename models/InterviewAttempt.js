const mongoose = require('mongoose');

const InterviewAttemptSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isScheduled: { type: Boolean, default: false },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationHours: { type: Number, min: 0.5, max: 4 },
    status: { type: String, enum: ['scheduled', 'started', 'completed', 'cancelled', 'missed'], default: 'scheduled' },
    // Additional meta fields can be added later
  },
  { timestamps: true }
);

module.exports = mongoose.model('InterviewAttempt', InterviewAttemptSchema);
