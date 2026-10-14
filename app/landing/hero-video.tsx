"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export function HeroVideo({
  poster = "/material_landing/quento_cancha1.jpg",
  src = "/material_landing/quento_videoweb.mp4",
}: {
  poster?: string;
  src?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");

      // Forzar carga y reproducción inmediata
      video.load();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Si por alguna razón el navegador espera interacción
        });
      }
    }
  }, [src]);

  const toggleSound = () => {
    const video = videoRef.current;
    if (video) {
      const nextMuted = !video.muted;
      video.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={poster}
        className="h-full w-full object-cover"
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* Botón flotante para activar/silenciar sonido */}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={isMuted ? "Activar sonido del video" : "Silenciar video"}
        className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-all hover:bg-black/80 hover:scale-105"
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-primary" />}
      </button>
    </div>
  );
}
