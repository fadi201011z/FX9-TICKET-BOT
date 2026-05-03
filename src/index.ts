import "dotenv/config";
import { ActivityType } from "discord.js";
import { createClient } from "./bot.js";
import { loadCommands, handleInteraction } from "./events/interactionCreate.js";
import { handleMessage } from "./events/messageCreate.js";
import { startInactivityMonitor } from "./handlers/inactivityHandler.js";
import http from "node:http"; // استيراد وحدة http لحل مشكلة Render

// ── التحقق من المتغيرات المطلوبة ──────────────────────────────────────────
const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("  ❌  DISCORD_BOT_TOKEN غير موجود!");
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.exit(1);
}

// ── حل مشكلة Port Scan في Render ──────────────────────────────────────────
// هذا الكود يفتح منفذ خادم وهمي لإعلام Render أن البوت يعمل بنجاح
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("FX9 Bot is Online! ✅");
}).listen(PORT, () => {
  console.log(` 📡  Web Server: Listening on port ${PORT} (Render Fix)`);
});

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

// معالجة الأحداث
client.on("interactionCreate", (i) => handleInteraction(client, i));
client.on("messageCreate", (m) => handleMessage(client, m));

// معالجة الأخطاء لضمان عدم توقف البوت
client.on("error", (err) => console.error("[Bot Error]", err.message));
process.on("unhandledRejection", (err) => console.error("[Rejection]", err));
process.on("SIGINT", () => { client.destroy(); process.exit(0); });
process.on("SIGTERM", () => { client.destroy(); process.exit(0); });

client.login(TOKEN);