const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzGGFHdaoyAfqFsP2Poq-3GvuyWWOfaeBbL2LPcqut2sgzy_P9-NqgPC4mrlUTidEZj/exec"; 

let students = [];
let history = [];

async function sync() {
    try {
        const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await res.json();
        if (Array.isArray(data)) {
            students = data.filter(s => String(s.exitTime).trim() === "");
            history = data.filter(s => String(s.exitTime).trim() !== "");
            render();
        }
    } catch (e) { console.log("Sincronizando..."); }
}

function render() {
    const list = document.getElementById("studentList");
    const hist = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
    list.innerHTML = "";
    students.forEach(s => {
        const node = temp.content.cloneNode(true);
        const badge = node.querySelector(".state-badge");
        badge.textContent = s.stateKey;
        badge.className = `state-badge state-${s.stateKey}`;

        node.querySelector(".student-name").textContent = s.name;
        // Mostramos Curso + Motivo
        node.querySelector(".student-course").textContent = `${s.course} • ${s.reason}`;
        
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
            render();
            await push(s);
        };
        list.appendChild(node);
    });

    // Historial
    hist.innerHTML = "";
    history.slice(-5).reverse().forEach(s => {
        const node = temp.content.cloneNode(true);
        node.querySelector(".student-item").style.opacity = "0.4";
        node.querySelector(".state-badge").textContent = "FIN";
        node.querySelector(".student-name").textContent = s.name;
        node.querySelector(".student-course").textContent = `${s.course} (${s.reason})`;
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
        reason: document.getElementById("reasonInput").value,
        stateKey: "ESPERA",
        timestamp: Date.now().toString(),
        exitTime: ""
    };
    await push(s);
    e.target.reset();
    setTimeout(sync, 1500);
};

sync();
setInterval(sync, 4000);
