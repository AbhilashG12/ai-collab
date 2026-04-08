
import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("CRITICAL ERROR: GROQ_API_KEY is not set in your .env file!");
}
console.log(`✅ GROQ_API_KEY loaded successfully. Key starts with: ${apiKey.substring(0, 7)}...`);

const groq = new ChatGroq({
  apiKey: apiKey,
  model: "llama-3.1-8b-instant",
});

const codeReviewPrompt = PromptTemplate.fromTemplate(
  `You are a code analysis assistant. Your goal is to provide a single, actionable suggestion to improve the given code snippet.
Follow these rules strictly:
1. Your response must be a single sentence.
2. Do NOT repeat the user's code.
3. Do NOT explain that you are an AI or that you are providing feedback.
Analyze this code:
---
{code}
---
Suggestion:`
);

export async function getAISuggestion(code: string): Promise<string> {
  console.log("AI SERVICE: Invoking Groq cloud API...");
  try {
    const chain = codeReviewPrompt.pipe(groq);
    const result = await chain.invoke({ code });
    console.log("AI SERVICE: Successfully received a result from Groq.");
    return result.content.toString();
  } catch (e: any) {
    console.error("AI SERVICE ERROR during invoke:", e.message);
    return `Could not retrieve an AI suggestion. Reason: ${e.message}`;
  }
}