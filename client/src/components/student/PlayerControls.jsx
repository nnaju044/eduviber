import React from "react";

/**
 * PlayerControls
 * Branded player overlay controls:
 * Play/Pause, Timeline/Scrubber, Current/Duration Time, Speed (0.5x-2x), Volume/Mute, Fullscreen.
 * Minimal white controls, EduVibe gold accents (#CA8A04), touch-friendly.
 */
export default function PlayerControls({
  isPlaying,
  currentTime = 0,
  duration = 0,
  playbackSpeed = 1,
  isMuted = false,
  isFullscreen = false,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
  onToggleMute,
  onToggleFullscreen,
}) {
  const formatTime = (secs) => {
    const s = Math.floor(secs || 0);
    const m = Math.floor(s / 60);
    const remainingSeconds = s % 60;
    return `${m}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 p-2 sm:p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col gap-1.5 text-white transition-opacity duration-300">
      {/* Timeline scrubber */}
      <div className="flex items-center gap-2 group/timeline">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime || 0}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Seek video position"
          className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#CA8A04] hover:h-1.5 transition-all"
        />
      </div>

      <div className="flex items-center justify-between text-xs pt-1">
        {/* Left: Play/Pause, Times, Volume */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? "Pause video" : "Play video"}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>

          <span className="font-mono text-[11px] text-neutral-300 select-none">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="p-1 hover:text-[#CA8A04] text-neutral-300 transition-colors cursor-pointer"
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
        </div>

        {/* Right: Speed, Fullscreen */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-black/40 rounded px-1.5 py-0.5 border border-white/10">
            <span className="text-[10px] text-neutral-400">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              aria-label="Playback speed"
              className="bg-transparent text-[11px] font-bold text-[#CA8A04] outline-none cursor-pointer"
            >
              {speeds.map((s) => (
                <option key={s} value={s} className="bg-neutral-900 text-white">
                  {s}×
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="p-1 hover:text-[#CA8A04] text-neutral-300 transition-colors cursor-pointer"
          >
            {isFullscreen ? "🗗" : "⛶"}
          </button>
        </div>
      </div>
    </div>
  );
}

