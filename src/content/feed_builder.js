/**
 * SkillTube - Feed Builder (Upgraded)
 * Coursera-style learning rails with "Continue Learning" progress shelf.
 */

import { searchSkillVideos } from './innertube.js';
import { TAXONOMY } from '../utils/taxonomy.js';
import { getCachedFeed, setCachedFeed, removeContinueLearning, getSettings } from '../utils/storage.js';

export class FeedBuilder {
  constructor(settings, onFilterChange) {
    this.settings = settings;
    this.onFilterChange = onFilterChange;
    this.container = null;
  }

  /**
   * Renders the complete SkillTube feed replacement container
   */
  async mount(parentEl) {
    if (document.getElementById("skilltube-feed-container")) {
      document.getElementById("skilltube-feed-container").remove();
    }

    this.container = document.createElement("div");
    this.container.id = "skilltube-feed-container";
    this.container.className = "skilltube-feed";

    // Build Header & Rails
    const headerEl = this.buildHeader();
    this.container.appendChild(headerEl);

    // Continue Learning Shelf (if any)
    const continueShelf = await this.buildContinueLearningShelf();
    if (continueShelf) {
      this.container.appendChild(continueShelf);
    }

    const railsContainer = document.createElement("div");
    railsContainer.className = "skilltube-rails-container";
    this.container.appendChild(railsContainer);

    // Insert at the top of parent
    parentEl.prepend(this.container);

    // Load rails asynchronously
    await this.loadRails(railsContainer);
  }

  buildHeader() {
    const profession = TAXONOMY[this.settings.activeProfession] || 
      (this.settings.customProfessions && this.settings.customProfessions[this.settings.activeProfession]) || {
      name: "Custom Learning Track",
      icon: "🎯",
      skills: []
    };

    const header = document.createElement("div");
    header.className = "skilltube-header";
    header.innerHTML = `
      <div class="skilltube-header-top">
        <div class="skilltube-profession-badge">
          <span class="skilltube-prof-icon">${profession.icon}</span>
          <div class="skilltube-prof-info">
            <span class="skilltube-prof-label">CURATED LEARNING TRACK</span>
            <h2 class="skilltube-prof-name">${profession.name}</h2>
          </div>
        </div>

        <div class="skilltube-actions">
          <div class="skilltube-stat-badge" title="Shield active: casual searches won't pollute your feed">
            <span class="shield-dot"></span>
            <span>Shield: <strong>${this.settings.historyShieldEnabled ? "Active" : "Disabled"}</strong></span>
          </div>
          <button class="skilltube-btn skilltube-btn-secondary" id="skilltube-refresh-btn" title="Refresh Feeds">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div class="skilltube-pills-bar" id="skilltube-pills-bar">
        <button class="skilltube-pill ${this.settings.selectedTrackFilter === 'all' ? 'active' : ''}" data-filter="all">
          ✨ All Tracks
        </button>
        <button class="skilltube-pill ${this.settings.selectedTrackFilter === 'masterclass' ? 'active' : ''}" data-filter="masterclass">
          🎓 Full Courses & Playlists
        </button>
        ${(profession.skills || []).map(skill => `
          <button class="skilltube-pill ${this.settings.selectedTrackFilter === skill.id ? 'active' : ''}" data-filter="${skill.id}">
            ${skill.name}
          </button>
        `).join('')}
      </div>
    `;

    // Event listeners
    header.querySelectorAll(".skilltube-pill").forEach(pill => {
      pill.addEventListener("click", (e) => {
        const filter = e.currentTarget.getAttribute("data-filter");
        header.querySelectorAll(".skilltube-pill").forEach(p => p.classList.remove("active"));
        e.currentTarget.classList.add("active");
        this.onFilterChange(filter);
      });
    });

    header.querySelector("#skilltube-refresh-btn")?.addEventListener("click", () => {
      const rails = this.container.querySelector(".skilltube-rails-container");
      if (rails) this.loadRails(rails, true);
    });

    return header;
  }

