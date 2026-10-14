import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  Clock,
  MapPin,
  MessageCircle,
  Users,
} from "lucide-react";
import {
  CLUB_ADDRESS,
  CLUB_MAPS_EMBED_URL,
  CLUB_MAPS_URL,
  CLUB_NAME,
  CLUB_SHORT_ADDRESS,
  CLUB_PHONE_LABEL,
  CLUB_WHATSAPP_URL,
} from "@/app/components/club-info";
import type { ClubHoursRow } from "@/app/landing/club-hours";
import { ATTENDANCE_POINTS, OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { HeroVideo } from "@/app/landing/hero-video";

/**
 * Landing Page de Quento Club.
 * - Hero original intacto (Split 50/50 con HeroVideo en loop y logo animado discreto).
 * - Sección de modalidades rediseñada para eliminar el vacío visual de la captura.
 * - Sección de "El club por dentro" restaurada a su diseño original de 3 tarjetas fotográficas.
 * - 100% Optimizada para dispositivos móviles.
 */
export function Landing({
  courtCount,
  hours,
}: {
  userName: string | null;
  isGuest: boolean;
  courtCount: number;
  hours: ClubHoursRow[];
  courts?: unknown;
}) {
  return (
    <div className="w-full bg-[#fbfaf7] text-[#141518] font-sans antialiased selection:bg-primary selection:text-white">
      {/* =========================================================================
          1. HERO SPLIT ORIGINAL (Con Video en Vivo y Logo GIF Discreto)
          ========================================================================= */}
      <section
        aria-label="Bienvenida"
        className="w-full border-b border-[#e7e5dc] bg-white"
      >
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 items-stretch gap-8 sm:gap-12 lg:grid-cols-12 lg:gap-16">
            {/* LADO IZQUIERDO: Marca, Titular y Turnera (6 columnas) */}
            <div className="flex flex-col justify-between space-y-8 sm:space-y-10 lg:col-span-6 lg:py-4">
              {/* Barra de marca con logo GIF animado */}
              <div className="flex items-center gap-3 text-xs font-mono tracking-widest text-[#71717a] uppercase">
                <Image
                  src="/material_landing/quento_logo.gif"
                  alt="Quento Logo"
                  width={24}
                  height={24}
                  unoptimized
                  className="h-6 w-6 rounded-md object-contain"
                />
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>QUENTO CLUB · VILLA ELISA</span>
              </div>

              {/* Titular y bajada con escala armónica */}
              <div className="space-y-5 sm:space-y-6">
                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#141518] leading-[1.08]">
                  {CLUB_NAME}
                  <span className="text-primary">.</span>
                  <span className="block text-2xl sm:text-3xl lg:text-4xl font-light text-[#52525b] mt-2 sm:mt-3">
                    Turnera oficial de pádel.
                  </span>
                </h1>

                <p className="max-w-lg text-sm sm:text-base lg:text-lg text-[#52525b] font-light leading-relaxed">
                  8 canchas panorámicas de cristal con iluminación LED profesional en Villa Elisa.
                  Consultá disponibilidad en vivo y reservá tu turno en segundos.
                </p>

                {/* Botones de acción (adaptados a ancho completo en celular) */}
                <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center">
                  <Link
                    href="/bookings"
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-xl bg-primary px-8 py-4 text-sm font-bold tracking-wide text-white transition-all hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    <span>Ver turnos disponibles</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/open-matches"
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#d4d2c9] bg-white px-6 py-4 text-sm font-semibold text-[#141518] transition-all hover:border-[#141518] hover:bg-[#f6f5f0] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Partidos abiertos</span>
                    <ArrowUpRight className="h-4 w-4 text-[#71717a]" />
                  </Link>
                </div>
              </div>

              {/* Fila sutil con datos del predio */}
              <div className="flex flex-wrap items-center gap-6 sm:gap-8 border-t border-[#f0ede4] pt-5 sm:pt-6 text-xs text-[#71717a]">
                <div>
                  <span className="font-mono font-bold text-[#141518] text-sm">8 Pistas</span>
                  <p className="mt-0.5">Blindex Panorámico</p>
                </div>
                <div className="h-6 w-px bg-[#e7e5dc]" />
                <div>
                  <span className="font-mono font-bold text-[#141518] text-sm">90 min</span>
                  <p className="mt-0.5">Duración Por Turno</p>
                </div>
                <div className="h-6 w-px bg-[#e7e5dc]" />
                <div>
                  <span className="font-mono font-bold text-[#141518] text-sm">Villa Elisa</span>
                  <p className="mt-0.5">{CLUB_SHORT_ADDRESS}</p>
                </div>
              </div>
            </div>

            {/* LADO DERECHO: Video Vivo con Autoplay Garantizado (6 columnas) */}
            <div className="lg:col-span-6">
              <div className="relative aspect-video sm:aspect-4/3 lg:aspect-auto lg:h-full min-h-[260px] sm:min-h-[400px] w-full overflow-hidden rounded-2xl sm:rounded-3xl bg-black shadow-lg">
                <HeroVideo
                  poster="/material_landing/quento_cancha1.jpg"
                  src="/material_landing/quento_videoweb.mp4"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10 pointer-events-none" />

                {/* Pie discreto en el video */}
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex items-center justify-between text-white text-xs">
                  <div>
                    <p className="font-bold text-sm">Quento Club · Villa Elisa</p>
                    <p className="text-white/70 text-[11px]">8 canchas oficiales y tercer tiempo</p>
                  </div>
                  <Link
                    href="/bookings"
                    className="rounded-full bg-white/20 px-3.5 py-1.5 font-semibold backdrop-blur hover:bg-white hover:text-black transition-colors"
                  >
                    Elegir cancha →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. LAS DOS MODALIDADES DE JUEGO (Rediseño de la sección de la foto: sin vacío)
          ========================================================================= */}
      <section className="w-full border-b border-[#e7e5dc] bg-[#f6f5f0] py-14 sm:py-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12 space-y-8 sm:space-y-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-[#e7e5dc] pb-5">
            <div>
              <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
                TURNERA & COMUNIDAD
              </span>
              <h2 className="font-display mt-1 text-2xl font-extrabold tracking-tight text-[#141518] sm:text-4xl lg:text-5xl">
                Venís con tu grupo o te sumás a jugar.
              </h2>
            </div>
            <p className="font-mono text-xs text-[#71717a] uppercase">
              SIN INTERMEDIARIOS · CONFIRMACIÓN INMEDIATA
            </p>
          </div>

          {/* Tarjetas Rediseñadas: Proporción balanceada, rica en detalles, sin espacio muerto */}
          <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2">
            {/* Modalidad 01: Cancha Privada */}
            <div className="group rounded-2xl sm:rounded-3xl border border-[#e0ded5] bg-white p-6 sm:p-9 shadow-xs transition-all hover:border-[#141518] hover:shadow-md flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#f6f5f0] px-3.5 py-1 font-mono text-[11px] font-bold tracking-wider text-[#141518] uppercase">
                    01 · CANCHA PRIVADA
                  </span>
                  <span className="font-mono text-xs text-[#71717a] font-semibold">4 Jugadores</span>
                </div>

                <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#141518]">
                  Cancha completa para tu cuarteto.
                </h3>

                <p className="text-sm text-[#52525b] leading-relaxed font-light">
                  Elegí día, horario y pista en la turnera en vivo. Mirá el valor por turno y confirmá al instante sin esperas ni llamadas.
                </p>

                {/* Características clave que rellenan y dan valor a la tarjeta */}
                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-[#52525b]">
                  <span className="rounded-lg bg-[#f6f5f0] px-2.5 py-1 font-mono font-medium">8 canchas en vivo</span>
                  <span className="rounded-lg bg-[#f6f5f0] px-2.5 py-1 font-mono font-medium">90 minutos</span>
                  <span className="rounded-lg bg-[#f6f5f0] px-2.5 py-1 font-mono font-medium">Reserva directa</span>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-[#f0ede4]">
                <Link
                  href="/bookings"
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#141518] hover:text-primary transition-colors"
                >
                  <span>Ir a la turnera de canchas</span>
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                </Link>
              </div>
            </div>

            {/* Modalidad 02: Partido Abierto */}
            <div className="group rounded-2xl sm:rounded-3xl border border-[#e0ded5] bg-white p-6 sm:p-9 shadow-xs transition-all hover:border-[#141518] hover:shadow-md flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-primary/10 px-3.5 py-1 font-mono text-[11px] font-bold tracking-wider text-primary uppercase">
                    02 · PARTIDO ABIERTO
                  </span>
                  <span className="font-mono text-xs text-[#71717a] font-semibold">Completá los 4</span>
                </div>

                <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#141518]">
                  ¿Te faltan jugadores? Abrí tu partido.
                </h3>

                <p className="text-sm text-[#52525b] leading-relaxed font-light">
                  Publicá los lugares libres de tu cancha o sumate a un partido armado para que nunca te quedes sin jugar al pádel.
                </p>

                {/* Características clave que rellenan y dan valor a la tarjeta */}
                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-[#52525b]">
                  <span className="rounded-lg bg-[#f6f5f0] px-2.5 py-1 font-mono font-medium">Por categoría</span>
                  <span className="rounded-lg bg-[#f6f5f0] px-2.5 py-1 font-mono font-medium">Chat propio</span>
                  <span className="rounded-lg bg-[#f6f5f0] px-2.5 py-1 font-mono font-medium">Sumá puntos</span>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-[#f0ede4]">
                <Link
                  href="/open-matches"
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#141518] hover:text-primary transition-colors"
                >
                  <span>Ver partidos disponibles</span>
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. QUÉ PODÉS HACER (Grilla Limpia con Alto Contraste)
          ========================================================================= */}
      <section
        aria-label="Qué podés hacer"
        className="w-full border-b border-[#e7e5dc] bg-white py-14 sm:py-20"
      >
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12 space-y-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-[#f0ede4] pb-5">
            <div>
              <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
                SISTEMA DIGITAL
              </span>
              <h2 className="font-display mt-1 text-2xl font-extrabold tracking-tight text-[#141518] sm:text-3xl">
                Qué podés hacer
              </h2>
            </div>
            <p className="font-mono text-xs text-[#71717a] uppercase">
              GESTIÓN SIMPLE DESDE CUALQUIER DISPOSITIVO
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:gap-6 lg:gap-8 divide-[#f0ede4]">
            <div className="py-6 sm:py-0 space-y-2.5">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-[#d4d2c9]">01</span>
              <h3 className="font-display text-base sm:text-lg font-bold text-[#141518]">Reservá online</h3>
              <p className="text-xs sm:text-sm text-[#52525b] leading-relaxed font-light">
                Mirá qué canchas están libres y reservá tu turno en segundos, sin llamar.
              </p>
              <div className="pt-1">
                <Link
                  href="/bookings"
                  className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-primary hover:underline uppercase tracking-wider"
                >
                  <span>Turnera en vivo</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="py-6 sm:py-0 space-y-2.5">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-[#d4d2c9]">02</span>
              <h3 className="font-display text-base sm:text-lg font-bold text-[#141518]">Partidos abiertos</h3>
              <p className="text-xs sm:text-sm text-[#52525b] leading-relaxed font-light">
                ¿Te faltan jugadores? Abrí tu partido o sumate a uno armado hasta completar los {OPEN_MATCH_MAX_PLAYERS}.
              </p>
              <div className="pt-1">
                <Link
                  href="/open-matches"
                  className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-primary hover:underline uppercase tracking-wider"
                >
                  <span>Ver partidos</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="py-6 sm:py-0 space-y-2.5">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-[#d4d2c9]">03</span>
              <h3 className="font-display text-base sm:text-lg font-bold text-[#141518]">Chat del partido</h3>
              <p className="text-xs sm:text-sm text-[#52525b] leading-relaxed font-light">
                Coordiná con los demás jugadores del partido desde un chat propio.
              </p>
              <p className="pt-1 font-mono text-[11px] text-[#a1a1aa] uppercase">
                Activo con tu reserva
              </p>
            </div>

            <div className="py-6 sm:py-0 space-y-2.5">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-[#d4d2c9]">04</span>
              <h3 className="font-display text-base sm:text-lg font-bold text-[#141518]">Sumá puntos</h3>
              <p className="text-xs sm:text-sm text-[#52525b] leading-relaxed font-light">
                Cada turno al que asistís suma {ATTENDANCE_POINTS} puntos de fidelidad.
              </p>
              <p className="pt-1 font-mono text-[11px] text-[#a1a1aa] uppercase">
                Acumulables en tu cuenta
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. EL CLUB POR DENTRO (Restaurado exactamente como estaba antes)
          ========================================================================= */}
      <section className="w-full border-b border-[#e7e5dc] bg-[#fbfaf7] py-14 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12 space-y-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-[#e7e5dc] pb-5">
            <div>
              <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
                INSTALACIONES
              </span>
              <h2 className="font-display mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#141518]">
                El club por dentro
              </h2>
            </div>
            <p className="text-xs font-mono text-[#71717a] uppercase">
              CAMINO CENTENARIO 8907 · VILLA ELISA
            </p>
          </div>

          {/* Tríptico Original de 3 Fotos Lado a Lado */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="group relative aspect-4/3 overflow-hidden rounded-2xl bg-black shadow-xs">
              <Image
                src="/material_landing/quento_cancha1.jpg"
                alt="Canchas panorámicas de cristal"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <span className="font-mono text-[10px] tracking-widest text-primary uppercase font-bold">PISTAS OFICIALES</span>
                <h3 className="mt-0.5 text-base font-bold">Cristal Panorámico</h3>
                <p className="text-xs text-white/70">Césped texturado oficial y medidas de torneo</p>
              </div>
            </div>

            <div className="group relative aspect-4/3 overflow-hidden rounded-2xl bg-black shadow-xs">
              <Image
                src="/material_landing/quento_cancha2.jpg"
                alt="Iluminación nocturna"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <span className="font-mono text-[10px] tracking-widest text-primary uppercase font-bold">NOCTURNO</span>
                <h3 className="mt-0.5 text-base font-bold">Iluminación LED Deportiva</h3>
                <p className="text-xs text-white/70">Calibración anti-sombras para alta velocidad</p>
              </div>
            </div>

            <div className="group relative aspect-4/3 overflow-hidden rounded-2xl bg-black shadow-xs">
              <Image
                src="/material_landing/quento_servicios.jpg"
                alt="Bar y Tercer tiempo"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <span className="font-mono text-[10px] tracking-widest text-primary uppercase font-bold">TERCER TIEMPO</span>
                <h3 className="mt-0.5 text-base font-bold">Bar, Cafetería & Parking</h3>
                <p className="text-xs text-white/70">Bebidas, cafetería y estacionamiento cerrado</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. EL COMPLEJO & UBICACIÓN (Fondo Crema Piedra #f4f2ec)
          ========================================================================= */}
      <section
        aria-label="El complejo"
        className="w-full bg-[#f4f2ec] py-14 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14 items-center">
            {/* Info a la izquierda (5 columnas) */}
            <div className="space-y-6 lg:col-span-5">
              <div className="space-y-2">
                <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
                  UBICACIÓN
                </span>
                <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#141518]">
                  El complejo
                </h2>
              </div>

              <div className="space-y-5 text-sm text-[#52525b]">
                {/* Dirección */}
                <div className="flex items-start gap-3.5">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#141518] text-sm sm:text-base">{CLUB_ADDRESS}</p>
                    <a
                      href={CLUB_MAPS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs font-bold text-primary hover:underline uppercase"
                    >
                      <span className="sr-only">Cómo llegar: </span>
                      <span>Abrir en Google Maps</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                <div className="border-t border-[#e0ded5]" />

                {/* Instalaciones */}
                <div className="flex items-start gap-3.5">
                  <Users className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#141518] text-sm">
                      {courtCount === 1 ? "1 cancha" : `${courtCount} canchas`}
                    </p>
                    <p className="text-xs text-[#71717a] mt-0.5">Predio cerrado con estacionamiento privado</p>
                  </div>
                </div>

                <div className="border-t border-[#e0ded5]" />

                {/* Horarios */}
                <div className="flex items-start gap-3.5">
                  <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-[#141518] text-sm">Horarios de atención</p>
                    {hours.length > 0 ? (
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs">
                        {hours.map((row) => (
                          <div key={row.days} className="contents">
                            <dt className="text-[#71717a] font-mono">{row.days}</dt>
                            <dd className="font-bold text-[#141518] font-mono">{row.hours}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-1 text-xs text-[#71717a]">Consultá los horarios por WhatsApp.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Botón WhatsApp */}
              <div className="pt-2">
                <a
                  href={CLUB_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-[#141518] px-6 py-3.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-black hover:scale-[1.01] active:scale-[0.98]"
                >
                  <MessageCircle className="h-4 w-4 text-white" />
                  <span>Escribinos por WhatsApp</span>
                  <span className="font-mono text-white/70">{CLUB_PHONE_LABEL}</span>
                  <ArrowRight className="h-4 w-4 ml-0.5 text-white/70" />
                </a>
              </div>
            </div>

            {/* Mapa Embebido (7 columnas) */}
            <div className="overflow-hidden rounded-2xl border border-[#e0ded5] bg-white h-72 sm:h-96 lg:h-[420px] lg:col-span-7 shadow-xs">
              <iframe
                title="Mapa del complejo"
                src={CLUB_MAPS_EMBED_URL}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
