import "dotenv/config";
import { ActivityType } from "discord.js";
import { createClient } from "./bot.js";
import { loadCommands, handleInteraction } from "./events/interactionCreate.js";
import { handleMessage } from "./events/messageCreate.js";
import { startInactivityMonitor } from "./handlers/inactivityHandler.js";

// ── التحقق من المتغيرات المطلوبة ──────────────────────────────────────────
const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("  ❌  DISCORD_BOT_TOKEN غير موجود!");
  console.error("");
  console.error("  الحل:");
  console.error("  1. انسخ ملف .env.example وسمّه .env");
  console.error("  2. ضع توكن البوت في DISCORD_BOT_TOKEN");
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.exit(1);
}

// ── تشغيل البوت ───────────────────────────────────────────────────────────
const client = createClient();

client.once("ready", async (c) => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  ✅  FX9 Bot — ${c.user.tag}`);
  console.log(`  📡  متصل بـ ${c.guilds.cache.size} سيرفر`);

  // حالة البوت في البروفايل
  c.user.setPresence({
    status: "online",
    activities: [
      {
        name: "🎫 FX9 Support | /helpt",
        type: ActivityType.Watching,
      },
    ],
  });

  await loadCommands();
  startInactivityMonitor(client);

  console.log("  🎫  نظام التكتات يعمل");
  console.log("  👁️  الحالة: يشاهد 🎫 FX9 Support");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

client.on("interactionCreate", (i) => handleInteraction(client, i));
client.on("messageCreate", (m) => handleMessage(client, m));

client.on("error", (err) => console.error("[Bot Error]", err.message));
process.on("unhandledRejection", (err) => console.error("[Rejection]", err));
process.on("SIGTERM", () => { client.destroy(); process.exit(0); });

client.login(TOKEN);
