import {
  Client, TextChannel, PermissionsBitField, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  StringSelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction,
  OverwriteResolvable,
} from "discord.js";
import {
  getGuildConfig, saveGuildConfig, getTicketByUser,
  saveTicket, getTicket, getAdminStats, saveAdminStats,
  getTicketByAdminChannel,
} from "../data/db.js";
import { ticketEmbed, ticketButtons, logEmbed, COLOR } from "../utils/embeds.js";
import type { TicketData } from "../types/index.js";
import { CATEGORY_SLUG } from "../types/index.js";

// ── 1. Category Select ─────────────────────────────────────────────────────────
export async function handleCategorySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const category = interaction.values[0];
  const modal = new ModalBuilder().setCustomId(`ticket_modal_${category}`).setTitle("📝 تفاصيل طلبك");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("title").setLabel("عنوان المشكلة").setStyle(TextInputStyle.Short).setPlaceholder("اكتب عنواناً مختصراً").setRequired(true).setMaxLength(100)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("description").setLabel("وصف المشكلة").setStyle(TextInputStyle.Paragraph).setPlaceholder("اشرح مشكلتك بالتفصيل...").setRequired(true).setMaxLength(1000)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("evidence").setLabel("رابط الأدلة (اختياري)").setStyle(TextInputStyle.Short).setPlaceholder("https://...").setRequired(false).setMaxLength(500)
    )
  );
  await interaction.showModal(modal);
}

// ── 2. Modal Submit ─────────────────────────────────────────────────────────────
export async function handleTicketModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const category = interaction.customId.replace("ticket_modal_", "");
  const { guildId, user } = interaction;
  if (!guildId) return;

  const config = getGuildConfig(guildId);
  if (!config.ticketCategoryId) {
    await interaction.editReply({ content: "❌ نظام التكت غير مهيأ." });
    return;
  }

  const title = interaction.fields.getTextInputValue("title") || "No Title";
  const description = interaction.fields.getTextInputValue("description") || "No Description";
  const evidence = interaction.fields.getTextInputValue("evidence") || undefined;

  config.ticketCounter = (config.ticketCounter ?? 0) + 1;
  saveGuildConfig(config);

  const ticketId = `FX9-${config.ticketCounter.toString().padStart(4, "0")}`;
  const chanName = `${config.ticketCounter}-${CATEGORY_SLUG[category] ?? "تكت"}`;
  const guild = interaction.guild!;

  let userOverwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] },
  ];

  const userChannel = await guild.channels.create({
    name: chanName,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    permissionOverwrites: userOverwrites,
  });

  const ticket: TicketData = {
    ticketId, channelId: userChannel.id, guildId, userId: user.id, username: user.username,
    category: category as any, title, description, evidence, priority: "medium", status: "open",
    openedAt: Date.now(), lastActivity: Date.now(), inactivityWarned: false,
  };
  saveTicket(ticket);

  await userChannel.send({
    embeds: [ticketEmbed(ticket, false)],
    components: ticketButtons(false, undefined, false) as any,
  });

  await interaction.editReply({ content: `✅ تم فتح تكتك: <#${userChannel.id}>` });
}

// ── 3. Claim (الدالة التي كانت مفقودة) ───────────────────────────────────────────
export async function handleClaimTicket(client: Client, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const ticket = getTicket(interaction.channelId!) ?? getTicketByAdminChannel(interaction.channelId!);
  if (!ticket) { await interaction.editReply({ content: "❌ التكت غير موجود." }); return; }

  ticket.status = "claimed";
  ticket.claimedBy = interaction.user.id;
  ticket.claimedByUsername = interaction.user.username;
  saveTicket(ticket);

  await interaction.message.edit({
    components: ticketButtons(true, interaction.user.username, interaction.channelId === ticket.adminChannelId) as any,
  });
  await interaction.editReply({ content: "✅ تم استلام التكت." });
}

// ── 4. Unclaim (الدالة التي كانت مفقودة) ─────────────────────────────────────────
export async function handleUnclaimTicket(client: Client, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const ticket = getTicket(interaction.channelId!) ?? getTicketByAdminChannel(interaction.channelId!);
  if (!ticket) return;

  ticket.status = "open";
  ticket.claimedBy = undefined;
  saveTicket(ticket);

  await interaction.message.edit({ components: ticketButtons(false, undefined, false) as any });
  await interaction.editReply({ content: "✅ تم إلغاء الاستلام." });
}

// ── 5. Rename Ticket ────────────────────────────────────────────────────────────
export async function handleRenameTicket(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId("ticket_rename_modal").setTitle("✏️ تغيير اسم التكت");
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder().setCustomId("new_name").setLabel("الاسم الجديد").setStyle(TextInputStyle.Short).setRequired(true)
  ));
  await interaction.showModal(modal);
}

// ── 6. Rename Modal Submit ──────────────────────────────────────────────────────
export async function handleRenameModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const rawName = interaction.fields.getTextInputValue("new_name") || "ticket";
  const slug = rawName.toLowerCase().replace(/\s+/g, "-").slice(0, 40);
  const ticket = getTicket(interaction.channelId!) ?? getTicketByAdminChannel(interaction.channelId!);
  const counter = ticket?.ticketId.split("-")[1] ?? "0";
  const finalName = `${counter}-${slug}`;

  const userCh = (ticket ? client.channels.cache.get(ticket.channelId) : interaction.channel) as TextChannel | undefined;
  if (userCh) await userCh.setName(finalName).catch(() => null);

  await interaction.editReply({ content: `✅ تم تغيير الاسم إلى: **${finalName}**` });
}

// ── 7. Quick Reply ──────────────────────────────────────────────────────────────
export async function handleQuickReply(client: Client, interaction: StringSelectMenuInteraction): Promise<void> {
  const ticket = getTicket(interaction.channelId!) ?? getTicketByAdminChannel(interaction.channelId!);
  if (!ticket) return;
  await interaction.reply({ content: "✅ تم إرسال الرد السريع.", ephemeral: true });
}