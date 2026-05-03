import {
  ChatInputCommandInteraction, SlashCommandBuilder,
  PermissionsBitField, EmbedBuilder, ChannelType,
} from "discord.js";
import { getGuildConfig, saveGuildConfig } from "../data/db.js";
import { COLOR, successEmbed, errorEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("⚙️ إعداد نظام تكتات FX9 — يتطلب Administrator")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addSubcommand((s) =>
    s.setName("panel_channel").setDescription("قناة البنل")
     .addChannelOption((o) => o.setName("channel").setDescription("القناة").addChannelTypes(ChannelType.GuildText).setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("ticket_category").setDescription("فئة تكتات الأعضاء")
     .addChannelOption((o) => o.setName("category").setDescription("الفئة").addChannelTypes(ChannelType.GuildCategory).setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("admin_category").setDescription("فئة قنوات الإدارة (الريلاي)")
     .addChannelOption((o) => o.setName("category").setDescription("الفئة").addChannelTypes(ChannelType.GuildCategory).setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName("support_role").setDescription("إضافة رتبة دعم")
     .addRoleOption((o) => o.setName("role").setDescription("الرتبة").setRequired(true))
     .addStringOption((o) => o.setName("action").setDescription("الإجراء").setRequired(false)
       .addChoices({ name: "➕ إضافة (افتراضي)", value: "add" }, { name: "➖ إزالة", value: "remove" }))
  )
  .addSubcommand((s) =>
    s.setName("log_channel").setDescription("قناة السجلات")
     .addChannelOption((o) => o.setName("channel").setDescription("القناة").addChannelTypes(ChannelType.GuildText).setRequired(true))
  )
  .addSubcommand((s) => s.setName("show").setDescription("عرض الإعدادات الحالية"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const config = getGuildConfig(interaction.guildId!);
  const sub    = interaction.options.getSubcommand();

  if (sub === "panel_channel") {
    const ch = interaction.options.getChannel("channel", true);
    config.panelChannelId = ch.id; saveGuildConfig(config);
    await interaction.reply({ embeds: [successEmbed(`قناة البنل: <#${ch.id}>`)], ephemeral: true });

  } else if (sub === "ticket_category") {
    const ch = interaction.options.getChannel("category", true);
    config.ticketCategoryId = ch.id; saveGuildConfig(config);
    await interaction.reply({ embeds: [successEmbed(`فئة تكتات الأعضاء: **${ch.name}**`)], ephemeral: true });

  } else if (sub === "admin_category") {
    const ch = interaction.options.getChannel("category");
    if (!ch) { config.adminCategoryId = undefined; saveGuildConfig(config); await interaction.reply({ embeds: [successEmbed("تم تعطيل نظام القنوات المزدوجة.")], ephemeral: true }); return; }
    config.adminCategoryId = ch.id; saveGuildConfig(config);
    await interaction.reply({ embeds: [successEmbed(`فئة الإدارة: **${ch.name}** — الريلاي مفعّل`)], ephemeral: true });

  } else if (sub === "support_role") {
    const role   = interaction.options.getRole("role", true);
    const action = interaction.options.getString("action") ?? "add";
    if (action === "add") {
      if (config.supportRoleIds.includes(role.id)) { await interaction.reply({ embeds: [errorEmbed(`<@&${role.id}> مضافة بالفعل.`)], ephemeral: true }); return; }
      config.supportRoleIds.push(role.id); saveGuildConfig(config);
      await interaction.reply({ embeds: [successEmbed(`✅ <@&${role.id}> مضافة لفريق الدعم.\n**المجموع: ${config.supportRoleIds.length} رتبة**`)], ephemeral: true });
    } else {
      config.supportRoleIds = config.supportRoleIds.filter((id) => id !== role.id); saveGuildConfig(config);
      await interaction.reply({ embeds: [successEmbed(`✅ تمت إزالة <@&${role.id}>.`)], ephemeral: true });
    }

  } else if (sub === "log_channel") {
    const ch = interaction.options.getChannel("channel", true);
    config.logChannelId = ch.id; saveGuildConfig(config);
    await interaction.reply({ embeds: [successEmbed(`قناة السجلات: <#${ch.id}>`)], ephemeral: true });

  } else if (sub === "show") {
    const rolesText = config.supportRoleIds.length ? config.supportRoleIds.map((id) => `<@&${id}>`).join(", ") : "❌ لا توجد";
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLOR.blue).setTitle("⚙️ إعدادات FX9")
        .addFields(
          { name: "📣 قناة البنل",         value: config.panelChannelId    ? `<#${config.panelChannelId}>`    : "❌", inline: true },
          { name: "📁 فئة الأعضاء",        value: config.ticketCategoryId  ? `<#${config.ticketCategoryId}>`  : "❌", inline: true },
          { name: "🔐 فئة الإدارة",        value: config.adminCategoryId   ? `<#${config.adminCategoryId}>`   : "❌", inline: true },
          { name: "📋 قناة السجلات",       value: config.logChannelId      ? `<#${config.logChannelId}>`      : "❌", inline: true },
          { name: "🔢 عداد التكتات",       value: `${config.ticketCounter ?? 0}`, inline: true },
          { name: `🛡️ رتب الدعم (${config.supportRoleIds.length})`, value: rolesText },
        ).setFooter({ text: "FX9 Support System" }).setTimestamp()],
      ephemeral: true,
    });
  }
}
