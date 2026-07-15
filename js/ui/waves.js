// ==========================================================================
// ENTRE LÍNEAS — js/ui/waves.js
// Fondo decorativo de "olas en capas" con profundidad real: cada capa tiene
// un resplandor (glow) detrás que se enciende al asentarse, más sombra de
// contacto para separar visualmente una capa de la siguiente. Curvas
// asimétricas, movimiento propio muy sutil, y animación de entrada en
// cascada (capa por capa, con iluminación progresiva).
// El fondo de la página en sí permanece estático; solo las olas se mecen.
// Los colores usan las variables --wave-1..6 (ver css/variables.css), así que
// se adaptan solos al modo claro/oscuro.
// ==========================================================================

const EL_WAVE_LAYERS = [
    { fill: 'var(--wave-2)', glow: 'var(--wave-3)', d: 'M-80,120 C120,40 320,190 560,110 C820,20 1040,170 1300,90 C1400,60 1460,90 1520,100 L1520,640 L-80,640 Z' },
    { fill: 'var(--wave-3)', glow: 'var(--wave-4)', d: 'M-80,230 C160,300 380,160 620,225 C860,290 1080,150 1320,215 C1400,238 1460,225 1520,235 L1520,640 L-80,640 Z' },
    { fill: 'var(--wave-4)', glow: 'var(--wave-5)', d: 'M-80,340 C140,270 400,400 660,335 C900,275 1120,380 1360,325 C1420,312 1470,320 1520,330 L1520,640 L-80,640 Z' },
    { fill: 'var(--wave-5)', glow: 'var(--wave-6)', d: 'M-80,440 C200,500 420,395 680,435 C920,472 1140,405 1380,440 C1430,447 1470,440 1520,445 L1520,640 L-80,640 Z' },
    { fill: 'var(--wave-6)', glow: null,            d: 'M-80,530 C220,570 460,500 700,525 C940,550 1160,505 1400,528 C1440,532 1470,528 1520,530 L1520,640 L-80,640 Z' }
];

function elWavesSVG(altura = '58%') {
    const capas = EL_WAVE_LAYERS.map((capa, i) => `
        ${capa.glow ? `<path class="el-wave-glow el-wave-glow-${i + 1}" fill="${capa.glow}" opacity="0.55" d="${capa.d}"/>` : ''}
        <path class="el-wave-layer el-wave-l${i + 1}" filter="url(#el-wave-shadow)" fill="${capa.fill}" d="${capa.d}"/>
    `).join('');

    return `
    <svg class="el-waves" viewBox="0 0 1440 620" preserveAspectRatio="none"
         style="width:100%;height:${altura};position:absolute;left:0;bottom:0;display:block;overflow:visible;"
         xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="el-wave-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000" flood-opacity="0.22"/>
            </filter>
            <filter id="el-wave-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="18"/>
            </filter>
        </defs>
        <rect x="0" y="0" width="1440" height="500" fill="var(--wave-1)"/>
        <g filter="url(#el-wave-glow-blur)">${capas}</g>
    </svg>
    <style>
        @keyframes el-wave-drift-1 { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-14px); } }
        @keyframes el-wave-drift-2 { 0%,100% { transform: translateX(0); } 50% { transform: translateX(12px); } }
        @keyframes el-wave-drift-3 { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-10px); } }
        @keyframes el-wave-drift-4 { 0%,100% { transform: translateX(0); } 50% { transform: translateX(9px); } }
        @keyframes el-wave-glow-pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        .el-wave-l1 { animation: el-wave-drift-1 13s ease-in-out infinite; }
        .el-wave-l2 { animation: el-wave-drift-2 17s ease-in-out infinite; }
        .el-wave-l3 { animation: el-wave-drift-3 21s ease-in-out infinite; }
        .el-wave-l4 { animation: el-wave-drift-4 15s ease-in-out infinite; }
        .el-wave-glow { animation: el-wave-glow-pulse 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
            .el-wave-layer, .el-wave-glow { animation: none !important; }
        }
    </style>`;
}

/**
 * Inserta el fondo de olas dentro de un contenedor (debe tener position:relative
 * y overflow:hidden). El SVG se inserta como primer hijo, anclado abajo.
 * animarEntrada: si es true, las capas "caen" desde arriba una por una,
 * encendiendo su resplandor al asentarse.
 */
function elInsertWaves(containerId, altura = '58%', animarEntrada = false) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const wrap = document.createElement('div');
    wrap.className = 'el-waves-wrap';
    wrap.innerHTML = elWavesSVG(altura);
    cont.insertBefore(wrap, cont.firstChild);

    if (animarEntrada) {
        const capas = wrap.querySelectorAll('.el-wave-layer');
        const glows = wrap.querySelectorAll('.el-wave-glow');

        capas.forEach((capa, i) => {
            capa.style.animationPlayState = 'paused';
            capa.style.transform = 'translateY(-160%)';
            capa.style.opacity = '0';
            capa.style.transition = 'transform .65s cubic-bezier(.22,1,.36,1), opacity .35s ease';
            setTimeout(() => {
                capa.style.transform = '';
                capa.style.opacity = '1';
                setTimeout(() => {
                    capa.style.transition = '';
                    capa.style.animationPlayState = 'running';
                }, 660);
            }, 130 * i + 80);
        });

        glows.forEach((glow, i) => {
            glow.style.animationPlayState = 'paused';
            glow.style.opacity = '0';
            glow.style.transition = 'opacity .5s ease';
            setTimeout(() => {
                glow.style.opacity = '0.55';
                setTimeout(() => { glow.style.animationPlayState = 'running'; }, 500);
            }, 130 * i + 260);
        });
    }
}
