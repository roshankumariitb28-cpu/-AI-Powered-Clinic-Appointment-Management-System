/* ================================================================
   SHREE NEURO & DENTAL — CHAT WIDGET UI CONTROLLER
   chat-widget.js — DOM creation, rendering, events, calendar, slots
   ================================================================ */

'use strict';

class ShreeChatWidget {

  constructor() {
    this.isOpen = false;
    this.unreadCount = 0;
    this.chatbot = null;
    this.currentCalendarDate = new Date();
    this.selectedDate = null;
    this._injectStyles();
    this._buildDOM();
    this._attachEvents();
    this._initTheme();
    setTimeout(() => this._initChatbot(), 300);
  }

  // ─── Inject Link to CSS ───────────────────────────────────────────
  _injectStyles() {
    if (!document.querySelector('link[href*="chatbot.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      // Auto-detect path based on current page location
      const isAdmin = window.location.pathname.includes('/admin/');
      link.href = isAdmin ? '../css/chatbot.css' : 'css/chatbot.css';
      document.head.appendChild(link);
    }
  }

  // ─── Build DOM ────────────────────────────────────────────────────
  _buildDOM() {
    // Toast container
    const toastContainer = document.createElement('div');
    toastContainer.id = 'cb-toast-container';
    document.body.appendChild(toastContainer);

    // Dark mode toggle
    const themeBtn = document.createElement('button');
    themeBtn.id = 'theme-toggle-btn';
    themeBtn.setAttribute('aria-label', 'Toggle dark/light mode');
    themeBtn.title = 'Toggle dark/light mode';
    themeBtn.innerHTML = `
      <svg id="theme-icon-moon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/>
      </svg>
      <svg id="theme-icon-sun" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" style="display:none">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/>
      </svg>`;
    document.body.appendChild(themeBtn);

    // Floating trigger button
    const trigger = document.createElement('button');
    trigger.id = 'chatbot-trigger';
    trigger.setAttribute('aria-label', 'Open AI chat assistant');
    trigger.innerHTML = `
      <svg class="icon-chat" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/>
      </svg>
      <svg class="icon-close" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
      </svg>
      <span id="chatbot-badge" class="hidden">1</span>`;
    document.body.appendChild(trigger);

    // Chat panel
    const panel = document.createElement('div');
    panel.id = 'chatbot-panel';
    panel.className = 'hidden';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'AI Appointment Assistant');
    panel.innerHTML = `
      <!-- Header -->
      <div class="cb-header">
        <div class="cb-avatar">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
          </svg>
          <span class="cb-online-dot"></span>
        </div>
        <div class="cb-header-info">
          <div class="cb-header-name">Shreya — AI Health Assistant</div>
          <div class="cb-header-status">🟢 Online · Shree Neuro &amp; Dental</div>
        </div>
        <div class="cb-header-actions">
          <button class="cb-header-btn" id="cb-refresh-btn" title="New Conversation" aria-label="New conversation">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
            </svg>
          </button>
          <button class="cb-header-btn" id="cb-close-btn" title="Close" aria-label="Close chat">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div class="cb-messages" id="cb-messages" role="log" aria-live="polite"></div>

      <!-- Chips Area -->
      <div id="cb-chips-area"></div>

      <!-- Input Area -->
      <div class="cb-input-area">
        <div class="cb-input-row">
          <textarea
            class="cb-input"
            id="cb-input"
            placeholder="Type your message..."
            rows="1"
            aria-label="Message input"
            autocomplete="off"
          ></textarea>
          <button class="cb-send-btn" id="cb-send-btn" aria-label="Send message">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>
            </svg>
          </button>
        </div>
        <div class="cb-input-hint">Powered by Shree AI · Press Enter to send</div>
      </div>`;

    document.body.appendChild(panel);
  }

