# 🛡️ Gestor de Pólizas, Cuotas (1° y 2° Vencimiento) y Renovaciones

Aplicación web progresiva (PWA) pensada para **Celular y Tablet**, con las **454 pólizas** del listado inicial ya precargadas, corregidas y con sus cuotas calculadas.

## ✨ Funciones Principales
1. **🔔 Semáforo de Alertas Diarias:**
   - 🔴 **Pólizas Sin Renovar:** Avisa cuando una póliza llegó a su fecha `Vig. Hasta` y todavía no le cargaste la renovación (con botón para *Cargar Renovación* en 1 paso o marcar como *No renueva / Baja*).
   - 🚨 **2° Vencimiento de Cuota:** Avisa cuando pasó el 1° vencimiento sin pago registrado o cuando se acerca la fecha del 2° vencimiento.
   - 🟠 **1° Vencimiento de Cuota:** Avisa con los días de anticipación que elijas antes del 1° vencimiento.
   - 🟡 **Fin de Póliza Próximo:** Avisa antes de que venza la póliza para gestionar la renovación con tiempo.
2. **🗂️ Visualizador de Cartera y Gestión de Cuotas:**
   - Buscador instantáneo por **Apellido, DNI/CUIT, Patente, N° de Póliza o Concepto**.
   - Filtro por **Compañía** y por **Estado**.
   - Edición directa de **Importe**, **1° Vencimiento** y **2° Vencimiento** de cada cuota, botón de **Marcar Pagada** y envío de aviso por **WhatsApp**.
3. **📥 Importador de Excel Multi-Compañía (`.xlsx`, `.xls`, `.csv`):**
   - Permite subir listados de **La Segunda, Sancor, Federación Patronal, San Cristóbal, Rivadavia, RUS**, etc.
   - Vincula las columnas de cada aseguradora y las recuerda para la próxima vez.
   - Detecta automáticamente si una póliza nueva renueva a una vencida del mismo cliente/vehículo.
4. **☁️ Sincronización entre Celular y Tablet vía GitHub:**
   - Permite guardar y descargar los cambios directamente contra el archivo `polizas.json` de tu repositorio de GitHub.

---

## 🚀 Cómo subirlo a GitHub Pages (Gratis)

1. Entrá a tu cuenta de [GitHub](https://github.com) y creá un repositorio nuevo (por ejemplo `gestor-polizas`).
2. Subí todos los archivos de esta carpeta:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `datos_iniciales.js`
   - `polizas.json`
   - `manifest.json`
   - `sw.js`
3. En tu repositorio de GitHub, andá a **Settings** -> **Pages** (en el menú izquierdo).
4. En **Branch**, elegí `main` (o `master`) y tocá **Save**.
5. En 1 minuto GitHub te dará tu link (ej: `https://tu-usuario.github.io/gestor-polizas/`).
6. Abrí ese link en tu **celular** y en tu **tablet** y elegí **"Agregar a la pantalla de inicio"** en el menú del navegador para instalarla como App.

### 🔗 Cómo activar la sincronización entre Celular y Tablet
1. En GitHub, andá a tu foto de perfil (arriba a la derecha) -> **Settings** -> **Developer settings** -> **Personal access tokens** -> **Tokens (classic)** (o Fine-grained tokens).
2. Generá un token marcando el permiso **`repo`** y copiá el código que empieza con `ghp_...`.
3. En la app (tanto en el celular como en la tablet), entrá a la pestaña **⚙️ Ajustes**, completá tu **Usuario**, **Repositorio** (`gestor-polizas`), pegá el **Token** y marcá *"Sincronizar automáticamente al guardar cambios"*.
