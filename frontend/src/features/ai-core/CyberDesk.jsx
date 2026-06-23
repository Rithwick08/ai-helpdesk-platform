import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform } from "framer-motion";
import { Mic, Send, Paperclip, Bell, ChevronRight, Zap, Activity, Shield, Ticket, Hash, Clock, CheckCircle2, Loader2, X, Volume2 } from "lucide-react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATES = { IDLE: "idle", LISTENING: "listening", RESPONDING: "responding" };

const STAR_COUNT = 28;
const STARS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  x: 50 + 42 * Math.cos((i / STAR_COUNT) * Math.PI * 2 + Math.random() * 0.8),
  y: 50 + 42 * Math.sin((i / STAR_COUNT) * Math.PI * 2 + Math.random() * 0.8),
  size: 1.5 + Math.random() * 2.5,
  delay: Math.random() * 3,
  orbitRadius: 35 + Math.random() * 25,
  orbitAngle: (i / STAR_COUNT) * Math.PI * 2,
  speed: 0.3 + Math.random() * 0.4,
}));

const CONNECTIONS = (() => {
  const conns = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    for (let j = i + 1; j < STAR_COUNT; j++) {
      const dx = STARS[i].x - STARS[j].x;
      const dy = STARS[i].y - STARS[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 22) conns.push({ from: i, to: j, dist });
    }
  }
  return conns;
})();

const SAMPLE_MESSAGES = [
  { id: 1, role: "assistant", text: "CyberDesk AI online. All systems operational. How can I assist you today?", time: "14:22" },
  { id: 2, role: "user", text: "I need help resetting my VPN credentials.", time: "14:23" },
  { id: 3, role: "assistant", text: "Understood. Initiating VPN credential reset protocol. Please verify your identity with your employee ID.", time: "14:23" },
];

const INTENTS = ["VPN Support", "Password Reset", "Security Incident", "Hardware Request", "Software License"];
const TICKET_ID = "INC-2024-8847";
const SESSION_ID = "SES-4F92A1";

