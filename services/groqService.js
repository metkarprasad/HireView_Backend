const axios = require('axios');

// Emergency Mock Generator (Strictly tied to the selected technology)
const getMockQuestion = (technology, difficulty, index) => {
  if (!technology) throw new Error("Interview technology is required.");
  const topics = ['Architecture', 'Performance', 'Error Handling', 'Core Concepts', 'Debugging', 'Scalability'];
  const topic = topics[index % topics.length];
  
  return {
    questionText: `Can you explain your experience with ${topic} specifically in ${technology}? Provide a real-world example if possible.`,
    expectedAnswer: `The candidate should provide a comprehensive explanation of ${topic} specific to ${technology}, demonstrating practical experience.`,
    difficulty: difficulty.toLowerCase(),
    topic: topic,
    skillsTested: [technology, topic],
    questionType: 'conceptual'
  };
};

const getMockEvaluation = (question, answer) => {
  const score = answer && answer.length > 50 ? 80 : 50; 
  const expected = typeof question === 'object' ? (question.expectedAnswer || '') : '';
  return {
    correctness: score,
    technicalAccuracy: score - 5,
    completeness: score + 5,
    score: score,
    maxScore: 100,
    percentage: score,
    comments: "Fallback evaluation: The candidate provided a basic response but more specific technical depth is needed.",
    strengths: "Addressed the general topic.",
    weakAreas: "Missed advanced technical details and edge cases.",
    improvements: expected ? `Recommended approach: ${expected}` : "Review official documentation and standard design patterns."
  };
};

const getMockReport = (questions) => {
  const evaluated = questions.filter(q => q.feedback && q.feedback.score !== undefined);
  const totalScore = evaluated.reduce((sum, q) => sum + (q.feedback?.score || 0), 0);
  const averagePercentage = evaluated.length > 0 ? Math.round(totalScore / evaluated.length) : 0;
  
  return {
    score: averagePercentage,
    strengths: ["Demonstrated foundational knowledge.", "Able to communicate basic concepts."],
    weakAreas: ["Needs deeper dive into edge cases and advanced architecture."],
    studyTopics: ["Performance profiling", "Advanced system design"],
    learningPath: [
      { step: "Deepen Core Theory", description: "Review official documentation and advanced patterns." }
    ]
  };
};

const callGroqAPI = async (messages, responseFormatJson = false) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY_HERE') {
    throw new Error('Groq API Key is not configured.');
  }

  // openai/gpt-oss-120b verified to work
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  
  try {
    const payload = {
      model: model,
      messages: messages,
      temperature: 0.7
    };

    if (responseFormatJson) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error(`Groq API Request failed: ${error.response ? error.response.status : error.message}`);
    throw error;
  }
};

const cleanJSONResponse = (rawString) => {
  try {
    let cleanStr = rawString.trim();
    if (cleanStr.startsWith('```')) {
      cleanStr = cleanStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }
    return JSON.parse(cleanStr);
  } catch (err) {
    try {
      const firstBrace = rawString.indexOf('{');
      const lastBrace = rawString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        const potentialJson = rawString.substring(firstBrace, lastBrace + 1);
        return JSON.parse(potentialJson);
      }
    } catch (innerErr) { }
    throw new Error('Invalid JSON format returned by AI');
  }
};

