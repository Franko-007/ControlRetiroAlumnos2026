const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxopNnF78VHD9CXlsc5UKRhxmSirHDkENbCbj38oFNcH2KzBj4Kv9nBSqwtTPiHmBiv/exec";

// 1. MEMORIA COMPARTIDA
let students = JSON.parse(localStorage.getItem('retiros_f_activos')) || [];
let history = JSON.parse(localStorage.getItem('retiros_f_historial')) || [];

function playSound(id) {
    const audio = document.getElementById(id);
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

// 2. SINCRONIZACIÓN TOTAL (Para ver cambios de otros equipos)
async function loadFromCloud() {
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${new Date().getTime()}`);
        const data = await res.json();
        
        // REGLA DE ORO: Solo reemplazamos si la nube trae un arreglo con datos.
        // Esto permite que si alguien agrega un alumno en el Equipo A, aparezca en el Equipo B.
        if (Array.isArray(data) && data.length > 0) {
            const nuevosActivos = data.filter(s => !s.exitTime || s.exitTime.trim() === "");
            const nuevoHistorial = data.filter(s => s.exitTime && s.exitTime.trim() !== "");

            // Solo renderizamos si los datos de la nube son distintos a los que tenemos
            if (JSON.stringify(nuevosActivos) !== JSON.stringify(students)) {
                students = nuevosActivos;
                history = nuevoHistorial;
                saveLocal();
                render();
            }
        }
    } catch (e) { 
        console.log("Error de red: Manteniendo vista actual."); 
    }
}

function saveLocal() {
    localStorage.setItem('retiros_f_activos', JSON.stringify(students));
    localStorage.setItem('retiros_f_historial', JSON.stringify(history));
}

function render() {
    const list = document.getElementById("studentList");
    const hist = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
    [cite_start]// Contadores basados en variables CSS [cite: 1, 2]
    const counts = { ESPERA: 0, BUSCA: 0, AVISADO: 0 };
    students.forEach(s => { if(counts[s.stateKey] !== undefined) counts[s.stateKey]++; });
    document.getElementById("countEspera").textContent = counts.ESPERA;
    document.getElementById("countBusca").textContent = counts.BUSCA;
    document.getElementById("countAvisado").textContent = counts.AVISADO;

    list.innerHTML = "";
    students.forEach(s => {
        const node = temp.content.cloneNode(true);
        const badge = node.querySelector(".state-badge");
        badge.textContent = s.stateKey;
        [cite_start]badge.className = `state-badge state-${s.stateKey}`; // Clases CSS [cite: 15, 16]

        node.querySelector(".student-name").textContent = s.name;
        node.querySelector(".student-course").textContent = s.course;
        
        const doneBtn = node.querySelector(".done-btn");
        if(s.stateKey === "AVISADO") {
            doneBtn.style.display = "block";
            doneBtn.onclick = async () => {
                s.exitTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                await saveToCloud(s); // Enviamos el fin a la nube primero
                loadFromCloud(); // Refrescamos para que todos vean que se fue
            };
        }

        badge.onclick = async () => {
            const keys = ["ESPERA", "BUSCA", "AVISADO"];
            s.stateKey = keys[(keys.indexOf(s.stateKey) + 1) % keys.length];
            playSound('sound-status');
            render(); 
            await saveToCloud(s); // Sincroniza el cambio de color
        };

        node.querySelector(".del-btn").onclick = () => {
            if(confirm("¿Eliminar?")) {
                students = students.filter(x => x.id !== s.id);
                saveLocal();
                render();
                // Aquí podrías agregar una función para borrar también en el Sheets si lo necesitas
            }
        };
        list.appendChild(node);
    });

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

async function saveToCloud(s) {
    const p = new URLSearchParams();
    for (const key in s) p.append(key, s[key]);
    [cite_start]// El modo no-cors es esencial para GitHub Pages [cite: 10]
    return fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p });
}

document.getElementById("addForm").onsubmit = async (e) => {
    e.preventDefault();
    const s = {
        id: "ID-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        name: document.getElementById("nameInput").value,
        course: document.getElementById("courseInput").value,
        stateKey: "ESPERA",
        timestamp: Date.now().toString(),
        exitTime: ""
    };
    
    // 1. Guardar local para respuesta instantánea
    students.push(s);
    playSound('sound-add');
    render();
    
    // 2. Enviar a la nube
    await saveToCloud(s);
    
    // 3. Limpiar y forzar recarga para asegurar sincronía
    e.target.reset();
    setTimeout(loadFromCloud, 2000); 
};

// INICIALIZACIÓN
render();
loadFromCloud();
// Intervalo de 10 segundos para que la portería y sala vean los cambios rápido
setInterval(loadFromCloud, 10000);
