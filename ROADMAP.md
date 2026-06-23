# GeoCamera — Roadmap

Mejoras planificadas, ordenadas por área. Cada ítem indica dificultad estimada (★ = fácil · ★★ = media · ★★★ = difícil) y prerequisitos si los hay.

---

## Visor geográfico (Leaflet)

Implementado en v1: pantalla `geo-map-screen` con marcadores, rectángulos Plus Code y exportación GeoJSON.

| # | Mejora | Descripción | Dificultad |
|---|--------|-------------|------------|
| M-1 | Navegar a detalle desde marcador | Tap en popup del marcador → `nav: detail` con el `photoId` correspondiente | ★ |
| M-2 | Círculo de precisión GPS | `L.circle(lat, lon, { radius: accuracyMeters })` alrededor de cada marcador, color según calidad de señal | ★ |
| M-3 | Toggle capas (calles / satélite) | Selector OSM calles ↔ Esri WorldImagery (o ESRI Satellite) en el control de capas de Leaflet | ★ |
| M-4 | Compartir GeoJSON | Botón Web Share API (`navigator.share({ files: [geojsonFile] })`) para enviar el `.geojson` por WhatsApp, Drive, etc. | ★ |
| M-5 | Filtro temporal en mapa | Rango de fechas (date-picker) para filtrar marcadores visibles en el mapa | ★★ |
| M-6 | Mapa offline con PMTiles | Migrar tile layer a MapLibre GL JS + archivo `.pmtiles` local — elimina dependencia de servidor de tiles | ★★★ |

---

## Índice de capturas

| # | Mejora | Descripción | Dificultad | Prerequisito |
|---|--------|-------------|------------|--------------|
| I-1 | FIFO configurable | Exponer `FIFO_MAX` como opción en Settings (slider 6–50); persistir en IndexedDB config | ★★ | — |
| I-2 | Búsqueda / filtro de texto | Barra de búsqueda en `list-screen` que filtre por Plus Code, fecha o nombre de archivo | ★★ | — |
| I-3 | Exportar todas las miniaturas en ZIP | Comprimir thumbnails en cliente con `fflate` y descargar `.zip` | ★★ | — |

---

## Captura y stencil

| # | Mejora | Descripción | Dificultad |
|---|--------|-------------|------------|
| C-1 | Stencil configurable en detalle | Permitir elegir qué campos aparecen (ocultar Plus Code, ocultar accuracy, etc.) | ★★ |
| C-2 | Captura en ráfaga | Modo ráfaga: 3–5 disparos automáticos; cada uno pasa por review individual | ★★ |
| C-3 | Orientación EXIF en iOS web | Leer EXIF orientation del blob de `getUserMedia` y rotar canvas antes del stencil (fix WebKit) | ★★★ |

---

## Plataforma / PWA

| # | Mejora | Descripción | Dificultad |
|---|--------|-------------|------------|
| P-1 | Notificación de guardado en Android | `LocalNotifications` de Capacitor al guardar en DCIM (confirma al usuario sin abrir la app) | ★ |
| P-2 | Onboarding iOS (instalación) | Pantalla única con instrucciones animadas "Share → Agregar a pantalla de inicio" para primera visita | ★★ |
| P-3 | Sincronización background (Android) | Activar `sync.js` cuando el backend esté listo; usar `BackgroundTask` de Capacitor para upload en segundo plano | ★★★ |

---

## Backend (activar solo cuando se cumplan criterios — ver `CLAUDE.md`)

| # | Mejora | Descripción | Dificultad |
|---|--------|-------------|------------|
| B-1 | API Go/Gin + PostgreSQL | Upload de capturas al servidor Linode; fotos accesibles desde cualquier dispositivo | ★★★ |
| B-2 | Object storage (Linode) | Full-res JPEG en Linode Object Storage; thumbnail en PostgreSQL | ★★★ |
| B-3 | Panel web de evidencias | Vista web (no PWA) para descarga y revisión institucional de capturas | ★★★ |
