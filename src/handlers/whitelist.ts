import { Context } from 'grammy';
import { db } from '../storage/sqlite.js';
import { stripCommand } from '../utils/text.js';

export async function handleWhitelist(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !db.isAdmin(userId)) {
    await ctx.reply('❌ 仅管理员可使用此命令');
    return;
  }

  const text = stripCommand(ctx.message?.text, 'whitelist');
  const args = text.split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'status' || !sub) {
    const mode = db.getWhitelistMode();
    const admins = db.getWhitelistAdmins();
    const allowed = db.getWhitelistAllowed();
    const denied = db.getWhitelistDenied();

    const txt = `👥 <b>白名单状态</b>

<b>模式:</b> ${mode === 'allow' ? '白名单 (仅允许)' : '黑名单 (仅拒绝)'}
<b>管理员:</b> ${admins.length} 人
<b>允许列表:</b> ${allowed.length} 人
<b>拒绝列表:</b> ${denied.length} 人

<b>管理员 ID:</b>
${admins.map(id => `• ${id}`).join('\n') || '(空)'}`;

    await ctx.reply(txt, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'mode') {
    const mode = args[1]?.toLowerCase();
    if (mode !== 'allow' && mode !== 'deny') {
      await ctx.reply('❌ 用法: /whitelist mode <allow|deny>');
      return;
    }

    db.setWhitelistMode(mode);
    await ctx.reply(`✅ 已设置为 ${mode === 'allow' ? '白名单' : '黑名单'} 模式`);
    return;
  }

  if (sub === 'allow') {
    const targetId = parseInt(args[1], 10);
    if (isNaN(targetId)) {
      await ctx.reply('❌ 请输入用户 ID');
      return;
    }

    db.addToWhitelist(targetId, 'allowed');
    await ctx.reply(`✅ 已添加用户 ${targetId} 到允许列表`);
    return;
  }

  if (sub === 'deny') {
    const targetId = parseInt(args[1], 10);
    if (isNaN(targetId)) {
      await ctx.reply('❌ 请输入用户 ID');
      return;
    }

    db.addToWhitelist(targetId, 'denied');
    await ctx.reply(`✅ 已添加用户 ${targetId} 到拒绝列表`);
    return;
  }

  if (sub === 'remove') {
    const targetId = parseInt(args[1], 10);
    if (isNaN(targetId)) {
      await ctx.reply('❌ 请输入用户 ID');
      return;
    }

    db.removeFromWhitelist(targetId);
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
      db.addToWhitelist(targetId, 'admin');
    } else {
      db.removeFromWhitelist(targetId);
    }

    await ctx.reply(`✅ 管理员 ${action === 'add' ? '添加' : '移除'}: ${targetId}`);
    return;
  }

  if (sub === 'list') {
    const type = args[1]?.toLowerCase() || 'all';
    const list: string[] = [];

    if (type === 'allowed' || type === 'all') {
      const allowed = db.getWhitelistAllowed();
      list.push(`<b>允许列表:</b>\n${allowed.map(id => `• ${id}`).join('\n') || '(空)'}`);
    }
    if (type === 'denied' || type === 'all') {
      const denied = db.getWhitelistDenied();
      list.push(`<b>拒绝列表:</b>\n${denied.map(id => `• ${id}`).join('\n') || '(空)'}`);
    }

    await ctx.reply(list.join('\n\n'), { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply('❌ 未知子命令。支持: status, mode, allow, deny, remove, admin, list');
}
