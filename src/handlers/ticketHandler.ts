import {
  Client, TextChannel, PermissionsBitField, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  StringSelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction,
} from "discord.js";
import {
  getGuildConfig, saveGuildConfig, getTicketByUser,
  saveTicket, getTicket, getAdminStats, saveAdminStats,
  getTicketByAdminChannel,
} from "../data/db.js";
import { ticketEmbed, ticketButtons, logEmbed, COLOR } from "../utils/embeds.js";
import type { TicketData } from "../types/index.js";
import { CATEGORY_SLUG } from "../types/index.js";

// ── Category Select → open Modal ─────────────────────────────────────────────
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

// ── Modal Submit → create ticket channels ─────────────────────────────────────
export async function handleTicketModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const category = interaction.customId.replace("ticket_modal_", "");
  const { guildId, user } = interaction;
  if (!guildId) return;

  const existing = getTicketByUser(guildId, user.id);
  if (existing) {
    await interaction.editReply({ content: `❌ لديك تكت مفتوح بالفعل: <#${existing.channelId}>\nأغلقه أولاً قبل فتح تكت جديد.` });
    return;
  }

  const config = getGuildConfig(guildId);
  if (!config.ticketCategoryId) {
    await interaction.editReply({ content: "❌ لم يُعدّ النظام بعد. تواصل مع الإدارة لإعداد `/configt ticket_category`." });
    return;
  }

  const title       = interaction.fields.getTextInputValue("title");
  const description = interaction.fields.getTextInputValue("description");
  const evidence    = interaction.fields.getTextInputValue("evidence") || undefined;

  config.ticketCounter = (config.ticketCounter ?? 0) + 1;
  saveGuildConfig(config);

  const ticketId  = `FX9-${config.ticketCounter.toString().padStart(4, "0")}`;
  // اسم القناة: رقم-القسم  (الرقم يبقى دائماً)
  const chanName  = `${config.ticketCounter}-${CATEGORY_SLUG[category] ?? "تكت"}`;
  const guild     = interaction.guild!;

  // ── صلاحيات قناة العضو ────────────────────────────────────────────────────
  const userOverwrites: Parameters<typeof guild.channels.create>[0]["permissionOverwrites"] = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] },
    { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages] },
  ];
  // رتب الدعم ترى قناة العضو للاطلاع فقط (الريلاي يكفي)
  for (const roleId of config.supportRoleIds) {
    userOverwrites.push({
      id: roleId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
      deny: [PermissionsBitField.Flags.SendMessages],
    });
  }

  // ── إنشاء قناة العضو ──────────────────────────────────────────────────────
  const userChannel = await guild.channels.create({
    name: chanName,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    permissionOverwrites: userOverwrites,
    topic: `${ticketId} | ${title} | <@${user.id}>`,
  });

  // ── قناة الإدارة ──────────────────────────────────────────────────────────
  let adminChannel: TextChannel | null = null;
  if (config.adminCategoryId) {
    const adminOverwrites: Parameters<typeof guild.channels.create>[0]["permissionOverwrites"] = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages] },
    ];
    for (const roleId of config.supportRoleIds) {
      adminOverwrites.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] });
    }
    adminChannel = await guild.channels.create({
      name: `admin-${chanName}`,
      type: ChannelType.GuildText,
      parent: config.adminCategoryId,
      permissionOverwrites: adminOverwrites,
      topic: `[ADMIN] ${ticketId} | ${title} | العضو: ${user.username}`,
    });
  }

  const ticket: TicketData = {
    ticketId,
    channelId: userChannel.id,
    adminChannelId: adminChannel?.id,
    guildId,
    userId: user.id,
    username: user.username,
    category: category as TicketData["category"],
    title,
    description,
    evidence,
    priority: "medium",
    status: "open",
    openedAt: Date.now(),
    lastActivity: Date.now(),
    inactivityWarned: false,
  };
  saveTicket(ticket);

  // ── إرسال في قناة العضو (بدون Quick Reply) ────────────────────────────────
  const supportMentions = config.supportRoleIds.map((id) => `<@&${id}>`).join(" ");
  const userMsg = await userChannel.send({
    content: `<@${user.id}>${supportMentions ? " | " + supportMentions : ""}`,
    embeds: [ticketEmbed(ticket, false)],
    components: ticketButtons(false, undefined, false) as any,
  });
  await userMsg.pin().catch(() => null);

  // ── إرسال في قناة الإدارة (مع Quick Reply) ───────────────────────────────
  if (adminChannel) {
    const adminMsg = await adminChannel.send({
      content: supportMentions || undefined,
      embeds: [ticketEmbed(ticket, true)],
      components: ticketButtons(false, undefined, true) as any,
    });
    await adminMsg.pin().catch(() => null);

    await adminChannel.send({
      content: [
        "## 📡 نظام الريلاي التلقائي",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "✅ **اكتب ردك هنا** وسيصل للعضو فوراً كرسالة منك.",
        "✅ **رسائل العضو** تصلك هنا تلقائياً.",
        `✅ قناة العضو: <#${userChannel.id}>`,
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ].join("\n"),
    });
  }

  await interaction.editReply({
    content: [
      `✅ **تم فتح تكتك:** <#${userChannel.id}>`,
      adminChannel ? `🔐 **قناة الإدارة:** <#${adminChannel.id}>` : "",
    ].filter(Boolean).join("\n"),
  });

  // ── لوق ──────────────────────────────────────────────────────────────────
  if (config.logChannelId) {
    const logCh = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    await logCh?.send({
      embeds: [logEmbed("🟢 تكت جديد مفتوح", COLOR.green, [
        { name: "رقم التكت",    value: ticketId, inline: true },
        { name: "العضو",         value: `<@${user.id}> \`${user.username}\``, inline: true },
        { name: "القسم",         value: CATEGORY_SLUG[category] ?? category, inline: true },
        { name: "قناة العضو",   value: `<#${userChannel.id}>`, inline: true },
        { name: "قناة الإدارة", value: adminChannel ? `<#${adminChannel.id}>` : "معطّل", inline: true },
        { name: "العنوان",       value: title },
      ])],
    });
  }
}

