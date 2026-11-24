// Arabic and English for the website. js/lang.js has already set <html lang dir> before the page
// was drawn; this module translates the page text, adds the language button and translates
// results that come back from the server in English (link warnings, watch reasons).
//
// Static text: elements carry data-i18n="key" and the Arabic is in STATIC below. The English text
// stays in the HTML, so the page still reads correctly without JavaScript.
// Text built in scripts: t("English text") returns the Arabic in AR, or the English if missing.

export const LANG = document.documentElement.lang === "ar" ? "ar" : "en";
export const isAr = LANG === "ar";

// Keeps a website name or code the right way round inside Arabic sentences.
const iso = s => "⁨" + s + "⁩";

/* ---------- text built in scripts ---------- */
const AR = {
  // link result
  "Likely a scam": "احتيال على الأرجح",
  "Don't open it. Delete the message.": "لا تفتحه، واحذف الرسالة.",
  "Suspicious": "مشبوه",
  "Don't enter details or pay. Go to the official site yourself.": "لا تُدخل بياناتك ولا تدفع. اذهب إلى الموقع الرسمي بنفسك.",
  "No obvious red flags": "لا توجد علامات خطر واضحة",
  "That doesn't prove it's safe. Stay alert on the page that opens.": "هذا لا يثبت أنه آمن. ابقَ منتبهاً في الصفحة التي ستفتح.",
  "High": "عالٍ", "Medium": "متوسط", "Low": "منخفض", "Good sign": "علامة جيدة",
  "Risk": "الخطورة",
  "Paste a link above to check it.": "الصق رابطاً في الأعلى لفحصه.",
  "That doesn't look like a web address. Paste the full link, for example https://example.com/page.": "هذا لا يبدو عنوان موقع. الصق الرابط كاملاً، مثل https://example.com/page.",
  "Checking phishing lists…": "جارٍ الفحص في قوائم مواقع التصيد…",
  "Online checks are unavailable right now. Showing pattern checks only.": "الفحص عبر الإنترنت غير متاح حالياً. تظهر نتائج فحص الأنماط فقط.",
  "pattern checks": "فحص الأنماط", "the trained model": "النموذج المدرَّب", "public phishing lists": "قوائم التصيد العامة", "Google Safe Browsing": "Google Safe Browsing",
  // message result
  "Probably legitimate": "سليم على الأرجح",
  "Check message": "افحص الرسالة",
  "Automatic check": "فحص آلي", "AI assessment": "تقييم الذكاء الاصطناعي",
  "Red flags": "علامات الخطر", "Flag": "تحذير", "Reassuring signs": "علامات مطمئنة", "What to do": "ماذا تفعل",
  "This automatic check can be wrong, especially with new kinds of scams.": "قد يخطئ هذا الفحص الآلي، خاصة مع أنواع الاحتيال الجديدة.",
  "AI can be wrong.": "قد يخطئ الذكاء الاصطناعي.",
  " If money or personal details are involved, contact the organization through its official app, website or phone number, or call the police on 901.": " إذا كان الأمر يتعلق بالمال أو ببياناتك الشخصية، فتواصل مع الجهة عبر تطبيقها أو موقعها أو رقمها الرسمي، أو اتصل بالشرطة على 901.",
  "Analyzing…": "جارٍ الفحص…",
  "Reading it now. This usually takes 10 to 30 seconds.": "جارٍ قراءة الرسالة…",
  "The AI check isn't available right now. The pattern checks above still work, or call 901 for advice.": "الفحص غير متاح حالياً. فحص الأنماط ما زال يعمل، أو اتصل بـ 901 للاستشارة.",
  "Too many checks just now. Please wait a minute and try again.": "عدد كبير من عمليات الفحص الآن. انتظر دقيقة ثم حاول مرة أخرى.",
  "This text couldn't be analyzed. Try removing personal details or shortening it.": "تعذّر فحص هذا النص. جرّب حذف البيانات الشخصية أو تقصيره.",
  "That screenshot couldn't be used. Try a PNG or JPG under 5 MB.": "تعذّر استخدام لقطة الشاشة. جرّب صورة PNG أو JPG أصغر من 5 ميغابايت.",
  "Paste a message or add a screenshot first.": "الصق رسالة أو أضف لقطة شاشة أولاً.",
  "Screenshots can't be read at the moment. Please paste the text of the message instead.": "لا يمكن قراءة لقطات الشاشة حالياً. الصق نص الرسالة بدلاً منها.",
  "Links in this message": "الروابط في هذه الرسالة",
  "No screenshot added": "لم تتم إضافة لقطة شاشة",
  "That image is over 5 MB. Try a smaller screenshot.": "حجم الصورة أكبر من 5 ميغابايت. جرّب لقطة شاشة أصغر.",
  // quick scan signs (names from SIGNS in url-analyzer.js)
  "Urgency or threats": "استعجال أو تهديد",
  "Asks for codes or passwords": "يطلب رموزاً أو كلمات مرور",
  "Asks for money": "يطلب مالاً",
  "Prize or easy money": "جائزة أو ربح سهل",
  "Claims to be an authority": "ينتحل صفة جهة رسمية",
  "Delivery story": "قصة توصيل",
  "Personal details requested": "يطلب بيانات شخصية",
  // fake sites watch
  "sites found": "موقعاً مكتشفاً",
  "newly registered look-alikes": "نطاقات مقلِّدة مسجّلة حديثاً",
  "live on phishing lists": "نشطة في قوائم التصيد",
  "high risk": "عالية الخطورة",
  "organisations targeted": "جهة مستهدفة",
  "Check": "افحص",
  "All": "الكل",
  "Newly registered domain": "نطاق مسجّل حديثاً",
  "new": "جديد", "reviewed": "تمت المراجعة", "reported": "تم الإبلاغ", "ignored": "تم التجاهل",
  "The first scan is running. This takes a few minutes…": "الفحص الأول قيد التشغيل، ويستغرق بضع دقائق…",
  "Nothing matches these filters.": "لا توجد نتائج مطابقة لهذه الاختيارات.",
  "Only authorised staff can change the status.": "يمكن للموظفين المخوّلين فقط تغيير الحالة.",
  "Could not load the watch list.": "تعذّر تحميل القائمة.",
  "not scanned yet": "لم يتم الفحص بعد",
  "scanning now…": "جارٍ الفحص الآن…"
};
export const t = s => (isAr && AR[s] != null ? AR[s] : s);

