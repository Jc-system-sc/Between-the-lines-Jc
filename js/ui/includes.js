// ==========================================================================
// ENTRE LÍNEAS — js/ui/includes.js
// Carga fragmentos HTML (navbar, secciones, footer) dentro de contenedores
// marcados con data-include="ruta/al/archivo.html". Esto evita tener toda
// la landing en un solo archivo index.html gigante.
//
// IMPORTANTE: como usa fetch(), la página debe abrirse a través de un
// servidor local (Live Server, `npx serve`, etc.), no con doble clic
// (protocolo file://). Ver docs/GUIA_DESPLIEGUE.md.
// ==========================================================================

async function elLoadIncludes() {
    const nodos = document.querySelectorAll('[data-include]');
    await Promise.all([...nodos].map(async (nodo) => {
        const ruta = nodo.getAttribute('data-include');
        try {
            const res = await fetch(ruta);
            if (!res.ok) throw new Error(`No se pudo cargar ${ruta}`);
            nodo.innerHTML = await res.text();
        } catch (e) {
            nodo.innerHTML = `<p style="padding:2rem;color:#a33;">No se pudo cargar "${ruta}". Asegúrate de abrir esta página con un servidor local (no con doble clic).</p>`;
            console.error(e);
        }
    }));
}
