const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxopNnF78VHD9CXlsc5UKRhxmSirHDkENbCbj38oFNcH2KzBj4Kv9nBSqwtTPiHmBiv/exec";

// Estado global de la aplicación
let students = [];
let history = [];

/**
 * FUNCIÓN MAESTRA DE CARGA
 * Elimina cualquier rastro de memoria local para obligar a ver lo de otros equipos.
 */
async function sync() {
    try {
        // El parámetro 'nocache' con Date.now() es la ÚNICA forma de saltarse el bloqueo de GitHub
        const response = await fetch(`${SCRIPT_URL}?nocache=${Date.now()}`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
            const nuevosActivos = data.filter(s => !s.exitTime || s.exitTime.trim() === "");
            const nuevoHistorial = data.filter(s => s.exitTime && s.exitTime.trim() !== "");

            // Solo redibujamos si la nube dice algo distinto a lo que vemos
            if (JSON.stringify(nuevosActivos) !== JSON.stringify(students) || 
                JSON.stringify(nuevoHistorial) !== JSON.stringify(history)) {
                
                students = nuevosActivos;
                history = nuevoHistorial;
                render();
            }
        }
    } catch (e) {
        console.error("Reconectando con el servidor escolar...");
    }
}

function render() {
    const list = document.getElementById("studentList");
    const hist = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
    // Actualizar contadores
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
        badge.className = `state-badge state-${s.stateKey}`;

        node.querySelector(".student-name").textContent = s.name;
        node.querySelector(".student-course").textContent = s.course;
        
        const doneBtn = node.querySelector(".done-btn");
        if(s.stateKey === "AVISADO") {
            doneBtn.style.display = "block";
            doneBtn.onclick = async () => {
                s.exitTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                await push(s);
                sync(); 
            };
        }

        badge.onclick = async () => {
            const keys = ["ESPERA", "BUSCA", "AVISADO"];
            s.stateKey = keys[(keys.indexOf(s.stateKey) + 1) % keys.length];
            const audio = document.getElementById('sound-status');
            if(audio) audio.play().catch(()=>{});
            
            // Cambio visual instantáneo para el usuario que hace click
            render(); 
            // Envío a la nube
            await push(s);
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

async function push(obj) {
    const params = new URLSearchParams();
    for (const key in obj) params.append(key, obj[key]);
    return fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params });
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
    
    const audio = document.getElementById('sound-add');
    if(audio) audio.play().catch(()=>{});

    await push(s);
    e.target.reset();
    
    // Refresco casi instantáneo tras agregar
    setTimeout(sync, 1000);
};

// --- ARRANQUE DE ALTA VELOCIDAD ---
sync(); 
// Consultamos cada 3 segundos. Es el límite seguro para no bloquear Google.
setInterval(sync, 3000);
