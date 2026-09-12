/**
 * SkillTube - Background Service Worker (with Live SW Console Logging)
 * Dynamic DeclarativeNetRequest rules for History Shield, Search Shield, and Service Worker logging.
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

// Setup right-click context menus for reporting & blocking videos
function setupContextMenus() {
  if (!chrome.contextMenus) return;
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "skilltube-block-video",
        title: "🚫 SkillTube: Block this Video",
        contexts: ["link", "video", "page"],
        documentUrlPatterns: ["*://*.youtube.com/*"]
      });
      chrome.contextMenus.create({
        id: "skilltube-report-keyword",
        title: "🏷️ SkillTube: Report & Block Keyword...",
        contexts: ["link", "video", "page"],
        documentUrlPatterns: ["*://*.youtube.com/*"]
      });
    });
  } catch (err) {
    console.debug("[SkillTube SW] Context menu init:", err);
  }
}

// Initialize on install & startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[SkillTube SW] Extension installed/updated. Ready!");
  setupContextMenus();
  if (details.reason === "install") {
    await updateSettings(DEFAULT_SETTINGS);
  }
  const settings = await getSettings();
  updateExtensionBadge(settings.isEnabled);
});

chrome.runtime.onStartup?.addListener(() => {
  setupContextMenus();
});

// Forward context menu clicks to active tab content script
chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const targetUrl = info.linkUrl || info.pageUrl || "";
  if (info.menuItemId === "skilltube-block-video") {
    chrome.tabs.sendMessage(tab.id, {
      type: "CONTEXT_BLOCK_VIDEO",
      targetUrl
    }).catch(() => {});
  } else if (info.menuItemId === "skilltube-report-keyword") {
    chrome.tabs.sendMessage(tab.id, {
      type: "CONTEXT_REPORT_KEYWORD",
      targetUrl
    }).catch(() => {});
  }
});

// Update extension icon badge
function updateExtensionBadge(isEnabled) {
  if (!chrome.action) return;
  if (isEnabled) {
    chrome.action.setBadgeText({ text: "PRO" });
    chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#64748b" });
  }
}

let currentShieldState = null;

/**
 * Configure DeclarativeNetRequest rules to block YouTube watch & search history beacons
 */
async function setHistoryShield(active) {
  if (!chrome.declarativeNetRequest) return;
  if (currentShieldState === active) return; // Deduplicate to avoid log flooding & redundant updates

  currentShieldState = active;
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
    console.log("[SkillTube SW] 🛡️ History & Search Shield ACTIVATED (Telemetry blocked)");
  } else {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds
    });
    console.log("[SkillTube SW] 🎓 History Logging ALLOWED (Learning mode)");
  }
}

// Check schedule if enabled
async function checkSchedule() {
  const settings = await getSettings();
  if (!settings.scheduleEnabled) return;

  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  const isWeekday = day >= 1 && day <= 5;
  const isWorkHours = hour >= (settings.scheduleStartHour || 9) && hour < (settings.scheduleEndHour || 18);

  const shouldBeEnabled = isWeekday && isWorkHours;
  if (settings.isEnabled !== shouldBeEnabled) {
    await updateSettings({ isEnabled: shouldBeEnabled });
    updateExtensionBadge(shouldBeEnabled);
  }
}

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

  // Developer Mode Live Log in Service Worker Console
  if (request.type === "DEV_LOG") {
    const log = request.logEntry;
    const badge = log.status === "ALLOWED" ? "✅ [ALLOWED]" : "🚫 [HIDDEN]";
    console.log(
      `%c[SkillTube SW] ${badge} %c"${log.title}" %c(${log.reason})`,
      log.status === "ALLOWED" ? "color: #22c55e; font-weight: bold;" : "color: #ef4444; font-weight: bold;",
      "color: #ffffff;",
      "color: #94a3b8; font-style: italic;"
    );
    sendResponse({ success: true });
    return true;
  }
});
