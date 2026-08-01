/* ==========================================================
   Bridge — contact form
   Wires the "Contact us" CTA to a real modal that submits into
   contact_messages. No login required — see the RLS policy
   "Anyone can submit a contact message" in the SQL for this
   feature.
   ========================================================== */

import { submitContactMessage } from './api.js';
import { showToast } from './nav-auth.js';

export function initContactForm(){
  const openBtn = document.getElementById('ctaContact');
  const overlay = document.getElementById('contactOverlay');
  const closeBtn = document.getElementById('contactClose');
  const form = document.getElementById('contactForm');
  const errorEl = document.getElementById('contactError');

  if(!openBtn || !overlay || !form) return; // page doesn't include this feature

  function open(){
    errorEl.classList.remove('show');
    form.reset();
    overlay.classList.add('open');
  }
  function close(){ overlay.classList.remove('open'); }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const payload = {
      name: document.getElementById('contactName').value.trim(),
      email: document.getElementById('contactEmail').value.trim(),
      role: document.getElementById('contactRole').value,
      message: document.getElementById('contactMessage').value.trim(),
    };

    const result = await submitContactMessage(payload);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Send message';

    if(!result.success){
      errorEl.textContent = result.error || 'Something went wrong — try again.';
      errorEl.classList.add('show');
      return;
    }

    close();
    showToast("Message sent — we'll get back to you soon.");
  });
}
