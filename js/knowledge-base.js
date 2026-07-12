/* ================================================================
   SHREE NEURO & DENTAL — AI KNOWLEDGE BASE
   knowledge-base.js — Clinic info, FAQs, and RAG data for GPT
   ================================================================ */

'use strict';

const CLINIC_KNOWLEDGE = {

  // ─── Clinic Overview ────────────────────────────────────────────
  overview: `
    Shree Neuro & Dental Health Care is Sambalpur's premier specialty clinic,
    located in Badabazar, Sambalpur, Odisha. The clinic offers two major specialties:
    Neurology/Neurosurgery and Dentistry. It is led by Dr. Mahesh Kumar Kusta,
    a Gold Medalist Brain & Spine Surgeon from VIMSAR.

    Clinic Hours: Monday to Saturday, 6:00 PM to 9:00 PM.
    Emergency contact is available 24/7 at +91 93373 88068.
    WhatsApp: +91 70089 56183.
    Address: Badabazar, Sambalpur, Odisha - 768001.
  `,

  // ─── Doctors ────────────────────────────────────────────────────
  doctors: [
    {
      id: "mkk",
      name: "Dr. Mahesh Kumar Kusta",
      shortName: "Dr. Kusta",
      specialty: "Neurology & Neurosurgery",
      department: "neuro",
      qualifications: "MBBS (Gold Medalist), MS, MCh (Neurosurgery), FNE",
      institution: "VIMSAR, Burla, Odisha",
      expertise: [
        "Brain tumors", "Spine surgery", "Hydrocephalus", "Stroke management",
        "Head injury", "Epilepsy", "Parkinson's disease", "Nerve disorders",
        "Cervical & lumbar disc problems", "Pediatric neurosurgery"
      ],
      experience: "10+ years",
      languages: ["English", "Hindi", "Odia"],
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      slots: ["6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"]
    },
    {
      id: "dental-specialist",
      name: "Dental Specialist",
      shortName: "Dental Specialist",
      specialty: "Dentistry & Oral Surgery",
      department: "dental",
      qualifications: "BDS, MDS (Prosthodontics & Implantology)",
      expertise: [
        "Teeth cleaning", "Root canal treatment", "Dental implants",
        "Tooth extraction", "Orthodontics (braces)", "Teeth whitening",
        "Crown & bridge", "Dentures", "Gum disease treatment",
        "Pediatric dentistry", "Wisdom tooth removal", "Dental X-rays"
      ],
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      slots: ["6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"]
    }
  ],

  // ─── Services ───────────────────────────────────────────────────
  services: {
    neurology: [
      { name: "Brain Tumor Consultation", duration: "45 mins", keywords: ["brain tumor", "tumor", "cancer brain"] },
      { name: "Spine Surgery Consultation", duration: "45 mins", keywords: ["spine", "back pain", "disc", "cervical", "lumbar"] },
      { name: "Stroke Management", duration: "30 mins", keywords: ["stroke", "paralysis", "weakness"] },
      { name: "Epilepsy Consultation", duration: "30 mins", keywords: ["epilepsy", "seizure", "fits"] },
      { name: "Head Injury Evaluation", duration: "30 mins", keywords: ["head injury", "accident", "trauma"] },
      { name: "Parkinson's Consultation", duration: "30 mins", keywords: ["parkinson", "tremor", "shaking"] },
      { name: "General Neurology OPD", duration: "20 mins", keywords: ["neurology", "brain", "nerve", "neuro", "headache", "migraine"] },
      { name: "Nerve Conduction Study", duration: "40 mins", keywords: ["nerve test", "ncs", "emg"] },
      { name: "Pediatric Neurology", duration: "30 mins", keywords: ["child", "baby", "pediatric neuro"] }
    ],
    dental: [
      { name: "Dental Check-up & Cleaning", duration: "30 mins", keywords: ["cleaning", "checkup", "scaling"] },
      { name: "Root Canal Treatment", duration: "60 mins", keywords: ["root canal", "rct", "tooth pain", "cavity"] },
      { name: "Dental Implants", duration: "60 mins", keywords: ["implant", "missing tooth"] },
      { name: "Tooth Extraction", duration: "30 mins", keywords: ["extraction", "remove tooth", "wisdom tooth", "wisdom"] },
      { name: "Orthodontic Consultation (Braces)", duration: "30 mins", keywords: ["braces", "orthodontic", "crooked teeth", "alignment"] },
      { name: "Teeth Whitening", duration: "45 mins", keywords: ["whitening", "bleaching", "yellow teeth"] },
      { name: "Crown & Bridge", duration: "45 mins", keywords: ["crown", "bridge", "cap"] },
      { name: "Dentures", duration: "30 mins", keywords: ["denture", "false teeth", "prosthetic"] },
      { name: "Gum Disease Treatment", duration: "30 mins", keywords: ["gum", "bleeding gum", "periodontitis"] },
      { name: "General Dental OPD", duration: "20 mins", keywords: ["dental", "teeth", "tooth", "dentist", "mouth"] }
    ]
  },

  // ─── FAQs ───────────────────────────────────────────────────────
  faqs: [
    {
      q: "What are the clinic hours?",
      a: "The clinic is open Monday to Saturday, from 6:00 PM to 9:00 PM. For emergencies, call +91 93373 88068 anytime."
    },
    {
      q: "How do I book an appointment?",
      a: "You can book right here in this chat! Just tell me what kind of appointment you need — neurology or dental — and I'll help you pick a date and time."
    },
    {
      q: "Can I book a same-day appointment?",
      a: "Yes! If slots are available today (after 6 PM), you can book same-day. I'll check availability for you."
    },
    {
      q: "How do I cancel or reschedule?",
      a: "Just tell me in this chat — 'I want to cancel my appointment' or 'I want to reschedule' — and I'll take care of it for you."
    },
    {
      q: "Is Dr. Mahesh Kumar Kusta available on weekends?",
      a: "Dr. Kusta is available Monday through Saturday, 6 PM to 9 PM. Sundays are off."
    },
    {
      q: "What is the consultation fee?",
      a: "Please call us at +91 93373 88068 or WhatsApp at +91 70089 56183 for current fee information."
    },
    {
      q: "Where is the clinic located?",
      a: "We are located in Badabazar, Sambalpur, Odisha - 768001. You can find us on Google Maps by searching 'Shree Neuro Dental Sambalpur'."
    },
    {
      q: "Is the clinic near any landmark?",
      a: "Yes, we are in Badabazar area of Sambalpur, which is a well-known central location. Call us at +91 93373 88068 for exact directions."
    },
    {
      q: "Do you accept walk-ins?",
      a: "Yes, walk-ins are welcome based on slot availability. However, booking in advance through this chatbot is recommended to guarantee your slot."
    },
    {
      q: "How many patients are seen per slot?",
      a: "We limit to 5 patients per 30-minute slot to ensure quality care and minimal waiting time."
    },
    {
      q: "Can I book for a family member?",
      a: "Absolutely! Just let me know their name and I'll book the appointment under their details."
    },
    {
      q: "Do you treat children?",
      a: "Yes! We have pediatric neurology and pediatric dental services available for children of all ages."
    },
    {
      q: "What should I bring to my appointment?",
      a: "Please bring any previous medical reports, prescriptions, or X-rays related to your condition. For dental visits, share any existing dental records if available."
    },
    {
      q: "Is there parking available?",
      a: "Please call the clinic at +91 93373 88068 for parking information near the Badabazar location."
    },
    {
      q: "Do you do emergency neurosurgery?",
      a: "For neurological emergencies like stroke, severe head injury, or sudden loss of consciousness — call +91 93373 88068 immediately or go to the nearest emergency room. Do NOT wait for a chatbot booking in emergencies."
    },
    {
      q: "What insurances do you accept?",
      a: "Please contact the clinic at +91 93373 88068 or WhatsApp at +91 70089 56183 for insurance empanelment details."
    },
    {
      q: "Can I get a report or certificate?",
      a: "Yes, medical certificates and reports are available. Please discuss with Dr. Kusta during your appointment."
    },
    {
      q: "How long is the wait time?",
      a: "With a booked appointment, typical wait time is under 15 minutes. Walk-in patients may have longer waits."
    }
  ],

  // ─── Emergency Protocol ─────────────────────────────────────────
  emergency: {
    keywords: ["emergency", "stroke", "unconscious", "fitting", "seizure", "accident", "critical", "urgent", "severe headache sudden"],
    response: `⚠️ This sounds like a medical emergency. Please DO NOT wait for an appointment — take immediate action:

1. **Call 108** (Emergency Ambulance) immediately
2. **Call Dr. Kusta directly**: +91 93373 88068
3. Go to the nearest hospital emergency room

For stroke: Remember F.A.S.T. — Face drooping, Arm weakness, Speech difficulty, Time to call.

Can I help you with anything else, or would you like me to initiate a call?`
  },

  // ─── Sentiment Responses ─────────────────────────────────────────
  sentimentPhrases: {
    anxious: ["nervous", "scared", "worried", "anxious", "afraid", "pain", "suffering"],
    greeting: ["hello", "hi", "hey", "good morning", "good evening", "namaste"],
    thankful: ["thank", "thanks", "great", "wonderful", "excellent", "awesome"],
    frustrated: ["useless", "not working", "problem", "issue", "error", "fail", "terrible"]
  }
};

// Export for use by chatbot engine
if (typeof module !== 'undefined') module.exports = { CLINIC_KNOWLEDGE };