exports.generateQuestion = async (technology, difficulty, experience, currentPhase, history = [], retryCount = 0, timeRemaining = 30, interviewerStyle = 'Professional') => {
  if (!technology) throw new Error("Interview technology is required.");
  
  const questionIndex = history.length;
  const phase = currentPhase || 'fundamentals';
  
  try {
    let previousQuestionsList = 'None';
    let topicsCovered = 'None';
    let questionStylesUsed = 'None';
    let previousEvaluations = 'None';
    let strengths = 'None';
    let weaknesses = 'None';

    if (history.length > 0) {
      previousQuestionsList = history.map((q, idx) => `Q${idx + 1}: ${q.questionText}`).join('\n');
      topicsCovered = Array.from(new Set(history.map(q => q.topic))).filter(Boolean).join(', ');
      questionStylesUsed = Array.from(new Set(history.map(q => q.questionStyle || q.questionType))).filter(Boolean).join(', ');
      previousEvaluations = history.map((q, idx) => `Q${idx + 1} Score: ${q.feedback?.score || 0}/100. Comments: ${q.feedback?.comments || 'None'}`).join('\n');
      
      const allStrengths = history.map(q => q.feedback?.strengths).filter(Boolean);
      const allWeaknesses = history.map(q => q.feedback?.weakAreas).filter(Boolean);
      
      if (allStrengths.length > 0) strengths = allStrengths.join(' | ');
      if (allWeaknesses.length > 0) weaknesses = allWeaknesses.join(' | ');
    }

    let allowedTypes = [];
    if (phase === "fundamentals") {
      allowedTypes = ["definition", "basic_concept", "conceptual"];
    } else if (phase === "concepts") {
      allowedTypes = ["conceptual", "comparison", "why_how", "concept_relationship"];
    } else if (phase === "application") {
      allowedTypes = ["practical", "implementation", "simple_scenario", "coding"];
    } else if (phase === "problem_solving") {
      allowedTypes = ["debugging", "problem_solving", "optimization", "code_review", "coding"];
    } else if (phase === "advanced") {
      allowedTypes = ["advanced_scenario", "architecture", "tradeoff", "system_design", "advanced_coding"];
    }

    const timeInstruction = timeRemaining < 5 
      ? `\nURGENT TIME WARNING: Only ${Math.round(timeRemaining)} minutes remain! You MUST ask final wrap-up or high-level closing questions now. Keep the question brief.` 
      : `\nTIME REMAINING: ${Math.round(timeRemaining)} minutes. Adjust your question depth naturally based on the remaining time.`;

    const prompt = `You are conducting a structured professional technical interview.
The interview MUST progress from fundamentals to deeper concepts, then practical application, then problem solving, and finally advanced questions.
Adopt a ${interviewerStyle} personality and speaking style when framing your questions.

INTERVIEW CONTEXT:
Technology: ${technology}
Candidate Experience: ${experience} years
Target Role Level: ${difficulty}
Question Number: ${questionIndex + 1}
CURRENT INTERVIEW PHASE: ${phase.toUpperCase()} (Allowed question types: ${allowedTypes.join(', ')})${timeInstruction}

YOUR RESPONSIBILITIES:
1. Ask exactly ONE interview question.
2. The question MUST primarily test the selected technology (${technology}).
3. NEVER default to JavaScript or another technology unless ${technology} is exactly JavaScript.
4. Respect the candidate's experience level (${experience} years) and interview level (${difficulty}).
5. Respect the CURRENT INTERVIEW PHASE. Do NOT skip phases.
   - If FUNDAMENTALS: ask definition and basic conceptual questions. Do NOT start with "Suppose..." or "Imagine...".
   - If CONCEPTS: test deeper conceptual understanding and relationships.
   - If APPLICATION: test practical implementation and simple scenarios.
   - If PROBLEM_SOLVING: test debugging, optimization, coding, and problem solving.
   - If ADVANCED: test architecture, trade-offs, system design.
6. Do NOT start an interview with advanced scenarios or use "Suppose/Imagine/Consider" in the fundamentals phase.
7. Never repeat a previous question or ask a semantically duplicate question.
8. Increase difficulty gradually.
9. When a coding question is appropriate (in Application, Problem Solving, or Advanced phases), return questionType="coding" and provide the required coding metadata (language, starterCode). The coding language should be determined from the selected technology.

PREVIOUS QUESTIONS:
${previousQuestionsList}

QUESTION STYLES USED:
${questionStylesUsed}

TOPICS ALREADY COVERED:
${topicsCovered}

PREVIOUS EVALUATIONS:
${previousEvaluations}

CANDIDATE STRENGTHS:
${strengths}

CANDIDATE WEAKNESSES:
${weaknesses}

OUTPUT FORMAT (STRICT JSON):
If it is a NORMAL question:
{
  "questionText": "The actual question to ask the candidate.",
  "expectedAnswer": "Detailed description of what constitutes a perfect answer.",
  "difficulty": "easy, medium, hard, or expert",
  "topic": "The specific sub-topic (e.g. Hooks, Streams, Indexes)",
  "skillsTested": ["Skill 1", "Skill 2"],
  "questionType": "scenario | debugging | conceptual | tradeoff | architecture",
  "questionStyle": "scenario | debugging | conceptual | tradeoff | architecture",
  "codingRequired": false
}

If it is a CODING question:
{
  "questionText": "The coding problem description.",
  "expectedAnswer": "Explanation of the optimal algorithm and edge cases.",
  "difficulty": "medium or hard",
  "topic": "The specific sub-topic",
  "skillsTested": ["Skill 1", "Skill 2"],
  "questionType": "coding",
  "questionStyle": "coding",
  "codingRequired": true,
  "language": "javascript (or appropriate language for ${technology})",
  "starterCode": "function solve() {\\n  // Write your code here\\n}"
}`;

    const messages = [
      { role: 'system', content: 'You are an AI technical interviewer. You must ONLY output a valid JSON object matching the exact requested format. Do NOT wrap in markdown.' },
      { role: 'user', content: prompt }
    ];

    const rawResponse = await callGroqAPI(messages, true);
    const parsedData = cleanJSONResponse(rawResponse);

    // SERVER-SIDE VALIDATION: Technology Drift & Semantic Duplication Guard
    const questionLower = (parsedData.questionText || '').toLowerCase();
    const techLower = technology.toLowerCase();
    
    // Very basic check: If the technology is clearly not mentioned in the question or expected answer, and it isn't a direct follow-up, it might be a drift.
    // To be safe, we reject if the word JavaScript appears when JS isn't the technology, just as a safety rail (unless it's a known JS framework where it might make sense, but we'll be strict as requested).
    if (techLower !== 'javascript' && questionLower.includes('javascript') && !questionLower.includes(techLower)) {
       console.warn(`[VALIDATION FAILED] AI drifted to JavaScript. Retrying... (Attempt ${retryCount + 1})`);
       if (retryCount < 2) {
         return exports.generateQuestion(technology, difficulty, experience, currentPhase, history, retryCount + 1);
       }
       throw new Error("AI Technology Drift Validation Failed");
    }

    return parsedData;
  } catch (error) {
    if (error.message === "AI Technology Drift Validation Failed" || error.response) {
      if (retryCount < 2) {
        console.warn(`[RETRY] Groq API or Validation failed. Retrying... (Attempt ${retryCount + 1})`);
        return exports.generateQuestion(technology, difficulty, experience, currentPhase, history, retryCount + 1);
      }
    }
    console.error('[FALLBACK] Using emergency mock question generator due to repeated failures.');
    return getMockQuestion(technology, difficulty, questionIndex);
  }
};

