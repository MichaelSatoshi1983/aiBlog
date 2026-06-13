const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_KEY = process.env.AI_API_KEY;
const API_URL = process.env.AI_API_URL;
const API_MODEL = process.env.AI_MODEL;
const API_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '4096', 10);
const BLOG_LOG_TOKEN = process.env.BLOG_LOG_TOKEN;

if (!API_KEY || !API_URL || !API_MODEL) {
  console.error('Missing env vars: AI_API_KEY, AI_API_URL, AI_MODEL');
  process.exit(1);
}

const LOG_REPO = `https://x-access-token:${BLOG_LOG_TOKEN}@github.com/MichaelSatoshi1983/aiBlog_Log.git`;
const LOG_DIR = '/tmp/aiBlog_Log';
const POSTS_DIR = path.join(__dirname, '..', 'source', '_posts');
const BLOG_REPO_DIR = path.join(__dirname, '..');

function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const year = now.getFullYear();

  const timeOfDay = hour < 6 ? '凌晨' : hour < 9 ? '早晨' : hour < 12 ? '上午'
    : hour < 14 ? '中午' : hour < 18 ? '下午' : '晚上';
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const season = month >= 3 && month <= 5 ? '春天' : month >= 6 && month <= 8 ? '夏天'
    : month >= 9 && month <= 11 ? '秋天' : '冬天';

  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`,
    year: String(year),
    month: String(month).padStart(2, '0'),
    dayOfWeek: dayNames[dayOfWeek],
    timeOfDay, isWeekend, season, hour
  };
}

function syncLogRepo() {
  if (!BLOG_LOG_TOKEN) { return false; }
  try {
    if (fs.existsSync(path.join(LOG_DIR, '.git'))) {
      execSync(`cd "${LOG_DIR}" && git pull`, { stdio: 'pipe', timeout: 30000 });
    } else {
      if (fs.existsSync(LOG_DIR)) fs.rmSync(LOG_DIR, { recursive: true, force: true });
      execSync(`git clone "${LOG_REPO}" "${LOG_DIR}"`, { stdio: 'pipe', timeout: 30000 });
    }
    return true;
  } catch (e) {
    return false;
  }
}

function readFile(filePath, fallback = '') {
  try { return fs.readFileSync(filePath, 'utf-8'); }
  catch { return fallback; }
}

async function callAI(systemPrompt) {
  const temperature = 0.7 + Math.random() * 0.3;
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: API_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '写一篇博客文章。只返回 JSON。' },
      ],
      temperature,
      max_tokens: API_MAX_TOKENS,
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

function extractJSON(raw) {
  let s = raw.trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*\n?/, '').replace(/\n```\s*$/, '');
  return JSON.parse(s);
}

async function main() {
  const timeCtx = getTimeContext();
  console.log(`${timeCtx.date} ${timeCtx.timeOfDay}`);

  const hasLog = syncLogRepo();
  const memoryFile = path.join(LOG_DIR, 'memory.md');
  const personalityFile = path.join(LOG_DIR, 'personality.md');

  let memoryContent = readFile(memoryFile);

  const sysPrompt = [
    '你是一个独立博客作者。',
    `时间：${timeCtx.date} 周${timeCtx.dayOfWeek} ${timeCtx.timeOfDay} 季节：${timeCtx.season}`,
    memoryContent ? `记忆：${memoryContent}` : '',
    '自己决定主题、风格、长度。',
    '返回 JSON：{title, tags[], content, topic, self_score(1-10), self_note}',
  ].filter(Boolean).join('\n');

  const raw = await callAI(sysPrompt);
  const article = extractJSON(raw);

  console.log(`${article.title} [${article.topic}] ${article.self_score}/10`);

  if (article.self_score >= 6) {
    const filename = article.title.replace(/[<>:"\/\\|?*]/g, '').replace(/\s+/g, '-').substring(0, 80);
    const now = new Date();
    const dateTimeStr = now.toISOString().replace(/\.\d{3}Z$/, '');

    let fm = '---\n';
    fm += `title: ${article.title}\n`;
    fm += `date: ${dateTimeStr}\n`;
    fm += 'tags:\n';
    if (Array.isArray(article.tags)) article.tags.forEach(t => { fm += `  - ${t}\n`; });
    fm += '---\n\n';

    const fullContent = fm + article.content.trim() + '\n';
    const filePath = path.join(POSTS_DIR, `${filename}.md`);
    fs.mkdirSync(POSTS_DIR, { recursive: true });
    fs.writeFileSync(filePath, fullContent, 'utf-8');
    console.log(`published: ${filename}.md`);
  } else {
    console.log('score too low, skipped');
  }

  if (hasLog) {
    const logDir = path.join(LOG_DIR, timeCtx.year, timeCtx.month);
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, `${timeCtx.date}.md`);
    const entry = `# ${timeCtx.date}\n\n- ${article.title} (${article.self_score}/10)\n\n`;
    fs.writeFileSync(logPath, entry, 'utf-8');

    const memoryLine = `- ${timeCtx.date}: ${article.title} [${article.topic}] ${article.self_score}/10\n`;
    fs.writeFileSync(memoryFile, (memoryContent || '') + memoryLine, 'utf-8');

    if (!readFile(personalityFile).trim()) {
      fs.writeFileSync(personalityFile, '# AI Blog Personality\n- writing to think\n- honest, not polished\n', 'utf-8');
    }

    try {
      execSync(`cd "${LOG_DIR}" && git add -A && git commit -m "${timeCtx.date}" && git push`, { stdio: 'pipe', timeout: 30000 });
    } catch (e) {
      if (!e.message.includes('nothing to commit')) console.error('log push:', e.message);
    }
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
