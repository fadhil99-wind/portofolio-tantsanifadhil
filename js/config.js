/**
 * ============================================
 * CONFIG.JS - Konfigurasi & Data Default
 * ============================================
 * File ini berisi semua data default dan kredensial.
 * Edit file ini untuk mengubah default content.
 */

// ===== KREDENSIAL ADMIN =====
// 
const CREDENTIALS = {
    user: 'fadhil',
    pass: 'tfr2026'
};

// ===== DATA DEFAULT =====
const DEFAULT_DATA = {
    name: 'Tantsani Fadhil Ramadhan',
    subtitle: 'Mahasiswa S1 Manajemen — UPN "Veteran" Yogyakarta',
    heroDesc: 'Menghubungkan dunia bisnis, kewirausahaan, dan teknologi untuk menciptakan solusi yang berdampak. Setiap langkah adalah tentang belajar, berkembang, dan berkarya.',
    aboutP1: 'Saya adalah mahasiswa S1 Manajemen di UPN "Veteran" Yogyakarta yang memiliki ketertarikan mendalam pada dunia bisnis, kewirausahaan, strategi, logistik, dan teknologi. Bagi saya, setiap tantangan adalah peluang untuk belajar dan bertumbuh.',
    aboutP2: 'Dengan semangat kewirausahaan dan rasa ingin tahu yang tinggi, saya aktif mengembangkan berbagai proyek yang menggabungkan pendekatan bisnis dengan inovasi teknologi. Saya percaya bahwa kolaborasi dan continuous learning adalah kunci untuk menciptakan dampak yang berarti.',
    aboutP3: 'Portofolio ini adalah rekam jejak perjalanan saya — dari proses belajar, pengembangan ide, hingga eksekusi nyata. Selamat menjelajah.',
    statProjects: '4+',
    statOrg: '3+',
    statSkills: '10+',
    email: 'hdil45366@gemail.com',
    linkedin: '',
    instagram: ''
};

// ===== PLAYLIST DEFAULT (YouTube) =====
// Ambil video ID dari URL YouTube atau YouTube Music
const DEFAULT_PLAYLIST = [
    {
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        title: 'Chill Electronic',
        artist: 'SoundHelix'
    },
    {
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        title: 'Ambient Beat',
        artist: 'SoundHelix'
    },
    {
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        title: 'Deep House',
        artist: 'SoundHelix'
    },
    {
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
        title: 'Relaxing Vibes',
        artist: 'SoundHelix'
    }
];

// ===== STORAGE KEYS =====
const STORAGE_KEYS = {
    portfolioData: 'portfolioData',
    profilePhoto: 'profilePhoto',
    playlist: 'musicPlaylist',
    musicConsent: 'musicConsent',
    musicAutoplay: 'musicAutoplay',
    volume: 'musicVolume'
};
