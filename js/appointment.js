/* ================================================================
   SHREE NEURO & DENTAL — APPOINTMENT BOOKING LOGIC
   appointment.js — Multi-step wizard, calendar, slots, localStorage
   ================================================================ */

'use strict';

// ─── Firebase Initialization ──────────────────────────────────────
const isFirebaseEnabled = typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey;
let db;
if (isFirebaseEnabled) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}


// ─── Doctors Data ─────────────────────────────────────────────────
const DOCTORS = {
  neuro: [
    {
      id: 'mkk',
      name: 'Dr. Mahesh Kumar Kusta',
      title: 'Brain & Spine Surgeon',
      quali: 'MBBS (Gold Medalist) · MS · MCh · FNE',
      img: '../images/doctor_profile_1.jpg',
    }
  ],
  dental: [
    {
      id: 'dental-specialist',
      name: 'Dental Specialist',
      title: 'Dental & Oral Surgery',
      quali: 'BDS · MDS · Prosthodontics & Implantology',
      img: '../images/Doctor_profile.jpg',
    }
  ]
};

// ─── Time Slots ───────────────────────────────────────────────────
const TIME_SLOTS = [
  '6:00 PM', '6:30 PM', '7:00 PM',
  '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM'
];

const MAX_PER_SLOT = 5; // max bookings per slot

// ─── State ────────────────────────────────────────────────────────
let currentStep = 1;
const TOTAL_STEPS = 4;

const state = {
  dept: null,
  doctor: null,
  date: null,
  slot: null,
  firstName: '', lastName: '', phone: '', email: '',
  age: '', gender: null, symptoms: ''
};

// ─── Helpers ──────────────────────────────────────────────────────
let activeBookings = [];
function loadInitialBookings() {
  if (isFirebaseEnabled) {
    db.collection("appointments").get()
      .then(snapshot => {
        activeBookings = [];
        snapshot.forEach(doc => activeBookings.push(doc.data()));
        if (typeof renderCalendar === 'function') {
          renderCalendar();
        }
      })
      .catch(err => {
        console.error("Error loading bookings from Firebase:", err);
      });
  }
}

function getAllBookings() {
  if (isFirebaseEnabled) {
    return activeBookings;
  }
  try { return JSON.parse(localStorage.getItem('sndc_appointments') || '[]'); } catch { return []; }
}


function getSlotCount(dateStr, slot) {
  return getAllBookings().filter(b => b.date === dateStr && b.slot === slot && b.status !== 'Cancelled').length;
}

function isDateAvailable(dateStr) {
  // Returns true if at least 1 slot has availability
  return TIME_SLOTS.some(s => getSlotCount(dateStr, s) < MAX_PER_SLOT);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function generateBookingId() {
  const now = new Date();
  const existing = getAllBookings();
  const num = String(existing.length + 1).padStart(4, '0');
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `SND-${y}${m}${d}-${num}`;
}

function getDeptLabel(dept) {
  return dept === 'neuro' ? 'Neurology / Brain & Spine' : 'Dental & Orthodontics';
}

// ─── Step Navigation ──────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.appt-step').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`step-${n}`);
  if (target) { target.classList.add('active'); currentStep = n; }
  updateProgress(n);
  window.scrollTo({ top: document.getElementById('apptWrapper').offsetTop - 120, behavior: 'smooth' });
}

function updateProgress(n) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot = document.getElementById(`prog-${i}`);
    if (!dot) continue;
    dot.classList.remove('active', 'done');
    if (i < n) dot.classList.add('done');
    else if (i === n) dot.classList.add('active');
  }
  for (let i = 1; i < TOTAL_STEPS; i++) {
    const line = document.getElementById(`line-${i}`);
    if (line) line.classList.toggle('done', i < n);
  }
}

// ─── Step 1 — Department & Doctor ─────────────────────────────────
function initStep1() {
  document.querySelectorAll('.dept-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.dept-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      state.dept = el.dataset.dept;
      state.doctor = null;
      renderDoctors(state.dept);
      document.getElementById('doctorSection').style.display = 'block';
    });
  });
}

function renderDoctors(dept) {
  const container = document.getElementById('doctorCards');
  container.innerHTML = '';
  (DOCTORS[dept] || []).forEach(doc => {
    const card = document.createElement('div');
    card.className = 'doctor-option';
    card.dataset.docId = doc.id;
    card.innerHTML = `
      <div class="doc-avatar">
        <img src="${doc.img}" alt="${doc.name}" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-user-doctor\\'></i>'">
      </div>
      <div class="doc-info">
        <div class="doc-name">${doc.name}</div>
        <div class="doc-spec">${doc.title}<br><small style="opacity:0.75">${doc.quali}</small></div>
      </div>
      <div class="doc-radio"></div>
    `;
    card.addEventListener('click', () => {
      container.querySelectorAll('.doctor-option').forEach(o => o.classList.remove('selected'));
      card.classList.add('selected');
      state.doctor = doc;
    });
    container.appendChild(card);
    // Auto-select if only one doctor
    if (DOCTORS[dept].length === 1) {
      card.click();
    }
  });
}

