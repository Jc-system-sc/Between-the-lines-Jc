// ==========================================================================
// ENTRE LÍNEAS — js/dashboard/admin.js
// Panel administrador. MVP 100% estático: todo habla directo con Firebase.
//
// Truco de la "instancia secundaria": para crear la cuenta de un usuario
// nuevo (correo + contraseña que el admin elige) sin cerrar la sesión del
// propio admin, se usa una segunda instancia de la app de Firebase, solo
// para ese registro puntual, y luego se cierra esa sesión secundaria.
// Esto es 100% cliente, no requiere ningún backend.
// ==========================================================================

let appSecundaria = null;
function obtenerAppSecundaria() {
    if (!appSecundaria) {
        appSecundaria = firebase.initializeApp(firebase.app().options, 'secundaria');
    }
    return appSecundaria;
}

// ─────────── AUTH GUARD ───────────
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = '../../pages/login/login.html'; return; }
    const snap = await firebase.database().ref(`usuarios/${user.uid}`).once('value');
    const perfil = snap.val();
    if (!perfil || perfil.rol !== 'admin') { window.location.href = '../../pages/login/login.html'; return; }

    document.getElementById('admin-name').textContent = perfil.nombre || 'Admin';
    document.getElementById('admin-greeting').textContent = perfil.nombre || 'Admin';
    document.querySelectorAll('.el-theme-toggle-icon').forEach(el => el.innerHTML = elThemeIconInicial());
    elInsertWaves('inicio-waves-container', '70%', true);

    cargarEstadisticasGenerales();
    cargarActividadReciente();
    actualizarBadgeSolicitudes();
    setTimeout(elOcultarLoader, 400);
});

// ─────────── NAVEGACIÓN ───────────
const secciones = ['inicio', 'estadisticas', 'ranking', 'solicitudes', 'usuarios', 'contenidos', 'notificaciones'];
const titulos = {
    inicio: 'Panel General', estadisticas: 'Estadísticas', ranking: 'Ranking',
    solicitudes: 'Solicitudes', usuarios: 'Usuarios', contenidos: 'Contenidos',
    notificaciones: 'Notificaciones'
};

function mostrarSeccion(id) {
    secciones.forEach(s => {
        const el = document.getElementById(`sec-${s}`);
        if (el) el.classList.toggle('hidden', s !== id);
    });
    document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${id}'`));
    });
    document.getElementById('topbar-title').textContent = titulos[id] || '';

    if (id === 'solicitudes') cargarSolicitudes();
    if (id === 'usuarios') cargarUsuarios();
    if (id === 'ranking') cargarRanking();
    if (id === 'contenidos') cargarContenidos();
    if (id === 'estadisticas') cargarEstadisticasContenido();
    if (id === 'notificaciones') cargarNotificaciones();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

function cerrarSesion() {
    firebase.auth().signOut().then(() => { window.location.href = '../../pages/login/login.html'; });
}

// ─────────── ESTADÍSTICAS GENERALES ───────────
async function cargarEstadisticasGenerales() {
    try {
        const usersSnap = await firebase.database().ref('usuarios').once('value');
        const users = usersSnap.val() || {};
        const listaUsuarios = Object.values(users).filter(u => u.rol !== 'admin');

        const totalUsuarios = listaUsuarios.length;
        const activos = listaUsuarios.filter(u => u.cuentaActiva !== false).length;
        document.getElementById('stat-usuarios').textContent = totalUsuarios;
        document.getElementById('stat-activos').textContent = activos;

        const triviasSnap = await firebase.database().ref('trivias').once('value');
        const trivias = triviasSnap.val() || {};
        document.getElementById('stat-trivias').textContent = Object.keys(trivias).length;

        let completadas = 0;
        let usuariosConProgreso = 0;
        listaUsuarios.forEach(u => {
            const usados = u.codigosUsados || {};
            const n = Object.keys(usados).length;
            completadas += n;
            if (n > 0) usuariosConProgreso++;
        });
        document.getElementById('stat-completadas').textContent = completadas;

        const avancePct = totalUsuarios > 0 ? Math.round((usuariosConProgreso / totalUsuarios) * 100) : 0;
        document.getElementById('stat-avance-pct').textContent = `${avancePct}%`;

        renderChartRoles(activos, totalUsuarios - activos);
        renderChartSesiones(listaUsuarios);
    } catch (e) { console.warn('Error estadísticas:', e); }
}

