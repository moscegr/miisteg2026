// ============================================================================
// PANEL DE ADMINISTRACIÓN DEDICADO (BACK-OFFICE MIISTEG 2026)
// ============================================================================

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

let currentSection = 'dashboard';
let selectedCertFolio = '';
let certLogoImg = null;

// Filtros del módulo de registros
let regSearchQuery = '';
let regFilterRol = 'TODOS';
let regFilterTurno = 'TODOS';
let regFilterEstado = 'TODOS';

const SECTION_TITLES = {
  dashboard: ['Resumen General del Foro', 'Estadísticas en tiempo real, registros recientes y estado de la plataforma'],
  registros: ['Padrón de Registros de Asistentes y Ponentes', 'Consulta, filtra, agrega, edita o exporta los registros de participantes'],
  constancias: ['Centro de Emisión y Diseño de Constancias', 'Configura firmantes, aprueba constancias y genera documentos oficiales en HD/PDF'],
  envivos: ['Transmisiones En Vivo y Videoteca', 'Administra los enlaces de transmisiones en vivo (YouTube/Facebook/Meet) y videos'],
  ponencias: ['Ponencias Magistrales y Paneles de Expertas', 'Publica y edita conferencias, paneles, ponentes, imágenes y materiales'],
  programa: ['Programa General del Evento', 'Administra los bloques de Recepción, Primer Turno y Segundo Turno'],
  galeria: ['Galería Fotográfica y Ejes Temáticos', 'Sube fotografías del evento y edita los tres ejes estratégicos de participación'],
  config: ['Configuración General y Base de Datos', 'Ajustes institucionales del evento, contacto y respaldos de MongoDB']
};

document.addEventListener('DOMContentLoaded', () => {
  preloadCertLogo();
  if (sessionStorage.getItem('miisteg_admin_auth') === '1') {
    showAdminDashboard();
  }
});

function preloadCertLogo() {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    certLogoImg = img;
    if (currentSection === 'constancias') {
      renderCertStudioCanvas();
    }
  };
  img.src = '/uploads/logo-miisteg-transparent.png';
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const input = document.getElementById('loginPasswordInput');
  const password = (input ? input.value : '').trim();
  if (!password) {
    showToast('Ingresa la contraseña de administrador.');
    return;
  }

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      if (input) input.value = '';
      sessionStorage.setItem('miisteg_admin_auth', '1');
      showAdminDashboard();
      showToast('Sesión iniciada en el Panel de Administración');
      return;
    }
    showToast('Contraseña de administrador incorrecta.');
  } catch (err) {
    showToast('Error al verificar credenciales con el servidor.');
  }
}

function logoutAdmin() {
  sessionStorage.removeItem('miisteg_admin_auth');
  document.getElementById('adminAppLayout').style.display = 'none';
  document.getElementById('adminLoginScreen').style.display = 'flex';
  const input = document.getElementById('loginPasswordInput');
  if (input) input.value = '';
  showToast('Sesión cerrada correctamente');
}

async function showAdminDashboard() {
  document.getElementById('adminLoginScreen').style.display = 'none';
  document.getElementById('adminAppLayout').style.display = 'flex';
  await reloadAdminData();
}

async function reloadAdminData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Error al obtener /api/data');
    appData = await res.json();
    localStorage.setItem('miisteg_backup_db', JSON.stringify(appData));
  } catch (err) {
    const cached = localStorage.getItem('miisteg_backup_db');
    if (cached) appData = JSON.parse(cached);
  }
  updateSidebarBadges();
  renderCurrentSection();
}

async function saveAdminData(partialUpdate, msg = 'Cambios guardados en MongoDB') {
  appData = { ...appData, ...partialUpdate };
  localStorage.setItem('miisteg_backup_db', JSON.stringify(appData));
  try {
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialUpdate)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al guardar');
    if (result.storage) appData.storage = result.storage;
    showToast(msg);
  } catch (err) {
    showToast(msg + ' (respaldo local)');
  }
  updateSidebarBadges();
  renderCurrentSection();
}

function updateSidebarBadges() {
  setText('badgeRegistros', (appData.registros || []).length);
  const aprobadas = (appData.registros || []).filter(r => r.constanciaAprobada).length;
  setText('badgeConstancias', `${aprobadas}/${(appData.registros || []).length}`);
  setText('badgeVideos', (appData.videos || []).length);
  setText('badgePonencias', (appData.ponencias || []).length);
  setText('badgePrograma', (appData.programa || []).length);
  setText('badgeGaleria', (appData.galeria || []).length);

  const dbText = document.getElementById('dbStatusText');
  if (dbText) {
    dbText.textContent = appData.storage === 'mongodb' ? 'MongoDB Conectado' : 'Persistencia Local JSON';
  }
}

function toggleSidebar(open) {
  const sb = document.getElementById('adminSidebar');
  const bd = document.getElementById('sidebarBackdrop');
  if (sb) sb.classList.toggle('open', open);
  if (bd) bd.classList.toggle('open', open);
}

function switchSection(sec, btnEl) {
  currentSection = sec;
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-sec') === sec);
  });
  if (btnEl) btnEl.classList.add('active');
  toggleSidebar(false);

  const [title, sub] = SECTION_TITLES[sec] || ['Panel de Administración', 'MIISTEG 2026'];
  setText('topbarTitle', title);
  setText('topbarSubtitle', sub);
  renderCurrentSection();
}

function renderCurrentSection() {
  const container = document.getElementById('adminMainContent');
  if (!container) return;

  switch (currentSection) {
    case 'dashboard':
      renderDashboardSection(container);
      break;
    case 'registros':
      renderRegistrosSection(container);
      break;
    case 'constancias':
      renderConstanciasSection(container);
      break;
    case 'envivos':
      renderEnVivosSection(container);
      break;
    case 'ponencias':
      renderPonenciasSection(container);
      break;
    case 'programa':
      renderProgramaSection(container);
      break;
    case 'galeria':
      renderGaleriaSection(container);
      break;
    case 'config':
      renderConfigSection(container);
      break;
  }
}

