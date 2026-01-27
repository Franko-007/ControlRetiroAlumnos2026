const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxii8gDn6G8NSoK1MJLLiEMJZ4G04yuk8UL8C-dq-88j0aoe4Ou_GL-g8nF1dV07Ckw/exec"; 

let students = [];
let history = [];
let isPaused = false;
let lastDataHash = "";
let historyExpanded = false;
let withdrawnExpanded = true; // Comienza expandido por defecto
let lastNotificationCheck = 0; // Para el sistema de notificaciones

// ============================================
// SISTEMA DE NOTIFICACIONES TOAST
// ============================================
function showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    const titles = {
        success: title || 'Éxito',
        error: title || 'Error',
        info: title || 'Información',
        warning: title || 'Advertencia'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// MODO OSCURO / CLARO
// ============================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        document.querySelector('.theme-icon').textContent = '☀️';
    }
}

document.getElementById('themeToggle').addEventListener('click', function() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    this.querySelector('.theme-icon').textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

// ============================================
// SONIDOS
// ============================================
function playSound(id) {
    const audio = document.getElementById(id);
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

function generateHash(data){
    return JSON.stringify(data).length;
}

// ============================================
// SISTEMA DE NOTIFICACIONES EN TIEMPO REAL
// ============================================
async function checkNotifications() {
    if (isPaused) return;
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=checkNotifications&lastCheck=${lastNotificationCheck}`);
        const data = await response.json();
        
        if (data.hasNew && data.notifications.length > 0) {
            // Procesar cada notificación
            data.notifications.forEach(notif => {
                if (notif.type === 'new') {
                    // Nueva entrada - Sonido y notificación
                    playSound('sound-add');
                    showToast(
                        `${notif.name} - ${notif.course}`, 
                        'info', 
                        '🆕 Nuevo Retiro Registrado'
                    );
                    
                    // Notificación de escritorio si está permitida
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("Nuevo Retiro - NSG", {
                            body: `${notif.name} (${notif.course}) - ${notif.reason}`,
                            icon: "🎒",
                            tag: 'retiro-' + notif.timestamp
                        });
                    }
                    
                } else if (notif.type === 'completed') {
                    // Retiro completado
                    playSound('sound-success');
                    showToast(
                        `${notif.name} completó su retiro a las ${notif.exitTime}`, 
                        'success', 
                        '✅ Retiro Finalizado'
                    );
                }
            });
            
            // Actualizar el timestamp de la última verificación
            lastNotificationCheck = Date.now();
            
            // Forzar sincronización para actualizar los datos
            sync();
        }
    } catch (e) {
        console.error("Error checking notifications", e);
    }
}

// Solicitar permisos de notificación
function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                showToast('Notificaciones de escritorio activadas', 'success');
            }
        });
    }
}

// ============================================
// SINCRONIZACIÓN CON SERVIDOR
// ============================================
async function sync() {
    if (isPaused) return;
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        if (!Array.isArray(data)) return;

        const newHash = generateHash(data);
        if(newHash === lastDataHash) return;
        lastDataHash = newHash;

        students = data.filter(s => !s.exitTime || s.exitTime === "");
        history = data.filter(s => s.exitTime && s.exitTime !== "");
        render();
        updateKPIs();
        updateTimeline();
    } catch (e) { 
        console.error("Error sync", e);
        showToast('Error al sincronizar con el servidor', 'error');
    }
}

// ============================================
// RANKING
// ============================================
async function updateRanking() {
    try {
        const res = await fetch(`${SCRIPT_URL}?action=getRanking`);
        const data = await res.json();
        const display = document.getElementById("topAlumnoDisplay");

        if (!data.rankingCompleto || data.rankingCompleto.length === 0) {
            display.innerHTML = "<div style='padding:20px; opacity:0.6; text-align:center;'>Sin registros este mes</div>";
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

// ============================================
// KPIs
// ============================================
function updateKPIs() {
    const total = students.length;
    document.getElementById('kpiTotal').textContent = total;
    
    // Calcular tiempo promedio
    const now = Date.now();
    let totalTime = 0;
    let count = 0;
    
    students.forEach(s => {
        if (s.timestamp) {
            const elapsed = now - parseInt(s.timestamp);
            totalTime += elapsed;
            count++;
        }
    });
    
    const avgMinutes = count > 0 ? Math.round(totalTime / count / 60000) : 0;
    document.getElementById('kpiAvgTime').textContent = `${avgMinutes} min`;
    
    // Completados hoy
    const today = new Date().toDateString();
    const completedToday = history.filter(s => {
        if (s.timestamp) {
            const date = new Date(parseInt(s.timestamp));
            return date.toDateString() === today;
        }
        return false;
    }).length;
    document.getElementById('kpiCompleted').textContent = completedToday;
    
    // Tiempo excedido (más de 30 minutos)
    const exceeded = students.filter(s => {
        if (s.timestamp) {
            const elapsed = now - parseInt(s.timestamp);
            return elapsed > 30 * 60000; // 30 minutos
        }
        return false;
    }).length;
    document.getElementById('kpiExceeded').textContent = exceeded;
}

// ============================================
// TIMELINE DE ACTIVIDAD
// ============================================
function updateTimeline() {
    const container = document.getElementById('timelineContainer');
    const template = document.getElementById('timelineTemplate');
    const dateSpan = document.getElementById('timelineDate');
    
    if (dateSpan) {
        dateSpan.textContent = new Date().toLocaleDateString('es-CL', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    
    if (!container || !template) return;
    
    container.innerHTML = '';
    
    // Obtener todos los eventos del día
    const today = new Date().toDateString();
    const todayEvents = [...students, ...history]
        .filter(s => {
            if (s.timestamp) {
                const date = new Date(parseInt(s.timestamp));
                return date.toDateString() === today;
            }
            return false;
        })
        .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
        .slice(0, 10);
    
    if (todayEvents.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">No hay actividad registrada hoy</p>';
        return;
    }
    
    todayEvents.forEach(event => {
        const clone = template.content.cloneNode(true);
        const time = new Date(parseInt(event.timestamp));
        
        clone.querySelector('.timeline-time').textContent = time.toLocaleTimeString('es-CL', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        clone.querySelector('.timeline-name').textContent = event.name;
        
        let action = 'Registrado';
        if (event.exitTime) {
            action = `Finalizado (${event.exitTime})`;
        } else if (event.stateKey === 'AVISADO') {
            action = 'Avisado';
        } else if (event.stateKey === 'EN BUSCA') {
            action = 'En búsqueda';
        }
        
        clone.querySelector('.timeline-action').textContent = `${action} • ${event.course}`;
        
        container.appendChild(clone);
    });
}

// ============================================
// FILTROS Y BÚSQUEDA
// ============================================
let currentFilters = {
    search: '',
    course: '',
    state: '',
    sortBy: 'time'
};

function initFilters() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        currentFilters.search = e.target.value.toLowerCase();
        render();
    });
    
    document.getElementById('filterCourse').addEventListener('change', (e) => {
        currentFilters.course = e.target.value;
        render();
    });
    
    document.getElementById('filterState').addEventListener('change', (e) => {
        currentFilters.state = e.target.value;
        render();
    });
    
    document.getElementById('sortBy').addEventListener('change', (e) => {
        currentFilters.sortBy = e.target.value;
        render();
    });
    
    // Toggle alumnos retirados
    document.getElementById('toggleWithdrawn').addEventListener('click', function() {
        withdrawnExpanded = !withdrawnExpanded;
        const withdrawnGrid = document.getElementById('withdrawnToday');
        withdrawnGrid.classList.toggle('collapsed');
        this.classList.toggle('active');
        this.querySelector('span:first-child').textContent = withdrawnExpanded ? 'Ocultar' : 'Ver todos';
    });
    
    // Toggle historial
    document.getElementById('toggleHistory').addEventListener('click', function() {
        historyExpanded = !historyExpanded;
        const histList = document.getElementById('historyList');
        histList.classList.toggle('expanded');
        this.classList.toggle('active');
        this.querySelector('span:first-child').textContent = historyExpanded ? 'Ocultar' : 'Ver historial';
    });
}

function filterAndSortStudents(studentsList) {
    let filtered = [...studentsList];
    
    // Buscar por nombre
    if (currentFilters.search) {
        filtered = filtered.filter(s => 
            s.name.toLowerCase().includes(currentFilters.search)
        );
    }
    
    // Filtrar por curso
    if (currentFilters.course) {
        filtered = filtered.filter(s => 
            s.course.includes(currentFilters.course)
        );
    }
    
    // Filtrar por estado
    if (currentFilters.state) {
        filtered = filtered.filter(s => 
            (s.stateKey || "ESPERA").toUpperCase() === currentFilters.state
        );
    }
    
    // Ordenar
    switch (currentFilters.sortBy) {
        case 'name':
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'course':
            filtered.sort((a, b) => a.course.localeCompare(b.course));
            break;
        case 'time':
        default:
            filtered.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
            break;
    }
    
    return filtered;
}

// ============================================
// CALCULAR DURACIÓN
// ============================================
function calculateDuration(entryTimestamp, exitTime) {
    if (!entryTimestamp || !exitTime) return 'N/A';
    
    const entry = new Date(parseInt(entryTimestamp));
    const [hours, minutes] = exitTime.split(':');
    const exit = new Date(entry);
    exit.setHours(parseInt(hours), parseInt(minutes), 0);
    
    const durationMs = exit - entry;
    const durationMinutes = Math.floor(durationMs / 60000);
    
    if (durationMinutes < 60) {
        return `${durationMinutes} min`;
    }
    
    const hrs = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    return `${hrs}h ${mins}m`;
}

// ============================================
// RENDERIZAR ALUMNOS RETIRADOS HOY
// ============================================
function renderWithdrawnToday() {
    const container = document.getElementById('withdrawnToday');
    const emptyState = document.getElementById('emptyWithdrawn');
    const badge = document.getElementById('withdrawnTodayBadge');
    const template = document.getElementById('withdrawnTemplate');
    
    if (!container || !template) return;
    
    // Filtrar retirados de hoy
    const today = new Date().toDateString();
    const withdrawnToday = history.filter(s => {
        if (s.timestamp) {
            const date = new Date(parseInt(s.timestamp));
            return date.toDateString() === today;
        }
        return false;
    }).sort((a, b) => {
        // Ordenar por hora de salida (más reciente primero)
        if (!a.exitTime || !b.exitTime) return 0;
        const [aH, aM] = a.exitTime.split(':').map(Number);
        const [bH, bM] = b.exitTime.split(':').map(Number);
        return (bH * 60 + bM) - (aH * 60 + aM);
    });
    
    badge.textContent = withdrawnToday.length;
    
    if (withdrawnToday.length === 0) {
        emptyState.style.display = 'block';
        container.innerHTML = '';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    withdrawnToday.forEach(student => {
        const clone = template.content.cloneNode(true);
        
        clone.querySelector('.withdrawn-name').textContent = student.name;
        clone.querySelector('.withdrawn-course').textContent = student.course;
        clone.querySelector('.withdrawn-reason').textContent = student.reason;
        
        if (student.timestamp) {
            const entryTime = new Date(parseInt(student.timestamp));
            clone.querySelector('.withdrawn-entry').textContent = entryTime.toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            clone.querySelector('.withdrawn-entry').textContent = 'N/A';
        }
        
        clone.querySelector('.withdrawn-exit').textContent = student.exitTime || 'N/A';
        clone.querySelector('.withdrawn-duration').textContent = calculateDuration(student.timestamp, student.exitTime);
        
        container.appendChild(clone);
    });
}

// ============================================
// CALCULAR TIEMPO TRANSCURRIDO
// ============================================
function getElapsedTime(timestamp) {
    const now = Date.now();
    const elapsed = now - parseInt(timestamp);
    const minutes = Math.floor(elapsed / 60000);
    
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

function getProgressPercentage(state, timestamp) {
    const elapsed = Date.now() - parseInt(timestamp);
    const minutes = elapsed / 60000;
    
    // 30 minutos es el 100%
    const maxMinutes = 30;
    let percentage = (minutes / maxMinutes) * 100;
    
    // Ajustar según el estado
    if (state === 'ESPERA') {
        percentage = Math.min(percentage * 0.33, 33);
    } else if (state === 'EN BUSCA') {
        percentage = Math.min(33 + (percentage * 0.33), 66);
    } else if (state === 'AVISADO') {
        percentage = Math.min(66 + (percentage * 0.34), 100);
    }
    
    return Math.min(percentage, 100);
}

// ============================================
// RENDERIZADO
// ============================================
function render() {
    const list = document.getElementById("studentList");
    const histList = document.getElementById("historyList");
    const temp = document.getElementById("itemTemplate");
    const activeBadge = document.getElementById("activeBadge");
    
    // Filtrar y ordenar
    const filteredStudents = filterAndSortStudents(students);
    
    const counts = { "ESPERA": 0, "EN BUSCA": 0, "AVISADO": 0 };
    students.forEach(s => { 
        const st = (s.stateKey || "ESPERA").toUpperCase();
        if(counts[st] !== undefined) counts[st]++; 
    });
    
    countEspera.textContent = counts["ESPERA"];
    countBusca.textContent = counts["EN BUSCA"];
    countAvisado.textContent = counts["AVISADO"];
    countFinalizado.textContent = history.length;
    
    if (activeBadge) {
        activeBadge.textContent = filteredStudents.length;
    }

    list.innerHTML = "";
    filteredStudents.forEach(s => {
        const clone = temp.content.cloneNode(true);
        const btn = clone.querySelector(".state-btn");
        const status = (s.stateKey || "ESPERA").toUpperCase().trim();
        btn.textContent = status;
        btn.className = `state-btn state-${status.replace(/\s+/g, '_')}`;
        
        clone.querySelector(".name").textContent = s.name;
        clone.querySelector(".sub").textContent = `${s.course} • ${s.reason}`;
        
        // Tiempo transcurrido
        if (s.timestamp) {
            const timeBadge = clone.querySelector('.card-time-badge');
            timeBadge.textContent = getElapsedTime(s.timestamp);
            
            // Barra de progreso
            const progressBar = clone.querySelector('.progress-bar');
            const percentage = getProgressPercentage(status, s.timestamp);
            progressBar.style.width = `${percentage}%`;
            
            // Advertencia si excede 30 minutos
            const elapsed = Date.now() - parseInt(s.timestamp);
            if (elapsed > 30 * 60000) {
                timeBadge.style.background = 'rgba(239, 68, 68, 0.2)';
                timeBadge.style.color = '#fca5a5';
                timeBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            }
        }
        
        // Mostrar botón de finalizar cuando está en estado AVISADO
        const okBtn = clone.querySelector(".done-check");
        console.log(`Alumno: ${s.name}, Estado: "${status}", Mostrar botón: ${status === "AVISADO"}`);
        
        if(status === "AVISADO") {
            okBtn.style.display = "flex";
            okBtn.onclick = () => finalizarRetiro(s);
            console.log(`✅ Botón de finalizar activado para ${s.name}`);
        }
        
        btn.onclick = () => cambiarEstado(s);
        clone.querySelector(".delete-btn").onclick = () => eliminarAlumno(s.id);
        list.appendChild(clone);
    });

    // Renderizar alumnos retirados hoy
    renderWithdrawnToday();

    // Renderizar historial completo
    histList.innerHTML = "";
    const historyToShow = history.slice().reverse();
    historyToShow.forEach(s => {
        const clone = temp.content.cloneNode(true);
        clone.querySelector(".state-btn").textContent = "FINALIZADO";
        clone.querySelector(".state-btn").className = "state-btn";
        clone.querySelector(".name").textContent = s.name;
        clone.querySelector(".sub").textContent = `${s.course} • ${s.reason}`;
        
        // Mostrar fecha y hora de salida
        let exitInfo = '';
        if (s.exitTime) {
            exitInfo = `Salida: ${s.exitTime}`;
        }
        if (s.timestamp) {
            const date = new Date(parseInt(s.timestamp));
            const dateStr = date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
            exitInfo += ` • ${dateStr}`;
        }
        clone.querySelector(".actions").innerHTML = `<small style="color: var(--text-muted);">${exitInfo}</small>`;
        
        // Ocultar barra de progreso en historial
        const progressIndicator = clone.querySelector('.progress-indicator');
        if (progressIndicator) progressIndicator.style.display = 'none';
        
        const timeBadge = clone.querySelector('.card-time-badge');
        if (timeBadge) timeBadge.style.display = 'none';
        
        histList.appendChild(clone);
    });

    emptyState.style.display = filteredStudents.length ? "none" : "block";
}

// ============================================
// CAMBIAR ESTADO
// ============================================
async function cambiarEstado(alumno) {
    pauseSync();
    const flow = ["ESPERA", "EN BUSCA", "AVISADO"];
    const oldState = alumno.stateKey;
    alumno.stateKey = flow[(flow.indexOf(alumno.stateKey) + 1) % flow.length];
    playSound('sound-status');
    render();
    await enviarDatos(alumno);
    showToast(`Estado cambiado a ${alumno.stateKey}`, 'info', alumno.name);
}

// ============================================
// FINALIZAR RETIRO
// ============================================
async function finalizarRetiro(alumno) {
    pauseSync();
    alumno.exitTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    playSound('sound-success');
    render();
    await enviarDatos(alumno);
    showToast(`Retiro finalizado exitosamente`, 'success', alumno.name);
    setTimeout(sync, 1000);
}

// ============================================
// ELIMINAR ALUMNO
// ============================================
async function eliminarAlumno(id) {
    if(!confirm("¿Eliminar este registro?")) return;
    pauseSync();
    await fetch(`${SCRIPT_URL}?action=delete&id=${id}`, { method: 'POST', mode: 'no-cors' });
    showToast('Registro eliminado', 'warning');
    setTimeout(sync, 1000);
}

// ============================================
// ENVIAR DATOS
// ============================================
async function enviarDatos(obj) {
    const p = new URLSearchParams();
    for (let k in obj) p.append(k, obj[k]);
    return fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p });
}

// ============================================
// FORMULARIO DE REGISTRO
// ============================================
addForm.onsubmit = async (e) => {
    e.preventDefault();
    pauseSync();
    const s = {
        id: "ID-" + Date.now(),
        name: nameInput.value.trim(),
        course: courseInput.value,
        reason: reasonInput.value,
        stateKey: "ESPERA",
        timestamp: Date.now().toString(),
        exitTime: ""
    };
    playSound('sound-add');
    students.unshift(s);
    render();
    updateKPIs();
    updateTimeline();
    await enviarDatos(s);
    e.target.reset();
    showToast('Alumno registrado exitosamente', 'success', s.name);
};

// ============================================
// EXPORTACIÓN A PDF
// ============================================
async function exportToPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        // Título
        pdf.setFontSize(20);
        pdf.text('Control de Retiro Escolar NSG', 20, 20);
        
        // Fecha
        pdf.setFontSize(12);
        const fecha = new Date().toLocaleDateString('es-CL');
        pdf.text(`Fecha: ${fecha}`, 20, 30);
        
        // Estadísticas
        pdf.setFontSize(14);
        pdf.text('Estadísticas del Día', 20, 45);
        pdf.setFontSize(11);
        pdf.text(`Total Activos: ${students.length}`, 20, 55);
        pdf.text(`En Espera: ${document.getElementById('countEspera').textContent}`, 20, 62);
        pdf.text(`En Busca: ${document.getElementById('countBusca').textContent}`, 20, 69);
        pdf.text(`Avisados: ${document.getElementById('countAvisado').textContent}`, 20, 76);
        pdf.text(`Finalizados: ${document.getElementById('countFinalizado').textContent}`, 20, 83);
        
        // Lista de alumnos activos
        pdf.setFontSize(14);
        pdf.text('Alumnos Activos', 20, 100);
        pdf.setFontSize(10);
        
        let y = 110;
        students.slice(0, 15).forEach((s, i) => {
            if (y > 270) {
                pdf.addPage();
                y = 20;
            }
            pdf.text(`${i + 1}. ${s.name} - ${s.course} - ${s.stateKey}`, 20, y);
            y += 7;
        });
        
        pdf.save(`retiros-${fecha}.pdf`);
        showToast('PDF generado exitosamente', 'success');
    } catch (e) {
        console.error(e);
        showToast('Error al generar PDF', 'error');
    }
}

// ============================================
// EXPORTACIÓN A EXCEL
// ============================================
function exportToExcel() {
    try {
        const data = [...students, ...history];
        let csv = 'Nombre,Curso,Motivo,Estado,Hora Entrada,Hora Salida\n';
        
        data.forEach(s => {
            const entrada = s.timestamp ? new Date(parseInt(s.timestamp)).toLocaleTimeString('es-CL') : '';
            const salida = s.exitTime || '';
            const estado = s.exitTime ? 'FINALIZADO' : (s.stateKey || 'ESPERA');
            csv += `"${s.name}","${s.course}","${s.reason}","${estado}","${entrada}","${salida}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `retiros-${new Date().toLocaleDateString('es-CL')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Excel generado exitosamente', 'success');
    } catch (e) {
        console.error(e);
        showToast('Error al generar Excel', 'error');
    }
}

// ============================================
// IMPRIMIR
// ============================================
function printReport() {
    window.print();
    showToast('Abriendo diálogo de impresión', 'info');
}

// ============================================
// PAUSAR SYNC
// ============================================
function pauseSync() { 
    isPaused = true; 
    setTimeout(() => isPaused = false, 3000); 
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initFilters();
    sync();
    updateRanking();
    
    // Solicitar permisos de notificación
    requestNotificationPermission();
    
    // Inicializar timestamp de notificaciones
    lastNotificationCheck = Date.now();
    
    // Intervalos de actualización
    setInterval(sync, 9000);
    setInterval(updateRanking, 60000);
    
    // Verificar notificaciones cada 3 segundos (tiempo real)
    setInterval(checkNotifications, 3000);
    
    setInterval(() => {
        if (students.length > 0) {
            render(); // Actualizar tiempos transcurridos
        }
    }, 30000); // Cada 30 segundos
    
    // Mostrar bienvenida
    setTimeout(() => {
        showToast('Sistema de Control Escolar NSG cargado correctamente', 'success', '¡Bienvenido!');
    }, 500);
});

// Actualizar KPIs cada minuto
setInterval(() => {
    updateKPIs();
}, 60000);
