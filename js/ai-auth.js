/* ================================================================
   SHREE NEURO & DENTAL — FIREBASE AUTHENTICATION MODULE
   ai-auth.js — Email, Google, Phone login, persistent session
   ================================================================ */

'use strict';

class ShreeAuth {

  constructor() {
    this.currentUser = null;
    this.authStateCallbacks = [];
    this._init();
  }

  _init() {
    // Check if Firebase Auth is available
    if (typeof firebase === 'undefined' || !FEATURES?.firebaseAuth) {
      console.info('[ShreeAuth] Firebase Auth not configured. Using localStorage session.');
      // Load from localStorage fallback
      const saved = localStorage.getItem('shree_user');
      if (saved) {
        this.currentUser = JSON.parse(saved);
        this._notifyCallbacks(this.currentUser);
      }
      return;
    }

    // Firebase Auth state observer
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        this.currentUser = {
          uid: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          phone: user.phoneNumber || '',
          photoURL: user.photoURL || '',
          provider: user.providerData[0]?.providerId || 'email'
        };
        localStorage.setItem('shree_user', JSON.stringify(this.currentUser));
      } else {
        this.currentUser = null;
        localStorage.removeItem('shree_user');
      }
      this._notifyCallbacks(this.currentUser);
    });
  }

  // ─── Email Registration ───────────────────────────────────────────
  async registerWithEmail(name, email, password, phone = '') {
    if (typeof firebase === 'undefined') {
      // Mock for demo
      const user = { uid: 'demo_' + Date.now(), name, email, phone, provider: 'email' };
      localStorage.setItem('shree_user', JSON.stringify(user));
      this.currentUser = user;
      this._notifyCallbacks(user);
      return { success: true, user };
    }

    try {
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });

      // Save to Firestore
      if (typeof db !== 'undefined' && db) {
        await db.collection('users').doc(cred.user.uid).set({
          name, email, phone,
          createdAt: new Date().toISOString(),
          role: 'patient'
        });
      }

      return { success: true, user: cred.user };
    } catch (err) {
      return { success: false, error: this._friendlyError(err.code) };
    }
  }

  // ─── Email Login ──────────────────────────────────────────────────
  async loginWithEmail(email, password) {
    if (typeof firebase === 'undefined') {
      // Demo mode
      const user = { uid: 'demo_' + Date.now(), name: email.split('@')[0], email, provider: 'email' };
      localStorage.setItem('shree_user', JSON.stringify(user));
      this.currentUser = user;
      this._notifyCallbacks(user);
      return { success: true, user };
    }

    try {
      const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
      return { success: true, user: cred.user };
    } catch (err) {
      return { success: false, error: this._friendlyError(err.code) };
    }
  }

  // ─── Google Sign-In ───────────────────────────────────────────────
  async loginWithGoogle() {
    if (typeof firebase === 'undefined') {
      const user = { uid: 'google_demo_' + Date.now(), name: 'Google User', email: 'user@gmail.com', provider: 'google' };
      localStorage.setItem('shree_user', JSON.stringify(user));
      this.currentUser = user;
      this._notifyCallbacks(user);
      return { success: true, user };
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      const result = await firebase.auth().signInWithPopup(provider);

      // Save to Firestore if new user
      if (typeof db !== 'undefined' && db) {
        const userRef = db.collection('users').doc(result.user.uid);
        const doc = await userRef.get();
        if (!doc.exists) {
          await userRef.set({
            name: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL,
            provider: 'google',
            createdAt: new Date().toISOString(),
            role: 'patient'
          });
        }
      }

      return { success: true, user: result.user };
    } catch (err) {
      return { success: false, error: this._friendlyError(err.code) };
    }
  }

  // ─── Phone OTP ────────────────────────────────────────────────────
  async sendOTP(phoneNumber, recaptchaContainerId) {
    if (typeof firebase === 'undefined') {
      return { success: true, verificationId: 'demo_verification' };
    }

    try {
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(recaptchaContainerId, {
        size: 'invisible',
        callback: () => {}
      });

      const result = await firebase.auth().signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier);
      window.confirmationResult = result;
      return { success: true };
    } catch (err) {
      return { success: false, error: this._friendlyError(err.code) };
    }
  }

  async verifyOTP(otp) {
    if (typeof firebase === 'undefined' || !window.confirmationResult) {
      const user = { uid: 'phone_demo_' + Date.now(), name: 'User', phone: '', provider: 'phone' };
      localStorage.setItem('shree_user', JSON.stringify(user));
      this.currentUser = user;
      this._notifyCallbacks(user);
      return { success: true, user };
    }

    try {
      const result = await window.confirmationResult.confirm(otp);
      return { success: true, user: result.user };
    } catch (err) {
      return { success: false, error: 'Invalid OTP. Please try again.' };
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────
  async logout() {
    if (typeof firebase !== 'undefined' && FEATURES?.firebaseAuth) {
      await firebase.auth().signOut();
    }
    localStorage.removeItem('shree_user');
    this.currentUser = null;
    this._notifyCallbacks(null);
  }

  // ─── Auth State Listener ──────────────────────────────────────────
  onAuthStateChange(callback) {
    this.authStateCallbacks.push(callback);
    // Immediately call with current state
    callback(this.currentUser);
    return () => {
      this.authStateCallbacks = this.authStateCallbacks.filter(cb => cb !== callback);
    };
  }

  _notifyCallbacks(user) {
    this.authStateCallbacks.forEach(cb => cb(user));
  }

  // ─── Update Profile ───────────────────────────────────────────────
  async updateProfile(data) {
    if (!this.currentUser) return { success: false, error: 'Not logged in' };

    if (typeof firebase !== 'undefined' && FEATURES?.firebaseAuth) {
      try {
        await firebase.auth().currentUser.updateProfile({ displayName: data.name });
        if (typeof db !== 'undefined' && db) {
          await db.collection('users').doc(this.currentUser.uid).update(data);
        }
      } catch (e) {
        console.warn('[ShreeAuth] Profile update error:', e);
      }
    }

    const updated = { ...this.currentUser, ...data };
    localStorage.setItem('shree_user', JSON.stringify(updated));
    this.currentUser = updated;
    return { success: true };
  }

  // ─── Get User's Appointments ──────────────────────────────────────
  async getUserAppointments() {
    if (!this.currentUser) return [];

    let firebaseAppts = [];

    // Try Firebase first
    if (typeof db !== 'undefined' && db) {
      try {
        const promises = [];
        
        // Helper to normalize legacy keys to the unified format
        const unify = (a) => ({
          ref:           a.ref || a.id || '—',
          department:    a.department || a.dept || 'neuro',
          doctor:        a.doctor || a.doctorName || 'Dr. Mahesh Kumar Kusta',
          date:          a.date || '—',
          dateLabel:     a.dateLabel || a.date || '—',
          slot:          a.slot || '—',
          patientName:   a.patientName || a.name || '—',
          patientPhone:  a.patientPhone || a.phone || '—',
          patientEmail:  a.patientEmail || a.email || '',
          patientAge:    a.patientAge || a.age || '—',
          patientGender: a.patientGender || a.gender || '—',
          symptoms:      a.symptoms || '',
          status:        (a.status || 'pending').toLowerCase(),
          createdAt:     a.createdAt || a.created || new Date().toISOString(),
          source:        a.source || 'web_form'
        });

        // 1. Query by Email (both unified patientEmail and legacy email keys)
        if (this.currentUser.email) {
          promises.push(
            db.collection('appointments')
              .where('patientEmail', '==', this.currentUser.email)
              .get()
              .then(snap => snap.docs.map(doc => unify({ id: doc.id, ...doc.data() })))
          );
          promises.push(
            db.collection('appointments')
              .where('email', '==', this.currentUser.email)
              .get()
              .then(snap => snap.docs.map(doc => unify({ id: doc.id, ...doc.data() })))
          );
        }

        // 2. Query by phone number variations (patientPhone, phone)
        const phone = this.currentUser.phone;
        if (phone) {
          const cleanPhone = phone.replace(/\D/g, '');
          const tenDigit = cleanPhone.slice(-10);

          // Standard 10-digit query (both fields)
          promises.push(
            db.collection('appointments')
              .where('patientPhone', '==', tenDigit)
              .get()
              .then(snap => snap.docs.map(doc => unify({ id: doc.id, ...doc.data() })))
          );
          promises.push(
            db.collection('appointments')
              .where('phone', '==', tenDigit)
              .get()
              .then(snap => snap.docs.map(doc => unify({ id: doc.id, ...doc.data() })))
          );

          // Raw format query
          promises.push(
            db.collection('appointments')
              .where('patientPhone', '==', phone)
              .get()
              .then(snap => snap.docs.map(doc => unify({ id: doc.id, ...doc.data() })))
          );
          promises.push(
            db.collection('appointments')
              .where('phone', '==', phone)
              .get()
              .then(snap => snap.docs.map(doc => unify({ id: doc.id, ...doc.data() })))
          );

          // +91 format query
          promises.push(
            db.collection('appointments')
              .where('patientPhone', '==', '+91' + tenDigit)
              .get()
              .then(snap => snap.docs.map(doc => unify({ id: doc.id, ...doc.data() })))
          );
          promises.push(
            db.collection('appointments')
              .where('phone', '==', '+91' + tenDigit)
              .get()
              .then(snap => snap.docs.map(doc => unify({ id: doc.id, ...doc.data() })))
          );
        }

        const results = await Promise.all(promises);
        
        // Merge and deduplicate
        const map = new Map();
        results.flat().forEach(a => {
          if (a.ref) map.set(a.ref, a);
        });
        
        firebaseAppts = Array.from(map.values());
      } catch (e) {
        console.warn('[ShreeAuth] Could not fetch from Firebase:', e);
      }
    }

    // Fallback & Merge: localStorage
    const local = JSON.parse(localStorage.getItem('shree_appointments') || '[]');
    const legacyLocal = JSON.parse(localStorage.getItem('sndc_appointments') || '[]');
    const allLocal = [...local, ...legacyLocal];
    
    // Filter local storage with normalized matching
    const curEmail = this.currentUser.email?.toLowerCase();
    const curPhoneNorm = this.currentUser.phone ? this.currentUser.phone.replace(/\D/g, '').slice(-10) : '';

    const unifyLocal = (a) => ({
      ref:           a.ref || a.id || '—',
      department:    a.department || a.dept || 'neuro',
      doctor:        a.doctor || a.doctorName || 'Dr. Mahesh Kumar Kusta',
      date:          a.date || '—',
      dateLabel:     a.dateLabel || a.date || '—',
      slot:          a.slot || '—',
      patientName:   a.patientName || a.name || '—',
      patientPhone:  a.patientPhone || a.phone || '—',
      patientEmail:  a.patientEmail || a.email || '',
      patientAge:    a.patientAge || a.age || '—',
      patientGender: a.patientGender || a.gender || '—',
      symptoms:      a.symptoms || '',
      status:        (a.status || 'pending').toLowerCase(),
      createdAt:     a.createdAt || a.created || new Date().toISOString(),
      source:        a.source || 'web_form'
    });

    const matchedLocal = allLocal.map(unifyLocal).filter(a => {
      const aEmail = a.patientEmail?.toLowerCase();
      const aPhoneNorm = a.patientPhone ? a.patientPhone.replace(/\D/g, '').slice(-10) : '';
      
      const emailMatch = curEmail && aEmail && curEmail === aEmail;
      const phoneMatch = curPhoneNorm && aPhoneNorm && curPhoneNorm === aPhoneNorm;
      
      return emailMatch || phoneMatch;
    });

    // Merge both lists
    const finalMap = new Map();
    firebaseAppts.forEach(a => finalMap.set(a.ref, a));
    matchedLocal.forEach(a => finalMap.set(a.ref, a));

    return Array.from(finalMap.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ─── Cancel Appointment ───────────────────────────────────────────
  async cancelAppointment(appointmentRef) {
    if (typeof db !== 'undefined' && db) {
      try {
        const snap = await db.collection('appointments').where('ref', '==', appointmentRef).get();
        if (snap.empty) {
          // Try legacy id match
          const legacySnap = await db.collection('appointments').where('id', '==', appointmentRef).get();
          legacySnap.docs.forEach(doc => doc.ref.update({ status: 'Cancelled' }));
        } else {
          snap.docs.forEach(doc => doc.ref.update({ status: 'cancelled' }));
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    // localStorage fallback
    const all = JSON.parse(localStorage.getItem('shree_appointments') || '[]');
    const legacy = JSON.parse(localStorage.getItem('sndc_appointments') || '[]');
    
    const updated = all.map(a => a.ref === appointmentRef ? { ...a, status: 'cancelled' } : a);
    const updatedLegacy = legacy.map(a => a.id === appointmentRef ? { ...a, status: 'Cancelled' } : a);
    
    localStorage.setItem('shree_appointments', JSON.stringify(updated));
    localStorage.setItem('sndc_appointments', JSON.stringify(updatedLegacy));
    return { success: true };
  }

  // ─── Error Messages ───────────────────────────────────────────────
  _friendlyError(code) {
    const messages = {
      'auth/email-already-in-use': 'This email is already registered. Please log in instead.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/too-many-requests': 'Too many failed attempts. Please wait a moment.',
      'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
      'auth/invalid-verification-code': 'Invalid OTP. Please check and try again.',
    };
    return messages[code] || 'An error occurred. Please try again.';
  }

  isLoggedIn() { return !!this.currentUser; }
  getUser()    { return this.currentUser; }
}

// ─── Global Instance ──────────────────────────────────────────────
window.ShreeAuthInstance = new ShreeAuth();

