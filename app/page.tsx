"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

type TabType = "Samples" | "Presets" | "Packs" | "My Library";
type SynthEngine = "All" | "Analog Lab" | "Serum" | "Vital" | "Omnisphere" | "WAV";

interface AudioAsset {
  id: string;
  filename: string;
  packId: string;
  packTitle: string;
  coverGradient: string;
  engine: Exclude<SynthEngine, "All">;
  extension: string;
  category: string;
  tags: string[];
  duration: string;
  musicalKey: string;
  bpm: number | null;
  credits: number;
  baseFreq: number;
  waveform: number[];
}

interface Pack {
  id: string;
  title: string;
  creator: string;
  coverGradient: string;
  description: string;
  genre: string;
}

const PACKS: Pack[] = [
  {
    id: "p1",
    title: "Midnight Serum & Analog Vol. 1",
    creator: "ProdPresets Sound Lab",
    coverGradient: "from-blue-600 via-indigo-600 to-cyan-500",
    description:
      "Lush analog-modeled pads, warm sub basses, and crisp modern plucks engineered for Serum and Analog Lab.",
    genre: "Melodic Trap / R&B",
  },
  {
    id: "p2",
    title: "Hyper-Vital & Omnisphere Textures",
    creator: "Kairo Audio",
    coverGradient: "from-sky-500 via-blue-700 to-slate-900",
    description:
      "Cinematic granular atmospheres, futuristic Vital leads, and tape-saturated songstarters.",
    genre: "Electronic / Ambient",
  },
  {
    id: "p3",
    title: "Velvet Soul & Boom Bap Drums",
    creator: "Nostalgic Sounds",
    coverGradient: "from-amber-500 via-orange-600 to-rose-600",
    description:
      "Dusty 24-bit acoustic drum breaks, vinyl-cut Rhodes chords, and warm bass loops.",
    genre: "Hip Hop / Soul",
  },
];

