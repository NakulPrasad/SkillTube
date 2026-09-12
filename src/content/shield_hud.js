/**
 * SkillTube - Video Player Shield HUD (Upgraded)
 * Real-time badge and playback tracker for the "Continue Learning" shelf.
 */

import { isVideoOnTopic } from '../utils/taxonomy.js';
import { saveContinueLearning } from '../utils/storage.js';

export class ShieldHUD {
  constructor(settings) {
    this.settings = settings;
    this.hudElement = null;
    this.manualOverride = null;
    this.progressTrackingInterval = null;
    this.currentVideoId = null;
  }

  updateSettings(settings) {
    this.settings = settings;
    this.evaluateCurrentVideo();
  }

  /**
   * Mounts or updates the badge and starts playback tracking
   */
  evaluateCurrentVideo() {
    if (!window.location.pathname.startsWith("/watch")) {
      this.remove();
      return;
    }

    if (!this.settings.isEnabled) {
      this.remove();
      return;
    }

    // Extract videoId from URL search params
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get("v");
    this.currentVideoId = videoId;

    const titleEl = document.querySelector("#title h1 yt-formatted-string, ytd-watch-metadata #title h1, h1.ytd-video-primary-info-renderer");
    const channelEl = document.querySelector("#owner #channel-name, ytd-channel-name");
    
    const titleText = titleEl ? titleEl.innerText : "";
    const channelText = channelEl ? channelEl.innerText : "";
    const fullText = `${titleText} ${channelText}`;

    if (!titleText) {
      setTimeout(() => this.evaluateCurrentVideo(), 800);
      return;
    }

    const matchResult = isVideoOnTopic(
      fullText,
      this.settings.activeSkills || [],
      this.settings.activeProfession,
      this.settings.customProfessions || {}
    );
    const isTopicMatch = matchResult.onTopic;

    const isShielded = this.manualOverride === "shielded" 
      ? true 
      : this.manualOverride === "learning" 
      ? false 
      : (!isTopicMatch && this.settings.historyShieldEnabled);

    // Communicate with background service worker
    chrome.runtime?.sendMessage?.({
      type: "TOGGLE_SHIELD",
      enabled: isShielded
    });

    if (isShielded) {
      chrome.runtime?.sendMessage?.({ type: "INCREMENT_SHIELD_STAT" });
      this.stopProgressTracking();
    } else {
      // Start tracking progress for Continue Learning shelf
      this.startProgressTracking(videoId, titleText, channelText);
    }

    this.renderBadge(isShielded, matchResult);
  }

  startProgressTracking(videoId, title, channel) {
    this.stopProgressTracking();

    const track = () => {
      const video = document.querySelector("video");
      if (!video || !video.duration || video.duration <= 0) return;

      // Only save if at least 15 seconds watched
      if (video.currentTime > 15) {
        const progressPercent = (video.currentTime / video.duration) * 100;
        const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        saveContinueLearning({
          id: videoId,
          title,
          channel,
          thumbnail,
          currentTime: video.currentTime,
          duration: video.duration,
          progressPercent
        });
      }
    };

    // Save every 8 seconds
    this.progressTrackingInterval = setInterval(track, 8000);
  }

  stopProgressTracking() {
    if (this.progressTrackingInterval) {
      clearInterval(this.progressTrackingInterval);
      this.progressTrackingInterval = null;
    }
  }

  renderBadge(isShielded, matchResult) {
    const targetParent = document.querySelector("#above-the-fold, #top-row, ytd-watch-metadata #owner");
    if (!targetParent) return;

    if (!this.hudElement) {
      this.hudElement = document.createElement("div");
      this.hudElement.id = "skilltube-hud-badge";
      this.hudElement.className = "skilltube-hud";
      targetParent.parentElement.insertBefore(this.hudElement, targetParent.nextSibling);
    }

    if (isShielded) {
      this.hudElement.className = "skilltube-hud shield-active";
      this.hudElement.innerHTML = `
        <div class="skilltube-hud-left">
          <span class="hud-icon">🛡️</span>
          <div>
            <strong>History & Search Shield Active</strong> (Casual / Off-Topic)
            <span class="hud-sub">Telemetry and search beacons are blocked. Your professional recommendations stay clean.</span>
          </div>
        </div>
        <button class="skilltube-hud-toggle-btn" id="skilltube-override-btn" title="Click to log this video anyway">
          Allow History
        </button>
      `;
    } else {
      this.hudElement.className = "skilltube-hud learning-active";
      this.hudElement.innerHTML = `
        <div class="skilltube-hud-left">
          <span class="hud-icon">🎓</span>
          <div>
            <strong>Learning Track: ${matchResult.matchedSkill || "Professional Skill"}</strong>
            <span class="hud-sub">Matched "${matchResult.matchedKeyword || 'Skill'}". Progress saved to "Continue Learning".</span>
          </div>
        </div>
        <button class="skilltube-hud-toggle-btn" id="skilltube-override-btn" title="Click to stealth shield this video">
          Shield Video
        </button>
      `;
    }

    this.hudElement.querySelector("#skilltube-override-btn")?.addEventListener("click", () => {
      this.manualOverride = isShielded ? "learning" : "shielded";
      this.evaluateCurrentVideo();
    });
  }

  remove() {
    this.stopProgressTracking();
    if (this.hudElement) {
      this.hudElement.remove();
      this.hudElement = null;
    }
    this.manualOverride = null;
    this.currentVideoId = null;
  }
}
