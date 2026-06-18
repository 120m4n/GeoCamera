# GeoCamera — Guía de desarrollo

## Requisitos previos

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| Node.js | 22 LTS | `brew install node` |
| npm | 10+ | incluido con Node |
| mkcert | cualquiera | `brew install mkcert` |
| Git | 2.x | `brew install git` |

> **¿Por qué mkcert?**  
> `getUserMedia` (cámara) y `navigator.geolocation` requieren HTTPS en Safari/iOS.  
> mkcert genera certificados firmados por una CA local instalada en el sistema —  
> sin advertencias del navegador y con comportamiento idéntico a producción.  
> El proyecto incluye un fallback a `@vitejs/plugin-basic-ssl` (auto-firmado) para  
> entornos donde mkcert no está disponible, pero la cámara **no funcionará en iOS real** con ese fallback.

---

## Instalación paso a paso

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url> GeoCamera
cd GeoCamera
npm install
```

### 2. Generar certificados SSL (mkcert)

```bash
# Instalar la CA raíz en el almacén de confianza del sistema (solo una vez por máquina)
mkcert -install

# Crear el directorio y los certs (no se guardan en git — ver .gitignore)
mkdir -p .ssl
mkcert \
  -cert-file .ssl/cert.pem \
  -key-file  .ssl/key.pem \
  localhost 127.0.0.1 ::1
```

Resultado esperado:

```
Created a new certificate valid for the following names 📜
 - "localhost"
 - "127.0.0.1"
 - "::1"

The certificate is at ".ssl/cert.pem" and the key at ".ssl/key.pem"
```

> **Verificación:** `vite.config.js` detecta `.ssl/cert.pem` automáticamente.  
> Si no existe, cae en `basicSsl` (HTTPS auto-firmado, solo web desktop).

### 3. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Salida esperada:

```
  VITE v8.x.x  ready in XXX ms

  ➜  Local:   https://localhost:3000/
  ➜  Network: https://192.168.x.x:3000/
```

Abrir `https://localhost:3000` en el navegador.  
Para probar en un dispositivo iOS en la misma red local, navegar a la URL de **Network** en Safari.

---

## Comandos disponibles

```bash
npm run dev        # Servidor de desarrollo HTTPS en localhost:3000
npm run build      # Compilar a dist/ (prerequisito para Capacitor)
npm run preview    # Preview de dist/ localmente

npm run cap:sync   # Build + sincronizar con Capacitor
npm run android    # Build + sync + abrir Android Studio
npm run ios        # Build + sync + abrir Xcode
npm run lint       # ESLint sobre src/
npm run icons      # Abrir generate-icons.html para regenerar PNG de íconos
```

---

## Regenerar certificados SSL (si expiran o se pierde .ssl/)

mkcert genera certs válidos por **2 años y 3 meses** desde la creación.  
Si expiran o se borra la carpeta `.ssl/`:

```bash
mkdir -p .ssl
mkcert \
  -cert-file .ssl/cert.pem \
  -key-file  .ssl/key.pem \
  localhost 127.0.0.1 ::1
```

No es necesario reinstalar la CA (`mkcert -install`) si ya se instaló en esta máquina.

---

## Estructura del proyecto (solo source)

```
GeoCamera/
├── public/             # Activos estáticos (sw.js, manifest.json, icons/, splash)
├── src/
│   ├── ui/             # Web Components (camera, review, list, detail, settings…)
│   ├── app.js          # Orquestador principal, router
│   ├── camera.js       # Wrapper getUserMedia / CameraPreview
│   ├── db.js           # IndexedDB (fotos + config)
│   ├── downloader.js   # Pipeline de guardado y descarga
│   ├── geo.js          # Geolocation wrapper
│   ├── pluscode.js     # Open Location Code (client-side)
│   ├── stencil.js      # Canvas overlay: GPS + logo watermark
│   ├── styles.css      # Estilos globales
│   ├── sync.js         # Stub MVP — inactivo
│   └── vendor/         # openlocationcode.js
├── index.html
├── vite.config.js
├── capacitor.config.json
└── package.json
```

---

## Notas importantes

- **Siempre probar en iOS real** — WebKit diverge de Chromium en cámara, storage y descarga.  
  DevTools "responsive mode" no emula el comportamiento de `getUserMedia` ni IndexedDB de Safari.

- **IndexedDB en iOS (ITP):** Safari puede purgar IndexedDB tras 7+ días de inactividad.  
  El índice y thumbnails se perderían; los archivos descargados (en Files/Documentos) no.

- **PWA install en iOS:** no hay `beforeinstallprompt`. El usuario debe ir a  
  Safari → Compartir → Agregar a la pantalla de inicio.

- La cámara **no se inicia en standby** — solo cuando el usuario toca la pantalla de splash.  
  Esto previene el calentamiento en uso prolongado de la app.
