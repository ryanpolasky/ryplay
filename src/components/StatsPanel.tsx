import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useStats } from "../hooks/useStats";
import ScrollingText from "./ScrollingText";
import type { PaletteColors } from "../types/lastfm";

interface Props {
  username: string;
  colors: PaletteColors;
  artworkUrl?: string;
  currentTrack?: { title: string; artist: string } | null;
}

function formatDate(unix: number): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function StatCard({
  label,
  value,
  suffix,
  sub,
  color,
  delay,
  colSpan,
  hero,
}: {
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  color?: string;
  delay: number;
  colSpan?: number;
  hero?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`rounded-xl ${hero ? "bg-white/[0.06]" : "bg-white/[0.04]"} ring-1 ring-white/[0.06] p-4 flex flex-col gap-1 min-w-0 ${
        colSpan === 2 ? "col-span-2 sm:col-span-1" : ""
      }`}
    >
      <span className="text-[9px] uppercase tracking-widest text-white/30">
        {label}
      </span>
      <ScrollingText className={`${hero ? "text-2xl sm:text-xl" : "text-xl"} font-bold tabular-nums`}>
        <span style={{ color: color ?? "rgba(255,255,255,0.85)" }}>
          {value}
        </span>
        {suffix && (
          <span className="text-sm font-normal text-white/25 ml-1.5">
            {suffix}
          </span>
        )}
      </ScrollingText>
      {sub && <ScrollingText className="text-[11px] text-white/30">{sub}</ScrollingText>}
    </motion.div>
  );
}

// --- Share image generation via Canvas ---