/* ---------- organisation names ---------- */
const BRAND_AR = {
  "Abu Dhabi Police": "شرطة أبوظبي", "Dubai Police": "شرطة دبي", "Sharjah Police": "شرطة الشارقة", "Ministry of Interior": "وزارة الداخلية",
  "Emirates Post": "بريد الإمارات", "Salik": "سالك", "RTA": "هيئة الطرق والمواصلات", "TAMM": "تم", "ICP": "الهيئة الاتحادية للهوية والجنسية",
  "DEWA": "هيئة كهرباء ومياه دبي", "SEWA": "هيئة كهرباء ومياه وغاز الشارقة", "ADDC": "شركة أبوظبي للتوزيع", "UAE PASS": "الهوية الرقمية UAE PASS",
  "Emirates NBD": "بنك الإمارات دبي الوطني", "Mashreq": "بنك المشرق", "FAB": "بنك أبوظبي الأول", "ADCB": "بنك أبوظبي التجاري",
  "ADIB": "مصرف أبوظبي الإسلامي", "Dubai Islamic Bank": "بنك دبي الإسلامي", "RAKBANK": "بنك رأس الخيمة",
  "etisalat by e&": "اتصالات من e&", "du": "دو", "Etihad": "الاتحاد للطيران", "Aramex": "أرامكس",
  "Carrefour": "كارفور", "SHARE rewards": "مكافآت SHARE", "LuLu Hypermarket": "لولو هايبرماركت", "LuLu": "لولو",
  "noon": "نون", "Amazon": "أمازون", "Careem": "كريم", "talabat": "طلبات"
};
export const brand = name => (isAr && BRAND_AR[name] ? BRAND_AR[name] : name);

