// ==========================================================================
// ENTRE LÍNEAS — js/ui/theme.js
// Alterna entre modo claro y oscuro. Se guarda la preferencia en localStorage
// (independiente para landing/admin/usuario, según la página).
// Requiere que el CSS de la página defina variables bajo [data-theme="dark"].
// ==========================================================================

(function () {
    const KEY = 'el-theme';
    const guardado = localStorage.getItem(KEY);
    const preferido = guardado || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', preferido);

    window.elToggleTheme = function () {
        const actual = document.documentElement.getAttribute('data-theme');
        const nuevo = actual === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nuevo);
        localStorage.setItem(KEY, nuevo);
        document.querySelectorAll('.el-theme-toggle-icon').forEach(el => {
            el.innerHTML = nuevo === 'dark' ? ICONO_SOL : ICONO_LUNA;
        });
    };

    window.elThemeIconInicial = function () {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? ICONO_SOL : ICONO_LUNA;
    };
})();

const ICONO_LUNA = '<svg viewBox="0 0 24 24"><path d="M12.3 2C6.6 2.3 2 7 2 12.8 2 18.5 6.5 23 12.2 23c4.5 0 8.3-2.9 9.7-7-1.5.9-3.2 1.4-5 1.4-5.5 0-10-4.5-10-10 0-2 .6-3.9 1.6-5.4h-.2z"/></svg>';
const ICONO_SOL  = '<svg viewBox="0 0 24 24"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 18a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zM4.2 4.2a1 1 0 0 1 1.4 0l1.4 1.4a1 1 0 1 1-1.4 1.4L4.2 5.6a1 1 0 0 1 0-1.4zm12.8 12.8a1 1 0 0 1 1.4 0l1.4 1.4a1 1 0 0 1-1.4 1.4L17 18.4a1 1 0 0 1 0-1.4zM2 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1zm18 0a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1zM4.2 19.8a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 1 1 1.4 1.4l-1.4 1.4a1 1 0 0 1-1.4 0zM17 7l1.4-1.4a1 1 0 0 1 1.4 1.4L18.4 8.4A1 1 0 1 1 17 7z"/></svg>';
