const supabaseUrl = 'https://nxfydodctuvgkgbidfbx.supabase.co';
const supabaseKey = 'sb_publishable_Cw6InfjEKF3jLJnc-qGa-Q_uhQu9i9O';
// Overwrite the global 'supabase' library object with the active client instance
window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
