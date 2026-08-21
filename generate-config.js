const fs = require("fs");
const path = require("path");

const key = process.env.KAKAO_REST_API_KEY || "";
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

const content =
  `const KAKAO_REST_API_KEY = "${key}";\n` +
  `const SUPABASE_URL = "${supabaseUrl}";\n` +
  `const SUPABASE_ANON_KEY = "${supabaseAnonKey}";\n`;

fs.writeFileSync(path.join(__dirname, "config.js"), content);
