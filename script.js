const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxopNnF78VHD9CXlsc5UKRhxmSirHDkENbCbj38oFNcH2KzBj4Kv9nBSqwtTPiHmBiv/exec";

// 1. CARGA INICIAL DESDE MEMORIA LOCAL (Para que nunca se vea vacío)
let students = JSON.parse(localStorage.getItem('retiros_backup_activos')) || [];
let history = JSON.parse(localStorage.getItem('retiros_backup_historial')) || [];

function playSound(id) {
    const audio = document.getElementById(id);
    if (audio) { audio.currentTime = 0; audio.play().catch(e => {}); }
}

// 2. SINCRONIZACIÓN CON LA NUBE (Sin borrar lo local si falla)
async function load() {
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await res.json();
        
        // SOLO si recibimos un array con datos, actualizamos
        if (Array.isArray(data) && data.length > 0) {
            students = data.filter(s => !s.exitTime || s.exitTime.trim() === "");
            history = data.filter(s => s.exitTime && s.exitTime.trim() !== "");
            guardarEnLocal();
            render();
        }
    } catch (e) { 
        console.warn("Nube desconectada, usando datos locales."); 
    }
}

function guardarEnLocal() {
    localStorage.setItem('retiros_backup_activos', JSON.stringify(students));
    localStorage.setItem('retiros_backup_historial', JSON.stringify(history));
}

function render() {
    const list = document.getElementById("studentList");
    const histList = document.getElementById("historyList");
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
        node.querySelector(".student-course").textContent = s.course;
        
        const doneBtn = node.querySelector(".done-btn");
        if(s.stateKey === "AVISADO") {
            doneBtn.style.display = "block";
            doneBtn.onclick = () => {
                s.exitTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                saveCloud(s);
                history.push(s);
                students = students.filter(x => x.id !== s.id);
                guardarEnLocal();
                render();
            };
        }

        badge.onclick = () => {
            const keys = ["ESPERA", "BUSCA", "AVISADO"];
            s.stateKey = keys[(keys.indexOf(s.stateKey) + 1) % keys.length];
            playSound('sound-status');
            guardarEnLocal();
            render();
            saveCloud(s);
        };

        node.querySelector(".del-btn").onclick = () => {
            if(confirm("¿Eliminar de la lista?")) {
                students = students.filter(x => x.id !== s.id);
                guardarEnLocal();
                render();
            }
        };

        list.appendChild(node);
    });

    histList.innerHTML = "";
    history.slice(-8).reverse().forEach(s => {
        const node = temp.content.cloneNode(true);
        node.querySelector(".student-item").style.opacity = "0.4";
        node.querySelector(".state-badge").textContent = "FIN";
        node.querySelector(".student-name").textContent = s.name;
        node.querySelector(".student-course").textContent = s.course;
        node.querySelector(".student-actions").innerHTML = `<small style="color:var(--muted)">${s.exitTime}</small>`;
        histList.appendChild(node);
    });

    document.getElementById("emptyState").style.display = students.length ? "none" : "block";
}

async function saveCloud(s) {
    const p = new URLSearchParams();
    for (const key in s) p.append(key, s[key]);
    fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p });
}

document.getElementById("addForm").onsubmit = (e) => {
    e.preventDefault();
    const s = {
        id: "ID-"+Date.now(),
        name: document.getElementById("nameInput").value,
        course: document.getElementById("courseInput").value,
        stateKey: "ESPERA",
        timestamp: Date.now().toString(),
        exitTime: ""
    };
    students.push(s);
    playSound('sound-add');
    guardarEnLocal();
    render();
    saveCloud(s);
    e.target.reset();
};

// 3. INICIO
render(); // Renderiza lo que hay en localStorage al abrir
load();   // Luego intenta traer cosas de la nube
setInterval(load, 30000); // Sincroniza cada 30 seg
