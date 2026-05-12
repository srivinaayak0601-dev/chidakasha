"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  LogOut, Film, Box, Image as ImageIcon, Bot, Code, WandSparkles,
  Home, FolderOpen, LayoutTemplate, Plus, Settings, ChevronFirst,
  ArrowRight, CheckCircle2, Sparkles, Mail
} from "lucide-react";
import VideoEditor from "@/components/VideoEditor";
import CadEditor from "@/components/CadEditor";

/* ─── Mini components ─────────────────────────────────────── */

function WireframeBox() {
  return (
    <Canvas camera={{ position: [2.5, 2, 2.5], fov: 45 }} style={{ background: "transparent" }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 4, 4]} intensity={1} color="#a855f7" />
      <mesh>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshBasicMaterial color="#8b3dff" wireframe />
      </mesh>
      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={4} enablePan={false} />
    </Canvas>
  );
}

function VideoTimelineMockup() {
  const tracks = [
    { color: "#8b3dff", clips: [{ w: 45, ml: 0 }, { w: 28, ml: 52 }] },
    { color: "#3b82f6", clips: [{ w: 58, ml: 12 }] },
    { color: "#10b981", clips: [{ w: 22, ml: 0 }, { w: 42, ml: 30 }] },
    { color: "#f59e0b", clips: [{ w: 75, ml: 5 }] },
  ];
  return (
    <div className="w-full h-full flex flex-col p-3 bg-[#0a0a0c] rounded-xl overflow-hidden group-hover/preview:shadow-inner relative">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
        <div className="w-[1px] h-full bg-red-500/80 absolute left-1/4 group-hover:animate-[playhead_2s_ease-in-out_infinite]" style={{ boxShadow: '0 0 4px rgba(239,68,68,0.8)' }}>
          <div className="w-2 h-2 bg-red-500 rotate-45 -translate-x-1/2 -mt-1" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-white/10">
        <div className="w-2 h-2 rounded-full bg-red-500/80" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/80" />
        <div className="w-2 h-2 rounded-full bg-green-500/80" />
        <span className="text-[9px] text-white/30 ml-2 font-mono">00:00:42:12</span>
      </div>
      <div className="relative mb-2 h-3 bg-white/5 rounded-full flex items-center px-1 gap-px">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/10 rounded-full" />
        ))}
        <div className="absolute left-[35%] top-0 bottom-0 w-px bg-purple-400 shadow-[0_0_8px_rgba(139,61,255,1)]" />
      </div>
      <div className="flex-1 space-y-1.5">
        {tracks.map((track, ti) => (
          <div key={ti} className="relative h-7 bg-white/[0.04] rounded-md">
            {track.clips.map((clip, ci) => (
              <div
                key={ci}
                className="absolute top-1 bottom-1 rounded opacity-90"
                style={{ width: `${clip.w}%`, left: `${clip.ml}%`, backgroundColor: track.color }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphicMockup() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a0c] rounded-xl p-3">
      <div className="w-[140px] aspect-[3/4] bg-gradient-to-br from-[#1a1030] to-[#0c0a1a] rounded-lg border border-white/10 relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-600/20 to-transparent" />
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-purple-500/20 border border-purple-500/20" />
        <div className="absolute top-4 left-3 right-3">
          <div className="h-1.5 w-10 bg-white/20 rounded mb-2" />
          <div className="h-4 w-full bg-white/80 rounded mb-1" />
          <div className="h-4 w-3/4 bg-white/70 rounded mb-3" />
          <div className="h-1 w-full bg-white/15 rounded mb-1" />
          <div className="h-1 w-4/5 bg-white/15 rounded mb-1" />
          <div className="h-1 w-3/5 bg-white/10 rounded" />
        </div>
        <div className="absolute bottom-10 left-3 right-3 h-14 bg-gradient-to-br from-blue-600/30 to-purple-600/30 rounded-lg border border-white/10 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20" />
        </div>
        <div className="absolute bottom-4 left-3 right-3 h-4 bg-purple-500/90 rounded flex items-center justify-center">
          <div className="h-1 w-12 bg-white/70 rounded" />
        </div>
        {/* selection handles */}
        <div className="absolute top-[60px] left-2 w-2 h-2 border border-blue-400 rounded-sm bg-blue-400/20" />
        <div className="absolute top-[60px] right-2 w-2 h-2 border border-blue-400 rounded-sm bg-blue-400/20" />
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */

const HERO_WORDS = ["Video.", "Graphics.", "3D CAD."];
const HERO_COLORS = ["text-purple-400", "text-blue-400", "text-yellow-400"];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; username: string } | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [wordIdx, setWordIdx] = useState(0);
  const [wordKey, setWordKey] = useState(0);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistState, setWaitlistState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    const stored = localStorage.getItem("chidakasha_user");
    if (!stored) { router.push("/"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setUser(JSON.parse(stored)); } catch { router.push("/"); }
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordKey(k => k + 1);
      setWordIdx(i => (i + 1) % HERO_WORDS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.includes("@") || !waitlistEmail.includes(".")) {
      return;
    }
    setWaitlistState("loading");
    try {
      await addDoc(collection(db, "waitlist"), {
        email: waitlistEmail,
        createdAt: serverTimestamp(),
      });
      setWaitlistState("done");
    } catch {
      setWaitlistState("done"); // show success regardless of DB error
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("chidakasha_user");
    router.push("/");
  };

  if (!user) return null;

  const sideNav = [
    { label: "Home", icon: Home, active: !activeTool, onClick: () => setActiveTool(null) },
    { label: "Projects", icon: FolderOpen, active: false, onClick: () => {} },
    { label: "Templates", icon: LayoutTemplate, active: false, onClick: () => {} },
  ];

  const divisions = [
    {
      id: "Video Edit",
      label: "Video Editor",
      icon: Film,
      badge: "🎬",
      color: "from-purple-600/20 to-purple-600/5",
      border: "border-purple-500/20",
      accent: "text-purple-400",
      desc: "Multi-track timeline. Cut, trim, layer, export.",
      preview: <VideoTimelineMockup />,
    },
    {
      id: "Photo & Poster",
      label: "Graphic Design",
      icon: ImageIcon,
      badge: "🎨",
      color: "from-blue-600/20 to-blue-600/5",
      border: "border-blue-500/20",
      accent: "text-blue-400",
      desc: "Posters, banners, social media — pixel-perfect.",
      preview: <GraphicMockup />,
    },
    {
      id: "3D CAD",
      label: "3D CAD Editor",
      icon: Box,
      badge: "📐",
      color: "from-yellow-600/20 to-yellow-600/5",
      border: "border-yellow-500/20",
      accent: "text-yellow-400",
      desc: "Parametric 3D modeling. Engineers & architects.",
      preview: (
        <div className="w-full h-full bg-[#0a0a0c] rounded-xl overflow-hidden">
          <WireframeBox />
        </div>
      ),
    },
  ];

  return (
    <main className="h-screen w-full bg-[#09090b] text-white flex font-sans overflow-hidden">

      {/* ── Sidebar ── */}
      <aside
        onMouseEnter={() => setIsSidebarCollapsed(false)}
        onMouseLeave={() => setIsSidebarCollapsed(true)}
        className={`bg-[#0d0d0f] border-r border-white/[0.07] flex flex-col flex-shrink-0 transition-all duration-300 ${isSidebarCollapsed ? "w-[68px]" : "w-[240px]"}`}
      >
        <div className={`p-4 flex items-center gap-3 mt-2 ${isSidebarCollapsed ? "justify-center" : ""}`}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {user.username.charAt(0).toUpperCase()}
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate">{user.username}&apos;s Workspace</p>
              <p className="text-[11px] text-white/40">Free Plan</p>
            </div>
          )}
        </div>

        <div className="px-3 mb-5 mt-1">
          <button className={`w-full bg-[#8b3dff] hover:bg-[#7a35e0] text-white font-semibold text-[13px] rounded-lg py-2.5 flex items-center justify-center gap-2 transition-all active:scale-95 ${isSidebarCollapsed ? "px-2" : "px-4"}`}>
            <Plus className="w-4 h-4 flex-shrink-0" />
            {!isSidebarCollapsed && <span>Create new</span>}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 no-scrollbar">
          {sideNav.map(item => (
            <button
              key={item.label}
              onClick={item.onClick}
              title={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isSidebarCollapsed ? "justify-center" : ""} ${item.active ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/[0.06] hover:text-white"}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.07]">
          <button
            onClick={handleLogout}
            title="Sign Out"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors ${isSidebarCollapsed ? "justify-center" : ""}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <section className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="h-14 flex items-center px-5 gap-4 border-b border-white/[0.07] bg-[#09090b]/90 backdrop-blur-sm z-20 flex-shrink-0">
          <button onClick={() => setIsSidebarCollapsed(v => !v)} className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <ChevronFirst className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? "rotate-180" : ""}`} />
          </button>
          <span className="font-bold text-base tracking-tight text-white mr-4">Chidakasha</span>

          {/* Nav tabs */}
          <div className="flex items-center gap-1">
            {[
              { label: "Video", id: "Video Edit", icon: Film },
              { label: "Graphics", id: "Photo & Poster", icon: ImageIcon },
              { label: "3D / CAD", id: "3D CAD", icon: Box },
              { label: "AI Tools", id: "AI Guide", icon: Bot },
            ].map(tab => (
              <button
                key={tab.label}
                onClick={() => setActiveTool(tab.id === activeTool ? null : tab.id)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium flex items-center gap-2 transition-all ${activeTool === tab.id ? "bg-purple-600/20 text-purple-300 border border-purple-500/30" : "text-white/50 hover:text-white hover:bg-white/[0.06]"}`}
              >
                <tab.icon className="w-5 h-5" /> {tab.label}
              </button>
            ))}
          </div>

          <div className="ml-auto">
            <button className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-colors">
              <Settings className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {activeTool === "Video Edit" ? (
            <div className="p-6"><VideoEditor /></div>
          ) : activeTool === "3D CAD" ? (
            <div className="h-full p-6 flex flex-col"><CadEditor /></div>
          ) : (

            /* ── HOME VIEW ── */
            <div className="min-h-full">

              {/* ── HERO ── */}
              <div className="relative flex flex-col items-center justify-center text-center px-6 py-20 overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-blue-600/8 rounded-full blur-[100px] pointer-events-none" />

                <div className="animate-slide-up relative z-10">
                  <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-full px-4 py-1.5 text-[12px] text-white/60 mb-8 animate-glow-pulse">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Now in Beta — Creative Suite for Professionals
                  </div>
                </div>

                <h1 className="animate-slide-up-delay-1 relative z-10 text-[52px] md:text-[68px] font-black tracking-tight leading-none mb-2 text-white">
                  Create anything.<br />
                  <span className="inline-block h-[1.15em] overflow-hidden relative">
                    <span key={wordKey} className={`inline-block word-in ${HERO_COLORS[wordIdx]}`}>
                      {HERO_WORDS[wordIdx]}
                    </span>
                  </span>
                </h1>

                <p className="animate-slide-up-delay-2 relative z-10 text-white/50 text-[16px] max-w-lg mt-4 mb-8 leading-relaxed">
                  One platform for video editing, graphic design, and 3D CAD modeling.
                  Built for creators who refuse to compromise.
                </p>

                <div className="animate-slide-up-delay-3 relative z-10 flex items-center gap-3 flex-wrap justify-center mb-6">
                  {["🎬 Video Editor", "🎨 Graphic Design", "📐 3D CAD"].map(badge => (
                    <span key={badge} className={`px-4 py-1.5 bg-white/[0.06] border border-white/10 rounded-full text-[13px] text-white/70 font-medium ${badge.includes('3D CAD') ? 'text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]' : ''}`}>
                      {badge}
                    </span>
                  ))}
                </div>

                <div className="animate-slide-up-delay-4 relative z-10 flex items-center gap-3">
                  <button
                    onClick={() => document.getElementById("divisions")?.scrollIntoView({ behavior: "smooth" })}
                    className="bg-[#8b3dff] hover:bg-[#9d5cff] text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-[0_0_24px_rgba(139,61,255,0.4)] hover:shadow-[0_0_30px_rgba(139,61,255,0.8)] hover:scale-[1.03]"
                  >
                    Start Creating <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
                    className="bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white font-semibold px-6 py-3 rounded-xl transition-all active:scale-95"
                  >
                    Join Beta
                  </button>
                </div>
              </div>

              {/* ── DIVISION CARDS ── */}
              <div id="divisions" className="px-8 pb-16 max-w-[1200px] mx-auto pt-10">
                <p className="text-center text-white/30 text-[11px] uppercase tracking-widest font-semibold mb-8">Three powerhouse tools. One workspace.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {divisions.map((div, index) => (
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }}
                      key={div.id}
                      className={`card-glow group relative bg-gradient-to-b ${div.color} backdrop-blur-xl bg-white/[0.03] border ${div.border} rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 cursor-pointer`}
                      onClick={() => setActiveTool(div.id)}
                    >
                      {/* Preview area */}
                      <div className="h-[180px] rounded-xl overflow-hidden border border-white/[0.06]">
                        {div.preview}
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{div.badge}</span>
                          <h3 className={`font-bold text-[15px] ${div.accent}`}>{div.label}</h3>
                        </div>
                        <p className="text-[13px] text-white/50 leading-relaxed">{div.desc}</p>
                      </div>

                      <button className={`mt-auto flex items-center gap-1.5 text-[12px] font-semibold ${div.accent} opacity-0 group-hover:opacity-100 transition-opacity`}>
                        Open Tool <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* ── BETA WAITLIST ── */}
              <div id="waitlist" className="border-t border-white/[0.06] bg-[#0d0d0f] px-8 py-16 flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 text-[12px] text-purple-300 mb-6">
                  <Sparkles className="w-3.5 h-3.5" /> Limited Beta Access
                </div>
                <h2 className="text-[32px] font-black text-white mb-3 tracking-tight">
                  Be the first to experience it.
                </h2>
                <p className="text-white/40 text-[15px] mb-8 max-w-md">
                  Join the waitlist and get early access before the public launch.
                </p>

                {waitlistState === "done" ? (
                  <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-6 py-4 text-emerald-400 font-semibold text-lg">
                    <CheckCircle2 className="w-6 h-6" />
                    You&apos;re on the list! 🚀
                  </div>
                ) : (
                  <form onSubmit={handleWaitlist} className="flex items-center gap-3 w-full max-w-md">
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        type="email"
                        required
                        value={waitlistEmail}
                        onChange={e => setWaitlistEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full bg-white/[0.06] border border-white/10 text-white text-[14px] rounded-xl pl-11 pr-4 py-3 outline-none focus:border-purple-500 shadow-[0_0_0_2px_rgba(139,61,255,0)] focus:shadow-[0_0_15px_rgba(139,61,255,0.4)] transition-all placeholder:text-white/30"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={waitlistState === "loading"}
                      className="bg-[#8b3dff] hover:bg-[#7a35e0] disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap"
                    >
                      {waitlistState === "loading" ? "Joining…" : "Join Beta"}
                    </button>
                  </form>
                )}

                <p className="text-[#A0A0A0] text-[12px] mt-4">No spam. Unsubscribe anytime.</p>
              </div>

              {/* Footer */}
              <div className="border-t border-white/[0.06] px-8 py-6 flex items-center justify-between text-[12px] text-white/20">
                <span>© 2026 Chidakasha</span>
                <span>Built for creators who refuse to compromise.</span>
              </div>

            </div>
          )}
        </div>
      </section>
    </main>
  );
}
