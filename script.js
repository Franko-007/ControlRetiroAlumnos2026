// REEMPLAZA ESTO CON TU URL DE "NUEVA IMPLEMENTACIÓN"
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFJp86DM9ixVK7dnHNzjc0eXZAeVa60wTGLdSRVRxZjQp5KV2QCUslODH040y1E4hV/exec"; 

let students = [];
let history = [];

async function sync() {
    try {
        // El 'cache-control' y el timestamp obligan a que la web se actualice
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
            // Un alumno está activo si NO tiene hora de salida escrita
            students = data.filter(s => !s.exitTime || String(s.exitTime).trim() === "");
            // Un alumno está en historial si YA tiene hora de salida
            history = data.filter(s => s.exitTime && String(s.exitTime).trim() !== "");
            render();
        }
    } catch (e) {
        console.error("Error cargando datos de la nube...");
    }
}

function render() {
    const list = document.getElementById("studentList");
    const hist = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
    // Contadores
    const counts = { ESPERA: 0, BUSCA: 0, AVISADO: 0 };
    students.forEach(s => { if(counts[s.stateKey] !== undefined) counts[s.stateKey]++; });
    document.getElementById("countEspera").textContent = counts.ESPERA;
    document.getElementById("countBusca").textContent = counts.BUSCA;
    document.getElementById("countAvisado").textContent = counts.AVISADO;

    // Lista Activa
    list.innerHTML = "";
    students.forEach(s => {
        const node = temp.content.cloneNode(true);
        const badge = node.querySelector(".state-badge");
        badge.textContent = s.stateKey;
        badge.className = `state-badge state-${s.stateKey}`;
        node.querySelector(".student-name").textContent = s.name;
        node.querySelector(".student-course").textContent = `${s.course} | ${s.reason}`;
        
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
            await push(s);
            sync();
        };
        list.appendChild(node);
    });

    // Historial (Últimos 5)
    hist.innerHTML = "";
    history.slice(-5).reverse().forEach(s => {
        const node = temp.content.cloneNode(true);
        node.querySelector(".student-item").style.opacity = "0.4";
        node.querySelector(".state-badge").textContent = "FIN";
        node.querySelector(".student-name").textContent = s.name;
        node.querySelector(".student-course").textContent = s.course;
        node.querySelector(".student-actions").innerHTML = `<small>${s.exitTime}</small>`;
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
        id: "ID-" + Date.now(),
        name: document.getElementById("nameInput").value,
        course: document.getElementById("courseInput").value,
        reason: document.getElementById("reasonInput").value,
        stateKey: "ESPERA",
        timestamp: Date.now().toString(),
        exitTime: ""
    };
    await push(s);
    e.target.reset();
    setTimeout(sync, 2000); // Espera 2 seg a que Sheets escriba y actualiza
};

// Sincronización cada 5 segundos
sync();
setInterval(sync, 5000);
