const mongoose = require('mongoose');

const InterviewAnalyticsSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewAttempt', required: true },
    overallScore: { type: Number, min: 0, max: 100 },
    technicalScore: { type: Number, min: 0, max: 100 },
    communicationScore: { type: Number, min: 0, max: 100 },
    confidenceScore: { type: Number, min: 0, max: 100 },
    problemSolvingScore: { type: Number, min: 0, max: 100 },
    codingScore: { type: Number, min: 0, max: 100 },
    grammarScore: { type: Number, min: 0, max: 100 },
    vocabularyScore: { type: Number, min: 0, max: 100 },
    speakingPace: { type: Number }, // words per minute
    fillerWordsCount: { type: Number },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    improvementSuggestions: [{ type: String }],
    recommendedResources: [{ type: String }],
    transcriptId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewTranscript' },
    // Additional analytical fields can be added later
  },
  { timestamps: true }
);

module.exports = mongoose.model('InterviewAnalytics', InterviewAnalyticsSchema);