// ── Claim ─────────────────────────────────────────────────────────────────────
export async function handleClaimTicket(client: Client, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const config = getGuildConfig(interaction.guildId!);
  const member = await interaction.guild!.members.fetch(interaction.user.id);
  const ok = config.supportRoleIds.some((id) => member.roles.cache.has(id)) || member.permissions.has(PermissionsBitField.Flags.ManageChannels);

  if (!ok) { await interaction.editReply({ content: "❌ لا تملك رتبة الدعم لاستلام هذا التكت." }); return; }

  const ticket = getTicket(interaction.channelId) ?? getTicketByAdminChannel(interaction.channelId);
  if (!ticket) { await interaction.editReply({ content: "❌ التكت غير موجود." }); return; }
  if (ticket.status === "claimed") { await interaction.editReply({ content: `❌ مستلم بالفعل من <@${ticket.claimedBy}>.` }); return; }

  ticket.status            = "claimed";
  ticket.claimedBy         = interaction.user.id;
  ticket.claimedByUsername = interaction.user.username;
  ticket.lastActivity      = Date.now();
  saveTicket(ticket);

  const stats = getAdminStats(interaction.user.id);
  stats.username = interaction.user.username;
  stats.claimed  = (stats.claimed ?? 0) + 1;
  saveAdminStats(stats);

  // تحديث الأزرار: قناة العضو بدون QR، قناة الإدارة مع QR
  const isAdminChannel = interaction.channelId === ticket.adminChannelId;
  await interaction.message.edit({
    components: ticketButtons(true, interaction.user.username, isAdminChannel) as any,
  });

  // تحديث الرسالة في القناة الأخرى أيضاً
  const otherChId = isAdminChannel ? ticket.channelId : ticket.adminChannelId;
  if (otherChId) {
    const otherCh = client.channels.cache.get(otherChId) as TextChannel | undefined;
    if (otherCh) {
      const msgs = await otherCh.messages.fetch({ limit: 10 });
      const pinned = msgs.find((m) => m.pinned && m.author.id === client.user!.id);
      if (pinned) {
        await pinned.edit({ components: ticketButtons(true, interaction.user.username, !isAdminChannel) as any }).catch(() => null);
      }
    }
  }

  const logE = logEmbed("📩 تم Claim", COLOR.blue, [
    { name: "الإداري", value: `<@${interaction.user.id}>`, inline: true },
    { name: "التكت",   value: ticket.ticketId, inline: true },
  ]);

  for (const chId of [ticket.channelId, ticket.adminChannelId].filter(Boolean) as string[]) {
    const ch = client.channels.cache.get(chId) as TextChannel | undefined;
    await ch?.send({ embeds: [logE] });
  }

  await interaction.editReply({ content: "✅ تم استلام التكت." });

  if (config.logChannelId) {
    const logCh = (await client.channels.fetch(config.logChannelId).catch(() => null)) as TextChannel | null;
    await logCh?.send({ embeds: [logEmbed("📩 Claim", COLOR.blue, [
      { name: "رقم التكت", value: ticket.ticketId, inline: true },
      { name: "الإداري",   value: `<@${interaction.user.id}>`, inline: true },
      { name: "العضو",     value: `<@${ticket.userId}>`, inline: true },
    ])] });
  }
}

