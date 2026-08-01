/* ==========================================================
   Bridge — shared nav + auth UI
   Wires the login/signup modal, the nav's logged-in/out state,
   and the mobile nav toggle. Any page that includes the standard
   nav markup and the #authOverlay modal markup can import
   initAuthUI() and get all of this for free.

   openAuthModal is also exported at module scope (not just
   returned from initAuthUI) so other modules — like the
   opportunity submission form — can prompt a login without
   needing a reference passed down from app.js.
   ========================================================== */

import { signUp, logIn, logOut, onAuthChange } from './auth.js';

export function openAuthModal(view = "login"){
  const authOverlay = document.getElementById("authOverlay");
  const loginView = document.getElementById("loginView");
  const signupView = document.getElementById("signupView");
  if(!authOverlay) return;

  loginView.style.display = view === "login" ? "block" : "none";
  signupView.style.display = view === "signup" ? "block" : "none";
  document.getElementById("loginError")?.classList.remove("show");
  document.getElementById("signupError")?.classList.remove("show");
  authOverlay.classList.add("open");
}

function closeAuthModal(){
  document.getElementById("authOverlay")?.classList.remove("open");
}

export function initAuthUI(onUserChange = () => {}) {
  const authOverlay = document.getElementById("authOverlay");

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
    showToast(result.needsConfirmation
      ? "Check your email to confirm your account, then log in."
      : "Account created, you're logged in.");
  });

  function renderNavAuth(user){
    const navCta = document.getElementById("navCta");

    if(user){
      const initial = (user.user_metadata?.full_name || user.email || "?")[0].toUpperCase();
      navCta.innerHTML = `
        <div class="nav-user">
          <span class="nav-user-avatar">${initial}</span>
          <span>${user.user_metadata?.full_name || user.email}</span>
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
    renderNavAuth(user);
    onUserChange(user);
  });

  initNavToggle();

  return { openAuthModal };
}

function initNavToggle(){
  const navToggle = document.getElementById("navToggle");
  if(!navToggle) return;

  navToggle.addEventListener("click", () => {
    const nav = document.querySelector(".nav");
    const open = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", open);
  });
}

export function showToast(msg){
  const t = document.getElementById("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 2400);
}
