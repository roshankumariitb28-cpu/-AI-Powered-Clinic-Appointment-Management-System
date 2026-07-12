/* ================================================================
   SHREE NEURO & DENTAL — GLOBAL CONFIGURATION
   config.js — Firebase, OpenAI, EmailJS, and App Settings
   ================================================================ */

// ─── Firebase Configuration ──────────────────────────────────────
// 1. Create a Firebase project at: https://console.firebase.google.com/
// 2. Enable Firestore, Authentication (Email/Google/Phone)
// 3. Paste your config below
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// ─── OpenAI Configuration ────────────────────────────────────────
// Get your key at: https://platform.openai.com/api-keys
// IMPORTANT: Restrict this key to your domain in the OpenAI dashboard
const OPENAI_CONFIG = {
  apiKey: "",               // Your OpenAI API key (sk-...)
  model: "gpt-4o-mini",    // gpt-4o-mini is cheapest; use gpt-4o for best quality
  maxTokens: 500,
  temperature: 0.7
};

// ─── EmailJS Configuration ───────────────────────────────────────
// Free at: https://www.emailjs.com/ (200 emails/month free)
// 1. Create account, add email service (Gmail recommended)
// 2. Create an email template with variables: {{patient_name}}, {{doctor}}, {{date}}, {{time}}, {{service}}
const EMAILJS_CONFIG = {
  publicKey: "",           // Your EmailJS public key
  serviceId: "",           // e.g. "service_abc123"
  templateId: "",          // e.g. "template_xyz789"
  reminderTemplateId: ""   // optional: for 24hr reminders
};

// ─── Clinic Configuration ────────────────────────────────────────
const CLINIC_CONFIG = {
  name: "Shree Neuro & Dental Health Care",
  shortName: "Shree Clinic",
  phone: "+91 93373 88068",
  whatsapp: "+91 70089 56183",
  whatsappNumber: "917008956183",
  email: "shreeneurodentalcare@gmail.com",
  address: "Badabazar, Sambalpur, Odisha - 768001",
  mapUrl: "https://maps.google.com/?q=Badabazar+Sambalpur+Odisha",
  hours: {
    weekdays: "Mon–Sat: 6:00 PM – 9:00 PM",
    emergency: "24/7 Emergency: +91 93373 88068"
  },
  maxPerSlot: 5,
  timeSlots: [
    "6:00 PM", "6:30 PM", "7:00 PM",
    "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"
  ]
};

// ─── Feature Flags ───────────────────────────────────────────────
const FEATURES = {
  aiChatbot: true,          // Enable/disable AI chatbot
  firebaseAuth: false,       // Enable after Firebase is configured
  emailNotifications: false, // Enable after EmailJS is configured
  whatsappLinks: true,       // Always on (no API needed)
  darkMode: true,            // Dark/light mode toggle
  multiLanguage: false       // Odia/Hindi support (future)
};
