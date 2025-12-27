const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxopNnF78VHD9CXlsc5UKRhxmSirHDkENbCbj38oFNcH2KzBj4Kv9nBSqwtTPiHmBiv/exec";

// Variables de estado sincronizado
let students = [];
let history = [];

// Sonidos
function playSound(id) {
    const audio = document.getElementById(id);
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

/**
 * ACCIÓN DEFINITIVA: Sincronización Multiequipo
 * Esta función limpia la vista y dibuja lo que la nube diga, 
 * asegurando que todos los dispositivos vean lo mismo.
 */
async function syncWithCloud() {
    try {
        // El parámetro '_cacheKiller' obliga a la red a no usar datos viejos
        const res = await fetch(`${SCRIPT_URL}?_cacheKiller=${Date.now()}`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
            const nuevosActivos = data.filter(s => !s.exitTime || s.exitTime.trim() === "");
            const nuevoHistorial = data.filter(s => s.exitTime && s.exitTime.trim() !== "");

            // Solo refresca la pantalla si hay cambios reales en los datos
            if (JSON.stringify(nuevosActivos) !== JSON.stringify(students) || 
                JSON.stringify(nuevoHistorial) !== JSON.stringify(history)) {
                
                students = nuevosActivos;
                history = nuevoHistorial;
                renderUI();
            }
        }
    } catch (e) { 
        console.error("Error de sincronización de red."); 
    }
}

/**
 * RENDERIZADO DE INTERFAZ
 */
function renderUI() {
    const list = document.getElementById("studentList");
    const hist = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
    // Actualización de contadores superiores
    const counts = { ESPERA: 0, BUSCA: 0, AVISADO: 0 };
    students.forEach(s => { if(counts[s.stateKey] !== undefined) counts[s.stateKey]++; });
    document.getElementById("countEspera").textContent = counts.ESPERA;
    document.getElementById("countBusca").textContent = counts.BUSCA;
    document.getElementById("countAvisado").textContent = counts.AVISADO;

    // Dibujar lista de alumnos activos
    list.innerHTML = "";
    students.forEach(s => {
        const node = temp.content.cloneNode(true);
        const badge = node.querySelector(".state-badge");
        badge.textContent = s.stateKey;
        badge.className = `state-badge state-${s.stateKey}`;

        node.querySelector(".student-name").textContent = s.name;
        node.querySelector(".student-course").textContent = s.course;
        
        const doneBtn = node.querySelector(".done-btn");
        if(s.stateKey === "AVISADO") {
            doneBtn.style.display = "block";
            doneBtn.onclick = async () => {
                s.exitTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                await sendToCloud(s);
                syncWithCloud(); // Sincroniza a todos inmediatamente
            };
        }

        // Cambio de estado circular: Espera -> Busca -> Avisado
        badge.onclick = async () => {
            const keys = ["ESPERA", "BUSCA", "AVISADO"];
            s.stateKey = keys[(keys.indexOf(s.stateKey) + 1) % keys.length];
            playSound('sound-status');
            await sendToCloud(s);
            syncWithCloud();
        };

        list.appendChild(node);
    });

    // Dibujar historial (Últimos 5 entregados)
    hist.innerHTML = "";
    history.slice(-5).reverse().forEach(s => {
        const node = temp.content.cloneNode(true);
        node.querySelector(".student-item").style.opacity = "0.4";
        node.querySelector(".state-badge").textContent = "FIN";
        node.querySelector(".student-name").textContent = s.name;
        node.querySelector(".student-course").textContent = s.course;
        node.querySelector(".student-actions").innerHTML = `<small style="color:var(--muted)">${s.exitTime}</small>`;
        hist.appendChild(node);
    });

    document.getElementById("emptyState").style.display = students.length ? "none" : "block";
}

/**
 * ENVÍO A GOOGLE SHEETS
 */
async function sendToCloud(studentObj) {
    const params = new URLSearchParams();
    for (const key in studentObj) params.append(key, studentObj[key]);
    
    // El modo 'no-cors' es vital para estabilidad en GitHub Pages
    return fetch(SCRIPT_URL, { 
        method: 'POST', 
        mode: 'no-cors', 
        body: params 
    });
}

/**
 * EVENTO: Agregar Alumno
 */
document.getElementById("addForm").onsubmit = async (e) => {
    e.preventDefault();
    const newStudent = {
        id: "ID-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        name: document.getElementById("nameInput").value,
        course: document.getElementById("courseInput").value,
        stateKey: "ESPERA",
        timestamp: Date.now().toString(),
        exitTime: ""
    };
    
    playSound('sound-add');
    await sendToCloud(newStudent);
    e.target.reset();
    
    // Pequeña pausa para que Google Sheets procese y luego sincroniza todos los equipos
    setTimeout(syncWithCloud, 1000);
};

// --- INICIO DE LA APLICACIÓN ---
syncWithCloud(); // Primera carga al abrir
setInterval(syncWithCloud, 5000); // Sincronización automática cada 5 segundos
