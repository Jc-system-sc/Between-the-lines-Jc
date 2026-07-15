// ==========================================================================
// ENTRE LÍNEAS v2 — js/dashboard/usuario.js
// Lógica de la experiencia del usuario: desbloquear código, leer, resolver
// trivia y ver el ranking. Las trivias ya no vienen en archivos fijos:
// se leen desde Firebase, porque ahora solo el admin las crea.
// ==========================================================================

// ─────────── ESTADO GLOBAL ───────────
let usuarioActual   = null; // { uid, nombre, apellido, email, puntos, codigosUsados }
let triviaActual    = null;
let indicePregunta  = 0;
let puntajeRonda    = 0;
let timerPregunta   = null;
const SEGUNDOS_POR_PREGUNTA = 20;

let timerLectura       = null;
let segundosRestantes  = 0;
let lecturaListaTiempo = false;

// ─────────── AUTH GUARD ───────────
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = '../login/login.html'; return; }

    const snap = await firebase.database().ref(`usuarios/${user.uid}`).once('value');
    const perfil = snap.val();
    if (!perfil) { window.location.href = '../login/login.html'; return; }
    if (perfil.rol === 'admin') { window.location.href = '../admin/admin.html'; return; }
    if (perfil.cuentaActiva === false) {
        elToast('Tu cuenta está desactivada. Contacta al administrador.', 'error');
        firebase.auth().signOut();
        return;
    }

    usuarioActual = {
        uid: user.uid,
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        email: perfil.email,
        puntos: perfil.puntos || 0,
        codigosUsados: perfil.codigosUsados || {}
    };

    document.getElementById('usuario-nombre-topbar').textContent = `${perfil.nombre} ${perfil.apellido}`;
    document.getElementById('logged-student-name-banner').textContent = perfil.nombre;
    document.querySelectorAll('.el-theme-toggle-icon').forEach(el => el.innerHTML = elThemeIconInicial());
    elInsertWaves('usuario-waves-container', '70%', true);

    ocultarSplash();

    irA('unlock-box');
    enlinHablar(`Bienvenido/a ${perfil.nombre}. Ingresa el código del libro.`);
    enlinOjos('feliz');

    renderRanking();
    cargarNotificaciones();
    setTimeout(elOcultarLoader, 400);
});

// ─────────── SIDEBAR MÓVIL ───────────
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ─────────── NAVEGACIÓN DEL SIDEBAR ───────────
function irASeccionUsuario(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const btn = [...document.querySelectorAll('.nav-item')].find(b => b.getAttribute('onclick')?.includes(`'${id}'`));
    if (btn) btn.classList.add('active');
}

// ─────────── NOTIFICACIONES DEL ADMIN ───────────
async function cargarNotificaciones() {
    try {
        const snap = await firebase.database().ref('notificaciones').orderByChild('fecha').limitToLast(20).once('value');
        const data = snap.val();
        const panel = document.getElementById('notif-panel');
        const badge = document.getElementById('notif-badge');
        if (!data) { panel.innerHTML = '<div class="notif-item"><p class="notif-item-msg">No hay notificaciones todavía.</p></div>'; return; }

        const items = Object.values(data).reverse();
        panel.innerHTML = items.map(n => `
            <div class="notif-item">
                <div class="notif-item-titulo">${n.titulo}</div>
                <div class="notif-item-msg">${n.mensaje}</div>
                <div class="notif-item-fecha">${new Date(n.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
        `).join('');

        const ultimaVista = parseInt(localStorage.getItem('el-notif-vistas') || '0');
        const nuevas = items.filter(n => n.fecha > ultimaVista).length;
        if (nuevas > 0) { badge.textContent = nuevas; badge.classList.add('show'); }
    } catch (e) { console.warn('Error al cargar notificaciones:', e); }
}

function toggleNotificaciones() {
    const panel = document.getElementById('notif-panel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
        localStorage.setItem('el-notif-vistas', Date.now().toString());
        document.getElementById('notif-badge').classList.remove('show');
    }
}

