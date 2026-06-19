# GeoCamera — Deploy en producción

## Arquitectura

```
Internet → Traefik (TLS termination) → geocamera container (nginx:alpine, port 80)
```

GeoCamera es una **PWA estática**: el build produce únicamente HTML, JS, CSS e íconos.  
No hay proceso de servidor, base de datos ni API — todo corre en el cliente.  
Nginx sirve los archivos y aplica las reglas de cache correctas para PWA.

**Stack de producción:**
- `nginx:alpine` — imagen base ~5 MB
- Build multi-stage (node:22-alpine + nginx:alpine) — imagen final ~25 MB
- HTTPS terminado por Traefik en el VPS de Linode

---

## Archivos involucrados

| Archivo | Propósito |
|---|---|
| `Dockerfile` | Build multi-stage: compila con Node, sirve con nginx |
| `nginx.conf` | Vhost: gzip, cache PWA, security headers, SPA fallback |
| `.dockerignore` | Excluye node_modules, .ssl, android/ios del contexto de build |

---

## Build y deploy

### 1. Verificar el build de producción localmente

```bash
npm install          # solo si no existe node_modules/
npm run build        # genera dist/
npm run preview      # preview en http://localhost:4173
```

### 2. Construir la imagen Docker

```bash
# Desde la raíz del repositorio
docker build --platform linux/amd64 -t geocamera:latest .

# Con tag de versión (recomendado en CI)
docker build --platform linux/amd64 -t geocamera:$(git rev-parse --short HEAD) .
```

El build multi-stage descarga dependencias, compila con Vite y copia solo `dist/`  
a la imagen final de nginx. El contexto de build ignora `node_modules/` y `dist/`  
locales (`.dockerignore`).

### 3. Probar la imagen localmente

```bash
docker run --rm --platform linux/amd64 -p 8080:80 geocamera:latest
```

Abrir `http://localhost:8080` — confirmar que la app carga y el Service Worker se registra.

> **Nota:** localmente la app corre en HTTP. La cámara y el GPS funcionarán solo si  
> el navegador está en `localhost` (Chrome/Firefox sí los permiten en localhost HTTP;  
> Safari requiere siempre HTTPS). En producción, Traefik provee el HTTPS.

### 4. Publicar en el registro

```bash
# Docker Hub
docker tag geocamera:latest usuario/geocamera:latest
docker push usuario/geocamera:latest

# GHCR (GitHub Container Registry)
docker tag geocamera:latest ghcr.io/120m4n/geocamera:latest
docker push ghcr.io/120m4n/geocamera:latest

docker build --no-cache --platform linux/amd64 -t ghcr.io/120m4n/geocamera:latest . && docker push ghcr.io/120m4n/geocamera:latest
```

### 5. Deploy en el VPS (Linode) con Traefik

Crear o actualizar el servicio en el VPS:

```bash
docker pull ghcr.io/120m4n/geocamera:latest

docker run -d \
  --name geocamera \
  --restart unless-stopped \
  --network traefik-public \
  -e VIRTUAL_HOST=geocamera.tudominio.com \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.geocamera.rule=Host(\`geocamera.tudominio.com\`)" \
  --label "traefik.http.routers.geocamera.entrypoints=websecure" \
  --label "traefik.http.routers.geocamera.tls.certresolver=letsencrypt" \
  --label "traefik.http.services.geocamera.loadbalancer.server.port=80" \
  geocamera:latest
```

Reemplazar `geocamera.tudominio.com` con el dominio real.  
Traefik obtiene y renueva el certificado TLS vía Let's Encrypt automáticamente.

---

## Con Docker Compose (opcional)

```yaml
# docker-compose.yml
services:
  geocamera:
    platform: linux/amd64
    image: ghcr.io/120m4n/geocamera:latest
    restart: unless-stopped
    networks:
      traefik_public:
        aliases:
          - geocamera-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.geocamera.rule=Host(`geocam.sidis-ingenieria.com`)"
      - "traefik.http.routers.geocamera.entrypoints=websecure"
      - "traefik.http.routers.geocamera.tls.certresolver=letsencrypt"
      - "traefik.http.services.geocamera.loadbalancer.server.port=80"

networks:
  traefik_public:
    external: true
```

```bash
docker compose up -d --build     # primera vez
docker compose pull && docker compose up -d   # actualizar
```

---

## Estrategia de cache (nginx.conf)

| Ruta | Cache | Razón |
|---|---|---|
| `/sw.js` | `no-cache` | El browser debe verificar actualizaciones del SW en cada visita |
| `/manifest.json` | `no-cache` | El browser recarga el manifest para detectar cambios de PWA |
| `/assets/*.js`, `/assets/*.css` | `immutable, 1 año` | Vite incluye hash del contenido en el nombre del archivo |
| `*.png`, `*.webp`, `*.svg` | `30 días` | Íconos y splash — cambian raramente |
| `/` (index.html) | `no-cache` | El shell de la app debe actualizarse para que el SW reciba el nuevo SW |

---

## Verificación post-deploy

```bash
# Cabeceras de respuesta
curl -I https://geocamera.tudominio.com/sw.js
# Esperado: cache-control: no-cache (o Pragma: no-cache)

curl -I https://geocamera.tudominio.com/assets/index-XXXXXXXX.js
# Esperado: cache-control: public, max-age=31536000, immutable

# Logs del container
docker logs geocamera --tail 50 -f

# Reiniciar sin downtime
docker pull geocamera:latest && docker compose up -d
```

---

## Consideraciones de seguridad

- HTTPS es **requerido** para `getUserMedia` (cámara) y `Geolocation` en todos los navegadores móviles.  
  Traefik lo gestiona — el container nginx solo escucha en HTTP interno.
- Los certificados TLS los genera y renueva Traefik/Let's Encrypt.  
  No hay certs dentro de la imagen Docker.
- El `nginx.conf` incluye:  
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,  
  `Referrer-Policy: strict-origin-when-cross-origin`,  
  `Permissions-Policy: camera=*, geolocation=*`
