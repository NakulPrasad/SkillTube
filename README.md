# 🎯 SkillTube - Profession & Skill Curated YouTube Feed

**SkillTube** is a Chrome Extension (Manifest V3) that transforms YouTube from a chaotic entertainment loop into a structured, Coursera-style professional learning platform.

---

## 🚀 Key Features

1. **🎓 Coursera-Style Learning Rails on YouTube Home**
   - **Full Masterclasses & Bootcamps:** Long-form courses (>40m) & complete series playlists.
   - **Concept Deep Dives:** Focused modules on specific skills (e.g. *System Design*, *Kubernetes*, *React internals*).
   - **Trusted Creators Network:** Handpicked reputable industry educators (e.g., *freeCodeCamp*, *ByteByteGo*, *Hussein Nasser*, *Fireship*).
2. **🛡️ Smart "History Shield" (Stealth Mode)**
   - When searching and watching funny clips or podcasts late at night, SkillTube automatically blocks telemetry and watch-time tracking beacons (`/api/stats/watchtime`).
   - Your account's recommendation algorithm **never gets polluted** by off-topic videos.
3. **🏷️ Live Video Player HUD**
   - Injects a status banner on every video: `[🎓 Learning Track]` or `[🛡️ History Shield Active]`.
   - Allows instant one-click switching if you want to record a video into your learning history.
4. **🎯 Clean Sidebar**
   - Removes unrelated clickbait/gaming/memes when watching tutorials so you stay focused on your learning track.

---

## 📦 How to Load in Google Chrome

1. Open Google Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer Mode** using the toggle in the top-right corner.
3. Click **Load unpacked** (top-left button).
4. Select this folder: `c:\Users\nakul\Documents\antigravity\quirky-fermi`
5. Open [YouTube.com](https://www.youtube.com):
   - Click the **SkillTube** icon in your Chrome toolbar.
   - Select your **Profession** (e.g., *Software Engineering*, *AI & Data Science*, *Product Management*, *Finance*, etc.).
   - Toggle specific skills and refresh YouTube.

---

## 🛠️ Architecture & Tech Stack

- **Manifest V3** with `declarativeNetRequest` for stealth history protection.
- **Native InnerTube Search Parsing**: Fast, zero API key requirement, immune to DOM class changes.
- **Chrome Storage Local Cache**: 2-hour TTL cache for instant, zero-lag homepage loads.
- **ES6 Modular Content Scripts**: Clean separation of taxonomy, storage, feed builder, and player HUD.
