/**
 * SkillTube - Browser Local AI Classifier
 * Leverages Edge Copilot / Chrome Built-in AI Prompt APIs (Gemini Nano) for zero-shot semantic video filtering.
 */

let aiSession = null;

/**
 * Checks if Browser Local AI (window.ai / Prompt API) is available
 */
export async function isLocalAIAvailable() {
  try {
    if (typeof window !== "undefined" && window.ai && window.ai.languageModel) {
      const capabilities = await window.ai.languageModel.capabilities();
      return capabilities.available === "readily" || capabilities.available === "after-download";
    }
  } catch (err) {
    console.debug("[SkillTube AI] Local AI capability check:", err);
  }
  return false;
}

/**
 * Classifies video relevance using Browser Local AI
 * Returns null if Local AI is unavailable (falls back to taxonomy keywords).
 */
export async function classifyVideoWithAI(titleText, professionName) {
  try {
    const isAvailable = await isLocalAIAvailable();
    if (!isAvailable) return null;

    if (!aiSession) {
      aiSession = await window.ai.languageModel.create({
        systemPrompt: "You are a strict career filter AI. Your job is to determine if a YouTube video title is relevant to a specific profession or software engineering topic. Answer strictly YES or NO."
      });
    }

    const prompt = `Profession: ${professionName}\nVideo Title: "${titleText}"\nIs this video relevant for learning or working in ${professionName}? Answer YES or NO.`;
    const response = await aiSession.prompt(prompt);

    const cleanResp = response.trim().toUpperCase();
    if (cleanResp.includes("YES")) {
      return { onTopic: true, aiVerified: true };
    } else if (cleanResp.includes("NO")) {
      return { onTopic: false, aiVerified: true };
    }
  } catch (err) {
    console.debug("[SkillTube AI] Classification error, falling back to keywords:", err);
    aiSession = null;
  }

  return null;
}
