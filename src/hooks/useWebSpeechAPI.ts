import { useState, useCallback, useRef } from "react";

export const useWebSpeechAPI = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback((onResult: (text: string) => void) => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      console.error("Web Speech API is not supported in this browser.");
      return false;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = "en-US";

    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentText = finalTranscript || interimTranscript;
      setTranscript(currentText);
      onResult(currentText);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Web Speech API Error:", event.error);
    };

    recognitionRef.current.onend = () => {
      // Auto-restart if we are supposed to be listening (continuous fallback)
      if (isListening) {
        try {
          recognitionRef.current?.start();
        } catch (e) {}
      }
    };

    try {
      recognitionRef.current.start();
      setIsListening(true);
      return true;
    } catch (e) {
      console.error("Failed to start Web Speech API", e);
      return false;
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
  };
};
