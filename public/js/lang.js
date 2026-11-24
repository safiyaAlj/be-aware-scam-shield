// Chooses the page language before anything is drawn, so an Arabic page never flashes in English
// or left-to-right. Order: ?lang= in the address, then the visitor's earlier choice, then the
// browser's language. js/i18n.js then translates the text and adds the language button.
(function () {
  var lang = "en";
  try {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "ar" || q === "en") {
      lang = q;
      try { localStorage.setItem("lang", q); } catch (e) { /* storage blocked: the address still carries it */ }
    } else {
      var saved = null;
      try { saved = localStorage.getItem("lang"); } catch (e) { /* ignore */ }
      if (saved === "ar" || saved === "en") lang = saved;
      else if ((navigator.language || "").toLowerCase().indexOf("ar") === 0) lang = "ar";
    }
  } catch (e) { /* keep English */ }
  var html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ar" ? "rtl" : "ltr";
  if (lang === "ar") {
    html.classList.add("i18n-wait");
    setTimeout(function () { html.classList.remove("i18n-wait"); }, 2500); // never stay hidden
  }
})();
