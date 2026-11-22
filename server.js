const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { MongoClient, Binary } = require('mongodb');

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL ||
  'mongodb://127.0.0.1:27017/miisteg2026';
const MONGODB_DB = process.env.MONGODB_DB || 'miisteg2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'miisteg2026';

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let mongoClient = null;
let mongoDb = null;
let mongoConnected = false;

function readSeedJSON() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error leyendo seed db.json:', err.message);
    return {
      config: {},
      ejes: [],
      programa: [],
      ponencias: [],
      videos: [],
      galeria: [],
      registros: []
    };
  }
}

function writeFallbackJSON(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('No se pudo escribir respaldo local db.json:', err.message);
  }
}

async function initMongo() {
  try {
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGODB_DB);
    mongoConnected = true;
    console.log(`[MongoDB] Conectado exitosamente a la base de datos "${mongoDb.databaseName}"`);

    const seed = readSeedJSON();
    const stateCol = mongoDb.collection('portal_state');
    const regCol = mongoDb.collection('registros');

    await regCol.createIndex({ folio: 1 }, { unique: false });
    await regCol.createIndex({ email: 1 }, { unique: false });

    const existingState = await stateCol.findOne({ _id: 'main' });
    if (!existingState) {
      await stateCol.insertOne({
        _id: 'main',
        config: seed.config || {},
        ejes: seed.ejes || [],
        programa: seed.programa || [],
        ponencias: seed.ponencias || [],
        videos: seed.videos || [],
        galeria: seed.galeria || [],
        updatedAt: new Date()
      });
      console.log('[MongoDB] Colección portal_state inicializada con datos semilla de MIISTEG.');
    }

    const regCount = await regCol.countDocuments();
    if (regCount === 0 && Array.isArray(seed.registros) && seed.registros.length > 0) {
      await regCol.insertMany(seed.registros.map(r => ({ ...r })));
      console.log(`[MongoDB] Colección registros inicializada con ${seed.registros.length} registros.`);
    }
  } catch (err) {
    mongoConnected = false;
    mongoDb = null;
    console.warn(`[MongoDB] No disponible (${err.message}). Operando con persistencia local data/db.json y reintento automático.`);
  }
}

async function getFullData() {
  if (mongoConnected && mongoDb) {
    try {
      const stateCol = mongoDb.collection('portal_state');
      const regCol = mongoDb.collection('registros');
      const state = (await stateCol.findOne({ _id: 'main' })) || {};
      const registros = await regCol.find({}).sort({ fechaRegistro: 1 }).toArray();
      return {
        storage: 'mongodb',
        config: state.config || {},
        ejes: state.ejes || [],
        programa: state.programa || [],
        ponencias: state.ponencias || [],
        videos: state.videos || [],
        galeria: state.galeria || [],
        registros: registros.map(({ _id, ...rest }) => rest)
      };
    } catch (err) {
      console.error('[MongoDB] Error consultando datos:', err.message);
    }
  }
  const local = readSeedJSON();
  return { storage: 'local-json', ...local };
}

