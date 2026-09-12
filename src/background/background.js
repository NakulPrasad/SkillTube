/**
 * SkillTube - Background Service Worker (Upgraded)
 * Dynamic DeclarativeNetRequest rules for History Shield, Search Shield, and telemetry blocking.
 */

import { DEFAULT_SETTINGS, getSettings, updateSettings } from '../utils/storage.js';

const SHIELD_RULE_BASE_ID = 1000;

// Watch-time, search history, and telemetry endpoints used by YouTube
const TELEMETRY_URL_PATTERNS = [
  "*://*.youtube.com/api/stats/watchtime*",
  "*://*.youtube.com/api/stats/playback*",
  "*://*.youtube.com/api/stats/delayplay*",
  "*://s.youtube.com/api/stats/watchtime*",
  "*://s.youtube.com/api/stats/playback*",
  "*://*.youtube.com/youtubei/v1/log_event*",
  "*://*.youtube.com/youtubei/v1/history/add_search_history_item*",
  "*://*.youtube.com/youtubei/v1/feedback*",
  "*://*.youtube.com/youtubei/v1/notification/record_interactions*"
];

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("[SkillTube] Initializing default settings...");
    await updateSettings(DEFAULT_SETTINGS);
  }
  const settings = await getSettings();
  updateExtensionBadge(settings.isEnabled);
});

// Update extension icon badge
function updateExtensionBadge(isEnabled) {
  if (!chrome.action) return;
  if (isEnabled) {
    chrome.action.setBadgeText({ text: "PRO" });
    chrome.action.setBadgeBackgroundColor({ color: "#2563eb" }); // Blue
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#64748b" }); // Slate
  }
}

/**
 * Configure DeclarativeNetRequest rules to block YouTube watch & search history beacons
 */
async function setHistoryShield(active) {
  if (!chrome.declarativeNetRequest) return;

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map(r => r.id);

  if (active) {
    const rules = TELEMETRY_URL_PATTERNS.map((urlFilter, index) => ({
      id: SHIELD_RULE_BASE_ID + index,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: urlFilter,
        resourceTypes: ["xmlhttprequest", "ping", "other"]
      }
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: rules
    });
    console.log("[SkillTube] 🛡️ History & Search Shield ACTIVATED (Telemetry blocked)");
  } else {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds
    });
    console.log("[SkillTube] 🎓 History Logging ALLOWED (Learning mode)");
  }
}

// Check schedule if enabled
async function checkSchedule() {
  const settings = await getSettings();
  if (!settings.scheduleEnabled) return;

  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 6 = Sat
  const hour = now.getHours();

  const isWeekday = day >= 1 && day <= 5;
  const isWorkHours = hour >= (settings.scheduleStartHour || 9) && hour < (settings.scheduleEndHour || 18);

  const shouldBeEnabled = isWeekday && isWorkHours;
  if (settings.isEnabled !== shouldBeEnabled) {
    await updateSettings({ isEnabled: shouldBeEnabled });
    updateExtensionBadge(shouldBeEnabled);
  }
}

// Check schedule every 15 minutes
setInterval(checkSchedule, 15 * 60 * 1000);

// Listen for messages from content scripts & popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "TOGGLE_SHIELD") {
    setHistoryShield(request.enabled).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === "INCREMENT_SHIELD_STAT") {
    getSettings().then(settings => {
      const stats = settings.stats || { videosShielded: 0, learningHours: 0, feedItemsFiltered: 0 };
      stats.videosShielded = (stats.videosShielded || 0) + 1;
      updateSettings({ stats });
      sendResponse({ stats });
    });
    return true;
  }

  if (request.type === "UPDATE_BADGE") {
    updateExtensionBadge(request.isEnabled);
    sendResponse({ success: true });
    return true;
  }
});
