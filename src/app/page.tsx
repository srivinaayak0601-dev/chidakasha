"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, ArrowRight, Mail, KeyRound, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  
  type Step = "email" | "otp" | "username";
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [username, setUsername] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      
      setOtpToken(data.token);
      setStep("otp");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, token: otpToken }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Invalid OTP");
      
      setStep("username");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    
    localStorage.setItem("chidakasha_user", JSON.stringify({ email, username }));
    router.push("/home");
  };

  return (
    // Outer canvas (Deepest dark grey, matches dashboard)
    <main className="h-screen w-full bg-[#09090A] text-[#E0E0E0] flex overflow-hidden font-sans p-4 md:p-6 lg:p-8 items-center justify-center">
      
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#8b3dff] rounded-full blur-[200px] opacity-10 pointer-events-none"></div>

      {/* The Floating App Window */}
      <div className="w-full max-w-[440px] bg-[#121214] border border-[#ffffff08] rounded-[32px] overflow-hidden flex flex-col shadow-2xl relative ring-1 ring-black/50 p-10 z-10">
        
        {/* Header */}
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#ffffff05] border border-[#ffffff08] flex items-center justify-center shadow-inner">
            <Sparkles className="w-6 h-6 text-[#8b3dff]" />
          </div>
        </div>

        {/* State 1: Email */}
        {step === "email" && (
          <div className="animate-fade-in flex flex-col h-full">
            <h1 className="text-2xl font-semibold tracking-tight text-white mb-2 text-center" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Welcome to Chidakasha
            </h1>
            <p className="text-[14px] text-[#A0A0A0] mb-8 text-center leading-relaxed">
              Log in or sign up to enter your personal workspace.
            </p>

            {error && <div className="mb-4 text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-lg">{error}</div>}

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-[#707070] group-focus-within:text-[#8b3dff] transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#161618] border border-[#ffffff08] text-white text-[15px] rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:border-[#8b3dff]/50 focus:ring-1 focus:ring-[#8b3dff]/50 transition-all placeholder:text-[#505050]"
                  placeholder="name@example.com"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading || !email} 
                className="w-full bg-[#E0E0E0] text-[#09090A] font-semibold text-[15px] rounded-2xl py-3.5 flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.05)] mt-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue with Email"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        )}

        {/* State 2: OTP */}
        {step === "otp" && (
          <div className="animate-fade-in flex flex-col h-full">
            <h1 className="text-2xl font-semibold tracking-tight text-white mb-2 text-center" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Check your email
            </h1>
            <p className="text-[14px] text-[#A0A0A0] mb-8 text-center leading-relaxed">
              We sent a 6-digit verification code to <br/>
              <span className="text-[#E0E0E0] font-medium">{email}</span>
            </p>

            {error && <div className="mb-4 text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-lg">{error}</div>}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-[#707070] group-focus-within:text-[#8b3dff] transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // only numbers
                  className="w-full bg-[#161618] border border-[#ffffff08] text-white text-[18px] tracking-[0.5em] text-center rounded-2xl pl-10 pr-4 py-3.5 outline-none focus:border-[#8b3dff]/50 focus:ring-1 focus:ring-[#8b3dff]/50 transition-all placeholder:text-[#303030] placeholder:tracking-normal"
                  placeholder="••••••"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || otp.length !== 6} 
                className="w-full bg-[#E0E0E0] text-[#09090A] font-semibold text-[15px] rounded-2xl py-3.5 flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
              </button>
            </form>

            <button 
              onClick={() => setStep("email")}
              className="mt-6 text-[13px] text-[#707070] hover:text-[#E0E0E0] transition-colors text-center w-full"
            >
              Use a different email
            </button>
          </div>
        )}

        {/* State 3: Username */}
        {step === "username" && (
          <div className="animate-fade-in flex flex-col h-full">
            <h1 className="text-2xl font-semibold tracking-tight text-white mb-2 text-center" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Almost there!
            </h1>
            <p className="text-[14px] text-[#A0A0A0] mb-8 text-center leading-relaxed">
              Choose a display name for your workspace.
            </p>

            {error && <div className="mb-4 text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-lg">{error}</div>}

            <form onSubmit={handleSetUsername} className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-[#707070] group-focus-within:text-[#8b3dff] transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#161618] border border-[#ffffff08] text-white text-[15px] rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:border-[#8b3dff]/50 focus:ring-1 focus:ring-[#8b3dff]/50 transition-all placeholder:text-[#505050]"
                  placeholder="Your display name"
                />
              </div>

              <button 
                type="submit" 
                disabled={!username.trim()} 
                className="w-full bg-[#8b3dff] text-white font-semibold text-[15px] rounded-2xl py-3.5 flex items-center justify-center gap-2 hover:bg-[#7a35e0] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(139,61,255,0.2)] mt-2"
              >
                Enter Workspace
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Footer Text */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[12px] text-[#505050]">
        Protected by Chidakasha Security
      </div>

    </main>
  );
}
