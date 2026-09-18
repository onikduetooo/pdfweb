/* ══════════════════════════════════════════════════════════
   PixelPress v40 — Complete Script
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  (function () {
    const _warn = console.warn.bind(console);
    const _error = console.error.bind(console);
    const SILENT = ['Third-party cookie','was not used','navigator.standalone','preload','deprecated','willReadFrequently','Canvas2D: Multiple readback','Ignoring unsupported entryTypes'];
    console.warn = function () {
      const args = Array.prototype.slice.call(arguments);
      const msg = String(args[0] || '') + ' ' + String(args[1] || '');
      if (SILENT.some(function (p) { return msg.indexOf(p) !== -1; })) return;
      _warn.apply(console, args);
    };
    console.error = function () {
      const args = Array.prototype.slice.call(arguments);
      const msg = String(args[0] || '') + ' ' + String(args[1] || '');
      if (msg.indexOf('Third-party cookie') !== -1) return;
      _error.apply(console, args);
    };
  })();

  function safe(label, fn) {
    try { fn(); }
    catch (err) { console.warn('[PixelPress] ' + label + ':', err && err.message); }
  }

  const CONFIG = {
    maxFileSize: 25 * 1024 * 1024,
    accepted: ['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/bmp'],
    marginPt: { none: 0, small: 18, medium: 36, large: 54 },
    pageSizes: { a4:[595.28,841.89], letter:[612,792], legal:[612,1008], a3:[841.89,1190.55], a5:[419.53,595.28] }
  };

  const SETTINGS_KEY = 'pp-settings-v3';
  const PP_BLOCK_KEY = 'pp-install-blocked-v11';
  const PP_LATER_KEY = 'pp-install-later-v11';
  const PP_INSTALLED_KEY = 'pp-installed-v2';

  const state = { items: [], uid: 0, busy: false, pdfBlob: null, pdfUrl: null, pdfName: null };
  const installState = {
    deferredPrompt: null, visible: false, isInstalled: false,
    isAndroid: false, isIOS: false, isIOSSafari: false, isIOSOther: false,
    isMobile: false, isDesktop: false, hasNative: false,
    browser: 'other', hideTimer: null, autoShowTimer: null
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  const el = {};
  function refreshEl() {
    el.header = $('.site-header'); el.nav = $('#primary-nav'); el.menuBtn = $('#menu-toggle');
    el.themeBtn = $('#theme-toggle'); el.dropzone = $('#dropzone'); el.fileInput = $('#file-input');
    el.workspace = $('#workspace'); el.gallery = $('#gallery'); el.imgCount = $('#img-count');
    el.addMore = $('#add-more'); el.clearAll = $('#clear-all'); el.createBtn = $('#create-pdf');
    el.createLabel = $('#create-btn-label'); el.pdfReady = $('#pdf-ready');
    el.pdfReadyMeta = $('#pdf-ready-meta'); el.downloadBtn = $('#download-pdf');
    el.previewBtn = $('#preview-pdf'); el.shareBtn = $('#share-pdf'); el.newPdfBtn = $('#new-pdf');
    el.heroUpload = $('#hero-upload'); el.toast = $('#toast'); el.toastMsg = $('#toast-msg');
    el.toastAction = $('#toast-action'); el.year = $('#year');
    el.filename = $('#opt-filename');
    el.pagenumToggle = $('#opt-pagenum'); el.pagenumOpts = $('#pagenum-opts');
    el.pagenumPos = $('#opt-pagenum-pos'); el.pagenumFormat = $('#opt-pagenum-format');
    el.watermarkToggle = $('#opt-watermark'); el.watermarkOpts = $('#watermark-opts');
    el.watermarkText = $('#opt-watermark-text'); el.watermarkOp = $('#opt-watermark-opacity');
    el.watermarkOpVal = $('#opt-watermark-opval'); el.metaToggle = $('#opt-meta');
    el.metaOpts = $('#meta-opts'); el.metaTitle = $('#opt-meta-title');
    el.metaAuthor = $('#opt-meta-author'); el.pdfaToggle = $('#opt-pdfa');
    el.installTip = $('#install-tip');
    el.installTitle = $('#install-title-text');
    el.installDesc = $('#install-desc');
    el.installIcon = $('#install-icon');
    el.installAction = $('#install-action');
    el.installActionLabel = $('#install-action-label');
    el.installClose = $('#install-close');
    el.installNever = $('#install-never');
    el.installChip = $('#install-chip');
    el.installModal = $('#install-modal');
    el.installModalClose = $('#install-modal-close');
    el.installModalIcon = $('#install-modal-icon');
    el.installModalTitle = $('#install-modal-title');
    el.installModalSubtitle = $('#install-modal-subtitle');
    el.installTabs = $('#install-tabs');
    el.imgModal = $('#img-modal'); el.imgModalImg = $('#img-modal-img');
    el.imgModalTitle = $('#img-modal-title'); el.imgModalMeta = $('#img-modal-meta');
    el.imgModalClose = $('#img-modal-close'); el.imgModalPrev = $('#img-modal-prev');
    el.imgModalNext = $('#img-modal-next');
    el.scrollFab = $('#scroll-fab'); el.scrollProgress = $('#scroll-progress');
    el.pipeline = $('#pipeline'); el.pipelineFill = $('#pipeline-fill');
    el.pipelinePct = $('#pipeline-pct'); el.pipelineTitle = $('#pipeline-title');
    el.pipelineDesc = $('#pipeline-desc'); el.pipelineStages = $('#pipeline-stages');
    el.converter = $('#converter');
  }
  refreshEl();

  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }
  function sanitizeFilename(s) {
    return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function setCookie(name, value, days) {
    try {
      const d = new Date();
      d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax' + secure;
    } catch (e) {}
  }
  function getCookie(name) {
    try {
      const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }

  function smartScrollTo(target, opts) {
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const merged = Object.assign({ behavior: reduce ? 'auto' : 'smooth', block: 'center', inline: 'nearest' }, opts || {});
    try { target.scrollIntoView(merged); }
    catch (e) { try { target.scrollIntoView(); } catch (er) {} }
  }
  function scrollAfterFrame(target, delay) {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        setTimeout(function () { smartScrollTo(target); resolve(); }, delay || 0);
      });
    });
  }

  function initScrollProgress() {
    if (!el.scrollProgress) return;
    let ticking = false;
    function update() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      el.scrollProgress.style.width = pct + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  let toastTimer = null;
  function showToast(msg, actionLabel, actionFn, duration) {
    if (!el.toast || !el.toastMsg) return;
    if (duration == null) duration = 4200;
    clearTimeout(toastTimer);
    el.toastMsg.textContent = msg;
    el.toast.hidden = false;
    el.toast.classList.remove('is-out');
    if (el.toastAction) {
      if (actionLabel && typeof actionFn === 'function') {
        el.toastAction.hidden = false;
        el.toastAction.textContent = actionLabel;
        el.toastAction.onclick = function () { actionFn(); hideToast(); };
      } else {
        el.toastAction.hidden = true;
        el.toastAction.onclick = null;
      }
    }
    toastTimer = setTimeout(hideToast, duration);
  }
  function hideToast() {
    if (!el.toast) return;
    el.toast.classList.add('is-out');
    setTimeout(function () { if (el.toast) el.toast.hidden = true; }, 300);
  }

  function syncThemeBtn(theme) {
    if (!el.themeBtn) return;
    const isDark = theme === 'dark';
    el.themeBtn.setAttribute('aria-pressed', String(isDark));
    el.themeBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }
  function initTheme() {
    if (!el.themeBtn) return;
    syncThemeBtn(document.documentElement.getAttribute('data-theme') || 'light');
    el.themeBtn.addEventListener('click', function () {
      const now = document.documentElement.getAttribute('data-theme');
      const next = now === 'dark' ? 'light' : 'dark';
      const apply = function () {
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('pp-theme', next); } catch (e) {}
        syncThemeBtn(next);
      };
      if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
        document.startViewTransition(apply);
      } else { apply(); }
    });
  }

  function closeNav() {
    if (el.nav) el.nav.classList.remove('is-open');
    if (el.menuBtn) {
      el.menuBtn.setAttribute('aria-expanded', 'false');
      el.menuBtn.setAttribute('aria-label', 'Open menu');
    }
  }
  function initNav() {
    if (!el.nav || !el.menuBtn) return;
    el.menuBtn.addEventListener('click', function () {
      const open = el.nav.classList.toggle('is-open');
      el.menuBtn.setAttribute('aria-expanded', String(open));
      el.menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    el.nav.addEventListener('click', function (e) {
      const link = e.target.closest('a');
      if (!link) return;
      closeNav();
      const href = link.getAttribute('href');
      if (href && href.startsWith('#') && href.length > 1) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          smartScrollTo(target, { block: 'start' });
          try { history.replaceState(null, '', href); } catch (er) {}
        }
      }
    });
    document.addEventListener('click', function (e) {
      if (!el.nav.classList.contains('is-open')) return;
      if (el.nav.contains(e.target) || el.menuBtn.contains(e.target)) return;
      closeNav();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeNav(); if (el.toast && !el.toast.hidden) hideToast(); }
    });
  }

  function initHeaderScroll() {
    if (!el.header) return;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        if (window.scrollY > 12) el.header.classList.add('is-scrolled');
        else el.header.classList.remove('is-scrolled');
        if (el.scrollFab) {
          if (window.scrollY > 600) el.scrollFab.classList.add('is-visible');
          else el.scrollFab.classList.remove('is-visible');
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initReveal() {
    const els = $$('[data-reveal]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('is-visible'); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const delay = parseInt(entry.target.getAttribute('data-reveal-delay') || '0', 10);
        setTimeout(function () { entry.target.classList.add('is-visible'); }, delay);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  function initCounters() {
    const els = $$('.counter');
    if (!els.length) return;
    function run(node) {
      const target = parseFloat(node.getAttribute('data-target')) || 0;
      const decimals = parseInt(node.getAttribute('data-decimals') || '0', 10);
      const suffix = node.getAttribute('data-suffix') || '';
      const dur = 1500, start = performance.now();
      function tick(now) {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        node.textContent = (target * eased).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else node.textContent = target.toFixed(decimals) + suffix;
      }
      requestAnimationFrame(tick);
    }
    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    els.forEach(function (e) { io.observe(e); });
  }

  function initScrollFab() {
    if (!el.scrollFab) return;
    el.scrollFab.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initHowTimeline() {
    const wrap = document.querySelector('[data-how]');
    if (!wrap) return;
    const steps = $$('.how-step', wrap);
    if (!steps.length) return;
    function setActive(target) {
      const tIdx = steps.indexOf(target);
      steps.forEach(function (s, idx) {
        const isTarget = s === target;
        s.classList.toggle('is-active', isTarget);
        s.classList.toggle('is-done', idx < tIdx);
        const btn = s.querySelector('.how-step__head');
        if (btn) btn.setAttribute('aria-expanded', String(isTarget));
      });
    }
    steps.forEach(function (step) {
      const btn = step.querySelector('.how-step__head');
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (step.classList.contains('is-active')) return;
        setActive(step);
      });
    });
    const initial = wrap.querySelector('.how-step.is-active') || steps[0];
    if (initial) setActive(initial);
  }

  function initFaqFilter() {
    const list = document.getElementById('faq-list');
    const search = document.getElementById('faq-search');
    const clear = document.getElementById('faq-clear');
    const empty = document.getElementById('faq-empty');
    const reset = document.getElementById('faq-reset');
    const cats = $$('.faq-cat');
    if (!list || !search) return;

    const items = $$('.faq-item', list);
    items.forEach(function (it) {
      const q = it.querySelector('.faq-item__q');
      if (q) q.dataset.text = q.textContent;
    });

    items.forEach(function (it) {
      const trigger = it.querySelector('.faq-trigger');
      if (!trigger) return;
      trigger.addEventListener('click', function () {
        const isOpen = it.classList.contains('is-open');
        items.forEach(function (other) {
          if (other !== it) {
            other.classList.remove('is-open');
            const t = other.querySelector('.faq-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          }
        });
        it.classList.toggle('is-open', !isOpen);
        trigger.setAttribute('aria-expanded', String(!isOpen));
      });
    });

    let activeCat = 'all';
    let query = '';

    function escapeHtmlLocal(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
      });
    }
    function highlight(text, q) {
      if (!q) return escapeHtmlLocal(text);
      const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      return escapeHtmlLocal(text).replace(re, '<mark>$1</mark>');
    }

    function apply() {
      let visible = 0;
      const q = query.trim().toLowerCase();
      items.forEach(function (it) {
        const cat = it.dataset.cat || 'general';
        const qText = it.querySelector('.faq-item__q');
        const original = qText ? qText.dataset.text : '';
        const matchCat = activeCat === 'all' || cat === activeCat;
        const matchQ = !q || original.toLowerCase().indexOf(q) !== -1;
        if (matchCat && matchQ) {
          it.hidden = false;
          visible++;
          if (qText) qText.innerHTML = highlight(original, q);
        } else {
          it.hidden = true;
          it.classList.remove('is-open');
          const t = it.querySelector('.faq-trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
      if (empty) empty.hidden = visible !== 0;
      if (clear) clear.hidden = !q;
    }

    search.addEventListener('input', function (e) { query = e.target.value; apply(); });

    if (clear) clear.addEventListener('click', function (e) {
      e.preventDefault();
      search.value = '';
      query = '';
      search.focus();
      apply();
    });

    cats.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const cat = btn.dataset.cat;
        activeCat = cat;
        cats.forEach(function (b) {
          const isOn = b === btn;
          b.classList.toggle('is-active', isOn);
          b.setAttribute('aria-selected', String(isOn));
        });
        apply();
      });
    });

    if (reset) reset.addEventListener('click', function () {
      search.value = ''; query = ''; activeCat = 'all';
      cats.forEach(function (b) {
        const isOn = b.dataset.cat === 'all';
        b.classList.toggle('is-active', isOn);
        b.setAttribute('aria-selected', String(isOn));
      });
      apply();
    });

    apply();
  }

  function initUpload() {
    if (!el.dropzone || !el.fileInput) return;
    el.dropzone.addEventListener('click', function () { el.fileInput.click(); });
    el.dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fileInput.click(); }
    });
    if (el.heroUpload) {
      el.heroUpload.addEventListener('click', function () {
        const t = document.getElementById('converter');
        if (t) {
          smartScrollTo(t, { block: 'start' });
          setTimeout(function () { el.fileInput.click(); }, 480);
        } else { el.fileInput.click(); }
      });
    }
    if (el.addMore) el.addMore.addEventListener('click', function () { el.fileInput.click(); });
    el.fileInput.addEventListener('change', function (e) {
      handleFiles(e.target.files);
      e.target.value = '';
    });
    ['dragenter','dragover'].forEach(function (evt) {
      el.dropzone.addEventListener(evt, function (e) {
        e.preventDefault(); e.stopPropagation();
        el.dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave','drop'].forEach(function (evt) {
      el.dropzone.addEventListener(evt, function (e) {
        e.preventDefault(); e.stopPropagation();
        if (evt === 'dragleave' && el.dropzone.contains(e.relatedTarget)) return;
        el.dropzone.classList.remove('is-dragover');
      });
    });
    el.dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });
    ['dragover','drop'].forEach(function (evt) {
      window.addEventListener(evt, function (e) {
        if (!el.dropzone.contains(e.target)) e.preventDefault();
      });
    });
  }

  async function handleFiles(fileList) {
    const files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    let added = 0, rejected = 0, tooBig = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const typeOk = CONFIG.accepted.indexOf(file.type) !== -1 || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
      if (!typeOk) { rejected++; continue; }
      if (file.size > CONFIG.maxFileSize) { tooBig++; continue; }
      try {
        const item = await loadImageItem(file);
        state.items.push(item);
        added++;
      } catch (err) { rejected++; }
    }
    if (added) {
      renderGallery();
      revealWorkspace();
      if (el.filename && !el.filename.value && state.items[0]) {
        el.filename.placeholder = state.items[0].name.replace(/\.[^.]+$/, '').slice(0, 40) || 'document';
      }
      showToast(added === 1 ? 'Image added successfully.' : added + ' images added successfully.');
      if (state.items.length === added) {
        setTimeout(function () {
          const ws = el.workspace;
          if (ws) smartScrollTo(ws, { block: 'start' });
        }, 240);
      }
    }
    if (rejected) showToast(rejected + ' file' + (rejected > 1 ? 's' : '') + ' skipped (unsupported).');
    if (tooBig) showToast(tooBig + ' file' + (tooBig > 1 ? 's' : '') + ' exceeded 25 MB.');
  }

  function loadImageItem(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        if (!img.naturalWidth || !img.naturalHeight) { URL.revokeObjectURL(url); reject(new Error('Invalid')); return; }
        resolve({ id: ++state.uid, file, name: file.name, size: file.size, url, rotation: 0, imgEl: img, w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Load failed')); };
      img.src = url;
    });
  }

  function renderGallery() {
    if (!el.gallery) return;
    el.gallery.innerHTML = '';
    const frag = document.createDocumentFragment();
    state.items.forEach(function (item, i) {
      const li = document.createElement('li');
      li.className = 'thumb';
      li.draggable = true;
      li.dataset.id = String(item.id);
      li.style.animationDelay = (i * 40) + 'ms';
      li.innerHTML =
        '<span class="thumb-drag"><svg class="ic"><use href="#i-grip"/></svg></span>' +
        '<div class="thumb-img"><img alt="" loading="lazy" decoding="async"></div>' +
        '<div class="thumb-meta"><span class="thumb-name"></span><span class="thumb-size"></span></div>' +
        '<div class="thumb-actions">' +
          '<button type="button" class="thumb-btn rotate" aria-label="Rotate"><svg class="ic"><use href="#i-rotate"/></svg></button>' +
          '<button type="button" class="thumb-btn remove" aria-label="Remove"><svg class="ic"><use href="#i-x"/></svg></button>' +
        '</div>';
      const imgEl = li.querySelector('img');
      imgEl.src = item.url; imgEl.alt = item.name;
      li.querySelector('.thumb-name').textContent = item.name;
      li.querySelector('.thumb-size').textContent = fmtSize(item.size);
      if (item.rotation) imgEl.style.transform = 'rotate(' + item.rotation + 'deg) scale(' + (item.rotation % 180 ? 0.82 : 1) + ')';
      li.querySelector('.thumb-img').addEventListener('click', function (e) { e.stopPropagation(); openModal(i); });
      li.querySelector('.rotate').addEventListener('click', function (e) { e.stopPropagation(); rotateItem(item.id); });
      li.querySelector('.remove').addEventListener('click', function (e) { e.stopPropagation(); removeItem(item.id); });
      frag.appendChild(li);
    });
    el.gallery.appendChild(frag);
    if (el.imgCount) el.imgCount.textContent = String(state.items.length);
    if (el.createBtn) {
      el.createBtn.disabled = state.items.length === 0;
      el.createBtn.style.opacity = state.items.length === 0 ? '.55' : '';
    }
    if (state.items.length === 0 && el.workspace) el.workspace.hidden = true;
  }
  function revealWorkspace() { if (el.workspace && el.workspace.hidden) el.workspace.hidden = false; }
  function rotateItem(id) {
    const item = state.items.find(function (x) { return x.id === id; });
    if (!item) return;
    item.rotation = (item.rotation + 90) % 360;
    const t = el.gallery.querySelector('.thumb[data-id="' + id + '"] .thumb-img img');
    if (t) t.style.transform = 'rotate(' + item.rotation + 'deg) scale(' + (item.rotation % 180 ? 0.82 : 1) + ')';
  }
  function removeItem(id) {
    const idx = state.items.findIndex(function (x) { return x.id === id; });
    if (idx === -1) return;
    const removed = state.items.splice(idx, 1)[0];
    if (removed && removed.url) URL.revokeObjectURL(removed.url);
    renderGallery();
    showToast('Image removed.');
  }
  function clearAll() {
    if (!state.items.length) return;
    if (!window.confirm('Remove all ' + state.items.length + ' image(s)?')) return;
    state.items.forEach(function (i) { if (i.url) URL.revokeObjectURL(i.url); });
    state.items = [];
    renderGallery();
    resetPdfState(true);
    showToast('All images cleared.');
  }

  let dragId = null;
  function initSort() {
    if (!el.gallery) return;
    el.gallery.addEventListener('dragstart', function (e) {
      const li = e.target.closest('.thumb');
      if (!li) return;
      dragId = Number(li.dataset.id);
      li.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragId)); } catch (err) {}
    });
    el.gallery.addEventListener('dragend', function () {
      dragId = null;
      $$('.thumb', el.gallery).forEach(function (t) { t.classList.remove('dragging', 'drop-target'); });
    });
    el.gallery.addEventListener('dragover', function (e) {
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (er) {}
      const target = e.target.closest('.thumb');
      if (!target || Number(target.dataset.id) === dragId) return;
      $$('.thumb', el.gallery).forEach(function (t) { t.classList.remove('drop-target'); });
      target.classList.add('drop-target');
    });
    el.gallery.addEventListener('drop', function (e) {
      e.preventDefault();
      const target = e.target.closest('.thumb');
      if (!target) return;
      const toId = Number(target.dataset.id);
      const fromIdx = state.items.findIndex(function (x) { return x.id === dragId; });
      const toIdx = state.items.findIndex(function (x) { return x.id === toId; });
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      const moved = state.items.splice(fromIdx, 1)[0];
      state.items.splice(toIdx, 0, moved);
      renderGallery();
    });
  }

  function loadSavedSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function persistSettings(obj) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj)); } catch (e) {}
  }
  function applySavedSettings() {
    const s = loadSavedSettings();
    if (!s || typeof s !== 'object') return;
    const setRadio = function (name, val) {
      if (!val) return;
      const r = document.querySelector('input[name="' + name + '"][value="' + val + '"]');
      if (r) r.checked = true;
    };
    ['pageSize','orientation','quality','compression','enhance','margin','fitMode'].forEach(function (k) { setRadio(k, s[k]); });
    if (el.pagenumToggle && s.pageNumber != null) el.pagenumToggle.checked = !!s.pageNumber;
    if (el.watermarkToggle && s.watermark != null) el.watermarkToggle.checked = !!s.watermark;
    if (el.watermarkText && s.watermarkText) el.watermarkText.value = s.watermarkText;
    if (el.metaToggle && s.metaEnabled != null) el.metaToggle.checked = !!s.metaEnabled;
    if (el.metaTitle && s.metaTitle) el.metaTitle.value = s.metaTitle;
    if (el.metaAuthor && s.metaAuthor) el.metaAuthor.value = s.metaAuthor;
    if (el.pdfaToggle && s.pdfA != null) el.pdfaToggle.checked = !!s.pdfA;
    if (el.pagenumOpts) el.pagenumOpts.hidden = !(el.pagenumToggle && el.pagenumToggle.checked);
    if (el.watermarkOpts) el.watermarkOpts.hidden = !(el.watermarkToggle && el.watermarkToggle.checked);
    if (el.metaOpts) el.metaOpts.hidden = !(el.metaToggle && el.metaToggle.checked);
  }

  function readSettings() {
    const get = function (name, fallback) {
      const c = document.querySelector('input[name="' + name + '"]:checked');
      return c ? c.value : fallback;
    };
    const s = {
      pageSize: get('pageSize', 'a4'),
      orientation: get('orientation', 'auto'),
      quality: get('quality', 'high'),
      compression: get('compression', 'high'),
      enhance: get('enhance', 'standard'),
      margin: get('margin', 'small'),
      fitMode: get('fitMode', 'fit'),
      filename: sanitizeFilename(el.filename ? el.filename.value : '') || 'document',
      pageNumber: !!(el.pagenumToggle && el.pagenumToggle.checked),
      pageNumberPos: el.pagenumPos ? el.pagenumPos.value : 'bottom-center',
      pageNumberFormat: el.pagenumFormat ? el.pagenumFormat.value : 'n',
      watermark: !!(el.watermarkToggle && el.watermarkToggle.checked),
      watermarkText: el.watermarkText ? el.watermarkText.value.trim() : '',
      watermarkOpacity: el.watermarkOp ? (parseInt(el.watermarkOp.value, 10) || 18) / 100 : 0.18,
      metaEnabled: !!(el.metaToggle && el.metaToggle.checked),
      metaTitle: el.metaTitle ? el.metaTitle.value.trim() : '',
      metaAuthor: el.metaAuthor ? el.metaAuthor.value.trim() : '',
      pdfA: !!(el.pdfaToggle && el.pdfaToggle.checked)
    };
    persistSettings(s);
    return s;
  }

  function initAdvanced() {
    if (el.pagenumToggle && el.pagenumOpts) el.pagenumToggle.addEventListener('change', function () { el.pagenumOpts.hidden = !el.pagenumToggle.checked; });
    if (el.watermarkToggle && el.watermarkOpts) el.watermarkToggle.addEventListener('change', function () {
      el.watermarkOpts.hidden = !el.watermarkToggle.checked;
      if (el.watermarkToggle.checked && el.watermarkText && !el.watermarkText.value) el.watermarkText.value = 'CONFIDENTIAL';
    });
    if (el.watermarkOp && el.watermarkOpVal) el.watermarkOp.addEventListener('input', function () { el.watermarkOpVal.textContent = el.watermarkOp.value + '%'; });
    if (el.metaToggle && el.metaOpts) el.metaToggle.addEventListener('change', function () { el.metaOpts.hidden = !el.metaToggle.checked; });
  }

  let pdfWorker = null;
  let pdfWorkerReqId = 0;
  const pdfWorkerPending = new Map();

  function getPdfWorker() {
    if (pdfWorker !== null) return pdfWorker;
    if (typeof Worker === 'undefined' || !window.OffscreenCanvas || !window.createImageBitmap) {
      pdfWorker = false;
      return false;
    }
    try {
      pdfWorker = new Worker('pdf-worker.js');
      pdfWorker.addEventListener('message', function (ev) {
        const data = ev.data || {};
        const resolver = pdfWorkerPending.get(data.reqId);
        if (!resolver) return;
        if (data.type === 'progress') { resolver.onProgress(data); return; }
        pdfWorkerPending.delete(data.reqId);
        if (data.type === 'done') {
          if (data.buffer) data.blob = new Blob([data.buffer], { type: 'application/pdf' });
          resolver.resolve(data);
        } else {
          resolver.reject(new Error(data.error || 'Worker error'));
        }
      });
      pdfWorker.addEventListener('error', function (ev) {
        pdfWorkerPending.forEach(function (r) { r.reject(new Error('Worker error: ' + (ev.message || ''))); });
        pdfWorkerPending.clear();
      });
      return pdfWorker;
    } catch (e) {
      pdfWorker = false;
      return false;
    }
  }

  async function buildPdfViaWorker(items, settings, onProgress) {
    const worker = getPdfWorker();
    if (!worker) return null;
    const reqId = ++pdfWorkerReqId;
    const transfers = [];
    const payload = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const bmp = await createImageBitmap(item.file);
        transfers.push(bmp);
        payload.push({ bitmap: bmp, rotation: item.rotation || 0, name: item.name });
      } catch (e) {
        payload.push({ file: item.file, rotation: item.rotation || 0, name: item.name });
      }
    }
    return new Promise(function (resolve, reject) {
      pdfWorkerPending.set(reqId, { resolve: resolve, reject: reject, onProgress: onProgress || function(){} });
      worker.postMessage({ reqId: reqId, items: payload, settings: settings }, transfers);
    });
  }

  const pipelineState = { stage: 0, pct: 0 };

  function pipelineShow() {
    if (!el.pipeline) return;
    el.pipeline.hidden = false;
    pipelineSetPct(0);
    pipelineSetStage(0);
    if (el.pipelineTitle) el.pipelineTitle.textContent = 'Composing your document…';
    if (el.pipelineDesc) el.pipelineDesc.textContent = 'Preparing images for processing';
  }
  function pipelineHide() { if (el.pipeline) el.pipeline.hidden = true; }
  function pipelineSetPct(pct) {
    pipelineState.pct = pct;
    if (el.pipelineFill) {
      const c = 276.46;
      el.pipelineFill.style.strokeDashoffset = c - (c * pct / 100);
    }
    if (el.pipelinePct) el.pipelinePct.textContent = Math.round(pct) + '%';
  }
  function pipelineSetStage(stage) {
    pipelineState.stage = stage;
    if (!el.pipelineStages) return;
    $$('.pipeline-stage', el.pipelineStages).forEach(function (node) {
      const num = parseInt(node.getAttribute('data-stage'), 10);
      node.classList.toggle('is-active', num === stage);
      node.classList.toggle('is-done', num < stage);
    });
  }
  function pipelineSetTitle(title, desc) {
    if (el.pipelineTitle) el.pipelineTitle.textContent = title;
    if (el.pipelineDesc) el.pipelineDesc.textContent = desc;
  }
  async function pipelineStage1(total) {
    pipelineSetStage(1);
    pipelineSetTitle('Reading images…', 'Decoding ' + total + ' file' + (total > 1 ? 's' : ''));
    await scrollAfterFrame(el.pipeline, 60);
    for (let i = 0; i < total; i++) {
      pipelineSetPct((i + 1) / total * 18);
      await new Promise(function (r) { setTimeout(r, 40); });
    }
  }
  async function pipelineStage2() {
    pipelineSetStage(2);
    pipelineSetTitle('Enhancing quality…', 'Applying colour science and sharpening');
    for (let p = 18; p <= 45; p += 2) { pipelineSetPct(p); await new Promise(function (r) { setTimeout(r, 25); }); }
  }
  async function pipelineStage3(current, total) {
    pipelineSetStage(3);
    pipelineSetTitle('Composing pages…', 'Page ' + current + ' of ' + total);
    const base = 45 + (current - 1) / total * 40;
    const target = 45 + current / total * 40;
    for (let p = base; p <= target; p += 2) { pipelineSetPct(p); await new Promise(function (r) { setTimeout(r, 20); }); }
  }
  async function pipelineStage4() {
    pipelineSetStage(4);
    pipelineSetTitle('Finalising document…', 'Writing metadata and PDF structure');
    for (let p = 85; p <= 100; p += 2) { pipelineSetPct(p); await new Promise(function (r) { setTimeout(r, 22); }); }
  }

  function showPdfReady(pages, bytes) {
    if (!el.pdfReady) return;
    if (el.pdfReadyMeta) el.pdfReadyMeta.textContent = pages + (pages === 1 ? ' page' : ' pages') + ' · ' + fmtSize(bytes);
    el.pdfReady.hidden = false;
    if (el.createBtn) el.createBtn.style.display = 'none';
    setTimeout(function () { smartScrollTo(el.pdfReady, { block: 'center' }); }, 220);
  }
  function hidePdfReady() {
    if (el.pdfReady) el.pdfReady.hidden = true;
    if (el.createBtn) el.createBtn.style.display = '';
  }
  function downloadPDF() {
    if (!state.pdfUrl) return;
    const a = document.createElement('a');
    a.href = state.pdfUrl;
    a.download = state.pdfName || 'document.pdf';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Downloading ' + (state.pdfName || 'PDF') + '…');
  }
  function previewPDF() {
    if (!state.pdfUrl) return;
    window.open(state.pdfUrl, '_blank', 'noopener');
  }
  async function sharePDF() {
    if (!state.pdfBlob) return;
    const fileName = state.pdfName || 'document.pdf';
    try {
      const file = new File([state.pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'My PDF', text: 'Created with PixelPress' }); return; } catch (e) {}
      }
    } catch (e) {}
    showToast('Sharing not supported here. Use Download instead.');
  }
  function resetPdfState(silent) {
    if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
    state.pdfUrl = null; state.pdfBlob = null; state.pdfName = null;
    hidePdfReady(); pipelineHide();
    if (!silent) showToast('Ready for a new PDF.');
  }

  async function convert() {
    if (state.busy) return;
    if (!state.items.length) {
      if (el.createBtn) {
        el.createBtn.classList.add('is-error');
        setTimeout(function () { if (el.createBtn) el.createBtn.classList.remove('is-error'); }, 500);
      }
      showToast('Please add at least one image first.');
      return;
    }
    state.busy = true;
    hidePdfReady();
    pipelineShow();
    if (el.createBtn) { el.createBtn.classList.add('is-processing'); el.createBtn.disabled = true; }
    if (el.createLabel) el.createLabel.textContent = 'Generating PDF…';

    const settings = readSettings();
    const total = state.items.length;

    try {
      await pipelineStage1(total);
      await pipelineStage2();

      let workerResult = null;
      try {
        workerResult = await buildPdfViaWorker(state.items, settings, function (prog) {
          if (prog.pct != null) pipelineSetPct(prog.pct);
          if (prog.stage != null) pipelineSetStage(prog.stage);
          if (prog.title) pipelineSetTitle(prog.title, prog.desc || '');
        });
      } catch (workerErr) { workerResult = null; }

      let pdfBlob = null;
      let pages = total;

      if (workerResult && workerResult.blob) {
        pdfBlob = workerResult.blob;
        pages = workerResult.pages || total;
        await pipelineStage4();
      } else {
        const prepared = [];
        for (let i = 0; i < total; i++) {
          const result = await prepareImageMainThread(state.items[i], settings);
          prepared.push(result);
          await pipelineStage3(i + 1, total);
        }
        pdfBlob = buildPDFMainThread(prepared, settings);
        await pipelineStage4();
      }

      await new Promise(function (r) { setTimeout(r, 250); });

      if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
      const base = settings.filename || 'document';
      state.pdfName = base + (total > 1 ? '-and-' + (total - 1) + '-more' : '') + '.pdf';
      state.pdfBlob = pdfBlob;
      state.pdfUrl = URL.createObjectURL(pdfBlob);
      pipelineHide();
      showPdfReady(pages, pdfBlob.size);
      showToast('Your PDF is ready! Click Download PDF to save it.');
    } catch (err) {
      console.warn('[PixelPress] PDF build failed:', err && err.message);
      pipelineHide();
      showToast('Something went wrong. Please try again.');
    } finally {
      state.busy = false;
      if (el.createBtn) {
        el.createBtn.classList.remove('is-processing');
        el.createBtn.disabled = state.items.length === 0;
        el.createBtn.style.opacity = state.items.length === 0 ? '.55' : '';
      }
      if (el.createLabel) el.createLabel.textContent = 'Generate PDF';
    }
  }

  function enhanceCanvas(canvas, level) {
    if (!level || level === 'none') return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const L = { soft:{b:6,c:8,s:6}, standard:{b:10,c:16,s:12}, strong:{b:14,c:24,s:18} }[level] || { b:0,c:0,s:0 };
    const bright = L.b * 2.55;
    const cF = (259 * (L.c + 255)) / (255 * (259 - L.c));
    const sF = 1 + L.s / 100;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      r = cF * (r - 128) + 128 + bright; g = cF * (g - 128) + 128 + bright; b = cF * (b - 128) + 128 + bright;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * sF; g = gray + (g - gray) * sF; b = gray + (b - gray) * sF;
      d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    ctx.putImageData(img, 0, 0);
  }

  async function prepareImageMainThread(item, settings) {
    const rot = item.rotation || 0;
    const srcW = item.w, srcH = item.h;
    const comp = { low:{maxDim:1400,q:0.62}, medium:{maxDim:2400,q:0.82}, high:{maxDim:3500,q:0.92} }[settings.compression] || { maxDim:3500, q:0.92 };
    const baseMax = { low:1400, medium:2400, high:3500, ultra:4500 }[settings.quality] || 3500;
    const maxDim = Math.min(baseMax, comp.maxDim);
    const longEdge = Math.max(srcW, srcH);
    const scale = longEdge > maxDim ? maxDim / longEdge : 1;
    const sw = Math.max(1, Math.round(srcW * scale));
    const sh = Math.max(1, Math.round(srcH * scale));
    const swap = rot % 180 !== 0;
    const cw = swap ? sh : sw, ch = swap ? sw : sh;
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(item.imgEl, -sw / 2, -sh / 2, sw, sh);
    if (settings.enhance && settings.enhance !== 'none') { try { enhanceCanvas(canvas, settings.enhance); } catch (e) {} }
    const q = Math.min({ low:0.62, medium:0.82, high:0.92, ultra:0.96 }[settings.quality] || 0.92, comp.q);
    const blob = await new Promise(function (resolve) {
      if (canvas.toBlob) canvas.toBlob(function (b) { resolve(b); }, 'image/jpeg', q);
      else { const url = canvas.toDataURL('image/jpeg', q); resolve(new Blob([base64ToBytes(url.split(',')[1])], { type: 'image/jpeg' })); }
    });
    if (!blob) throw new Error('Encoding failed');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    canvas.width = canvas.height = 0;
    const autoOrientation = (cw > ch) ? 'landscape' : 'portrait';
    return { jpegBytes: bytes, imgW: cw, imgH: ch, autoOrientation };
  }

  function base64ToBytes(b64) {
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function fmtNum(n) { return String(Math.round(n * 1000) / 1000); }
  function escapePdfString(s) { return String(s).replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1'); }
  function pdfDate(d) {
    const p = function (n) { return String(n).padStart(2, '0'); };
    return 'D:' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + 'Z';
  }

  function buildPDFMainThread(prepared, settings) {
    const parts = [];
    let offset = 0;
    const offsets = {};
    const txt = function (s) { const b = new TextEncoder().encode(s); parts.push(b); offset += b.length; };
    const bin = function (b) { parts.push(b); offset += b.length; };
    txt('%PDF-1.4\n');
    bin(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    const N = prepared.length;
    const pageNums = [], contNums = [], imgNums = [];
    let n = 3;
    for (let i = 0; i < N; i++) { pageNums.push(n++); contNums.push(n++); imgNums.push(n++); }
    const infoObj = n++;
    const totalObjs = n;
    const margin = CONFIG.marginPt[settings.margin] != null ? CONFIG.marginPt[settings.margin] : 0;
    const pages = prepared.map(function (p) {
      let pw, ph;
      if (settings.pageSize === 'original') { pw = p.imgW; ph = p.imgH; }
      else {
        const size = CONFIG.pageSizes[settings.pageSize] || CONFIG.pageSizes.a4;
        let orientation = settings.orientation;
        if (settings.orientation === 'auto') orientation = p.autoOrientation;
        if (orientation === 'landscape') { pw = size[1]; ph = size[0]; }
        else { pw = size[0]; ph = size[1]; }
      }
      let dw, dh, dx, dy, clip = false;
      if (settings.pageSize === 'original') { dw = p.imgW; dh = p.imgH; dx = 0; dy = 0; }
      else if (settings.fitMode === 'stretch') { dw = Math.max(1, pw - margin * 2); dh = Math.max(1, ph - margin * 2); dx = margin; dy = margin; }
      else if (settings.fitMode === 'fill') {
        const s = Math.max((pw - margin * 2) / p.imgW, (ph - margin * 2) / p.imgH);
        dw = p.imgW * s; dh = p.imgH * s; dx = (pw - dw) / 2; dy = (ph - dh) / 2; clip = true;
      } else {
        const availW = Math.max(1, pw - margin * 2), availH = Math.max(1, ph - margin * 2);
        const s = Math.min(availW / p.imgW, availH / p.imgH);
        dw = p.imgW * s; dh = p.imgH * s; dx = (pw - dw) / 2; dy = (ph - dh) / 2;
      }
      return { pw, ph, dw, dh, dx, dy, clip };
    });
    offsets[1] = offset;
    txt('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    offsets[2] = offset;
    const kids = pageNums.map(function (p) { return p + ' 0 R'; }).join(' ');
    txt('2 0 obj\n<< /Type /Pages /Kids [' + kids + '] /Count ' + N + ' >>\nendobj\n');
    const wmText = (settings.watermark && settings.watermarkText) ? escapePdfString(settings.watermarkText) : '';
    const wmGray = String(Math.max(0, Math.min(1, 1 - settings.watermarkOpacity)).toFixed(3));
    for (let i = 0; i < N; i++) {
      const g = pages[i], p = prepared[i];
      const pn = pageNums[i], cn = contNums[i], im = imgNums[i];
      offsets[pn] = offset;
      txt(pn + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + fmtNum(g.pw) + ' ' + fmtNum(g.ph) + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> >> /ProcSet [/PDF /Text /ImageC] >> /Contents ' + cn + ' 0 R >>\nendobj\n');
      let content = '';
      if (g.clip) {
        content += 'q\n' + fmtNum(g.pw) + ' 0 0 ' + fmtNum(g.ph) + ' 0 0 cm\n';
        content += '0 0 ' + fmtNum(g.pw) + ' ' + fmtNum(g.ph) + ' re W n\n';
        content += fmtNum(g.dw) + ' 0 0 ' + fmtNum(g.dh) + ' ' + fmtNum(g.dx) + ' ' + fmtNum(g.dy) + ' cm\n/Im0 Do\nQ\n';
      } else {
        content += 'q\n' + fmtNum(g.dw) + ' 0 0 ' + fmtNum(g.dh) + ' ' + fmtNum(g.dx) + ' ' + fmtNum(g.dy) + ' cm\n/Im0 Do\nQ\n';
      }
      if (wmText) {
        const size = Math.max(24, Math.min(g.pw, g.ph) * 0.11);
        const cx = g.pw / 2, cy = g.ph / 2;
        const tw = wmText.length * size * 0.5;
        content += 'q\n0.7071 0.7071 -0.7071 0.7071 ' + fmtNum(cx) + ' ' + fmtNum(cy) + ' cm\nBT\n/F1 ' + fmtNum(size) + ' Tf\n' + wmGray + ' ' + wmGray + ' ' + wmGray + ' rg\n' + fmtNum(-tw / 2) + ' ' + fmtNum(-size / 3) + ' Td\n(' + wmText + ') Tj\nET\nQ\n';
      }
      if (settings.pageNumber) {
        let label = settings.pageNumberFormat === 'n-of-total' ? (i + 1) + ' / ' + N : String(i + 1);
        label = escapePdfString(label);
        const fsize = 10, tw = label.length * fsize * 0.52;
        const pos = settings.pageNumberPos || 'bottom-center', pad = 20;
        let px, py;
        if (pos.indexOf('top') === 0) py = g.ph - pad - fsize; else py = pad;
        if (pos.indexOf('center') !== -1) px = (g.pw - tw) / 2;
        else if (pos.indexOf('right') !== -1) px = g.pw - tw - pad;
        else px = pad;
        content += 'BT\n/F1 ' + fsize + ' Tf\n0.35 0.35 0.35 rg\n' + fmtNum(px) + ' ' + fmtNum(py) + ' Td\n(' + label + ') Tj\nET\n';
      }
      offsets[cn] = offset;
      txt(cn + ' 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n');
      offsets[im] = offset;
      txt(im + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + p.imgW + ' /Height ' + p.imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpegBytes.length + ' >>\nstream\n');
      bin(p.jpegBytes);
      txt('\nendstream\nendobj\n');
    }
    const now = new Date();
    const metaTitle = (settings.metaEnabled && settings.metaTitle) ? settings.metaTitle : (settings.filename || 'Document');
    const metaAuthor = (settings.metaEnabled && settings.metaAuthor) ? settings.metaAuthor : 'PixelPress';
    offsets[infoObj] = offset;
    const infoExtra = settings.pdfA ? '/GTS_PDFA1Version (PDF/A-1b) ' : '';
    txt(infoObj + ' 0 obj\n<< /Title (' + escapePdfString(metaTitle) + ') /Author (' + escapePdfString(metaAuthor) + ') /Producer (PixelPress) /Creator (PixelPress) ' + infoExtra + '/CreationDate (' + pdfDate(now) + ') /ModDate (' + pdfDate(now) + ') >>\nendobj\n');
    const xrefStart = offset;
    let xref = 'xref\n0 ' + totalObjs + '\n0000000000 65535 f \n';
    for (let i = 1; i < totalObjs; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    xref += 'trailer\n<< /Size ' + totalObjs + ' /Root 1 0 R /Info ' + infoObj + ' 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF\n';
    txt(xref);
    return new Blob(parts, { type: 'application/pdf' });
  }

  /* ══════════════════════════════════════════════════════════
     INSTALL SYSTEM — direct install from popup
     ══════════════════════════════════════════════════════════ */
  function detectPlatform() {
    const ua = (navigator.userAgent || '').toLowerCase();
    installState.isAndroid = /android/.test(ua);
    const iOSFromUA = /ipad|iphone|ipod/.test(ua) && !window.MSStream;
    const iOSFromMac = /macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    installState.isIOS = iOSFromUA || iOSFromMac;
    installState.isMobile = installState.isAndroid || installState.isIOS;
    installState.isDesktop = !installState.isMobile;

    if (/samsungbrowser/.test(ua)) installState.browser = 'samsung';
    else if (/edgios|edga|edg\//.test(ua)) installState.browser = 'edge';
    else if (/fxios|firefox/.test(ua)) installState.browser = 'firefox';
    else if (/opios|opr\/|opera/.test(ua)) installState.browser = 'opera';
    else if (/ucbrowser|ucweb/.test(ua)) installState.browser = 'uc';
    else if (/crios|chrome/.test(ua)) installState.browser = 'chrome';
    else if (/safari/.test(ua) && !/chrome|crios|fxios|edg/.test(ua)) installState.browser = 'safari';
    else installState.browser = 'other';

    installState.isIOSSafari = installState.isIOS && installState.browser === 'safari';
    installState.isIOSOther = installState.isIOS && !installState.isIOSSafari;
  }

  function isStandalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
             window.matchMedia('(display-mode: window-controls-overlay)').matches ||
             window.navigator.standalone === true ||
             document.referrer.indexOf('android-app://') === 0 ||
             document.referrer.indexOf('ios-app://') === 0;
    } catch (e) { return false; }
  }

  function hasBeenBlocked() {
    try {
      if (localStorage.getItem(PP_BLOCK_KEY) === '1') return true;
      if (localStorage.getItem(PP_INSTALLED_KEY) === '1') return true;
      if (getCookie('pp_install_blocked_v11') === '1') return true;
      if (getCookie('pp_installed_v2') === '1') return true;
    } catch (e) {}
    return false;
  }

  function markInstalled() {
    installState.isInstalled = true;
    try {
      localStorage.setItem(PP_INSTALLED_KEY, '1');
      localStorage.setItem(PP_BLOCK_KEY, '1');
    } catch (e) {}
    setCookie('pp_installed_v2', '1', 3650);
    setCookie('pp_install_blocked_v11', '1', 3650);
    document.documentElement.classList.add('is-standalone');
    if (el.installChip) el.installChip.style.display = 'none';
    hideInstallTip();
    hideInstallModal();
  }

  function initInstall() {
    if (!el.installTip) return;
    detectPlatform();

    if (isStandalone()) { markInstalled(); return; }

    if (window.__ppDeferredPrompt) {
      installState.deferredPrompt = window.__ppDeferredPrompt;
      installState.hasNative = true;
    }

    if (el.installAction) el.installAction.addEventListener('click', onInstallAction);

    if (el.installClose) el.installClose.addEventListener('click', function (e) {
      e.stopPropagation();
      onInstallLater();
    });

    if (el.installNever) el.installNever.addEventListener('click', function (e) {
      e.stopPropagation();
      onInstallNever();
    });

    if (el.installChip) {
      el.installChip.style.display = '';
      el.installChip.addEventListener('click', function () {
        try { localStorage.removeItem(PP_LATER_KEY); } catch (e) {}
        if (window.__ppDeferredPrompt) {
          installState.deferredPrompt = window.__ppDeferredPrompt;
          installState.hasNative = true;
        }
        showInstallTip();
      });
    }

    if (el.installModalClose) el.installModalClose.addEventListener('click', hideInstallModal);
    if (el.installModal) {
      el.installModal.addEventListener('click', function (e) {
        if (e.target === el.installModal) hideInstallModal();
      });
    }
    if (el.installTabs) {
      $$('.install-tab', el.installTabs).forEach(function (tab) {
        tab.addEventListener('click', function () {
          const target = tab.getAttribute('data-tab');
          $$('.install-tab', el.installTabs).forEach(function (t) {
            t.classList.toggle('is-active', t === tab);
          });
          $$('.install-panel', el.installModal).forEach(function (p) {
            p.classList.toggle('is-active', p.getAttribute('data-panel') === target);
          });
        });
      });
    }

    if (!hasBeenBlocked()) {
      clearTimeout(installState.autoShowTimer);
      installState.autoShowTimer = setTimeout(function () {
        if (!installState.isInstalled && !hasBeenBlocked()) {
          showInstallTip();
        }
      }, 1800);
    }
  }

  function renderTipMode() {
    if (!el.installTip) return;
    const isIOS = installState.isIOS;
    const isIOSSafari = installState.isIOSSafari;
    const isIOSOther = installState.isIOSOther;
    const hasNative = !!(installState.deferredPrompt || window.__ppDeferredPrompt);
    const b = installState.browser;

    if (el.installTitle) {
      if (isIOSOther) el.installTitle.textContent = 'Open in Safari';
      else el.installTitle.textContent = 'Install PixelPress';
    }

    if (el.installDesc) {
      if (isIOSOther) el.installDesc.textContent = 'iOS allows installation only from Safari';
      else if (isIOSSafari) el.installDesc.textContent = 'Add to Home Screen — works offline, no account needed';
      else if (hasNative) el.installDesc.textContent = 'Tap Install to add the app — works offline';
      else if (b === 'samsung') el.installDesc.textContent = 'Add to Home screen via Samsung Internet menu';
      else if (b === 'firefox') el.installDesc.textContent = 'Install via Firefox menu — works offline';
      else if (b === 'opera') el.installDesc.textContent = 'Add to Home screen via Opera menu';
      else el.installDesc.textContent = 'Install the app — works offline, no account needed';
    }

    if (el.installActionLabel) {
      if (hasNative) el.installActionLabel.textContent = 'Install Now';
      else if (isIOSOther) el.installActionLabel.textContent = 'Open Safari';
      else if (isIOSSafari) el.installActionLabel.textContent = 'Show me how';
      else el.installActionLabel.textContent = 'Install';
    }

    if (el.installIcon) {
      if (isIOS) el.installIcon.innerHTML = '<svg class="ic"><use href="#i-apple"/></svg>';
      else if (installState.isAndroid) el.installIcon.innerHTML = '<svg class="ic"><use href="#i-android"/></svg>';
      else el.installIcon.innerHTML = '<svg class="ic"><use href="#i-leaf"/></svg>';
    }
  }

  function showInstallTip() {
    if (!el.installTip || installState.isInstalled) return;
    if (window.__ppDeferredPrompt) {
      installState.deferredPrompt = window.__ppDeferredPrompt;
      installState.hasNative = true;
    }
    renderTipMode();
    clearTimeout(installState.hideTimer);
    el.installTip.classList.remove('is-hiding');
    el.installTip.classList.add('is-visible');
    installState.visible = true;
    installState.hideTimer = setTimeout(hideInstallTip, 30000);
  }

  function hideInstallTip() {
    if (!el.installTip || !installState.visible) return;
    installState.visible = false;
    el.installTip.classList.remove('is-visible');
    el.installTip.classList.add('is-hiding');
    setTimeout(function () {
      if (el.installTip) el.installTip.classList.remove('is-hiding');
    }, 320);
  }

  function onInstallLater() {
    const until = Date.now() + 48 * 60 * 60 * 1000;
    try { localStorage.setItem(PP_LATER_KEY, String(until)); } catch (e) {}
    setCookie('pp_install_later_v11', String(until), 2);
    hideInstallTip();
  }

  function onInstallNever() {
    try { localStorage.setItem(PP_BLOCK_KEY, '1'); } catch (e) {}
    setCookie('pp_install_blocked_v11', '1', 365);
    hideInstallTip();
    if (el.installChip) el.installChip.style.display = 'none';
    showToast("Got it — we won't ask again.");
  }

  async function onInstallAction() {
    if (window.__ppDeferredPrompt) {
      installState.deferredPrompt = window.__ppDeferredPrompt;
      installState.hasNative = true;
    }

    /* 1. DIRECT INSTALL — native prompt ready */
    if (installState.deferredPrompt) {
      try {
        installState.deferredPrompt.prompt();
        const choice = await installState.deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          markInstalled();
          showToast('Installing PixelPress app…');
        } else {
          onInstallLater();
        }
        installState.deferredPrompt = null;
        installState.hasNative = false;
        window.__ppDeferredPrompt = null;
      } catch (err) {
        hideInstallTip();
        showInstallModal();
      }
      return;
    }

    /* 2. Android/Desktop — wait for prompt up to 8s */
    const canUseNative = installState.isAndroid || installState.isDesktop;
    if (canUseNative && installState.browser !== 'firefox') {
      const btn = el.installAction;
      const label = el.installActionLabel;
      const originalLabel = label ? label.textContent : '';
      if (label) label.textContent = 'Preparing…';
      if (btn) btn.disabled = true;

      const gotPrompt = await new Promise(function (resolve) {
        const timer = setTimeout(function () { resolve(false); }, 8000);
        window.__ppInstallWaiters.push(function () {
          clearTimeout(timer);
          resolve(true);
        });
      });

      if (label) label.textContent = originalLabel;
      if (btn) btn.disabled = false;

      if (gotPrompt && window.__ppDeferredPrompt) {
        try {
          window.__ppDeferredPrompt.prompt();
          const choice = await window.__ppDeferredPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            markInstalled();
            showToast('Installing PixelPress app…');
          } else {
            onInstallLater();
          }
          window.__ppDeferredPrompt = null;
          installState.deferredPrompt = null;
        } catch (err) {
          showInstallModal();
        }
        return;
      }

      hideInstallTip();
      showInstallModal();
      showToast('Please follow the on-screen steps to install');
      return;
    }

    /* 3. iOS other browser */
    if (installState.isIOSOther) {
      hideInstallTip();
      showInstallModal();
      return;
    }

    /* 4. iOS Safari / Firefox */
    hideInstallTip();
    showInstallModal();
  }

  function showInstallModal() {
    if (!el.installModal) return;

    let tab = 'android';
    if (installState.isIOS) tab = 'ios';
    else if (installState.browser === 'samsung') tab = 'samsung';
    else if (installState.browser === 'firefox') tab = 'firefox';
    else if (installState.browser === 'opera') tab = 'opera';
    else if (installState.browser === 'uc') tab = 'other';
    else if (installState.browser === 'chrome' || installState.browser === 'edge') tab = 'android';
    else tab = 'other';

    if (el.installModalTitle) {
      if (installState.isIOSOther) el.installModalTitle.textContent = 'Open in Safari to Install';
      else if (installState.isIOS) el.installModalTitle.textContent = 'Install PixelPress on iOS';
      else if (installState.isAndroid) el.installModalTitle.textContent = 'Install PixelPress on Android';
      else el.installModalTitle.textContent = 'Install PixelPress App';
    }
    if (el.installModalSubtitle) {
      if (installState.isIOSOther) el.installModalSubtitle.textContent = 'iOS only allows PWA installation from Safari';
      else if (installState.isIOS) el.installModalSubtitle.textContent = 'Follow these steps on your iPhone or iPad';
      else if (installState.isAndroid) el.installModalSubtitle.textContent = 'Follow these steps on your Android device';
      else el.installModalSubtitle.textContent = 'Choose your browser below';
    }

    if (el.installModalIcon) {
      if (installState.isIOS) el.installModalIcon.innerHTML = '<svg class="ic"><use href="#i-apple"/></svg>';
      else if (installState.isAndroid) el.installModalIcon.innerHTML = '<svg class="ic"><use href="#i-android"/></svg>';
      else el.installModalIcon.innerHTML = '<svg class="ic"><use href="#i-leaf"/></svg>';
    }

    if (el.installTabs) {
      $$('.install-tab', el.installTabs).forEach(function (t) {
        t.classList.toggle('is-active', t.getAttribute('data-tab') === tab);
      });
      $$('.install-panel', el.installModal).forEach(function (p) {
        p.classList.toggle('is-active', p.getAttribute('data-panel') === tab);
      });
    }

    el.installModal.hidden = false;
    document.body.classList.add('is-modal-open');
  }

  function hideInstallModal() {
    if (!el.installModal || el.installModal.hidden) return;
    el.installModal.classList.add('is-closing');
    setTimeout(function () {
      el.installModal.hidden = true;
      el.installModal.classList.remove('is-closing');
      document.body.classList.remove('is-modal-open');
    }, 200);
  }

  /* ══════════════════════════════════════════════════════════
     IMAGE MODAL
     ══════════════════════════════════════════════════════════ */
  let modalIndex = 0;
  function openModal(idx) {
    if (!el.imgModal || !state.items.length) return;
    modalIndex = Math.max(0, Math.min(idx, state.items.length - 1));
    const item = state.items[modalIndex];
    if (!item) return;
    el.imgModalImg.src = item.url;
    el.imgModalImg.alt = item.name;
    el.imgModalTitle.textContent = item.name;
    el.imgModalMeta.textContent = (modalIndex + 1) + ' / ' + state.items.length + ' · ' + fmtSize(item.size) + ' · ' + item.w + '×' + item.h;
    el.imgModal.hidden = false;
    document.body.classList.add('is-modal-open');
  }
  function closeModal() {
    if (!el.imgModal) return;
    el.imgModal.classList.add('is-closing');
    setTimeout(function () {
      el.imgModal.hidden = true;
      el.imgModal.classList.remove('is-closing');
      document.body.classList.remove('is-modal-open');
    }, 200);
  }
  function modalNext() { if (state.items.length) openModal((modalIndex + 1) % state.items.length); }
  function modalPrev() { if (state.items.length) openModal((modalIndex - 1 + state.items.length) % state.items.length); }
  function initImageModal() {
    if (!el.imgModal) return;
    if (el.imgModalClose) el.imgModalClose.addEventListener('click', closeModal);
    if (el.imgModalNext) el.imgModalNext.addEventListener('click', modalNext);
    if (el.imgModalPrev) el.imgModalPrev.addEventListener('click', modalPrev);
    el.imgModal.addEventListener('click', function (e) {
      if (e.target === el.imgModal || e.target.classList.contains('img-modal-stage')) closeModal();
    });
  }

  function initKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (el.createBtn && !el.createBtn.disabled && !el.createBtn.hidden) convert();
        return;
      }
      if (e.key === 'Escape') {
        if (el.imgModal && !el.imgModal.hidden) { closeModal(); return; }
        if (el.installModal && !el.installModal.hidden) { hideInstallModal(); return; }
        if (el.installTip && installState.visible) { hideInstallTip(); return; }
        return;
      }
      if (el.imgModal && !el.imgModal.hidden) {
        if (e.key === 'ArrowRight') modalNext();
        if (e.key === 'ArrowLeft') modalPrev();
      }
    });
  }

  const REQUIRED = [['themeBtn', '#theme-toggle'], ['dropzone', '#dropzone'], ['fileInput', '#file-input'], ['createBtn', '#create-pdf']];
  function allRequiredPresent() {
    return REQUIRED.every(function (pair) {
      if (!el[pair[0]]) el[pair[0]] = $(pair[1]);
      return !!el[pair[0]];
    });
  }

  function startApp() {
    document.documentElement.classList.add('is-ready');
    document.documentElement.classList.remove('is-loading');
    if (el.year) el.year.textContent = String(new Date().getFullYear());

    safe('theme', initTheme);
    safe('nav', initNav);
    safe('headerScroll', initHeaderScroll);
    safe('scrollProgress', initScrollProgress);
    safe('reveal', initReveal);
    safe('counters', initCounters);
    safe('scrollFab', initScrollFab);
    safe('upload', initUpload);
    safe('sort', initSort);
    safe('advanced', initAdvanced);
    safe('install', initInstall);
    safe('modal', initImageModal);
    safe('shortcuts', initKeyboardShortcuts);
    safe('applySaved', applySavedSettings);
    safe('howTimeline', initHowTimeline);
    safe('faqFilter', initFaqFilter);

    if (el.createBtn) {
      el.createBtn.addEventListener('click', convert);
      el.createBtn.disabled = true;
      el.createBtn.style.opacity = '.55';
    }
    if (el.downloadBtn) el.downloadBtn.addEventListener('click', downloadPDF);
    if (el.previewBtn) el.previewBtn.addEventListener('click', previewPDF);
    if (el.shareBtn) el.shareBtn.addEventListener('click', sharePDF);
    if (el.newPdfBtn) el.newPdfBtn.addEventListener('click', function () { resetPdfState(false); });
    if (el.clearAll) el.clearAll.addEventListener('click', clearAll);
  }

  function waitForDom() {
    refreshEl();
    if (allRequiredPresent()) { startApp(); return; }
    let tries = 0;
    const timer = setInterval(function () {
      tries++; refreshEl();
      if (allRequiredPresent()) { clearInterval(timer); startApp(); }
      else if (tries >= 100) { clearInterval(timer); startApp(); }
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForDom);
  else waitForDom();
})();