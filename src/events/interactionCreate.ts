import {
  Client, Interaction, StringSelectMenuInteraction,
  ButtonInteraction, ModalSubmitInteraction, ChatInputCommandInteraction,
} from "discord.js";
import {
  handleCategorySelect, handleTicketModalSubmit, handleClaimTicket,
  handleUnclaimTicket, handleRenameTicket, handleRenameModalSubmit, handleQuickReply,
} from "../handlers/ticketHandler.js";
import { handleCloseTicket, handleRatingButton } from "../handlers/closeHandler.js";
import { updateTicketActivity } from "../handlers/inactivityHandler.js";

type Cmd = { execute: (i: ChatInputCommandInteraction) => Promise<void> };
const commands = new Map<string, Cmd>();

export async function loadCommands(): Promise<void> {
  const mods = await Promise.all([
    import("../commands/config.js"),
    import("../commands/configt.js"),
    import("../commands/stats.js"),
    import("../commands/panel.js"),
    import("../commands/ratings.js"),
    import("../commands/ticket.js"),
    import("../commands/announce.js"),
    import("../commands/helpt.js"),
    import("../commands/botinfo.js"),
    import("../commands/remind.js"),
  ]);
  for (const m of mods) commands.set(m.data.name, { execute: m.execute });
  console.log(`  📡  ${mods.length} أوامر محمّلة`);
}

export async function handleInteraction(client: Client, interaction: Interaction): Promise<void> {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (cmd) await cmd.execute(interaction);
      return;
    }

    // Select menus
    if (interaction.isStringSelectMenu()) {
      const m = interaction as StringSelectMenuInteraction;
      if (m.customId === "ticket_category")   { await handleCategorySelect(m); return; }
      if (m.customId === "ticket_quickreply") { await handleQuickReply(client, m); return; }
    }

    // Modals
    if (interaction.isModalSubmit()) {
      const m = interaction as ModalSubmitInteraction;
      if (m.customId.startsWith("ticket_modal_")) { await handleTicketModalSubmit(client, m); return; }
      if (m.customId === "ticket_rename_modal")    { await handleRenameModalSubmit(client, m); return; }
    }

    // Buttons
    if (interaction.isButton()) {
      const b = interaction as ButtonInteraction;
      if (b.customId.startsWith("rate_")) { await handleRatingButton(client, b); return; }
      updateTicketActivity(b.channelId);
      switch (b.customId) {
        case "ticket_claim":   await handleClaimTicket(client, b);   break;
        case "ticket_unclaim": await handleUnclaimTicket(client, b); break;
        case "ticket_rename":  await handleRenameTicket(b);          break;
        case "ticket_close":   await handleCloseTicket(client, b);   break;
      }
    }
  } catch (err) {
    console.error("[Interaction Error]", err);
    try {
      const i = interaction as any;
      if (i.replied === false && i.deferred === false) {
        await i.reply({ content: "❌ حدث خطأ غير متوقع. يرجى المحاولة مجدداً.", ephemeral: true });
      }
    } catch {}
  }
}
