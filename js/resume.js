/* ==========================================================
   Bridge — resume.html entry point
   For now this page is just the nav/auth shell — the upload
   flow isn't built yet. Once it is, that logic goes here,
   same pattern as app.js: import a module, call an init
   function, keep this file thin.
   ========================================================== */

import { initAuthUI } from './nav-auth.js';

initAuthUI();
