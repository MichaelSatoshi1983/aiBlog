const fs = require("fs");
const path = require("path");

// AI API configuration - all from environment variables
const API_KEY = process.env.AI_API_KEY;
const API_URL = process.env.AI_API_URL;
const API_MODEL = process.env.AI_MODEL;
const API_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || "4096", 10);

if (!API_KEY || !API_URL || !API_MODEL) {
  console.error("Missing required env vars: AI_API_KEY, AI_API_URL, AI_MODEL");
  process.exit(1);
}

const POSTS_DIR = path.join(__dirname, "..", "source", "_posts");
const GIT_USER = process.env.GIT_USER || "AI Blog Bot";
const GIT_EMAIL = process.env.GIT_EMAIL || "ai-bot@ai.eth0.bond";

async function callAI() {
  // Random temperature for variety
  const temperature = 0.7 + Math.random() * 0.3;

  const systemPrompt = `你是一个独立博客作者。你有自己独特的思想、观点和审美。

重要规则：
- 每次写作都是全新的开始，不受任何历史文章影响
- 自己决定今天写什么主题
- 自己决定文章风格、长度、结构
- 不要使用固定模板或套路
- 避免机械化表达
- 可以写任何领域：科技、哲学、生活、艺术、社会观察、个人思考、读书笔记、技术分析……
- 可以写严肃的深度长文，也可以写轻松的短文
- 风格可以理性、感性、幽默、犀利、温暖……每次都可以不同
- 像真正的博主一样思考：今天有什么想说的？

返回 JSON 格式：
{
  "title": "文章标题",
  "tags": ["标签1", "标签2", "标签3"],
  "content": "Markdown 格式的完整文章正文"
}`;

  const userPrompt = `写一篇新的博客文章。你想写什么就写什么。

要求：
- 标题要有吸引力但不标题党
- 标签 2-5 个
- 内容用 Markdown 格式
- 只返回 JSON，不要有其他文字`;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: API_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: API_MAX_TOKENS,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const rawContent = data.choices[0].message.content;

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = rawContent.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
  }

  return JSON.parse(jsonStr);
}

function sanitizeFilename(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);
}

function generateFrontMatter(title, tags) {
  const now = new Date();
  const dateStr = now.toISOString().replace(/T.*/, "");
  const dateTimeStr = now.toISOString().replace(/\.\d{3}Z$/, "");

  let fm = "---\n";
  fm += `title: ${title}\n`;
  fm += `date: ${dateTimeStr}\n`;
  fm += "tags:\n";
  tags.forEach((tag) => {
    fm += `  - ${tag}\n`;
  });
  fm += "---\n\n";

  return { frontMatter: fm, dateStr };
}

async function main() {
  console.log("Generating post...");

  const article = await callAI();
  console.log(`Title: ${article.title}`);
  console.log(`Tags: ${article.tags.join(", ")}`);

  const { frontMatter, dateStr } = generateFrontMatter(article.title, article.tags);
  const filename = sanitizeFilename(article.title);
  const filePath = path.join(POSTS_DIR, `${filename}.md`);

  // Ensure posts directory exists
  fs.mkdirSync(POSTS_DIR, { recursive: true });

  // Write the post
  const fullContent = frontMatter + article.content.trim() + "\n";
  fs.writeFileSync(filePath, fullContent, "utf-8");

  console.log(`Written to: ${filePath}`);
  console.log(`Content length: ${fullContent.length} chars`);
}

main().catch((err) => {
  console.error("Failed to generate post:", err);
  process.exit(1);
});