exports.generateHRQuestion = async (difficulty, experience, currentPhase, history = [], timeRemaining = 30, retryCount = 0, interviewerStyle = 'Professional') => {
  const questionIndex = history.length;
  const phase = currentPhase || 'introduction';
  
  try {
    let previousQuestionsList = 'None';
    let previousAnswersList = 'None';
    if (history.length > 0) {
      previousQuestionsList = history.map((q, idx) => `Q${idx + 1}: ${q.questionText}`).join('\n');
      previousAnswersList = history.map((q, idx) => `A${idx + 1}: ${q.answerText || 'None'}`).join('\n');
    }

    const timeInstruction = timeRemaining < 5 
      ? `\nURGENT TIME WARNING: Only ${Math.round(timeRemaining)} minutes remain! You MUST begin wrapping up the interview. Transition towards candidate questions and closing.` 
      : `\nTIME REMAINING: ${Math.round(timeRemaining)} minutes. Adjust your question depth naturally based on the remaining time.`;

    const prompt = `You are an experienced professional HR interviewer conducting a one-on-one HR interview.
Conduct a natural, conversational, and structured HR interview.
Adopt a ${interviewerStyle} personality and speaking style when framing your questions.

INTERVIEW CONTEXT:
Candidate Experience: ${experience} years
Target Role Level: ${difficulty}
Question Number: ${questionIndex + 1}
CURRENT HR PHASE: ${phase.toUpperCase()}${timeInstruction}

YOUR RESPONSIBILITIES:
1. Ask exactly ONE HR interview question. Do NOT ask multiple questions at once.
2. DO NOT ask any technical questions (e.g., coding, system design, framework specifics).
3. Respect the CURRENT HR PHASE. Do NOT skip phases.
   - If GREETING: Always start with a natural, friendly greeting (e.g., "Hi, how are you doing today?") and ask a simple ice-breaker.
   - If INTRODUCTION: ask "Tell me about yourself" or for a brief professional summary.
   - If CURRENT_ROLE: ask about their current job and day-to-day responsibilities.
   - If EXPERIENCE: ask about past roles and career progression.
   - If COMPANY: ask about their current or previous company environment.
   - If RESPONSIBILITIES: ask about specific projects they led or contributed to.
   - If ACHIEVEMENTS: ask what they are most proud of.
   - If MOTIVATION: ask why they are looking for a change or what attracted them to this role.
   - If STRENGTHS_WEAKNESSES: ask about areas they excel in and areas they want to improve.
   - If BEHAVIORAL: ask situational questions (e.g., dealing with conflict, failure).
   - If TEAMWORK_COMMUNICATION: ask how they interact with colleagues and handle disagreements.
   - If SITUATIONAL: ask how they would handle hypothetical workplace scenarios.
   - If CAREER_GOALS: ask where they see themselves in the future.
   - If ROLE_EXPECTATIONS: ask what they expect from the new position and management.
   - If CANDIDATE_QUESTIONS: ask if they have any questions for you about the company.
   - If CLOSING: wrap up naturally and thank them for their time.
4. Keep a conversational tone. If the candidate answered a previous question, use their answer to form a contextual follow-up. 
5. DO NOT ask questions whose answers were already provided.
6. DO NOT repeat the same or semantically similar questions.
7. DO NOT start every question with "Tell me about...". Vary the wording naturally.
8. Balance follow-up questions with transitioning to new topics when appropriate.
9. Do not judge personality unfairly in the prompt.
10. Use the candidate's name naturally occasionally, not in every question. (Candidate's name is Prasad, but you can just say "Hi there" or use it sparsely).

PREVIOUS QUESTIONS:
${previousQuestionsList}

PREVIOUS ANSWERS:
${previousAnswersList}

Return your response STRICTLY as a JSON object with the following fields:
{
  "questionText": "The actual HR question you are asking. (Make sure it includes a greeting if this is the greeting phase)",
  "expectedAnswer": "Brief points on what a good answer would include.",
  "questionType": "${phase}",
  "topic": "The general theme of this question"
}`;

    const rawResponse = await callGroqAPI([{ role: "user", content: prompt }], true);
    const parsedData = cleanJSONResponse(rawResponse);
    if (!parsedData.questionText) throw new Error("Invalid format");
    return parsedData;
  } catch (error) {
    if (retryCount < 2) {
      return exports.generateHRQuestion(difficulty, experience, currentPhase, history, retryCount + 1);
    }
    return {
      questionText: "Tell me about a time you had to overcome a difficult challenge at work.",
      expectedAnswer: "Candidate should provide a clear situation, task, action, and result.",
      questionType: "behavioral",
      topic: "challenge"
    };
  }
};

