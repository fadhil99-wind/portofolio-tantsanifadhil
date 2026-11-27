/**
 * ============================================
 * MAIN.JS - Initialization & Utilities
 * ============================================
 */

// ===== LOADING SCREEN =====
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
        
        // Show music consent (selalu tampilkan di first visit)
setTimeout(() => {
    const consent = localStorage.getItem(STORAGE_KEYS.musicConsent);
    if (!consent) {
        // First visit - tampilkan consent
        document.getElementById('musicConsent').classList.add('active');
    } else if (consent === 'true') {
        // Sudah pernah izinkan - langsung play
        musicState.hasConsent = true;
        // Tunggu user interaction dulu
        const startOnInteraction = () => {
            startMusic();
            document.removeEventListener('click', startOnInteraction);
            document.removeEventListener('scroll', startOnInteraction);
            document.removeEventListener('touchstart', startOnInteraction);
        };
        document.addEventListener('click', startOnInteraction, { once: true });
        document.addEventListener('scroll', startOnInteraction, { once: true });
        document.addEventListener('touchstart', startOnInteraction, { once: true });
    }
}, 500);
    }, 1800);
});

// ===== NAVBAR =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (navbar) {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    }
});

function toggleNav() {
    document.getElementById('navLinks').classList.toggle('active');
}

function closeNav() {
    document.getElementById('navLinks').classList.remove('active');
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });
    
    fadeElements.forEach(el => observer.observe(el));
}

// ===== CURSOR GLOW EFFECT (Desktop only) =====
function initCursorGlow() {
    if (window.matchMedia('(pointer: fine)').matches) {
        const cursorGlow = document.createElement('div');
        cursorGlow.style.cssText = `
            position: fixed;
            width: 300px; height: 300px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(0,255,136,0.03) 0%, transparent 70%);
            pointer-events: none;
            z-index: 0;
            transform: translate(-50%, -50%);
            transition: all 0.1s ease;
        `;
        document.body.appendChild(cursorGlow);

        document.addEventListener('mousemove', (e) => {
            cursorGlow.style.left = e.clientX + 'px';
            cursorGlow.style.top = e.clientY + 'px';
        });
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // Apply saved data
    applyData();
    
    // Setup secret access methods
    setupLongPress();
    setupSecretWord();
    setupFooterTap();
    checkHash();
    window.addEventListener('hashchange', checkHash);
    
    // Init UI features
    initScrollAnimations();
    initCursorGlow();
    
    // Init music player
    initMusicPlayer();
    loadYouTubeAPI();
});