document.addEventListener('click', (e) => {
    const panel = document.getElementById('notif-panel');
    const btn = document.getElementById('notif-bell-btn');
    if (panel && panel.classList.contains('open') && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('open');
    }
});

// ─────────── SPLASH ───────────
function ocultarSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.classList.add('oculto');
        setTimeout(() => splash.remove(), 600);
    }
}

// ─────────── DESBLOQUEAR LIBRO ───────────
async function unlockBook() {
    const codigo  = document.getElementById('book-code').value.trim().toUpperCase();
    const errorEl = document.getElementById('unlock-error');

    if (!codigo) { errorEl.textContent = 'Ingresa un código.'; return; }

    if (usuarioActual.codigosUsados && usuarioActual.codigosUsados[codigo]) {
        errorEl.textContent = 'Ya completaste esta trivia.';
        enlinOjos('confundido');
        enlinHablar('Ya resolviste este libro. Busca otro código.');
        return;
    }

    errorEl.textContent = 'Buscando...';
    try {
        const snap = await firebase.database().ref(`trivias/${codigo}`).once('value');
        const trivia = snap.val();
        if (!trivia) {
            errorEl.textContent = 'Código no registrado.';
            enlinOjos('confundido');
            enlinHablar('Ese código no existe. Revisa las letras.');
            return;
        }

        errorEl.textContent = '';
        triviaActual = { ...trivia, codigo };
        indicePregunta = 0;
        puntajeRonda = 0;
        abrirModalLector(triviaActual);
    } catch (e) {
        errorEl.textContent = 'No se pudo verificar el código. Intenta de nuevo.';
    }
}

// ─────────── MODAL LECTOR PDF ───────────
function abrirModalLector(trivia) {
    const modal    = document.getElementById('modal-lector');
    const iframe   = document.getElementById('pdf-iframe');
    const tituloEl = document.getElementById('lector-titulo');
    const autorEl  = document.getElementById('lector-autor');

    tituloEl.textContent = trivia.titulo || '';
    autorEl.textContent  = trivia.autor ? `— ${trivia.autor}` : '';
    iframe.src = trivia.pdfUrl || '';

    lecturaListaTiempo = false;
    actualizarBotonEmpezar();

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const minutos = trivia.tiempoLectura || 8;
    segundosRestantes = minutos * 60;
    const frases = [
        `Has desbloqueado: ${trivia.titulo}.`,
        `Tómate ${minutos} minutos para leer con calma.`,
        'Cuando termines, presiona Empezar Trivia.'
    ];
    iniciarTyping(frases, () => {
        iniciarContadorLectura();
        iniciarProgresoSimulado();
    });

    enlinHablar('Código verificado. Lee con atención y presiona Empezar cuando termines.');
    enlinOjos('feliz');
}

// ─────────── TYPING EFFECT ───────────
function iniciarTyping(frases, callback) {
    const el = document.getElementById('lector-typing');
    if (!el) return;
    el.textContent = '';
    let fraseIdx = 0, charIdx = 0, textoActual = '';

    function escribir() {
        if (fraseIdx >= frases.length) { if (callback) callback(); return; }
        const frase = frases[fraseIdx];
        if (charIdx < frase.length) {
            textoActual += frase[charIdx];
            el.textContent = textoActual;
            charIdx++;
            setTimeout(escribir, 38);
        } else {
            textoActual += '  ';
            fraseIdx++;
            charIdx = 0;
            setTimeout(escribir, 600);
        }
    }
    escribir();
}

// ─────────── CONTADOR DE TIEMPO MÍNIMO DE LECTURA ───────────
function iniciarContadorLectura() {
    clearInterval(timerLectura);
    actualizarDisplayTiempo();
    timerLectura = setInterval(() => {
        segundosRestantes--;
        actualizarDisplayTiempo();
        if (segundosRestantes <= 0) {
            clearInterval(timerLectura);
            lecturaListaTiempo = true;
            marcarTiempoListo();
            actualizarBotonEmpezar();
        }
    }, 1000);
}

