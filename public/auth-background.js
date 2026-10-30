// Dependency-free Canvas adaptation of the supplied animated-dot shader.
(() => {
  'use strict';
  const canvas = document.getElementById('authDots');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const spacing = 22;
  let width = 0, height = 0, raf = 0, last = 0, started = performance.now();
  let reduced = preference.matches;
  const noise = (x,y) => { const z = Math.sin(x*127.1+y*311.7)*43758.5453123; return z-Math.floor(z); };
  function paint(t) {
    ctx.clearRect(0, 0, width, height);
    const midX = width/2, midY = height/2;
    for (let y=0; y<height; y+=spacing) {
      for (let x=0; x<width; x+=spacing) {
        const n=noise(x/spacing,y/spacing), distance=Math.hypot(x-midX,y-midY);
        const intro=Math.min(1,Math.max(0,(t-distance*.0017-n*.6)*2));
        if (!intro) continue;
        const drift=reduced?.35:(.5+.5*Math.sin(t*.62+n*12));
        const opacity=intro*(.13+n*.12+drift*.16);
        ctx.fillStyle=n>.87?`rgba(80,192,232,${opacity})`:`rgba(236,246,255,${opacity})`;
        const size=n>.87?4.1:3.2;
        ctx.fillRect(x+spacing/2,y+spacing/2,size,size);
      }
    }
  }
  function resize() {
    width=window.innerWidth; height=window.innerHeight;
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr);
    canvas.style.width=width+'px'; canvas.style.height=height+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if (reduced) paint(7);
  }
  function frame(now) {
    if (document.hidden || reduced) { raf=0; return; }
    if (now-last>=1000/24) { paint((now-started)/1000); last=now; }
    raf=requestAnimationFrame(frame);
  }
  function update() {
    reduced=preference.matches;
    if (raf) cancelAnimationFrame(raf);
    raf=0;
    if (reduced) paint(7);
    else if (!document.hidden) raf=requestAnimationFrame(frame);
  }
  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',update);
  if (preference.addEventListener) preference.addEventListener('change',update);
  else preference.addListener(update);
  resize();
  update();
})();