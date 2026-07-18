const curl2Json = require("@bany/curl-to-json");

const curlStrings = [
  `curl -X POST "https://speech.googleapis.com/v1/speech:recognize?key={{API_KEY}}" \\
      -H "Content-Type: application/json" \\
      -d '{
        "config": {
          "encoding": "LINEAR16", 
          "sampleRateHertz": 16000,
          "languageCode": "en-US"
        },
        "audio": {
          "content": "{{AUDIO}}"
        }
      }'`,
      
  `curl "https://generativelanguage.googleapis.com/v1beta/models/{{MODEL}}:generateContent?key={{API_KEY}}" \\
      -H "Content-Type: application/json" \\
      -d '{
        "contents": [
          {
            "parts": [
              {
                "text": "Please transcribe this audio exactly as spoken, with no additional commentary, notes, or formatting."
              },
              {
                "inline_data": {
                  "mime_type": "audio/wav",
                  "data": "{{AUDIO}}"
                }
              }
            ]
          }
        ]
      }'`
];

for (const curl of curlStrings) {
  try {
    const json = curl2Json.default ? curl2Json.default(curl) : curl2Json(curl);
    console.log("Success:", json.url);
  } catch (e) {
    console.error("Error parsing curl:", e.message);
  }
}
