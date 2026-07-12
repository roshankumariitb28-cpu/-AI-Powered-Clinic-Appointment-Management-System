/* ================================================================
   SHREE NEURO & DENTAL — CORE AI CHATBOT ENGINE v2.0
   ai-chatbot.js — GPT-4o, full booking flow (name/age/gender),
                   appointment lookup, 40+ Q&A, smart fallback
   ================================================================ */

'use strict';

class ShreeAIChatbot {

  constructor(widgetCallback) {
    this.widget  = widgetCallback;
    this.sessionId = this._generateSessionId();

    // Full OpenAI conversation history
    this.conversationHistory = [];

    // All collected booking fields
    this.sessionMemory = {
      intent:        null,
      department:    null,
      doctor:        null,
      service:       null,
      date:          null,
      dateLabel:     null,
      slot:          null,
      patientName:   null,
      patientAge:    null,
      patientGender: null,
      patientPhone:  null,
      patientEmail:  null,
      symptoms:      null,
      appointmentRef: null,
      lookupPhone:   null,   // phone used for "check my appointment"
      stage: 'greeting'      // tracks where in the flow we are
    };

    this.bookedAppointments = [];
    this.isProcessing = false;
    this._loadBookingCache();
    this._buildSystemPrompt();
  }

  // ─── System Prompt ─────────────────────────────────────────────────
  _buildSystemPrompt() {
    const kb   = typeof CLINIC_KNOWLEDGE !== 'undefined' ? CLINIC_KNOWLEDGE : {};
    const today = new Date();
    const dayName  = today.toLocaleDateString('en-IN', { weekday: 'long' });
    const dateStr  = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const faqText  = (kb.faqs || []).map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');
    const doctorText = (kb.doctors || []).map(d =>
      `${d.name} (${d.specialty}): ${(d.expertise || []).slice(0, 6).join(', ')}`
    ).join('\n');

    this.systemPrompt = `You are Shreya, the friendly AI health assistant for Shree Neuro & Dental Health Care, Sambalpur, Odisha, India.

TODAY: ${dayName}, ${dateStr}
CLINIC HOURS: Monday–Saturday, 6:00 PM – 9:00 PM (CLOSED on Sundays)
EMERGENCY CONTACT: +91 93373 88068 (24/7)
WHATSAPP: +91 70089 56183
ADDRESS: Badabazar, Sambalpur, Odisha - 768001

DOCTORS:
${doctorText || 'Dr. Mahesh Kumar Kusta (Neuro & Brain Surgery, Gold Medalist, VIMSAR)\nDental Specialist (Dentistry – fillings, root canal, implants, orthodontics)'}

TIME SLOTS: 6:00 PM, 6:30 PM, 7:00 PM, 7:30 PM, 8:00 PM, 8:30 PM, 9:00 PM (Mon–Sat only)

BOOKING FIELDS REQUIRED (collect ONE at a time, in this order):
1. Department (neuro or dental)
2. Date (Mon–Sat only)
3. Time slot
4. Patient full name
5. Patient AGE (important for medical records)
6. Patient GENDER (Male / Female / Other)
7. Patient phone number
8. Symptoms / chief complaint (optional but helpful)
→ Only set confirmBooking:true when ALL of 1–7 are collected.

FREQUENTLY ASKED:
${faqText}

APPOINTMENT LOOKUP: If user asks "when is my appointment", "check my booking", "I forgot my appointment date" etc., set intent:"lookup" and ask for their phone number or booking ref.

INSTRUCTIONS:
1. Be warm, conversational, empathetic. Use natural Indian English.
2. Ask ONE piece of information at a time. Never bombard the patient.
3. Always respond in this EXACT JSON format:
{
  "reply": "Your message to the user",
  "intent": "book|cancel|reschedule|availability|faq|greeting|emergency|general|confirm_booking|lookup",
  "extracted": {
    "department": "neuro|dental|null",
    "doctor": "string or null",
    "date": "YYYY-MM-DD or null",
    "dateLabel": "Monday, 14 July or null",
    "slot": "6:00 PM or null",
    "patientName": "string or null",
    "patientAge": "number or null",
    "patientGender": "Male|Female|Other|null",
    "patientPhone": "string or null",
    "patientEmail": "string or null",
    "symptoms": "string or null",
    "lookupPhone": "string or null"
  },
  "showChips": ["option1", "option2"],
  "showCalendar": false,
  "showSlots": false,
  "confirmBooking": false,
  "isEmergency": false
}
4. EMERGENCY (stroke, unconscious, seizure, severe bleeding, can't breathe): set isEmergency:true immediately.
5. For Sunday bookings: tell the clinic is closed, suggest nearest Mon/Sat.
6. Keep replies ≤ 3 sentences unless giving confirmation summary or detailed FAQ answer.
7. After collecting all 7 fields, show a FULL summary of the booking request before setting confirmBooking:true. Explicitly tell the user that their booking is submitted as a request and is pending doctor review and decision (confirm or cancel). Never say the booking is already confirmed.
8. showChips: max 4 quick-reply buttons (use sparingly).
9. showCalendar: true when asking for date.
10. showSlots: true when asking for time.
11. LOOKUP flow: ask for phone → search bookings → show results with date/time/doctor/ref.
12. If user says "cancel" during booking, ask for ref or phone to find their booking.
13. Respond in Hindi/Odia if the user writes in that language.`;
  }

  // ─── Process User Message ──────────────────────────────────────────
  async processMessage(userText) {
    if (this.isProcessing) return null;
    this.isProcessing = true;

    try {
      // Fast-path: emergency detection
      if (this._isEmergency(userText)) {
        this.isProcessing = false;
        return this._emergencyResponse();
      }

      this.conversationHistory.push({ role: 'user', content: userText });

      let response;
      if (this._isOpenAIEnabled()) {
        response = await this._callOpenAI();
      } else {
        response = this._ruleBasedFallback(userText);
      }

      const parsed = this._parseAIResponse(response);
      this._updateSessionMemory(parsed.extracted);

      this.conversationHistory.push({ role: 'assistant', content: parsed.reply });

      // NOTE: _saveBooking() is intentionally NOT called here.
      // The chat-widget.js calls it when confirmBooking===true
      // and renders the confirmation card. Calling it here too
      // would cause duplicate entries and wrong sequential IDs.

      // Handle lookup flow
      if (parsed.intent === 'lookup' || this.sessionMemory.stage === 'lookup') {
        this.sessionMemory.stage = 'lookup';
        this._handleLookup(parsed);
      }

      this._logConversation(userText, parsed.reply, parsed.intent);
      this.isProcessing = false;
      return parsed;

    } catch (err) {
      console.error('[ShreeAI] Error:', err);
      this.isProcessing = false;
      return this._errorResponse();
    }
  }

