import { Context, InlineKeyboard } from 'grammy';
import { stripCommand } from '../utils/text.js';

const HELP_MAIN = `🤖 <b>AI Bot 帮助</b>

<b>💬 对话命令</b>
/chat [问题] - AI 对话，无参数进入对话模式
/search [查询] - 搜索模式对话
/live - 实时语音对话 (Gemini Live)

<b>🖼️ 图片命令</b>
/image [描述] - 生成图片，无参数进入图片模式

<b>🎵 语音命令</b>
/tts [文本] - 文本转语音
/audio [问题] - 对话后转语音

<b>⚙️ 设置命令</b>
/config - 服务商和功能配置
/model - 模型设置
/voice - 音色设置
/prompt - Prompt 模板管理
/cancel - 退出当前模式

<b>👥 管理命令</b>
/whitelist - 用户白名单管理 (管理员)

<b>💡 使用详细帮助</b>
/help config - 配置命令详解
/help model - 模型命令详解
/help voice - 音色命令详解
/help prompt - 模板命令详解`;

const HELP_CONFIG = `⚙️ <b>/config 命令详解</b>

<b>查看配置</b>
<code>/config</code> - 查看当前配置概览
<code>/config status</code> - 同上
<code>/config list</code> - 列出所有服务商

<b>添加服务商</b>
<code>/config add &lt;名称&gt; &lt;API密钥&gt; &lt;BaseURL&gt;</code>
示例:
<code>/config add openai sk-xxx https://api.openai.com</code>
<code>/config add gemini AIzaSy-xxx https://generativelanguage.googleapis.com</code>
<code>/config add claude sk-ant-xxx https://api.anthropic.com</code>
<code>/config add gemini-live AIzaSy-xxx https://generativelanguage.googleapis.com</code>

<b>更新服务商</b>
<code>/config update &lt;名称&gt; apikey &lt;新密钥&gt;</code>
<code>/config update &lt;名称&gt; baseurl &lt;新URL&gt;</code>

<b>删除服务商</b>
<code>/config remove &lt;名称&gt;</code> - 删除指定服务商
<code>/config remove all</code> - 删除所有服务商

<b>折叠设置</b>
<code>/config collapse on</code> - 开启长消息折叠
<code>/config collapse off</code> - 关闭折叠

<b>Telegraph 设置</b>
<code>/config telegraph on</code> - 开启 Telegraph
<code>/config telegraph off</code> - 关闭 Telegraph
<code>/config telegraph limit &lt;字数&gt;</code> - 设置触发阈值
<code>/config telegraph token &lt;token&gt;</code> - 设置自定义 Token

<b>🔐 安全说明</b>
API Key 使用 AES-256 加密存储，管理员无法查看`;

const HELP_MODEL = `🔧 <b>/model 命令详解</b>

<b>查看当前模型</b>
<code>/model</code> - 查看所有模型配置
<code>/model list</code> - 同上

<b>设置模型</b>
<code>/model &lt;类型&gt; &lt;服务商&gt; &lt;模型名&gt;</code>

<b>模型类型</b>
• <code>chat</code> - 对话模型
• <code>search</code> - 搜索模型
• <code>image</code> - 图像生成模型
• <code>tts</code> - 语音合成模型
• <code>live</code> - 实时语音模型

<b>配置示例</b>
<code>/model chat openai gpt-4o</code>
<code>/model chat gemini gemini-2.5-flash</code>
<code>/model chat claude claude-sonnet-4-20250514</code>
<code>/model search gemini gemini-2.5-flash</code>
<code>/model image openai dall-e-3</code>
<code>/model tts openai tts-1</code>
<code>/model tts gemini gemini-2.5-flash</code>

<b>⚠️ 注意</b>
设置模型前需先添加对应服务商: /config add`;

const HELP_VOICE = `🎤 <b>/voice 命令详解</b>

<b>查看音色</b>
<code>/voice</code> - 查看当前音色和可用列表
<code>/voice list</code> - 同上

<b>设置 Gemini 音色</b>
<code>/voice gemini &lt;音色名&gt;</code>
可选: Aoede, Charon, Fenrir, Kore, Puck 等

<b>设置 OpenAI 音色</b>
<code>/voice openai &lt;音色名&gt;</code>
可选: alloy, echo, fable, onyx, nova, shimmer

<b>配置示例</b>
<code>/voice gemini Aoede</code>
<code>/voice openai nova</code>

<b>💡 说明</b>
• Gemini 音色用于 /tts 和 /live 命令
• OpenAI 音色用于 /tts 命令`;

const HELP_PROMPT = `🧩 <b>/prompt 命令详解</b>

<b>查看模板</b>
<code>/prompt</code> - 列出所有模板
<code>/prompt list</code> - 同上

<b>添加模板</b>
方式一: 回复消息
回复一条消息并执行 <code>/prompt add &lt;名称&gt;</code>

方式二: 多行输入
<code>/prompt add &lt;名称&gt;
模板内容第一行
模板内容第二行...</code>

<b>删除模板</b>
<code>/prompt del &lt;名称&gt;</code> - 删除指定模板
<code>/prompt del all</code> - 删除所有模板

<b>应用模板</b>
<code>/prompt chat &lt;名称&gt;</code> - 应用到对话
<code>/prompt search &lt;名称&gt;</code> - 应用到搜索
<code>/prompt image &lt;名称&gt;</code> - 应用到图片
<code>/prompt tts &lt;名称&gt;</code> - 应用到语音

<b>清除应用</b>
<code>/prompt chat</code> - 清除对话模板
<code>/prompt search</code> - 清除搜索模板
<code>/prompt image</code> - 清除图片模板
<code>/prompt tts</code> - 清除语音模板

<b>💡 使用场景</b>
• 设置系统角色: "你是一个专业翻译..."
• 设置输出格式: "请用 Markdown 格式回复..."
• 设置风格: "请用简洁的语言回答..."`;

const HELP_MAP: Record<string, string> = {
  config: HELP_CONFIG,
  model: HELP_MODEL,
  voice: HELP_VOICE,
  prompt: HELP_PROMPT,
};

export async function handleStart(ctx: Context): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text('💬 对话', 'mode:chat').text('🔍 搜索', 'mode:search').row()
    .text('🎨 图片', 'mode:image').text('🎤 实时', 'mode:live');

  await ctx.reply(`🤖 <b>欢迎使用 AI Bot!</b>\n\n请选择模式，或使用 /help 查看帮助`, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handleHelp(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'help').toLowerCase().trim();

  if (text && HELP_MAP[text]) {
    await ctx.reply(HELP_MAP[text], { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply(HELP_MAIN, { parse_mode: 'HTML' });
}
