import { Context } from 'grammy';
import { db } from '../storage/sqlite.js';
import { html, shortenUrlForDisplay, trimBase, sanitizeUrl, stripCommand } from '../utils/text.js';

export async function handleConfig(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = stripCommand(ctx.message?.text, 'config');
  const args = text.split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'status' || !sub) {
    const user = db.getUser(userId);
    const models = db.getAllModels(userId);
    const telegraph = db.getTelegraph(userId);

    const flags = [
      `• 折叠: ${user.collapse ? '开启' : '关闭'}`,
      `• Telegraph: ${telegraph.enabled ? '开启' : '关闭'}${telegraph.enabled && telegraph.limit ? `（阈值 ${telegraph.limit}）` : ''}`,
    ].join('\n');

    const providers = db.listProviders(userId);
    const provList = providers.length
      ? providers.map(v => {
          const display = shortenUrlForDisplay(v.baseUrl);
          return `• <b>${html(v.name)}</b> - key:${v.apiKey ? '✅' : '❌'} base:<a href="${sanitizeUrl(v.baseUrl)}">${html(display)}</a>`;
        }).join('\n')
      : '(空)';

    const txt = `⚙️ <b>AI 配置概览</b>

<b>功能模型</b>
<b>chat:</b> <code>${html(models.chat) || '(未设)'}</code>
<b>search:</b> <code>${html(models.search) || '(未设)'}</code>
<b>image:</b> <code>${html(models.image) || '(未设)'}</code>
<b>tts:</b> <code>${html(models.tts) || '(未设)'}</code>

<b>功能开关</b>
${flags}

<b>服务商</b>
${provList}`;

    await ctx.reply(txt, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    return;
  }

  if (sub === 'add') {
    const [, name, key, baseUrl] = args;
    if (!name || !key || !baseUrl) {
      await ctx.reply('❌ 用法: /config add <名称> <API密钥> <BaseURL>');
      return;
    }

    try {
      const u = new URL(baseUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        await ctx.reply('❌ baseUrl 无效，请使用 http/https 协议');
        return;
      }
    } catch {
      await ctx.reply('❌ baseUrl 无效，请检查是否为合法 URL');
      return;
    }

    db.setProvider(userId, name, key, trimBase(baseUrl));
    await ctx.reply(`✅ 已添加服务商 <b>${html(name)}</b>`, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'update') {
    const [, name, field, ...rest] = args;
    const value = rest.join(' ').trim();

    if (!name || !field || !value) {
      await ctx.reply('❌ 用法: /config update <名称> <apikey|baseurl> <值>');
      return;
    }

    const p = db.getProvider(userId, name);
    if (!p) {
      await ctx.reply('❌ 未找到服务商');
      return;
    }

    if (field === 'apikey') {
      db.setProvider(userId, name, value, p.baseUrl);
    } else if (field === 'baseurl') {
      try {
        const u = new URL(value);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          await ctx.reply('❌ baseUrl 无效');
          return;
        }
      } catch {
        await ctx.reply('❌ baseUrl 无效');
        return;
      }
      db.setProvider(userId, name, p.apiKey, trimBase(value));
    } else {
      await ctx.reply('❌ 字段仅支持 apikey|baseurl');
      return;
    }

    await ctx.reply(`✅ 已更新 <b>${html(name)}</b> 的 <code>${html(field)}</code>`, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'remove') {
    const target = (args[1] || '').toLowerCase();
    if (!target) {
      await ctx.reply('❌ 请输入服务商名称或 all');
      return;
    }

    if (target === 'all') {
      db.deleteAllProviders(userId);
    } else {
      if (!db.deleteProvider(userId, target)) {
        await ctx.reply('❌ 未找到服务商');
        return;
      }
    }

    await ctx.reply('✅ 已删除');
    return;
  }

  if (sub === 'list') {
    const providers = db.listProviders(userId);
    const list = providers.length
      ? providers.map(v => {
          const display = shortenUrlForDisplay(v.baseUrl);
          return `• <b>${html(v.name)}</b> - key:${v.apiKey ? '✅' : '❌'} base:<a href="${sanitizeUrl(v.baseUrl)}">${html(display)}</a>`;
        }).join('\n')
      : '(空)';

    await ctx.reply(`📦 <b>已配置服务商</b>\n\n${list}`, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    return;
  }

  if (sub === 'collapse') {
    const val = args[1]?.toLowerCase();
    if (val === 'on') {
      db.updateUser(userId, { collapse: true });
      await ctx.reply('✅ 已开启折叠');
    } else if (val === 'off') {
      db.updateUser(userId, { collapse: false });
      await ctx.reply('✅ 已关闭折叠');
    } else {
      const user = db.getUser(userId);
      await ctx.reply(`折叠状态: ${user.collapse ? '开启' : '关闭'}\n\n用法: /config collapse <on|off>`);
    }
    return;
  }

  if (sub === 'telegraph') {
    const action = args[1]?.toLowerCase();
    if (action === 'on') {
      db.setTelegraph(userId, { enabled: true });
      await ctx.reply('✅ 已开启 Telegraph');
    } else if (action === 'off') {
      db.setTelegraph(userId, { enabled: false });
      await ctx.reply('✅ 已关闭 Telegraph');
    } else if (action === 'limit') {
      const limit = parseInt(args[2], 10);
      if (isNaN(limit) || limit < 0) {
        await ctx.reply('❌ 请输入有效的阈值');
        return;
      }
      db.setTelegraph(userId, { limit });
      await ctx.reply(`✅ 已设置 Telegraph 阈值: ${limit}`);
    } else if (action === 'token') {
      const token = args[2] || '';
      db.setTelegraph(userId, { token });
      await ctx.reply('✅ 已设置 Telegraph Token');
    } else {
      const tg = db.getTelegraph(userId);
      await ctx.reply(`Telegraph 状态: ${tg.enabled ? '开启' : '关闭'}\n阈值: ${tg.limit}\n\n用法: /config telegraph <on|off|limit|token> [值]`);
    }
    return;
  }

  await ctx.reply('❌ 未知子命令。支持: status, add, update, remove, list, collapse, telegraph');
}
