/**
 * SkillTube - Popup Logic (Upgraded with Developer Mode Console)
 */

import { getSettings, updateSettings, clearDebugLogs } from '../utils/storage.js';
import { TAXONOMY, generateCustomRoadmap } from '../utils/taxonomy.js';

document.addEventListener("DOMContentLoaded", async () => {
  const masterToggle = document.getElementById("master-toggle");
  const professionSelect = document.getElementById("profession-select");
  const skillsContainer = document.getElementById("skills-chips");
  const shieldToggle = document.getElementById("shield-toggle");
  const aiToggle = document.getElementById("ai-toggle");
  const devToggle = document.getElementById("dev-toggle");
  const shortsToggle = document.getElementById("shorts-toggle");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const statShielded = document.getElementById("stat-shielded");
  const statContinue = document.getElementById("stat-continue");
  const statSkills = document.getElementById("stat-skills");
  const openOptionsBtn = document.getElementById("open-options-btn");

  // API Key elements
  const geminiKeyInput = document.getElementById("gemini-key-input");
  const saveKeyBtn = document.getElementById("save-key-btn");

  // Developer Mode elements
  const devLogsBox = document.getElementById("dev-logs-box");
  const popupLogsScroll = document.getElementById("popup-logs-scroll");
  const clearPopupLogsBtn = document.getElementById("clear-popup-logs-btn");

  // Custom roadmap elements
  const customRoadmapBtn = document.getElementById("custom-roadmap-btn");
  const customJobBox = document.getElementById("custom-job-box");
  const customJobInput = document.getElementById("custom-job-input");
  const saveCustomJobBtn = document.getElementById("save-custom-job-btn");
  const cancelCustomJobBtn = document.getElementById("cancel-custom-job-btn");

  let settings = await getSettings();

  function populateProfessions() {
    professionSelect.innerHTML = "";
    
    // Built-in professions
    Object.values(TAXONOMY).forEach(prof => {
      const opt = document.createElement("option");
      opt.value = prof.id;
      opt.textContent = `${prof.icon} ${prof.name}`;
      if (prof.id === settings.activeProfession) {
        opt.selected = true;
      }
      professionSelect.appendChild(opt);
    });

    // Custom professions
    if (settings.customProfessions) {
      Object.values(settings.customProfessions).forEach(prof => {
        const opt = document.createElement("option");
        opt.value = prof.id;
        opt.textContent = `🚀 ${prof.name} (Custom)`;
        if (prof.id === settings.activeProfession) {
          opt.selected = true;
        }
        professionSelect.appendChild(opt);
      });
    }
  }

  function renderDevLogs() {
    if (!settings.developerMode) {
      devLogsBox.style.display = "none";
      return;
    }

    devLogsBox.style.display = "flex";
    popupLogsScroll.innerHTML = "";

    const logs = settings.debugLogs || [];
    if (logs.length === 0) {
      popupLogsScroll.innerHTML = `<div class="log-line info">No filter decisions logged yet...</div>`;
      return;
    }

    logs.forEach(log => {
      const line = document.createElement("div");
      const isAllowed = log.status === "ALLOWED";
      line.className = `log-line ${isAllowed ? 'allowed' : 'hidden'}`;
      line.innerHTML = `[${log.time}] <strong>[${log.status}]</strong> ${log.title} (${log.reason})`;
      popupLogsScroll.appendChild(line);
    });
  }

  populateProfessions();

  // Render initial state
  masterToggle.checked = settings.isEnabled;
  shieldToggle.checked = settings.historyShieldEnabled;
  aiToggle.checked = settings.aiEnabled !== false;
  devToggle.checked = settings.developerMode || false;
  shortsToggle.checked = settings.blockShorts;
  sidebarToggle.checked = settings.sidebarFilteringEnabled;
  geminiKeyInput.value = settings.geminiApiKey || "";

  statShielded.textContent = settings.stats?.videosShielded || 0;
  statContinue.textContent = (settings.continueLearning || []).length;

  renderSkillsChips(settings.activeProfession, settings.activeSkills);
  renderDevLogs();

  // Master Toggle
  masterToggle.addEventListener("change", async () => {
    const isEnabled = masterToggle.checked;
    await updateSettings({ isEnabled });
    chrome.runtime?.sendMessage?.({ type: "UPDATE_BADGE", isEnabled });
  });

  // Profession change
  professionSelect.addEventListener("change", async () => {
    const newProfId = professionSelect.value;
    const profData = TAXONOMY[newProfId] || (settings.customProfessions && settings.customProfessions[newProfId]);
    const defaultSkills = profData ? profData.skills.map(s => s.id) : [];

    await updateSettings({
      activeProfession: newProfId,
      activeSkills: defaultSkills,
      selectedTrackFilter: "all"
    });

    settings.activeProfession = newProfId;
    settings.activeSkills = defaultSkills;
    renderSkillsChips(newProfId, defaultSkills);
  });

  // Shield Toggle
  shieldToggle.addEventListener("change", async () => {
    const historyShieldEnabled = shieldToggle.checked;
    await updateSettings({ historyShieldEnabled });
    chrome.runtime?.sendMessage?.({ type: "TOGGLE_SHIELD", enabled: historyShieldEnabled });
  });

  // AI Toggle
  aiToggle.addEventListener("change", async () => {
    await updateSettings({ aiEnabled: aiToggle.checked });
  });

  // Dev Mode Toggle
  devToggle.addEventListener("change", async () => {
    const developerMode = devToggle.checked;
    settings.developerMode = developerMode;
    await updateSettings({ developerMode });
    renderDevLogs();
  });

  // Clear Popup Logs
  clearPopupLogsBtn.addEventListener("click", async () => {
    await clearDebugLogs();
    settings.debugLogs = [];
    renderDevLogs();
  });

  // Save Gemini API Key
  saveKeyBtn.addEventListener("click", async () => {
    const key = geminiKeyInput.value.trim();
    await updateSettings({ geminiApiKey: key });
    saveKeyBtn.textContent = "Saved ✓";
    setTimeout(() => { saveKeyBtn.textContent = "Save"; }, 2000);
  });

  // Shorts Toggle
  shortsToggle.addEventListener("change", async () => {
    await updateSettings({ blockShorts: shortsToggle.checked });
  });

  // Sidebar Toggle
  sidebarToggle.addEventListener("change", async () => {
    await updateSettings({ sidebarFilteringEnabled: sidebarToggle.checked });
  });

  // Custom Roadmap generator toggle
  customRoadmapBtn.addEventListener("click", () => {
    customJobBox.style.display = "flex";
    customJobInput.focus();
  });

  cancelCustomJobBtn.addEventListener("click", () => {
    customJobBox.style.display = "none";
    customJobInput.value = "";
  });

  saveCustomJobBtn.addEventListener("click", async () => {
    const title = customJobInput.value.trim();
    if (!title) return;

    const newRoadmap = generateCustomRoadmap(title);
    const customProfessions = settings.customProfessions || {};
    customProfessions[newRoadmap.id] = newRoadmap;

    const defaultSkills = newRoadmap.skills.map(s => s.id);

    await updateSettings({
      customProfessions,
      activeProfession: newRoadmap.id,
      activeSkills: defaultSkills,
      selectedTrackFilter: "all"
    });

    settings.customProfessions = customProfessions;
    settings.activeProfession = newRoadmap.id;
    settings.activeSkills = defaultSkills;

    customJobBox.style.display = "none";
    customJobInput.value = "";

    populateProfessions();
    renderSkillsChips(newRoadmap.id, defaultSkills);
  });

  // Open Options
  openOptionsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("src/options/options.html"));
    }
  });

  function renderSkillsChips(profId, activeSkillsList) {
    skillsContainer.innerHTML = "";
    const prof = TAXONOMY[profId] || (settings.customProfessions && settings.customProfessions[profId]);
    if (!prof) return;

    statSkills.textContent = activeSkillsList.length;

    (prof.skills || []).forEach(skill => {
      const chip = document.createElement("div");
      const isActive = activeSkillsList.includes(skill.id);
      chip.className = `skill-chip ${isActive ? 'active' : ''}`;
      chip.textContent = skill.name;

      chip.addEventListener("click", async () => {
        let currentSkills = [...activeSkillsList];
        if (currentSkills.includes(skill.id)) {
          currentSkills = currentSkills.filter(id => id !== skill.id);
          chip.classList.remove("active");
        } else {
          currentSkills.push(skill.id);
          chip.classList.add("active");
        }

        activeSkillsList = currentSkills;
        settings.activeSkills = currentSkills;
        statSkills.textContent = currentSkills.length;
        await updateSettings({ activeSkills: currentSkills });
      });

      skillsContainer.appendChild(chip);
    });
  }
});
