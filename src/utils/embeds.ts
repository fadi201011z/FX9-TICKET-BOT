import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { TicketData } from "../types/index.js";
import { CATEGORY_LABEL } from "../types/index.js";

export const COLOR = {
  blue:   0x1a6fff,
  black:  0x0d0d0d,
  red:    0xe53935,
  white:  0xffffff,
  gold:   0xffd700,
  green:  0x00c853,
  orange: 0xff9800,
  purple: 0x7c4dff,
} as const;

const CATEGORY_COLOR: Record<string, number> = {
  technical:   COLOR.blue,
  complaint:   COLOR.red,
  partnership: COLOR.green,
  other:       COLOR.gold,
};

// ── Panel ─────────────────────────────────────────────────────────────────────

export function panelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR.blue)
    .setTitle("🎫  FX9 Support — نظام التكتات")
    .setDescription(
      [
        "```",
        "  ███████╗██╗  ██╗ █████╗ ",
        "  ██╔════╝╚██╗██╔╝██╔══██╗",
        "  █████╗   ╚███╔╝ ╚██████║",
        "  ██╔══╝   ██╔██╗ ██╔══██║",
        "  ██║     ██╔╝ ██╗╚█████╔╝",
        "  ╚═╝     ╚═╝  ╚═╝ ╚════╝ ",
        "```",
        "",
        "**مرحباً بك في مركز الدعم الرسمي لـ FX9**",
        "",
        "اختر نوع طلبك من القائمة أدناه وسيُفتح لك تكت خاص.",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "🛠️ **دعم فني** — أعطال وأخطاء تقنية",
        "🚫 **شكاوى** — الإبلاغ عن مشكلة",
        "🤝 **شراكات** — عروض التعاون",
        "❓ **أخرى** — استفسارات عامة",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "> 💡 تكت واحد فقط لكل عضو في نفس الوقت.",
        "> ⏱️ تُغلق التكتات الخاملة تلقائياً بعد **36 ساعة**.",
        "> 🔒 محادثتك خاصة ولا يراها إلا فريق الدعم.",
      ].join("\n")
    )
    .setFooter({ text: "FX9 Support System • اضغط أدناه للتواصل معنا" })
    .setTimestamp();
}

export function panelMenu(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("📋 اختر نوع طلبك لفتح تكت...")
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("دعم فني").setDescription("مشاكل تقنية وأعطال").setValue("technical").setEmoji("🛠️"),
        new StringSelectMenuOptionBuilder().setLabel("شكاوى").setDescription("الإبلاغ عن تصرف أو مشكلة").setValue("complaint").setEmoji("🚫"),
        new StringSelectMenuOptionBuilder().setLabel("شراكات").setDescription("عروض تعاون وشراكة").setValue("partnership").setEmoji("🤝"),
        new StringSelectMenuOptionBuilder().setLabel("أخرى").setDescription("استفسارات لا تندرج في الأقسام أعلاه").setValue("other").setEmoji("❓")
      )
  );
}

// ── Ticket ────────────────────────────────────────────────────────────────────

