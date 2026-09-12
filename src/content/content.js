/**
 * SkillTube - Main Content Script (AI-Powered Filter with Developer Console Overlay)
 * Removes non-profession videos from YouTube Native UI & provides live real-time debug logs.
 */

import { getSettings, subscribeSettings, addDebugLog } from '../utils/storage.js';
import { isVideoOnTopic, TAXONOMY } from '../utils/taxonomy.js';
import { ShieldHUD } from './shield_hud.js';
import { classifyVideoWithAI } from '../utils/ai_classifier.js';

class SkillTubeController {
  constructor() {
    this.settings = null;
    this.shieldHud = null;
    this.currentPath = window.location.pathname;
    this.observer = null;
    this.devConsoleEl = null;
    this.processedVideos = new Set();
  }

  async init() {
    console.log("[SkillTube] Initializing AI Filter & Developer Mode Console...");
    this.settings = await getSettings();
    this.shieldHud = new ShieldHUD(this.settings);

    // Subscribe to live settings changes from popup
    subscribeSettings((newSettings) => {
      this.settings = { ...this.settings, ...newSettings };
      this.shieldHud.updateSettings(this.settings);
      this.applyShortsBlocking();
      this.updateDevConsole();
      this.filterNativeInterface();
    });

    // Hook into YouTube navigation events
    window.addEventListener("yt-navigate-finish", () => this.handleRoute());
    window.addEventListener("yt-page-data-updated", () => this.handleRoute());
    window.addEventListener("popstate", () => this.handleRoute());

    // Initial check
    this.applyShortsBlocking();
    this.handleRoute();
    this.setupMutationObserver();
    this.updateDevConsole();
  }

  applyShortsBlocking() {
    if (this.settings.blockShorts && this.settings.isEnabled) {
      document.body.classList.add("skilltube-block-shorts");
    } else {
      document.body.classList.remove("skilltube-block-shorts");
    }
  }

  handleRoute() {
    const path = window.location.pathname;
    this.currentPath = path;

    if (!this.settings.isEnabled) {
      this.cleanup();
      return;
    }

    this.applyShortsBlocking();

    if (path === "/" || path === "") {
      this.shieldHud.remove();
      this.filterNativeInterface();
    } else if (path.startsWith("/watch")) {
      this.shieldHud.evaluateCurrentVideo();
      this.filterNativeInterface();
    } else {
      this.shieldHud.remove();
    }
  }

