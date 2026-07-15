import { fetchSTT } from "@/lib";
import { UseCompletionReturn } from "@/types";
import { LoaderCircleIcon, MicIcon, MicOffIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components";
import { useApp } from "@/contexts";
import { shouldUsePluelyAPI } from "@/lib/functions/pluely.api";

interface AutoSpeechVADProps {
  submit: UseCompletionReturn["submit"];
  setState: UseCompletionReturn["setState"];
  setEnableVAD: UseCompletionReturn["setEnableVAD"];
  microphoneDeviceId?: string;
}

/**
 * Push-to-talk audio recorder.
 * Replaces the WASM-based VAD which caused app freezes due to loading
 * a 2MB ONNX neural network model via WebAssembly workers at runtime.
 *
 * Usage: Click once to START recording, click again to STOP and transcribe.
 */
const AutoSpeechVADInternal = ({
  submit,
  setState,
  setEnableVAD,
  microphoneDeviceId,
}: AutoSpeechVADProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { selectedSttProvider, allSttProviders } = useApp();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    // Stop the recorder — this triggers onstop which does the transcription
    recorder.stop();

    // Also stop all mic tracks to release the mic indicator
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setIsRecording(false);
    setEnableVAD(false);
  }, [setEnableVAD]);

  const startRecording = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
          ...(microphoneDeviceId && microphoneDeviceId !== "default"
            ? { deviceId: { ideal: microphoneDeviceId } }
            : {}),
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      chunksRef.current = [];

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];

        // If no audio was captured at all
        if (audioBlob.size === 0) {
          setState((prev: any) => ({
            ...prev,
            error: "No audio captured. Please ensure your microphone is working.",
          }));
          return;
        }

        const usePluelyAPI = await shouldUsePluelyAPI();

        if (!selectedSttProvider.provider && !usePluelyAPI) {
          setState((prev: any) => ({
            ...prev,
            error: "No speech provider selected. Please select one in settings.",
          }));
          return;
        }

        const providerConfig = allSttProviders.find(
          (p) => p.id === selectedSttProvider.provider
        );

        if (!providerConfig && !usePluelyAPI) {
          setState((prev: any) => ({
            ...prev,
            error: "Speech provider configuration not found. Please check settings.",
          }));
          return;
        }

        try {
          setIsTranscribing(true);
          const transcription = await fetchSTT({
            provider: usePluelyAPI ? undefined : providerConfig,
            selectedProvider: selectedSttProvider,
            audio: audioBlob,
          });

          if (transcription && transcription.trim().length > 0) {
            submit(transcription);
          } else {
             setState((prev: any) => ({
              ...prev,
              error: "Transcription returned empty text. Could not hear clearly.",
            }));
          }
        } catch (err) {
          console.error("Transcription failed:", err);
          setState((prev: any) => ({
            ...prev,
            error: err instanceof Error ? err.message : "Transcription failed",
          }));
        } finally {
          setIsTranscribing(false);
        }
      };

      // Use a timeslice of 200ms to ensure chunks are pushed regularly
      recorder.start(200);
      setIsRecording(true);
      setEnableVAD(true);
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      const isNotAllowed =
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError" ||
        err?.message?.includes("Permission denied");

      setState((prev: any) => ({
        ...prev,
        error: isNotAllowed
          ? "Microphone permission denied. On Windows: go to Settings → Privacy & Security → Microphone → enable access for desktop apps, then restart the app."
          : `Could not access microphone: ${err?.message || err}`,
      }));
    }
  }, [
    microphoneDeviceId,
    selectedSttProvider,
    allSttProviders,
    submit,
    setState,
    setEnableVAD,
  ]);

  const handleClick = useCallback(async () => {
    if (isRecording) {
      await stopAndTranscribe();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopAndTranscribe]);

  return (
    <>
      <Button
        size="icon"
        onClick={handleClick}
        disabled={isTranscribing}
        className={`cursor-pointer transition-colors ${
          isRecording ? "text-red-500 hover:text-red-600" : ""
        }`}
        title={
          isTranscribing
            ? "Transcribing..."
            : isRecording
            ? "Click to stop recording"
            : "Click to start recording"
        }
      >
        {isTranscribing ? (
          <LoaderCircleIcon className="h-4 w-4 animate-spin text-green-500" />
        ) : isRecording ? (
          <MicOffIcon className="h-4 w-4 animate-pulse text-red-500" />
        ) : (
          <MicIcon className="h-4 w-4" />
        )}
      </Button>
    </>
  );
};

export const AutoSpeechVAD = (props: AutoSpeechVADProps) => {
  return <AutoSpeechVADInternal key={props.microphoneDeviceId} {...props} />;
};
