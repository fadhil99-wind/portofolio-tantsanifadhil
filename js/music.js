/**
 * MUSIC.JS - Versi Super Simpel (HTML5 Audio)
 */

let musicState = {
    playlist: [],
    currentIndex: 0,
    isPlaying: false,
    volume: 30,
    isMuted: false
};

let audio = null;

function initMusicPlayer() {
    const saved = localStorage.getItem(STORAGE_KEYS.playlist);
    if (saved) {
        try {
            const p = JSON.parse(saved);
            musicState.playlist = (p && p.length > 0) ? p : [...DEFAULT_PLAYLIST];
        } catch (e) {
            musicState.playlist = [...DEFAULT_PLAYLIST];
        }
    } else {
        musicState.playlist = [...DEFAULT_PLAYLIST];
    }

    const sv = localStorage.getItem(STORAGE_KEYS.volume);
    if (sv !== null) musicState.volume = parseInt(sv);

    audio = new Audio();
    audio.volume = musicState.volume / 100;
    audio.addEventListener('ended', nextTrack);
    audio.addEventListener('error', () => {
        console.log('Audio error, skip...');
        nextTrack();
    });

    updateVolumeIcon();
    renderPlaylist();
    updateNowPlaying();
}

function togglePlay() {
    if (!audio) return;
    if (musicState.isPlaying) {
        audio.pause();
        musicState.isPlaying = false;
    } else {
        audio.play().catch(e => showToast('🔇 Klik lagi untuk play'));
        musicState.isPlaying = true;
    }
    updatePlayButton();
    updatePlayingUI();
}

function nextTrack() {
    if (musicState.playlist.length === 0) return;
    musicState.currentIndex = (musicState.currentIndex + 1) % musicState.playlist.length;
    loadTrack();
}

function prevTrack() {
    if (musicState.playlist.length === 0) return;
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
    musicState.currentIndex = (musicState.currentIndex - 1 + musicState.playlist.length) % musicState.playlist.length;
    loadTrack();
}

function playTrackByIndex(i) {
    if (i < 0 || i >= musicState.playlist.length) return;
    musicState.currentIndex = i;
    musicState.isPlaying = true;
    loadTrack();
    updatePlayButton();
    updatePlayingUI();
}

function loadTrack() {
    if (!audio) return;
    const track = musicState.playlist[musicState.currentIndex];
    if (!track) return;
    audio.src = track.src;
    audio.load();
    if (musicState.isPlaying) {
        audio.play().catch(() => {
            musicState.isPlaying = false;
            updatePlayButton();
        });
    }
    updateNowPlaying();
    renderPlaylist();
}

function changeVolume(v) {
    musicState.volume = parseInt(v);
    localStorage.setItem(STORAGE_KEYS.volume, v);
    if (audio) audio.volume = musicState.volume / 100;
    musicState.isMuted = musicState.volume === 0;
    updateVolumeIcon();
}

function toggleMute() {
    if (!audio) return;
    musicState.isMuted = !musicState.isMuted;
    if (musicState.isMuted) {
        audio.volume = 0;
        document.getElementById('volumeSlider').value = 0;
    } else {
        audio.volume = musicState.volume / 100;
        document.getElementById('volumeSlider').value = musicState.volume;
    }
    updateVolumeIcon();
}

function toggleShuffle() {
    showToast('🔀 Shuffle: coming soon!');
}

function updatePlayButton() {
    const btn = document.getElementById('playBtn');
    if (btn) btn.textContent = musicState.isPlaying ? '⏸' : '▶';
}

function updatePlayingUI() {
    const p = document.getElementById('musicPlayer');
    const t = document.getElementById('musicToggle');
    if (p) p.classList.toggle('playing', musicState.isPlaying);
    if (t) t.classList.toggle('playing', musicState.isPlaying);
}

function updateVolumeIcon() {
    const icon = document.querySelector('.music-volume-icon');
    if (!icon) return;
    if (musicState.isMuted || musicState.volume === 0) icon.textContent = '🔇';
    else if (musicState.volume < 50) icon.textContent = '🔉';
    else icon.textContent = '🔊';
}

function updateNowPlaying() {
    const track = musicState.playlist[musicState.currentIndex];
    if (!track) return;
    const t = document.getElementById('npTitle');
    const a = document.getElementById('npArtist');
    if (t) t.textContent = track.title;
    if (a) a.textContent = track.artist;
}

setInterval(() => {
    if (!audio || !audio.duration) return;
    const fill = document.getElementById('musicProgressFill');
    if (fill) fill.style.width = (audio.currentTime / audio.duration) * 100 + '%';
}, 500);

document.addEventListener('DOMContentLoaded', () => {
    const pb = document.getElementById('musicProgress');
    if (pb) {
        pb.addEventListener('click', (e) => {
            if (!audio || !audio.duration) return;
            const r = pb.getBoundingClientRect();
            audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
        });
    }
});

function renderPlaylist() {
    const c = document.getElementById('musicPlaylist');
    if (!c) return;
    c.innerHTML = '<div class="playlist-title">📋 Playlist</div>';
    musicState.playlist.forEach((t, i) => {
        const d = document.createElement('div');
        d.className = 'playlist-item' + (i === musicState.currentIndex ? ' active' : '');
        d.innerHTML = `<span class="playlist-item-num">${String(i+1).padStart(2,'0')}</span><span class="playlist-item-title">${t.title}</span>`;
        d.addEventListener('click', () => playTrackByIndex(i));
        c.appendChild(d);
    });
}

function toggleMusicExpand() {
    const e = document.getElementById('musicExpanded');
    if (e) e.classList.toggle('active');
}

function acceptMusic() {
    localStorage.setItem(STORAGE_KEYS.musicConsent, 'true');
    localStorage.setItem(STORAGE_KEYS.musicAutoplay, 'true');
    document.getElementById('musicConsent').classList.remove('active');
    startMusic();
}

function declineMusic() {
    localStorage.setItem(STORAGE_KEYS.musicConsent, 'false');
    localStorage.setItem(STORAGE_KEYS.musicAutoplay, 'false');
    document.getElementById('musicConsent').classList.remove('active');
}

function startMusic() {
    if (!audio) return;
    musicState.isPlaying = true;
    updatePlayButton();
    updatePlayingUI();
    audio.play().catch(() => showToast('🔇 Klik tombol play untuk mulai'));
}
