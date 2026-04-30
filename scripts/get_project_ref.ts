
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
if (url) {
    const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (match) console.log("PROJECT_REF=" + match[1]);
}

if (process.env.DATABASE_URL) {
    console.log("DATABASE_URL_EXISTS=true");
} else {
    console.log("DATABASE_URL_EXISTS=false");
}
