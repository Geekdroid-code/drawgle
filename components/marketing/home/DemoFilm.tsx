"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

export const PLAY_DEMO_EVENT = "drawgle:play-demo";

const FILM_SRC = "/media/drawgle-launch-film.mp4";
const FILM_POSTER = "/media/drawgle-launch-film-poster.webp";
const FILM_DURATION = 58;

/** Story beats in the launch film, used as seekable chapters. */
const CHAPTERS = [
  { label: "Describe", at: 0 },
  { label: "Plan", at: 8.5 },
  { label: "Generate", at: 13 },
  { label: "Tokens", at: 16.5 },
  { label: "Edit", at: 24.5 },
  { label: "Hand off", at: 32.5 },
];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest < 10 ? "0" : ""}${rest}`;
}

/** The launch film, in a quiet player that matches the page. */
export function DemoFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(FILM_DURATION);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void video
      .play()
      .then(() => {
        setIsPlaying(true);
        setHasStarted(true);
      })
      .catch(() => {
        // Autoplay with sound can be refused; fall back to muted playback.
        video.muted = true;
        setIsMuted(true);
        void video.play().then(() => {
          setIsPlaying(true);
          setHasStarted(true);
        }).catch(() => undefined);
      });
  }, []);

  const seekTo = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setCurrentTime(seconds);
    play();
  };

  const activeChapter = hasStarted
    ? CHAPTERS.reduce((current, chapter, index) => (currentTime >= chapter.at ? index : current), 0)
    : -1;

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      play();
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [play]);

  const revealControls = () => {
    setShowControls(true);
    if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    if (isPlaying) {
      hideTimeoutRef.current = window.setTimeout(() => setShowControls(false), 2500);
    }
  };

  useEffect(() => {
    const onPlayRequest = () => play();
    window.addEventListener(PLAY_DEMO_EVENT, onPlayRequest);
    return () => window.removeEventListener(PLAY_DEMO_EVENT, onPlayRequest);
  }, [play]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const handleSeek = (event: MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || duration === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    video.currentTime = ratio * duration;
    setCurrentTime(video.currentTime);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen().catch(() => undefined);
    } else {
      void document.exitFullscreen().catch(() => undefined);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mk-surface rounded-[30px] p-1.5 sm:rounded-[36px] sm:p-2">
      <div
        id="demo-player"
        ref={containerRef}
        onMouseMove={revealControls}
        onMouseLeave={() => {
          if (isPlaying) setShowControls(false);
        }}
        className={cn(
          "group relative aspect-video w-full scroll-mt-28 overflow-hidden rounded-[24px] bg-neutral-100 ring-1 ring-black/[0.06] sm:rounded-[28px]",
          isFullscreen && "rounded-none ring-0",
        )}
      >
        <video
          ref={videoRef}
          src={FILM_SRC}
          poster={FILM_POSTER}
          playsInline
          preload="metadata"
          onClick={togglePlay}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || FILM_DURATION)}
          onEnded={() => {
            setIsPlaying(false);
            setShowControls(true);
          }}
          onVolumeChange={() => setIsMuted(Boolean(videoRef.current?.muted))}
          className="h-full w-full cursor-pointer bg-black object-cover"
          aria-label="Drawgle launch film: describe an app, plan it, generate screens, change tokens, edit elements, and hand off to a coding agent"
        />

        <AnimatePresence>
          {!isPlaying ? (
            <motion.button
              type="button"
              key="play-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={togglePlay}
              aria-label={hasStarted ? "Resume film" : "Play the Drawgle launch film"}
              className="absolute inset-0 flex items-center justify-center bg-black/20"
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-lg transition-transform group-hover:scale-105 group-active:scale-95 sm:size-20">
                <Play className="ml-1 size-7 fill-neutral-800 sm:size-8" />
              </span>
              {!hasStarted ? (
                <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur sm:left-5 sm:top-5 sm:text-xs">
                  Launch film · 0:58
                </span>
              ) : null}
            </motion.button>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {hasStarted && showControls ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 py-3 sm:px-6 sm:py-4"
            >
              <div
                onClick={handleSeek}
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(currentTime)}
                tabIndex={0}
                onKeyDown={(event) => {
                  const video = videoRef.current;
                  if (!video) return;
                  if (event.key === "ArrowRight") video.currentTime = Math.min(duration, video.currentTime + 5);
                  if (event.key === "ArrowLeft") video.currentTime = Math.max(0, video.currentTime - 5);
                }}
                className="group/bar relative h-1.5 w-full cursor-pointer rounded-full bg-white/25 transition-all hover:h-2.5"
              >
                <div style={{ width: `${progress}%` }} className="relative h-full rounded-full bg-white">
                  <div className="absolute right-0 top-1/2 size-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/bar:opacity-100" />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-3 sm:gap-4">
                  <button type="button" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"} className="p-1 text-white/90 transition-colors hover:text-white">
                    {isPlaying ? <Pause className="size-4 fill-current sm:size-5" /> : <Play className="size-4 fill-current sm:size-5" />}
                  </button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={toggleMute} aria-label={isMuted ? "Unmute" : "Mute"} className="p-1 text-white/80 transition-colors hover:text-white">
                      {isMuted || volume === 0 ? <VolumeX className="size-4 sm:size-5" /> : <Volume2 className="size-4 sm:size-5" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(event) => {
                        const video = videoRef.current;
                        const next = Number.parseFloat(event.target.value);
                        if (!video) return;
                        video.volume = next;
                        video.muted = next === 0;
                        setVolume(next);
                        setIsMuted(next === 0);
                      }}
                      className="hidden h-1 w-14 cursor-pointer rounded-full accent-white sm:block sm:w-20"
                      aria-label="Volume"
                    />
                  </div>
                  <span className="select-none font-mono text-[11px] text-white/80 sm:text-xs">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  className="p-1 text-white/80 transition-colors hover:text-white"
                >
                  {isFullscreen ? <Minimize className="size-4 sm:size-5" /> : <Maximize className="size-4 sm:size-5" />}
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <nav aria-label="Film chapters" className="mk-hide-scrollbar flex items-center gap-1 overflow-x-auto px-1 pb-0.5 pt-2 sm:justify-center sm:pt-2.5">
        {CHAPTERS.map((chapter, index) => (
          <button
            key={chapter.label}
            type="button"
            onClick={() => seekTo(chapter.at)}
            aria-current={index === activeChapter ? "true" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              index === activeChapter ? "bg-white text-mk-ink ring-1 ring-black/[0.06]" : "text-neutral-500 hover:text-mk-ink",
            )}
          >
            <span className="font-mono text-[10px] font-medium text-neutral-400">{formatTime(chapter.at)}</span>
            {chapter.label}
          </button>
        ))}
      </nav>
    </div>
  );
}