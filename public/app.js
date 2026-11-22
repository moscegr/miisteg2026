// Estado global de la plataforma MIISTEG
let appData = {
  storage: 'mongodb',
  config: {},
  ejes: [],
  programa: [],
  ponencias: [],
  videos: [],
  galeria: [],
  registros: []
};

let currentProgramaFilter = 'todos';
let currentPonenciasFilter = 'TODOS';
let currentAdminTab = 'config';
let currentCertRegistro = null;
let isAdminAuthenticated = false;
let certLogoImage = null;

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
  preloadLogoForCertificate();
  await loadAppData();
  startCountdown();
});

// Menú móvil responsivo
function toggleMobileMenu() {
  const nav = document.getElementById('navCollapse');
  const btn = document.getElementById('mobileMenuToggle');
  if (!nav) return;
  const isOpen = nav.classList.toggle('open');
  if (btn) btn.textContent = isOpen ? '✕' : '☰';
}

function closeMobileMenu() {
  const nav = document.getElementById('navCollapse');
  const btn = document.getElementById('mobileMenuToggle');
  if (nav) nav.classList.remove('open');
  if (btn) btn.textContent = '☰';
}

function preloadLogoForCertificate() {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    certLogoImage = img;
    if (currentCertRegistro) {
      dibujarConstanciaCanvas(currentCertRegistro);
    }
  };
  img.src = '/uploads/logo-miisteg-transparent.png';
}

async function loadAppData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('No se pudo cargar /api/data');
    appData = await res.json();
    localStorage.setItem('miisteg_backup_db', JSON.stringify(appData));
  } catch (err) {
    console.warn('Usando respaldo local:', err);
    const cached = localStorage.getItem('miisteg_backup_db');
    if (cached) appData = JSON.parse(cached);
  }
  renderAll();
}

async function saveAppData(partialUpdate, successMsg = 'Cambios guardados en la base de datos') {
  appData = { ...appData, ...partialUpdate };
  localStorage.setItem('miisteg_backup_db', JSON.stringify(appData));
  try {
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialUpdate)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error guardando en servidor');
    if (result.storage) appData.storage = result.storage;
    showToast(`${successMsg} (${appData.storage === 'mongodb' ? 'MongoDB' : 'Persistencia activa'})`);
  } catch (err) {
    showToast(successMsg + ' (guardado localmente)');
  }
  renderAll();
  if (isAdminAuthenticated) {
    renderAdminTab();
  }
}

function renderAll() {
  renderConfig();
  renderEjes();
  renderPrograma();
  renderPonencias();
  renderVideos();
  renderGaleria();
}

// 1. Renderizar Configuración General
function renderConfig() {
  const c = appData.config || {};
  setText('navSiglas', c.siglas || 'MIISTEG');
  setText('heroLema', '🔬 ' + (c.lemaSuperior || '¡LA CIENCIA Y LA INNOVACIÓN TIENEN VOZ DE MUJER EN GUERRERO!'));
  setText('heroTitulo', (c.titulo || 'FORO ESTATAL DE MUJERES EN LA CIENCIA Y TECNOLOGÍA').replace(/^1\.er\s*/i, ''));
  setText('heroSubtitulo', c.subtitulo || 'Mujeres Innovando el Futuro de Guerrero: Media Superior y Superior.');
  setText('heroDescripcion', c.descripcion || '');
  setText('heroFecha', c.fechaTexto || '7 de diciembre de 2026');
  setText('heroSede', c.sede || 'Auditorio José Joaquín de Herrera');
  setText('heroHorario', c.horarioTexto || '9:30 a 16:00 hrs');
  setText('significadoSiglasText', `${c.significadoSiglas || ''} — ${c.eslogan || ''}`);

  setText('infoSede', c.sede || 'Auditorio José Joaquín de Herrera');
  setText('infoCiudad', c.ciudad || 'Chilpancingo de los Bravo, Guerrero.');
  setText('infoContactoNombre', c.contactoNombre || 'Mtra. Yammel Anilú Martínez Saavedra');

  const telEl = document.getElementById('infoTelefono');
  if (telEl) {
    telEl.textContent = c.contactoTelefono || '744 424 5666';
    telEl.href = 'tel:' + (c.contactoTelefono || '7444245666').replace(/\s+/g, '');
  }

  const emailEl = document.getElementById('infoEmail');
  if (emailEl) {
    emailEl.textContent = c.contactoEmail || 'mujeresinvestigadorasguerrero@gmail.com';
    emailEl.href = 'mailto:' + (c.contactoEmail || 'mujeresinvestigadorasguerrero@gmail.com');
  }

  const hashContainer = document.getElementById('footerHashtags');
  if (hashContainer) {
    const tags = c.hashtags || ['#MIISTEG', '#MujeresEnLaCiencia', '#MujeresSTEM', '#Guerrero'];
    hashContainer.innerHTML = tags.map(t => `<span class="hashtag-pill">${escapeHtml(t)}</span>`).join('');
  }

  const storageBadge = document.getElementById('storageStatusBadge');
  if (storageBadge) {
    storageBadge.textContent =
      appData.storage === 'mongodb'
        ? '🟢 CMS Conectado a MongoDB'
        : '🟡 CMS Persistente (Modo Local / Fallback)';
  }
}

// 2. Renderizar los 3 Ejes Temáticos con Imágenes Contextuales
function renderEjes() {
  const container = document.getElementById('ejesContainer');
  if (!container) return;
  const ejes = appData.ejes || [];
  const icons = {
    microscope: '🔬',
    dna: '🧬',
    rocket: '🚀'
  };
  const defaultImages = {
    'eje-1': '/uploads/ponencia-saberes-locales.jpg',
    'eje-2': '/uploads/panel-educacion-steam.jpg',
    'eje-3': '/uploads/panel-liderazgo-mentoria.jpg'
  };
  container.innerHTML = ejes.map(e => {
    const imgUrl = e.imagen || defaultImages[e.id] || '/uploads/ponencia-saberes-locales.jpg';
    return `
      <article class="eje-card" style="--eje-color: ${e.color || '#db2777'}">
        <img
          src="${escapeHtml(imgUrl)}"
          alt="${escapeHtml(e.titulo)}"
          class="eje-thumb"
          loading="lazy"
        />
        <div class="eje-card-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.65rem;">
            <span class="eje-badge" style="background:${e.color || '#db2777'}33; border:1px solid ${e.color || '#db2777'}">${escapeHtml(e.numero)}</span>
            <span style="font-size:1.65rem;">${icons[e.icono] || '✨'}</span>
          </div>
          <h3>${escapeHtml(e.titulo)}</h3>
          <p>${escapeHtml(e.descripcion)}</p>
        </div>
      </article>
    `;
  }).join('');
}

