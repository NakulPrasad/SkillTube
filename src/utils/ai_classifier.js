import { isContextValid } from './storage.js';

// Suppress unhandled extension context invalidations when extension is reloaded
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason?.message || event?.reason?.toString() || "";
    if (reason.includes("Extension context invalidated")) {
      event.preventDefault();
    }
  });
}

let aiSession = null;

const requestQueue = [];
let isProcessingQueue = false;
const MIN_REQUEST_INTERVAL_MS = 1500;
let lastRequestTime = 0;

/**
 * Safe wrapper for chrome.storage.local.get to prevent unhandled context invalidation crashes
 */
async function safeStorageGet(key) {
  if (!isContextValid()) return undefined;
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([key], (res) => {
        if (chrome.runtime?.lastError) {
          resolve(undefined);
        } else {
          resolve(res ? res[key] : undefined);
        }
      });
    } catch (err) {
      resolve(undefined);
    }
  });
}

/**
 * Safe wrapper for chrome.storage.local.set to prevent unhandled context invalidation crashes
 */
async function safeStorageSet(items) {
  if (!isContextValid()) return;
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime?.lastError) {}
        resolve();
      });
    } catch (err) {
      resolve();
    }
  });
}

/**
 * Actively verifies if a Gemini API Key is valid and working with the target model & thinking level
 */
