/**
 * SkillTube - Options Page Logic
 */

import { getSettings, updateSettings } from '../utils/storage.js';
import { TAXONOMY } from '../utils/taxonomy.js';

document.addEventListener("DOMContentLoaded", async () => {
  const blockedTagsList = document.getElementById("blocked-tags-list");
  const newTagInput = document.getElementById("new-tag-input");
  const addTagBtn = document.getElementById("add-tag-btn");
  const creatorsList = document.getElementById("creators-list");
  const exportProfileBtn = document.getElementById("export-profile-btn");
  const clearCacheBtn = document.getElementById("clear-cache-btn");
  const statusToast = document.getElementById("status-toast");

  let settings = await getSettings();

  // Render blocked tags
  function renderBlockedTags() {
    blockedTagsList.innerHTML = "";
    (settings.blockedKeywords || []).forEach(keyword => {
      const tag = document.createElement("div");
      tag.className = "tag-item";
      tag.innerHTML = `
        <span>${keyword}</span>
        <button class="tag-remove-btn" title="Remove">✕</button>
      `;
      tag.querySelector(".tag-remove-btn").addEventListener("click", async () => {
        settings.blockedKeywords = settings.blockedKeywords.filter(k => k !== keyword);
        await updateSettings({ blockedKeywords: settings.blockedKeywords });
        renderBlockedTags();
        showToast(`Removed "${keyword}"`);
      });
      blockedTagsList.appendChild(tag);
    });
  }

  // Render creators
  function renderCreators() {
    creatorsList.innerHTML = "";
    const activeProf = TAXONOMY[settings.activeProfession];
    if (!activeProf || !activeProf.trustedChannels) return;

    activeProf.trustedChannels.forEach(channel => {
      const tag = document.createElement("div");
      tag.className = "tag-item";
      tag.innerHTML = `<span>🌟 ${channel.name} (${channel.handle})</span>`;
      creatorsList.appendChild(tag);
    });
  }

  // Add new blocked tag
  addTagBtn.addEventListener("click", async () => {
    const val = newTagInput.value.trim().toLowerCase();
    if (!val) return;
    if (!settings.blockedKeywords.includes(val)) {
      settings.blockedKeywords.push(val);
      await updateSettings({ blockedKeywords: settings.blockedKeywords });
      newTagInput.value = "";
      renderBlockedTags();
      showToast(`Added "${val}" to filter`);
    }
  });

  newTagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTagBtn.click();
  });

  // Export Profile
  exportProfileBtn.addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `skilltube_profile_${settings.activeProfession}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Profile exported successfully!");
  });

  // Clear cache
  clearCacheBtn.addEventListener("click", () => {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(k => k.startsWith("cache_"));
      chrome.storage.local.remove(keysToRemove, () => {
        showToast("Video feed cache cleared!");
      });
    });
  });

  function showToast(msg) {
    statusToast.textContent = msg;
    setTimeout(() => {
      if (statusToast.textContent === msg) statusToast.textContent = "";
    }, 3000);
  }

  renderBlockedTags();
  renderCreators();
});
