// Xuddi broadcast'dagi kabi payload yuborib, aniq xatoni ko'ramiz
const TOKEN = "8924345505:AAHc3WSg9CzhF_U-Eo5cJCSUo36ZNFVP8qg";
const CHAT = "6839364895";

const lines = [
  "🆕 <b>Yangi foydalanuvchi qo'shildi!</b>",
  "",
  "<b>F.I.Sh:</b> Test Foydalanuvchi",
  "<b>Email:</b> test@example.com",
  "<b>Bo'lim:</b> IT",
  "",
  "<b>Holat:</b> Tasdiqlash kutilmoqda",
  "",
  "👇 Ruxsat bering yoki rad eting:",
];

const payload = {
  chat_id: CHAT,
  text: lines.join("\n"),
  parse_mode: "HTML",
  reply_markup: {
    inline_keyboard: [
      [
        { text: "✅ Ruxsat berish", callback_data: "approve:test-id" },
        { text: "❌ Rad etish", callback_data: "reject:test-id" },
      ],
    ],
  },
};

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const data = await res.json();
console.log(JSON.stringify(data).slice(0, 500));
