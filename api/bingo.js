const baseKey = "squishy:bingo:v1";

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

function cleanName(value = "") {
  return value.trim().replace(/[<>]/g, "").slice(0, 30);
}

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function makeCard() {
  const pool = Array.from({ length: 100 }, (_, index) => index + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 25);
}

function hasBingo(card, marked) {
  const set = new Set(marked);
  const lines = [];
  for (let row = 0; row < 5; row += 1) lines.push([0,1,2,3,4].map(col => row * 5 + col));
  for (let col = 0; col < 5; col += 1) lines.push([0,1,2,3,4].map(row => row * 5 + col));
  lines.push([0,6,12,18,24], [4,8,12,16,20]);
  return lines.some(line => line.every(index => set.has(card[index])));
}

async function currentRound() {
  let value = await redis("GET", `${baseKey}:round`);
  if (!value) {
    await redis("SET", `${baseKey}:round`, 1, "NX");
    value = await redis("GET", `${baseKey}:round`);
  }
  return Number(value);
}

export default async function handler(req, res) {
  try {
    const round = await currentRound();
    const roundKey = `${baseKey}:round:${round}`;

    if (req.method === "GET") {
      const drawnRaw = await redis("GET", `${roundKey}:drawn`);
      const winnerRaw = await redis("GET", `${roundKey}:winner`);
      return send(res, 200, {
        round,
        drawn: drawnRaw ? JSON.parse(drawnRaw) : [],
        winner: winnerRaw ? JSON.parse(winnerRaw) : null
      });
    }

    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    const action = req.body?.action;

    if (action === "join") {
      const name = cleanName(req.body?.name);
      if (name.length < 2) return send(res, 400, { error: "נא להכניס שם של לפחות שתי אותיות" });
      const key = `${roundKey}:player:${name}`;
      const saved = await redis("GET", key);
      if (saved) return send(res, 200, JSON.parse(saved));
      const player = { name, round, card: makeCard(), marked: [] };
      await redis("SET", key, JSON.stringify(player));
      return send(res, 200, player);
    }

    if (action === "mark") {
      if (Number(req.body?.round) !== round) return send(res, 409, { error: "נפתח סבב חדש", reset: true });
      const name = cleanName(req.body?.name);
      const key = `${roundKey}:player:${name}`;
      const raw = await redis("GET", key);
      if (!raw) return send(res, 404, { error: "הלוח לא נמצא. התחברו מחדש." });
      const player = JSON.parse(raw);
      const number = Number(req.body?.number);
      const drawnRaw = await redis("GET", `${roundKey}:drawn`);
      const drawn = drawnRaw ? JSON.parse(drawnRaw) : [];
      if (!player.card.includes(number) || !drawn.includes(number)) {
        return send(res, 400, { error: "אפשר לסמן רק מספר שכבר הוגרל" });
      }
      player.marked = [...new Set([...player.marked, number])];
      await redis("SET", key, JSON.stringify(player));
      let winner = null;
      if (hasBingo(player.card, player.marked)) {
        const candidate = { name: player.name, wonAt: Date.now() };
        const claimed = await redis("SET", `${roundKey}:winner`, JSON.stringify(candidate), "NX");
        const winnerRaw = claimed ? JSON.stringify(candidate) : await redis("GET", `${roundKey}:winner`);
        winner = JSON.parse(winnerRaw);
      }
      return send(res, 200, { marked: player.marked, winner });
    }

    if (action === "draw") {
      if (!process.env.ADMIN_CODE || req.body?.code !== process.env.ADMIN_CODE) {
        return send(res, 403, { error: "קוד מארחת שגוי" });
      }
      const raw = await redis("GET", `${roundKey}:drawn`);
      const drawn = raw ? JSON.parse(raw) : [];
      if (drawn.length >= 100) return send(res, 409, { error: "כל המספרים כבר הוגרלו" });
      const remaining = Array.from({ length: 100 }, (_, i) => i + 1).filter(number => !drawn.includes(number));
      const number = remaining[Math.floor(Math.random() * remaining.length)];
      drawn.push(number);
      await redis("SET", `${roundKey}:drawn`, JSON.stringify(drawn));
      return send(res, 200, { number, drawn });
    }

    if (action === "reset") {
      if (!process.env.ADMIN_CODE || req.body?.code !== process.env.ADMIN_CODE) {
        return send(res, 403, { error: "קוד מארחת שגוי" });
      }
      const nextRound = await redis("INCR", `${baseKey}:round`);
      return send(res, 200, { reset: true, round: Number(nextRound) });
    }

    return send(res, 400, { error: "פעולה לא מוכרת" });
  } catch (error) {
    const message = error.message === "STORAGE_NOT_CONFIGURED"
      ? "המשחק עדיין לא חובר למסד הנתונים"
      : "אירעה תקלה זמנית. נסו שוב.";
    return send(res, 503, { error: message });
  }
}