  // ─── Handle Appointment Lookup ─────────────────────────────────────
  _handleLookup(parsed) {
    // If we now have a phone from extraction, search
    const phone = parsed.extracted?.lookupPhone || parsed.extracted?.patientPhone
               || this.sessionMemory.lookupPhone;

    if (phone) {
      this.sessionMemory.lookupPhone = phone;
      const found = this._findAppointmentByPhone(phone);
      if (found.length > 0) {
        // Override the reply with real booking data
        const lines = found.map(b =>
          `📋 Ref: *${b.ref}*\n` +
          `👨‍⚕️ ${b.doctor || b.department}\n` +
          `📅 ${b.dateLabel || b.date} at ${b.slot}\n` +
          `✅ Status: ${b.status || 'Confirmed'}`
        ).join('\n\n');
        parsed.reply = `I found ${found.length} appointment(s) for this number:\n\n${lines}\n\nWould you like to reschedule or cancel any of these?`;
        parsed.showChips = ['Reschedule', 'Cancel Appointment', 'Book New'];
      } else {
        // Check by ref
        const byRef = this._findAppointmentByRef(phone);
        if (byRef) {
          parsed.reply = `Found your appointment!\n\n📋 Ref: *${byRef.ref}*\n👨‍⚕️ ${byRef.doctor}\n📅 ${byRef.dateLabel || byRef.date} at ${byRef.slot}\n✅ Status: ${byRef.status || 'Confirmed'}\n\nAnything else I can help you with?`;
          parsed.showChips = ['Reschedule', 'Cancel', 'Book New Appointment'];
        } else {
          parsed.reply = `I couldn't find any upcoming appointment with this number. Try sharing your booking reference (starts with SND), or call us at +91 93373 88068.`;
          parsed.showChips = ['Try Ref Number', 'Call Clinic', 'Book New'];
        }
      }
    }
  }

  _findAppointmentByPhone(phone) {
    const clean = phone.replace(/\D/g, '').slice(-10);
    const all = [
      ...this.bookedAppointments,
      ...JSON.parse(localStorage.getItem('sndc_appointments') || '[]')
    ];
    const today = new Date().toISOString().split('T')[0];
    return all.filter(b => {
      const bPhone = (b.patientPhone || b.phone || '').replace(/\D/g, '').slice(-10);
      return bPhone === clean && (b.date || '') >= today && b.status !== 'Cancelled' && b.status !== 'cancelled';
    });
  }

  _findAppointmentByRef(ref) {
    const all = [
      ...this.bookedAppointments,
      ...JSON.parse(localStorage.getItem('sndc_appointments') || '[]')
    ];
    return all.find(b => (b.ref || b.id || '') === ref.trim().toUpperCase()) || null;
  }

