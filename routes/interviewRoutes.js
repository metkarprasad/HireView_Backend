const express = require('express');
const {
  startInterview,
  submitAnswer,
  getHistory,
  getInterviewDetails,
  getAnalytics,
} = require('../controllers/interviewController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect); // Secure all routes

router.post('/start', startInterview);
router.post('/submit', submitAnswer);
router.get('/history', getHistory);
router.get('/analytics/dashboard', getAnalytics);
router.get('/:id', getInterviewDetails);

module.exports = router;
