# Minisuper Miranda · inventario y ventas

Demo frontend adaptable para practicar inventario, ventas y reportes. Funciona directamente desde `index.html`; no necesita instalar dependencias.

## Estructura

- `index.html`: estructura de las pantallas.
- `styles.css`: identidad visual, componentes y diseño adaptable.
- `js/app.js`: navegación, inventario, caja, compras, reportes y persistencia local.
- `js/supabase.js`: autenticación y transporte con Supabase.
- `supabase/schema.sql`: tabla de datos y políticas de acceso.
- `js/data.js`: catálogo y ventas de demostración.
- `assets/`: fotografías de categorías y productos, ilustraciones de respaldo y distintivo de Miranda.
- `manifest.webmanifest` y `service-worker.js`: instalación y caché sin conexión al publicarse en HTTPS.

## Cómo probarla

Abre `index.html` en un navegador moderno o usa **Run Minisuper Miranda** en VS Code (F5). No necesita un servidor en `localhost`. Los cambios se guardan en el almacenamiento local de ese navegador. La sincronización con Supabase requiere conexión a internet y la configuración indicada abajo. Para probar el modo instalable y la caché sin conexión, publica la carpeta completa en un hosting HTTPS o sírvela desde un servidor local; los *service workers* no se habilitan desde `file://`.

### Atajos de caja

- `F2`: enfocar el buscador de productos.
- `F4`: enfocar el campo de efectivo.
- `F8`: completar la venta cuando el pago alcanza.
- `Ctrl+K` o `⌘K`: abrir el punto de venta y enfocar el buscador.
- Un lector de código de barras que envíe `Enter` agrega el producto si el código coincide.

## Supabase y compras

La app guarda el inventario, las ventas, los proveedores, los pedidos y los movimientos en una fila JSON de PostgreSQL. Supabase Authentication controla el acceso; la tabla tiene Row Level Security (RLS) y una revisión para detectar cambios simultáneos.

### Activar la conexión

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En **SQL Editor**, ejecuta el contenido de [`supabase/schema.sql`](./supabase/schema.sql). Crea la tabla `app_state`, restringe el acceso con RLS y prepara la fila inicial.
3. En **Authentication → Providers → Email**, desactiva el registro público. En **Users**, crea y confirma una cuenta para cada persona autorizada; no compartas una sola contraseña entre varias personas.
4. En la configuración del proyecto, copia la **Project URL** y la clave **anon/publicable**. Nunca copies una clave `service_role` al navegador. En la aplicación, abre **Configurar Supabase**, captura esos datos y las credenciales de una cuenta autorizada.
5. Si la tabla está vacía, la app ofrece importar los datos locales de este navegador. Excluye las ventas de demostración. Los datos que existan en Google Sheets **no se migran automáticamente**; conserva esa hoja y haz una copia antes de cualquier migración manual. Este cambio retira la conexión de la app, pero no borra la hoja ni su implementación publicada.

El correo y la contraseña no se guardan en la aplicación. La sesión de Supabase sí se conserva en el almacenamiento local para mantener la conexión; cierra sesión en computadoras compartidas. La clave publicable solo es segura con las políticas RLS aplicadas y el registro público desactivado.

La aplicación guarda un respaldo local, pero no es una copia de seguridad completa ni una fuente compartida entre dispositivos. Supabase guarda una instantánea completa del estado; si otra sesión guardó primero, la revisión bloquea el guardado y muestra un conflicto. Para trabajar en equipo, cierra y vuelve a conectar para cargar la última versión antes de continuar. Conserva respaldos periódicos desde Supabase.

Al cargar un catálogo de una versión anterior, la aplicación actualiza una sola vez los precios de los doce productos de demostración que aún conservan su precio original. Solo se modifican los productos cuyo identificador, código y precio coinciden con esos valores; los precios personalizados y el historial de ventas se conservan.

## Alcance y seguridad

La autenticación requiere cuentas de Supabase autorizadas y RLS; la clave pública no concede acceso por sí sola. La app aún guarda el estado completo en una sola fila y no ofrece roles por empleado ni auditoría. Para una operación comercial crítica, configura copias de seguridad y una política de acceso revisada antes de cargar datos reales.

Los doce productos de demostración usan fotografías locales en `assets/photos/`, incluidas en la caché sin conexión. Las imágenes de respaldo en `assets/products/` se conservan para compatibilidad. Las fotografías de producto y categoría proceden de [Unsplash](https://unsplash.com/) y se usan conforme a su [licencia](https://unsplash.com/license). La foto de frijol negro (`assets/photos/frijol.jpg`) corresponde a `photo-1709229851054-a09c8f7bd7e3`. Las fotografías de categoría fueron descargadas y recortadas:

- `assets/produce.jpg`: `photo-1542838132-92c53300491e`
- `assets/bakery.jpg`: `photo-1509440159596-0249088772ff`
- `assets/dairy.jpg`: `photo-1550583724-b2692b85b150`
- `assets/pantry.jpg`: `photo-1547592180-85f173990554`
- `assets/drinks.jpg`: `photo-1517093157656-b9eccef91cb1`