  setupMutationObserver() {
    this.observer = new MutationObserver(() => {
      if (this.settings.isEnabled) {
        this.filterNativeInterface();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Updates or removes the live floating Developer Mode Console Overlay on YouTube
   */
  updateDevConsole() {
    if (!this.settings.isEnabled || !this.settings.developerMode) {
      if (this.devConsoleEl) {
        this.devConsoleEl.remove();
        this.devConsoleEl = null;
      }
      return;
    }

    if (!this.devConsoleEl) {
      this.devConsoleEl = document.createElement("div");
      this.devConsoleEl.id = "skilltube-dev-overlay";
      this.devConsoleEl.className = "skilltube-dev-overlay";
      this.devConsoleEl.innerHTML = `
        <div class="dev-header">
          <span>🐞 SkillTube Dev Console</span>
          <button id="dev-clear-btn" class="dev-btn">Clear</button>
        </div>
        <div class="dev-logs-scroll" id="dev-logs-scroll">
          <div class="dev-log-row info">Developer Mode active. Log entries will appear live below...</div>
        </div>
      `;

      document.body.appendChild(this.devConsoleEl);

      this.devConsoleEl.querySelector("#dev-clear-btn")?.addEventListener("click", () => {
        const scroll = this.devConsoleEl.querySelector("#dev-logs-scroll");
        if (scroll) scroll.innerHTML = `<div class="dev-log-row info">Console cleared.</div>`;
      });
    }
  }

  logToDevConsole(logEntry) {
    if (!this.settings.developerMode || !this.devConsoleEl) return;

    const scroll = this.devConsoleEl.querySelector("#dev-logs-scroll");
    if (!scroll) return;

    const row = document.createElement("div");
    const isAllowed = logEntry.status === "ALLOWED";
    row.className = `dev-log-row ${isAllowed ? 'allowed' : 'hidden'}`;
    
    row.innerHTML = `
      <span class="dev-time">[${new Date().toLocaleTimeString()}]</span>
      <span class="dev-tag ${isAllowed ? 'tag-allow' : 'tag-hide'}">${logEntry.status}</span>
      <span class="dev-title" title="${logEntry.title}">${logEntry.title.substring(0, 45)}...</span>
      <span class="dev-reason">(${logEntry.reason})</span>
    `;

    scroll.prepend(row);
    // Keep max 30 rows in DOM console
    if (scroll.children.length > 30) {
      scroll.lastElementChild.remove();
    }
  }

  /**
   * Filters YouTube's native UI in-place using Taxonomy Keywords & AI Classifier
   */
  filterNativeInterface() {
    if (!this.settings.isEnabled) return;

    const homeSelectors = [
      "ytd-browse[page-subtype='home'] ytd-rich-item-renderer",
      "ytd-browse[page-subtype='home'] yt-lockup-view-model",
      "#primary #contents ytd-rich-item-renderer",
      "#primary #contents yt-lockup-view-model"
    ];

    const sidebarSelectors = [
      "#secondary ytd-compact-video-renderer",
      "#secondary ytd-rich-item-renderer",
      "#secondary yt-lockup-view-model",
      "#secondary ytd-grid-video-renderer",
      "#related ytd-compact-video-renderer",
      "#related ytd-rich-item-renderer",
      "#related yt-lockup-view-model",
      "ytd-watch-next-secondary-results-renderer ytd-compact-video-renderer",
      "ytd-watch-next-secondary-results-renderer ytd-rich-item-renderer",
      "ytd-watch-next-secondary-results-renderer yt-lockup-view-model"
    ];

    const allSelectors = window.location.pathname.startsWith("/watch")
      ? sidebarSelectors
      : homeSelectors;

    const items = document.querySelectorAll(allSelectors.join(", "));
    const activeProf = TAXONOMY[this.settings.activeProfession] || (this.settings.customProfessions && this.settings.customProfessions[this.settings.activeProfession]);
    const profName = activeProf ? activeProf.name : "Software Engineering";

    items.forEach(async (item) => {
      const titleEl = item.querySelector(
        "#video-title, .title, h3, " +
        ".yt-lockup-metadata-view-model-wiz__title, " +
        "a[href*='/watch'] span, " +
        "#video-title-link, " +
        ".yt-core-attributed-string"
      );

      const titleText = (titleEl ? (titleEl.innerText || titleEl.getAttribute("title") || titleEl.textContent || "") : item.innerText || item.textContent || "").trim();

      if (!titleText) return;

      // 1. Keyword Taxonomy Check
      const kwResult = isVideoOnTopic(
        titleText,
        this.settings.activeSkills || [],
        this.settings.activeProfession || "software_engineering",
        this.settings.customProfessions || {}
      );

      let finalOnTopic = kwResult.onTopic;
      let badgeLabel = "🎓 ON-TRACK";
      let filterReason = kwResult.matchedKeyword ? `Matched: "${kwResult.matchedKeyword}"` : (kwResult.reason || "no match");
      let method = "KEYWORD";

      // 2. Try AI Classification if enabled
      if (this.settings.aiEnabled) {
        const aiResult = await classifyVideoWithAI(titleText, profName, this.settings);
        if (aiResult && aiResult.aiVerified) {
          finalOnTopic = aiResult.onTopic;
          badgeLabel = "🤖 AI ON-TRACK";
          filterReason = `AI Verdict: ${aiResult.onTopic ? 'YES' : 'NO'}`;
          method = "AI";
        }
      }

      const logKey = `${titleText}_${finalOnTopic}`;
      if (!this.processedVideos.has(logKey)) {
        this.processedVideos.add(logKey);
        const logEntry = {
          title: titleText,
          status: finalOnTopic ? "ALLOWED" : "HIDDEN",
          reason: filterReason,
          method
        };
        addDebugLog(logEntry);
        this.logToDevConsole(logEntry);
      }

      if (!finalOnTopic) {
        item.style.setProperty("display", "none", "important");
      } else {
        item.style.removeProperty("display");
        
        if (!item.querySelector(".skilltube-sidebar-tag")) {
          const badge = document.createElement("span");
          badge.className = "skilltube-sidebar-tag";
          badge.innerText = badgeLabel;
          const targetMeta = item.querySelector(".metadata, #metadata, .yt-lockup-metadata-view-model-wiz, #byline-container, #meta");
          if (targetMeta) targetMeta.prepend(badge);
        }
      }
    });

    // Remove Shorts shelves if shorts blocker is active
    if (this.settings.blockShorts) {
      document.querySelectorAll("ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]").forEach(el => {
        el.style.setProperty("display", "none", "important");
      });
    }
  }

  cleanup() {
    this.shieldHud.remove();
    if (this.devConsoleEl) {
      this.devConsoleEl.remove();
      this.devConsoleEl = null;
    }
    document.body.classList.remove("skilltube-block-shorts");
    document.body.classList.remove("skilltube-active");
    document.querySelectorAll("ytd-rich-item-renderer, ytd-compact-video-renderer, yt-lockup-view-model").forEach(el => {
      el.style.removeProperty("display");
    });
  }
}

// Instantiate and start
const controller = new SkillTubeController();
controller.init();
