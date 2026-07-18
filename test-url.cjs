const curl2Json = require("@bany/curl-to-json");

const curlStr = `curl "https://generativelanguage.googleapis.com/v1beta/models/{{MODEL}}:generateContent?key={{API_KEY}}" \
  -H "Content-Type: application/json" \
  -d '{}'`;

const curlJson = curl2Json.default ? curl2Json.default(curlStr) : curl2Json(curlStr);
console.log("CURL JSON PARAMS:", curlJson.params);