// ============================================================================
// 1. MÓDULO: RESUMEN GENERAL (DASHBOARD)
// ============================================================================
function renderDashboardSection(container) {
  const regs = appData.registros || [];
  const aprobadas = regs.filter(r => r.constanciaAprobada).length;
  const turno1 = regs.filter(r => (r.turno || '').includes('Primer')).length;
  const turno2 = regs.filter(r => (r.turno || '').includes('Segundo')).length;
  const ambosTurnos = regs.filter(r => (r.turno || '').includes('Ambos')).length;
  const cfg = appData.config || {};

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card" onclick="switchSection('registros')">
        <div class="kpi-info">
          <small>Total Registros</small>
          <strong>${regs.length}</strong>
          <span>Asistentes, ponentes y comité</span>
        </div>
        <div class="kpi-icon">👥</div>
      </div>

      <div class="kpi-card" onclick="switchSection('constancias')">
        <div class="kpi-info">
          <small>Constancias Aprobadas</small>
          <strong>${aprobadas} / ${regs.length}</strong>
          <span>${cfg.constanciasLiberadas ? '🟢 Descarga pública abierta' : '🟡 Validación individual'}</span>
        </div>
        <div class="kpi-icon" style="background:rgba(20,184,166,0.2);">🎓</div>
      </div>

      <div class="kpi-card" onclick="switchSection('envivos')">
        <div class="kpi-info">
          <small>En Vivos y Videos</small>
          <strong>${(appData.videos || []).length}</strong>
          <span>${cfg.enVivoActivo ? '🔴 Señal En Vivo Activa' : '⚪ Señal En Vivo Pausada'}</span>
        </div>
        <div class="kpi-icon" style="background:rgba(239,68,68,0.2);">🔴</div>
      </div>

      <div class="kpi-card" onclick="switchSection('ponencias')">
        <div class="kpi-info">
          <small>Ponencias y Paneles</small>
          <strong>${(appData.ponencias || []).length}</strong>
          <span>En 3 Ejes Estratégicos</span>
        </div>
        <div class="kpi-icon" style="background:rgba(245,158,11,0.2);">🎤</div>
      </div>

      <div class="kpi-card" onclick="switchSection('programa')">
        <div class="kpi-info">
          <small>Actividades Programa</small>
          <strong>${(appData.programa || []).length}</strong>
          <span>09:00 a 16:00 hrs</span>
        </div>
        <div class="kpi-icon" style="background:rgba(124,58,237,0.22);">📋</div>
      </div>

      <div class="kpi-card" onclick="switchSection('galeria')">
        <div class="kpi-info">
          <small>Galería Fotográfica</small>
          <strong>${(appData.galeria || []).length}</strong>
          <span>Imágenes publicadas</span>
        </div>
        <div class="kpi-icon" style="background:rgba(6,182,212,0.2);">🖼️</div>
      </div>
    </div>

    <!-- Desglose rápido por turnos y estado de transmisión -->
    <div class="live-studio-grid" style="margin-bottom:1.5rem;">
      <div class="panel-card" style="margin-bottom:0;">
        <div class="panel-header">
          <div>
            <h3>📊 Distribución de Asistentes por Turno</h3>
            <p>Participación registrada para el 7 de diciembre de 2026</p>
          </div>
          <button type="button" class="btn btn-teal btn-sm" onclick="exportarRegistrosCSV()">
            📊 Descargar Padrón Excel (CSV)
          </button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.85rem;">
          <div style="padding:1rem; border-radius:12px; background:rgba(219,39,119,0.12); border:1px solid rgba(219,39,119,0.3);">
            <small style="color:var(--text-muted); display:block;">Primer Turno (10:00–12:45)</small>
            <strong style="font-size:1.55rem; color:#f472b6;">${turno1}</strong>
          </div>
          <div style="padding:1rem; border-radius:12px; background:rgba(13,148,136,0.12); border:1px solid rgba(13,148,136,0.3);">
            <small style="color:var(--text-muted); display:block;">Segundo Turno (13:00–16:00)</small>
            <strong style="font-size:1.55rem; color:#2dd4bf;">${turno2}</strong>
          </div>
          <div style="padding:1rem; border-radius:12px; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3);">
            <small style="color:var(--text-muted); display:block;">Ambos Turnos (Jornada Completa)</small>
            <strong style="font-size:1.55rem; color:#fbbf24;">${ambosTurnos}</strong>
          </div>
        </div>
      </div>

      <div class="panel-card" style="margin-bottom:0;">
        <div class="panel-header">
          <div>
            <h3>🔴 Estado de Transmisión En Vivo</h3>
            <p>${escapeHtml(cfg.enVivoPlataforma || 'YouTube Live / Facebook Live')}</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="switchSection('envivos')">
            ⚙️ Configurar En Vivo
          </button>
        </div>
        <p style="font-size:0.88rem; margin-bottom:0.75rem;">
          <strong>Título:</strong> ${escapeHtml(cfg.enVivoTitulo || 'Transmisión Oficial MIISTEG 2026')}
        </p>
        <p style="font-size:0.82rem; color:var(--cyan-400); word-break:break-all; margin-bottom:0.9rem;">
          🔗 ${escapeHtml(cfg.enVivoUrlDirecta || cfg.transmisionUrl || 'Sin enlace configurado')}
        </p>
        <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-sm ${cfg.enVivoActivo ? 'btn-teal' : 'btn-outline'}" onclick="toggleEnVivoActivo()">
            ${cfg.enVivoActivo ? '🟢 En Vivo Visible en Web (Clic para Ocultar)' : '⚪ En Vivo Oculto (Clic para Mostrar en Web)'}
          </button>
        </div>
      </div>
    </div>

    <!-- Últimos Registros -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3>👥 Últimos Registros Recibidos</h3>
          <p>Vista rápida de participantes registradas recientemente</p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" onclick="abrirModalRegistro()">➕ Nuevo Registro Manual</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="switchSection('registros')">Ver Todos (${regs.length}) →</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Nombre Completo</th>
              <th>Institución / Nivel</th>
              <th>Modalidad / Turno</th>
              <th>Constancia</th>
              <th>Acciones Rápidas</th>
            </tr>
          </thead>
          <tbody>
            ${regs.slice(-8).reverse().map(r => {
              const realIdx = regs.findIndex(item => item.folio === r.folio);
              return `
                <tr>
                  <td><strong style="color:var(--gold-400);">${escapeHtml(r.folio)}</strong></td>
                  <td>
                    <strong>${escapeHtml(r.nombre)}</strong><br/>
                    <small style="color:var(--text-muted);">${escapeHtml(r.email)} • ${escapeHtml(r.telefono || '')}</small>
                  </td>
                  <td>${escapeHtml(r.institucion || '')}<br/><small style="color:var(--cyan-400);">${escapeHtml(r.nivel || '')}</small></td>
                  <td><span class="chip">${escapeHtml(r.rol || 'Asistente')}</span><br/><small>${escapeHtml(r.turno || '')}</small></td>
                  <td>
                    <button type="button" class="btn btn-sm ${r.constanciaAprobada ? 'btn-teal' : 'btn-outline'}" onclick="toggleAprobarConstancia(${realIdx})">
                      ${r.constanciaAprobada ? '✅ Aprobada' : '⏳ Pendiente'}
                    </button>
                  </td>
                  <td>
                    <div style="display:flex; gap:0.35rem;">
                      <button type="button" class="btn btn-gold btn-sm" onclick="abrirConstanciaEnStudio('${escapeHtml(r.folio)}')">🎓 Constancia</button>
                      <button type="button" class="btn btn-outline btn-sm" onclick="abrirModalRegistro(${realIdx})">✏️ Editar</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================================================
// 2. MÓDULO: PADRÓN COMPLETO DE REGISTROS DE ASISTENTES Y PONENTES
// ============================================================================
function renderRegistrosSection(container) {
  const regs = appData.registros || [];

  const filtrados = regs.filter(r => {
    const q = regSearchQuery.toLowerCase();
    const matchQ = !q ||
      (r.folio && r.folio.toLowerCase().includes(q)) ||
      (r.nombre && r.nombre.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.telefono && r.telefono.toLowerCase().includes(q)) ||
      (r.institucion && r.institucion.toLowerCase().includes(q));

    const matchRol = regFilterRol === 'TODOS' || r.rol === regFilterRol;
    const matchTurno = regFilterTurno === 'TODOS' || (r.turno && r.turno.includes(regFilterTurno));
    const matchEstado =
      regFilterEstado === 'TODOS' ||
      (regFilterEstado === 'APROBADA' && r.constanciaAprobada) ||
      (regFilterEstado === 'PENDIENTE' && !r.constanciaAprobada);

    return matchQ && matchRol && matchTurno && matchEstado;
  });

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3>👥 Padrón Oficial de Participantes (${filtrados.length} de ${regs.length})</h3>
          <p>Administra asistentes, alumnas, maestras, ponentes magistrales, panelistas y comité organizador</p>
        </div>
        <div style="display:flex; gap:0.55rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" onclick="abrirModalRegistro()">
            ➕ Registrar Participante
          </button>
          <button type="button" class="btn btn-teal btn-sm" onclick="aprobarTodasLasConstancias()">
            ✅ Aprobar Todas las Constancias
          </button>
          <button type="button" class="btn btn-gold btn-sm" onclick="exportarRegistrosCSV()">
            📊 Exportar a Excel (CSV)
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="imprimirListaAsistencia()">
            🖨️ Imprimir Lista de Asistencia
          </button>
        </div>
      </div>

      <!-- Barra de Búsqueda y Filtros -->
      <div class="filters-bar">
        <input
          type="text"
          class="form-control"
          placeholder="🔍 Buscar por folio, nombre, correo, teléfono o institución..."
          value="${escapeHtml(regSearchQuery)}"
          oninput="regSearchQuery = this.value; renderCurrentSection();"
        />
        <select class="form-control" onchange="regFilterRol = this.value; renderCurrentSection();">
          <option value="TODOS" ${regFilterRol === 'TODOS' ? 'selected' : ''}>Todos los Roles</option>
          <option value="Asistente" ${regFilterRol === 'Asistente' ? 'selected' : ''}>Asistente (Alumna)</option>
          <option value="Docente / Investigadora Asistente" ${regFilterRol === 'Docente / Investigadora Asistente' ? 'selected' : ''}>Docente / Investigadora</option>
          <option value="Ponente Magistral" ${regFilterRol === 'Ponente Magistral' ? 'selected' : ''}>Ponente Magistral</option>
          <option value="Panelista" ${regFilterRol === 'Panelista' ? 'selected' : ''}>Panelista</option>
          <option value="Comité Organizador" ${regFilterRol === 'Comité Organizador' ? 'selected' : ''}>Comité Organizador</option>
          <option value="Invitada Especial" ${regFilterRol === 'Invitada Especial' ? 'selected' : ''}>Invitada Especial</option>
        </select>
        <select class="form-control" onchange="regFilterTurno = this.value; renderCurrentSection();">
          <option value="TODOS" ${regFilterTurno === 'TODOS' ? 'selected' : ''}>Todos los Turnos</option>
          <option value="Primer Turno" ${regFilterTurno === 'Primer Turno' ? 'selected' : ''}>Primer Turno (10:00–12:45)</option>
          <option value="Segundo Turno" ${regFilterTurno === 'Segundo Turno' ? 'selected' : ''}>Segundo Turno (13:00–16:00)</option>
          <option value="Ambos Turnos" ${regFilterTurno === 'Ambos Turnos' ? 'selected' : ''}>Ambos Turnos</option>
        </select>
        <select class="form-control" onchange="regFilterEstado = this.value; renderCurrentSection();">
          <option value="TODOS" ${regFilterEstado === 'TODOS' ? 'selected' : ''}>Constancias: Todas</option>
          <option value="APROBADA" ${regFilterEstado === 'APROBADA' ? 'selected' : ''}>✅ Sólo Aprobadas</option>
          <option value="PENDIENTE" ${regFilterEstado === 'PENDIENTE' ? 'selected' : ''}>⏳ Sólo Pendientes</option>
        </select>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Nombre Completo y Contacto</th>
              <th>Institución y Nivel</th>
              <th>Rol / Turno / Eje</th>
              <th>Ponencia / Proyecto</th>
              <th>Constancia</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${filtrados.map(r => {
              const idx = regs.findIndex(item => item.folio === r.folio);
              return `
                <tr>
                  <td><strong style="color:var(--gold-400);">${escapeHtml(r.folio)}</strong></td>
                  <td>
                    <strong>${escapeHtml(r.nombre)}</strong><br/>
                    <small style="color:var(--text-muted);">✉️ ${escapeHtml(r.email)}</small><br/>
                    <small style="color:var(--cyan-400);">📞 ${escapeHtml(r.telefono || 'S/N')}</small>
                  </td>
                  <td>
                    <strong>${escapeHtml(r.institucion || '')}</strong><br/>
                    <span class="chip teal">${escapeHtml(r.nivel || '')}</span>
                  </td>
                  <td>
                    <span class="chip">${escapeHtml(r.rol || 'Asistente')}</span><br/>
                    <small>${escapeHtml(r.turno || '')}</small><br/>
                    <small style="color:var(--gold-400);">${escapeHtml(r.eje || '')}</small>
                  </td>
                  <td><small>${escapeHtml(r.ponenciaTitulo || '—')}</small></td>
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
                    <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                      <button type="button" class="btn btn-gold btn-sm" title="Ver o Descargar Constancia" onclick="abrirConstanciaEnStudio('${escapeHtml(r.folio)}')">🎓</button>
                      <button type="button" class="btn btn-outline btn-sm" title="Editar Datos" onclick="abrirModalRegistro(${idx})">✏️</button>
                      <button type="button" class="btn btn-danger btn-sm" title="Eliminar Registro" onclick="eliminarItemColeccion('registros', ${idx})">🗑️</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function abrirModalRegistro(editIndex = null) {
  const isEdit = editIndex !== null && editIndex >= 0;
  const r = isEdit ? appData.registros[editIndex] : {
    nombre: '',
    email: '',
    telefono: '',
    institucion: '',
    nivel: 'Educación Superior',
    rol: 'Asistente',
    turno: 'Ambos Turnos (09:30 a 16:00 h)',
    eje: 'EJE 1',
    ponenciaTitulo: '',
    constanciaAprobada: true
  };

  const body = document.getElementById('editModalBody');
  body.innerHTML = `
    <h3 style="margin-bottom:0.4rem; font-size:1.3rem;">
      ${isEdit ? `✏️ Editar Registro (${escapeHtml(r.folio)})` : '➕ Registrar Nueva Participante'}
    </h3>
    <p style="font-size:0.84rem; color:var(--text-muted); margin-bottom:1.25rem;">
      Verifica que el nombre completo incluya los grados académicos exactamente como deben aparecer en su constancia.
    </p>
    <form onsubmit="guardarRegistroModal(event, ${isEdit ? editIndex : 'null'})" class="form-grid">
      <div class="form-group full">
        <label>Nombre Completo (para Constancia Oficial) *</label>
        <input type="text" id="modRegNombre" class="form-control" value="${escapeHtml(r.nombre)}" required />
      </div>
      <div class="form-group">
        <label>Correo Electrónico *</label>
        <input type="email" id="modRegEmail" class="form-control" value="${escapeHtml(r.email)}" required />
      </div>
      <div class="form-group">
        <label>Teléfono / WhatsApp</label>
        <input type="text" id="modRegTel" class="form-control" value="${escapeHtml(r.telefono || '')}" />
      </div>
      <div class="form-group full">
        <label>Institución / Dependencia *</label>
        <input type="text" id="modRegInst" class="form-control" value="${escapeHtml(r.institucion || '')}" required />
      </div>
      <div class="form-group">
        <label>Nivel Educativo / Sector</label>
        <select id="modRegNivel" class="form-control">
          ${['Educación Media Superior', 'Educación Superior', 'Posgrado / Centro de Investigación', 'Sector Público / Sociedad Civil']
            .map(opt => `<option value="${opt}" ${r.nivel === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Modalidad de Participación (Rol en Constancia)</label>
        <select id="modRegRol" class="form-control">
          ${['Asistente', 'Docente / Investigadora Asistente', 'Ponente Magistral', 'Panelista', 'Moderadora', 'Comité Organizador', 'Invitada Especial']
            .map(opt => `<option value="${opt}" ${r.rol === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Turno de Asistencia</label>
        <select id="modRegTurno" class="form-control">
          ${['Ambos Turnos (09:30 a 16:00 h)', 'Primer Turno (10:00 a 12:45 h)', 'Segundo Turno (13:00 a 16:00 h)']
            .map(opt => `<option value="${opt}" ${r.turno === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Eje Temático</label>
        <select id="modRegEje" class="form-control">
          ${['EJE 1', 'EJE 2', 'EJE 3']
            .map(opt => `<option value="${opt}" ${r.eje === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Título de Ponencia, Conferencia o Participación (Opcional, aparece en la constancia)</label>
        <input type="text" id="modRegPonencia" class="form-control" value="${escapeHtml(r.ponenciaTitulo || '')}" />
      </div>
      <div class="form-group full">
        <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
          <input type="checkbox" id="modRegAprobada" ${r.constanciaAprobada ? 'checked' : ''} />
          Constancia aprobada y habilitada para descarga
        </label>
      </div>
      <div class="form-group full" style="display:flex; justify-content:flex-end; gap:0.6rem; margin-top:0.5rem;">
        <button type="button" class="btn btn-outline" onclick="closeEditModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">💾 Guardar Participante</button>
      </div>
    </form>
  `;
  document.getElementById('editModal').classList.add('open');
}

async function guardarRegistroModal(e, editIndex) {
  e.preventDefault();
  const registros = [...(appData.registros || [])];
  const datos = {
    nombre: document.getElementById('modRegNombre').value.trim(),
    email: document.getElementById('modRegEmail').value.trim(),
    telefono: document.getElementById('modRegTel').value.trim(),
    institucion: document.getElementById('modRegInst').value.trim(),
    nivel: document.getElementById('modRegNivel').value,
    rol: document.getElementById('modRegRol').value,
    turno: document.getElementById('modRegTurno').value,
    eje: document.getElementById('modRegEje').value,
    ponenciaTitulo: document.getElementById('modRegPonencia').value.trim(),
    constanciaAprobada: document.getElementById('modRegAprobada').checked
  };

  if (editIndex !== null && registros[editIndex]) {
    registros[editIndex] = { ...registros[editIndex], ...datos };
    closeEditModal();
    await saveAdminData({ registros }, `Registro ${registros[editIndex].folio} actualizado`);
  } else {
    const nextNum = registros.length + 1;
    const nuevo = {
      id: 'reg-' + Date.now(),
      folio: `MIISTEG-2026-${String(nextNum).padStart(4, '0')}`,
      ...datos,
      fechaRegistro: new Date().toISOString()
    };
    registros.push(nuevo);
    closeEditModal();
    await saveAdminData({ registros }, `Participante registrada con folio ${nuevo.folio}`);
  }
}

function imprimirListaAsistencia() {
  const regs = appData.registros || [];
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Habilita las ventanas emergentes para imprimir la lista');
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <title>Lista Oficial de Asistencia — MIISTEG 2026</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h2 { margin-bottom: 4px; color: #4c1d95; }
        p { margin-top: 0; font-size: 13px; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
        th, td { border: 1px solid #999; padding: 7px 9px; text-align: left; }
        th { background: #f3e8ff; }
      </style>
    </head>
    <body>
      <h2>1.er Foro Estatal de Mujeres en la Ciencia y Tecnología (MIISTEG Guerrero)</h2>
      <p>Padrón de Registro y Control de Asistencia • 7 de diciembre de 2026 • Auditorio José Joaquín de Herrera</p>
      <table>
        <thead>
          <tr>
            <th>Folio</th>
            <th>Nombre Completo</th>
            <th>Institución / Nivel</th>
            <th>Modalidad / Turno</th>
            <th>Correo / Teléfono</th>
            <th style="width:120px;">Firma Asistencia</th>
          </tr>
        </thead>
        <tbody>
          ${regs.map(r => `
            <tr>
              <td><strong>${escapeHtml(r.folio)}</strong></td>
              <td>${escapeHtml(r.nombre)}</td>
              <td>${escapeHtml(r.institucion)} (${escapeHtml(r.nivel)})</td>
              <td>${escapeHtml(r.rol)} — ${escapeHtml(r.turno)}</td>
              <td>${escapeHtml(r.email)}<br/>${escapeHtml(r.telefono || '')}</td>
              <td></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `);
  win.document.close();
}

// ============================================================================
// 3. MÓDULO: CENTRO DE CONSTANCIAS Y ESTUDIO DE EMISIÓN
// ============================================================================
function abrirConstanciaEnStudio(folio) {
  selectedCertFolio = folio;
  switchSection('constancias');
}

function renderConstanciasSection(container) {
  const regs = appData.registros || [];
  const cfg = appData.config || {};
  if (!selectedCertFolio && regs.length > 0) {
    selectedCertFolio = regs[0].folio;
  }

  container.innerHTML = `
    <div class="live-studio-grid">
      <!-- Visor y Generador de Constancias en Tiempo Real -->
      <div class="panel-card">
        <div class="panel-header">
          <div>
            <h3>🎓 Estudio y Emisión de Constancias Oficiales</h3>
            <p>Selecciona cualquier participante registrada para previsualizar, descargar o imprimir su constancia</p>
          </div>
        </div>

        <div class="form-grid" style="margin-bottom:1.1rem;">
          <div class="form-group full">
            <label>Seleccionar Participante Registrada (${regs.length} en padrón)</label>
            <select class="form-control" id="studioSelectReg" onchange="selectedCertFolio = this.value; renderCertStudioCanvas();">
              ${regs.map(r => `
                <option value="${escapeHtml(r.folio)}" ${r.folio === selectedCertFolio ? 'selected' : ''}>
                  ${escapeHtml(r.folio)} — ${escapeHtml(r.nombre)} (${escapeHtml(r.rol)}) [${r.constanciaAprobada ? '✅ Aprobada' : '⏳ Pendiente'}]
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-bottom:1rem;">
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-teal btn-sm" onclick="descargarStudioCertPNG()">
              ⬇️ Descargar Constancia PNG (HD)
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="imprimirStudioCertPDF()">
              🖨️ Imprimir / Guardar en PDF
            </button>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-gold btn-sm" onclick="aprobarTodasLasConstancias()">
              ✅ Aprobar Todas (${regs.length})
            </button>
          </div>
        </div>

        <div class="cert-studio-wrap">
          <canvas id="adminCertCanvas" width="1400" height="990"></canvas>
        </div>
      </div>

      <!-- Configuración de Textos y Firmantes de la Constancia -->
      <div class="panel-card">
        <div class="panel-header">
          <div>
            <h3>✒️ Configuración Oficial de las Constancias</h3>
            <p>Personaliza el texto legal, firmantes y liberación global</p>
          </div>
        </div>

        <form onsubmit="guardarConfigConstancias(event)" class="form-grid">
          <div class="form-group full">
            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; background:rgba(20,184,166,0.15); padding:0.75rem; border-radius:10px; border:1px solid rgba(20,184,166,0.35);">
              <input type="checkbox" id="certLiberadasCheck" ${cfg.constanciasLiberadas ? 'checked' : ''} />
              <span><strong>Liberación Global Automática:</strong> Permitir que todas las personas registradas descarguen su constancia en el portal público</span>
            </label>
          </div>

          <div class="form-group full">
            <label>Texto Oficial del Reconocimiento</label>
            <textarea id="certTextoOficial" class="form-control" rows="4" required>${escapeHtml(cfg.textoConstancia || '')}</textarea>
          </div>

          <div class="form-group full">
            <label>Firmante 1 — Nombre y Grado</label>
            <input type="text" id="certFirma1Nombre" class="form-control" value="${escapeHtml(cfg.firmante1Nombre || 'Mtra. Yammel Anilú Martínez Saavedra')}" required />
          </div>

          <div class="form-group full">
            <label>Firmante 1 — Cargo</label>
            <input type="text" id="certFirma1Cargo" class="form-control" value="${escapeHtml(cfg.firmante1Cargo || 'Coordinadora General MIISTEG')}" required />
          </div>

          <div class="form-group full">
            <label>Firmante 2 — Nombre / Órgano</label>
            <input type="text" id="certFirma2Nombre" class="form-control" value="${escapeHtml(cfg.firmante2Nombre || 'Comité Científico y Académico')}" required />
          </div>

          <div class="form-group full">
            <label>Firmante 2 — Cargo</label>
            <input type="text" id="certFirma2Cargo" class="form-control" value="${escapeHtml(cfg.firmante2Cargo || '1.er Foro Estatal de Mujeres en la Ciencia y Tecnología')}" required />
          </div>

          <div class="form-group full">
            <button type="submit" class="btn btn-primary btn-block">
              💾 Guardar Diseño de Constancia y Actualizar Vista Previa
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  renderCertStudioCanvas();
}

async function guardarConfigConstancias(e) {
  e.preventDefault();
  const config = {
    ...appData.config,
    constanciasLiberadas: document.getElementById('certLiberadasCheck').checked,
    textoConstancia: document.getElementById('certTextoOficial').value.trim(),
    firmante1Nombre: document.getElementById('certFirma1Nombre').value.trim(),
    firmante1Cargo: document.getElementById('certFirma1Cargo').value.trim(),
    firmante2Nombre: document.getElementById('certFirma2Nombre').value.trim(),
    firmante2Cargo: document.getElementById('certFirma2Cargo').value.trim()
  };
  await saveAdminData({ config }, 'Diseño y firmantes de constancias actualizados');
}

function renderCertStudioCanvas() {
  const canvas = document.getElementById('adminCertCanvas');
  if (!canvas) return;
  const regs = appData.registros || [];
  const reg = regs.find(r => r.folio === selectedCertFolio) || regs[0];
  if (!reg) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cfg = appData.config || {};

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#fdfcff');
  bgGrad.addColorStop(0.5, '#f8f5ff');
  bgGrad.addColorStop(1, '#f0fdfa');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  if (certLogoImg) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.drawImage(certLogoImg, W / 2 - 210, H / 2 - 210, 420, 420);
    ctx.restore();
  }

  const topGrad = ctx.createLinearGradient(0, 0, W, 0);
  topGrad.addColorStop(0, '#3b0764');
  topGrad.addColorStop(0.45, '#be185d');
  topGrad.addColorStop(1, '#0d9488');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, 28);
  ctx.fillRect(0, H - 28, W, 28);

  ctx.strokeStyle = '#be185d';
  ctx.lineWidth = 4;
  ctx.strokeRect(42, 52, W - 84, H - 104);

  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 64, W - 108, H - 128);

  if (certLogoImg) {
    ctx.drawImage(certLogoImg, 85, 84, 130, 130);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4c1d95';
  ctx.font = '800 25px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('MIISTEG — MUJERES INVESTIGADORAS, INNOVADORAS,', W / 2 + 30, 130);
  ctx.fillText('SIEMPRE TECNOLÓGICAS Y EMPODERADAS DE GUERRERO', W / 2 + 30, 164);

  ctx.fillStyle = '#0d9488';
  ctx.font = '700 17px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('CIENCIA  •  TECNOLOGÍA  •  INNOVACIÓN  •  LIDERAZGO  •  EMPODERAMIENTO', W / 2 + 30, 198);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(230, 224);
  ctx.lineTo(W - 180, 224);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Otorgan la presente', W / 2, 268);

  ctx.fillStyle = '#be185d';
  ctx.font = '900 58px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('C O N S T A N C I A', W / 2, 332);

  ctx.fillStyle = '#1e1b4b';
  ctx.font = '900 38px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`A: ${reg.nombre}`, W / 2, 405, W - 240);

  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(230, 424);
  ctx.lineTo(W - 230, 424);
  ctx.stroke();

  const rolLabel = (reg.rol || 'Asistente').toUpperCase();
  ctx.fillStyle = '#0f766e';
  ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`En calidad de: ${rolLabel}`, W / 2, 470, W - 260);

  if (reg.ponenciaTitulo) {
    ctx.fillStyle = '#4c1d95';
    ctx.font = 'italic 700 21px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`«${reg.ponenciaTitulo}»`, W / 2, 505, W - 260);
  }

  const bodyText = cfg.textoConstancia ||
    'Por su destacada y valiosa participación en el 1.er Foro Estatal de Mujeres en la Ciencia y Tecnología: «Mujeres Innovando el Futuro de Guerrero: Media Superior y Superior».';
  ctx.fillStyle = '#334155';
  ctx.font = '500 21px "Plus Jakarta Sans", sans-serif';
  wrapCanvasText(ctx, bodyText, W / 2, reg.ponenciaTitulo ? 550 : 530, W - 260, 32);

  ctx.fillStyle = '#1e1b4b';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `${cfg.sede || 'Auditorio José Joaquín de Herrera'} • ${cfg.ciudad || 'Chilpancingo de los Bravo, Guerrero'} • ${cfg.fechaTexto || '7 de diciembre de 2026'}`,
    W / 2,
    690
  );

  ctx.fillStyle = '#be185d';
  ctx.font = 'italic 700 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('«¡Unidas por la ciencia, conectadas por la innovación y comprometidas con Guerrero!»', W / 2, 725);

  const yFirma = 810;
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.moveTo(190, yFirma);
  ctx.lineTo(570, yFirma);
  ctx.stroke();

  ctx.fillStyle = '#1e1b4b';
  ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(cfg.firmante1Nombre || 'Mtra. Yammel Anilú Martínez Saavedra', 380, yFirma + 26, 430);
  ctx.fillStyle = '#334155';
  ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(cfg.firmante1Cargo || 'Coordinadora General MIISTEG', 380, yFirma + 48, 430);

  ctx.beginPath();
  ctx.moveTo(830, yFirma);
  ctx.lineTo(1210, yFirma);
  ctx.stroke();

  ctx.fillStyle = '#1e1b4b';
  ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(cfg.firmante2Nombre || 'Comité Científico y Organizador', 1020, yFirma + 26, 430);
  ctx.fillStyle = '#334155';
  ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(cfg.firmante2Cargo || '1.er Foro Estatal de Mujeres en la Ciencia y Tecnología', 1020, yFirma + 48, 430);

  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, yFirma - 5, 50, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#be185d';
  ctx.stroke();
  if (certLogoImg) {
    ctx.drawImage(certLogoImg, W / 2 - 36, yFirma - 41, 72, 72);
  }
  ctx.restore();

  // Cintillo de Folio dentro del marco dorado (sin cruzar ninguna línea)
  ctx.fillStyle = 'rgba(76, 29, 149, 0.08)';
  ctx.fillRect(140, 880, W - 280, 32);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1e1b4b';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `FOLIO DE VERIFICACIÓN: ${reg.folio}   •   INSTITUCIÓN: ${reg.institucion || 'Guerrero'}`,
    W / 2,
    901,
    W - 310
  );
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

function descargarStudioCertPNG() {
  const canvas = document.getElementById('adminCertCanvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `Constancia-${selectedCertFolio || 'MIISTEG'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Constancia descargada en PNG HD');
}

function imprimirStudioCertPDF() {
  const canvas = document.getElementById('adminCertCanvas');
  if (!canvas) return;
  const dataUrl = canvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Constancia Oficial ${escapeHtml(selectedCertFolio)}</title>
      <style>
        @page { size: landscape; margin: 0; }
        body { margin: 0; display:flex; align-items:center; justify-content:center; height:100vh; background:#fff; }
        img { max-width:100%; max-height:100vh; object-fit:contain; }
      </style>
    </head>
    <body><img src="${dataUrl}" onload="window.print();" /></body>
    </html>
  `);
  win.document.close();
}

// ============================================================================
// 4. MÓDULO: TRANSMISIONES EN VIVO (ENLACES DE EN VIVOS) Y VIDEOTECA
// ============================================================================
function renderEnVivosSection(container) {
  const cfg = appData.config || {};
  const videos = appData.videos || [];

  container.innerHTML = `
    <!-- Panel de Control de la Transmisión En Vivo Principal -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3>🔴 Configuración de la Señal En Vivo Principal (En Vivos)</h3>
          <p>Configura el enlace de YouTube Live, Facebook Live, Meet o Zoom que verán los asistentes en la página principal</p>
        </div>
        <button type="button" class="btn btn-sm ${cfg.enVivoActivo ? 'btn-teal' : 'btn-outline'}" onclick="toggleEnVivoActivo()">
          ${cfg.enVivoActivo ? '🟢 Señal En Vivo ACTIVA en el Portal' : '⚪ Señal En Vivo OCULTA en el Portal'}
        </button>
      </div>

      <div class="live-studio-grid">
        <form onsubmit="guardarEnVivoConfig(event)" class="form-grid">
          <div class="form-group full">
            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; background:rgba(239,68,68,0.15); padding:0.75rem; border-radius:10px; border:1px solid rgba(239,68,68,0.35);">
              <input type="checkbox" id="liveActivoCheck" ${cfg.enVivoActivo ? 'checked' : ''} />
              <span><strong>Mostrar reproductor y alerta "¡ESTAMOS EN VIVO!"</strong> en la portada del sitio web</span>
            </label>
          </div>

          <div class="form-group full">
            <label>Título de la Transmisión En Vivo *</label>
            <input type="text" id="liveTitulo" class="form-control" value="${escapeHtml(cfg.enVivoTitulo || 'Transmisión En Vivo — 1.er Foro Estatal de Mujeres en la Ciencia y Tecnología')}" required />
          </div>

          <div class="form-group">
            <label>Plataforma del En Vivo</label>
            <select id="livePlataforma" class="form-control">
              ${['YouTube Live', 'Facebook Live', 'YouTube Live / Facebook Live', 'Google Meet / Zoom', 'Transmisión Especial MIISTEG']
                .map(p => `<option value="${p}" ${cfg.enVivoPlataforma === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Enlace Directo Externo (para botón "Abrir En Vivo")</label>
            <input type="text" id="liveUrlDirecta" class="form-control" placeholder="https://www.youtube.com/watch?v=... o Facebook Live" value="${escapeHtml(cfg.enVivoUrlDirecta || '')}" />
          </div>

          <div class="form-group full">
            <label>Enlace del Video / Stream para Reproductor Embebido (YouTube watch, youtu.be o embed) *</label>
            <input type="text" id="liveEmbedUrl" class="form-control" placeholder="https://www.youtube.com/watch?v=..." value="${escapeHtml(cfg.transmisionUrl || '')}" required />
            <small style="color:var(--text-muted); font-size:0.76rem;">Puedes pegar cualquier link normal de YouTube y el sistema lo convierte automáticamente a formato embebido.</small>
          </div>

          <div class="form-group full">
            <button type="submit" class="btn btn-primary">
              💾 Guardar Configuración de Transmisión En Vivo
            </button>
          </div>
        </form>

        <div>
          <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.5rem; color:var(--gold-400);">
            📺 Monitor de Señal En Vivo Actual:
          </label>
          <div class="video-preview-box">
            <iframe
              src="${escapeHtml(normalizeYoutubeEmbed(cfg.transmisionUrl || 'https://www.youtube.com/embed/jfKfPfyJRdk'))}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      </div>
    </div>

    <!-- Gestión de Videoteca, Grabaciones y Enlaces de Sesiones -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3>🎬 Videoteca, Grabaciones de Conferencias y Cápsulas STEAM (${videos.length})</h3>
          <p>Agrega o edita videos de ponencias, enlaces a transmisiones por turno o cápsulas de divulgación</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="abrirModalVideo()">
          ➕ Agregar Nuevo Video / En Vivo
        </button>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Título del Video / Transmisión</th>
              <th>Categoría / Duración</th>
              <th>Ponente / Responsable</th>
              <th>Enlace Embebido</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${videos.map((v, idx) => `
              <tr>
                <td>
                  <strong>${escapeHtml(v.titulo)}</strong><br/>
                  <small style="color:var(--text-muted);">${escapeHtml(v.descripcion || '')}</small>
                </td>
                <td>
                  <span class="chip teal">${escapeHtml(v.categoria || 'Video')}</span><br/>
                  <small>${escapeHtml(v.duracion || '')}</small>
                </td>
                <td>${escapeHtml(v.ponente || 'MIISTEG Guerrero')}</td>
                <td><small style="color:var(--cyan-400); word-break:break-all;">${escapeHtml(v.url)}</small></td>
                <td>
                  <div style="display:flex; gap:0.35rem;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="abrirModalVideo(${idx})">✏️ Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarItemColeccion('videos', ${idx})">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function toggleEnVivoActivo() {
  const config = {
    ...appData.config,
    enVivoActivo: !appData.config.enVivoActivo
  };
  await saveAdminData({ config }, config.enVivoActivo ? 'Señal En Vivo activada en el portal' : 'Señal En Vivo ocultada del portal');
}

async function guardarEnVivoConfig(e) {
  e.preventDefault();
  const rawEmbed = document.getElementById('liveEmbedUrl').value.trim();
  const rawDirect = document.getElementById('liveUrlDirecta').value.trim();
  const config = {
    ...appData.config,
    enVivoActivo: document.getElementById('liveActivoCheck').checked,
    enVivoTitulo: document.getElementById('liveTitulo').value.trim(),
    enVivoPlataforma: document.getElementById('livePlataforma').value,
    enVivoUrlDirecta: rawDirect || rawEmbed,
    transmisionUrl: normalizeYoutubeEmbed(rawEmbed)
  };
  await saveAdminData({ config }, 'Transmisión En Vivo actualizada');
}

function abrirModalVideo(editIdx = null) {
  const isEdit = editIdx !== null && editIdx >= 0;
  const v = isEdit ? appData.videos[editIdx] : {
    titulo: '',
    categoria: 'Transmisión en Vivo / Magistral',
    ponente: 'Comité Organizador MIISTEG',
    duracion: 'En vivo / Grabación',
    url: '',
    descripcion: ''
  };

  document.getElementById('editModalBody').innerHTML = `
    <h3 style="margin-bottom:1rem;">${isEdit ? '✏️ Editar Video / Enlace de Transmisión' : '➕ Agregar Video o Enlace de En Vivo'}</h3>
    <form onsubmit="guardarVideoModal(event, ${isEdit ? editIdx : 'null'})" class="form-grid">
      <div class="form-group full">
        <label>Título del Video o Transmisión *</label>
        <input type="text" id="modVidTitulo" class="form-control" value="${escapeHtml(v.titulo)}" required />
      </div>
      <div class="form-group full">
        <label>Enlace de YouTube (watch, live, youtu.be o embed) *</label>
        <input type="text" id="modVidUrl" class="form-control" placeholder="https://www.youtube.com/watch?v=..." value="${escapeHtml(v.url)}" required />
      </div>
      <div class="form-group">
        <label>Categoría</label>
        <input type="text" id="modVidCat" class="form-control" value="${escapeHtml(v.categoria || '')}" />
      </div>
      <div class="form-group">
        <label>Duración / Estado</label>
        <input type="text" id="modVidDur" class="form-control" value="${escapeHtml(v.duracion || '')}" placeholder="Ej. En vivo / 45 min" />
      </div>
      <div class="form-group full">
        <label>Ponente / Autor</label>
        <input type="text" id="modVidPon" class="form-control" value="${escapeHtml(v.ponente || '')}" />
      </div>
      <div class="form-group full">
        <label>Descripción</label>
        <textarea id="modVidDesc" class="form-control" rows="2">${escapeHtml(v.descripcion || '')}</textarea>
      </div>
      <div class="form-group full" style="display:flex; justify-content:flex-end; gap:0.6rem;">
        <button type="button" class="btn btn-outline" onclick="closeEditModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">💾 Guardar Video</button>
      </div>
    </form>
  `;
  document.getElementById('editModal').classList.add('open');
}

async function guardarVideoModal(e, editIdx) {
  e.preventDefault();
  const videos = [...(appData.videos || [])];
  const item = {
    id: editIdx !== null && videos[editIdx] ? videos[editIdx].id : 'vid-' + Date.now(),
    titulo: document.getElementById('modVidTitulo').value.trim(),
    url: normalizeYoutubeEmbed(document.getElementById('modVidUrl').value.trim()),
    categoria: document.getElementById('modVidCat').value.trim() || 'Conferencia',
    duracion: document.getElementById('modVidDur').value.trim(),
    ponente: document.getElementById('modVidPon').value.trim(),
    descripcion: document.getElementById('modVidDesc').value.trim()
  };

  if (editIdx !== null && videos[editIdx]) {
    videos[editIdx] = item;
  } else {
    videos.push(item);
  }
  closeEditModal();
  await saveAdminData({ videos }, 'Videoteca actualizada');
}

// ============================================================================
// 5. MÓDULO: PONENCIAS, CONFERENCIAS MAGISTRALES Y PANELES
// ============================================================================
function renderPonenciasSection(container) {
  const list = appData.ponencias || [];

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3>🎤 Ponencias Magistrales, Paneles y Talleres (${list.length})</h3>
          <p>Administra la información de las conferencias, ponentes, horarios, portadas y enlaces a presentaciones o videos</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="abrirModalPonencia()">
          ➕ Nueva Ponencia / Panel
        </button>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Portada</th>
              <th>Eje / Tipo / Turno</th>
              <th>Título y Resumen</th>
              <th>Ponente e Institución</th>
              <th>Horario</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((p, idx) => `
              <tr>
                <td>
                  <img src="${escapeHtml(p.imagen || '/uploads/ponencia-saberes-locales.jpg')}" alt="" style="width:80px; height:52px; object-fit:cover; border-radius:8px;" />
                </td>
                <td>
                  <span class="chip">${escapeHtml(p.eje)}</span>
                  <span class="chip teal">${escapeHtml(p.tipo || 'Conferencia')}</span><br/>
                  <small>${escapeHtml(p.turno || '')}</small>
                </td>
                <td>
                  <strong>${escapeHtml(p.titulo)}</strong><br/>
                  <small style="color:var(--text-muted);">${escapeHtml((p.resumen || '').slice(0, 110))}...</small>
                </td>
                <td>
                  <strong style="color:var(--gold-400);">${escapeHtml(p.ponente)}</strong><br/>
                  <small>${escapeHtml(p.institucion || '')}</small>
                </td>
                <td><strong>${escapeHtml(p.horario || '')}</strong></td>
                <td>
                  <div style="display:flex; gap:0.35rem;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="abrirModalPonencia(${idx})">✏️ Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarItemColeccion('ponencias', ${idx})">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function abrirModalPonencia(editIdx = null) {
  const isEdit = editIdx !== null && editIdx >= 0;
  const p = isEdit ? appData.ponencias[editIdx] : {
    titulo: '',
    tipo: 'Conferencia Magistral',
    ponente: '',
    institucion: '',
    eje: 'EJE 1',
    turno: 'Primer Turno',
    horario: '10:15 – 11:35 h',
    resumen: '',
    imagen: '/uploads/ponencia-saberes-locales.jpg',
    documentoUrl: '#programa',
    videoUrl: ''
  };

  document.getElementById('editModalBody').innerHTML = `
    <h3 style="margin-bottom:1rem;">${isEdit ? '✏️ Editar Ponencia o Panel' : '➕ Publicar Nueva Ponencia o Panel'}</h3>
    <form onsubmit="guardarPonenciaModal(event, ${isEdit ? editIdx : 'null'})" class="form-grid">
      <div class="form-group full">
        <label>Título de la Conferencia, Ponencia o Panel *</label>
        <input type="text" id="modPonTitulo" class="form-control" value="${escapeHtml(p.titulo)}" required />
      </div>
      <div class="form-group">
        <label>Ponente(s) / Panelistas *</label>
        <input type="text" id="modPonPonente" class="form-control" value="${escapeHtml(p.ponente)}" required />
      </div>
      <div class="form-group">
        <label>Institución de Procedencia</label>
        <input type="text" id="modPonInst" class="form-control" value="${escapeHtml(p.institucion || '')}" />
      </div>
      <div class="form-group">
        <label>Eje Temático</label>
        <select id="modPonEje" class="form-control">
          <option value="EJE 1" ${p.eje === 'EJE 1' ? 'selected' : ''}>EJE 1: Investigación de Impacto y Saberes Locales</option>
          <option value="EJE 2" ${p.eje === 'EJE 2' ? 'selected' : ''}>EJE 2: Educación STEAM</option>
          <option value="EJE 3" ${p.eje === 'EJE 3' ? 'selected' : ''}>EJE 3: Empoderamiento y Liderazgo</option>
        </select>
      </div>
      <div class="form-group">
        <label>Tipo de Actividad</label>
        <select id="modPonTipo" class="form-control">
          ${['Conferencia Magistral', 'Panel de Expertas', 'Ponencia Oral', 'Taller STEAM', 'Mesa de Diálogo']
            .map(t => `<option value="${t}" ${p.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Turno</label>
        <select id="modPonTurno" class="form-control">
          <option value="Primer Turno" ${p.turno === 'Primer Turno' ? 'selected' : ''}>Primer Turno (10:00 – 12:45 h)</option>
          <option value="Segundo Turno" ${p.turno === 'Segundo Turno' ? 'selected' : ''}>Segundo Turno (13:00 – 16:00 h)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Horario</label>
        <input type="text" id="modPonHorario" class="form-control" value="${escapeHtml(p.horario || '')}" />
      </div>
      <div class="form-group full">
        <label>Resumen / Descripción</label>
        <textarea id="modPonResumen" class="form-control" rows="3">${escapeHtml(p.resumen || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Subir Nueva Imagen desde tu Computadora</label>
        <input type="file" id="modPonFile" class="form-control" accept="image/*" />
      </div>
      <div class="form-group">
        <label>O URL de Imagen de Portada</label>
        <input type="text" id="modPonImgUrl" class="form-control" value="${escapeHtml(p.imagen || '')}" />
      </div>
      <div class="form-group">
        <label>Enlace a Presentación / Material PDF</label>
        <input type="text" id="modPonDocUrl" class="form-control" value="${escapeHtml(p.documentoUrl || '')}" />
      </div>
      <div class="form-group">
        <label>Enlace a Video / Transmisión de la Ponencia</label>
        <input type="text" id="modPonVideoUrl" class="form-control" value="${escapeHtml(p.videoUrl || '')}" placeholder="https://www.youtube.com/watch?v=..." />
      </div>
      <div class="form-group full" style="display:flex; justify-content:flex-end; gap:0.6rem;">
        <button type="button" class="btn btn-outline" onclick="closeEditModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">💾 Guardar Ponencia</button>
      </div>
    </form>
  `;
  document.getElementById('editModal').classList.add('open');
}

async function guardarPonenciaModal(e, editIdx) {
  e.preventDefault();
  const uploaded = await uploadFileHelper(document.getElementById('modPonFile'));
  const ponencias = [...(appData.ponencias || [])];
  const item = {
    id: editIdx !== null && ponencias[editIdx] ? ponencias[editIdx].id : 'pon-' + Date.now(),
    titulo: document.getElementById('modPonTitulo').value.trim(),
    ponente: document.getElementById('modPonPonente').value.trim(),
    institucion: document.getElementById('modPonInst').value.trim(),
    eje: document.getElementById('modPonEje').value,
    tipo: document.getElementById('modPonTipo').value,
    turno: document.getElementById('modPonTurno').value,
    horario: document.getElementById('modPonHorario').value.trim(),
    resumen: document.getElementById('modPonResumen').value.trim(),
    imagen: uploaded || document.getElementById('modPonImgUrl').value.trim() || '/uploads/ponencia-saberes-locales.jpg',
    documentoUrl: document.getElementById('modPonDocUrl').value.trim(),
    videoUrl: document.getElementById('modPonVideoUrl').value.trim()
  };

  if (editIdx !== null && ponencias[editIdx]) {
    ponencias[editIdx] = item;
  } else {
    ponencias.push(item);
  }
  closeEditModal();
  await saveAdminData({ ponencias }, 'Ponencias actualizadas');
}

// ============================================================================
// 6. MÓDULO: PROGRAMA GENERAL
// ============================================================================
function renderProgramaSection(container) {
  const list = appData.programa || [];

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3>📋 Cronograma del Programa General (${list.length} bloques)</h3>
          <p>Edita horarios, actividades y duraciones de Recepción, Primer Turno y Segundo Turno</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="abrirModalPrograma()">
          ➕ Agregar Actividad al Programa
        </button>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Bloque / Turno</th>
              <th>Horario</th>
              <th>Actividad y Detalle</th>
              <th>Duración</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((item, idx) => `
              <tr>
                <td>
                  <div style="display:flex; gap:0.25rem;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="moverItemPrograma(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="moverItemPrograma(${idx}, 1)" ${idx === list.length - 1 ? 'disabled' : ''}>↓</button>
                  </div>
                </td>
                <td><span class="chip">${escapeHtml(item.turno)}</span></td>
                <td><strong>${escapeHtml(item.horario)}</strong></td>
                <td>
                  <strong>${escapeHtml(item.actividad)}</strong><br/>
                  <small style="color:var(--text-muted);">${escapeHtml(item.detalle || '')}</small>
                </td>
                <td><span class="chip teal">${escapeHtml(item.duracion || '')}</span></td>
                <td>
                  <div style="display:flex; gap:0.35rem;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="abrirModalPrograma(${idx})">✏️ Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarItemColeccion('programa', ${idx})">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function abrirModalPrograma(editIdx = null) {
  const isEdit = editIdx !== null && editIdx >= 0;
  const item = isEdit ? appData.programa[editIdx] : {
    turno: 'turno1',
    horario: '10:00 – 10:30 h',
    duracion: '30 min',
    actividad: '',
    detalle: ''
  };

  document.getElementById('editModalBody').innerHTML = `
    <h3 style="margin-bottom:1rem;">${isEdit ? '✏️ Editar Actividad del Programa' : '➕ Agregar Actividad al Programa'}</h3>
    <form onsubmit="guardarProgramaModal(event, ${isEdit ? editIdx : 'null'})" class="form-grid">
      <div class="form-group">
        <label>Bloque / Turno</label>
        <select id="modProgTurno" class="form-control">
          <option value="recepcion" ${item.turno === 'recepcion' ? 'selected' : ''}>Recepción (09:00 – 10:00 h)</option>
          <option value="turno1" ${item.turno === 'turno1' ? 'selected' : ''}>Primer Turno (10:00 – 12:45 h)</option>
          <option value="turno2" ${item.turno === 'turno2' ? 'selected' : ''}>Segundo Turno (13:00 – 16:00 h)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Horario (ej. 10:15 – 11:35 h) *</label>
        <input type="text" id="modProgHorario" class="form-control" value="${escapeHtml(item.horario)}" required />
      </div>
      <div class="form-group">
        <label>Nombre de la Actividad *</label>
        <input type="text" id="modProgAct" class="form-control" value="${escapeHtml(item.actividad)}" required />
      </div>
      <div class="form-group">
        <label>Duración (ej. 1 h 20 min)</label>
        <input type="text" id="modProgDur" class="form-control" value="${escapeHtml(item.duracion || '')}" />
      </div>
      <div class="form-group full">
        <label>Detalle / Descripción de la Actividad</label>
        <textarea id="modProgDet" class="form-control" rows="2">${escapeHtml(item.detalle || '')}</textarea>
      </div>
      <div class="form-group full" style="display:flex; justify-content:flex-end; gap:0.6rem;">
        <button type="button" class="btn btn-outline" onclick="closeEditModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">💾 Guardar Actividad</button>
      </div>
    </form>
  `;
  document.getElementById('editModal').classList.add('open');
}

async function guardarProgramaModal(e, editIdx) {
  e.preventDefault();
  const programa = [...(appData.programa || [])];
  const turno = document.getElementById('modProgTurno').value;
  const bloquesMap = {
    recepcion: 'Recepción y Registro',
    turno1: 'Primer Turno | 10:00 a 12:45 Horas',
    turno2: 'Segundo Turno | 13:00 a 16:00 Horas'
  };
  const nuevo = {
    id: editIdx !== null && programa[editIdx] ? programa[editIdx].id : 'prog-' + Date.now(),
    bloque: bloquesMap[turno],
    turno,
    horario: document.getElementById('modProgHorario').value.trim(),
    actividad: document.getElementById('modProgAct').value.trim(),
    duracion: document.getElementById('modProgDur').value.trim(),
    detalle: document.getElementById('modProgDet').value.trim()
  };

  if (editIdx !== null && programa[editIdx]) {
    programa[editIdx] = nuevo;
  } else {
    programa.push(nuevo);
  }
  closeEditModal();
  await saveAdminData({ programa }, 'Programa general actualizado');
}

async function moverItemPrograma(idx, dir) {
  const programa = [...(appData.programa || [])];
  const target = idx + dir;
  if (target < 0 || target >= programa.length) return;
  const temp = programa[idx];
  programa[idx] = programa[target];
  programa[target] = temp;
  await saveAdminData({ programa }, 'Orden del programa actualizado');
}

// ============================================================================
// 7. MÓDULO: GALERÍA FOTOGRÁFICA Y EJES TEMÁTICOS
// ============================================================================
function renderGaleriaSection(container) {
  const galeria = appData.galeria || [];
  const ejes = appData.ejes || [];

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3>🖼️ Galería Fotográfica del Foro (${galeria.length} imágenes)</h3>
          <p>Sube fotografías directamente desde tu computadora (se guardan en MongoDB) o edita las existentes</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="abrirModalGaleria()">
          ➕ Subir Nueva Fotografía
        </button>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Vista Previa</th>
              <th>Título y Descripción</th>
              <th>Categoría</th>
              <th>Ruta / Archivo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${galeria.map((g, idx) => `
              <tr>
                <td><img src="${escapeHtml(g.url)}" alt="" style="width:86px; height:56px; object-fit:cover; border-radius:8px;" /></td>
                <td>
                  <strong>${escapeHtml(g.titulo)}</strong><br/>
                  <small style="color:var(--text-muted);">${escapeHtml(g.descripcion || '')}</small>
                </td>
                <td><span class="chip teal">${escapeHtml(g.categoria || 'Galería')}</span></td>
                <td><small style="color:var(--cyan-400);">${escapeHtml(g.url)}</small></td>
                <td>
                  <div style="display:flex; gap:0.35rem;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="abrirModalGaleria(${idx})">✏️ Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarItemColeccion('galeria', ${idx})">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Editor de los 3 Ejes Temáticos -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3>🔬 Los 3 Grandes Ejes de Participación</h3>
          <p>Personaliza los títulos, descripciones e imágenes contextuales de cada eje temático</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Eje</th>
              <th>Título y Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${ejes.map((e, idx) => `
              <tr>
                <td><img src="${escapeHtml(e.imagen || '/uploads/ponencia-saberes-locales.jpg')}" alt="" style="width:80px; height:52px; object-fit:cover; border-radius:8px;" /></td>
                <td><span class="chip" style="background:${escapeHtml(e.color || '#db2777')}; color:#fff;">${escapeHtml(e.numero)}</span></td>
                <td>
                  <strong>${escapeHtml(e.titulo)}</strong><br/>
                  <small style="color:var(--text-muted);">${escapeHtml(e.descripcion)}</small>
                </td>
                <td>
                  <button type="button" class="btn btn-outline btn-sm" onclick="abrirModalEje(${idx})">✏️ Editar Eje</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function abrirModalGaleria(editIdx = null) {
  const isEdit = editIdx !== null && editIdx >= 0;
  const g = isEdit ? appData.galeria[editIdx] : {
    titulo: '',
    categoria: 'Memoria Fotográfica MIISTEG',
    descripcion: '',
    url: ''
  };

  document.getElementById('editModalBody').innerHTML = `
    <h3 style="margin-bottom:1rem;">${isEdit ? '✏️ Editar Imagen de la Galería' : '➕ Subir Imagen a la Galería'}</h3>
    <form onsubmit="guardarGaleriaModal(event, ${isEdit ? editIdx : 'null'})" class="form-grid">
      <div class="form-group full">
        <label>Título de la Fotografía *</label>
        <input type="text" id="modGalTitulo" class="form-control" value="${escapeHtml(g.titulo)}" required />
      </div>
      <div class="form-group">
        <label>Categoría</label>
        <input type="text" id="modGalCat" class="form-control" value="${escapeHtml(g.categoria || '')}" />
      </div>
      <div class="form-group">
        <label>Subir Archivo desde tu Computadora</label>
        <input type="file" id="modGalFile" class="form-control" accept="image/*" />
      </div>
      <div class="form-group full">
        <label>O URL de la Imagen</label>
        <input type="text" id="modGalUrl" class="form-control" value="${escapeHtml(g.url || '')}" placeholder="/uploads/..." />
      </div>
      <div class="form-group full">
        <label>Descripción</label>
        <textarea id="modGalDesc" class="form-control" rows="2">${escapeHtml(g.descripcion || '')}</textarea>
      </div>
      <div class="form-group full" style="display:flex; justify-content:flex-end; gap:0.6rem;">
        <button type="button" class="btn btn-outline" onclick="closeEditModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">💾 Guardar en Galería</button>
      </div>
    </form>
  `;
  document.getElementById('editModal').classList.add('open');
}

async function guardarGaleriaModal(e, editIdx) {
  e.preventDefault();
  const uploaded = await uploadFileHelper(document.getElementById('modGalFile'));
  const galeria = [...(appData.galeria || [])];
  const item = {
    id: editIdx !== null && galeria[editIdx] ? galeria[editIdx].id : 'gal-' + Date.now(),
    titulo: document.getElementById('modGalTitulo').value.trim(),
    categoria: document.getElementById('modGalCat').value.trim() || 'Galería MIISTEG',
    descripcion: document.getElementById('modGalDesc').value.trim(),
    url: uploaded || document.getElementById('modGalUrl').value.trim() || '/uploads/ponencia-saberes-locales.jpg',
    fecha: new Date().toISOString().slice(0, 10)
  };

  if (editIdx !== null && galeria[editIdx]) {
    galeria[editIdx] = item;
  } else {
    galeria.unshift(item);
  }
  closeEditModal();
  await saveAdminData({ galeria }, 'Galería fotográfica actualizada');
}

function abrirModalEje(idx) {
  const e = appData.ejes[idx];
  if (!e) return;
  document.getElementById('editModalBody').innerHTML = `
    <h3 style="margin-bottom:1rem;">✏️ Editar ${escapeHtml(e.numero)}</h3>
    <form onsubmit="guardarEjeModal(event, ${idx})" class="form-grid">
      <div class="form-group">
        <label>Identificador (ej. EJE 1)</label>
        <input type="text" id="modEjeNum" class="form-control" value="${escapeHtml(e.numero)}" required />
      </div>
      <div class="form-group">
        <label>Color Distintivo (Hex)</label>
        <input type="text" id="modEjeColor" class="form-control" value="${escapeHtml(e.color || '#0d9488')}" />
      </div>
      <div class="form-group full">
        <label>Título del Eje *</label>
        <input type="text" id="modEjeTitulo" class="form-control" value="${escapeHtml(e.titulo)}" required />
      </div>
      <div class="form-group full">
        <label>Descripción</label>
        <textarea id="modEjeDesc" class="form-control" rows="3">${escapeHtml(e.descripcion)}</textarea>
      </div>
      <div class="form-group">
        <label>Subir Nueva Imagen Contextual</label>
        <input type="file" id="modEjeFile" class="form-control" accept="image/*" />
      </div>
      <div class="form-group">
        <label>URL de Imagen Contextual</label>
        <input type="text" id="modEjeImg" class="form-control" value="${escapeHtml(e.imagen || '')}" />
      </div>
      <div class="form-group full" style="display:flex; justify-content:flex-end; gap:0.6rem;">
        <button type="button" class="btn btn-outline" onclick="closeEditModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">💾 Guardar Eje</button>
      </div>
    </form>
  `;
  document.getElementById('editModal').classList.add('open');
}

async function guardarEjeModal(e, idx) {
  e.preventDefault();
  const uploaded = await uploadFileHelper(document.getElementById('modEjeFile'));
  const ejes = [...(appData.ejes || [])];
  ejes[idx] = {
    ...ejes[idx],
    numero: document.getElementById('modEjeNum').value.trim(),
    color: document.getElementById('modEjeColor').value.trim(),
    titulo: document.getElementById('modEjeTitulo').value.trim(),
    descripcion: document.getElementById('modEjeDesc').value.trim(),
    imagen: uploaded || document.getElementById('modEjeImg').value.trim()
  };
  closeEditModal();
  await saveAdminData({ ejes }, 'Eje temático actualizado');
}

// ============================================================================
// 8. MÓDULO: CONFIGURACIÓN GENERAL Y RESPALDOS DE BASE DE DATOS
// ============================================================================
function renderConfigSection(container) {
  const c = appData.config || {};

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3>⚙️ Datos Generales del Evento, Sede y Contacto Oficial</h3>
          <p>Toda esta información actualiza de inmediato la portada, pie de página y fichas informativas del portal</p>
        </div>
      </div>

      <form onsubmit="guardarConfigGeneral(event)" class="form-grid">
        <div class="form-group">
          <label>Siglas Oficiales</label>
          <input type="text" id="cfgSiglas" class="form-control" value="${escapeHtml(c.siglas || 'MIISTEG')}" required />
        </div>
        <div class="form-group">
          <label>Significado de las Siglas</label>
          <input type="text" id="cfgSignificado" class="form-control" value="${escapeHtml(c.significadoSiglas || '')}" />
        </div>
        <div class="form-group full">
          <label>Lema Superior</label>
          <input type="text" id="cfgLema" class="form-control" value="${escapeHtml(c.lemaSuperior || '')}" />
        </div>
        <div class="form-group full">
          <label>Título Principal del Evento *</label>
          <input type="text" id="cfgTitulo" class="form-control" value="${escapeHtml(c.titulo || '')}" required />
        </div>
        <div class="form-group full">
          <label>Subtítulo</label>
          <input type="text" id="cfgSubtitulo" class="form-control" value="${escapeHtml(c.subtitulo || '')}" />
        </div>
        <div class="form-group full">
          <label>Descripción General</label>
          <textarea id="cfgDescripcion" class="form-control" rows="2">${escapeHtml(c.descripcion || '')}</textarea>
        </div>
        <div class="form-group full">
          <label>Eslogan Institucional</label>
          <input type="text" id="cfgEslogan" class="form-control" value="${escapeHtml(c.eslogan || '')}" />
        </div>
        <div class="form-group">
          <label>Fecha (Texto Visible)</label>
          <input type="text" id="cfgFechaTexto" class="form-control" value="${escapeHtml(c.fechaTexto || '7 de diciembre de 2026')}" />
        </div>
        <div class="form-group">
          <label>Fecha y Hora ISO (para Cuenta Regresiva)</label>
          <input type="text" id="cfgFechaISO" class="form-control" value="${escapeHtml(c.fechaISO || '2026-12-07T09:30:00-06:00')}" />
        </div>
        <div class="form-group">
          <label>Horario Visible</label>
          <input type="text" id="cfgHorario" class="form-control" value="${escapeHtml(c.horarioTexto || '9:30 a 16:00 hrs')}" />
        </div>
        <div class="form-group">
          <label>Recinto Sede Oficial</label>
          <input type="text" id="cfgSede" class="form-control" value="${escapeHtml(c.sede || 'Auditorio José Joaquín de Herrera')}" />
        </div>
        <div class="form-group">
          <label>Ciudad y Estado</label>
          <input type="text" id="cfgCiudad" class="form-control" value="${escapeHtml(c.ciudad || 'Chilpancingo de los Bravo, Guerrero')}" />
        </div>
        <div class="form-group">
          <label>Responsable de Informes y Coordinación</label>
          <input type="text" id="cfgContactoNombre" class="form-control" value="${escapeHtml(c.contactoNombre || 'Mtra. Yammel Anilú Martínez Saavedra')}" />
        </div>
        <div class="form-group">
          <label>Teléfono / WhatsApp de Informes</label>
          <input type="text" id="cfgTelefono" class="form-control" value="${escapeHtml(c.contactoTelefono || '744 424 5666')}" />
        </div>
        <div class="form-group">
          <label>Correo Electrónico Oficial</label>
          <input type="email" id="cfgEmail" class="form-control" value="${escapeHtml(c.contactoEmail || 'mujeresinvestigadorasguerrero@gmail.com')}" />
        </div>
        <div class="form-group full">
          <label>Hashtags Oficiales (separados por coma)</label>
          <input type="text" id="cfgHashtags" class="form-control" value="${escapeHtml((c.hashtags || []).join(', '))}" />
        </div>
        <div class="form-group full">
          <button type="submit" class="btn btn-primary">
            💾 Guardar Configuración General en MongoDB
          </button>
        </div>
      </form>
    </div>

    <!-- Respaldo y Restauración de Base de Datos -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3>🗄️ Respaldo y Restauración de la Base de Datos (MongoDB)</h3>
          <p>Descarga una copia completa de seguridad en formato JSON o restaura un respaldo previo</p>
        </div>
      </div>

      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-teal" onclick="exportBackupJSON()">
          ⬇️ Descargar Respaldo Completo (.JSON)
        </button>

        <label class="btn btn-outline" style="cursor:pointer;">
          ⬆️ Restaurar / Importar Respaldo (.JSON)
          <input type="file" accept=".json" style="display:none;" onchange="importBackupJSON(this)" />
        </label>
      </div>
    </div>
  `;
}

async function guardarConfigGeneral(e) {
  e.preventDefault();
  const rawTags = document.getElementById('cfgHashtags').value;
  const hashtags = rawTags.split(',').map(t => t.trim()).filter(Boolean);

  const config = {
    ...appData.config,
    siglas: document.getElementById('cfgSiglas').value.trim(),
    significadoSiglas: document.getElementById('cfgSignificado').value.trim(),
    lemaSuperior: document.getElementById('cfgLema').value.trim(),
    titulo: document.getElementById('cfgTitulo').value.trim(),
    subtitulo: document.getElementById('cfgSubtitulo').value.trim(),
    descripcion: document.getElementById('cfgDescripcion').value.trim(),
    eslogan: document.getElementById('cfgEslogan').value.trim(),
    fechaTexto: document.getElementById('cfgFechaTexto').value.trim(),
    fechaISO: document.getElementById('cfgFechaISO').value.trim(),
    horarioTexto: document.getElementById('cfgHorario').value.trim(),
    sede: document.getElementById('cfgSede').value.trim(),
    ciudad: document.getElementById('cfgCiudad').value.trim(),
    contactoNombre: document.getElementById('cfgContactoNombre').value.trim(),
    contactoTelefono: document.getElementById('cfgTelefono').value.trim(),
    contactoEmail: document.getElementById('cfgEmail').value.trim(),
    hashtags
  };
  await saveAdminData({ config }, 'Configuración general actualizada en MongoDB');
}

// ============================================================================
// FUNCIONES COMPARTIDAS DEL PANEL ADMIN
// ============================================================================
async function toggleAprobarConstancia(idx) {
  const registros = [...(appData.registros || [])];
  if (!registros[idx]) return;
  registros[idx].constanciaAprobada = !registros[idx].constanciaAprobada;
  await saveAdminData({ registros }, `Constancia ${registros[idx].folio}: ${registros[idx].constanciaAprobada ? 'Aprobada' : 'Pendiente'}`);
}

async function aprobarTodasLasConstancias() {
  const registros = (appData.registros || []).map(r => ({ ...r, constanciaAprobada: true }));
  await saveAdminData({ registros }, 'Todas las constancias fueron aprobadas');
}

async function eliminarItemColeccion(coleccion, idx) {
  const list = [...(appData[coleccion] || [])];
  list.splice(idx, 1);
  await saveAdminData({ [coleccion]: list }, 'Registro eliminado de MongoDB');
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
    console.warn('Subida local fallback');
  }
  return dataUrl;
}

function normalizeYoutubeEmbed(rawUrl) {
  if (!rawUrl) return '';
  const match = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return rawUrl;
}

function exportarRegistrosCSV() {
  const list = appData.registros || [];
  const headers = ['Folio', 'Nombre', 'Email', 'Telefono', 'Institucion', 'Nivel', 'Rol', 'Turno', 'Eje', 'Ponencia', 'ConstanciaAprobada', 'FechaRegistro'];
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
    r.constanciaAprobada ? 'SI' : 'NO',
    r.fechaRegistro || ''
  ]);
  const csvContent = '\uFEFF' + [headers, ...rows]
    .map(row => row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Padron-Registros-Foro-MIISTEG-2026.csv';
  link.click();
  showToast('Padrón exportado a Excel (CSV)');
}

function exportBackupJSON() {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'respaldo-miisteg-2026.json';
  link.click();
  showToast('Respaldo JSON descargado');
}

async function importBackupJSON(input) {
  if (!input.files || !input.files[0]) return;
  try {
    const text = await input.files[0].text();
    const parsed = JSON.parse(text);
    await saveAdminData({
      config: parsed.config || appData.config,
      ejes: parsed.ejes || appData.ejes,
      programa: parsed.programa || appData.programa,
      ponencias: parsed.ponencias || appData.ponencias,
      videos: parsed.videos || appData.videos,
      galeria: parsed.galeria || appData.galeria,
      registros: parsed.registros || appData.registros
    }, 'Base de datos restaurada exitosamente desde el respaldo JSON');
  } catch (err) {
    showToast('Error al leer el archivo JSON de respaldo');
  }
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) modal.classList.remove('open');
}

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
