import fs from "fs-extra";
import path from "path";
import type { BotData, GuildConfig, TicketData, AdminStats } from "../types/index.js";

const DATA_FILE = path.join(process.cwd(), "data", "fx9_data.json");
const DEFAULT: BotData = { guilds: {}, tickets: {}, adminStats: {} };

export function loadData(): BotData {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.ensureDirSync(path.dirname(DATA_FILE));
      fs.writeJsonSync(DATA_FILE, DEFAULT, { spaces: 2 });
      return structuredClone(DEFAULT);
    }
    const raw = fs.readJsonSync(DATA_FILE) as BotData;
    // Migrate old single supportRoleId to array
    for (const cfg of Object.values(raw.guilds)) {
      if (!cfg.supportRoleIds) {
        cfg.supportRoleIds = (cfg as any).supportRoleId ? [(cfg as any).supportRoleId] : [];
        delete (cfg as any).supportRoleId;
      }
    }
    return raw;
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function saveData(data: BotData): void {
  fs.ensureDirSync(path.dirname(DATA_FILE));
  fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
}

export function getGuildConfig(guildId: string): GuildConfig {
  const data = loadData();
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = { guildId, supportRoleIds: [], ticketCounter: 0 };
    saveData(data);
  }
  if (!data.guilds[guildId].supportRoleIds) data.guilds[guildId].supportRoleIds = [];
  return data.guilds[guildId];
}

export function saveGuildConfig(config: GuildConfig): void {
  const data = loadData();
  data.guilds[config.guildId] = config;
  saveData(data);
}

export function hasSupport(member: { roles: { cache: { has: (id: string) => boolean } }; permissions: { has: (f: bigint) => boolean } }, config: GuildConfig): boolean {
  const MANAGE_CHANNELS = 16n;
  if (member.permissions.has(MANAGE_CHANNELS)) return true;
  return config.supportRoleIds.some((id) => member.roles.cache.has(id));
}

export function getTicket(channelId: string): TicketData | null {
  const data = loadData();
  return (
    Object.values(data.tickets).find((t) => t.channelId === channelId) ??
    null
  );
}

export function getTicketByAdminChannel(channelId: string): TicketData | null {
  const data = loadData();
  return Object.values(data.tickets).find((t) => t.adminChannelId === channelId) ?? null;
}

export function getTicketByUser(guildId: string, userId: string): TicketData | null {
  const data = loadData();
  return (
    Object.values(data.tickets).find(
      (t) => t.guildId === guildId && t.userId === userId && t.status !== "closed"
    ) ?? null
  );
}

export function saveTicket(ticket: TicketData): void {
  const data = loadData();
  data.tickets[ticket.ticketId] = ticket;
  saveData(data);
}

export function getAllOpenTickets(guildId: string): TicketData[] {
  return Object.values(loadData().tickets).filter(
    (t) => t.guildId === guildId && t.status !== "closed"
  );
}

export function getAllTickets(guildId: string): TicketData[] {
  return Object.values(loadData().tickets).filter((t) => t.guildId === guildId);
}

export function getClosedTicketsCount(guildId: string): number {
  return Object.values(loadData().tickets).filter(
    (t) => t.guildId === guildId && t.status === "closed"
  ).length;
}

export function getAdminStats(adminId: string): AdminStats {
  const data = loadData();
  if (!data.adminStats[adminId]) {
    data.adminStats[adminId] = { adminId, username: "", claimed: 0, closed: 0, totalRating: 0, ratingCount: 0 };
    saveData(data);
  }
  return data.adminStats[adminId];
}

export function saveAdminStats(stats: AdminStats): void {
  const data = loadData();
  data.adminStats[stats.adminId] = stats;
  saveData(data);
}

export function getAllAdminStats(): AdminStats[] {
  return Object.values(loadData().adminStats);
}
