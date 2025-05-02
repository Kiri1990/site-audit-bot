import TelegramBot from 'node-telegram-bot-api';
import puppeteer from 'puppeteer';

const token = process.env.BOT_TOKEN;
const allowedId = process.env.ALLOWED_CHAT_ID;

if (!token) {
  console.error("❌ BOT_TOKEN is not set. Exiting in 5s...");
  setTimeout(() => process.exit(1), 5000);
} else {
  console.log("✅ Bot is starting...");
  console.log("🔑 BOT_TOKEN:", token.slice(0, 10) + "...");  // partial mask
  console.log("📨 ALLOWED_CHAT_ID:", allowedId || "not set");
}

const bot = new TelegramBot(token, { polling: true });

bot.on('polling_error', (err) => {
  console.error("❌ Polling error:", err.message);
});

bot.onText(/\/start/, (msg) => {
  if (allowedId && msg.chat.id.toString() !== allowedId) return;
  bot.sendMessage(msg.chat.id, "👋 Привет! Я SEO бот. Пришли мне ссылку или используй /audit https://example.com");
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, "📘 Помощь:\n— Пришли ссылку: https://site.com\n— /audit https://site.com");
});

bot.onText(/\/audit\s+(https?:\/\/\S+)/, (msg, match) => {
  const url = match[1];
  auditSite(msg.chat.id, url);
});

bot.on('message', (msg) => {
  const text = msg.text?.trim();
  if (/^\/(start|help|audit)/.test(text)) return;
  if (/^https?:\/\//.test(text)) auditSite(msg.chat.id, text);
  else bot.sendMessage(msg.chat.id, "🤖 Ожидаю ссылку или команду /audit. Попробуй /help.");
});

async function auditSite(chatId, url) {
  if (allowedId && chatId.toString() !== allowedId) return;
  bot.sendMessage(chatId, `⏳ Анализирую: ${url}`);
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const report = await page.evaluate(() => {
      const escape = (s) => s?.toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || '—';
      const title = document.title;
      const desc = document.querySelector('meta[name="description"]')?.content || '—';
      const canonical = document.querySelector('link[rel="canonical"]')?.href || '—';
      const robots = document.querySelector('meta[name="robots"]')?.content || '—';
      const h1 = [...document.querySelectorAll('h1')].map(el => el.innerText.trim()).join(', ') || '—';
      const imgs = [...document.images];
      const broken = imgs.filter(i => !i.complete || i.naturalWidth === 0).length;
      return `📊 <b>SEO-АУДИТ</b>\n<b>Title:</b> ${escape(title)}\n<b>Description:</b> ${escape(desc)}\n<b>Canonical:</b> ${escape(canonical)}\n<b>Meta Robots:</b> ${escape(robots)}\n<b>H1:</b> ${escape(h1)}\n<b>Images:</b> ${imgs.length}, <b>Broken:</b> ${broken}`;
    });

    await bot.sendMessage(chatId, report, { parse_mode: 'HTML' });
    await browser.close();
  } catch (e) {
    console.error("❌ Audit error:", e);
    bot.sendMessage(chatId, `❌ Ошибка во время аудита: ${e.message}`);
  }
}
