/**
 * SkillTube - Professions & Skills Taxonomy (Upgraded Smart Matching)
 * Broad semantic tech clusters, music/entertainment blacklist, and trusted channels.
 */

// Explicit Music, Gaming, Comedy & Distraction Blacklist
const DISTRACTION_KEYWORDS = [
  "music", "song", "official video", "official audio", "lyric video", "lyrics",
  "album", "remix", "lofi", "beats", "dj mix", "hip hop", "rap", "pop", "rock",
  "soundtrack", "mv", "trailer", "movie", "film", "short film", "comedy", "standup",
  "roast", "gaming", "gameplay", "walkthrough", "vlog", "prank", "reaction",
  "unboxing", "luxury car", "how i spend", "per month", "decode", "animation"
];

// Broad Tech & Software Engineering Keywords
const SOFTWARE_ENGINEERING_KEYWORDS = [
  "code", "coding", "program", "programming", "developer", "dev", "development",
  "software", "engineer", "engineering", "tutorial", "course", "tech", "technology",
  "full stack", "fullstack", "backend", "frontend", "api", "rest api", "graphql",
  "sql", "database", "postgres", "mysql", "mongodb", "redis", "react", "next.js",
  "nextjs", "typescript", "javascript", "js", "ts", "python", "java", "golang", "go",
  "c++", "cpp", "c#", "rust", "html", "css", "tailwind", "git", "github", "docker",
  "kubernetes", "k8s", "aws", "cloud", "linux", "devops", "ci/cd", "architecture",
  "system design", "distributed systems", "microservices", "algorithms", "data structures",
  "leetcode", "interview", "web dev", "app dev", "build", "framework", "node", "nodejs",
  "express", "vue", "angular", "django", "flask", "spring", "spring boot", "project",
  "masterclass", "filtering", "records", "computer", "machine learning", "ai"
];

// Broad AI & Data Science Keywords
const AI_DATA_SCIENCE_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "ml", "deep learning",
  "data science", "data scientist", "python", "pytorch", "tensorflow", "neural network",
  "llm", "large language model", "chatgpt", "gpt", "claude", "gemini", "langchain",
  "rag", "prompt engineering", "nlp", "computer vision", "pandas", "numpy",
  "statistics", "data analysis", "data engineering", "spark", "airflow", "vector database"
];

// Broad Product & Business Keywords
const PRODUCT_KEYWORDS = [
  "product management", "product manager", "product strategy", "product discovery",
  "roadmap", "agile", "scrum", "user stories", "a/b testing", "product analytics",
  "metrics", "cohort", "growth", "jira", "kanban", "startup", "y combinator", "mvp"
];

// Broad UI/UX Keywords
const DESIGN_KEYWORDS = [
  "ui design", "ux design", "ui/ux", "figma", "design system", "user research",
  "usability", "wireframe", "prototype", "auto layout", "typography", "color theory",
  "micro-interaction", "interaction design", "user experience", "interface"
];

// Broad Finance Keywords
const FINANCE_KEYWORDS = [
  "finance", "financial", "investing", "investment", "valuation", "dcf", "dcf valuation",
  "financial modeling", "excel", "macroeconomics", "monetary policy", "interest rates",
  "inflation", "stock market", "equity research", "balance sheet", "accounting", "ebitda"
];

// Broad Security Keywords
const SECURITY_KEYWORDS = [
  "cyber security", "cybersecurity", "ethical hacking", "pentesting", "penetration testing",
  "bug bounty", "burp suite", "kali linux", "owasp", "soc analyst", "wireshark",
  "malware", "network security", "appsec", "cryptography", "privilege escalation"
];

