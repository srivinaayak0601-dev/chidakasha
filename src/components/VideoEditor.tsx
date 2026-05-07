"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Plus, Play, Pause, Scissors, Trash2, Video as VideoIcon,
  ChevronLast, ChevronFirst, Copy, Layout, Music, Undo2, Palette, Type as TextIcon, Settings2, Save, Cloud
} from "lucide-react";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";

type AspectRatio = "16/9" | "9/16" | "1/1";

interface VideoAsset {
  id: string; name: string; url: string; thumbnail: string; duration: number;
}

interface TimelineClip {
  id: string; assetId: string; startTime: number; duration: number; track: number;
  scale: number; posX: number; posY: number; opacity: number; blendMode: string;
  isVisible: boolean; isLocked: boolean; gain: number; isFlashing?: boolean;
  brightness: number; contrast: number; saturation: number;
  text?: string; fontSize?: number; textColor?: string;
}

export default function VideoEditor() {
  const [projectFormat, setProjectFormat] = useState<AspectRatio | null>(null);
  const [assets, setAssets] = useState<VideoAsset[]>([]);
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
  const [tracks, setTracks] = useState<number[]>([0, 1, 2]); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(60); 
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activePanel, setActivePanel] = useState<"edit" | "audio" | "text" | "color">("edit");
  const [isDraggingClip, setIsDraggingClip] = useState<string | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartClipTime, setDragStartClipTime] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const activeClip = timelineClips.find(c => selectedClipIds.includes(c.id));

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const storageRef = ref(storage, `assets/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => console.error(error),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setAssets(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: file.name, url: downloadURL, thumbnail: "", duration: 15 }]);
          setUploadProgress(0);
        }
      );
    }
  }

  async function saveProject() {
    const projectId = "project_" + Date.now();
    try {
      await setDoc(doc(db, "projects", projectId), {
        format: projectFormat,
        assets,
        clips: timelineClips,
        tracks,
        duration: totalDuration,
        updatedAt: new Date().toISOString()
      });
      alert("Project saved to Cloud!");
    } catch (e) {
      alert("Failed to save project.");
    }
  }

  function handleTimelineMouseDown(e: React.MouseEvent) {
    if (timelineContentRef.current) {
      setIsDraggingPlayhead(true);
      updatePlayheadPosition(e.clientX);
    }
  }

  function updatePlayheadPosition(clientX: number) {
    if (timelineContentRef.current) {
      const rect = timelineContentRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      setCurrentTime((x / rect.width) * totalDuration);
    }
  }

  function onAssetDrop(e: React.DragEvent, trackIndex: number) {
    e.preventDefault();
    const assetId = e.dataTransfer.getData("assetId");
    const asset = assets.find((a) => a.id === assetId);
    if (asset && timelineContentRef.current) {
      const rect = timelineContentRef.current.getBoundingClientRect();
      const startTime = ((e.clientX - rect.left) / rect.width) * totalDuration;
      const newClip: TimelineClip = {
        id: Math.random().toString(36).substr(2, 9),
        assetId: asset.id, startTime: Math.max(0, startTime), duration: asset.duration,
        track: trackIndex, scale: trackIndex === 0 ? 100 : 40, posX: 0, posY: 0, opacity: 100,
        blendMode: "normal", isVisible: true, isLocked: false, gain: 1.0,
        brightness: 100, contrast: 100, saturation: 100
      };
      setTimelineClips((prev) => [...prev, newClip]);
      setSelectedClipIds([newClip.id]);
    }
  }

  function startClipDrag(e: React.MouseEvent, clip: TimelineClip) {
    e.stopPropagation();
    setSelectedClipIds([clip.id]);
    setIsDraggingClip(clip.id);
    setDragStartX(e.clientX);
    setDragStartClipTime(clip.startTime);
    setCurrentTime(clip.startTime);
  }

  function addTextOverlay() {
    const newClip: TimelineClip = {
      id: Math.random().toString(36).substr(2, 9),
      assetId: "text-layer", startTime: currentTime, duration: 5, track: tracks.length - 1,
      scale: 100, posX: 0, posY: 0, opacity: 100, blendMode: "normal", isVisible: true, isLocked: false, gain: 0,
      brightness: 100, contrast: 100, saturation: 100, text: "New Text", fontSize: 32, textColor: "#ffffff"
    };
    setTimelineClips((prev) => [...prev, newClip]);
    setSelectedClipIds([newClip.id]);
    setActivePanel("text");
  }

  function handleSplit() {
    if (selectedClipIds.length !== 1) return;
    const clipId = selectedClipIds[0];
    const clip = timelineClips.find(c => c.id === clipId);
    if (clip && currentTime > clip.startTime && currentTime < (clip.startTime + clip.duration)) {
      const splitPoint = currentTime - clip.startTime;
      const firstHalf: TimelineClip = { ...clip, duration: splitPoint };
      const secondHalf: TimelineClip = { ...clip, id: Math.random().toString(36).substr(2, 9), startTime: currentTime, duration: clip.duration - splitPoint, isFlashing: true };
      setTimelineClips(prev => [...prev.filter(c => c.id !== clipId), firstHalf, secondHalf]);
      setSelectedClipIds([secondHalf.id]);
      setTimeout(() => setTimelineClips(prev => prev.map(c => c.id === secondHalf.id ? { ...c, isFlashing: false } : c)), 200);
    }
  }

  function handleDuplicate() {
    if (selectedClipIds.length !== 1) return;
    const clip = timelineClips.find(c => c.id === selectedClipIds[0]);
    if (clip) {
      const newClip: TimelineClip = { ...clip, id: Math.random().toString(36).substr(2, 9), startTime: clip.startTime + clip.duration };
      setTimelineClips(prev => [...prev, newClip]);
      setSelectedClipIds([newClip.id]);
    }
  }

  function updateClipProperty(id: string, property: keyof TimelineClip, value: any) {
    setTimelineClips(prev => prev.map(c => c.id === id ? { ...c, [property]: value } : c));
  }

  const togglePlay = () => setIsPlaying(!isPlaying);
  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isDraggingPlayhead) updatePlayheadPosition(e.clientX);
      if (isDraggingClip && timelineContentRef.current) {
        const deltaX = e.clientX - dragStartX;
        const rect = timelineContentRef.current.getBoundingClientRect();
        const deltaTime = (deltaX / rect.width) * totalDuration;
        let newStart = Math.max(0, dragStartClipTime + deltaTime);
        const current = timelineClips.find(c => c.id === isDraggingClip);
        if (current) {
          const others = timelineClips.filter(c => c.track === current.track && c.id !== current.id);
          const hasOverlap = others.some(c => (newStart >= c.startTime && newStart < c.startTime + c.duration) || (newStart + current.duration > c.startTime && newStart + current.duration <= c.startTime + c.duration) || (newStart <= c.startTime && newStart + current.duration >= c.startTime + c.duration));
          if (!hasOverlap) { setTimelineClips(prev => prev.map(c => c.id === isDraggingClip ? { ...c, startTime: newStart } : c)); setCurrentTime(newStart); }
        }
      }
    };
    const handleUp = () => { setIsDraggingPlayhead(false); setIsDraggingClip(null); };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [isDraggingPlayhead, isDraggingClip, dragStartX, dragStartClipTime, timelineClips, totalDuration]);

  useEffect(() => {
    let frameId: number;
    const update = () => {
      if (isPlaying) {
        setCurrentTime(prev => { const next = prev + 0.0166; return next >= totalDuration ? 0 : next; });
        frameId = requestAnimationFrame(update);
      }
    };
    if (isPlaying) frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, totalDuration]);

  if (!projectFormat) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0d0d0d] flex items-center justify-center p-6">
        <div className="max-w-4xl w-full flex flex-col items-center">
          <div className="flex items-center gap-3 mb-12"><h1 className="text-3xl font-black text-white tracking-tighter uppercase">New Project</h1></div>
          <div className="grid grid-cols-3 gap-8 w-full">
            {["16/9", "9/16", "1/1"].map(f => (
              <button key={f} onClick={() => setProjectFormat(f as AspectRatio)} className="group bg-[#1a1a1a] border border-white/5 rounded-[32px] p-10 hover:border-blue-500 hover:bg-blue-500/5 transition-all text-center flex flex-col items-center gap-6">
                <div className={`w-24 border-2 border-white/10 rounded-xl group-hover:border-blue-500 transition-colors ${f==='16/9'?'aspect-video':f==='9/16'?'aspect-[9/16] h-24 w-auto':'aspect-square'}`}></div>
                <span className="text-lg font-black text-white uppercase tracking-tighter">{f==='16/9'?'Horizontal':f==='9/16'?'Vertical':'Square'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#141414] text-gray-200 overflow-hidden font-sans select-none">
      <style jsx global>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0d0d0d; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #444; }
      `}</style>

      <header className="h-14 border-b border-white/5 bg-[#0d0d0d] flex items-center px-8 justify-between z-[90]">
        <div className="flex items-center gap-6">
          <button onClick={() => setProjectFormat(null)} className="text-[10px] font-black text-gray-600 hover:text-white transition-colors uppercase tracking-[2px]">Reset</button>
          <button onClick={saveProject} className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"><Save className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Save Cloud</span></button>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-all"><Undo2 className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Undo</span></button>
          <button className="bg-blue-600 text-white px-8 py-2 rounded-full text-[11px] font-black uppercase tracking-tighter hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30">Export</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className={`bg-[#0d0d0d] border-r border-white/5 flex flex-col items-center py-6 gap-6 z-[85] transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
          <div className="w-full flex items-center justify-between px-4 mb-2">
            {isSidebarOpen && <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Assets</span>}
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 transition-colors mx-auto">
              {isSidebarOpen ? <ChevronFirst className="w-5 h-5" /> : <ChevronLast className="w-5 h-5" />}
            </button>
          </div>
          <div 
            className="flex flex-col gap-4 w-full px-3 items-center overflow-y-auto no-scrollbar pb-10"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                Array.from(files).forEach(async (file) => {
                  if (file.type.startsWith('video/')) {
                    const storageRef = ref(storage, `assets/${Date.now()}_${file.name}`);
                    const uploadTask = uploadBytesResumable(storageRef, file);
                    uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes)*100), (err) => console.error(err), async () => {
                      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                      setAssets(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: file.name, url: downloadURL, thumbnail: "", duration: 15 }]);
                      setUploadProgress(0);
                    });
                  }
                });
              }
            }}
          >
            <button onClick={() => fileInputRef.current?.click()} className="w-full aspect-square max-w-[48px] bg-blue-600/10 text-blue-500 rounded-xl hover:bg-blue-600/20 transition-all flex items-center justify-center border border-blue-500/20 shadow-lg relative overflow-hidden">
              {uploadProgress > 0 ? <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-500">{Math.round(uploadProgress)}%</div> : <Plus className="w-6 h-6" />}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="video/*" />
            {assets.map(a => (
              <div key={a.id} draggable onDragStart={(e) => e.dataTransfer.setData("assetId", a.id)} className={`w-full aspect-video bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden relative group cursor-grab shadow-lg transition-all ${!isSidebarOpen && 'h-0 opacity-0'}`}>
                <video src={a.url} className="w-full h-full object-cover opacity-50 group-hover:opacity-100" muted onLoadedData={e => e.currentTarget.currentTime = 1} />
                <span className="absolute bottom-1 right-1 text-[8px] font-black bg-black/60 px-1.5 py-0.5 rounded text-blue-400">{formatDuration(a.duration)}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-[#141414] overflow-hidden relative">
          <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-black/20">
            <div className="h-full shadow-[0_0_100px_rgba(0,0,0,0.8)] bg-black rounded-3xl overflow-hidden relative border border-white/5" style={{ aspectRatio: projectFormat.split('/').join(' / ') }}>
              {tracks.slice().reverse().map(tId => (
                <div key={tId} className="absolute inset-0 pointer-events-none">
                  {timelineClips.filter(c => c.track === tId && c.isVisible).map(clip => {
                    const isActive = currentTime >= clip.startTime && currentTime <= (clip.startTime + clip.duration);
                    if (!isActive) return null;
                    return (
                      <div key={clip.id} className="absolute inset-0 flex items-center justify-center" style={{ opacity: clip.opacity / 100, mixBlendMode: clip.blendMode as any, zIndex: clip.track + 10 }}>
                        <div className="w-full h-full relative flex items-center justify-center" style={{ width: `${clip.scale}%`, height: `${clip.scale}%`, transform: `translate(${clip.posX}px, ${clip.posY}px)` }}>
                          {clip.assetId === "text-layer" ? (
                            <span className="text-center font-black break-words px-4" style={{ fontSize: `${clip.fontSize}px`, color: clip.textColor }}>{clip.text}</span>
                          ) : (
                            <video 
                              src={assets.find(a => a.id === clip.assetId)?.url} className="w-full h-full object-contain" style={{ filter: `brightness(${clip.brightness}%) contrast(${clip.contrast}%) saturate(${clip.saturation}%)` }}
                              playsInline ref={el => { if (el) { const target = Math.max(0, currentTime - clip.startTime); if (Math.abs(el.currentTime - target) > 0.1) el.currentTime = target; el.volume = Math.min(1, clip.gain); isPlaying ? el.play().catch(() => {}) : el.pause(); }}}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-[#0d0d0d]/80 backdrop-blur-xl px-10 py-3 rounded-full border border-white/10 z-[95]">
                <button onClick={togglePlay} className="text-white hover:text-blue-500 transition-all">{isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}</button>
                <span className="text-sm font-mono font-black text-white/90">{formatDuration(currentTime)}</span>
              </div>
            </div>
          </div>
        </main>

        <aside className="w-72 bg-[#0d0d0d] border-l border-white/5 flex flex-col p-6 overflow-y-auto no-scrollbar z-[85]">
          <div className="flex items-center justify-between mb-8">
            {[ { id: 'edit', icon: Layout }, { id: 'color', icon: Palette }, { id: 'text', icon: TextIcon }, { id: 'audio', icon: Music } ].map(tab => (
              <button key={tab.id} onClick={() => setActivePanel(tab.id as any)} className={`p-2.5 rounded-xl transition-all ${activePanel === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}><tab.icon className="w-5 h-5" /></button>
            ))}
          </div>
          {activeClip ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h3 className="text-[11px] font-black uppercase tracking-[3px] text-blue-500">{activePanel}</h3>
              {activePanel === "edit" && (
                <div className="space-y-6">
                  <div className="space-y-4"><div className="flex justify-between text-[10px] font-black text-gray-500 uppercase"><span>Scale</span><span>{activeClip.scale}%</span></div><input type="range" min="10" max="200" value={activeClip.scale} onChange={e => updateClipProperty(activeClip.id, 'scale', parseInt(e.target.value))} className="w-full accent-blue-600" /></div>
                  <div className="space-y-4"><div className="flex justify-between text-[10px] font-black text-gray-500 uppercase"><span>Opacity</span><span>{activeClip.opacity}%</span></div><input type="range" min="0" max="100" value={activeClip.opacity} onChange={e => updateClipProperty(activeClip.id, 'opacity', parseInt(e.target.value))} className="w-full accent-blue-600" /></div>
                </div>
              )}
              {activePanel === "color" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-2">
                    {[ { n: 'Normal', b: 100, c: 100, s: 100 }, { n: 'B&W', b: 110, c: 130, s: 0 }, { n: 'Vivid', b: 100, c: 130, s: 150 }, { n: 'Sepia', b: 90, c: 100, s: 50 } ].map(p => (
                      <button key={p.n} onClick={() => { updateClipProperty(activeClip.id, 'brightness', p.b); updateClipProperty(activeClip.id, 'contrast', p.c); updateClipProperty(activeClip.id, 'saturation', p.s); }} className="px-3 py-2 bg-white/5 rounded-lg text-[9px] font-black text-gray-400 hover:text-white border border-transparent hover:border-blue-500 transition-all uppercase">{p.n}</button>
                    ))}
                  </div>
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase"><span>Brightness</span><span>{activeClip.brightness}%</span></div><input type="range" min="50" max="150" value={activeClip.brightness} onChange={e => updateClipProperty(activeClip.id, 'brightness', parseInt(e.target.value))} className="w-full accent-blue-600" />
                    <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase"><span>Contrast</span><span>{activeClip.contrast}%</span></div><input type="range" min="50" max="150" value={activeClip.contrast} onChange={e => updateClipProperty(activeClip.id, 'contrast', parseInt(e.target.value))} className="w-full accent-blue-600" />
                    <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase"><span>Saturation</span><span>{activeClip.saturation}%</span></div><input type="range" min="0" max="200" value={activeClip.saturation} onChange={e => updateClipProperty(activeClip.id, 'saturation', parseInt(e.target.value))} className="w-full accent-blue-600" />
                  </div>
                </div>
              )}
              {activePanel === "text" && activeClip.assetId === "text-layer" && (
                <div className="space-y-6">
                  <textarea value={activeClip.text} onChange={e => updateClipProperty(activeClip.id, 'text', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-black text-white outline-none focus:border-blue-500 h-24" />
                  <div className="space-y-4"><div className="flex justify-between text-[10px] font-black text-gray-500 uppercase"><span>Size</span><span>{activeClip.fontSize}px</span></div><input type="range" min="12" max="120" value={activeClip.fontSize} onChange={e => updateClipProperty(activeClip.id, 'fontSize', parseInt(e.target.value))} className="w-full accent-blue-600" /></div>
                  <input type="color" value={activeClip.textColor} onChange={e => updateClipProperty(activeClip.id, 'textColor', e.target.value)} className="w-full h-10 bg-transparent cursor-pointer rounded-lg" />
                </div>
              )}
              {activePanel === "audio" && (
                <div className="space-y-4"><div className="flex justify-between text-[10px] font-black text-gray-500 uppercase"><span>Gain</span><span>{Math.round(activeClip.gain * 100)}%</span></div><input type="range" min="0" max="4" step="0.1" value={activeClip.gain} onChange={e => updateClipProperty(activeClip.id, 'gain', parseFloat(e.target.value))} className="w-full accent-blue-600" /></div>
              )}
            </div>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center opacity-10 text-center"><Settings2 className="w-10 h-10 mb-4" /><p className="text-[9px] font-black uppercase tracking-[4px]">Select Clip</p></div>
          )}
        </aside>
      </div>

      <div className="h-64 bg-[#0d0d0d] border-t border-white/5 flex flex-col z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="h-12 border-b border-white/5 flex items-center px-8 justify-between bg-[#111] sticky top-0 z-[110]">
          <div className="flex items-center gap-2">
            <button onClick={handleSplit} disabled={!activeClip} className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-all disabled:opacity-20"><Scissors className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">Split</span></button>
            <button onClick={handleDuplicate} disabled={!activeClip} className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-all disabled:opacity-20"><Copy className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">Clone</span></button>
            <button onClick={addTextOverlay} className="flex items-center gap-2 px-4 py-2 rounded-lg text-blue-500 hover:bg-blue-600/10 transition-all"><TextIcon className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">Text</span></button>
            <button onClick={() => selectedClipIds.forEach(id => setTimelineClips(prev => prev.filter(c => c.id !== id)))} className="p-2 text-gray-600 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 hover:scale-110 active:scale-95 transition-all">{isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}</button>
            <span className="text-[11px] font-mono font-black text-blue-500 tracking-[1px]">{formatDuration(currentTime)} / {formatDuration(totalDuration)}</span>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-16 bg-[#0d0d0d] border-r border-white/5 flex flex-col py-8 overflow-y-auto no-scrollbar">
            {tracks.slice().reverse().map(tId => (
              <div key={tId} className="h-14 flex items-center justify-center border-b border-white/5 flex-shrink-0 opacity-20"><span className="text-[8px] font-black text-white">{tId === 0 ? 'V1' : `V${tId+1}`}</span></div>
            ))}
          </div>
          <div ref={timelineContentRef} className="flex-1 relative overflow-x-auto overflow-y-auto bg-[#0a0a0a] pt-12 no-scrollbar cursor-crosshair" onMouseDown={handleTimelineMouseDown}>
            <div className="absolute top-0 bottom-0 w-[2px] bg-blue-500 z-[120] pointer-events-none shadow-[0_0_15px_#3b82f6]" style={{ left: `calc(${(currentTime / totalDuration) * 100}%)`, transition: isPlaying || isDraggingPlayhead ? 'none' : 'left 0.1s linear' }}><div className="w-4 h-4 bg-blue-500 rounded-full -ml-[7px] -mt-2 shadow-[0_0_15px_rgba(59,130,246,0.5)] flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div></div>
            <div className="absolute top-0 left-0 right-0 h-10 flex border-b border-white/5 bg-[#111] z-[105]">{Array.from({ length: 11 }).map((_, i) => (<div key={i} className="flex-1 border-l border-white/5 text-[8px] font-black text-white/10 pl-3 pt-3">{formatDuration(i * 6)}</div>))}</div>
            <div className="flex flex-col min-w-full">
              {tracks.slice().reverse().map(tId => (
                <div key={tId} onDragOver={e => e.preventDefault()} onDrop={e => onAssetDrop(e, tId)} className="h-14 w-[300%] border-b border-white/5 relative hover:bg-white/[0.01] flex-shrink-0">
                  {timelineClips.filter(c => c.track === tId).map(clip => (
                    <div key={clip.id} onMouseDown={e => { e.stopPropagation(); startClipDrag(e, clip); }} className={`absolute top-1 bottom-1 rounded-xl border-2 p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing transition-all z-[100] overflow-hidden ${selectedClipIds.includes(clip.id) ? 'bg-blue-600/30 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]' : 'bg-[#1a1a1a] border-white/5 hover:border-white/10'} ${clip.isFlashing ? 'ring-2 ring-white animate-pulse' : ''}`} style={{ left: `${(clip.startTime / totalDuration) * 100}%`, width: `${(clip.duration / totalDuration) * 100}%` }}>
                      {clip.assetId === 'text-layer' ? <TextIcon className="w-3.5 h-3.5 text-blue-500" /> : <VideoIcon className="w-3.5 h-3.5 text-gray-700" />}
                      <span className="text-[9px] font-black text-gray-300 truncate uppercase tracking-tighter">{clip.assetId === 'text-layer' ? clip.text : assets.find(a => a.id === clip.assetId)?.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
