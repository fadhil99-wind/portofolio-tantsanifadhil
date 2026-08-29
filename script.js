/* =========================================================
   TANTSANI FADHIL RAMADHAN — PANGGUNG PRIBADI
   script.js

   Arsitektur singkat:
   - Semua isi website hidup di satu objek data (PORTFOLIO).
   - Pengunjung membaca data.json (jika ada) — inilah versi publik.
   - Pemilik menyunting di browser sendiri; hasilnya disimpan ke
     localStorage, gambar ke IndexedDB.
   - Untuk mempublikasikan: SYSTEM → PUBLISH, unggah data.json
     hasil unduhan ke hosting, sejajar dengan index.html.

   Catatan keamanan: password di sini hanya penghalang, bukan
   pengaman. Tidak ada server, jadi siapa pun yang membuka source
   code bisa melewatinya di browser sendiri. Cukup untuk mencegah
   pengunjung biasa masuk ke editor — jangan simpan rahasia apa pun.
========================================================= */
(function(){
"use strict";

/* =========================================================
   0. UTILITAS
========================================================= */
const $  = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none)').matches;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function esc(str){
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function debounce(fn, wait){
  let t = null;
  return function(){
    const args = arguments;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

function isPlainObject(v){
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/* Gabung objek secara mendalam. Array selalu diganti utuh,
   supaya penghapusan item oleh pemilik tidak "hidup lagi". */
function deepMerge(base, patch){
  if(!isPlainObject(patch)) return patch === undefined ? base : patch;
  const out = isPlainObject(base) ? Object.assign({}, base) : {};
  Object.keys(patch).forEach(key => {
    const pv = patch[key];
    if(isPlainObject(pv)) out[key] = deepMerge(out[key], pv);
    else if(pv !== undefined) out[key] = pv;
  });
  return out;
}

function getPath(obj, path){
  return String(path).split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setPath(obj, path, value){
  const keys = String(path).split('.');
  const last = keys.pop();
  let target = obj;
  keys.forEach(key => {
    if(target[key] == null || typeof target[key] !== 'object') target[key] = {};
    target = target[key];
  });
  target[last] = value;
}

function findById(list, id){ return (list || []).find(item => item.id === id); }
function indexById(list, id){ return (list || []).findIndex(item => item.id === id); }

/* =========================================================
   1. PENYIMPANAN GAMBAR (IndexedDB)
   Gambar disimpan terpisah dari teks supaya localStorage
   (batas ~5MB) tidak cepat penuh.
========================================================= */
const Media = (function(){
  const DB_NAME = 'tfr-media';
  const STORE = 'images';
  const LS_PREFIX = 'tfr:img:';   // fallback localStorage
  let dbPromise = null;
  let idbFailed = false;           // kalau IDB gagal, pakai LS selamanya
  const cache = new Map();

  /* ---- IndexedDB ---- */
  function open(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if(!('indexedDB' in window)){ idbFailed = true; reject(new Error('no-idb')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { idbFailed = true; reject(req.error); };
    });
    return dbPromise;
  }

  function tx(mode){
    return open().then(db => db.transaction(STORE, mode).objectStore(STORE));
  }

  /* ---- localStorage fallback ---- */
  function lsGet(id){
    try{ return localStorage.getItem(LS_PREFIX + id) || ''; }catch(e){ return ''; }
  }
  function lsSet(id, dataUrl){
    try{ localStorage.setItem(LS_PREFIX + id, dataUrl); return true; }
    catch(e){
      /* localStorage penuh — coba hapus item lama yang tidak terpakai */
      try{
        const keys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX));
        if(keys.length){ localStorage.removeItem(keys[0]); localStorage.setItem(LS_PREFIX + id, dataUrl); return true; }
      }catch(e2){}
      return false;
    }
  }
  function lsDel(id){ try{ localStorage.removeItem(LS_PREFIX + id); }catch(e){} }
  function lsClear(){
    try{
      Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    }catch(e){}
  }
  function lsAll(){
    try{
      Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX)).forEach(k => {
        const id = k.slice(LS_PREFIX.length);
        if(!cache.has(id)) cache.set(id, localStorage.getItem(k) || '');
      });
    }catch(e){}
  }

  /* ---- API publik ---- */
  async function loadAll(){
    /* 1. coba IDB */
    if(!idbFailed){
      try{
        const store = await tx('readonly');
        await new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => { (req.result || []).forEach(row => cache.set(row.id, row.data)); resolve(); };
          req.onerror = () => reject(req.error);
        });
      }catch(err){
        console.warn('Media: IndexedDB tidak tersedia, beralih ke localStorage.', err.message || err);
        idbFailed = true;
      }
    }
    /* 2. kalau IDB gagal / tidak ada, muat dari LS */
    if(idbFailed) lsAll();
    return cache;
  }

  async function put(id, dataUrl){
    cache.set(id, dataUrl);
    if(!idbFailed){
      try{
        const store = await tx('readwrite');
        await new Promise((resolve, reject) => {
          const req = store.put({ id, data: dataUrl });
          req.onsuccess = resolve;
          req.onerror = () => reject(req.error);
        });
        return true;
      }catch(err){
        console.warn('Media: IDB put gagal, beralih ke localStorage.', err.message || err);
        idbFailed = true;
      }
    }
    /* fallback LS */
    return lsSet(id, dataUrl);
  }

  async function remove(id){
    if(!id) return;
    cache.delete(id);
    if(!idbFailed){
      try{ const store = await tx('readwrite'); store.delete(id); }catch(e){ idbFailed = true; }
    }
    lsDel(id);
  }

  async function clear(){
    cache.clear();
    if(!idbFailed){
      try{ const store = await tx('readwrite'); store.clear(); }catch(e){ idbFailed = true; }
    }
    lsClear();
  }

  function get(id){ return id ? (cache.get(id) || lsGet(id)) : ''; }
  function has(id){ return !!id && (cache.has(id) || !!lsGet(id)); }
  function seed(map){
    if(!map) return;
    Object.keys(map).forEach(id => { if(!cache.has(id)) cache.set(id, map[id]); });
  }
  function all(){ return cache; }
  function bytes(){
    let total = 0;
    cache.forEach(v => { total += v.length; });
    return total;
  }
  function usingFallback(){ return idbFailed; }

  return { loadAll, put, get, has, remove, clear, seed, all, bytes, usingFallback };
})();