export function ticketEmbed(
  t: Pick<TicketData, "ticketId" | "userId" | "username" | "category" | "title" | "description" | "evidence" | "priority">,
  adminChannel = false
): EmbedBuilder {
  const PRIORITY_LABEL = { high: "🔴 عالية", medium: "🟡 متوسطة", low: "🟢 منخفضة" };

  return new EmbedBuilder()
    .setColor(adminChannel ? COLOR.purple : (CATEGORY_COLOR[t.category] ?? COLOR.blue))
    .setTitle(adminChannel
      ? `🔐 [إداري] ${t.ticketId} — ${CATEGORY_LABEL[t.category] ?? t.category}`
      : `🎫 ${t.ticketId} — ${CATEGORY_LABEL[t.category] ?? t.category}`)
    .setDescription(
      [
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        adminChannel
          ? "**⚠️ هذه القناة للإدارة فقط — اكتب ردك هنا وسيصل للعضو تلقائياً**"
          : "**✅ تم فتح تكتك — فريق الدعم سيتواصل معك قريباً**",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        `**👤 العضو:** <@${t.userId}> \`(${t.username})\``,
        `**📂 القسم:** ${CATEGORY_LABEL[t.category] ?? t.category}`,
        `**🎯 الأولوية:** ${PRIORITY_LABEL[t.priority]}`,
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "**📌 العنوان:**",
        `> ${t.title}`,
        "",
        "**📝 الوصف:**",
        `> ${t.description}`,
        t.evidence ? `\n**🔗 الأدلة:**\n> ${t.evidence}` : "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ].filter(Boolean).join("\n")
    )
    .setFooter({ text: adminChannel ? "FX9 Support System • Admin View" : "FX9 Support System • User View" })
    .setTimestamp();
}

/**
 * @param adminMode - إذا true يُضاف Quick Reply (للقناة الإدارية فقط)
 */
export function ticketButtons(
  claimed: boolean,
  claimedByUsername?: string,
  adminMode = false
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel(claimed ? `✅ ${claimedByUsername ?? "مستلم"}` : "📩 Claim")
      .setStyle(claimed ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(claimed),
    new ButtonBuilder().setCustomId("ticket_unclaim").setLabel("📤 Unclaim").setStyle(ButtonStyle.Secondary).setDisabled(!claimed),
    new ButtonBuilder().setCustomId("ticket_rename").setLabel("✏️ Rename").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒 Close").setStyle(ButtonStyle.Danger)
  );

  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [row1];

  // Quick Reply يظهر فقط في القناة الإدارية أو عند عدم وجود قناة إدارية
  if (adminMode) {
    const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_quickreply")
        .setPlaceholder("📋 Quick Reply — اختر رداً سريعاً...")
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel("قيد المراجعة").setDescription("نراجع طلبك حالياً").setValue("reviewing").setEmoji("🔍"),
          new StringSelectMenuOptionBuilder().setLabel("طلب أدلة").setDescription("طلب صور أو أدلة إضافية").setValue("need_evidence").setEmoji("📸"),
          new StringSelectMenuOptionBuilder().setLabel("تم الحل").setDescription("تم حل المشكلة").setValue("resolved").setEmoji("✅"),
          new StringSelectMenuOptionBuilder().setLabel("يرجى التوضيح").setDescription("نحتاج توضيحاً إضافياً").setValue("clarify").setEmoji("❓"),
          new StringSelectMenuOptionBuilder().setLabel("شكراً للتواصل").setDescription("رسالة ترحيب وشكر").setValue("thanks").setEmoji("🙏"),
          new StringSelectMenuOptionBuilder().setLabel("سيتم التحويل").setDescription("تحويل الطلب لجهة أخرى").setValue("transfer").setEmoji("🔄"),
          new StringSelectMenuOptionBuilder().setLabel("مشكلة معروفة").setDescription("نعمل على حلها حالياً").setValue("known_issue").setEmoji("⚠️")
        )
    );
    rows.push(row2);
  }

  return rows as ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
}

// ── Rating ────────────────────────────────────────────────────────────────────

export function ratingEmbed(ticketId: string, adminUsername?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR.gold)
    .setTitle("⭐  كيف كانت تجربتك مع الدعم؟")
    .setDescription(
      [
        "```",
        "  شكراً لتواصلك مع FX9 Support  ",
        "```",
        adminUsername ? `\nالإداري الذي ساعدك: **${adminUsername}**` : "",
        "",
        "**قيّم تجربتك من ١ إلى ٥ نجوم:**",
        "",
        "> ⭐ — تجربة ضعيفة جداً",
        "> ⭐⭐ — تجربة ضعيفة",
        "> ⭐⭐⭐ — تجربة مقبولة",
        "> ⭐⭐⭐⭐ — تجربة جيدة",
        "> ⭐⭐⭐⭐⭐ — تجربة ممتازة",
        "",
        `> *رقم التكت: \`${ticketId}\`*`,
        "\n> 💙 تقييمك يساعدنا على تحسين جودة الخدمة.",
      ].filter(Boolean).join("\n")
    )
    .setFooter({ text: "FX9 Support System • Feedback" });
}

export function ratingButtons(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`rate_1_${ticketId}`).setLabel("⭐ 1").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`rate_2_${ticketId}`).setLabel("⭐ 2").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`rate_3_${ticketId}`).setLabel("⭐ 3").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rate_4_${ticketId}`).setLabel("⭐ 4").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rate_5_${ticketId}`).setLabel("⭐ 5").setStyle(ButtonStyle.Success)
  );
}

// ── Log / Misc ────────────────────────────────────────────────────────────────

export function logEmbed(
  title: string,
  color: number,
  fields: { name: string; value: string; inline?: boolean }[]
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`📋 ${title}`)
    .addFields(fields)
    .setTimestamp()
    .setFooter({ text: "FX9 Support System • Log" });
}

export function inactivityEmbed(ticketId: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR.orange)
    .setTitle("⚠️ تحذير خمول التكت")
    .setDescription(
      [
        `**رقم التكت: \`${ticketId}\`**`,
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "⏰ لم يتم إرسال أي رسائل منذ **24 ساعة**.",
        "",
        "إذا لم يكن هناك نشاط خلال **12 ساعة إضافية** سيُغلق التكت تلقائياً.",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "> يرجى الرد إذا كنت لا تزال تحتاج للمساعدة.",
      ].join("\n")
    )
    .setFooter({ text: "FX9 Support System • Inactivity Warning" })
    .setTimestamp();
}

export function successEmbed(desc: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COLOR.green).setTitle("✅ تم بنجاح").setDescription(desc).setTimestamp();
}

export function errorEmbed(desc: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COLOR.red).setTitle("❌ خطأ").setDescription(desc).setTimestamp();
}
