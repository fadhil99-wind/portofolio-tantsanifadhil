const ADMIN_PASSWORD = "USAHAdoa"; // ganti kalau mau
const LS_PROJECTS = "portfolio_projects";
const LS_THEME = "portfolio_theme";

const defaultProjects = [
  {
    title: "Public Speaking",
    category: "Pengalaman",
    desc: "Mengisi kegiatan edukasi dan berbicara di depan umum untuk remaja maupun masyarakat.",
    link: "#"
  },
  {
    title: "Konten Edukasi",
    category: "Karya",
    desc: "Membuat konten yang berisi edukasi, motivasi, dan pengembangan diri.",
    link: "#"
  },
  {
    title: "Kegiatan Organisasi",
    category: "Organisasi",
    desc: "Aktif dalam koordinasi, kepemimpinan, dan kerja sama tim di berbagai kegiatan.",
    link: "#"
  },
   {
    title: "Melatih Karate",
    category: "Coaching",
    desc: "Mengajar dan melatih dalam bela diri karate dengan keterampilan dasar bela diri dalam kegiatan latihan maupun pertandingan.",
    link: "#"
  }
  
];

const defaultTestimonials = [
  {
    title: "Apresiasi",
    text: "- Melatih dan sering menjadi Official di Dojo (tempat berlatih) 'SPARTAN' Tambakromo

- Pelatih dan Official Paskibra SMPN 1 Tambakromo 'PASTABARA'

- Mengikuti berbagai perlombaan karate dan mendapatkan juara di kategori kadet dan junior kumite

- Menjadi Komandan Peleton LKBB dan Pemimpin upacara di upacara pembukaan event basket Pemuda Cup Tahun 2024

- Menjabat sebagai Sie Bidang Keterampilan di Extrakurikuler DUTA SMAGA

- Mengikuti kepengurusan PIK-R Juwana 'GRESENA' tahun 2025

- Mengikuti lomba baca puisi FLS3N tingkat Kabupaten Tahun 2025

- Wakil Ketua OSIS saat SMP periode 2021/2022

- Menjadi narasumber dalam kegiatan edukasi remaja terkait perencanaan kehidupan berkeluarga, kesehatan reproduksi, dan pencegahan stunting"
  },
  {
    title: "Prestasi",
    text: ""
  }
];

const els = {
  themeToggle: document.getElementById("themeToggle"),
  adminToggle: document.getElementById("adminToggle"),
  addProjectBtn: document.getElementById("addProjectBtn"),
  projectGrid: document.getElementById("projectGrid"),
  testimonialGrid: document.getElementById("testimonialGrid"),
  detailModal: document.getElementById("detailModal"),
  formModal: document.getElementById("formModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalCategory: document.getElementById("modalCategory"),
  modalDesc: document.getElementById("modalDesc"),
  modalLink: document.getElementById("modalLink"),
  projectForm: document.getElementById("projectForm"),
  projectTitle: document.getElementById("projectTitle"),
  projectCategory: document.getElementById("projectCategory"),
  projectDesc: document.getElementById("projectDesc"),
  projectLink: document.getElementById("projectLink")
};

let adminMode = false;

function loadProjects() {
  const saved = localStorage.getItem(LS_PROJECTS);
  return saved ? JSON.parse(saved) : defaultProjects;
}

function saveProjects(projects) {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
}

function renderProjects() {
  const projects = loadProjects();
  els.projectGrid.innerHTML = projects
    .map(
      (p, i) => `
        <article class="project-card" data-index="${i}">
          <span class="tag">${escapeHtml(p.category)}</span>
          <h4>${escapeHtml(p.title)}</h4>
          <p>${escapeHtml(p.desc)}</p>
          <span class="project-link">Klik untuk detail →</span>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", () => {
      const index = Number(card.dataset.index);
      openDetail(loadProjects()[index]);
    });
  });
}

function renderTestimonials() {
  els.testimonialGrid.innerHTML = defaultTestimonials
    .map(
      (t) => `
        <div class="testimonial-card">
          <h4>${escapeHtml(t.title)}</h4>
          <p>${escapeHtml(t.text)}</p>
        </div>
      `
    )
    .join("");
}

function openDetail(project) {
  els.modalTitle.textContent = project.title;
  els.modalCategory.textContent = project.category;
  els.modalDesc.textContent = project.desc;

  if (project.link && project.link !== "#") {
    els.modalLink.href = project.link;
    els.modalLink.style.display = "inline-flex";
  } else {
    els.modalLink.href = "#";
    els.modalLink.style.display = "none";
  }

  els.detailModal.classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light");
  localStorage.setItem(LS_THEME, isLight ? "light" : "dark");
}

function loadTheme() {
  const theme = localStorage.getItem(LS_THEME);
  if (theme === "light") document.body.classList.add("light");
}

function toggleAdminMode() {
  if (!adminMode) {
    const input = prompt("Masukkan password admin:");
    if (input !== ADMIN_PASSWORD) {
      alert("Password salah.");
      return;
    }
    adminMode = true;
    els.adminToggle.textContent = "Admin Aktif";
    els.addProjectBtn.classList.remove("hidden");
    alert("Mode edit aktif.");
  } else {
    adminMode = false;
    els.adminToggle.textContent = "Mode Edit";
    els.addProjectBtn.classList.add("hidden");
    alert("Mode edit dimatikan.");
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.themeToggle.addEventListener("click", toggleTheme);
els.adminToggle.addEventListener("click", toggleAdminMode);
els.addProjectBtn.addEventListener("click", () => {
  if (!adminMode) return;
  els.formModal.classList.remove("hidden");
});

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});

els.detailModal.addEventListener("click", (e) => {
  if (e.target === els.detailModal) closeModal("detailModal");
});

els.formModal.addEventListener("click", (e) => {
  if (e.target === els.formModal) closeModal("formModal");
});

els.projectForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const newProject = {
    title: els.projectTitle.value.trim(),
    category: els.projectCategory.value.trim(),
    desc: els.projectDesc.value.trim(),
    link: els.projectLink.value.trim() || "#"
  };

  const projects = loadProjects();
  projects.unshift(newProject);
  saveProjects(projects);

  renderProjects();
  els.projectForm.reset();
  closeModal("formModal");
});

loadTheme();
renderProjects();
renderTestimonials();

const LS_CERTS = "portfolio_certs";
const certGrid = document.getElementById("certGrid");
const addCertBtn = document.getElementById("addCertBtn");
const certModal = document.getElementById("certModal");
const certForm = document.getElementById("certForm");

function loadCerts() {
  const data = localStorage.getItem(LS_CERTS);
  return data ? JSON.parse(data) : [];
}

function saveCerts(certs) {
  localStorage.setItem(LS_CERTS, JSON.stringify(certs));
}

function renderCerts() {
  const certs = loadCerts();
  certGrid.innerHTML = certs.map(cert => `
    <div class="project-card">
      <img src="${cert.image}" />
      <h4>${cert.title}</h4>
      <p>${cert.issuer}</p>
    </div>
  `).join("");
}

addCertBtn.addEventListener("click", () => {
  if (!adminMode) return;
  certModal.classList.remove("hidden");
});

