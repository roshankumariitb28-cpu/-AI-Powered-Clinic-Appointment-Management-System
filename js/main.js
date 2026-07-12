/* ================================================================
   SHREE NEURO & DENTAL HEALTH CARE — Premium JS v2.0
   main.js — Interactions, animations, scroll effects
   ================================================================ */

'use strict';

// ─── Page Loader ──────────────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    const loader = document.getElementById('pageLoader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 600);
    }
    // Trigger hero animations after load
    document.querySelectorAll('.hero .fade-up, .hero .fade-left, .hero .fade-right').forEach(el => {
      el.classList.add('visible');
    });
  }, 1800);
});

// ─── Scroll Progress Bar ──────────────────────────────────────────
const scrollProgress = document.getElementById('scrollProgress');
function updateScrollProgress() {
  if (!scrollProgress) return;
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  scrollProgress.style.width = pct + '%';
}

// ─── Navbar Scroll Effect ─────────────────────────────────────────
const navbar = document.getElementById('navbar');
function updateNavbar() {
  if (!navbar) return;
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}

// ─── Scroll-to-top Button ─────────────────────────────────────────
const scrollTopBtn = document.getElementById('scrollTop');
function updateScrollTop() {
  if (!scrollTopBtn) return;
  if (window.scrollY > 500) {
    scrollTopBtn.classList.add('visible');
  } else {
    scrollTopBtn.classList.remove('visible');
  }
}
if (scrollTopBtn) {
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ─── Combined Scroll Handler ──────────────────────────────────────
let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (!scrollTicking) {
    requestAnimationFrame(() => {
      updateScrollProgress();
      updateNavbar();
      updateScrollTop();
      scrollTicking = false;
    });
    scrollTicking = true;
  }
}, { passive: true });

// ─── Mobile Menu ──────────────────────────────────────────────────
const hamburger = document.getElementById('navHamburger');
const navMenu   = document.getElementById('navMenu');

if (hamburger && navMenu) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navMenu.classList.toggle('open');
    document.body.style.overflow = navMenu.classList.contains('open') ? 'hidden' : '';
  });

  // Close on nav link click
  navMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navMenu.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!navbar?.contains(e.target)) {
      hamburger.classList.remove('open');
      navMenu.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
}

// ─── Scroll-Reveal Animations ─────────────────────────────────────
const revealElements = document.querySelectorAll(
  '.fade-up, .fade-left, .fade-right, .fade-in, .scale-in'
);

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.12,
  rootMargin: '0px 0px -60px 0px'
});

revealElements.forEach(el => {
  // Skip hero elements — they're triggered by loader
  if (!el.closest('.hero')) {
    revealObserver.observe(el);
  }
});

// ─── Counter Animation ────────────────────────────────────────────
function animateCounter(el) {
  const target = parseInt(el.getAttribute('data-target'), 10);
  if (isNaN(target)) return;
  const duration = 2000;
  const start    = performance.now();
  const startVal = 0;

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function update(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = easeOutCubic(progress);
    const current  = Math.round(startVal + (target - startVal) * eased);
    el.textContent = current >= 1000
      ? (current >= 10000 ? Math.round(current / 1000) + 'k' : current.toLocaleString('en-IN'))
      : current;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));

// ─── FAQ Accordion ────────────────────────────────────────────────
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item   = btn.closest('.faq-item');
    const isOpen = item.classList.contains('active');

    // Close all
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));

    // Open clicked if it was closed
    if (!isOpen) item.classList.add('active');
  });
});

// ─── Active Nav Link ──────────────────────────────────────────────
(function setActiveNavLink() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href')?.split('#')[0] || '';
    if (href === current || (current === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
})();

// ─── Smooth hover tilt on service cards ──────────────────────────
document.querySelectorAll('.service-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect   = card.getBoundingClientRect();
    const x      = e.clientX - rect.left;
    const y      = e.clientY - rect.top;
    const cx     = rect.width  / 2;
    const cy     = rect.height / 2;
    const rotX   = ((y - cy) / cy) * 3;
    const rotY   = ((x - cx) / cx) * -3;
    card.style.transform = `translateY(-8px) perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});

// ─── Testimonial card parallax ────────────────────────────────────
document.querySelectorAll('.testimonial-card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
  });
});

// ─── Lazy-load images (Handled natively by browser loading="lazy") ──
// No JS overlay needed to avoid cache loading bugs


// ─── Dept card expand on hover ────────────────────────────────────
document.querySelectorAll('.dept-card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    const tags = card.querySelectorAll('.dept-tag');
    tags.forEach((tag, i) => {
      tag.style.transition = `opacity 0.3s ease ${i * 0.05}s, transform 0.3s ease ${i * 0.05}s`;
      tag.style.opacity    = '1';
      tag.style.transform  = 'translateY(0)';
    });
  });
});

// ─── Keyboard accessibility ───────────────────────────────────────
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const isOpen = btn.closest('.faq-item').classList.contains('active');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
});
