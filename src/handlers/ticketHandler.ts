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

// ── Category Select ─────────────────────────────────────────────────────────
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

// ── Modal Submit (إصلاح أخطاء الـ Lambda و null) ─────────────────────────────
export async function handleTicketModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const category = interaction.customId.replace("ticket_modal_", "");
  const { guildId, user } = interaction;
  if (!guildId) return;

  const existing = getTicketByUser(guildId, user.id);
  if (existing) {
    await interaction.editReply({ content: `❌ لديك تكت مفتوح بالفعل: <#${existing.channelId}>` });
    return;
  }

  const config = getGuildConfig(guildId);
  if (!config.ticketCategoryId) {
    await interaction.editReply({ content: "❌ لم يُعدّ النظام بعد." });
    return;
  }

  // استخدام الاندماج لضمان وجود نصوص دائماً
  const title       = interaction.fields.getTextInputValue("title") || "No Title";
  const description = interaction.fields.getTextInputValue("description") || "No Description";
  const evidence    = interaction.fields.getTextInputValue("evidence") || undefined;

  config.ticketCounter = (config.ticketCounter ?? 0) + 1;
  saveGuildConfig(config);

  const ticketId  = `FX9-${config.ticketCounter.toString().padStart(4, "0")}`;
  const chanName  = `${config.ticketCounter}-${CATEGORY_SLUG[category] ?? "تكت"}`;
  const guild     = interaction.guild!;

  // تصحيح الصلاحيات: تجنب استخدام push واستخدام مصفوفة جديدة
  let userOverwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] },
  ];

  config.supportRoleIds.forEach(roleId => {
    userOverwrites = [...userOverwrites, { id: roleId, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }];
  });

  const userChannel = await guild.channels.create({
    name: chanName,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    permissionOverwrites: userOverwrites,
  });

  let adminChannel: TextChannel | null = null;
  if (config.adminCategoryId) {
    let adminOverwrites: OverwriteResolvable[] = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] },
    ];
    config.supportRoleIds.forEach(roleId => {
      adminOverwrites = [...adminOverwrites, { id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }];
    });
    
    adminChannel = await guild.channels.create({
      name: `admin-${chanName}`,
      type: ChannelType.GuildText,
      parent: config.adminCategoryId,
      permissionOverwrites: adminOverwrites,
    });
  }

  const ticket: TicketData = {
    ticketId, channelId: userChannel.id, adminChannelId: adminChannel?.id,
    guildId, userId: user.id, username: user.username, category: category as any,
    title, description, evidence, priority: "medium", status: "open",
    openedAt: Date.now(), lastActivity: Date.now(), inactivityWarned: false,
  };
  saveTicket(ticket);

  await userChannel.send({
    content: `<@${user.id}>`,
    embeds: [ticketEmbed(ticket, false)],
    components: ticketButtons(false, undefined, false) as any,
  });

  await interaction.editReply({ content: `✅ تم فتح تكتك: <#${userChannel.id}>` });
}

// ── Rename (حل نهائي لمشكلة string | null) ────────────────────────────────────
export async function handleRenameModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const rawName = interaction.fields.getTextInputValue("new_name") || "ticket";
  const slug = rawName.toLowerCase().replace(/\s+/g, "-").slice(0, 40);

 const ticket = getTicket(interaction.channelId!) ?? getTicketByAdminChannel(interaction.channelId!);
  const counter = ticket?.ticketId.split("-")[1] ?? "0";

  // ضمان أن الاسم دائماً string وليس null
  const finalName: string = `${counter}-${slug}`;
  const adminName: string = `admin-${finalName}`;

  const userCh = (ticket ? client.channels.cache.get(ticket.channelId) : interaction.channel) as TextChannel | undefined;
  if (userCh) await userCh.setName(finalName).catch(() => null);

  if (ticket?.adminChannelId) {
    const adminCh = client.channels.cache.get(ticket.adminChannelId) as TextChannel | undefined;
    if (adminCh) await adminCh.setName(adminName).catch(() => null);
  }

  await interaction.editReply({ content: `✅ تم تغيير الاسم إلى: **${finalName}**` });
}