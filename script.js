const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzDM1Hk1YlbLMsvRcqSYxEF5w2Q_W9xpg6y7Cr34KYPLODA-VA_F3DOWe0m2gs0nb6B/exec"

let students = [];
let history = [];

async function sync() {
    try {
        // Forzamos la descarga sin caché para que se vea en otros equipos
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        if (!response.ok) throw new Error("Error de red");
        
        const data = await response.json();
        
        // Separamos alumnos activos de los ya entregados
        students = data.filter(s => String(s.exitTime).trim() === "");
        history = data.filter(s => String(s.exitTime).trim() !== "");
        
        render();
    } catch (e) {
        console.error("Esperando datos del Sheets...");
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
            await push(s);
            sync(); // Actualiza a todos los equipos
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
        stateKey: "ESPERA",
        timestamp: Date.now().toString(),
        exitTime: ""
    };
    await push(s);
    e.target.reset();
    setTimeout(sync, 1500);
};

// Sincronización automática cada 4 segundos
sync();
setInterval(sync, 4000);