  async buildContinueLearningShelf() {
    const items = this.settings.continueLearning || [];
    if (items.length === 0) return null;

    const shelf = document.createElement("div");
    shelf.className = "skilltube-continue-shelf";
    shelf.id = "skilltube-continue-shelf";

    const cardsHtml = items.map(item => {
      const remainingSecs = Math.max(0, item.duration - item.currentTime);
      const remainingMins = Math.round(remainingSecs / 60);

      return `
        <div class="skilltube-continue-card" data-video-id="${item.id}">
          <div class="continue-thumb-wrapper">
            <img src="${item.thumbnail}" alt="${item.title}" class="continue-thumb" />
            <div class="continue-progress-bar-bg">
              <div class="continue-progress-bar-fill" style="width: ${item.progressPercent}%"></div>
            </div>
          </div>
          <div class="continue-card-body">
            <div class="continue-header-row">
              <span class="continue-percent">${item.progressPercent}% Complete</span>
              <button class="continue-dismiss-btn" title="Dismiss from list" data-id="${item.id}">✕</button>
            </div>
            <h4 class="continue-card-title" title="${item.title}">${item.title}</h4>
            <div class="continue-meta">
              <span class="continue-channel">${item.channel}</span>
              <span class="continue-left">${remainingMins}m remaining</span>
            </div>
            <a href="https://www.youtube.com/watch?v=${item.id}&t=${item.currentTime}" class="continue-resume-btn">
              Resume ↗
            </a>
          </div>
        </div>
      `;
    }).join('');

    shelf.innerHTML = `
      <div class="skilltube-rail-header">
        <div>
          <h3 class="skilltube-rail-title">⏳ Pick Up Where You Left Off</h3>
          <p class="skilltube-rail-sub">Your active tutorials and courses with saved playback timestamps</p>
        </div>
      </div>
      <div class="skilltube-continue-scroll">
        ${cardsHtml}
      </div>
    `;

    // Dismiss button handlers
    shelf.querySelectorAll(".continue-dismiss-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.currentTarget.getAttribute("data-id");
        const updatedList = await removeContinueLearning(id);
        this.settings.continueLearning = updatedList;
        const card = shelf.querySelector(`.skilltube-continue-card[data-video-id="${id}"]`);
        if (card) card.remove();
        if (updatedList.length === 0) shelf.remove();
      });
    });

    return shelf;
  }

  async loadRails(container, forceRefresh = false) {
    container.innerHTML = "";
    const profession = TAXONOMY[this.settings.activeProfession] || 
      (this.settings.customProfessions && this.settings.customProfessions[this.settings.activeProfession]);
    if (!profession) return;

    const filter = this.settings.selectedTrackFilter || "all";

    // Determine which rails to render
    const railConfigs = [];

    if (filter === "all" || filter === "masterclass") {
      railConfigs.push({
        title: "🎓 Masterclasses & Full Courses",
        subtitle: "In-depth, end-to-end bootcamps and comprehensive playlists",
        query: `${profession.name} full course complete tutorial`,
        filter: "long",
        badge: "FULL COURSE"
      });
    }

    const skillsToRender = filter === "all" || filter === "masterclass"
      ? (profession.skills || []).slice(0, 3)
      : (profession.skills || []).filter(s => s.id === filter);

    for (const skill of skillsToRender) {
      railConfigs.push({
        title: `⚡ ${skill.name}`,
        subtitle: `Core concepts, best practices, and practical guides`,
        query: skill.queries[0] || `${skill.name} tutorial deep dive`,
        badge: skill.name.split(" ")[0].toUpperCase()
      });
    }

    if (filter === "all" && profession.trustedChannels?.length > 0) {
      const topCreators = profession.trustedChannels.slice(0, 3).map(c => c.name).join(" OR ");
      railConfigs.push({
        title: "🌟 Trusted Industry Mentors",
        subtitle: `Curated releases from top educators`,
        query: `${profession.name} (${topCreators})`,
        badge: "TOP CREATORS"
      });
    }

    // Render skeleton loaders
    railConfigs.forEach(rc => {
      container.appendChild(this.createSkeletonRail(rc.title, rc.subtitle));
    });

    // Fetch and render content
    for (let i = 0; i < railConfigs.length; i++) {
      const rc = railConfigs[i];
      const skeleton = container.children[i];

      const cacheKey = `${this.settings.activeProfession}_${rc.query}_${rc.filter || 'norm'}`;
      let videos = !forceRefresh ? await getCachedFeed(cacheKey) : null;

      if (!videos || videos.length === 0) {
        videos = await searchSkillVideos(rc.query, { filter: rc.filter, limit: 10 });
        if (videos && videos.length > 0) {
          await setCachedFeed(cacheKey, videos);
        }
      }

      if (skeleton) {
        const railEl = this.buildRailElement(rc, videos);
        container.replaceChild(railEl, skeleton);
      }
    }
  }

  createSkeletonRail(title, subtitle) {
    const rail = document.createElement("div");
    rail.className = "skilltube-rail";
    rail.innerHTML = `
      <div class="skilltube-rail-header">
        <div>
          <h3 class="skilltube-rail-title">${title}</h3>
          <p class="skilltube-rail-sub">${subtitle}</p>
        </div>
      </div>
      <div class="skilltube-cards-scroll">
        ${Array(5).fill(0).map(() => `
          <div class="skilltube-skeleton-card">
            <div class="skilltube-skeleton-thumb"></div>
            <div class="skilltube-skeleton-line short"></div>
            <div class="skilltube-skeleton-line"></div>
          </div>
        `).join('')}
      </div>
    `;
    return rail;
  }

  buildRailElement(config, videos) {
    const rail = document.createElement("div");
    rail.className = "skilltube-rail";

    if (!videos || videos.length === 0) {
      rail.innerHTML = `
        <div class="skilltube-rail-header">
          <div>
            <h3 class="skilltube-rail-title">${config.title}</h3>
            <p class="skilltube-rail-sub">${config.subtitle}</p>
          </div>
        </div>
        <div class="skilltube-empty-msg">No videos found for this topic right now. Try refreshing.</div>
      `;
      return rail;
    }

    const cardsHtml = videos.map(v => `
      <a href="${v.url}" class="skilltube-card" data-video-id="${v.id}">
        <div class="skilltube-thumb-wrapper">
          <img src="${v.thumbnail}" alt="${v.title}" class="skilltube-thumb" loading="lazy" />
          ${v.duration ? `<span class="skilltube-duration">${v.duration}</span>` : ''}
          ${config.badge ? `<span class="skilltube-badge">${config.badge}</span>` : ''}
        </div>
        <div class="skilltube-card-body">
          <h4 class="skilltube-card-title" title="${v.title}">${v.title}</h4>
          <div class="skilltube-card-meta">
            <span class="skilltube-channel">${v.channelName}</span>
            <div class="skilltube-stats">
              <span>${v.viewCount || ''}</span>
              ${v.publishedTime ? `<span>• ${v.publishedTime}</span>` : ''}
            </div>
          </div>
        </div>
      </a>
    `).join('');

    rail.innerHTML = `
      <div class="skilltube-rail-header">
        <div>
          <h3 class="skilltube-rail-title">${config.title}</h3>
          <p class="skilltube-rail-sub">${config.subtitle}</p>
        </div>
        <div class="skilltube-rail-nav">
          <button class="skilltube-nav-btn prev" title="Scroll Left">‹</button>
          <button class="skilltube-nav-btn next" title="Scroll Right">›</button>
        </div>
      </div>
      <div class="skilltube-cards-scroll">
        ${cardsHtml}
      </div>
    `;

    // Horizontal scroll handlers
    const scrollContainer = rail.querySelector(".skilltube-cards-scroll");
    rail.querySelector(".skilltube-nav-btn.prev")?.addEventListener("click", () => {
      scrollContainer.scrollBy({ left: -600, behavior: "smooth" });
    });
    rail.querySelector(".skilltube-nav-btn.next")?.addEventListener("click", () => {
      scrollContainer.scrollBy({ left: 600, behavior: "smooth" });
    });

    return rail;
  }
}