// ── Unclaim ───────────────────────────────────────────────────────────────────
export async function handleUnclaimTicket(client: Client, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const ticket = getTicket(interaction.channelId) ?? getTicketByAdminChannel(interaction.channelId);
  if (!ticket) { await interaction.editReply({ content: "❌ التكت غير موجود." }); return; }

  const config = getGuildConfig(interaction.guildId!);
  const member = await interaction.guild!.members.fetch(interaction.user.id);
  const isSupport = config.supportRoleIds.some((id) => member.roles.cache.has(id)) || member.permissions.has(PermissionsBitField.Flags.ManageChannels);

  if (ticket.claimedBy !== interaction.user.id && !isSupport) {
    await interaction.editReply({ content: "❌ لا يمكنك Unclaim هذا التكت." }); return;
  }

  const prev           = ticket.claimedBy;
  ticket.status        = "open";
  ticket.claimedBy     = undefined;
  ticket.claimedByUsername = undefined;
  ticket.lastActivity  = Date.now();
  saveTicket(ticket);

  const isAdminChannel = interaction.channelId === ticket.adminChannelId;
  await interaction.message.edit({ components: ticketButtons(false, undefined, isAdminChannel) as any });

  const otherChId = isAdminChannel ? ticket.channelId : ticket.adminChannelId;
  if (otherChId) {
    const otherCh = client.channels.cache.get(otherChId) as TextChannel | undefined;
    if (otherCh) {
      const msgs = await otherCh.messages.fetch({ limit: 10 });
      const pinned = msgs.find((m) => m.pinned && m.author.id === client.user!.id);
      if (pinned) {
        await pinned.edit({ components: ticketButtons(false, undefined, !isAdminChannel) as any }).catch(() => null);
      }
    }
  }

  const logE = logEmbed("📤 تم Unclaim", COLOR.black, [
    { name: "الإداري السابق", value: prev ? `<@${prev}>` : "—", inline: true },
    { name: "التكت",          value: ticket.ticketId, inline: true },
  ]);
  for (const chId of [ticket.channelId, ticket.adminChannelId].filter(Boolean) as string[]) {
    const ch = client.channels.cache.get(chId) as TextChannel | undefined;
    await ch?.send({ embeds: [logE] });
  }
  await interaction.editReply({ content: "✅ تم إعادة التكت للفريق." });
}

