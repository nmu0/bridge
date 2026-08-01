/* ==========================================================
   Bridge — front-end interactions
   Pulls real opportunities from Supabase via api.js, and
   real auth via auth.js.
   ========================================================== */

import { getOpportunities, getSavedIds, saveOpportunity, unsaveOpportunity } from './api.js';
import { signUp, logIn, logOut, onAuthChange } from './auth.js';
import { initSubmissionForm } from './submissions.js';
import { initContactForm } from './contact.js';

// ---------- state ----------
let state = {
  type: "all",
  freeOnly: false,
  remoteOnly: false,
  savedOnly: false,
  query: "",
  visibleCount: 6,
};

let opportunities = [];   // full result set for the current filters
let saved = new Set();    // opportunity IDs saved by the current user
let currentUser = null;
let loading = false;

// ---------- data loading ----------
async function loadOpportunities(){
  loading = true;
  renderLoading();

  const [oppsResult, savedIds] = await Promise.all([
    getOpportunities({
      type: state.type,
      freeOnly: state.freeOnly,
      remoteOnly: state.remoteOnly,
      query: state.query,
    }),
    getSavedIds(),
  ]);

  opportunities = oppsResult;
  saved = new Set(savedIds);
  loading = false;
  render();
}

// ---------- render: cards ----------
function matchesSavedFilter(o){
  if(state.savedOnly && !saved.has(o.id)) return false;
  return true;
}

function cardHTML(o){
  const isSaved = saved.has(o.id);
  return `
    <article class="opp-card">
      <div class="opp-top">
        <span class="opp-type">${o.type}</span>
        <button class="save-btn ${isSaved ? "saved" : ""}" data-id="${o.id}" aria-label="Save opportunity">
          ${isSaved ? "★" : "☆"}
        </button>
      </div>
      <h3>${o.title}</h3>
      <p class="opp-org">${o.org}</p>
      <div class="opp-meta">
        <span class="meta-tag ${o.cost === "free" ? "free" : ""}">${o.cost === "free" ? "free" : "paid"}</span>
        <span class="meta-tag">${o.location}</span>
        <span class="meta-tag">${o.eligibility}</span>
        <span class="meta-tag deadline">due ${o.deadline}</span>
      </div>
      <p class="opp-desc">${o.description}</p>
      <div class="opp-actions">
        <button class="btn btn-primary small view-btn" data-id="${o.id}">View details</button>
        <button class="btn btn-text small save-btn-2" data-id="${o.id}">
          ${isSaved ? "Saved" : "Save"}
        </button>
      </div>
    </article>
  `;
}

function renderLoading(){
  const grid = document.getElementById("cardGrid");
  grid.innerHTML = `<div class="empty-state">Loading opportunities</div>`;
  document.getElementById("resultsCount").textContent = "Loading";
  document.getElementById("loadMoreBtn").style.display = "none";
}

function render(){
  if(loading) return;

  const grid = document.getElementById("cardGrid");
  const filtered = opportunities.filter(matchesSavedFilter);
  const visible = filtered.slice(0, state.visibleCount);

  document.getElementById("resultsCount").textContent =
    `Showing ${visible.length} of ${filtered.length} opportunit${filtered.length === 1 ? "y" : "ies"}`;

  grid.innerHTML = visible.length
    ? visible.map(cardHTML).join("")
    : `<div class="empty-state">No opportunities match those filters yet. Try clearing one.</div>`;

  document.getElementById("loadMoreBtn").style.display =
    filtered.length > visible.length ? "inline-block" : "none";

  grid.querySelectorAll(".save-btn, .save-btn-2").forEach(btn => {
    btn.addEventListener("click", () => toggleSave(btn.dataset.id));
  });
  grid.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
}

async function toggleSave(id){
  const wasSaved = saved.has(id);
  const o = opportunities.find(x => x.id === id);

  wasSaved ? saved.delete(id) : saved.add(id);
  render();

  const success = wasSaved ? await unsaveOpportunity(id) : await saveOpportunity(id);

  if(!success){
    wasSaved ? saved.add(id) : saved.delete(id);
    render();
    showToast("Log in to save opportunities.");
    return;
  }

  showToast(wasSaved ? `Removed "${o.title}" from saved` : `Saved "${o.title}"`);
}

function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 2400);
}

// ---------- opportunity detail modal ----------
const detailOverlay = document.getElementById("detailOverlay");
const detailContent = document.getElementById("detailContent");

function openDetail(id){
  const o = opportunities.find(x => x.id === id);
  if(!o) return;

  detailContent.innerHTML = `
    <span class="detail-type">${o.type}</span>
    <h2>${o.title}</h2>
    <p class="detail-org">${o.org}</p>
    <div class="detail-meta">
      <span class="meta-tag ${o.cost === "free" ? "free" : ""}">${o.cost === "free" ? "free" : "paid"}</span>
      <span class="meta-tag">${o.location}</span>
      <span class="meta-tag">${o.eligibility}</span>
      <span class="meta-tag deadline">due ${o.deadline}</span>
    </div>
    <p class="detail-desc">${o.description}</p>
    <div class="detail-actions">
      ${o.source_url
    ? `<a class="btn btn-primary" href="${o.source_url}" target="_blank" rel="noopener">Go to application</a>`
    : `<button class="btn btn-primary" disabled title="Application link coming soon">Application link coming soon</button>`}
      <button class="btn btn-text save-btn-2" data-id="${o.id}">${saved.has(o.id) ? "Saved" : "Save"}</button>
    </div>
  `;

  detailContent.querySelector(".save-btn-2").addEventListener("click", (e) => {
    toggleSave(e.target.dataset.id);
  });

  detailOverlay.classList.add("open");
}

