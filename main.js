(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer:fine)').matches;

  // Contact form -> emailed to contact@nervtech.in via FormSubmit (static site, no backend of its own).
  // shortcut: FormSubmit needs a one-time "Activate Form" click from the contact@ inbox; move to an own backend if volume grows.
  const MAIL = 'contact@nervtech.in';
  const form = $('#form'), note = $('#formNote'), sendBtn = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) { note.textContent = 'Please fill in your name, a valid email and a message.'; return; }
    const d = Object.fromEntries(new FormData(form));
    if (d._honey) return; // bot filled the hidden field
    sendBtn.disabled = true; note.textContent = 'Sending…';
    try {
      const r = await fetch(`https://formsubmit.co/ajax/${MAIL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: d.name, email: d.email, message: d.message, _replyto: d.email,
          _subject: `NERV TECH website — ${d.topic || 'Enquiry'} from ${d.name}`, _template: 'table', _captcha: 'false' })
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok || String(res.success) !== 'true') throw new Error(res.message || r.status);
      form.reset(); note.textContent = 'Thanks — your message has been sent. We’ll get back to you soon.';
    } catch {
      note.innerHTML = `Couldn’t send right now. Please email us at <a href="mailto:${MAIL}">${MAIL}</a>.`;
    } finally { sendBtn.disabled = false; }
  });
  // "Request a Demo" buttons tag the enquiry with the product and start the message for the visitor.
  $$('[data-demo]').forEach(b => b.addEventListener('click', () => {
    form.topic.value = 'Demo request: ' + b.dataset.demo;
    if (!form.message.value.trim()) form.message.value = `Hi, I'd like a demo of ${b.dataset.demo}.`;
  }));

  // Mobile menu
  const burger = $('#burger'), links = $('#links');
  let onMenu = () => {}; // replaced with Lenis stop/start once Lenis exists
  const setMenu = o => { burger.setAttribute('aria-expanded', o); links.classList.toggle('open', o); document.documentElement.classList.toggle('menu-open', o); onMenu(o); };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));

  // Product panels (Drone / TRACK / CCTV): one visible at a time; switched by tabs, hero strip and cards.
  let motion = false, seen = false;
  const animIn = p => { seen = true; gsap.fromTo($$('.pa', p), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'expo.out', stagger: .07, overwrite: true }); };
  const showPanel = id => {
    const next = document.getElementById(id);
    if (!next) return;
    $$('.panel').forEach(p => (p.hidden = p !== next));
    $$('.ptabs a').forEach(a => a.setAttribute('aria-selected', a.hash === '#' + id));
    $$('.hs').forEach(a => { const on = a.hash === '#' + id; a.classList.toggle('on', on); a.querySelector('.ico').classList.toggle('acc', on); });
    if (motion) { animIn(next); ScrollTrigger.refresh(); }
  };
  const panelOf = a => { const t = $(a.getAttribute('href')); return t && t.classList.contains('panel') ? t : null; };

  // Graceful fallback: no GSAP (CDN blocked / reduced motion) => plain static page.
  if (!window.gsap || !window.ScrollTrigger || still) {
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      setMenu(false);
      const p = panelOf(a);
      if (p) { e.preventDefault(); showPanel(p.id); if (!a.closest('.ptabs')) $('#product').scrollIntoView(); }
    }));
    return;
  }
  motion = true;
  document.documentElement.classList.add('js');
  history.scrollRestoration = 'manual'; // intro always plays from the top
  scrollTo(0, 0);
  gsap.registerPlugin(ScrollTrigger);

  // ---------- Smooth scroll (Lenis + ScrollTrigger, same stack as the reference sites)
  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  onMenu = o => (o ? lenis.stop() : lenis.start());
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = $(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault(); setMenu(false);
    const p = panelOf(a);
    if (p) { showPanel(p.id); if (a.closest('.ptabs')) return; }
    lenis.scrollTo(a.getAttribute('href') === '#home' ? 0 : p ? '#product' : t, { duration: 1.4, easing: x => 1 - Math.pow(1 - x, 4) });
  }));
  ScrollTrigger.create({ trigger: '#product', start: 'top 75%', once: true, onEnter: () => seen || animIn($('.panel:not([hidden])')) });

  // ---------- Split headings into masked words
  $$('[data-split]').forEach(h => {
    const out = [];
    const walk = (node, accent) => node.childNodes.forEach(n => {
      if (n.nodeType === 3) n.textContent.split(/\s+/).filter(Boolean).forEach(word => {
        const w = document.createElement('span'); w.className = 'w' + (accent ? ' a' : '');
        w.innerHTML = '<i></i>'; w.firstChild.textContent = word;
        out.push(w, document.createTextNode(' '));
      });
      else if (n.nodeName === 'BR') out.push(n.cloneNode());
      else walk(n, accent || n.nodeName === 'EM');
    });
    walk(h, false);
    h.replaceChildren(...out);
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    gsap.set($$('.w>i', h), { yPercent: 115 });
    gsap.to($$('.w>i', h), { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: h, start: 'top 85%' } });
  });

  // ---------- Generic reveals (batched so siblings stagger)
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    onEnter: els => gsap.fromTo(els, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.12, overwrite: true })
  });

  // ---------- Parallax
  $$('[data-speed]').forEach(el => gsap.to(el, {
    yPercent: parseFloat(el.dataset.speed) * -100, ease: 'none',
    scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true }
  }));

  // Hero scroll-out: photo drifts + zooms, copy lifts faster (depth).
  const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
  gsap.to('.hero-img', { yPercent: 12, scale: 1.08, ease: 'none', scrollTrigger: heroST });
  gsap.to('.hero-inner', { yPercent: -18, opacity: .2, ease: 'none', scrollTrigger: heroST });

  // Layer drift inside cards / product
  const drift = (sel, from, to) => $$(sel).forEach(el => gsap.fromTo(el, { yPercent: from }, { yPercent: to, ease: 'none', scrollTrigger: { trigger: el.closest('.card,section'), start: 'top bottom', end: 'bottom top', scrub: true } }));
  drift('.f-mtn', -6, 8); drift('.f-drone', 14, -14); drift('.d-img', 6, -6);

  // About building rises in
  gsap.fromTo('.b-wrap', { yPercent: 14, xPercent: 6 }, { yPercent: 0, xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'center center', scrub: true } });

  // Counter
  $$('.count').forEach(el => {
    const o = { v: 0 };
    gsap.to(o, { v: +el.dataset.to, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 90%' }, onUpdate: () => (el.textContent = Math.round(o.v)) });
  });

  // ---------- Nav: always visible (sticky), glass after 40px, active link by section
  const nav = $('.nav');
  lenis.on('scroll', ({ scroll }) => nav.classList.toggle('scrolled', scroll > 40));
  const map = { home: 'home', work: 'work', product: 'work', capabilities: 'work', about: 'about', trusted: 'about', contact: 'contact' };
  Object.keys(map).forEach(id => ScrollTrigger.create({
    trigger: '#' + id, start: 'top 50%', end: 'bottom 50%',
    onToggle: s => s.isActive && $$('.links a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + map[id]))
  }));

  // ---------- Hero: mouse parallax on drone, telemetry jitter
  if (fine) {
    const xTo = gsap.quickTo('.hero-img', 'x', { duration: 1.4, ease: 'power3' }), yTo = gsap.quickTo('.hero-img', 'y', { duration: 1.4, ease: 'power3' });
    addEventListener('mousemove', e => { xTo((e.clientX / innerWidth - 0.5) * -24); yTo((e.clientY / innerHeight - 0.5) * -14); });
  }
  const lat = $('#lat'), lon = $('#lon');
  setInterval(() => {
    lat.textContent = (17 + (Math.random() - .5) * 0.0006).toFixed(4) + '° N';
    lon.textContent = (81.84 + (Math.random() - .5) * 0.0006).toFixed(4) + '° E';
  }, 1600);

  // ---------- Magnetic buttons + card tilt (fine pointers only)
  if (fine) {
    $$('.magnetic').forEach(b => {
      const x = gsap.quickTo(b, 'x', { duration: .5, ease: 'power3' }), y = gsap.quickTo(b, 'y', { duration: .5, ease: 'power3' });
      b.addEventListener('mousemove', e => { const r = b.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * .3); y((e.clientY - r.top - r.height / 2) * .35); });
      b.addEventListener('mouseleave', () => { x(0); y(0); });
    });
    $$('[data-tilt]').forEach(c => {
      const rx = gsap.quickTo(c, 'rotationX', { duration: .6, ease: 'power3' }), ry = gsap.quickTo(c, 'rotationY', { duration: .6, ease: 'power3' });
      gsap.set(c, { transformPerspective: 1100 });
      c.addEventListener('mousemove', e => { const r = c.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - .5) * 5); rx(-((e.clientY - r.top) / r.height - .5) * 5); });
      c.addEventListener('mouseleave', () => { rx(0); ry(0); });
    });
  }

  // ---------- Intro: hero reveal on load (no loading screen)
  gsap.timeline({ delay: .1 })
    .fromTo('.hero-scene', { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: 2.2, ease: 'expo.out' })
    .to('[data-hero-title] .ln>span', { y: 0, yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .12 }, '<+.1')
    .to('[data-fade]', { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: .1 }, '<+.3')
    .fromTo('.nav', { opacity: 0 }, { opacity: 1, duration: .8, ease: 'power2.out' }, 0); // fade only: nav position is never animated
})();
