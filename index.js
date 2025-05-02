import TelegramBot from 'node-telegram-bot-api';
import puppeteer from 'puppeteer';

const token = '6716914662:AAFfsPmsAoSAlyjLSQ9COgy6PHTuXGyFCJ8';
const bot = new TelegramBot(token, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const url = msg.text;

  if (!url.startsWith('http')) {
    return bot.sendMessage(chatId, 'Пожалуйста, пришли корректный URL (с http/https).');
  }

  bot.sendMessage(chatId, `Анализирую: ${url}`);

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
    bot.sendMessage(chatId, `Ошибка при аудите: ${e.message}`);
  }
});