// 3. Renderizar Programa General
function filterPrograma(turno, btn) {
  currentProgramaFilter = turno;
  document.querySelectorAll('#programaFilterPills .filter-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderPrograma();
}

function renderPrograma() {
  const container = document.getElementById('programaContainer');
  if (!container) return;

  const items = (appData.programa || []).filter(item =>
    currentProgramaFilter === 'todos' ? true : item.turno === currentProgramaFilter
  );

  const grupos = [
    { key: 'recepcion', titulo: 'RECEPCIÓN Y REGISTRO | 09:00 A 10:00 HORAS', clase: 'bloque-recepcion' },
    { key: 'turno1', titulo: 'PRIMER TURNO | 10:00 A 12:45 HORAS', clase: 'bloque-turno1' },
    { key: 'turno2', titulo: 'SEGUNDO TURNO | 13:00 A 16:00 HORAS', clase: 'bloque-turno2' }
  ];

  let html = '';
  grupos.forEach(g => {
    const lista = items.filter(i => i.turno === g.key);
    if (lista.length === 0) return;

    html += `
      <div class="programa-bloque ${g.clase}">
        <div class="bloque-header">
          <span>${g.titulo}</span>
          <span style="font-size:0.8rem; opacity:0.9;">${lista.length} actividades</span>
        </div>
        <table class="programa-table">
          <thead>
            <tr>
              <th style="width:190px;">Horario</th>
              <th>Actividad Programada</th>
              <th style="width:140px;">Duración</th>
            </tr>
          </thead>
          <tbody>
            ${lista.map(act => `
              <tr>
                <td><span class="horario-chip">🕒 ${escapeHtml(act.horario)}</span></td>
                <td>
                  <div class="actividad-title">${escapeHtml(act.actividad)}</div>
                  ${act.detalle ? `<div class="actividad-detalle">${escapeHtml(act.detalle)}</div>` : ''}
                </td>
                <td><span class="duracion-chip">⏱️ ${escapeHtml(act.duracion || '')}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });

  container.innerHTML = html || `<p style="text-align:center; color:var(--text-muted);">No hay actividades en este filtro.</p>`;
}

// 4. Renderizar Ponencias y Paneles con Imágenes Contextuales
function filterPonencias(eje, btn) {
  currentPonenciasFilter = eje;
  const parent = btn ? btn.parentElement : null;
  if (parent) {
    parent.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  renderPonencias();
}

function renderPonencias() {
  const container = document.getElementById('ponenciasContainer');
  if (!container) return;
  const list = (appData.ponencias || []).filter(p =>
    currentPonenciasFilter === 'TODOS' ? true : p.eje === currentPonenciasFilter
  );

  container.innerHTML = list.map(p => `
    <article class="content-card">
      <img
        class="card-thumb"
        src="${escapeHtml(p.imagen || '/uploads/ponencia-saberes-locales.jpg')}"
        alt="${escapeHtml(p.titulo)}"
        onclick="openLightbox('${escapeHtml(p.imagen || '/uploads/ponencia-saberes-locales.jpg')}', '${escapeHtml(p.titulo)}')"
        style="cursor:pointer;"
        loading="lazy"
      />
      <div class="card-body">
        <div class="card-tags">
          <span class="tag-chip">${escapeHtml(p.eje || 'EJE 1')}</span>
          <span class="tag-chip teal">${escapeHtml(p.tipo || 'Conferencia')}</span>
          <span class="tag-chip" style="background:rgba(255,255,255,0.1); color:#fff;">${escapeHtml(p.turno || '')}</span>
        </div>
        <h3 class="card-title">${escapeHtml(p.titulo)}</h3>
        <div class="card-speaker">👩‍🔬 ${escapeHtml(p.ponente)}</div>
        <div class="card-inst">🏛️ ${escapeHtml(p.institucion || '')}</div>
        <p class="card-desc">${escapeHtml(p.resumen || '')}</p>
        <div class="card-footer">
          <span style="font-size:0.82rem; font-weight:700; color:var(--cyan-400);">🕒 ${escapeHtml(p.horario || '')}</span>
          <div style="display:flex; gap:0.4rem;">
            ${p.documentoUrl ? `<a href="${escapeHtml(p.documentoUrl)}" class="btn btn-outline btn-sm">📄 Info / Material</a>` : ''}
          </div>
        </div>
      </div>
    </article>
  `).join('');
}

// 5. Renderizar Videos
function renderVideos() {
  const container = document.getElementById('videosContainer');
  if (!container) return;
  const videos = appData.videos || [];

  container.innerHTML = videos.map(v => `
    <article class="content-card">
      <div class="video-frame-wrap">
        <iframe
          src="${escapeHtml(v.url)}"
          title="${escapeHtml(v.titulo)}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
      <div class="card-body">
        <div class="card-tags">
          <span class="tag-chip teal">🎬 ${escapeHtml(v.categoria || 'Video')}</span>
          ${v.duracion ? `<span class="tag-chip">${escapeHtml(v.duracion)}</span>` : ''}
        </div>
        <h3 class="card-title">${escapeHtml(v.titulo)}</h3>
        <div class="card-speaker">${escapeHtml(v.ponente || 'MIISTEG Guerrero')}</div>
        <p class="card-desc" style="margin-top:0.4rem;">${escapeHtml(v.descripcion || '')}</p>
      </div>
    </article>
  `).join('');
}

// 6. Renderizar Galería
function renderGaleria() {
  const container = document.getElementById('galeriaContainer');
  if (!container) return;
  const galeria = appData.galeria || [];

  container.innerHTML = galeria.map(item => `
    <div class="galeria-item" onclick="openLightbox('${escapeHtml(item.url)}', '${escapeHtml(item.titulo)}')">
      <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.titulo)}" loading="lazy" />
      <div class="galeria-caption">
        <span class="tag-chip" style="margin-bottom:0.45rem; display:inline-block;">${escapeHtml(item.categoria || 'Galería')}</span>
        <h4>${escapeHtml(item.titulo)}</h4>
        <p>${escapeHtml(item.descripcion || '')}</p>
      </div>
    </div>
  `).join('');
}

// Lightbox
function openLightbox(src, title) {
  const modal = document.getElementById('lightboxModal');
  const img = document.getElementById('lightboxImg');
  const titleEl = document.getElementById('lightboxTitle');
  const dl = document.getElementById('lightboxDownload');
  if (img) img.src = src;
  if (titleEl) titleEl.textContent = title || 'Imagen MIISTEG';
  if (dl) dl.href = src;
  if (modal) modal.classList.add('open');
}

function closeLightbox() {
  const modal = document.getElementById('lightboxModal');
  if (modal) modal.classList.remove('open');
}

// Cuenta Regresiva
function startCountdown() {
  function update() {
    const targetStr = (appData.config && appData.config.fechaISO) || '2026-12-07T09:30:00-06:00';
    const target = new Date(targetStr).getTime();
    const now = Date.now();
    const diff = Math.max(0, target - now);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    setText('cdDays', String(days).padStart(2, '0'));
    setText('cdHours', String(hours).padStart(2, '0'));
    setText('cdMins', String(mins).padStart(2, '0'));
    setText('cdSecs', String(secs).padStart(2, '0'));
  }
  update();
  setInterval(update, 1000);
}

// 7. Registro en Línea
async function submitRegistro(event) {
  event.preventDefault();
  const payload = {
    nombre: document.getElementById('regNombre').value.trim(),
    email: document.getElementById('regEmail').value.trim(),
    telefono: document.getElementById('regTelefono').value.trim(),
    institucion: document.getElementById('regInstitucion').value.trim(),
    nivel: document.getElementById('regNivel').value,
    rol: document.getElementById('regRol').value,
    turno: document.getElementById('regTurno').value,
    eje: document.getElementById('regEje').value,
    ponenciaTitulo: document.getElementById('regPonencia').value.trim()
  };

  try {
    const res = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Error al registrar');

    const reg = data.registro;
    appData.registros.push(reg);
    mostrarConfirmacionRegistro(reg);
    document.getElementById('registroForm').reset();
    showToast(`¡Registro guardado en ${data.storage === 'mongodb' ? 'MongoDB' : 'base de datos'}! Folio: ${reg.folio}`);
  } catch (err) {
    const nextNum = (appData.registros || []).length + 1;
    const reg = {
      id: 'reg-' + Date.now(),
      folio: `MIISTEG-2026-${String(nextNum).padStart(4, '0')}`,
      ...payload,
      constanciaAprobada: true,
      fechaRegistro: new Date().toISOString()
    };
    appData.registros.push(reg);
    localStorage.setItem('miisteg_backup_db', JSON.stringify(appData));
    mostrarConfirmacionRegistro(reg);
    document.getElementById('registroForm').reset();
    showToast(`¡Registro completado! Folio: ${reg.folio}`);
  }
}

function mostrarConfirmacionRegistro(reg) {
  const box = document.getElementById('registroExitoBox');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
      <div>
        <span class="tag-chip teal">¡REGISTRO CONFIRMADO!</span>
        <h4 style="font-size:1.15rem; font-weight:900; margin-top:0.4rem;">Folio Oficial: <span style="color:var(--gold-400);">${escapeHtml(reg.folio)}</span></h4>
        <p style="font-size:0.88rem; color:var(--text-muted); margin-top:0.2rem;">
          Participante: <strong>${escapeHtml(reg.nombre)}</strong> (${escapeHtml(reg.rol)})<br/>
          Turno: ${escapeHtml(reg.turno)} • Sede: Auditorio José Joaquín de Herrera
        </p>
      </div>
      <div>
        <button type="button" class="btn btn-primary btn-sm" onclick="probarFolio('${escapeHtml(reg.folio)}'); document.getElementById('constancias').scrollIntoView({behavior:'smooth'});">
          🎓 Ver Mi Constancia Ahora
        </button>
      </div>
    </div>
  `;
}

// 8. Módulo de Constancias y Generador HD en Canvas con el Logo Oficial Extraído
function probarFolio(folio) {
  const input = document.getElementById('constanciaQuery');
  if (input) input.value = folio;
  buscarConstancia();
}

function buscarConstancia() {
  const q = (document.getElementById('constanciaQuery').value || '').trim().toLowerCase();
  const msgBox = document.getElementById('constanciaResultadosMsg');
  const wrap = document.getElementById('certificatePreviewWrap');

  if (!q) {
    msgBox.innerHTML = `<p style="color:#fca5a5; font-size:0.9rem;">Por favor ingresa tu folio, correo electrónico o nombre completo.</p>`;
    wrap.style.display = 'none';
    return;
  }

  const resultados = (appData.registros || []).filter(r =>
    (r.folio && r.folio.toLowerCase().includes(q)) ||
    (r.email && r.email.toLowerCase().includes(q)) ||
    (r.nombre && r.nombre.toLowerCase().includes(q))
  );

  if (resultados.length === 0) {
    msgBox.innerHTML = `
      <div style="padding:1rem; border-radius:12px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); color:#fecaca;">
        No se encontró ningún registro con <strong>"${escapeHtml(q)}"</strong>. Verifica tus datos o regístrate arriba en la sección de Registro.
      </div>
    `;
    wrap.style.display = 'none';
    return;
  }

  const reg = resultados[0];
  if (!reg.constanciaAprobada && !(appData.config && appData.config.constanciasLiberadas)) {
    msgBox.innerHTML = `
      <div style="padding:1rem; border-radius:12px; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4); color:#fde68a;">
        Registro localizado: <strong>${escapeHtml(reg.nombre)}</strong> (Folio: ${escapeHtml(reg.folio)}).<br/>
        Tu constancia se encuentra en proceso de validación de asistencia por el Comité Organizador.
      </div>
    `;
    wrap.style.display = 'none';
    return;
  }

  msgBox.innerHTML = `
    <div style="padding:0.9rem 1.2rem; border-radius:12px; background:rgba(13,148,136,0.2); border:1px solid var(--teal-500); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
      <div>
        ✅ <strong>Constancia Oficial Validada:</strong> ${escapeHtml(reg.nombre)} — <em>${escapeHtml(reg.rol)}</em> (Folio: <strong>${escapeHtml(reg.folio)}</strong>)
      </div>
      ${resultados.length > 1 ? `<small style="color:var(--text-muted);">Mostrando 1 de ${resultados.length} coincidencias</small>` : ''}
    </div>
  `;

  currentCertRegistro = reg;
  wrap.style.display = 'block';
  dibujarConstanciaCanvas(reg);
}

function dibujarConstanciaCanvas(reg) {
  const canvas = document.getElementById('certCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cfg = appData.config || {};

  // Fondo blanco marfil diplomático
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#fdfcff');
  bgGrad.addColorStop(0.5, '#f8f5ff');
  bgGrad.addColorStop(1, '#f0fdfa');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Marca de agua suave al centro con el logo extraído
  if (certLogoImage) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.drawImage(certLogoImage, W / 2 - 210, H / 2 - 210, 420, 420);
    ctx.restore();
  }

  // Franja decorativa superior e inferior con los colores de MIISTEG
  const topGrad = ctx.createLinearGradient(0, 0, W, 0);
  topGrad.addColorStop(0, '#3b0764');
  topGrad.addColorStop(0.45, '#be185d');
  topGrad.addColorStop(1, '#0d9488');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, 28);
  ctx.fillRect(0, H - 28, W, 28);

  // Marco doble dorado y magenta
  ctx.strokeStyle = '#be185d';
  ctx.lineWidth = 4;
  ctx.strokeRect(42, 52, W - 84, H - 104);

  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 64, W - 108, H - 128);

  // Dibujar el Logo Oficial Extraído MIISTEG en la esquina superior izquierda
  if (certLogoImage) {
    ctx.drawImage(certLogoImage, 85, 84, 130, 130);
  }

  // Encabezado Institucional
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4c1d95';
  ctx.font = '800 25px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('MIISTEG — MUJERES INVESTIGADORAS, INNOVADORAS,', W / 2 + 30, 130);
  ctx.fillText('SIEMPRE TECNOLÓGICAS Y EMPODERADAS DE GUERRERO', W / 2 + 30, 164);

  ctx.fillStyle = '#0d9488';
  ctx.font = '700 17px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('CIENCIA  •  TECNOLOGÍA  •  INNOVACIÓN  •  LIDERAZGO  •  EMPODERAMIENTO', W / 2 + 30, 198);

  // Línea divisoria
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(230, 224);
  ctx.lineTo(W - 180, 224);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Otorgan la presente', W / 2, 268);

  // Título CONSTANCIA
  ctx.fillStyle = '#be185d';
  ctx.font = '900 58px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('C O N S T A N C I A', W / 2, 332);

  // A: Nombre de la participante
  ctx.fillStyle = '#1e1b4b';
  ctx.font = '900 40px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`A: ${reg.nombre}`, W / 2, 405);

  // Línea bajo el nombre
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(230, 424);
  ctx.lineTo(W - 230, 424);
  ctx.stroke();

  // Calidad de participación y texto
  const rolLabel = (reg.rol || 'Asistente').toUpperCase();
  ctx.fillStyle = '#0f766e';
  ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`En calidad de: ${rolLabel}`, W / 2, 470);

  if (reg.ponenciaTitulo) {
    ctx.fillStyle = '#4c1d95';
    ctx.font = 'italic 700 21px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`«${reg.ponenciaTitulo}»`, W / 2, 505);
  }

  // Cuerpo del texto envuelto
  const bodyText = cfg.textoConstancia ||
    'Por su destacada y valiosa participación en el 1.er Foro Estatal de Mujeres en la Ciencia y Tecnología: «Mujeres Innovando el Futuro de Guerrero: Media Superior y Superior», contribuyendo al fortalecimiento de la investigación de impacto, la educación STEAM y el liderazgo científico femenino.';
  ctx.fillStyle = '#334155';
  ctx.font = '500 21px "Plus Jakarta Sans", sans-serif';
  wrapText(ctx, bodyText, W / 2, reg.ponenciaTitulo ? 550 : 530, W - 260, 32);

  // Lugar y Fecha
  ctx.fillStyle = '#1e1b4b';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `${cfg.sede || 'Auditorio José Joaquín de Herrera'} • ${cfg.ciudad || 'Chilpancingo de los Bravo, Guerrero'} • ${cfg.fechaTexto || '7 de diciembre de 2026'}`,
    W / 2,
    690
  );

  // Lema
  ctx.fillStyle = '#be185d';
  ctx.font = 'italic 700 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('«¡Unidas por la ciencia, conectadas por la innovación y comprometidas con Guerrero!»', W / 2, 725);

  // Firmas
  const yFirma = 840;
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.8;

  // Firma 1
  ctx.beginPath();
  ctx.moveTo(190, yFirma);
  ctx.lineTo(570, yFirma);
  ctx.stroke();

  ctx.fillStyle = '#1e1b4b';
  ctx.font = '800 19px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(cfg.firmante1Nombre || 'Mtra. Yammel Anilú Martínez Saavedra', 380, yFirma + 28);
  ctx.fillStyle = '#64748b';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(cfg.firmante1Cargo || 'Coordinadora General MIISTEG', 380, yFirma + 52);

  // Firma 2
  ctx.beginPath();
  ctx.moveTo(830, yFirma);
  ctx.lineTo(1210, yFirma);
  ctx.stroke();

  ctx.fillStyle = '#1e1b4b';
  ctx.font = '800 19px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(cfg.firmante2Nombre || 'Comité Científico y Organizador', 1020, yFirma + 28);
  ctx.fillStyle = '#64748b';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(cfg.firmante2Cargo || '1.er Foro Estatal de Mujeres en la Ciencia y Tecnología', 1020, yFirma + 52);

  // Sello central con el Emblema Oficial
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, yFirma - 10, 52, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#be185d';
  ctx.stroke();
  if (certLogoImage) {
    ctx.drawImage(certLogoImage, W / 2 - 38, yFirma - 48, 76, 76);
  }
  ctx.restore();

  // Folio en esquina inferior
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '700 15px monospace';
  ctx.fillText(`FOLIO DE VERIFICACIÓN: ${reg.folio}  |  INSTITUCIÓN: ${reg.institucion || 'Guerrero'}`, 75, H - 46);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

function descargarConstanciaPNG() {
  const canvas = document.getElementById('certCanvas');
  if (!canvas || !currentCertRegistro) return;
  const link = document.createElement('a');
  const safeFolio = (currentCertRegistro.folio || 'Constancia').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `Constancia-${safeFolio}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Constancia descargada en alta resolución (PNG)');
}

function imprimirConstanciaPDF() {
  const canvas = document.getElementById('certCanvas');
  if (!canvas || !currentCertRegistro) return;
  const dataUrl = canvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Permite las ventanas emergentes para imprimir o guardar en PDF');
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Constancia Oficial ${escapeHtml(currentCertRegistro.folio)}</title>
      <style>
        @page { size: landscape; margin: 0; }
        body { margin: 0; display: flex; align-items: center; justify-content: center; background: #fff; height: 100vh; }
        img { max-width: 100%; max-height: 100vh; object-fit: contain; }
      </style>
    </head>
    <body>
      <img src="${dataUrl}" onload="window.print();" />
    </body>
    </html>
  `);
  win.document.close();
}

// ============================================================================
// 9. PANEL DE ADMINISTRACIÓN (CMS COMPLETO PERSISTENTE EN MONGODB)
// ============================================================================
function openAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) modal.classList.add('open');
  const passInput = document.getElementById('adminPassInput');
  if (passInput && !isAdminAuthenticated) passInput.value = '';
  if (isAdminAuthenticated) {
    document.getElementById('adminLoginView').style.display = 'none';
    document.getElementById('adminDashboardView').style.display = 'block';
    renderAdminTab();
  }
}

function closeAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) modal.classList.remove('open');
}

async function loginAdmin() {
  const passInput = document.getElementById('adminPassInput');
  const pass = (passInput ? passInput.value : '').trim();
  if (!pass) {
    showToast('Por favor ingresa la contraseña de administrador.');
    return;
  }
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      isAdminAuthenticated = true;
      if (passInput) passInput.value = '';
      document.getElementById('adminLoginView').style.display = 'none';
      document.getElementById('adminDashboardView').style.display = 'block';
      renderAdminTab();
      showToast('Acceso concedido al Panel Administrable MIISTEG');
      return;
    }
    showToast('Contraseña de administrador incorrecta.');
    return;
  } catch (e) {
    // Fallback sin conexión al servidor
  }
  if (pass === 'miisteg2026') {
    isAdminAuthenticated = true;
    if (passInput) passInput.value = '';
    document.getElementById('adminLoginView').style.display = 'none';
    document.getElementById('adminDashboardView').style.display = 'block';
    renderAdminTab();
    showToast('Bienvenido al Panel Administrable MIISTEG');
  } else {
    showToast('Contraseña de administrador incorrecta.');
  }
}

function switchAdminTab(tab, btn) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAdminTab();
}

function renderAdminTab() {
  const container = document.getElementById('adminTabContent');
  if (!container) return;

  if (currentAdminTab === 'config') {
    const c = appData.config || {};
    container.innerHTML = `
      <form onsubmit="guardarConfigAdmin(event)">
        <div class="form-grid">
          <div class="form-group">
            <label>Siglas del Foro</label>
            <input type="text" id="admSiglas" class="form-control" value="${escapeHtml(c.siglas || '')}" required />
          </div>
          <div class="form-group">
            <label>Lema Superior</label>
            <input type="text" id="admLema" class="form-control" value="${escapeHtml(c.lemaSuperior || '')}" />
          </div>
          <div class="form-group full">
            <label>Título Principal del Evento</label>
            <input type="text" id="admTitulo" class="form-control" value="${escapeHtml(c.titulo || '')}" required />
          </div>
          <div class="form-group full">
            <label>Subtítulo</label>
            <input type="text" id="admSubtitulo" class="form-control" value="${escapeHtml(c.subtitulo || '')}" />
          </div>
          <div class="form-group full">
            <label>Descripción Principal</label>
            <textarea id="admDescripcion" class="form-control" rows="2">${escapeHtml(c.descripcion || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Fecha (Texto Visible)</label>
            <input type="text" id="admFechaTexto" class="form-control" value="${escapeHtml(c.fechaTexto || '')}" />
          </div>
          <div class="form-group">
            <label>Horario</label>
            <input type="text" id="admHorario" class="form-control" value="${escapeHtml(c.horarioTexto || '')}" />
          </div>
          <div class="form-group">
            <label>Sede Oficial</label>
            <input type="text" id="admSede" class="form-control" value="${escapeHtml(c.sede || '')}" />
          </div>
          <div class="form-group">
            <label>Ciudad / Estado</label>
            <input type="text" id="admCiudad" class="form-control" value="${escapeHtml(c.ciudad || '')}" />
          </div>
          <div class="form-group">
            <label>Responsable de Informes</label>
            <input type="text" id="admContactoNombre" class="form-control" value="${escapeHtml(c.contactoNombre || '')}" />
          </div>
          <div class="form-group">
            <label>Teléfono / WhatsApp</label>
            <input type="text" id="admTelefono" class="form-control" value="${escapeHtml(c.contactoTelefono || '')}" />
          </div>
          <div class="form-group full">
            <label>Correo Electrónico Oficial</label>
            <input type="email" id="admEmail" class="form-control" value="${escapeHtml(c.contactoEmail || '')}" />
          </div>
          <div class="form-group full">
            <label>Texto Oficial para las Constancias</label>
            <textarea id="admTextoConstancia" class="form-control" rows="3">${escapeHtml(c.textoConstancia || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Firmante 1 (Nombre)</label>
            <input type="text" id="admFirmante1Nombre" class="form-control" value="${escapeHtml(c.firmante1Nombre || '')}" />
          </div>
          <div class="form-group">
            <label>Firmante 1 (Cargo)</label>
            <input type="text" id="admFirmante1Cargo" class="form-control" value="${escapeHtml(c.firmante1Cargo || '')}" />
          </div>
          <div class="form-group full">
            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
              <input type="checkbox" id="admConstanciasLiberadas" ${c.constanciasLiberadas ? 'checked' : ''} />
              Liberar descarga automática de constancias para todos los participantes registrados
            </label>
          </div>
          <div class="form-group full">
            <button type="submit" class="btn btn-primary">💾 Guardar Configuración General</button>
          </div>
        </div>
      </form>
    `;
  } else if (currentAdminTab === 'programa') {
    const list = appData.programa || [];
    container.innerHTML = `
      <div style="margin-bottom:1.5rem; padding:1.25rem; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid var(--border-glass);">
        <h4 style="margin-bottom:0.85rem;">➕ Agregar Actividad al Programa</h4>
        <form onsubmit="agregarActividadPrograma(event)" class="form-grid">
          <div class="form-group">
            <label>Bloque / Turno</label>
            <select id="progTurno" class="form-control">
              <option value="recepcion">Recepción (09:00 – 10:00 h)</option>
              <option value="turno1">Primer Turno (10:00 – 12:45 h)</option>
              <option value="turno2">Segundo Turno (13:00 – 16:00 h)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Horario (ej. 10:15 – 11:35 h)</label>
            <input type="text" id="progHorario" class="form-control" placeholder="10:15 – 11:35 h" required />
          </div>
          <div class="form-group">
            <label>Título de la Actividad</label>
            <input type="text" id="progActividad" class="form-control" placeholder="Nombre de la actividad..." required />
          </div>
          <div class="form-group">
            <label>Duración (ej. 1 h 20 min)</label>
            <input type="text" id="progDuracion" class="form-control" placeholder="1 h 20 min" />
          </div>
          <div class="form-group full">
            <label>Descripción / Detalle</label>
            <input type="text" id="progDetalle" class="form-control" placeholder="Detalle adicional de la sesión..." />
          </div>
          <div class="form-group full">
            <button type="submit" class="btn btn-teal btn-sm">➕ Añadir al Programa</button>
          </div>
        </form>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Turno</th>
              <th>Horario</th>
              <th>Actividad</th>
              <th>Duración</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((item, idx) => `
              <tr>
                <td><span class="tag-chip">${escapeHtml(item.turno)}</span></td>
                <td><strong>${escapeHtml(item.horario)}</strong></td>
                <td>
                  <div>${escapeHtml(item.actividad)}</div>
                  <small style="color:var(--text-muted);">${escapeHtml(item.detalle || '')}</small>
                </td>
                <td>${escapeHtml(item.duracion || '')}</td>
                <td>
                  <button type="button" class="btn btn-danger btn-sm" onclick="eliminarItemColeccion('programa', ${idx})">🗑️ Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (currentAdminTab === 'ponencias') {
    const list = appData.ponencias || [];
    container.innerHTML = `
      <div style="margin-bottom:1.5rem; padding:1.25rem; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid var(--border-glass);">
        <h4 style="margin-bottom:0.85rem;">➕ Publicar Nueva Ponencia, Conferencia Magistral o Panel</h4>
        <form onsubmit="agregarPonenciaAdmin(event)" class="form-grid">
          <div class="form-group full">
            <label>Título de la Ponencia / Panel *</label>
            <input type="text" id="ponTitulo" class="form-control" required />
          </div>
          <div class="form-group">
            <label>Ponente(s) / Panelistas *</label>
            <input type="text" id="ponPonente" class="form-control" required />
          </div>
          <div class="form-group">
            <label>Institución de Procedencia</label>
            <input type="text" id="ponInstitucion" class="form-control" />
          </div>
          <div class="form-group">
            <label>Eje Temático</label>
            <select id="ponEje" class="form-control">
              <option value="EJE 1">EJE 1: Investigación de Impacto y Saberes Locales</option>
              <option value="EJE 2">EJE 2: Educación STEAM</option>
              <option value="EJE 3">EJE 3: Empoderamiento y Liderazgo</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tipo de Sesión</label>
            <select id="ponTipo" class="form-control">
              <option value="Conferencia Magistral">Conferencia Magistral</option>
              <option value="Panel de Expertas">Panel de Expertas</option>
              <option value="Ponencia Oral">Ponencia Oral</option>
              <option value="Taller STEAM">Taller STEAM</option>
            </select>
          </div>
          <div class="form-group">
            <label>Turno</label>
            <select id="ponTurno" class="form-control">
              <option value="Primer Turno">Primer Turno (10:00 – 12:45 h)</option>
              <option value="Segundo Turno">Segundo Turno (13:00 – 16:00 h)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Horario</label>
            <input type="text" id="ponHorario" class="form-control" placeholder="Ej. 10:15 – 11:35 h" />
          </div>
          <div class="form-group full">
            <label>Resumen de la Ponencia</label>
            <textarea id="ponResumen" class="form-control" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>Subir Imagen / Portada desde tu equipo (Opcional)</label>
            <input type="file" id="ponImagenFile" class="form-control" accept="image/*" />
          </div>
          <div class="form-group">
            <label>URL de Presentación PDF / Diapositivas (Opcional)</label>
            <input type="text" id="ponDocUrl" class="form-control" placeholder="https://..." />
          </div>
          <div class="form-group full">
            <button type="submit" class="btn btn-teal btn-sm">➕ Publicar Ponencia</button>
          </div>
        </form>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Eje / Turno</th>
              <th>Título</th>
              <th>Ponente</th>
              <th>Horario</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((p, idx) => `
              <tr>
                <td><span class="tag-chip">${escapeHtml(p.eje)}</span><br/><small>${escapeHtml(p.turno || '')}</small></td>
                <td><strong>${escapeHtml(p.titulo)}</strong></td>
                <td>${escapeHtml(p.ponente)}<br/><small style="color:var(--text-muted);">${escapeHtml(p.institucion || '')}</small></td>
                <td>${escapeHtml(p.horario || '')}</td>
                <td>
                  <button type="button" class="btn btn-danger btn-sm" onclick="eliminarItemColeccion('ponencias', ${idx})">🗑️ Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (currentAdminTab === 'videos') {
    const list = appData.videos || [];
    container.innerHTML = `
      <div style="margin-bottom:1.5rem; padding:1.25rem; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid var(--border-glass);">
        <h4 style="margin-bottom:0.85rem;">➕ Agregar Video o Transmisión (YouTube)</h4>
        <form onsubmit="agregarVideoAdmin(event)" class="form-grid">
          <div class="form-group">
            <label>Título del Video *</label>
            <input type="text" id="vidTitulo" class="form-control" required />
          </div>
          <div class="form-group">
            <label>Enlace de YouTube (watch o embed) *</label>
            <input type="text" id="vidUrl" class="form-control" placeholder="https://www.youtube.com/watch?v=..." required />
          </div>
          <div class="form-group">
            <label>Categoría</label>
            <input type="text" id="vidCategoria" class="form-control" placeholder="Conferencia Magistral / Cápsula STEAM" />
          </div>
          <div class="form-group">
            <label>Ponente / Autor</label>
            <input type="text" id="vidPonente" class="form-control" placeholder="Red MIISTEG Guerrero" />
          </div>
          <div class="form-group full">
            <label>Descripción</label>
            <input type="text" id="vidDescripcion" class="form-control" />
          </div>
          <div class="form-group full">
            <button type="submit" class="btn btn-teal btn-sm">➕ Publicar Video</button>
          </div>
        </form>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Categoría</th>
              <th>URL</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((v, idx) => `
              <tr>
                <td><strong>${escapeHtml(v.titulo)}</strong></td>
                <td>${escapeHtml(v.categoria || '')}</td>
                <td><small style="color:var(--cyan-400);">${escapeHtml(v.url)}</small></td>
                <td>
                  <button type="button" class="btn btn-danger btn-sm" onclick="eliminarItemColeccion('videos', ${idx})">🗑️ Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (currentAdminTab === 'galeria') {
    const list = appData.galeria || [];
    container.innerHTML = `
      <div style="margin-bottom:1.5rem; padding:1.25rem; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid var(--border-glass);">
        <h4 style="margin-bottom:0.85rem;">➕ Subir Fotografía Contextual a la Galería</h4>
        <form onsubmit="agregarGaleriaAdmin(event)" class="form-grid">
          <div class="form-group">
            <label>Título de la Imagen *</label>
            <input type="text" id="galTitulo" class="form-control" required />
          </div>
          <div class="form-group">
            <label>Categoría</label>
            <input type="text" id="galCategoria" class="form-control" placeholder="Fotografía Oficial / Conferencias / STEAM" />
          </div>
          <div class="form-group">
            <label>Seleccionar Archivo de Imagen desde tu Computadora</label>
            <input type="file" id="galFile" class="form-control" accept="image/*" />
          </div>
          <div class="form-group">
            <label>O ingresar URL directa de imagen</label>
            <input type="text" id="galUrl" class="form-control" placeholder="/uploads/ponencia-saberes-locales.jpg" />
          </div>
          <div class="form-group full">
            <label>Descripción</label>
            <input type="text" id="galDescripcion" class="form-control" />
          </div>
          <div class="form-group full">
            <button type="submit" class="btn btn-teal btn-sm">⬆️ Subir y Guardar en MongoDB</button>
          </div>
        </form>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Vista Previa</th>
              <th>Título</th>
              <th>Categoría</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((g, idx) => `
              <tr>
                <td><img src="${escapeHtml(g.url)}" alt="" style="width:70px; height:48px; object-fit:cover; border-radius:6px;" /></td>
                <td><strong>${escapeHtml(g.titulo)}</strong><br/><small style="color:var(--text-muted);">${escapeHtml(g.descripcion || '')}</small></td>
                <td>${escapeHtml(g.categoria || '')}</td>
                <td>
                  <button type="button" class="btn btn-danger btn-sm" onclick="eliminarItemColeccion('galeria', ${idx})">🗑️ Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (currentAdminTab === 'registros') {
    const list = appData.registros || [];
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.8rem; margin-bottom:1.2rem;">
        <div>
          <strong>Total de Participantes Registradas: ${list.length}</strong>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-teal btn-sm" onclick="aprobarTodasLasConstancias()">✅ Aprobar Todas las Constancias</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="exportarRegistrosCSV()">📊 Exportar Padrón a Excel (CSV)</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Nombre Completo</th>
              <th>Institución / Nivel</th>
              <th>Rol / Turno</th>
              <th>Constancia</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((r, idx) => `
              <tr>
                <td><strong style="color:var(--gold-400);">${escapeHtml(r.folio)}</strong></td>
                <td>
                  <strong>${escapeHtml(r.nombre)}</strong><br/>
                  <small style="color:var(--text-muted);">${escapeHtml(r.email)} • ${escapeHtml(r.telefono || '')}</small>
                </td>
                <td>${escapeHtml(r.institucion || '')}<br/><small style="color:var(--cyan-400);">${escapeHtml(r.nivel || '')}</small></td>
                <td>${escapeHtml(r.rol || '')}<br/><small>${escapeHtml(r.turno || '')}</small></td>
                <td>
                  <button
                    type="button"
                    class="btn btn-sm ${r.constanciaAprobada ? 'btn-teal' : 'btn-outline'}"
                    onclick="toggleAprobarConstancia(${idx})"
                  >
                    ${r.constanciaAprobada ? '✅ Aprobada' : '⏳ Pendiente'}
                  </button>
                </td>
                <td>
                  <div style="display:flex; gap:0.35rem;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="verConstanciaDesdeAdmin('${escapeHtml(r.folio)}')">🎓 Ver</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarItemColeccion('registros', ${idx})">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

async function guardarConfigAdmin(e) {
  e.preventDefault();
  const updatedConfig = {
    ...appData.config,
    siglas: document.getElementById('admSiglas').value.trim(),
    lemaSuperior: document.getElementById('admLema').value.trim(),
    titulo: document.getElementById('admTitulo').value.trim(),
    subtitulo: document.getElementById('admSubtitulo').value.trim(),
    descripcion: document.getElementById('admDescripcion').value.trim(),
    fechaTexto: document.getElementById('admFechaTexto').value.trim(),
    horarioTexto: document.getElementById('admHorario').value.trim(),
    sede: document.getElementById('admSede').value.trim(),
    ciudad: document.getElementById('admCiudad').value.trim(),
    contactoNombre: document.getElementById('admContactoNombre').value.trim(),
    contactoTelefono: document.getElementById('admTelefono').value.trim(),
    contactoEmail: document.getElementById('admEmail').value.trim(),
    textoConstancia: document.getElementById('admTextoConstancia').value.trim(),
    firmante1Nombre: document.getElementById('admFirmante1Nombre').value.trim(),
    firmante1Cargo: document.getElementById('admFirmante1Cargo').value.trim(),
    constanciasLiberadas: document.getElementById('admConstanciasLiberadas').checked
  };
  await saveAppData({ config: updatedConfig }, 'Configuración general actualizada');
}

async function agregarActividadPrograma(e) {
  e.preventDefault();
  const turno = document.getElementById('progTurno').value;
  const bloquesMap = {
    recepcion: 'Recepción y Registro',
    turno1: 'Primer Turno | 10:00 a 12:45 Horas',
    turno2: 'Segundo Turno | 13:00 a 16:00 Horas'
  };
  const nueva = {
    id: 'prog-' + Date.now(),
    bloque: bloquesMap[turno],
    turno,
    horario: document.getElementById('progHorario').value.trim(),
    actividad: document.getElementById('progActividad').value.trim(),
    duracion: document.getElementById('progDuracion').value.trim(),
    detalle: document.getElementById('progDetalle').value.trim()
  };
  const programa = [...(appData.programa || []), nueva];
  await saveAppData({ programa }, 'Actividad agregada al programa');
}

async function uploadFileHelper(fileInput) {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;
  const file = fileInput.files[0];
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, dataUrl })
    });
    const data = await res.json();
    if (res.ok && data.ok) return data.url;
  } catch (err) {
    console.warn('Subida local dataURL fallback');
  }
  return dataUrl;
}

async function agregarPonenciaAdmin(e) {
  e.preventDefault();
  const uploadedUrl = await uploadFileHelper(document.getElementById('ponImagenFile'));
  const eje = document.getElementById('ponEje').value;
  const defaultByEje = {
    'EJE 1': '/uploads/ponencia-saberes-locales.jpg',
    'EJE 2': '/uploads/panel-educacion-steam.jpg',
    'EJE 3': '/uploads/ponencia-ia-tecnologia.jpg'
  };
  const nueva = {
    id: 'pon-' + Date.now(),
    titulo: document.getElementById('ponTitulo').value.trim(),
    ponente: document.getElementById('ponPonente').value.trim(),
    institucion: document.getElementById('ponInstitucion').value.trim(),
    eje,
    tipo: document.getElementById('ponTipo').value,
    turno: document.getElementById('ponTurno').value,
    horario: document.getElementById('ponHorario').value.trim(),
    resumen: document.getElementById('ponResumen').value.trim(),
    imagen: uploadedUrl || defaultByEje[eje] || '/uploads/ponencia-saberes-locales.jpg',
    documentoUrl: document.getElementById('ponDocUrl').value.trim() || '#programa'
  };
  const ponencias = [...(appData.ponencias || []), nueva];
  await saveAppData({ ponencias }, 'Ponencia publicada correctamente');
}

function normalizeYoutubeEmbed(rawUrl) {
  if (!rawUrl) return '';
  const match = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return rawUrl;
}

async function agregarVideoAdmin(e) {
  e.preventDefault();
  const nuevo = {
    id: 'vid-' + Date.now(),
    titulo: document.getElementById('vidTitulo').value.trim(),
    url: normalizeYoutubeEmbed(document.getElementById('vidUrl').value.trim()),
    categoria: document.getElementById('vidCategoria').value.trim() || 'Conferencia',
    ponente: document.getElementById('vidPonente').value.trim() || 'MIISTEG Guerrero',
    descripcion: document.getElementById('vidDescripcion').value.trim()
  };
  const videos = [...(appData.videos || []), nuevo];
  await saveAppData({ videos }, 'Video agregado a la videoteca');
}

async function agregarGaleriaAdmin(e) {
  e.preventDefault();
  const uploadedUrl = await uploadFileHelper(document.getElementById('galFile'));
  const manualUrl = document.getElementById('galUrl').value.trim();
  const finalUrl = uploadedUrl || manualUrl || '/uploads/ponencia-saberes-locales.jpg';

  const nueva = {
    id: 'gal-' + Date.now(),
    titulo: document.getElementById('galTitulo').value.trim(),
    categoria: document.getElementById('galCategoria').value.trim() || 'Galería MIISTEG',
    descripcion: document.getElementById('galDescripcion').value.trim(),
    url: finalUrl,
    fecha: new Date().toISOString().slice(0, 10)
  };
  const galeria = [nueva, ...(appData.galeria || [])];
  await saveAppData({ galeria }, 'Imagen publicada en la galería');
}

async function eliminarItemColeccion(coleccion, idx) {
  const list = [...(appData[coleccion] || [])];
  list.splice(idx, 1);
  await saveAppData({ [coleccion]: list }, 'Elemento eliminado');
}

async function toggleAprobarConstancia(idx) {
  const registros = [...(appData.registros || [])];
  if (!registros[idx]) return;
  registros[idx].constanciaAprobada = !registros[idx].constanciaAprobada;
  await saveAppData({ registros }, 'Estado de constancia actualizado');
}

async function aprobarTodasLasConstancias() {
  const registros = (appData.registros || []).map(r => ({ ...r, constanciaAprobada: true }));
  await saveAppData({ registros }, 'Todas las constancias han sido aprobadas');
}

function verConstanciaDesdeAdmin(folio) {
  closeAdminModal();
  probarFolio(folio);
  document.getElementById('constancias').scrollIntoView({ behavior: 'smooth' });
}

function exportarRegistrosCSV() {
  const list = appData.registros || [];
  const headers = ['Folio', 'Nombre', 'Email', 'Telefono', 'Institucion', 'Nivel', 'Rol', 'Turno', 'Eje', 'Ponencia', 'ConstanciaAprobada'];
  const rows = list.map(r => [
    r.folio,
    r.nombre,
    r.email,
    r.telefono,
    r.institucion,
    r.nivel,
    r.rol,
    r.turno,
    r.eje,
    r.ponenciaTitulo || '',
    r.constanciaAprobada ? 'SI' : 'NO'
  ]);
  const csvContent = '\uFEFF' + [headers, ...rows]
    .map(row => row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Padron-Registros-Foro-MIISTEG-2026.csv';
  link.click();
  showToast('Padrón exportado a CSV (Excel)');
}

function exportBackupJSON() {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'respaldo-miisteg-2026.json';
  link.click();
  showToast('Respaldo JSON descargado');
}

// Utilidades
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(msg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3800);
}