  // ─── OpenAI API Call ───────────────────────────────────────────────
  async _callOpenAI() {
    const config = typeof OPENAI_CONFIG !== 'undefined' ? OPENAI_CONFIG : {};
    if (!config.apiKey) throw new Error('No OpenAI key');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model:           config.model       || 'gpt-4o-mini',
        messages:        [{ role: 'system', content: this.systemPrompt }, ...this._getRecentHistory(10)],
        max_tokens:      config.maxTokens   || 600,
        temperature:     config.temperature || 0.65,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'OpenAI error');
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  // ─── Rule-Based Fallback Engine (no OpenAI key needed) ────────────
  _ruleBasedFallback(text) {
    const t   = text.toLowerCase().trim();
    const mem = this.sessionMemory;

    // ── Intent signals ────────────────────────────────────────────────
    const isGreet    = /^(hi|hello|hey|namaste|namaskar|good|howdy|ola|hii|helo|helloo|sup|greet)/i.test(t);
    const isBook     = /book|appoint|schedule|want to see|consult|meet|visit|fix appoint|make appoint/i.test(t);
    const isCancel   = /cancel|cancell|don.?t want|remove booking|delete appoint/i.test(t);
    const isReschedule = /reschedule|change date|change time|postpone|move|different day|new date/i.test(t);
    const isAvail    = /available|slot|free|when.*open|time.*available/i.test(t);
    const isLookup   = /forgot|forget|check.*appoint|when.*appoint|my.*appoint|find.*appoint|look.*up|my booking|booking.*check|what.*time|remind me/i.test(t);
    const isStatus   = /status|confirm|confirmed|what.*status/i.test(t);

    // ── Dept signals ──────────────────────────────────────────────────
    const isNeuro  = /neuro|brain|spine|head|nerve|migraine|seizure|epilepsy|parkinson|stroke|headache|vertigo|numb|tremor|dementia|memory|alzheimer|paralysis|meningi|tumor|mri|neurosurg/i.test(t);
    const isDental = /dental|teeth|tooth|dentist|gum|root canal|cavity|braces|implant|whitening|filling|crown|bridge|wisdom|jaw|ache.*tooth|tooth.*ache|extraction|scaling/i.test(t);

    // ── FAQ patterns (comprehensive Q&A) ─────────────────────────────
    const faqAnswer = this._matchFAQ(t);
    if (faqAnswer && !isBook && !isCancel && !isReschedule) {
      return this._buildReply(faqAnswer.reply, 'faq', {}, faqAnswer.chips || []);
    }

    // ── Appointment Lookup ────────────────────────────────────────────
    if (isLookup || mem.stage === 'lookup') {
      // If we already have a phone being given
      const phone = this._extractPhone(text);
      const ref   = text.match(/SND[A-Z0-9]+/i)?.[0];

      if (phone || ref) {
        mem.stage = 'lookup';
        mem.lookupPhone = phone || ref;
        const found = phone
          ? this._findAppointmentByPhone(phone)
          : [this._findAppointmentByRef(ref)].filter(Boolean);

        if (found.length > 0) {
          const lines = found.map(b =>
            `📋 Ref: *${b.ref}*\n👨‍⚕️ ${b.doctor || (b.department === 'neuro' ? 'Dr. Mahesh Kumar Kusta' : 'Dental Specialist')}\n📅 ${b.dateLabel || b.date} at ${b.slot}\n✅ Status: ${b.status || 'Confirmed'}`
          ).join('\n\n─────────────────\n\n');
          const reply = `I found ${found.length} upcoming appointment(s) for you! 📋\n\n${lines}\n\nWould you like to change or cancel any of these?`;
          return this._buildReply(reply, 'lookup', { lookupPhone: phone || ref }, ['Reschedule', 'Cancel Appointment', 'Book New Appointment', 'Thank You']);
        } else {
          const reply = `I couldn't find any upcoming appointments with that ${phone ? 'number' : 'reference'}. 😕\n\nMaybe the appointment is completed, or try the other option?`;
          return this._buildReply(reply, 'lookup', {}, ['Try Phone Number', 'Try Ref Number', 'Call Clinic', 'Book New']);
        }
      }

      // Ask for phone or ref
      mem.stage = 'lookup';
      const reply = `Sure! I can look that up for you. 🔍\n\nCould you please share the **phone number** you used for booking, or your **booking reference** (starts with SND)?`;
      return this._buildReply(reply, 'lookup', {}, []);
    }

    // ── Cancel / Reschedule ────────────────────────────────────────────
    if (isCancel) {
      const phone = this._extractPhone(text);
      if (phone) {
        const found = this._findAppointmentByPhone(phone);
        if (found.length) {
          const b = found[0];
          return this._buildReply(
            `I found your appointment with ${b.doctor} on ${b.dateLabel || b.date} at ${b.slot} (Ref: ${b.ref}).\n\nAre you sure you want to cancel this? This cannot be undone.`,
            'cancel', {}, ['Yes, Cancel It', 'No, Keep It', 'Reschedule Instead']
          );
        }
      }
      return this._buildReply(
        `I'll help you cancel your appointment. Could you share the **phone number** you used for booking, or your **booking reference** (like SND123ABC)?`,
        'cancel', {}, ['I have my reference', 'Use my phone number', 'Call clinic instead']
      );
    }

    if (isReschedule) {
      return this._buildReply(
        `Sure, I can help you reschedule! 📅\n\nPlease share your **booking reference** or **phone number** first, and then tell me your preferred new date.`,
        'reschedule', {}, [], true
      );
    }

    // ── Status check ──────────────────────────────────────────────────
    if (isStatus) {
      const phone = this._extractPhone(text);
      if (phone) {
        const found = this._findAppointmentByPhone(phone);
        if (found.length) {
          const statuses = found.map(b => `• Ref ${b.ref}: **${b.status || 'Confirmed'}** on ${b.dateLabel || b.date}`).join('\n');
          return this._buildReply(`Here's your appointment status:\n\n${statuses}`, 'general', {}, ['View Details', 'Book New']);
        }
      }
      return this._buildReply(`To check your appointment status, please share your phone number or booking reference.`, 'general', {}, []);
    }

    // ── Booking Flow ──────────────────────────────────────────────────
    const extracted = {
      department:    isNeuro ? 'neuro' : isDental ? 'dental' : null,
      date:          this._extractDate(t)?.iso || null,
      dateLabel:     this._extractDate(t)?.label || null,
      slot:          this._extractSlot(t) || null,
      patientName:   this._extractName(text) || null,
      patientAge:    this._extractAge(text) || null,
      patientGender: this._extractGender(text) || null,
      patientPhone:  this._extractPhone(text) || null,
      patientEmail:  this._extractEmail(text) || null,
      symptoms:      this._extractSymptoms(text) || null,
      doctor:        null,
      lookupPhone:   null
    };

    // ── Fallback checks for slot-filling steps ──
    // 1. Patient Name fallback
    if (mem.department && mem.date && mem.slot && !mem.patientName && !extracted.patientName) {
      if (!isGreet && !isBook && !isCancel && !isReschedule && !isAvail && !isLookup && !isStatus) {
        const cleanName = text.replace(/[^a-zA-Z\s.-]/g, '').trim();
        if (cleanName.length >= 2 && cleanName.split(/\s+/).length <= 4) {
          extracted.patientName = this._capitalize(cleanName);
        }
      }
    }

    // 2. Patient Age fallback
    if (mem.department && mem.date && mem.slot && mem.patientName && !mem.patientAge && !extracted.patientAge) {
      const match = text.match(/\b\d{1,3}\b/);
      if (match) {
        extracted.patientAge = parseInt(match[0]);
      } else {
        const numMap = {
          one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
          eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,
          thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90
        };
        const words = t.split(/\s+/);
        let ageVal = 0;
        words.forEach(w => { if (numMap[w]) ageVal += numMap[w]; });
        if (ageVal > 0 && ageVal <= 120) extracted.patientAge = ageVal;
      }
    }

    // 3. Patient Gender fallback
    if (mem.department && mem.date && mem.slot && mem.patientName && mem.patientAge && !mem.patientGender && !extracted.patientGender) {
      const cleaned = t.trim();
      if (/^m(ale)?$/i.test(cleaned)) extracted.patientGender = 'Male';
      else if (/^f(emale)?$/i.test(cleaned)) extracted.patientGender = 'Female';
      else if (/^o(ther)?$/i.test(cleaned)) extracted.patientGender = 'Other';
    }

    // 4. Patient Phone fallback
    if (mem.department && mem.date && mem.slot && mem.patientName && mem.patientAge && mem.patientGender && !mem.patientPhone && !extracted.patientPhone) {
      const digits = text.replace(/\D/g, '');
      if (digits.length === 10) {
        extracted.patientPhone = digits;
      }
    }

    // Merge with memory
    const dept   = extracted.department  || mem.department;
    const date   = extracted.date        || mem.date;
    const dLabel = extracted.dateLabel   || mem.dateLabel;
    const slot   = extracted.slot        || mem.slot;
    const name   = extracted.patientName || mem.patientName;
    const age    = extracted.patientAge  || mem.patientAge;
    const gender = extracted.patientGender || mem.patientGender;
    const phone  = extracted.patientPhone  || mem.patientPhone;


    // ── Greeting ──────────────────────────────────────────────────────
    if (isGreet && !isBook && !dept) {
      return this._buildReply(
        `Hello! 👋 I'm **Shreya**, your AI health assistant at Shree Neuro & Dental Health Care, Sambalpur.\n\nHow can I help you today?`,
        'greeting', extracted,
        ['📅 Book Appointment', '🔍 Check My Appointment', '🏥 Clinic Hours', '⚕️ Services', '📞 Emergency']
      );
    }

    // ── Start booking / ask department ────────────────────────────────
    if ((isBook || isAvail) && !dept) {
      return this._buildReply(
        `I'd be happy to help you book an appointment! 🏥\n\nAre you looking for **Neurology** (brain & spine) or **Dental** care?`,
        'book', extracted, ['🧠 Neurology', '🦷 Dental']
      );
    }

    // ── Got dept, ask date ────────────────────────────────────────────
    if (dept && !date) {
      const deptName = dept === 'neuro'
        ? '🧠 Neurology — Dr. Mahesh Kumar Kusta'
        : '🦷 Dental — Dental Specialist';
      return this._buildReply(
        `Great choice — **${deptName}**! 👍\n\nWhich day would you like? The clinic is open **Monday to Saturday, 6 PM – 9 PM**.`,
        'book', extracted, ['Today', 'Tomorrow', 'This Saturday', 'Next Monday'], true
      );
    }

    // ── Got date, ask slot ────────────────────────────────────────────
    if (dept && date && !slot) {
      const d = new Date(date);
      if (d.getDay() === 0) {
        const sat = new Date(date); sat.setDate(sat.getDate() + 6);
        return this._buildReply(
          `Sorry, the clinic is **closed on Sundays**. 🚫\n\nShall I book for **${sat.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}** (Saturday) instead?`,
          'book', { ...extracted, date: null, dateLabel: null },
          ['Yes, book Saturday', 'Choose another date']
        );
      }
      return this._buildReply(
        `Perfect — **${dLabel}** it is! 📅\n\nWhich time slot works best for you?`,
        'book', extracted, [], false, true
      );
    }

    // ── Got slot, ask name ────────────────────────────────────────────
    if (dept && date && slot && !name) {
      return this._buildReply(
        `${slot} on ${dLabel} — noted! ✅\n\nMay I have the **patient's full name**, please?`,
        'book', extracted, []
      );
    }

    // ── Got name, ask age ─────────────────────────────────────────────
    if (dept && date && slot && name && !age) {
      return this._buildReply(
        `Thank you, **${name}**! 😊\n\nWhat is the patient's **age**? (This helps the doctor prepare.)`,
        'book', extracted, []
      );
    }

    // ── Got age, ask gender ───────────────────────────────────────────
    if (dept && date && slot && name && age && !gender) {
      return this._buildReply(
        `Got it! And what is the patient's **gender**?`,
        'book', extracted, ['Male', 'Female', 'Other']
      );
    }

    // ── Got gender, ask phone ─────────────────────────────────────────
    if (dept && date && slot && name && age && gender && !phone) {
      return this._buildReply(
        `Almost there! 📱\n\nWhat is the best **contact number** for ${name}? We'll send the confirmation to this number.`,
        'book', extracted, []
      );
    }

    // ── All collected — show confirmation ─────────────────────────────
    if (dept && date && slot && name && age && gender && phone) {
      const isConfirm = /^(yes|submit|confirm|yep|yeah|ok|okay|✅ yes, submit!)/i.test(t);
      const isDecline = /^(no|cancel|decline|dont|stop|❌ cancel)/i.test(t);
      const isEdit    = /^(change|edit|modify|something else|✏️ change something)/i.test(t);

      if (isConfirm) {
        // Set confirmBooking to true ONLY in this step
        return this._buildReply(`Perfect! I am submitting your appointment request now. ⏳`, 'confirm_booking', {}, [], false, false, true);
      }
      if (isDecline) {
        this.resetSession();
        return this._buildReply(`No problem! I have cancelled the booking request. What else can I help you with?`, 'greeting', {}, ['📅 Book Appointment', '🔍 Check My Appointment']);
      }
      if (isEdit) {
        // Clear patient info and ask again
        mem.patientName = null;
        mem.patientAge = null;
        mem.patientGender = null;
        mem.patientPhone = null;
        return this._buildReply(`Understood. Let's correct the patient details. What is the patient's full name?`, 'book', {});
      }

      const doctorName = dept === 'neuro' ? 'Dr. Mahesh Kumar Kusta' : 'Dental Specialist';
      const deptLabel  = dept === 'neuro' ? 'Neurology 🧠' : 'Dental 🦷';
      const reply =
        `Here's a summary of your appointment request:\n\n` +
        `👨‍⚕️ **Doctor:** ${doctorName}\n` +
        `🏥 **Department:** ${deptLabel}\n` +
        `📅 **Date:** ${dLabel || date}\n` +
        `🕐 **Time:** ${slot}\n` +
        `👤 **Patient:** ${name}\n` +
        `🎂 **Age:** ${age} years\n` +
        `⚧ **Gender:** ${gender}\n` +
        `📱 **Phone:** ${phone}\n\n` +
        `Shall I **submit this booking request**? (The doctor will confirm or cancel it) 😊`;

      // Set confirmBooking to FALSE on the summary card itself!
      return this._buildReply(reply, 'confirm_booking', extracted, ['✅ Yes, Submit!', '✏️ Change Something', '❌ Cancel'], false, false, false);
    }

    // ── Generic fallback ──────────────────────────────────────────────
    if (isGreet) {
      return this._buildReply(
        `Hello! 👋 I'm Shreya. I can help you book an appointment, check your existing booking, or answer questions about our clinic.\n\nWhat would you like to do?`,
        'greeting', extracted,
        ['📅 Book Appointment', '🔍 Check My Appointment', '📞 Clinic Info', '⚕️ Services']
      );
    }

    return this._buildReply(
      `I'm here to help! I can assist you with:\n• **Booking** an appointment\n• **Checking** your existing booking\n• **Cancelling** or rescheduling\n• **Answering** questions about our clinic\n\nWhat would you like to do?`,
      'general', extracted,
      ['📅 Book Appointment', '🔍 Check My Appointment', '📞 Clinic Hours & Info', '⚕️ Emergency']
    );
  }

