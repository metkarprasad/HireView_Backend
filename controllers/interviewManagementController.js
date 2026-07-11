const Interview = require('../models/Interview');
const InterviewAttempt = require('../models/InterviewAttempt');
const InterviewEvent = require('../models/InterviewEvent');
const InterviewAnalytics = require('../models/InterviewAnalytics');
const InterviewReview = require('../models/InterviewReview');
const InterviewNote = require('../models/InterviewNote');
const InterviewCodeSubmission = require('../models/InterviewCodeSubmission');
const InterviewTranscript = require('../models/InterviewTranscript');
const { sendInterviewCancellation, sendInterviewReschedule } = require('../services/emailService');

/**
 * Cancel a scheduled interview
 */
exports.cancelInterview = async (req, res, next) => {
  const { id } = req.params; // interview id
  try {
    const interview = await Interview.findOne({ _id: id, userId: req.user.id });
    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }
    if (interview.status !== 'scheduled') {
      return res.status(400).json({ success: false, message: 'Only scheduled interviews can be cancelled' });
    }
    interview.status = 'cancelled';
    await interview.save();

    // send cancellation email if possible
    await sendInterviewCancellation(req.user.email, interview);

    return res.status(200).json({ success: true, message: 'Interview cancelled' });
  } catch (err) {
    next(err);
  }
};

/**
 * Reschedule a scheduled interview
 */
exports.rescheduleInterview = async (req, res, next) => {
  const { id } = req.params;
  const { scheduledAt } = req.body;
  if (!scheduledAt) {
    return res.status(400).json({ success: false, message: 'New scheduledAt is required' });
  }
  try {
    const interview = await Interview.findOne({ _id: id, userId: req.user.id });
    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }
    if (interview.status !== 'scheduled') {
      return res.status(400).json({ success: false, message: 'Only scheduled interviews can be rescheduled' });
    }
    interview.scheduledAt = new Date(scheduledAt);
    await interview.save();

    await sendInterviewReschedule(req.user.email, interview);
    return res.status(200).json({ success: true, message: 'Interview rescheduled', scheduledAt: interview.scheduledAt });
  } catch (err) {
    next(err);
  }
};

/**
 * Submit a review for a completed interview
 */
exports.submitReview = async (req, res, next) => {
  const { id } = req.params; // interview id
  const { rating, feedback } = req.body;
  if (!rating) {
    return res.status(400).json({ success: false, message: 'Rating is required' });
  }
  try {
    const interview = await Interview.findOne({ _id: id, userId: req.user.id });
    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }
    if (interview.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Only completed interviews can be reviewed' });
    }
    const review = await InterviewReview.create({
      attemptId: interview._id,
      userId: req.user.id,
      rating,
      feedback,
    });
    return res.status(201).json({ success: true, review });
  } catch (err) {
    next(err);
  }
};

/**
 * Get review for an interview
 */
exports.getReview = async (req, res, next) => {
  const { id } = req.params;
  try {
    const review = await InterviewReview.findOne({ attemptId: id, userId: req.user.id });
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    return res.status(200).json({ success: true, review });
  } catch (err) {
    next(err);
  }
};

/**
 * Save a note for an interview attempt
 */
exports.saveNote = async (req, res, next) => {
  const { id } = req.params; // interview id
  const { content } = req.body;
  try {
    const attempt = await InterviewAttempt.findOne({ interviewId: id, userId: req.user.id });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Interview attempt not found' });
    }
    // Upsert a note document
    const note = await InterviewNote.findOneAndUpdate(
      { attemptId: attempt._id, userId: req.user.id },
      { content },
      { upsert: true, new: true }
    );
    return res.status(200).json({ success: true, note });
  } catch (err) {
    next(err);
  }
};

/**
 * Get notes for an interview attempt
 */
exports.getNote = async (req, res, next) => {
  const { id } = req.params;
  try {
    const attempt = await InterviewAttempt.findOne({ interviewId: id, userId: req.user.id });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Interview attempt not found' });
    }
    const note = await InterviewNote.findOne({ attemptId: attempt._id, userId: req.user.id });
    return res.status(200).json({ success: true, note });
  } catch (err) {
    next(err);
  }
};

/**
 * Save a code submission for a specific question
 */
exports.saveCode = async (req, res, next) => {
  const { id } = req.params; // interview id
  const { questionIndex, language, code } = req.body;
  if (questionIndex === undefined || !language || !code) {
    return res.status(400).json({ success: false, message: 'questionIndex, language and code are required' });
  }
  try {
    const attempt = await InterviewAttempt.findOne({ interviewId: id, userId: req.user.id });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Interview attempt not found' });
    }
    const submission = await InterviewCodeSubmission.create({
      attemptId: attempt._id,
      questionIndex,
      language,
      code,
    });
    return res.status(201).json({ success: true, submission });
  } catch (err) {
    next(err);
  }
};

/**
 * Get code submissions for an interview attempt
 */
exports.getCodeSubmissions = async (req, res, next) => {
  const { id } = req.params;
  try {
    const attempt = await InterviewAttempt.findOne({ interviewId: id, userId: req.user.id });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Interview attempt not found' });
    }
    const submissions = await InterviewCodeSubmission.find({ attemptId: attempt._id });
    return res.status(200).json({ success: true, submissions });
  } catch (err) {
    next(err);
  }
};

/**
 * Get event log for an interview attempt
 */
exports.getEvents = async (req, res, next) => {
  const { id } = req.params;
  try {
    const attempt = await InterviewAttempt.findOne({ interviewId: id, userId: req.user.id });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Interview attempt not found' });
    }
    const events = await InterviewEvent.find({ attemptId: attempt._id }).sort({ timestamp: 1 });
    return res.status(200).json({ success: true, events });
  } catch (err) {
    next(err);
  }
};

/**
 * Get transcript for an interview attempt
 */
exports.getTranscript = async (req, res, next) => {
  const { id } = req.params;
  try {
    const attempt = await InterviewAttempt.findOne({ interviewId: id, userId: req.user.id });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Interview attempt not found' });
    }
    const transcript = await InterviewTranscript.findOne({ attemptId: attempt._id });
    return res.status(200).json({ success: true, transcript });
  } catch (err) {
    next(err);
  }
};