function validateStep1() {
  if (!state.dept) { showToast('Please select a department.', 'error'); return false; }
  if (!state.doctor) { showToast('Please select a doctor.', 'error'); return false; }
  return true;
}

// ─── Step 2 — Calendar & Time Slots ───────────────────────────────
let calYear, calMonth;

function initStep2() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();

  document.getElementById('calPrev').addEventListener('click', () => {
    const now2 = new Date();
    if (calYear === now2.getFullYear() && calMonth === now2.getMonth()) return;
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });

  document.getElementById('calNext').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });
}

function renderCalendar() {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calTitle').textContent = `${monthNames[calMonth]} ${calYear}`;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const grid = document.getElementById('calDays');
  grid.innerHTML = '';

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(calYear, calMonth, d);
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = cellDate.getDay(); // 0=Sun
    const isPast = cellDate < today;
    const isSun = dow === 0;
    const isToday = cellDate.getTime() === today.getTime();

    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;

    if (isSun) { cell.classList.add('sunday-col'); }
    else if (isPast) { cell.classList.add('disabled'); }
    else {
      const hasSlots = isDateAvailable(dateStr);
      if (hasSlots) cell.classList.add('has-slots');
      cell.addEventListener('click', () => selectDate(dateStr, cell));
    }

    if (isToday) cell.classList.add('today');
    if (state.date === dateStr) cell.classList.add('selected');

    grid.appendChild(cell);
  }
}

function selectDate(dateStr, cell) {
  document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
  cell.classList.add('selected');
  state.date = dateStr;
  state.slot = null;
  renderTimeSlots(dateStr);
  document.getElementById('slotsSection').style.display = 'block';
  document.getElementById('slotDateLabel').textContent = `Available slots for ${formatDate(dateStr)}`;
}

function renderTimeSlots(dateStr) {
  const container = document.getElementById('slotsGrid');
  container.innerHTML = '';

  TIME_SLOTS.forEach(slot => {
    const count = getSlotCount(dateStr, slot);
    const remaining = MAX_PER_SLOT - count;
    const isBooked = remaining <= 0;

    const btn = document.createElement('button');
    btn.className = 'slot-btn' + (isBooked ? ' booked' : '');
    btn.type = 'button';
    btn.innerHTML = `
      <span class="slot-time">${slot}</span>
      <span class="slot-avail">${isBooked ? 'Full' : `${remaining} left`}</span>
    `;

    if (!isBooked) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.slot = slot;
      });
    }

    if (state.slot === slot && !isBooked) btn.classList.add('selected');
    container.appendChild(btn);
  });
}

function validateStep2() {
  if (!state.date) { showToast('Please select a date.', 'error'); return false; }
  if (!state.slot) { showToast('Please select a time slot.', 'error'); return false; }
  return true;
}