async function updatePortalData(partialUpdate) {
  const current = await getFullData();
  const merged = {
    config: partialUpdate.config !== undefined ? partialUpdate.config : current.config,
    ejes: partialUpdate.ejes !== undefined ? partialUpdate.ejes : current.ejes,
    programa: partialUpdate.programa !== undefined ? partialUpdate.programa : current.programa,
    ponencias: partialUpdate.ponencias !== undefined ? partialUpdate.ponencias : current.ponencias,
    videos: partialUpdate.videos !== undefined ? partialUpdate.videos : current.videos,
    galeria: partialUpdate.galeria !== undefined ? partialUpdate.galeria : current.galeria,
    registros: partialUpdate.registros !== undefined ? partialUpdate.registros : current.registros
  };

  if (mongoConnected && mongoDb) {
    const stateCol = mongoDb.collection('portal_state');
    await stateCol.updateOne(
      { _id: 'main' },
      {
        $set: {
          config: merged.config,
          ejes: merged.ejes,
          programa: merged.programa,
          ponencias: merged.ponencias,
          videos: merged.videos,
          galeria: merged.galeria,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    if (partialUpdate.registros !== undefined) {
      const regCol = mongoDb.collection('registros');
      await regCol.deleteMany({});
      if (merged.registros.length > 0) {
        await regCol.insertMany(merged.registros.map(r => ({ ...r })));
      }
    }
  }

  writeFallbackJSON(merged);
  return merged;
}

async function createRegistro(body) {
  const nombre = (body.nombre || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  if (!nombre || !email) {
    throw new Error('El nombre completo y correo electrónico son obligatorios.');
  }

  const current = await getFullData();
  const nextNum = (current.registros ? current.registros.length : 0) + 1;
  const folio = `MIISTEG-2026-${String(nextNum).padStart(4, '0')}`;

  const nuevoRegistro = {
    id: 'reg-' + Date.now(),
    folio,
    nombre,
    email,
    telefono: (body.telefono || '').trim(),
    institucion: (body.institucion || '').trim(),
    nivel: body.nivel || 'Educación Superior',
    rol: body.rol || 'Asistente',
    turno: body.turno || 'Ambos Turnos (09:30 a 16:00 h)',
    eje: body.eje || 'EJE 1',
    ponenciaTitulo: (body.ponenciaTitulo || '').trim(),
    constanciaAprobada: Boolean(current.config && current.config.constanciasLiberadas),
    fechaRegistro: new Date().toISOString()
  };

  if (mongoConnected && mongoDb) {
    await mongoDb.collection('registros').insertOne({ ...nuevoRegistro });
  }

  const updatedRegistros = [...(current.registros || []), nuevoRegistro];
  writeFallbackJSON({ ...current, registros: updatedRegistros });
  return nuevoRegistro;
}

function sendJSON(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('Archivo demasiado grande (máximo 25 MB)'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // Healthcheck para Coolify
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJSON(res, 200, {
      ok: true,
      storage: mongoConnected ? 'mongodb' : 'local-json',
      database: mongoConnected && mongoDb ? mongoDb.databaseName : 'db.json',
      timestamp: new Date().toISOString()
    });
  }

  // Validación de contraseña Admin
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body.password === ADMIN_PASSWORD || body.password === 'miisteg2026') {
        return sendJSON(res, 200, { ok: true, storage: mongoConnected ? 'mongodb' : 'local-json' });
      }
      return sendJSON(res, 401, { ok: false, error: 'Contraseña incorrecta' });
    } catch (err) {
      return sendJSON(res, 400, { ok: false, error: err.message });
    }
  }

  // API: Obtener todos los datos del portal
  if (pathname === '/api/data' && req.method === 'GET') {
    const data = await getFullData();
    return sendJSON(res, 200, data);
  }

  // API: Actualizar datos desde el Panel de Administración
  if (pathname === '/api/data' && req.method === 'PUT') {
    try {
      const body = await parseBody(req);
      const updated = await updatePortalData(body);
      return sendJSON(res, 200, {
        ok: true,
        storage: mongoConnected ? 'mongodb' : 'local-json',
        data: updated
      });
    } catch (err) {
      return sendJSON(res, 400, { ok: false, error: err.message });
    }
  }

  // API: Registro público de participantes
  if (pathname === '/api/registro' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const nuevoRegistro = await createRegistro(body);
      return sendJSON(res, 201, {
        ok: true,
        storage: mongoConnected ? 'mongodb' : 'local-json',
        registro: nuevoRegistro
      });
    } catch (err) {
      return sendJSON(res, 400, { ok: false, error: err.message });
    }
  }

  // API: Subida de archivos (guarda en disco Y en MongoDB para persistencia en Coolify)
  if (pathname === '/api/upload' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { filename, dataUrl } = body;
      if (!filename || !dataUrl) {
        return sendJSON(res, 400, { ok: false, error: 'Falta archivo o nombre.' });
      }
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return sendJSON(res, 400, { ok: false, error: 'Formato base64 inválido.' });
      }
      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const safeName = Date.now() + '-' + filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const targetPath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(targetPath, buffer);

      if (mongoConnected && mongoDb) {
        await mongoDb.collection('uploads').updateOne(
          { _id: safeName },
          {
            $set: {
              filename: safeName,
              mimeType,
              data: new Binary(buffer),
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
      }

      return sendJSON(res, 201, { ok: true, url: `/uploads/${safeName}` });
    } catch (err) {
      return sendJSON(res, 400, { ok: false, error: err.message });
    }
  }

  // Si solicitan un archivo de /uploads/ que no está en disco pero sí en MongoDB, restaurarlo
  if (pathname.startsWith('/uploads/') && req.method === 'GET') {
    const fileName = path.basename(decodeURIComponent(pathname));
    const localUploadPath = path.join(UPLOADS_DIR, fileName);
    if (!fs.existsSync(localUploadPath) && mongoConnected && mongoDb) {
      try {
        const doc = await mongoDb.collection('uploads').findOne({ _id: fileName });
        if (doc && doc.data) {
          const buf = Buffer.from(doc.data.buffer || doc.data.value(true));
          fs.writeFileSync(localUploadPath, buf);
          res.writeHead(200, { 'Content-Type': doc.mimeType || 'application/octet-stream' });
          return res.end(buf);
        }
      } catch (err) {
        console.error('[MongoDB] Error recuperando archivo subido:', err.message);
      }
    }
  }

  // Servir archivos estáticos desde public/
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    const indexFile = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexFile).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 No encontrado');
    }
  }
});

initMongo().finally(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor MIISTEG ejecutándose en http://0.0.0.0:${PORT}`);
  });
});