  // ─── Comprehensive FAQ Matcher (40+ Q&A) ──────────────────────────
  _matchFAQ(t) {

    const match = (patterns) => patterns.some(p => t.includes(p) || new RegExp(p, 'i').test(t));

    // ─── Clinic Hours ────────────────────────────────────────────────
    if (match(['hour', 'time.*open', 'open.*time', 'timing', 'clinic.*time', 'working hour', 'when.*open', 'close.*time', 'open.*day', 'days.*open'])) {
      return {
        reply: `🕐 **Clinic Hours:**\n**Monday – Saturday: 6:00 PM – 9:00 PM**\n\n❌ Closed on **Sundays** and public holidays.\n\n📞 Emergency line available 24/7: **+91 93373 88068**`,
        chips: ['Book Appointment', 'Emergency Contact', 'Location']
      };
    }

    // ─── Location / Address ───────────────────────────────────────────
    if (match(['address', 'location', 'where.*clinic', 'where.*hospital', 'how.*reach', 'direction', 'near', 'badabazar', 'sambalpur', 'map'])) {
      return {
        reply: `📍 **Shree Neuro & Dental Health Care**\nMadhavban, Badabazar, Khetrajpur,\nSambalpur, Odisha – 768003\n\n🗺️ [Open in Google Maps](https://maps.google.com/?q=Shree+Neuro+Dental+Sambalpur)\n\n🚗 Easily accessible by auto-rickshaw or taxi from Sambalpur city centre.`,
        chips: ['Clinic Hours', 'Book Appointment', 'Contact Number']
      };
    }

    // ─── Phone / Contact ─────────────────────────────────────────────
    if (match(['phone', 'contact', 'number', 'call', 'reach', 'helpline', 'whatsapp'])) {
      return {
        reply: `📞 **Contact Numbers:**\n• **Clinic:** +91 93373 88068\n• **WhatsApp:** +91 70089 56183\n\n📧 Available Mon–Sat, 6 PM – 9 PM\n📲 Emergency: +91 93373 88068 (24/7)`,
        chips: ['Book Appointment', 'Clinic Hours', 'Location']
      };
    }

    // ─── Emergency ───────────────────────────────────────────────────
    if (match(['emergency', 'urgent', '24.*7', 'after.*hour', 'midnight', 'night.*call'])) {
      return {
        reply: `🚨 **Emergency Contact:**\n📞 **+91 93373 88068** (24 hours, 7 days)\n\n🏥 For life-threatening emergencies, call **108** (Ambulance) immediately.\n\nDr. Kusta is reachable after hours for genuine neuro emergencies.`,
        chips: ['Call Now', 'Book Appointment', 'Clinic Hours']
      };
    }

    // ─── Doctor / Specialist ──────────────────────────────────────────
    if (match(['doctor', 'specialist', 'surgeon', 'dr.*kusta', 'mahesh', 'who.*treat', 'which.*doctor', 'qualification', 'experience', 'gold medal'])) {
      return {
        reply: `👨‍⚕️ **Dr. Mahesh Kumar Kusta**\n• MBBS, MS, MCh (Neurosurgery)\n• 🥇 **Gold Medalist** — VIMSAR, Burla\n• Speciality: Brain, Spine, Neuro-endoscopy, Epilepsy, Stroke\n• 10+ years of experience\n\n🦷 **Dental Department:**\nExperienced dental surgeon handling all dental procedures.`,
        chips: ['Book with Dr. Kusta', 'Dental Services', 'Clinic Hours']
      };
    }

    // ─── Fees / Consultation charges ─────────────────────────────────
    if (match(['fee', 'fees', 'charge', 'cost', 'price', 'consult.*fee', 'how.*much', 'rupee', 'rs.', 'payment'])) {
      return {
        reply: `💰 **Consultation Fees** vary by service:\n• General OPD Consultation: Affordable rates\n• Neurology Consultation: As per specialist\n• Dental Procedures: Priced by treatment\n\n📞 For exact fees, please call: **+91 93373 88068** or WhatsApp **+91 70089 56183**.\n\n💳 We accept cash and UPI.`,
        chips: ['Book Appointment', 'Contact Clinic', 'Services List']
      };
    }

    // ─── Services — Neurology ─────────────────────────────────────────
    if (match(['neuro.*service', 'brain.*service', 'spine.*service', 'what.*treat.*neuro', 'neurology.*treat', 'what.*brain', 'brain.*problem'])) {
      return {
        reply: `🧠 **Neurology & Brain Surgery Services:**\n• Brain & Spinal Cord Surgery\n• Stroke Management & Rehab\n• Epilepsy / Seizure Treatment\n• Migraine & Headache Disorders\n• Parkinson's Disease Management\n• Dementia / Memory Disorders\n• Neuro-endoscopy\n• Peripheral Nerve Disorders\n• Pediatric Neurology\n• MRI / CT scan guidance`,
        chips: ['Book Neuro Appointment', 'Doctor Details', 'Dental Services']
      };
    }

    // ─── Services — Dental ────────────────────────────────────────────
    if (match(['dental.*service', 'teeth.*service', 'tooth.*service', 'what.*treat.*dental', 'dental.*treat', 'dentist.*do'])) {
      return {
        reply: `🦷 **Dental Services:**\n• Tooth Fillings (Composite & Amalgam)\n• Root Canal Treatment (RCT)\n• Tooth Extractions (including Wisdom teeth)\n• Dental Implants\n• Braces & Orthodontic Treatment\n• Teeth Whitening & Cleaning\n• Crowns & Bridges\n• Scaling & Polishing\n• Pediatric Dentistry\n• Gum Disease Treatment`,
        chips: ['Book Dental Appointment', 'Clinic Hours', 'Contact Clinic']
      };
    }

    // ─── Headache / Migraine ─────────────────────────────────────────
    if (match(['headache', 'head.*pain', 'migraine', 'head.*ache'])) {
      return {
        reply: `🤕 **For headaches & migraines**, Dr. Mahesh Kumar Kusta specialises in:\n• Migraine diagnosis & prevention\n• Tension-type headache management\n• Identifying secondary causes (tumours, hypertension)\n\n⚠️ If you have **sudden, severe, "worst headache of your life"**, please call emergency immediately: **+91 93373 88068**\n\nWould you like to book an appointment?`,
        chips: ['Book Neuro Appointment', 'Emergency Contact', 'Clinic Hours']
      };
    }

    // ─── Stroke ──────────────────────────────────────────────────────
    if (match(['stroke', 'paralysis', 'face.*droop', 'sudden.*weakness', 'arm.*weak'])) {
      return {
        reply: `⚠️ **STROKE ALERT — Act FAST!**\n\n🆘 **F** — Face drooping\n💪 **A** — Arm weakness\n🗣️ **S** — Speech difficulty\n⏰ **T** — Time to call emergency!\n\n📞 Call **108** (Ambulance) OR **+91 93373 88068** (Dr. Kusta)\n\nStroke is a medical emergency — every minute counts!`,
        chips: ['Call 108', 'Call Dr. Kusta', 'Clinic Info']
      };
    }

    // ─── Epilepsy / Seizure ───────────────────────────────────────────
    if (match(['epilepsy', 'seizure', 'convulsion', 'fit', 'fits'])) {
      return {
        reply: `⚡ **Epilepsy & Seizure Management** at Shree Clinic:\n\nDr. Kusta offers complete epilepsy care including:\n• EEG interpretation\n• Medication management\n• Surgical evaluation for drug-resistant epilepsy\n\n🆘 If someone is having a **seizure right now**, clear the area, don't restrain, turn them sideways and call **108** or **+91 93373 88068**.`,
        chips: ['Book Appointment', 'Emergency Contact', 'Clinic Hours']
      };
    }

    // ─── Back / Spine pain ────────────────────────────────────────────
    if (match(['back pain', 'spine', 'spinal', 'disc', 'slipped disc', 'sciatica', 'lower back', 'neck pain', 'cervical'])) {
      return {
        reply: `🦴 **Spine & Back Problems** are treated by Dr. Kusta:\n• Slipped/Herniated Disc\n• Sciatica\n• Cervical Spondylosis (neck pain)\n• Spinal Cord Compression\n• Minimally invasive spine surgery\n\nEarly treatment can prevent surgery. Would you like to book a consultation?`,
        chips: ['Book Neuro Appointment', 'Clinic Hours', 'Contact Clinic']
      };
    }

    // ─── Memory / Dementia ────────────────────────────────────────────
    if (match(['memory', 'forget', 'dementia', 'alzheimer', 'memory.*loss', 'forgetful'])) {
      return {
        reply: `🧩 **Memory & Cognitive Disorders** are evaluated at our Neurology department:\n• Alzheimer's Disease\n• Dementia screening & management\n• MCI (Mild Cognitive Impairment)\n• Memory testing & cognitive assessment\n\nEarly diagnosis makes a big difference. Would you like to book an appointment for a loved one?`,
        chips: ['Book Neuro Appointment', 'Doctor Details', 'Clinic Hours']
      };
    }

    // ─── Tooth pain ──────────────────────────────────────────────────
    if (match(['toothache', 'tooth.*pain', 'tooth.*hurt', 'dental.*pain', 'pain.*tooth'])) {
      return {
        reply: `😬 **Toothache** can have several causes — cavities, gum disease, or cracked teeth.\n\nOur dentist can:\n• Identify the cause with X-ray\n• Perform fillings or root canal if needed\n• Provide immediate pain relief\n\n📅 Book a dental appointment soon — tooth pain usually worsens without treatment!`,
        chips: ['Book Dental Appointment', 'Clinic Hours', 'Contact Clinic']
      };
    }

    // ─── Root canal ───────────────────────────────────────────────────
    if (match(['root canal', 'rct'])) {
      return {
        reply: `🦷 **Root Canal Treatment (RCT)** is performed at our dental department.\n\nModern RCT is:\n• Virtually **painless** with local anaesthesia\n• Completed in 1–2 sittings\n• Saves your natural tooth from extraction\n\nWould you like to book a dental consultation?`,
        chips: ['Book Dental Appointment', 'Dental Services', 'Clinic Hours']
      };
    }

    // ─── Braces / Orthodontics ────────────────────────────────────────
    if (match(['braces', 'orthodontic', 'teeth.*align', 'crooked.*teeth', 'retainer', 'aligner'])) {
      return {
        reply: `😁 **Orthodontic Treatment** (braces) is available at Shree Clinic:\n• Metal braces\n• Ceramic braces\n• Removable aligners\n• Retainer fitting\n\nTypically takes **12–24 months** depending on severity. Starting age — children (10+) and adults both welcome!`,
        chips: ['Book Dental Appointment', 'Dental Services', 'Contact Clinic']
      };
    }

    // ─── Implants ────────────────────────────────────────────────────
    if (match(['implant', 'dental.*implant', 'missing.*tooth', 'replace.*tooth'])) {
      return {
        reply: `🦷 **Dental Implants** — the best permanent solution for missing teeth:\n• Looks and functions like a natural tooth\n• Long-lasting (20+ years with care)\n• No damage to adjacent teeth\n\nConsultation needed to assess bone density. Book an appointment for evaluation!`,
        chips: ['Book Dental Appointment', 'Clinic Hours', 'Contact Clinic']
      };
    }

    // ─── Whitening ───────────────────────────────────────────────────
    if (match(['whiten', 'whitening', 'yellow.*teeth', 'teeth.*yellow', 'stain'])) {
      return {
        reply: `✨ **Teeth Whitening** is available at our dental department!\n\n• Professional in-clinic whitening\n• Safe and effective\n• Results visible in a single session\n• Much more effective than home kits\n\nWant to book a consultation?`,
        chips: ['Book Dental Appointment', 'Dental Services', 'Clinic Hours']
      };
    }

    // ─── Appointment confirmation / existing booking ──────────────────
    if (match(['confirm.*booking', 'booking.*confirm', 'is.*appoint.*confirm', 'got.*appoint', 'appoint.*done'])) {
      return {
        reply: `✅ Once your appointment is confirmed, you receive:\n• A **booking reference number** (SND...)\n• Details via WhatsApp (if number provided)\n• An option to add to your calendar\n\nTo check if your booking went through, share your phone number or ref number.`,
        chips: ['Check My Appointment', 'Book New', 'Contact Clinic']
      };
    }

    // ─── Payment / Insurance ─────────────────────────────────────────
    if (match(['insurance', 'cashless', 'mediclaim', 'ayushman', 'health.*card'])) {
      return {
        reply: `💳 **Payment Options:**\n• Cash\n• UPI (Google Pay, PhonePe, Paytm)\n• Online transfer\n\n📋 For insurance/Ayushman Bharat queries, please call the clinic directly: **+91 93373 88068**\n\nWe'll guide you on what documentation is needed.`,
        chips: ['Contact Clinic', 'Book Appointment', 'Clinic Hours']
      };
    }

    // ─── Parking ─────────────────────────────────────────────────────
    if (match(['parking', 'park', 'bike', 'car.*park'])) {
      return {
        reply: `🚗 **Parking** is available near the clinic at Badabazar.\n\nPublic parking nearby or you can park on the adjacent streets. For 2-wheelers, space is easily available right outside.`,
        chips: ['Clinic Location', 'Book Appointment', 'Contact Clinic']
      };
    }

    // ─── MRI / CT / Scan ─────────────────────────────────────────────
    if (match(['mri', 'ct scan', 'scan', 'x-ray', 'xray', 'x ray', 'report', 'test'])) {
      return {
        reply: `🔬 **Scans & Tests:**\nDr. Kusta reviews MRI/CT reports and can advise on:\n• Whether a scan is needed\n• Interpreting your existing report\n• Recommending the right diagnostic centre\n\nBring your existing reports to the consultation. Our team can guide you to nearby scan centres in Sambalpur.`,
        chips: ['Book Neuro Appointment', 'Contact Clinic', 'Clinic Hours']
      };
    }

    // ─── Children / Paediatric ───────────────────────────────────────
    if (match(['child', 'children', 'baby', 'infant', 'kid', 'paediatric', 'pediatric', 'minor'])) {
      return {
        reply: `👶 **Paediatric Care:**\n• **Paediatric Neurology** — epilepsy in children, developmental delays, headaches\n• **Paediatric Dentistry** — dental check-ups, cavities, fluoride treatment, space maintainers\n\nChildren of all ages are welcome. Bring school ID or birth certificate for age verification.`,
        chips: ['Book Appointment', 'Contact Clinic', 'Clinic Hours']
      };
    }

    // ─── Second opinion ───────────────────────────────────────────────
    if (match(['second opinion', 'another.*doctor', 'review.*report', 'get.*opinion'])) {
      return {
        reply: `💡 **Second Opinions** are always welcome at Shree Clinic!\n\nDr. Kusta frequently provides second opinions for:\n• Neurosurgery decisions\n• Complex neurological cases\n• MRI/CT interpretation\n\nBring your existing reports, scans, and medical history. Book a consultation!`,
        chips: ['Book Neuro Appointment', 'Contact Clinic', 'Clinic Hours']
      };
    }

    // ─── Thank you / bye ─────────────────────────────────────────────
    if (match(['thank', 'thanks', 'ok bye', 'goodbye', 'ok ok', 'great', 'perfect', 'done', 'all done', 'that.*all'])) {
      return {
        reply: `You're welcome! 😊 Take care and stay healthy!\n\nIf you ever need anything — appointments, information, or just a question — I'm here 24/7.\n\n🏥 **Shree Neuro & Dental Health Care, Sambalpur**\n📞 +91 93373 88068`,
        chips: ['Book Another Appointment', 'Check My Appointment', 'Clinic Hours']
      };
    }

    // ─── Parking / Accessibility ──────────────────────────────────────
    if (match(['wheelchair', 'disabled', 'accessible', 'disable', 'disability'])) {
      return {
        reply: `♿ The clinic is accessible for patients with mobility needs.\n\nPlease call ahead **+91 93373 88068** so we can assist you on arrival and ensure minimal waiting.`,
        chips: ['Contact Clinic', 'Book Appointment', 'Location']
      };
    }

    // ─── Online consultation ──────────────────────────────────────────
    if (match(['online.*consult', 'video.*consult', 'telemedicine', 'consult.*online', 'consult.*phone', 'video.*call'])) {
      return {
        reply: `📱 **Online / Tele-consultation:**\nCurrently, consultations are primarily **in-person** at the clinic.\n\nFor brief follow-up questions or report review, please WhatsApp: **+91 70089 56183**.\n\nFor a formal consultation, booking an in-clinic visit is recommended for accurate examination.`,
        chips: ['Book In-clinic Appointment', 'WhatsApp Clinic', 'Clinic Hours']
      };
    }

    // ─── Waiting time ────────────────────────────────────────────────
    if (match(['wait', 'waiting.*time', 'how.*long.*wait', 'rush', 'crowd'])) {
      return {
        reply: `⏱️ **Waiting Time:**\nWith our slot-based booking system, wait times are minimal.\n\nIf you **book online**, your slot is reserved and typically called within 5–10 minutes of your arrival.\n\n💡 Tip: Arrive 5 minutes before your slot for paperwork.`,
        chips: ['Book Appointment', 'Check Availability', 'Contact Clinic']
      };
    }

    // ─── No match ────────────────────────────────────────────────────
    return null;
  }

