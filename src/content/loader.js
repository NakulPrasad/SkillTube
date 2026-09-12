/**
 * SkillTube - Content Script Loader
 * Dynamically imports ES modules into YouTube's content script context.
 */
(async () => {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) return;
    const src = chrome.runtime.getURL("src/content/content.js");
    await import(src);
  } catch (err) {
    if (err?.message?.includes("Extension context invalidated")) return;
    console.error("[SkillTube] Failed to load content module:", err);
  }
})();
