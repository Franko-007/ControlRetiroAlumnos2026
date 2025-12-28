const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxii8gDn6G8NSoK1MJLLiEMJZ4G04yuk8UL8C-dq-88j0aoe4Ou_GL-g8nF1dV07Ckw/exec"; 

let students = [];
let history = [];
let isPaused = false;

function playSound(id) {
    const audio = document.getElementById(id);
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

async function sync() {
    if (isPaused) return;
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        if (Array.isArray(data)) {
            students = data.filter(s => !s.exitTime || s.exitTime === "");
            history = data.filter(s => s.exitTime && s.exitTime !== "");
            render();
        }
    } catch (e) { console.error("Error sync"); }
}

async function updateRanking() {
    try {
        const res = await fetch(`${SCRIPT_URL}?action=getRanking`);
        const data = await res.json();
        const display = document.getElementById("topAlumnoDisplay");

        if (!data.rankingCompleto || data.rankingCompleto.length === 0) {
            display.innerHTML = "<div style='padding:10px; opacity:0.5;'>Sin registros esta semana</div>";
            return data;
        }

        const maxVal = data.rankingCompleto[0][1];
        let html = `<div class="ranking-grid">`;
        
        data.rankingCompleto.forEach((item, i) => {
            const porcentaje = (item[1] / maxVal) * 100;
            html += `
                <div class="rank-card">
                    <div class="rank-header">
                        <span class="rank-number">${i + 1}</span>
                        <span class="rank-name">${item[0]}</span>
                        <span class="rank-count">${item[1]} <small>retiros</small></span>
                    </div>
                    <div class="rank-bar-container">
                        <div class="rank-bar-fill" style="width: ${porcentaje}%"></div>
                    </div>
                </div>`;
        });
        display.innerHTML = html + "</div>";
        return data;
    } catch (e) { return null; }
}

function render() {
    const list = document.getElementById("studentList");
    const histList = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    
    const counts = { "ESPERA": 0, "EN BUSCA": 0, "AVISADO": 0 };
    students.forEach(s => { 
        const st = (s.stateKey || "ESPERA").toUpperCase();
        if(counts[st] !== undefined) counts[st]++; 
    });
    
    document.getElementById("countEspera").textContent = counts["ESPERA"];
    document.getElementById("countBusca").textContent = counts["EN BUSCA"];
    document.getElementById("countAvisado").textContent = counts["AVISADO"];
    document.getElementById("countFinalizado").textContent = history.length;

    list.innerHTML = "";
    students.forEach(s => {
        const clone = temp.content.cloneNode(true);
        const btn = clone.querySelector(".state-btn");
        const status = (s.stateKey || "ESPERA").toUpperCase();
        btn.textContent = status;
        btn.className = `state-btn state-${status.replace(/\s+/g, '_')}`;
        clone.querySelector(".name").textContent = s.name;
        clone.querySelector(".sub").textContent = `${s.course} | ${s.reason}`;
        
        if(status === "AVISADO") {
            const okBtn = clone.querySelector(".done-check");
            okBtn.style.display = "flex";
            okBtn.onclick = () => finalizarRetiro(s);
        }
        btn.onclick = () => cambiarEstado(s);
        clone.querySelector(".delete-btn").onclick = () => eliminarAlumno(s.id);
        list.appendChild(clone);
    });

    histList.innerHTML = "";
    history.slice(-5).reverse().forEach(s => {
        const clone = temp.content.cloneNode(true);
        clone.querySelector(".card").style.opacity = "0.5";
        clone.querySelector(".state-btn").textContent = "FIN";
        clone.querySelector(".name").textContent = s.name;
        clone.querySelector(".sub").textContent = s.course;
        clone.querySelector(".actions").innerHTML = `<small>Salida: ${s.exitTime}</small>`;
        histList.appendChild(clone);
    });
    document.getElementById("emptyState").style.display = students.length ? "none" : "block";
}

async function cambiarEstado(alumno) {
    pauseSync();
    const flow = ["ESPERA", "EN BUSCA", "AVISADO"];
    alumno.stateKey = flow[(flow.indexOf(alumno.stateKey) + 1) % flow.length];
    playSound('sound-status');
    render();
    await enviarDatos(alumno);
}

async function finalizarRetiro(alumno) {
    pauseSync();
    alumno.exitTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    render();
    await enviarDatos(alumno);
    sync();
}

async function eliminarAlumno(id) {
    if(!confirm("¿Eliminar?")) return;
    pauseSync();
    await fetch(`${SCRIPT_URL}?action=delete&id=${id}`, { method: 'POST', mode: 'no-cors' });
    sync();
}

async function enviarDatos(obj) {
    const p = new URLSearchParams();
    for (let k in obj) p.append(k, obj[k]);
    return fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p });
}

