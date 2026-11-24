// Free scam analysis that runs entirely on this server: the trained classifier,
// the keyword signs and the link checks, combined into the same result shape
// that analyzeWithClaude() returns, so the website (and apps using the API) can show either.
import { SIGNS } from "../public/js/url-analyzer.js";
import { classify } from "./local-model/classifier.js";
import { AnalysisError } from "./claude.js";

const isArabic = text => /[؀-ۿ]/.test(text || "");

const SIGN_TEXT = {
  "Urgency or threats": { ar: "استعجال أو تهديد", en_why: "Scammers rush you with deadlines or threats so you act before thinking.", ar_why: "يستعجلك المحتالون بمهلة أو تهديد حتى تتصرف دون تفكير." },
  "Asks for codes or passwords": { ar: "طلب رموز أو كلمات مرور", en_why: "No real bank, police or company asks you to share a code or password.", ar_why: "لا يطلب أي بنك أو جهة رسمية مشاركة رمز أو كلمة مرور." },
  "Asks for money": { ar: "طلب مال", en_why: "It asks for a payment, fee or transfer, which is what most scams are after.", ar_why: "تطلب دفع مبلغ أو رسوم أو تحويل، وهذا هدف معظم عمليات الاحتيال." },
  "Prize or easy money": { ar: "جائزة أو ربح سهل", en_why: "Prizes you never entered for and easy money are classic bait.", ar_why: "الجوائز التي لم تشارك فيها والربح السهل طُعم معروف." },
  "Claims to be an authority": { ar: "انتحال صفة جهة رسمية", en_why: "It claims to be a bank, police or government body. Scammers copy these names to win trust.", ar_why: "تدّعي أنها من بنك أو شرطة أو جهة حكومية، والمحتالون ينتحلون هذه الأسماء لكسب الثقة." },
  "Delivery story": { ar: "قصة توصيل", en_why: "Fake delivery problems are one of the most common scams in the UAE.", ar_why: "مشاكل التوصيل المزيفة من أكثر عمليات الاحتيال انتشاراً في الإمارات." },
  "Personal details requested": { ar: "طلب بيانات شخصية", en_why: "It asks for ID, card or bank details, which can be used for fraud.", ar_why: "تطلب بيانات الهوية أو البطاقة أو البنك، ويمكن استخدامها في الاحتيال." }
};

function scamType(signs, ar) {
  const has = s => signs.includes(s);
  if (has("Delivery story") && (has("Asks for money") || has("Personal details requested"))) return ar ? "رسوم توصيل مزيفة" : "Fake delivery fee";
  if (has("Claims to be an authority") && (has("Asks for money") || has("Urgency or threats"))) return ar ? "انتحال جهة رسمية" : "Fake authority or fine";
  if (has("Asks for codes or passwords")) return ar ? "سرقة رمز أو حساب" : "Code or account theft";
  if (has("Prize or easy money")) return ar ? "جائزة أو وظيفة وهمية" : "Fake prize or job";
  if (has("Personal details requested")) return ar ? "سرقة بيانات" : "Data theft";
  return "";
}

const STEPS = {
  scam: {
    en: [
      "Don't click any link, reply, or call any number in this message.",
      "If you need to check, contact the organisation through its official app or website, or the number on the back of your bank card.",
      "If you already paid, shared a code or installed an app, call your bank immediately, then report it to the police on 901.",
      "Block the sender and delete the message."
    ],
    ar: [
      "لا تضغط على أي رابط ولا ترد ولا تتصل بأي رقم في هذه الرسالة.",
      "إذا أردت التأكد، تواصل مع الجهة عبر تطبيقها أو موقعها الرسمي، أو الرقم الموجود خلف بطاقتك البنكية.",
      "إذا دفعت أو شاركت رمزاً أو ثبّت تطبيقاً، اتصل ببنكك فوراً ثم أبلغ الشرطة على 901.",
      "احظر المرسل واحذف الرسالة."
    ]
  },
  suspicious: {
    en: [
      "Don't use the links or numbers in this message.",
      "Check directly with the organisation through its official app or website.",
      "Never share codes, passwords or card details.",
      "If you're unsure, call the police on 901 for advice."
    ],
    ar: [
      "لا تستخدم الروابط أو الأرقام الموجودة في هذه الرسالة.",
      "تحقق مباشرة من الجهة عبر تطبيقها أو موقعها الرسمي.",
      "لا تشارك أبداً الرموز أو كلمات المرور أو بيانات البطاقة.",
      "إذا لم تكن متأكداً، اتصل بالشرطة على 901 للاستشارة."
    ]
  },
  likely_safe: {
    en: [
      "Still never share codes, passwords or card details.",
      "If it asks you to act, open the organisation's official app or website yourself.",
      "If something changes or feels wrong, call the police on 901 for advice."
    ],
    ar: [
      "مع ذلك، لا تشارك أبداً الرموز أو كلمات المرور أو بيانات البطاقة.",
      "إذا طُلب منك إجراء، افتح التطبيق أو الموقع الرسمي للجهة بنفسك.",
      "إذا تغير شيء أو شعرت بالريبة، اتصل بالشرطة على 901 للاستشارة."
    ]
  }
};

