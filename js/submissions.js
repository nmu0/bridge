/* ==========================================================
   Bridge — opportunity submission form
   Lets a logged-in user propose a new opportunity. It's
   inserted with status: 'pending' (the column default), so
   it won't show up publicly until an admin approves it — the
   RLS policy "Authenticated users can submit opportunities"
   in schema.sql already allows this insert.
   ========================================================== */

import { supabase } from './supabase-client.js';
import { openAuthModal, showToast } from './nav-auth.js';

export function initSubmissionForm(){
  const openBtn = document.getElementById('submitOppBtn');
  const overlay = document.getElementById('submitOverlay');
  const closeBtn = document.getElementById('submitClose');
  const form = document.getElementById('submitForm');
  const errorEl = document.getElementById('submitError');

  if(!openBtn || !overlay || !form) return; // page doesn't include this feature

  async function open(){
    const { data: { user } } = await supabase.auth.getUser();
    if(!user){
      openAuthModal('login');
      showToast('Log in to submit an opportunity.');
      return;
    }
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

    const { data: { user } } = await supabase.auth.getUser();
    if(!user){
      openAuthModal('login');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    const payload = {
      title: document.getElementById('subTitle').value.trim(),
      org: document.getElementById('subOrg').value.trim(),
      type: document.getElementById('subType').value,
      cost: document.getElementById('subCost').value,
      remote: document.getElementById('subRemote').checked,
      location: document.getElementById('subLocation').value.trim(),
      eligibility: document.getElementById('subEligibility').value.trim(),
      deadline: document.getElementById('subDeadline').value || null,
      description: document.getElementById('subDescription').value.trim(),
      source_url: document.getElementById('subUrl').value.trim() || null,
      submitted_by: user.id,
    };

    const { error } = await supabase.from('opportunities').insert(payload);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit for review';

    if(error){
      errorEl.textContent = error.message;
      errorEl.classList.add('show');
      return;
    }

    close();
    showToast("Submitted! It'll show up once approved.");
  });
}
