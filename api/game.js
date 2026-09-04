const phrases = [
  "מזל טוב יהונתן","יום הולדת שמח","עשרים ושבע שמח","מלך הסקווישים",
  "מסיבת ניאון מטורפת","קפוץ וזכה בפרס","חפש את הכוכב","כולם אוהבים סקווישים",
  "הפרס מחכה לך","לוחצים ומנצחים","החלפה רק בהסכמה","תציע עסקה שווה",
  "סקווישי קטן וחמוד","הגיע זמן לחגוג","יהונתן מלך המסיבה","עוד סקווישי בבקשה",
  "מצא את הדובי","הכוכבים כבר זוהרים","היום כולנו קופצים","מזל טוב לעד"
];

const symbols = ["●","○","◆","◇","▲","△","■","□","★","☆","♥","♠","♣","☀","☂","☁","☾","✦","✿","⬟","⬢","⬣","⬤","◐","◒","◈","◎","⊕","⌂","♜","♞","⚑"];
const letters = [...new Set(phrases.join("").replace(/\s/g, ""))];
const baseKey = "squishy:birthday:v1";

function keyFor(card) {
  const shift = (card * 7) % symbols.length;
  return Object.fromEntries(letters.map((letter, index) => [
    letter, symbols[(index + shift) % symbols.length]
  ]));
}

function normalize(value = "") {
  return value.trim().replace(/[״׳"'.,!?\-]/g, "").replace(/\s+/g, " ");
}

function cleanName(value = "") {
  return value.trim().replace(/[<>]/g, "").slice(0, 30);
}

async function redis(...command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("STORAGE_NOT_CONFIGURED");
  const path = command.map(part => encodeURIComponent(String(part))).join("/");
  const response = await fetch(`${url}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("STORAGE_ERROR");
  return (await response.json()).result;
}

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const winner = await redis("GET", `${baseKey}:winner`);
      return send(res, 200, { winner: winner ? JSON.parse(winner) : null });
    }

    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    const action = req.body?.action;

    if (action === "join") {
      const name = cleanName(req.body?.name);
      if (name.length < 2) return send(res, 400, { error: "נא להכניס שם של לפחות שתי אותיות" });
      const saved = await redis("GET", `${baseKey}:player:${name}`);
      if (saved) return send(res, 200, JSON.parse(saved));

      const start = Math.floor(Math.random() * phrases.length);
      let card = null;
      for (let offset = 0; offset < phrases.length; offset += 1) {
        const candidate = (start + offset) % phrases.length;
        if (await redis("SADD", `${baseKey}:used`, candidate)) {
          card = candidate;
          break;
        }
      }
      if (card === null) return send(res, 409, { error: "כל 20 הכרטיסים כבר הוגרלו" });

      const map = keyFor(card);
      const phrase = phrases[card];
      const player = {
        name, card: card + 1,
        cipher: [...phrase].map(char => char === " " ? " / " : map[char]).join(" "),
        key: Object.entries(map).map(([letter, symbol]) => ({ letter, symbol }))
      };
      await redis("SET", `${baseKey}:player:${name}`, JSON.stringify(player));
      return send(res, 200, player);
    }

    if (action === "submit") {
      const name = cleanName(req.body?.name);
      const playerRaw = await redis("GET", `${baseKey}:player:${name}`);
      if (!playerRaw) return send(res, 404, { error: "הכרטיס לא נמצא. התחברו מחדש." });
      const player = JSON.parse(playerRaw);
      if (normalize(req.body?.answer) !== normalize(phrases[player.card - 1])) {
        return send(res, 400, { error: "עוד לא — נסו שוב!" });
      }
      const candidate = { name: player.name, card: player.card, wonAt: Date.now() };
      const claimed = await redis("SET", `${baseKey}:winner`, JSON.stringify(candidate), "NX");
      const winnerRaw = claimed ? JSON.stringify(candidate) : await redis("GET", `${baseKey}:winner`);
      return send(res, 200, { correct: true, winner: JSON.parse(winnerRaw), claimed: Boolean(claimed) });
    }

    if (action === "reset") {
      if (!process.env.ADMIN_CODE || req.body?.code !== process.env.ADMIN_CODE) {
        return send(res, 403, { error: "קוד מארחת שגוי" });
      }
      await redis("DEL", `${baseKey}:winner`, `${baseKey}:used`);
      return send(res, 200, { reset: true });
    }

    return send(res, 400, { error: "פעולה לא מוכרת" });
  } catch (error) {
    const message = error.message === "STORAGE_NOT_CONFIGURED"
      ? "המשחק עדיין לא חובר למסד הנתונים"
      : "אירעה תקלה זמנית. נסו שוב.";
    return send(res, 503, { error: message });
  }
}
