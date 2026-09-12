/**
 * SkillTube - Storage Manager (Upgraded with Developer Mode & Debug Logs)
 * Handles settings, caching, progress tracking, and live debug logs.
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
  scheduleEnabled: false,
  scheduleStartHour: 9,
  scheduleEndHour: 18,
  selectedTrackFilter: "all",
  customProfessions: {},
  blockedKeywords: ["shorts", "vlog", "prank", "reaction", "gaming", "unboxing"],
  continueLearning: [],
  // AI Settings
  aiEnabled: true,
  aiProvider: "auto",
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

export async function getSettings() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage) {
      resolve(DEFAULT_SETTINGS);
      return;
    }
    chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
      resolve(items);
    });
  });
}

export async function updateSettings(partialSettings) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage) {
      resolve(partialSettings);
      return;
    }
    chrome.storage.local.set(partialSettings, () => {
      resolve(partialSettings);
    });
  });
}

export function subscribeSettings(callback) {
  if (typeof chrome === "undefined" || !chrome.storage) return () => {};
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
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Appends a log entry for Developer Mode debugging (keeps top 40 entries)
 */
export async function addDebugLog(entry) {
  try {
    const settings = await getSettings();
    if (!settings.developerMode) return;

    let logs = settings.debugLogs || [];
    const formatted = {
      time: new Date().toLocaleTimeString(),
      title: entry.title ? entry.title.substring(0, 60) : "Unknown",
      status: entry.status, // "ALLOWED" | "HIDDEN"
      reason: entry.reason || "",
      method: entry.method || "KEYWORD" // "KEYWORD" | "AI" | "BLACKLIST"
    };

    logs.unshift(formatted);
    logs = logs.slice(0, 40); // Ring buffer 40 items

    await updateSettings({ debugLogs: logs });
  } catch (err) {
    console.debug("[SkillTube Dev] Log error:", err);
  }
}

export async function clearDebugLogs() {
  await updateSettings({ debugLogs: [] });
}

/**
 * Save / update video playback progress
 */
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

/**
 * Cache video queries with TTL (2 hours)
 */
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

export async function getCachedFeed(key) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage) {
      resolve(null);
      return;
    }
    const cacheKey = `cache_${key}`;
    chrome.storage.local.get([cacheKey], (result) => {
      const entry = result[cacheKey];
      if (entry && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
        resolve(entry.data);
      } else {
        resolve(null);
      }
    });
  });
}

export async function setCachedFeed(key, data) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage) {
      resolve();
      return;
    }
    const cacheKey = `cache_${key}`;
    chrome.storage.local.set({
      [cacheKey]: {
        timestamp: Date.now(),
        data
      }
    }, resolve);
  });
}
