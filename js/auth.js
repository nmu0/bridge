/* ==========================================================
   Bridge — auth
   Thin wrapper around Supabase auth. app.js/resume.js call
   these and react to the returned { success, error } shape;
   they never talk to `supabase` directly.
   ========================================================== */

import { supabase } from './supabase-client.js';

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) return { success: false, error: error.message };
  return { success: true, user: data.user };
}

export async function logIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { success: false, error: error.message };
  return { success: true, user: data.user };
}

export async function logOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Returns the current user (or null if logged out).
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Registers a callback that fires immediately with the current
 * auth state, then again on every login/logout. Use this to
 * keep nav UI in sync instead of polling.
 *
 * Uses getSession() (reads the persisted local token, instant,
 * no network round trip) rather than getUser() (which re-verifies
 * against Supabase's servers) so the nav paints the correct
 * logged-in/out state immediately on page load instead of
 * flashing "logged out" while a network call is in flight.
 */
export function onAuthChange(callback) {
  supabase.auth.getSession().then(({ data: { session } }) => callback(session?.user ?? null));
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ? session.user : null);
  });
}
