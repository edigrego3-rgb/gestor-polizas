const STORAGE_KEYS = {
  POLICIES: 'gestor_polizas_data_v1',
  SETTINGS: 'gestor_polizas_settings_v1',
  GH_CONFIG: 'gestor_polizas_github_v1',
  MAPPINGS: 'gestor_polizas_excel_mappings_v1'
};

const RAMOS_NOMBRES = {
  "1": "Incendio",
  "2": "Transporte",
  "4": "Automotores",
  "6": "Cristales",
  "7": "Responsabilidad Civil",
  "14": "Caución / Tránsito",
  "17": "Vida Colectivo",
  "23": "Acc. Personales Colectivo",
  "30": "Accidentes Personales",
  "31": "Integral de Comercio",
  "32": "Integral / Combinado",
  "33": "Mala Praxis / RC Prof.",
  "43": "RC Productores",
  "44": "Motovehículos",
  "60": "Vida / Sepelio"
};

const app = {
  policies: [],
  settings: {
    diasPoliza: 10,
    diasVenc1: 5,
    diasVenc2: 5,
    gapVenc2: 10
  },
  ghConfig: {
    owner: 'edigrego3-rgb',
    repo: 'gestor-polizas',
    branch: 'main',
    token: '',
    autoSync: true
  },
  companyFilter: 'TODAS',
  alertCategoryFilter: 'todas',
  policyStatusFilter: 'TODAS',
  currentPolicyId: null,
  renewSourcePolicyId: null,
  renewPreviewQuotas: [],
  excelRawRows: [],
  excelHeaders: [],

  init() {
    this.loadSettings();
    this.loadGitHubConfig();
    this.loadPolicies();
    this.updateTodayBadge();
    this.populateCompanyFilter();
    this.renderAll();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  getTodayIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  updateTodayBadge() {
    const badge = document.getElementById('active-date-badge');
    if (badge) {
      badge.textContent = '📅 Hoy: ' + this.formatDateAR(this.getTodayIso());
    }
  },

  formatDateAR(isoStr) {
    if (!isoStr || isoStr === '-') return '-';
    const parts = String(isoStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  },

  formatMoney(num) {
    const val = Number(num || 0);
    return '$ ' + val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  daysDiffFromToday(targetIso) {
    if (!targetIso) return 9999;
    const todayParts = this.getTodayIso().split('-').map(Number);
    const targetParts = String(targetIso).split('-').map(Number);
    if (targetParts.length !== 3) return 9999;
    const dtToday = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
    const dtTarget = new Date(targetParts[0], targetParts[1] - 1, targetParts[2]);
    const diffMs = dtTarget.getTime() - dtToday.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  },

  addMonthsIso(isoDate, monthsToAdd) {
    const parts = String(isoDate).split('-').map(Number);
    if (parts.length !== 3) return isoDate;
    let year = parts[0];
    let month = parts[1] - 1 + monthsToAdd;
    let day = parts[2];
    year += Math.floor(month / 12);
    month = ((month % 12) + 12) % 12;
    const maxDays = new Date(year, month + 1, 0).getDate();
    day = Math.min(day, maxDays);
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  },

  addDaysIso(isoDate, daysToAdd) {
    const parts = String(isoDate).split('-').map(Number);
    if (parts.length !== 3) return isoDate;
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    dt.setDate(dt.getDate() + Number(daysToAdd));
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {}
    document.getElementById('cfg-dias-poliza').value = this.settings.diasPoliza;
    document.getElementById('cfg-dias-venc1').value = this.settings.diasVenc1;
    document.getElementById('cfg-dias-venc2').value = this.settings.diasVenc2;
    document.getElementById('cfg-gap-venc2').value = this.settings.gapVenc2;
  },

  saveSettings() {
    this.settings.diasPoliza = Math.max(1, parseInt(document.getElementById('cfg-dias-poliza').value || 10, 10));
    this.settings.diasVenc1 = Math.max(0, parseInt(document.getElementById('cfg-dias-venc1').value || 5, 10));
    this.settings.diasVenc2 = Math.max(0, parseInt(document.getElementById('cfg-dias-venc2').value || 5, 10));
    this.settings.gapVenc2 = Math.max(1, parseInt(document.getElementById('cfg-gap-venc2').value || 10, 10));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    this.renderAll();
    this.showToast('✅ Preferencias de alertas guardadas');
  },

  loadPolicies() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POLICIES);
      if (saved) {
        this.policies = JSON.parse(saved);
        return;
      }
    } catch (e) {}
    if (window.POLIZAS_INICIALES && Array.isArray(window.POLIZAS_INICIALES)) {
      this.policies = JSON.parse(JSON.stringify(window.POLIZAS_INICIALES));
      this.savePolicies(true);
    }
  },

  savePolicies(skipAutoSync = false) {
    localStorage.setItem(STORAGE_KEYS.POLICIES, JSON.stringify(this.policies));
    this.populateCompanyFilter();
    if (!skipAutoSync && this.ghConfig.autoSync && this.ghConfig.token && this.ghConfig.owner && this.ghConfig.repo) {
      this.pushToGitHub(true);
    }
  },

  populateCompanyFilter() {
    const select = document.getElementById('global-company-filter');
    if (!select) return;
    const companies = Array.from(new Set(this.policies.map(p => p.compania || 'La Segunda'))).sort();
    const currentVal = this.companyFilter;
    select.innerHTML = `<option value="TODAS">Todas las compañías (${this.policies.length})</option>`;
    companies.forEach(comp => {
      const count = this.policies.filter(p => (p.compania || 'La Segunda') === comp).length;
      const opt = document.createElement('option');
      opt.value = comp;
      opt.textContent = `${comp} (${count})`;
      select.appendChild(opt);
    });
    if (companies.includes(currentVal) || currentVal === 'TODAS') {
      select.value = currentVal;
    } else {
      this.companyFilter = 'TODAS';
    }
  },

  setCompanyFilter(val) {
    this.companyFilter = val;
    this.renderAll();
  },

  switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    const btn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderAll() {
    this.renderAlerts();
    this.renderPolicies();
  },

  /* ==================== MOTOR DE ALERTAS ==================== */
  computeAlerts() {
    const listSinRenovar = [];
    const listVenc2 = [];
    const listVenc1 = [];
    const listPorVencer = [];

    const filteredPolicies = this.policies.filter(p =>
      this.companyFilter === 'TODAS' || (p.compania || 'La Segunda') === this.companyFilter
    );

    filteredPolicies.forEach(p => {
      if (p.estado_poliza === 'Renovada' || p.estado_poliza === 'Baja') {
        return;
      }

      const diffFinPoliza = this.daysDiffFromToday(p.vig_hasta);

      // 1. Pólizas vencidas SIN RENOVAR
      if (diffFinPoliza <= 0) {
        listSinRenovar.push({
          type: 'sin_renovar',
          daysDiff: diffFinPoliza,
          policy: p
        });
      } else if (diffFinPoliza <= this.settings.diasPoliza) {
        // 4. Pólizas próximas a vencer
        listPorVencer.push({
          type: 'por_vencer',
          daysDiff: diffFinPoliza,
          policy: p
        });
      }

      // 2 y 3. Alertas de Cuotas (1° y 2° Vencimiento)
      if (Array.isArray(p.cuotas)) {
        p.cuotas.forEach(c => {
          if (c.estado === 'Pagada') return;
          // Si el premio es 0, no alertamos cuota salvo que le hayan puesto monto > 0
          if (Number(c.monto || 0) <= 0 && Number(p.premio || 0) <= 0) return;

          const diffV1 = this.daysDiffFromToday(c.vencimiento1);
          const diffV2 = this.daysDiffFromToday(c.vencimiento2);

          // Si ya venció el 1° vencimiento (diffV1 < 0), pasa directo a alerta de 2° Vencimiento!
          // O si faltan <= diasVenc2 para el 2° vencimiento
          if (diffV1 < 0) {
            // Evitar inundar con cuotas de hace muchos meses si la póliza ya está vencida hace más de 45 días
            if (diffV2 >= -45) {
              listVenc2.push({
                type: 'venc2',
                daysDiff: diffV2,
                diffV1: diffV1,
                policy: p,
                cuota: c
              });
            }
          } else if (diffV1 <= this.settings.diasVenc1) {
            listVenc1.push({
              type: 'venc1',
              daysDiff: diffV1,
              diffV2: diffV2,
              policy: p,
              cuota: c
            });
          }
        });
      }
    });

    listSinRenovar.sort((a, b) => b.daysDiff - a.daysDiff);
    listVenc2.sort((a, b) => a.daysDiff - b.daysDiff);
    listVenc1.sort((a, b) => a.daysDiff - b.daysDiff);
    listPorVencer.sort((a, b) => a.daysDiff - b.daysDiff);

    return {
      sin_renovar: listSinRenovar,
      venc2: listVenc2,
      venc1: listVenc1,
      por_vencer: listPorVencer,
      total: listSinRenovar.length + listVenc2.length + listVenc1.length + listPorVencer.length
    };
  },

  filterAlertCategory(cat) {
    this.alertCategoryFilter = cat;
    document.querySelectorAll('#alert-category-tabs .pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat);
    });
    this.renderAlerts();
  },

  renderAlerts() {
    const alerts = this.computeAlerts();

    document.getElementById('kpi-sin-renovar').textContent = alerts.sin_renovar.length;
    document.getElementById('kpi-venc2').textContent = alerts.venc2.length;
    document.getElementById('kpi-venc1').textContent = alerts.venc1.length;
    document.getElementById('kpi-por-vencer').textContent = alerts.por_vencer.length;
    document.getElementById('nav-badge-alertas').textContent = alerts.total;

    let combined = [];
    if (this.alertCategoryFilter === 'todas') {
      combined = [
        ...alerts.sin_renovar,
        ...alerts.venc2,
        ...alerts.venc1,
        ...alerts.por_vencer
      ];
    } else {
      combined = alerts[this.alertCategoryFilter] || [];
    }

    const q = (document.getElementById('alert-search')?.value || '').trim().toLowerCase();
    if (q) {
      combined = combined.filter(item => {
        const p = item.policy;
        return (
          (p.nombre || '').toLowerCase().includes(q) ||
          (p.dni_cuit || '').toLowerCase().includes(q) ||
          (p.poliza || '').toLowerCase().includes(q) ||
          (p.concepto || '').toLowerCase().includes(q) ||
          (p.patente || '').toLowerCase().includes(q)
        );
      });
    }

    const container = document.getElementById('alerts-container');
    if (combined.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>🎉 <strong>No hay alertas pendientes en esta categoría.</strong></p>
          <p class="small-text mt-8">Podés ajustar los días de anticipación desde la pestaña Ajustes.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = combined.map(item => this.renderAlertCardHTML(item)).join('');
  },

  renderAlertCardHTML(item) {
    const p = item.policy;
    const comp = p.compania || 'La Segunda';

    if (item.type === 'sin_renovar') {
      const diasTxt = item.daysDiff === 0
        ? '¡Vence HOY!'
        : `Venció hace ${Math.abs(item.daysDiff)} día(s)`;

      return `
        <div class="item-card alert-sin_renovar">
          <div class="card-top">
            <div class="badge-group">
              <span class="badge-company">${this.escapeHtml(comp)}</span>
              <span class="badge badge-danger">🔴 PÓLIZA SIN RENOVAR · ${diasTxt}</span>
            </div>
          </div>
          <div class="card-title" onclick="app.openPolicyDetail('${p.id}')">${this.escapeHtml(p.nombre)}</div>
          <div class="card-concepto">${this.escapeHtml(p.concepto || p.ramo_nombre)}</div>
          <div class="card-meta">
            <span>📄 Póliza: <strong>${this.escapeHtml(p.poliza)}</strong></span>
            <span>📅 Fin Vigencia: <strong>${this.formatDateAR(p.vig_hasta)}</strong></span>
            <span>💰 Premio: <strong>${this.formatMoney(p.premio)}</strong></span>
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="app.openRenewModal('${p.id}')">🔄 Cargar Renovación</button>
            <button class="btn btn-whatsapp btn-sm" onclick="app.sendWhatsApp('${p.id}', 'renovacion')">💬 WhatsApp</button>
            <button class="btn btn-secondary btn-sm" onclick="app.openPolicyDetail('${p.id}')">👁️ Ver Ficha</button>
            <button class="btn btn-danger-outline btn-sm" onclick="app.markPolicyAsBaja('${p.id}')">❌ No renueva</button>
          </div>
        </div>
      `;
    }

    if (item.type === 'por_vencer') {
      const diasTxt = item.daysDiff === 0 ? 'Vence HOY' : `Vence en ${item.daysDiff} día(s)`;
      return `
        <div class="item-card alert-por_vencer">
          <div class="card-top">
            <div class="badge-group">
              <span class="badge-company">${this.escapeHtml(comp)}</span>
              <span class="badge badge-info">🟡 FIN DE PÓLIZA PRÓXIMO · ${diasTxt}</span>
            </div>
          </div>
          <div class="card-title" onclick="app.openPolicyDetail('${p.id}')">${this.escapeHtml(p.nombre)}</div>
          <div class="card-concepto">${this.escapeHtml(p.concepto || p.ramo_nombre)}</div>
          <div class="card-meta">
            <span>📄 Póliza: <strong>${this.escapeHtml(p.poliza)}</strong></span>
            <span>📅 Vence el: <strong>${this.formatDateAR(p.vig_hasta)}</strong></span>
            <span>💰 Premio: <strong>${this.formatMoney(p.premio)}</strong></span>
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="app.openRenewModal('${p.id}')">🔄 Cargar Renovación</button>
            <button class="btn btn-whatsapp btn-sm" onclick="app.sendWhatsApp('${p.id}', 'por_vencer')">💬 Avisar WhatsApp</button>
            <button class="btn btn-secondary btn-sm" onclick="app.openPolicyDetail('${p.id}')">👁️ Ver Ficha</button>
          </div>
        </div>
      `;
    }

    if (item.type === 'venc2' || item.type === 'venc1') {
      const c = item.cuota;
      const isV2 = item.type === 'venc2';
      let estadoCuotaBadge = '';

      if (isV2) {
        const txtV2 = item.daysDiff < 0
          ? `2° Venc. pasado hace ${Math.abs(item.daysDiff)}d`
          : (item.daysDiff === 0 ? '2° Venc. HOY' : `2° Venc. en ${item.daysDiff}d`);
        estadoCuotaBadge = `<span class="badge badge-urgent">🚨 2° VENCIMIENTO CUOTA ${c.numero}/${c.total_cuotas || ''} · ${txtV2}</span>`;
      } else {
        const txtV1 = item.daysDiff === 0 ? '1° Venc. HOY' : `1° Venc. en ${item.daysDiff}d`;
        estadoCuotaBadge = `<span class="badge badge-warning">🟠 1° VENCIMIENTO CUOTA ${c.numero}/${c.total_cuotas || ''} · ${txtV1}</span>`;
      }

      return `
        <div class="item-card alert-${item.type}">
          <div class="card-top">
            <div class="badge-group">
              <span class="badge-company">${this.escapeHtml(comp)}</span>
              ${estadoCuotaBadge}
            </div>
          </div>
          <div class="card-title" onclick="app.openPolicyDetail('${p.id}')">${this.escapeHtml(p.nombre)}</div>
          <div class="card-concepto">${this.escapeHtml(p.concepto || p.ramo_nombre)} · Póliza ${this.escapeHtml(p.poliza)}</div>
          <div class="dual-venc-box">
            <div class="venc-pill">
              <span>1° Vencimiento</span>
              <strong style="color:${isV2 ? '#dc2626' : '#d97706'}">${this.formatDateAR(c.vencimiento1)} ${isV2 ? '(Vencido)' : ''}</strong>
            </div>
            <div class="venc-pill">
              <span>2° Vencimiento</span>
              <strong style="color:#991b1b">${this.formatDateAR(c.vencimiento2)}</strong>
            </div>
            <div class="venc-pill">
              <span>Importe Cuota ${c.numero}</span>
              <strong style="color:#15803d">${this.formatMoney(c.monto)}</strong>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn btn-success btn-sm" onclick="app.toggleQuotaPaid('${p.id}', '${c.id}')">✅ Marcar Pagada</button>
            <button class="btn btn-whatsapp btn-sm" onclick="app.sendWhatsApp('${p.id}', '${item.type}', '${c.id}')">💬 Avisar Cuota</button>
            <button class="btn btn-secondary btn-sm" onclick="app.openPolicyDetail('${p.id}')">✏️ Cuotas / Ficha</button>
          </div>
        </div>
      `;
    }
    return '';
  },

  /* ==================== CARTERA DE PÓLIZAS ==================== */
  setPolicyStatusFilter(st) {
    this.policyStatusFilter = st;
    document.querySelectorAll('#tab-polizas .pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.st === st);
    });
    this.renderPolicies();
  },

  renderPolicies() {
    const q = (document.getElementById('policy-search')?.value || '').trim().toLowerCase();

    let list = this.policies.filter(p => {
      if (this.companyFilter !== 'TODAS' && (p.compania || 'La Segunda') !== this.companyFilter) {
        return false;
      }

      const diffFin = this.daysDiffFromToday(p.vig_hasta);
      if (this.policyStatusFilter === 'VIGENTES') {
        if (p.estado_poliza !== 'Vigente' || diffFin <= 0) return false;
      } else if (this.policyStatusFilter === 'SIN_RENOVAR') {
        if (p.estado_poliza !== 'Vigente' || diffFin > 0) return false;
      } else if (this.policyStatusFilter === 'POR_VENCER') {
        if (p.estado_poliza !== 'Vigente' || diffFin <= 0 || diffFin > this.settings.diasPoliza) return false;
      } else if (this.policyStatusFilter === 'RENOVADAS') {
        if (p.estado_poliza !== 'Renovada') return false;
      } else if (this.policyStatusFilter === 'BAJAS') {
        if (p.estado_poliza !== 'Baja') return false;
      }

      if (q) {
        return (
          (p.nombre || '').toLowerCase().includes(q) ||
          (p.dni_cuit || '').toLowerCase().includes(q) ||
          (p.poliza || '').toLowerCase().includes(q) ||
          (p.expediente || '').toLowerCase().includes(q) ||
          (p.concepto || '').toLowerCase().includes(q) ||
          (p.patente || '').toLowerCase().includes(q) ||
          (p.compania || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    document.getElementById('policies-count-bar').textContent = `Mostrando ${list.length} póliza(s)`;

    const container = document.getElementById('policies-container');
    if (list.length === 0) {
      container.innerHTML = `<div class="empty-state">No se encontraron pólizas con ese criterio.</div>`;
      return;
    }

    // Mostrar hasta 150 tarjetas para fluidez inmediata en celulares; si busca filtra sobre las 454+
    const visibleList = list.slice(0, 150);

    container.innerHTML = visibleList.map(p => {
      const diffFin = this.daysDiffFromToday(p.vig_hasta);
      let badgeHtml = '';
      if (p.estado_poliza === 'Renovada') {
        badgeHtml = `<span class="badge badge-success">🔄 Renovada (${this.escapeHtml(p.renovada_con || 'Sí')})</span>`;
      } else if (p.estado_poliza === 'Baja') {
        badgeHtml = `<span class="badge badge-danger">❌ Dada de Baja</span>`;
      } else if (diffFin <= 0) {
        badgeHtml = `<span class="badge badge-danger">🔴 Vencida Sin Renovar</span>`;
      } else if (diffFin <= this.settings.diasPoliza) {
        badgeHtml = `<span class="badge badge-info">🟡 Vence en ${diffFin}d</span>`;
      } else {
        badgeHtml = `<span class="badge badge-success">🟢 Vigente</span>`;
      }

      const pagadas = (p.cuotas || []).filter(c => c.estado === 'Pagada').length;
      const totalC = (p.cuotas || []).length;

      return `
        <div class="item-card" onclick="app.openPolicyDetail('${p.id}')" style="cursor:pointer">
          <div class="card-top">
            <div class="badge-group">
              <span class="badge-company">${this.escapeHtml(p.compania || 'La Segunda')}</span>
              <span class="badge" style="background:#f1f5f9;color:#334155">${this.escapeHtml(p.ramo_nombre || 'SR ' + p.sr)}</span>
            </div>
            ${badgeHtml}
          </div>
          <div class="card-title">${this.escapeHtml(p.nombre)}</div>
          <div class="card-concepto">${this.escapeHtml(p.concepto || '-')}</div>
          <div class="card-meta">
            <span>📄 Póliza: <strong>${this.escapeHtml(p.poliza)}</strong></span>
            <span>🪪 DNI/CUIT: <strong>${this.escapeHtml(p.dni_cuit || '-')}</strong></span>
            <span>📅 Vigencia: <strong>${this.formatDateAR(p.vig_desde)} al ${this.formatDateAR(p.vig_hasta)}</strong></span>
            <span>💳 Cuotas: <strong>${pagadas}/${totalC} pagadas</strong></span>
            <span>💰 Premio: <strong>${this.formatMoney(p.premio)}</strong></span>
          </div>
        </div>
      `;
    }).join('');
  },

  /* ==================== FICHA DE PÓLIZA Y GESTIÓN DE CUOTAS ==================== */
  openPolicyDetail(policyId) {
    const p = this.policies.find(item => item.id === policyId);
    if (!p) return;
    this.currentPolicyId = policyId;

    document.getElementById('det-company-badge').textContent = p.compania || 'La Segunda';
    document.getElementById('det-nombre').textContent = p.nombre;
    document.getElementById('det-poliza').textContent = p.poliza;
    document.getElementById('det-dni').textContent = p.dni_cuit || '-';
    document.getElementById('det-ramo').textContent = `${p.sr} - ${p.ramo_nombre || RAMOS_NOMBRES[p.sr] || ''}`;
    document.getElementById('det-expediente').textContent = `${p.expediente || '-'} / Sup: ${p.suplemento || '-'}`;
    document.getElementById('det-concepto').textContent = p.concepto || '-';
    document.getElementById('det-desde').textContent = this.formatDateAR(p.vig_desde);
    document.getElementById('det-hasta').textContent = this.formatDateAR(p.vig_hasta);
    document.getElementById('det-prima').textContent = this.formatMoney(p.prima);
    document.getElementById('det-premio').textContent = this.formatMoney(p.premio);
    document.getElementById('det-emision').textContent = this.formatDateAR(p.emision);
    document.getElementById('det-telefono').value = p.telefono || '';
    document.getElementById('det-observaciones').value = p.observaciones || '';

    this.renderPolicyStatusBanner(p);
    this.renderPolicyQuotas(p);

    document.getElementById('modal-policy').classList.remove('hidden');
  },

  renderPolicyStatusBanner(p) {
    const diffFin = this.daysDiffFromToday(p.vig_hasta);
    const statusText = document.getElementById('det-status-text');
    const statusSub = document.getElementById('det-status-sub');
    const actionsDiv = document.getElementById('det-status-actions');

    if (p.estado_poliza === 'Renovada') {
      statusText.innerHTML = '🔄 Póliza Renovada';
      statusSub.textContent = `Reemplazada por póliza N° ${p.renovada_con || '-'}`;
      actionsDiv.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="app.reactivatePolicy('${p.id}')">Reactivar como Vigente</button>`;
    } else if (p.estado_poliza === 'Baja') {
      statusText.innerHTML = '❌ Póliza Dada de Baja / No Renovada';
      statusSub.textContent = 'No genera alertas de falta de renovación.';
      actionsDiv.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="app.reactivatePolicy('${p.id}')">Reactivar como Vigente</button>`;
    } else if (diffFin <= 0) {
      statusText.innerHTML = '🔴 PÓLIZA VENCIDA SIN RENOVAR';
      statusSub.textContent = `Venció el ${this.formatDateAR(p.vig_hasta)} (${Math.abs(diffFin)} días atrás)`;
      actionsDiv.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="app.openRenewModal('${p.id}')">🔄 Cargar Renovación</button>
        <button class="btn btn-danger-outline btn-sm" onclick="app.markPolicyAsBaja('${p.id}')">❌ No renueva</button>
      `;
    } else {
      statusText.innerHTML = `🟢 Póliza Vigente (${diffFin} días restantes)`;
      statusSub.textContent = `Vence el ${this.formatDateAR(p.vig_hasta)}`;
      actionsDiv.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="app.openRenewModal('${p.id}')">🔄 Renovar Anticipado</button>
      `;
    }
  },

  renderPolicyQuotas(p) {
    const listEl = document.getElementById('det-cuotas-list');
    if (!Array.isArray(p.cuotas) || p.cuotas.length === 0) {
      listEl.innerHTML = `<div class="small-text">Esta póliza no tiene cuotas cargadas. Tocá "➕ Cuota" o "⚡ Autogenerar".</div>`;
      return;
    }

    listEl.innerHTML = p.cuotas.map(c => {
      const isPaid = c.estado === 'Pagada';
      return `
        <div class="cuota-row ${isPaid ? 'pagada' : ''}">
          <div class="cuota-row-top">
            <span class="cuota-num-title">Cuota #${c.numero} ${isPaid ? '✅ PAGADA' : '⏳ PENDIENTE'}</span>
            <div class="btn-group-mini">
              <button class="btn btn-sm ${isPaid ? 'btn-secondary' : 'btn-success'}" onclick="app.toggleQuotaPaid('${p.id}', '${c.id}')">
                ${isPaid ? '↩️ Desmarcar' : '✅ Marcar Pagada'}
              </button>
              <button class="btn btn-whatsapp btn-sm" onclick="app.sendWhatsApp('${p.id}', 'venc1', '${c.id}')">💬</button>
              <button class="btn btn-danger-outline btn-sm" onclick="app.deleteQuota('${p.id}', '${c.id}')">🗑️</button>
            </div>
          </div>
          <div class="cuota-inputs-grid">
            <div class="cuota-field">
              <label>Importe ($)</label>
              <input type="number" step="0.01" value="${c.monto}" onchange="app.updateQuotaField('${p.id}', '${c.id}', 'monto', this.value)" />
            </div>
            <div class="cuota-field">
              <label>1° Vencimiento</label>
              <input type="date" value="${c.vencimiento1 || ''}" onchange="app.updateQuotaField('${p.id}', '${c.id}', 'vencimiento1', this.value)" />
            </div>
            <div class="cuota-field">
              <label>2° Vencimiento</label>
              <input type="date" value="${c.vencimiento2 || ''}" onchange="app.updateQuotaField('${p.id}', '${c.id}', 'vencimiento2', this.value)" />
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  savePolicyContact() {
    const p = this.policies.find(item => item.id === this.currentPolicyId);
    if (!p) return;
    p.telefono = document.getElementById('det-telefono').value.trim();
    p.observaciones = document.getElementById('det-observaciones').value.trim();
    this.savePolicies();
    this.showToast('💾 Datos de contacto actualizados');
  },

  toggleQuotaPaid(policyId, quotaId) {
    const p = this.policies.find(item => item.id === policyId);
    if (!p || !Array.isArray(p.cuotas)) return;
    const c = p.cuotas.find(q => q.id === quotaId);
    if (!c) return;

    if (c.estado === 'Pagada') {
      c.estado = 'Pendiente';
      c.fecha_pago = null;
      this.showToast(`↩️ Cuota #${c.numero} marcada como Pendiente`);
    } else {
      c.estado = 'Pagada';
      c.fecha_pago = this.getTodayIso();
      this.showToast(`✅ Cuota #${c.numero} de ${p.nombre} marcada como PAGADA`);
    }

    this.savePolicies();
    this.renderAll();
    if (this.currentPolicyId === policyId) {
      this.renderPolicyQuotas(p);
    }
  },

  updateQuotaField(policyId, quotaId, field, value) {
    const p = this.policies.find(item => item.id === policyId);
    if (!p || !Array.isArray(p.cuotas)) return;
    const c = p.cuotas.find(q => q.id === quotaId);
    if (!c) return;

    if (field === 'monto') {
      c.monto = parseFloat(value || 0);
    } else {
      c[field] = value;
    }
    this.savePolicies();
    this.renderAll();
    this.showToast('💾 Cuota actualizada');
  },

  deleteQuota(policyId, quotaId) {
    const p = this.policies.find(item => item.id === policyId);
    if (!p || !Array.isArray(p.cuotas)) return;
    p.cuotas = p.cuotas.filter(q => q.id !== quotaId);
    this.savePolicies();
    this.renderPolicyQuotas(p);
    this.renderAll();
  },

  openAddQuotaModal() {
    const p = this.policies.find(item => item.id === this.currentPolicyId);
    if (!p) return;
    const nextNum = (p.cuotas?.length || 0) + 1;
    const lastQuota = p.cuotas && p.cuotas.length > 0 ? p.cuotas[p.cuotas.length - 1] : null;
    const defaultV1 = lastQuota ? this.addMonthsIso(lastQuota.vencimiento1, 1) : (p.vig_desde || this.getTodayIso());
    const defaultV2 = this.addDaysIso(defaultV1, this.settings.gapVenc2);
    const defaultMonto = lastQuota ? lastQuota.monto : (p.premio || 0);

    document.getElementById('aq-numero').value = nextNum;
    document.getElementById('aq-monto').value = defaultMonto;
    document.getElementById('aq-venc1').value = defaultV1;
    document.getElementById('aq-venc2').value = defaultV2;
    document.getElementById('modal-add-quota').classList.remove('hidden');
  },

  onAddQuotaVenc1Change() {
    const v1 = document.getElementById('aq-venc1').value;
    if (v1) {
      document.getElementById('aq-venc2').value = this.addDaysIso(v1, this.settings.gapVenc2);
    }
  },

  saveAddedQuota() {
    const p = this.policies.find(item => item.id === this.currentPolicyId);
    if (!p) return;
    if (!Array.isArray(p.cuotas)) p.cuotas = [];

    const num = parseInt(document.getElementById('aq-numero').value || 1, 10);
    const monto = parseFloat(document.getElementById('aq-monto').value || 0);
    const v1 = document.getElementById('aq-venc1').value;
    const v2 = document.getElementById('aq-venc2').value;

    p.cuotas.push({
      id: 'c_man_' + Date.now(),
      numero: num,
      total_cuotas: Math.max(p.cuotas.length + 1, num),
      monto: monto,
      vencimiento1: v1,
      vencimiento2: v2,
      estado: 'Pendiente',
      fecha_pago: null
    });

    this.savePolicies();
    this.renderPolicyQuotas(p);
    this.renderAll();
    this.closeModal('modal-add-quota');
    this.showToast('✅ Cuota agregada');
  },

  autoGenerateQuotasPrompt() {
    const p = this.policies.find(item => item.id === this.currentPolicyId);
    if (!p) return;
    const cantStr = prompt('¿Cuántas cuotas mensuales querés generar para esta póliza?', '3');
    if (!cantStr) return;
    const cant = Math.max(1, parseInt(cantStr, 10) || 3);
    const montoUnit = p.premio > 0 ? Math.round((p.premio / cant) * 100) / 100 : 0;
    const baseDate = p.vig_desde || this.getTodayIso();

    p.cuotas = [];
    for (let i = 1; i <= cant; i++) {
      const v1 = this.addMonthsIso(baseDate, i - 1);
      const v2 = this.addDaysIso(v1, this.settings.gapVenc2);
      p.cuotas.push({
        id: `c_auto_${Date.now()}_${i}`,
        numero: i,
        total_cuotas: cant,
        monto: montoUnit,
        vencimiento1: v1,
        vencimiento2: v2,
        estado: 'Pendiente',
        fecha_pago: null
      });
    }

    this.savePolicies();
    this.renderPolicyQuotas(p);
    this.renderAll();
    this.showToast(`⚡ Se generaron ${cant} cuotas con 1° y 2° vencimiento`);
  },

  /* ==================== RENOVACIONES Y BAJAS ==================== */
  openRenewModal(policyId) {
    const p = this.policies.find(item => item.id === policyId);
    if (!p) return;
    this.renewSourcePolicyId = policyId;

    // Calcular duración original en meses (por defecto 3 meses si era trimestral)
    let origMonths = 3;
    if (p.vig_desde && p.vig_hasta) {
      const d1 = p.vig_desde.split('-').map(Number);
      const d2 = p.vig_hasta.split('-').map(Number);
      if (d1.length === 3 && d2.length === 3) {
        const diffM = (d2[0] - d1[0]) * 12 + (d2[1] - d1[1]);
        if (diffM > 0 && diffM <= 12) origMonths = diffM;
      }
    }

    const newDesde = p.vig_hasta || this.getTodayIso();
    const newHasta = this.addMonthsIso(newDesde, origMonths);

    document.getElementById('renew-old-summary').innerHTML = `
      <strong>Renovando a:</strong> ${this.escapeHtml(p.nombre)} (${this.escapeHtml(p.compania || 'La Segunda')})<br/>
      <strong>Riesgo:</strong> ${this.escapeHtml(p.concepto || p.ramo_nombre)}<br/>
      <strong>Póliza anterior:</strong> ${this.escapeHtml(p.poliza)} (Vencimiento: ${this.formatDateAR(p.vig_hasta)})
    `;

    document.getElementById('ren-poliza').value = '';
    document.getElementById('ren-desde').value = newDesde;
    document.getElementById('ren-hasta').value = newHasta;
    document.getElementById('ren-prima').value = p.prima || 0;
    document.getElementById('ren-premio').value = p.premio || 0;
    document.getElementById('ren-cuotas-cant').value = origMonths;
    document.getElementById('ren-gap-venc2').value = this.settings.gapVenc2;

    this.onRenewDateChange();
    document.getElementById('modal-renew').classList.remove('hidden');
  },

  onRenewDateChange() {
    const desde = document.getElementById('ren-desde').value || this.getTodayIso();
    const premio = parseFloat(document.getElementById('ren-premio').value || 0);
    const cant = Math.max(1, parseInt(document.getElementById('ren-cuotas-cant').value || 3, 10));
    const gap = Math.max(1, parseInt(document.getElementById('ren-gap-venc2').value || 10, 10));
    const montoCuota = premio > 0 ? Math.round((premio / cant) * 100) / 100 : 0;

    this.renewPreviewQuotas = [];
    for (let i = 1; i <= cant; i++) {
      const v1 = this.addMonthsIso(desde, i - 1);
      const v2 = this.addDaysIso(v1, gap);
      this.renewPreviewQuotas.push({
        id: `c_ren_${Date.now()}_${i}`,
        numero: i,
        total_cuotas: cant,
        monto: montoCuota,
        vencimiento1: v1,
        vencimiento2: v2,
        estado: 'Pendiente',
        fecha_pago: null
      });
    }

    const previewEl = document.getElementById('ren-cuotas-preview');
    previewEl.innerHTML = this.renewPreviewQuotas.map((c, idx) => `
      <div class="cuota-row">
        <span class="cuota-num-title">Cuota #${c.numero}</span>
        <div class="cuota-inputs-grid">
          <div class="cuota-field">
            <label>Importe ($)</label>
            <input type="number" step="0.01" value="${c.monto}" onchange="app.renewPreviewQuotas[${idx}].monto = parseFloat(this.value || 0)" />
          </div>
          <div class="cuota-field">
            <label>1° Vencimiento</label>
            <input type="date" value="${c.vencimiento1}" onchange="app.renewPreviewQuotas[${idx}].vencimiento1 = this.value" />
          </div>
          <div class="cuota-field">
            <label>2° Vencimiento</label>
            <input type="date" value="${c.vencimiento2}" onchange="app.renewPreviewQuotas[${idx}].vencimiento2 = this.value" />
          </div>
        </div>
      </div>
    `).join('');
  },

  confirmRenewal() {
    const oldP = this.policies.find(item => item.id === this.renewSourcePolicyId);
    if (!oldP) return;

    const newPolizaNum = document.getElementById('ren-poliza').value.trim();
    if (!newPolizaNum) {
      alert('Por favor ingresá el nuevo N° de Póliza.');
      return;
    }

    const newDesde = document.getElementById('ren-desde').value;
    const newHasta = document.getElementById('ren-hasta').value;
    const newPrima = parseFloat(document.getElementById('ren-prima').value || 0);
    const newPremio = parseFloat(document.getElementById('ren-premio').value || 0);

    // 1. Marcar la póliza anterior como Renovada
    oldP.estado_poliza = 'Renovada';
    oldP.renovada_con = newPolizaNum;

    // 2. Crear la nueva póliza manteniendo todos los datos del cliente y vehículo
    const newPolicy = {
      ...JSON.parse(JSON.stringify(oldP)),
      id: `pol_${newPolizaNum}_${Date.now()}`,
      poliza: newPolizaNum,
      prima: newPrima,
      premio: newPremio,
      emision: this.getTodayIso(),
      vig_desde: newDesde,
      vig_hasta: newHasta,
      estado_poliza: 'Vigente',
      renovada_con: null,
      cuotas: JSON.parse(JSON.stringify(this.renewPreviewQuotas))
    };

    this.policies.unshift(newPolicy);
    this.savePolicies();
    this.closeModal('modal-renew');
    this.closeModal('modal-policy');
    this.renderAll();
    this.showToast(`🔄 Póliza renovada con éxito (Nueva: ${newPolizaNum})`);
  },

  markPolicyAsBaja(policyId) {
    const p = this.policies.find(item => item.id === policyId);
    if (!p) return;
    if (!confirm(`¿Marcar la póliza ${p.poliza} de ${p.nombre} como NO RENOVADA / BAJA para que deje de alertar?`)) {
      return;
    }
    p.estado_poliza = 'Baja';
    this.savePolicies();
    this.renderAll();
    if (this.currentPolicyId === policyId) {
      this.renderPolicyStatusBanner(p);
    }
    this.showToast('❌ Póliza marcada como Baja / No renueva');
  },

  reactivatePolicy(policyId) {
    const p = this.policies.find(item => item.id === policyId);
    if (!p) return;
    p.estado_poliza = 'Vigente';
    p.renovada_con = null;
    this.savePolicies();
    this.renderPolicyStatusBanner(p);
    this.renderAll();
    this.showToast('🟢 Póliza reactivada como Vigente');
  },

  /* ==================== ALTA Y EDICIÓN MANUAL DE PÓLIZA ==================== */
  openNewPolicyModal() {
    document.getElementById('form-policy-title').textContent = '➕ Nueva Póliza';
    document.getElementById('fp-id').value = '';
    document.getElementById('fp-compania').value = this.companyFilter !== 'TODAS' ? this.companyFilter : 'La Segunda';
    document.getElementById('fp-nombre').value = '';
    document.getElementById('fp-dni').value = '';
    document.getElementById('fp-poliza').value = '';
    document.getElementById('fp-sr').value = '4';
    document.getElementById('fp-patente').value = '';
    document.getElementById('fp-expediente').value = '';
    document.getElementById('fp-concepto').value = '';
    const today = this.getTodayIso();
    document.getElementById('fp-desde').value = today;
    document.getElementById('fp-hasta').value = this.addMonthsIso(today, 3);
    document.getElementById('fp-prima').value = '';
    document.getElementById('fp-premio').value = '';
    document.getElementById('fp-cuotas-cant').value = '3';
    document.getElementById('fp-telefono').value = '';
    document.getElementById('fp-auto-cuotas-row').classList.remove('hidden');
    document.getElementById('modal-form-policy').classList.remove('hidden');
  },

  openEditPolicyModal() {
    const p = this.policies.find(item => item.id === this.currentPolicyId);
    if (!p) return;
    document.getElementById('form-policy-title').textContent = '✏️ Editar Póliza';
    document.getElementById('fp-id').value = p.id;
    document.getElementById('fp-compania').value = p.compania || 'La Segunda';
    document.getElementById('fp-nombre').value = p.nombre || '';
    document.getElementById('fp-dni').value = p.dni_cuit || '';
    document.getElementById('fp-poliza').value = p.poliza || '';
    document.getElementById('fp-sr').value = p.sr || '4';
    document.getElementById('fp-patente').value = p.patente || '';
    document.getElementById('fp-expediente').value = p.expediente || '';
    document.getElementById('fp-concepto').value = p.concepto || '';
    document.getElementById('fp-desde').value = p.vig_desde || '';
    document.getElementById('fp-hasta').value = p.vig_hasta || '';
    document.getElementById('fp-prima').value = p.prima || 0;
    document.getElementById('fp-premio').value = p.premio || 0;
    document.getElementById('fp-telefono').value = p.telefono || '';
    document.getElementById('fp-auto-cuotas-row').classList.add('hidden');
    document.getElementById('modal-form-policy').classList.remove('hidden');
  },

  savePolicyForm() {
    const existingId = document.getElementById('fp-id').value;
    const compania = document.getElementById('fp-compania').value.trim() || 'La Segunda';
    const nombre = document.getElementById('fp-nombre').value.trim();
    const dni = document.getElementById('fp-dni').value.trim();
    const poliza = document.getElementById('fp-poliza').value.trim();
    const sr = document.getElementById('fp-sr').value.trim() || '4';
    const patente = document.getElementById('fp-patente').value.trim().toUpperCase();
    const expediente = document.getElementById('fp-expediente').value.trim();
    const concepto = document.getElementById('fp-concepto').value.trim();
    const desde = document.getElementById('fp-desde').value;
    const hasta = document.getElementById('fp-hasta').value;
    const prima = parseFloat(document.getElementById('fp-prima').value || 0);
    const premio = parseFloat(document.getElementById('fp-premio').value || 0);
    const telefono = document.getElementById('fp-telefono').value.trim();

    if (!nombre || !poliza) {
      alert('Completá al menos el Nombre del Asegurado y el N° de Póliza.');
      return;
    }

    if (existingId) {
      const p = this.policies.find(item => item.id === existingId);
      if (p) {
        p.compania = compania;
        p.nombre = nombre;
        p.dni_cuit = dni;
        p.tomador_completo = dni ? `${dni} - ${nombre}` : nombre;
        p.poliza = poliza;
        p.sr = sr;
        p.ramo_nombre = RAMOS_NOMBRES[sr] || `Ramo ${sr}`;
        p.patente = patente;
        p.expediente = expediente;
        p.concepto = concepto;
        p.vig_desde = desde;
        p.vig_hasta = hasta;
        p.prima = prima;
        p.premio = premio;
        p.telefono = telefono;
      }
      this.savePolicies();
      this.closeModal('modal-form-policy');
      this.openPolicyDetail(existingId);
      this.renderAll();
      this.showToast('✅ Póliza actualizada');
    } else {
      const cantCuotas = Math.max(1, parseInt(document.getElementById('fp-cuotas-cant').value || 3, 10));
      const montoCuota = premio > 0 ? Math.round((premio / cantCuotas) * 100) / 100 : 0;
      const cuotas = [];
      for (let i = 1; i <= cantCuotas; i++) {
        const v1 = this.addMonthsIso(desde || this.getTodayIso(), i - 1);
        const v2 = this.addDaysIso(v1, this.settings.gapVenc2);
        cuotas.push({
          id: `c_new_${Date.now()}_${i}`,
          numero: i,
          total_cuotas: cantCuotas,
          monto: montoCuota,
          vencimiento1: v1,
          vencimiento2: v2,
          estado: 'Pendiente',
          fecha_pago: null
        });
      }

      const newP = {
        id: `pol_${poliza}_${Date.now()}`,
        compania,
        tomador_completo: dni ? `${dni} - ${nombre}` : nombre,
        dni_cuit: dni,
        nombre,
        telefono,
        sr,
        ramo_nombre: RAMOS_NOMBRES[sr] || `Ramo ${sr}`,
        poliza,
        suplemento: '-',
        expediente: expediente || '-',
        concepto,
        patente,
        moneda: '$',
        prima,
        premio,
        emision: this.getTodayIso(),
        vig_desde: desde,
        vig_hasta: hasta,
        estado_poliza: 'Vigente',
        renovada_con: null,
        observaciones: '',
        cuotas
      };

      this.checkAndAutoRenewExisting(newP);
      this.policies.unshift(newP);
      this.savePolicies();
      this.closeModal('modal-form-policy');
      this.renderAll();
      this.showToast('✅ Nueva póliza creada');
    }
  },

  deleteCurrentPolicy() {
    const p = this.policies.find(item => item.id === this.currentPolicyId);
    if (!p) return;
    if (!confirm(`¿Seguro que querés eliminar la póliza ${p.poliza} de ${p.nombre}?`)) return;
    this.policies = this.policies.filter(item => item.id !== this.currentPolicyId);
    this.savePolicies();
    this.closeModal('modal-policy');
    this.renderAll();
    this.showToast('🗑️ Póliza eliminada');
  },

  /* ==================== WHATSAPP DIRECTO ==================== */
  sendWhatsApp(policyId, tipoAlerta, quotaId = null) {
    const p = this.policies.find(item => item.id === policyId);
    if (!p) return;
    let msg = '';
    const comp = p.compania || 'La Segunda';
    const riesgo = p.concepto || p.ramo_nombre || '';

    if (tipoAlerta === 'renovacion' || tipoAlerta === 'por_vencer') {
      msg = `Hola ${p.nombre}, te escribo para avisarte que la póliza N° ${p.poliza} (${comp} - ${riesgo}) tiene fecha de fin de vigencia el ${this.formatDateAR(p.vig_hasta)}. Quedo a disposición por la renovación. ¡Saludos!`;
    } else {
      const c = (p.cuotas || []).find(q => q.id === quotaId) || (p.cuotas || [])[0];
      if (c) {
        if (tipoAlerta === 'venc2') {
          msg = `Hola ${p.nombre}, te recuerdo que la Cuota N° ${c.numero} de tu seguro (${comp} - ${riesgo}, Póliza ${p.poliza}) por ${this.formatMoney(c.monto)} tuvo su 1° vencimiento el ${this.formatDateAR(c.vencimiento1)} y su 2° vencimiento es el ${this.formatDateAR(c.vencimiento2)}. ¡Avisame si ya la abonaste para registrarlo!`;
        } else {
          msg = `Hola ${p.nombre}, te recuerdo que la Cuota N° ${c.numero} de tu seguro (${comp} - ${riesgo}, Póliza ${p.poliza}) por ${this.formatMoney(c.monto)} tiene su 1° vencimiento el ${this.formatDateAR(c.vencimiento1)} (2° vencimiento: ${this.formatDateAR(c.vencimiento2)}). ¡Saludos!`;
        }
      }
    }

    const cleanPhone = (p.telefono || '').replace(/[^0-9]/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('54') ? cleanPhone : '549' + cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  },

  /* ==================== IMPORTADOR EXCEL / CSV MULTI-COMPAÑÍA ==================== */
  onImportCompanyChange(val) {
    const customInput = document.getElementById('import-company-custom');
    if (val === 'OTRA') {
      customInput.classList.remove('hidden');
    } else {
      customInput.classList.add('hidden');
    }
  },

  getSelectedImportCompany() {
    const sel = document.getElementById('import-company-select').value;
    if (sel === 'OTRA') {
      return document.getElementById('import-company-custom').value.trim() || 'Otra Compañía';
    }
    return sel;
  },

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
          alert('El archivo seleccionado está vacío o no tiene filas válidas.');
          return;
        }

        this.excelRawRows = rows;
        this.excelHeaders = Object.keys(rows[0]);
        this.buildColumnMapperUI();
      } catch (err) {
        alert('Error al leer el archivo Excel/CSV: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  },

  buildColumnMapperUI() {
    const mode = document.getElementById('import-mode-select').value;
    const comp = this.getSelectedImportCompany();
    let savedMappings = {};
    try {
      savedMappings = JSON.parse(localStorage.getItem(STORAGE_KEYS.MAPPINGS) || '{}');
    } catch (e) {}
    const compMap = (savedMappings[`${comp}_${mode}`]) || {};

    const fieldsPolizas = [
      { key: 'tomador', label: 'Asegurado / Tomador *', hints: ['tomador', 'asegurado', 'cliente', 'nombre', 'razon'] },
      { key: 'dni', label: 'DNI / CUIT (si viene separado)', hints: ['dni', 'cuit', 'doc', 'documento'] },
      { key: 'poliza', label: 'N° de Póliza *', hints: ['poliza', 'póliza', 'nro poliza', 'numero'] },
      { key: 'vig_desde', label: 'Vigencia Desde *', hints: ['vig. desde', 'desde', 'inicio', 'vigencia desde'] },
      { key: 'vig_hasta', label: 'Vigencia Hasta *', hints: ['vig. hasta', 'hasta', 'fin', 'vencimiento poliza', 'vigencia hasta'] },
      { key: 'concepto', label: 'Concepto / Vehículo / Riesgo', hints: ['concepto', 'riesgo', 'vehiculo', 'bien', 'descripcion'] },
      { key: 'patente', label: 'Patente / Dominio (si viene separado)', hints: ['patente', 'dominio'] },
      { key: 'premio', label: 'Premio Total ($)', hints: ['premio', 'total', 'importe total'] },
      { key: 'prima', label: 'Prima ($)', hints: ['prima'] },
      { key: 'sr', label: 'Ramo / SR / Sección', hints: ['sr', 'ramo', 'seccion', 'sección'] },
      { key: 'expediente', label: 'Expediente / Referencia', hints: ['exped', 'expediente', 'solicitud'] },
      { key: 'cuotas_cant', label: 'Cant. de Cuotas (opcional)', hints: ['cuotas', 'cant cuotas', 'plan'] },
      { key: 'venc1_col', label: '1° Venc. Cuota (si el Excel trae cuota)', hints: ['1 venc', '1° venc', 'vencimiento 1', 'primer venc'] },
      { key: 'venc2_col', label: '2° Venc. Cuota (si el Excel trae cuota)', hints: ['2 venc', '2° venc', 'vencimiento 2', 'segundo venc'] }
    ];

    const fieldsCuotas = [
      { key: 'poliza', label: 'N° de Póliza *', hints: ['poliza', 'póliza', 'nro poliza'] },
      { key: 'numero', label: 'N° de Cuota *', hints: ['cuota', 'nro cuota', 'numero', 'endoso'] },
      { key: 'monto', label: 'Importe de la Cuota ($) *', hints: ['importe', 'monto', 'premio', 'valor'] },
      { key: 'vencimiento1', label: 'Fecha 1° Vencimiento *', hints: ['1 venc', '1° venc', 'vencimiento 1', 'vencimiento', 'fecha 1'] },
      { key: 'vencimiento2', label: 'Fecha 2° Vencimiento (opcional)', hints: ['2 venc', '2° venc', 'vencimiento 2', 'fecha 2', 'corte'] },
      { key: 'estado', label: 'Estado (Pendiente / Pagada)', hints: ['estado', 'situacion', 'pagada'] }
    ];

    const targetFields = mode === 'polizas' ? fieldsPolizas : fieldsCuotas;
    const container = document.getElementById('mapper-fields');

    container.innerHTML = targetFields.map(f => {
      let selectedCol = compMap[f.key] || '';
      if (!selectedCol) {
        // Auto-detectar por similitud de nombre de columna
        const match = this.excelHeaders.find(h => {
          const norm = h.toLowerCase().trim();
          return f.hints.some(hint => norm === hint || norm.includes(hint));
        });
        if (match) selectedCol = match;
      }

      const optionsHtml = [
        `<option value="">-- No incluir / Automático --</option>`,
        ...this.excelHeaders.map(h => `<option value="${this.escapeHtml(h)}" ${h === selectedCol ? 'selected' : ''}>${this.escapeHtml(h)}</option>`)
      ].join('');

      return `
        <div class="mapper-item">
          <label>${f.label}</label>
          <select data-map-key="${f.key}">
            ${optionsHtml}
          </select>
        </div>
      `;
    }).join('');

    document.getElementById('column-mapper-box').classList.remove('hidden');
    this.showToast(`📄 ${this.excelRawRows.length} filas leídas del archivo`);
  },

  parseAnyDateToIso(val) {
    if (!val && val !== 0) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    if (!str || str === '-') return null;
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.substring(0, 10);
    }
    // DD/MM/YYYY o DD-MM-YYYY
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      let d = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (d > 0 && m > 0 && m <= 12 && y > 1990) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return null;
  },

  parseNumberClean(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let s = String(val).replace(/[^0-9,.-]/g, '').trim();
    // Si tiene punto de miles y coma decimal (ej. 120.500,45)
    if (s.includes('.') && s.includes(',')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    return parseFloat(s) || 0;
  },

  confirmExcelImport() {
    const mode = document.getElementById('import-mode-select').value;
    const comp = this.getSelectedImportCompany();

    const mapping = {};
    document.querySelectorAll('#mapper-fields select[data-map-key]').forEach(sel => {
      mapping[sel.dataset.mapKey] = sel.value;
    });

    // Guardar preferencia de mapeo para esta compañía
    try {
      const savedMappings = JSON.parse(localStorage.getItem(STORAGE_KEYS.MAPPINGS) || '{}');
      savedMappings[`${comp}_${mode}`] = mapping;
      localStorage.setItem(STORAGE_KEYS.MAPPINGS, JSON.stringify(savedMappings));
    } catch (e) {}

    if (mode === 'polizas') {
      this.importPoliciesFromMappedRows(comp, mapping);
    } else {
      this.importQuotasFromMappedRows(comp, mapping);
    }
  },

  importPoliciesFromMappedRows(compania, map) {
    if (!map.poliza || !map.tomador) {
      alert('Por favor vinculá al menos la columna de "Asegurado / Tomador" y "N° de Póliza".');
      return;
    }

    let added = 0;
    let updated = 0;
    let renewed = 0;

    this.excelRawRows.forEach((row, idx) => {
      const rawPoliza = String(row[map.poliza] || '').trim();
      const rawTomador = String(row[map.tomador] || '').trim();
      if (!rawPoliza || !rawTomador) return;

      let dni = map.dni ? String(row[map.dni] || '').trim() : '';
      let nombre = rawTomador;
      if (!dni && rawTomador.includes(' - ')) {
        const pts = rawTomador.split(' - ');
        dni = pts[0].trim();
        nombre = pts.slice(1).join(' - ').trim();
      }

      const sr = map.sr ? String(row[map.sr] || '4').trim() : '4';
      const concepto = map.concepto ? String(row[map.concepto] || '').trim().replace(/\s+/g, ' ') : '';
      let patente = map.patente ? String(row[map.patente] || '').trim().toUpperCase() : '';
      if (!patente && concepto) {
        const firstTok = concepto.split(' ')[0].toUpperCase();
        if ((firstTok.length === 6 || firstTok.length === 7) && /[0-9]/.test(firstTok) && /[A-Z]/.test(firstTok)) {
          patente = firstTok;
        }
      }

      const desdeIso = this.parseAnyDateToIso(row[map.vig_desde]) || this.getTodayIso();
      let hastaIso = this.parseAnyDateToIso(row[map.vig_hasta]) || this.addMonthsIso(desdeIso, 3);

      // Corrección preventiva si mes hasta < mes desde en el mismo año
      const dPts = desdeIso.split('-').map(Number);
      const hPts = hastaIso.split('-').map(Number);
      if (dPts[0] === hPts[0] && hPts[1] < dPts[1]) {
        hastaIso = `${dPts[0] + 1}-${String(hPts[1]).padStart(2, '0')}-${String(hPts[2]).padStart(2, '0')}`;
      }

      const premio = map.premio ? this.parseNumberClean(row[map.premio]) : 0;
      const prima = map.prima ? this.parseNumberClean(row[map.prima]) : 0;
      const expediente = map.expediente ? String(row[map.expediente] || '-').trim() : '-';

      // ¿Ya existe exactamente esta póliza en esta compañía?
      const existing = this.policies.find(p => p.poliza === rawPoliza && (p.compania || 'La Segunda') === compania);
      if (existing) {
        existing.vig_desde = desdeIso;
        existing.vig_hasta = hastaIso;
        if (premio > 0) existing.premio = premio;
        if (prima > 0) existing.prima = prima;
        if (concepto) existing.concepto = concepto;
        updated++;
        return;
      }

      // Calcular cuotas
      const d1 = desdeIso.split('-').map(Number);
      const d2 = hastaIso.split('-').map(Number);
      let monthsDiff = (d2[0] - d1[0]) * 12 + (d2[1] - d1[1]);
      if (monthsDiff <= 0) monthsDiff = 3;
      if (monthsDiff > 12) monthsDiff = 12;

      const cantCuotas = map.cuotas_cant && parseInt(row[map.cuotas_cant], 10) > 0
        ? parseInt(row[map.cuotas_cant], 10)
        : monthsDiff;
      const montoUnit = premio > 0 ? Math.round((premio / cantCuotas) * 100) / 100 : 0;

      const cuotas = [];
      const customV1 = map.venc1_col ? this.parseAnyDateToIso(row[map.venc1_col]) : null;
      const customV2 = map.venc2_col ? this.parseAnyDateToIso(row[map.venc2_col]) : null;

      for (let c = 1; c <= cantCuotas; c++) {
        const v1 = (c === 1 && customV1) ? customV1 : this.addMonthsIso(desdeIso, c - 1);
        const v2 = (c === 1 && customV2) ? customV2 : this.addDaysIso(v1, this.settings.gapVenc2);
        cuotas.push({
          id: `c_imp_${Date.now()}_${idx}_${c}`,
          numero: c,
          total_cuotas: cantCuotas,
          monto: montoUnit,
          vencimiento1: v1,
          vencimiento2: v2,
          estado: 'Pendiente',
          fecha_pago: null
        });
      }

      const newPolicy = {
        id: `pol_${rawPoliza}_${Date.now()}_${idx}`,
        compania,
        tomador_completo: dni ? `${dni} - ${nombre}` : nombre,
        dni_cuit: dni,
        nombre,
        telefono: '',
        sr,
        ramo_nombre: RAMOS_NOMBRES[sr] || `Ramo ${sr}`,
        poliza: rawPoliza,
        suplemento: '-',
        expediente,
        concepto,
        patente,
        moneda: '$',
        prima,
        premio,
        emision: this.getTodayIso(),
        vig_desde: desdeIso,
        vig_hasta: hastaIso,
        estado_poliza: 'Vigente',
        renovada_con: null,
        observaciones: '',
        cuotas
      };

      if (this.checkAndAutoRenewExisting(newPolicy)) {
        renewed++;
      }

      this.policies.push(newPolicy);
      added++;
    });

    this.savePolicies();
    this.renderAll();
    document.getElementById('column-mapper-box').classList.add('hidden');
    document.getElementById('excel-file-input').value = '';
    this.showToast(`✅ Importación lista: ${added} nuevas, ${renewed} renovadas, ${updated} actualizadas`);
    this.switchTab('tab-polizas');
  },

  checkAndAutoRenewExisting(newPolicy) {
    let foundRenewal = false;
    this.policies.forEach(oldP => {
      if (oldP.estado_poliza !== 'Vigente') return;
      if ((oldP.compania || 'La Segunda') !== (newPolicy.compania || 'La Segunda')) return;

      let sameRisk = false;
      if (oldP.expediente && oldP.expediente !== '-' && oldP.expediente === newPolicy.expediente) {
        sameRisk = true;
      } else if (oldP.patente && oldP.patente === newPolicy.patente && oldP.dni_cuit === newPolicy.dni_cuit) {
        sameRisk = true;
      } else if (oldP.dni_cuit && oldP.dni_cuit === newPolicy.dni_cuit && oldP.concepto && oldP.concepto === newPolicy.concepto) {
        sameRisk = true;
      }

      if (sameRisk && newPolicy.vig_desde >= oldP.vig_desde && newPolicy.poliza !== oldP.poliza) {
        oldP.estado_poliza = 'Renovada';
        oldP.renovada_con = newPolicy.poliza;
        if (!newPolicy.telefono && oldP.telefono) {
          newPolicy.telefono = oldP.telefono;
        }
        foundRenewal = true;
      }
    });
    return foundRenewal;
  },

  importQuotasFromMappedRows(compania, map) {
    if (!map.poliza || !map.vencimiento1) {
      alert('Por favor vinculá al menos "N° de Póliza" y "Fecha 1° Vencimiento".');
      return;
    }

    let count = 0;
    this.excelRawRows.forEach((row, idx) => {
      const polNum = String(row[map.poliza] || '').trim();
      if (!polNum) return;

      const p = this.policies.find(item => item.poliza === polNum);
      if (!p) return;
      if (!Array.isArray(p.cuotas)) p.cuotas = [];

      const numCuota = map.numero ? parseInt(row[map.numero] || 1, 10) : (p.cuotas.length + 1);
      const monto = map.monto ? this.parseNumberClean(row[map.monto]) : 0;
      const v1 = this.parseAnyDateToIso(row[map.vencimiento1]);
      if (!v1) return;
      const v2 = (map.vencimiento2 && this.parseAnyDateToIso(row[map.vencimiento2]))
        ? this.parseAnyDateToIso(row[map.vencimiento2])
        : this.addDaysIso(v1, this.settings.gapVenc2);

      const rawEst = map.estado ? String(row[map.estado] || '').toLowerCase() : '';
      const estado = (rawEst.includes('pag') || rawEst.includes('cobrad') || rawEst.includes('canc')) ? 'Pagada' : 'Pendiente';

      const existingQ = p.cuotas.find(q => Number(q.numero) === Number(numCuota));
      if (existingQ) {
        existingQ.monto = monto || existingQ.monto;
        existingQ.vencimiento1 = v1;
        existingQ.vencimiento2 = v2;
        existingQ.estado = estado;
      } else {
        p.cuotas.push({
          id: `c_qimp_${Date.now()}_${idx}`,
          numero: numCuota,
          total_cuotas: Math.max(p.cuotas.length + 1, numCuota),
          monto,
          vencimiento1: v1,
          vencimiento2: v2,
          estado,
          fecha_pago: estado === 'Pagada' ? this.getTodayIso() : null
        });
      }
      count++;
    });

    this.savePolicies();
    this.renderAll();
    document.getElementById('column-mapper-box').classList.add('hidden');
    document.getElementById('excel-file-input').value = '';
    this.showToast(`✅ ${count} cuota(s) actualizadas desde el Excel`);
    this.switchTab('tab-alertas');
  },

  downloadTemplateExcel(tipo) {
    if (typeof XLSX === 'undefined') {
      alert('Cargando librería Excel, intentá en un segundo.');
      return;
    }
    let data = [];
    let filename = '';
    if (tipo === 'polizas') {
      data = [
        {
          Compania: 'Sancor Seguros',
          Tomador: '25123456 - PEREZ, JUAN CARLOS',
          SR: '4',
          Poliza: '90012345',
          Expediente: '112233',
          Patente: 'AB123CD',
          Concepto: 'AB123CD TOYOTA HILUX 2.8 SRX 2022',
          Prima: 120000,
          Premio: 165000,
          'Vig. Desde': '28/10/2026',
          'Vig. Hasta': '28/01/2027',
          Cuotas: 3
        }
      ];
      filename = 'Plantilla_Polizas_MultiCompania.xlsx';
    } else {
      data = [
        {
          Poliza: '69523766',
          Cuota: 1,
          Importe: 30893.39,
          '1 Vencimiento': '28/10/2026',
          '2 Vencimiento': '07/11/2026',
          Estado: 'Pendiente'
        }
      ];
      filename = 'Plantilla_Cuotas_DobleVencimiento.xlsx';
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, filename);
  },

  /* ==================== SINCRONIZACIÓN GITHUB (CELULAR <-> TABLET) ==================== */
  loadGitHubConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GH_CONFIG);
      if (saved) {
        this.ghConfig = { ...this.ghConfig, ...JSON.parse(saved) };
      }
    } catch (e) {}
    document.getElementById('gh-owner').value = this.ghConfig.owner || '';
    document.getElementById('gh-repo').value = this.ghConfig.repo || '';
    document.getElementById('gh-branch').value = this.ghConfig.branch || 'main';
    document.getElementById('gh-token').value = this.ghConfig.token || '';
    document.getElementById('gh-autosync').checked = !!this.ghConfig.autoSync;
  },

  saveGitHubConfig() {
    this.ghConfig.owner = document.getElementById('gh-owner').value.trim();
    this.ghConfig.repo = document.getElementById('gh-repo').value.trim();
    this.ghConfig.branch = document.getElementById('gh-branch').value.trim() || 'main';
    this.ghConfig.token = document.getElementById('gh-token').value.trim();
    this.ghConfig.autoSync = document.getElementById('gh-autosync').checked;
    localStorage.setItem(STORAGE_KEYS.GH_CONFIG, JSON.stringify(this.ghConfig));
    this.showToast('💾 Configuración de GitHub guardada');
  },

  setSyncStatus(msg, isError = false) {
    const el = document.getElementById('gh-sync-status');
    if (el) {
      el.textContent = msg;
      el.style.color = isError ? '#dc2626' : '#15803d';
    }
  },

  async quickSync() {
    if (!this.ghConfig.token || !this.ghConfig.owner || !this.ghConfig.repo) {
      this.switchTab('tab-ajustes');
      this.showToast('⚙️ Configurá tu usuario y token de GitHub para sincronizar');
      return;
    }
    await this.pushToGitHub();
  },

  async pushToGitHub(silent = false) {
    this.saveGitHubConfig();
    const { owner, repo, branch, token } = this.ghConfig;
    if (!owner || !repo || !token) {
      if (!silent) alert('Completá Usuario, Repositorio y Token de GitHub en Ajustes.');
      return;
    }

    const path = 'polizas.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    if (!silent) this.setSyncStatus('⏳ Subiendo datos a GitHub...');

    try {
      let sha = null;
      const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json'
        }
      });
      if (getRes.ok) {
        const existingData = await getRes.json();
        sha = existingData.sha;
      }

      const jsonStr = JSON.stringify(this.policies, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));

      const bodyObj = {
        message: `Actualización de pólizas y cuotas (${new Date().toLocaleString('es-AR')})`,
        content: base64Content,
        branch
      };
      if (sha) bodyObj.sha = sha;

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyObj)
      });

      if (!putRes.ok) {
        throw new Error(`GitHub respondió ${putRes.status}`);
      }

      this.setSyncStatus(`✅ Sincronizado en la nube (${new Date().toLocaleTimeString('es-AR')})`);
      if (!silent) this.showToast('☁️ Datos subidos a GitHub correctamente');
    } catch (err) {
      this.setSyncStatus(`❌ Error al sincronizar: ${err.message}`, true);
      if (!silent) this.showToast('❌ Error al subir a GitHub');
    }
  },

  async pullFromGitHub() {
    this.saveGitHubConfig();
    const { owner, repo, branch, token } = this.ghConfig;
    if (!owner || !repo || !token) {
      alert('Completá Usuario, Repositorio y Token de GitHub en Ajustes.');
      return;
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/polizas.json?ref=${branch}`;
    this.setSyncStatus('⏳ Descargando datos desde GitHub...');

    try {
      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json'
        }
      });
      if (!res.ok) throw new Error(`No se pudo leer polizas.json (${res.status})`);
      const data = await res.json();
      const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
      const parsed = JSON.parse(decoded);

      if (Array.isArray(parsed)) {
        this.policies = parsed;
        this.savePolicies(true);
        this.renderAll();
        this.setSyncStatus(`✅ Datos actualizados desde GitHub (${parsed.length} pólizas)`);
        this.showToast('⬇️ Datos sincronizados desde la nube');
      }
    } catch (err) {
      this.setSyncStatus(`❌ Error al descargar: ${err.message}`, true);
    }
  },

  /* ==================== EXPORTACIÓN Y RESPALDO ==================== */
  exportFullExcel() {
    if (typeof XLSX === 'undefined') return;
    const rowsPolizas = this.policies.map(p => ({
      Compania: p.compania || 'La Segunda',
      Estado: p.estado_poliza,
      Tomador: p.tomador_completo,
      DNI_CUIT: p.dni_cuit,
      Nombre: p.nombre,
      Telefono: p.telefono,
      SR: p.sr,
      Ramo: p.ramo_nombre,
      Poliza: p.poliza,
      Expediente: p.expediente,
      Patente: p.patente,
      Concepto: p.concepto,
      Prima: p.prima,
      Premio: p.premio,
      Vig_Desde: this.formatDateAR(p.vig_desde),
      Vig_Hasta: this.formatDateAR(p.vig_hasta),
      Renovada_Con: p.renovada_con || ''
    }));

    const rowsCuotas = [];
    this.policies.forEach(p => {
      (p.cuotas || []).forEach(c => {
        rowsCuotas.push({
          Compania: p.compania || 'La Segunda',
          Poliza: p.poliza,
          Asegurado: p.nombre,
          Concepto: p.concepto,
          Cuota_Nro: c.numero,
          Importe: c.monto,
          Vencimiento_1: this.formatDateAR(c.vencimiento1),
          Vencimiento_2: this.formatDateAR(c.vencimiento2),
          Estado: c.estado,
          Fecha_Pago: c.fecha_pago ? this.formatDateAR(c.fecha_pago) : ''
        });
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsPolizas), 'Polizas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsCuotas), 'Cuotas');
    XLSX.writeFile(wb, `Cartera_Polizas_y_Cuotas_${this.getTodayIso()}.xlsx`);
  },

  exportBackupJson() {
    const blob = new Blob([JSON.stringify(this.policies, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_polizas_${this.getTodayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importBackupJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (Array.isArray(parsed)) {
          this.policies = parsed;
          this.savePolicies();
          this.renderAll();
          this.showToast(`✅ Restauradas ${parsed.length} pólizas`);
        }
      } catch (err) {
        alert('Archivo JSON inválido.');
      }
    };
    reader.readAsText(file);
  },

  resetToFactory() {
    if (!confirm('¿Restaurar el listado original de fábrica? Se perderán los cambios no exportados.')) return;
    localStorage.removeItem(STORAGE_KEYS.POLICIES);
    this.loadPolicies();
    this.renderAll();
    this.showToast('🔄 Listado original restaurado');
  },

  closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
  },

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      t.classList.add('hidden');
    }, 3000);
  }
};

window.addEventListener('DOMContentLoaded', () => app.init());
