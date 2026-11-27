/**
 * ============================================
 * ADMIN.JS - Panel Admin & Editing
 * ============================================
 * Akses rahasia:
 * 1. Long-press logo "TFR" (1.5 detik) - Mobile
 * 2. Ctrl + Shift + A - Desktop
 * 3. Ketik "admin" tanpa klik input
 * 4. URL hash #admin
 * 5. Tap footer 5x cepat
 */

// ===== SECRET ACCESS METHODS =====

// Method 1: Ctrl + Shift + A
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        showLoginModal();
    }
});

// Method 2: Long press on logo (mobile-friendly)
function setupLongPress() {
    const navLogo = document.getElementById('navLogo');
    if (!navLogo) return;
    
    let pressTimer = null;
    let isLongPress = false;

    function startPress(e) {
        isLongPress = false;
        navLogo.classList.add('pressing');
        pressTimer = setTimeout(() => {
            isLongPress = true;
            navLogo.classList.remove('pressing');
            showLoginModal();
            if (navigator.vibrate) navigator.vibrate(50);
        }, 1500);
    }

    function endPress(e) {
        clearTimeout(pressTimer);
        navLogo.classList.remove('pressing');
        if (!isLongPress && e.type === 'click') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function cancelPress() {
        clearTimeout(pressTimer);
        navLogo.classList.remove('pressing');
    }

    navLogo.addEventListener('mousedown', startPress);
    navLogo.addEventListener('mouseup', endPress);
    navLogo.addEventListener('mouseleave', cancelPress);
    navLogo.addEventListener('touchstart', startPress, { passive: true });
    navLogo.addEventListener('touchend', endPress);
    navLogo.addEventListener('touchmove', cancelPress);
}

// Method 3: Ketik "admin"
function setupSecretWord() {
    let secretBuffer = '';
    document.addEventListener('keypress', (e) => {
        const active = document.activeElement.tagName;
        if (active !== 'INPUT' && active !== 'TEXTAREA') {
            secretBuffer += e.key.toLowerCase();
            if (secretBuffer.length > 10) secretBuffer = secretBuffer.slice(-10);
            if (secretBuffer.includes('admin')) {
                secretBuffer = '';
                showLoginModal();
            }
        }
    });
}

// Method 4: URL hash #admin
function checkHash() {
    if (window.location.hash === '#admin') {
        showLoginModal();
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }
}

// Method 5: Footer 5x tap
function setupFooterTap() {
    const footer = document.querySelector('.footer');
    if (!footer) return;
    
    let footerClicks = 0;
    let footerTimer = null;
    
    footer.addEventListener('click', () => {
        footerClicks++;
        if (footerTimer) clearTimeout(footerTimer);
        footerTimer = setTimeout(() => { footerClicks = 0; }, 1500);
        if (footerClicks >= 5) {
            footerClicks = 0;
            showLoginModal();
        }
    });
}

// ===== LOGIN MODAL =====
function showLoginModal() {
    document.getElementById('loginModal').classList.add('active');
    setTimeout(() => document.getElementById('loginUser').focus(), 100);
}

function closeLogin() {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginError').style.display = 'none';
}

function attemptLogin() {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    
    if (user === CREDENTIALS.user && pass === CREDENTIALS.pass) {
        closeLogin();
        openAdmin();
    } else {
        document.getElementById('loginError').style.display = 'block';
        setTimeout(() => {
            document.getElementById('loginError').style.display = 'none';
        }, 3000);
    }
}

// Enter key handlers
document.addEventListener('DOMContentLoaded', () => {
    const loginPass = document.getElementById('loginPass');
    const loginUser = document.getElementById('loginUser');
    
    if (loginPass) {
        loginPass.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') attemptLogin();
        });
    }
    if (loginUser) {
        loginUser.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginPass.focus();
        });
    }
});

