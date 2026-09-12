/**
 * SkillTube - Popup Logic (Upgraded with Music Toggle & Live API Verification)
 */

import { getSettings, updateSettings, clearDebugLogs } from '../utils/storage.js';
import { TAXONOMY, generateCustomRoadmap } from '../utils/taxonomy.js';
import { verifyGeminiApiKey, isLocalAIAvailable } from '../utils/ai_classifier.js';

document.addEventListener("DOMContentLoaded", async () => {
  const masterToggle = document.getElementById("master-toggle");
  const professionSelect = document.getElementById("profession-select");
  const skillsContainer = document.getElementById("skills-chips");
  const shieldToggle = document.getElementById("shield-toggle");
  const musicToggle = document.getElementById("music-toggle");
  const aiToggle = document.getElementById("ai-toggle");
  const devToggle = document.getElementById("dev-toggle");
  const shortsToggle = document.getElementById("shorts-toggle");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const statShielded = document.getElementById("stat-shielded");
  const statContinue = document.getElementById("stat-continue");
  const statSkills = document.getElementById("stat-skills");
  const openOptionsBtn = document.getElementById("open-options-btn");

  // API Key & Model Selector elements
  const aiModelSelect = document.getElementById("ai-model-select");
  const customModelBox = document.getElementById("custom-model-box");
  const customModelInput = document.getElementById("custom-model-input");
  const thinkingLevelSelect = document.getElementById("thinking-level-select");
  const geminiKeyGroup = document.getElementById("gemini-key-group");
  const modelHint = document.getElementById("model-hint");
  const geminiKeyInput = document.getElementById("gemini-key-input");
  const saveKeyBtn = document.getElementById("save-key-btn");
  const apiStatusMsg = document.getElementById("api-status-msg");

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

  function updateModelUI() {
    const selectedModel = aiModelSelect ? aiModelSelect.value : (settings.aiModel || "gemini-3.8-flash");

    if (customModelBox) {
      customModelBox.style.display = selectedModel === "custom" ? "block" : "none";
    }

    if (selectedModel === "window_ai") {
      if (geminiKeyGroup) geminiKeyGroup.style.display = "none";
      if (modelHint) modelHint.textContent = "Offline & Free";
    } else {
      if (geminiKeyGroup) geminiKeyGroup.style.display = "block";
      if (modelHint) {
        if (selectedModel === "gemini-3.8-flash") modelHint.textContent = "Latest 3.8";
        else if (selectedModel === "gemini-3.7-flash") modelHint.textContent = "Latest 3.7";
        else if (selectedModel === "gemini-3.7-pro") modelHint.textContent = "Deep Reasoning";
        else if (selectedModel === "gemini-2.0-flash") modelHint.textContent = "Ultra Fast";
        else if (selectedModel === "custom") modelHint.textContent = "Custom Model";
      }
    }
  }

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

  function getEffectiveModel() {
    if (settings.aiModel === "custom") {
      return (settings.customModelName || "").trim() || "gemini-3.8-flash";
    }
    return settings.aiModel || "gemini-3.8-flash";
  }

  async function checkAIStatus() {
    const currentModel = getEffectiveModel();
    const currentThinking = settings.thinkingLevel || "low";
    const hasLocalAI = await isLocalAIAvailable();

    if (settings.aiModel === "window_ai") {
      if (hasLocalAI) {
        apiStatusMsg.className = "api-status-msg success";
        apiStatusMsg.textContent = "🧠 Browser Local AI (Gemini Nano) active";
      } else {
        apiStatusMsg.className = "api-status-msg error";
        apiStatusMsg.textContent = "⚠️ Browser AI not available on this device. Switch to Gemini model.";
      }
      return;
    }

    if (settings.geminiApiKey) {
      apiStatusMsg.className = "api-status-msg loading";
      apiStatusMsg.textContent = `Testing key with ${currentModel} (Thinking: ${currentThinking})...`;
      const result = await verifyGeminiApiKey(settings.geminiApiKey, currentModel, currentThinking);

      if (result.valid) {
        apiStatusMsg.className = "api-status-msg success";
        apiStatusMsg.textContent = `✅ Connected (${result.model} | Thinking: ${currentThinking})`;
        chrome.runtime?.sendMessage?.({
          type: "DEV_LOG",
          logEntry: {
            title: "Gemini API Connection",
            status: "ALLOWED",
            reason: `Model ${result.model} connected (Thinking: ${currentThinking}).`
          }
        });
      } else {
        apiStatusMsg.className = "api-status-msg error";
        apiStatusMsg.textContent = `❌ ${result.error || "Invalid API Key"}`;
      }
    } else {
      apiStatusMsg.className = "api-status-msg info";
      apiStatusMsg.textContent = `Enter Gemini API key to activate ${currentModel}`;
    }
  }

  populateProfessions();

  // Render initial state
  masterToggle.checked = settings.isEnabled;
  shieldToggle.checked = settings.historyShieldEnabled;
  musicToggle.checked = settings.allowMusic || false;
  aiToggle.checked = settings.aiEnabled !== false;
  devToggle.checked = settings.developerMode || false;
  shortsToggle.checked = settings.blockShorts;
  sidebarToggle.checked = settings.sidebarFilteringEnabled;
  geminiKeyInput.value = settings.geminiApiKey || "";

  if (aiModelSelect) {
    aiModelSelect.value = settings.aiModel || "gemini-3.8-flash";
  }
  if (thinkingLevelSelect) {
    thinkingLevelSelect.value = settings.thinkingLevel || "low";
  }
  if (customModelInput) {
    customModelInput.value = settings.customModelName || "";
  }
  updateModelUI();

  statShielded.textContent = settings.stats?.videosShielded || 0;
  statContinue.textContent = (settings.continueLearning || []).length;

  renderSkillsChips(settings.activeProfession, settings.activeSkills);
  renderDevLogs();
  checkAIStatus();

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

  // Music Toggle
  musicToggle.addEventListener("change", async () => {
    const allowMusic = musicToggle.checked;
    await updateSettings({ allowMusic });
  });

  // AI Toggle
  aiToggle.addEventListener("change", async () => {
    await updateSettings({ aiEnabled: aiToggle.checked });
  });

  // AI Model Selection Change
  if (aiModelSelect) {
    aiModelSelect.addEventListener("change", async () => {
      const selectedModel = aiModelSelect.value;
      updateModelUI();
      await updateSettings({
        aiModel: selectedModel,
        aiProvider: selectedModel === "window_ai" ? "window_ai" : "gemini"
      });
      settings = await getSettings();
      await checkAIStatus();
    });
  }

  // Thinking Effort Selection Change
  if (thinkingLevelSelect) {
    thinkingLevelSelect.addEventListener("change", async () => {
      const thinkingLevel = thinkingLevelSelect.value;
      await updateSettings({ thinkingLevel });
      settings = await getSettings();
      await checkAIStatus();
    });
  }

  // Custom Model Input Change
  if (customModelInput) {
    customModelInput.addEventListener("change", async () => {
      const customModelName = customModelInput.value.trim();
      await updateSettings({ customModelName });
      settings = await getSettings();
      await checkAIStatus();
    });
  }

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

  // Save & Test Gemini API Key
  saveKeyBtn.addEventListener("click", async () => {
    const key = geminiKeyInput.value.trim();
    const currentModel = getEffectiveModel();
    const currentThinking = settings.thinkingLevel || "low";
    saveKeyBtn.textContent = "Testing...";
    saveKeyBtn.disabled = true;

    apiStatusMsg.className = "api-status-msg loading";
    apiStatusMsg.textContent = `Connecting to ${currentModel} (Thinking: ${currentThinking})...`;

    const verification = await verifyGeminiApiKey(key, currentModel, currentThinking);
    await updateSettings({ geminiApiKey: key });
    settings.geminiApiKey = key;

    saveKeyBtn.disabled = false;
    saveKeyBtn.textContent = "Test & Save";

    if (verification.valid) {
      apiStatusMsg.className = "api-status-msg success";
      apiStatusMsg.textContent = `✅ Connected (${verification.model} | Thinking: ${currentThinking})`;
    } else {
      apiStatusMsg.className = "api-status-msg error";
      apiStatusMsg.textContent = `❌ ${verification.error || "Key test failed"}`;
    }
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
