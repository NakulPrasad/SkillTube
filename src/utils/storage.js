/**
 * SkillTube - Storage Manager (Upgraded)
 * Handles defaults, caching, progress tracking, and reactive updates.
 */

import { TAXONOMY } from './taxonomy.js';

export const DEFAULT_SETTINGS = {
  isEnabled: true,
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
  continueLearning: [], // Array of { id, title, channel, thumbnail, currentTime, duration, progressPercent, lastUpdated }
  stats: {
    videosShielded: 0,
    learningHours: 0,
    feedItemsFiltered: 0
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
 * Save / update video playback progress for the "Continue Learning" shelf
 */
export async function saveContinueLearning(video) {
  const settings = await getSettings();
  let list = settings.continueLearning || [];

  // Remove existing entry for this video if present
  list = list.filter(item => item.id !== video.id);

  // If completed (>92%), don't show on continue shelf
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

  // Keep top 6 items
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
 * Cache video queries in chrome.storage.local with timestamp TTL (2 hours)
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
