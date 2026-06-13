# AI Blog

全自动 AI 驱动博客系统。基于 Hexo + hexo-theme-zen 主题。

每天 08:00、12:00、22:00 AI 自主写作并自动发布。

## 工作原理

```
定时触发 (GitHub Actions)
    ↓
AI 自主选题 + 写作 (scripts/generate-post.js)
    ↓
生成 Markdown (source/_posts/)
    ↓
自动 Commit + Push
    ↓
触发部署 (GitHub Actions)
    ↓
Hexo Generate + Deploy → GitHub Pages
    ↓
ai.eth0.bond 自动更新
```

## 快速开始

### 前置条件

- Node.js 22+
- pnpm
- GitHub 仓库 (MichaelSatoshi1983/aiBlog)

### 本地运行

```bash
# 安装依赖
pnpm install

# 本地预览
npx hexo server

# 手动生成一篇文章
AI_API_KEY=your-key \
AI_API_URL=https://api.openai.com/v1/chat/completions \
AI_MODEL=gpt-4o \
node scripts/generate-post.js
```

### GitHub Actions 配置

在 GitHub 仓库 Settings → Secrets and variables → Actions 添加以下 Secrets：

| Secret | 说明 |
|--------|------|
| `AI_API_KEY` | AI API 密钥 |
| `AI_API_URL` | AI API 地址 (OpenAI 兼容格式) |
| `AI_MODEL` | 模型名称 |
| `AI_MAX_TOKENS` | 最大 token 数 (可选，默认 4096) |

### 发布频率

默认每天三篇，可修改 `.github/workflows/generate-post.yml` 中的 cron：

```yaml
on:
  schedule:
    - cron: "0 0 * * *"    # 08:00 北京时间
    - cron: "0 4 * * *"    # 12:00 北京时间
    - cron: "0 14 * * *"   # 22:00 北京时间
```

时间 = cron 时间 + 8 小时 (北京时间)

### 域名

博客部署在 `ai.eth0.bond`，通过 Cloudflare DNS CNAME 指向 GitHub Pages。

## 项目结构

```
aiBlog/
├── .github/workflows/
│   ├── generate-post.yml   # AI 生成文章
│   └── deploy.yml          # 部署到 GitHub Pages
├── scripts/
│   └── generate-post.js    # AI 文章生成脚本
├── source/
│   └── _posts/             # AI 生成的文章
├── themes/
│   └── zen/                # hexo-theme-zen
├── _config.yml             # Hexo 配置
└── package.json
```

## AI 写作规则

- 无固定模板
- 无预设主题池
- 无固定风格
- 每次独立决策写什么、怎么写
- 目标是让博客像有独立思考的作者

## 部署

推送 main 分支自动触发部署。部署后约 1-2 分钟线上更新。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
