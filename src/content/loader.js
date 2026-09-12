/**
 * SkillTube - Content Script Loader
 * Dynamically imports ES modules into YouTube's content script context.
 */
(async () => {
  try {
    const src = chrome.runtime.getURL("src/content/content.js");
    await import(src);
  } catch (err) {
    console.error("[SkillTube] Failed to load content module:", err);
  }
})();
