const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxopNnF78VHD9CXlsc5UKRhxmSirHDkENbCbj38oFNcH2KzBj4Kv9nBSqwtTPiHmBiv/exec";

// 1. MEMORIA LOCAL PERSISTENTE
let students = JSON.parse(localStorage.getItem('retiros_f_activos')) || [];
let history = JSON.parse(localStorage.getItem('retiros_f_historial')) || [];

function playSound(id) {
    const audio = document.getElementById(id);
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

// 2. CARGA INTELIGENTE (Mezcla, no reemplaza)
async function loadFromCloud() {
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${new Date().getTime()}`);
        const data = await res.json();
        
        // PROTECCIÓN: Solo procesamos si la nube trae un array válido
        if (Array.isArray(data) && data.length > 0) {
            const cloudActivos = data.filter(s => !s.exitTime || s.exitTime.trim() === "");
            const cloudHistorial = data.filter(s => s.exitTime && s.exitTime.trim() !== "");

            // MEZCLA SEGURA: Agregamos lo que no tenemos, pero no borramos lo que ya está en pantalla
            let huboCambios = false;
            cloudActivos.forEach(c => {
                if (!students.some(l => l.id === c.id)) {
                    students.push(c);
                    huboCambios = true;
                }
            });

            if (huboCambios) {
                saveLocal();
                render();
            }
        }
    } catch (e) { console.log("Sincronizando..."); }
}

function saveLocal() {
    localStorage.setItem('retiros_f_activos', JSON.stringify(students));
    localStorage.setItem('retiros_f_historial', JSON.stringify(history));
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
                history.push(s);
                students = students.filter(x => x.id !== s.id);
                saveLocal();
                render();
                await saveToCloud(s);
            };
        }

        badge.onclick = async () => {
            const keys = ["ESPERA", "BUSCA", "AVISADO"];
            s.stateKey = keys[(keys.indexOf(s.stateKey) + 1) % keys.length];
            playSound('sound-status');
            saveLocal();
            render();
            await saveToCloud(s);
        };

        node.querySelector(".del-btn").onclick = () => {
            if(confirm("¿Eliminar?")) {
                students = students.filter(x => x.id !== s.id);
                saveLocal();
                render();
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
    
    students.push(s);
    playSound('sound-add');
    saveLocal();
    render();
    await saveToCloud(s);
    e.target.reset();
};

// INICIALIZACIÓN
render();
loadFromCloud();
setInterval(loadFromCloud, 20000); // Sincroniza cada 20 segundos