function actualizarDisplayTiempo() {
    const min = Math.floor(segundosRestantes / 60);
    const seg = segundosRestantes % 60;
    const display = `${min}:${seg.toString().padStart(2, '0')}`;
    const textoEl = document.getElementById('tiempo-texto');
    const countdownEl = document.getElementById('countdown-display');
    if (textoEl) textoEl.textContent = segundosRestantes > 0 ? `Tiempo mínimo: ${display}` : 'Tiempo completado';
    if (countdownEl) countdownEl.textContent = segundosRestantes > 0 ? display : 'listo';
}

function marcarTiempoListo() {
    document.getElementById('tiempo-badge')?.classList.add('listo');
    const textoEl = document.getElementById('tiempo-texto');
    if (textoEl) textoEl.textContent = 'Tiempo completado';
    enlinHablar('Tiempo de lectura cumplido. Puedes empezar la trivia cuando quieras.');
}

function iniciarProgresoSimulado() {
    const totalSeg = (triviaActual?.tiempoLectura || 8) * 60;
    let elapsed = 0;
    const inter = setInterval(() => {
        elapsed++;
        if (elapsed >= totalSeg || lecturaListaTiempo) { clearInterval(inter); setScrollProgress(100); return; }
        setScrollProgress(Math.min(99, Math.round((elapsed / totalSeg) * 100)));
    }, 1000);
}

function setScrollProgress(pct) {
    const fillH = document.getElementById('scroll-progress-fill');
    const label = document.getElementById('scroll-progress-label');
    if (fillH) fillH.style.width = `${pct}%`;
    if (label) label.textContent = pct >= 100 ? 'Tiempo de lectura completado' : `Progreso de lectura obligatorio: ${pct}%`;
}

function actualizarBotonEmpezar() {
    const btn = document.getElementById('btn-empezar');
    if (!btn) return;
    if (lecturaListaTiempo) {
        btn.disabled = false;
        const btnText = document.getElementById('btn-empezar-texto');
        if (btnText) btnText.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;vertical-align:middle;margin-right:8px;"><path d="M8 5v14l11-7z"/></svg> Empezar Trivia`;
    } else {
        btn.disabled = true;
    }
}

// ─────────── CONFIRMACIÓN ───────────
function pedirConfirmacion() { document.getElementById('modal-confirmar').classList.remove('hidden'); }
function volverALeer() { document.getElementById('modal-confirmar').classList.add('hidden'); }

function confirmarInicioTrivia() {
    document.getElementById('modal-confirmar').classList.add('hidden');
    const modalLector = document.getElementById('modal-lector');
    modalLector.style.transition = 'opacity .3s ease';
    modalLector.style.opacity = '0';
    setTimeout(() => {
        modalLector.classList.add('hidden');
        modalLector.style.opacity = '';
        document.getElementById('pdf-iframe').src = '';
    }, 300);

    document.body.style.overflow = '';
    clearInterval(timerLectura);

    document.getElementById('quiz-titulo').textContent = triviaActual.titulo;
    document.getElementById('quiz-autor').textContent = triviaActual.autor ? `— ${triviaActual.autor}` : '';

    irA('quiz-box');
    enlinOjos('feliz');
    enlinHablar('Ahora sí. Responde con calma, tienes 20 segundos por pregunta.');
    mostrarPregunta();
}

// ─────────── QUIZ ───────────
function mostrarPregunta() {
    const total = triviaActual.preguntas.length;
    const pregData = triviaActual.preguntas[indicePregunta];

    document.getElementById('quiz-question').textContent = pregData.pregunta;
    document.getElementById('quiz-numero').textContent = `Pregunta ${indicePregunta + 1} de ${total}`;

    const cont = document.getElementById('quiz-options');
    cont.innerHTML = '';
    pregData.opciones.forEach((opcion, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opcion;
        btn.onclick = () => seleccionarRespuesta(i);
        cont.appendChild(btn);
    });

    document.getElementById('progress').style.width = `${((indicePregunta + 1) / total) * 100}%`;
    iniciarTimer();
}