async function generateShareImage(
  stats: NonNullable<ReturnType<typeof useStats>["stats"]>,
  colors: PaletteColors,
  username: string,
  artworkUrl?: string,
  currentTrack?: { title: string; artist: string } | null,
): Promise<Blob> {
  const W = 1080,
    H = 1350; // vertical, IG-friendly
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = (w: number, style = "") =>
    `${style} ${w}px Inter, system-ui, sans-serif`.trim();
  const PAD = 60;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, colors.dominant);
  bg.addColorStop(0.3, "#0a0a0f");
  bg.addColorStop(0.7, "#0a0a0f");
  bg.addColorStop(1, colors.dark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Load album art once
  let artImg: HTMLImageElement | null = null;
  if (artworkUrl) {
    try {
      artImg = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = rej;
        // Request higher res for share image (swap 300x300/600x600 to 1200x1200)
        const hiResUrl = artworkUrl
          .replace(/\/\d+x\d+bb/, "/1200x1200bb")
          .replace(/\d+x\d+(?=\.\w+$)/, "1200x1200");
        i.src = `/api/artwork?url=${encodeURIComponent(hiResUrl)}`;
      });
    } catch {
      /* */
    }
  }

  // Blurred art background (cover-fit, not stretched)
  if (artImg) {
    ctx.globalAlpha = 0.12;
    const scale = Math.max(W / artImg.width, H / artImg.height);
    const sw = artImg.width * scale;
    const sh = artImg.height * scale;
    ctx.drawImage(artImg, (W - sw) / 2, (H - sh) / 2, sw, sh);
    ctx.globalAlpha = 1;
  }

  // Vignette
  const vig = ctx.createRadialGradient(
    W / 2,
    H * 0.35,
    100,
    W / 2,
    H * 0.35,
    W * 0.8,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  let y = PAD;

  // --- Album art (centered square) ---
  if (artImg) {
    const artSize = 320;
    const artX = (W - artSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(artX, y, artSize, artSize, 20);
    ctx.clip();
    ctx.drawImage(artImg, artX, y, artSize, artSize);
    ctx.restore();
    // Ring
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(artX, y, artSize, artSize, 20);
    ctx.stroke();
    // Glow
    ctx.shadowColor = colors.vibrant;
    ctx.shadowBlur = 40;
    ctx.strokeStyle = "rgba(0,0,0,0)";
    ctx.beginPath();
    ctx.roundRect(artX, y, artSize, artSize, 20);
    ctx.stroke();
    ctx.shadowBlur = 0;
    y += artSize + 30;
  }

  // --- Currently listening ---
  if (currentTrack) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = font(14);
    ctx.fillText("CURRENTLY LISTENING TO", W / 2, y);
    y += 30;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = font(26, "bold");
    ctx.fillText(currentTrack.title, W / 2, y);
    y += 32;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = font(20);
    ctx.fillText(currentTrack.artist, W / 2, y);
    y += 50;
    ctx.textAlign = "left";
  } else {
    y += 20;
  }

  // --- Divider ---
  ctx.fillStyle = `${colors.vibrant}30`;
  ctx.fillRect(PAD, y, W - PAD * 2, 1);
  y += 40;

  // --- Username ---
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = font(22);
  ctx.fillText(username, PAD, y);
  y += 85;

  // --- Big scrobbles ---
  ctx.fillStyle = colors.vibrant;
  ctx.font = font(64, "bold");
  const scrobText = (stats.totalScrobbles ?? 0).toLocaleString();
  ctx.fillText(scrobText, PAD, y);
  const sw = ctx.measureText(scrobText).width;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = font(22);
  ctx.fillText("listens", PAD + sw + 14, y);
  if (stats.avgDaily) {
    const sl = ctx.measureText("listens").width;
    ctx.fillText(`· ${stats.avgDaily}/day`, PAD + sw + 14 + sl + 10, y);
  }
  y += 55;

  // --- Stat grid ---
  const colW = (W - PAD * 2) / 3;
  const statsGrid = [
    { label: "ARTISTS", val: (stats.totalArtists ?? 0).toLocaleString() },
    { label: "TRACKS", val: (stats.totalTracks ?? 0).toLocaleString() },
    { label: "ALBUMS", val: (stats.totalAlbums ?? 0).toLocaleString() },
  ];
  for (let i = 0; i < statsGrid.length; i++) {
    const x = PAD + i * colW;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = font(12);
    ctx.fillText(statsGrid[i].label, x, y);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = font(30, "bold");
    ctx.fillText(statsGrid[i].val, x, y + 34);
  }
  y += 80;

  // --- #1s ---
  const highlights = [
    stats.topArtist ? { label: "#1 ARTIST", val: stats.topArtist.name } : null,
    stats.topTrack ? { label: "#1 TRACK", val: stats.topTrack.name } : null,
    stats.topGenre ? { label: "TOP GENRE", val: stats.topGenre } : null,
  ].filter(Boolean) as { label: string; val: string }[];

  for (let i = 0; i < highlights.length; i++) {
    const x = PAD + i * colW;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = font(12);
    ctx.fillText(highlights[i].label, x, y);
    ctx.fillStyle = colors.vibrant;
    ctx.font = font(22, "bold");
    // Truncate if too wide
    let val = highlights[i].val;
    while (ctx.measureText(val).width > colW - 10 && val.length > 3) {
      val = val.slice(0, -2) + "…";
    }
    ctx.fillText(val, x, y + 30);
  }
  y += 70;

  // --- Top 5 Artists ---
  if (stats.topArtists && stats.topArtists.length > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = font(12);
    ctx.fillText("TOP ARTISTS", PAD, y);
    y += 28;

    for (let i = 0; i < Math.min(5, stats.topArtists.length); i++) {
      const a = stats.topArtists[i];
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = font(16, "bold");
      ctx.fillText(`${i + 1}`, PAD, y);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = font(20, "bold");
      let name = a.name;
      while (
        ctx.measureText(name).width > W - PAD * 2 - 200 &&
        name.length > 3
      ) {
        name = name.slice(0, -2) + "…";
      }
      ctx.fillText(name, PAD + 30, y);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = font(16);
      ctx.textAlign = "right";
      ctx.fillText(`${a.playcount.toLocaleString()} plays`, W - PAD, y);
      ctx.textAlign = "left";
      y += 30;
    }
    y += 15;
  }

  // --- Top 5 Tracks ---
  if (stats.topTracks && stats.topTracks.length > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = font(12);
    ctx.fillText("TOP TRACKS", PAD, y);
    y += 28;

    for (let i = 0; i < Math.min(5, stats.topTracks.length); i++) {
      const t = stats.topTracks[i];
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = font(16, "bold");
      ctx.fillText(`${i + 1}`, PAD, y);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = font(18, "bold");
      let name = t.name;
      const maxNameW = W - PAD * 2 - 200;
      while (ctx.measureText(name).width > maxNameW && name.length > 3) {
        name = name.slice(0, -2) + "…";
      }
      ctx.fillText(name, PAD + 30, y);
      // Artist name below track name
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = font(14);
      let artist = t.artist;
      while (ctx.measureText(artist).width > maxNameW && artist.length > 3) {
        artist = artist.slice(0, -2) + "…";
      }
      ctx.fillText(artist, PAD + 30, y + 18);
      // Playcount
      ctx.font = font(14);
      ctx.textAlign = "right";
      ctx.fillText(`${t.playcount.toLocaleString()}`, W - PAD, y);
      ctx.textAlign = "left";
      y += 42;
    }
  }

  // --- Branding ---
  ctx.font = font(16);
  ctx.textAlign = "right";
  const brandFull = `ryplay.dev/${username}`;
  const brandFullW = ctx.measureText(brandFull).width;
  ctx.measureText("ry").width;
  // Draw full string in white first
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillText(brandFull, W - PAD, H - PAD);
  // Overdraw "ry" in accent at the same position
  ctx.fillStyle = colors.vibrant;
  ctx.textAlign = "left";
  ctx.fillText("ry", W - PAD - brandFullW, H - PAD);
  ctx.textAlign = "left";

  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
}

