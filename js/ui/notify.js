// ==========================================================================
// ENTRE LÍNEAS — js/ui/notify.js
// Reemplaza alert()/confirm() nativos por avisos propios, integrados al
// diseño de la plataforma. Incluir este script en cualquier página que
// necesite mostrar avisos o pedir confirmación.
// ==========================================================================

(function () {
    if (document.getElementById('el-toast-root')) return;

    const root = document.createElement('div');
    root.id = 'el-toast-root';
    root.innerHTML = `
        <div id="el-toast-stack" class="el-toast-stack"></div>
        <div id="el-confirm-overlay" class="el-confirm-overlay">
            <div class="el-confirm-card">
                <p id="el-confirm-msg" class="el-confirm-msg"></p>
                <div class="el-confirm-actions">
                    <button id="el-confirm-cancel" class="el-confirm-btn el-confirm-btn-ghost">Cancelar</button>
                    <button id="el-confirm-ok" class="el-confirm-btn el-confirm-btn-danger">Confirmar</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    const style = document.createElement('style');
    style.textContent = `
        .el-toast-stack {
            position: fixed; top: 1.25rem; right: 1.25rem; z-index: 9999;
            display: flex; flex-direction: column; gap: 0.6rem; pointer-events: none;
        }
        .el-toast {
            min-width: 260px; max-width: 360px; padding: 0.85rem 1.1rem;
            border-radius: 10px; font-family: var(--font-sans, sans-serif); font-size: 0.85rem;
            box-shadow: 0 6px 24px rgba(0,0,0,0.18);
            display: flex; align-items: flex-start; gap: 0.6rem;
            background: var(--el-toast-bg, #2b2b2b); color: var(--el-toast-fg, #fff);
            opacity: 0; transform: translateY(-8px); transition: opacity .25s ease, transform .25s ease;
            pointer-events: all;
        }
        .el-toast.show { opacity: 1; transform: translateY(0); }
        .el-toast.ok    { background: #2f6f5e; }
        .el-toast.error { background: #8a3a3a; }
        .el-toast svg { width: 18px; height: 18px; flex-shrink: 0; fill: currentColor; margin-top: 1px; }

        .el-confirm-overlay {
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(20,20,20,0.45); backdrop-filter: blur(2px);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: opacity .2s ease;
        }
        .el-confirm-overlay.open { opacity: 1; pointer-events: all; }
        .el-confirm-card {
            background: var(--el-card-bg, #fff); color: var(--el-card-fg, #222);
            border-radius: 14px; padding: 1.75rem; max-width: 380px; width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25);
            transform: scale(0.95); transition: transform .2s ease;
        }
        .el-confirm-overlay.open .el-confirm-card { transform: scale(1); }
        .el-confirm-msg { font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
        .el-confirm-actions { display: flex; justify-content: flex-end; gap: 0.6rem; }
        .el-confirm-btn {
            padding: 0.55rem 1.1rem; border-radius: 8px; border: none; cursor: pointer;
            font-size: 0.82rem; font-weight: 600; font-family: var(--font-sans, sans-serif);
        }
        .el-confirm-btn-ghost { background: transparent; color: var(--el-card-fg, #222); border: 1px solid rgba(0,0,0,0.15); }
        .el-confirm-btn-danger { background: #b5493f; color: #fff; }
    `;
    document.head.appendChild(style);
})();

/**
 * Muestra un aviso flotante (reemplaza alert()).
 * tipo: 'info' | 'ok' | 'error'
 */
function elToast(mensaje, tipo = 'info') {
    const stack = document.getElementById('el-toast-stack');
    if (!stack) return;
    const iconos = {
        ok: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
        error: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
        info: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
    };
    const el = document.createElement('div');
    el.className = `el-toast ${tipo}`;
    el.innerHTML = `${iconos[tipo] || iconos.info}<span>${mensaje}</span>`;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

/**
 * Pide confirmación con un modal propio (reemplaza confirm()).
 * Devuelve una Promise<boolean>.
 */
function elConfirm(mensaje) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('el-confirm-overlay');
        const msgEl = document.getElementById('el-confirm-msg');
        const btnOk = document.getElementById('el-confirm-ok');
        const btnCancel = document.getElementById('el-confirm-cancel');

        msgEl.textContent = mensaje;
        overlay.classList.add('open');

        function limpiar(resultado) {
            overlay.classList.remove('open');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            resolve(resultado);
        }
        function onOk() { limpiar(true); }
        function onCancel() { limpiar(false); }

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
    });
}
