// ==========================================================================
// ENTRE LÍNEAS — js/ui/loader.js
// Controla la pantalla de carga (el HTML del loader va directo en cada
// página para que aparezca de inmediato, antes de que cargue cualquier
// otro script). Este archivo solo la retira con una transición suave.
// ==========================================================================

function elOcultarLoader() {
    const loader = document.getElementById('el-loader');
    if (!loader) return;
    loader.classList.add('el-loader-out');
    setTimeout(() => loader.remove(), 550);
}

// Salvavidas: si algo tarda demasiado o falla silenciosamente, no dejar
// a la persona mirando la pantalla de carga para siempre.
setTimeout(elOcultarLoader, 6000);
