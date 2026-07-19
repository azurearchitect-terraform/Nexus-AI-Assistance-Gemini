import { PERSONAS, DEFAULT_SYSTEM_PROMPT } from "@/config";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getByPath } from "./common.function";

export async function routePrompt(transcript: string, openAiKey: string): Promise<string> {
  if (!transcript || transcript.trim() === "") {
    return DEFAULT_SYSTEM_PROMPT;
  }

  const personaDescriptions = PERSONAS.map(p => `- ID: ${p.id}, Name: ${p.name}, Description: ${p.description}`).join("\n");

  const routerSystemPrompt = `You are an intelligent intent router. 
Analyze the following transcript and determine the best persona to handle the response.

Available Personas:
${personaDescriptions}

Respond ONLY with a valid JSON object containing exactly one key "persona_id" with the ID of the chosen persona.
Example: {"persona_id": "azure_architect"}`;

  try {
    const response = await tauriFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: routerSystemPrompt },
          { role: "user", content: transcript }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = getByPath(data, "choices[0].message.content");
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.persona_id) {
          const matchedPersona = PERSONAS.find(p => p.id === parsed.persona_id);
          if (matchedPersona) {
            console.log(`[Router] Matched Persona: ${matchedPersona.name}`);
            return matchedPersona.systemPrompt;
          }
        }
      }
    }
  } catch (err) {
    console.error("[Router] Routing failed, falling back to default prompt", err);
  }

  return DEFAULT_SYSTEM_PROMPT;
}
