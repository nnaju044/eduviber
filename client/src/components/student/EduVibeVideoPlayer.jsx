import React, { useRef, useState, useEffect, useCallback } from "react";
import VideoWatermark from "./VideoWatermark.jsx";
import PlayerControls from "./PlayerControls.jsx";
import { studentApi } from "../../api/studentApi.js";

const PLAYER_JS_SCRIPT_SRC = "https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js";

/**
 * EduVibeVideoPlayer
 * Bunny Player.js engine integration wrapped in EduVibe branded canvas.
 * - Aspect ratio 16:9
 * - Unique watched-interval recording
 * - Auto-resume saved position
 * - Periodic 10-second sync + pause/visibility/unload sync
 * - Moving student identity watermark
 * - Two-device registration handling
 * - Network recovery & error retry
 */
export default React.memo(function EduVibeVideoPlayer({
  lesson,
  playbackData,
  courseId,
  onProgressSaved,
  onLessonCompleted,
}) {
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const onProgressSavedRef = useRef(onProgressSaved);
  const onLessonCompletedRef = useRef(onLessonCompleted);

  useEffect(() => {
    onProgressSavedRef.current = onProgressSaved;
    onLessonCompletedRef.current = onLessonCompleted;
  });

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasResumed, setHasResumed] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [networkError, setNetworkError] = useState(null);

  // Interval & Progress tracking references
  const watchedIntervalsRef = useRef(playbackData?.playback?.watchedIntervals || []);
  const currentIntervalStartRef = useRef(null);
  const lastSyncTimeRef = useRef(Date.now());
  const lastPositionRef = useRef(playbackData?.playback?.lastPositionSeconds || 0);
  const isSyncingRef = useRef(false);

  // 1. Ensure Player.js script is loaded once
  useEffect(() => {
    if (window.playerjs) return;

    let script = document.querySelector(`script[src="${PLAYER_JS_SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = PLAYER_JS_SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Flush current interval and save progress
  const flushProgress = useCallback(
    async (isCompleting = false) => {
      if (!courseId || !lesson?.id || isSyncingRef.current) return;

      const pos = Math.floor(lastPositionRef.current);
      const intervalsToSend = [...watchedIntervalsRef.current];

      // If active playback interval is open, close and record it
      if (currentIntervalStartRef.current !== null) {
        const start = Math.floor(currentIntervalStartRef.current);
        const end = Math.floor(lastPositionRef.current);
        if (end > start) {
          intervalsToSend.push([start, end]);
        }
        // Advance current interval start to current pos
        currentIntervalStartRef.current = lastPositionRef.current;
      }

      isSyncingRef.current = true;
      lastSyncTimeRef.current = Date.now();

      try {
        const payload = {
          position: pos,
          intervals: intervalsToSend,
          completed: Boolean(isCompleting),
        };

        const savedProgress = await studentApi.saveProgress(courseId, lesson.id, payload);

        setNetworkError(null);
        if (savedProgress) {
          watchedIntervalsRef.current = savedProgress.watchedIntervals || [];
          if (savedProgress.completed) {
            setIsCompleted(true);
            onLessonCompletedRef.current?.();
          }
          onProgressSavedRef.current?.(savedProgress);
        }
      } catch (err) {
        console.warn("[ProgressSync] Non-OK response:", err.message);
        setNetworkError("Network interrupted. Progress will retry syncing when connected.");
      } finally {
        isSyncingRef.current = false;
      }
    },
    [courseId, lesson?.id]
  );

  // 2. Initialize Player.js instance when iframe & script are available
  useEffect(() => {
    let checkInterval;
    let playerInstance = null;

    const initPlayer = () => {
      const iframe = iframeRef.current;
      if (!iframe || !window.playerjs) return false;

      try {
        playerInstance = new window.playerjs.Player(iframe);
        playerRef.current = playerInstance;

        playerInstance.on("ready", () => {
          setIsPlayerReady(true);
          // Resume saved position once
          const initialPos = playbackData?.playback?.lastPositionSeconds || 0;
          if (initialPos > 0 && !hasResumed) {
            try {
              playerInstance.setCurrentTime(initialPos);
            } catch (_) { }
            setHasResumed(true);
          }
        });

        playerInstance.on("play", () => {
          setIsPlaying(true);
          currentIntervalStartRef.current = lastPositionRef.current;
        });

        playerInstance.on("pause", () => {
          setIsPlaying(false);
          flushProgress(false);
          currentIntervalStartRef.current = null;
        });

        playerInstance.on("timeupdate", (data) => {
          let sec = 0;
          let dur = 0;
          if (typeof data === "number") {
            sec = data;
          } else if (data && typeof data === "object") {
            sec = Number(data.seconds ?? data.currentTime ?? 0);
            dur = Number(data.duration ?? 0);
          }
          if (sec >= 0) {
            setCurrentTime(sec);
            lastPositionRef.current = sec;
          }
          if (dur > 0) {
            setDuration(dur);
          }

          // Periodic sync every 10 seconds while playing
          const now = Date.now();
          if (now - lastSyncTimeRef.current >= 10000) {
            flushProgress(false);
          }
        });

        playerInstance.on("ended", () => {
          setIsPlaying(false);
          flushProgress(true);
          currentIntervalStartRef.current = null;
        });

        playerInstance.on("error", (e) => {
          console.warn("[Player.js] Playback error:", e);
        });

        return true;
      } catch (err) {
        console.error("Failed to construct Player.js:", err);
        return false;
      }
    };

    if (!initPlayer()) {
      checkInterval = setInterval(() => {
        if (initPlayer()) {
          clearInterval(checkInterval);
        }
      }, 250);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (playerRef.current) {
        try {
          flushProgress(false);
        } catch (_) { }
        playerRef.current = null;
      }
    };
  }, [playbackData?.playback?.embedUrl]);

  // Window unload / visibilitychange flush
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushProgress(false);
      }
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", () => flushProgress(false));

    return () => {
      window.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [flushProgress]);

  // Control handlers
  const handlePlay = () => {
    playerRef.current?.play();
  };

  const handlePause = () => {
    playerRef.current?.pause();
  };

  const handleSeek = (seconds) => {
    // Seeking ends current interval and starts a new one at target position
    if (currentIntervalStartRef.current !== null && seconds !== currentIntervalStartRef.current) {
      const start = Math.floor(currentIntervalStartRef.current);
      const end = Math.floor(lastPositionRef.current);
      if (end > start) {
        watchedIntervalsRef.current.push([start, end]);
      }
    }
    currentIntervalStartRef.current = seconds;
    lastPositionRef.current = seconds;
    setCurrentTime(seconds);
    playerRef.current?.setCurrentTime(seconds);
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    try {
      playerRef.current?.setPlaybackRate?.(speed);
    } catch (_) { }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    try {
      if (next) {
        playerRef.current?.mute?.();
      } else {
        playerRef.current?.unmute?.();
      }
    } catch (_) { }
  };

  const handleToggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  };

  const embedUrl = playbackData?.playback?.embedUrl;
  const watermarkText = playbackData?.watermark?.text;

  return (
    <section
      ref={containerRef}
      aria-label="EduVibe Video Player"
      className="relative w-full aspect-video bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-lg flex items-center justify-center select-none group"
    >
      {/* Bunny Embed Iframe */}
      {embedUrl ? (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={lesson?.title || "Course Video"}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          className="w-full h-full border-0 absolute inset-0"
        />
      ) : (
        <div className="text-white text-xs text-center p-4">
          No embed video available for this lesson.
        </div>
      )}

      {/* Moving Watermark (F04) */}
      <VideoWatermark watermarkText={watermarkText} />

      {/* Network Error Toast / Banner (F09) */}
      {networkError && (
        <div className="absolute top-3 inset-x-4 z-40 bg-amber-500/90 text-black text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center justify-between shadow-md">
          <span>{networkError}</span>
          <button
            type="button"
            onClick={() => flushProgress(false)}
            className="underline text-[11px] font-bold ml-2 cursor-pointer"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Lesson Completed Floating Notification (F08) */}
      {isCompleted && (
        <div className="absolute top-3 right-3 z-40 bg-emerald-600/90 text-white text-xs font-bold px-3 py-1 rounded-full border border-emerald-400 shadow-sm flex items-center gap-1.5">
          <span>✓</span>
          <span>100% Watched & Completed</span>
        </div>
      )}
    </section>
  );
});

