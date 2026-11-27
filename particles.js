/**
 * ============================================
 * PARTICLES.JS - Animasi Background Particles
 * ============================================
 */

const particlesCanvas = document.getElementById('particles-canvas');
const pCtx = particlesCanvas.getContext('2d');
let particles = [];

function resizeParticlesCanvas() {
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;
}

class Particle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * particlesCanvas.width;
        this.y = Math.random() * particlesCanvas.height;
        this.size = Math.random() * 1.5 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.5 + 0.1;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        // Wrap around
        if (this.x < 0) this.x = particlesCanvas.width;
        if (this.x > particlesCanvas.width) this.x = 0;
        if (this.y < 0) this.y = particlesCanvas.height;
        if (this.y > particlesCanvas.height) this.y = 0;
    }
    draw() {
        pCtx.beginPath();
        pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        pCtx.fillStyle = `rgba(0, 255, 136, ${this.opacity})`;
        pCtx.fill();
    }
}

function initParticles() {
    resizeParticlesCanvas();
    const count = window.innerWidth < 768 ? 40 : 80;
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
}

function animateParticles() {
    pCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    // Draw connections between nearby particles
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                const alpha = 0.05 * (1 - dist / 120);
                pCtx.beginPath();
                pCtx.moveTo(particles[i].x, particles[i].y);
                pCtx.lineTo(particles[j].x, particles[j].y);
                pCtx.strokeStyle = `rgba(0, 255, 136, ${alpha})`;
                pCtx.lineWidth = 0.5;
                pCtx.stroke();
            }
        }
    }
    
    requestAnimationFrame(animateParticles);
}

window.addEventListener('resize', () => {
    resizeParticlesCanvas();
});

// Initialize
initParticles();
animateParticles();