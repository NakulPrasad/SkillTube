/**
 * SkillTube - Main Content Script (AI-Powered Filter with Live Multi-Console Logging & Music Toggle)
 * Removes non-profession videos from YouTube, supports toggleable music/study beats, and pipes live logs.
 */

import {
  getSettings,
  subscribeSettings,
  addDebugLog,
  isContextValid,
  addBlockedVideo,
  removeBlockedVideo,
  addBlockedKeyword,
  removeBlockedKeyword
} from '../utils/storage.js';
import { isVideoOnTopic, TAXONOMY } from '../utils/taxonomy.js';
import { ShieldHUD } from './shield_hud.js';
import { classifyVideoWithAI, isLocalAIAvailable, verifyGeminiApiKey } from '../utils/ai_classifier.js';

// Suppress unhandled extension context invalidations when extension is reloaded
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason?.message || event?.reason?.toString() || "";
    if (reason.includes("Extension context invalidated")) {
      event.preventDefault();
    }
  });
}

class SkillTubeController {
  constructor() {
    this.settings = null;
    this.shieldHud = null;
    this.currentPath = window.location.pathname;
    this.observer = null;
    this.devConsoleEl = null;
    this.processedVideos = new Set();
    this.lastContextMenuInfo = null;
    this.activeModal = null;
    this.activeToast = null;
  }

