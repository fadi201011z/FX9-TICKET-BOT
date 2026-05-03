export interface GuildConfig {
  guildId: string;
  panelChannelId?: string;
  ticketCategoryId?: string;
  adminCategoryId?: string;
  supportRoleIds: string[];
  logChannelId?: string;
  ticketCounter: number;
}

export interface TicketData {
  ticketId: string;
  channelId: string;
  adminChannelId?: string;
  guildId: string;
  userId: string;
  username: string;
  category: TicketCategory;
  title: string;
  description: string;
  evidence?: string;
  priority: "high" | "medium" | "low";
  status: "open" | "claimed" | "closed";
  claimedBy?: string;
  claimedByUsername?: string;
  openedAt: number;
  closedAt?: number;
  lastActivity: number;
  inactivityWarned: boolean;
  rating?: number;
  ratedBy?: string;
}

export interface AdminStats {
  adminId: string;
  username: string;
  claimed: number;
  closed: number;
  totalRating: number;
  ratingCount: number;
}

export interface BotData {
  guilds: Record<string, GuildConfig>;
  tickets: Record<string, TicketData>;
  adminStats: Record<string, AdminStats>;
}

export type TicketCategory = "technical" | "complaint" | "partnership" | "other";

export const CATEGORY_LABEL: Record<string, string> = {
  technical: "🛠️ دعم فني",
  complaint: "🚫 شكاوى",
  partnership: "🤝 شراكات",
  other: "❓ أخرى",
};

export const CATEGORY_SLUG: Record<string, string> = {
  technical: "دعم-فني",
  complaint: "شكاوى",
  partnership: "شراكات",
  other: "أخرى",
};

export const PRIORITY_LABEL: Record<string, string> = {
  high: "🔴 عالية",
  medium: "🟡 متوسطة",
  low: "🟢 منخفضة",
};

export const CATEGORY_EMOJI: Record<string, string> = {
  technical: "🛠️",
  complaint: "🚫",
  partnership: "🤝",
  other: "❓",
};