exports.evaluateHRAnswer = async (questionText, answerText, difficulty) => {
  if (!answerText || answerText.trim().length === 0) {
    return {
      score: 0,
      maxScore: 100,
      percentage: 0,
      communication: 0,
      professionalism: 0,
      clarity: 0,
      teamwork: 0,
      adaptability: 0,
      selfAwareness: 0,
      careerMotivation: 0,
      comments: "No answer provided.",
      strengths: "None",
      weakAreas: "Failed to answer.",
      improvements: "Provide a structured answer using the STAR method (Situation, Task, Action, Result)."
    };
  }

  try {
    const prompt = `You are a professional HR evaluator. Evaluate the candidate's answer to the HR question.

QUESTION ASKED: ${questionText}
CANDIDATE'S ANSWER: ${answerText}
TARGET ROLE LEVEL: ${difficulty}

EVALUATION CRITERIA:
- Do NOT evaluate technical coding correctness.
- Evaluate based on communication, clarity, professionalism, self-awareness, teamwork, adaptability, and relevance.
- Provide constructive, evidence-based feedback. Do not make unsupported judgments about personality.
- Provide clear Recommended Solution & Core Theory improvements for the candidate.

Return your evaluation STRICTLY as a JSON object with the following fields:
{
  "score": <overall score from 0-100>,
  "communication": <score 0-100>,
  "professionalism": <score 0-100>,
  "clarity": <score 0-100>,
  "teamwork": <score 0-100>,
  "adaptability": <score 0-100>,
  "selfAwareness": <score 0-100>,
  "careerMotivation": <score 0-100>,
  "comments": "Detailed feedback on the response",
  "strengths": "What they did well",
  "weakAreas": "What they can improve",
  "improvements": "Recommended approach, model response strategy, or communication tips"
}`;

    const rawResponse = await callGroqAPI([{ role: "user", content: prompt }], true);
    const result = cleanJSONResponse(rawResponse);
    const rawScore = typeof result.score === 'number' ? result.score : (parseInt(result.score, 10) || 0);
    const boundedScore = Math.max(0, Math.min(100, rawScore));

    return {
      score: boundedScore,
      maxScore: 100,
      percentage: boundedScore,
      communication: Math.max(0, Math.min(100, Number(result.communication) || boundedScore)),
      professionalism: Math.max(0, Math.min(100, Number(result.professionalism) || boundedScore)),
      clarity: Math.max(0, Math.min(100, Number(result.clarity) || boundedScore)),
      teamwork: Math.max(0, Math.min(100, Number(result.teamwork) || boundedScore)),
      adaptability: Math.max(0, Math.min(100, Number(result.adaptability) || boundedScore)),
      selfAwareness: Math.max(0, Math.min(100, Number(result.selfAwareness) || boundedScore)),
      careerMotivation: Math.max(0, Math.min(100, Number(result.careerMotivation) || boundedScore)),
      comments: result.comments || 'Evaluated successfully.',
      strengths: result.strengths || 'Demonstrated conversational communication.',
      weakAreas: result.weakAreas || 'Can provide more concrete workplace examples.',
      improvements: result.improvements || result.weakAreas || 'Use the STAR methodology to clearly highlight concrete results in behavioural answers.'
    };
  } catch (error) {
    console.error("HR Evaluation Error:", error.message);
    const fallbackScore = answerText.trim().length > 30 ? 70 : 40;
    return {
      score: fallbackScore,
      maxScore: 100,
      percentage: fallbackScore,
      communication: fallbackScore,
      professionalism: fallbackScore,
      clarity: fallbackScore,
      teamwork: fallbackScore,
      adaptability: fallbackScore,
      selfAwareness: fallbackScore,
      careerMotivation: fallbackScore,
      comments: "Evaluation recorded.",
      strengths: "Addressed the question.",
      weakAreas: "Could articulate thoughts with more specific examples.",
      improvements: "Structure responses clearly with the STAR framework (Situation, Task, Action, Result)."
    };
  }
};

