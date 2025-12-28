# Telegram AI Bot

多服务商 AI Telegram Bot，支持 OpenAI、Google Gemini、Anthropic Claude。

## 功能特性

- 🤖 **多模型支持** - OpenAI、Gemini、Claude 统一接口
- 💬 **对话模式** - 支持上下文记忆的多轮对话
- 🔍 **搜索模式** - 启用 Web Search 能力
- 🎙️ **实时语音** - Gemini Live 实时语音对话
- 🖼️ **图像生成** - DALL-E、Gemini 图像生成
- 🎵 **语音合成** - TTS 多音色支持
- 👥 **白名单系统** - 灵活的用户权限控制
- 💾 **Per-user 存储** - 每用户独立配置，数据隔离
- 🔐 **API Key 加密** - 用户配置加密存储，管理员不可见
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

| 命令 | 别名 | 说明 |
|------|------|------|
| `/chat [消息]` | `/c` | AI 对话，无参数进入对话模式 |
| `/search [关键词]` | `/s` | 搜索模式，无参数进入搜索模式 |
| `/image [描述]` | `/img`, `/i` | 生成图片，无参数进入图片模式 |
| `/tts [文本]` | `/v` | 文本转语音，无参数进入 TTS 模式 |
| `/audio [消息]` | `/a` | 对话后转语音，无参数进入语音对话模式 |
| `/live` | `/l` | 进入 Gemini Live 实时语音对话 |
| `/cancel` | - | 退出当前模式 |
| `/config` | - | 配置管理 |
| `/model` | - | 模型设置 |
| `/voice` | - | 音色设置 |
| `/prompt` | - | 模板管理 |
| `/whitelist` | - | 白名单管理 (仅管理员) |

## 会话模式

Bot 支持会话模式，进入模式后所有消息都会作为该模式的输入处理，直到使用 `/cancel` 退出：

```
/chat          # 进入对话模式
你好           # 作为对话消息处理
再说一遍       # 继续对话，保持上下文
/cancel        # 退出对话模式
```

## 配置服务商

每个用户需要配置自己的 API Key（加密存储，管理员不可见）：

```
/config add openai sk-xxx https://api.openai.com
/config add gemini AIzaSy-xxx https://generativelanguage.googleapis.com
/config add claude sk-ant-xxx https://api.anthropic.com
/config add gemini-live AIzaSy-xxx https://generativelanguage.googleapis.com
```

查看和管理配置：

```
/config list              # 列出已配置的服务商（Key 已脱敏）
/config remove <name>     # 删除服务商
/config collapse on|off   # 折叠长回复
/config telegraph on|off [limit]  # Telegraph 发布设置
```

## 设置模型

```
/model chat openai gpt-4o
/model search gemini gemini-2.5-flash
/model image openai dall-e-3
/model tts gemini gemini-2.5-flash
```

查看当前模型：`/model list`

## Gemini Live 实时语音

使用 `/live` 进入实时语音对话模式。

### 配置

每个用户需单独配置 Gemini Live API Key：

```
/config add gemini-live YOUR_API_KEY https://generativelanguage.googleapis.com
```

### 使用步骤

1. (可选) 设置音色：
   ```
   /voice gemini Aoede
   ```
   可选音色：Aoede, Charon, Fenrir, Kore, Puck

2. 开始对话：
   ```
   /live
   ```
   发送语音或文字消息，Bot 会以语音回复。

3. 退出：
   ```
   /cancel
   ```

## 音色设置

```
/voice gemini Kore       # 设置 Gemini TTS/Live 音色
/voice openai alloy      # 设置 OpenAI TTS 音色
```

Gemini 音色：Aoede, Charon, Fenrir, Kore, Puck
OpenAI 音色：alloy, echo, fable, onyx, nova, shimmer

## 提示词模板

```
/prompt add <name> <content>     # 创建模板
/prompt list                     # 列出模板
/prompt use <kind> <name>        # 应用到 chat/search/image/tts
/prompt clear <kind>             # 清除应用
/prompt delete <name>            # 删除模板
```

## 白名单

- 模式切换：`/whitelist mode allow|deny`
- 添加用户：`/whitelist allow <用户ID>`
- 拒绝用户：`/whitelist deny <用户ID>`
- 管理员：`/whitelist admin add|remove <用户ID>`
- 查看列表：`/whitelist list`

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `BOT_TOKEN` | ✅ | Telegram Bot Token |
| `ADMIN_IDS` | ✅ | 管理员 ID (逗号分隔) |
| `DATA_DIR` | ❌ | 数据目录 (默认 ./data) |
| `WHITELIST_MODE` | ❌ | allow 或 deny (默认 allow) |

## 安全特性

- **Per-user 隔离**：每个用户只能访问自己的配置和数据
- **API Key 加密**：用户的 API Key 使用 AES-256-GCM 加密存储
- **密钥派生**：加密密钥从 BOT_TOKEN 派生，数据库泄露不会暴露明文 Key
- **脱敏显示**：`/config list` 仅显示 Key 的前后 4 位

## 技术架构

- **框架**: grammY (Telegram Bot API)
- **存储**: SQLite (per-user 隔离)
- **加密**: AES-256-GCM
- **AI 服务**: OpenAI、Google Gemini、Anthropic Claude
- **实时语音**: Gemini Live API (WebSocket)
- **音频处理**: ffmpeg (ogg ↔ pcm 转换)

## License

MIT