  // ─── Attach Events ────────────────────────────────────────────────
  _attachEvents() {
    // Trigger button
    document.getElementById('chatbot-trigger').addEventListener('click', () => this.toggle());

    // Close button
    document.getElementById('cb-close-btn').addEventListener('click', () => this.close());

    // Refresh/new conversation button
    document.getElementById('cb-refresh-btn').addEventListener('click', () => this._newConversation());

    // Send button
    document.getElementById('cb-send-btn').addEventListener('click', () => this._sendMessage());

    // Input keyboard
    const input = document.getElementById('cb-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // Theme toggle
    document.getElementById('theme-toggle-btn').addEventListener('click', () => this._toggleTheme());

    // Close on backdrop click (mobile)
    document.getElementById('chatbot-panel').addEventListener('click', (e) => {
      if (e.target.id === 'chatbot-panel') this.close();
    });
  }

  // ─── Initialize Chatbot Engine ────────────────────────────────────
  _initChatbot() {
    this.chatbot = new ShreeAIChatbot({
      addMessage: (role, content) => this.addMessage(role, content),
      showTyping: () => this.showTyping(),
      hideTyping: () => this.hideTyping()
    });
    window.ShreeAI = this.chatbot;

    // Show welcome message after short delay
    setTimeout(() => {
      this.addMessage('bot', `👋 Hi there! I'm **Shreya**, your AI health assistant at **Shree Neuro & Dental Health Care**.

I can help you **book, reschedule, or cancel appointments**, check doctor availability, or answer any questions about our clinic. How can I assist you today?`);

      this._renderChips(['📅 Book Appointment', '🧠 Neurology', '🦷 Dental', '⏰ Clinic Hours']);
    }, 400);

    // Show unread badge after 3 seconds if chat is closed
    setTimeout(() => {
      if (!this.isOpen) this._showBadge(1);
    }, 3000);
  }

  // ─── Open / Close / Toggle ────────────────────────────────────────
  open() {
    this.isOpen = true;
    const panel = document.getElementById('chatbot-panel');
    const trigger = document.getElementById('chatbot-trigger');
    panel.classList.remove('hidden');
    panel.classList.add('visible');
    trigger.classList.add('is-open');
    this._hideBadge();
    setTimeout(() => document.getElementById('cb-input').focus(), 400);
    this._scrollToBottom();
  }

  close() {
    this.isOpen = false;
    const panel = document.getElementById('chatbot-panel');
    const trigger = document.getElementById('chatbot-trigger');
    panel.classList.add('hidden');
    panel.classList.remove('visible');
    trigger.classList.remove('is-open');
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  // ─── Add Message Bubble ───────────────────────────────────────────
  addMessage(role, text, extraContent = null) {
    const messages = document.getElementById('cb-messages');

    // Clear chips
    document.getElementById('cb-chips-area').innerHTML = '';

    const row = document.createElement('div');
    row.className = `cb-message-row ${role}`;

    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    if (role === 'bot') {
      row.innerHTML = `
        <div class="cb-msg-avatar">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
          </svg>
        </div>
        <div>
          <div class="cb-bubble">${this._formatText(text)}</div>
          ${extraContent ? extraContent : ''}
          <div class="cb-msg-time">${time}</div>
        </div>`;
    } else {
      row.innerHTML = `
        <div>
          <div class="cb-bubble">${this._escapeHTML(text)}</div>
          <div class="cb-msg-time">${time} ✓</div>
        </div>`;
    }

    messages.appendChild(row);
    this._scrollToBottom();

    // Increment unread if closed
    if (!this.isOpen && role === 'bot') {
      this.unreadCount++;
      this._showBadge(this.unreadCount);
    }
  }

  // ─── Typing Indicator ─────────────────────────────────────────────
  showTyping() {
    const messages = document.getElementById('cb-messages');
    const existing = document.getElementById('cb-typing-indicator');
    if (existing) return;

    const typing = document.createElement('div');
    typing.id = 'cb-typing-indicator';
    typing.className = 'cb-typing';
    typing.innerHTML = `
      <div class="cb-msg-avatar">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
        </svg>
      </div>
      <div class="cb-typing-bubble">
        <span class="cb-dot"></span>
        <span class="cb-dot"></span>
        <span class="cb-dot"></span>
      </div>`;

    messages.appendChild(typing);
    this._scrollToBottom();
  }

  hideTyping() {
    const typing = document.getElementById('cb-typing-indicator');
    if (typing) typing.remove();
  }

  // ─── Quick Reply Chips ────────────────────────────────────────────
  _renderChips(chips) {
    if (!chips || chips.length === 0) return;
    const area = document.getElementById('cb-chips-area');
    area.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'cb-chips';

    chips.forEach(chip => {
      const btn = document.createElement('button');
      btn.className = 'cb-chip';
      btn.textContent = chip;
      btn.addEventListener('click', () => {
        area.innerHTML = '';
        this._handleUserInput(chip);
      });
      wrapper.appendChild(btn);
    });

    area.appendChild(wrapper);
    this._scrollToBottom();
  }

  // ─── Calendar Renderer ────────────────────────────────────────────
  _renderCalendar(container) {
    const cal = document.createElement('div');
    cal.className = 'cb-calendar';

    const today = new Date();
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();

    const monthName = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    cal.innerHTML = `
      <div class="cb-cal-header">
        <button class="cb-cal-nav" id="cb-cal-prev" aria-label="Previous month">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
          </svg>
        </button>
        <span class="cb-cal-title">${monthName}</span>
        <button class="cb-cal-nav" id="cb-cal-next" aria-label="Next month">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
          </svg>
        </button>
      </div>
      <div class="cb-cal-grid" id="cb-cal-grid">
        ${dayNames.map(d => `<div class="cb-cal-day-name">${d}</div>`).join('')}
      </div>`;

    container.appendChild(cal);

    const grid = cal.querySelector('#cb-cal-grid');

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'cb-cal-day empty';
      grid.appendChild(empty);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(year, month, d);
      const dayEl = document.createElement('div');
      dayEl.className = 'cb-cal-day';
      dayEl.textContent = d;

      const isPast = dayDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isSunday = dayDate.getDay() === 0;
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

      if (isPast || isSunday) {
        dayEl.classList.add('disabled');
        if (isSunday) dayEl.classList.add('sunday');
      } else {
        if (isToday) dayEl.classList.add('today');
        if (this.selectedDate && dayDate.toDateString() === new Date(this.selectedDate).toDateString()) {
          dayEl.classList.add('selected');
        }

        dayEl.addEventListener('click', () => {
          // Remove previous selected
          grid.querySelectorAll('.cb-cal-day.selected').forEach(el => el.classList.remove('selected'));
          dayEl.classList.add('selected');

          const dateISO = dayDate.toISOString().split('T')[0];
          const dateLabel = dayDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
          this.selectedDate = dateISO;
          this._onDateSelected(dateISO, dateLabel);
        });
      }

      grid.appendChild(dayEl);
    }

    // Nav events
    cal.querySelector('#cb-cal-prev').addEventListener('click', () => {
      this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
      container.innerHTML = '';
      this._renderCalendar(container);
    });

    cal.querySelector('#cb-cal-next').addEventListener('click', () => {
      this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
      container.innerHTML = '';
      this._renderCalendar(container);
    });
  }

  // ─── Slot Grid Renderer ───────────────────────────────────────────
  _renderSlots(container, date) {
    const slots = (typeof CLINIC_CONFIG !== 'undefined' ? CLINIC_CONFIG.timeSlots : null)
               || ['6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM'];

    const availability = this.chatbot ? this.chatbot.getAllSlotAvailability(date) : slots.map(s => ({ slot: s, available: true, remaining: 5 }));

    const grid = document.createElement('div');
    grid.className = 'cb-slot-grid';

    availability.forEach(({ slot, available, remaining }) => {
      const btn = document.createElement('button');
      btn.className = `cb-slot ${!available ? 'full' : ''}`;
      btn.innerHTML = `${slot}<span class="cb-slot-count">${available ? `${remaining} left` : 'Full'}</span>`;

      if (!available) {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          grid.querySelectorAll('.cb-slot').forEach(el => el.classList.remove('selected'));
          btn.classList.add('selected');
          setTimeout(() => this._onSlotSelected(slot), 300);
        });
      }

      grid.appendChild(btn);
    });

