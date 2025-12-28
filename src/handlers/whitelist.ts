import { Context } from 'grammy';
import { store } from '../storage/store.js';
import { html, stripCommand } from '../utils/text.js';
import { isAdmin } from '../middlewares/auth.js';

export async function handleWhitelist(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('❌ 仅管理员可使用此命令');
    return;
  }

  const text = stripCommand(ctx.message?.text, 'whitelist');
  const args = text.split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();

  const wl = store.data.whitelist;

  if (sub === 'status' || !sub) {
    const txt = `👥 <b>白名单状态</b>

<b>模式:</b> ${wl.mode === 'allow' ? '白名单 (仅允许)' : '黑名单 (仅拒绝)'}
<b>管理员:</b> ${wl.admins.length} 人
<b>允许列表:</b> ${wl.allowed.length} 人
<b>拒绝列表:</b> ${wl.denied.length} 人

<b>管理员 ID:</b>
${wl.admins.map((id) => `• ${id}`).join('\n') || '(空)'}`;

    await ctx.reply(txt, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'mode') {
    const mode = args[1]?.toLowerCase();
    if (mode !== 'allow' && mode !== 'deny') {
      await ctx.reply('❌ 用法: /whitelist mode <allow|deny>');
      return;
    }

    wl.mode = mode;
    await store.writeSoon();
    await ctx.reply(`✅ 已设置为 ${mode === 'allow' ? '白名单' : '黑名单'} 模式`);
    return;
  }

  if (sub === 'allow') {
    const targetId = parseInt(args[1], 10);
    if (isNaN(targetId)) {
      await ctx.reply('❌ 请输入用户 ID');
      return;
    }

    if (!wl.allowed.includes(targetId)) {
      wl.allowed.push(targetId);
    }
    const idx = wl.denied.indexOf(targetId);
    if (idx >= 0) wl.denied.splice(idx, 1);

    await store.writeSoon();
    await ctx.reply(`✅ 已添加用户 ${targetId} 到允许列表`);
    return;
  }

  if (sub === 'deny') {
    const targetId = parseInt(args[1], 10);
    if (isNaN(targetId)) {
      await ctx.reply('❌ 请输入用户 ID');
      return;
    }

    if (!wl.denied.includes(targetId)) {
      wl.denied.push(targetId);
    }
    const idx = wl.allowed.indexOf(targetId);
    if (idx >= 0) wl.allowed.splice(idx, 1);

    await store.writeSoon();
    await ctx.reply(`✅ 已添加用户 ${targetId} 到拒绝列表`);
    return;
  }

  if (sub === 'remove') {
    const targetId = parseInt(args[1], 10);
    if (isNaN(targetId)) {
      await ctx.reply('❌ 请输入用户 ID');
      return;
    }

    const allowIdx = wl.allowed.indexOf(targetId);
    if (allowIdx >= 0) wl.allowed.splice(allowIdx, 1);
    const denyIdx = wl.denied.indexOf(targetId);
    if (denyIdx >= 0) wl.denied.splice(denyIdx, 1);

    await store.writeSoon();
    await ctx.reply(`✅ 已移除用户 ${targetId}`);
    return;
  }

  if (sub === 'admin') {
    const action = args[1]?.toLowerCase();
    const targetId = parseInt(args[2], 10);

    if (!['add', 'remove'].includes(action) || isNaN(targetId)) {
      await ctx.reply('❌ 用法: /whitelist admin <add|remove> <用户ID>');
      return;
    }

    if (action === 'add') {
      if (!wl.admins.includes(targetId)) {
        wl.admins.push(targetId);
      }
    } else {
      const idx = wl.admins.indexOf(targetId);
      if (idx >= 0) wl.admins.splice(idx, 1);
    }

    await store.writeSoon();
    await ctx.reply(`✅ 管理员 ${action === 'add' ? '添加' : '移除'}: ${targetId}`);
    return;
  }

  if (sub === 'list') {
    const type = args[1]?.toLowerCase() || 'all';
    let list: string[] = [];

    if (type === 'allowed' || type === 'all') {
      list.push(`<b>允许列表:</b>\n${wl.allowed.map((id) => `• ${id}`).join('\n') || '(空)'}`);
    }
    if (type === 'denied' || type === 'all') {
      list.push(`<b>拒绝列表:</b>\n${wl.denied.map((id) => `• ${id}`).join('\n') || '(空)'}`);
    }

    await ctx.reply(list.join('\n\n'), { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply('❌ 未知子命令。支持: status, mode, allow, deny, remove, admin, list');
}
