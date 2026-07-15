# Entre Líneas — Guía de configuración y despliegue (MVP, sin backend)

Este proyecto es 100% HTML, CSS y JavaScript. No hay ningún servidor que instalar
ni correr: todo se comunica directo con Firebase desde el navegador.

## 1. Crear el proyecto en Firebase

1. Ve a https://console.firebase.google.com y crea un proyecto nuevo.
2. **Authentication → Sign-in method** → activa **Correo electrónico/contraseña**
   y también **Google** (se usa para verificar el correo en la solicitud de acceso).
3. **Authentication → Settings → Authorized domains** → agrega tu dominio real
   (y `localhost` mientras pruebas en tu máquina).
4. **Realtime Database → Crear base de datos** (elige la región más cercana a tus usuarios).
5. En la pestaña **Rules** de Realtime Database, pega el contenido de
   `docs/database.rules.json` (incluido en este proyecto) y publica.

## 2. Configurar el frontend

Edita `firebase/config/firebase-config.js` con los valores de tu proyecto
(Configuración del proyecto → General → Tus apps → SDK de Firebase). El `apiKey`
no es secreto — es normal que sea público en una app web de Firebase.

## 3. Configurar el WhatsApp de contacto de la landing

En `index.html`, dentro del `<script>` final, reemplaza:
```js
const WHATSAPP_CONTACTO = "51900000000";
```
por tu número real (código de país + número, sin espacios ni símbolos).

## 4. Reemplazar las fotos polaroid del hero

En `partials/hero.html`, busca los bloques `<figure class="polaroid">` y
reemplaza cada `<div class="polaroid-placeholder">...</div>` por
`<img src="ruta/a/tu/foto.jpg" alt="...">`.

## 5. Servir el frontend

**Importante:** la landing (`index.html`) ahora carga sus secciones desde la
carpeta `partials/` usando `fetch()`, así que **debes** abrirla a través de un
servidor local — abrirla con doble clic (protocolo `file://`) no va a cargar
las secciones.

```bash
npx serve .
```
o la extensión **Live Server** de VS Code. En producción, sube la carpeta a
cualquier hosting estático (Firebase Hosting, Netlify, Vercel, GitHub Pages).

## 6. Crear la primera cuenta de administrador

1. Ve a **Firebase Console → Authentication → Users → Add user**, crea una
   cuenta con el correo y contraseña que va a usar el admin.
2. Copia el **UID** que se generó.
3. Ve a **Realtime Database** y crea manualmente:
```
usuarios/
  {ese-uid}/
    nombre: "Nombre"
    apellido: "Apellido"
    email: "correo@ejemplo.com"
    rol: "admin"
    cuentaActiva: true
    creadoEn: 1735689600000
```
4. Esa persona ya puede entrar por el formulario de login normal (correo + contraseña).

## 7. Cómo funciona el flujo completo de acceso

1. Alguien llena el formulario de **"Solicitar acceso"** en el login — por Google
   (verifica su correo) o manualmente — indicando edad, sexo, ciudad, WhatsApp
   y el código de pago de su comprobante.
2. Esa solicitud aparece en el panel admin, en **Solicitudes**.
3. El admin la revisa; si aprueba, se abre el formulario **"Crear acceso"**, donde
   el admin define el correo de acceso (normalmente el mismo que la persona puso)
   y una contraseña inicial (puede escribirla o generarla con un clic).
4. Esa contraseña se muestra **una sola vez** en pantalla, con botones para
   copiarla o enviarla por WhatsApp al número que la persona indicó.
5. Esa persona ya puede entrar por el formulario de login normal.

## 8. Notificaciones a todos los usuarios

Desde **Notificaciones** en el panel admin, el admin puede escribir un título y
un mensaje y enviarlo a todos los usuarios registrados. Cada usuario lo ve en la
campana de notificaciones de su vista, con un contador de mensajes no leídos.

## 9. Modo claro/oscuro

Hay un botón de sol/luna en la landing, el login, el panel admin y la vista de
usuario. La preferencia se guarda en el navegador de cada persona (no es una
configuración global de la plataforma).

## 10. Limitaciones conocidas de este MVP (por no tener backend)

- **"Desactivar" una cuenta**: no bloquea la cuenta de Firebase Auth en sí (eso
  requeriría un backend con privilegios de administrador) — marca la cuenta como
  inactiva en la base de datos, y la propia app revisa ese estado en cada login y
  niega el acceso igual. El efecto para el usuario final es el mismo.
- **"Eliminar" una cuenta**: borra su perfil de la base de datos, pero no su
  cuenta de autenticación subyacente. Si esa persona vuelve a intentar entrar,
  el sistema ya no reconoce ningún acceso suyo.
- **"Restablecer contraseña"** de una cuenta ya creada: el admin no puede escribir
  directamente una contraseña nueva para otra persona sin backend — en su lugar,
  se envía un enlace oficial de Firebase al correo de esa persona para que ella
  misma defina una nueva. Es el mecanismo estándar y seguro para este caso.
- El truco de "instancia secundaria de Firebase" (usado al crear un usuario nuevo
  desde el panel) es 100% cliente y no dejará nunca cerrada la sesión del admin,
  pero si en el futuro necesitas más operaciones de este tipo (forzar una
  contraseña específica en una cuenta ya existente, borrar cuentas de Auth, etc.),
  eso sí requeriría un pequeño backend con el Admin SDK.

## 11. Resumen del modelo de datos

```
usuarios/{uid}          — cuentas ya activas (admin o usuario)
solicitudes/{id}        — solicitudes de acceso pendientes de revisión
trivias/{codigo}        — contenido de lectura creado por el admin
actividad/{id}          — historial de trivias resueltas (para estadísticas)
notificaciones/{id}     — avisos enviados por el admin a todos los usuarios
```
