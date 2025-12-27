const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxopNnF78VHD9CXlsc5UKRhxmSirHDkENbCbj38oFNcH2KzBj4Kv9nBSqwtTPiHmBiv/exec";

// Carga inmediata desde LocalStorage para que nunca se vea vacío al recargar
let students = JSON.parse(localStorage.getItem('retiros_f_activos')) || [];
let history = JSON.parse(localStorage.getItem('retiros_f_historial')) || [];

function playSound(id) {
    const audio = document.getElementById(id);
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

async function loadFromCloud() {
    try {
        // El timestamp (?t=) evita que GitHub cachee datos viejos
        const res = await fetch(`${SCRIPT_URL}?t=${new Date().getTime()}`);
        const data = await res.json();
        if (Array.isArray(data)) {
            students = data.filter(s => !s.exitTime || s.exitTime.trim() === "");
            history = data.filter(s => s.exitTime && s.exitTime.trim() !== "");
            updateLocal();
            render();
        }
    } catch (e) { console.warn("Modo local: No se pudo conectar con la nube."); }
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
            doneBtn.onclick = () => {
                s.exitTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                saveToCloud(s);
                history.push(s);
                students = students.filter(x => x.id !== s.id);
                updateLocal();
                render();
            };
        }

        badge.onclick = () => {
            const keys = ["ESPERA", "BUSCA", "AVISADO"];
            s.stateKey = keys[(keys.indexOf(s.stateKey) + 1) % keys.length];
            playSound('sound-status');
            render();
            updateLocal();
            saveToCloud(s);
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
    // 'no-cors' es fundamental para que GitHub Pages no bloquee el envío
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
    students.push(s);
    playSound('sound-add');
    render();
    updateLocal();
    await saveToCloud(s);
    e.target.reset();
};

// Inicio
render();
loadFromCloud();
setInterval(loadFromCloud, 30000);
