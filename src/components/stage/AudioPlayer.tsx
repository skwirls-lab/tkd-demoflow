"use client";

import { useEffect, useRef, useState } from "react";

export interface SeekRequest {
  time: number;
  id: number;
}

interface AudioPlayerProps {
  url: string;
  isPlaying: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  // A new `id` (use Date.now()) triggers a seek, even to the same time. If the track is still
  // loading (e.g. the segment switched to a different song), the seek is
  // applied as soon as its metadata arrives.
  seekRequest?: SeekRequest | null;
  label?: string;
}

const formatTime = (time: number) => {
  if (!isFinite(time) || time < 0) time = 0;
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function AudioPlayer({
  url,
  isPlaying,
  onTimeUpdate,
  onEnded,
  seekRequest,
  label,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      // When url changes, the audio element loads it and resets to paused,
      // so play() has to be called again.
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying, url]);

  useEffect(() => {
    setDuration(0);
    setCurrentTime(0);
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!seekRequest || !audio) return;
    // Seek requests are one-off commands (id = Date.now()). Ignore an old one
    // left over from before this player mounted for a different track.
    if (Date.now() - seekRequest.id > 1000) return;
    if (audio.readyState >= 1) {
      audio.currentTime = seekRequest.time;
      setCurrentTime(seekRequest.time);
    } else {
      pendingSeekRef.current = seekRequest.time;
    }
  }, [seekRequest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration);
    if (pendingSeekRef.current !== null) {
      audio.currentTime = pendingSeekRef.current;
      setCurrentTime(pendingSeekRef.current);
      pendingSeekRef.current = null;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  const seekBy = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + delta));
  };

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
      />

      {label && (
        <p className="text-[11px] font-black text-belt-white/50 uppercase tracking-widest truncate">
          ♪ {label}
        </p>
      )}

      <div className="space-y-1">
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={currentTime}
          onChange={(e) => {
            const time = parseFloat(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = time;
            setCurrentTime(time);
          }}
          className="w-full h-2 bg-belt-gray rounded-lg appearance-none cursor-pointer accent-belt-red"
          aria-label="Music position"
        />
        <div className="flex justify-between text-xs font-mono text-belt-white/40">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => seekBy(-5)}
          className="h-11 px-3 rounded-lg bg-belt-gray/50 hover:bg-belt-gray text-xs font-black text-belt-white active:scale-95"
          aria-label="Back 5 seconds"
        >
          −5s
        </button>
        <button
          onClick={() => seekBy(5)}
          className="h-11 px-3 rounded-lg bg-belt-gray/50 hover:bg-belt-gray text-xs font-black text-belt-white active:scale-95"
          aria-label="Forward 5 seconds"
        >
          +5s
        </button>
        <span className="text-base opacity-40 ml-auto" aria-hidden>🔈</span>
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
          className="w-24 md:w-32 h-1 bg-belt-gray rounded-lg appearance-none cursor-pointer accent-belt-gold"
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
