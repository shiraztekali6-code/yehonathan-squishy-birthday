const phrases = [
  "יהונתן חוגג עשרים ושבע עם סקווישים זוהרים",
  "מי שמפענח ראשון זוכה בסקווישי הנכסף",
  "בתוך ים של צורות מסתתרת ברכת יום הולדת",
  "הסקווישי הנדיר מחכה למפענח המהיר ביותר",
  "רק מי שחושב מחוץ לקופסה ימצא את הפתרון",
  "כשהאורות זוהרים מתחילה חגיגת הסקווישים",
  "עסקה מוצלחת מתחילה בהצעה שאי אפשר לסרב לה",
  "עשרים ושבע שנים של חיוכים והרפתקאות נפלאות",
  "אל תתנו לצורות המבלבלות להסתיר את התשובה",
  "הדרך אל הפרס עוברת דרך סבלנות וריכוז",
  "לפעמים הסמל הקטן ביותר מגלה את הסוד הגדול",
  "במסיבת ניאון אפילו הסקווישים יודעים לרקוד",
  "המנצח האמיתי נשאר רגוע גם כשהשעון מתקתק",
  "יהונתן הוא המלך הבלתי מעורער של הסקווישים",
  "אם הגעתם עד לכאן אתם קרובים מאוד לניצחון",
  "החלפה הוגנת מתקיימת רק כששני הצדדים מרוצים",
  "מאחורי כל צורה מסתתרת אות שמחכה להתגלות",
  "הכוכבים כבר זוהרים והמסיבה רק מתחילה",
  "חשיבה חדה ולב אמיץ יובילו אל הסקווישי",
  "שיהיו ליהונתן עוד שנים מלאות שמחה והפתעות",
  "הפתרון מתחבא במקום שבו הצורות פוגשות את האותיות",
  "סקווישי צבעוני אחד יכול לשנות את כל העסקה",
  "מי שמביט היטב מגלה שגם לסמלים יש שפה משלהם",
  "הסוד הגדול של המסיבה שמור למי שלא מוותר",
  "כדי לזכות בפרס צריך לפענח כל סימן בסבלנות",
  "המסיבה הטובה ביותר מתחילה בחברים ובסקווישים",
  "אלופי ההחלפות תמיד יודעים מתי לבקש תוספת",
  "ברכה מסתורית ליהונתן מסתתרת בין הכוכבים",
  "גם החידה המסובכת ביותר נפתרת צורה אחרי צורה",
  "מי שיקרא את הסימנים נכון יגיע ראשון אל האוצר",
  "הסקווישים קפצו משמחה כשיהונתן נכנס למסיבה",
  "הלילה כל צבעי הניאון מאירים לכבוד חתן השמחה",
  "מפענח אמיתי בודק כל אות לפני שהוא שולח תשובה",
  "הפרס המתוק ביותר שייך למי ששומר על קור רוח",
  "בין המשולשים והכוכבים מסתתר משפט מפתיע במיוחד",
  "רק שילוב של זריזות ודיוק יוביל לניצחון הגדול",
  "כל סימן מקרב אתכם עוד צעד אל הסקווישי המושלם",
  "יהונתן מאחל לכל המפענחים הצלחה והרבה מזל",
  "כשהחברים מתאספים מתחילות ההרפתקאות הכי טובות",
  "בסוף כל חידה מוצלחת מחכה הפתעה רכה וצבעונית"
];

const symbols = ["●","○","◆","◇","▲","△","■","□","★","☆","♥","♠","♣","☀","☂","☁","☾","✦","✿","⬟","⬢","⬣","⬤","◐","◒","◈","◎","⊕","⌂","♜","♞","⚑"];
const letters = [..."אבגדהוזחטיכךלמםנןסעפףצץקרשת"];
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
    let storedRound = await redis("GET", `${baseKey}:round`);
    if (!storedRound) {
      await redis("SET", `${baseKey}:round`, 1, "NX");
      storedRound = await redis("GET", `${baseKey}:round`);
    }
    const round = Number(storedRound);
    const roundKey = `${baseKey}:round:${round}`;
    if (req.method === "GET") {
      const winner = await redis("GET", `${roundKey}:winner`);
      return send(res, 200, { round, winner: winner ? JSON.parse(winner) : null });
    }

    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    const action = req.body?.action;

    if (action === "join") {
      const name = cleanName(req.body?.name);
      if (name.length < 2) return send(res, 400, { error: "נא להכניס שם של לפחות שתי אותיות" });
      const saved = await redis("GET", `${roundKey}:player:${name}`);
      if (saved) return send(res, 200, JSON.parse(saved));

      const start = Math.floor(Math.random() * phrases.length);
      let card = null;
      for (let offset = 0; offset < phrases.length; offset += 1) {
        const candidate = (start + offset) % phrases.length;
        if (await redis("SADD", `${roundKey}:used`, candidate)) {
          card = candidate;
          break;
        }
      }
      if (card === null) return send(res, 409, { error: "כל 40 הכרטיסים כבר הוגרלו" });

      const map = keyFor(card);
      const phrase = phrases[card];
      const player = {
        name, card: card + 1, round,
        cipher: [...phrase].map(char => char === " " ? " / " : map[char]).join(" "),
        key: Object.entries(map).map(([letter, symbol]) => ({ letter, symbol }))
      };
      await redis("SET", `${roundKey}:player:${name}`, JSON.stringify(player));
      return send(res, 200, player);
    }

    if (action === "submit") {
      const name = cleanName(req.body?.name);
      if (Number(req.body?.round) !== round) {
        return send(res, 409, { error: "המשחק אופס — יש להגריל כרטיס חדש", reset: true });
      }
      const playerRaw = await redis("GET", `${roundKey}:player:${name}`);
      if (!playerRaw) return send(res, 404, { error: "הכרטיס לא נמצא. התחברו מחדש." });
      const player = JSON.parse(playerRaw);
      if (normalize(req.body?.answer) !== normalize(phrases[player.card - 1])) {
        return send(res, 400, { error: "עוד לא — נסו שוב!" });
      }
      const candidate = { name: player.name, card: player.card, wonAt: Date.now() };
      const claimed = await redis("SET", `${roundKey}:winner`, JSON.stringify(candidate), "NX");
      const winnerRaw = claimed ? JSON.stringify(candidate) : await redis("GET", `${roundKey}:winner`);
      return send(res, 200, { correct: true, winner: JSON.parse(winnerRaw), claimed: Boolean(claimed) });
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
