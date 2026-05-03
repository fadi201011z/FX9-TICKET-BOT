import { Client, TextChannel } from "discord.js";
import type { TicketData } from "../types/index.js";
import { getAllOpenTickets, getTicket, saveTicket, getGuildConfig } from "../data/db.js";
import { logEmbed, inactivityEmbed, ratingEmbed, ratingButtons, COLOR } from "../utils/embeds.js";

const WARN_MS  = 24 * 60 * 60 * 1000;
const CLOSE_MS = 36 * 60 * 60 * 1000;

export function startInactivityMonitor(client: Client): void {
  setInterval(() => checkAll(client), 30 * 60 * 1000);
  console.log("  ⏰  مراقب الخمول يعمل (فحص كل 30 دقيقة)");
}

export function updateTicketActivity(channelId: string): void {
  const t = getTicket(channelId);
  if (t && t.status !== "closed") {
    t.lastActivity     = Date.now();
    t.inactivityWarned = false;
    saveTicket(t);
  }
}

async function checkAll(client: Client): Promise<void> {
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    for (const ticket of getAllOpenTickets(guild.id)) {
      const elapsed = now - ticket.lastActivity;
      if      (elapsed >= CLOSE_MS)                            await autoClose(client, ticket);
      else if (elapsed >= WARN_MS && !ticket.inactivityWarned) await warn(client, ticket);
    }
  }
}

async function warn(client: Client, ticket: TicketData): Promise<void> {
  try {
    const ch = client.channels.cache.get(ticket.channelId) as TextChannel | undefined;
    if (!ch) return;
    ticket.inactivityWarned = true;
    saveTicket(ticket);
    await ch.send({ content: `<@${ticket.userId}>`, embeds: [inactivityEmbed(ticket.ticketId)] });

    // أرسل في قناة الإدارة أيضاً
    if (ticket.adminChannelId) {
      const adminCh = client.channels.cache.get(ticket.adminChannelId) as TextChannel | undefined;
      await adminCh?.send({ embeds: [inactivityEmbed(ticket.ticketId)] });
    }
  } catch {}
}

async function autoClose(client: Client, ticket: TicketData): Promise<void> {
  try {
    ticket.status   = "closed";
    ticket.closedAt = Date.now();
    saveTicket(ticket);

    const config = getGuildConfig(ticket.guildId);
    const embed  = logEmbed("🔒 إغلاق تلقائي (خمول)", COLOR.red, [
      { name: "رقم التكت", value: ticket.ticketId, inline: true },
      { name: "العضو",     value: `<@${ticket.userId}>`, inline: true },
      { name: "السبب",     value: "خمول لمدة 36 ساعة" },
    ]);

    const ratingData = {
      embeds:     [ratingEmbed(ticket.ticketId, ticket.claimedByUsername)],
      components: [ratingButtons(ticket.ticketId)],
    };

    // محاولة إرسال التقييم بـ DM
    let ratingInChannel = false;
    try {
      const user = await client.users.fetch(ticket.userId);
      await user.send(ratingData);
    } catch {
      ratingInChannel = true;
    }

    // قناة العضو
    const userCh = client.channels.cache.get(ticket.channelId) as TextChannel | undefined;
    if (userCh) {
      await userCh.send({ embeds: [embed] });
      if (ratingInChannel) {
        await userCh.send({
          content: `<@${ticket.userId}> ⭐ **قيّم تجربتك قبل إغلاق هذه القناة** — ستُحذف بعد 30 ثانية:`,
          ...ratingData,
        });
      }
    }

    // قناة الإدارة
    if (ticket.adminChannelId) {
      const adminCh = client.channels.cache.get(ticket.adminChannelId) as TextChannel | undefined;
      await adminCh?.send({ embeds: [embed] });
    }

    // لوق
    if (config.logChannelId) {
      const logCh = (await client.channels.fetch(config.logChannelId).catch(() => null)) as TextChannel | null;
      await logCh?.send({ embeds: [embed] });
    }

    // حذف القناتين
    const delay = ratingInChannel ? 30_000 : 8_000;
    setTimeout(async () => {
      await userCh?.delete().catch(() => null);
      if (ticket.adminChannelId) {
        const adminCh = client.channels.cache.get(ticket.adminChannelId) as TextChannel | undefined;
        await adminCh?.delete().catch(() => null);
      }
    }, delay);
  } catch (err) {
    console.error("[Inactivity AutoClose]", err);
  }
}
