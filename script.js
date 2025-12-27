const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxopNnF78VHD9CXlsc5UKRhxmSirHDkENbCbj38oFNcH2KzBj4Kv9nBSqwtTPiHmBiv/exec";

// 1. CARGA INICIAL (Prioridad absoluta a la memoria del navegador)
let students = JSON.parse(localStorage.getItem('retiros_f_activos')) || [];
let history = JSON.parse(localStorage.getItem('retiros_f_historial')) || [];

function playSound(id) {
    const audio = document.getElementById(id);
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

async function loadFromCloud() {
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${new Date().getTime()}`);
        const data = await res.json();
        
        // SOLO si la nube trae datos reales y NO está vacía, actualizamos.
        // Si la nube está vacía, NO tocamos la lista local para que no se borre.
        if (Array.isArray(data) && data.length > 0) {
            const nuevosActivos = data.filter(s => !s.exitTime || s.exitTime.trim() === "");
            const nuevoHistorial = data.filter(s => s.exitTime && s.exitTime.trim() !== "");
            
            // Si hay cambios reales, actualizamos la vista
            if (JSON.stringify(nuevosActivos) !== JSON.stringify(students)) {
                students = nuevosActivos;
                history = nuevoHistorial;
                updateLocal();
                render();
            }
        }
    } catch (e) { 
        console.warn("GitHub/Sheets: Error de conexión, manteniendo datos locales."); 
    }
}

function updateLocal() {
    localStorage.setItem('retiros_f_activos', JSON.stringify(students));
    localStorage.setItem('retiros_f_historial', JSON.stringify(history));
}

function render() {
    const list = document.getElementById("studentList");
    const hist = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
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
                updateLocal();
                render();
                await saveToCloud(s);
            };
        }

        badge.onclick = async () => {
            const keys = ["ESPERA", "BUSCA", "AVISADO"];
            s.stateKey = keys[(keys.indexOf(s.stateKey) + 1) % keys.length];
            playSound('sound-status');
            updateLocal();
            render();
            await saveToCloud(s);
        };

        node.querySelector(".del-btn").onclick = () => {
            if(confirm("¿Eliminar?")) {
                students = students.filter(x => x.id !== s.id);
                updateLocal();
                render();
            }
        };

        list.appendChild(node);
    });

    hist.innerHTML = "";
    history.slice(-8).reverse().forEach(s => {
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
    // 'no-cors' evita bloqueos de seguridad en GitHub
    return fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p });
}

document.getElementById("addForm").onsubmit = async (e) => {
    e.preventDefault();
    const s = {
        id: "ID-"+Date.now(),
        name: document.getElementById("nameInput").value,
        course: document.getElementById("courseInput").value,
        stateKey: "ESPERA",
        timestamp: Date.now().toString(),
        exitTime: ""
    };
    
    // Primero mostramos y guardamos localmente (Instantáneo)
    students.push(s);
    playSound('sound-add');
    updateLocal();
    render();
    
    // Luego intentamos enviar a la nube
    await saveToCloud(s);
    e.target.reset();
};

// INICIO SEGURO
render(); 
loadFromCloud(); 
setInterval(loadFromCloud, 20000); // Sincroniza cada 20 seg sin borrar lo local
