"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  LogOut, 
  Image as ImageIcon, 
  Film, 
  Bot, 
  Code, 
  WandSparkles,
  Search,
  Home,
  FolderOpen,
  LayoutTemplate,
  Plus,
  MoreHorizontal,
  Settings,
  ChevronFirst,
  Box
} from "lucide-react";
import VideoEditor from "@/components/VideoEditor";
import CadEditor from "@/components/CadEditor";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; username: string } | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("chidakasha_user");
    if (!storedUser) {
      router.push("/");
      return;
    }
    
    try {
      const parsedUser = JSON.parse(storedUser);
      setTimeout(() => setUser(parsedUser), 0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("chidakasha_user");
    router.push("/");
  };

  if (!user) return null; // Or a loading spinner

  const mainTools = [
    { name: "Photo & Poster", icon: ImageIcon, color: "text-blue-400", bg: "bg-[#252629]" },
    { name: "Video Edit", icon: Film, color: "text-purple-400", bg: "bg-[#252629]" },
    { name: "3D CAD", icon: Box, color: "text-yellow-400", bg: "bg-[#252629]" },
    { name: "AI Guide", icon: Bot, color: "text-emerald-400", bg: "bg-[#252629]" },
    { name: "Code", icon: Code, color: "text-orange-400", bg: "bg-[#252629]" },
    { name: "Enhance", icon: WandSparkles, color: "text-pink-400", bg: "bg-[#252629]" },
  ];

  return (
    // Canva Dark Mode base
    <main className="h-screen w-full bg-[#18191b] text-white flex font-sans">
      
      {/* Sidebar (Flush to edge) */}
      <aside className={`bg-[#18191b] border-r border-[#ffffff15] flex flex-col z-10 flex-shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-[260px]'}`}>
        
        {/* Profile Header */}
        <div className={`p-4 flex items-center gap-3 mt-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user.username.charAt(0).toUpperCase()}
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <h2 className="text-[14px] font-semibold text-white truncate" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                {user.username}&apos;s Workspace
              </h2>
              <p className="text-[12px] text-[#A0A0A0] truncate">Free</p>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <div className="px-4 mb-6 mt-2">
          <button className={`w-full bg-[#8b3dff] hover:bg-[#7a35e0] text-white font-semibold text-[14px] rounded-lg py-2.5 flex items-center justify-center gap-2 transition-all ${isSidebarCollapsed ? 'p-2' : 'px-4'}`}>
            <Plus className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span>Create a design</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 no-scrollbar">
          <button 
            onClick={() => setActiveTool(null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] font-medium transition-colors ${isSidebarCollapsed ? 'justify-center' : ''} ${!activeTool ? 'bg-[#ffffff10] text-white' : 'text-[#c0c0c0] hover:bg-[#ffffff08]'}`}
            title="Home"
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span>Home</span>}
          </button>
          <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] font-medium text-[#c0c0c0] hover:bg-[#ffffff08] transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`} title="Projects">
            <FolderOpen className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span>Projects</span>}
          </button>
          <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] font-medium text-[#c0c0c0] hover:bg-[#ffffff08] transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`} title="Templates">
            <LayoutTemplate className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span>Templates</span>}
          </button>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#ffffff15]">
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] font-medium text-[#A0A0A0] hover:bg-[#ffffff08] hover:text-white transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex-1 relative flex flex-col bg-[#18191b] overflow-y-auto scroll-smooth">
        
        {/* Top Navbar */}
        <header className="h-16 flex items-center px-8 justify-between sticky top-0 bg-[#18191b]/90 backdrop-blur-sm z-20">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 hover:bg-[#ffffff10] rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <ChevronFirst className={`w-5 h-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
            <span className="font-bold text-xl tracking-tight" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Chidakasha
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-[#ffffff10] flex items-center justify-center cursor-pointer hover:bg-[#ffffff20] transition-colors">
              <Settings className="w-4 h-4 text-[#E0E0E0]" />
            </div>
          </div>
        </header>

        {activeTool === "Video Edit" ? (
          <div className="w-full flex flex-col">
            <div className="p-6">
              <VideoEditor />
            </div>
          </div>
        ) : activeTool === "3D CAD" ? (
          <div className="w-full h-[calc(100vh-64px)] p-6 flex flex-col">
            <CadEditor />
          </div>
        ) : (
          /* Content Body */
          <div className="flex-1 pb-12">
          
          {/* Canva Signature Gradient Banner */}
          <div className="w-full bg-gradient-to-r from-[#00c4cc] via-[#7d2ae8] to-[#ff0099] pt-12 pb-16 px-8 rounded-b-[24px] relative overflow-hidden">
            {/* Soft decorative blur circles to mimic Canva's fluid gradients */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/4"></div>

            <div className="max-w-4xl mx-auto relative z-10 text-center">
              <h1 className="text-[32px] md:text-[40px] font-bold text-white mb-8" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                What will you create today, {user.username}?
              </h1>
              
              {/* Search Bar */}
              <div className="max-w-2xl mx-auto relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 group-focus-within:text-[#8b3dff] transition-colors" />
                </div>
                <input
                  type="text"
                  className="w-full bg-white text-black text-[16px] rounded-full pl-14 pr-6 py-4 shadow-lg outline-none focus:ring-4 focus:ring-[#8b3dff]/30 transition-all placeholder:text-gray-500 font-medium"
                  placeholder="Search your content or Chidakasha's templates"
                />
              </div>
            </div>
          </div>

          <div className="max-w-[1200px] mx-auto px-8 -mt-6 relative z-20">
            
            {/* Horizontal Tool Row */}
            <div className="flex items-center justify-center gap-4 md:gap-6 mb-12 flex-wrap">
              {mainTools.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => setActiveTool(tool.name)}
                  className="flex flex-col items-center justify-center gap-3 group w-[100px]"
                >
                  <div className={`w-16 h-16 rounded-[20px] ${tool.bg} border border-[#ffffff15] flex items-center justify-center shadow-lg group-hover:bg-[#303135] group-active:scale-95 transition-all ${activeTool === tool.name ? 'ring-2 ring-[#8b3dff]' : ''}`}>
                    <tool.icon className={`w-7 h-7 ${tool.color}`} />
                  </div>
                  <span className="text-[13px] font-medium text-[#c0c0c0] group-hover:text-white transition-colors">
                    {tool.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Recent Designs Section */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                  Recent designs
                </h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {/* Empty State / Placeholder Cards */}
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="aspect-video bg-[#252629] rounded-xl border border-[#ffffff10] mb-3 relative overflow-hidden group-hover:border-[#ffffff30] transition-colors">
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <MoreHorizontal className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <p className="text-[14px] font-medium text-white truncate">Untitled Design {i}</p>
                    <p className="text-[12px] text-[#A0A0A0]">Edited just now</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
      </section>
    </main>
  );
}
