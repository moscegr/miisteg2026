# 1.er Foro Estatal de Mujeres en la Ciencia y Tecnología — MIISTEG Guerrero 2026

Plataforma web administrable (CMS) con persistencia en **MongoDB**, desarrollada para la difusión, consulta de programa general, repositorio de ponencias magistrales y paneles, videoteca, galería fotográfica, registro en línea con asignación de folio y emisión automatizada de constancias oficiales con el emblema de **MIISTEG** (*Mujeres Investigadoras, Innovadoras, Siempre Tecnológicas y Empoderadas de Guerrero*).

---

## 🚀 Despliegue en Coolify

Este repositorio incluye un `Dockerfile` listo para producción y soporte nativo para **MongoDB**.

### 1. Crear recurso en Coolify
1. En tu panel de **Coolify**, crea un nuevo servicio o base de datos **MongoDB** (si aún no tienes uno) y copia su cadena de conexión interna (`MONGODB_URI`, por ejemplo: `mongodb://root:password@mongodb-uuid:27017/miisteg2026?authSource=admin`).
2. Crea un nuevo recurso de tipo **Public Repository** (o GitHub App) apuntando a:
   ```
   https://github.com/moscegr/miisteg2026.git
   ```
3. Selecciona **Dockerfile** (o **Nixpacks**) como Build Pack.
4. Puerto expuesto (**Ports Exposes**): `3000`
5. Healthcheck Path: `/api/health`

### 2. Variables de Entorno en Coolify
Configura las siguientes variables de entorno en la pestaña **Environment Variables** de tu aplicación en Coolify:

```env
PORT=3000
MONGODB_URI=mongodb://usuario:password@host:27017/miisteg2026?authSource=admin
MONGODB_DB=miisteg2026
ADMIN_PASSWORD=miisteg2026
```

> **Nota sobre Persistencia Total en MongoDB:**
> - Al iniciar por primera vez, el servidor inicializa automáticamente las colecciones `portal_state` y `registros` en MongoDB con la información oficial del 1.er Foro Estatal MIISTEG.
> - Todas las imágenes o archivos que subas desde el **Panel Admin** se almacenan tanto en `/uploads` como en la colección binaria `uploads` de **MongoDB**, por lo que **nunca se pierden** aunque Coolify reconstruya el contenedor en futuros despliegues.

---

## 💻 Ejecución Local

```bash
npm install
npm start
```

El portal estará disponible en `http://localhost:3000`.
Para entrar al **Panel Admin**, haz clic en el botón **⚙️ Panel Admin** e ingresa la contraseña configurada en `ADMIN_PASSWORD` (por defecto `miisteg2026`).
