const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz0_Vypdi5SKxLUHfc21M8eWflY4bfvAsgCfa5S1gB2QzSsBoPEwuRAYylh9ZB0wJ7Q/exec"; 

let students = [];
let history = [];
let isPaused = false; 

async function sync() {
    if (isPaused) return;
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await res.json();
        if (Array.isArray(data)) {
            const activos = data.filter(s => !s.exitTime || String(s.exitTime).trim() === "");
            const historial = data.filter(s => s.exitTime && String(s.exitTime).trim() !== "");
            if (JSON.stringify(activos) !== JSON.stringify(students) || JSON.stringify(historial) !== JSON.stringify(history)) {
                students = activos; history = historial; render();
            }
        }
    } catch (e) { console.warn("Sincronizando..."); }
}

function pauseSync() {
    isPaused = true;
    setTimeout(() => { isPaused = false; }, 5000); 
}

function render() {
    const list = document.getElementById("studentList");
    const histList = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
    const counts = { "ESPERA": 0, "EN BUSCA": 0, "AVISADO": 0 };
    students.forEach(s => { 
        const key = (s.stateKey || "ESPERA").toUpperCase();
        if(counts[key] !== undefined) counts[key]++; 
    });
    
    document.getElementById("countEspera").textContent = counts["ESPERA"];
    document.getElementById("countBusca").textContent = counts["EN BUSCA"];
    document.getElementById("countAvisado").textContent = counts["AVISADO"];
    document.getElementById("countFinalizado").textContent = history.length;

    list.innerHTML = "";
    students.forEach(s => {
        const node = temp.content.cloneNode(true);
        const btn = node.querySelector(".state-btn");
        const currentState = (s.stateKey || "ESPERA").toUpperCase();
        
        btn.textContent = currentState;
        btn.className = `state-btn state-${currentState.replace(/\s+/g, '_')}`;
        node.querySelector(".name").textContent = s.name;
        node.querySelector(".sub").textContent = `${s.course} | ${s.reason}`;
        
        const doneBtn = node.querySelector(".done-check");
        if(currentState === "AVISADO") {
            doneBtn.style.display = "flex";
            doneBtn.onclick = async () => {
                pauseSync();
                s.exitTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                history.push(s);
                students = students.filter(x => x.id !== s.id);
                render();
                await push(s);
            };
        }

        btn.onclick = async () => {
            pauseSync(); 
            const keys = ["ESPERA", "EN BUSCA", "AVISADO"];
            let idx = keys.indexOf(currentState);
            if (idx === -1) idx = 0;
            const nextState = keys[(idx + 1) % keys.length];

            const audio = document.getElementById('sound-status');
            if(audio) { audio.volume = 1.0; audio.play().catch(()=>{}); }

            s.stateKey = nextState;
            render();
            await push(s);
        };

        node.querySelector(".delete-btn").onclick = async () => {
            if(confirm("¿Eliminar alumno?")) {
                pauseSync();
                const id = s.id;
                students = students.filter(x => x.id !== id);
                render();
                const p = new URLSearchParams();
                p.append("action", "delete"); p.append("id", id);
                await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p });
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
    const p = new URLSearchParams();
    for (const k in obj) p.append(k, obj[k]);
    return fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p });
}

document.getElementById("addForm").onsubmit = async (e) => {
    e.preventDefault(); pauseSync();
    const s = {
        id: "ID-" + Date.now(),
        name: document.getElementById("nameInput").value,
        course: document.getElementById("courseInput").value,
        reason: document.getElementById("reasonInput").value,
        stateKey: "ESPERA", timestamp: Date.now().toString(), exitTime: ""
    };
    const audio = document.getElementById('sound-add');
    if(audio) { audio.volume = 1.0; audio.play().catch(()=>{}); }
    students.push(s); render(); await push(s); e.target.reset();
};

sync();
setInterval(sync, 9000);
