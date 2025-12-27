// URL proporcionada por Franco
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFJp86DM9ixVK7dnHNzjc0eXZAeVa60wTGLdSRVRxZjQp5KV2QCUslODH040y1E4hV/exec"; 

let students = [];
let history = [];

// Sincronización inteligente (Sin pestañeo)
async function sync() {
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
            const nuevosActivos = data.filter(s => !s.exitTime || String(s.exitTime).trim() === "");
            const nuevoHistorial = data.filter(s => s.exitTime && String(s.exitTime).trim() !== "");

            // Solo redibuja si hay cambios reales en los datos para evitar el pestañeo
            if (JSON.stringify(nuevosActivos) !== JSON.stringify(students) || 
                JSON.stringify(nuevoHistorial) !== JSON.stringify(history)) {
                
                students = nuevosActivos;
                history = nuevoHistorial;
                render();
            }
        }
    } catch (e) { 
        console.warn("Sincronizando con el servidor..."); 
    }
}

function render() {
    const list = document.getElementById("studentList");
    const hist = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
    // 1. Actualizar Contadores (Funcionando ahora)
    const counts = { ESPERA: 0, BUSCA: 0, AVISADO: 0 };
    students.forEach(s => { 
        if(counts[s.stateKey] !== undefined) counts[s.stateKey]++; 
    });
    document.getElementById("countEspera").textContent = counts.ESPERA;
    document.getElementById("countBusca").textContent = counts.BUSCA;
    document.getElementById("countAvisado").textContent = counts.AVISADO;

    // 2. Dibujar Lista Activa
    list.innerHTML = "";
    students.forEach(s => {
        const node = temp.content.cloneNode(true);
        const badge = node.querySelector(".state-badge");
        
        badge.textContent = s.stateKey;
        badge.className = `state-badge state-${s.stateKey}`;
        
        node.querySelector(".student-name").textContent = s.name;
        node.querySelector(".student-course").textContent = `${s.course} | ${s.reason}`;
        
        // LÓGICA DEL BOTÓN FINALIZAR: Solo aparece si está en "AVISADO" (Verde)
        const doneBtn = node.querySelector(".done-btn");
        if(s.stateKey === "AVISADO") {
            doneBtn.style.display = "block";
            doneBtn.onclick = async () => {
                const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                s.exitTime = time;
                // Eliminación visual inmediata
                students = students.filter(x => x.id !== s.id);
                render(); 
                await push(s);
            };
        } else {
            doneBtn.style.display = "none";
        }

        // Cambio de estado circular al tocar el botón de estado
        badge.onclick = async () => {
            const keys = ["ESPERA", "BUSCA", "AVISADO"];
            let currentIndex = keys.indexOf(s.stateKey);
            s.stateKey = keys[(currentIndex + 1) % keys.length];
            
            const audio = document.getElementById('sound-status');
            if(audio) audio.play().catch(()=>{});
            
            render(); // Actualiza visualmente al instante
            await push(s);
        };

        // Botón eliminar (Basurero)
        node.querySelector(".del-btn").onclick = () => {
            if(confirm("¿Eliminar este registro?")) {
                students = students.filter(x => x.id !== s.id);
                render();
                // Opcional: podrías implementar un borrado físico en el Apps Script aquí
            }
        };

        list.appendChild(node);
    });

    // 3. Dibujar Historial (Últimos 5)
    hist.innerHTML = "";
    history.slice(-5).reverse().forEach(s => {
        const node = temp.content.cloneNode(true);
        const item = node.querySelector(".student-item");
        item.style.opacity = "0.5";
        
        node.querySelector(".state-badge").textContent = "FIN";
        node.querySelector(".state-badge").className = "state-badge";
        node.querySelector(".state-badge").style.background = "#444";
        
        node.querySelector(".student-name").textContent = s.name;
        node.querySelector(".student-course").textContent = s.course;
        node.querySelector(".student-actions").innerHTML = `<small style="color:var(--muted)">${s.exitTime}</small>`;
        hist.appendChild(node);
    });

    document.getElementById("emptyState").style.display = students.length ? "none" : "block";
}

// Envío de datos al servidor
async function push(obj) {
    const params = new URLSearchParams();
    for (const key in obj) params.append(key, obj[key]);
    return fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params });
}

// Evento de formulario
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
    
    const audio = document.getElementById('sound-add');
    if(audio) audio.play().catch(()=>{});

    // Mostrar inmediatamente
    students.push(s);
    render();
    
    // Enviar a la nube
    await push(s);
    e.target.reset();
};

// Inicio de sincronización (Cada 4 segundos)
sync();
setInterval(sync, 4000);
