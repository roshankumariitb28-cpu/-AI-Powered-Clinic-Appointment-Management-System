/* ================================================================
   SHREE NEURO & DENTAL — NOTIFICATION SYSTEM
   ai-notifications.js — Email (EmailJS), WhatsApp deep links, toasts
   ================================================================ */

'use strict';

class ShreeNotifications {

  // ─── Send Booking Confirmation ────────────────────────────────────
  static async sendConfirmation(booking) {
    const results = [];

    // Email confirmation
    if (booking.patientEmail && FEATURES?.emailNotifications) {
      results.push(await this.sendEmailConfirmation(booking));
    }

    // WhatsApp link (always available)
    this._sendWhatsAppNotification(booking);

    // In-app toast
    if (window.ShreeChatWidgetInstance) {
      window.ShreeChatWidgetInstance.showToast(
        `✅ Appointment confirmed! Ref: ${booking.ref}`,
        'success',
        6000
      );
    }

    // Schedule reminder (24 hours before)
    this._scheduleReminder(booking);

    return results;
  }

  // ─── Email via EmailJS ────────────────────────────────────────────
  static async sendEmailConfirmation(booking) {
    if (typeof emailjs === 'undefined') {
      console.warn('[ShreeNotify] EmailJS not loaded');
      return { success: false, error: 'EmailJS not loaded' };
    }

    const config = typeof EMAILJS_CONFIG !== 'undefined' ? EMAILJS_CONFIG : {};
    if (!config.publicKey || !config.serviceId || !config.templateId) {
      console.warn('[ShreeNotify] EmailJS not configured');
      return { success: false, error: 'EmailJS not configured' };
    }

    const templateParams = {
      patient_name:  booking.patientName,
      patient_email: booking.patientEmail,
      patient_phone: booking.patientPhone,
      doctor:        booking.doctor,
      department:    booking.department === 'neuro' ? 'Neurology' : 'Dental',
      service:       booking.service,
      date:          booking.dateLabel || booking.date,
      time:          booking.slot,
      ref:           booking.ref,
      clinic_name:   'Shree Neuro & Dental Health Care',
      clinic_phone:  '+91 93373 88068',
      clinic_address:'Badabazar, Sambalpur, Odisha'
    };

    try {
      emailjs.init(config.publicKey);
      await emailjs.send(config.serviceId, config.templateId, templateParams);
      console.log('[ShreeNotify] Confirmation email sent to', booking.patientEmail);
      return { success: true };
    } catch (err) {
      console.error('[ShreeNotify] Email failed:', err);
      return { success: false, error: err.message };
    }
  }

  // ─── Email Reminder ───────────────────────────────────────────────
  static async sendReminderEmail(booking) {
    if (typeof emailjs === 'undefined') return;
    const config = typeof EMAILJS_CONFIG !== 'undefined' ? EMAILJS_CONFIG : {};
    if (!config.reminderTemplateId) return;

    try {
      await emailjs.send(config.serviceId, config.reminderTemplateId, {
        patient_name:  booking.patientName,
        patient_email: booking.patientEmail,
        doctor:        booking.doctor,
        date:          booking.dateLabel || booking.date,
        time:          booking.slot,
        ref:           booking.ref
      });
    } catch (e) {
      console.warn('[ShreeNotify] Reminder email failed:', e);
    }
  }

  // ─── WhatsApp Deep Link ───────────────────────────────────────────
  static _sendWhatsAppNotification(booking) {
    // We don't auto-open; we prepare the link for the user
    const whatsappNum = (typeof CLINIC_CONFIG !== 'undefined' ? CLINIC_CONFIG.whatsappNumber : '917008956183');
    const msg = encodeURIComponent(
      `*Appointment Confirmation* ✅\n\n` +
      `*Clinic:* Shree Neuro & Dental Health Care\n` +
      `*Ref:* ${booking.ref}\n` +
      `*Patient:* ${booking.patientName}\n` +
      `*Doctor:* ${booking.doctor}\n` +
      `*Date:* ${booking.dateLabel || booking.date}\n` +
      `*Time:* ${booking.slot}\n` +
      `*Phone:* ${booking.patientPhone}\n\n` +
      `For queries: +91 93373 88068`
    );
    // Store for reference
    booking.whatsappLink = `https://wa.me/${whatsappNum}?text=${msg}`;
  }

  // ─── Schedule Reminder (localStorage-based) ───────────────────────
  static _scheduleReminder(booking) {
    try {
      const reminders = JSON.parse(localStorage.getItem('shree_reminders') || '[]');
      const apptDate = new Date(`${booking.date}T${this._slotToTime(booking.slot)}`);
      const reminderDate = new Date(apptDate.getTime() - 24 * 60 * 60 * 1000); // 24h before

      reminders.push({
        ref: booking.ref,
        patientEmail: booking.patientEmail,
        reminderAt: reminderDate.toISOString(),
        sent: false,
        booking
      });

      localStorage.setItem('shree_reminders', JSON.stringify(reminders));
    } catch (e) {
      console.warn('[ShreeNotify] Could not schedule reminder:', e);
    }
  }

  // ─── Check Pending Reminders ──────────────────────────────────────
  static checkPendingReminders() {
    const reminders = JSON.parse(localStorage.getItem('shree_reminders') || '[]');
    const now = new Date();
    const updated = reminders.map(r => {
      if (!r.sent && new Date(r.reminderAt) <= now) {
        if (r.patientEmail && FEATURES?.emailNotifications) {
          this.sendReminderEmail(r.booking);
        }
        // In-app reminder if on site
        if (window.ShreeChatWidgetInstance) {
          window.ShreeChatWidgetInstance.showToast(
            `⏰ Reminder: Appointment tomorrow at ${r.booking.slot}!`,
            'info',
            8000
          );
        }
        return { ...r, sent: true };
      }
      return r;
    });
    localStorage.setItem('shree_reminders', JSON.stringify(updated));
  }

  // ─── Generate WhatsApp Link ───────────────────────────────────────
  static getWhatsAppLink(booking) {
    const whatsappNum = (typeof CLINIC_CONFIG !== 'undefined' ? CLINIC_CONFIG.whatsappNumber : '917008956183');
    const msg = `Appointment Ref: ${booking.ref} | ${booking.patientName} | ${booking.dateLabel || booking.date} at ${booking.slot}`;
    return `https://wa.me/${whatsappNum}?text=${encodeURIComponent(msg)}`;
  }

  // ─── Helper: Slot to 24H time ─────────────────────────────────────
  static _slotToTime(slot) {
    if (!slot) return '18:00:00';
    const [time, period] = slot.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2,'0')}:${(m||0).toString().padStart(2,'0')}:00`;
  }
}

// ─── Check reminders on page load ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ShreeNotifications.checkPendingReminders();
});