export default function StatsPanel({
  username,
  colors,
  artworkUrl,
  currentTrack,
}: Props) {
  const { stats, loading } = useStats(username);
  const vibrant = colors.vibrant;
  const shareRef = useRef(false);
  const [shareLabel, setShareLabel] = useState("share stats");

  const handleShare = async () => {
    if (!stats || shareRef.current) return;
    shareRef.current = true;
    try {
      const blob = await generateShareImage(
        stats,
        colors,
        username,
        artworkUrl,
        currentTrack,
      );
      const file = new File([blob], `ryplay-${username}.png`, {
        type: "image/png",
      });

      // Mobile: native share sheet
      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      if (
        isMobile &&
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `${username} on ryplay`,
        });
      }
      // Desktop: copy to clipboard
      else if (navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        // Brief "copied" feedback could go here
        setShareLabel("copied!");
        setTimeout(() => setShareLabel("share stats"), 2000);
      }
      // Fallback: download
      else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ryplay-${username}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      shareRef.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center gap-2 px-1">
        <div
          className="h-px flex-1"
          style={{ background: `${colors.muted}40` }}
        />
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
          Profile
        </span>
        <div
          className="h-px flex-1"
          style={{ background: `${colors.muted}40` }}
        />
      </div>

      {loading || !stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className={`h-20 rounded-xl bg-white/[0.04] animate-pulse ${
                i === 0 ? "col-span-2 sm:col-span-1" : ""
              }`}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Row 1 */}
            <StatCard
              label="Total Scrobbles"
              value={(stats.totalScrobbles ?? 0).toLocaleString()}
              suffix={
                stats.avgDaily
                  ? `${stats.avgDaily.toLocaleString()}/day`
                  : undefined
              }
              delay={0}
              color={vibrant}
              colSpan={2}
              hero
            />
            <StatCard
              label="Member Since"
              value={formatDate(stats.memberSince)}
              delay={0.04}
            />
            {stats.topGenre ? (
              <StatCard
                label="Top Genre"
                value={stats.topGenre}
                delay={0.08}
                color={vibrant}
              />
            ) : (
              <StatCard
                label="Albums"
                value={(stats.totalAlbums ?? 0).toLocaleString()}
                delay={0.08}
              />
            )}

            {/* Row 2 */}
            <StatCard
              label="Artists"
              value={(stats.totalArtists ?? 0).toLocaleString()}
              delay={0.12}
            />
            <StatCard
              label="Tracks"
              value={(stats.totalTracks ?? 0).toLocaleString()}
              delay={0.16}
              color={vibrant}
            />
            {stats.topGenre ? (
              <StatCard
                label="Albums"
                value={(stats.totalAlbums ?? 0).toLocaleString()}
                delay={0.2}
              />
            ) : (
              <StatCard
                label="Albums"
                value={(stats.totalAlbums ?? 0).toLocaleString()}
                delay={0.2}
              />
            )}

            {/* Row 3 */}
            {stats.topArtist && (
              <StatCard
                label="#1 Artist"
                value={stats.topArtist.name}
                sub={`${(stats.topArtist.playcount ?? 0).toLocaleString()} plays`}
                delay={0.24}
                color={vibrant}
              />
            )}
            {stats.topTrack && (
              <StatCard
                label="#1 Track"
                value={stats.topTrack.name}
                sub={stats.topTrack.artist}
                delay={0.28}
              />
            )}
            {stats.topAlbum && (
              <StatCard
                label="#1 Album"
                value={stats.topAlbum.name}
                sub={stats.topAlbum.artist}
                delay={0.32}
                color={vibrant}
              />
            )}
          </div>

          {/* Share button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={handleShare}
            className="self-center mt-2 px-5 py-2 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.07] transition-all cursor-pointer"
          >
            {shareLabel}
          </motion.button>
        </>
      )}
    </div>
  );
}
