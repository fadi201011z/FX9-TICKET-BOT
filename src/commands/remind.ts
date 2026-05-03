import {
  ChatInputCommandInteraction, SlashCommandBuilder,
  PermissionsBitField, EmbedBuilder, TextChannel,
} from "discord.js";
import { getTicket, getTicketByAdminChannel, getGuildConfig } from "../data/db.js";
import { COLOR } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("remind")
  .setDescription("⏰ تذكير العضو بالرد على التكت")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
  .addStringOption((o) =>
    o.setName("message")
     .setDescription("رسالة مخصصة للتذكير (اختياري)")
     .setRequired(false)
     .setMaxLength(300)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  // البحث عن التكت في القناة الحالية أو قناة الإدارة
  const ticket =
    getTicket(interaction.channelId) ??
    getTicketByAdminChannel(interaction.channelId);

  if (!ticket) {
    await interaction.editReply({ content: "❌ هذا الأمر يعمل فقط داخل قناة تكت." });
    return;
  }
  if (ticket.status === "closed") {
    await interaction.editReply({ content: "❌ التكت مغلق." });
    return;
  }

  const config      = getGuildConfig(interaction.guildId!);
  const member      = await interaction.guild!.members.fetch(interaction.user.id);
  const isSupport   =
    member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
    config.supportRoleIds.some((id) => member.roles.cache.has(id));

  if (!isSupport) {
    await interaction.editReply({ content: "❌ هذا الأمر لفريق الدعم فقط." });
    return;
  }

  const custom = interaction.options.getString("message");

  const embed = new EmbedBuilder()
    .setColor(COLOR.orange)
    .setTitle("⏰ تذكير — يرجى الرد")
    .setDescription(
      [
        `<@${ticket.userId}>`,
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        custom
          ? `📣 **رسالة من فريق الدعم:**\n> ${custom}`
          : "📣 **فريق الدعم بانتظار ردك على هذا التكت.**\nيرجى الرد في أقرب وقت ممكن.",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        `> رقم التكت: \`${ticket.ticketId}\``,
        "> إذا لم يكن هناك رد سيُغلق التكت تلقائياً.",
      ].join("\n")
    )
    .setFooter({ text: `بواسطة: ${interaction.user.username} • FX9 Support` })
    .setTimestamp();

  // إرسال في قناة العضو دائماً
  const userCh = interaction.client.channels.cache.get(ticket.channelId) as TextChannel | undefined;
  if (userCh) {
    await userCh.send({ content: `<@${ticket.userId}>`, embeds: [embed] });
  }

  // إرسال في قناة الإدارة إن وُجدت
  if (ticket.adminChannelId) {
    const adminCh = interaction.client.channels.cache.get(ticket.adminChannelId) as TextChannel | undefined;
    await adminCh?.send({ embeds: [embed] });
  }

  await interaction.editReply({ content: `✅ تم إرسال التذكير لـ <@${ticket.userId}>` });
}
