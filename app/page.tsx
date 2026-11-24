"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

type TabType = "Samples" | "Presets" | "Packs" | "My Library";
type SynthEngine = "All" | "Analog Lab" | "Serum" | "Vital" | "Omnisphere" | "WAV";

interface AudioAsset {
  id: string;
  filename: string;
  storagePath?: string;
  previewPath?: string | null;
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
  waveformBars: string;
}

interface Pack {
  id: string;
  title: string;
  creator: string;
  coverGradient: string;
  description: string;
  genre: string;
}

interface MidiRollNote {
  id: string;
  note: string; // e.g., "C3", "G3"
  step: number; // 0..15 (16th notes in 1 bar)
  durationSteps: number; // 1..8
}

const FALLBACK_PACKS: Pack[] = [
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

const FALLBACK_ASSETS: AudioAsset[] = [
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
    waveformBars: "35,60,85,95,70,50,90,100,80,65,45,75,90,60,40,70,85,55,35,25",
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
    waveformBars: "25,40,55,70,85,95,90,85,80,75,85,90,80,70,60,50,45,35,30,20",
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
    waveformBars: "90,45,85,40,95,50,80,35,90,45,85,40,75,35,80,40,65,30,50,25",
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
    waveformBars: "20,30,45,60,75,85,95,100,95,90,85,80,75,70,60,50,40,30,25,15",
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
    waveformBars: "95,40,75,30,90,45,85,35,95,40,80,30,90,45,75,35,85,40,60,25",
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
    waveformBars: "75,85,70,60,80,90,75,65,85,80,70,60,75,85,70,55,45,35,25,20",
  },
];

const QUICK_TAGS = [
  "edm",
  "blissful",
  "bass",
  "pad",
  "chords",
  "pluck",
  "lead",
  "drums",
  "keys",
  "trap",
  "rnb",
  "ambient",
];

// Mapped around C3 so C3 plays the exact unshifted Serum bounce
const PIANO_NOTES = [
  { note: "C3", keyBind: "a", freq: 130.81, isBlack: false, midiNum: 48 },
  { note: "C#3", keyBind: "w", freq: 138.59, isBlack: true, midiNum: 49 },
  { note: "D3", keyBind: "s", freq: 146.83, isBlack: false, midiNum: 50 },
  { note: "D#3", keyBind: "e", freq: 155.56, isBlack: true, midiNum: 51 },
  { note: "E3", keyBind: "d", freq: 164.81, isBlack: false, midiNum: 52 },
  { note: "F3", keyBind: "f", freq: 174.61, isBlack: false, midiNum: 53 },
  { note: "F#3", keyBind: "t", freq: 185.0, isBlack: true, midiNum: 54 },
  { note: "G3", keyBind: "g", freq: 196.0, isBlack: false, midiNum: 55 },
  { note: "G#3", keyBind: "y", freq: 207.65, isBlack: true, midiNum: 56 },
  { note: "A3", keyBind: "h", freq: 220.0, isBlack: false, midiNum: 57 },
  { note: "A#3", keyBind: "u", freq: 233.08, isBlack: true, midiNum: 58 },
  { note: "B3", keyBind: "j", freq: 246.94, isBlack: false, midiNum: 59 },
  { note: "C4", keyBind: "k", freq: 261.63, isBlack: false, midiNum: 60 },
  { note: "C#4", keyBind: "o", freq: 277.18, isBlack: true, midiNum: 61 },
  { note: "D4", keyBind: "l", freq: 293.66, isBlack: false, midiNum: 62 },
  { note: "D#4", keyBind: "p", freq: 311.13, isBlack: true, midiNum: 63 },
  { note: "E4", keyBind: ";", freq: 329.63, isBlack: false, midiNum: 64 },
];

// Top-to-bottom rows for the Piano Roll grid (E4 at top down to C3 at bottom)
const ROLL_ROWS = [...PIANO_NOTES].reverse();

const STARTER_PATTERNS: Record<string, MidiRollNote[]> = {
  "EDM Chords": [
    { id: "c1", note: "C3", step: 0, durationSteps: 4 },
    { id: "c2", note: "G3", step: 0, durationSteps: 4 },
    { id: "c3", note: "D#4", step: 0, durationSteps: 4 },
    { id: "c4", note: "G#3", step: 6, durationSteps: 4 },
    { id: "c5", note: "C4", step: 6, durationSteps: 4 },
    { id: "c6", note: "D#4", step: 6, durationSteps: 4 },
    { id: "c7", note: "A#3", step: 12, durationSteps: 4 },
    { id: "c8", note: "D4", step: 12, durationSteps: 4 },
  ],
  "Blissful Arp": [
    { id: "a1", note: "C3", step: 0, durationSteps: 2 },
    { id: "a2", note: "G3", step: 2, durationSteps: 2 },
    { id: "a3", note: "D#4", step: 4, durationSteps: 2 },
    { id: "a4", note: "D4", step: 6, durationSteps: 2 },
    { id: "a5", note: "C4", step: 8, durationSteps: 2 },
    { id: "a6", note: "G3", step: 10, durationSteps: 2 },
    { id: "a7", note: "A#3", step: 12, durationSteps: 2 },
    { id: "a8", note: "D4", step: 14, durationSteps: 2 },
  ],
  "Sub Groove": [
    { id: "b1", note: "C3", step: 0, durationSteps: 3 },
    { id: "b2", note: "C3", step: 4, durationSteps: 2 },
    { id: "b3", note: "D#3", step: 6, durationSteps: 2 },
    { id: "b4", note: "G3", step: 8, durationSteps: 3 },
    { id: "b5", note: "F3", step: 12, durationSteps: 2 },
    { id: "b6", note: "D#3", step: 14, durationSteps: 2 },
  ],
};

