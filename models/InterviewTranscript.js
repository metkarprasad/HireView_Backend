const mongoose = require('mongoose');

const InterviewTranscriptSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewAttempt', required: true },
    segments: [
      {
        start: { type: Number }, // start time in ms from interview start
        end: { type: Number },   // end time in ms
        text: { type: String },
        confidence: { type: Number },
      },
    ],
    fullText: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InterviewTranscript', InterviewTranscriptSchema);
