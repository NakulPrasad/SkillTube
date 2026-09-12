/**
 * SkillTube - Professions & Skills Taxonomy (with Configurable Music Toggle)
 * Word-boundary regex matching with separated music and distraction categories.
 */

// Pure Distraction Blacklist (always filtered out)
const GENERAL_DISTRACTION_KEYWORDS = [
  "trailer", "movie", "film", "short film", "comedy", "standup",
  "roast", "gaming", "gameplay", "walkthrough", "vlog", "prank", "reaction",
  "unboxing", "luxury car", "how i spend", "per month", "decode", "animation",
  "badminton", "cricket", "football", "soccer", "recipe", "cooking", "maggi",
  "eggs", "diet", "fitness", "workout", "gym", "lin dan", "goat of"
];

// Music & Study Beats Keywords (Toggleable by user)
const MUSIC_KEYWORDS = [
  "music", "song", "songs", "official video", "official music video", "official audio", "lyric video", "lyrics",
  "album", "remix", "lofi", "lo-fi", "beats", "dj mix", "hip hop", "rap", "pop", "rock",
  "soundtrack", "ost", "mv", "chillhop", "synthwave", "ambient", "study beats", "instrumental",
  "acoustic", "unplugged", "concert", "live performance", "orchestra", "symphony",
  "disco", "karaoke", "cover", "prod by", "feat", "ft.", "single", "records", "vevo",
  "audio track", "visualizer", "bass boosted", "slowed + reverb", "playlist", "radio"
];

// Tech Keywords (checked with word boundaries)
const SOFTWARE_ENGINEERING_KEYWORDS = [
  "code", "coding", "programming", "programmer", "developer", "software", "software engineer",
  "software engineering", "software development", "web development", "full stack",
  "fullstack", "backend", "frontend", "api", "rest api", "graphql", "sql", "postgresql",
  "postgres", "mysql", "mongodb", "redis", "react", "next.js", "nextjs", "typescript",
  "javascript", "python", "java", "golang", "go language", "go lang", "c++", "rust", "tailwind", "docker",
  "kubernetes", "k8s", "aws", "cloud architecture", "linux", "devops", "ci/cd",
  "system design", "distributed systems", "microservices", "data structures",
  "algorithms", "leetcode", "computer science", "node.js", "nodejs", "express.js",
  "django", "flask", "spring boot", "masterclass", "tech interview", "coding interview",
  "n-queen", "backtracking", "sudoku solver", "dynamic programming", "graph algorithm",
  "ts tutorial", "react ts", "js tutorial", "web dev", "app development",
  "oop", "oops", "object oriented", "object-oriented",
  "open source", "open-source", "oss",
  "git", "github", "gitlab",
  "refactor", "refactoring", "clean code", "debugging",
  "architecture", "software architecture", "shipping software",
  "terminal", "bash", "cli", "shell script", "neovim", "vim", "vscode",
  "self-hosted", "self host", "tech career"
];

const AI_DATA_SCIENCE_KEYWORDS = [
  "artificial intelligence", "machine learning", "deep learning",
  "data science", "data scientist", "pytorch", "tensorflow", "neural network",
  "neural networks", "large language model", "llm", "chatgpt", "gemini", "langchain",
  "rag", "prompt engineering", "nlp", "computer vision", "pandas", "numpy",
  "data analysis", "data engineering", "spark", "vector database"
];

const PRODUCT_KEYWORDS = [
  "product management", "product manager", "product strategy", "product discovery",
  "roadmap", "agile", "scrum", "user stories", "a/b testing", "product analytics",
  "jira", "kanban", "startup", "mvp"
];

const DESIGN_KEYWORDS = [
  "ui design", "ux design", "ui/ux", "figma", "design system", "user research",
  "usability testing", "wireframe", "wireframing", "prototype", "prototyping",
  "auto layout", "design tokens", "interaction design"
];

const FINANCE_KEYWORDS = [
  "financial modeling", "dcf valuation", "discounted cash flow", "valuation model",
  "macroeconomics", "monetary policy", "interest rates", "central bank",
  "equity research", "balance sheet", "income statement", "ebitda"
];

const SECURITY_KEYWORDS = [
  "cyber security", "cybersecurity", "ethical hacking", "penetration testing",
  "bug bounty", "burp suite", "kali linux", "owasp", "soc analyst", "wireshark",
  "malware analysis", "network security", "appsec", "privilege escalation"
];

