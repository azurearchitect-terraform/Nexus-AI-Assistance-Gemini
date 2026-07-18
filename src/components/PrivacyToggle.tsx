import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EyeOffIcon, EyeIcon } from "lucide-react";
import { getPlatform } from "@/lib";

export const PrivacyToggle: React.FC = () => {
  const [isProtected, setIsProtected] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (getPlatform() !== "windows") {
      setIsSupported(false);
    }
  }, []);

  const togglePrivacy = async () => {
    try {
      const newState = !isProtected;
      await invoke("set_screen_share_protection", { enable: newState });
      setIsProtected(newState);
    } catch (err) {
      console.error("Failed to toggle screen share protection:", err);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-xl">
      <div className="space-y-1">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          {isProtected ? (
            <EyeOffIcon className="w-4 h-4 text-green-500" />
          ) : (
            <EyeIcon className="w-4 h-4 text-muted-foreground" />
          )}
          Screen Share Protection
        </h3>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          Hide this application window from screen sharing tools (e.g. Zoom, Teams, OBS).
        </p>
      </div>
      <button
        onClick={togglePrivacy}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          isProtected ? "bg-primary" : "bg-muted"
        }`}
        role="switch"
        aria-checked={isProtected}
      >
        <span className="sr-only">Toggle screen share protection</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isProtected ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
};
