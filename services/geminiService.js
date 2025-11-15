import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CONFIG = {
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,       
  REQUEST_TIMEOUT: 30000,  
  MAX_INPUT_LENGTH: 10000 
};

export const getGeminiSuggestion = async (codeInput, retryCount = 0) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }

    if (!codeInput || codeInput.trim().length === 0) {
      throw new Error("Code input cannot be empty");
    }

    if (codeInput.length > CONFIG.MAX_INPUT_LENGTH) {
      throw new Error(`Code input too long. Maximum ${CONFIG.MAX_INPUT_LENGTH} characters allowed.`);
    }

    console.log(`[Gemini] Calling API (attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES + 1})...`);

    const prompt = `You are an expert coding assistant. Analyze the following code and provide helpful suggestions for improvement, completion, bug fixes, or optimization.

Code:
\`\`\`
${codeInput}
\`\`\`

Please provide:
1. Brief analysis of the code
2. Specific suggestions for improvement
3. Any potential issues or bugs
4. Best practices recommendations

Keep your response clear, concise, and actionable.`;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), CONFIG.REQUEST_TIMEOUT);
    });

    const apiPromise = ai.models.generateContent({
      model: "gemini-2.0-flash-001",     
      contents: prompt
    });

    const result = await Promise.race([apiPromise, timeoutPromise]);
    console.log(result.candidates[0].content.parts[0].text);
    const result_text = result.candidates[0].content.parts[0].text

    const text = result_text ?? (await result.response)?.text?.();

    if (!text || text.trim().length === 0) {
      throw new Error("Empty response from Gemini API");
    }

    console.log(`[Gemini] Response received successfully (${text.length} characters)`);

    return text;

  } catch (error) {
    console.error(`[Gemini] Error (attempt ${retryCount + 1}):`, error.message);

    if (error.message.includes("API_KEY") || error.message.includes("API key")) {
      throw new Error("Gemini API key configuration error. Please check your API key.");
    }

    if (error.message.toLowerCase().includes("quota") || error.message.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Gemini API quota exceeded. Please try again later.");
    }

    if (error.message.toLowerCase().includes("rate limit") || error.message.includes("RATE_LIMIT_EXCEEDED")) {
      throw new Error("Gemini API rate limit exceeded. Please wait a moment and try again.");
    }

    if (error.message.includes("timeout") || error.message.includes("Request timeout")) {
      console.log("[Gemini] Request timed out");

      if (retryCount < CONFIG.MAX_RETRIES) {
        console.log(`[Gemini] Retrying in ${CONFIG.RETRY_DELAY}ms...`);
        await sleep(CONFIG.RETRY_DELAY);
        return getGeminiSuggestion(codeInput, retryCount + 1);
      }

      throw new Error("Request timed out after multiple attempts. Please try again.");
    }

    if (error.message.includes("INVALID_ARGUMENT")) {
      throw new Error("Invalid input provided to Gemini API.");
    }

    if (error.message.includes("PERMISSION_DENIED")) {
      throw new Error("Permission denied. Please check your API key permissions.");
    }

    if (retryCount < CONFIG.MAX_RETRIES && isRetryableError(error)) {
      console.log(`[Gemini] Retrying in ${CONFIG.RETRY_DELAY}ms...`);
      await sleep(CONFIG.RETRY_DELAY);
      return getGeminiSuggestion(codeInput, retryCount + 1);
    }

    throw new Error(`Failed to get suggestion: ${error.message}`);
  }
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


export const getGeminiConfig = () => ({
  configured: !!process.env.GEMINI_API_KEY,
  model: "gemini-2.0-flash-001",
  maxRetries: CONFIG.MAX_RETRIES,
  timeout: CONFIG.REQUEST_TIMEOUT,
  maxInputLength: CONFIG.MAX_INPUT_LENGTH
});