const SUMMARY = {
  scam: { en: "This message shows strong signs of a scam.", ar: "تظهر في هذه الرسالة علامات قوية على الاحتيال." },
  suspicious: { en: "This message has some warning signs and could be a scam.", ar: "في هذه الرسالة بعض علامات التحذير وقد تكون احتيالاً." },
  likely_safe: { en: "No clear warning signs were found in this message.", ar: "لم يتم العثور على علامات تحذير واضحة في هذه الرسالة." }
};
const SUMMARY_TAIL = {
  scam: { en: "Do not reply, pay or open its links.", ar: "لا ترد ولا تدفع ولا تفتح روابطها." },
  suspicious: { en: "Treat it with caution and check with the organisation directly.", ar: "تعامل معها بحذر وتحقق من الجهة مباشرة." },
  likely_safe: { en: "That is not a guarantee it is safe.", ar: "هذا لا يضمن أنها آمنة." }
};

/**
 * Same inputs and result shape as analyzeWithClaude(), plus engine: "local".
 * Screenshots can't be read locally; a screenshot with no text is rejected with code "needs_text".
 */
export async function analyzeLocally({ text = "", image, signs = [], links = [], lang: pageLang }) {
  const body = String(text).slice(0, 8000);
  if (!body.trim()) throw new AnalysisError("needs_text", "Screenshots need the AI check; paste the message text instead.");
  const ar = pageLang ? pageLang === "ar" : isArabic(body); // answer in the page's language when it is given
  const lang = ar ? "ar" : "en";

  // 1. Trained classifier. Few words means little to go on, so it counts less.
  const model = classify(body);
  const trust = Math.min(1, model.words / 8);

  // 2. Keyword signs (already found by messageSigns()).
  const signRisk = Math.min(70, signs.length * 18);

  // 3. Link checks.
  let linkRisk = 0;
  for (const l of links) {
    let r = l.score || 0;
    if (l.level === "high") r = Math.max(r, 80);
    else if (l.level === "med") r = Math.max(r, 45);
    if (l.safeBrowsing?.matches?.length) r = 100;
    linkRisk = Math.max(linkRisk, r);
  }

  let textRisk = trust * model.probability * 100 + (1 - trust) * signRisk;
  // Many warning signs raise the score, unless the model is confident the message is normal
  // (real bank messages mention codes, money and the bank too).
  if (signs.length >= 3 && model.probability >= 0.25) textRisk = Math.max(textRisk, 60);
  if (model.probability >= 0.5) textRisk = Math.max(textRisk, signRisk);
  const risk = Math.round(Math.max(0, Math.min(100, Math.max(textRisk, linkRisk))));
  const verdict = risk >= 70 ? "scam" : risk >= 45 ? "suspicious" : "likely_safe";

  // Reasons shown to the person.
  const red_flags = [];
  for (const l of links) {
    const f = (l.flags || []).find(x => x.sev === "high") || (l.flags || []).find(x => x.sev === "med");
    if (f && (l.level !== "low" || l.safeBrowsing?.matches?.length)) red_flags.push({ quote: l.raw, why: ar ? `رابط خطر: ${l.parts?.reg || l.host} ليس موقعاً رسمياً معروفاً.` : `${f.title}. ${f.detail}` });
  }
  for (const name of signs) {
    const re = SIGNS.find(([n]) => n === name)?.[1];
    const quote = (re && body.match(re)?.[0]) || "";
    const t = SIGN_TEXT[name];
    if (t) red_flags.push({ quote, why: ar ? t.ar_why : t.en_why });
  }
  if (verdict !== "likely_safe" && model.probability >= 0.5 && model.evidence.length) {
    red_flags.push({
      quote: model.evidence.join(" · "),
      why: ar ? "هذه الكلمات شائعة في رسائل الاحتيال التي تدرب عليها الفحص الآلي." : "Wording like this is common in the scam messages the automatic check was trained on."
    });
  }

  const reassuring_signs = [];
  if (verdict !== "scam") {
    if (!links.length) reassuring_signs.push(ar ? "لا توجد روابط في الرسالة." : "There are no links in the message.");
    if (!signs.includes("Asks for money")) reassuring_signs.push(ar ? "لا تطلب الرسالة دفع أي مبلغ." : "It doesn't ask you to pay anything.");
    if (!signs.includes("Asks for codes or passwords") || /do not share|don't share|لا تشارك/i.test(body)) {
      reassuring_signs.push(ar ? "لا تطلب منك مشاركة رمز أو كلمة مرور." : "It doesn't ask you to share a code or password.");
    }
  }

  let summary = `${SUMMARY[verdict][lang]} ${SUMMARY_TAIL[verdict][lang]}`;
  if (image) summary += ar ? " لم تتم قراءة صورة الشاشة، تم فحص النص فقط." : " The screenshot wasn't read; only the text was checked.";

  return {
    verdict,
    risk,
    scam_type: verdict === "likely_safe" ? "" : scamType(signs, ar),
    summary,
    red_flags: red_flags.slice(0, 5),
    reassuring_signs: reassuring_signs.slice(0, 3),
    next_steps: STEPS[verdict][lang],
    engine: "local"
  };
}