function iniciarTimer() {
    clearInterval(timerPregunta);
    let restante = SEGUNDOS_POR_PREGUNTA;
    const timerEl = document.getElementById('quiz-timer');
    if (!timerEl) return;
    timerEl.textContent = restante;
    timerEl.classList.remove('urgente');

    timerPregunta = setInterval(() => {
        restante--;
        timerEl.textContent = restante;
        if (restante <= 5) timerEl.classList.add('urgente');
        if (restante <= 0) { clearInterval(timerPregunta); seleccionarRespuesta(-1); }
    }, 1000);
}

function seleccionarRespuesta(indexElegido) {
    clearInterval(timerPregunta);
    const pregData = triviaActual.preguntas[indicePregunta];
    const correcta = pregData.respuestaCorrecta;
    const botones = document.querySelectorAll('.option-btn');

    botones.forEach((btn, i) => {
        btn.disabled = true;
        if (i === correcta) btn.classList.add('correcta');
        if (i === indexElegido && i !== correcta) btn.classList.add('incorrecta');
    });

    if (indexElegido === correcta) {
        puntajeRonda += 100;
        enlinHablar('Correcto. Excelente.');
        enlinOjos('feliz');
    } else {
        enlinHablar('Esa no era. Sigue adelante.');
        enlinOjos('confundido');
    }

    setTimeout(() => {
        indicePregunta++;
        if (indicePregunta < triviaActual.preguntas.length) {
            mostrarPregunta();
        } else {
            mostrarResultados();
        }
    }, 1200);
}

// ─────────── GUARDAR RESULTADO EN FIREBASE ───────────
async function guardarEnFirebase(aciertos, totalPreguntas) {
    const nuevosPuntos = (usuarioActual.puntos || 0) + puntajeRonda;
    const ahora = Date.now();

    try {
        await firebase.database().ref(`usuarios/${usuarioActual.uid}`).update({
            puntos: nuevosPuntos,
            [`codigosUsados/${triviaActual.codigo}`]: {
                puntos: puntajeRonda, aciertos, totalPreguntas, fecha: ahora
            }
        });
        usuarioActual.puntos = nuevosPuntos;
        usuarioActual.codigosUsados[triviaActual.codigo] = { puntos: puntajeRonda, aciertos, totalPreguntas, fecha: ahora };

        // Registro para el panel de administración (actividad reciente / gráficos)
        await firebase.database().ref('actividad').push({
            usuario: `${usuarioActual.nombre} ${usuarioActual.apellido}`,
            trivia: triviaActual.titulo,
            aciertos, totalPreguntas,
            puntos: puntajeRonda,
            fecha: ahora
        });
    } catch (e) { console.error('Error al guardar en Firebase:', e); }
}

// ─────────── MOSTRAR RESULTADOS ───────────
async function mostrarResultados() {
    const total = triviaActual.preguntas.length;
    const maxPts = total * 100;
    const aciertos = Math.round(puntajeRonda / 100);
    const porciento = Math.round((puntajeRonda / maxPts) * 100);

    await guardarEnFirebase(aciertos, total);

    document.getElementById('result-score-num').textContent = puntajeRonda;
    document.getElementById('result-score-max').textContent = maxPts;
    document.getElementById('result-porcentaje').textContent = `${porciento}%`;
    document.getElementById('result-libro').textContent = triviaActual.titulo;

    const medallaEl = document.getElementById('result-medalla');
    let mensaje = '';
    if (porciento === 100) {
        medallaEl.innerHTML = svgMedallaResultado('oro');
        mensaje = 'Perfecto. Eres un lector extraordinario.';
        enlinOjos('feliz');
    } else if (porciento >= 60) {
        medallaEl.innerHTML = svgMedallaResultado('plata');
        mensaje = 'Muy bien. Tus puntos fueron guardados.';
        enlinOjos('feliz');
    } else {
        medallaEl.innerHTML = svgMedallaResultado('libro');
        mensaje = 'Sigue leyendo. La próxima te irá mejor.';
        enlinOjos('confundido');
    }
    document.getElementById('result-mensaje').textContent = mensaje;

    irA('result-box');
    enlinHablar(mensaje);
    renderRanking();
}

