/* ==========================================================
   Bridge — API layer
   Wraps all Supabase calls. app.js should only ever talk to
   this file, never to `supabase` directly — keeps the swap
   from demo data to real data (already done) and any future
   backend change contained to one place.
   ========================================================== */

import { supabase } from './supabase-client.js';

/**
 * Fetch approved opportunities, optionally filtered.
 * Mirrors the shape of the old hardcoded OPPORTUNITIES array,
 * so app.js's cardHTML()/matches() logic barely has to change.
 *
 * @param {Object} filters
 * @param {string} [filters.type]      - 'internship' | 'scholarship' | ... | 'all'
 * @param {boolean} [filters.freeOnly]
 * @param {boolean} [filters.remoteOnly]
 * @param {string} [filters.query]     - free-text search across title/org/eligibility/location
 * @returns {Promise<Array>}
 */
export async function getOpportunities(filters = {}) {
  let request = supabase
    .from('opportunities')
    .select('*')
    .eq('status', 'approved')
    .order('deadline', { ascending: true, nullsFirst: false });

  if (filters.type && filters.type !== 'all') {
    request = request.eq('type', filters.type);
  }
  if (filters.freeOnly) {
    request = request.eq('cost', 'free');
  }
  if (filters.remoteOnly) {
    request = request.eq('remote', true);
  }
  if (filters.query) {
    // Search across a few text columns. Postgres ILIKE = case-insensitive LIKE.
    const q = `%${filters.query}%`;
    request = request.or(
      `title.ilike.${q},org.ilike.${q},eligibility.ilike.${q},location.ilike.${q}`
    );
  }

  const { data, error } = await request;

  if (error) {
    console.error('getOpportunities failed:', error);
    return [];
  }

  // Normalize deadline display: use deadline_label if set (e.g. "Rolling"),
  // otherwise format the real date. Keeps app.js's o.deadline usage simple.
  return data.map((o) => ({
    ...o,
    deadline: o.deadline_label || formatDate(o.deadline),
  }));
}

/**
 * Get the current logged-in user's saved opportunity IDs.
 * Returns an empty array if logged out.
 */
export async function getSavedIds() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('saved_opportunities')
    .select('opportunity_id')
    .eq('user_id', user.id);

  if (error) {
    console.error('getSavedIds failed:', error);
    return [];
  }
  return data.map((row) => row.opportunity_id);
}

/**
 * Save an opportunity for the current user. Requires login.
 * Returns true on success, false otherwise (e.g. not logged in).
 */
export async function saveOpportunity(opportunityId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('saveOpportunity: no user logged in');
    return false;
  }

  const { error } = await supabase
    .from('saved_opportunities')
    .insert({ user_id: user.id, opportunity_id: opportunityId });

  if (error) {
    console.error('saveOpportunity failed:', error);
    return false;
  }
  return true;
}

/**
 * Remove a saved opportunity for the current user.
 */
export async function unsaveOpportunity(opportunityId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('saved_opportunities')
    .delete()
    .eq('user_id', user.id)
    .eq('opportunity_id', opportunityId);

  if (error) {
    console.error('unsaveOpportunity failed:', error);
    return false;
  }
  return true;
}

/**
 * Submit a new opportunity for review. Requires login.
 * Goes in with status='pending' — see schema.sql RLS policies.
 */
export async function submitOpportunity(opportunity) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('submitOpportunity: no user logged in');
    return { success: false, error: 'not_logged_in' };
  }

  const { data, error } = await supabase
    .from('opportunities')
    .insert({ ...opportunity, submitted_by: user.id, status: 'pending' })
    .select()
    .single();

  if (error) {
    console.error('submitOpportunity failed:', error);
    return { success: false, error: error.message };
  }
  return { success: true, opportunity: data };
}

export function formatDate(dateStr) {
  if (!dateStr) return 'Rolling';
  const d = new Date(dateStr + 'T00:00:00'); // avoid timezone-shift-by-a-day bug
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export async function isAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('isAdmin check failed:', error);
    return false;
  }
  return data?.role === 'admin';
}

export async function getPendingOpportunities() {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getPendingOpportunities failed:', error);
    return [];
  }
  return data.map((o) => ({
    ...o,
    deadline: o.deadline_label || formatDate(o.deadline),
  }));
}

export async function setOpportunityStatus(id, status) {
  const { error } = await supabase
    .from('opportunities')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('setOpportunityStatus failed:', error);
    return false;
  }
  return true;
}
