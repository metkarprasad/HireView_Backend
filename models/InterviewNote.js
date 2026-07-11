const mongoose = require('mongoose');

const InterviewNoteSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewAttempt', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String }, // rich text stored as HTML or markdown
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InterviewNote', InterviewNoteSchema);