// ─── Step 3 — Patient Details ──────────────────────────────────────
function validateStep3() {
  let valid = true;

  const fields = [
    { id: 'firstName', key: 'firstName', label: 'First Name', required: true },
    { id: 'lastName',  key: 'lastName',  label: 'Last Name',  required: true },
    { id: 'phone',     key: 'phone',     label: 'Phone',      required: true, pattern: /^[\d\s\+\-]{10,15}$/ },
    { id: 'email',     key: 'email',     label: 'Email',      required: false, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    { id: 'age',       key: 'age',       label: 'Age',        required: true, pattern: /^\d{1,3}$/ },
  ];

  fields.forEach(f => {
    const el = document.getElementById(f.id);
    const errEl = document.getElementById(`err-${f.id}`);
    const val = el.value.trim();
    el.classList.remove('error');
    if (errEl) errEl.textContent = '';

    if (f.required && !val) {
      el.classList.add('error');
      if (errEl) errEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> This field is required.';
      valid = false;
    } else if (val && f.pattern && !f.pattern.test(val)) {
      el.classList.add('error');
      if (errEl) errEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Enter a valid ${f.label.toLowerCase()}.`;
      valid = false;
    } else {
      state[f.key] = val;
    }
  });

  if (!state.gender) {
    document.getElementById('err-gender').innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Please select a gender.';
    valid = false;
  }

  state.symptoms = document.getElementById('symptoms').value.trim();
  return valid;
}

function initStep3() {
  // Gender pills
  document.querySelectorAll('.gender-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.gender-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      state.gender = opt.dataset.gender;
      document.getElementById('err-gender').textContent = '';
    });
  });
}

// ─── Step 4 — Review & Confirm ────────────────────────────────────
function buildReview() {
  document.getElementById('rv-dept').textContent = getDeptLabel(state.dept);
  document.getElementById('rv-doctor').textContent = state.doctor?.name || '—';
  document.getElementById('rv-date').textContent = formatDate(state.date);
  document.getElementById('rv-slot').textContent = state.slot;
  document.getElementById('rv-name').textContent = `${state.firstName} ${state.lastName}`;
  document.getElementById('rv-phone').textContent = state.phone;
  document.getElementById('rv-email').textContent = state.email || 'Not provided';
  document.getElementById('rv-age').textContent = `${state.age} years`;
  document.getElementById('rv-gender').textContent = state.gender;
  document.getElementById('rv-symptoms').textContent = state.symptoms || 'No symptoms specified';
}

function validateStep4() {
  const terms = document.getElementById('termsCheck');
  if (!terms.checked) {
    showToast('Please agree to the terms to proceed.', 'error');
    return false;
  }
  return true;
}

// ─── Submit Booking ────────────────────────────────────────────────
function submitBooking() {
  const id = generateBookingId();

  const booking = {
    id,
    ref: id,
    dept: state.dept,
    department: state.dept,
    deptLabel: getDeptLabel(state.dept),
    doctorId: state.doctor?.id,
    doctorName: state.doctor?.name,
    doctor: state.doctor?.name,
    date: state.date,
    slot: state.slot,
    firstName: state.firstName,
    lastName: state.lastName,
    name: `${state.firstName} ${state.lastName}`,
    patientName: `${state.firstName} ${state.lastName}`,
    phone: state.phone,
    patientPhone: state.phone,
    email: state.email,
    patientEmail: state.email,
    age: state.age,
    patientAge: state.age,
    gender: state.gender,
    patientGender: state.gender,
    symptoms: state.symptoms,
    status: 'Pending',
    created: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    source: 'web_form'
  };

  // Prevent double submissions
  const btn = document.getElementById('confirmBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  }

  if (isFirebaseEnabled) {
    db.collection("appointments").doc(id).set(booking)
      .then(() => {
        activeBookings.push(booking);
        showSuccess(booking);
      })
      .catch(err => {
        console.error("Firebase write failed, fallback to local storage:", err);
        showToast("Cloud sync failed. Booking saved locally.", "info");
        saveLocal(booking);
      });
  } else {
    saveLocal(booking);
  }
}

function saveLocal(booking) {
  const bookings = [];
  try {
    const local = JSON.parse(localStorage.getItem('sndc_appointments') || '[]');
    local.push(booking);
    localStorage.setItem('sndc_appointments', JSON.stringify(local));
  } catch(e) {
    console.error(e);
  }
  showSuccess(booking);
}


// ─── Success Screen ────────────────────────────────────────────────
function showSuccess(booking) {
  document.getElementById('apptCard').style.display = 'none';
  document.getElementById('progressWrap').style.display = 'none';

  const sc = document.getElementById('successScreen');
  sc.classList.add('active');

  document.getElementById('sc-id').textContent = booking.id;
  document.getElementById('sc-name').textContent = booking.name;
  document.getElementById('sc-dept').textContent = booking.deptLabel;
  document.getElementById('sc-date').textContent = formatDate(booking.date);
  document.getElementById('sc-slot').textContent = booking.slot;
  document.getElementById('sc-doctor').textContent = booking.doctorName;

  // WhatsApp share
  const wa = document.getElementById('sc-whatsapp');
  const waMsg = encodeURIComponent(
    `Hello, I have booked an appointment at Shree Neuro & Dental Health Care.\n\nBooking ID: ${booking.id}\nName: ${booking.name}\nDate: ${formatDate(booking.date)}\nTime: ${booking.slot}\nDepartment: ${booking.deptLabel}\n\nKindly confirm my slot. Thank you.`
  );
  wa.href = `https://wa.me/917008956183?text=${waMsg}`;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Toast ─────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: 'circle-check', error: 'circle-xmark', info: 'circle-info' };
  toast.innerHTML = `<i class="fa-solid fa-${icons[type] || 'circle-info'}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.35s ease';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ─── Main Initialization ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initStep1();
  initStep2();
  initStep3();

  // Next buttons
  document.getElementById('next1').addEventListener('click', () => {
    if (validateStep1()) goToStep(2);
  });

  document.getElementById('next2').addEventListener('click', () => {
    if (validateStep2()) goToStep(3);
  });

  document.getElementById('next3').addEventListener('click', () => {
    if (validateStep3()) { buildReview(); goToStep(4); }
  });

  document.getElementById('confirmBtn').addEventListener('click', () => {
    if (validateStep4()) submitBooking();
  });

  // Back buttons
  document.getElementById('back2').addEventListener('click', () => goToStep(1));
  document.getElementById('back3').addEventListener('click', () => goToStep(2));
  document.getElementById('back4').addEventListener('click', () => goToStep(3));

  // New booking
  const newApptBtn = document.getElementById('newApptBtn');
  if (newApptBtn) {
    newApptBtn.addEventListener('click', () => {
      location.reload();
    });
  }

  // Progress step click (navigate back)
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById(`prog-${i}`);
    if (el) {
      el.addEventListener('click', () => {
        if (i < currentStep) goToStep(i);
      });
    }
  }
});
