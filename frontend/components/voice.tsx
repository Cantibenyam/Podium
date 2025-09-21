/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { cn } from "@/lib/utils";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { AnimatePresence, motion } from "framer-motion";
import { Download, FileDown, Mic, Trash } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  className?: string;
  timerClassName?: string;
};

type Record = {
  id: number;
  name: string;
  file: unknown;
};

let recorder: MediaRecorder;
let recordingChunks: BlobPart[] = [];
let timerTimeout: NodeJS.Timeout;

// Utility function to pad a number with leading zeros
const padWithLeadingZeros = (num: number, length: number): string => {
  return String(num).padStart(length, "0");
};

// Utility function to download a blob
const downloadBlob = (blob: Blob) => {
  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = `Audio_${new Date().getMilliseconds()}.mp3`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
};

export const AudioRecorderWithVisualizer = ({
  className,
  timerClassName,
}: Props) => {
  // States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [, setIsRecordingFinished] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const [currentRecord, setCurrentRecord] = useState<Record>({
    id: -1,
    name: "",
    file: null,
  });
  // Calculate the hours, minutes, and seconds from the timer
  const hours = Math.floor(timer / 3600);
  const minutes = Math.floor((timer % 3600) / 60);
  const seconds = timer % 60;

  // Split the hours, minutes, and seconds into individual digits
  const [hourLeft, hourRight] = useMemo(
    () => padWithLeadingZeros(hours, 2).split(""),
    [hours]
  );
  const [minuteLeft, minuteRight] = useMemo(
    () => padWithLeadingZeros(minutes, 2).split(""),
    [minutes]
  );
  const [secondLeft, secondRight] = useMemo(
    () => padWithLeadingZeros(seconds, 2).split(""),
    [seconds]
  );
  // Refs
  const mediaRecorderRef = useRef<{
    stream: MediaStream | null;
    analyser: AnalyserNode | null;
    mediaRecorder: MediaRecorder | null;
    audioContext: AudioContext | null;
  }>({
    stream: null,
    analyser: null,
    mediaRecorder: null,
    audioContext: null,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<any>(null);
  const deepgramRef = useRef<any>(null);
  const dgOpenRef = useRef<boolean>(false);
  const transcriptSessionIdRef = useRef<number>(0);
  const [finalText, setFinalText] = useState<string>("");
  const [interimText, setInterimText] = useState<string>("");
  const transcriptRef = useRef<HTMLDivElement>(null);

  function startRecording() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          audio: true,
        })
        .then(async (stream) => {
          setIsRecording(true);
          // ============ Analyzing ============
          const AudioContext = window.AudioContext;
          const audioCtx = new AudioContext();
          const analyser = audioCtx.createAnalyser();
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          // ============ Deepgram Live WS ============
          try {
            const thisSessionId = ++transcriptSessionIdRef.current;
            const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY as
              | string
              | undefined;
            if (apiKey) {
              const deepgram = createClient(apiKey);
              const dgConn = deepgram.listen.live({
                model: "nova-3",
                smart_format: true,
                interim_results: true,
                encoding: "linear16",
                filter_channels: true,
                endpointing: 10000,
                vad_events: true,
                filler_words: true,
                language: "multi",
                sample_rate: audioCtx.sampleRate,
              });
              dgConn.on(LiveTranscriptionEvents.Open, () => {
                dgOpenRef.current = true;
              });
              dgConn.on(LiveTranscriptionEvents.Close, () => {
                dgOpenRef.current = false;
              });
              dgConn.on(LiveTranscriptionEvents.Transcript, (payload: any) => {
                if (thisSessionId !== transcriptSessionIdRef.current) return;
                const alt = payload?.channel?.alternatives?.[0];
                const text = ((alt?.transcript as string) || "").trim();
                const isFinal = Boolean((payload as any)?.is_final);
                if (!isFinal) {
                  setInterimText(text);
                } else {
                  if (text.length > 0) {
                    setFinalText((prev) => (prev ? `${prev} ${text}` : text));
                  }
                  setInterimText("");
                }
              });
              deepgramRef.current = dgConn;
            } else {
              console.warn("NEXT_PUBLIC_DEEPGRAM_API_KEY is not set");
            }
          } catch (err) {
            console.warn("Deepgram SDK init failed", err);
          }
          mediaRecorderRef.current = {
            stream,
            analyser,
            mediaRecorder: null,
            audioContext: audioCtx,
          };

          const mimeType = MediaRecorder.isTypeSupported("audio/mpeg")
            ? "audio/mpeg"
            : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/wav";

          const options = { mimeType };
          mediaRecorderRef.current.mediaRecorder = new MediaRecorder(
            stream,
            options
          );
          mediaRecorderRef.current.mediaRecorder.start();
          recordingChunks = [];
          // ============ Recording ============
          recorder = new MediaRecorder(stream);
          // Emit chunks every second so we can download without stopping
          recorder.start(1000);
          recorder.ondataavailable = (e) => {
            recordingChunks.push(e.data);
          };
          // ============ AudioWorklet (replace deprecated ScriptProcessorNode) ============
          try {
            // load worklet asynchronously without using await in non-async func
            audioCtx.audioWorklet
              .addModule("/worklets/pcm-processor.js")
              .then(() => {
                const worklet = new AudioWorkletNode(audioCtx, "pcm-processor");
                source.connect(worklet);
                const volumeSink = audioCtx.createGain();
                volumeSink.gain.value = 0;
                worklet.connect(volumeSink);
                volumeSink.connect(audioCtx.destination);
                worklet.port.onmessage = (event) => {
                  if (!deepgramRef.current || !dgOpenRef.current) return;
                  const channelData = event.data; // Float32Array
                  const ab = floatTo16BitPCM(channelData);
                  try {
                    deepgramRef.current.send(ab);
                  } catch {}
                };
              })
              .catch((err) => {
                console.warn("AudioWorklet failed to load", err);
              });
          } catch (err) {
            console.warn("AudioWorklet unavailable; falling back", err);
          }
        })
        .catch((error) => {
          alert(error);
          console.log(error);
        });
    }
  }
  function resetRecording() {
    const { mediaRecorder, stream, analyser, audioContext } =
      mediaRecorderRef.current;

    // Invalidate any in-flight transcription events
    transcriptSessionIdRef.current++;

    if (mediaRecorder) {
      mediaRecorder.onstop = () => {
        recordingChunks = [];
      };
      mediaRecorder.stop();
    } else {
      alert("recorder instance is null!");
    }

    // Close Deepgram live connection if open
    try {
      if (deepgramRef.current) {
        if (typeof deepgramRef.current.finish === "function") {
          deepgramRef.current.finish();
        }
        if (typeof deepgramRef.current.close === "function") {
          deepgramRef.current.close();
        }
      }
    } catch {
      // ignore
    } finally {
      deepgramRef.current = null;
      dgOpenRef.current = false;
    }

    // Stop the web audio context and the analyser node
    if (analyser) {
      analyser.disconnect();
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (audioContext) {
      audioContext.close();
    }
    setIsRecording(false);
    setIsRecordingFinished(true);
    setTimer(0);
    clearTimeout(timerTimeout);

    // Clear the animation frame and canvas
    cancelAnimationFrame(animationRef.current || 0);
    const canvas = canvasRef.current;
    if (canvas) {
      const canvasCtx = canvas.getContext("2d");
      if (canvasCtx) {
        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;
        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      }
    }

    // Revoke any existing audio object URL and clear current record
    try {
      if (typeof currentRecord.file === "string") {
        URL.revokeObjectURL(currentRecord.file as string);
      }
    } catch {
      // ignore
    }
    setCurrentRecord({ id: -1, name: "", file: null });

    // Clear transcript text
    setFinalText("");
    setInterimText("");
  }
  const downloadCurrentAudio = () => {
    try {
      if (recordingChunks.length > 0) {
        const recordBlob = new Blob(recordingChunks, { type: "audio/wav" });
        downloadBlob(recordBlob);
      } else if (typeof currentRecord.file === "string") {
        const a = document.createElement("a");
        a.href = currentRecord.file as string;
        a.download = `Audio_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {}
  };

  // Convert Float32 PCM to 16-bit little-endian PCM ArrayBuffer
  function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
    }
    return buffer;
  }

  // Effect to update the timer every second
  useEffect(() => {
    if (isRecording) {
      timerTimeout = setTimeout(() => {
        setTimer(timer + 1);
      }, 1000);
    }
    return () => clearTimeout(timerTimeout);
  }, [isRecording, timer]);

  // Visualizer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const drawWaveform = (dataArray: Uint8Array) => {
      if (!canvasCtx) return;
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.fillStyle = "#939393";

      const barWidth = 1;
      const spacing = 1;
      const maxBarHeight = HEIGHT / 2.5;
      const numBars = Math.floor(WIDTH / (barWidth + spacing));

      for (let i = 0; i < numBars; i++) {
        const barHeight = Math.pow(dataArray[i] / 128.0, 8) * maxBarHeight;
        const x = (barWidth + spacing) * i;
        const y = HEIGHT / 2 - barHeight / 2;
        canvasCtx.fillRect(x, y, barWidth, barHeight);
      }
    };

    const visualizeVolume = () => {
      if (
        !mediaRecorderRef.current?.stream?.getAudioTracks()[0]?.getSettings()
          .sampleRate
      )
        return;
      const bufferLength =
        (mediaRecorderRef.current?.stream?.getAudioTracks()[0]?.getSettings()
          .sampleRate as number) / 100;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!isRecording) {
          cancelAnimationFrame(animationRef.current || 0);
          return;
        }
        animationRef.current = requestAnimationFrame(draw);
        mediaRecorderRef.current?.analyser?.getByteTimeDomainData(dataArray);
        drawWaveform(dataArray);
      };

      draw();
    };

    if (isRecording) {
      visualizeVolume();
    } else {
      cancelAnimationFrame(animationRef.current || 0);
    }

    return () => {
      cancelAnimationFrame(animationRef.current || 0);
    };
  }, [isRecording]);

  // Auto-follow transcript scroll (horizontal)
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [finalText, interimText]);

  function downloadTranscript() {
    const text = `${finalText} ${interimText}`.trim();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transcript_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className={cn("w-full relative", className)}>
      <AnimatePresence>
        {!isRecording ? (
          <motion.div
            className="absolute inset-0 z-10 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.button
              onClick={() => startRecording()}
              className="inline-flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full border bg-card text-card-foreground shadow-lg"
              aria-label="Start recording"
              title="Start recording"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Mic size={22} />
            </motion.button>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="w-full grid grid-cols-[auto_1fr] items-center gap-2">
        <div className="flex gap-2">
          {isRecording ? (
            <button
              onClick={resetRecording}
              className="inline-flex h-12 w-12 items-center justify-center rounded-md border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Reset recording"
              title="Reset recording"
            >
              <Trash size={16} />
            </button>
          ) : null}

          {isRecording ? (
            <button
              onClick={downloadCurrentAudio}
              className="inline-flex h-12 w-12 items-center justify-center rounded-md border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Download audio"
              title="Download audio"
            >
              <Download size={16} />
            </button>
          ) : null}
        </div>

        <motion.div
          className={cn(
            "flex items-center gap-2",
            !isRecording && "pointer-events-none"
          )}
          initial={false}
          animate={{ opacity: isRecording ? 1 : 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {isRecording ? (
            <Timer
              hourLeft={hourLeft}
              hourRight={hourRight}
              minuteLeft={minuteLeft}
              minuteRight={minuteRight}
              secondLeft={secondLeft}
              secondRight={secondRight}
              timerClassName={cn("h-12", timerClassName)}
            />
          ) : null}
          <canvas
            ref={canvasRef}
            className="h-12 w-full bg-background border rounded-md"
          />
        </motion.div>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <motion.div
          ref={transcriptRef as any}
          className={cn(
            "rounded-md border bg-background text-lg leading-relaxed text-foreground h-12 w-full overflow-x-auto overflow-y-hidden flex items-center px-3",
            !isRecording && "pointer-events-none"
          )}
          initial={false}
          animate={{ opacity: isRecording ? 1 : 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <span className="whitespace-nowrap">{finalText} </span>
          <span className="opacity-60 whitespace-nowrap">{interimText}</span>
        </motion.div>
        {isRecording ? (
          <motion.button
            onClick={downloadTranscript}
            className="inline-flex h-12 w-12 items-center justify-center rounded-md border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Download transcript"
            title="Download transcript"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <FileDown size={16} />
          </motion.button>
        ) : null}
      </div>
    </div>
  );
};

const Timer = React.memo(
  ({
    hourLeft,
    hourRight,
    minuteLeft,
    minuteRight,
    secondLeft,
    secondRight,
    timerClassName,
  }: {
    hourLeft: string;
    hourRight: string;
    minuteLeft: string;
    minuteRight: string;
    secondLeft: string;
    secondRight: string;
    timerClassName?: string;
  }) => {
    return (
      <div
        className={cn(
          "items-center justify-center gap-0.5 border p-1.5 rounded-md font-mono font-medium text-foreground flex",
          timerClassName
        )}
      >
        <span className="rounded-md bg-background p-0.5 text-foreground">
          {hourLeft}
        </span>
        <span className="rounded-md bg-background p-0.5 text-foreground">
          {hourRight}
        </span>
        <span>:</span>
        <span className="rounded-md bg-background p-0.5 text-foreground">
          {minuteLeft}
        </span>
        <span className="rounded-md bg-background p-0.5 text-foreground">
          {minuteRight}
        </span>
        <span>:</span>
        <span className="rounded-md bg-background p-0.5 text-foreground">
          {secondLeft}
        </span>
        <span className="rounded-md bg-background p-0.5 text-foreground ">
          {secondRight}
        </span>
      </div>
    );
  }
);
Timer.displayName = "Timer";