// Lightweight Standard MIDI File (.mid) parser for browser file imports
function parseMidiFileToRollNotes(buffer: ArrayBuffer): MidiRollNote[] {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 14) return [];

  const readUint32 = (offset: number) =>
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0;

  const readUint16 = (offset: number) => (bytes[offset] << 8) | bytes[offset + 1];

  const headerId = String.fromCharCode(...bytes.slice(0, 4));
  if (headerId !== "MThd") return [];

  const headerLength = readUint32(4);
  const ticksPerQuarter = readUint16(12) || 480;
  const ticksPer16th = ticksPerQuarter / 4;

  let cursor = 8 + headerLength;
  const rawEvents: { tick: number; noteNum: number; on: boolean }[] = [];

  while (cursor + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(...bytes.slice(cursor, cursor + 4));
    const chunkLen = readUint32(cursor + 4);
    const trackStart = cursor + 8;
    const trackEnd = Math.min(bytes.length, trackStart + chunkLen);

    if (chunkId === "MTrk") {
      let pos = trackStart;
      let absTick = 0;
      let runningStatus = 0;

      while (pos < trackEnd) {
        let delta = 0;
        while (pos < trackEnd) {
          const b = bytes[pos++];
          delta = (delta << 7) | (b & 0x7f);
          if ((b & 0x80) === 0) break;
        }
        absTick += delta;
        if (pos >= trackEnd) break;

        let status = bytes[pos];
        if (status < 0x80) {
          status = runningStatus;
        } else {
          pos++;
          if (status < 0xf0) runningStatus = status;
        }

        const eventType = status & 0xf0;
        if (eventType === 0x90 || eventType === 0x80) {
          const noteNum = bytes[pos++];
          const velocity = bytes[pos++];
          const isNoteOn = eventType === 0x90 && velocity > 0;
          rawEvents.push({ tick: absTick, noteNum, on: isNoteOn });
        } else if (eventType === 0xa0 || eventType === 0xb0 || eventType === 0xe0) {
          pos += 2;
        } else if (eventType === 0xc0 || eventType === 0xd0) {
          pos += 1;
        } else if (status === 0xff) {
          pos++;
          let metaLen = 0;
          while (pos < trackEnd) {
            const b = bytes[pos++];
            metaLen = (metaLen << 7) | (b & 0x7f);
            if ((b & 0x80) === 0) break;
          }
          pos += metaLen;
        } else if (status === 0xf0 || status === 0xf7) {
          let sysexLen = 0;
          while (pos < trackEnd) {
            const b = bytes[pos++];
            sysexLen = (sysexLen << 7) | (b & 0x7f);
            if ((b & 0x80) === 0) break;
          }
          pos += sysexLen;
        } else {
          break;
        }
      }
    }

    cursor = trackEnd;
  }

  rawEvents.sort((a, b) => a.tick - b.tick);

  const activeStarts = new Map<number, number>();
  const parsed: MidiRollNote[] = [];

  for (const ev of rawEvents) {
    let folded = ev.noteNum;
    while (folded < 48) folded += 12;
    while (folded > 64) folded -= 12;

    const matchedKey = PIANO_NOTES.find((k) => k.midiNum === folded);
    if (!matchedKey) continue;

    if (ev.on) {
      activeStarts.set(ev.noteNum, ev.tick);
    } else if (activeStarts.has(ev.noteNum)) {
      const startTick = activeStarts.get(ev.noteNum)!;
      activeStarts.delete(ev.noteNum);

      const startStep = Math.round(startTick / ticksPer16th) % 16;
      const rawSteps = Math.max(1, Math.round((ev.tick - startTick) / ticksPer16th));
      const durationSteps = Math.min(16 - startStep, Math.min(8, rawSteps));

      parsed.push({
        id: `imp-${parsed.length}-${startStep}-${matchedKey.note}`,
        note: matchedKey.note,
        step: startStep,
        durationSteps,
      });
    }
  }

  return parsed.slice(0, 64);
}

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
        className={`relative w-9 h-9 rounded-full flex items-center justify-center cursor-ns-resize transition-shadow ${
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
            strokeWidth="3.5"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="#2563eb"
            strokeWidth="3.5"
            strokeDasharray={`${(value / 100) * 94} 126`}
            strokeLinecap="round"
          />
        </svg>

        <div
          style={{ transform: `rotate(${angle}deg)` }}
          className={`w-6 h-6 rounded-full flex items-start justify-center pt-0.5 transition-transform duration-75 ${
            darkMode ? "bg-zinc-800 border border-zinc-700" : "bg-slate-50 border border-slate-200"
          }`}
        >
          <div className="w-0.5 h-2 rounded-full bg-blue-600" />
        </div>
      </div>
      <span className={`mt-1 text-[10px] font-medium leading-none ${darkMode ? "text-zinc-300" : "text-slate-700"}`}>
        {label}
      </span>
      <span className="text-[9px] font-mono text-blue-500 font-semibold leading-tight">{value}%</span>
    </div>
  );
}

export default function ProdPresetsMarketplace() {
  const supabase = useRef(createClient()).current;

  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("Presets");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);

  const [packs, setPacks] = useState<Pack[]>(FALLBACK_PACKS);
  const [assets, setAssets] = useState<AudioAsset[]>(FALLBACK_ASSETS);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<SynthEngine>("All");
  const [selectedKey, setSelectedKey] = useState<string>("All");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Supabase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Credits & Payments
  const [credits, setCredits] = useState<number>(0);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("Card");
  const [selectedBundleCredits, setSelectedBundleCredits] = useState<number>(100);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutBanner, setCheckoutBanner] = useState<"success" | "canceled" | null>(null);
  const [creditHistory, setCreditHistory] = useState<{ label: string; delta: number; date: string }[]>([]);

  // Synth Deck, Tone.Sampler & Polyphonic Multi-Key State
  const [activeAsset, setActiveAsset] = useState<AudioAsset>(FALLBACK_ASSETS[0]);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isSampleReady, setIsSampleReady] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [activeNotes, setActiveNotes] = useState<string[]>([]);
  const [dockMinimized, setDockMinimized] = useState(false);

  // Interactive MIDI Piano Roll Sequencer State
  const [pianoRollOpen, setPianoRollOpen] = useState(false);
  const [rollNotes, setRollNotes] = useState<MidiRollNote[]>(STARTER_PATTERNS["EDM Chords"]);
  const [drawLengthSteps, setDrawLengthSteps] = useState<number>(2);
  const [rollBpm, setRollBpm] = useState<number>(128);
  const [isRollPlaying, setIsRollPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [importedMidiName, setImportedMidiName] = useState<string | null>(null);
  const midiFileInputRef = useRef<HTMLInputElement | null>(null);

  const [cutoff, setCutoff] = useState(100);
  const [resonance, setResonance] = useState(15);
  const [envelope, setEnvelope] = useState(35);
  const [spaceMix, setSpaceMix] = useState(15);
  const [macro1, setMacro1] = useState(50);

  const samplerRef = useRef<Tone.Sampler | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayAfterLoadRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Build public URL from the capitalized `Previews` bucket
  const getPreviewUrl = useCallback((previewPath?: string | null) => {
    if (!previewPath) return null;
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) return null;
    const encodedPath = previewPath
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    return `${baseUrl}/storage/v1/object/public/Previews/${encodedPath}`;
  }, []);

  // Load live packs & presets from Supabase
  useEffect(() => {
    async function loadCatalog() {
      const [{ data: dbPacks }, { data: dbAssets }] = await Promise.all([
        supabase.from("packs").select("*").order("created_at", { ascending: false }),
        supabase.from("assets").select("*").order("filename", { ascending: true }),
      ]);

      const mergedPacks: Pack[] = [
        ...(dbPacks ?? []).map((p) => ({
          id: p.id,
          title: p.title,
          creator: p.creator,
          coverGradient: p.cover_gradient,
          description: p.description,
          genre: p.genre,
        })),
        ...FALLBACK_PACKS,
      ];
      setPacks(mergedPacks);

      const packMap = new Map(mergedPacks.map((p) => [p.id, p]));

      const mappedDbAssets: AudioAsset[] = (dbAssets ?? []).map((row) => {
        const parentPack = packMap.get(row.pack_id);
        return {
          id: row.id,
          filename: row.filename,
          storagePath: row.storage_path,
          previewPath: row.preview_path ?? null,
          packId: row.pack_id ?? "blissful-edm-sounds",
          packTitle: parentPack?.title ?? "Blissful EDM Sounds",
          coverGradient: parentPack?.coverGradient ?? "from-cyan-500 via-blue-600 to-indigo-700",
          engine: (row.engine as Exclude<SynthEngine, "All">) || "Serum",
          extension: row.extension || ".SerumPreset",
          category: row.category || "Synth",
          tags: Array.isArray(row.tags) ? row.tags : ["serum"],
          duration: row.duration || "0:04",
          musicalKey: row.musical_key || "C min",
          bpm: row.bpm ?? 128,
          credits: row.credits ?? 2,
          baseFreq: Number(row.base_freq) || 220,
          waveformBars:
            row.waveform_bars ||
            "35,60,85,95,70,50,90,100,80,65,45,75,90,60,40,70,85,55,35,25",
        };
      });

      const combinedAssets = [...mappedDbAssets, ...FALLBACK_ASSETS];
      setAssets(combinedAssets);
      if (mappedDbAssets.length > 0) {
        setActiveAsset(mappedDbAssets[0]);
      }
    }

    loadCatalog();
  }, [supabase]);

  // Sync sequencer BPM when switching to a preset that has a tagged BPM
  useEffect(() => {
    if (activeAsset.bpm && activeAsset.bpm >= 60 && activeAsset.bpm <= 200) {
      setRollBpm(activeAsset.bpm);
    }
  }, [activeAsset.id, activeAsset.bpm]);

  // Load real .m4a audio sample into Tone.Sampler whenever activeAsset changes
  useEffect(() => {
    setIsSampleReady(false);
    setSampleError(null);

    samplerRef.current?.releaseAll();
    samplerRef.current?.dispose();
    samplerRef.current = null;

    const previewUrl = getPreviewUrl(activeAsset.previewPath);
    if (!previewUrl) return;

    if (!filterRef.current) {
      filterRef.current = new Tone.Filter({
        type: "lowpass",
        frequency: 18000,
        Q: 1,
      }).toDestination();
    }

    const sampler = new Tone.Sampler({
      urls: {
        C3: previewUrl,
      },
      release: 0.35 + (envelope / 100) * 1.2,
      onload: () => {
        setIsSampleReady(true);
        if (autoPlayAfterLoadRef.current) {
          autoPlayAfterLoadRef.current = false;
          sampler.triggerAttackRelease("C3", 3.5);
          setIsPlayingPreview(true);
          if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
          previewTimeoutRef.current = setTimeout(() => setIsPlayingPreview(false), 3500);
        }
      },
      onerror: (err) => {
        console.error("Failed to load preview:", previewUrl, err);
        setSampleError("File not found in Storage");
      },
    }).connect(filterRef.current);

    samplerRef.current = sampler;

    return () => {
      sampler.releaseAll();
      sampler.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAsset.id, activeAsset.previewPath, getPreviewUrl]);

  // Live update Tone.js Filter & Release from Rotary Knobs
  useEffect(() => {
    if (filterRef.current) {
      const minFreq = 180;
      const maxFreq = 18000;
      const mappedFreq = minFreq * Math.pow(maxFreq / minFreq, cutoff / 100);
      filterRef.current.frequency.rampTo(mappedFreq, 0.05);
      filterRef.current.Q.rampTo(0.7 + (resonance / 100) * 10, 0.05);
    }
    if (samplerRef.current) {
      samplerRef.current.release = 0.2 + (envelope / 100) * 1.6;
    }
  }, [cutoff, resonance, envelope]);

  const loadUserWallet = useCallback(
    async (userId: string) => {
      const [{ data: profile }, { data: unlockRows }] = await Promise.all([
        supabase.from("profiles").select("credits").eq("id", userId).single(),
        supabase
          .from("unlocks")
          .select("asset_id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (profile) {
        setCredits(profile.credits);
      }
      if (unlockRows) {
        setOwnedIds(unlockRows.map((row) => row.asset_id));
        setCreditHistory(
          unlockRows.map((row) => ({
            label: `Unlocked ${row.asset_id}`,
            delta: -2,
            date: row.created_at ? new Date(row.created_at).toLocaleDateString() : "Saved",
          }))
        );
      }
    },
    [supabase]
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (data.user) loadUserWallet(data.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        loadUserWallet(nextUser.id);
      } else {
        setCredits(0);
        setOwnedIds([]);
        setCreditHistory([]);
      }
    });

    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    if (status === "success" || status === "canceled") {
      setCheckoutBanner(status);
      window.history.replaceState({}, "", "/");
    }

    return () => subscription.unsubscribe();
  }, [loadUserWallet, supabase]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);

    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });
      setAuthLoading(false);
      if (error) {
        setAuthError(error.message);
        return;
      }
      if (data.session) {
        setAuthModalOpen(false);
        setAuthEmail("");
        setAuthPassword("");
      } else {
        setAuthNotice("Check your email for a confirmation link, then sign in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      setAuthLoading(false);
      if (error) {
        setAuthError(error.message);
        return;
      }
      setAuthModalOpen(false);
      setAuthEmail("");
      setAuthPassword("");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAccountOpen(false);
  };

  const resetKnobs = () => {
    setCutoff(100);
    setResonance(15);
    setEnvelope(35);
    setSpaceMix(15);
    setMacro1(50);
  };

  const triggerFallbackOsc = useCallback(
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
        gain.gain.linearRampToValueAtTime(0.2, now + attack);
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

  // Trigger a timed note (used by Piano Roll playback)
  const triggerTimedNote = useCallback(
    async (noteName: string, durationSec: number) => {
      const found = PIANO_NOTES.find((n) => n.note === noteName);
      if (!found) return;

      if (activeAsset.previewPath) {
        await Tone.start();
        if (samplerRef.current && isSampleReady) {
          samplerRef.current.triggerAttackRelease(noteName, durationSec);
        }
      } else {
        triggerFallbackOsc(found.freq, durationSec);
      }
    },
    [activeAsset.previewPath, isSampleReady, triggerFallbackOsc]
  );

  // Piano Roll 16-step loop playback engine
  useEffect(() => {
    if (!isRollPlaying) {
      setCurrentStep(null);
      return;
    }

    let stepIndex = 0;
    const stepMs = (60 / rollBpm / 4) * 1000;

    const tick = () => {
      const activeStep = stepIndex % 16;
      setCurrentStep(activeStep);

      const notesAtStep = rollNotes.filter((n) => n.step === activeStep);
      const activeNames: string[] = [];

      for (const item of notesAtStep) {
        const durSec = Math.max(0.12, (item.durationSteps * stepMs) / 1000);
        triggerTimedNote(item.note, durSec);
        activeNames.push(item.note);
      }

      if (activeNames.length > 0) {
        setActiveNotes(activeNames);
      } else {
        setActiveNotes([]);
      }

      stepIndex++;
    };

    tick();
    const interval = setInterval(tick, stepMs);

    return () => {
      clearInterval(interval);
      setActiveNotes([]);
      setCurrentStep(null);
      samplerRef.current?.releaseAll();
    };
  }, [isRollPlaying, rollBpm, rollNotes, triggerTimedNote]);

  const handleToggleRollNote = (noteName: string, step: number) => {
    const existing = rollNotes.find(
      (n) => n.note === noteName && step >= n.step && step < n.step + n.durationSteps
    );

    if (existing) {
      setRollNotes((prev) => prev.filter((n) => n.id !== existing.id));
    } else {
      const clampedDuration = Math.min(drawLengthSteps, 16 - step);
      const newNote: MidiRollNote = {
        id: `${noteName}-${step}-${Date.now()}`,
        note: noteName,
        step,
        durationSteps: clampedDuration,
      };
      setRollNotes((prev) => [...prev, newNote]);
      triggerTimedNote(noteName, 0.35);
    }
  };

  const handleImportMidiFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMidiFileToRollNotes(buffer);
      if (parsed.length === 0) {
        alert("No playable notes found in that MIDI file.");
        return;
      }
      setRollNotes(parsed);
      setImportedMidiName(file.name);
      setPianoRollOpen(true);
      await Tone.start();
      setIsRollPlaying(true);
    } catch {
      alert("Unable to read that .mid file. Please try another standard MIDI file.");
    } finally {
      e.target.value = "";
    }
  };

  const handlePressNote = useCallback(
    async (noteName: string, freq: number) => {
      setActiveNotes((prev) => (prev.includes(noteName) ? prev : [...prev, noteName]));

      if (activeAsset.previewPath) {
        await Tone.start();
        if (samplerRef.current && isSampleReady) {
          samplerRef.current.triggerAttack(noteName);
        }
      } else {
        triggerFallbackOsc(freq, 0.65);
      }
    },
    [activeAsset.previewPath, isSampleReady, triggerFallbackOsc]
  );

  const handleReleaseNote = useCallback((noteName: string) => {
    setActiveNotes((prev) => prev.filter((n) => n !== noteName));
    if (samplerRef.current) {
      samplerRef.current.triggerRelease(noteName);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const found = PIANO_NOTES.find((k) => k.keyBind === e.key.toLowerCase());
      if (found && !e.repeat) {
        handlePressNote(found.note, found.freq);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const found = PIANO_NOTES.find((k) => k.keyBind === e.key.toLowerCase());
      if (found) {
        handleReleaseNote(found.note);
      }
    };

    const handleWindowBlur = () => {
      setActiveNotes([]);
      samplerRef.current?.releaseAll();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [handlePressNote, handleReleaseNote]);

  const handleTogglePlay = async (asset: AudioAsset) => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    setIsRollPlaying(false);

    if (activeAsset.id === asset.id && isPlayingPreview) {
      samplerRef.current?.releaseAll();
      setIsPlayingPreview(false);
      return;
    }

    if (asset.previewPath) {
      await Tone.start();
      if (activeAsset.id === asset.id && samplerRef.current && isSampleReady) {
        samplerRef.current.releaseAll();
        samplerRef.current.triggerAttackRelease("C3", 3.5);
        setIsPlayingPreview(true);
        previewTimeoutRef.current = setTimeout(() => setIsPlayingPreview(false), 3500);
      } else {
        autoPlayAfterLoadRef.current = true;
        setActiveAsset(asset);
        setIsPlayingPreview(true);
      }
      return;
    }

    setActiveAsset(asset);
    setIsPlayingPreview(true);
    triggerFallbackOsc(asset.baseFreq, 0.8);
    setTimeout(() => triggerFallbackOsc(asset.baseFreq * 1.25, 0.7), 220);
    setTimeout(() => triggerFallbackOsc(asset.baseFreq * 1.5, 0.9), 440);
    previewTimeoutRef.current = setTimeout(() => setIsPlayingPreview(false), 1400);
  };

  const triggerFileDownload = async (asset: AudioAsset, userId: string) => {
    if (!asset.storagePath) {
      alert(`Saved ${asset.filename} to My Library! (Demo item — no storage file attached)`);
      return;
    }

    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: asset.id,
        userId,
        storagePath: asset.storagePath,
        filename: asset.filename,
      }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || "Unable to download file");
    }
  };

  const handleUnlockAsset = async (asset: AudioAsset) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (ownedIds.includes(asset.id)) {
      await triggerFileDownload(asset, user.id);
      return;
    }
    if (credits < asset.credits) {
      setPaymentModalOpen(true);
      return;
    }

    const { data: newBalance, error } = await supabase.rpc("unlock_asset", {
      p_asset_id: asset.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (typeof newBalance === "number") {
      setCredits(newBalance);
    }

    setOwnedIds((prev) => (prev.includes(asset.id) ? prev : [...prev, asset.id]));
    setCreditHistory((prev) => [
      { label: `Unlocked ${asset.filename}`, delta: -asset.credits, date: "Just now" },
      ...prev,
    ]);

    await triggerFileDownload(asset, user.id);
  };

  const handleCompletePayment = async () => {
    if (!user) {
      setPaymentModalOpen(false);
      setAuthModalOpen(true);
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: selectedBundleCredits }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Unable to start checkout");
        setCheckoutLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Network error connecting to Stripe Checkout");
      setCheckoutLoading(false);
    }
  };

  const filteredAssets = assets.filter((item) => {
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
        pianoRollOpen ? "pb-[430px]" : "pb-44"
      } ${darkMode ? "bg-[#0e0f12] text-zinc-100" : "bg-white text-slate-900"}`}
    >
      {/* Hidden MIDI File Input */}
      <input
        ref={midiFileInputRef}
        type="file"
        accept=".mid,.midi,audio/midi,audio/x-midi"
        onChange={handleImportMidiFile}
        className="hidden"
      />

      {/* TOP NAVIGATION BAR */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          darkMode ? "bg-[#0e0f12]/90 border-zinc-800" : "bg-white/95 border-slate-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div
              onClick={() => {
                setSelectedPack(null);
                setActiveTab("Presets");
              }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/30 font-bold text-xs">
                VP
              </div>
              <span className="font-bold text-base sm:text-lg tracking-tight">
                Virtual<span className="text-blue-500">Presets</span>
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

          <div className="flex items-center gap-2">
            {/* Credit Wallet + Quick Buy Button */}
            <button
              onClick={() => (user ? setPaymentModalOpen(true) : setAuthModalOpen(true))}
              title="Click to add credits"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                darkMode
                  ? "bg-blue-950/60 border-blue-800/70 text-blue-400 hover:border-blue-500"
                  : "bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-400"
              }`}
            >
              <span className="text-blue-500">✦</span>
              <span>{credits} CR</span>
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px]">
                + Buy
              </span>
            </button>

            {/* Dark / Light Theme Switcher */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle studio theme"
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                darkMode
                  ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {darkMode ? "☀ Light" : "☾ Dark"}
            </button>

            {/* Account / Sign In Button */}
            {user ? (
              <button
                onClick={() => setAccountOpen(true)}
                className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                  darkMode
                    ? "border-zinc-800 bg-zinc-900 hover:border-blue-500"
                    : "border-slate-200 bg-white hover:border-blue-500 shadow-sm"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px] uppercase">
                  {user.email?.[0] ?? "P"}
                </div>
                <span className="hidden sm:inline max-w-[110px] truncate">{user.email}</span>
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CATALOG AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* CHECKOUT STATUS BANNER */}
        {checkoutBanner && (
          <div
            className={`rounded-xl border px-4 py-3 flex items-center justify-between text-xs font-medium ${
              checkoutBanner === "success"
                ? "bg-emerald-950/50 border-emerald-700 text-emerald-300"
                : "bg-zinc-900 border-zinc-700 text-zinc-300"
            }`}
          >
            <span>
              {checkoutBanner === "success"
                ? "✓ Payment confirmed! Your credits have been added to your wallet."
                : "Checkout canceled — no charges were made."}
            </span>
            <button onClick={() => setCheckoutBanner(null)} className="opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* PACK DETAIL BANNER */}
        {selectedPack && (
          <section
            className={`rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 ${
              darkMode ? "bg-zinc-900 border-zinc-800" : "bg-blue-50/50 border-blue-100"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-20 h-20 rounded-xl bg-gradient-to-br ${selectedPack.coverGradient} flex items-center justify-center text-white shadow-md shrink-0 font-bold text-lg`}
              >
                PACK
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-500">
                  {selectedPack.genre}
                </span>
                <h1 className="text-xl font-bold">{selectedPack.title}</h1>
                <p className={`text-xs max-w-xl ${darkMode ? "text-zinc-400" : "text-slate-600"}`}>
                  {selectedPack.description}
                </p>
                <p className="text-xs font-medium text-blue-500 pt-0.5">By {selectedPack.creator}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedPack(null)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
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
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {packs.map((pack) => (
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
                  className={`aspect-square w-full rounded-xl bg-gradient-to-br ${pack.coverGradient} mb-3.5 flex items-center justify-center text-white relative overflow-hidden`}
                >
                  <span className="text-3xl font-extrabold tracking-tight opacity-85 group-hover:scale-110 transition-transform">
                    VP
                  </span>
                  <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/50 backdrop-blur-sm text-xs font-semibold">
                    {pack.genre}
                  </span>
                </div>
                <h3 className="font-bold text-base group-hover:text-blue-500 transition-colors">
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
            <section className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedEngine}
                    onChange={(e) => setSelectedEngine(e.target.value as SynthEngine)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold outline-none focus:border-blue-600 ${
                      darkMode
                        ? "bg-zinc-900 border-zinc-800 text-zinc-200"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <option value="All">Synth / Format: All</option>
                    <option value="Analog Lab">Analog Lab (.labx)</option>
                    <option value="Serum">Serum (.fxp / .SerumPreset)</option>
                    <option value="Vital">Vital (.vital)</option>
                    <option value="Omnisphere">Omnisphere (.prt_omn)</option>
                    <option value="WAV">Audio Samples (.wav)</option>
                  </select>

                  <select
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold outline-none focus:border-blue-600 ${
                      darkMode
                        ? "bg-zinc-900 border-zinc-800 text-zinc-200"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <option value="All">Key: Any</option>
                    <option value="C min">C min</option>
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
                    className={`w-full px-3.5 py-1.5 rounded-lg border text-xs outline-none focus:border-blue-600 ${
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
                      className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
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
                      <th className="py-2.5 pl-4 pr-2 w-14">Pack</th>
                      <th className="py-2.5 px-2 w-10"></th>
                      <th className="py-2.5 px-3">Filename</th>
                      <th className="py-2.5 px-3 hidden md:table-cell">Waveform</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Key</th>
                      <th className="py-2.5 px-3">BPM</th>
                      <th className="py-2.5 pl-3 pr-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-sm">
                    {filteredAssets.map((item) => {
                      const isCurrent = activeAsset.id === item.id;
                      const isRowPlaying = isCurrent && isPlayingPreview;
                      const isOwned = ownedIds.includes(item.id);
                      const bars = item.waveformBars.split(",").map(Number);

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setActiveAsset(item)}
                          className={`group transition-colors cursor-pointer ${
                            isCurrent
                              ? darkMode
                                ? "bg-blue-950/30"
                                : "bg-blue-50/70"
                              : darkMode
                              ? "hover:bg-zinc-800/40"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="py-2 pl-4 pr-2">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const foundPack = packs.find((p) => p.id === item.packId);
                                if (foundPack) setSelectedPack(foundPack);
                              }}
                              title={`View pack: ${item.packTitle}`}
                              className={`w-9 h-9 rounded-md bg-gradient-to-br ${item.coverGradient} flex items-center justify-center text-white text-[10px] font-bold shadow-sm hover:scale-105 transition-transform`}
                            >
                              VP
                            </div>
                          </td>

                          <td className="py-2 px-2">
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

                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[13px] group-hover:text-blue-500 transition-colors">
                                {item.filename}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  item.engine === "WAV"
                                    ? darkMode
                                      ? "bg-zinc-800 text-zinc-300"
                                      : "bg-slate-200 text-slate-700"
                                    : "bg-blue-600/20 text-blue-400"
                                }`}
                              >
                                {item.engine}
                              </span>
                              {item.previewPath && (
                                <span
                                  title="Real Serum audio preview loaded"
                                  className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400"
                                >
                                  HQ Audio
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
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

                          <td className="py-2 px-3 hidden md:table-cell">
                            <div className="flex items-center gap-[2px] h-6 w-36">
                              {bars.map((height, idx) => (
                                <div
                                  key={idx}
                                  style={{ height: `${height}%` }}
                                  className={`w-1 rounded-full transition-colors ${
                                    isRowPlaying
                                      ? "bg-blue-500 animate-pulse"
                                      : isCurrent
                                      ? "bg-blue-500"
                                      : darkMode
                                      ? "bg-zinc-700 group-hover:bg-zinc-500"
                                      : "bg-slate-300 group-hover:bg-blue-400"
                                  }`}
                                />
                              ))}
                            </div>
                          </td>

                          <td className="py-2 px-3 text-xs font-mono opacity-75">{item.duration}</td>
                          <td className="py-2 px-3 text-xs font-medium opacity-80">{item.musicalKey}</td>
                          <td className="py-2 px-3 text-xs font-mono opacity-75">
                            {item.bpm ?? "--"}
                          </td>

                          <td className="py-2 pl-3 pr-4 text-right">
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
                                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium ${
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
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                                  isOwned
                                    ? darkMode
                                      ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                }`}
                              >
                                {isOwned ? "↓ Download" : `↓ ${item.credits} CR`}
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
                    {activeTab === "My Library" && !user
                      ? "Sign in to view your saved presets and samples."
                      : "No presets or samples match your current filters."}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* BOTTOM DOCKED SYNTH DECK + EXPANDABLE MIDI PIANO ROLL */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur-xl transition-colors ${
          darkMode
            ? "bg-[#12141a]/95 border-zinc-800 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
            : "bg-white/95 border-slate-200 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]"
        }`}
      >
        {/* EXPANDABLE INTERACTIVE MIDI PIANO ROLL DRAWER */}
        {pianoRollOpen && (
          <div
            className={`border-b ${
              darkMode ? "bg-[#0d0f14] border-zinc-800" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2.5">
              {/* Piano Roll Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={async () => {
                      await Tone.start();
                      setIsRollPlaying((p) => !p);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      isRollPlaying
                        ? "bg-rose-600 hover:bg-rose-700 text-white"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    {isRollPlaying ? "■ Stop Loop" : "▶ Play MIDI Loop"}
                  </button>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="opacity-60 font-medium">BPM:</span>
                    <input
                      type="number"
                      min={60}
                      max={200}
                      value={rollBpm}
                      onChange={(e) => setRollBpm(Math.min(200, Math.max(60, Number(e.target.value) || 128)))}
                      className={`w-14 px-2 py-1 rounded-md border text-xs font-mono ${
                        darkMode ? "bg-zinc-900 border-zinc-700" : "bg-white border-slate-300"
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-1 text-xs">
                    <span className="opacity-60 font-medium hidden sm:inline">Note Len:</span>
                    {[
                      { label: "1/16", steps: 1 },
                      { label: "1/8", steps: 2 },
                      { label: "1/4", steps: 4 },
                    ].map((len) => (
                      <button
                        key={len.steps}
                        onClick={() => setDrawLengthSteps(len.steps)}
                        className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold border ${
                          drawLengthSteps === len.steps
                            ? "bg-blue-600 text-white border-blue-500"
                            : darkMode
                            ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                            : "bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        {len.label}
                      </button>
                    ))}
                  </div>

                  {/* Starter Patterns */}
                  <div className="hidden md:flex items-center gap-1 pl-1">
                    {Object.keys(STARTER_PATTERNS).map((name) => (
                      <button
                        key={name}
                        onClick={() => {
                          setRollNotes(STARTER_PATTERNS[name]);
                          setImportedMidiName(null);
                        }}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium border ${
                          darkMode
                            ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-blue-500"
                            : "bg-white border-slate-200 text-slate-700 hover:border-blue-500"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {importedMidiName && (
                    <span className="text-[11px] font-mono text-blue-400 max-w-[140px] truncate">
                      🎵 {importedMidiName}
                    </span>
                  )}

                  <button
                    onClick={() => midiFileInputRef.current?.click()}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                      darkMode
                        ? "bg-zinc-900 border-zinc-700 text-blue-400 hover:border-blue-500"
                        : "bg-white border-slate-300 text-blue-600 hover:border-blue-500"
                    }`}
                  >
                    ↑ Import .MID
                  </button>

                  <button
                    onClick={() => {
                      setRollNotes([]);
                      setImportedMidiName(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                      darkMode
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-rose-400"
                        : "bg-white border-slate-200 text-slate-600 hover:text-rose-600"
                    }`}
                  >
                    Clear
                  </button>

                  <button
                    onClick={() => setPianoRollOpen(false)}
                    className="px-2 py-1 rounded-lg text-xs opacity-60 hover:opacity-100"
                    title="Close Piano Roll"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 16-Step Piano Roll Grid */}
              <div
                className={`rounded-xl border overflow-x-auto max-h-52 overflow-y-auto select-none ${
                  darkMode ? "border-zinc-800 bg-zinc-950" : "border-slate-300 bg-white"
                }`}
              >
                <div className="min-w-[680px]">
                  {ROLL_ROWS.map((row) => (
                    <div
                      key={row.note}
                      className={`flex items-stretch h-4 border-b last:border-b-0 ${
                        darkMode ? "border-zinc-900" : "border-slate-100"
                      }`}
                    >
                      {/* Left Pitch Label */}
                      <button
                        onClick={() => triggerTimedNote(row.note, 0.35)}
                        className={`w-12 shrink-0 px-1.5 text-[10px] font-mono font-bold text-left flex items-center justify-between border-r ${
                          row.isBlack
                            ? darkMode
                              ? "bg-zinc-900 text-zinc-400 border-zinc-800"
                              : "bg-slate-200 text-slate-700 border-slate-300"
                            : darkMode
                            ? "bg-zinc-800/80 text-zinc-200 border-zinc-800"
                            : "bg-slate-50 text-slate-800 border-slate-300"
                        }`}
                      >
                        <span>{row.note}</span>
                      </button>

                      {/* 16 Step Cells */}
                      <div className="flex-1 grid grid-cols-16 relative">
                        {Array.from({ length: 16 }).map((_, stepIdx) => {
                          const startingNote = rollNotes.find(
                            (n) => n.note === row.note && n.step === stepIdx
                          );
                          const coveredByPrev = rollNotes.some(
                            (n) =>
                              n.note === row.note &&
                              stepIdx > n.step &&
                              stepIdx < n.step + n.durationSteps
                          );
                          const isBeatStart = stepIdx % 4 === 0;
                          const isPlayhead = currentStep === stepIdx;

                          return (
                            <div
                              key={stepIdx}
                              onClick={() => handleToggleRollNote(row.note, stepIdx)}
                              className={`relative border-r cursor-pointer transition-colors ${
                                isBeatStart
                                  ? darkMode
                                    ? "border-zinc-700"
                                    : "border-slate-300"
                                  : darkMode
                                  ? "border-zinc-900"
                                  : "border-slate-100"
                              } ${
                                isPlayhead
                                  ? "bg-blue-500/20"
                                  : row.isBlack
                                  ? darkMode
                                    ? "bg-zinc-950 hover:bg-zinc-800/60"
                                    : "bg-slate-100/80 hover:bg-blue-50"
                                  : darkMode
                                  ? "bg-zinc-900/30 hover:bg-zinc-800/60"
                                  : "bg-white hover:bg-blue-50"
                              }`}
                            >
                              {startingNote && (
                                <div
                                  style={{
                                    width: `calc(${startingNote.durationSteps * 100}% - 2px)`,
                                  }}
                                  className="absolute inset-y-[1px] left-[1px] z-10 rounded-[3px] bg-blue-600 hover:bg-blue-500 shadow-xs flex items-center px-1 text-[8px] font-mono text-white font-bold pointer-events-none"
                                >
                                  {startingNote.durationSteps > 1 ? row.note : ""}
                                </div>
                              )}
                              {!startingNote && coveredByPrev && <span className="sr-only">held</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MAIN SYNTH DECK BAR */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
            <div className="flex items-center justify-between w-full lg:w-auto gap-3 min-w-[260px]">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white">
                    {activeAsset.engine}
                  </span>
                  <span className="text-[11px] font-mono opacity-60">{activeAsset.extension}</span>
                  {activeAsset.previewPath && (
                    <span
                      className={`text-[10px] font-semibold ${
                        sampleError
                          ? "text-rose-400"
                          : isSampleReady
                          ? "text-emerald-400"
                          : "text-amber-400 animate-pulse"
                      }`}
                    >
                      {sampleError
                        ? `✕ ${sampleError}`
                        : isSampleReady
                        ? "● Ready"
                        : "○ Loading..."}
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold truncate max-w-[210px] mt-0.5">
                  {activeAsset.filename}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleTogglePlay(activeAsset)}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors"
                >
                  {isPlayingPreview ? "■ Stop" : "▶ Play"}
                </button>
                <button
                  onClick={() => setPianoRollOpen((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                    pianoRollOpen
                      ? "bg-blue-600/20 border-blue-500 text-blue-400"
                      : darkMode
                      ? "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-blue-500"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-500"
                  }`}
                >
                  🎹 Piano Roll
                </button>
                <button
                  onClick={resetKnobs}
                  title="Reset FX Knobs"
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                    darkMode
                      ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  ↺
                </button>
                <button
                  onClick={() => setDockMinimized(!dockMinimized)}
                  className={`lg:hidden px-2 py-1.5 rounded-lg border text-[11px] font-medium ${
                    darkMode ? "border-zinc-700 text-zinc-300" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {dockMinimized ? "Show Synth" : "Hide"}
                </button>
              </div>
            </div>

            {!dockMinimized && (
              <>
                <div
                  className={`flex items-center justify-center gap-3.5 sm:gap-4 px-3.5 py-1.5 rounded-xl border ${
                    darkMode ? "bg-zinc-950/70 border-zinc-800" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <RotaryKnob label="Cutoff" value={cutoff} onChange={setCutoff} darkMode={darkMode} />
                  <RotaryKnob label="Res" value={resonance} onChange={setResonance} darkMode={darkMode} />
                  <RotaryKnob label="Env" value={envelope} onChange={setEnvelope} darkMode={darkMode} />
                  <RotaryKnob label="Space" value={spaceMix} onChange={setSpaceMix} darkMode={darkMode} />
                  <RotaryKnob label="Macro" value={macro1} onChange={setMacro1} darkMode={darkMode} />
                </div>

                <div className="w-full lg:w-[420px] xl:w-[470px] overflow-x-auto select-none">
                  <div className="relative h-14 min-w-[380px] w-full flex">
                    {PIANO_NOTES.filter((n) => !n.isBlack).map((k) => {
                      const isPressed = activeNotes.includes(k.note);
                      return (
                        <button
                          key={k.note}
                          onMouseDown={() => handlePressNote(k.note, k.freq)}
                          onMouseUp={() => handleReleaseNote(k.note)}
                          onMouseLeave={() => handleReleaseNote(k.note)}
                          className={`flex-1 h-full border rounded-b-md flex flex-col justify-end items-center pb-1 transition-all ${
                            isPressed
                              ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.75)] translate-y-0.5"
                              : darkMode
                              ? "bg-zinc-100 text-zinc-800 border-zinc-400 hover:bg-blue-50"
                              : "bg-white text-slate-500 border-slate-300 hover:bg-blue-50/70"
                          }`}
                        >
                          <span className="text-[9px] font-mono uppercase opacity-75">{k.keyBind}</span>
                        </button>
                      );
                    })}

                    <div className="pointer-events-none absolute inset-0 flex">
                      {PIANO_NOTES.map((k, idx) => {
                        if (!k.isBlack) return null;
                        const whiteKeysBefore = PIANO_NOTES.slice(0, idx).filter((n) => !n.isBlack).length;
                        const leftPercent = (whiteKeysBefore / 10) * 100 - 3;
                        const isPressed = activeNotes.includes(k.note);
                        return (
                          <button
                            key={k.note}
                            style={{ left: `${leftPercent}%` }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handlePressNote(k.note, k.freq);
                            }}
                            onMouseUp={() => handleReleaseNote(k.note)}
                            onMouseLeave={() => handleReleaseNote(k.note)}
                            className={`pointer-events-auto absolute top-0 w-[6%] h-[58%] rounded-b z-10 flex flex-col justify-end items-center pb-0.5 text-[8px] font-mono uppercase transition-all ${
                              isPressed
                                ? "bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.9)] translate-y-0.5"
                                : "bg-slate-900 text-slate-400 hover:bg-slate-800 shadow"
                            }`}
                          >
                            {k.keyBind}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* AUTH MODAL (SIGN IN / CREATE ACCOUNT) */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-2xl ${
              darkMode ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {authMode === "signin" ? "Sign In to VirtualPresets" : "Create Producer Account"}
                </h3>
                <p className="text-xs opacity-60">Sync your credits & preset library across devices</p>
              </div>
              <button
                onClick={() => setAuthModalOpen(false)}
                className="px-2.5 py-1 rounded-lg hover:bg-zinc-800/40 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold opacity-75 block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@studio.com"
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-blue-600 ${
                    darkMode ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>
              <div>
                <label className="text-xs font-semibold opacity-75 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-blue-600 ${
                    darkMode ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              {authError && <p className="text-xs text-rose-400">{authError}</p>}
              {authNotice && <p className="text-xs text-emerald-400">{authNotice}</p>}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
              >
                {authLoading
                  ? "Please wait..."
                  : authMode === "signin"
                  ? "Sign In"
                  : "Create Account"}
              </button>
            </form>

            <div className="text-center text-xs opacity-75 pt-1">
              {authMode === "signin" ? (
                <>
                  New to VirtualPresets?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError(null);
                    }}
                    className="text-blue-500 font-semibold hover:underline"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signin");
                      setAuthError(null);
                    }}
                    className="text-blue-500 font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STRIPE CREDIT CHECKOUT MODAL */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 space-y-5 shadow-2xl ${
              darkMode ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Top Up VirtualPresets Credits</h3>
                <p className="text-xs opacity-60">Instant delivery • Credits never expire</p>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="px-2.5 py-1 rounded-lg hover:bg-zinc-800/40 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { cr: 50, price: "$9.99", tag: "Starter" },
                { cr: 100, price: "$17.99", tag: "Most Popular" },
                { cr: 250, price: "$39.99", tag: "Studio Pro" },
              ].map((tier) => {
                const selected = selectedBundleCredits === tier.cr;
                return (
                  <button
                    key={tier.cr}
                    onClick={() => setSelectedBundleCredits(tier.cr)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selected
                        ? "border-blue-600 bg-blue-600/10 ring-1 ring-blue-600"
                        : darkMode
                        ? "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase text-blue-500">{tier.tag}</div>
                    <div className="text-base font-extrabold mt-0.5">{tier.cr} CR</div>
                    <div className="text-xs opacity-75 font-medium">{tier.price}</div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider opacity-60 block">
                Supported via Stripe Checkout
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "Card", label: "💳 Credit / Debit Card" },
                  { id: "Apple Pay", label: " Apple Pay" },
                  { id: "Google Pay", label: "G Pay / Link" },
                  { id: "Klarna", label: "Split Pay / Klarna" },
                ].map((method) => {
                  const active = selectedPaymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setSelectedPaymentMethod(method.id)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition-colors ${
                        active
                          ? "border-blue-600 bg-blue-600 text-white"
                          : darkMode
                          ? "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {method.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleCompletePayment}
              disabled={checkoutLoading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition-colors"
            >
              {checkoutLoading
                ? "Redirecting to Stripe..."
                : `Continue to Stripe • Add ${selectedBundleCredits} Credits`}
            </button>
          </div>
        </div>
      )}

      {/* USER ACCOUNT DRAWER */}
      {accountOpen && user && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div
            className={`w-full max-w-md h-full p-6 flex flex-col justify-between overflow-y-auto ${
              darkMode ? "bg-zinc-900 text-zinc-100" : "bg-white text-slate-900"
            }`}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold uppercase">
                    {user.email?.[0] ?? "P"}
                  </div>
                  <div>
                    <h3 className="font-bold text-base truncate max-w-[230px]">{user.email}</h3>
                    <p className="text-xs opacity-60">VirtualPresets Studio Wallet</p>
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
                      setAccountOpen(false);
                      setPaymentModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white text-blue-700 text-xs font-bold hover:bg-blue-50 transition-colors"
                  >
                    + Buy More Credits
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
                  {creditHistory.length === 0 ? (
                    <p className="text-xs opacity-50">No credit transactions yet.</p>
                  ) : (
                    creditHistory.map((entry, i) => (
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
                            entry.delta > 0 ? "text-emerald-500" : "text-blue-500"
                          }`}
                        >
                          {entry.delta > 0 ? `+${entry.delta}` : entry.delta} CR
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
              <span className="opacity-60">100% Royalty-Free Licensing</span>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-rose-500 text-rose-400 font-semibold"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