const INITIAL_ASSETS: AudioAsset[] = [
  {
    id: "a1",
    filename: "PP_Midnight_Warm_Sub_Bass.fxp",
    packId: "p1",
    packTitle: "Midnight Serum & Analog Vol. 1",
    coverGradient: "from-blue-600 via-indigo-600 to-cyan-500",
    engine: "Serum",
    extension: ".fxp",
    category: "Bass",
    tags: ["bass", "sub", "trap", "analog", "warm"],
    duration: "0:06",
    musicalKey: "F min",
    bpm: 140,
    credits: 2,
    baseFreq: 110,
    waveform: [35, 60, 85, 95, 70, 50, 90, 100, 80, 65, 45, 75, 90, 60, 40, 70, 85, 55, 35, 25],
  },
  {
    id: "a2",
    filename: "PP_Velvet_Juno_Pad_Lush.labx",
    packId: "p1",
    packTitle: "Midnight Serum & Analog Vol. 1",
    coverGradient: "from-blue-600 via-indigo-600 to-cyan-500",
    engine: "Analog Lab",
    extension: ".labx",
    category: "Pad",
    tags: ["pad", "chords", "rnb", "vintage", "lush"],
    duration: "0:08",
    musicalKey: "C# min",
    bpm: 95,
    credits: 2,
    baseFreq: 220,
    waveform: [25, 40, 55, 70, 85, 95, 90, 85, 80, 75, 85, 90, 80, 70, 60, 50, 45, 35, 30, 20],
  },
  {
    id: "a3",
    filename: "PP_Glass_Arp_Sequence.vital",
    packId: "p2",
    packTitle: "Hyper-Vital & Omnisphere Textures",
    coverGradient: "from-sky-500 via-blue-700 to-slate-900",
    engine: "Vital",
    extension: ".vital",
    category: "Pluck",
    tags: ["pluck", "arp", "melody", "electronic", "bright"],
    duration: "0:08",
    musicalKey: "A min",
    bpm: 128,
    credits: 2,
    baseFreq: 330,
    waveform: [90, 45, 85, 40, 95, 50, 80, 35, 90, 45, 85, 40, 75, 35, 80, 40, 65, 30, 50, 25],
  },
  {
    id: "a4",
    filename: "PP_Celestial_Choir_Atmos.prt_omn",
    packId: "p2",
    packTitle: "Hyper-Vital & Omnisphere Textures",
    coverGradient: "from-sky-500 via-blue-700 to-slate-900",
    engine: "Omnisphere",
    extension: ".prt_omn",
    category: "Atmosphere",
    tags: ["ambient", "texture", "vocal", "cinematic", "pad"],
    duration: "0:12",
    musicalKey: "D# min",
    bpm: null,
    credits: 2,
    baseFreq: 261.63,
    waveform: [20, 30, 45, 60, 75, 85, 95, 100, 95, 90, 85, 80, 75, 70, 60, 50, 40, 30, 25, 15],
  },
  {
    id: "a5",
    filename: "PP_90_Vinyl_Soul_Drum_Loop_Emin.wav",
    packId: "p3",
    packTitle: "Velvet Soul & Boom Bap Drums",
    coverGradient: "from-amber-500 via-orange-600 to-rose-600",
    engine: "WAV",
    extension: ".wav",
    category: "Drums",
    tags: ["drums", "hip hop", "soul", "grooves", "vinyl"],
    duration: "0:08",
    musicalKey: "E min",
    bpm: 90,
    credits: 2,
    baseFreq: 164.81,
    waveform: [95, 40, 75, 30, 90, 45, 85, 35, 95, 40, 80, 30, 90, 45, 75, 35, 85, 40, 60, 25],
  },
  {
    id: "a6",
    filename: "PP_87_Dusty_Rhodes_Chords_Am.wav",
    packId: "p3",
    packTitle: "Velvet Soul & Boom Bap Drums",
    coverGradient: "from-amber-500 via-orange-600 to-rose-600",
    engine: "WAV",
    extension: ".wav",
    category: "Keys",
    tags: ["keys", "chords", "lo-fi hip hop", "rnb", "warm"],
    duration: "0:11",
    musicalKey: "A min",
    bpm: 87,
    credits: 2,
    baseFreq: 220,
    waveform: [75, 85, 70, 60, 80, 90, 75, 65, 85, 80, 70, 60, 75, 85, 70, 55, 45, 35, 25, 20],
  },
];

const QUICK_TAGS = [
  "bass",
  "pad",
  "chords",
  "pluck",
  "drums",
  "keys",
  "trap",
  "rnb",
  "hip hop",
  "lo-fi hip hop",
  "ambient",
  "analog",
];

const PIANO_NOTES = [
  { note: "C4", keyBind: "a", freq: 261.63, isBlack: false },
  { note: "C#4", keyBind: "w", freq: 277.18, isBlack: true },
  { note: "D4", keyBind: "s", freq: 293.66, isBlack: false },
  { note: "D#4", keyBind: "e", freq: 311.13, isBlack: true },
  { note: "E4", keyBind: "d", freq: 329.63, isBlack: false },
  { note: "F4", keyBind: "f", freq: 349.23, isBlack: false },
  { note: "F#4", keyBind: "t", freq: 369.99, isBlack: true },
  { note: "G4", keyBind: "g", freq: 392.0, isBlack: false },
  { note: "G#4", keyBind: "y", freq: 415.3, isBlack: true },
  { note: "A4", keyBind: "h", freq: 440.0, isBlack: false },
  { note: "A#4", keyBind: "u", freq: 466.16, isBlack: true },
  { note: "B4", keyBind: "j", freq: 493.88, isBlack: false },
  { note: "C5", keyBind: "k", freq: 523.25, isBlack: false },
  { note: "C#5", keyBind: "o", freq: 554.37, isBlack: true },
  { note: "D5", keyBind: "l", freq: 587.33, isBlack: false },
  { note: "D#5", keyBind: "p", freq: 622.25, isBlack: true },
  { note: "E5", keyBind: ";", freq: 659.25, isBlack: false },
];

