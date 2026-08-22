const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  phase: {
    type: String,
    default: 'fundamentals'
  },
  questionText: {
    type: String,
    required: true,
  },
  expectedAnswer: {
    type: String,
    default: '',
  },
  difficulty: {
    type: String,
    default: 'medium',
  },
  topic: {
    type: String,
    default: '',
  },
  skillsTested: {
    type: [String],
    default: [],
  },
  questionType: {
    type: String,
    default: 'conceptual',
  },
  questionStyle: {
    type: String,
    default: 'conceptual',
  },
  codingRequired: {
    type: Boolean,
    default: false,
  },
  language: {
    type: String,
    default: '',
  },
  starterCode: {
    type: String,
    default: '',
  },
  answerText: {
    type: String,
    default: '',
  },
  feedback: {
    correctness: { type: Number, min: 0, max: 100, default: 0 },
    technicalAccuracy: { type: Number, min: 0, max: 100, default: 0 },
    completeness: { type: Number, min: 0, max: 100, default: 0 },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    comments: String,
    strengths: String,
    weakAreas: String,
  },
});

const InterviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    interviewType: {
      type: String,
      enum: ['Technical', 'HR'],
      default: 'Technical',
    },
    technology: {
      type: String,
      required: function() { return this.interviewType === 'Technical'; },
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Senior'],
      required: [true, 'Please specify the difficulty level'],
    },
    experience: {
      type: Number,
      default: 0,
      min: 0,
      max: 50,
    },
    status: {
      type: String,
      enum: ['scheduled', 'started', 'completed', 'cancelled', 'missed'],
      default: 'started',
    },
    currentPhase: {
      type: String,
      default: 'fundamentals'
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
    startedAt: {
      type: Date,
    },
    endsAt: {
      type: Date,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    interviewerConfig: {
      avatar: { type: String, default: 'professional_male' },
      voiceURI: { type: String },
      region: { type: String, default: 'Default' },
      style: { type: String, default: 'Professional' },
      speed: { type: Number, default: 1.0 }
    },
    questions: [QuestionSchema],
    overallFeedback: {
      score: {
        type: Number,
        min: 0,
        max: 100,
      },
      // Technical metrics
      strengths: [String],
      weakAreas: [String],
      studyTopics: [String],
      // HR metrics
      communication: Number,
      professionalism: Number,
      clarity: Number,
      teamwork: Number,
      adaptability: Number,
      selfAwareness: Number,
      careerMotivation: Number,
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
