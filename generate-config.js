const fs = require("fs");
const path = require("path");

const key = process.env.KAKAO_REST_API_KEY || "";

const content = `const KAKAO_REST_API_KEY = "${key}";\n`;

fs.writeFileSync(path.join(__dirname, "config.js"), content);
