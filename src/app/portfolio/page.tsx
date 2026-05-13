"use client";

import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, TorusKnot, Environment, Float, Sphere } from "@react-three/drei";
import { motion, useScroll, useTransform } from "framer-motion";

// SVG Noise overlay for texture
const NoiseOverlay = () => (
  <svg
    className="pointer-events-none fixed inset-0 z-50 h-full w-full opacity-30 mix-blend-multiply"
    xmlns="http://www.w3.org/2000/svg"
  >
    <filter id="noiseFilter">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
    </filter>
    <rect width="100%" height="100%" filter="url(#noiseFilter)" />
  </svg>
);

// 3D Core Component
const FusionCore = () => {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 45 }} className="w-full h-full">
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#00FFFF" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#FFBF00" />
      <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
        <group>
          <TorusKnot args={[1.5, 0.4, 128, 32]} rotation={[Math.PI / 4, 0, 0]}>
            <meshPhysicalMaterial
              color="#00FFFF"
              transmission={0.9}
              opacity={1}
              metalness={0.8}
              roughness={0.1}
              ior={1.5}
              thickness={0.5}
            />
          </TorusKnot>
          <Sphere args={[0.8, 64, 64]}>
            <meshStandardMaterial color="#FFBF00" emissive="#FFBF00" emissiveIntensity={2} />
          </Sphere>
        </group>
      </Float>
      <OrbitControls enableZoom={true} autoRotate autoRotateSpeed={2} />
      <Environment preset="city" />
    </Canvas>
  );
};