exports.generateOverallHRReport = async (difficulty, questions = []) => {
  try {
    const evaluatedQuestions = questions.filter(q => q.feedback && q.feedback.score !== undefined);
    const calculatedAvg = evaluatedQuestions.length > 0
      ? Math.round(evaluatedQuestions.reduce((sum, q) => sum + (q.feedback?.score || 0), 0) / evaluatedQuestions.length)
      : 0;

    const averageCommunication = evaluatedQuestions.length > 0
      ? Math.round(evaluatedQuestions.reduce((sum, q) => sum + (q.feedback?.communication || q.feedback?.score || 0), 0) / evaluatedQuestions.length)
      : 0;

    const averageProfessionalism = evaluatedQuestions.length > 0
      ? Math.round(evaluatedQuestions.reduce((sum, q) => sum + (q.feedback?.professionalism || q.feedback?.score || 0), 0) / evaluatedQuestions.length)
      : 0;
    
    const prompt = `You are a Senior HR Manager. Generate a final HR interview report based on the candidate's performance across ${questions.length} questions.
    
    Overall Score: ${calculatedAvg}/100
    Average Communication: ${averageCommunication}/100
    Average Professionalism: ${averageProfessionalism}/100
    Target Level: ${difficulty}
    
    Return STRICTLY as JSON:
    {
      "score": ${calculatedAvg},
      "strengths": ["string point 1", "string point 2"],
      "weakAreas": ["string point 1", "string point 2"],
      "studyTopics": ["Focus area 1", "Focus area 2"]
    }`;

    const rawResponse = await callGroqAPI([{ role: "user", content: prompt }], true);
    const parsed = cleanJSONResponse(rawResponse);
    return {
      score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : calculatedAvg,
      communication: averageCommunication,
      professionalism: averageProfessionalism,
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : ["Completed the HR interview round with clear articulation."],
      weakAreas: Array.isArray(parsed.weakAreas) && parsed.weakAreas.length > 0 ? parsed.weakAreas : ["Refine situational examples to focus on measurable business impact."],
      studyTopics: Array.isArray(parsed.studyTopics) && parsed.studyTopics.length > 0 ? parsed.studyTopics : ["Behavioural Interview Techniques", "STAR Methodology"]
    };
  } catch (err) {
    const evaluatedQuestions = questions.filter(q => q.feedback && q.feedback.score !== undefined);
    const calculatedAvg = evaluatedQuestions.length > 0
      ? Math.round(evaluatedQuestions.reduce((sum, q) => sum + (q.feedback?.score || 0), 0) / evaluatedQuestions.length)
      : 70;
    return {
      score: calculatedAvg,
      communication: calculatedAvg,
      professionalism: calculatedAvg,
      strengths: ["Completed the HR round."],
      weakAreas: ["Continue refining structured communication."],
      studyTopics: ["STAR Framework", "Executive Communication"]
    };
  }
};