    container.appendChild(grid);
  }

  _renderConfirmCard(mem) {
    const doctor = mem.department === 'neuro' ? 'Dr. Mahesh Kumar Kusta' : 'Dental Specialist';
    const ref = mem.appointmentRef || '—';
    const whatsappNum = typeof CLINIC_CONFIG !== 'undefined' ? CLINIC_CONFIG.whatsappNumber : '917008956183';
    const deptLabel = mem.department === 'neuro' ? 'Neurology / Brain & Spine' : 'Dental & Orthodontics';
    const waText = encodeURIComponent(
      `Hello, I have submitted an appointment booking request.\n\nBooking ID: ${ref}\nPatient: ${mem.patientName}\nDoctor: ${doctor}\nDepartment: ${deptLabel}\nDate: ${mem.dateLabel || mem.date}\nTime: ${mem.slot}\n\nPlease confirm my slot. Thank you.`
    );

    // Determine base path (admin subfolder vs root)
    const isAdmin = window.location.pathname.includes('/admin/');
    const basePath = isAdmin ? '../' : '';

    return `
      <div class="cb-success-card cb-pending-card">
        <div class="cb-success-icon cb-pending-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
        </div>
        <div class="cb-success-title">Booking Request Received! ⏳</div>
        <div class="cb-success-detail">
          👨‍⚕️ ${doctor}<br>
          📅 ${mem.dateLabel || mem.date}<br>
          🕐 ${mem.slot}<br>
          👤 ${mem.patientName}<br>
          📱 ${mem.patientPhone}
        </div>
        <div class="cb-ref-code" style="color: #D97706; background: rgba(245, 158, 11, 0.1);">Ref: ${ref}</div>
        <div style="font-size:0.75rem; color:var(--cb-text-muted); margin-top:10px; margin-bottom:4px; line-height:1.4;">
          ⚠️ Your booking is <strong>Pending Confirmation</strong>. Our clinic team will review and confirm or cancel your slot shortly.<br><br>
          📋 <strong>Save your Ref: ${ref}</strong> — use it to check your status anytime.
        </div>
        <div class="cb-appt-actions" style="margin-top:14px; flex-wrap: wrap; gap: 8px;">
          <button class="cb-appt-btn secondary" onclick="window.open('https://wa.me/${whatsappNum}?text=${waText}', '_blank')">
            💬 WhatsApp
          </button>
          <button class="cb-appt-btn primary" onclick="window.open('${basePath}my-appointment.html?ref=${ref}', '_blank')" style="background: linear-gradient(135deg, #10b981, #059669);">
            🔍 Check My Status
          </button>
          <button class="cb-appt-btn secondary" onclick="ShreeChatWidgetInstance.addToCalendar()" style="width:100%; margin-top:4px;">
            📅 Add to Calendar
          </button>
        </div>
      </div>`;
  }

  // ─── Send Message Flow ────────────────────────────────────────────
  async _sendMessage() {
    const input = document.getElementById('cb-input');
    const text = input.value.trim();
    if (!text || !this.chatbot) return;

    input.value = '';
    input.style.height = 'auto';
    document.getElementById('cb-chips-area').innerHTML = '';

    this.addMessage('user', text);
    this.showTyping();

    // Simulate minimum typing delay for UX
    const [response] = await Promise.all([
      this.chatbot.processMessage(text),
      new Promise(r => setTimeout(r, 800))
    ]);

    this.hideTyping();

    if (!response) return;

    // Build extra content
    let extra = '';
    if (response.confirmBooking && this.chatbot._isBookingReady()) {
      // Save the booking
      const savedBooking = await this.chatbot._saveBooking();
      // Render the pending confirmation card using the saved details
      extra = this._renderConfirmCard({
        department: savedBooking.department,
        appointmentRef: savedBooking.ref,
        date: savedBooking.date,
        dateLabel: savedBooking.dateLabel,
        slot: savedBooking.slot,
        patientName: savedBooking.patientName,
        patientPhone: savedBooking.patientPhone
      });
      // Clear/Reset the chatbot session memory so subsequent user inputs start clean
      this.chatbot.resetSession();
    }

    this.addMessage('bot', response.reply, extra);

    // Show calendar if needed
    if (response.showCalendar) {
      const calContainer = document.createElement('div');
      calContainer.style.padding = '0 16px 8px';
      this._renderCalendar(calContainer);
      document.getElementById('cb-messages').appendChild(calContainer);
    }

    // Show slots if needed
    if (response.showSlots && this.chatbot.sessionMemory.date) {
      const slotContainer = document.createElement('div');
      slotContainer.style.padding = '0 16px 8px';
      this._renderSlots(slotContainer, this.chatbot.sessionMemory.date);
      document.getElementById('cb-messages').appendChild(slotContainer);
    }

    // Show chips
    if (response.showChips && response.showChips.length > 0) {
      this._renderChips(response.showChips);
    }

    // Emergency styling
    if (response.isEmergency) {
      this._renderEmergencyBanner();
    }

    this._scrollToBottom();
  }

  // ─── Handle User Input (from chips or programmatic) ───────────────
  async _handleUserInput(text) {
    const input = document.getElementById('cb-input');
    input.value = text;
    await this._sendMessage();
  }

  // ─── Date Selected Callback ───────────────────────────────────────
  async _onDateSelected(dateISO, dateLabel) {
    if (!this.chatbot) return;
    this.addMessage('user', `I want an appointment on ${dateLabel}`);
    this.showTyping();

    const [response] = await Promise.all([
      this.chatbot.handleDateSelection(dateISO, dateLabel),
      new Promise(r => setTimeout(r, 700))
    ]);

    this.hideTyping();
    if (!response) return;

    this.addMessage('bot', response.reply);

    if (response.showSlots) {
      const slotContainer = document.createElement('div');
      slotContainer.style.padding = '0 16px 8px';
      this._renderSlots(slotContainer, dateISO);
      document.getElementById('cb-messages').appendChild(slotContainer);
    }

    if (response.showChips?.length) this._renderChips(response.showChips);
    this._scrollToBottom();
  }

  // ─── Slot Selected Callback ───────────────────────────────────────
  async _onSlotSelected(slot) {
    if (!this.chatbot) return;
    this.addMessage('user', `I'll take the ${slot} slot`);
    this.showTyping();

    const [response] = await Promise.all([
      this.chatbot.handleSlotSelection(slot),
      new Promise(r => setTimeout(r, 700))
    ]);

    this.hideTyping();
    if (!response) return;

    this.addMessage('bot', response.reply);
    if (response.showChips?.length) this._renderChips(response.showChips);
    this._scrollToBottom();
  }

  // ─── Emergency Banner ─────────────────────────────────────────────
  _renderEmergencyBanner() {
    const messages = document.getElementById('cb-messages');
    const banner = document.createElement('div');
    banner.style.cssText = `
      background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05));
      border: 1.5px solid rgba(239,68,68,0.4);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      gap: 10px;
      align-items: center;
      font-family: Inter, sans-serif;
      font-size: 0.82rem;
      color: #DC2626;
      font-weight: 600;
      margin: 8px 0;
      animation: msgIn 0.4s ease both;
    `;
    banner.innerHTML = `
      ⚠️ Emergency? Call <a href="tel:+919337388068" style="color:#DC2626;font-weight:700;">+91 93373 88068</a>
      or <a href="tel:108" style="color:#DC2626;font-weight:700;">108 (Ambulance)</a> immediately.`;
    messages.appendChild(banner);
  }

  // ─── New Conversation ─────────────────────────────────────────────
  _newConversation() {
    if (this.chatbot) this.chatbot.resetSession();
    document.getElementById('cb-messages').innerHTML = '';
    document.getElementById('cb-chips-area').innerHTML = '';
    setTimeout(() => {
      this.addMessage('bot', '🔄 New conversation started! How can I help you today?');
      this._renderChips(['📅 Book Appointment', '🧠 Neurology', '🦷 Dental', '❓ FAQ']);
    }, 200);
  }

  // ─── Add to Calendar ──────────────────────────────────────────────
  addToCalendar() {
    const mem = this.chatbot?.sessionMemory;
    if (!mem?.date) return;

    const title = encodeURIComponent(`Appointment at Shree Neuro & Dental Health Care`);
    const location = encodeURIComponent('Badabazar, Sambalpur, Odisha');
    const details = encodeURIComponent(`Doctor: ${mem.department === 'neuro' ? 'Dr. Mahesh Kumar Kusta' : 'Dental Specialist'}\nPhone: +91 93373 88068`);

    const dateStr = mem.date.replace(/-/g, '');
    const [hour, min] = (mem.slot || '18:00').replace(' PM', '').replace(' AM', '').split(':').map(Number);
    const startHour = (mem.slot?.includes('PM') && hour < 12 ? hour + 12 : hour).toString().padStart(2, '0');
    const endHour = (parseInt(startHour) + 1).toString().padStart(2, '0');

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}T${startHour}${(min||0).toString().padStart(2,'0')}00/${dateStr}T${endHour}0000&details=${details}&location=${location}`;
    window.open(gcalUrl, '_blank');
  }

  // ─── Toast Notifications ──────────────────────────────────────────
  showToast(message, type = 'info', duration = 4000) {
    const icons = {
      success: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>`,
      error:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>`,
      info:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg>`,
      warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>`
    };

    const toast = document.createElement('div');
    toast.className = `cb-toast ${type}`;
    toast.innerHTML = `<span class="cb-toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;

    document.getElementById('cb-toast-container').appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ─── Theme ────────────────────────────────────────────────────────
  _initTheme() {
    const saved = localStorage.getItem('shree_theme') || 'light';
    this._applyTheme(saved);
  }

  _toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    this._applyTheme(next);
    localStorage.setItem('shree_theme', next);
  }

  _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const moonIcon = document.getElementById('theme-icon-moon');
    const sunIcon  = document.getElementById('theme-icon-sun');
    if (moonIcon && sunIcon) {
      moonIcon.style.display = theme === 'dark' ? 'none' : 'block';
      sunIcon.style.display  = theme === 'dark' ? 'block' : 'none';
    }
  }

  // ─── Badge ────────────────────────────────────────────────────────
  _showBadge(count) {
    const badge = document.getElementById('chatbot-badge');
    if (badge) { badge.textContent = count; badge.classList.remove('hidden'); }
  }

  _hideBadge() {
    const badge = document.getElementById('chatbot-badge');
    if (badge) { badge.classList.add('hidden'); this.unreadCount = 0; }
  }

  // ─── Scroll to Bottom ─────────────────────────────────────────────
  _scrollToBottom() {
    const messages = document.getElementById('cb-messages');
    if (messages) setTimeout(() => messages.scrollTop = messages.scrollHeight, 50);
  }

  // ─── Text Formatting (basic markdown) ────────────────────────────
  _formatText(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:4px;font-size:0.85em">$1</code>')
      .replace(/\n/g, '<br>');
  }

  _escapeHTML(text) {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }
}

// ─── Auto-initialize ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.ShreeChatWidgetInstance = new ShreeChatWidget();
});
