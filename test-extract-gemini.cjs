const extractVariables = (curl, includeAll = false) => {
  if (typeof curl !== "string") {
    return [];
  }

  const regex = /\{\{([A-Z_]+)\}\}/g;
  const matches = curl?.match(regex) || [];
  const variables = matches
    .map((match) => {
      if (typeof match === "string") {
        return match.slice(2, -2);
      }
      return "";
    })
    .filter((v) => v !== "");

  const uniqueVariables = [...new Set(variables)];

  const doNotInclude = includeAll
    ? []
    : ["SYSTEM_PROMPT", "TEXT", "IMAGE", "AUDIO"];

  const filteredVariables = uniqueVariables?.filter(
    (variable) => !doNotInclude?.includes(variable)
  );

  return filteredVariables.map((variable) => ({
    key: variable?.toLowerCase()?.replace(/_/g, "_") || "",
    value: variable,
  }));
};

const curl = `curl "https://generativelanguage.googleapis.com/v1beta/models/{{MODEL}}:generateContent?key={{API_KEY}}" \\
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
      }'`;

console.log(extractVariables(curl));