exports.evaluateAnswer = async (questionData, answer, technology, difficulty) => {
  const isQuestionObj = typeof questionData === 'object' && questionData !== null;
  const questionText = isQuestionObj ? (questionData.questionText || '') : String(questionData || '');
  const expectedAnswer = isQuestionObj ? (questionData.expectedAnswer || '') : '';
  const isCoding = isQuestionObj && (questionData.questionType === 'coding' || questionData.codingRequired);

  if (!answer || answer.trim().length === 0) {
    return {
      correctness: 0,
      technicalAccuracy: 0,
      completeness: 0,
      score: 0,
      maxScore: 100,
      percentage: 0,
      comments: "No answer provided.",
      strengths: "None",
      weakAreas: "Question was not answered.",
      improvements: expectedAnswer ? `Recommended Solution: ${expectedAnswer}` : `Review core ${technology} concepts and standard documentation.`
    };
  }

  try {
    let prompt = '';
    if (isCoding) {
      prompt = `You are a senior technical interviewer evaluating a candidate's submitted code.
Technology: ${technology}
Level: ${difficulty}

Coding Question: ${questionText}
Expected Ideal Approach: ${expectedAnswer || 'Optimal, bug-free implementation with consideration of edge cases.'}

Candidate's Submitted Code:
\`\`\`
${answer}
\`\`\`

EVALUATION INSTRUCTIONS:
1. Evaluate code correctness, logic, time/space complexity, edge cases, and code quality.
2. Provide a score from 0-100.
3. In "improvements", provide the recommended solution, optimal code pattern, or core theory principles.

OUTPUT FORMAT (STRICT JSON):
{
  "correctness": <number 0-100>,
  "technicalAccuracy": <number 0-100 (Code Quality & Efficiency)>,
  "completeness": <number 0-100 (Handles edge cases?)>,
  "score": <number 0-100>,
  "comments": "Overall summary of their code.",
  "strengths": "Specific algorithms or clean patterns they used.",
  "weakAreas": "Bugs, inefficiencies, or missing edge cases.",
  "improvements": "Recommended solution pattern and core theoretical explanation."
}`;
    } else {
      prompt = `You are a senior technical interviewer evaluating a candidate's verbal response.
Technology: ${technology}
Level: ${difficulty}

Question Asked: ${questionText}
Expected Ideal Answer: ${expectedAnswer || 'Thorough conceptual explanation with practical context.'}

Candidate's Answer: ${answer}

EVALUATION INSTRUCTIONS:
1. Evaluate semantic correctness, not exact wording.
2. Provide a score from 0-100.
3. In "improvements", provide the Recommended Solution & Core Theory details that would make for a 100% ideal answer.

OUTPUT FORMAT (STRICT JSON):
{
  "correctness": <number 0-100>,
  "technicalAccuracy": <number 0-100>,
  "completeness": <number 0-100>,
  "score": <number 0-100>,
  "comments": "Overall summary of their performance on this question.",
  "strengths": "Specific core concepts they explained well.",
  "weakAreas": "Specific gaps, misunderstandings, or missing details.",
  "improvements": "Recommended solution, core mechanics, and optimal conceptual answer."
}`;
    }

    const messages = [
      { role: 'system', content: 'You must respond ONLY with a valid JSON object. No conversational text.' },
      { role: 'user', content: prompt }
    ];

    const rawResponse = await callGroqAPI(messages, true);
    const parsed = cleanJSONResponse(rawResponse);
    
    const rawScore = typeof parsed.score === 'number' ? parsed.score : (parseInt(parsed.score, 10) || 0);
    const boundedScore = Math.max(0, Math.min(100, rawScore));
    const maxScore = 100;
    const percentage = Math.round((boundedScore / maxScore) * 100);

    return {
      correctness: Math.max(0, Math.min(100, Number(parsed.correctness) || boundedScore)),
      technicalAccuracy: Math.max(0, Math.min(100, Number(parsed.technicalAccuracy) || boundedScore)),
      completeness: Math.max(0, Math.min(100, Number(parsed.completeness) || boundedScore)),
      score: boundedScore,
      maxScore: maxScore,
      percentage: percentage,
      comments: parsed.comments || 'Evaluated successfully.',
      strengths: parsed.strengths || 'Demonstrated foundational familiarity with the topic.',
      weakAreas: parsed.weakAreas || 'Could provide more detailed technical specifics.',
      improvements: parsed.improvements || expectedAnswer || `Review official ${technology} documentation and architecture best practices.`
    };
  } catch (error) {
    console.error('[FALLBACK] Using mock answer evaluation due to API failure:', error.message);
    return getMockEvaluation(questionData, answer);
  }
};

