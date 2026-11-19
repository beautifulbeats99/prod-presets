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
    waveform:,
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
    waveform:,
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
    waveform:,
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
    waveform:,
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
    waveform:,
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
    waveform:,
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