export const TAXONOMY = {
  software_engineering: {
    id: "software_engineering",
    name: "Software Engineering",
    icon: "💻",
    keywords: SOFTWARE_ENGINEERING_KEYWORDS
  },
  ai_data_science: {
    id: "ai_data_science",
    name: "AI & Data Science",
    icon: "🧠",
    keywords: AI_DATA_SCIENCE_KEYWORDS
  },
  product_management: {
    id: "product_management",
    name: "Product & Business",
    icon: "📊",
    keywords: PRODUCT_KEYWORDS
  },
  ui_ux_design: {
    id: "ui_ux_design",
    name: "UI / UX Design",
    icon: "🎨",
    keywords: DESIGN_KEYWORDS
  },
  finance_investing: {
    id: "finance_investing",
    name: "Finance & Investing",
    icon: "📈",
    keywords: FINANCE_KEYWORDS
  },
  cyber_security: {
    id: "cyber_security",
    name: "Cyber Security",
    icon: "🛡️",
    keywords: SECURITY_KEYWORDS
  }
};

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesWordBoundary(text, keyword) {
  const pattern = new RegExp(`(?:^|\\W)${escapeRegex(keyword)}(?:$|\\W)`, "i");
  return pattern.test(text);
}

/**
 * Robust On-Topic Evaluator with Music Toggle Support:
 * - Checks general distractions (always hidden)
 * - Checks music: if allowMusic is true, music is ALLOWED; if false, music is HIDDEN
 * - Checks profession keywords with word boundary
 */
export function isVideoOnTopic(videoText, activeSkillIds, professionId, customProfessions = {}, options = {}) {
  if (!videoText) return { onTopic: false };
  const text = videoText.toLowerCase();

  // 0. Explicit User Blocklist (Video ID, Title, or Custom User Blocked Keywords)
  if (options.videoId && (options.blockedVideoIds || []).includes(options.videoId)) {
    return { onTopic: false, isDistraction: true, isUserBlocked: true, reason: "Manually blocked video" };
  }
  if (options.title && (options.blockedVideoTitles || []).some(t => t.toLowerCase() === options.title.toLowerCase())) {
    return { onTopic: false, isDistraction: true, isUserBlocked: true, reason: "Manually blocked video" };
  }
  for (const userKw of (options.blockedKeywords || [])) {
    if (userKw && matchesWordBoundary(text, userKw)) {
      return { onTopic: false, matchedKeyword: userKw, isDistraction: true, isUserBlocked: true, reason: `User blocked keyword: "${userKw}"` };
    }
  }

  // 1. Explicit Music Badge / Topic Channel Check
  if (options.hasMusicBadge) {
    if (options.allowMusic) {
      return { onTopic: true, matchedKeyword: "Music Channel", isMusic: true, matchedSkill: "Music & Beats" };
    } else {
      return { onTopic: false, matchedKeyword: "Music Channel", isMusic: true, reason: "Music blocked by filter" };
    }
  }

  // 2. Music Keywords Check (toggleable via options.allowMusic)
  for (const musicKw of MUSIC_KEYWORDS) {
    if (matchesWordBoundary(text, musicKw)) {
      if (options.allowMusic) {
        return { onTopic: true, matchedKeyword: musicKw, isMusic: true, matchedSkill: "Music & Beats" };
      } else {
        return { onTopic: false, matchedKeyword: musicKw, isMusic: true, reason: `Music blocked ("${musicKw}")` };
      }
    }
  }

  // 3. General Distraction Check (always hidden)
  for (const noiseKw of GENERAL_DISTRACTION_KEYWORDS) {
    if (matchesWordBoundary(text, noiseKw)) {
      return { onTopic: false, matchedKeyword: noiseKw, isDistraction: true, reason: `Blacklisted: "${noiseKw}"` };
    }
  }

  // 4. Resolve Profession Keywords
  const profession = TAXONOMY[professionId] || customProfessions[professionId] || TAXONOMY["software_engineering"];
  const professionKeywords = profession.keywords || SOFTWARE_ENGINEERING_KEYWORDS;

  // 5. Match Profession Keywords with Word Boundary
  for (const kw of professionKeywords) {
    if (matchesWordBoundary(text, kw)) {
      return { onTopic: true, matchedKeyword: kw };
    }
  }

  return { onTopic: false, reason: "No profession keyword match" };
}

export function generateCustomRoadmap(jobTitle) {
  const cleanTitle = jobTitle.trim();
  const id = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const words = cleanTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  return {
    id,
    name: cleanTitle,
    icon: "🚀",
    description: `Custom Curriculum for ${cleanTitle}`,
    isCustom: true,
    keywords: [cleanTitle.toLowerCase(), ...words, "tutorial", "course", "guide", "fundamentals", "masterclass"]
  };
}