function RotaryKnob({
  label,
  value,
  onChange,
  darkMode,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  darkMode: boolean;
}) {
  const startYRef = useRef<number | null>(null);
  const startValRef = useRef<number>(value);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startYRef.current = e.clientY;
    startValRef.current = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (startYRef.current === null) return;
      const deltaY = startYRef.current - moveEvent.clientY;
      const nextVal = Math.min(100, Math.max(0, Math.round(startValRef.current + deltaY * 0.6)));
      onChange(nextVal);
    };

    const handleMouseUp = () => {
      startYRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const angle = -135 + (value / 100) * 270;

  return (
    <div className="flex flex-col items-center select-none">
      <div
        onMouseDown={handleMouseDown}
        title="Click and drag up or down to adjust"
        className={`relative w-12 h-12 rounded-full flex items-center justify-center cursor-ns-resize transition-shadow ${
          darkMode
            ? "bg-zinc-900 border border-zinc-700 shadow-inner hover:border-blue-500"
            : "bg-white border border-slate-200 shadow-sm hover:border-blue-500"
        }`}
      >
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={darkMode ? "#27272a" : "#e2e8f0"}
            strokeWidth="3"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeDasharray={`${(value / 100) * 94} 126`}
            strokeLinecap="round"
          />
        </svg>

        <div
          style={{ transform: `rotate(${angle}deg)` }}
          className={`w-8 h-8 rounded-full flex items-start justify-center pt-1 transition-transform duration-75 ${
            darkMode ? "bg-zinc-800 border border-zinc-700" : "bg-slate-50 border border-slate-200"
          }`}
        >
          <div className="w-1 h-2.5 rounded-full bg-blue-600" />
        </div>
      </div>
      <span className={`mt-1.5 text-[11px] font-medium ${darkMode ? "text-zinc-300" : "text-slate-700"}`}>
        {label}
      </span>
      <span className="text-[10px] font-mono text-blue-600 font-semibold">{value}%</span>
    </div>
  );
}

