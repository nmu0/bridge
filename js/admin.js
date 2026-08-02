/* ==========================================================
   Bridge — admin.html entry point
   Lists pending opportunity submissions and lets an admin
   approve or reject each one. Gated by isAdmin() (checks
   profiles.role — see schema.sql). The RLS policy "Admins can
   update opportunities" is what actually enforces this
   server-side; the client-side gate here is just UX, not the
   security boundary.
   ========================================================== */

import { initAuthUI, showToast } from './nav-auth.js';
import { isAdmin, getPendingOpportunities, setOpportunityStatus, getContactMessages, markMessageRead } from './api.js';

let currentUser = null;
let pending = [];
let messages = [];

const gateEl = document.getElementById('adminGate');
const listEl = document.getElementById('adminList');

initAuthUI(async (user) => {
  currentUser = user;
  await refresh();
});

async function refresh(){
  if(!currentUser){
    gateEl.style.display = 'block';
    gateEl.textContent = 'You need to be logged in as an admin to view this page.';
    listEl.innerHTML = '';
    return;
  }

  const admin = await isAdmin();
  if(!admin){
    gateEl.style.display = 'block';
    gateEl.textContent = "You're logged in, but this account doesn't have admin access.";
    listEl.innerHTML = '';
    return;
  }

  gateEl.style.display = 'none';
  pending = await getPendingOpportunities();
  messages = await getContactMessages();
  render();
  renderMessages();
}

function render(){
  if(pending.length === 0){
    listEl.innerHTML = `<div class="empty-state">No pending submissions right now.</div>`;
    return;
  }

  listEl.innerHTML = pending.map(o => `
    <article class="admin-card">
      <div class="opp-top">
        <span class="opp-type">${o.type}</span>
        <span class="meta-tag">submitted by ${o.submitted_by ? o.submitted_by.slice(0, 8) : 'unknown'}…</span>
      </div>
      <h3>${o.title}</h3>
      <p class="opp-org">${o.org}</p>
      <div class="opp-meta">
        <span class="meta-tag ${o.cost === 'free' ? 'free' : ''}">${o.cost === 'free' ? 'free' : 'paid'}</span>
        <span class="meta-tag">${o.location}</span>
        <span class="meta-tag">${o.eligibility}</span>
        <span class="meta-tag deadline">due ${o.deadline}</span>
      </div>
      <p class="opp-desc">${o.description}</p>
      ${o.source_url ? `<p class="admin-url"><a href="${o.source_url}" target="_blank" rel="noopener">${o.source_url}</a></p>` : ''}
      <div class="opp-actions">
        <button class="btn btn-primary small approve-btn" data-id="${o.id}">Approve</button>
        <button class="btn btn-outline small reject-btn" data-id="${o.id}">Reject</button>
      </div>
    </article>
  `).join('');

  listEl.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDecision(btn.dataset.id, 'approved'));
  });
  listEl.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDecision(btn.dataset.id, 'rejected'));
  });
}

function renderMessages(){
  const listEl = document.getElementById('messagesList');
  if(!listEl) return;

  if(messages.length === 0){
    listEl.innerHTML = `<div class="empty-state">No messages yet.</div>`;
    return;
  }

  listEl.innerHTML = messages.map(m => `
    <article class="admin-card ${m.read ? '' : 'unread'}">
      <div class="opp-top">
        <span class="opp-type">${m.role || 'unspecified'}</span>
        <span class="meta-tag">${new Date(m.created_at).toLocaleDateString()}</span>
      </div>
      <h3>${m.name}</h3>
      <p class="opp-org"><a href="mailto:${m.email}">${m.email}</a></p>
      <p class="opp-desc">${m.message}</p>
      ${m.read ? '' : `<button class="btn btn-outline small mark-read-btn" data-id="${m.id}">Mark as read</button>`}
    </article>
  `).join('');

  listEl.querySelectorAll('.mark-read-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await markMessageRead(btn.dataset.id);
      messages = messages.map(m => m.id === btn.dataset.id ? { ...m, read: true } : m);
      renderMessages();
    });
  });
}

async function handleDecision(id, status){
  const success = await setOpportunityStatus(id, status);
  if(!success){
    showToast('Something went wrong — try again.');
    return;
  }
  pending = pending.filter(o => o.id !== id);
  render();
  showToast(status === 'approved' ? 'Approved — now live.' : 'Rejected.');
}
