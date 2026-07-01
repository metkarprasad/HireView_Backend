const axios = require('axios');

// Fallback Mock Data for demo mode or API failures
const MOCK_QUESTIONS = {
  React: {
    Beginner: [
      "What is the difference between state and props in React?",
      "What are React Hooks, and why were they introduced?",
      "Explain the concept of Virtual DOM in React.",
      "What is the use of the 'key' prop in React lists?",
      "What are functional components, and how do they differ from class components?"
    ],
    Intermediate: [
      "Explain the React component lifecycle and how useEffect hooks map to it.",
      "What is the difference between useMemo and useCallback? Provide a use case for each.",
      "How does React's Context API work, and when should you prefer it over Redux?",
      "What are controlled vs uncontrolled components in React forms?",
      "Explain the concept of Custom Hooks in React and build a quick mental model of one."
    ],
    Advanced: [
      "Explain React's Reconciliation algorithm and Fiber architecture.",
      "What are React Server Components (RSC) and how do they differ from Server-Side Rendering (SSR)?",
      "How would you optimize a large React application experiencing rendering performance bottlenecks?",
      "Explain the rules of hooks and how React tracks hook state internally under the hood.",
      "How does Concurrent React work, and what is the role of useTransition and useDeferredValue?"
    ]
  },
  JavaScript: {
    Beginner: [
      "What are the different data types in JavaScript?",
      "Explain the difference between 'let', 'const', and 'var'.",
      "What is the difference between '==' and '===' operators?",
      "Explain how array methods like map(), filter(), and reduce() work.",
      "What is an arrow function and how does its 'this' binding differ from regular functions?"
    ],
    Intermediate: [
      "Explain the concept of Closures in JavaScript and give a practical example.",
      "What is the Prototype chain in JavaScript and how does inheritance work?",
      "Explain the event loop, call stack, callback queue, and microtask queue in JavaScript.",
      "What is the difference between Promise.all, Promise.race, and Promise.allSettled?",
      "Explain event delegation and how event bubbling/capturing works in the DOM."
    ],
    Advanced: [
      "Explain how memory management and garbage collection work in JavaScript engines like V8.",
      "What are Generators and Iterators in JavaScript, and how do they work under the hood?",
      "Explain the difference between deep copy and shallow copy, and write a custom deep clone function.",
      "What is a Proxy object in JavaScript, and how can it be used for data binding or validation?",
      "Explain how currying and memoization work, and implement a reusable memoize utility."
    ]
  },
  "Node.js": {
    Beginner: [
      "What is Node.js, and how does it handle non-blocking I/O operations?",
      "What is the purpose of npm and package.json in Node.js?",
      "How do you read a file asynchronously in Node.js using the fs module?",
      "What is the difference between module.exports and exports?",
      "What is the purpose of the path module in Node.js?"
    ],
    Intermediate: [
      "Explain the event-driven architecture of Node.js and the role of the EventEmitter class.",
      "What are streams in Node.js, and what are the different types of streams?",
      "How does the cluster module work in Node.js, and how can it improve application scaling?",
      "What is the difference between process.nextTick() and setImmediate()?",
      "How do you handle unhandled exceptions and unhandled promise rejections in Node.js?"
    ],
    Advanced: [
      "Explain the internal workings of the Libuv library and how it interacts with the OS thread pool.",
      "How would you debug memory leaks in a production Node.js application?",
      "Describe the Node.js event loop phases (timers, pending callbacks, idle/prepare, poll, check, close) in detail.",
      "What is the buffer class, and how do buffers optimize binary data handling in high-throughput streams?",
      "How do worker threads differ from the cluster module, and when should you use each for CPU-bound tasks?"
    ]
  }
};

// Generic mock generator if technology is not specifically listed above
const getMockQuestion = (tech, difficulty, index) => {
  const techKey = Object.keys(MOCK_QUESTIONS).find(k => k.toLowerCase() === tech.toLowerCase()) || 'JavaScript';
  const diffKey = MOCK_QUESTIONS[techKey][difficulty] ? difficulty : 'Intermediate';
  const list = MOCK_QUESTIONS[techKey][diffKey];
  return list[index % list.length];
};

const getMockEvaluation = (question, answer) => {
  const score = answer.length > 50 ? Math.floor(Math.random() * 3) + 7 : Math.floor(Math.random() * 4) + 4; // score between 4 and 9
  return {
    score: score,
    comments: "The candidate shows a reasonable understanding of the concept but could add more specific examples.",
    strengths: "Addressed the primary terms and explained the core mechanism.",
    weakAreas: "Missed edge cases, performance trade-offs, or syntactic details.",
    improvements: "Focus on giving real-world examples and explaining how it behaves under the hood."
  };
};

const getMockReport = (questions) => {
  const totalScore = questions.reduce((sum, q) => sum + (q.feedback?.score || 6), 0);
  const averagePercentage = Math.round((totalScore / (questions.length * 10)) * 100);
  
  return {
    score: averagePercentage,
    strengths: [
      "Demonstrated solid grasp of basic syntax and primary mechanics.",
      "Good communication skills in structuring explanations."
    ],
    weakAreas: [
      "Needs deeper dive into edge cases and internal engine workings.",
      "Could improve practical coding examples and optimization principles."
    ],
    studyTopics: [
      "Under-the-hood execution context and memory models.",
      "Performance profiling and application optimization.",
      "Best practices in scaling architecture."
    ],
    learningPath: [
      { step: "Deepen Core Theory", description: "Read standard specifications and documentation (e.g., MDN, official docs)." },
      { step: "Build Practical Sandboxes", description: "Implement mock examples focusing specifically on performance benchmarks." },
      { step: "Mock Coding Challenges", description: "Practice explaining your implementation details out loud during code exercises." }
    ]
  };
};