  async init() {
    if (!isContextValid()) return;
    console.log("[SkillTube] Initializing AI Filter & Developer Mode Console...");
    this.settings = await getSettings();
    this.shieldHud = new ShieldHUD(this.settings);

    // Announce AI Status in Console
    await this.logAIStatus();

    // Subscribe to live settings changes from popup & options
    subscribeSettings((newSettings) => {
      const relevantKeys = [
        "isEnabled", "activeProfession", "activeSkills",
        "historyShieldEnabled", "sidebarFilteringEnabled",
        "blockShorts", "allowMusic", "aiEnabled", "aiModel",
        "thinkingLevel", "developerMode", "customProfessions", "geminiApiKey",
        "blockedKeywords", "blockedVideoIds", "blockedVideoTitles"
      ];
      const hasRelevantChange = Object.keys(newSettings).some(k => relevantKeys.includes(k));
      if (!hasRelevantChange) return;

      this.settings = { ...this.settings, ...newSettings };
      this.shieldHud.updateSettings(this.settings);
      this.applyShortsBlocking();
      this.updateDevConsole();
      this.filterNativeInterface();
    });

    // Capture right-clicks on video cards to enable context menu blocking
    document.addEventListener("contextmenu", (e) => {
      const videoItem = e.target.closest(
        "ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model"
      );
      if (videoItem) {
        this.lastContextMenuInfo = this.extractVideoInfo(videoItem);
      } else if (window.location.pathname.startsWith("/watch")) {
        const title = (document.querySelector("h1.ytd-watch-metadata, #title h1")?.innerText || document.title.replace(/ - YouTube$/, "")).trim();
        const channel = (document.querySelector("#channel-name, ytd-channel-name")?.innerText || "").trim();
        const videoId = new URLSearchParams(window.location.search).get("v") || "";
        this.lastContextMenuInfo = { item: null, title, channel, videoId };
      }
    }, true);

    // Listen for right-click context menu commands from background service worker
    chrome.runtime.onMessage?.addListener((request, sender, sendResponse) => {
      if (request.type === "CONTEXT_BLOCK_VIDEO") {
        this.handleContextBlock(request.targetUrl);
        sendResponse({ success: true });
        return true;
      }
      if (request.type === "CONTEXT_REPORT_KEYWORD") {
        this.handleContextReport(request.targetUrl);
        sendResponse({ success: true });
        return true;
      }
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

  async logAIStatus() {
    if (!this.settings.aiEnabled) {
      console.log("%c[SkillTube AI] AI filtering is turned OFF (using keyword taxonomy)", "color: #94a3b8;");
      return;
    }

    const selectedModel = this.settings.aiModel || "gemini-3.8-flash";
    const thinkingLevel = this.settings.thinkingLevel || "low";
    const hasLocalAI = await isLocalAIAvailable();

    if (selectedModel === "window_ai" || (!this.settings.geminiApiKey && hasLocalAI)) {
      console.log("%c[SkillTube AI] 🧠 Browser Local AI (Gemini Nano) active. Zero API quota required.", "color: #38bdf8; font-weight: bold;");
      this.logToDevConsole({
        title: "AI Engine Status",
        status: "ALLOWED",
        reason: "Browser Local AI (Gemini Nano) active."
      });
    } else if (this.settings.geminiApiKey) {
      console.log(`%c[SkillTube AI] 🔑 Gemini Cloud [${selectedModel}] (Thinking: ${thinkingLevel}) active. Zero-shot classification enabled.`, "color: #a855f7; font-weight: bold;");
      this.logToDevConsole({
        title: "AI Engine Status",
        status: "ALLOWED",
        reason: `Model [${selectedModel}] connected (Thinking: ${thinkingLevel}).`
      });
    } else {
      console.log("%c[SkillTube AI] ℹ️ Running on Word-Boundary Keyword Taxonomy (No API Key set).", "color: #94a3b8; font-style: italic;");
    }
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
    let debounceTimeout = null;
    this.observer = new MutationObserver(() => {
      if (!this.settings.isEnabled || !isContextValid()) return;
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        this.filterNativeInterface();
      }, 250);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

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
          <div class="dev-log-row info">Developer Mode active. Filter decisions appear live below...</div>
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
    const isAllowed = logEntry.status === "ALLOWED";
    console.log(
      `%c[SkillTube] ${isAllowed ? '✅ ALLOWED' : '🚫 HIDDEN'}%c "${logEntry.title.substring(0, 50)}" %c(${logEntry.reason})`,
      isAllowed ? "color: #22c55e; font-weight: bold;" : "color: #ef4444; font-weight: bold;",
      "color: inherit;",
      "color: #94a3b8; font-style: italic;"
    );

    if (isContextValid()) {
      try {
        chrome.runtime.sendMessage({ type: "DEV_LOG", logEntry }).catch(() => {});
      } catch (e) {}
    }

    if (!this.settings.developerMode || !this.devConsoleEl) return;

    const scroll = this.devConsoleEl.querySelector("#dev-logs-scroll");
    if (!scroll) return;

    const row = document.createElement("div");
    row.className = `dev-log-row ${isAllowed ? 'allowed' : 'hidden'}`;
    
    row.innerHTML = `
      <span class="dev-time">[${new Date().toLocaleTimeString()}]</span>
      <span class="dev-tag ${isAllowed ? 'tag-allow' : 'tag-hide'}">${logEntry.status}</span>
      <span class="dev-title" title="${logEntry.title}">${logEntry.title.substring(0, 45)}...</span>
      <span class="dev-reason">(${logEntry.reason})</span>
    `;

    scroll.prepend(row);
    if (scroll.children.length > 30) {
      scroll.lastElementChild.remove();
    }
  }

  /**
   * Filters YouTube's native UI in-place with music toggle support and robust hiding
   */
  filterNativeInterface() {
    if (!this.settings.isEnabled || !isContextValid()) return;

    // Toggle body class for instant CSS-level hiding of Mixes / Music radios
    if (this.settings.allowMusic) {
      document.body.classList.remove("skilltube-hide-music");
    } else {
      document.body.classList.add("skilltube-hide-music");
    }

    const allSelectors = [
      "ytd-rich-item-renderer",
      "ytd-compact-video-renderer",
      "ytd-video-renderer",
      "ytd-grid-video-renderer",
      "yt-lockup-view-model"
    ];

    const items = document.querySelectorAll(allSelectors.join(", "));
    const activeProf = TAXONOMY[this.settings.activeProfession] || (this.settings.customProfessions && this.settings.customProfessions[this.settings.activeProfession]);
    const profName = activeProf ? activeProf.name : "Software Engineering";

    items.forEach(async (item) => {
      try {
        if (!isContextValid()) return;

        // Specific video title extraction
        const titleEl = item.querySelector(
          "#video-title, " +
          "a#video-title-link, " +
          "h3.ytd-rich-grid-media, " +
          "h3.ytd-compact-video-renderer, " +
          ".yt-lockup-metadata-view-model-wiz__title, " +
          "h3 a[href*='/watch'], " +
          "h3 span"
        );

        const titleText = (titleEl ? (titleEl.getAttribute("title") || titleEl.innerText || titleEl.textContent || "") : "").trim();
        if (!titleText) return;

        // Channel info & music badge detection
        const channelEl = item.querySelector(
          "#channel-name, " +
          "ytd-channel-name, " +
          ".ytd-channel-name, " +
          "#text.ytd-channel-name, " +
          ".yt-lockup-metadata-view-model-wiz__author"
        );
        const channelName = (channelEl ? (channelEl.innerText || channelEl.textContent || "") : "").trim();

        const hasMusicBadge = !!(
          item.querySelector("[aria-label*='Artist'], [aria-label*='Music'], ytd-badge-supported-renderer [aria-label*='Artist']") ||
          channelName.endsWith("- Topic") ||
          channelName.toLowerCase().includes("vevo") ||
          channelName.toLowerCase().includes("records") ||
          channelName.toLowerCase().includes("t-series") ||
          channelName.toLowerCase().includes("music")
        );

        // Virtual-scrolling safe deduplication key
        const videoLink = item.querySelector("a[href*='watch?v='], a#thumbnail");
        const href = videoLink ? videoLink.getAttribute("href") : "";
        const videoId = href ? (new URLSearchParams(href.split("?")[1] || "").get("v") || href) : titleText;
        const evalKey = `${videoId}_${this.settings.allowMusic}_${this.settings.activeProfession}_${(this.settings.blockedKeywords || []).length}_${(this.settings.blockedVideoIds || []).length}`;

        if (item.dataset.skilltubeEvalKey === evalKey) return;
        item.dataset.skilltubeEvalKey = evalKey;

        // 1. Keyword Taxonomy Check (with channel, music badge & user blocklist detection)
        const kwResult = isVideoOnTopic(
          `${titleText} ${channelName}`,
          this.settings.activeSkills || [],
          this.settings.activeProfession || "software_engineering",
          this.settings.customProfessions || {},
          {
            allowMusic: this.settings.allowMusic || false,
            hasMusicBadge,
            videoId,
            title: titleText,
            blockedKeywords: this.settings.blockedKeywords || [],
            blockedVideoIds: this.settings.blockedVideoIds || [],
            blockedVideoTitles: this.settings.blockedVideoTitles || []
          }
        );

        let finalOnTopic = kwResult.onTopic;
        let badgeLabel = kwResult.isMusic ? "🎵 STUDY BEATS" : "🎓 ON-TRACK";
        let filterReason = kwResult.matchedKeyword ? `Matched: "${kwResult.matchedKeyword}"` : (kwResult.reason || "no match");
        let method = "KEYWORD";

        // 2. Try AI Classification for ambiguous videos (saves quota & prevents queue saturation)
        if (!finalOnTopic && !kwResult.isMusic && !kwResult.isDistraction && this.settings.aiEnabled && isContextValid()) {
          const aiResult = await classifyVideoWithAI(titleText, profName, this.settings);
          if (aiResult && aiResult.aiVerified) {
            finalOnTopic = aiResult.onTopic;
            badgeLabel = "🤖 AI ON-TRACK";
            filterReason = `AI [${aiResult.model || 'Model'}]: ${aiResult.onTopic ? 'YES' : 'NO'}`;
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
          item.classList.add("skilltube-hidden");
          item.style.setProperty("display", "none", "important");
          const oldBadge = item.querySelector(".skilltube-sidebar-tag");
          if (oldBadge) oldBadge.remove();
          const oldBtn = item.querySelector(".skilltube-quick-block-btn");
          if (oldBtn) oldBtn.remove();
        } else {
          item.classList.remove("skilltube-hidden");
          item.style.removeProperty("display");
          
          if (!item.querySelector(".skilltube-sidebar-tag")) {
            const badge = document.createElement("span");
            badge.className = "skilltube-sidebar-tag";
            badge.innerText = badgeLabel;
            const targetMeta = item.querySelector(".metadata, #metadata, .yt-lockup-metadata-view-model-wiz, #byline-container, #meta");
            if (targetMeta) targetMeta.prepend(badge);
          }

          // Add Quick-Action Block/Report button to card thumbnail
          const thumb = item.querySelector("ytd-thumbnail, #thumbnail, .yt-lockup-view-model__visual");
          if (thumb && !thumb.querySelector(".skilltube-quick-block-btn")) {
            const blockBtn = document.createElement("button");
            blockBtn.className = "skilltube-quick-block-btn";
            blockBtn.title = "🚫 Block or Report Video (SkillTube)";
            blockBtn.innerHTML = "🚫 Block";
            blockBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.openReportModal({ item, title: titleText, channel: channelName, videoId });
            });
            thumb.style.position = "relative";
            thumb.appendChild(blockBtn);
          }
        }
      } catch (err) {
        if (err?.message?.includes("Extension context invalidated")) return;
      }
    });

    // Remove Shorts shelves if shorts blocker is active
    if (this.settings.blockShorts) {
      document.querySelectorAll("ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]").forEach(el => {
        el.style.setProperty("display", "none", "important");
      });
    }
  }

  extractVideoInfo(item) {
    if (!item) return null;
    const titleEl = item.querySelector(
      "#video-title, a#video-title-link, h3.ytd-rich-grid-media, h3.ytd-compact-video-renderer, .yt-lockup-metadata-view-model-wiz__title, h3 a[href*='/watch'], h3 span"
    );
    const title = (titleEl ? (titleEl.getAttribute("title") || titleEl.innerText || titleEl.textContent || "") : "").trim();
    const channelEl = item.querySelector(
      "#channel-name, ytd-channel-name, .ytd-channel-name, #text.ytd-channel-name, .yt-lockup-metadata-view-model-wiz__author"
    );
    const channel = (channelEl ? (channelEl.innerText || channelEl.textContent || "") : "").trim();
    const videoLink = item.querySelector("a[href*='watch?v='], a#thumbnail");
    const href = videoLink ? videoLink.getAttribute("href") : "";
    const videoId = href ? (new URLSearchParams(href.split("?")[1] || "").get("v") || href) : "";

    return { item, title, channel, videoId };
  }

  findVideoInfoByUrl(targetUrl) {
    if (!targetUrl) return null;
    try {
      const urlObj = new URL(targetUrl, window.location.origin);
      const videoId = urlObj.searchParams.get("v");
      if (!videoId) return null;

      const link = document.querySelector(`a[href*='watch?v=${videoId}']`);
      if (link) {
        const item = link.closest("ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model");
        if (item) return this.extractVideoInfo(item);
      }
    } catch (e) {}
    return null;
  }

  async handleContextBlock(targetUrl) {
    const videoInfo = this.lastContextMenuInfo || this.findVideoInfoByUrl(targetUrl);
    if (!videoInfo || (!videoInfo.title && !videoInfo.videoId)) {
      this.showToast("⚠️ Could not detect targeted video.");
      return;
    }

    if (videoInfo.item) {
      videoInfo.item.classList.add("skilltube-hidden");
      videoInfo.item.style.setProperty("display", "none", "important");
    }

    const { videoId, title } = videoInfo;
    await addBlockedVideo(videoId, title);
    this.settings.blockedVideoIds = Array.from(new Set([...(this.settings.blockedVideoIds || []), videoId].filter(Boolean)));
    this.settings.blockedVideoTitles = Array.from(new Set([...(this.settings.blockedVideoTitles || []), title].filter(Boolean)));

    const logEntry = {
      title: title || videoId || "Blocked Video",
      status: "HIDDEN",
      reason: "Manually blocked via right-click",
      method: "USER"
    };
    addDebugLog(logEntry);
    this.logToDevConsole(logEntry);

    this.showToast(`🚫 Blocked: "${(title || videoId).substring(0, 30)}..."`, async () => {
      await removeBlockedVideo(videoId, title);
      this.settings.blockedVideoIds = (this.settings.blockedVideoIds || []).filter(id => id !== videoId);
      this.settings.blockedVideoTitles = (this.settings.blockedVideoTitles || []).filter(t => t !== title);
      if (videoInfo.item) {
        videoInfo.item.classList.remove("skilltube-hidden");
        videoInfo.item.style.removeProperty("display");
        delete videoInfo.item.dataset.skilltubeEvalKey;
      }
      this.filterNativeInterface();
      this.showToast("↩️ Video restored.");
    });
  }

  handleContextReport(targetUrl) {
    const videoInfo = this.lastContextMenuInfo || this.findVideoInfoByUrl(targetUrl);
    if (!videoInfo) {
      this.showToast("⚠️ Could not detect targeted video.");
      return;
    }
    this.openReportModal(videoInfo);
  }

  openReportModal(videoInfo) {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }

    const { item, title, channel, videoId } = videoInfo;
    const cleanTitle = title || "Selected Video";

    // Generate smart suggested keyword pills from title & channel
    const stopWords = new Set([
      "with", "this", "from", "that", "what", "full", "free", "your", "into", "over",
      "when", "where", "have", "more", "make", "made", "here", "just", "about", "hindi",
      "english", "tamil", "telugu", "official", "part", "video", "episode", "course"
    ]);

    const words = `${cleanTitle} ${channel}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !stopWords.has(w));

    const uniquePills = Array.from(new Set([
      ...(channel ? [channel.toLowerCase()] : []),
      ...words
    ])).slice(0, 8);

    const backdrop = document.createElement("div");
    backdrop.className = "skilltube-modal-backdrop";
    backdrop.innerHTML = `
      <div class="skilltube-modal">
        <div class="skilltube-modal-header">
          <h3>🚫 Report Distraction / Block Keyword</h3>
          <button class="skilltube-modal-close-btn" id="st-modal-close">&times;</button>
        </div>
        <div class="skilltube-modal-body">
          <div class="skilltube-modal-video-card">
            <div class="skilltube-modal-video-title">${cleanTitle}</div>
            ${channel ? `<div class="skilltube-modal-video-channel">Channel: ${channel}</div>` : ""}
          </div>

          <div>
            <div class="skilltube-pills-label">💡 Suggested keywords to block from title & channel:</div>
            <div class="skilltube-pills-list" id="st-pills-list">
              ${uniquePills.map(p => `<span class="skilltube-pill" data-kw="${p}">+ ${p}</span>`).join("")}
            </div>
          </div>

          <div>
            <div class="skilltube-pills-label">Or enter custom keyword / phrase to permanently hide:</div>
            <div class="skilltube-input-group">
              <input type="text" id="st-keyword-input" placeholder="e.g. roast, prank, vlog, mukbang" value="" />
              <button class="skilltube-btn-danger" id="st-add-keyword-btn">Block Keyword</button>
            </div>
          </div>
        </div>
        <div class="skilltube-modal-footer">
          <button class="skilltube-btn-danger" id="st-block-only-video-btn">🚫 Block Just This Video</button>
          <button class="skilltube-btn-secondary" id="st-cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    this.activeModal = backdrop;

    const input = backdrop.querySelector("#st-keyword-input");
    input?.focus();

    // Clicking a pill fills input
    backdrop.querySelectorAll(".skilltube-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        const kw = pill.dataset.kw;
        if (input) {
          input.value = kw;
          input.focus();
        }
      });
    });

    const closeModal = () => {
      backdrop.remove();
      this.activeModal = null;
    };

    backdrop.querySelector("#st-modal-close")?.addEventListener("click", closeModal);
    backdrop.querySelector("#st-cancel-btn")?.addEventListener("click", closeModal);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });

    // Block Just This Video
    backdrop.querySelector("#st-block-only-video-btn")?.addEventListener("click", async () => {
      closeModal();
      await this.handleContextBlock(null);
    });

    // Add Keyword and Block
    const handleAddKeyword = async () => {
      const kw = (input?.value || "").trim().toLowerCase();
      if (!kw) {
        input?.focus();
        return;
      }
      closeModal();
      await addBlockedKeyword(kw);
      this.settings.blockedKeywords = Array.from(new Set([...(this.settings.blockedKeywords || []), kw]));
      
      // Clear evaluated cache and re-filter immediately
      document.querySelectorAll("[data-skilltube-eval-key]").forEach(el => {
        delete el.dataset.skilltubeEvalKey;
      });
      this.processedVideos.clear();
      this.filterNativeInterface();

      this.showToast(`🏷️ Added "${kw}" to blocklist. Feeds refreshed!`, async () => {
        await removeBlockedKeyword(kw);
        this.settings.blockedKeywords = (this.settings.blockedKeywords || []).filter(k => k !== kw);
        document.querySelectorAll("[data-skilltube-eval-key]").forEach(el => {
          delete el.dataset.skilltubeEvalKey;
        });
        this.processedVideos.clear();
        this.filterNativeInterface();
        this.showToast(`↩️ Removed "${kw}" from blocklist.`);
      });
    };

    backdrop.querySelector("#st-add-keyword-btn")?.addEventListener("click", handleAddKeyword);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAddKeyword();
      if (e.key === "Escape") closeModal();
    });
  }

  showToast(message, onUndo = null) {
    if (this.activeToast) {
      this.activeToast.remove();
      this.activeToast = null;
    }

    const toast = document.createElement("div");
    toast.className = "skilltube-toast";
    toast.innerHTML = `
      <span>${message}</span>
      ${onUndo ? `<button class="skilltube-toast-undo">Undo</button>` : ""}
    `;

    if (onUndo) {
      toast.querySelector(".skilltube-toast-undo")?.addEventListener("click", () => {
        toast.remove();
        this.activeToast = null;
        onUndo();
      });
    }

    document.body.appendChild(toast);
    this.activeToast = toast;

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      if (this.activeToast === toast) {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
        this.activeToast = null;
      }
    }, 4500);
  }

  cleanup() {
    this.shieldHud.remove();
    if (this.devConsoleEl) {
      this.devConsoleEl.remove();
      this.devConsoleEl = null;
    }
    document.body.classList.remove("skilltube-block-shorts");
    document.body.classList.remove("skilltube-hide-music");
    document.body.classList.remove("skilltube-active");
    document.querySelectorAll(".skilltube-hidden").forEach(el => {
      el.classList.remove("skilltube-hidden");
      el.style.removeProperty("display");
    });
    document.querySelectorAll("ytd-rich-item-renderer, ytd-compact-video-renderer, yt-lockup-view-model").forEach(el => {
      el.style.removeProperty("display");
    });
  }
}

// Instantiate and start
const controller = new SkillTubeController();
controller.init();