document.getElementById("addForm").onsubmit = async (e) => {
    e.preventDefault();
    pauseSync();
    const s = {
        id: "ID-" + Date.now(),
        name: document.getElementById("nameInput").value,
        course: document.getElementById("courseInput").value,
        reason: document.getElementById("reasonInput").value,
        stateKey: "ESPERA", timestamp: Date.now().toString(), exitTime: ""
    };
    playSound('sound-add');
    students.push(s);
    render();
    await enviarDatos(s);
    e.target.reset();
};

function pauseSync() { isPaused = true; setTimeout(() => isPaused = false, 3000); }

async function exportToPDF() {
    const win = window.open('', '_blank');
    win.document.write('<html><body style="font-family:sans-serif; text-align:center; padding-top:50px;"><h2>Generando informe oficial...</h2></body></html>');
    
    const stats = await updateRanking();
    
    // LOGO ACTUALIZADO CON TU LINK, FRANCO
    const URL_LOGOTIPO = "https://i.postimg.cc/sxxwfhwK/LOGO-LBSNG-06-237x300.png"; 
    
    const fechaActual = new Date();
    const mesAnio = fechaActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

    win.document.open();
    win.document.write(`
        <html>
        <head>
            <title>Informe NSG - ${mesAnio}</title>
            <script src="https://www.gstatic.com/charts/loader.js"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; background: white; }
                
                .header-wrapper { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    border-bottom: 3px solid #3b82f6; 
                    padding-bottom: 20px; 
                    margin-bottom: 30px; 
                }
                .logo-area { display: flex; align-items: center; gap: 20px; }
                .logo-img { height: 80px; width: auto; object-fit: contain; }
                .header-text h1 { margin: 0; font-size: 26px; color: #0f172a; }
                .header-text p { margin: 5px 0 0; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }

                .print-container {
                    display: flex;
                    align-items: center;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    overflow: hidden;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .print-text { background: #3b82f6; color: white; padding: 12px 20px; font-weight: 800; font-size: 13px; }
                .print-icon { padding: 12px 15px; background: #f8fafc; font-size: 20px; }

                .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
                .chart-card { border: 1px solid #f1f5f9; border-radius: 12px; padding: 15px; height: 350px; }

                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #f8fafc; text-align: left; padding: 14px; font-size: 12px; border-bottom: 2px solid #e2e8f0; color: #475569; }
                td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
                tr:nth-child(even) { background: #fbfcfd; }

                @media print { .no-print { display: none; } body { padding: 10px; } }
            </style>
            <script>
                google.charts.load('current', {'packages':['corechart']});
                google.charts.setOnLoadCallback(() => {
                    if(!${JSON.stringify(stats)}) return;
                    const d1 = google.visualization.arrayToDataTable([['Alumno', 'Cant'], ${stats.rankingCompleto.map(a => `['${a[0]}', ${a[1]}]`).join(',')}]);
                    new google.visualization.BarChart(document.getElementById('c1')).draw(d1, { title:'RANKING DE ALUMNOS', colors:['#3b82f6'], legend:'none', chartArea: {width: '50%'} });
                    
                    const d2 = google.visualization.arrayToDataTable([['Motivo', 'Cant'], ${stats.motivos.map(m => `['${m[0]}', ${m[1]}]`).join(',')}]);
                    new google.visualization.PieChart(document.getElementById('c2')).draw(d2, { title:'MOTIVOS DE RETIRO', pieHole: 0.4, colors: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981'] });
                });
            </script>
        </head>
        <body>
            <div class="header-wrapper">
                <div class="logo-area">
                    <img src="${URL_LOGOTIPO}" class="logo-img" onerror="this.style.display='none'">
                    <div class="header-text">
                        <h1>Informe de Retiro Escolar NSG</h1>
                        <p>Periodo: ${mesAnio}</p>
                    </div>
                </div>
                <div class="print-container no-print" onclick="window.print()">
                    <div class="print-text">IMPRIMIR REPORTE</div>
                    <div class="print-icon">🖨️</div>
                </div>
            </div>

            <div class="charts-grid">
                <div id="c1" class="chart-card"></div>
                <div id="c2" class="chart-card"></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>FECHA</th>
                        <th>ALUMNO</th>
                        <th>CURSO</th>
                        <th>MOTIVO</th>
                        <th>SALIDA</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.detalles.reverse().map(d => `
                        <tr>
                            <td>${d.fecha}</td>
                            <td><strong>${d.nombre}</strong></td>
                            <td>${d.curso}</td>
                            <td>${d.motivo}</td>
                            <td>${d.salida || 'Finalizado'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <footer style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #eee; padding-top: 20px;">
                Sistema de Control NSG - Franco 2026 © Generado el ${new Date().toLocaleString()}
            </footer>
        </body>
        </html>
    `);
    win.document.close();
}

sync();
updateRanking();
setInterval(sync, 9000);
setInterval(updateRanking, 60000);
