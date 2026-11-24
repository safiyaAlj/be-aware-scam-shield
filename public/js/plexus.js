// Animated network background, the same as in the كن واعياً game page (public/game/index.html).
// Stays still for people who ask for reduced motion.
const c = document.getElementById("plexus");
if (c && c.getContext) {
  const x = c.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w, h, pts = [];
  const size = () => {
    const d = Math.min(2, devicePixelRatio || 1);
    w = innerWidth; h = innerHeight; c.width = w * d; c.height = h * d; x.setTransform(d, 0, 0, d, 0, 0);
    const n = Math.round(Math.min(110, (w * h) / 9000));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: Math.random() * 1.6 + 0.4 }));
  };
  const draw = () => {
    x.clearRect(0, 0, w, h);
    const L2 = 130 * 130;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (!still) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; }
      for (let j = i + 1; j < pts.length; j++) {
        const q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
        if (d < L2) { x.strokeStyle = `rgba(230,222,210,${0.22 * (1 - d / L2)})`; x.lineWidth = 0.6; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.stroke(); }
      }
      x.fillStyle = "rgba(240,234,224,.75)"; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
    }
    if (!still) requestAnimationFrame(draw);
  };
  size(); draw();
  addEventListener("resize", () => { size(); if (still) draw(); });
}
