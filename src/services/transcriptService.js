// src/services/transcriptService.js
/**
 * Service for storing interview transcripts.
 * Stores the full text for each interview attempt.
 * In a real implementation you might store segmented timestamps.
 */
const InterviewTranscript = require('../models/InterviewTranscript');

/**
 * Save or update transcript for a given attempt.
 * @param {String} attemptId - Mongo ObjectId of the interview attempt.
 * @param {String} transcript - Full transcript text up to now.
 */
async function saveTranscript(attemptId, transcript) {
  // Find existing document
  let doc = await InterviewTranscript.findOne({ attemptId });
  if (doc) {
    // Append to existing fullText
    doc.fullText = doc.fullText ? `${doc.fullText} ${transcript}` : transcript;
    await doc.save();
  } else {
    // Create new document
    doc = new InterviewTranscript({ attemptId, fullText: transcript, segments: [] });
    await doc.save();
  }
  return doc;
}

module.exports = { saveTranscript };