// ─── FLOATING PARTICLES ───────────────────────────────────────────────────────
function FloatingParticles() {
  const particles = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 10,
    opacity: 0.1 + Math.random() * 0.3,
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `rgba(0, 212, 255, ${p.opacity})`,
            boxShadow: `0 0 ${p.size * 3}px rgba(0, 212, 255, ${p.opacity * 0.8})`,
          }}
          animate={{
            y: [0, -80, -160, -80, 0],
            x: [0, 20, -10, 30, 0],
            opacity: [0, p.opacity, p.opacity * 0.7, p.opacity, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── GRID BACKGROUND ─────────────────────────────────────────────────────────
function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#00d4ff" strokeWidth="0.5" />
          </pattern>
          <pattern id="gridLarge" width="300" height="300" patternUnits="userSpaceOnUse">
            <path d="M 300 0 L 0 0 0 300" fill="none" stroke="#00d4ff" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#gridLarge)" />
      </svg>
    </div>
  );
}

// ─── CONSTELLATION CORE ───────────────────────────────────────────────────────
function ConstellationCore({ state, onToggle }) {
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0);
  const canvasRef = useRef(null);
  const [dims, setDims] = useState({ w: 420, h: 420 });

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { w, h } = dims;
    canvas.width = w;
    canvas.height = h;
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / 420;

    let frame = 0;
    const draw = (timestamp) => {
      timeRef.current = timestamp * 0.001;
      const t = timeRef.current;
      ctx.clearRect(0, 0, w, h);

      const rotationSpeed = state === STATES.IDLE ? 0.05 : state === STATES.LISTENING ? 0.15 : 0.08;
      const rotation = t * rotationSpeed;

      // Compute star positions
      const positions = STARS.map((s) => {
        const angle = s.orbitAngle + rotation * s.speed;
        const contractionFactor = state === STATES.LISTENING
          ? 0.55 + 0.45 * Math.sin(t * 2)
          : 1;
        const r = s.orbitRadius * scale * contractionFactor;
        const twinkle = state === STATES.RESPONDING
          ? 0.5 + 0.5 * Math.sin(t * 4 + s.delay)
          : 0.4 + 0.4 * Math.sin(t * 0.8 + s.delay);
        return {
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
          brightness: twinkle,
          size: s.size * scale,
        };
      });

      // Draw connections
      CONNECTIONS.forEach(({ from, to, dist }) => {
        const pf = positions[from];
        const pt = positions[to];
        const alpha = state === STATES.RESPONDING
          ? 0.15 + 0.25 * Math.sin(t * 3 + (from + to) * 0.3)
          : 0.08 + 0.06 * Math.sin(t * 0.5 + (from + to) * 0.2);

        // Traveling energy along lines
        if (state === STATES.RESPONDING) {
          const prog = ((t * 1.5 + from * 0.15) % 1);
          const ex = pf.x + (pt.x - pf.x) * prog;
          const ey = pf.y + (pt.y - pf.y) * prog;
          const energyGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6 * scale);
          energyGrad.addColorStop(0, "rgba(0,212,255,0.9)");
          energyGrad.addColorStop(1, "rgba(0,212,255,0)");
          ctx.fillStyle = energyGrad;
          ctx.beginPath();
          ctx.arc(ex, ey, 4 * scale, 0, Math.PI * 2);
          ctx.fill();
        }

        const grad = ctx.createLinearGradient(pf.x, pf.y, pt.x, pt.y);
        const color = state === STATES.RESPONDING ? `rgba(0,212,255,${alpha})` : `rgba(100,180,255,${alpha})`;
        grad.addColorStop(0, color);
        grad.addColorStop(0.5, state === STATES.RESPONDING ? `rgba(120,80,255,${alpha * 1.5})` : color);
        grad.addColorStop(1, color);

        ctx.beginPath();
        ctx.moveTo(pf.x, pf.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.6 * scale;
        ctx.stroke();
      });

      // Draw stars
      positions.forEach((p, i) => {
        const starColor = state === STATES.RESPONDING
          ? `rgba(0,212,255,${p.brightness})`
          : state === STATES.LISTENING
          ? `rgba(100,200,255,${p.brightness * 0.9})`
          : `rgba(150,200,255,${p.brightness * 0.7})`;

        const glowR = (STARS[i].size * 3 + (state === STATES.RESPONDING ? 4 : 2)) * scale;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        glow.addColorStop(0, starColor);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = starColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Waveform ring (listening/responding)
      if (state !== STATES.IDLE) {
        const wavePoints = 120;
        const waveR = 80 * scale;
        ctx.beginPath();
        for (let i = 0; i <= wavePoints; i++) {
          const angle = (i / wavePoints) * Math.PI * 2;
          const amp = state === STATES.RESPONDING
            ? 8 + 6 * Math.sin(t * 8 + i * 0.4) + 4 * Math.sin(t * 12 + i * 0.2)
            : 4 + 3 * Math.sin(t * 6 + i * 0.5);
          const r = waveR + amp * scale;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        const waveAlpha = state === STATES.RESPONDING ? 0.6 : 0.4;
        ctx.strokeStyle = `rgba(0,212,255,${waveAlpha})`;
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();
      }

      // Outer rings
      [130, 160, 185].forEach((r, i) => {
        const ringR = r * scale;
        const alpha = state === STATES.RESPONDING
          ? 0.12 + 0.08 * Math.sin(t * 2 + i * 1.2)
          : 0.06 + 0.03 * Math.sin(t * 0.6 + i);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,150,255,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4 * scale, 8 * scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [dims, state]);

  // Orb config by state
  const orbScale = state === STATES.LISTENING ? 1.18 : state === STATES.RESPONDING ? 1.12 : 1;
  const orbGlow = state === STATES.RESPONDING ? "0 0 60px rgba(0,212,255,0.8), 0 0 120px rgba(0,100,255,0.4)"
    : state === STATES.LISTENING ? "0 0 50px rgba(0,212,255,0.7), 0 0 100px rgba(0,150,255,0.3)"
    : "0 0 30px rgba(0,150,255,0.4), 0 0 60px rgba(0,100,255,0.2)";

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center cursor-pointer select-none"
      style={{ width: "min(420px, 90vw)", height: "min(420px, 90vw)" }}
      onClick={onToggle}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Expanding rings on listen */}
      <AnimatePresence>
        {state === STATES.LISTENING && [0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-cyan-400/30"
            initial={{ width: "20%", height: "20%", opacity: 0.8 }}
            animate={{ width: "85%", height: "85%", opacity: 0 }}
            transition={{ duration: 2, delay: i * 0.65, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>

      {/* Central Orb */}
      <motion.div
        className="relative z-10 flex items-center justify-center rounded-full"
        animate={{ scale: orbScale }}
        transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
        style={{
          width: "min(96px, 23vw)",
          height: "min(96px, 23vw)",
          background: "radial-gradient(circle at 35% 35%, rgba(0,212,255,0.25) 0%, rgba(0,80,180,0.4) 50%, rgba(0,20,60,0.95) 100%)",
          border: "1px solid rgba(0,212,255,0.5)",
          boxShadow: orbGlow,
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Inner glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: "1px solid rgba(0,212,255,0.3)" }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: state === STATES.RESPONDING ? 0.8 : 2.5, repeat: Infinity }}
        />

        {/* Mic icon */}
        <motion.div
          animate={{ scale: state === STATES.LISTENING ? [1, 1.15, 1] : 1 }}
          transition={{ duration: 0.4, repeat: state === STATES.LISTENING ? Infinity : 0 }}
        >
          {state === STATES.RESPONDING ? (
            <Volume2
              className="text-cyan-300"
              style={{ width: "min(28px, 6vw)", height: "min(28px, 6vw)" }}
            />
          ) : (
            <Mic
              className={state === STATES.LISTENING ? "text-cyan-200" : "text-cyan-400"}
              style={{
                width: "min(28px, 6vw)",
                height: "min(28px, 6vw)",
                filter: `drop-shadow(0 0 8px rgba(0,212,255,${state === STATES.IDLE ? 0.5 : 0.9}))`,
              }}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── TOP NAV ─────────────────────────────────────────────────────────────────
function TopNav() {
  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4"
      style={{
        background: "linear-gradient(180deg, rgba(0,8,30,0.95) 0%, rgba(0,8,30,0) 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <motion.div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 36, height: 36,
            background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,80,200,0.3))",
            border: "1px solid rgba(0,212,255,0.4)",
            boxShadow: "0 0 16px rgba(0,212,255,0.2)",
          }}
          whileHover={{ scale: 1.05, boxShadow: "0 0 24px rgba(0,212,255,0.4)" }}
        >
          <Zap size={18} className="text-cyan-400" />
        </motion.div>
        <div>
          <div className="text-white font-bold tracking-widest text-sm" style={{ fontFamily: "monospace", letterSpacing: "0.2em" }}>
            CYBER<span className="text-cyan-400">DESK</span>
          </div>
          <div className="text-cyan-500/60 text-xs tracking-widest" style={{ fontFamily: "monospace", fontSize: 9 }}>AI COMMAND CENTER</div>
        </div>
      </div>

      {/* Center title */}
      <div className="hidden md:flex flex-col items-center">
        <div className="text-white/80 text-sm tracking-widest font-light" style={{ fontFamily: "monospace", letterSpacing: "0.25em" }}>
          AI VOICE ASSISTANT
        </div>
        <div className="flex items-center gap-2 mt-1">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ boxShadow: "0 0 6px rgba(52,211,153,0.8)" }}
          />
          <span className="text-emerald-400/80 text-xs tracking-widest" style={{ fontFamily: "monospace", fontSize: 10 }}>ONLINE</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex items-center justify-center rounded-lg"
          style={{
            width: 36, height: 36,
            background: "rgba(0,212,255,0.05)",
            border: "1px solid rgba(0,212,255,0.15)",
          }}
        >
          <Bell size={16} className="text-cyan-400/70" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 6px rgba(0,212,255,0.8)" }} />
        </motion.button>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1"
          style={{ border: "1px solid rgba(0,212,255,0.15)", background: "rgba(0,212,255,0.05)" }}
        >
          <div
            className="flex items-center justify-center rounded-full text-xs font-bold text-cyan-900"
            style={{ width: 26, height: 26, background: "linear-gradient(135deg, #00d4ff, #0080ff)" }}
          >
            A
          </div>
          <span className="text-white/60 text-xs hidden md:block" style={{ fontFamily: "monospace" }}>ADMIN</span>
        </motion.div>
      </div>
    </motion.nav>
  );
}

// ─── STATUS TEXT ──────────────────────────────────────────────────────────────
function StatusText({ state }) {
  const config = {
    [STATES.IDLE]: { text: "Click to speak", sub: "Voice & text supported", color: "rgba(100,180,255,0.7)" },
    [STATES.LISTENING]: { text: "Listening…", sub: "Speak your command", color: "rgba(0,212,255,0.9)" },
    [STATES.RESPONDING]: { text: "CyberDesk is responding…", sub: "Processing your request", color: "rgba(0,212,255,1)" },
  };
  const c = config[state];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col items-center gap-1.5 mt-6"
      >
        <div
          className="text-lg font-light tracking-widest"
          style={{ fontFamily: "monospace", color: c.color, letterSpacing: "0.18em", textShadow: `0 0 20px ${c.color}` }}
        >
          {c.text}
        </div>
        <div className="text-xs tracking-widest text-white/30" style={{ fontFamily: "monospace", letterSpacing: "0.2em" }}>
          {c.sub}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── TYPING INDICATOR ────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-bl-sm" style={{
      background: "rgba(0,212,255,0.06)",
      border: "1px solid rgba(0,212,255,0.15)",
      backdropFilter: "blur(8px)",
      width: "fit-content",
    }}>
      <div className="flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="rounded-full bg-cyan-400"
            style={{ width: 5, height: 5, boxShadow: "0 0 4px rgba(0,212,255,0.6)" }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
          />
        ))}
      </div>
      <span className="text-cyan-400/60 text-xs" style={{ fontFamily: "monospace" }}>Processing</span>
    </div>
  );
}