export default function PortfolioPage() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  // Custom Cursor state
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHoveringExperimental, setIsHoveringExperimental] = useState(false);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F5F0] text-black font-mono overflow-x-hidden relative selection:bg-[#00FFFF] selection:text-black">
      <NoiseOverlay />

      {/* Custom Cursor */}
      <motion.div
        className="fixed top-0 left-0 w-6 h-6 rounded-full border border-[#00FFFF] pointer-events-none z-[100] mix-blend-difference"
        animate={{
          x: mousePosition.x - 12,
          y: mousePosition.y - 12,
          scale: isHoveringExperimental ? 2 : 1
        }}
        transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.5 }}
      />
      <motion.div
        className="fixed top-0 left-0 w-2 h-2 rounded-full bg-[#FFBF00] pointer-events-none z-[100]"
        animate={{
          x: mousePosition.x - 4,
          y: mousePosition.y - 4
        }}
        transition={{ type: "spring", stiffness: 1000, damping: 40 }}
      />

      {/* Hidden Experimental Navigation */}
      <nav
        className="fixed top-0 left-0 w-full h-16 z-40 group"
        onMouseEnter={() => setIsHoveringExperimental(true)}
        onMouseLeave={() => setIsHoveringExperimental(false)}
      >
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center -translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out bg-white/10 backdrop-blur-md border-b border-[#00FFFF]">
          <span className="text-xs font-bold tracking-widest text-black">AEROSPACE DESIGN SYNDICATE</span>
          <div className="flex gap-6">
            <a href="#core" className="text-xs font-bold hover:text-[#00FFFF] transition-colors uppercase">Core</a>
            <a href="#telemetry" className="text-xs font-bold hover:text-[#00FFFF] transition-colors uppercase">Telemetry</a>
            <a href="#micro" className="text-xs font-bold hover:text-[#00FFFF] transition-colors uppercase">Micro-Mechanics</a>
          </div>
        </div>
        <div className="absolute top-4 right-4 group-hover:opacity-0 transition-opacity duration-300">
           <span className="text-[10px] uppercase tracking-widest text-gray-400">Hover to reveal menu</span>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen w-full flex flex-col justify-center px-8 md:px-16 z-10">
        <motion.div style={{ y }} className="max-w-7xl relative">
          <p className="text-[#00FFFF] font-bold tracking-widest text-sm mb-4 uppercase drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]">
            Project: Antigravity Propulsion Synthesis
          </p>
          <h1 className="text-6xl md:text-8xl lg:text-[140px] font-black leading-[0.85] tracking-tighter uppercase text-black mix-blend-multiply">
            Redefining<br/>Lift:
          </h1>
          <h2 className="text-4xl md:text-6xl lg:text-[80px] font-black leading-none tracking-tight mt-4 text-transparent bg-clip-text bg-gradient-to-r from-gray-800 to-gray-400">
            Synchronized Mass Acceleration
          </h2>
        </motion.div>

        {/* Scroll indicator */}
        <div className="absolute bottom-12 left-16 flex flex-col items-center gap-2">
          <div className="w-[1px] h-16 bg-gray-300 overflow-hidden relative">
            <motion.div
              className="absolute top-0 left-0 w-full h-full bg-[#00FFFF]"
              animate={{ y: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
          </div>
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Initiate Sequence</span>
        </div>
      </section>

      {/* 3D Viewer Section */}
      <section id="core" className="h-[80vh] w-full border-y border-[#00FFFF] bg-black relative">
        <div className="absolute top-4 left-4 z-10 text-white font-mono text-xs p-2 bg-black/50 border border-[#00FFFF] backdrop-blur-sm">
          <p className="text-[#00FFFF]">ACTIVE_MODULE: FUSION_CORE_v3</p>
          <p className="text-[#FFBF00]">STATUS: CONTAINMENT_STABLE</p>
          <p className="text-gray-400 mt-2">Interaction Enabled [Drag/Zoom]</p>
        </div>
        <FusionCore />
      </section>

      {/* Bento Grid Technical Breakdown */}
      <section id="telemetry" className="max-w-7xl mx-auto py-24 px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Cell 1: Molten Salt Reactor */}
          <div className="col-span-1 md:col-span-2 bg-white/40 backdrop-blur-xl border border-[#00FFFF] p-8 relative overflow-hidden group cursor-pointer hover:bg-white/60 transition-all">
            <div className="absolute inset-0 bg-[#00FFFF]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <h3 className="text-2xl font-black uppercase mb-4">Molten Salt Reactor</h3>
            <p className="text-sm text-gray-600 max-w-md">
              High-thermal efficiency power generation leveraging a liquid fluoride salt mixture. The core operates at 700°C, providing the immense energy required for gravitational field manipulation.
            </p>
            <div className="mt-8 flex gap-4">
              <div className="px-3 py-1 border border-black text-xs font-bold">EFF: 98.4%</div>
              <div className="px-3 py-1 border border-black text-xs font-bold">TEMP: 700C</div>
            </div>
          </div>

          {/* Cell 2: Telemetry HUD */}
          <div className="col-span-1 bg-black text-white border border-[#00FFFF] p-8 flex flex-col items-center justify-center relative group">
            <h3 className="text-[#FFBF00] text-sm font-bold tracking-widest absolute top-4 left-4">TELEMETRY</h3>
            {/* Simple CSS Circular indicator */}
            <div className="w-32 h-32 rounded-full border-4 border-gray-800 border-t-[#00FFFF] border-r-[#FFBF00] animate-spin mt-6 shadow-[0_0_15px_rgba(0,255,255,0.5)]" style={{ animationDuration: '3s' }} />
            <div className="mt-8 text-center w-full">
              <div className="flex justify-between text-xs mb-1"><span className="text-gray-400">Core Stability</span><span className="text-[#00FFFF]">99.9%</span></div>
              <div className="w-full h-1 bg-gray-800"><div className="h-full bg-[#00FFFF] w-[99.9%]" /></div>

              <div className="flex justify-between text-xs mb-1 mt-4"><span className="text-gray-400">Plasma Flow</span><span className="text-[#FFBF00]">Nominal</span></div>
              <div className="w-full h-1 bg-gray-800"><div className="h-full bg-[#FFBF00] w-[85%]" /></div>
            </div>
          </div>

          {/* Cell 3: Volumetric Lattices */}
          <div className="col-span-1 bg-white/40 backdrop-blur-xl border border-black p-8 group hover:border-[#00FFFF] transition-colors cursor-crosshair">
            <h3 className="text-lg font-black uppercase mb-2">Volumetric Lattices</h3>
            <p className="text-xs text-gray-600 mb-6">
              Meta-material structures designed to distribute inertial loads during extreme acceleration phases.
            </p>
            <div className="w-full h-32 border border-gray-300 relative overflow-hidden">
               {/* Decorative lattice pattern */}
               <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
            </div>
          </div>

          {/* Cell 4: Infin-path Drive */}
          <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-gray-900 to-black text-white border border-[#00FFFF] p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00FFFF]/10 rounded-full blur-[60px]" />
            <h3 className="text-2xl font-black uppercase mb-4 text-[#00FFFF]">∞-path Inertial Drive</h3>
            <p className="text-sm text-gray-400 max-w-lg mb-6 leading-relaxed">
              The proprietary engine module responsible for decoupling mass from local gravitational vectors. Utilizes synchronized quantum locked superconductors to generate an isolated metric tensor field.
            </p>
            <button className="px-6 py-2 border border-[#00FFFF] text-[#00FFFF] text-xs font-bold uppercase hover:bg-[#00FFFF] hover:text-black transition-colors">
              Access Schematics
            </button>
          </div>

        </div>
      </section>

      {/* The Micro-Mechanical Layer */}
      <section id="micro" className="border-t border-black bg-white py-24 px-8 relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1">
            <h2 className="text-4xl font-black uppercase mb-6">The Micro-Mechanical Layer</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Precision matters at the atomic level. Our hex-head flange bolts and socket head cap screws are forged from proprietary titanium-iridium alloys, featuring PBR-mapped textures to ensure zero micro-fractures under 50G loads.
            </p>
            <ul className="space-y-2 text-xs font-bold">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#00FFFF]" /> TENSILE STRENGTH: 1800 MPa</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#FFBF00]" /> THERMAL TOLERANCE: 2200K</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-black" /> MASS: 4.2g (per unit)</li>
            </ul>
          </div>
          <div className="flex-1 w-full aspect-square bg-gray-100 border border-gray-300 relative group flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gray-200 opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), repeating-linear-gradient(45deg, #ccc 25%, #eee 25%, #eee 75%, #ccc 75%, #ccc)', backgroundPosition: '0 0, 10px 10px', backgroundSize: '20px 20px' }} />
            <div className="z-10 bg-white border-2 border-black px-6 py-4 transform group-hover:scale-110 transition-transform duration-500 shadow-[10px_10px_0px_rgba(0,0,0,1)]">
               <span className="font-black text-xl tracking-tighter">HEX-CAP-IR-4A</span>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-black/80 backdrop-blur-md border-t border-[#00FFFF] z-50 md:hidden">
        <button className="w-full h-[44px] bg-[#00FFFF] text-black font-black uppercase tracking-widest text-sm hover:bg-[#FFBF00] transition-colors">
          Request Technical Specs
        </button>
      </div>

      {/* Footer */}
      <footer className="bg-black text-white py-12 px-8 border-t border-[#00FFFF] text-center">
         <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">AEROSPACE DESIGN SYNDICATE © 2026</p>
         <p className="text-[10px] text-gray-700">SPECULATIVE ENGINEERING DIVISION</p>
      </footer>
    </div>
  );
}
