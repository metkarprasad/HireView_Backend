const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
  },
  answerText: {
    type: String,
    default: '',
  },
  feedback: {
    score: {
      type: Number,
      min: 0,
      max: 10,
    },
    comments: String,
    strengths: String,
    weakAreas: String,
    improvements: String,
  },
});

const InterviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    technology: {
      type: String,
      required: [true, 'Please specify the technology'],
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      required: [true, 'Please specify the difficulty level'],
    },
    status: {
      type: String,
      enum: ['scheduled', 'started', 'completed', 'cancelled', 'missed'],
      default: 'started',
    },
    duration: {
      type: Number,
      default: 1.0,
      min: 0.5,
      max: 4.0,
    },
    isScheduled: {
      type: Boolean,
      default: false,
    },
    scheduledAt: {
      type: Date,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    questions: [QuestionSchema],
    overallFeedback: {
      score: {
        type: Number,
        min: 0,
        max: 100,
      },
      strengths: [String],
      weakAreas: [String],
      studyTopics: [String],
      learningPath: [
        {
          step: String,
          description: String,
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Interview', InterviewSchema);
