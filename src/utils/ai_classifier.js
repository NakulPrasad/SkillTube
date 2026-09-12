/**
 * SkillTube - Browser & Cloud AI Classifier
 * Combines Browser Local AI (window.ai / Gemini Nano) and Google Gemini API for 100% accurate zero-shot video filtering.
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
 * Hash function for video title caching
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return "aicache_" + Math.abs(hash);
}

/**
 * Classifies video relevance using Browser Local AI or Gemini API key
 */
export async function classifyVideoWithAI(titleText, professionName, settings = {}) {
  if (!settings.aiEnabled) return null;

  const cacheKey = hashString(`${professionName}_${titleText}`);

  // 1. Check local cache
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    const cached = await new Promise(res => chrome.storage.local.get([cacheKey], r => res(r[cacheKey])));
    if (cached !== undefined) {
      return { onTopic: cached, aiVerified: true, cached: true };
    }
  }

  let result = null;

  // 2. Try Browser Local AI (window.ai)
  if (settings.aiProvider === "auto" || settings.aiProvider === "window_ai") {
    try {
      const isAvailable = await isLocalAIAvailable();
      if (isAvailable) {
        if (!aiSession) {
          aiSession = await window.ai.languageModel.create({
            systemPrompt: "You are a career video filter AI. Determine if a YouTube video title is relevant to a profession. Answer strictly YES or NO."
          });
        }
        const prompt = `Profession: ${professionName}\nVideo Title: "${titleText}"\nIs this video relevant for working or learning in ${professionName}? Answer YES or NO.`;
        const response = await aiSession.prompt(prompt);
        const cleanResp = response.trim().toUpperCase();

        if (cleanResp.includes("YES")) result = true;
        else if (cleanResp.includes("NO")) result = false;
      }
    } catch (err) {
      console.debug("[SkillTube AI] Local AI error, falling back:", err);
      aiSession = null;
    }
  }

  // 3. Try Gemini API Key if Local AI wasn't used or failed
  if (result === null && settings.geminiApiKey) {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`;
      const promptText = `Profession: ${professionName}\nVideo Title: "${titleText}"\nIs this video title relevant to learning, practicing, or working in ${professionName}? Answer strictly YES or NO.`;

      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 5 }
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toUpperCase() || "";
        if (text.includes("YES")) result = true;
        else if (text.includes("NO")) result = false;
      }
    } catch (err) {
      console.warn("[SkillTube AI] Gemini API error:", err);
    }
  }

  // Cache result if classified
  if (result !== null && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ [cacheKey]: result });
    return { onTopic: result, aiVerified: true };
  }

  return null;
}