/* ---------- link warnings from the checker ---------- */
const TITLE_AR = {
  "Runs code instead of opening a page": "يشغّل أوامر برمجية بدلاً من فتح صفحة",
  "Not encrypted": "غير مشفّر",
  "Uses https": "يستخدم https",
  "Uses a bare IP address": "يستخدم عنوان IP رقمياً",
  "Contains look-alike characters": "يحتوي على حروف متشابهة الشكل",
  "Hides the real destination": "يخفي الوجهة الحقيقية",
  "Unusual port number": "رقم منفذ غير معتاد",
  "Shortened link": "رابط مختصر",
  "Domain ending often used in scams": "امتداد نطاق شائع في الاحتيال",
  "Many subdomains": "نطاقات فرعية كثيرة",
  "Many hyphens in the domain": "شرطات كثيرة في اسم النطاق",
  "Downloads an app file": "يُنزّل ملف تطبيق",
  "Very long link": "رابط طويل جداً",
  "UAE government domain": "نطاق حكومي إماراتي",
  "Bait words in the link": "كلمات طُعم في الرابط",
  "Short link revealed": "تم كشف وجهة الرابط المختصر",
  "On a list of known phishing sites": "مدرج في قائمة مواقع تصيد معروفة",
  "Website name looks like phishing sites": "اسم الموقع يشبه مواقع التصيد",
  "Website name resembles phishing sites": "اسم الموقع قريب من أسماء مواقع التصيد",
  "Listed by Google Safe Browsing": "مدرج لدى Google Safe Browsing",
  "Not on Google's threat lists": "غير مدرج في قوائم التهديدات لدى Google",
  "Website is only a few months old": "عمر الموقع بضعة أشهر فقط"
};
const WHEN_AR = w => (w === "today" ? "اليوم" : w === "yesterday" ? "أمس" : "قبل " + w.replace(" days ago", "") + " أيام");
const TITLE_RE = [
  [/^Pretends to be (.+)$/, m => "ينتحل صفة " + brand(m[1])],
  [/^Look-alike spelling of (.+)$/, m => "تهجئة مقلِّدة لاسم " + brand(m[1])],
  [/^Official (.+) domain$/, m => "النطاق الرسمي لـ " + brand(m[1])],
  [/^Misspelled (.+)$/, m => "تحريف متعمّد لاسم " + brand(m[1])],
  [/^Mentions (.+) but goes elsewhere$/, m => "يذكر " + brand(m[1]) + " لكنه يذهب إلى موقع آخر"],
  [/^Website registered (today|yesterday|\d+ days ago)$/, m => "سُجّل الموقع " + WHEN_AR(m[1])]
];
const DETAIL_AR = {
  "Links starting with javascript: or data: can run code in your browser.": "الروابط التي تبدأ بـ javascript: أو data: يمكنها تشغيل أوامر برمجية في متصفحك.",
  "The link uses http, not https. Real payment and login pages always use https.": "يستخدم الرابط http وليس https. صفحات الدفع وتسجيل الدخول الحقيقية تستخدم https دائماً.",
  "The connection is encrypted. Scam sites use https too, so this alone proves nothing.": "الاتصال مشفّر. لكن مواقع الاحتيال تستخدم https أيضاً، لذا هذا وحده لا يثبت شيئاً.",
  "Real organisations use a named website, not a string of numbers.": "الجهات الحقيقية تستخدم اسم موقع، وليس سلسلة من الأرقام.",
  "The address uses foreign letters that can look identical to English ones (for example Cyrillic а instead of a).": "يستخدم العنوان حروفاً أجنبية قد تبدو مطابقة للحروف الإنجليزية (مثل حرف а السيريلي بدلاً من a).",
  "Everything before the @ is ignored by the browser. The real site comes after it.": "المتصفح يتجاهل كل ما يسبق علامة @، والموقع الحقيقي هو ما يأتي بعدها.",
  "Short links hide where they lead. Check where it really goes before opening it.": "الروابط المختصرة تخفي وجهتها. تحقق من وجهتها الحقيقية قبل فتحها.",
  "Long chains of words before the real domain are used to bury it out of sight.": "تُستخدم سلاسل الكلمات الطويلة قبل النطاق الحقيقي لإخفائه عن النظر.",
  "Names like secure-login-update are a common phishing pattern.": "الأسماء مثل secure-login-update نمط شائع في التصيد.",
  "This link installs software. Fake APK apps can read your SMS codes and drain bank accounts. Only install apps from the official app store.": "هذا الرابط يثبّت برنامجاً. تطبيقات APK المزيفة تستطيع قراءة رموز الرسائل وسرقة الحسابات البنكية. ثبّت التطبيقات من المتجر الرسمي فقط.",
  "Long links can hide the real address in the noise.": "الروابط الطويلة قد تخفي العنوان الحقيقي وسط الحشو.",
  "Google Safe Browsing has no record of this address. New scam sites appear every hour, so this is not a guarantee.": "لا يوجد سجل لهذا العنوان لدى Google Safe Browsing. تظهر مواقع احتيال جديدة كل ساعة، لذا هذا ليس ضماناً."
};
const DETAIL_RE = [
  [/^The :(\d+) in the address is rare for real websites\.$/, m => "رقم المنفذ " + iso(":" + m[1]) + " في العنوان نادر في المواقع الحقيقية."],
  [/^Addresses ending in \.(\S+) are cheap and common in phishing campaigns\.$/, m => "العناوين المنتهية بـ " + iso("." + m[1]) + " رخيصة وشائعة في حملات التصيد."],
  [/^(\S+) is a government address\. Still type it yourself rather than following links in messages\.$/, m => iso(m[1]) + " عنوان حكومي. ومع ذلك اكتبه بنفسك بدلاً من فتح الروابط الواردة في الرسائل."],
  [/^The link names (.+) but points to a bare server address that .+ would never use\.$/, m => "يذكر الرابط " + brand(m[1]) + " لكنه يشير إلى عنوان خادم رقمي لا تستخدمه هذه الجهة أبداً."],
  [/^(\S+) belongs to (.+)\.$/, m => iso(m[1]) + " يتبع " + brand(m[2]) + "."],
  [/^(?:The address imitates "(.+?)" by swapping letters for numbers or similar shapes\. )?It mentions (.+) but the real site is (\S+), which .+ doesn't own\.$/,
    m => (m[1] ? "يقلّد العنوان كلمة " + iso('"' + m[1] + '"') + " باستبدال حروف بأرقام أو أشكال متشابهة. " : "") + "يذكر " + brand(m[2]) + " لكن الموقع الحقيقي هو " + iso(m[3]) + "، وهو لا يتبع هذه الجهة."],
  [/^"(.+)" is one or two letters away from "(.+)"\. This is called typosquatting\.$/, m => iso('"' + m[1] + '"') + " يختلف بحرف أو حرفين فقط عن " + iso('"' + m[2] + '"') + ". يسمى هذا التحريف الإملائي للنطاقات (Typosquatting)."],
  [/^The rest of the link names (.+), but the site is (\S+), which .+ doesn't own\.$/, m => "يذكر باقي الرابط " + brand(m[1]) + "، لكن الموقع هو " + iso(m[2]) + "، وهو لا يتبع هذه الجهة."],
  [/^Contains: (.+)\. Scam links lean on words about accounts, payments and urgency\.$/, m => "يحتوي على: " + iso(m[1]) + ". تعتمد روابط الاحتيال على كلمات عن الحسابات والدفع والاستعجال."],
  [/^(\S+) redirects to (\S+)\. The checks below are for the real destination\.$/, m => iso(m[1]) + " يحوّل إلى " + iso(m[2]) + ". الفحوصات أدناه تخص الوجهة الحقيقية."],
  [/^This (address|website) is listed as phishing by (.+), a public list of reported scam sites\. Do not open it\.$/, m => (m[1] === "address" ? "هذا العنوان" : "هذا الموقع") + " مدرج كموقع تصيد في " + iso(m[2]) + "، وهي قائمة عامة لمواقع الاحتيال المبلّغ عنها. لا تفتحه."],
  [/^A model trained on ([\d,]+) known phishing and genuine website names rates this one (\d+)% likely to be phishing\. It judges the name only, not the page\.$/, m => "نموذج مدرَّب على " + m[1] + " اسم موقع، حقيقي ومعروف بالتصيد، يقدّر احتمال أن يكون هذا الموقع للتصيد بنسبة " + m[2] + "%. يحكم على الاسم فقط، وليس على محتوى الصفحة."],
  [/^Google has flagged this address as: (.+)\. Do not open it\.$/, m => "صنّفت Google هذا العنوان على أنه: " + iso(m[1]) + ". لا تفتحه."],
  [/^(\S+) was registered (today|yesterday|\d+ days ago)\. Most scam sites are only days old; real banks, couriers and government sites have existed for years\.$/, m => "سُجّل " + iso(m[1]) + " " + WHEN_AR(m[2]) + ". معظم مواقع الاحتيال عمرها أيام فقط، أما مواقع البنوك وشركات التوصيل والجهات الحكومية الحقيقية فموجودة منذ سنوات."],
  [/^(\S+) is less than a month old\. Scam sites are usually new; be careful with any request for payment or details\.$/, m => "عمر " + iso(m[1]) + " أقل من شهر. مواقع الاحتيال تكون جديدة عادة، فاحذر من أي طلب للدفع أو للبيانات."],
  [/^(\S+) was registered (\d+) months ago\.$/, m => "سُجّل " + iso(m[1]) + " قبل " + m[2] + " أشهر."]
];
function fromRules(s, exact, rules) {
  if (exact[s]) return exact[s];
  for (const [re, fn] of rules) { const m = s.match(re); if (m) return fn(m); }
  return s;
}
export const flagTitle = s => (isAr && s ? fromRules(s, TITLE_AR, TITLE_RE) : s);
export const flagDetail = s => (isAr && s ? fromRules(s, DETAIL_AR, DETAIL_RE) : s);

/* ---------- static page text ---------- */
const STATIC = {
  // shared
  "brand.eyebrow": "كن واعياً",
  "foot.back": "العودة إلى فحص الاحتيال",
  // homepage
  "home.title": "كن واعياً | فحص الاحتيال",
  "home.h1": "هل هذا احتيال؟",
  "home.lede": "افحص الرابط أو الرسالة أو لقطة الشاشة المشبوهة قبل أن تضغط أو تدفع أو ترد.",
  "home.callout": "<b>غير متأكد؟ اتصل بـ 901</b><p>الرقم غير الطارئ للشرطة للاستفسار عن الاحتيال والإبلاغ عنه. في الحالات الطارئة اتصل بـ 999.</p>",
  "home.ex.watch": "<b>رصد المواقع المزيفة</b><span>مواقع جديدة تقلّد جهات إماراتية، تُكتشف قبل أن يبلّغ عنها أحد</span>",
  "home.ex.search": "<b>تجربة نتائج البحث</b><span>شاهد الشارات التي تضيفها إضافة المتصفح إلى نتائج البحث في Google و Bing</span>",
  "home.ex.game": "<b>تحدي كن واعياً</b><span>لعبة التوعية التفاعلية، بالعربية والإنجليزية</span>",
  "home.tab.link": "افحص رابطاً", "home.tab.message": "افحص رسالة", "home.tab.quiz": "العب التحدي",
  "home.link.label": "الرابط المراد فحصه", "home.link.btn": "افحص الرابط", "home.try": "جرّب:",
  "home.chip.lookalike": "موقع مقلّد", "home.chip.short": "رابط مختصر", "home.chip.ip": "عنوان IP", "home.chip.apk": "تنزيل تطبيق", "home.chip.gov": "موقع حكومي رسمي",
  "home.ai.head": "<h3>رأي ثانٍ من الذكاء الاصطناعي</h3><p class=\"hint\">يقرأ الذكاء الاصطناعي بنية الرابط فقط، ولا يفتح الصفحة.</p>",
  "home.ai.btn": "اسأل الذكاء الاصطناعي",
  "home.msg.label": "نص الرسالة النصية أو رسالة واتساب أو البريد الإلكتروني <span class=\"hint\">(تم تحميل مثال)</span>",
  "home.msg.shot": "أضف لقطة شاشة", "home.msg.remove": "إزالة",
  "home.msg.btn": "حلّل بالذكاء الاصطناعي",
  "home.msg.privacy": "احذف الأسماء وأرقام الحسابات والرموز قبل اللصق.",
  "home.qs": "<h3>فحص سريع</h3><p class=\"hint\">علامات التحذير الموجودة في النص، وتتحدث أثناء الكتابة.</p>",
  "home.quiz.head": "<h2>تحدي كن واعياً</h2><p class=\"hint\">اكتشف علامات التحذير في رسالة طرد مزيفة وإعلان توظيف مزيف على إنستغرام. بالعربية والإنجليزية.</p>",
  "home.quiz.open": "فتح بملء الشاشة",
  "home.rules.h": "أربع قواعد توقف معظم عمليات الاحتيال",
  "home.rule1": "<b>لا تشارك الرموز أبداً</b><p>لن يطلب منك أي بنك أو شرطي أو شركة رمز التحقق (OTP) أو الرقم السري أو رمز CVV أو كلمة المرور. من يطلبها محتال.</p>",
  "home.rule2": "<b>الاستعجال يعني توقّف</b><p>«خلال 12 ساعة»، «لتجنب القبض عليك»، «تم إيقاف حسابك». الاستعجال هدفه أن يمنعك من التفكير.</p>",
  "home.rule3": "<b>اذهب بنفسك</b><p>افتح التطبيق الرسمي أو اكتب عنوان الموقع بنفسك. اتصل بالرقم الموجود خلف بطاقتك، وليس بالرقم الوارد في الرسالة.</p>",
  "home.rule4": "<b>اقرأ النطاق الحقيقي</b><p>المهم هو الجزء الذي يسبق أول شرطة مائلة مفردة: في <span class=\"mono\" dir=\"ltr\">bank.com.verify.xyz</span> الموقع الحقيقي هو <span class=\"mono\" dir=\"ltr\">verify.xyz</span>.</p>",
  "home.types.h": "عمليات احتيال شائعة الآن",
  "home.type1": "<h3>رسوم توصيل مزيفة</h3><p>رسالة نصية تقول إن طردك محتجز وتطلب رسوماً بسيطة، وصفحة الدفع تسرق بيانات بطاقتك.</p><p class=\"tell\">العلامة: مبلغ صغير، ونطاق غريب، ومهلة قصيرة.</p>",
  "home.type2": "<h3>مخالفات وجهات رسمية مزيفة</h3><p>رسائل أو مكالمات تنتحل صفة الشرطة أو جهة حكومية، وتدّعي وجود مخالفة أو قضية.</p><p class=\"tell\">العلامة: تهديد بالقبض ودفع عبر رابط.</p>",
  "home.type3": "<h3>مكالمة «أمن» البنك</h3><p>متصل يقول إن بطاقتك موقوفة، ويطلب الرمز الذي سيصلك «للتحقق» منك.</p><p class=\"tell\">العلامة: يطلب رمز التحقق. أغلق الخط.</p>",
  "home.type4": "<h3>عروض المهام والوظائف</h3><p>أموال سهلة مقابل الإعجاب بالفيديوهات أو تقييم المنتجات. أرباح صغيرة في البداية، ثم يُطلب منك إيداع المال.</p><p class=\"tell\">العلامة: تدفع لكي تربح.</p>",
  "home.type5": "<h3>الاستثمار والعملات الرقمية</h3><p>أرباح مضمونة، وترويج باسم المشاهير، وتطبيقات تداول لا يمكنك السحب منها.</p><p class=\"tell\">العلامة: ربح مضمون.</p>",
  "home.type6": "<h3>الجوائز واليانصيب</h3><p>«ربحت» في سحب لم تشارك فيه، وعليك دفع رسوم أو إرسال صورة الهوية.</p><p class=\"tell\">العلامة: تدفع لتستلم جائزة.</p>",
  "home.type7": "<h3>سرقة الحساب</h3><p>«صديق» يطلب الرمز المكوّن من 6 أرقام الذي وصلك «بالخطأ»، وهو في الحقيقة رمز الدخول إلى واتساب أو بريدك.</p><p class=\"tell\">العلامة: أي طلب لإعادة إرسال رمز.</p>",
  "home.type8": "<h3>تطبيقات مزيفة (APK)</h3><p>رابط يطلب منك تثبيت تطبيق لتتبع طرد أو دفع فاتورة، والتطبيق يقرأ رسائلك ورموز البنك.</p><p class=\"tell\">العلامة: تنزيل من خارج متجر التطبيقات.</p>",
  "home.help.h": "إذا ضغطت على الرابط أو دفعت بالفعل",
  "home.help.list": "<li><b>اتصل ببنكك فوراً</b> على الرقم الموجود على بطاقتك، واطلب إيقاف البطاقة ووقف التحويل أو استرجاعه.</li><li><b>أمّن حساباتك.</b> غيّر كلمات المرور، وفعّل التحقق بخطوتين، وسجّل الخروج من الأجهزة الأخرى.</li><li><b>احذف</b> أي تطبيق جعلك الرابط تنزّله.</li><li><b>احتفظ بالأدلة:</b> لقطات الشاشة وأرقام الهواتف والروابط ومراجع العمليات.</li><li><b>أبلغ الشرطة</b> وحذّر جهات اتصالك إذا استُخدم حسابك.</li>",
  "home.contact.h": "التواصل مع الشرطة",
  "home.contact.901": "استفسارات الاحتيال والبلاغات (غير طارئ)", "home.contact.999": "الطوارئ",
  "home.contact.note": "الإبلاغ يساعد الشرطة على تحذير الآخرين وتتبع الأموال، حتى لو كانت الخسارة صغيرة.",
  "home.footer": "خدمة توعوية من <b>كن واعياً</b>. النتائج إرشادية فقط: الدرجة المنخفضة لا تثبت أن الرابط أو الرسالة آمنة. تُفحص الروابط والرسائل تلقائياً على خادمنا ولا تُخزَّن. <a href=\"/privacy\">الخصوصية</a> · <a href=\"/watch\">رصد المواقع المزيفة</a>",
  // fake sites watch
  "watch.title": "رصد المواقع المزيفة | كن واعياً",
  "watch.eyebrow": "كن واعياً · رصد المواقع المزيفة",
  "watch.h1": "مواقع مزيفة تقلّد جهات إماراتية",
  "watch.lede": "قائمة مباشرة متاحة للجميع: مواقع تنتحل صفة الخدمات الحكومية والبنوك وشركات الاتصالات والتوصيل والتطبيقات في الإمارات. تُكتشف مبكراً من كل نطاق جديد يُسجَّل (نحو 70,000 نطاق يومياً) ومن القوائم العامة لمواقع التصيد النشطة. إذا كان رابط وصلك موجوداً في هذه القائمة فلا تفتحه. ويمكن للجهات والسلطات تصدير القائمة لإزالة هذه المواقع.",
  "watch.f.brand": "الجهة", "watch.f.source": "المصدر", "watch.f.level": "الخطورة", "watch.f.status": "الحالة",
  "watch.all": "الكل", "watch.src.nrd": "نطاق مسجّل حديثاً", "watch.lv.high": "العالية فقط", "watch.lv.med": "المتوسطة والعالية",
  "watch.st.new": "جديد", "watch.st.reviewed": "تمت المراجعة", "watch.st.reported": "تم الإبلاغ", "watch.st.ignored": "تم التجاهل",
  "watch.export": "تصدير CSV",
  "watch.th": "<th>الخطورة</th><th>الموقع</th><th>ينتحل صفة</th><th>اكتُشف عبر</th><th>تاريخ التسجيل</th><th>السبب</th><th>الحالة</th>",
  "watch.loading": "جارٍ التحميل…",
  "watch.note": "تظهر أسماء المواقع كنص وليس كروابط، حتى لا يفتح أحد موقع احتيال بالخطأ. زر «افحص» يفتح التحليل الكامل. تواريخ التسجيل مأخوذة من سجلات النطاقات (RDAP)، وللمواقع على الاستضافة المشتركة يكون التاريخ هو تاريخ منصة الاستضافة.",
  // privacy
  "privacy.title": "الخصوصية | فحص الاحتيال | كن واعياً"
};

// Internal links keep the chosen language even when the browser can't store it.
export function withLang(href) {
  if (!isAr || !href || !href.startsWith("/") || href.startsWith("/api/") || href.startsWith("//")) return href;
  const u = new URL(href, location.origin);
  u.searchParams.set("lang", "ar");
  return u.pathname + u.search + u.hash;
}

function applyStatic() {
  if (isAr) {
    for (const e of document.querySelectorAll("[data-i18n]")) {
      const ar = STATIC[e.dataset.i18n];
      if (ar == null) continue;
      if (e.tagName === "TITLE") document.title = ar; else e.innerHTML = ar;
    }
    for (const a of document.querySelectorAll("a[href^='/']")) a.setAttribute("href", withLang(a.getAttribute("href")));
  }
  for (const e of document.querySelectorAll("[data-lang]")) e.hidden = e.dataset.lang !== LANG;
}

function addSwitch() {
  const b = document.createElement("button");
  b.type = "button"; b.className = "lang-btn";
  b.textContent = isAr ? "English" : "عربي";
  b.lang = isAr ? "en" : "ar";
  b.setAttribute("aria-label", isAr ? "Switch to English" : "التبديل إلى العربية");
  b.addEventListener("click", () => {
    const next = isAr ? "en" : "ar";
    try { localStorage.setItem("lang", next); } catch { /* the address carries it */ }
    const u = new URL(location.href);
    u.searchParams.set("lang", next);
    location.href = u.href;
  });
  (document.querySelector(".wrap") || document.body).prepend(b);
}

// Site pages (they have a .wrap column). The search demo page only borrows the translations.
if (document.querySelector(".wrap")) { applyStatic(); addSwitch(); }
document.documentElement.classList.remove("i18n-wait");
