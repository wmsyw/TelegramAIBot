# Telegram AI Bot

多服务商 AI Telegram Bot，支持 OpenAI、Google Gemini、Anthropic Claude。

## 功能特性

- 🤖 **多模型支持** - OpenAI、Gemini、Claude 统一接口
- 💬 **对话** - 支持上下文记忆
- 🔍 **搜索** - 启用 Web Search 能力
- 🖼️ **图像生成** - DALL-E、Gemini 图像生成
- 🎵 **语音合成** - TTS 多音色支持
- 👥 **白名单系统** - 灵活的用户权限控制
- 🐳 **Docker 支持** - 多架构镜像 (amd64/arm64)

## 快速开始

### 1. 配置

```bash
cp .env.example .env
# 编辑 .env 填入 BOT_TOKEN 和 ADMIN_IDS
```

### 2. Docker 运行

```bash
docker-compose up -d
```

### 3. 本地开发

```bash
npm install
npm run dev
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `/chat` | AI 对话 |
| `/search` | 搜索模式对话 |
| `/image` | 生成图片 |
| `/tts` | 文本转语音 |
| `/audio` | 对话后转语音 |
| `/config` | 配置管理 |
| `/model` | 模型设置 |
| `/voice` | 音色设置 |
| `/context` | 上下文管理 |
| `/prompt` | 模板管理 |
| `/whitelist` | 白名单管理 |

## 配置服务商

```
/config add openai sk-xxx https://api.openai.com
/config add gemini AIzaSy-xxx https://generativelanguage.googleapis.com
/config add claude sk-ant-xxx https://api.anthropic.com
```

## 设置模型

```
/model chat openai gpt-4o
/model search gemini gemini-2.5-flash
/model image openai dall-e-3
/model tts gemini gemini-2.5-flash
```

## 白名单

- 模式切换: `/whitelist mode allow|deny`
- 添加用户: `/whitelist allow <用户ID>`
- 拒绝用户: `/whitelist deny <用户ID>`
- 管理员: `/whitelist admin add|remove <用户ID>`

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `BOT_TOKEN` | ✅ | Telegram Bot Token |
| `ADMIN_IDS` | ✅ | 管理员 ID (逗号分隔) |
| `DATA_DIR` | ❌ | 数据目录 (默认 ./data) |
| `WHITELIST_MODE` | ❌ | allow 或 deny (默认 allow) |

## License

MIT