// ─── CHAT PANEL ───────────────────────────────────────────────────────────────
function ChatPanel({ messages, inputText, setInputText, onSend, onVoice, state }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
      className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 md:px-6 md:pb-5"
      style={{ marginRight: "min(280px, 0px)" }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(0,8,30,0.85)",
          border: "1px solid rgba(0,212,255,0.18)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(0,212,255,0.1) inset",
        }}
      >
        {/* Messages */}
        <div ref={scrollRef} className="px-4 py-3 flex flex-col gap-3" style={{ maxHeight: "28vh", overflowY: "auto" }}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} gap-0.5`}
            >
              <div
                className="px-4 py-2.5 text-sm leading-relaxed"
                style={{
                  maxWidth: "72%",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, rgba(0,120,220,0.4), rgba(0,60,140,0.6))"
                    : "rgba(0,212,255,0.07)",
                  border: `1px solid ${msg.role === "user" ? "rgba(0,150,255,0.3)" : "rgba(0,212,255,0.15)"}`,
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  color: msg.role === "user" ? "rgba(200,230,255,0.9)" : "rgba(180,230,255,0.85)",
                  backdropFilter: "blur(8px)",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 13,
                }}
              >
                {msg.text}
              </div>
              <span className="text-white/20 text-xs px-1" style={{ fontFamily: "monospace", fontSize: 10 }}>{msg.time}</span>
            </motion.div>
          ))}
          {state === STATES.RESPONDING && <TypingIndicator />}
        </div>

        {/* Input */}
        <div
          className="flex items-center gap-2 px-3 py-2.5"
          style={{ borderTop: "1px solid rgba(0,212,255,0.1)" }}
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 flex items-center justify-center rounded-lg"
            style={{ width: 34, height: 34, background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)" }}
          >
            <Paperclip size={15} className="text-cyan-400/50" />
          </motion.button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder="Type a command…"
            className="flex-1 bg-transparent text-sm outline-none placeholder-white/20"
            style={{
              color: "rgba(180,220,255,0.9)",
              fontFamily: "system-ui, sans-serif",
              fontSize: 13,
            }}
          />

          <motion.button
            whileHover={{ scale: 1.1, boxShadow: "0 0 16px rgba(0,212,255,0.4)" }}
            whileTap={{ scale: 0.95 }}
            onClick={onVoice}
            className="flex-shrink-0 flex items-center justify-center rounded-lg"
            style={{
              width: 34, height: 34,
              background: state === STATES.LISTENING
                ? "linear-gradient(135deg, rgba(0,212,255,0.4), rgba(0,100,220,0.5))"
                : "rgba(0,212,255,0.08)",
              border: `1px solid ${state === STATES.LISTENING ? "rgba(0,212,255,0.6)" : "rgba(0,212,255,0.2)"}`,
              boxShadow: state === STATES.LISTENING ? "0 0 12px rgba(0,212,255,0.4)" : "none",
            }}
          >
            <Mic size={15} className={state === STATES.LISTENING ? "text-cyan-300" : "text-cyan-400/60"} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(0,212,255,0.5)" }}
            whileTap={{ scale: 0.95 }}
            onClick={onSend}
            className="flex-shrink-0 flex items-center justify-center rounded-lg"
            style={{
              width: 34, height: 34,
              background: "linear-gradient(135deg, rgba(0,150,255,0.5), rgba(0,80,200,0.6))",
              border: "1px solid rgba(0,212,255,0.35)",
              boxShadow: "0 0 12px rgba(0,100,255,0.25)",
            }}
          >
            <Send size={13} className="text-cyan-300" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── ACTIVITY PANEL ───────────────────────────────────────────────────────────
function ActivityCard({ icon: Icon, label, value, sub, accent = false, animate: shouldAnimate = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-xl p-3"
      style={{
        background: accent ? "rgba(0,212,255,0.06)" : "rgba(0,30,80,0.4)",
        border: `1px solid ${accent ? "rgba(0,212,255,0.25)" : "rgba(0,100,200,0.15)"}`,
        backdropFilter: "blur(8px)",
      }}
      whileHover={{ borderColor: "rgba(0,212,255,0.35)", scale: 1.01 }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-lg mt-0.5"
          style={{
            width: 28, height: 28,
            background: accent ? "rgba(0,212,255,0.15)" : "rgba(0,80,180,0.2)",
            border: `1px solid ${accent ? "rgba(0,212,255,0.3)" : "rgba(0,100,200,0.2)"}`,
          }}
        >
          <Icon size={13} className={accent ? "text-cyan-300" : "text-blue-400/70"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white/35 text-xs mb-0.5" style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.12em" }}>
            {label}
          </div>
          <div
            className="text-xs font-medium truncate"
            style={{
              color: accent ? "rgba(0,212,255,0.9)" : "rgba(180,210,255,0.85)",
              fontFamily: "monospace",
              fontSize: 11,
            }}
          >
            {value}
          </div>
          {sub && (
            <div className="text-white/30 text-xs mt-0.5 truncate" style={{ fontFamily: "monospace", fontSize: 9 }}>
              {sub}
            </div>
          )}
        </div>
        {shouldAnimate && (
          <motion.div
            className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ boxShadow: "0 0 5px rgba(52,211,153,0.7)" }}
          />
        )}
      </div>
    </motion.div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="rounded-full overflow-hidden" style={{ height: 4, background: "rgba(0,80,180,0.2)" }}>
      <motion.div
        className="h-full rounded-full"
        style={{
          background: "linear-gradient(90deg, rgba(0,100,255,0.8), rgba(0,212,255,0.9))",
          boxShadow: "0 0 8px rgba(0,212,255,0.5)",
        }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </div>
  );
}

function RightPanel({ state, intent, progress }) {
  const actions = [
    { text: "Identity verified", done: true },
    { text: "VPN credentials reset", done: true },
    { text: "Confirmation email sent", done: false },
  ];

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
      className="absolute right-4 top-16 bottom-20 z-20 hidden md:flex flex-col gap-2.5 overflow-y-auto"
      style={{ width: 240 }}
    >
      <div className="flex items-center gap-2 px-1 mb-0.5">
        <Activity size={10} className="text-cyan-400/50" />
        <span className="text-cyan-400/40 text-xs tracking-widest" style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.2em" }}>
          LIVE ACTIVITY
        </span>
      </div>

      <ActivityCard
        icon={Zap}
        label="CURRENT SESSION"
        value={SESSION_ID}
        sub="Duration: 03:42"
        accent
        animate
      />

      <ActivityCard
        icon={Activity}
        label="STATUS"
        value={state === STATES.IDLE ? "Standby" : state === STATES.LISTENING ? "Listening" : "Processing"}
        sub={state === STATES.RESPONDING ? "Generating response…" : "Awaiting input"}
        accent={state !== STATES.IDLE}
        animate={state !== STATES.IDLE}
      />

      <ActivityCard
        icon={Shield}
        label="CURRENT INTENT"
        value={intent}
        sub="Confidence: 94%"
      />

      <div
        className="rounded-xl p-3"
        style={{
          background: "rgba(0,30,80,0.4)",
          border: "1px solid rgba(0,100,200,0.15)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="text-white/35 text-xs mb-2" style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.12em" }}>PROGRESS</div>
        <ProgressBar value={progress} />
        <div className="text-cyan-400/60 text-xs mt-1.5 text-right" style={{ fontFamily: "monospace", fontSize: 10 }}>{progress}%</div>
      </div>

      <div
        className="rounded-xl p-3"
        style={{
          background: "rgba(0,30,80,0.4)",
          border: "1px solid rgba(0,100,200,0.15)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="text-white/35 text-xs mb-2" style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.12em" }}>RECENT ACTIONS</div>
        <div className="flex flex-col gap-1.5">
          {actions.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="flex items-center gap-2"
            >
              {a.done ? (
                <CheckCircle2 size={10} className="text-emerald-400 flex-shrink-0" />
              ) : (
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  <Loader2 size={10} className="text-cyan-400 flex-shrink-0" />
                </motion.div>
              )}
              <span className="text-white/50 text-xs" style={{ fontFamily: "monospace", fontSize: 9 }}>{a.text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <ActivityCard
        icon={Ticket}
        label="TICKET"
        value={TICKET_ID}
        sub="Priority: High"
        accent
      />

      <ActivityCard
        icon={Hash}
        label="INCIDENT"
        value="INC-2024-0381"
        sub="Assigned to L2"
      />
    </motion.div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function CyberDesk() {
  const [state, setState] = useState(STATES.IDLE);
  const [messages, setMessages] = useState(SAMPLE_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [intent, setIntent] = useState("VPN Support");
  const [progress, setProgress] = useState(65);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Cycle through demo states on orb click
  const handleToggle = useCallback(() => {
    setState((prev) => {
      if (prev === STATES.IDLE) return STATES.LISTENING;
      if (prev === STATES.LISTENING) return STATES.RESPONDING;
      return STATES.IDLE;
    });
  }, []);

  // Auto-advance from responding back to idle
  useEffect(() => {
    if (state === STATES.RESPONDING) {
      const t = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: "assistant",
            text: "Your VPN credentials have been reset successfully. Check your registered email for the new access link. Is there anything else I can help you with?",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setProgress(85);
        setState(STATES.IDLE);
      }, 3500);
      return () => clearTimeout(t);
    }
    if (state === STATES.LISTENING) {
      const t = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: "user",
            text: "Please reset my VPN access and send me the new credentials.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setState(STATES.RESPONDING);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    setMessages((prev) => [...prev, {
      id: Date.now(),
      role: "user",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    setInputText("");
    setState(STATES.RESPONDING);
    const randIntent = INTENTS[Math.floor(Math.random() * INTENTS.length)];
    setIntent(randIntent);
  }, [inputText]);

  const handleVoice = useCallback(() => {
    if (state === STATES.IDLE || state === STATES.RESPONDING) {
      setState(STATES.LISTENING);
    } else {
      setState(STATES.IDLE);
    }
  }, [state]);

  return (
    <div
      className="relative w-full overflow-hidden flex flex-col"
      style={{
        height: "100vh",
        background: "linear-gradient(135deg, #000814 0%, #001233 40%, #000c24 70%, #000510 100%)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Radial ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "20%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "60vw", height: "60vw",
          background: "radial-gradient(circle, rgba(0,80,180,0.12) 0%, rgba(0,0,0,0) 70%)",
          borderRadius: "50%",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: "35%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "40vw", height: "40vw",
          background: "radial-gradient(circle, rgba(0,150,255,0.07) 0%, rgba(0,0,0,0) 70%)",
          borderRadius: "50%",
        }}
      />

      <GridBackground />
      <FloatingParticles />
      <TopNav />
      <RightPanel state={state} intent={intent} progress={progress} />

      {/* CENTER */}
      <div className="flex-1 flex flex-col items-center justify-center" style={{ paddingTop: 64, paddingBottom: 140, paddingRight: "min(256px, 0px)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <ConstellationCore state={state} onToggle={handleToggle} />
          <StatusText state={state} />

          {/* Hint text */}
          <AnimatePresence>
            {state === STATES.IDLE && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 1 }}
                className="mt-8 flex items-center gap-4"
              >
                {["VOICE", "TEXT", "COMMAND"].map((mode, i) => (
                  <motion.div
                    key={mode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{
                      background: "rgba(0,100,200,0.08)",
                      border: "1px solid rgba(0,150,255,0.12)",
                    }}
                    whileHover={{ borderColor: "rgba(0,212,255,0.3)", background: "rgba(0,100,200,0.15)" }}
                  >
                    <div className="w-1 h-1 rounded-full bg-cyan-400/40" />
                    <span className="text-white/25 text-xs" style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em" }}>{mode}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <ChatPanel
        messages={messages}
        inputText={inputText}
        setInputText={setInputText}
        onSend={handleSend}
        onVoice={handleVoice}
        state={state}
      />
    </div>
  );
}