function svgMedallaResultado(tipo) {
    if (tipo === 'oro') return `<svg viewBox="0 0 64 64" style="width:72px;height:72px"><circle cx="32" cy="32" r="28" fill="#F0D060" opacity=".18"/><path fill="#C9A84C" d="M32 8l5.5 11.2 12.4 1.8-9 8.7 2.1 12.3L32 36.2l-11 5.8 2.1-12.3-9-8.7 12.4-1.8z"/></svg>`;
    if (tipo === 'plata') return `<svg viewBox="0 0 64 64" style="width:72px;height:72px"><circle cx="32" cy="32" r="28" fill="#C0C0C0" opacity=".18"/><path fill="#A0A0A0" d="M32 8l5.5 11.2 12.4 1.8-9 8.7 2.1 12.3L32 36.2l-11 5.8 2.1-12.3-9-8.7 12.4-1.8z"/></svg>`;
    return `<svg viewBox="0 0 24 24" style="width:56px;height:56px;fill:#9E7E70;"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 15H8v-2h9v2zm0-4H8v-2h9v2zm0-4H8V7h9v2z"/></svg>`;
}

// ─────────── VOLVER A DESBLOQUEAR ───────────
// ─────────── DESCARGAR CONSTANCIA (PDF) ───────────
function descargarConstancia() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });

        const titulo = document.getElementById('result-libro').textContent;
        const puntos = document.getElementById('result-score-num').textContent;
        const porcentaje = document.getElementById('result-porcentaje').textContent;
        const nombreCompleto = `${usuarioActual.nombre} ${usuarioActual.apellido}`;
        const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

        // Fondo
        doc.setFillColor(51, 84, 79);
        doc.rect(0, 0, 210, 148, 'F');
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(8, 8, 194, 132, 3, 3, 'F');

        // Encabezado
        doc.setTextColor(106, 158, 153);
        doc.setFont('times', 'italic');
        doc.setFontSize(22);
        doc.text('Entre Líneas', 105, 28, { align: 'center' });

        doc.setTextColor(90, 90, 90);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('CONSTANCIA DE LECTURA Y COMPRENSIÓN', 105, 38, { align: 'center' });

        // Cuerpo
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(12);
        doc.text('Se certifica que', 105, 58, { align: 'center' });

        doc.setFont('times', 'bold');
        doc.setFontSize(20);
        doc.text(nombreCompleto, 105, 70, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text(`completó satisfactoriamente la trivia de lectura de:`, 105, 82, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(`"${titulo}"`, 105, 92, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(`Obteniendo ${puntos} puntos (${porcentaje} de aciertos)`, 105, 102, { align: 'center' });

        doc.setFontSize(9);
        doc.setTextColor(130, 130, 130);
        doc.text(`Emitido el ${fecha}`, 105, 128, { align: 'center' });

        doc.save(`constancia-${titulo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        elToast('Constancia descargada.', 'ok');
    } catch (e) {
        elToast('No se pudo generar la constancia.', 'error');
    }
}

function volverAUnlock() {
    document.getElementById('book-code').value = '';
    document.getElementById('unlock-error').textContent = '';
    triviaActual = null;
    irA('unlock-box');
}

// ─────────── CERRAR SESIÓN ───────────
function cerrarSesion() {
    firebase.auth().signOut().then(() => { window.location.href = '../login/login.html'; });
}

// ─────────── RANKING (sin emojis: SVG + posición numérica) ───────────
async function renderRanking() {
    const lista = document.getElementById('leaderboard');
    if (!lista) return;
    try {
        const snap = await firebase.database().ref('usuarios').once('value');
        const data = snap.val() || {};
        const arr = Object.values(data)
            .filter(u => u.rol !== 'admin')
            .map(u => ({ nombre: `${u.nombre} ${u.apellido}`, puntos: u.puntos || 0 }))
            .sort((a, b) => b.puntos - a.puntos)
            .slice(0, 5);

        const svgMedalla = (i) => {
            const colors = ['#C9A84C', '#A0A0A0', '#B07B5A'];
            if (i < 3) return `<svg class="rank-svg" viewBox="0 0 24 24" style="width:18px;height:18px;fill:${colors[i]}"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A6.01 6.01 0 0 0 11 14.93V17H9v2h6v-2h-2v-2.07a6.01 6.01 0 0 0 3.61-2.99C19.08 11.63 21 9.55 21 7V6c0-1.1-.9-2-2-2zm-12 4c-1.1 0-2-.9-2-2V7h2v2zm10 0V7h2v1c0 1.1-.9 2-2 2z"/></svg>`;
            return `<span style="font-family:var(--font-mono);font-size:.72rem;color:rgba(94,72,64,.35)">${i + 1}</span>`;
        };

        lista.innerHTML = '';
        arr.forEach((e, i) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="rank-pos">${svgMedalla(i)}</span><span class="rank-nombre">${e.nombre}</span><span class="rank-pts">${e.puntos} pts</span>`;
            lista.appendChild(li);
        });
    } catch (e) { console.warn('Error al cargar ranking:', e); }
}

// ─────────── NAVEGACIÓN ENTRE SECCIONES ───────────
const SECCIONES = ['unlock-box', 'quiz-box', 'result-box'];
function irA(idSeccion) {
    SECCIONES.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== idSeccion);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────── ENLIN (mascota) ───────────
const FRASES_ENLIN = [
    'Leer es el superpoder más accesible del mundo.',
    'Cada código es la puerta a un mundo nuevo.',
    'Tus puntos se guardan automáticamente.',
    'Solo puedes resolver cada código una vez. Vale la pena prepararse.',
    'La lectura fortalece tu imaginación y tu memoria.'
];
let enlinTimeout = null;

function enlinHablar(texto) {
    const burbuja = document.getElementById('enlin-bubble');
    if (!burbuja) return;
    burbuja.textContent = texto;
    burbuja.classList.remove('hidden');
    clearTimeout(enlinTimeout);
    enlinTimeout = setTimeout(() => burbuja.classList.add('hidden'), 6000);
}

function enlinOjos(estado) {
    const ojos = document.getElementById('enlin-eyes');
    if (ojos) ojos.className = `eyes-${estado}`;
}

function enlinClickAleatorio() {
    enlinHablar(FRASES_ENLIN[Math.floor(Math.random() * FRASES_ENLIN.length)]);
}

function hacerEnlinArrastrable() {
    const widget = document.getElementById('enlin-widget');
    const clickArea = document.getElementById('enlin-clickarea');
    if (!widget || !clickArea) return;
    let arrastrando = false, movio = false;
    let sx = 0, sy = 0, ox = 0, oy = 0;

    const getXY = e => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    const start = e => { movio = false; arrastrando = true; const { x, y } = getXY(e); sx = x - ox; sy = y - oy; };
    const move = e => { if (!arrastrando) return; movio = true; e.preventDefault(); const { x, y } = getXY(e); ox = x - sx; oy = y - sy; widget.style.transform = `translate3d(${ox}px,${oy}px,0)`; };
    const end = () => { arrastrando = false; if (!movio) enlinClickAleatorio(); };

    clickArea.addEventListener('mousedown', start, { passive: true });
    document.addEventListener('mousemove', move, { passive: false });
    document.addEventListener('mouseup', end, { passive: true });
    clickArea.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: true });
}

// ─────────── INICIO ───────────
window.addEventListener('DOMContentLoaded', () => {
    hacerEnlinArrastrable();
});