// Main API call to Groq
const callGroqAPI = async (messages, responseFormatJson = false) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY_HERE') {
    throw new Error('Groq API Key is not configured. Falling back to Mock service.');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  
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
        timeout: 10000 // 10s timeout
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Groq API Request failed:', error.message);
    throw error;
  }
};

const cleanJSONResponse = (rawString) => {
  try {
    // Strip markdown formatting if any (e.g. ```json ... ```)
    let cleanStr = rawString.trim();
    if (cleanStr.startsWith('```')) {
      cleanStr = cleanStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }
    return JSON.parse(cleanStr);
  } catch (err) {
    console.error('Failed to parse JSON from AI response. Raw string:', rawString);
    // Find the first '{' and last '}' and try to parse
    try {
      const firstBrace = rawString.indexOf('{');
      const lastBrace = rawString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        const potentialJson = rawString.substring(firstBrace, lastBrace + 1);
        return JSON.parse(potentialJson);
      }
    } catch (innerErr) {
      console.error('Nested parse failed:', innerErr);
    }
    throw new Error('Invalid JSON format returned by AI');
  }
};

exports.generateQuestion = async (technology, difficulty, history = []) => {
  const questionIndex = history.length;
  
  try {
    const prompt = `You are a world-class technical interviewer conducting an interview.
Technology: ${technology}
Difficulty: ${difficulty}
Current question number: ${questionIndex + 1} of 5.

Here are the questions that have already been asked in this session (avoid repeating them or covering identical concepts):
${history.map((q, idx) => `Q${idx + 1}: ${q.questionText}`).join('\n')}

Generate the next highly technical, relevant, and engaging interview question. 
Output ONLY the question text itself. Do not add any greeting, intro, conversational filler, markdown code fences, or numbering. Keep it pure question text.`;

    const messages = [
      { role: 'system', content: 'You are an interviewer. Output only the question string.' },
      { role: 'user', content: prompt }
    ];

    const questionText = await callGroqAPI(messages);
    return questionText;
  } catch (error) {
    console.log(`Using mock question generator for ${technology} (${difficulty}, Index: ${questionIndex})`);
    return getMockQuestion(technology, difficulty, questionIndex);
  }
};

exports.evaluateAnswer = async (question, answer, technology, difficulty) => {
  try {
    const prompt = `You are a senior technical interviewer. Evaluate the candidate's response to the question.
Technology: ${technology}
Difficulty: ${difficulty}
Question: ${question}
Candidate's Answer: ${answer}

Provide a structured, constructive assessment in a strict JSON format with the following keys:
{
  "score": (a number from 0 to 10 evaluating technical accuracy),
  "comments": "Brief overall commentary",
  "strengths": "Specific core concepts the candidate got right",
  "weakAreas": "Specific gaps or flaws in the answer",
  "improvements": "Clear steps or correct conceptual/syntax explanation to help them improve"
}

Ensure your response is valid JSON and contains only the JSON object. Do not wrap in markdown \`\`\`json blocks.`;

    const messages = [
      { role: 'system', content: 'You must respond ONLY with a valid JSON object. No conversational text.' },
      { role: 'user', content: prompt }
    ];

    const rawResponse = await callGroqAPI(messages, true);
    return cleanJSONResponse(rawResponse);
  } catch (error) {
    console.log('Using mock answer evaluation.');
    return getMockEvaluation(question, answer);
  }
};

exports.generateOverallReport = async (technology, difficulty, questions = []) => {
  try {
    const interviewData = questions.map((q, idx) => {
      return `Question ${idx + 1}: ${q.questionText}\nCandidate Answer: ${q.answerText}\nScore: ${q.feedback?.score || 0}/10\nEvaluation: ${q.feedback?.comments || ''}`;
    }).join('\n\n');

    const prompt = `You are a principal architect reviewing a candidate's full interview performance.
Technology: ${technology}
Difficulty: ${difficulty}

Here is the transcript of questions, answers, and evaluations:
${interviewData}

Provide a detailed summary and performance report as a strict JSON object with the following fields:
{
  "score": (overall score from 0 to 100 based on individual questions performance),
  "strengths": ["list of main technical strengths demonstrated"],
  "weakAreas": ["list of technical areas that need improvement"],
  "studyTopics": ["specific technical topics/concepts to study next"],
  "learningPath": [
    {
      "step": "Step Title (e.g. Master React Reconciliation)",
      "description": "Short explanation of what to do and read."
    }
  ]
}

Ensure your response is valid JSON and contains only the JSON object. Do not wrap in markdown \`\`\`json blocks.`;

    const messages = [
      { role: 'system', content: 'You must respond ONLY with a valid JSON object. No conversational text.' },
      { role: 'user', content: prompt }
    ];

    const rawResponse = await callGroqAPI(messages, true);
    return cleanJSONResponse(rawResponse);
  } catch (error) {
    console.log('Using mock overall report generator.');
    return getMockReport(questions);
  }
};
