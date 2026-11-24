// Demo results page: never navigate to the (possibly malicious) sample links.
document.addEventListener("click", e => {
  const a = e.target.closest?.(".demo-result a");
  if (!a) return;
  e.preventDefault();
  alert("Demo page: links are disabled. Click the badge to see the full check.");
}, true);
