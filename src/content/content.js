/**
 * SkillTube - Main Content Script (Robust In-Place Profession Filter)
 * Removes music, gaming, and non-profession videos from YouTube Native UI.
 */

import { getSettings, subscribeSettings } from '../utils/storage.js';
import { isVideoOnTopic } from '../utils/taxonomy.js';
import { ShieldHUD } from './shield_hud.js';

class SkillTubeController {
  constructor() {
    this.settings = null;
    this.shieldHud = null;
    this.currentPath = window.location.pathname;
    this.observer = null;
  }

  async init() {
    console.log("[SkillTube] Initializing Native UI Profession Filter...");
    this.settings = await getSettings();
    this.shieldHud = new ShieldHUD(this.settings);

    // Subscribe to live settings changes from popup
    subscribeSettings((newSettings) => {
      this.settings = { ...this.settings, ...newSettings };
      this.shieldHud.updateSettings(this.settings);
      this.applyShortsBlocking();
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
   * Filters YouTube's native UI in-place (Home grid & Watch sidebar)
   * Keeps tech/profession videos visible, and hides music/gaming/entertainment videos.
   */
  filterNativeInterface() {
    if (!this.settings.isEnabled) return;

    // Home Grid Selectors
    const homeSelectors = [
      "ytd-browse[page-subtype='home'] ytd-rich-item-renderer",
      "ytd-browse[page-subtype='home'] yt-lockup-view-model",
      "#primary #contents ytd-rich-item-renderer",
      "#primary #contents yt-lockup-view-model"
    ];

    // Watch Sidebar Selectors
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

    items.forEach(item => {
      // Robust text extraction from item's innerText or title element
      const titleEl = item.querySelector(
        "#video-title, .title, h3, " +
        ".yt-lockup-metadata-view-model-wiz__title, " +
        "a[href*='/watch'] span, " +
        "#video-title-link, " +
        ".yt-core-attributed-string"
      );

      const titleText = (titleEl ? (titleEl.innerText || titleEl.getAttribute("title") || titleEl.textContent || "") : item.innerText || item.textContent || "").trim();

      if (!titleText) return;

      const result = isVideoOnTopic(
        titleText,
        this.settings.activeSkills || [],
        this.settings.activeProfession || "software_engineering",
        this.settings.customProfessions || {}
      );

      if (!result.onTopic) {
        // Hide music, gaming, movies, and off-topic non-profession videos
        item.style.setProperty("display", "none", "important");
      } else {
        // Keep profession-related videos visible in native YouTube UI
        item.style.removeProperty("display");
        
        // Add ON-TRACK badge if not present
        if (!item.querySelector(".skilltube-sidebar-tag")) {
          const badge = document.createElement("span");
          badge.className = "skilltube-sidebar-tag";
          badge.innerText = "🎓 ON-TRACK";
          const targetMeta = item.querySelector(".metadata, #metadata, .yt-lockup-metadata-view-model-wiz, #byline-container, #meta");
          if (targetMeta) targetMeta.prepend(badge);
        }
      }
    });

    // Remove YouTube Shorts shelves if shorts blocker is active
    if (this.settings.blockShorts) {
      document.querySelectorAll("ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]").forEach(el => {
        el.style.setProperty("display", "none", "important");
      });
    }
  }

  cleanup() {
    this.shieldHud.remove();
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
