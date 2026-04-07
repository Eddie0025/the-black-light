const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    console.log("Cleaning up mock blogs...");
    const { error } = await supabase
        .from('blogs')
        .delete()
        .neq('id', 0); // Delete all rows
        
    if (error) {
        console.error("Cleanup failed:", error);
        process.exit(1);
    } else {
        console.log("Mock blogs removed successfully.");
        process.exit(0);
    }
}

cleanup();
