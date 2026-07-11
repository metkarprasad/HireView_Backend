const express = require('express');
const {
  startInterview,
  submitAnswer,
  getHistory,
  getInterviewDetails,
  getAnalytics,
} = require('../controllers/interviewController');
const {
  cancelInterview,
  rescheduleInterview,
  submitReview,
  getReview,
  saveNote,
  getNote,
  saveCode,
  getCodeSubmissions,
  getEvents,
  getTranscript,
} = require('../controllers/interviewManagementController');

const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Interview lifecycle endpoints
router.post('/start', startInterview);
router.post('/submit', submitAnswer);
router.get('/history', getHistory);
router.get('/analytics/dashboard', getAnalytics);
router.get('/:id', getInterviewDetails);

// Management endpoints
router.put('/:id/cancel', cancelInterview);
router.put('/:id/reschedule', rescheduleInterview);
router.post('/:id/review', submitReview);
router.get('/:id/review', getReview);
router.post('/:id/note', saveNote);
router.get('/:id/note', getNote);
router.post('/:id/code', saveCode);
router.get('/:id/code', getCodeSubmissions);
router.get('/:id/events', getEvents);
router.get('/:id/transcript', getTranscript);

module.exports = router;
