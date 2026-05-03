import { Client, Message, TextChannel } from "discord.js";
import { updateTicketActivity } from "../handlers/inactivityHandler.js";
import { getTicket, getTicketByAdminChannel, getGuildConfig } from "../data/db.js";

// ── تنسيق الرسالة كنص احترافي ────────────────────────────────────────────────
function formatUserRelay(msg: Message): string {
  const parts: string[] = [];
  parts.push(`📩 **${msg.author.username}:** ${msg.content || ""}`);
  if (msg.attachments.size > 0) {
    for (const att of msg.attachments.values()) {
      parts.push(att.url);
    }
  }
  return parts.join("\n");
}

async function formatAdminRelay(msg: Message, guildId: string, client: Client): Promise<string> {
  const parts: string[] = [];

  // جلب رتب الإداري
  let roleDisplay = "";
  try {
    const guild  = client.guilds.cache.get(guildId);
    const member = guild ? await guild.members.fetch(msg.author.id) : null;
    if (member) {
      const config  = getGuildConfig(guildId);
      const support = config.supportRoleIds
        .filter((id) => member.roles.cache.has(id))
        .map((id) => member.roles.cache.get(id)?.name)
        .filter(Boolean);
      roleDisplay = support.length > 0 ? `[${support[0]}] ` : "[دعم] ";
    }
  } catch {}

  parts.push(`📨 **${roleDisplay}${msg.author.username}:** ${msg.content || ""}`);
  if (msg.attachments.size > 0) {
    for (const att of msg.attachments.values()) {
      parts.push(att.url);
    }
  }
  return parts.join("\n");
}

// ── المعالج الرئيسي ────────────────────────────────────────────────────────
export async function handleMessage(client: Client, message: Message): Promise<void> {
  if (message.author.bot || !message.guildId) return;
  if (!message.content && message.attachments.size === 0) return;

  const guildId = message.guildId;

  // ── رسالة من قناة العضو → أرسلها لقناة الإدارة ──────────────────────────
  const userTicket = getTicket(message.channelId);
  if (userTicket && userTicket.status !== "closed" && userTicket.adminChannelId) {
    updateTicketActivity(message.channelId);
    try {
      const adminCh = (await client.channels.fetch(userTicket.adminChannelId).catch(() => null)) as TextChannel | null;
      if (adminCh) {
        await adminCh.send(formatUserRelay(message));
      }
    } catch {}
    return;
  }

  // ── رسالة من قناة الإدارة → أرسلها لقناة العضو ──────────────────────────
  const adminTicket = getTicketByAdminChannel(message.channelId);
  if (adminTicket && adminTicket.status !== "closed") {
    // تحقق أن المرسل من فريق الدعم
    const config = getGuildConfig(guildId);
    try {
      const guild  = client.guilds.cache.get(guildId);
      const member = guild ? await guild.members.fetch(message.author.id).catch(() => null) : null;
      if (!member) return;

      const isSupport =
        member.permissions.has(8n) ||   // ADMINISTRATOR
        member.permissions.has(16n) ||  // MANAGE_CHANNELS
        config.supportRoleIds.some((id) => member.roles.cache.has(id));

      if (!isSupport) return;

      const userCh = (await client.channels.fetch(adminTicket.channelId).catch(() => null)) as TextChannel | null;
      if (userCh) {
        const text = await formatAdminRelay(message, guildId, client);
        await userCh.send(text);
        updateTicketActivity(adminTicket.channelId);
        // لا نحذف رسالة الإداري — تبقى في قناته للمرجعية
      }
    } catch {}
    return;
  }

  // ── تكت بقناة واحدة فقط ─────────────────────────────────────────────────
  if (userTicket && userTicket.status !== "closed") {
    updateTicketActivity(message.channelId);
  }
}
