import { Context } from 'grammy';

const HELP_TEXT = `🤖 <b>AI Bot 帮助</b>

<b>💬 对话</b>
/chat [问题] - AI 对话
/search [查询] - 搜索模式对话

<b>🖼️ 图片</b>
/image [描述] - 生成图片

<b>🎵 语音</b>
/tts [文本] - 文本转语音
/audio [问题] - 对话后转语音

<b>⚙️ 设置</b>
/config - 查看/管理服务商配置
/model - 查看/设置模型
/voice - 查看/设置音色
/context - 上下文管理
/prompt - Prompt 模板管理

<b>👥 白名单</b>
/whitelist - 用户白名单管理 (管理员)

<b>📝 配置示例</b>
• 添加服务商: /config add openai sk-xxx https://api.openai.com
• 设置模型: /model chat openai gpt-4o

<b>💡 提示</b>
• 回复消息可作为输入
• 使用 /context on 开启上下文记忆`;

export async function handleStart(ctx: Context): Promise<void> {
  await ctx.reply(`🤖 欢迎使用 AI Bot!\n\n使用 /help 查看帮助`, { parse_mode: 'HTML' });
}

export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(HELP_TEXT, { parse_mode: 'HTML' });
}
