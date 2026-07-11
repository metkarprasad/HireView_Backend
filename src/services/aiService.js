// src/services/aiService.js
/**
 * AI Service placeholder.
 * In production this would call OpenAI or another LLM to generate questions and feedback.
 * For now it returns a mock question based on the previous transcript.
 */
export const generateQuestion = async (previousTranscript) => {
  // Simple mock: echo back a generic follow‑up.
  const followUps = [
    "Can you elaborate on that?",
    "What was the biggest challenge you faced?",
    "How did you overcome that obstacle?",
    "Tell me more about your role in that project.",
    "What did you learn from that experience?",
  ];
  const random = followUps[Math.floor(Math.random() * followUps.length)];
  return { text: random };
};
