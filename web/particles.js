(function(){
  const COUNT = 80;   // Original: 100–200. Weniger = sparsamer für schwache Geräte.

  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const rnd = (min, max) => min + Math.random() * (max - min);
  const root = document.createElement('div');
  root.className = 'particles';
  root.setAttribute('aria-hidden', 'true');

  const frag = document.createDocumentFragment();
  for(let i = 0; i < COUNT; i++){
    const p = document.createElement('div');
    p.className = 'particle';
    const dur = rnd(28, 37);                       // Sekunden für einmal quer durch
    const s = p.style;
    s.setProperty('--size',  rnd(2, 8).toFixed(1) + 'px');
    s.setProperty('--dur',   dur.toFixed(1) + 's');
    s.setProperty('--delay', (-rnd(0, dur)).toFixed(1) + 's');   // negativ: Partikel sind sofort verteilt
    s.setProperty('--pdelay', (-rnd(0, 4)).toFixed(1) + 's');
    s.setProperty('--fade',  rnd(0.8, 1.6).toFixed(2) + 's');
    s.setProperty('--x0', rnd(0, 100).toFixed(1) + 'vw');
    s.setProperty('--x1', rnd(0, 100).toFixed(1) + 'vw');
    s.setProperty('--y0', rnd(100, 110).toFixed(1) + 'vh');      // startet unter dem Bildschirm
    s.setProperty('--y1', (-rnd(10, 30)).toFixed(1) + 'vh');     // endet über dem Bildschirm
    frag.appendChild(p);
  }
  root.appendChild(frag);
  document.body.appendChild(root);
})();