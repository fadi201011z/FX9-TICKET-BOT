/**
 * تسجيل أوامر البوت (Slash Commands) مع Discord
 * شغّل هذا الملف مرة واحدة فقط بعد كل تغيير في الأوامر:
 *   npx tsx src/deploy-commands.ts
 */

import "dotenv/config";
import { REST, Routes } from "discord.js";
import { data as configCmd   } from "./commands/config.js";
import { data as configtCmd  } from "./commands/configt.js";
import { data as statsCmd    } from "./commands/stats.js";
import { data as panelCmd    } from "./commands/panel.js";
import { data as ratingsCmd  } from "./commands/ratings.js";
import { data as ticketCmd   } from "./commands/ticket.js";
import { data as announceCmd } from "./commands/announce.js";
import { data as helptCmd    } from "./commands/helpt.js";
import { data as botinfoCmd  } from "./commands/botinfo.js";
import { data as remindCmd   } from "./commands/remind.js";

const TOKEN     = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID  = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("  ❌  مطلوب في ملف .env:");
  console.error("      DISCORD_BOT_TOKEN");
  console.error("      DISCORD_CLIENT_ID");
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.exit(1);
}

const cmds = [
  configCmd, configtCmd, statsCmd, panelCmd,
  ratingsCmd, ticketCmd, announceCmd, helptCmd,
  botinfoCmd, remindCmd,
].map((c) => c.toJSON());

const rest = new REST().setToken(TOKEN);

(async () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  🔄  تسجيل ${cmds.length} أوامر...`);

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: cmds });
    console.log("  ✅  تم التسجيل في السيرفر (فورية)");
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: cmds });
    console.log("  ✅  تم التسجيل عالمياً (قد تأخذ حتى ساعة)");
  }

  console.log("");
  console.log("  📋  الأوامر:");
  cmds.forEach((c, i) => console.log(`     ${i + 1}. /${(c as any).name}`));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
})().catch((e) => { console.error("❌ فشل:", e); process.exit(1); });
