# Entre Líneas

Plataforma de lectura gamificada: cada libro incluye un código que desbloquea
una trivia digital cronometrada, con puntos y un ranking.

**MVP 100% frontend** (HTML, CSS, JavaScript) — sin backend, sin servidor que
instalar. Toda la lógica se comunica directo con Firebase (Authentication +
Realtime Database), protegida por reglas de seguridad.

## Cómo funciona

- **Acceso**: solo con Google (Firebase Authentication). No existen contraseñas
  en ningún punto del sistema.
- **Roles**: únicamente `admin` y `usuario`.
- **Alta de usuarios**: el admin invita por correo desde su panel (nombre,
  apellido, correo, edad, sexo). La cuenta se activa sola la primera vez que esa
  persona inicia sesión con Google usando ese mismo correo.
- **Contacto/solicitud de acceso**: la landing (`index.html`) tiene un formulario
  que abre WhatsApp con los datos de quien lo llena, para coordinar el acceso
  directamente con el administrador.
- **Contenido**: las trivias de lectura (código, título, autor, PDF, preguntas)
  las crea y gestiona el admin desde su panel — sección "Contenidos".

## Estructura del proyecto

```
index.html                  ← shell de la landing (carga las secciones de partials/)
partials/                   ← secciones de la landing separadas en archivos
  ├── navbar.html, hero.html, proyecto.html, objetivos.html
  └── equipo.html, contacto.html, footer.html
pages/login/login.html      ← login con Google (único acceso)
pages/admin/admin.html       ← panel de administración
pages/usuario/usuario.html   ← experiencia de lectura/trivia del usuario
firebase/config/             ← configuración de Firebase (reemplazar con la tuya)
js/
  ├── ui/                    ← kit compartido: avisos (notify.js), tema claro/oscuro
  │                            (theme.js), fondo de olas (waves.js), includes (includes.js)
  ├── dashboard/              ← lógica de admin.js y usuario.js
  └── config/
css/                          ← estilos
docs/
  ├── GUIA_DESPLIEGUE.md     ← guía completa de configuración y despliegue
  └── database.rules.json   ← reglas de seguridad listas para pegar en Firebase
```

**Nota:** como `index.html` carga sus secciones con `fetch()`, ábrelo siempre
a través de un servidor local (ver "Empezar" abajo), nunca con doble clic.

## Empezar

Sigue **`docs/GUIA_DESPLIEGUE.md`** paso a paso: crear el proyecto en Firebase,
activar Google como método de acceso, pegar las reglas de seguridad, configurar
`firebase-config.js`, y crear la primera cuenta de administrador.
