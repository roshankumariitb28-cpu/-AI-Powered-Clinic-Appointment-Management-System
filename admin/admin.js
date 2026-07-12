/* ================================================================
   SHREE NEURO & DENTAL — ADMIN DASHBOARD LOGIC
   admin.js — Auth, data management, table, calendar, charts
   ================================================================ */

'use strict';

// ─── Firebase Setup ────────────────────────────────────────────────
const isAdminFirebaseEnabled = typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey;
let adminDb;
let unsubscribeLiveListener = null; // holds real-time subscription

if (isAdminFirebaseEnabled) {
  try {
    // Avoid re-initializing if appointment.js already did it
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    adminDb = firebase.firestore();
  } catch (e) {
    console.error("Admin Firebase init failed:", e);
  }
}


// ─── Auth ──────────────────────────────────────────────────────────
const DEFAULT_PASS_HASH = btoa('shree2026');

function getPassHash() {
  return localStorage.getItem('sndc_admin_pass') || DEFAULT_PASS_HASH;
}

function checkAuth() {
  const logged = sessionStorage.getItem('sndc_admin_logged');
  if (!logged) {
    document.getElementById('loginScreen').style.display = 'flex';
  } else {
    document.getElementById('loginScreen').style.display = 'none';
    initDashboard();
  }
}

document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('loginUser').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.remove('show');

  if (user !== 'admin') {
    errEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Invalid username.';
    errEl.classList.add('show');
    return;
  }

  if (btoa(pass) !== getPassHash()) {
    errEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Incorrect password. Try again.';
    errEl.classList.add('show');
    document.getElementById('loginPass').value = '';
    document.getElementById('loginPass').focus();
    return;
  }

  sessionStorage.setItem('sndc_admin_logged', '1');
  document.getElementById('loginScreen').style.display = 'none';
  initDashboard();
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  // Stop real-time listener if active
  if (unsubscribeLiveListener) unsubscribeLiveListener();
  sessionStorage.removeItem('sndc_admin_logged');
  location.reload();
});

// ─── Data ──────────────────────────────────────────────────────────
// In-memory cache updated by the real-time Firebase listener
let adminAppointments = [];

function getAppointments() {
  if (isAdminFirebaseEnabled) {
    return adminAppointments;
  }
  try { return JSON.parse(localStorage.getItem('sndc_appointments') || '[]'); } catch { return []; }
}

function saveAppointments(arr) {
  if (!isAdminFirebaseEnabled) {
    localStorage.setItem('sndc_appointments', JSON.stringify(arr));
  }
  // Firebase: data is written per-document in updateStatus / deleteAppointment
}

function updateStatus(id, status) {
  if (isAdminFirebaseEnabled) {
    adminDb.collection("appointments").doc(id).update({ status })
      .then(() => {
        showToast(`Appointment ${status.toLowerCase()}.`, 'success');
        // Real-time listener will auto-refresh the UI
      })
      .catch(err => {
        console.error("Status update failed:", err);
        showToast("Update failed. Check your internet connection.", "error");
      });
  } else {
    const appts = getAppointments();
    const idx = appts.findIndex(a => a.id === id);
    if (idx > -1) {
      appts[idx].status = status;
      saveAppointments(appts);
      showToast(`Appointment ${status.toLowerCase()}.`, 'success');
      refreshCurrentView();
    }
  }
}

function deleteAppointment(id) {
  if (!confirm(`Delete appointment ${id}? This cannot be undone.`)) return;
  if (isAdminFirebaseEnabled) {
    adminDb.collection("appointments").doc(id).delete()
      .then(() => {
        showToast('Appointment deleted.', 'success');
        closeModal();
        // Real-time listener will auto-refresh the UI
      })
      .catch(err => {
        console.error("Delete failed:", err);
        showToast("Delete failed. Check your internet connection.", "error");
      });
  } else {
    const appts = getAppointments().filter(a => a.id !== id);
    saveAppointments(appts);
    showToast('Appointment deleted.', 'success');
    refreshCurrentView();
  }
}

// ─── Real-time Listener ───────────────────────────────────────────
function startLiveListener() {
  if (!isAdminFirebaseEnabled) return;

  // Show live indicator in the topbar
  const tb = document.getElementById('topbarSubtitle');
  if (tb) tb.innerHTML = '🟢 <span style="color:#4ade80">Live sync active</span>';

  unsubscribeLiveListener = adminDb.collection("appointments")
    .orderBy("created", "desc")
    .onSnapshot(snapshot => {
      adminAppointments = [];
      snapshot.forEach(doc => adminAppointments.push(doc.data()));
      refreshCurrentView();
      renderStats();
    }, err => {
      console.error("Live listener error:", err);
      const tb2 = document.getElementById('topbarSubtitle');
      if (tb2) tb2.innerHTML = '🔴 <span style="color:#f87171">Sync disconnected</span>';
    });
}