// ── Rename ────────────────────────────────────────────────────────────────────
export async function handleRenameTicket(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId("ticket_rename_modal").setTitle("✏️ تغيير اسم التكت");
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId("new_name")
      .setLabel("الاسم الجديد (الرقم يُضاف تلقائياً)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("مثال: مشكلة-دفع")
      .setRequired(true)
      .setMaxLength(40)
  ));
  await interaction.showModal(modal);
}

export async function handleRenameModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const raw  = interaction.fields.getTextInputValue("new_name");
  const slug = raw.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u0600-\u06ff-]/g, "").slice(0, 40);

  // جلب التكت للحصول على رقمه
  const ticket = getTicket(interaction.channelId) ?? getTicketByAdminChannel(interaction.channelId);
  const counter = ticket ? ticket.ticketId.split("-")[1] ?? "" : "";

  // الاسم النهائي: رقم-الاسم_المخصص
  const finalName  = counter ? `${parseInt(counter, 10)}-${slug}` : slug;
  const adminName  = `admin-${finalName}`;

  // إعادة تسمية القناتين
  const userCh = (ticket ? client.channels.cache.get(ticket.channelId) : interaction.channel) as TextChannel | undefined;
  await userCh?.setName(finalName).catch(() => null);

  if (ticket?.adminChannelId) {
    const adminCh = client.channels.cache.get(ticket.adminChannelId) as TextChannel | undefined;
    await adminCh?.setName(adminName).catch(() => null);
  }

  if (ticket) { ticket.lastActivity = Date.now(); saveTicket(ticket); }
  await interaction.editReply({ content: `✅ تم تغيير الاسم إلى: **${finalName}**` });
}

// ── Quick Reply ───────────────────────────────────────────────────────────────
export async function handleQuickReply(client: Client, interaction: StringSelectMenuInteraction): Promise<void> {
  const config = getGuildConfig(interaction.guildId!);
  const member = await interaction.guild!.members.fetch(interaction.user.id);
  const ok =
    config.supportRoleIds.some((id) => member.roles.cache.has(id)) ||
    member.permissions.has(PermissionsBitField.Flags.ManageChannels);

  if (!ok) {
    await interaction.reply({ content: "❌ الردود السريعة متاحة لفريق الدعم فقط.", ephemeral: true });
    return;
  }

  const MAP: Record<string, string> = {
    reviewing:    "🔍 **نحن نراجع طلبك حالياً.** سنتواصل معك قريباً، يرجى الانتظار.",
    need_evidence:"📸 **يرجى تزويدنا بصور أو أدلة إضافية** لمساعدتنا في حل مشكلتك.",
    resolved:     "✅ **تم حل مشكلتك بنجاح.**\nإذا احتجت أي شيء آخر لا تتردد في التواصل.",
    clarify:      "❓ **يرجى توضيح مشكلتك أكثر** حتى نتمكن من مساعدتك بشكل أفضل.",
    thanks:       "🙏 **شكراً لتواصلك مع فريق FX9!**\nنحن هنا دائماً لخدمتك.",
    transfer:     "🔄 **سيتم تحويل طلبك** إلى الجهة المختصة. يرجى الانتظار.",
    known_issue:  "⚠️ **هذه مشكلة معروفة لدينا** ويعمل فريقنا على حلها حالياً. سنخطرك فور الانتهاء.",
  };

  const reply = MAP[interaction.values[0]];
  if (!reply) { await interaction.reply({ content: "❌ رد غير معروف.", ephemeral: true }); return; }

  const ticket = getTicket(interaction.channelId) ?? getTicketByAdminChannel(interaction.channelId);
  if (ticket) {
    const userCh = (await client.channels.fetch(ticket.channelId).catch(() => null)) as TextChannel | null;
    await userCh?.send({ content: reply });
    ticket.lastActivity = Date.now();
    saveTicket(ticket);
  }

  await interaction.reply({ content: `✅ تم إرسال الرد للعضو.`, ephemeral: true });
}