  // ─── Entity Extractors ────────────────────────────────────────────

  _extractDate(text) {
    const today    = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const months   = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const days     = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const fmt = (d) => ({
      iso:   d.toISOString().split('T')[0],
      label: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    });

    if (/today|aaj\b/i.test(text))    return fmt(today);
    if (/tomorrow|kal\b|agle\s*din/i.test(text)) return fmt(tomorrow);

    const nextDay = text.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday)/i);
    if (nextDay) {
      const d = new Date(today);
      let diff = days.indexOf(nextDay[1].toLowerCase()) - d.getDay();
      if (diff <= 0) diff += 7;
      d.setDate(d.getDate() + diff);
      return fmt(d);
    }

    const thisDay = text.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday)/i);
    if (thisDay) {
      const d = new Date(today);
      let diff = days.indexOf(thisDay[1].toLowerCase()) - d.getDay();
      if (diff < 0) diff += 7;
      d.setDate(d.getDate() + diff);
      return fmt(d);
    }

    const dated = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i)
                || text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i);
    if (dated) {
      const dayNum  = parseInt(dated[1]) || parseInt(dated[2]);
      const monthStr = (dated[2] || dated[1]).toLowerCase();
      const monthNum = months.indexOf(monthStr);
      if (monthNum >= 0 && dayNum >= 1 && dayNum <= 31) {
        const d = new Date(today.getFullYear(), monthNum, dayNum);
        if (d < today) d.setFullYear(today.getFullYear() + 1);
        return fmt(d);
      }
    }

    const justDay = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (justDay) {
      const d = new Date(today);
      let diff = days.indexOf(justDay[1].toLowerCase()) - d.getDay();
      if (diff <= 0) diff += 7;
      d.setDate(d.getDate() + diff);
      return fmt(d);
    }

    return null;
  }

  _extractSlot(text) {
    const slots = (typeof CLINIC_CONFIG !== 'undefined' ? CLINIC_CONFIG.timeSlots : null)
               || ['6:00 PM','6:30 PM','7:00 PM','7:30 PM','8:00 PM','8:30 PM','9:00 PM'];
    const m = text.match(/(\d{1,2})(?::(\d{2}))?\s*(pm|am|PM|AM)/i);
    if (m) {
      let h = parseInt(m[1]);
      const min = m[2] ? parseInt(m[2]) : 0;
      const p   = m[3]?.toUpperCase();
      if (p === 'PM' && h < 12) h += 12;
      if (p === 'AM' && h === 12) h = 0;
      for (const slot of slots) {
        const [sh, sm] = slot.replace(/ PM| AM/,'').split(':').map(Number);
        const slotH = sh + (slot.includes('PM') && sh < 12 ? 12 : 0);
        if (slotH === h && sm === min) return slot;
      }
    }
    return null;
  }

  _extractName(text) {
    // Remove all emojis first so blacklist matches work even if message starts with an emoji (e.g. "📅 Book Appointment")
    const clean = text.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();

    // Exclude common navigation/action keywords to prevent extracting them as patient names
    const lower = clean.toLowerCase();
    if (/^(book|cancel|reschedule|check|appointment|status|menu|hello|hi|yes|no|submit|help|emergency|option|slots|select)/i.test(lower)) {
      return null;
    }
    const m = clean.match(/(?:my name is|i am|i'm|name is|patient.*name.*is?:?|name:)\s+([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*)/i);
    if (m) return m[1].trim();
    const title = clean.match(/\b([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/);
    if (title && title[1].length > 4 && !/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|June|July|August|September|October|November|December/i.test(title[1])) {
      return title[1].trim();
    }
    return null;
  }

  _extractAge(text) {
    // 1. Remove phone numbers (10 digits)
    let clean = text.replace(/\b\d{10}\b/g, '');
    // 2. Remove reference codes (like SND-...)
    clean = clean.replace(/SND-\d+-\d+/gi, '');
    // 3. Remove time formats like 8:00, 6:30, 8:00 PM, 6 PM, 8pm, etc.
    clean = clean.replace(/\b\d{1,2}:\d{2}(\s*(?:pm|am))?/gi, '');
    clean = clean.replace(/\b\d{1,2}\s*(pm|am)\b/gi, '');
    // 4. Remove dates (e.g. 13 July or July 13) to prevent matching dates as ages
    const months = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec';
    clean = clean.replace(new RegExp('\\b\\d{1,2}\\s*(' + months + ')\\b', 'gi'), '');
    clean = clean.replace(new RegExp('\\b(' + months + ')\\s*\\d{1,2}\\b', 'gi'), '');
    // Remove 4-digit years
    clean = clean.replace(/\b\d{4}\b/g, '');

    // Now extract age from the remaining clean text
    // Look for explicit patterns first (e.g., "age 25", "25 years old", "25 yrs")
    const m = clean.match(/(?:age[:\s]+|i\s+am\s+|patient.*is\s+|years?\s+old[\s,]+|aged?\s*)(\d{1,3})(?:\s+years?)?/i)
           || clean.match(/(\d{1,3})\s+(?:years?\s+old|yr|yrs)/i)
           || clean.replace(/\D/g, '').match(/^(\d{1,3})$/); // or just a standalone number reply (e.g. user typed "25")

    if (m) {
      const age = parseInt(m[1]);
      if (age >= 1 && age <= 120) return age;
    }

    // Fallback: if user sent only a single number word as their message (e.g. "28")
    const words = clean.trim().split(/\s+/);
    if (words.length === 1 && /^\d{1,3}$/.test(words[0])) {
      const age = parseInt(words[0]);
      if (age >= 1 && age <= 120) return age;
    }

    return null;
  }

  _extractGender(text) {
    if (/\b(male|man|boy|he|his|mr\.?)\b/i.test(text) && !/fe?male|woman/i.test(text)) return 'Male';
    if (/\b(female|woman|girl|she|her|mrs\.?|miss|ms\.?)\b/i.test(text)) return 'Female';
    if (/\bother\b/i.test(text)) return 'Other';
    return null;
  }

  _extractPhone(text) {
    const m = text.match(/(?:\+91[\s-]?)?[6789]\d{9}/);
    return m ? m[0].replace(/[\s-]/g,'') : null;
  }

  _extractEmail(text) {
    const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return m ? m[0] : null;
  }

  _extractSymptoms(text) {
    const t = text.toLowerCase();
    const symp = [];
    const symptomWords = [
      'headache','migraine','pain','dizziness','vertigo','nausea','weakness',
      'numbness','tingling','seizure','tremor','blurred vision','double vision',
      'memory loss','confusion','fatigue','fever','swelling','bleeding',
      'toothache','tooth pain','gum','cavity','sensitivity'
    ];
    symptomWords.forEach(s => { if (t.includes(s)) symp.push(s); });
    return symp.length > 0 ? symp.join(', ') : null;
  }

  // ─── Build JSON Reply ──────────────────────────────────────────────
  _buildReply(reply, intent, extracted = {}, chips = [], showCalendar = false, showSlots = false, confirmBooking = false) {
    return JSON.stringify({ reply, intent, extracted, showChips: chips, showCalendar, showSlots, confirmBooking, isEmergency: false });
  }

  // ─── Emergency Detection ───────────────────────────────────────────
  _isEmergency(text) {
    const words = ['emergency','stroke','unconscious','fitting','severe headache','not breathing','bleeding heavily','accident','collapsed','fainted','trauma','heart attack','paralysis sudden','cannot breathe','choking'];
    const t = text.toLowerCase();
    return words.some(w => t.includes(w));
  }

  _emergencyResponse() {
    return {
      reply: `🚨 **This sounds like a medical emergency!**\n\n📞 **Call 108 (Ambulance) immediately!**\n\nFor Dr. Kusta: **+91 93373 88068** (24/7 emergency)\n\n🏥 Nearest hospital: VIMSAR, Burla or District HQ Hospital, Sambalpur.\n\n⚠️ Do NOT delay — call now!`,
      intent: 'emergency',
      extracted: {},
      showChips: ['📞 Call 108 (Ambulance)', '📞 Call Dr. Kusta: +91 93373 88068'],
      showCalendar: false,
      showSlots: false,
      confirmBooking: false,
      isEmergency: true
    };
  }

  // ─── Response Parser ───────────────────────────────────────────────
  _parseAIResponse(rawResponse) {
    try {
      const parsed = JSON.parse(rawResponse);
      return {
        reply:          parsed.reply || "I'm here to help! How can I assist you?",
        intent:         parsed.intent || 'general',
        extracted:      parsed.extracted || {},
        showChips:      parsed.showChips || [],
        showCalendar:   parsed.showCalendar || false,
        showSlots:      parsed.showSlots || false,
        confirmBooking: parsed.confirmBooking || false,
        isEmergency:    parsed.isEmergency || false
      };
    } catch {
      return {
        reply:          rawResponse,
        intent:         'general',
        extracted:      {},
        showChips:      [],
        showCalendar:   false,
        showSlots:      false,
        confirmBooking: false,
        isEmergency:    false
      };
    }
  }

  // ─── Update Session Memory ─────────────────────────────────────────
  _updateSessionMemory(extracted) {
    if (!extracted) return;
    const keys = [
      'department','doctor','date','dateLabel','slot',
      'patientName','patientAge','patientGender',
      'patientPhone','patientEmail','symptoms','lookupPhone'
    ];
    keys.forEach(k => { if (extracted[k] !== null && extracted[k] !== undefined) this.sessionMemory[k] = extracted[k]; });
  }

  // ─── Booking Ready Check ──────────────────────────────────────────
  _isBookingReady() {
    const m = this.sessionMemory;
    return !!(m.department && m.date && m.slot && m.patientName && m.patientAge && m.patientGender && m.patientPhone);
  }

  // ─── Save Booking ─────────────────────────────────────────────────
  async _saveBooking() {
    const m      = this.sessionMemory;
    const id     = this._generateRef();
    const doctor = m.department === 'neuro' ? 'Dr. Mahesh Kumar Kusta' : 'Dental Specialist';
    const deptLabel = m.department === 'neuro' ? 'Neurology / Brain & Spine' : 'Dental & Orthodontics';

    const booking = {
      // Primary IDs (used by admin dashboard)
      id,
      ref:           id,

      // Department & Doctor
      dept:          m.department,
      department:    m.department,
      deptLabel,
      doctorId:      m.department === 'neuro' ? 'mkk' : 'dental-specialist',
      doctorName:    doctor,
      doctor,
      service:       m.service || (m.department === 'neuro' ? 'Neurology OPD' : 'Dental OPD'),

      // Schedule
      date:          m.date,
      dateLabel:     m.dateLabel,
      slot:          m.slot,

      // Patient — both naming conventions for admin compat
      name:          m.patientName,
      patientName:   m.patientName,
      firstName:     m.patientName ? m.patientName.split(' ')[0] : '',
      lastName:      m.patientName ? m.patientName.split(' ').slice(1).join(' ') : '',
      phone:         m.patientPhone,
      patientPhone:  m.patientPhone,
      email:         m.patientEmail || '',
      patientEmail:  m.patientEmail || '',
      age:           m.patientAge,
      patientAge:    m.patientAge,
      gender:        m.patientGender,
      patientGender: m.patientGender,
      symptoms:      m.symptoms || '',

      // Meta
      status:        'Pending',  // Doctor must review & confirm in admin dashboard
      created:       new Date().toISOString(),
      createdAt:     new Date().toISOString(),
      sessionId:     this.sessionId,
      source:        'ai_chatbot'
    };

    // Try Firebase first (use .doc(id).set() so doc ID = booking ID)
    if (typeof db !== 'undefined' && db) {
      try {
        await db.collection('appointments').doc(id).set(booking);
      } catch (e) {
        console.warn('[ShreeAI] Firebase save failed, using localStorage:', e);
        this._saveToLocalStorage(booking);
      }
    } else {
      this._saveToLocalStorage(booking);
    }

    this.sessionMemory.appointmentRef = id;
    this.bookedAppointments.push(booking);

    // Send confirmation
    if (typeof ShreeNotifications !== 'undefined') {
      ShreeNotifications.sendConfirmation(booking);
    }

    return booking;
  }

  _saveToLocalStorage(booking) {
    // Use the SAME key as the web form & admin dashboard
    const existing = JSON.parse(localStorage.getItem('sndc_appointments') || '[]');
    existing.push(booking);
    localStorage.setItem('sndc_appointments', JSON.stringify(existing));
  }

  // ─── Load Cache ────────────────────────────────────────────────────
  _loadBookingCache() {
    // Same key as web form & admin dashboard
    this.bookedAppointments = JSON.parse(localStorage.getItem('sndc_appointments') || '[]');
    if (typeof db !== 'undefined' && db) {
      const today = new Date().toISOString().split('T')[0];
      db.collection('appointments').where('date', '>=', today).get()
        .then(snap => {
          this.bookedAppointments = [];
          snap.forEach(doc => this.bookedAppointments.push(doc.data()));
        })
        .catch(() => {});
    }
  }

  // ─── Slot Availability ─────────────────────────────────────────────
  getSlotAvailability(date, slot) {
    const max   = (typeof CLINIC_CONFIG !== 'undefined' ? CLINIC_CONFIG.maxPerSlot : null) || 5;
    const count = this.bookedAppointments.filter(b => b.date === date && b.slot === slot && b.status !== 'cancelled').length;
    return { available: count < max, remaining: Math.max(0, max - count), count };
  }

  getAllSlotAvailability(date) {
    const slots = (typeof CLINIC_CONFIG !== 'undefined' ? CLINIC_CONFIG.timeSlots : null)
               || ['6:00 PM','6:30 PM','7:00 PM','7:30 PM','8:00 PM','8:30 PM','9:00 PM'];
    return slots.map(slot => ({ slot, ...this.getSlotAvailability(date, slot) }));
  }

  // ─── Firebase Logging ─────────────────────────────────────────────
  _logConversation(userMsg, botMsg, intent) {
    if (typeof db === 'undefined' || !db) return;
    db.collection('ai_chats').add({
      sessionId:   this.sessionId,
      userMessage: userMsg,
      botMessage:  botMsg,
      intent,
      timestamp:   new Date().toISOString(),
      patientName: this.sessionMemory.patientName || null,
      department:  this.sessionMemory.department  || null
    }).catch(() => {});
  }

  // ─── Helpers ──────────────────────────────────────────────────────
  _isOpenAIEnabled() {
    return typeof OPENAI_CONFIG !== 'undefined'
      && OPENAI_CONFIG.apiKey
      && OPENAI_CONFIG.apiKey.startsWith('sk-');
  }

  _getRecentHistory(n = 10) { return this.conversationHistory.slice(-n); }

  _generateSessionId() { return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8); }

  _generateRef() {
    // Format: SND-YYYYMMDD-XXXX  (matches web form IDs like SND-20260712-0003)
    const now = new Date();
    const y   = now.getFullYear();
    const mo  = String(now.getMonth() + 1).padStart(2, '0');
    const d   = String(now.getDate()).padStart(2, '0');
    // Count existing bookings for the sequential number
    const existing = JSON.parse(localStorage.getItem('sndc_appointments') || '[]');
    const num = String(existing.length + 1).padStart(4, '0');
    return `SND-${y}${mo}${d}-${num}`;
  }

  _errorResponse() {
    return {
      reply: "I'm having a small hiccup 😅 Please try again, or call us directly at **+91 93373 88068** for immediate help!",
      intent: 'error',
      extracted: {},
      showChips: ['Try Again', 'Call Clinic: +91 93373 88068'],
      showCalendar: false, showSlots: false, confirmBooking: false, isEmergency: false
    };
  }

  // ─── Public Event Handlers (called from UI) ────────────────────────
  async handleSlotSelection(slot) {
    this.sessionMemory.slot = slot;
    return await this.processMessage(`I'd like the ${slot} slot`);
  }

  async handleDateSelection(dateISO, dateLabel) {
    this.sessionMemory.date      = dateISO;
    this.sessionMemory.dateLabel = dateLabel;
    return await this.processMessage(`I want an appointment on ${dateLabel}`);
  }

  async handleChipClick(chipText) {
    return await this.processMessage(chipText);
  }

  resetSession() {
    this.sessionMemory = {
      intent: null, department: null, doctor: null, service: null,
      date: null, dateLabel: null, slot: null,
      patientName: null, patientAge: null, patientGender: null,
      patientPhone: null, patientEmail: null,
      symptoms: null, appointmentRef: null, lookupPhone: null, stage: 'greeting'
    };
    this.conversationHistory = [];
    this.sessionId = this._generateSessionId();
  }

  _capitalize(str) {
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  getLocalHistory() { return JSON.parse(localStorage.getItem('sndc_appointments') || '[]'); }
}

// Global hook for chat-widget.js
window.ShreeAI = null;
