const PHASES = ['fundamentals', 'concepts', 'application', 'problem_solving', 'advanced'];

/**
 * Calculates the next phase of the interview based on performance and configuration.
 * @param {string} currentPhase - The current phase of the interview.
 * @param {number} lastScore - The score of the most recent answer (0-100).
 * @param {number} questionIndex - The 0-based index of the question just answered.
 * @param {string} difficulty - The overall interview level (Beginner, Intermediate, Advanced, Senior).
 * @param {number} totalQuestions - The total number of questions expected in the interview.
 * @returns {string} The next phase to use.
 */
exports.calculateNextPhase = (currentPhase, lastScore, questionIndex, difficulty, totalQuestions = 5) => {
  const currentIndex = PHASES.indexOf(currentPhase);
  if (currentIndex === -1) return 'fundamentals';

  // If candidate is struggling significantly, we don't progress them yet.
  if (lastScore < 50) {
    return currentPhase; // Keep them in current phase
  }

  const levelLower = (difficulty || '').toLowerCase();
  let maxPhaseIndex = 2; // Default max to 'application'

  if (levelLower === 'beginner') {
    maxPhaseIndex = 3; // up to 'problem_solving'
  } else if (levelLower === 'intermediate') {
    maxPhaseIndex = 4; // up to 'advanced' (but very late)
  } else if (levelLower === 'advanced' || levelLower === 'senior') {
    maxPhaseIndex = 4; // up to 'advanced'
  }

  // Calculate roughly how fast we should progress
  // For a 10 question interview for a Senior, they might reach advanced by Q5.
  // We'll use a simple threshold based on question index and level.
  let shouldProgress = false;

  if (lastScore >= 70) {
    // They answered well, they are eligible to progress
    // Depending on level, progress faster
    if (levelLower === 'beginner') {
       // Beginners need more questions per phase
       if (questionIndex >= (currentIndex + 1) * 2) shouldProgress = true;
    } else if (levelLower === 'intermediate') {
       if (questionIndex >= (currentIndex + 1) * 1.5) shouldProgress = true;
    } else {
       // Seniors progress rapidly if they answer well
       if (questionIndex >= currentIndex + 1) shouldProgress = true;
    }
  }


  if (shouldProgress && currentIndex < maxPhaseIndex) {
    return PHASES[currentIndex + 1];
  }

  return currentPhase;
};

const HR_PHASES = [
  'greeting',
  'introduction',
  'current_role',
  'experience',
  'company',
  'responsibilities',
  'achievements',
  'motivation',
  'strengths_weaknesses',
  'behavioral',
  'teamwork_communication',
  'situational',
  'career_goals',
  'role_expectations',
  'candidate_questions',
  'closing'
];

/**
 * Calculates the next phase for an HR interview.
 */
exports.calculateNextHRPhase = (currentPhase, lastScore, questionIndex, totalQuestions = 16) => {
  const currentIndex = HR_PHASES.indexOf(currentPhase);
  if (currentIndex === -1) return 'greeting';

  if (lastScore < 60) {
    // If they score somewhat poorly, maybe keep them there for one more question to dig deeper
    // But don't punish them forever in HR.
    if (questionIndex >= (currentIndex + 1) * 2) {
       // Force progress if stuck
       if (currentIndex < HR_PHASES.length - 1) return HR_PHASES[currentIndex + 1];
    }
    return currentPhase;
  }

  // HR generally progresses fairly linearly.
  // 1-2 questions per phase.
  if (questionIndex >= currentIndex + 1) {
    if (currentIndex < HR_PHASES.length - 1) return HR_PHASES[currentIndex + 1];
  }

  return currentPhase;
};
