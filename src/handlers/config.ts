import { Context } from 'grammy';
import { store } from '../storage/store.js';
import { html, shortenUrlForDisplay, trimBase, sanitizeUrl, stripCommand } from '../utils/text.js';
import { isAdmin } from '../middlewares/auth.js';

export async function handleConfig(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'config');
  const args = text.split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'status' || !sub) {
    const cur = store.data.models;
    const flags = [
      `• 上下文: ${store.data.contextEnabled ? '开启' : '关闭'}`,
      `• 折叠: ${store.data.collapse ? '开启' : '关闭'}`,
      `• Telegraph: ${store.data.telegraph.enabled ? '开启' : '关闭'}${store.data.telegraph.enabled && store.data.telegraph.limit ? `（阈值 ${store.data.telegraph.limit}）` : ''}`,
    ].join('\n');

    const provList = Object.entries(store.data.providers)
      .map(([n, v]) => {
        const display = shortenUrlForDisplay(v.baseUrl);
        return `• <b>${html(n)}</b> - key:${v.apiKey ? '✅' : '❌'} base:<a href="${sanitizeUrl(v.baseUrl)}">${html(display)}</a>`;
      })
      .join('\n') || '(空)';

    const txt = `⚙️ <b>AI 配置概览</b>

<b>功能模型</b>
<b>chat:</b> <code>${html(cur.chat) || '(未设)'}</code>
<b>search:</b> <code>${html(cur.search) || '(未设)'}</code>
<b>image:</b> <code>${html(cur.image) || '(未设)'}</code>
<b>tts:</b> <code>${html(cur.tts) || '(未设)'}</code>

<b>功能开关</b>
${flags}

<b>服务商</b>
${provList}`;

    await ctx.reply(txt, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    return;
  }

  if (sub === 'add') {
    const userId = ctx.from?.id;
    if (!userId || !isAdmin(userId)) {
      await ctx.reply('❌ 仅管理员可添加服务商');
      return;
    }

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

    store.data.providers[name] = { apiKey: key, baseUrl: trimBase(baseUrl) };
    await store.writeSoon();
    await ctx.reply(`✅ 已添加服务商 <b>${html(name)}</b>`, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'update') {
    const userId = ctx.from?.id;
    if (!userId || !isAdmin(userId)) {
      await ctx.reply('❌ 仅管理员可更新服务商配置');
      return;
    }

    const [, name, field, ...rest] = args;
    const value = rest.join(' ').trim();

    if (!name || !field || !value) {
      await ctx.reply('❌ 用法: /config update <名称> <apikey|baseurl> <值>');
      return;
    }

    const p = store.data.providers[name];
    if (!p) {
      await ctx.reply('❌ 未找到服务商');
      return;
    }

    if (field === 'apikey') {
      p.apiKey = value;
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
      p.baseUrl = trimBase(value);
    } else {
      await ctx.reply('❌ 字段仅支持 apikey|baseurl');
      return;
    }

    await store.writeSoon();
    await ctx.reply(`✅ 已更新 <b>${html(name)}</b> 的 <code>${html(field)}</code>`, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'remove') {
    const userId = ctx.from?.id;
    if (!userId || !isAdmin(userId)) {
      await ctx.reply('❌ 仅管理员可删除服务商');
      return;
    }

    const target = (args[1] || '').toLowerCase();
    if (!target) {
      await ctx.reply('❌ 请输入服务商名称或 all');
      return;
    }

    if (target === 'all') {
      store.data.providers = {};
    } else {
      if (!store.data.providers[target]) {
        await ctx.reply('❌ 未找到服务商');
        return;
      }
      delete store.data.providers[target];
    }

    await store.writeSoon();
    await ctx.reply('✅ 已删除');
    return;
  }

  if (sub === 'list') {
    const list = Object.entries(store.data.providers)
      .map(([n, v]) => {
        const display = shortenUrlForDisplay(v.baseUrl);
        return `• <b>${html(n)}</b> - key:${v.apiKey ? '✅' : '❌'} base:<a href="${sanitizeUrl(v.baseUrl)}">${html(display)}</a>`;
      })
      .join('\n') || '(空)';

    await ctx.reply(`📦 <b>已配置服务商</b>\n\n${list}`, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    return;
  }

  await ctx.reply('❌ 未知子命令。支持: status, add, update, remove, list');
}