/* Kecilkan gambar sebelum disimpan: hemat ruang, cepat dimuat. */
function compressImage(file, maxDim, quality){
  maxDim = maxDim || 1400;
  quality = quality || 0.82;
  return new Promise((resolve, reject) => {
    if(!file || !file.type || file.type.indexOf('image/') !== 0){
      reject(new Error('Berkas bukan gambar'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let out = '';
        try{ out = canvas.toDataURL('image/webp', quality); }catch(e){ out = ''; }
        if(out.indexOf('data:image/webp') !== 0){
          out = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   2. DATA BAWAAN
   Ini yang dilihat pengunjung sebelum ada data.json.
========================================================= */
const DEFAULTS = {
  meta: { version: 2, updatedAt: '' },
  settings: {
    loadingScreen: true,
    animation: 'balanced',
    accent: '#ffb545',
    pet: 'cat',
    musicEnabled: true,
    musicVolume: 45
  },
  hero: {
    status: 'Available for collaboration',
    name: 'Tantsani Fadhil Ramadhan',
    role: 'Public Speaking · Content · Coaching',
    tagline: 'Naik ke atas panggung lewat public speaking, konten, dan coaching — membangun pengalaman satu langkah dengan cara yang sama: mulai, kerjakan, selesaikan.',
    ctaPrimary: 'Explore My Journey',
    ctaSecondary: 'Hubungi Saya'
  },
  marquee: ['START', 'DO', 'FINISH'],
  about: {
    eyebrow: 'Tentang',
    title: 'Tiga babak, satu motto.',
    intro: '"Start, Do, Finish" bukan cuma slogan — ini urutan kerja yang literal: mulai dari ketertarikan, jalani prosesnya, lalu siapkan hasil akhirnya.',
    cards: [
      { id: 'ab1', stage: '01 · Start', title: 'Profile', desc: 'Tertarik pada dunia public speaking, coaching, pembuatan konten, dan pengembangan diri secara berkelanjutan — titik awal dari semua yang dikerjakan.' },
      { id: 'ab2', stage: '02 · Do', title: 'Focus', desc: 'Membangun pengalaman nyata dan karya yang bermanfaat lewat latihan, proyek, dan kolaborasi — belajar dengan cara benar-benar mengerjakannya.' },
      { id: 'ab3', stage: '03 · Finish', title: 'Objective', desc: 'Mempersiapkan diri seoptimal mungkin untuk melangkah ke jenjang karier berikutnya, dengan bekal komunikasi dan kepemimpinan yang matang.' }
    ],
    stats: [
      { id: 'st1', num: '—', label: 'Panggung diisi' },
      { id: 'st2', num: '—', label: 'Kegiatan volunteer' },
      { id: 'st3', num: '—', label: 'Tahun berlatih' }
    ]
  },
  skills: {
    eyebrow: 'Keahlian',
    title: 'Yang dibawa ke panggung.',
    items: [
      { id: 'sk1', name: 'Public Speaking', level: 92 },
      { id: 'sk2', name: 'Content Creator', level: 85 },
      { id: 'sk3', name: 'Coaching', level: 80 },
      { id: 'sk4', name: 'Communication', level: 90 },
      { id: 'sk5', name: 'Leadership', level: 82 }
    ]
  },
  journey: {
    eyebrow: 'Perjalanan',
    title: 'Peta menuju panggung ini.',
    intro: 'Setiap titik adalah satu babak: tempat belajar, tempat gagal, tempat akhirnya berdiri di depan orang banyak.',
    checkpoints: [
      {
        id: 'jp1', kind: 'start', year: 'Awal', title: 'Titik Nol',
        institution: '', role: '',
        desc: 'Ganti isi checkpoint ini lewat Mode Edit. Ceritakan dari mana semuanya dimulai — momen pertama yang membuatmu tertarik berbicara di depan orang.',
        tags: [], imageId: ''
      },
      {
        id: 'jp2', kind: 'school', year: 'Sekolah', title: 'Latihan Pertama',
        institution: 'Nama sekolah', role: 'Jurusan / kelas',
        desc: 'Tulis pengalaman sekolah yang membentuk kemampuanmu sekarang: lomba, ekstrakurikuler, atau momen pertama memegang mikrofon.',
        tags: [], imageId: ''
      },
      {
        id: 'jp3', kind: 'organization', year: 'Organisasi', title: 'Belajar Memimpin',
        institution: 'Nama organisasi', role: 'Posisi',
        desc: 'Ceritakan peranmu di organisasi dan apa yang berubah dari cara kamu bekerja dengan orang lain.',
        tags: [], imageId: ''
      },
      {
        id: 'jp4', kind: 'university', year: '2026', title: 'A New Chapter',
        institution: 'UPN Veteran Yogyakarta', role: 'Manajemen',
        desc: 'Memulai babak baru dalam perjalanan pendidikan dan mulai membangun arah menuju dunia manajemen, operasional, dan logistik.',
        tags: ['Manajemen', 'Logistik'], imageId: ''
      },
      {
        id: 'jp5', kind: 'future', year: 'Next', title: "What's Next?",
        institution: '', role: 'Tujuan berikutnya',
        desc: 'Tujuan karier, keahlian yang ingin dikuasai, industri yang dituju, dan visi pribadi. Bagian ini sengaja dibiarkan terbuka — perjalanannya masih berlanjut.',
        tags: ['Career goal', 'Skills to learn', 'Vision'], imageId: ''
      }
    ]
  },
  projects: {
    eyebrow: 'Proyek & Pengalaman',
    title: 'Rekam jejak di atas panggung.',
    items: []
  },
  gallery: {
    eyebrow: 'Dokumentasi',
    title: 'Sertifikat & kegiatan volunteer.',
    intro: 'Bukti dari setiap proses — dari sertifikat pelatihan sampai dokumentasi kegiatan sukarela yang sudah dijalani.',
    categories: [
      { id: 'sertifikat', label: '🎓 Sertifikat' },
      { id: 'volunteer', label: '🤝 Dokumentasi Volunteer' }
    ],
    items: []
  },
  final: {
    kicker: 'THE SHOW IS ALMOST OVER',
    headline: 'THE STAGE IS YOURS.',
    name: 'Tantsani Fadhil Ramadhan',
    thanks: 'Terima kasih sudah bertahan sampai akhir.'
  },
  contact: {
    eyebrow: 'Kontak',
    title: 'Mungkin dari sini koneksi baru dimulai.',
    intro: 'Terbuka untuk kolaborasi, undangan berbicara, atau sekadar diskusi seputar public speaking dan konten.',
    email: 'padhilyo@gmail.com',
    mailSubject: 'Halo Tantsani — mau kolaborasi',
    panelTitle: 'Kirim pesan singkat',
    panelIntro: 'Klik tombol di bawah untuk membuka aplikasi email dengan alamat tujuan yang sudah terisi.',
    ctaLabel: 'Kirim email',
    links: [
      { id: 'ln1', type: 'instagram', label: 'Instagram', value: '@fadhilramadhan.05', url: 'https://instagram.com/fadhilramadhan.05' },
      { id: 'ln2', type: 'linkedin', label: 'LinkedIn', value: '', url: '' }
    ]
  },
  footer: {
    motto: 'Start · Do · Finish',
    copyright: 'Tantsani Fadhil Ramadhan. Dibangun untuk naik panggung berikutnya.'
  },
  pets: {
    cat: {
      name: 'Kucing',
      cooldown: 14,
      lines: {
        hero: 'Selamat datang di panggung.',
        about: 'Start, Do, Finish. Sesederhana itu.',
        journey: 'Setiap tujuan berangkat dari suatu tempat.',
        skills: 'Ini yang dilatih terus-terusan.',
        projects: 'Lihat apa saja yang sudah dibangun.',
        gallery: 'Bukti-buktinya ada di sini.',
        final: 'Tepuk tangan dulu, yuk.',
        contact: 'Mungkin dari sini koneksi baru dimulai.'
      },
      click: ['Meong! Semangat ya 🐾', 'Start, Do, Finish!', 'Jangan lupa istirahat.', 'Aku jaga panggung ini.']
    },
    eagle: {
      name: 'Elang',
      cooldown: 14,
      lines: {
        hero: 'Panggungnya sudah menyala. Naik.',
        about: 'Arah dulu, baru kecepatan.',
        journey: 'Dari atas, semua jalur kelihatan.',
        skills: 'Latihan yang tidak terlihat menentukan yang terlihat.',
        projects: 'Karya bicara lebih keras dari niat.',
        gallery: 'Rekam jejak tidak pernah bohong.',
        final: 'Akhir satu babak, awal babak lain.',
        contact: 'Kesempatan datang ke orang yang bisa dihubungi.'
      },
      click: ['Fokus. Lalu terbang.', 'Incar yang jauh.', 'Tenang dulu, lihat lebih luas.', 'Sayap ini untuk dipakai.']
    }
  }
};

/* =========================================================
   3. STATE
========================================================= */
const LS_DATA = 'tfr:data:v2';
const LS_LEGACY = ['tfr:portrait', 'tfr:projects', 'tfr:gallery:sertifikat', 'tfr:gallery:volunteer', 'tfr:links'];
const SESSION_KEY = 'tfr:editUnlocked';

/* SHA-256 dari password Mode Edit.
   Ganti lewat SYSTEM → "Ubah password" (alat di panel akan
   menghitung hash barunya untuk kamu tempel ke sini). */
const EDIT_PASS_HASH = 'b53b39694f63c228c7c7c97da5e625ed5a565ec1b0e1fcf05f5b0f5c1dc05850';

let DATA = clone(DEFAULTS);
let publishedData = null;
let editMode = false;
let previewMode = false;
let activeSection = 'hero';
let projectFilter = 'all';
let galleryCat = 'sertifikat';

/* =========================================================
   4. SIMPAN & MUAT
========================================================= */
function saveNow(){
  try{
    DATA.meta = DATA.meta || {};
    DATA.meta.updatedAt = new Date().toISOString();
    localStorage.setItem(LS_DATA, JSON.stringify(DATA));
    toast('✓ Tersimpan');
    return true;
  }catch(err){
    toast('Penyimpanan browser penuh. Kurangi gambar atau ekspor cadangan.', true);
    return false;
  }
}
const save = debounce(saveNow, 400);

async function loadData(){
  /* 1. versi publik (kalau sudah dipublikasikan) */
  try{
    const res = await fetch('data.json', { cache: 'no-store' });
    if(res.ok){
      const json = await res.json();
      if(json && json.data){
        publishedData = json.data;
        if(json.images) Media.seed(json.images);
      }
    }
  }catch(err){
    /* Wajar: file belum ada, atau dibuka lewat file:// */
  }

  /* 2. suntingan lokal pemilik */
  let local = null;
  try{
    const raw = localStorage.getItem(LS_DATA);
    if(raw) local = JSON.parse(raw);
  }catch(err){ local = null; }

  DATA = deepMerge(clone(DEFAULTS), publishedData || {});
  if(local) DATA = deepMerge(DATA, local);

  await Media.loadAll();
  migrateLegacy(local);
}

/* Pindahkan data dari versi website sebelumnya sekali jalan. */
function migrateLegacy(hadLocal){
  if(hadLocal) return;
  let touched = false;
  try{
    const oldProjects = JSON.parse(localStorage.getItem('tfr:projects') || 'null');
    if(Array.isArray(oldProjects) && oldProjects.length){
      DATA.projects.items = oldProjects.map(p => ({
        id: p.id || uid(),
        title: p.title || 'Tanpa judul',
        category: '', year: '', role: p.meta || '',
        desc: p.desc || '', tech: [], link: p.link || '',
        imageId: p.image ? stashLegacyImage(p.image) : ''
      }));
      touched = true;
    }

    ['sertifikat', 'volunteer'].forEach(cat => {
      const old = JSON.parse(localStorage.getItem('tfr:gallery:' + cat) || 'null');
      if(Array.isArray(old) && old.length){
        old.forEach(item => {
          DATA.gallery.items.push({
            id: item.id || uid(),
            catId: cat,
            caption: item.caption || '',
            alt: item.caption || '',
            imageId: item.image ? stashLegacyImage(item.image) : ''
          });
        });
        touched = true;
      }
    });

    const oldLinks = JSON.parse(localStorage.getItem('tfr:links') || 'null');
    if(oldLinks){
      if(oldLinks.linkedin){
        const li = DATA.contact.links.find(l => l.type === 'linkedin');
        if(li){ li.url = oldLinks.linkedin; li.value = oldLinks.linkedin.replace(/^https?:\/\//, ''); }
        touched = true;
      }
      (oldLinks.extra || []).forEach(l => {
        DATA.contact.links.push({ id: l.id || uid(), type: 'link', label: l.label, value: l.label, url: l.url });
        touched = true;
      });
    }

    const oldPortrait = localStorage.getItem('tfr:portrait');
    if(oldPortrait){
      const clean = JSON.parse(oldPortrait);
      if(clean){ DATA.portraitId = stashLegacyImage(clean); touched = true; }
    }
  }catch(err){ /* data lama tidak terbaca — lewati saja */ }

  if(touched){
    saveNow();
    LS_LEGACY.forEach(key => { try{ localStorage.removeItem(key); }catch(e){} });
  }
}

function stashLegacyImage(dataUrl){
  const id = uid();
  Media.put(id, dataUrl);
  return id;
}

/* =========================================================
   5. RENDER — teks terikat data-edit
========================================================= */
function applyBindings(root){
  $$('[data-edit]', root || document).forEach(el => {
    if(el.getAttribute('contenteditable') === 'true') return;
    const value = getPath(DATA, el.dataset.edit);
    if(value === undefined || value === null) return;
    if(el.id === 'heroTitle'){ renderHeroName(); return; }
    el.textContent = String(value);
  });
}

function renderHeroName(){
  const el = $('#heroTitle');
  if(!el) return;
  const name = String(DATA.hero.name || '');
  const words = name.trim().split(/\s+/);
  const lastWord = words.length ? words[words.length - 1] : '';
  const splitAt = Math.max(0, lastWord.length - 3);
  const head = words.slice(0, -1).join(' ');
  const tailHead = lastWord.slice(0, splitAt);
  const tail = lastWord.slice(splitAt);

  const line1 = head ? esc(head) : '';
  const line2 = esc(tailHead) + (tail ? '<span class="last">' + esc(tail) + '</span>' : '');
  el.innerHTML = line1 ? (line1 + '<br>' + line2) : line2;

  const curtainName = $('#curtainName');
  if(curtainName) curtainName.textContent = name.toUpperCase();
  document.title = name + ' — Panggung Pribadi';
}

/* ---------- marquee ---------- */
function renderMarquee(){
  const track = $('#marqueeTrack');
  if(!track) return;
  const words = (DATA.marquee && DATA.marquee.length) ? DATA.marquee : ['START', 'DO', 'FINISH'];
  const unit = words.map(w => '<span>' + esc(w) + '</span>').join('');
  track.innerHTML = unit.repeat(6) + unit.repeat(6);
}

function buildBulbs(){
  ['#bulbRowTop', '#bulbRowBottom'].forEach(sel => {
    const el = $(sel);
    if(!el) return;
    let html = '';
    for(let i = 0; i < 42; i++){
      html += '<span class="bulb" style="animation-delay:' + (i * 0.09).toFixed(2) + 's"></span>';
    }
    el.innerHTML = html;
  });
}

/* ---------- about ---------- */
function renderAbout(){
  const grid = $('#aboutGrid');
  if(grid){
    grid.innerHTML = (DATA.about.cards || []).map((card, i) => `
      <article class="about-card reveal" data-rv="${i % 2 ? 'scale' : ''}" data-num="${esc(String(i + 1).padStart(2, '0'))}">
        <div class="card-tools edit-only">
          <button class="mini-btn danger" type="button" data-act="about-del" data-id="${esc(card.id)}" aria-label="Hapus kartu ${esc(card.title)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="stage" data-edit="about.cards.${i}.stage">${esc(card.stage)}</div>
        <h3 data-edit="about.cards.${i}.title">${esc(card.title)}</h3>
        <p data-edit="about.cards.${i}.desc">${esc(card.desc)}</p>
      </article>
    `).join('');
  }

  const statRow = $('#statRow');
  if(statRow){
    const stats = DATA.about.stats || [];
    statRow.innerHTML = stats.map((s, i) => `
      <div class="stat reveal">
        <span class="num" data-edit="about.stats.${i}.num">${esc(s.num)}</span>
        <span class="lbl" data-edit="about.stats.${i}.label">${esc(s.label)}</span>
      </div>
    `).join('');
    statRow.style.display = stats.length ? '' : 'none';
  }
  observeReveals();
}

/* ---------- skills ---------- */
function renderSkills(){
  const list = $('#skillList');
  if(!list) return;
  const items = DATA.skills.items || [];
  if(!items.length){
    list.innerHTML = `<div class="empty-state" style="border-top:none;">
      <div class="es-title">Belum ada keahlian</div>
      <p>Tambahkan keahlian yang paling sering kamu pakai di atas panggung.</p>
    </div>`;
    return;
  }
  list.innerHTML = items.map((s, i) => `
    <div class="skill-row" data-id="${esc(s.id)}">
      <span class="n">${String(i + 1).padStart(2, '0')}</span>
      <span class="name" data-edit="skills.items.${i}.name">${esc(s.name)}</span>
      <span class="bar"><i data-level="${Number(s.level) || 0}"></i></span>
      <span class="tag">${Number(s.level) || 0}%</span>
      <span class="row-tools edit-only">
        <button class="mini-btn" type="button" data-act="skill-level" data-id="${esc(s.id)}" aria-label="Ubah level ${esc(s.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12h16M12 4v16"/></svg>
        </button>
        <button class="mini-btn danger" type="button" data-act="skill-del" data-id="${esc(s.id)}" aria-label="Hapus ${esc(s.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </span>
    </div>
  `).join('');
  animateSkillBars();
}

function animateSkillBars(){
  const bars = $$('#skillList .bar > i');
  const fill = () => bars.forEach(bar => { bar.style.width = (bar.dataset.level || 0) + '%'; });
  if(prefersReduced){ fill(); return; }
  const section = $('#skills');
  if(!section){ fill(); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){ fill(); io.disconnect(); }
    });
  }, { threshold: 0.2 });
  io.observe(section);
}

/* ---------- journey ---------- */
const KIND_LABEL = {
  start: 'Start', school: 'Sekolah', organization: 'Organisasi',
  achievement: 'Prestasi', university: 'Kuliah', project: 'Proyek', future: 'Masa depan'
};

function renderJourney(){
  const list = $('#journeyList');
  if(!list) return;
  const points = DATA.journey.checkpoints || [];

  if(!points.length){
    list.innerHTML = `<li class="empty-state">
      <div class="es-title">Peta perjalanan masih kosong</div>
      <p>Tambahkan checkpoint pertama: tahun, tempat, dan apa yang terjadi di sana.</p>
    </li>`;
    const count = $('#journeyCount');
    if(count) count.textContent = '';
    return;
  }

  list.innerHTML = points.map((p, i) => {
    const logo = Media.get(p.imageId);
    const meta = [p.institution, p.role].filter(Boolean).map(esc).join('<span class="sep">·</span>');
    return `
    <li class="jp ${p.kind === 'future' ? 'future' : ''}" data-id="${esc(p.id)}" data-index="${i}">
      <span class="jp-node" aria-hidden="true"></span>
      <div class="jp-card" role="button" tabindex="0" aria-expanded="false" data-act="jp-toggle">
        <div class="jp-top">
          <span class="jp-year" data-edit="journey.checkpoints.${i}.year">${esc(p.year)}</span>
          <span class="jp-kind">${esc(KIND_LABEL[p.kind] || p.kind || '')}</span>
        </div>
        <div class="jp-title" data-edit="journey.checkpoints.${i}.title">${esc(p.title)}</div>
        ${meta ? `<div class="jp-meta">${meta}</div>` : ''}
        <div class="jp-body">
          ${logo ? `<img class="jp-logo" src="${esc(logo)}" alt="Logo ${esc(p.institution || p.title)}" loading="lazy">` : ''}
          <p data-edit="journey.checkpoints.${i}.desc">${esc(p.desc)}</p>
          ${(p.tags && p.tags.length) ? `<div class="jp-tags">${p.tags.map(t => `<span class="jp-tag">${esc(t)}</span>`).join('')}</div>` : ''}
          <div class="jp-tools edit-only">
            <button class="btn btn-ghost btn-sm" type="button" data-act="jp-edit" data-id="${esc(p.id)}">Sunting</button>
            <button class="btn btn-ghost btn-sm" type="button" data-act="jp-up" data-id="${esc(p.id)}">↑</button>
            <button class="btn btn-ghost btn-sm" type="button" data-act="jp-down" data-id="${esc(p.id)}">↓</button>
            <button class="btn btn-danger btn-sm" type="button" data-act="jp-del" data-id="${esc(p.id)}">Hapus</button>
          </div>
        </div>
      </div>
    </li>`;
  }).join('');

  const count = $('#journeyCount');
  if(count) count.textContent = points.length + ' checkpoint';
  updateJourneyRail();
}

function updateJourneyRail(){
  const rail = $('#railFill');
  const items = $$('#journeyList .jp');
  if(!rail || !items.length) return;
  const mark = window.innerHeight * 0.62;
  let passed = 0;
  items.forEach(item => {
    const rect = item.getBoundingClientRect();
    if(rect.top < mark){ item.classList.add('lit'); passed++; }
    else item.classList.remove('lit');
  });
  const wrap = $('.journey-wrap');
  if(!wrap) return;
  const wr = wrap.getBoundingClientRect();
  const total = wr.height || 1;
  const progress = Math.min(1, Math.max(0, (mark - wr.top) / total));
  rail.style.height = (progress * 100).toFixed(2) + '%';
}

/* ---------- projects ---------- */
function projectCategories(){
  const set = [];
  (DATA.projects.items || []).forEach(p => {
    const cat = (p.category || '').trim();
    if(cat && set.indexOf(cat) === -1) set.push(cat);
  });
  return set;
}

function renderProjectFilters(){
  const row = $('#projectFilters');
  if(!row) return;
  const cats = projectCategories();
  if(!cats.length){ row.innerHTML = ''; return; }
  if(projectFilter !== 'all' && cats.indexOf(projectFilter) === -1) projectFilter = 'all';
  row.innerHTML = ['all'].concat(cats).map(cat => `
    <button class="filter-btn" type="button" data-act="filter" data-cat="${esc(cat)}"
      aria-pressed="${projectFilter === cat ? 'true' : 'false'}">${cat === 'all' ? 'Semua' : esc(cat)}</button>
  `).join('');

  const datalist = $('#categoryList');
  if(datalist) datalist.innerHTML = cats.map(c => `<option value="${esc(c)}"></option>`).join('');
}

function renderProjects(){
  renderProjectFilters();
  const grid = $('#projectGrid');
  if(!grid) return;
  const all = DATA.projects.items || [];
  const items = projectFilter === 'all' ? all : all.filter(p => (p.category || '') === projectFilter);

  if(!items.length){
    grid.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
      <div class="es-title">${all.length ? 'Tidak ada proyek di kategori ini' : 'Panggung ini masih kosong'}</div>
      <p>${all.length ? 'Pilih kategori lain untuk melihat proyek yang sudah tercatat.' : 'Catat pengalaman, kegiatan, atau karya pertama untuk mengisi bagian ini.'}</p>
    </div>`;
    return;
  }

  grid.innerHTML = items.map(p => {
    const idx = indexById(all, p.id);
    const img = Media.get(p.imageId);
    const meta = [p.category, p.year].filter(Boolean).join(' · ');
    return `
    <article class="project-card" data-id="${esc(p.id)}">
      <div class="project-thumb">
        ${img
          ? `<img src="${esc(img)}" alt="Sampul ${esc(p.title)}" loading="lazy">`
          : `<span class="ph">BELUM ADA GAMBAR</span>`}
        <span class="thumb-veil" aria-hidden="true">VIEW PROJECT</span>
      </div>
      <div class="project-body">
        ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
        <h3 data-edit="projects.items.${idx}.title">${esc(p.title)}</h3>
        ${p.role ? `<div class="jp-meta">${esc(p.role)}</div>` : ''}
        ${p.desc ? `<p data-edit="projects.items.${idx}.desc">${esc(p.desc)}</p>` : ''}
        ${(p.tech && p.tech.length) ? `<div class="tech-row">${p.tech.map(t => `<span class="tech-pill">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="project-foot">
          ${p.link
            ? `<a class="project-link" href="${esc(p.link)}" target="_blank" rel="noopener">Lihat tautan
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17L17 7M8 7h9v9"/></svg>
               </a>`
            : '<span></span>'}
          <span class="card-tools edit-only">
            <button class="mini-btn" type="button" data-act="pj-edit" data-id="${esc(p.id)}" aria-label="Sunting ${esc(p.title)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>
            </button>
            <button class="mini-btn" type="button" data-act="pj-dup" data-id="${esc(p.id)}" aria-label="Duplikat ${esc(p.title)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>
            </button>
            <button class="mini-btn danger" type="button" data-act="pj-del" data-id="${esc(p.id)}" aria-label="Hapus ${esc(p.title)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-1 13a1 1 0 01-1 1H8a1 1 0 01-1-1L6 7"/></svg>
            </button>
          </span>
        </div>
      </div>
    </article>`;
  }).join('');
}

/* ---------- gallery ---------- */
function renderGalleryTabs(){
  const row = $('#galleryTabs');
  if(!row) return;
  const cats = DATA.gallery.categories || [];
  if(!findById(cats, galleryCat) && cats.length) galleryCat = cats[0].id;
  row.innerHTML = cats.map(c => `
    <button class="tab-btn" role="tab" type="button" data-act="gal-tab" data-cat="${esc(c.id)}"
      aria-selected="${galleryCat === c.id ? 'true' : 'false'}">${esc(c.label)}</button>
  `).join('');
}

function renderGallery(){
  renderGalleryTabs();
  const grid = $('#galleryGrid');
  if(!grid) return;

  const cat = findById(DATA.gallery.categories || [], galleryCat);
  const title = $('#uploadZoneTitle');
  if(title) title.textContent = cat ? ('Tambahkan ' + cat.label.replace(/^\S+\s/, '').toLowerCase()) : 'Tambahkan berkas';

  const items = (DATA.gallery.items || []).filter(it => it.catId === galleryCat);
  if(!items.length){
    grid.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5-11 11"/></svg>
      <p>Belum ada berkas di kategori ini.</p>
    </div>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    const img = Media.get(item.imageId);
    return `
    <figure class="gallery-item" data-id="${esc(item.id)}">
      ${img ? `<img src="${esc(img)}" alt="${esc(item.alt || item.caption)}" data-act="gal-open" data-id="${esc(item.id)}" tabindex="0" loading="lazy">` : ''}
      <figcaption class="cap">${esc(item.caption)}</figcaption>
      <span class="item-tools edit-only">
        <button class="mini-btn" type="button" data-act="gal-caption" data-id="${esc(item.id)}" aria-label="Ubah keterangan">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>
        </button>
        <button class="mini-btn danger" type="button" data-act="gal-del" data-id="${esc(item.id)}" aria-label="Hapus berkas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </span>
    </figure>`;
  }).join('');
}

/* ---------- contact & sosial ---------- */
const ICONS = {
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="7.5" y1="10" x2="7.5" y2="17"/><circle cx="7.5" cy="6.7" r="0.5" fill="currentColor" stroke="none"/><path d="M11.5 17v-4.2c0-1.6 1-2.6 2.4-2.6s2.1 1 2.1 2.6V17"/>',
  link: '<path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1-1"/>'
};
function iconSvg(type){
  return '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
         (ICONS[type] || ICONS.link) + '</svg>';
}

function renderContact(){
  const cards = $('#contactCards');
  const email = DATA.contact.email || '';

  if(cards){
    let html = '';
    if(email){
      html += `<a class="contact-card" href="mailto:${esc(email)}">
        <span class="ic">${iconSvg('email')}</span>
        <span><span class="label">Email</span><span class="value">${esc(email)}</span></span>
      </a>`;
    }
    (DATA.contact.links || []).forEach(link => {
      const hasUrl = !!link.url;
      const value = link.value || link.url || 'Belum ditautkan';
      html += `<a class="contact-card" href="${hasUrl ? esc(link.url) : '#contact'}" ${hasUrl ? 'target="_blank" rel="noopener"' : ''}>
        <span class="ic">${iconSvg(link.type)}</span>
        <span>
          <span class="label">${esc(link.label)}</span>
          <span class="value ${hasUrl ? '' : 'placeholder'}">${hasUrl ? esc(value) : 'Belum ditautkan'}</span>
        </span>
      </a>`;
    });
    cards.innerHTML = html;
  }

  const mailto = $('#mailtoBtn');
  if(mailto){
    const subject = encodeURIComponent(DATA.contact.mailSubject || '');
    mailto.href = email ? ('mailto:' + email + (subject ? '?subject=' + subject : '')) : '#contact';
  }
  const emailLine = $('#contactEmailLine');
  if(emailLine) emailLine.textContent = email;

  const social = $('#navSocial');
  if(social){
    let html = '';
    if(email){
      html += `<a class="icon-btn" href="mailto:${esc(email)}" aria-label="Kirim email ke ${esc(email)}">${iconSvg('email')}</a>`;
    }
    (DATA.contact.links || []).filter(l => l.url).slice(0, 3).forEach(link => {
      html += `<a class="icon-btn" href="${esc(link.url)}" target="_blank" rel="noopener" aria-label="${esc(link.label)}">${iconSvg(link.type)}</a>`;
    });
    social.innerHTML = html;
  }
}

/* ---------- foto profil ---------- */
function renderPortrait(){
  const img = $('#portraitImg');
  const ph = $('#portraitPlaceholder');
  if(!img || !ph) return;
  const src = Media.get(DATA.portraitId);
  if(src){
    img.src = src;
    img.hidden = false;
    ph.hidden = true;
    img.alt = 'Foto profil ' + (DATA.hero.name || '');
  }else{
    img.hidden = true;
    ph.hidden = false;
  }
}

function renderAll(){
  applyBindings();
  renderMarquee();
  renderAbout();
  renderSkills();
  renderJourney();
  renderProjects();
  renderGallery();
  renderContact();
  renderPortrait();
  applySettings();
  const year = $('#year');
  if(year) year.textContent = new Date().getFullYear();
}

/* ---------- pengaturan tampilan ---------- */
function applySettings(){
  const s = DATA.settings || {};
  document.body.dataset.motion = s.animation || 'balanced';
  if(s.accent){
    const root = document.documentElement;
    root.style.setProperty('--amber', s.accent);
    root.style.setProperty('--amber-strong', shade(s.accent, -8));
    root.style.setProperty('--amber-deep', shade(s.accent, -26));
    root.style.setProperty('--amber-glow', hexToRgba(shade(s.accent, -12), 0.35));
  }
}

function hexToRgb(hex){
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function hexToRgba(hex, alpha){
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
function shade(hex, percent){
  const { r, g, b } = hexToRgb(hex);
  const adjust = v => Math.max(0, Math.min(255, Math.round(v + (percent / 100) * 255)));
  return '#' + [adjust(r), adjust(g), adjust(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/* =========================================================
   6. LOADING SCREEN
========================================================= */
function runCurtain(){
  const curtain = $('#curtain');
  if(!curtain) return Promise.resolve();

  const skip = !DATA.settings.loadingScreen || prefersReduced ||
               sessionStorage.getItem('tfr:seenCurtain') === '1';
  if(skip){
    curtain.classList.add('done');
    curtain.setAttribute('hidden', '');
    document.body.classList.remove('is-booting');
    return Promise.resolve();
  }

  const scenes = $$('.curtain-scene', curtain);
  const bar = $('#curtainBar');
  const wait = ms => new Promise(res => setTimeout(res, ms));
  const show = n => scenes.forEach(s => s.classList.toggle('on', Number(s.dataset.scene) === n));

  return (async function(){
    show(1);
    await wait(340);

    show(2);
    const slots = 14;
    for(let i = 1; i <= slots; i++){
      if(bar) bar.textContent = '[' + '█'.repeat(i) + '░'.repeat(slots - i) + ']';
      await wait(22);
    }
    await wait(90);

    curtain.classList.add('lit');
    show(3);
    await wait(460);

    show(4);
    await wait(480);

    show(5);
    await wait(580);

    show(0);
    curtain.classList.add('parting');
    await wait(320);
    curtain.classList.add('done');
    await wait(300);
    curtain.setAttribute('hidden', '');
    document.body.classList.remove('is-booting');
    sessionStorage.setItem('tfr:seenCurtain', '1');
  })();
}

/* =========================================================
   7. NAVIGASI, SCROLL, REVEAL
========================================================= */
function initNav(){
  const toggle = $('#navToggle');
  const links = $('#navLinks');
  if(!toggle || !links) return;
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $$('a', links).forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

let revealObserver = null;
function observeReveals(){
  if(!revealObserver){
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if(!entry.isIntersecting) return;
        const delay = prefersReduced ? 0 : Math.min(i * 70, 280);
        setTimeout(() => entry.target.classList.add('is-visible'), delay);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  }
  $$('.reveal:not(.is-visible)').forEach(el => revealObserver.observe(el));
}

function initSectionSpy(){
  const sections = $$('[data-section]');
  if(!sections.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(!entry.isIntersecting) return;
      const name = entry.target.dataset.section;
      activeSection = name;
      $$('#navLinks a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
      });
      Pet.onSection(name);
      if(name === 'final') lightFinalStage();
    });
  }, { threshold: 0.4 });
  sections.forEach(s => io.observe(s));
}

function lightFinalStage(){
  const stage = $('#final');
  if(!stage || stage.classList.contains('lit')) return;
  stage.classList.add('dimmed');
  setTimeout(() => stage.classList.add('lit'), prefersReduced ? 0 : 420);
}

function initScrollEffects(){
  const progress = $('#scrollProgress');
  let ticking = false;
  const onScroll = () => {
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if(progress){
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        progress.style.width = pct.toFixed(2) + '%';
      }
      updateJourneyRail();
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', debounce(updateJourneyRail, 150));
  onScroll();
}

function initCursor(){
  if(prefersReduced || isTouch) return;
  const spot = $('#cursorSpot');
  if(!spot) return;
  let raf = null;
  window.addEventListener('mousemove', e => {
    if(raf) return;
    raf = requestAnimationFrame(() => {
      spot.style.setProperty('--mx', e.clientX + 'px');
      spot.style.setProperty('--my', e.clientY + 'px');
      raf = null;
    });
  });
}

function initMagnetic(){
  if(prefersReduced || isTouch) return;
  $$('.magnetic').forEach(el => {
    el.addEventListener('mousemove', e => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * 0.18;
      const y = (e.clientY - rect.top - rect.height / 2) * 0.28;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

function animateHeroTitle(){
  if(prefersReduced) return;
  const el = $('#heroTitle');
  if(!el) return;
  /* Setiap KATA dibungkus span.word (nowrap) berisi span.ch per huruf.
     Baris hanya boleh patah di antara kata, tidak pernah di tengahnya —
     spasi antar kata tetap teks biasa supaya wrapping alami browser jalan. */
  const walk = node => {
    Array.from(node.childNodes).forEach(child => {
      if(child.nodeType === 3){
        const frag = document.createDocumentFragment();
        const text = String(child.textContent);
        const parts = text.split(/(\s+)/); // simpan spasi sebagai elemen terpisah
        parts.forEach(part => {
          if(part === '') return;
          if(/^\s+$/.test(part)){
            frag.appendChild(document.createTextNode(part));
            return;
          }
          const word = document.createElement('span');
          word.className = 'word';
          Array.from(part).forEach(ch => {
            const span = document.createElement('span');
            span.className = 'ch';
            span.textContent = ch;
            word.appendChild(span);
          });
          frag.appendChild(word);
        });
        node.replaceChild(frag, child);
      }else if(child.nodeType === 1 && child.tagName !== 'BR'){
        walk(child);
      }
    });
  };
  walk(el);
  $$('.ch', el).forEach((span, i) => {
    span.style.animationDelay = (i * 0.026).toFixed(3) + 's';
  });
}

/* =========================================================
   8. LIGHTBOX & TOAST
========================================================= */
function openLightbox(src, caption){
  const box = $('#lightbox');
  if(!box) return;
  $('#lightboxImg').src = src;
  $('#lightboxImg').alt = caption || '';
  $('#lightboxCap').textContent = caption || '';
  box.classList.add('open');
  document.body.classList.add('no-scroll');
  $('#lightboxClose').focus();
}
function closeLightbox(){
  const box = $('#lightbox');
  if(!box) return;
  box.classList.remove('open');
  document.body.classList.remove('no-scroll');
  $('#lightboxImg').src = '';
}

let toastTimer = null;
function toast(message, isWarning){
  const el = $('#saveToast');
  if(!el) return;
  el.textContent = message;
  el.classList.toggle('warn', !!isWarning);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), isWarning ? 4200 : 1800);
}

/* =========================================================
   9. MODAL
========================================================= */
let lastFocused = null;

function openModal(el){
  if(!el) return;
  lastFocused = document.activeElement;
  el.classList.add('open');
  document.body.classList.add('no-scroll');
  const focusable = el.querySelector('input:not([type="file"]), textarea, select, button');
  if(focusable) setTimeout(() => focusable.focus(), 40);
}
function closeModal(el){
  if(!el) return;
  el.classList.remove('open');
  if(!$('.modal-overlay.open')) document.body.classList.remove('no-scroll');
  if(lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
}
function topModal(){ return $('.modal-overlay.open'); }

function initModalBehaviour(){
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('mousedown', e => { if(e.target === overlay) closeModal(overlay); });
  });
  document.addEventListener('keydown', e => {
    if(e.key !== 'Tab') return;
    const modal = topModal();
    if(!modal) return;
    const focusables = $$('a[href], button:not([disabled]), input:not([type="file"]), textarea, select, [tabindex]:not([tabindex="-1"])', modal)
      .filter(el => el.offsetParent !== null);
    if(!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
}

/* Dialog konfirmasi yang bisa dipakai ulang. */
function confirmAction(options){
  return new Promise(resolve => {
    const modal = $('#confirmModal');
    const typeWrap = $('#confirmTypeWrap');
    const typeInput = $('#confirmTypeInput');
    $('#confirmTitle').textContent = options.title || 'Konfirmasi';
    $('#confirmText').textContent = options.text || '';
    $('#confirmOk').textContent = options.okLabel || 'Lanjutkan';
    $('#confirmOk').className = 'btn btn-sm ' + (options.danger ? 'btn-danger' : 'btn-primary');

    const needsTyping = !!options.typeWord;
    typeWrap.hidden = !needsTyping;
    if(needsTyping){
      /* Bangun ulang isi label: promptText sempat menimpanya. */
      const labelEl = typeWrap.querySelector('label');
      labelEl.innerHTML = 'Ketik <b id="confirmTypeWord"></b> untuk melanjutkan';
      labelEl.querySelector('b').textContent = options.typeWord;
      typeInput.value = '';
    }

    function cleanup(result){
      $('#confirmOk').removeEventListener('click', onOk);
      $('#confirmCancel').removeEventListener('click', onCancel);
      $('#confirmClose').removeEventListener('click', onCancel);
      closeModal(modal);
      resolve(result);
    }
    function onOk(){
      if(needsTyping && typeInput.value.trim().toUpperCase() !== options.typeWord.toUpperCase()){
        toast('Ketik ' + options.typeWord + ' untuk melanjutkan.', true);
        return;
      }
      cleanup(true);
    }
    function onCancel(){ cleanup(false); }

    $('#confirmOk').addEventListener('click', onOk);
    $('#confirmCancel').addEventListener('click', onCancel);
    $('#confirmClose').addEventListener('click', onCancel);
    openModal(modal);
  });
}

/* =========================================================
   10. PET SYSTEM
========================================================= */
const Pet = (function(){
  let current = 'cat';
  let bubbleTimer = null;
  let lastSpoke = 0;
  let clickCount = 0;
  let idleTimer = null;

  function el(){ return current === 'eagle' ? $('#petEagle') : $('#petCat'); }
  function config(){ return (DATA.pets && DATA.pets[current]) || { lines: {}, click: [], cooldown: 14 }; }

  function setPet(name){
    current = (name === 'eagle') ? 'eagle' : 'cat';
    const cat = $('#petCat');
    const eagle = $('#petEagle');
    if(cat) cat.hidden = current !== 'cat';
    if(eagle) eagle.hidden = current !== 'eagle';
    const node = el();
    if(node){
      const label = config().name || (current === 'eagle' ? 'Elang' : 'Kucing');
      node.setAttribute('aria-label', 'Maskot ' + label + ' — klik untuk berinteraksi');
    }
  }

  function say(text, force){
    if(!text) return;
    const now = Date.now();
    const cooldown = (Number(config().cooldown) || 14) * 1000;
    if(!force && now - lastSpoke < cooldown) return;
    lastSpoke = now;

    const bubble = $('#petBubble');
    if(!bubble) return;
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 3400);
  }

  function hop(){
    const node = el();
    if(!node || prefersReduced) return;
    node.classList.remove('jump');
    void node.offsetWidth;
    node.classList.add('jump');
  }

  function onSection(name){
    const line = (config().lines || {})[name];
    if(line) say(line);
  }

  function onClick(){
    hop();
    clickCount++;
    if(clickCount === 7){
      say('You found the hidden layer.', true);
      clickCount = 0;
      return;
    }
    const lines = config().click || [];
    if(lines.length) say(lines[Math.floor(Math.random() * lines.length)], true);
  }

  function trackCursor(){
    if(prefersReduced || isTouch) return;
    let raf = null;
    window.addEventListener('mousemove', e => {
      if(raf) return;
      raf = requestAnimationFrame(() => {
        const node = el();
        raf = null;
        if(!node || node.hidden) return;
        const rect = node.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height * 0.42;
        const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
        const dist = Math.min(2.4, Math.hypot(e.clientX - cx, e.clientY - cy) / 40);
        const px = (Math.cos(angle) * dist).toFixed(2);
        const py = (Math.sin(angle) * dist).toFixed(2);
        $$('.pet-pupil', node).forEach(p => p.setAttribute('transform', `translate(${px} ${py})`));
      });
    });
  }

  function idleLoop(){
    if(prefersReduced) return;
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      if(document.hidden || editMode) return;
      if(Math.random() < 0.35) hop();
    }, 22000);
  }

  function init(){
    setPet((DATA.settings && DATA.settings.pet) || 'cat');
    [$('#petCat'), $('#petEagle')].forEach(node => {
      if(!node) return;
      node.addEventListener('click', onClick);
      node.addEventListener('keydown', e => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); onClick(); }
      });
    });
    trackCursor();
    idleLoop();
  }

  return { init, setPet, say, onSection, get current(){ return current; } };
})();

/* =========================================================
   10b. BACKSOUND — musik latar panggung
   Dua sumber, dicoba berurutan:
   1) File milik pemilik di music/theme.mp3 (taruh sejajar
      index.html) — pilih lagu no-copyright apa pun dari sana.
   2) Kalau file itu tidak ada, situs memutar musik ambient
      yang DISINTESIS langsung di browser lewat Web Audio API —
      bukan sampel/rekaman apa pun, jadi otomatis 100% bebas
      hak cipta.
   Kebijakan autoplay browser tetap dihormati: audio baru mulai
   setelah pengunjung mengklik tombol speaker sendiri.
========================================================= */
const Music = (function(){
  let ctx = null;
  let master = null;
  let pad = null;              // graph sintesis (jika dipakai)
  let customEl = null;         // <audio> milik pemilik (jika ada)
  let customAvailable = null;  // null = belum dicek, true/false setelahnya
  let playing = false;
  let chordTimer = null;
  let chordIndex = 0;

  /* Progresi akord hangat & tenang (Am7 - Fmaj7 - Cmaj7 - G6),
     ditulis sebagai frekuensi empat suara supaya bisa "meluncur"
     halus dari satu akord ke akord berikutnya tanpa klik. */
  const CHORDS = [
    [110.00, 130.81, 164.81, 196.00],   // Am7
    [87.31,  110.00, 130.81, 164.81],   // Fmaj7
    [130.81, 164.81, 196.00, 246.94],   // Cmaj7
    [98.00,  123.47, 146.83, 196.00]    // G6
  ];

  const MUSIC_URL = 'music/theme.mp3?v=' + Date.now(); // cache-busting biar tidak nyangkut ke 404 lama

  function checkCustomFile(){
    if(customAvailable !== null) return Promise.resolve(customAvailable);
    return new Promise(resolve => {
      const audio = new Audio();
      let done = false;
      const finish = ok => {
        if(done) return;
        done = true;
        customAvailable = ok;
        audio.removeEventListener('loadedmetadata', onOk);
        audio.removeEventListener('canplay', onOk);
        audio.removeEventListener('error', onErr);
        resolve(ok);
      };
      /* 'loadedmetadata'/'canplay' jauh lebih cepat & konsisten daripada
         'canplaythrough' — cukup tahu durasinya sudah kebaca, tidak perlu
         menunggu seluruh berkas ter-buffer dulu. */
      const onOk = () => finish(true);
      const onErr = () => finish(false);
      audio.addEventListener('loadedmetadata', onOk, { once: true });
      audio.addEventListener('canplay', onOk, { once: true });
      audio.addEventListener('error', onErr, { once: true });
      setTimeout(() => finish(false), 6000); // beri ruang untuk koneksi lambat
      audio.preload = 'auto';
      audio.src = MUSIC_URL;
      audio.load();
    });
  }

  /* Impulse response sederhana (noise meluruh) untuk kesan ruang
     tanpa perlu mengunduh berkas reverb apa pun. */
  function makeImpulse(context, seconds, decay){
    const rate = context.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = context.createBuffer(2, length, rate);
    for(let ch = 0; ch < 2; ch++){
      const data = buffer.getChannelData(ch);
      for(let i = 0; i < length; i++){
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  function buildPad(){
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 820;
    filter.Q.value = 0.35;

    const dry = ctx.createGain(); dry.gain.value = 0.85;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 2.4, 2.6);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26; comp.ratio.value = 3;

    filter.connect(dry); dry.connect(comp);
    filter.connect(convolver); convolver.connect(wet); wet.connect(comp);
    comp.connect(master);

    /* gerakan lambat pada filter, seperti napas panggung */
    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.045;
    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = 220;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);
    filterLfo.start();

    const voices = CHORDS[0].map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;

      const vGain = ctx.createGain();
      vGain.gain.value = 0.16;

      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 0.1 + i * 0.013;
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.value = 2.4;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.detune);

      osc.connect(vGain);
      vGain.connect(filter);
      osc.start();
      vibrato.start();
      return { osc, vibrato, vGain };
    });

    return { filter, voices, filterLfo };
  }

  function nextChord(){
    if(!pad) return;
    chordIndex = (chordIndex + 1) % CHORDS.length;
    const chord = CHORDS[chordIndex];
    const now = ctx.currentTime;
    pad.voices.forEach((voice, i) => {
      voice.osc.frequency.setTargetAtTime(chord[i], now, 3.2); // meluncur halus
    });
  }

  function ensureContext(){
    if(ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volumeToGain();
    master.connect(ctx.destination);
  }

  function volumeToGain(){
    const pct = (DATA.settings && Number(DATA.settings.musicVolume)) || 0;
    return Math.max(0, Math.min(1, pct / 100)) * 0.5; // batas atas dijaga tetap lembut
  }

  async function play(){
    const hasCustom = await checkCustomFile();
    if(hasCustom){
      if(!customEl){
        customEl = new Audio(MUSIC_URL);
        customEl.loop = true;
      }
      customEl.volume = volumeToGain() * 2; // <audio>.volume 0..1, skala berbeda dari WebAudio gain
      try{ await customEl.play(); }catch(err){ toast('Browser memblokir pemutaran otomatis.', true); return; }
    }else{
      ensureContext();
      if(ctx.state === 'suspended') await ctx.resume();
      if(!pad) pad = buildPad();
      clearInterval(chordTimer);
      chordTimer = setInterval(nextChord, 9000);
    }
    playing = true;
    updateToggleUI();
  }

  function pause(){
    if(customEl) customEl.pause();
    if(ctx && ctx.state === 'running') ctx.suspend();
    clearInterval(chordTimer);
    playing = false;
    updateToggleUI();
  }

  function toggle(){ playing ? pause() : play(); }

  function setVolume(pct){
    DATA.settings.musicVolume = Math.max(0, Math.min(100, Math.round(pct)));
    if(master) master.gain.setTargetAtTime(volumeToGain(), ctx.currentTime, 0.2);
    if(customEl) customEl.volume = volumeToGain() * 2;
  }

  function updateToggleUI(){
    const btn = $('#musicToggle');
    if(!btn) return;
    btn.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Jeda musik latar' : 'Putar musik latar');
  }

  function applyVisibility(){
    const btn = $('#musicToggle');
    if(btn) btn.hidden = !(DATA.settings && DATA.settings.musicEnabled !== false);
  }

  function init(){
    applyVisibility();
    const btn = $('#musicToggle');
    if(btn) btn.addEventListener('click', toggle);
    /* Hentikan audio yang sedang jalan kalau tab disembunyikan lama,
       supaya tidak menumpuk proses di tab yang ditinggalkan. */
    document.addEventListener('visibilitychange', () => {
      if(document.hidden && playing) pause();
    });
  }

  return { init, play, pause, toggle, setVolume, applyVisibility, get isPlaying(){ return playing; } };
})();

/* =========================================================
   11. MODE EDIT — pintu rahasia
========================================================= */
async function sha256Hex(text){
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function setEditMode(on){
  editMode = !!on;
  document.body.classList.toggle('edit-mode', editMode);
  if(!editMode){
    setPreviewMode(false);
    closePanel();
    sessionStorage.removeItem(SESSION_KEY);
  }else{
    sessionStorage.setItem(SESSION_KEY, '1');
  }
}

function setPreviewMode(on){
  previewMode = !!on;
  document.body.classList.toggle('preview-mode', previewMode);
  const exit = $('#previewExit');
  if(exit) exit.hidden = !previewMode;
  if(previewMode) closePanel();
}

function askPassword(){
  if(editMode){ toast('Mode edit sudah aktif.'); return; }
  const modal = $('#passModal');
  $('#passError').classList.remove('show');
  $('#passInput').value = '';
  openModal(modal);
}

function initSecretTriggers(){
  document.addEventListener('keydown', async e => {
    const meta = e.ctrlKey || e.metaKey;

    if(meta && e.shiftKey && (e.code === 'KeyE' || e.key.toLowerCase() === 'e')){
      e.preventDefault();
      askPassword();
      return;
    }
    if(meta && !e.shiftKey && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')){
      if(!editMode) return;
      e.preventDefault();
      togglePalette(true);
      return;
    }
    if(meta && !e.shiftKey && (e.code === 'KeyS' || e.key.toLowerCase() === 's')){
      if(!editMode) return;
      e.preventDefault();
      commitActiveEdit();
      saveNow();
      return;
    }
    if(e.key === 'Escape'){
      const editing = $('[contenteditable="true"]');
      if(editing){ cancelInlineEdit(editing); return; }
      if(!$('#paletteOverlay').hidden){ togglePalette(false); return; }
      const modal = topModal();
      if(modal){ closeModal(modal); return; }
      if($('#lightbox').classList.contains('open')){ closeLightbox(); return; }
      const panel = $('#editorPanel');
      if(panel && panel.classList.contains('open')){ closePanel(); return; }
      if(previewMode) setPreviewMode(false);
    }
  });

  /* Klik logo lima kali dengan cepat. */
  const logo = $('#logoMark');
  if(logo){
    let hits = 0;
    let timer = null;
    logo.addEventListener('click', e => {
      hits++;
      clearTimeout(timer);
      timer = setTimeout(() => { hits = 0; }, 1400);
      if(hits >= 5){
        e.preventDefault();
        hits = 0;
        askPassword();
      }
    });
  }
}

function initPasswordForm(){
  const form = $('#passForm');
  if(!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const value = $('#passInput').value;
    let hash = '';
    try{ hash = await sha256Hex(value); }
    catch(err){ toast('Browser ini tidak mendukung Web Crypto.', true); return; }

    if(hash === EDIT_PASS_HASH){
      setEditMode(true);
      closeModal($('#passModal'));
      toast('Mode edit aktif');
      Pet.say('Backstage. Silakan mulai.', true);
    }else{
      $('#passError').classList.add('show');
      $('#passInput').select();
    }
  });
  $('#closePassModal').addEventListener('click', () => closeModal($('#passModal')));
  $('#cancelPassBtn').addEventListener('click', () => closeModal($('#passModal')));
}

/* =========================================================
   12. EDITOR TEKS INLINE
========================================================= */
function startInlineEdit(el){
  if(!el || el.getAttribute('contenteditable') === 'true') return;
  const path = el.dataset.edit;
  const raw = getPath(DATA, path);
  el.dataset.orig = raw == null ? '' : String(raw);
  if(el.id === 'heroTitle') el.textContent = el.dataset.orig;

  el.setAttribute('contenteditable', 'true');
  el.setAttribute('spellcheck', 'false');
  el.focus();

  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  el.addEventListener('blur', onEditBlur);
  el.addEventListener('keydown', onEditKey);
}

function onEditBlur(e){ commitInlineEdit(e.currentTarget); }

function onEditKey(e){
  const el = e.currentTarget;
  const multiline = el.tagName === 'P' || el.dataset.multiline === '1';
  if(e.key === 'Enter' && !multiline){ e.preventDefault(); el.blur(); }
  if(e.key === 'Enter' && multiline && e.ctrlKey){ e.preventDefault(); el.blur(); }
  if(e.key === 'Escape'){ e.preventDefault(); cancelInlineEdit(el); }
}

function stopEditing(el){
  el.removeAttribute('contenteditable');
  el.removeAttribute('spellcheck');
  el.removeEventListener('blur', onEditBlur);
  el.removeEventListener('keydown', onEditKey);
}

function commitInlineEdit(el){
  if(!el || el.getAttribute('contenteditable') !== 'true') return;
  const path = el.dataset.edit;
  const value = el.textContent.replace(/\s+$/, '').trim();
  stopEditing(el);
  setPath(DATA, path, value);
  save();

  if(path === 'hero.name'){ renderHeroName(); renderPortrait(); }
  else el.textContent = value;

  if(path.indexOf('marquee') === 0) renderMarquee();
}

function cancelInlineEdit(el){
  if(!el) return;
  const orig = el.dataset.orig || '';
  stopEditing(el);
  if(el.id === 'heroTitle') renderHeroName();
  else el.textContent = orig;
}

function commitActiveEdit(){
  const el = $('[contenteditable="true"]');
  if(el) commitInlineEdit(el);
}

/* =========================================================
   13. PANEL EDITOR
========================================================= */
let activePanel = '';

function openPanel(name){
  const panel = $('#editorPanel');
  if(!panel) return;
  activePanel = name;
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('open'));
  document.body.classList.add('panel-open');
  $('#panelTitle').textContent = ({
    content: 'Content', journey: 'Journey', projects: 'Projects',
    pet: 'Pet', design: 'Design', system: 'System'
  })[name] || 'Editor';
  $$('.tb-btn[data-panel]').forEach(btn => btn.classList.toggle('active', btn.dataset.panel === name));
  renderPanel();
}

function closePanel(){
  const panel = $('#editorPanel');
  if(!panel) return;
  panel.classList.remove('open');
  document.body.classList.remove('panel-open');
  activePanel = '';
  $$('.tb-btn[data-panel]').forEach(btn => btn.classList.remove('active'));
  setTimeout(() => { if(!panel.classList.contains('open')) panel.hidden = true; }, 300);
}

function field(label, path, opts){
  opts = opts || {};
  const value = getPath(DATA, path);
  const safe = esc(value == null ? '' : value);
  const input = opts.textarea
    ? `<textarea rows="${opts.rows || 3}" data-bind="${esc(path)}" data-render="${esc(opts.render || '')}">${safe}</textarea>`
    : `<input type="${opts.type || 'text'}" data-bind="${esc(path)}" data-render="${esc(opts.render || '')}" value="${safe}" placeholder="${esc(opts.placeholder || '')}">`;
  return `<div class="form-field"><label>${esc(label)}</label>${input}</div>`;
}

function panelItem(title, sub, tools){
  return `<div class="panel-item">
    <div class="pi-main">
      <div class="pi-title">${esc(title)}</div>
      ${sub ? `<div class="pi-sub">${esc(sub)}</div>` : ''}
    </div>
    <div class="pi-tools">${tools}</div>
  </div>`;
}

const TOOL_ICONS = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M18 13l-6 6-6-6"/></svg>',
  dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
function toolBtn(act, id, icon, label, danger){
  return `<button class="mini-btn ${danger ? 'danger' : ''}" type="button" data-act="${act}" data-id="${esc(id)}" aria-label="${esc(label)}">${TOOL_ICONS[icon]}</button>`;
}

function renderPanel(){
  const body = $('#panelBody');
  if(!body || !activePanel) return;
  const map = {
    content: panelContent, journey: panelJourney, projects: panelProjects,
    pet: panelPet, design: panelDesign, system: panelSystem
  };
  body.innerHTML = (map[activePanel] || (() => ''))();
  if(activePanel === 'system') refreshStorageInfo();
}

function panelContent(){
  return `
    <div class="panel-section">
      <h4>Hero</h4>
      ${field('Status', 'hero.status')}
      ${field('Nama', 'hero.name', { render: 'hero' })}
      ${field('Peran singkat', 'hero.role')}
      ${field('Tagline', 'hero.tagline', { textarea: true })}
      ${field('Tombol utama', 'hero.ctaPrimary')}
      ${field('Tombol kedua', 'hero.ctaSecondary')}
    </div>

    <div class="panel-section">
      <h4>About</h4>
      ${field('Eyebrow', 'about.eyebrow')}
      ${field('Judul', 'about.title')}
      ${field('Pengantar', 'about.intro', { textarea: true })}
      <div class="panel-list">
        ${(DATA.about.cards || []).map(card => panelItem(card.title, card.stage,
          toolBtn('about-del', card.id, 'del', 'Hapus kartu', true))).join('')}
      </div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="about-add">+ Kartu</button></div>
      <p class="panel-hint">Isi kartu disunting langsung di halaman: klik teksnya.</p>
    </div>

    <div class="panel-section">
      <h4>Statistik</h4>
      <div class="panel-list">
        ${(DATA.about.stats || []).map(s => panelItem(s.num + ' — ' + s.label, '',
          toolBtn('stat-del', s.id, 'del', 'Hapus statistik', true))).join('')}
      </div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="stat-add">+ Statistik</button></div>
    </div>

    <div class="panel-section">
      <h4>Skills</h4>
      ${field('Eyebrow', 'skills.eyebrow')}
      ${field('Judul', 'skills.title')}
      <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="skill-add">+ Keahlian</button></div>
    </div>

    <div class="panel-section">
      <h4>Kontak</h4>
      ${field('Email', 'contact.email', { type: 'text', render: 'contact' })}
      ${field('Subjek email', 'contact.mailSubject', { render: 'contact' })}
      ${field('Judul panel', 'contact.panelTitle')}
      ${field('Teks panel', 'contact.panelIntro', { textarea: true })}
      ${field('Label tombol', 'contact.ctaLabel')}
      <div class="panel-list">
        ${(DATA.contact.links || []).map(l => panelItem(l.label, l.url || 'belum ditautkan',
          toolBtn('link-edit', l.id, 'edit', 'Sunting tautan') + toolBtn('link-del', l.id, 'del', 'Hapus tautan', true))).join('')}
      </div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="link-add">+ Tautan</button></div>
    </div>

    <div class="panel-section">
      <h4>Final stage &amp; footer</h4>
      ${field('Kicker', 'final.kicker')}
      ${field('Headline', 'final.headline')}
      ${field('Nama', 'final.name')}
      ${field('Ucapan penutup', 'final.thanks', { textarea: true, rows: 2 })}
      ${field('Motto footer', 'footer.motto')}
      ${field('Copyright', 'footer.copyright', { textarea: true, rows: 2 })}
    </div>
  `;
}

function panelJourney(){
  const points = DATA.journey.checkpoints || [];
  return `
    <div class="panel-section">
      <h4>Judul section</h4>
      ${field('Eyebrow', 'journey.eyebrow')}
      ${field('Judul', 'journey.title')}
      ${field('Pengantar', 'journey.intro', { textarea: true })}
    </div>
    <div class="panel-section">
      <h4>Checkpoint (${points.length})</h4>
      <div class="panel-list">
        ${points.map(p => panelItem(
          p.year + ' — ' + p.title,
          [p.institution, p.role].filter(Boolean).join(' · '),
          toolBtn('jp-edit', p.id, 'edit', 'Sunting checkpoint') +
          toolBtn('jp-up', p.id, 'up', 'Naikkan') +
          toolBtn('jp-down', p.id, 'down', 'Turunkan') +
          toolBtn('jp-del', p.id, 'del', 'Hapus checkpoint', true)
        )).join('') || '<p class="panel-hint">Belum ada checkpoint.</p>'}
      </div>
      <div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="jp-add">+ Checkpoint</button></div>
    </div>
  `;
}

function panelProjects(){
  const items = DATA.projects.items || [];
  return `
    <div class="panel-section">
      <h4>Judul section</h4>
      ${field('Eyebrow', 'projects.eyebrow')}
      ${field('Judul', 'projects.title')}
    </div>
    <div class="panel-section">
      <h4>Proyek (${items.length})</h4>
      <div class="panel-list">
        ${items.map(p => panelItem(
          p.title,
          [p.category, p.year].filter(Boolean).join(' · '),
          toolBtn('pj-edit', p.id, 'edit', 'Sunting proyek') +
          toolBtn('pj-up', p.id, 'up', 'Naikkan') +
          toolBtn('pj-down', p.id, 'down', 'Turunkan') +
          toolBtn('pj-dup', p.id, 'dup', 'Duplikat proyek') +
          toolBtn('pj-del', p.id, 'del', 'Hapus proyek', true)
        )).join('') || '<p class="panel-hint">Belum ada proyek.</p>'}
      </div>
      <div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="pj-add">+ Proyek</button></div>
    </div>
    <div class="panel-section">
      <h4>Galeri</h4>
      <div class="panel-list">
        ${(DATA.gallery.categories || []).map(c => panelItem(
          c.label,
          (DATA.gallery.items || []).filter(i => i.catId === c.id).length + ' berkas',
          toolBtn('galcat-del', c.id, 'del', 'Hapus kategori', true)
        )).join('')}
      </div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="galcat-add">+ Kategori galeri</button></div>
      <p class="panel-hint">Unggah berkas lewat kotak unggah di section Galeri.</p>
    </div>
  `;
}

function panelPet(){
  const key = (DATA.settings && DATA.settings.pet) || 'cat';
  const pet = DATA.pets[key] || {};
  const lines = pet.lines || {};
  const sections = [
    ['hero', 'Hero'], ['about', 'About'], ['journey', 'Journey'], ['skills', 'Skills'],
    ['projects', 'Projects'], ['gallery', 'Gallery'], ['final', 'Final stage'], ['contact', 'Contact']
  ];
  return `
    <div class="panel-section">
      <h4>Pilih pet</h4>
      <div class="seg">
        <button type="button" data-act="pet-set" data-pet="cat" aria-pressed="${key === 'cat'}">🐱 CAT</button>
        <button type="button" data-act="pet-set" data-pet="eagle" aria-pressed="${key === 'eagle'}">🦅 EAGLE</button>
      </div>
      <p class="panel-hint">Pergantian langsung terlihat di pojok layar — itu pratinjaunya.</p>
    </div>
    <div class="panel-section">
      <h4>Identitas</h4>
      ${field('Nama pet', 'pets.' + key + '.name', { render: 'pet' })}
      ${field('Jeda bicara (detik)', 'pets.' + key + '.cooldown', { type: 'number' })}
    </div>
    <div class="panel-section">
      <h4>Dialog per section</h4>
      ${sections.map(([id, label]) => field(label, 'pets.' + key + '.lines.' + id)).join('')}
    </div>
    <div class="panel-section">
      <h4>Dialog saat diklik</h4>
      <div class="form-field">
        <label>Satu baris per kalimat</label>
        <textarea rows="5" data-bind-lines="pets.${esc(key)}.click">${esc((pet.click || []).join('\n'))}</textarea>
      </div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="pet-test">Coba bicara</button></div>
    </div>
  `;
}

function panelDesign(){
  const s = DATA.settings || {};
  const swatches = ['#ffb545', '#ff8c42', '#ffd166', '#8be9c2', '#7aa2ff', '#e07a9c'];
  return `
    <div class="panel-section">
      <h4>Warna aksen</h4>
      <div class="swatch-row">
        ${swatches.map(hex => `<button class="swatch" type="button" data-act="accent" data-hex="${hex}"
          style="background:${hex}" aria-pressed="${s.accent === hex}" aria-label="Aksen ${hex}"></button>`).join('')}
      </div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="accent-reset">Kembali ke amber</button></div>
    </div>
    <div class="panel-section">
      <h4>Intensitas animasi</h4>
      <div class="seg">
        <button type="button" data-act="motion" data-value="minimal" aria-pressed="${s.animation === 'minimal'}">MINIMAL</button>
        <button type="button" data-act="motion" data-value="balanced" aria-pressed="${s.animation === 'balanced'}">BALANCED</button>
        <button type="button" data-act="motion" data-value="cinematic" aria-pressed="${s.animation === 'cinematic'}">CINEMATIC</button>
      </div>
      <p class="panel-hint">Pengunjung dengan "reduce motion" aktif tetap mendapat versi paling tenang, apa pun pilihan ini.</p>
    </div>
    <div class="panel-section">
      <h4>Loading screen</h4>
      <div class="panel-row">
        <span class="rl">Tampilkan saat website dibuka
          <span class="rs">Hanya sekali per sesi browser</span>
        </span>
        <button class="switch" type="button" role="switch" data-act="toggle-loader"
          aria-checked="${s.loadingScreen ? 'true' : 'false'}" aria-label="Loading screen"></button>
      </div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="loader-replay">Putar ulang sekarang</button></div>
    </div>
    <div class="panel-section">
      <h4>Marquee</h4>
      <div class="form-field">
        <label>Kata berjalan (pisahkan dengan koma)</label>
        <input type="text" data-bind-list="marquee" value="${esc((DATA.marquee || []).join(', '))}">
      </div>
    </div>

    <div class="panel-section">
      <h4>Musik latar</h4>
      <div class="panel-row">
        <span class="rl">Tombol musik untuk pengunjung
          <span class="rs">Ambient bebas hak cipta, dibuat langsung di browser</span>
        </span>
        <button class="switch" type="button" role="switch" data-act="toggle-music"
          aria-checked="${s.musicEnabled !== false ? 'true' : 'false'}" aria-label="Tampilkan tombol musik"></button>
      </div>
      <div class="form-field" style="margin-top:14px;">
        <label>Volume (${Number(s.musicVolume) || 0}%)</label>
        <input type="range" min="0" max="100" step="5" data-bind="settings.musicVolume" data-render="music" value="${Number(s.musicVolume) || 0}">
      </div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="music-test">Coba putar</button></div>
      <p class="panel-hint">
        Mau pakai lagu no-copyright pilihanmu sendiri? Taruh berkas MP3 bernama
        <b>music/theme.mp3</b> sejajar index.html — situs otomatis memakainya.
        Kalau berkas itu tidak ada, musik ambient bawaan yang diputar.
      </p>
    </div>
  `;
}

function panelSystem(){
  return `
    <div class="panel-section">
      <h4>Publikasikan</h4>
      <p class="panel-hint" style="margin-top:0;">
        Suntinganmu tersimpan di browser ini saja. Supaya pengunjung ikut melihatnya:
        unduh <b>data.json</b>, lalu unggah ke hosting sejajar dengan index.html.
      </p>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" type="button" data-act="publish">Unduh data.json</button>
      </div>
    </div>

    <div class="panel-section">
      <h4>Sinkronisasi antar perangkat</h4>
      <p class="panel-hint" style="margin-top:0;">
        Tiap perangkat (HP, laptop) menyimpan suntingannya <b>masing-masing secara terpisah</b> —
        tidak otomatis nyambung. Kalau kamu baru publish dari perangkat lain, perangkat ini
        akan tetap memakai suntingannya sendiri sampai kamu tarik versi terbarunya:
      </p>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" type="button" data-act="pull-published">Tarik versi terpublikasi</button>
      </div>
      <p class="panel-hint">
        Ini akan <b>mengganti</b> semua suntingan lokal di perangkat ini (termasuk foto) dengan
        isi <code>data.json</code> yang sedang aktif di hosting. Pastikan sudah publish dari
        perangkat yang benar sebelum menariknya di sini.
      </p>
    </div>

    <div class="panel-section">
      <h4>Cadangan</h4>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" type="button" data-act="export">Export cadangan</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="import">Import cadangan</button>
      </div>
      <p class="panel-hint">Cadangan berisi teks dan gambar. Import akan menimpa isi yang sekarang.</p>
    </div>
    <div class="panel-section">
      <h4>Penyimpanan</h4>
      <div class="panel-row">
        <span class="rl">Terpakai <span class="rs" id="storageInfo">menghitung…</span></span>
      </div>
    </div>
    <div class="panel-section">
      <h4>Ubah password</h4>
      <div class="form-field">
        <label for="newPassInput">Password baru</label>
        <input type="text" id="newPassInput" placeholder="ketik password baru" autocomplete="off">
      </div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="hash-pass">Hitung hash</button></div>
      <div class="form-field" id="hashOutWrap" hidden style="margin-top:14px;">
        <label>Tempel nilai ini ke EDIT_PASS_HASH di script.js</label>
        <input type="text" id="hashOut" readonly>
      </div>
      <p class="panel-hint">Password disimpan sebagai hash di dalam script.js, jadi harus diganti langsung di file itu.</p>
    </div>
    <div class="panel-section">
      <h4>Reset</h4>
      <div class="btn-row"><button class="btn btn-danger btn-sm" type="button" data-act="reset">Reset semua data</button></div>
      <p class="panel-hint">Menghapus seluruh suntingan lokal dan gambar. Tidak bisa dibatalkan.</p>
    </div>
  `;
}

function refreshStorageInfo(){
  const el = $('#storageInfo');
  if(!el) return;
  let textBytes = 0;
  try{ textBytes = (localStorage.getItem(LS_DATA) || '').length; }catch(e){}
  const imgBytes = Media.bytes();
  const fmt = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
  const mode = Media.usingFallback() ? ' · mode: localStorage' : ' · mode: IndexedDB';
  el.textContent = 'teks ' + fmt(textBytes) + ' · gambar ' + fmt(imgBytes) + mode;
}

/* Dialog isian teks singkat (dipakai untuk hal-hal kecil). */
function promptText(options){
  return new Promise(resolve => {
    const modal = $('#confirmModal');
    const wrap = $('#confirmTypeWrap');
    const input = $('#confirmTypeInput');
    const labelEl = wrap.querySelector('label');

    $('#confirmTitle').textContent = options.title || 'Isi teks';
    $('#confirmText').textContent = options.text || '';
    $('#confirmOk').textContent = options.okLabel || 'Simpan';
    $('#confirmOk').className = 'btn btn-sm btn-primary';
    wrap.hidden = false;
    labelEl.innerHTML = esc(options.label || 'Nilai');
    input.value = options.value == null ? '' : options.value;

    function cleanup(result){
      $('#confirmOk').removeEventListener('click', onOk);
      $('#confirmCancel').removeEventListener('click', onCancel);
      $('#confirmClose').removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      labelEl.textContent = 'Ketik untuk melanjutkan';
      wrap.hidden = true;
      closeModal(modal);
      resolve(result);
    }
    function onOk(){ cleanup(input.value.trim()); }
    function onCancel(){ cleanup(null); }
    function onKey(e){ if(e.key === 'Enter'){ e.preventDefault(); onOk(); } }

    $('#confirmOk').addEventListener('click', onOk);
    $('#confirmCancel').addEventListener('click', onCancel);
    $('#confirmClose').addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
    openModal(modal);
    setTimeout(() => { input.focus(); input.select(); }, 60);
  });
}

/* =========================================================
   14. MODAL PROYEK & CHECKPOINT
========================================================= */
let editingProjectId = null;
let pendingProjectImage = null;

function openProjectForm(id){
  editingProjectId = id || null;
  pendingProjectImage = null;
  const project = id ? findById(DATA.projects.items, id) : null;

  $('#projectModalTitle').textContent = project ? 'Sunting proyek' : 'Tambah proyek';
  $('#projectTitle').value = project ? project.title : '';
  $('#projectCategory').value = project ? (project.category || '') : '';
  $('#projectYear').value = project ? (project.year || '') : '';
  $('#projectRole').value = project ? (project.role || '') : '';
  $('#projectDesc').value = project ? (project.desc || '') : '';
  $('#projectTech').value = project ? (project.tech || []).join(', ') : '';
  $('#projectLink').value = project ? (project.link || '') : '';

  const img = project ? Media.get(project.imageId) : '';
  const preview = $('#projectPreviewImg');
  preview.src = img || '';
  preview.hidden = !img;
  $('#projectPreviewPh').hidden = !!img;

  renderProjectFilters();
  openModal($('#projectModal'));
}

function saveProjectForm(e){
  e.preventDefault();
  const title = $('#projectTitle').value.trim();
  if(!title) return;

  const payload = {
    title,
    category: $('#projectCategory').value.trim(),
    year: $('#projectYear').value.trim(),
    role: $('#projectRole').value.trim(),
    desc: $('#projectDesc').value.trim(),
    tech: $('#projectTech').value.split(',').map(s => s.trim()).filter(Boolean),
    link: $('#projectLink').value.trim()
  };

  DATA.projects.items = DATA.projects.items || [];
  if(editingProjectId){
    const project = findById(DATA.projects.items, editingProjectId);
    if(project){
      Object.assign(project, payload);
      if(pendingProjectImage){
        if(project.imageId) Media.remove(project.imageId);
        project.imageId = pendingProjectImage;
      }
    }
  }else{
    DATA.projects.items.unshift(Object.assign({ id: uid(), imageId: pendingProjectImage || '' }, payload));
  }

  saveNow();
  renderProjects();
  closeModal($('#projectModal'));
  if(activePanel === 'projects') renderPanel();
  editingProjectId = null;
  pendingProjectImage = null;
}

let editingJourneyId = null;
let pendingJourneyImage = null;

function openJourneyForm(id){
  editingJourneyId = id || null;
  pendingJourneyImage = null;
  const point = id ? findById(DATA.journey.checkpoints, id) : null;

  $('#journeyModalTitle').textContent = point ? 'Sunting checkpoint' : 'Tambah checkpoint';
  $('#journeyYear').value = point ? point.year : '';
  $('#journeyKind').value = point ? (point.kind || 'school') : 'school';
  $('#journeyTitle').value = point ? point.title : '';
  $('#journeyInstitution').value = point ? (point.institution || '') : '';
  $('#journeyRole').value = point ? (point.role || '') : '';
  $('#journeyDesc').value = point ? (point.desc || '') : '';
  $('#journeyTags').value = point ? (point.tags || []).join(', ') : '';

  const img = point ? Media.get(point.imageId) : '';
  const preview = $('#journeyPreviewImg');
  preview.src = img || '';
  preview.hidden = !img;
  $('#journeyPreviewPh').hidden = !!img;

  openModal($('#journeyModal'));
}

function saveJourneyForm(e){
  e.preventDefault();
  const title = $('#journeyTitle').value.trim();
  const year = $('#journeyYear').value.trim();
  if(!title || !year) return;

  const payload = {
    year, title,
    kind: $('#journeyKind').value,
    institution: $('#journeyInstitution').value.trim(),
    role: $('#journeyRole').value.trim(),
    desc: $('#journeyDesc').value.trim(),
    tags: $('#journeyTags').value.split(',').map(s => s.trim()).filter(Boolean)
  };

  DATA.journey.checkpoints = DATA.journey.checkpoints || [];
  if(editingJourneyId){
    const point = findById(DATA.journey.checkpoints, editingJourneyId);
    if(point){
      Object.assign(point, payload);
      if(pendingJourneyImage){
        if(point.imageId) Media.remove(point.imageId);
        point.imageId = pendingJourneyImage;
      }
    }
  }else{
    const list = DATA.journey.checkpoints;
    const futureAt = list.findIndex(p => p.kind === 'future');
    const item = Object.assign({ id: uid(), imageId: pendingJourneyImage || '' }, payload);
    if(futureAt > -1 && payload.kind !== 'future') list.splice(futureAt, 0, item);
    else list.push(item);
  }

  saveNow();
  renderJourney();
  closeModal($('#journeyModal'));
  if(activePanel === 'journey') renderPanel();
  editingJourneyId = null;
  pendingJourneyImage = null;
}

/* =========================================================
   15. AKSI
========================================================= */
function move(list, id, delta){
  const i = indexById(list, id);
  const j = i + delta;
  if(i < 0 || j < 0 || j >= list.length) return false;
  const [item] = list.splice(i, 1);
  list.splice(j, 0, item);
  return true;
}

async function handleAction(act, el, event){
  const id = el.dataset.id;

  switch(act){

    /* ---------- halaman ---------- */
    case 'jp-toggle': {
      const li = el.closest('.jp');
      if(!li) return;
      const open = li.classList.toggle('open');
      el.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    case 'filter': {
      projectFilter = el.dataset.cat;
      renderProjects();
      return;
    }
    case 'gal-tab': {
      galleryCat = el.dataset.cat;
      renderGallery();
      return;
    }
    case 'gal-open': {
      const item = findById(DATA.gallery.items, id);
      if(item) openLightbox(Media.get(item.imageId), item.caption);
      return;
    }

    /* ---------- about / skills ---------- */
    case 'about-add': {
      DATA.about.cards.push({ id: uid(), stage: '0' + (DATA.about.cards.length + 1) + ' · Babak', title: 'Judul baru', desc: 'Klik teks ini di halaman untuk menggantinya.' });
      saveNow(); renderAbout(); renderPanel();
      return;
    }
    case 'about-del': {
      if(!await confirmAction({ title: 'Hapus kartu', text: 'Kartu ini akan hilang dari section About.', danger: true, okLabel: 'Hapus' })) return;
      DATA.about.cards = DATA.about.cards.filter(c => c.id !== id);
      saveNow(); renderAbout(); renderPanel();
      return;
    }
    case 'stat-add': {
      const num = await promptText({ title: 'Statistik baru', label: 'Angka', value: '10' });
      if(num === null) return;
      const label = await promptText({ title: 'Statistik baru', label: 'Keterangan', value: 'Panggung diisi' });
      if(label === null) return;
      DATA.about.stats.push({ id: uid(), num, label });
      saveNow(); renderAbout(); renderPanel();
      return;
    }
    case 'stat-del': {
      DATA.about.stats = DATA.about.stats.filter(s => s.id !== id);
      saveNow(); renderAbout(); renderPanel();
      return;
    }
    case 'skill-add': {
      const name = await promptText({ title: 'Keahlian baru', label: 'Nama keahlian', value: '' });
      if(!name) return;
      DATA.skills.items.push({ id: uid(), name, level: 80 });
      saveNow(); renderSkills(); renderPanel();
      return;
    }
    case 'skill-level': {
      const skill = findById(DATA.skills.items, id);
      if(!skill) return;
      const value = await promptText({ title: 'Level keahlian', text: 'Angka 0–100.', label: 'Level', value: String(skill.level) });
      if(value === null) return;
      skill.level = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
      saveNow(); renderSkills();
      return;
    }
    case 'skill-del': {
      DATA.skills.items = DATA.skills.items.filter(s => s.id !== id);
      saveNow(); renderSkills(); renderPanel();
      return;
    }

    /* ---------- journey ---------- */
    case 'jp-add': { openJourneyForm(null); return; }
    case 'jp-edit': { if(event) event.stopPropagation(); openJourneyForm(id); return; }
    case 'jp-up':
    case 'jp-down': {
      if(event) event.stopPropagation();
      if(move(DATA.journey.checkpoints, id, act === 'jp-up' ? -1 : 1)){
        saveNow(); renderJourney(); if(activePanel === 'journey') renderPanel();
      }
      return;
    }
    case 'jp-del': {
      if(event) event.stopPropagation();
      if(!await confirmAction({ title: 'Hapus checkpoint', text: 'Babak ini akan hilang dari peta perjalanan.', danger: true, okLabel: 'Hapus' })) return;
      const point = findById(DATA.journey.checkpoints, id);
      if(point && point.imageId) Media.remove(point.imageId);
      DATA.journey.checkpoints = DATA.journey.checkpoints.filter(p => p.id !== id);
      saveNow(); renderJourney(); if(activePanel === 'journey') renderPanel();
      return;
    }

    /* ---------- projects ---------- */
    case 'pj-add': { openProjectForm(null); return; }
    case 'pj-edit': { openProjectForm(id); return; }
    case 'pj-dup': {
      const project = findById(DATA.projects.items, id);
      if(!project) return;
      const copy = clone(project);
      copy.id = uid();
      copy.title = project.title + ' (salinan)';
      if(project.imageId){
        const newId = uid();
        await Media.put(newId, Media.get(project.imageId));
        copy.imageId = newId;
      }
      DATA.projects.items.splice(indexById(DATA.projects.items, id) + 1, 0, copy);
      saveNow(); renderProjects(); if(activePanel === 'projects') renderPanel();
      return;
    }
    case 'pj-up':
    case 'pj-down': {
      if(move(DATA.projects.items, id, act === 'pj-up' ? -1 : 1)){
        saveNow(); renderProjects(); renderPanel();
      }
      return;
    }
    case 'pj-del': {
      const project = findById(DATA.projects.items, id);
      if(!await confirmAction({ title: 'Hapus proyek', text: '"' + (project ? project.title : '') + '" akan hilang dari panggung.', danger: true, okLabel: 'Hapus' })) return;
      if(project && project.imageId) Media.remove(project.imageId);
      DATA.projects.items = DATA.projects.items.filter(p => p.id !== id);
      saveNow(); renderProjects(); if(activePanel === 'projects') renderPanel();
      return;
    }

    /* ---------- gallery ---------- */
    case 'gal-caption': {
      const item = findById(DATA.gallery.items, id);
      if(!item) return;
      const caption = await promptText({ title: 'Keterangan berkas', label: 'Caption', value: item.caption });
      if(caption === null) return;
      item.caption = caption;
      const alt = await promptText({ title: 'Teks alternatif', text: 'Dibaca pembaca layar.', label: 'Alt text', value: item.alt || caption });
      if(alt !== null) item.alt = alt;
      saveNow(); renderGallery();
      return;
    }
    case 'gal-del': {
      if(!await confirmAction({ title: 'Hapus berkas', text: 'Foto ini akan dihapus dari galeri.', danger: true, okLabel: 'Hapus' })) return;
      const item = findById(DATA.gallery.items, id);
      if(item && item.imageId) Media.remove(item.imageId);
      DATA.gallery.items = DATA.gallery.items.filter(i => i.id !== id);
      saveNow(); renderGallery();
      return;
    }
    case 'galcat-add': {
      const label = await promptText({ title: 'Kategori galeri baru', label: 'Nama kategori', value: '' });
      if(!label) return;
      DATA.gallery.categories.push({ id: uid(), label });
      saveNow(); renderGallery(); renderPanel();
      return;
    }
    case 'galcat-del': {
      const count = (DATA.gallery.items || []).filter(i => i.catId === id).length;
      if(!await confirmAction({
        title: 'Hapus kategori',
        text: count ? (count + ' berkas di dalamnya ikut terhapus.') : 'Kategori kosong ini akan dihapus.',
        danger: true, okLabel: 'Hapus'
      })) return;
      (DATA.gallery.items || []).filter(i => i.catId === id).forEach(i => Media.remove(i.imageId));
      DATA.gallery.items = DATA.gallery.items.filter(i => i.catId !== id);
      DATA.gallery.categories = DATA.gallery.categories.filter(c => c.id !== id);
      saveNow(); renderGallery(); renderPanel();
      return;
    }

    /* ---------- kontak ---------- */
    case 'link-add': {
      const label = await promptText({ title: 'Tautan baru', label: 'Nama platform', value: '' });
      if(!label) return;
      const url = await promptText({ title: 'Tautan baru', label: 'URL lengkap', value: 'https://' });
      if(url === null) return;
      DATA.contact.links.push({ id: uid(), type: label.toLowerCase().indexOf('linked') > -1 ? 'linkedin' : 'link', label, value: label, url });
      saveNow(); renderContact(); renderPanel();
      return;
    }
    case 'link-edit': {
      const link = findById(DATA.contact.links, id);
      if(!link) return;
      const url = await promptText({ title: link.label, text: 'Kosongkan untuk menghapus tautannya.', label: 'URL', value: link.url || 'https://' });
      if(url === null) return;
      link.url = url === 'https://' ? '' : url;
      link.value = link.url ? link.url.replace(/^https?:\/\//, '') : '';
      saveNow(); renderContact(); renderPanel();
      return;
    }
    case 'link-del': {
      DATA.contact.links = DATA.contact.links.filter(l => l.id !== id);
      saveNow(); renderContact(); renderPanel();
      return;
    }

    /* ---------- pet ---------- */
    case 'pet-set': {
      DATA.settings.pet = el.dataset.pet;
      saveNow(); Pet.setPet(DATA.settings.pet); renderPanel();
      Pet.say((DATA.pets[DATA.settings.pet].lines || {}).hero || 'Halo.', true);
      return;
    }
    case 'pet-test': {
      const key = DATA.settings.pet;
      const lines = (DATA.pets[key] || {}).click || [];
      Pet.say(lines.length ? lines[Math.floor(Math.random() * lines.length)] : 'Halo!', true);
      return;
    }

    /* ---------- design ---------- */
    case 'accent': {
      DATA.settings.accent = el.dataset.hex;
      saveNow(); applySettings(); renderPanel();
      return;
    }
    case 'accent-reset': {
      DATA.settings.accent = '#ffb545';
      saveNow(); applySettings(); renderPanel();
      return;
    }
    case 'motion': {
      DATA.settings.animation = el.dataset.value;
      saveNow(); applySettings(); renderPanel();
      return;
    }
    case 'toggle-loader': {
      DATA.settings.loadingScreen = !DATA.settings.loadingScreen;
      saveNow(); renderPanel();
      return;
    }
    case 'toggle-music': {
      DATA.settings.musicEnabled = DATA.settings.musicEnabled === false ? true : false;
      saveNow(); Music.applyVisibility(); renderPanel();
      return;
    }
    case 'music-test': {
      Music.toggle();
      return;
    }
    case 'loader-replay': {
      sessionStorage.removeItem('tfr:seenCurtain');
      const curtain = $('#curtain');
      curtain.removeAttribute('hidden');
      curtain.classList.remove('done', 'parting', 'lit');
      document.body.classList.add('is-booting');
      closePanel();
      const wasOn = DATA.settings.loadingScreen;
      DATA.settings.loadingScreen = true;
      await runCurtain();
      DATA.settings.loadingScreen = wasOn;
      return;
    }

    /* ---------- system ---------- */
    case 'publish': { downloadJson('data.json'); return; }
    case 'pull-published': { pullPublished(); return; }
    case 'export': { downloadJson('portfolio-backup.json'); return; }
    case 'import': { importBackup(); return; }
    case 'hash-pass': {
      const value = $('#newPassInput').value;
      if(!value){ toast('Isi password barunya dulu.', true); return; }
      const hash = await sha256Hex(value);
      $('#hashOutWrap').hidden = false;
      $('#hashOut').value = hash;
      $('#hashOut').select();
      return;
    }
    case 'reset': {
      const ok = await confirmAction({
        title: 'Reset semua data',
        text: 'Seluruh teks, proyek, checkpoint, dan gambar yang tersimpan di browser ini akan dihapus.',
        typeWord: 'RESET', danger: true, okLabel: 'Hapus semuanya'
      });
      if(!ok) return;
      try{ localStorage.removeItem(LS_DATA); }catch(e){}
      await Media.clear();
      sessionStorage.removeItem(SESSION_KEY);
      location.reload();
      return;
    }
  }
}

/* =========================================================
   16. EXPORT / IMPORT
========================================================= */
function collectUsedImages(){
  const ids = [];
  const push = id => { if(id && Media.has(id) && ids.indexOf(id) === -1) ids.push(id); };
  push(DATA.portraitId);
  (DATA.journey.checkpoints || []).forEach(p => push(p.imageId));
  (DATA.projects.items || []).forEach(p => push(p.imageId));
  (DATA.gallery.items || []).forEach(i => push(i.imageId));
  const out = {};
  ids.forEach(id => { out[id] = Media.get(id); });
  return out;
}

function downloadJson(filename){
  commitActiveEdit();
  const payload = {
    exportedAt: new Date().toISOString(),
    data: DATA,
    images: collectUsedImages()
  };
  const text = JSON.stringify(payload);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const mb = (text.length / 1048576).toFixed(1);
  toast('✓ ' + filename + ' diunduh (' + mb + ' MB)');
}

/* Tarik data.json yang sedang live di hosting dan jadikan itu sumber
   kebenaran untuk perangkat ini — menimpa suntingan lokal perangkat ini.
   Dipakai saat perangkat A publish, lalu perangkat B mau ikut menyesuaikan
   diri tanpa harus di-reset total. */
async function pullPublished(){
  let json = null;
  try{
    const res = await fetch('data.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('data.json belum ada di hosting (status ' + res.status + ')');
    json = await res.json();
  }catch(err){
    toast('Gagal mengambil data.json: ' + err.message, true);
    return;
  }
  if(!json || !json.data){
    toast('data.json ditemukan tapi strukturnya tidak dikenali.', true);
    return;
  }

  const ok = await confirmAction({
    title: 'Tarik versi terpublikasi',
    text: 'Semua suntingan lokal di perangkat ini (termasuk foto yang belum dipublish) akan diganti dengan isi data.json yang sedang aktif di hosting.',
    okLabel: 'Timpa dengan versi terpublikasi',
    danger: true
  });
  if(!ok) return;

  /* Berbeda dari boot() biasa: di sini publishedData JADI satu-satunya
     sumber (tidak di-merge dengan local lama), supaya suntingan lokal
     yang basi benar-benar tergantikan, bukan cuma ditambal. */
  DATA = deepMerge(clone(DEFAULTS), json.data);
  if(json.images){
    const ids = Object.keys(json.images);
    for(const id of ids){ await Media.put(id, json.images[id]); }
  }
  saveNow();
  renderAll();
  observeReveals();
  if(activePanel) renderPanel();
  toast('✓ Perangkat ini sekarang memakai versi terpublikasi');
}

function importBackup(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if(!file) return;
    try{
      const text = await file.text();
      const json = JSON.parse(text);
      if(!json || !json.data) throw new Error('Struktur berkas tidak dikenali');

      const ok = await confirmAction({
        title: 'Import cadangan',
        text: 'Isi website sekarang akan diganti dengan isi berkas ini.',
        okLabel: 'Ganti sekarang'
      });
      if(!ok) return;

      DATA = deepMerge(clone(DEFAULTS), json.data);
      if(json.images){
        const ids = Object.keys(json.images);
        for(const id of ids){ await Media.put(id, json.images[id]); }
      }
      saveNow();
      renderAll();
      observeReveals();
      if(activePanel) renderPanel();
      toast('✓ Cadangan dipulihkan');
    }catch(err){
      toast('Berkas tidak bisa dibaca: ' + err.message, true);
    }
  });
  input.click();
}

/* =========================================================
   17. COMMAND CENTER (Ctrl + K)
========================================================= */
const COMMANDS = [
  { key: 'hero',     label: 'Sunting Hero',            run: () => { openPanel('content'); scrollToId('hero'); } },
  { key: 'hero',     label: 'Ganti nama & headline',   run: () => { openPanel('content'); focusBind('hero.name'); } },
  { key: 'hero',     label: 'Ganti teks tombol CTA',   run: () => { openPanel('content'); focusBind('hero.ctaPrimary'); } },
  { key: 'about',    label: 'Sunting About',           run: () => { openPanel('content'); scrollToId('about'); } },
  { key: 'about',    label: 'Tambah kartu About',      run: () => handleAction('about-add', document.body) },
  { key: 'skills',   label: 'Tambah keahlian',         run: () => handleAction('skill-add', document.body) },
  { key: 'journey',  label: 'Tambah checkpoint',       run: () => openJourneyForm(null) },
  { key: 'journey',  label: 'Kelola perjalanan',       run: () => openPanel('journey') },
  { key: 'projects', label: 'Tambah proyek',           run: () => openProjectForm(null) },
  { key: 'projects', label: 'Kelola proyek',           run: () => openPanel('projects') },
  { key: 'gallery',  label: 'Buka galeri',             run: () => scrollToId('gallery') },
  { key: 'pet',      label: 'Ganti pet',               run: () => openPanel('pet') },
  { key: 'pet',      label: 'Sunting dialog pet',      run: () => openPanel('pet') },
  { key: 'contact',  label: 'Sunting kontak & tautan', run: () => openPanel('content') },
  { key: 'design',   label: 'Warna aksen & animasi',   run: () => openPanel('design') },
  { key: 'design',   label: 'Loading screen ON / OFF', run: () => openPanel('design') },
  { key: 'music',    label: 'Musik latar & volume',    run: () => openPanel('design') },
  { key: 'music',    label: 'Putar / jeda musik',      run: () => Music.toggle() },
  { key: 'system',   label: 'Publikasikan (data.json)',run: () => handleAction('publish', document.body) },
  { key: 'system',   label: 'Tarik versi terpublikasi',run: () => pullPublished() },
  { key: 'system',   label: 'Export cadangan',         run: () => handleAction('export', document.body) },
  { key: 'system',   label: 'Import cadangan',         run: () => importBackup() },
  { key: 'view',     label: 'Preview sebagai visitor', run: () => setPreviewMode(true) },
  { key: 'view',     label: 'Keluar dari mode edit',   run: () => exitEditMode() }
];

let paletteIndex = 0;
let paletteMatches = [];

function togglePalette(show){
  const overlay = $('#paletteOverlay');
  if(!overlay) return;
  if(show){
    overlay.hidden = false;
    $('#paletteInput').value = '';
    filterPalette('');
    setTimeout(() => $('#paletteInput').focus(), 40);
  }else{
    overlay.hidden = true;
  }
}

function filterPalette(query){
  const q = query.trim().toLowerCase();
  paletteMatches = COMMANDS.filter(cmd =>
    !q || cmd.key.indexOf(q) > -1 || cmd.label.toLowerCase().indexOf(q) > -1
  );
  paletteIndex = 0;
  const list = $('#paletteList');
  if(!paletteMatches.length){
    list.innerHTML = '<li class="palette-empty">Tidak ada perintah yang cocok.</li>';
    return;
  }
  list.innerHTML = paletteMatches.map((cmd, i) => `
    <li><button class="palette-item ${i === 0 ? 'sel' : ''}" type="button" role="option" data-i="${i}">
      <span class="pk">${esc(cmd.key)}</span>${esc(cmd.label)}
    </button></li>
  `).join('');
}

function movePalette(delta){
  if(!paletteMatches.length) return;
  paletteIndex = (paletteIndex + delta + paletteMatches.length) % paletteMatches.length;
  $$('#paletteList .palette-item').forEach((btn, i) => btn.classList.toggle('sel', i === paletteIndex));
  const active = $$('#paletteList .palette-item')[paletteIndex];
  if(active) active.scrollIntoView({ block: 'nearest' });
}

function runPalette(index){
  const cmd = paletteMatches[index];
  togglePalette(false);
  if(cmd) cmd.run();
}

function scrollToId(id){
  const el = document.getElementById(id);
  if(el) el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
}

function focusBind(path){
  setTimeout(() => {
    const el = $('[data-bind="' + path + '"]');
    if(el){ el.focus(); el.select && el.select(); }
  }, 320);
}

function exitEditMode(){
  commitActiveEdit();
  saveNow();
  setEditMode(false);
  toast('Kembali ke tampilan pengunjung');
}

/* =========================================================
   18. PENGKABELAN
========================================================= */
function initDelegation(){
  document.addEventListener('click', e => {
    /* Editor teks inline menang dari aksi lain. */
    const editEl = e.target.closest('[data-edit]');
    if(editMode && !previewMode && editEl && editEl.getAttribute('contenteditable') !== 'true'){
      e.preventDefault();
      e.stopPropagation();
      startInlineEdit(editEl);
      return;
    }
    const actEl = e.target.closest('[data-act]');
    if(actEl){
      if(actEl.tagName === 'BUTTON' && actEl.type !== 'submit') e.preventDefault();
      handleAction(actEl.dataset.act, actEl, e);
    }
  });

  document.addEventListener('keydown', e => {
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.jp-card, [data-act="gal-open"]');
    if(!card) return;
    if(document.activeElement !== card) return;
    e.preventDefault();
    handleAction(card.dataset.act, card, e);
  });

  /* Isian di panel editor */
  const panel = $('#editorPanel');
  if(panel){
    panel.addEventListener('input', e => {
      const el = e.target;
      if(el.dataset.bind){
        let value = el.value;
        if(el.type === 'number' || el.type === 'range') value = parseInt(value, 10) || 0;
        setPath(DATA, el.dataset.bind, value);
        save();
        applyBindings();
        const render = el.dataset.render;
        if(render === 'hero'){ renderHeroName(); renderPortrait(); }
        if(render === 'contact') renderContact();
        if(render === 'pet') Pet.setPet(DATA.settings.pet);
        if(render === 'music'){
          Music.setVolume(value);
          const lbl = el.closest('.form-field').querySelector('label');
          if(lbl) lbl.textContent = 'Volume (' + value + '%)';
        }
      }else if(el.dataset.bindList){
        setPath(DATA, el.dataset.bindList, el.value.split(',').map(s => s.trim()).filter(Boolean));
        save();
        renderMarquee();
      }else if(el.dataset.bindLines){
        setPath(DATA, el.dataset.bindLines, el.value.split('\n').map(s => s.trim()).filter(Boolean));
        save();
      }
    });
  }
}

function initToolbar(){
  $$('.tb-btn[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      if(activePanel === btn.dataset.panel) closePanel();
      else openPanel(btn.dataset.panel);
    });
  });
  const preview = $('#tbPreview');
  if(preview) preview.addEventListener('click', () => { commitActiveEdit(); setPreviewMode(true); });
  const exitBtn = $('#tbExit');
  if(exitBtn) exitBtn.addEventListener('click', exitEditMode);
  const previewExit = $('#previewExit');
  if(previewExit) previewExit.addEventListener('click', () => setPreviewMode(false));
  const panelClose = $('#panelClose');
  if(panelClose) panelClose.addEventListener('click', closePanel);
}

function initForms(){
  const projectForm = $('#projectForm');
  if(projectForm) projectForm.addEventListener('submit', saveProjectForm);
  $('#closeProjectModal').addEventListener('click', () => closeModal($('#projectModal')));
  $('#cancelProjectBtn').addEventListener('click', () => closeModal($('#projectModal')));

  const journeyForm = $('#journeyForm');
  if(journeyForm) journeyForm.addEventListener('submit', saveJourneyForm);
  $('#closeJourneyModal').addEventListener('click', () => closeModal($('#journeyModal')));
  $('#cancelJourneyBtn').addEventListener('click', () => closeModal($('#journeyModal')));

  $('#openProjectModal').addEventListener('click', () => openProjectForm(null));
  $('#addJourneyBtn').addEventListener('click', () => openJourneyForm(null));
  $('#addSkillBtn').addEventListener('click', () => handleAction('skill-add', document.body));
  $('#manageLinksBtn').addEventListener('click', () => openPanel('content'));

  const explore = $('#exploreJourneyBtn');
  if(explore){
    explore.addEventListener('click', () => {
      const items = $$('#journeyList .jp');
      if(!items.length) return;
      const openIndex = items.findIndex(li => li.classList.contains('open'));
      const next = items[(openIndex + 1) % items.length];
      items.forEach(li => {
        li.classList.remove('open');
        const card = $('.jp-card', li);
        if(card) card.setAttribute('aria-expanded', 'false');
      });
      next.classList.add('open');
      const card = $('.jp-card', next);
      if(card) card.setAttribute('aria-expanded', 'true');
      next.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' });
    });
  }
}

function initUploads(){
  const portraitBtn = $('#portraitUploadBtn');
  const portraitInput = $('#portraitInput');
  if(portraitBtn && portraitInput){
    portraitBtn.addEventListener('click', () => portraitInput.click());
    portraitInput.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      try{
        const dataUrl = await compressImage(file, 900, 0.85);
        const id = uid();
        await Media.put(id, dataUrl);
        if(DATA.portraitId) Media.remove(DATA.portraitId);
        DATA.portraitId = id;
        saveNow();
        renderPortrait();
      }catch(err){ toast('Gambar gagal diproses: ' + err.message, true); }
      portraitInput.value = '';
    });
  }

  const projectImage = $('#projectImageInput');
  if(projectImage){
    projectImage.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      try{
        const dataUrl = await compressImage(file, 1400, 0.82);
        const id = uid();
        await Media.put(id, dataUrl);
        pendingProjectImage = id;
        const preview = $('#projectPreviewImg');
        preview.src = dataUrl;
        preview.hidden = false;
        $('#projectPreviewPh').hidden = true;
      }catch(err){ toast('Gambar gagal diproses: ' + err.message, true); }
      projectImage.value = '';
    });
  }

  const journeyImage = $('#journeyImageInput');
  if(journeyImage){
    journeyImage.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      try{
        const dataUrl = await compressImage(file, 600, 0.85);
        const id = uid();
        await Media.put(id, dataUrl);
        pendingJourneyImage = id;
        const preview = $('#journeyPreviewImg');
        preview.src = dataUrl;
        preview.hidden = false;
        $('#journeyPreviewPh').hidden = true;
      }catch(err){ toast('Gambar gagal diproses: ' + err.message, true); }
      journeyImage.value = '';
    });
  }

  const galleryInput = $('#galleryInput');
  if(galleryInput){
    galleryInput.addEventListener('change', async e => {
      const files = Array.from(e.target.files || []);
      if(!files.length) return;
      toast('Memproses ' + files.length + ' gambar…');
      for(const file of files){
        try{
          const dataUrl = await compressImage(file, 1400, 0.8);
          const id = uid();
          await Media.put(id, dataUrl);
          const caption = file.name.replace(/\.[^.]+$/, '').slice(0, 60);
          DATA.gallery.items.push({ id: uid(), catId: galleryCat, caption, alt: caption, imageId: id });
        }catch(err){ toast(file.name + ': ' + err.message, true); }
      }
      saveNow();
      renderGallery();
      galleryInput.value = '';
    });
  }
}

function initPalette(){
  const input = $('#paletteInput');
  const overlay = $('#paletteOverlay');
  if(!input || !overlay) return;
  input.addEventListener('input', () => filterPalette(input.value));
  input.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown'){ e.preventDefault(); movePalette(1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); movePalette(-1); }
    else if(e.key === 'Enter'){ e.preventDefault(); runPalette(paletteIndex); }
  });
  overlay.addEventListener('mousedown', e => { if(e.target === overlay) togglePalette(false); });
  $('#paletteList').addEventListener('click', e => {
    const btn = e.target.closest('.palette-item');
    if(btn) runPalette(Number(btn.dataset.i));
  });
}

function initLightbox(){
  const close = $('#lightboxClose');
  if(close) close.addEventListener('click', closeLightbox);
  const box = $('#lightbox');
  if(box) box.addEventListener('mousedown', e => { if(e.target === box) closeLightbox(); });
}

/* =========================================================
   19. BOOT
========================================================= */
async function boot(){
  await loadData();
  renderAll();

  initNav();
  initDelegation();
  initToolbar();
  initForms();
  initUploads();
  initPalette();
  initLightbox();
  initModalBehaviour();
  initSecretTriggers();
  initPasswordForm();
  initCursor();
  initMagnetic();
  initScrollEffects();
  initSectionSpy();
  buildBulbs();
  Pet.init();
  Music.init();

  if(sessionStorage.getItem(SESSION_KEY) === '1') setEditMode(true);

  observeReveals();
  await runCurtain();
  animateHeroTitle();
  observeReveals();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
}else{
  boot();
}

})();
