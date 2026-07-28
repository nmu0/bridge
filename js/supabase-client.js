/* ==========================================================
   Bridge — Supabase client
   Single shared client instance, imported by api.js and auth.js.

   Requires @supabase/supabase-js:
     npm install @supabase/supabase-js

   Requires SUPABASE_URL and SUPABASE_ANON_KEY to be exposed to
   the bundle. If your webpack.common.js doesn't already do this,
   add (using the built-in webpack.DefinePlugin, no extra package
   needed):

     const webpack = require('webpack');
     require('dotenv').config(); // npm install dotenv

     plugins: [
       new webpack.DefinePlugin({
         'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
         'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
       }),
     ]

   The anon key is safe to ship to the browser — it's a public,
   restricted key. Row Level Security (see schema.sql) is what
   actually protects your data, not keeping this key secret.
   ========================================================== */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY. Check your .env file and that ' +
    'webpack.common.js is passing them through via DefinePlugin.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
