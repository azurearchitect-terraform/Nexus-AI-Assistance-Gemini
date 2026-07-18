import { useState, useEffect, useCallback } from "react";
import { KeywordTrigger, DEFAULT_KEYWORD_TRIGGERS } from "@/types/keywords";
import { safeLocalStorage } from "@/lib";

// Define a new storage key inline or import from constants
const KEYWORD_TRIGGERS_KEY = "nexus_keyword_triggers";

export function useKeywordScanner(transcript: string) {
  const [triggers, setTriggers] = useState<KeywordTrigger[]>(DEFAULT_KEYWORD_TRIGGERS);
  const [activeTrigger, setActiveTrigger] = useState<KeywordTrigger | null>(null);

  // Load triggers from storage
  useEffect(() => {
    const saved = safeLocalStorage.getItem(KEYWORD_TRIGGERS_KEY);
    if (saved) {
      try {
        setTriggers(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse keyword triggers", e);
      }
    }
  }, []);

  // Save triggers to storage
  const saveTriggers = useCallback((newTriggers: KeywordTrigger[]) => {
    setTriggers(newTriggers);
    safeLocalStorage.setItem(KEYWORD_TRIGGERS_KEY, JSON.stringify(newTriggers));
  }, []);

  // Scan transcript for keywords
  useEffect(() => {
    if (!transcript) return;
    
    // Check the last 100 characters of the transcript for performance and recency
    const recentTranscript = transcript.slice(-100).toLowerCase();
    
    for (const trigger of triggers) {
      if (recentTranscript.includes(trigger.keyword.toLowerCase())) {
        setActiveTrigger(trigger);
        
        // Clear the trigger after 3 seconds
        const timer = setTimeout(() => {
          setActiveTrigger(null);
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [transcript, triggers]);

  return {
    triggers,
    saveTriggers,
    activeTrigger,
  };
}
