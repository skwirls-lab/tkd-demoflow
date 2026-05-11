"use client";

import { useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  url: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  isPlaying: boolean;
  onTogglePlay: (playing: boolean) => void;
  seekTo?: number;
}

export default function AudioPlayer({
  url,
  onTimeUpdate,
  onEnded,
  isPlaying,
  onTogglePlay,
  seekTo,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (audioRef.current && !analyserRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      analyser.fftSize = 256;
      analyserRef.current = analyser;
    }
  }, []);

  useEffect(() => {
    if (isPlaying && analyserRef.current) {
      draw();
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, [isPlaying]);

  const draw = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      animationRef.current = requestAnimationFrame(renderFrame);
      analyserRef.current!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        
        // Gradient color based on intensity
        const opacity = (dataArray[i] / 255) * 0.5 + 0.1;
        ctx.fillStyle = `rgba(220, 38, 38, ${opacity})`; // belt-red
        
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    renderFrame();
  };

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (seekTo !== undefined && audioRef.current) {
      audioRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
    }
  }, [seekTo]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="card bg-belt-dark/80 backdrop-blur-md border-belt-gray/50 shadow-2xl p-6 relative overflow-hidden">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
        crossOrigin="anonymous"
      />

      {/* Background Visualizer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        width={400}
        height={150}
      />

      <div className="flex flex-col gap-6 relative z-10">
        {/* Progress Bar */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-belt-gray rounded-lg appearance-none cursor-pointer accent-belt-red"
          />
          <div className="flex justify-between text-xs font-mono text-belt-white/40">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime -= 5;
            }}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-belt-gray/30 hover:bg-belt-gray/50 text-belt-white transition-all active:scale-95"
            title="Backward 5s"
          >
            <span className="text-xl">⏪</span>
          </button>

          <button
            onClick={() => onTogglePlay(!isPlaying)}
            className={`w-20 h-20 flex items-center justify-center rounded-full transition-all active:scale-90 shadow-lg ${
              isPlaying
                ? "bg-belt-white text-belt-black shadow-belt-white/10"
                : "bg-belt-red text-white shadow-belt-red/20"
            }`}
          >
            {isPlaying ? (
              <span className="text-3xl">⏸️</span>
            ) : (
              <span className="text-3xl ml-1">▶️</span>
            )}
          </button>

          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime += 5;
            }}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-belt-gray/30 hover:bg-belt-gray/50 text-belt-white transition-all active:scale-95"
            title="Forward 5s"
          >
            <span className="text-xl">⏩</span>
          </button>
        </div>

        {/* Volume & Extras */}
        <div className="flex items-center gap-4 px-4">
          <span className="text-lg opacity-40">🔈</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
            className="flex-1 h-1 bg-belt-gray rounded-lg appearance-none cursor-pointer accent-belt-gold"
          />
          <span className="text-lg opacity-40">🔊</span>
        </div>
      </div>
    </div>
  );
}
