const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFJp86DM9ixVK7dnHNzjc0eXZAeVa60wTGLdSRVRxZjQp5KV2QCUslODH040y1E4hV/exec"; 

let students = [];
let history = [];

async function sync() {
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await res.json();
        if (Array.isArray(data)) {
            const nuevosActivos = data.filter(s => !s.exitTime || String(s.exitTime).trim() === "");
            const nuevoHistorial = data.filter(s => s.exitTime && String(s.exitTime).trim() !== "");
            if (JSON.stringify(nuevosActivos) !== JSON.stringify(students)) {
                students = nuevosActivos;
                history = nuevoHistorial;
                render();
            }
        }
    } catch (e) { console.warn("Sincronizando..."); }
}

function render() {
    const list = document.getElementById("studentList");
    const hist = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
    // Actualizar Contadores
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
        node.querySelector(".student-course").textContent = `${s.course} | ${s.reason}`;
        
        const doneBtn = node.querySelector(".done-btn");
        if(s.stateKey === "AVISADO") {
            doneBtn.style.display = "flex";
            doneBtn.onclick = async () => {
                s.exitTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                students = students.filter(x => x.id !== s.id);
                render();
                await push(s);
            };
        }

        badge.onclick = async () => {
            const keys = ["ESPERA", "BUSCA", "AVISADO"];
            s.stateKey = keys[(keys.indexOf(s.stateKey) + 1) % keys.length];
            render();
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
        stateKey: "ESPERA", timestamp: Date.now().toString(), exitTime: ""
    };
    students.push(s);
    render();
    await push(s);
    e.target.reset();
};

sync();
setInterval(sync, 4000);
