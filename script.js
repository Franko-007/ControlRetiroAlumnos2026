// Estados y colores
const STATES = [
  { key: "ESPERA", label: "EN ESPERA", className: "state-ESPERA" },   // Rojo
  { key: "BUSCA", label: "EN BUSCA", className: "state-BUSCA" },       // Amarillo
  { key: "AVISADO", label: "AVISADO", className: "state-AVISADO" }     // Verde
];

// LocalStorage helpers
const STORAGE_KEY = "retiroEscolar:v1:students";

function loadStudents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Error leyendo storage", e);
    return [];
  }
}

function saveStudents(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Estado
let students = loadStudents(); // [{id, name, course, stateKey}]

const els = {
  addForm: document.getElementById("addForm"),
  nameInput: document.getElementById("nameInput"),
  courseInput: document.getElementById("courseInput"),
  searchInput: document.getElementById("searchInput"),
  courseFilter: document.getElementById("courseFilter"),
  statusFilter: document.getElementById("statusFilter"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  studentList: document.getElementById("studentList"),
  emptyState: document.getElementById("emptyState"),
  template: document.getElementById("studentItemTemplate")
};

// Inicializar filtro de cursos
function refreshCourseFilter() {
  const distinct = Array.from(new Set(students.map(s => s.course))).filter(Boolean).sort();
  const current = els.courseFilter.value;
  els.courseFilter.innerHTML = '<option value="">Todos los cursos</option>' +
    distinct.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if (distinct.includes(current)) {
    els.courseFilter.value = current;
  }
}

// Render
function render() {
  const query = els.searchInput.value.trim().toLowerCase();
  const courseSel = els.courseFilter.value;
  const statusSel = els.statusFilter.value;

  const filtered = students.filter(s => {
    const textMatch = s.name.toLowerCase().includes(query) || s.course.toLowerCase().includes(query);
    const courseMatch = !courseSel || s.course === courseSel;
    const statusMatch = !statusSel || s.stateKey === statusSel;
    return textMatch && courseMatch && statusMatch;
  });

  els.studentList.innerHTML = "";
  els.emptyState.style.display = filtered.length ? "none" : "block";

  filtered.forEach(s => {
    const node = els.template.content.cloneNode(true);
    const li = node.querySelector(".student-item");
    const badge = node.querySelector(".state-badge");
    const nameEl = node.querySelector(".student-name");
    const courseEl = node.querySelector(".student-course");
    const delBtn = node.querySelector(".delete-btn");
    const upBtn = node.querySelector(".up-btn");
    const downBtn = node.querySelector(".down-btn");

    // Datos
    nameEl.textContent = s.name;
    courseEl.textContent = s.course;
    setBadgeState(badge, s.stateKey);

    // Eventos
    badge.addEventListener("click", () => {
      cycleState(s);
      saveStudents(students);
      render();
    });

    delBtn.addEventListener("click", () => {
      students = students.filter(x => x.id !== s.id);
      saveStudents(students);
      refreshCourseFilter();
      render();
    });

    upBtn.addEventListener("click", () => {
      moveStudent(s.id, -1);
    });

    downBtn.addEventListener("click", () => {
      moveStudent(s.id, +1);
    });

    els.studentList.appendChild(node);
  });
}

function setBadgeState(badge, stateKey) {
  const st = STATES.find(x => x.key === stateKey) || STATES[0];
  badge.textContent = st.label;
  badge.className = `state-badge ${st.className}`;
}

function cycleState(student) {
  const idx = STATES.findIndex(s => s.key === student.stateKey);
  const next = STATES[(idx + 1) % STATES.length];
  student.stateKey = next.key;
}

function moveStudent(id, delta) {
  const idx = students.findIndex(s => s.id === id);
  if (idx < 0) return;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= students.length) return;
  const [item] = students.splice(idx, 1);
  students.splice(newIdx, 0, item);
  saveStudents(students);
  render();
}

// Formulario
els.addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = els.nameInput.value.trim();
  const course = els.courseInput.value.trim();
  if (!name || !course) return;

  const student = {
    id: cryptoRandomId(),
    name,
    course,
    stateKey: "ESPERA"
  };
  students.push(student);
  saveStudents(students);
  els.nameInput.value = "";
  els.courseInput.value = "";
  refreshCourseFilter();
  render();
});

// Filtros
["input", "change"].forEach(evt => {
  els.searchInput.addEventListener(evt, render);
  els.courseFilter.addEventListener(evt, render);
  els.statusFilter.addEventListener(evt, render);
});

els.clearAllBtn.addEventListener("click", () => {
  if (confirm("¿Vaciar toda la lista? Esta acción no se puede deshacer.")) {
    students = [];
    saveStudents(students);
    refreshCourseFilter();
    render();
  }
});

// Utilidades
function cryptoRandomId() {
  // ID corto y único
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
}

// Inicio
refreshCourseFilter();
render();
