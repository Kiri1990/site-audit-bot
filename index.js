import TelegramBot from 'node-telegram-bot-api';
import puppeteer from 'puppeteer';

const token = process.env.BOT_TOKEN;
const allowedId = process.env.ALLOWED_CHAT_ID;

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  if (allowedId && msg.chat.id.toString() !== allowedId) return;
  bot.sendMessage(msg.chat.id, `👋 Привет! Я SEO бот. Пришли мне ссылку, и я пришлю краткий SEO-аудит.\n\nТы также можешь использовать команду /audit https://example.com`);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `📘 Помощь:\n— Пришли ссылку: https://site.com\n— Или: /audit https://site.com`);
});

bot.onText(/\/audit (.+)/, (msg, match) => {
  const url = match[1];
  if (!url.startsWith('http')) {
    return bot.sendMessage(msg.chat.id, '❌ Пришли корректный URL (с http/https).');
  }
  auditSite(msg.chat.id, url);
});

bot.on('message', (msg) => {
  const url = msg.text;
  if (url.startsWith('http')) {
    auditSite(msg.chat.id, url);
  }
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
      const h1 = [...document.querySelectorAll('h1')].map(el => el.innerText).join(', ') || '—';
      const imgs = [...document.images];
      const broken = imgs.filter(i => !i.complete || i.naturalWidth === 0).length;

      return `<b>📊 SEO-АУДИТ</b>
<b>Title:</b> ${escape(title)}
<b>Description:</b> ${escape(desc)}
<b>Canonical:</b> ${escape(canonical)}
<b>Meta Robots:</b> ${escape(robots)}
<b>H1:</b> ${escape(h1)}
<b>Images:</b> ${imgs.length}, <b>Broken:</b> ${broken}`;
    });

    await bot.sendMessage(chatId, report, { parse_mode: 'HTML' });
    await browser.close();
  } catch (e) {
    bot.sendMessage(chatId, `❌ Ошибка: ${e.message}`);
  }
}