async function actualizarBadgeSolicitudes() {
    try {
        const snap = await firebase.database().ref('solicitudes').once('value');
        const data = snap.val() || {};
        const pendientes = Object.values(data).filter(s => s.estado === 'pendiente' || !s.estado).length;
        const badge = document.getElementById('badge-solicitudes');
        if (pendientes > 0) { badge.textContent = pendientes; badge.classList.add('show'); }
        else badge.classList.remove('show');
    } catch (e) {}
}

// ─────────── GRÁFICOS (Chart.js) ───────────
let chartRolesInstance = null, chartSesionesInstance = null, chartActividadInstance = null, chartProgresoInstance = null;

function renderChartRoles(activos, inactivos) {
    const canvas = document.getElementById('chart-roles');
    if (!canvas || typeof Chart === 'undefined') return;
    if (chartRolesInstance) chartRolesInstance.destroy();
    chartRolesInstance = new Chart(canvas, {
        type: 'doughnut',
        data: { labels: ['Activas', 'Desactivadas'], datasets: [{ data: [activos, inactivos], backgroundColor: ['#81aea8', '#d9c9b8'], borderWidth: 0 }] },
        options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }, cutout: '65%' }
    });
}

function renderChartSesiones(listaUsuarios) {
    const canvas = document.getElementById('chart-sesiones');
    if (!canvas || typeof Chart === 'undefined') return;
    const dias = [], conteos = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
        dias.push(key); conteos[key] = 0;
    }
    listaUsuarios.forEach(u => {
        Object.values(u.codigosUsados || {}).forEach(c => {
            if (!c.fecha) return;
            const key = new Date(c.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
            if (key in conteos) conteos[key]++;
        });
    });
    if (chartSesionesInstance) chartSesionesInstance.destroy();
    chartSesionesInstance = new Chart(canvas, {
        type: 'bar',
        data: { labels: dias, datasets: [{ label: 'Trivias resueltas', data: dias.map(d => conteos[d]), backgroundColor: '#7a9abf', borderRadius: 6 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

function renderChartActividad(actividad) {
    const canvas = document.getElementById('chart-actividad');
    if (!canvas || typeof Chart === 'undefined') return;
    const dias = [], conteos = {};
    for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
        dias.push(key); conteos[key] = 0;
    }
    Object.values(actividad || {}).forEach(a => {
        if (!a.fecha) return;
        const key = new Date(a.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
        if (key in conteos) conteos[key]++;
    });
    if (chartActividadInstance) chartActividadInstance.destroy();
    chartActividadInstance = new Chart(canvas, {
        type: 'line',
        data: { labels: dias, datasets: [{ label: 'Actividad', data: dias.map(d => conteos[d]), borderColor: '#6A9E99', backgroundColor: 'rgba(129,174,168,0.15)', fill: true, tension: 0.35 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

function renderChartProgreso(labels, valores) {
    const canvas = document.getElementById('chart-progreso');
    if (!canvas || typeof Chart === 'undefined') return;
    const colores = ['#81aea8', '#9b8ec4', '#d49a7a', '#7a9abf', '#c48ba8', '#e0a96d', '#7fb0d6'];
    if (chartProgresoInstance) chartProgresoInstance.destroy();
    chartProgresoInstance = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Veces resuelta', data: valores, backgroundColor: labels.map((_, i) => colores[i % colores.length]), borderRadius: 6 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

// ─────────── ACTIVIDAD RECIENTE ───────────
async function cargarActividadReciente() {
    const tbody = document.getElementById('tabla-actividad');
    try {
        const snap = await firebase.database().ref('actividad').orderByChild('fecha').limitToLast(200).once('value');
        const data = snap.val();
        renderChartActividad(data);
        if (!data) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-300);padding:2rem;">Sin actividad registrada.</td></tr>'; return; }
        const rows = Object.values(data).reverse().slice(0, 20);
        tbody.innerHTML = rows.map(a => `
            <tr>
                <td>${a.usuario || '—'}</td>
                <td>${a.trivia || '—'}</td>
                <td>${a.aciertos != null ? `${a.aciertos}/${a.totalPreguntas || '—'}` : '—'}</td>
                <td><strong>${a.puntos || 0}</strong> pts</td>
                <td style="color:var(--gray-500);font-size:0.8rem;">${formatFecha(a.fecha)}</td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-300);padding:2rem;">Sin datos disponibles.</td></tr>';
    }
}

// ─────────── SOLICITUDES ───────────
async function cargarSolicitudes() {
    const tbody = document.getElementById('tabla-solicitudes');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray-300);padding:2rem;">Cargando...</td></tr>';
    try {
        const snap = await firebase.database().ref('solicitudes').once('value');
        const data = snap.val();
        const entradas = Object.entries(data || {}).filter(([, s]) => (s.estado || 'pendiente') === 'pendiente');
        if (!entradas.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray-300);padding:2rem;">Sin solicitudes pendientes.</td></tr>'; return; }

        tbody.innerHTML = entradas.map(([id, s]) => `
            <tr>
                <td><strong>${s.nombre} ${s.apellido || ''}</strong></td>
                <td style="color:var(--gray-500);font-size:0.82rem;">${s.correo}</td>
                <td>${s.edad || '—'}</td>
                <td>${s.sexo || '—'}</td>
                <td>${s.ciudad || '—'}</td>
                <td>${s.whatsapp || '—'}</td>
                <td><code style="font-size:0.78rem;">${s.codigoPago || '—'}</code></td>
                <td>${s.viaGoogle ? 'Google' : 'Formulario'}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn" onclick="aprobarSolicitud('${id}')" title="Aprobar y crear acceso">
                            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        </button>
                        <button class="action-btn danger" onclick="rechazarSolicitud('${id}')" title="Rechazar">
                            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray-500);padding:2rem;">Error al cargar.</td></tr>'; }
}

let solicitudEnProceso = null;

async function aprobarSolicitud(id) {
    const snap = await firebase.database().ref(`solicitudes/${id}`).once('value');
    const s = snap.val();
    if (!s) return;
    solicitudEnProceso = id;

    document.getElementById('modal-crear-acceso-titulo').textContent = 'Aprobar solicitud y crear acceso';
    document.getElementById('usr-nombre').value = s.nombre || '';
    document.getElementById('usr-apellido').value = s.apellido || '';
    document.getElementById('usr-edad').value = s.edad || '';
    document.getElementById('usr-sexo').value = s.sexo || '';
    document.getElementById('usr-ciudad').value = s.ciudad || '';
    document.getElementById('usr-whatsapp').value = s.whatsapp || '';
    document.getElementById('usr-email').value = s.correo || '';
    document.getElementById('usr-password').value = '';
    document.getElementById('modal-usuario').classList.add('open');
}

async function rechazarSolicitud(id) {
    const ok = await elConfirm('¿Rechazar esta solicitud? La persona ya no aparecerá en la lista.');
    if (!ok) return;
    try {
        await firebase.database().ref(`solicitudes/${id}`).remove();
        elToast('Solicitud rechazada.', 'ok');
        cargarSolicitudes();
        actualizarBadgeSolicitudes();
    } catch (e) { elToast('No se pudo rechazar.', 'error'); }
}

// ─────────── USUARIOS ───────────
async function cargarUsuarios() {
    const tbody = document.getElementById('tabla-usuarios');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray-300);padding:2rem;">Cargando...</td></tr>';
    try {
        const filtroSexo = document.getElementById('filtro-sexo')?.value || '';
        const snap = await firebase.database().ref('usuarios').once('value');
        const data = snap.val() || {};
        let lista = Object.entries(data).filter(([, u]) => u.rol !== 'admin');
        if (filtroSexo) lista = lista.filter(([, u]) => u.sexo === filtroSexo);

        if (!lista.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray-300);padding:2rem;">Sin usuarios para este filtro.</td></tr>'; return; }

        tbody.innerHTML = lista.map(([uid, u]) => `
            <tr data-search="${(u.nombre + ' ' + u.apellido).toLowerCase()}">
                <td><strong>${u.nombre} ${u.apellido}</strong></td>
                <td style="color:var(--gray-500);font-size:0.82rem;">${u.email}</td>
                <td>${u.edad || '—'}</td>
                <td>${u.sexo || '—'}</td>
                <td>${u.ciudad || '—'}</td>
                <td><strong style="color:var(--tierra-2);">${u.puntos || 0}</strong> pts</td>
                <td>${renderEstadoCuenta(uid, u.cuentaActiva !== false)}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn" onclick="restablecerAcceso('${u.email}', '${u.nombre}')" title="Enviar enlace para restablecer contraseña">
                            <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08a5.99 5.99 0 0 1-5.65 4c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                        </button>
                        <button class="action-btn" onclick="reenviarPorWhatsappUsuario('${u.whatsapp || ''}', '${u.nombre}', '${u.email}')" title="Enviar datos de acceso por WhatsApp">
                            <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
                        </button>
                        <button class="action-btn danger" onclick="eliminarUsuario('${uid}', '${u.nombre}')" title="Eliminar">
                            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray-500);padding:2rem;">Error al cargar.</td></tr>'; }
}

// ─────────── RANKING ───────────
async function cargarRanking() {
    const lista = document.getElementById('ranking-lista');
    lista.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--gray-300);">Cargando ranking...</div>';
    try {
        const snap = await firebase.database().ref('usuarios').once('value');
        const data = snap.val() || {};
        let arr = Object.values(data).filter(u => u.rol !== 'admin').map(u => ({
            nombre: `${u.nombre} ${u.apellido}`, puntos: u.puntos || 0,
            triviasResueltas: Object.keys(u.codigosUsados || {}).length
        }));
        arr.sort((a, b) => b.puntos - a.puntos);
        arr = arr.slice(0, 10);
        if (!arr.length) { lista.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--gray-300);">Sin datos.</div>'; return; }
        lista.innerHTML = arr.map((e, i) => {
            const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            const initial = e.nombre.charAt(0).toUpperCase();
            return `
                <div class="ranking-row">
                    <div class="rank-pos ${posClass}">${i + 1}</div>
                    <div class="rank-avatar">${initial}</div>
                    <div class="rank-info">
                        <div class="rank-name">${e.nombre}</div>
                        <div class="rank-level">${e.triviasResueltas} trivia(s) resuelta(s)</div>
                    </div>
                    <div class="rank-points">${e.puntos} pts</div>
                </div>
            `;
        }).join('');
    } catch (e) { lista.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--gray-500);">Error al cargar ranking.</div>'; }
}

// ─────────── CONTENIDOS (TRIVIAS) ───────────
async function cargarContenidos() {
    const tbody = document.getElementById('tabla-contenidos');
    try {
        const snap = await firebase.database().ref('trivias').once('value');
        const data = snap.val();
        if (!data) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-300);padding:2rem;">Sin trivias creadas todavía.</td></tr>'; return; }
        tbody.innerHTML = Object.entries(data).map(([codigo, t]) => `
            <tr>
                <td><code>${codigo}</code></td>
                <td><strong>${t.titulo || '—'}</strong></td>
                <td style="color:var(--gray-500);">${t.autor || '—'}</td>
                <td>${(t.preguntas || []).length}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn danger" onclick="eliminarTrivia('${codigo}')" title="Eliminar">
                            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

async function cargarEstadisticasContenido() {
    try {
        const [triviasSnap, usuariosSnap] = await Promise.all([
            firebase.database().ref('trivias').once('value'),
            firebase.database().ref('usuarios').once('value')
        ]);
        const trivias = triviasSnap.val() || {};
        const usuarios = Object.values(usuariosSnap.val() || {}).filter(u => u.rol !== 'admin');

        document.getElementById('stat-trivias-total').textContent = Object.keys(trivias).length;

        const conteoPorCodigo = {};
        let intentosTotal = 0, sumaAciertosPct = 0;
        usuarios.forEach(u => {
            Object.entries(u.codigosUsados || {}).forEach(([codigo, r]) => {
                conteoPorCodigo[codigo] = (conteoPorCodigo[codigo] || 0) + 1;
                intentosTotal++;
                if (r.totalPreguntas) sumaAciertosPct += (r.aciertos || 0) / r.totalPreguntas;
            });
        });
        document.getElementById('stat-intentos-total').textContent = intentosTotal;
        document.getElementById('stat-aciertos-pct').textContent = intentosTotal > 0 ? `${Math.round((sumaAciertosPct / intentosTotal) * 100)}%` : '—';

        const top = Object.entries(conteoPorCodigo).sort((a, b) => b[1] - a[1])[0];
        document.getElementById('stat-libro-top').textContent = top ? (trivias[top[0]]?.titulo || top[0]) : '—';

        const entradasOrdenadas = Object.entries(conteoPorCodigo).sort((a, b) => b[1] - a[1]).slice(0, 7);
        renderChartProgreso(entradasOrdenadas.map(([c]) => trivias[c]?.titulo || c), entradasOrdenadas.map(([, n]) => n));

        renderChartEdad(usuarios);
        renderChartSexo(usuarios);
        renderChartCiudad(usuarios);
    } catch (e) { console.warn(e); }
}

let chartEdadInstance = null, chartSexoInstance = null, chartCiudadInstance = null;

function renderChartEdad(usuarios) {
    const canvas = document.getElementById('chart-edad');
    if (!canvas || typeof Chart === 'undefined') return;

    const rangos = [
        { label: '≤6',    min: 0,  max: 6 },
        { label: '7-9',   min: 7,  max: 9 },
        { label: '10-12', min: 10, max: 12 },
        { label: '13-15', min: 13, max: 15 },
        { label: '16+',   min: 16, max: 999 }
    ];
    const conteos = rangos.map(() => 0);
    usuarios.forEach(u => {
        const edad = parseInt(u.edad, 10);
        if (!edad) return;
        const i = rangos.findIndex(r => edad >= r.min && edad <= r.max);
        if (i >= 0) conteos[i]++;
    });

    if (chartEdadInstance) chartEdadInstance.destroy();
    chartEdadInstance = new Chart(canvas, {
        type: 'bar',
        data: { labels: rangos.map(r => r.label), datasets: [{ label: 'Usuarios', data: conteos, backgroundColor: '#6A9E99', borderRadius: 6 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

function renderChartSexo(usuarios) {
    const canvas = document.getElementById('chart-sexo');
    if (!canvas || typeof Chart === 'undefined') return;

    const conteo = { Femenino: 0, Masculino: 0, Otro: 0 };
    usuarios.forEach(u => { if (u.sexo && conteo[u.sexo] != null) conteo[u.sexo]++; });

    if (chartSexoInstance) chartSexoInstance.destroy();
    chartSexoInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: Object.keys(conteo),
            datasets: [{ data: Object.values(conteo), backgroundColor: ['#c48ba8', '#7a9abf', '#d49a7a'], borderWidth: 0 }]
        },
        options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }, cutout: '60%' }
    });
}

function renderChartCiudad(usuarios) {
    const canvas = document.getElementById('chart-ciudad');
    if (!canvas || typeof Chart === 'undefined') return;

    const conteo = {};
    usuarios.forEach(u => { if (u.ciudad) conteo[u.ciudad] = (conteo[u.ciudad] || 0) + 1; });
    const entradas = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (chartCiudadInstance) chartCiudadInstance.destroy();
    chartCiudadInstance = new Chart(canvas, {
        type: 'bar',
        data: { labels: entradas.map(([c]) => c), datasets: [{ label: 'Usuarios', data: entradas.map(([, n]) => n), backgroundColor: '#81aea8', borderRadius: 6 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

// ─────────── EXPORTAR USUARIOS A CSV ───────────
async function exportarUsuariosCSV() {
    try {
        const snap = await firebase.database().ref('usuarios').once('value');
        const data = snap.val() || {};
        const lista = Object.values(data).filter(u => u.rol !== 'admin');
        if (!lista.length) { elToast('No hay usuarios para exportar.', 'error'); return; }

        const encabezados = ['Nombre', 'Apellido', 'Correo', 'Edad', 'Sexo', 'Ciudad', 'Puntos', 'Estado'];
        const filas = lista.map(u => [
            u.nombre || '', u.apellido || '', u.email || '', u.edad || '', u.sexo || '',
            u.ciudad || '', u.puntos || 0, u.cuentaActiva !== false ? 'Activa' : 'Desactivada'
        ]);

        const csv = [encabezados, ...filas]
            .map(fila => fila.map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usuarios-entre-lineas-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        elToast('Archivo CSV descargado.', 'ok');
    } catch (e) { elToast('No se pudo exportar el archivo.', 'error'); }
}

// ─────────── MODALES ───────────
function abrirModalCrearAcceso() {
    solicitudEnProceso = null;
    document.getElementById('modal-crear-acceso-titulo').textContent = 'Nuevo Usuario';
    ['usr-nombre','usr-apellido','usr-edad','usr-ciudad','usr-whatsapp','usr-email','usr-password'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('usr-sexo').value = '';
    document.getElementById('modal-usuario').classList.add('open');
}
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); });

function generarPasswordAleatoria() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    document.getElementById('usr-password').value = pass;
}

// ─────────── CREAR ACCESO (correo + contraseña elegidos por el admin) ───────────
async function guardarUsuario() {
    const nombre = document.getElementById('usr-nombre').value.trim();
    const apellido = document.getElementById('usr-apellido').value.trim();
    const edad = document.getElementById('usr-edad').value.trim();
    const sexo = document.getElementById('usr-sexo').value;
    const ciudad = document.getElementById('usr-ciudad').value.trim();
    const whatsapp = document.getElementById('usr-whatsapp').value.trim();
    const email = document.getElementById('usr-email').value.trim().toLowerCase();
    const password = document.getElementById('usr-password').value;

    if (!nombre || !apellido || !email || !password) { elToast('Completa nombre, apellido, correo y contraseña.', 'error'); return; }
    if (password.length < 6) { elToast('La contraseña debe tener al menos 6 caracteres.', 'error'); return; }

    try {
        // Se crea con una instancia secundaria para no cerrar la sesión del admin.
        const secApp = obtenerAppSecundaria();
        const cred = await secApp.auth().createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;
        await secApp.auth().signOut();

        await firebase.database().ref(`usuarios/${uid}`).set({
            nombre, apellido, email, edad: edad || null, sexo: sexo || null,
            ciudad: ciudad || null, whatsapp: whatsapp || null,
            rol: 'usuario', cuentaActiva: true, creadoEn: Date.now(),
            puntos: 0, codigosUsados: {}
        });

        if (solicitudEnProceso) {
            await firebase.database().ref(`solicitudes/${solicitudEnProceso}`).remove();
            solicitudEnProceso = null;
        }

        cerrarModal('modal-usuario');
        mostrarCredenciales({ nombre, email, password, whatsapp });
        cargarUsuarios();
        cargarSolicitudes();
        actualizarBadgeSolicitudes();
    } catch (e) {
        const mensajes = {
            'auth/email-already-in-use': 'Ese correo ya tiene una cuenta creada.',
            'auth/invalid-email': 'Correo electrónico no válido.',
            'auth/weak-password': 'La contraseña es muy débil (mínimo 6 caracteres).'
        };
        elToast(mensajes[e.code] || e.message || 'Error al crear el acceso.', 'error');
    }
}

// ─────────── ESTADO DE CUENTA ───────────
function renderEstadoCuenta(uid, activa) {
    return `
        <label class="switch-cuenta" title="${activa ? 'Cuenta activa' : 'Cuenta desactivada'}">
            <input type="checkbox" ${activa ? 'checked' : ''} onchange="toggleCuenta('${uid}', this.checked, this)">
            <span class="switch-track"></span>
        </label>
    `;
}

async function toggleCuenta(uid, activa, checkboxEl) {
    try {
        await firebase.database().ref(`usuarios/${uid}/cuentaActiva`).set(activa);
        elToast(activa ? 'Cuenta activada.' : 'Cuenta desactivada.', 'ok');
    } catch (e) {
        if (checkboxEl) checkboxEl.checked = !activa;
        elToast('No se pudo cambiar el estado.', 'error');
    }
}

// ─────────── RESTABLECER ACCESO (enlace oficial de Firebase, sin backend) ───────────
async function restablecerAcceso(email, nombre) {
    const ok = await elConfirm(`Se enviará un enlace al correo de ${nombre} para que defina una nueva contraseña. ¿Continuar?`);
    if (!ok) return;
    try {
        await firebase.auth().sendPasswordResetEmail(email);
        elToast('Enlace de restablecimiento enviado a su correo.', 'ok');
    } catch (e) { elToast('No se pudo enviar el enlace.', 'error'); }
}

function reenviarPorWhatsappUsuario(whatsapp, nombre, email) {
    if (!whatsapp) { elToast('Este usuario no tiene un número de WhatsApp registrado.', 'error'); return; }
    const mensaje = `Hola ${nombre}, aquí tienes tu acceso a Entre Lineas:%0ACorreo: ${email}%0AIngresa desde la página de inicio de sesión.`;
    window.open(`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${mensaje}`, '_blank');
}

// ─────────── MODAL DE CREDENCIALES (única vez visible) ───────────
let ultimasCredenciales = null;

function mostrarCredenciales(resultado) {
    ultimasCredenciales = resultado;
    document.getElementById('cred-nombre').value = resultado.nombre || '';
    document.getElementById('cred-email').value = resultado.email || '';
    document.getElementById('cred-password').value = resultado.password || '';
    document.getElementById('modal-credenciales').classList.add('open');
}

function copiarCredenciales() {
    if (!ultimasCredenciales) return;
    const texto = `Correo: ${ultimasCredenciales.email}\nContraseña: ${ultimasCredenciales.password}`;
    navigator.clipboard.writeText(texto).then(() => elToast('Credenciales copiadas.', 'ok'));
}

function enviarPorWhatsapp() {
    if (!ultimasCredenciales) return;
    if (!ultimasCredenciales.whatsapp) {
        elToast('Este usuario no tiene un número de WhatsApp registrado. Cópialas y envíalas manualmente.', 'error');
        return;
    }
    const numeroLimpio = ultimasCredenciales.whatsapp.replace(/\D/g, '');
    const mensaje = `Hola ${ultimasCredenciales.nombre}, ya tienes acceso a Entre Lineas.%0ACorreo: ${ultimasCredenciales.email}%0AContrasena: ${ultimasCredenciales.password}%0AIngresa desde la pagina de inicio de sesion.`;
    window.open(`https://wa.me/${numeroLimpio}?text=${mensaje}`, '_blank');
}

// ─────────── ELIMINAR USUARIO ───────────
// Nota MVP: sin backend no se puede borrar la cuenta de Firebase Auth en sí
// (eso requiere Admin SDK). Se borra su perfil; si esa persona vuelve a
// intentar entrar, el sistema ya no reconoce ninguna cuenta suya.
async function eliminarUsuario(uid, nombre) {
    const ok = await elConfirm(`¿Eliminar la cuenta de ${nombre}? Esta acción es irreversible.`);
    if (!ok) return;
    try {
        await firebase.database().ref(`usuarios/${uid}`).remove();
        elToast(`${nombre} eliminado.`, 'ok');
        cargarUsuarios();
    } catch (e) { elToast('Error al eliminar.', 'error'); }
}

// ─────────── GESTIÓN DE TRIVIAS ───────────
let contadorPreguntas = 0;

function abrirModalTrivia() {
    document.getElementById('triv-codigo').value = '';
    document.getElementById('triv-titulo').value = '';
    document.getElementById('triv-autor').value = '';
    document.getElementById('triv-pdf').value = '';
    document.getElementById('lista-preguntas-trivia').innerHTML = '';
    contadorPreguntas = 0;
    agregarPreguntaTrivia();
    document.getElementById('modal-trivia').classList.add('open');
}

function agregarPreguntaTrivia() {
    contadorPreguntas++;
    const id = `p${contadorPreguntas}`;
    const div = document.createElement('div');
    div.className = 'pregunta-row';
    div.id = `pregunta-${id}`;
    div.innerHTML = `
        <button type="button" class="btn-quitar-pregunta" onclick="quitarPreguntaTrivia('${id}')" title="Quitar pregunta">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
        <div class="form-group">
            <label>Pregunta</label>
            <input type="text" class="input triv-pregunta-texto" placeholder="Escribe la pregunta...">
        </div>
        ${[0, 1, 2, 3].map(i => `
            <div class="opcion-row">
                <input type="radio" name="correcta-${id}" value="${i}" ${i === 0 ? 'checked' : ''}>
                <input type="text" class="input triv-opcion-texto" placeholder="Opción ${i + 1}">
            </div>
        `).join('')}
    `;
    document.getElementById('lista-preguntas-trivia').appendChild(div);
}

function quitarPreguntaTrivia(id) {
    const el = document.getElementById(`pregunta-${id}`);
    if (el) el.remove();
}

async function guardarTrivia() {
    const codigo = document.getElementById('triv-codigo').value.trim().toUpperCase();
    const titulo = document.getElementById('triv-titulo').value.trim();
    const autor = document.getElementById('triv-autor').value.trim();
    const pdfUrl = document.getElementById('triv-pdf').value.trim();

    if (!codigo || !titulo) { elToast('El código y el título son obligatorios.', 'error'); return; }

    const preguntas = [];
    document.querySelectorAll('#lista-preguntas-trivia .pregunta-row').forEach(row => {
        const pregunta = row.querySelector('.triv-pregunta-texto').value.trim();
        const opciones = [...row.querySelectorAll('.triv-opcion-texto')].map(i => i.value.trim());
        const marcada = row.querySelector('input[type="radio"]:checked');
        const respuestaCorrecta = marcada ? parseInt(marcada.value, 10) : 0;
        if (pregunta && opciones.every(o => o)) preguntas.push({ pregunta, opciones, respuestaCorrecta });
    });

    if (!preguntas.length) { elToast('Agrega al menos una pregunta completa (con sus 4 opciones).', 'error'); return; }

    try {
        await firebase.database().ref(`trivias/${codigo}`).set({ codigo, titulo, autor, pdfUrl, icono: 'libro', preguntas, actualizadoEn: Date.now() });
        cerrarModal('modal-trivia');
        elToast('Trivia guardada correctamente.', 'ok');
        cargarContenidos();
    } catch (e) { elToast('Error al guardar la trivia.', 'error'); }
}

async function eliminarTrivia(codigo) {
    const ok = await elConfirm(`¿Eliminar la trivia "${codigo}"? Esta acción es irreversible.`);
    if (!ok) return;
    try {
        await firebase.database().ref(`trivias/${codigo}`).remove();
        elToast('Trivia eliminada.', 'ok');
        cargarContenidos();
    } catch (e) { elToast('Error al eliminar.', 'error'); }
}

// ─────────── NOTIFICACIONES MASIVAS ───────────
async function cargarNotificaciones() {
    const tbody = document.getElementById('tabla-notificaciones');
    try {
        const snap = await firebase.database().ref('notificaciones').orderByChild('fecha').limitToLast(30).once('value');
        const data = snap.val();
        if (!data) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--gray-300);padding:2rem;">Sin notificaciones enviadas.</td></tr>'; return; }
        tbody.innerHTML = Object.values(data).reverse().map(n => `
            <tr>
                <td><strong>${n.titulo}</strong></td>
                <td style="color:var(--gray-500);font-size:0.85rem;">${n.mensaje}</td>
                <td style="color:var(--gray-500);font-size:0.8rem;">${formatFecha(n.fecha)}</td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--gray-500);padding:2rem;">Error al cargar.</td></tr>'; }
}

async function enviarNotificacion() {
    const titulo = document.getElementById('notif-titulo').value.trim();
    const mensaje = document.getElementById('notif-mensaje').value.trim();
    if (!titulo || !mensaje) { elToast('Completa el título y el mensaje.', 'error'); return; }

    const ok = await elConfirm('Este mensaje se enviará a todos los usuarios registrados. ¿Confirmas?');
    if (!ok) return;

    try {
        await firebase.database().ref('notificaciones').push({ titulo, mensaje, fecha: Date.now() });
        document.getElementById('notif-titulo').value = '';
        document.getElementById('notif-mensaje').value = '';
        elToast('Notificación enviada a todos los usuarios.', 'ok');
        cargarNotificaciones();
    } catch (e) { elToast('No se pudo enviar la notificación.', 'error'); }
}

// ─────────── UTILIDADES ───────────
function filtrarTabla(tbodyId, query) {
    const q = query.toLowerCase();
    document.querySelectorAll(`#${tbodyId} tr`).forEach(row => {
        const text = row.dataset.search || row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

function formatFecha(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

if (window.innerWidth <= 900) {
    const h = document.getElementById('hamburger');
    if (h) h.style.display = 'flex';
}