// ─── Stats ────────────────────────────────────────────────────────
function computeStats(appts) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    total:     appts.length,
    todayCount: appts.filter(a => a.date === today).length,
    pending:   appts.filter(a => a.status === 'Pending').length,
    completed: appts.filter(a => a.status === 'Completed').length,
    confirmed: appts.filter(a => a.status === 'Confirmed').length,
    cancelled: appts.filter(a => a.status === 'Cancelled').length,
    neuro:     appts.filter(a => a.dept === 'neuro').length,
    dental:    appts.filter(a => a.dept === 'dental').length,
  };
}

function renderStats() {
  const s = computeStats(getAppointments());
  animateCount('stat-total',     s.total);
  animateCount('stat-today',     s.todayCount);
  animateCount('stat-pending',   s.pending);
  animateCount('stat-completed', s.completed);
  renderPendingBadge(s.pending);
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let cur = 0;
  const dur = 900;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / dur, 1);
    cur = Math.round(t * target);
    el.textContent = cur;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderPendingBadge(n) {
  document.querySelectorAll('.pend-badge').forEach(el => {
    el.textContent = n;
    el.style.display = n > 0 ? 'inline' : 'none';
  });
}

// ─── Charts ───────────────────────────────────────────────────────
function renderCharts() {
  const appts = getAppointments();
  const s = computeStats(appts);

  // Bar chart - last 7 days
  renderWeeklyChart(appts);

  // Donut - dept breakdown
  renderDeptDonut(s.neuro, s.dental);

  // Status donut
  renderStatusChart(s);
}

function renderWeeklyChart(appts) {
  const wrap = document.getElementById('weeklyChart');
  if (!wrap) return;
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
    days.push({ ds, label });
  }

  const max = Math.max(...days.map(d => appts.filter(a => a.date === d.ds).length), 1);

  wrap.innerHTML = days.map(d => {
    const count = appts.filter(a => a.date === d.ds).length;
    const pct = Math.round((count / max) * 100);
    return `
      <div class="bar-wrap">
        <div class="bar-value">${count}</div>
        <div class="bar" style="height:${pct}%; background: var(--grad-primary);"></div>
        <div class="bar-label">${d.label}</div>
      </div>
    `;
  }).join('');
}

function renderDeptDonut(neuro, dental) {
  const svg = document.getElementById('deptDonut');
  if (!svg) return;
  const total = neuro + dental || 1;
  const pct = neuro / total;

  const r = 40;
  const circ = 2 * Math.PI * r;
  const dashNeuro = circ * pct;
  const dashDental = circ * (1 - pct);

  svg.innerHTML = `
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="#E2EAFA" stroke-width="16"/>
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="url(#gNeuro)" stroke-width="16"
      stroke-dasharray="${dashNeuro} ${circ - dashNeuro}" stroke-linecap="round"
      transform="rotate(-90 55 55)"/>
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="url(#gDental)" stroke-width="16"
      stroke-dasharray="${dashDental} ${circ - dashDental}"
      stroke-dashoffset="${-dashNeuro}"
      stroke-linecap="round"
      transform="rotate(-90 55 55)"/>
    <defs>
      <linearGradient id="gNeuro" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0A3D6B"/>
        <stop offset="100%" stop-color="#1A72C8"/>
      </linearGradient>
      <linearGradient id="gDental" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00B8A0"/>
        <stop offset="100%" stop-color="#00D9C0"/>
      </linearGradient>
    </defs>
    <text x="55" y="55" text-anchor="middle" dominant-baseline="middle"
          font-family="Poppins,sans-serif" font-size="13" font-weight="800" fill="#0A3D6B">
      ${total}
    </text>
    <text x="55" y="68" text-anchor="middle" font-family="Poppins,sans-serif" font-size="6.5" fill="#6B7FA0">
      Total
    </text>
  `;

  document.getElementById('deptNeuroVal').textContent  = neuro;
  document.getElementById('deptDentalVal').textContent = dental;
}