exports.generateOverallReport = async (technology, difficulty, questions = []) => {
  try {
    const evaluatedQuestions = questions.filter(q => q.feedback && q.feedback.score !== undefined);
    const calculatedAvg = evaluatedQuestions.length > 0
      ? Math.round(evaluatedQuestions.reduce((sum, q) => sum + (q.feedback?.score || 0), 0) / evaluatedQuestions.length)
      : 0;

    const interviewData = questions.map((q, idx) => {
      return `Question ${idx + 1}: ${q.questionText}
Candidate Answer: ${q.answerText}
Score: ${q.feedback?.score || 0}/100
Evaluator Comments: ${q.feedback?.comments || ''}
Strengths: ${q.feedback?.strengths || ''}
Weak Areas: ${q.feedback?.weakAreas || ''}`;
    }).join('\n\n');

    const prompt = `You are a principal engineer reviewing a candidate's full interview performance.
Technology: ${technology}
Difficulty: ${difficulty}
Overall Average Score: ${calculatedAvg}/100

INTERVIEW TRANSCRIPT & EVALUATIONS:
${interviewData}

INSTRUCTIONS:
1. Provide a comprehensive summary of the candidate's performance.
2. Return the overall score (0-100), which should be close to or equal to ${calculatedAvg}.
3. Identify top strengths and critical weak areas.
4. Provide an actionable learning path.

OUTPUT FORMAT (STRICT JSON):
{
  "score": ${calculatedAvg},
  "strengths": ["Strength 1", "Strength 2"],
  "weakAreas": ["Weakness 1", "Weakness 2"],
  "studyTopics": ["Topic 1", "Topic 2"],
  "learningPath": [
    {
      "step": "Step Title",
      "description": "Short explanation of what to do and read."
    }
  ]
}`;

    const messages = [
      { role: 'system', content: 'You must respond ONLY with a valid JSON object. No conversational text.' },
      { role: 'user', content: prompt }
    ];

    const rawResponse = await callGroqAPI(messages, true);
    const parsed = cleanJSONResponse(rawResponse);
    const finalScore = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : calculatedAvg;

    return {
      score: finalScore,
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : ["Demonstrated technical foundation in " + technology],
      weakAreas: Array.isArray(parsed.weakAreas) && parsed.weakAreas.length > 0 ? parsed.weakAreas : ["Deepen understanding of edge cases and internal mechanics"],
      studyTopics: Array.isArray(parsed.studyTopics) && parsed.studyTopics.length > 0 ? parsed.studyTopics : [technology + " Architecture", "Performance Optimization"],
      learningPath: Array.isArray(parsed.learningPath) && parsed.learningPath.length > 0 ? parsed.learningPath : [
        { step: "Deepen Core Theory", description: "Review official " + technology + " documentation." }
      ]
    };
  } catch (error) {
    console.error('[FALLBACK] Using mock overall report generator due to API failure:', error.message);
    return getMockReport(questions);
  }
};
