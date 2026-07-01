const Interview = require('../models/Interview');
const groqService = require('../services/groqService');

const QUESTION_LIMIT = 5;

// @desc    Start a new interview session and get first question
// @route   POST /api/interviews/start
// @access  Private
exports.startInterview = async (req, res, next) => {
  const { technology, difficulty } = req.body;

  if (!technology || !difficulty) {
    return res.status(400).json({ success: false, message: 'Please specify technology and difficulty' });
  }

  try {
    // 1. Generate first question
    const firstQuestionText = await groqService.generateQuestion(technology, difficulty, []);

    // 2. Create Interview session in DB
    const interview = await Interview.create({
      userId: req.user.id,
      technology,
      difficulty,
      status: 'started',
      questions: [
        {
          questionText: firstQuestionText,
          answerText: '',
        },
      ],
    });

    res.status(201).json({
      success: true,
      interviewId: interview._id,
      technology: interview.technology,
      difficulty: interview.difficulty,
      questionIndex: 0,
      question: firstQuestionText,
      totalQuestions: QUESTION_LIMIT,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit answer to current question and get next question or overall report
// @route   POST /api/interviews/submit
// @access  Private
exports.submitAnswer = async (req, res, next) => {
  const { interviewId, answerText } = req.body;

  if (!interviewId || answerText === undefined) {
    return res.status(400).json({ success: false, message: 'Please provide interview ID and answer text' });
  }

  try {
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user.id });

    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview session not found' });
    }

    if (interview.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Interview session is already completed' });
    }

    const currentQuestionIndex = interview.questions.length - 1;
    const currentQuestion = interview.questions[currentQuestionIndex];

    // 1. Evaluate current answer
    const feedback = await groqService.evaluateAnswer(
      currentQuestion.questionText,
      answerText,
      interview.technology,
      interview.difficulty
    );

    // Update current question with user's response and feedback
    currentQuestion.answerText = answerText;
    currentQuestion.feedback = feedback;

    let nextQuestion = null;
    let overallReport = null;

    // 2. Decide if we should generate next question or compile overall report
    if (interview.questions.length < QUESTION_LIMIT) {
      // Generate next question
      nextQuestion = await groqService.generateQuestion(
        interview.technology,
        interview.difficulty,
        interview.questions
      );
      
      interview.questions.push({
        questionText: nextQuestion,
        answerText: '',
      });
      
      await interview.save();

      res.status(200).json({
        success: true,
        status: 'ongoing',
        feedback: currentQuestion.feedback,
        nextQuestion: nextQuestion,
        questionIndex: interview.questions.length - 1, // index of next question
        totalQuestions: QUESTION_LIMIT,
      });
    } else {
      // Complete the interview session
      interview.status = 'completed';

      // Generate overall evaluation report
      overallReport = await groqService.generateOverallReport(
        interview.technology,
        interview.difficulty,
        interview.questions
      );

      interview.overallFeedback = overallReport;
      await interview.save();

      res.status(200).json({
        success: true,
        status: 'completed',
        feedback: currentQuestion.feedback,
        overallReport: overallReport,
        interviewId: interview._id,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's completed interview sessions history
// @route   GET /api/interviews/history
// @access  Private
exports.getHistory = async (req, res, next) => {
  try {
    const interviews = await Interview.find({
      userId: req.user.id,
      status: 'completed',
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: interviews.length,
      interviews,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get details of a single interview session
// @route   GET /api/interviews/:id
// @access  Private
exports.getInterviewDetails = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview session not found' });
    }

    res.status(200).json({
      success: true,
      interview,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user performance analytics
// @route   GET /api/interviews/analytics/dashboard
// @access  Private
exports.getAnalytics = async (req, res, next) => {
  try {
    const interviews = await Interview.find({
      userId: req.user.id,
      status: 'completed',
    });

    if (interviews.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          totalCompleted: 0,
          averageScore: 0,
          difficultyDistribution: {},
          techScores: [],
          scoreHistory: [],
        },
      });
    }

    // 1. General Totals
    const totalCompleted = interviews.length;
    const averageScore = Math.round(
      interviews.reduce((sum, item) => sum + (item.overallFeedback?.score || 0), 0) / totalCompleted
    );

    // 2. Score History (Chronological)
    const scoreHistory = interviews
      .map((item) => ({
        date: item.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: item.overallFeedback?.score || 0,
        tech: item.technology,
      }))
      .reverse(); // newest last for line chart

    // 3. Technology scores
    const techGroups = {};
    const difficultyDist = { Beginner: 0, Intermediate: 0, Advanced: 0 };

    interviews.forEach((item) => {
      // Tech grouping
      if (!techGroups[item.technology]) {
        techGroups[item.technology] = { sum: 0, count: 0 };
      }
      techGroups[item.technology].sum += item.overallFeedback?.score || 0;
      techGroups[item.technology].count += 1;

      // Difficulty distribution
      if (difficultyDist[item.difficulty] !== undefined) {
        difficultyDist[item.difficulty] += 1;
      }
    });

    const techScores = Object.keys(techGroups).map((tech) => ({
      technology: tech,
      score: Math.round(techGroups[tech].sum / techGroups[tech].count),
      count: techGroups[tech].count,
    }));

    res.status(200).json({
      success: true,
      summary: {
        totalCompleted,
        averageScore,
        difficultyDistribution: difficultyDist,
        techScores,
        scoreHistory,
      },
    });
  } catch (error) {
    next(error);
  }
};
