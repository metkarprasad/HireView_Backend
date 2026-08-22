const Interview = require('../models/Interview');
const groqService = require('../services/groqService');
const emailService = require('../services/emailService');

const QUESTION_LIMIT = 5;

// @desc    Start a new interview session and get first question
// @route   POST /api/interviews/start
// @access  Private
exports.startInterview = async (req, res, next) => {
  const {
    interviewType = 'Technical',
    technology,
    difficulty,
    experience,
    duration = 1.0,
    isScheduled = false,
    scheduledAt,
    interviewerConfig = {
      avatar: 'professional_male',
      voiceURI: '',
      region: 'Default',
      style: 'Professional',
      speed: 1.0
    }
  } = req.body;

  if (interviewType === 'Technical' && (!technology || !difficulty)) {
    return res.status(400).json({ success: false, message: 'Please specify technology and difficulty for a technical interview' });
  }

  if (interviewType === 'HR' && !difficulty) {
    return res.status(400).json({ success: false, message: 'Please specify the level for the HR interview' });
  }

  const selectedDuration = duration ? parseFloat(duration) : 1.0;
  if (selectedDuration < 0.5 || selectedDuration > 4.0) {
    return res.status(400).json({ success: false, message: 'Duration must be between 0.5 and 4 hours' });
  }

  try {
    if (isScheduled) {
      if (!scheduledAt) {
        return res.status(400).json({ success: false, message: 'Scheduled date and time is required' });
      }

      const interview = await Interview.create({
        userId: req.user.id,
        interviewType,
        technology: interviewType === 'Technical' ? technology : undefined,
        difficulty,
        status: 'scheduled',
        currentPhase: interviewType === 'HR' ? 'greeting' : 'fundamentals',
        duration: selectedDuration,
        experience: experience || 0,
        isScheduled: true,
        scheduledAt: new Date(scheduledAt),
        interviewerConfig,
        questions: [],
      });

      // Send immediate email confirmation
      await emailService.sendInterviewConfirmation(
        req.user.email,
        req.user.username,
        interview.technology || 'HR',
        interview.difficulty,
        interview.scheduledAt,
        interview.duration
      );

      return res.status(201).json({
        success: true,
        status: 'scheduled',
        interviewId: interview._id,
        interviewType: interview.interviewType,
        technology: interview.technology,
        difficulty: interview.difficulty,
        duration: interview.duration,
        scheduledAt: interview.scheduledAt,
      });
    }

    // Otherwise, start immediately
    // 1. Generate first question
    let firstQuestionData;
    if (interviewType === 'HR') {
      firstQuestionData = await groqService.generateHRQuestion(difficulty, experience || 0, 'greeting', []);
    } else {
      firstQuestionData = await groqService.generateQuestion(technology, difficulty, experience || 0, 'fundamentals', []);
    }

    // 2. Create Interview session in DB
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + selectedDuration * 60 * 60 * 1000);

    const interview = await Interview.create({
      userId: req.user.id,
      interviewType,
      technology: interviewType === 'Technical' ? technology : undefined,
      difficulty,
      experience: experience || 0,
      status: 'started',
      currentPhase: interviewType === 'HR' ? 'greeting' : 'fundamentals',
      duration: selectedDuration,
      isScheduled: false,
      startedAt,
      endsAt,
      interviewerConfig,
      questions: [
        {
          questionText: firstQuestionData.questionText || firstQuestionData,
          expectedAnswer: firstQuestionData.expectedAnswer || '',
          difficulty: firstQuestionData.difficulty || difficulty,
          topic: firstQuestionData.topic || '',
          skillsTested: firstQuestionData.skillsTested || [],
          questionType: firstQuestionData.questionType || 'conceptual',
          answerText: '',
        },
      ],
    });

    res.status(201).json({
      success: true,
      interviewId: interview._id,
      interviewType: interview.interviewType,
      technology: interview.technology,
      difficulty: interview.difficulty,
      questionIndex: 0,
      question: firstQuestionData.questionText || firstQuestionData,
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

    // If the interview is scheduled and not started yet, start it now
    if (interview.status === 'scheduled') {
      interview.status = 'started';
      interview.startedAt = new Date();
      interview.endsAt = new Date(interview.startedAt.getTime() + (interview.duration || 1.0) * 60 * 60 * 1000);

      if (interview.questions.length === 0) {
        let firstQuestionData;
        if (interview.interviewType === 'HR') {
          firstQuestionData = await groqService.generateHRQuestion(
            interview.difficulty,
            interview.experience || 0,
            interview.currentPhase || 'greeting',
            []
          );
        } else {
          firstQuestionData = await groqService.generateQuestion(
            interview.technology,
            interview.difficulty,
            interview.experience || 0,
            interview.currentPhase || 'fundamentals',
            []
          );
        }
        
        interview.questions.push({
          questionText: firstQuestionData.questionText || firstQuestionData,
          expectedAnswer: firstQuestionData.expectedAnswer || '',
          difficulty: firstQuestionData.difficulty || interview.difficulty,
          topic: firstQuestionData.topic || '',
          skillsTested: firstQuestionData.skillsTested || [],
          questionType: firstQuestionData.questionType || 'conceptual',
          answerText: '',
        });
      }
      await interview.save();
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
