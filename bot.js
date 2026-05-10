const { Telegraf, Markup } = require('telegraf');

/**
 * EarnBD Telegram Bot
 * 
 * Instructions:
 * 1. Install Node.js
 * 2. Run: npm install telegraf
 * 3. Add your Bot Token below
 * 4. Run: node bot.js
 */

// --- CONFIGURATION ---
const BOT_TOKEN = '8091594023:AAHqdgehZZZjkQT7DsTdlTz-1CJRVCgEuYc'; // Updated with provided token
const WEB_APP_URL = 'https://earn-bd-six.vercel.app';
const TUTORIAL_URL = 'https://youtube.com/your_tutorial_link'; // Add your tutorial link here
const WELCOME_IMAGE = 'https://earn-bd-six.vercel.app/img/welcome.jpg'; // Or any professional image URL

const bot = new Telegraf(BOT_TOKEN);

// --- START COMMAND ---
bot.start((ctx) => {
    const firstName = ctx.from.first_name || 'User';
    
    const welcomeMessage = 
`🌟 **স্বাগতম, ${firstName}**

Web Mini App ব্যবহার করে এখনই আপনার আয় শুরু করুন।
নিচে থাকা “ইনকাম শুরু করুন” বাটনে ক্লিক করে অ্যাপটি ওপেন করুন এবং কাজ শুরু করুন।

📌 **ব্যবহার বুঝতে সুবিধার জন্য আগে টিউটোরিয়াল ভিডিওটি দেখে নেওয়ার অনুরোধ রইলো।**

👉 শুরু করতে এখনই **ইনকাম শুরু করুন** বাটনে চাপ দিন।`;

    // Sending Photo with Caption and Inline Buttons
    return ctx.replyWithPhoto(
        { url: WELCOME_IMAGE },
        {
            caption: welcomeMessage,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.webApp('🚀 ইনকাম শুরু করুন', WEB_APP_URL)],
                [Markup.button.url('🎥 টিউটোরিয়াল দেখুন', TUTORIAL_URL)]
            ])
        }
    ).catch(err => {
        // Fallback if image fails to load
        console.error("Photo error, sending text only:", err.message);
        return ctx.reply(welcomeMessage, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.webApp('🚀 ইনকাম শুরু করুন', WEB_APP_URL)],
                [Markup.button.url('🎥 টিউটোরিয়াল দেখুন', TUTORIAL_URL)]
            ])
        });
    });
});

// --- LAUNCH ---
bot.launch().then(() => {
    console.log('🚀 EarnBD Bot is running successfully!');
}).catch(err => {
    console.error('❌ Bot launch failed:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