export const TAXONOMY = {
  software_engineering: {
    id: "software_engineering",
    name: "Software Engineering",
    icon: "💻",
    keywords: SOFTWARE_ENGINEERING_KEYWORDS,
    skills: [
      { id: "system_design", name: "System Design & Architecture", queries: ["system design course", "distributed systems tutorial"] },
      { id: "backend_dev", name: "Backend Development", queries: ["backend engineering course", "building apis tutorial"] },
      { id: "frontend_dev", name: "Frontend & Web Dev", queries: ["react next.js tutorial", "web development masterclass"] },
      { id: "devops_cloud", name: "DevOps & Cloud", queries: ["kubernetes docker tutorial", "aws cloud architecture"] },
      { id: "cs_fundamentals", name: "CS Fundamentals", queries: ["data structures algorithms course", "leetcode tutorial"] }
    ]
  },
  ai_data_science: {
    id: "ai_data_science",
    name: "AI & Data Science",
    icon: "🧠",
    keywords: AI_DATA_SCIENCE_KEYWORDS,
    skills: [
      { id: "llm_generative_ai", name: "LLMs & Generative AI", queries: ["building llm agents course", "rag deep dive tutorial"] },
      { id: "machine_learning", name: "Machine Learning & PyTorch", queries: ["pytorch deep learning course", "machine learning concepts"] }
    ]
  },
  product_management: {
    id: "product_management",
    name: "Product & Business",
    icon: "📊",
    keywords: PRODUCT_KEYWORDS,
    skills: [
      { id: "product_strategy", name: "Product Strategy & Discovery", queries: ["product management course", "product strategy case study"] }
    ]
  },
  ui_ux_design: {
    id: "ui_ux_design",
    name: "UI / UX Design",
    icon: "🎨",
    keywords: DESIGN_KEYWORDS,
    skills: [
      { id: "figma_mastery", name: "Figma & Design Systems", queries: ["figma design system tutorial", "ui ux design course"] }
    ]
  },
  finance_investing: {
    id: "finance_investing",
    name: "Finance & Investing",
    icon: "📈",
    keywords: FINANCE_KEYWORDS,
    skills: [
      { id: "financial_modeling", name: "Financial Modeling & Valuation", queries: ["financial modeling course", "valuation dcf step by step"] }
    ]
  },
  cyber_security: {
    id: "cyber_security",
    name: "Cyber Security",
    icon: "🛡️",
    keywords: SECURITY_KEYWORDS,
    skills: [
      { id: "ethical_hacking", name: "Ethical Hacking & AppSec", queries: ["ethical hacking course", "web application security tutorial"] }
    ]
  }
};

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
    keywords: [cleanTitle.toLowerCase(), ...words, "tutorial", "course", "guide", "fundamentals", "masterclass"],
    skills: [
      { id: `${id}_foundations`, name: `${cleanTitle} Foundations`, queries: [`${cleanTitle} course for beginners`] },
      { id: `${id}_advanced`, name: `Advanced ${cleanTitle}`, queries: [`advanced ${cleanTitle} tutorial`] }
    ]
  };
}

/**
 * Robust On-Topic Tester:
 * 1. Rejects any video with music / gaming / entertainment blacklist terms.
 * 2. Accepts video if title matches the active profession's broad keyword cluster.
 */
export function isVideoOnTopic(videoText, activeSkillIds, professionId, customProfessions = {}) {
  if (!videoText) return { onTopic: false };
  const text = videoText.toLowerCase();

  // 1. Music & Entertainment Blacklist Check (Instant Hide)
  for (const noiseKw of DISTRACTION_KEYWORDS) {
    if (text.includes(noiseKw)) {
      return { onTopic: false, matchedKeyword: noiseKw, reason: "music/entertainment blacklist" };
    }
  }

  // 2. Resolve Profession
  const profession = TAXONOMY[professionId] || customProfessions[professionId] || TAXONOMY["software_engineering"];
  const professionKeywords = profession.keywords || SOFTWARE_ENGINEERING_KEYWORDS;

  // 3. Match against profession's keyword cluster
  for (const kw of professionKeywords) {
    if (text.includes(kw)) {
      return { onTopic: true, matchedKeyword: kw };
    }
  }

  // 4. Also check sub-skill keywords if defined
  if (profession.skills) {
    for (const skill of profession.skills) {
      if (skill.keywords) {
        for (const kw of skill.keywords) {
          if (text.includes(kw.toLowerCase())) {
            return { onTopic: true, matchedSkill: skill.name, matchedKeyword: kw };
          }
        }
      }
    }
  }

  // Default: Off-topic if it doesn't match any profession keyword
  return { onTopic: false, reason: "no profession match" };
}