function renderStatusChart(s) {
  const svg = document.getElementById('statusDonut');
  if (!svg) return;
  const data = [
    { val: s.pending,   color: '#F97316', label: 'Pending'   },
    { val: s.confirmed, color: '#0A3D6B', label: 'Confirmed' },
    { val: s.completed, color: '#22C55E', label: 'Completed' },
    { val: s.cancelled, color: '#E05252', label: 'Cancelled' },
  ];
  const total = data.reduce((a, b) => a + b.val, 0) || 1;

  const r = 40, cx = 55, cy = 55;
  const circ = 2 * Math.PI * r;
  let offset = -circ / 4;
  let paths = '';

  data.forEach(seg => {
    const pct   = seg.val / total;
    const dash  = circ * pct;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="16"
      stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${offset}"
      transform="rotate(0 ${cx} ${cy})"/>`;
    offset -= dash;
  });

  svg.innerHTML = `
    ${paths}
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
          font-family="Poppins,sans-serif" font-size="13" font-weight="800" fill="#0D1B2A">
      ${total}
    </text>
    <text x="${cx}" y="${cy+13}" text-anchor="middle" font-family="Poppins,sans-serif" font-size="6.5" fill="#6B7FA0">
      Appts
    </text>
  `;

  // Update legend
  ['pending','confirmed','completed','cancelled'].forEach(key => {
    const el = document.getElementById(`sval-${key}`);
    if (el) el.textContent = s[key];
  });
}

// ─── Appointments Table ────────────────────────────────────────────
let tableFilters = { search: '', dept: '', status: '', sort: 'date-desc' };
let currentPage  = 1;
const PAGE_SIZE  = 10;

function renderAppointmentsTable() {
  let appts = getAppointments();

  // Filter
  if (tableFilters.search) {
    const q = tableFilters.search.toLowerCase();
    appts = appts.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.phone?.includes(q) ||
      a.id?.toLowerCase().includes(q) ||
      a.doctorName?.toLowerCase().includes(q)
    );
  }
  if (tableFilters.dept)   appts = appts.filter(a => a.dept === tableFilters.dept);
  if (tableFilters.status) appts = appts.filter(a => a.status === tableFilters.status);

  // Sort
  switch (tableFilters.sort) {
    case 'date-desc': appts.sort((a,b) => (b.date + b.slot).localeCompare(a.date + a.slot)); break;
    case 'date-asc':  appts.sort((a,b) => (a.date + a.slot).localeCompare(b.date + b.slot)); break;
    case 'name-asc':  appts.sort((a,b) => a.name?.localeCompare(b.name)); break;
    case 'created':   appts.sort((a,b) => new Date(b.created) - new Date(a.created)); break;
  }

  const totalPages = Math.ceil(appts.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = 1;

  const paged = appts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const tbody = document.getElementById('apptTableBody');
  tbody.innerHTML = '';

  if (paged.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <i class="fa-solid fa-calendar-xmark"></i>
        <h3>No appointments found</h3>
        <p>Try adjusting your filters or search query.</p>
      </div>
    </td></tr>`;
  } else {
    paged.forEach(a => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><span style="font-family:'Courier New',monospace;font-size:0.78rem;color:var(--adm-muted)">${a.id}</span></td>
        <td><strong>${escHtml(a.name)}</strong><br><small style="color:var(--adm-muted)">${escHtml(a.phone)}</small></td>
        <td><span class="dept-badge ${a.dept}">${escHtml(a.deptLabel || a.dept)}</span></td>
        <td>${escHtml(a.doctorName || '—')}</td>
        <td>${formatDateShort(a.date)}</td>
        <td>${escHtml(a.slot)}</td>
        <td><span class="status-badge status-${a.status}">${a.status}</span></td>
        <td>${a.age ? a.age + 'y' : '—'} / ${escHtml(a.gender || '—')}</td>
        <td>
          <div class="action-btns">
            <button class="act-btn act-btn-view"    title="View Details"  onclick="openModal('${a.id}')"><i class="fa-solid fa-eye"></i></button>
            <button class="act-btn act-btn-confirm"  title="Confirm"       onclick="updateStatus('${a.id}','Confirmed')"><i class="fa-solid fa-circle-check"></i></button>
            <button class="act-btn act-btn-complete" title="Complete"      onclick="updateStatus('${a.id}','Completed')"><i class="fa-solid fa-flag-checkered"></i></button>
            <button class="act-btn act-btn-cancel"   title="Cancel"        onclick="updateStatus('${a.id}','Cancelled')"><i class="fa-solid fa-ban"></i></button>
            <button class="act-btn act-btn-delete"   title="Delete"        onclick="deleteAppointment('${a.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  // Pagination
  document.getElementById('pageInfo').textContent = `Showing ${paged.length} of ${appts.length} records`;
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const wrap = document.getElementById('paginationBtns');
  wrap.innerHTML = '';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'pag-btn';
  prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
  prevBtn.disabled = currentPage <= 1;
  prevBtn.addEventListener('click', () => { currentPage--; renderAppointmentsTable(); });
  wrap.appendChild(prevBtn);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'pag-btn' + (i === currentPage ? ' active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => { currentPage = i; renderAppointmentsTable(); });
    wrap.appendChild(btn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'pag-btn';
  nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.addEventListener('click', () => { currentPage++; renderAppointmentsTable(); });
  wrap.appendChild(nextBtn);
}

// ─── Recent Appointments (Dashboard) ──────────────────────────────
function renderRecentTable() {
  const appts = [...getAppointments()]
    .sort((a, b) => new Date(b.created) - new Date(a.created))
    .slice(0, 6);

  const tbody = document.getElementById('recentTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (appts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state" style="padding:30px">
        <i class="fa-solid fa-inbox"></i>
        <h3>No appointments yet</h3>
        <p>Bookings made via the website will appear here.</p>
      </div>
    </td></tr>`;
    return;
  }

  appts.forEach(a => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span style="font-family:'Courier New',monospace;font-size:0.78rem;color:var(--adm-muted)">${a.id}</span></td>
      <td><strong>${escHtml(a.name)}</strong></td>
      <td><span class="dept-badge ${a.dept}">${escHtml(a.deptLabel || a.dept)}</span></td>
      <td>${formatDateShort(a.date)} • ${escHtml(a.slot)}</td>
      <td><span class="status-badge status-${a.status}">${a.status}</span></td>
      <td>
        <div class="action-btns">
          <button class="act-btn act-btn-view" title="View" onclick="openModal('${a.id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="act-btn act-btn-confirm" title="Confirm" onclick="updateStatus('${a.id}','Confirmed')"><i class="fa-solid fa-circle-check"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ─── Modal ─────────────────────────────────────────────────────────
function openModal(id) {
  const a = getAppointments().find(x => x.id === id);
  if (!a) return;

  document.getElementById('mId').textContent     = a.id;
  document.getElementById('mName').textContent   = a.name;
  document.getElementById('mPhone').textContent  = a.phone;
  document.getElementById('mEmail').textContent  = a.email || '—';
  document.getElementById('mAge').textContent    = a.age ? `${a.age} years` : '—';
  document.getElementById('mGender').textContent = a.gender || '—';
  document.getElementById('mDept').textContent   = a.deptLabel || a.dept;
  document.getElementById('mDoctor').textContent = a.doctorName || '—';
  document.getElementById('mDate').textContent   = formatDateShort(a.date);
  document.getElementById('mSlot').textContent   = a.slot;
  document.getElementById('mStatus').innerHTML   = `<span class="status-badge status-${a.status}">${a.status}</span>`;
  document.getElementById('mSymptoms').textContent = a.symptoms || 'No symptoms specified.';
  document.getElementById('mCreated').textContent  = new Date(a.created).toLocaleString('en-IN');

  // Modal action buttons
  document.getElementById('mConfirmBtn').onclick  = () => { updateStatus(id, 'Confirmed');  closeModal(); };
  document.getElementById('mCompleteBtn').onclick = () => { updateStatus(id, 'Completed'); closeModal(); };
  document.getElementById('mCancelBtn').onclick   = () => { updateStatus(id, 'Cancelled'); closeModal(); };
  document.getElementById('mDeleteBtn').onclick   = () => { closeModal(); deleteAppointment(id); };

  document.getElementById('apptModal').classList.add('show');
}

function closeModal() {
  document.getElementById('apptModal').classList.remove('show');
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('apptModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ─── Calendar (Admin) ──────────────────────────────────────────────
let admCalYear, admCalMonth;

function initAdmCalendar() {
  const now = new Date();
  admCalYear = now.getFullYear();
  admCalMonth = now.getMonth();
  renderAdmCalendar();

  document.getElementById('admCalPrev').addEventListener('click', () => {
    admCalMonth--;
    if (admCalMonth < 0) { admCalMonth = 11; admCalYear--; }
    renderAdmCalendar();
  });

  document.getElementById('admCalNext').addEventListener('click', () => {
    admCalMonth++;
    if (admCalMonth > 11) { admCalMonth = 0; admCalYear++; }
    renderAdmCalendar();
  });
}

function renderAdmCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('admCalTitle').textContent = `${months[admCalMonth]} ${admCalYear}`;

  const appts = getAppointments();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const firstDay    = new Date(admCalYear, admCalMonth, 1).getDay();
  const daysInMonth = new Date(admCalYear, admCalMonth + 1, 0).getDate();

  const grid = document.getElementById('admCalDays');
  grid.innerHTML = '';

  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div'); e.className = 'cal-adm-day empty'; grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(admCalYear, admCalMonth, d);
    const ds = `${admCalYear}-${String(admCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const count = appts.filter(a => a.date === ds && a.status !== 'Cancelled').length;
    const isToday = cellDate.getTime() === today.getTime();

    const cell = document.createElement('div');
    cell.className = 'cal-adm-day';
    cell.innerHTML = `<span>${d}</span>${count > 0 ? `<span class="day-count">${count}</span>` : ''}`;
    if (isToday)  cell.classList.add('today');
    if (count > 0) { cell.classList.add('has-appt'); }

    cell.addEventListener('click', () => {
      document.querySelectorAll('.cal-adm-day').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      renderDayDetail(ds, appts);
    });

    grid.appendChild(cell);
  }
}

function renderDayDetail(dateStr, appts) {
  const dayAppts = appts.filter(a => a.date === dateStr && a.status !== 'Cancelled');
  const panel = document.getElementById('calDetailBody');
  const title = document.getElementById('calDetailTitle');

  title.textContent = `Appointments — ${new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`;

  if (dayAppts.length === 0) {
    panel.innerHTML = '<div class="empty-state" style="padding:24px"><i class="fa-solid fa-calendar-day"></i><h3>No appointments</h3><p>No bookings for this day.</p></div>';
    return;
  }

  dayAppts.sort((a, b) => a.slot.localeCompare(b.slot));
  panel.innerHTML = dayAppts.map(a => `
    <div class="cal-appt-item">
      <div class="cal-appt-name">${escHtml(a.name)} <span class="status-badge status-${a.status}" style="font-size:0.65rem;padding:2px 8px">${a.status}</span></div>
      <div class="cal-appt-meta">
        <span><i class="fa-solid fa-clock" style="margin-right:4px;opacity:.6"></i>${escHtml(a.slot)}</span>
        <span><i class="fa-solid fa-hospital" style="margin-right:4px;opacity:.6"></i>${escHtml(a.deptLabel||a.dept)}</span>
        <span><i class="fa-solid fa-phone" style="margin-right:4px;opacity:.6"></i>${escHtml(a.phone)}</span>
      </div>
    </div>
  `).join('');
}

// ─── Settings ──────────────────────────────────────────────────────
function initSettings() {
  document.getElementById('savePassBtn').addEventListener('click', () => {
    const np = document.getElementById('newPass').value;
    const cp = document.getElementById('confirmPass').value;

    if (!np || np.length < 4) { showToast('Password must be at least 4 characters.', 'error'); return; }
    if (np !== cp) { showToast('Passwords do not match.', 'error'); return; }

    localStorage.setItem('sndc_admin_pass', btoa(np));
    document.getElementById('newPass').value = '';
    document.getElementById('confirmPass').value = '';
    showToast('Password changed successfully!', 'success');
  });

  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (!confirm('This will delete ALL appointments permanently. Are you sure?')) return;

    if (isAdminFirebaseEnabled) {
      // Delete all Firestore documents in batches
      adminDb.collection("appointments").get().then(snapshot => {
        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        return batch.commit();
      }).then(() => {
        adminAppointments = [];
        showToast('All appointment data cleared from cloud.', 'success');
        refreshCurrentView();
      }).catch(err => {
        console.error("Clear failed:", err);
        showToast('Could not clear cloud data. Check connection.', 'error');
      });
    } else {
      localStorage.removeItem('sndc_appointments');
      showToast('All appointment data cleared.', 'success');
      refreshCurrentView();
    }
  });
}

// ─── CSV Export ────────────────────────────────────────────────────
document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);

function exportCSV() {
  const appts = getAppointments();
  if (appts.length === 0) { showToast('No appointments to export.', 'info'); return; }

  const headers = ['Booking ID','Name','Phone','Email','Age','Gender','Department','Doctor','Date','Time Slot','Status','Symptoms','Created At'];
  const rows = appts.map(a => [
    a.id, a.name, a.phone, a.email || '', a.age || '', a.gender || '',
    a.deptLabel || a.dept, a.doctorName || '', a.date, a.slot, a.status,
    `"${(a.symptoms||'').replace(/"/g,'""')}"`,
    new Date(a.created).toLocaleString('en-IN')
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sndc_appointments_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully!', 'success');
}

// ─── Navigation ────────────────────────────────────────────────────
let currentView = 'dashboard';

function showView(view) {
  document.querySelectorAll('.adm-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const page = document.getElementById(`page-${view}`);
  if (page) page.classList.add('active');

  document.querySelectorAll(`[data-view="${view}"]`).forEach(l => l.classList.add('active'));

  currentView = view;

  const titles = {
    dashboard:    { t: 'Dashboard Overview',      s: 'Welcome back, Admin' },
    appointments: { t: 'All Appointments',        s: 'Manage and update appointment statuses' },
    calendar:     { t: 'Calendar View',           s: 'Browse appointments by date' },
    settings:     { t: 'Settings',                s: 'Clinic & account configuration' },
  };

  const info = titles[view] || titles.dashboard;
  document.getElementById('topbarTitle').textContent    = info.t;
  document.getElementById('topbarSubtitle').textContent = info.s;

  if (view === 'dashboard') {
    renderStats();
    renderRecentTable();
    setTimeout(renderCharts, 100);
  } else if (view === 'appointments') {
    renderAppointmentsTable();
  } else if (view === 'calendar') {
    renderAdmCalendar();
  }

  // Close sidebar on mobile after nav
  if (window.innerWidth < 900) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function refreshCurrentView() {
  renderStats();
  renderRecentTable();
  if (currentView === 'appointments') renderAppointmentsTable();
  if (currentView === 'calendar')     renderAdmCalendar();
  if (currentView === 'dashboard')    setTimeout(renderCharts, 100);
}

// ─── Toast ─────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: 'circle-check', error: 'circle-xmark', info: 'circle-info' };
  t.innerHTML = `<i class="fa-solid fa-${icons[type]||'circle-info'}"></i> ${msg}`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; t.style.transition = 'all .35s';
    setTimeout(() => t.remove(), 400);
  }, 3000);
}

// ─── Clock ─────────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('topbarTime');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ─── Utilities ─────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDateShort(ds) {
  if (!ds) return '—';
  const d = new Date(ds + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Main Init ─────────────────────────────────────────────────────
function initDashboard() {
  // Sidebar nav
  document.querySelectorAll('.sidebar-link[data-view]').forEach(link => {
    link.addEventListener('click', () => showView(link.dataset.view));
  });

  // Mobile hamburger
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Appointment filters
  document.getElementById('apptSearch')?.addEventListener('input', e => {
    tableFilters.search = e.target.value;
    currentPage = 1;
    renderAppointmentsTable();
  });

  document.getElementById('apptDeptFilter')?.addEventListener('change', e => {
    tableFilters.dept = e.target.value;
    currentPage = 1;
    renderAppointmentsTable();
  });

  document.getElementById('apptStatusFilter')?.addEventListener('change', e => {
    tableFilters.status = e.target.value;
    currentPage = 1;
    renderAppointmentsTable();
  });

  document.getElementById('apptSortFilter')?.addEventListener('change', e => {
    tableFilters.sort = e.target.value;
    renderAppointmentsTable();
  });

  initAdmCalendar();
  initSettings();
  showView('dashboard');
  // Start Firebase real-time listener if configured
  startLiveListener();
}

// ─── Boot ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', checkAuth);


/* ================================================================
   AI CONVERSATIONS & ANALYTICS — Admin Extensions
   ================================================================ */

// ─── All AI chat logs (in-memory) ─────────────────────────────────
let allAIChats = [];

// ─── Load AI Chat Logs from Firebase ─────────────────────────────
function loadAIChats() {
  if (!isAdminFirebaseEnabled || !adminDb) {
    renderAIChatsEmpty();
    return;
  }

  adminDb.collection('ai_chats')
    .orderBy('timestamp', 'desc')
    .limit(200)
    .get()
    .then(snap => {
      allAIChats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderAIChatsTable(allAIChats);
      renderAIStats(allAIChats);

      // Show badge if there are today's chats
      const today = new Date().toISOString().split('T')[0];
      const todayChats = allAIChats.filter(c => c.timestamp?.startsWith(today));
      if (todayChats.length > 0) {
        const badge = document.getElementById('ai-chat-badge');
        if (badge) { badge.style.display = ''; badge.textContent = todayChats.length; }
      }
    })
    .catch(err => {
      console.warn('[Admin AI] Could not load chats:', err);
      renderAIChatsEmpty();
    });
}

// ─── Render AI Chats Table ─────────────────────────────────────────
function renderAIChatsTable(chats) {
  const tbody = document.getElementById('aiChatTableBody');
  if (!tbody) return;

  if (!chats || chats.length === 0) {
    renderAIChatsEmpty();
    return;
  }

  const intentColors = {
    book: '#1A72C8', cancel: '#EF4444', reschedule: '#F97316',
    availability: '#8B5CF6', faq: '#06B6D4', greeting: '#22C55E',
    emergency: '#DC2626', general: '#64748B', confirm_booking: '#16A34A'
  };

  tbody.innerHTML = chats.map(c => {
    const intent = c.intent || 'general';
    const color  = intentColors[intent] || '#64748B';
    const ts     = c.timestamp ? new Date(c.timestamp).toLocaleString('en-IN') : '—';
    const sessId = c.sessionId ? c.sessionId.substring(0, 12) + '…' : '—';

    return `<tr>
      <td style="font-size:0.78rem;white-space:nowrap;">${ts}</td>
      <td style="font-family:'Courier New',monospace;font-size:0.75rem;color:var(--adm-muted);">${sessId}</td>
      <td>${c.patientName || '<span style="opacity:.4">—</span>'}</td>
      <td>
        <span style="padding:3px 10px;border-radius:20px;background:${color}22;color:${color};font-size:0.72rem;font-weight:700;font-family:var(--font-heading);">
          ${intent.replace('_', ' ')}
        </span>
      </td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.82rem;" title="${(c.userMessage||'').replace(/"/g,'&quot;')}">
        ${c.userMessage || '—'}
      </td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.82rem;color:var(--adm-muted);" title="${(c.botMessage||'').replace(/"/g,'&quot;')}">
        ${c.botMessage || '—'}
      </td>
      <td>${c.department ? `<span style="text-transform:capitalize;">${c.department}</span>` : '—'}</td>
    </tr>`;
  }).join('');
}

function renderAIChatsEmpty() {
  const tbody = document.getElementById('aiChatTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7">
    <div class="empty-state">
      <i class="fa-solid fa-robot"></i>
      <h3>No AI conversations yet</h3>
      <p>Configure Firebase in config.js to start recording chatbot conversations.</p>
    </div>
  </td></tr>`;
}

// ─── Render AI Stats ──────────────────────────────────────────────
function renderAIStats(chats) {
  const total       = chats.length;
  const bookings    = chats.filter(c => c.intent === 'confirm_booking' || c.intent === 'book').length;
  const emergencies = chats.filter(c => c.intent === 'emergency').length;
  const sessions    = new Set(chats.map(c => c.sessionId)).size;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('aiTotal',       total);
  setEl('aiBookings',    bookings);
  setEl('aiEmergencies', emergencies);
  setEl('aiSessions',    sessions);
}

// ─── Filter AI Chats ──────────────────────────────────────────────
function filterAIChats() {
  const query  = (document.getElementById('aiChatSearch')?.value || '').toLowerCase();
  const intent = document.getElementById('intentFilter')?.value || '';

  let filtered = allAIChats;
  if (query) {
    filtered = filtered.filter(c =>
      (c.patientName || '').toLowerCase().includes(query) ||
      (c.userMessage  || '').toLowerCase().includes(query) ||
      (c.sessionId    || '').toLowerCase().includes(query)
    );
  }
  if (intent) {
    filtered = filtered.filter(c => (c.intent || '').includes(intent));
  }
  renderAIChatsTable(filtered);
}

// ─── Export AI Chats as CSV ───────────────────────────────────────
function exportAIChatsCSV() {
  if (!allAIChats.length) { alert('No AI chat data to export.'); return; }

  const headers = ['Timestamp','Session ID','Patient','Intent','User Message','Bot Reply','Department'];
  const rows = allAIChats.map(c => [
    c.timestamp || '', c.sessionId || '',
    c.patientName || '', c.intent || '',
    (c.userMessage || '').replace(/,/g,'|'),
    (c.botMessage  || '').replace(/,/g,'|'),
    c.department || ''
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ai-chats-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Render Analytics Page ────────────────────────────────────────
function renderAnalytics() {
  const appts = getAppointments();
  const all   = [...appts];

  // Also pull from chatbot localStorage bookings
  const chatbotAppts = JSON.parse(localStorage.getItem('shree_appointments') || '[]');
  chatbotAppts.forEach(ca => {
    if (!all.find(a => a.ref === ca.ref)) all.push(ca);
  });

  // Stats
  const total  = all.length;
  const aiAppts= all.filter(a => a.source === 'ai_chatbot').length;
  const neuro  = all.filter(a => a.dept === 'neuro' || a.department === 'neuro').length;
  const dental = all.filter(a => a.dept === 'dental' || a.department === 'dental').length;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('an-total',  total);
  setEl('an-ai',     aiAppts);
  setEl('an-neuro',  neuro);
  setEl('an-dental', dental);

  // Booking source donut
  setEl('src-ai',   aiAppts);
  setEl('src-form', total - aiAppts);
  renderAdminDonut('sourceDonut', [
    { value: aiAppts,        color: '#00B8A0' },
    { value: total - aiAppts, color: '#0A3D6B' }
  ]);

  // Monthly bar chart (last 6 months)
  renderMonthlyChart(all);

  // Hourly chart
  renderHourlyChart(all);
}

// ─── Monthly Bar Chart ────────────────────────────────────────────
function renderMonthlyChart(appts) {
  const container = document.getElementById('monthlyChart');
  if (!container) return;

  const months = [];
  const counts = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push(d.toLocaleDateString('en-IN', { month: 'short' }));
    counts.push(appts.filter(a => a.date && a.date.startsWith(key)).length);
  }

  const maxCount = Math.max(...counts, 1);
  container.innerHTML = counts.map((c, i) => {
    const pct = Math.round((c / maxCount) * 100);
    return `<div class="bar-col">
      <div class="bar-val">${c}</div>
      <div class="bar-fill" style="height:${pct}%;background:linear-gradient(to top,#0A3D6B,#1A72C8);"></div>
      <div class="bar-label">${months[i]}</div>
    </div>`;
  }).join('');
}

// ─── Hourly Bar Chart ─────────────────────────────────────────────
function renderHourlyChart(appts) {
  const container = document.getElementById('hourlyChart');
  if (!container) return;

  const slotLabels = ['6PM','6:30','7PM','7:30','8PM','8:30','9PM'];
  const slotKeys   = ['6:00 PM','6:30 PM','7:00 PM','7:30 PM','8:00 PM','8:30 PM','9:00 PM'];
  const counts     = slotKeys.map(s => appts.filter(a => a.slot === s || a.timeSlot === s).length);
  const maxCount   = Math.max(...counts, 1);

  container.innerHTML = counts.map((c, i) => {
    const pct = Math.round((c / maxCount) * 100);
    return `<div class="bar-col">
      <div class="bar-val">${c}</div>
      <div class="bar-fill" style="height:${pct}%;background:linear-gradient(to top,#008B79,#00B8A0);"></div>
      <div class="bar-label">${slotLabels[i]}</div>
    </div>`;
  }).join('');
}

// ─── Donut Chart Helper ───────────────────────────────────────────
function renderAdminDonut(svgId, segments) {
  const svg = document.getElementById(svgId);
  if (!svg) return;

  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) { svg.innerHTML = ''; return; }

  const cx = 55, cy = 55, r = 40, strokeW = 18;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  svg.innerHTML = segments.map(seg => {
    const dash = (seg.value / total) * circ;
    const gap  = circ - dash;
    const el   = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${seg.color}" stroke-width="${strokeW}"
      stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}"
      stroke-dashoffset="${-offset.toFixed(1)}"
      transform="rotate(-90 ${cx} ${cy})" />`;
    offset += dash;
    return el;
  }).join('') + `<text x="${cx}" y="${cy+1}" text-anchor="middle"
    dominant-baseline="middle" font-size="14" font-weight="800"
    fill="var(--adm-text)" font-family="var(--font-heading)">${total}</text>`;
}

// ─── Hook into showView for new pages ────────────────────────────
const _origShowView = typeof showView !== 'undefined' ? showView : null;

// Extend showView to handle AI chats and analytics
document.addEventListener('DOMContentLoaded', () => {
  // Wait for original init then patch sidebar buttons
  setTimeout(() => {
    document.querySelectorAll('.sidebar-link[data-view]').forEach(btn => {
      const view = btn.dataset.view;
      if (view === 'ai-chats' || view === 'analytics') {
        btn.addEventListener('click', () => {
          // Deactivate all sidebar links
          document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
          btn.classList.add('active');
          // Hide all pages
          document.querySelectorAll('.adm-page').forEach(p => p.classList.remove('active'));
          // Show target page
          const target = document.getElementById(`page-${view}`);
          if (target) target.classList.add('active');
          // Update topbar
          const titles = { 'ai-chats': 'AI Conversations', 'analytics': 'Analytics' };
          const topbarTitle = document.getElementById('topbarTitle');
          if (topbarTitle) topbarTitle.textContent = titles[view] || view;

          // Load data for the view
          if (view === 'ai-chats') loadAIChats();
          if (view === 'analytics') renderAnalytics();
        });
      }
    });
  }, 800);
});