export default function ProdPresetsMarketplace() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("Presets");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<SynthEngine>("All");
  const [selectedKey, setSelectedKey] = useState<string>("All");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [credits, setCredits] = useState<number>(100);
  const [ownedIds, setOwnedIds] = useState<string[]>(["a2"]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [creditHistory, setCreditHistory] = useState<{ label: string; delta: number; date: string }[]>([
    { label: "Pro Creator Monthly Top-Up", delta: 100, date: "Today" },
    { label: "Unlocked PP_Velvet_Juno_Pad_Lush.labx", delta: -2, date: "Today" },
  ]);

  const [activeAsset, setActiveAsset] = useState<AudioAsset>(INITIAL_ASSETS[0]);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);

  const [cutoff, setCutoff] = useState(72);
  const [resonance, setResonance] = useState(30);
  const [envelope, setEnvelope] = useState(45);
  const [spaceMix, setSpaceMix] = useState(35);
  const [macro1, setMacro1] = useState(60);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const resetKnobs = () => {
    setCutoff(72);
    setResonance(30);
    setEnvelope(45);
    setSpaceMix(35);
    setMacro1(60);
  };

  const triggerSynthNote = useCallback(
    (freq: number, durationSec = 0.65) => {
      try {
        if (!audioCtxRef.current) {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") ctx.resume();

        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc1.type =
          activeAsset.engine === "Serum"
            ? "sawtooth"
            : activeAsset.engine === "Vital"
            ? "triangle"
            : "sawtooth";
        osc2.type = "sine";

        osc1.frequency.setValueAtTime(freq, now);
        osc2.frequency.setValueAtTime(freq * (1 + (macro1 - 50) * 0.0004), now);

        filter.type = "lowpass";
        const mappedCutoff = 140 + (cutoff / 100) * 5200;
        filter.frequency.setValueAtTime(mappedCutoff, now);
        filter.Q.setValueAtTime(1 + (resonance / 100) * 14, now);

        const attack = 0.015 + (envelope / 100) * 0.18;
        const release = durationSec + (spaceMix / 100) * 0.9;

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.22, now + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + release);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + release + 0.05);
        osc2.stop(now + release + 0.05);
      } catch {
        // Ignore browser autoplay restrictions before interaction
      }
    },
    [activeAsset.engine, cutoff, envelope, macro1, resonance, spaceMix]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const found = PIANO_NOTES.find((k) => k.keyBind === e.key.toLowerCase());
      if (found && !e.repeat) {
        setActiveNote(found.note);
        triggerSynthNote(found.freq, 0.55);
      }
    };
    const handleKeyUp = () => setActiveNote(null);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [triggerSynthNote]);

  const handleTogglePlay = (asset: AudioAsset) => {
    if (activeAsset.id === asset.id && isPlayingPreview) {
      setIsPlayingPreview(false);
      return;
    }
    setActiveAsset(asset);
    setIsPlayingPreview(true);
    triggerSynthNote(asset.baseFreq, 0.8);
    setTimeout(() => triggerSynthNote(asset.baseFreq * 1.25, 0.7), 220);
    setTimeout(() => triggerSynthNote(asset.baseFreq * 1.5, 0.9), 440);
    setTimeout(() => setIsPlayingPreview(false), 1400);
  };

  const handleUnlockAsset = (asset: AudioAsset) => {
    if (ownedIds.includes(asset.id)) {
      alert(`Re-downloading ${asset.filename} (0 Credits — Already in My Library)`);
      return;
    }
    if (credits < asset.credits) {
      alert("Not enough credits! Top up your subscription in Account Settings.");
      return;
    }
    setCredits((c) => c - asset.credits);
    setOwnedIds((prev) => [...prev, asset.id]);
    setCreditHistory((prev) => [
      { label: `Unlocked ${asset.filename}`, delta: -asset.credits, date: "Just now" },
      ...prev,
    ]);
  };

  const filteredAssets = INITIAL_ASSETS.filter((item) => {
    if (activeTab === "Samples" && item.engine !== "WAV") return false;
    if (activeTab === "Presets" && item.engine === "WAV") return false;
    if (activeTab === "My Library" && !ownedIds.includes(item.id)) return false;
    if (selectedPack && item.packId !== selectedPack.id) return false;
    if (selectedEngine !== "All" && item.engine !== selectedEngine) return false;
    if (selectedKey !== "All" && item.musicalKey !== selectedKey) return false;
    if (selectedTag && !item.tags.includes(selectedTag)) return false;
    if (
      searchQuery &&
      !item.filename.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.tags.some((t) => t.includes(searchQuery.toLowerCase()))
    ) {
      return false;
    }
    return true;
  });

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? "bg-[#0e0f12] text-zinc-100" : "bg-white text-slate-900"
      }`}
    >
      {/* TOP NAVIGATION BAR */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          darkMode ? "bg-[#0e0f12]/90 border-zinc-800" : "bg-white/95 border-slate-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <div
              onClick={() => {
                setSelectedPack(null);
                setActiveTab("Presets");
              }}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/30 font-bold text-sm">
                PP
              </div>
              <span className="font-bold text-lg tracking-tight">
                Prod<span className="text-blue-600">Presets</span>
                <span className="text-xs font-normal opacity-60">.com</span>
              </span>
            </div>

            <nav className="flex items-center gap-1 overflow-x-auto">
              {(["Samples", "Presets", "Packs", "My Library"] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setSelectedPack(null);
                    setActiveTab(tab);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === tab
                      ? "bg-blue-600 text-white"
                      : darkMode
                      ? "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {tab}
                  {tab === "My Library" && (
                    <span
                      className={`text-[11px] px-1.5 rounded-full ${
                        activeTab === tab
                          ? "bg-blue-500 text-white"
                          : darkMode
                          ? "bg-zinc-800 text-zinc-300"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {ownedIds.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                darkMode
                  ? "bg-blue-950/50 border-blue-800/60 text-blue-400"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              <span className="text-blue-600">✦</span>
              <span>{credits} Credits</span>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle studio theme"
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                darkMode
                  ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {darkMode ? "Light" : "Dark"}
            </button>

            <button
              onClick={() => setAccountOpen(true)}
              className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                darkMode
                  ? "border-zinc-800 bg-zinc-900 hover:border-blue-500"
                  : "border-slate-200 bg-white hover:border-blue-500 shadow-sm"
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                P
              </div>
              <span className="hidden sm:inline">Account</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* TOP INTERACTIVE SYNTH DECK */}
        <section
          className={`rounded-2xl border p-5 transition-colors ${
            darkMode
              ? "bg-zinc-900/70 border-zinc-800 shadow-lg"
              : "bg-slate-50/80 border-slate-200/90 shadow-sm"
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5 min-w-[240px]">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600 text-white">
                  {activeAsset.engine}
                </span>
                <span className={`text-xs font-mono ${darkMode ? "text-zinc-400" : "text-slate-500"}`}>
                  {activeAsset.extension}
                </span>
              </div>
              <h2 className="text-base font-bold truncate max-w-[280px]">{activeAsset.filename}</h2>
              <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-slate-500"}`}>
                Tweak macros below & play keys (A–L) to audition live
              </p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={() => handleTogglePlay(activeAsset)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >
                  ▶ Audition Patch
                </button>
                <button
                  onClick={resetKnobs}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    darkMode
                      ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  ↺ Reset
                </button>
              </div>
            </div>

            {/* 5 Rotary Knobs */}
            <div
              className={`flex flex-wrap items-center justify-center gap-5 sm:gap-7 px-5 py-3.5 rounded-xl border ${
                darkMode ? "bg-zinc-950/60 border-zinc-800" : "bg-white border-slate-200"
              }`}
            >
              <RotaryKnob label="Cutoff" value={cutoff} onChange={setCutoff} darkMode={darkMode} />
              <RotaryKnob label="Resonance" value={resonance} onChange={setResonance} darkMode={darkMode} />
              <RotaryKnob label="Envelope" value={envelope} onChange={setEnvelope} darkMode={darkMode} />
              <RotaryKnob label="Space FX" value={spaceMix} onChange={setSpaceMix} darkMode={darkMode} />
              <RotaryKnob label="Macro 1" value={macro1} onChange={setMacro1} darkMode={darkMode} />
            </div>
          </div>

          {/* 2-OCTAVE MINI PIANO */}
          <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-zinc-800">
            <div className="relative h-24 w-full overflow-x-auto select-none flex justify-center">
              <div className="relative flex h-full min-w-[540px] max-w-3xl w-full">
                {PIANO_NOTES.filter((n) => !n.isBlack).map((k) => {
                  const isPressed = activeNote === k.note;
                  return (
                    <button
                      key={k.note}
                      onMouseDown={() => {
                        setActiveNote(k.note);
                        triggerSynthNote(k.freq, 0.55);
                      }}
                      onMouseUp={() => setActiveNote(null)}
                      onMouseLeave={() => setActiveNote(null)}
                      className={`flex-1 h-full border rounded-b-lg flex flex-col justify-end items-center pb-2 transition-all ${
                        isPressed
                          ? "bg-blue-600 text-white border-blue-600 translate-y-0.5"
                          : darkMode
                          ? "bg-zinc-100 text-zinc-800 border-zinc-400 hover:bg-blue-50"
                          : "bg-white text-slate-500 border-slate-300 hover:bg-blue-50/70 shadow-sm"
                      }`}
                    >
                      <span className="text-[10px] font-mono uppercase opacity-70">{k.keyBind}</span>
                    </button>
                  );
                })}

                <div className="pointer-events-none absolute inset-0 flex">
                  {PIANO_NOTES.map((k, idx) => {
                    if (!k.isBlack) return null;
                    const whiteKeysBefore = PIANO_NOTES.slice(0, idx).filter((n) => !n.isBlack).length;
                    const leftPercent = (whiteKeysBefore / 10) * 100 - 3;
                    const isPressed = activeNote === k.note;
                    return (
                      <button
                        key={k.note}
                        style={{ left: `${leftPercent}%` }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setActiveNote(k.note);
                          triggerSynthNote(k.freq, 0.55);
                        }}
                        onMouseUp={() => setActiveNote(null)}
                        onMouseLeave={() => setActiveNote(null)}
                        className={`pointer-events-auto absolute top-0 w-[6%] h-[58%] rounded-b-md z-10 flex flex-col justify-end items-center pb-1.5 text-[9px] font-mono uppercase transition-all ${
                          isPressed
                            ? "bg-blue-500 text-white translate-y-0.5"
                            : "bg-slate-900 text-slate-400 hover:bg-slate-800 shadow-md"
                        }`}
                      >
                        {k.keyBind}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PACK DETAIL BANNER */}
        {selectedPack && (
          <section
            className={`rounded-2xl border p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 ${
              darkMode ? "bg-zinc-900 border-zinc-800" : "bg-blue-50/50 border-blue-100"
            }`}
          >
            <div className="flex items-center gap-5">
              <div
                className={`w-24 h-24 rounded-xl bg-gradient-to-br ${selectedPack.coverGradient} flex items-center justify-center text-white shadow-md shrink-0 font-bold text-xl`}
              >
                PACK
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  {selectedPack.genre}
                </span>
                <h1 className="text-2xl font-bold">{selectedPack.title}</h1>
                <p className={`text-sm max-w-xl ${darkMode ? "text-zinc-400" : "text-slate-600"}`}>
                  {selectedPack.description}
                </p>
                <p className="text-xs font-medium text-blue-600 pt-1">By {selectedPack.creator}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedPack(null)}
              className={`px-3.5 py-2 rounded-lg border text-xs font-semibold ${
                darkMode
                  ? "border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              ✕ Back to All Sounds
            </button>
          </section>
        )}

        {/* PACKS GRID VIEW */}
        {activeTab === "Packs" && !selectedPack ? (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PACKS.map((pack) => (
              <div
                key={pack.id}
                onClick={() => setSelectedPack(pack)}
                className={`group rounded-2xl border p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${
                  darkMode
                    ? "bg-zinc-900 border-zinc-800 hover:border-blue-500"
                    : "bg-white border-slate-200 hover:border-blue-500 shadow-sm"
                }`}
              >
                <div
                  className={`aspect-square w-full rounded-xl bg-gradient-to-br ${pack.coverGradient} mb-4 flex items-center justify-center text-white relative overflow-hidden`}
                >
                  <span className="text-3xl font-extrabold tracking-tight opacity-85 group-hover:scale-110 transition-transform">
                    PP
                  </span>
                  <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/50 backdrop-blur-sm text-xs font-semibold">
                    {pack.genre}
                  </span>
                </div>
                <h3 className="font-bold text-base group-hover:text-blue-600 transition-colors">
                  {pack.title}
                </h3>
                <p className={`text-xs mt-1 line-clamp-2 ${darkMode ? "text-zinc-400" : "text-slate-500"}`}>
                  {pack.description}
                </p>
              </div>
            ))}
          </section>
        ) : (
          <>
            {/* FILTER BAR */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={selectedEngine}
                    onChange={(e) => setSelectedEngine(e.target.value as SynthEngine)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold outline-none focus:border-blue-600 ${
                      darkMode
                        ? "bg-zinc-900 border-zinc-800 text-zinc-200"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <option value="All">Synth / Format: All</option>
                    <option value="Analog Lab">Analog Lab (.labx)</option>
                    <option value="Serum">Serum (.fxp)</option>
                    <option value="Vital">Vital (.vital)</option>
                    <option value="Omnisphere">Omnisphere (.prt_omn)</option>
                    <option value="WAV">Audio Samples (.wav)</option>
                  </select>

                  <select
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold outline-none focus:border-blue-600 ${
                      darkMode
                        ? "bg-zinc-900 border-zinc-800 text-zinc-200"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <option value="All">Key: Any</option>
                    <option value="C# min">C# min</option>
                    <option value="D# min">D# min</option>
                    <option value="E min">E min</option>
                    <option value="F min">F min</option>
                    <option value="A min">A min</option>
                  </select>
                </div>

                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search filenames, synths, tags..."
                    className={`w-full px-3.5 py-2 rounded-lg border text-xs outline-none focus:border-blue-600 ${
                      darkMode
                        ? "bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                        : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {QUICK_TAGS.map((tag) => {
                  const active = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(active ? null : tag)}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        active
                          ? "bg-blue-600 text-white"
                          : darkMode
                          ? "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* DATA TABLE */}
            <section
              className={`rounded-2xl border overflow-hidden ${
                darkMode ? "border-zinc-800 bg-zinc-900/40" : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr
                      className={`border-b text-[11px] uppercase tracking-wider font-semibold ${
                        darkMode
                          ? "border-zinc-800 text-zinc-500 bg-zinc-900/80"
                          : "border-slate-200 text-slate-400 bg-slate-50"
                      }`}
                    >
                      <th className="py-3 pl-4 pr-2 w-14">Pack</th>
                      <th className="py-3 px-2 w-10"></th>
                      <th className="py-3 px-3">Filename</th>
                      <th className="py-3 px-3 hidden md:table-cell">Waveform</th>
                      <th className="py-3 px-3">Time</th>
                      <th className="py-3 px-3">Key</th>
                      <th className="py-3 px-3">BPM</th>
                      <th className="py-3 pl-3 pr-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-sm">
                    {filteredAssets.map((item) => {
                      const isCurrent = activeAsset.id === item.id;
                      const isRowPlaying = isCurrent && isPlayingPreview;
                      const isOwned = ownedIds.includes(item.id);

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setActiveAsset(item)}
                          className={`group transition-colors cursor-pointer ${
                            isCurrent
                              ? darkMode
                                ? "bg-blue-950/25"
                                : "bg-blue-50/60"
                              : darkMode
                              ? "hover:bg-zinc-800/40"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="py-2.5 pl-4 pr-2">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const foundPack = PACKS.find((p) => p.id === item.packId);
                                if (foundPack) setSelectedPack(foundPack);
                              }}
                              title={`View pack: ${item.packTitle}`}
                              className={`w-10 h-10 rounded-md bg-gradient-to-br ${item.coverGradient} flex items-center justify-center text-white text-[10px] font-bold shadow-sm hover:scale-105 transition-transform`}
                            >
                              PP
                            </div>
                          </td>

                          <td className="py-2.5 px-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePlay(item);
                              }}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${
                                isRowPlaying
                                  ? "bg-blue-600 text-white"
                                  : darkMode
                                  ? "bg-zinc-800 text-zinc-200 hover:bg-blue-600 hover:text-white"
                                  : "bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white"
                              }`}
                            >
                              {isRowPlaying ? "■" : "▶"}
                            </button>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[13px] group-hover:text-blue-600 transition-colors">
                                {item.filename}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  item.engine === "WAV"
                                    ? darkMode
                                      ? "bg-zinc-800 text-zinc-300"
                                      : "bg-slate-200 text-slate-700"
                                    : "bg-blue-600/15 text-blue-600"
                                }`}
                              >
                                {item.engine}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {item.tags.map((t) => (
                                <span
                                  key={t}
                                  className={`text-[11px] ${
                                    darkMode ? "text-zinc-500" : "text-slate-400"
                                  }`}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 hidden md:table-cell">
                            <div className="flex items-center gap-[2px] h-7 w-36">
                              {item.waveform.map((height, idx) => (
                                <div
                                  key={idx}
                                  style={{ height: `${height}%` }}
                                  className={`w-1 rounded-full transition-colors ${
                                    isRowPlaying
                                      ? "bg-blue-500 animate-pulse"
                                      : isCurrent
                                      ? "bg-blue-600"
                                      : darkMode
                                      ? "bg-zinc-700 group-hover:bg-zinc-500"
                                      : "bg-slate-300 group-hover:bg-blue-400"
                                  }`}
                                />
                              ))}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-xs font-mono opacity-75">{item.duration}</td>
                          <td className="py-2.5 px-3 text-xs font-medium opacity-80">{item.musicalKey}</td>
                          <td className="py-2.5 px-3 text-xs font-mono opacity-75">
                            {item.bpm ?? "--"}
                          </td>

                          <td className="py-2.5 pl-3 pr-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {activeTab === "My Library" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    alert(
                                      `Royalty-Free Commercial License Certificate generated for ${item.filename}`
                                    );
                                  }}
                                  title="Download Commercial License PDF"
                                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium ${
                                    darkMode
                                      ? "border-zinc-700 text-zinc-300 hover:border-blue-500"
                                      : "border-slate-200 text-slate-600 hover:border-blue-500"
                                  }`}
                                >
                                  License
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnlockAsset(item);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                                  isOwned
                                    ? darkMode
                                      ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                }`}
                              >
                                {isOwned ? "✓ Saved" : `↓ ${item.credits} CR`}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredAssets.length === 0 && (
                  <div className="py-12 text-center text-sm opacity-60">
                    No presets or samples match your current filters.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* USER ACCOUNT DRAWER */}
      {accountOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div
            className={`w-full max-w-md h-full p-6 flex flex-col justify-between overflow-y-auto ${
              darkMode ? "bg-zinc-900 text-zinc-100" : "bg-white text-slate-900"
            }`}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    P
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Producer Account</h3>
                    <p className="text-xs opacity-60">Pro Creator Subscription • Active</p>
                  </div>
                </div>
                <button
                  onClick={() => setAccountOpen(false)}
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-xl bg-blue-600 text-white space-y-2">
                <div className="text-xs uppercase tracking-wider opacity-80 font-semibold">
                  Available Balance
                </div>
                <div className="text-3xl font-bold">{credits} Credits</div>
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setCredits((c) => c + 50);
                      setCreditHistory((prev) => [
                        { label: "Instant Top-Up (+50 Credits)", delta: 50, date: "Just now" },
                        ...prev,
                      ]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white text-blue-700 text-xs font-bold hover:bg-blue-50 transition-colors"
                  >
                    + Add 50 Credits
                  </button>
                  <button
                    onClick={() => {
                      setAccountOpen(false);
                      setActiveTab("My Library");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800"
                  >
                    Open My Library ({ownedIds.length})
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">
                  Recent Credit Activity
                </h4>
                <div className="space-y-2.5">
                  {creditHistory.map((entry, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                        darkMode ? "border-zinc-800 bg-zinc-950/50" : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div>
                        <div className="font-medium">{entry.label}</div>
                        <div className="opacity-50 text-[11px]">{entry.date}</div>
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          entry.delta > 0 ? "text-emerald-500" : "text-blue-600"
                        }`}
                      >
                        {entry.delta > 0 ? `+${entry.delta}` : entry.delta} CR
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 text-xs opacity-60 text-center">
              ProdPresets.com • 100% Royalty-Free Commercial Licensing
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