// ===== ADMIN PANEL =====
function openAdmin() {
    loadCurrentData();
    renderMusicAdminList();
    document.getElementById('adminOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAdmin() {
    document.getElementById('adminOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function loadCurrentData() {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.portfolioData) || '{}');
    
    document.getElementById('editName').value = data.name || DEFAULT_DATA.name;
    document.getElementById('editSubtitle').value = data.subtitle || DEFAULT_DATA.subtitle;
    document.getElementById('editHeroDesc').value = data.heroDesc || DEFAULT_DATA.heroDesc;
    document.getElementById('editAboutP1').value = data.aboutP1 || DEFAULT_DATA.aboutP1;
    document.getElementById('editAboutP2').value = data.aboutP2 || DEFAULT_DATA.aboutP2;
    document.getElementById('editAboutP3').value = data.aboutP3 || DEFAULT_DATA.aboutP3;
    document.getElementById('editStatProjects').value = data.statProjects || DEFAULT_DATA.statProjects;
    document.getElementById('editStatOrg').value = data.statOrg || DEFAULT_DATA.statOrg;
    document.getElementById('editStatSkills').value = data.statSkills || DEFAULT_DATA.statSkills;
    document.getElementById('editEmail').value = data.email || DEFAULT_DATA.email;
    document.getElementById('editLinkedin').value = data.linkedin || '';
    document.getElementById('editInstagram').value = data.instagram || '';

    // Load photo preview
    const photoData = localStorage.getItem(STORAGE_KEYS.profilePhoto);
    if (photoData) {
        document.getElementById('adminPhotoPreview').innerHTML = `<img src="${photoData}" alt="Profile">`;
    }
}

// ===== PHOTO UPLOAD =====
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('⚠️ File terlalu besar! Maksimal 5MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const photoData = e.target.result;
        localStorage.setItem(STORAGE_KEYS.profilePhoto, photoData);
        document.getElementById('adminPhotoPreview').innerHTML = `<img src="${photoData}" alt="Profile">`;
        showToast('✓ Foto berhasil diupload!');
    };
    reader.readAsDataURL(file);
}

// ===== MUSIC ADMIN =====
function renderMusicAdminList() {
    const container = document.getElementById('musicAdminList');
    if (!container) return;
    
    container.innerHTML = '';
    
    musicState.playlist.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'music-admin-item';
        item.innerHTML = `
            <span class="music-admin-item-num">${String(index + 1).padStart(2, '0')}</span>
            <div class="music-admin-item-info">
                <div class="music-admin-item-title">${track.title}</div>
                <div class="music-admin-item-url">${track.url}</div>
            </div>
            <div class="music-admin-item-actions">
                <button class="music-admin-item-btn delete" onclick="deleteTrack(${index})" title="Hapus">✕</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|music\.youtube\.com\/watch\?v=)([^&\?\s]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function addNewTrack() {
    const title = document.getElementById('newTrackTitle').value.trim();
    const artist = document.getElementById('newTrackArtist').value.trim();
    const url = document.getElementById('newTrackUrl').value.trim();
    
    if (!title || !url) {
        showToast('⚠️ Judul dan URL wajib diisi!');
        return;
    }
    
    const videoId = extractYouTubeId(url);
    if (!videoId) {
        showToast('⚠️ URL YouTube tidak valid!');
        return;
    }
    
    const newTrack = {
        id: videoId,
        title: title,
        artist: artist || 'Unknown',
        url: url
    };
    
    musicState.playlist.push(newTrack);
    savePlaylist();
    renderMusicAdminList();
    renderPlaylist();
    
    // Clear form
    document.getElementById('newTrackTitle').value = '';
    document.getElementById('newTrackArtist').value = '';
    document.getElementById('newTrackUrl').value = '';
    
    showToast('✓ Lagu ditambahkan ke playlist!');
}

function deleteTrack(index) {
    if (musicState.playlist.length <= 1) {
        showToast('⚠️ Minimal harus ada 1 lagu!');
        return;
    }
    
    if (confirm('Hapus lagu ini dari playlist?')) {
        musicState.playlist.splice(index, 1);
        
        // Adjust current index
        if (musicState.currentIndex >= musicState.playlist.length) {
            musicState.currentIndex = 0;
        }
        
        savePlaylist();
        renderMusicAdminList();
        renderPlaylist();
        
        // Reload current track if needed
        if (ytPlayer && ytPlayer.loadVideoById) {
            const current = musicState.playlist[musicState.currentIndex];
            ytPlayer.loadVideoById(current.id);
            updateNowPlaying();
        }
        
        showToast('✓ Lagu dihapus!');
    }
}

function savePlaylist() {
    localStorage.setItem(STORAGE_KEYS.playlist, JSON.stringify(musicState.playlist));
}

function loadDefaultPlaylist() {
    if (confirm('Reset playlist ke default?')) {
        musicState.playlist = [...DEFAULT_PLAYLIST];
        musicState.currentIndex = 0;
        savePlaylist();
        renderMusicAdminList();
        renderPlaylist();
        
        if (ytPlayer && ytPlayer.loadVideoById) {
            ytPlayer.loadVideoById(DEFAULT_PLAYLIST[0].id);
            updateNowPlaying();
        }
        
        showToast('✓ Playlist direset ke default!');
    }
}

// ===== SAVE & RESET =====
function saveAllChanges() {
    const data = {
        name: document.getElementById('editName').value,
        subtitle: document.getElementById('editSubtitle').value,
        heroDesc: document.getElementById('editHeroDesc').value,
        aboutP1: document.getElementById('editAboutP1').value,
        aboutP2: document.getElementById('editAboutP2').value,
        aboutP3: document.getElementById('editAboutP3').value,
        statProjects: document.getElementById('editStatProjects').value,
        statOrg: document.getElementById('editStatOrg').value,
        statSkills: document.getElementById('editStatSkills').value,
        email: document.getElementById('editEmail').value,
        linkedin: document.getElementById('editLinkedin').value,
        instagram: document.getElementById('editInstagram').value
    };

    localStorage.setItem(STORAGE_KEYS.portfolioData, JSON.stringify(data));
    applyData();
    showToast('✓ Semua perubahan berhasil disimpan!');
}

function applyData() {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.portfolioData) || '{}');

    if (data.name) {
        document.getElementById('aboutTitle').textContent = data.name;
        const initials = data.name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase();
        document.getElementById('heroInitials').textContent = initials;
    }
    if (data.subtitle) document.getElementById('heroSubtitle').textContent = data.subtitle;
    if (data.heroDesc) document.getElementById('heroDesc').textContent = data.heroDesc;
    if (data.aboutP1) document.getElementById('aboutP1').textContent = data.aboutP1;
    if (data.aboutP2) document.getElementById('aboutP2').textContent = data.aboutP2;
    if (data.aboutP3) document.getElementById('aboutP3').textContent = data.aboutP3;
    if (data.statProjects) document.getElementById('statProjects').textContent = data.statProjects;
    if (data.statOrg) document.getElementById('statOrg').textContent = data.statOrg;
    if (data.statSkills) document.getElementById('statSkills').textContent = data.statSkills;

    // Apply photo
    const photoData = localStorage.getItem(STORAGE_KEYS.profilePhoto);
    if (photoData) {
        // Hero photo
        document.getElementById('heroInitials').style.display = 'none';
        let heroImg = document.getElementById('heroImg');
        if (!heroImg) {
            heroImg = document.createElement('img');
            heroImg.id = 'heroImg';
            document.getElementById('heroProfileImg').appendChild(heroImg);
        }
        heroImg.src = photoData;

        // About photo
        const aboutPhoto = document.getElementById('aboutPhoto');
        aboutPhoto.src = photoData;
        aboutPhoto.style.display = 'block';
        document.getElementById('aboutPhotoPlaceholder').style.display = 'none';
    }

    // Apply contact links
    if (data.email) {
        const emailLink = document.getElementById('contactEmail');
        if (emailLink) emailLink.href = `mailto:${data.email}`;
    }
    if (data.linkedin) {
        const linkedinLink = document.getElementById('contactLinkedin');
        if (linkedinLink) linkedinLink.href = data.linkedin;
    }
    if (data.instagram) {
        const instaLink = document.getElementById('contactInstagram');
        if (instaLink) instaLink.href = data.instagram;
    }
}

function resetAll() {
    if (confirm('Yakin ingin reset semua data ke default?')) {
        localStorage.removeItem(STORAGE_KEYS.portfolioData);
        localStorage.removeItem(STORAGE_KEYS.profilePhoto);
        location.reload();
    }
}

// ===== TOAST =====
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
