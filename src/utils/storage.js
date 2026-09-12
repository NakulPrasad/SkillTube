/**
 * SkillTube - Storage Manager (Upgraded with Model Selection & Safe Storage)
 * Prevents 'Extension context invalidated' crashes and supports selectable AI models.
 */

import { TAXONOMY } from './taxonomy.js';

export const DEFAULT_SETTINGS = {
  isEnabled: true,
  developerMode: false,
  activeProfession: "software_engineering",
  activeSkills: ["system_design", "backend_dev", "frontend_dev", "devops_cloud"],
  historyShieldEnabled: true,
  sidebarFilteringEnabled: true,
  blockShorts: true,
  allowMusic: false,
  scheduleEnabled: false,
  scheduleStartHour: 9,
  scheduleEndHour: 18,
  selectedTrackFilter: "all",
  customProfessions: {},
  blockedKeywords: ["shorts", "vlog", "prank", "reaction", "gaming", "unboxing"],
  blockedVideoIds: [],
  blockedVideoTitles: [],
  continueLearning: [],
  // AI Settings
  aiEnabled: true,
  aiProvider: "auto",
  aiModel: "gemini-3.8-flash", // "gemini-3.8-flash" | "gemini-3.7-flash" | "gemini-3.7-pro" | "gemini-2.0-flash" | "window_ai"
  thinkingLevel: "low",        // "low" | "medium" | "high" | "off"
  customModelName: "",
  geminiApiKey: "",
  // Debug Logs
  debugLogs: [],
  stats: {
    videosShielded: 0,
    learningHours: 0,
    feedItemsFiltered: 0,
    aiClassifications: 0
  }
};

export function isContextValid() {
  try {
    return typeof chrome !== "undefined" && 
           chrome.runtime !== undefined && 
           Boolean(chrome.runtime.id) && 
           Boolean(chrome.storage && chrome.storage.local);
  } catch (e) {
    return false;
  }
}

export async function getSettings() {
  return new Promise((resolve) => {
    if (!isContextValid()) {
      resolve(DEFAULT_SETTINGS);
      return;
    }
    try {
      chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
        if (chrome.runtime.lastError) {
          resolve(DEFAULT_SETTINGS);
        } else {
          resolve(items || DEFAULT_SETTINGS);
        }
      });
    } catch (e) {
      resolve(DEFAULT_SETTINGS);
    }
  });
}

export async function updateSettings(partialSettings) {
  return new Promise((resolve) => {
    if (!isContextValid()) {
      resolve(partialSettings);
      return;
    }
    try {
      chrome.storage.local.set(partialSettings, () => {
        resolve(partialSettings);
      });
    } catch (e) {
      resolve(partialSettings);
    }
  });
}

export function subscribeSettings(callback) {
  if (!isContextValid()) return () => {};
  try {
    const listener = (changes, areaName) => {
      if (areaName === "local") {
        const updated = {};
        for (const [key, change] of Object.entries(changes)) {
          updated[key] = change.newValue;
        }
        callback(updated);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      try {
        if (isContextValid()) chrome.storage.onChanged.removeListener(listener);
      } catch (e) {}
    };
  } catch (e) {
    return () => {};
  }
}

export async function addDebugLog(entry) {
  try {
    if (!isContextValid()) return;
    const settings = await getSettings();
    if (!settings.developerMode) return;

    let logs = settings.debugLogs || [];
    const formatted = {
      time: new Date().toLocaleTimeString(),
      title: entry.title ? entry.title.substring(0, 60) : "Unknown",
      status: entry.status,
      reason: entry.reason || "",
      method: entry.method || "KEYWORD"
    };

    logs.unshift(formatted);
    logs = logs.slice(0, 40);

    await updateSettings({ debugLogs: logs });
  } catch (err) {
    // Ignore logging errors when context invalid
  }
}

export async function clearDebugLogs() {
  await updateSettings({ debugLogs: [] });
}

export async function saveContinueLearning(video) {
  const settings = await getSettings();
  let list = settings.continueLearning || [];

  list = list.filter(item => item.id !== video.id);

  if (video.progressPercent < 92) {
    list.unshift({
      id: video.id,
      title: video.title,
      channel: video.channel,
      thumbnail: video.thumbnail,
      currentTime: Math.floor(video.currentTime),
      duration: Math.floor(video.duration),
      progressPercent: Math.round(video.progressPercent),
      lastUpdated: Date.now()
    });
  }

  list = list.slice(0, 6);
  await updateSettings({ continueLearning: list });
}

export async function removeContinueLearning(videoId) {
  const settings = await getSettings();
  let list = (settings.continueLearning || []).filter(item => item.id !== videoId);
  await updateSettings({ continueLearning: list });
  return list;
}

const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

export async function getCachedFeed(key) {
  return new Promise((resolve) => {
    if (!isContextValid()) {
      resolve(null);
      return;
    }
    const cacheKey = `cache_${key}`;
    try {
      chrome.storage.local.get([cacheKey], (result) => {
        const entry = result ? result[cacheKey] : null;
        if (entry && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      });
    } catch (e) {
      resolve(null);
    }
  });
}

export async function setCachedFeed(key, data) {
  return new Promise((resolve) => {
    if (!isContextValid()) {
      resolve();
      return;
    }
    const cacheKey = `cache_${key}`;
    try {
      chrome.storage.local.set({
        [cacheKey]: {
          timestamp: Date.now(),
          data
        }
      }, resolve);
    } catch (e) {
      resolve();
    }
  });
}

export async function addBlockedVideo(videoId, title) {
  const settings = await getSettings();
  const blockedVideoIds = Array.from(new Set([...(settings.blockedVideoIds || []), videoId].filter(Boolean)));
  const blockedVideoTitles = Array.from(new Set([...(settings.blockedVideoTitles || []), title].filter(Boolean)));
  await updateSettings({ blockedVideoIds, blockedVideoTitles });
  return { blockedVideoIds, blockedVideoTitles };
}

export async function removeBlockedVideo(videoId, title) {
  const settings = await getSettings();
  const blockedVideoIds = (settings.blockedVideoIds || []).filter(id => id !== videoId);
  const blockedVideoTitles = (settings.blockedVideoTitles || []).filter(t => t !== title);
  await updateSettings({ blockedVideoIds, blockedVideoTitles });
  return { blockedVideoIds, blockedVideoTitles };
}

export async function addBlockedKeyword(keyword) {
  if (!keyword || !keyword.trim()) return [];
  const clean = keyword.trim().toLowerCase();
  const settings = await getSettings();
  const blockedKeywords = Array.from(new Set([...(settings.blockedKeywords || []), clean]));
  await updateSettings({ blockedKeywords });
  return blockedKeywords;
}

export async function removeBlockedKeyword(keyword) {
  const clean = keyword.trim().toLowerCase();
  const settings = await getSettings();
  const blockedKeywords = (settings.blockedKeywords || []).filter(k => k.toLowerCase() !== clean);
  await updateSettings({ blockedKeywords });
  return blockedKeywords;
}