export async function verifyGeminiApiKey(apiKey, model = "gemini-3.8-flash", thinkingLevel = "low") {
  if (!apiKey || !apiKey.trim()) {
    return { valid: false, error: "No API key provided" };
  }

  const cleanKey = apiKey.trim();
  const targetModel = model === "window_ai" ? "gemini-3.8-flash" : (model || "gemini-3.8-flash");
  const isGemini3 = targetModel.includes("3.8") || targetModel.includes("3.7") || targetModel.includes("gemini-3");

  console.log(`%c[SkillTube AI] 🔑 Validating Gemini API Key for model [${targetModel}] (Thinking: ${thinkingLevel})...`, "color: #38bdf8; font-weight: bold;");

  const genConfig = { maxOutputTokens: 5 };
  if (isGemini3 && thinkingLevel && thinkingLevel !== "off") {
    genConfig.thinking_level = thinkingLevel;
  }

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    let resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "ping" }] }],
        generationConfig: genConfig
      })
    });

    // Fallback if thinking_level returned 400 on older endpoint
    if (!resp.ok && resp.status === 400 && genConfig.thinking_level) {
      delete genConfig.thinking_level;
      resp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ping" }] }],
          generationConfig: genConfig
        })
      });
    }

    if (resp.ok) {
      console.log(`%c[SkillTube AI] ✅ Gemini API Key Connected & Verified! Model: [${targetModel}] (Thinking: ${thinkingLevel}) is ready.`, "color: #22c55e; font-weight: bold;");
      return { valid: true, model: targetModel, thinkingLevel };
    } else {
      const errData = await resp.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${resp.status}`;
      console.warn(`%c[SkillTube AI] ❌ Gemini API Key Error with [${targetModel}]: ${errMsg}`, "color: #ef4444; font-weight: bold;");
      return { valid: false, error: errMsg, model: targetModel };
    }
  } catch (err) {
    console.warn(`%c[SkillTube AI] ❌ Network Error testing Gemini API Key: ${err.message}`, "color: #ef4444; font-weight: bold;");
    return { valid: false, error: err.message, model: targetModel };
  }
}

export async function isLocalAIAvailable() {
  try {
    if (typeof window !== "undefined" && window.ai && window.ai.languageModel) {
      const capabilities = await window.ai.languageModel.capabilities();
      const ready = capabilities.available === "readily" || capabilities.available === "after-download";
      if (ready) {
        console.log("%c[SkillTube AI] 🧠 Browser Local AI (window.ai / Gemini Nano) is active and available.", "color: #38bdf8; font-weight: bold;");
      }
      return ready;
    }
  } catch (err) {
    console.debug("[SkillTube AI] Local AI check:", err);
  }
  return false;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return "aicache_" + Math.abs(hash);
}

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;

  try {
    while (requestQueue.length > 0) {
      if (!isContextValid()) {
        while (requestQueue.length > 0) {
          const item = requestQueue.shift();
          if (item?.resolve) item.resolve(null);
        }
        break;
      }

      const item = requestQueue.shift();
      if (!item) break;

      const { titleText, professionName, settings, resolve } = item;

      const now = Date.now();
      const timeSinceLast = now - lastRequestTime;
      if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
        await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL_MS - timeSinceLast));
      }

      if (!isContextValid()) {
        resolve(null);
        break;
      }

      lastRequestTime = Date.now();
      try {
        const result = await executeDirectAIClassification(titleText, professionName, settings);
        resolve(result);
      } catch (err) {
        resolve(null);
      }
    }
  } catch (err) {
    // Gracefully handle queue interruption
  } finally {
    isProcessingQueue = false;
  }
}

async function executeDirectAIClassification(titleText, professionName, settings) {
  let result = null;
  const selectedModel = settings.aiModel || "gemini-1.5-flash";

  // 1. Try Browser Local AI (window.ai)
  if (selectedModel === "window_ai" || (!settings.geminiApiKey && (settings.aiProvider === "auto" || settings.aiProvider === "window_ai"))) {
    try {
      const isAvailable = await isLocalAIAvailable();
      if (isAvailable) {
        if (!aiSession) {
          aiSession = await window.ai.languageModel.create({
            systemPrompt: "You are a career filter. Answer YES only if the video title is genuinely relevant to the profession, otherwise answer NO."
          });
        }
        const prompt = `Profession: ${professionName}\nVideo: "${titleText}"\nIs this genuinely relevant to ${professionName}? Answer strictly YES or NO.`;
        const response = await aiSession.prompt(prompt);
        const clean = response.trim().toUpperCase();

        if (clean.includes("YES")) result = true;
        else if (clean.includes("NO")) result = false;
        console.log(`[SkillTube AI] Local AI classified "${titleText.substring(0, 30)}..." -> ${result ? 'YES' : 'NO'}`);
      }
    } catch (err) {
      console.debug("[SkillTube AI] Local AI error:", err);
      aiSession = null;
    }
  }

  // 2. Cloud Gemini API with Selected Model, Thinking Level, Rate Limit & Error Handling
  if (result === null && settings.geminiApiKey && selectedModel !== "window_ai") {
    try {
      const targetModel = selectedModel.startsWith("gemini-") ? selectedModel : `gemini-${selectedModel}`;
      const isGemini3 = targetModel.includes("3.8") || targetModel.includes("3.7") || targetModel.includes("gemini-3");
      const thinkingLevel = settings.thinkingLevel || "low";

      const genConfig = {
        temperature: 0.1,
        maxOutputTokens: 10
      };

      if (isGemini3 && thinkingLevel && thinkingLevel !== "off") {
        genConfig.thinking_level = thinkingLevel;
      } else if (targetModel.includes("thinking") && thinkingLevel !== "off") {
        genConfig.thinkingConfig = { thinkingBudget: 100 };
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`;
      const promptText = `Profession: ${professionName}\nVideo: "${titleText}"\nIs this video relevant for working or learning in ${professionName}? Answer strictly YES or NO.`;

      let resp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: genConfig
        })
      });

      // Fallback if thinking_level was rejected on older API version
      if (!resp.ok && resp.status === 400 && genConfig.thinking_level) {
        delete genConfig.thinking_level;
        resp = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: genConfig
          })
        });
      }

      if (resp.ok) {
        const data = await resp.json();
        const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || data.outputText || "").trim().toUpperCase();
        if (text.includes("YES")) result = true;
        else if (text.includes("NO")) result = false;
        console.log(`%c[SkillTube AI] [${targetModel} | thinking:${thinkingLevel}] classified: "${titleText.substring(0, 35)}..." -> ${result ? 'YES' : 'NO'}`, "color: #a855f7; font-weight: bold;");
      } else if (resp.status === 429) {
        console.warn(`[SkillTube AI] Rate limit reached on ${targetModel}. Falling back to keywords.`);
      } else {
        const errData = await resp.json().catch(() => ({}));
        console.warn(`[SkillTube AI] ${targetModel} returned status ${resp.status}:`, errData.error?.message);
      }
    } catch (err) {
      console.warn("[SkillTube AI] Gemini API call failed:", err);
    }
  }

  // Cache result safely
  if (result !== null && isContextValid()) {
    try {
      const cacheKey = hashString(`${professionName}_${titleText}`);
      await safeStorageSet({ [cacheKey]: result });
    } catch (e) {}
    return { onTopic: result, aiVerified: true, model: selectedModel };
  }

  return null;
}

export async function classifyVideoWithAI(titleText, professionName, settings = {}) {
  if (!settings.aiEnabled || !isContextValid()) return null;

  try {
    const cacheKey = hashString(`${professionName}_${titleText}`);

    // 1. Instant Safe Cache Lookup
    const cached = await safeStorageGet(cacheKey);
    if (cached !== undefined) {
      return { onTopic: cached, aiVerified: true, cached: true };
    }

    const selectedModel = settings.aiModel || "gemini-1.5-flash";

    // 2. Skip queue if no API key and not using window_ai
    if (selectedModel !== "window_ai" && !settings.geminiApiKey && !(await isLocalAIAvailable())) {
      return null;
    }

    // 3. Queue request
    return new Promise((resolve) => {
      if (!isContextValid() || requestQueue.length > 15) {
        resolve(null);
        return;
      }

      requestQueue.push({ titleText, professionName, settings, resolve });
      processQueue().catch(() => resolve(null));
    });
  } catch (err) {
    if (err?.message?.includes("Extension context invalidated")) return null;
    console.debug("[SkillTube AI] classifyVideoWithAI error:", err);
    return null;
  }
}
