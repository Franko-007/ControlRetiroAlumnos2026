const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz0_Vypdi5SKxLUHfc21M8eWflY4bfvAsgCfa5S1gB2QzSsBoPEwuRAYylh9ZB0wJ7Q/exec"; 

let students = [];
let history = [];

async function sync() {
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await res.json();
        if (Array.isArray(data)) {
            const nuevosActivos = data.filter(s => !s.exitTime || String(s.exitTime).trim() === "");
            const nuevoHistorial = data.filter(s => s.exitTime && String(s.exitTime).trim() !== "");
            
            if (JSON.stringify(nuevosActivos) !== JSON.stringify(students) || JSON.stringify(nuevoHistorial) !== JSON.stringify(history)) {
                students = nuevosActivos;
                history = nuevoHistorial;
                render();
            }
        }
    } catch (e) { console.warn("Sync..."); }
}

function render() {
    const list = document.getElementById("studentList");
    const histList = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
    const counts = { "ESPERA": 0, "EN BUSCA": 0, "AVISADO": 0 };
    students.forEach(s => { if(counts[s.stateKey] !== undefined) counts[s.stateKey]++; });
    
    document.getElementById("countEspera").textContent = counts["ESPERA"];
    document.getElementById("countBusca").textContent = counts["EN BUSCA"];
    document.getElementById("countAvisado").textContent = counts["AVISADO"];
    document.getElementById("countFinalizado").textContent = history.length;

    list.innerHTML = "";
    students.forEach(s => {
        const node = temp.content.cloneNode(true);
        const btn = node.querySelector(".state-btn");
        
        btn.textContent = s.stateKey;
        const cssClass = s.stateKey.replace(/\s+/g, '_');
        btn.className = `state-btn state-${cssClass}`;
        
        node.querySelector(".name").textContent = s.name;
        node.querySelector(".sub").textContent = `${s.course} | ${s.reason}`;
        
        const doneBtn = node.querySelector(".done-check");
        if(s.stateKey === "AVISADO") {
            doneBtn.style.display = "flex";
            doneBtn.onclick = async () => {
                s.exitTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                history.push(s);
                students = students.filter(x => x.id !== s.id);
                render();
                await push(s);
            };
        }

        btn.onclick = async () => {
            const keys = ["ESPERA", "EN BUSCA", "AVISADO"];
            const nextIndex = (keys.indexOf(s.stateKey) + 1) % keys.length;
            const nextState = keys[nextIndex];

            if (nextState === "AVISADO") {
                const audioAviso = document.getElementById('sound-status');
                audioAviso.volume = 1.0;
                audioAviso.play().catch(()=>{});
            } else {
                document.getElementById('sound-status').play().catch(()=>{});
            }

            s.stateKey = nextState;
            render();
            await push(s);
        };

        // BOTÓN ELIMINAR CORREGIDO
        node.querySelector(".delete-btn").onclick = async () => {
            if(confirm("¿Seguro que deseas eliminar a este alumno de la lista y de la base de datos?")) {
                const studentId = s.id;
                // 1. Eliminar visualmente de inmediato
                students = students.filter(x => x.id !== studentId);
                render();
                
                // 2. Enviar orden de eliminación al servidor
                await deleteFromSheet(studentId);
            }
        };

        list.appendChild(node);
    });

    histList.innerHTML = "";
    history.slice(-5).reverse().forEach(s => {
        const node = temp.content.cloneNode(true);
        node.querySelector(".card").style.opacity = "0.4";
        node.querySelector(".state-btn").textContent = "FIN";
        node.querySelector(".state-btn").style.background = "#444";
        node.querySelector(".name").textContent = s.name;
        node.querySelector(".sub").textContent = s.course;
        node.querySelector(".actions").innerHTML = `<small>${s.exitTime}</small>`;
        histList.appendChild(node);
    });

    document.getElementById("emptyState").style.display = students.length ? "none" : "block";
}

async function push(obj) {
    const params = new URLSearchParams();
    for (const key in obj) params.append(key, obj[key]);
    return fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params });
}

// NUEVA FUNCIÓN PARA ELIMINAR REALMENTE EN GOOGLE SHEETS
async function deleteFromSheet(id) {
    const params = new URLSearchParams();
    params.append("action", "delete"); // Enviamos una acción de eliminación
    params.append("id", id);
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
    
    const audioAdd = document.getElementById('sound-add');
    audioAdd.volume = 1.0;
    audioAdd.play().catch(()=>{});

    students.push(s);
    render();
    await push(s);
    e.target.reset();
};

sync();
setInterval(sync, 4000);