document.getElementById("detailClose").addEventListener("click", () => {
  detailOverlay.classList.remove("open");
});
detailOverlay.addEventListener("click", (e) => {
  if(e.target === detailOverlay) detailOverlay.classList.remove("open");
});

// ---------- auth modal ----------
const authOverlay = document.getElementById("authOverlay");
const loginView = document.getElementById("loginView");
const signupView = document.getElementById("signupView");

function openAuthModal(view = "login"){
  loginView.style.display = view === "login" ? "block" : "none";
  signupView.style.display = view === "signup" ? "block" : "none";
  document.getElementById("loginError").classList.remove("show");
  document.getElementById("signupError").classList.remove("show");
  authOverlay.classList.add("open");
}
function closeAuthModal(){
  authOverlay.classList.remove("open");
}

document.getElementById("authClose").addEventListener("click", closeAuthModal);
authOverlay.addEventListener("click", (e) => {
  if(e.target === authOverlay) closeAuthModal();
});
document.getElementById("switchToSignup").addEventListener("click", () => openAuthModal("signup"));
document.getElementById("switchToLogin").addEventListener("click", () => openAuthModal("login"));

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorEl = document.getElementById("loginError");

  const result = await logIn(email, password);
  if(!result.success){
    errorEl.textContent = result.error;
    errorEl.classList.add("show");
    return;
  }
  closeAuthModal();
  showToast("Logged in.");
  loadOpportunities();
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const errorEl = document.getElementById("signupError");

  const result = await signUp(email, password, fullName);
  if(!result.success){
    errorEl.textContent = result.error;
    errorEl.classList.add("show");
    return;
  }
  closeAuthModal();
  showToast("Account created. Check your email to confirm, then log in.");
});

// ---------- nav auth state ----------
function renderNavAuth(){
  const navCta = document.getElementById("navCta");

  if(currentUser){
    const initial = (currentUser.user_metadata?.full_name || currentUser.email || "?")[0].toUpperCase();
    navCta.innerHTML = `
      <div class="nav-user">
        <span class="nav-user-avatar">${initial}</span>
        <span>${currentUser.user_metadata?.full_name || currentUser.email}</span>
      </div>
      <button class="btn btn-text" id="logoutBtn">Log out</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logOut();
      showToast("Logged out.");
    });
  } else {
    navCta.innerHTML = `
      <button class="btn btn-text" id="loginBtn">Log in</button>
      <button class="btn btn-primary" id="getStartedBtn">Get started</button>
    `;
    document.getElementById("loginBtn").addEventListener("click", () => openAuthModal("login"));
    document.getElementById("getStartedBtn").addEventListener("click", () => openAuthModal("signup"));
  }
}

onAuthChange((user) => {
  currentUser = user;
  renderNavAuth();
  loadOpportunities(); // refresh saved-state whenever auth changes
});

// ---------- filter bar ----------
document.getElementById("filterBar").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if(!chip) return;

  let needsRefetch = false;

  if(chip.dataset.type){
    document.querySelectorAll("#filterBar .chip[data-type]").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.type = chip.dataset.type;
    needsRefetch = true;
  } else if(chip.id === "freeToggle"){
    state.freeOnly = !state.freeOnly;
    chip.classList.toggle("active", state.freeOnly);
    needsRefetch = true;
  } else if(chip.id === "remoteToggle"){
    state.remoteOnly = !state.remoteOnly;
    chip.classList.toggle("active", state.remoteOnly);
    needsRefetch = true;
  } else if(chip.id === "savedToggle"){
    state.savedOnly = !state.savedOnly;
    chip.classList.toggle("active", state.savedOnly);
  }

  state.visibleCount = 6;
  needsRefetch ? loadOpportunities() : render();
});

document.getElementById("clearFilters").addEventListener("click", () => {
  state = { type: "all", freeOnly: false, remoteOnly: false, savedOnly: false, query: "", visibleCount: 6 };
  document.querySelectorAll("#filterBar .chip").forEach(c => c.classList.remove("active"));
  document.querySelector('#filterBar .chip[data-type="all"]').classList.add("active");
  document.getElementById("searchInput").value = "";
  loadOpportunities();
});

document.getElementById("loadMoreBtn").addEventListener("click", () => {
  state.visibleCount += 6;
  render();
});

// ---------- search ----------
document.getElementById("heroSearch").addEventListener("submit", (e) => {
  e.preventDefault();
  state.query = document.getElementById("searchInput").value.trim();
  state.visibleCount = 6;
  document.getElementById("browse").scrollIntoView({ behavior: "smooth" });
  loadOpportunities();
});

// ---------- scroll buttons ----------
document.querySelectorAll("[data-scroll]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelector(btn.dataset.scroll).scrollIntoView({ behavior: "smooth" });
  });
});

// ---------- nav toggle (mobile) ----------
const navToggle = document.getElementById("navToggle");
navToggle.addEventListener("click", () => {
  const nav = document.querySelector(".nav");
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", open);
});

// ---------- CTA at bottom of page (schools section) ----------
document.getElementById("ctaGetStarted").addEventListener("click", () => openAuthModal("signup"));

// ---------- init ----------
loadOpportunities();
initSubmissionForm();
initContactForm();
