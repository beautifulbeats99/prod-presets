"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as Tone from "tone";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

type TabType = "Home" | "Presets" | "Samples" | "Packs" | "My Library";
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
  note: string;
  step: number; // 0 to 127 (8 bars * 16 sixteenth-notes)
  durationSteps: number; // 1 to 128
}

interface RollKeyInfo {
  note: string;
  midiNum: number;
  freq: number;
  isBlack: boolean;
  isC: boolean;
}

const TOTAL_BARS = 8;
const STEPS_PER_BAR = 16;
const TOTAL_STEPS = TOTAL_BARS * STEPS_PER_BAR; // 128 steps
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// 3 Full Octaves: C2 (MIDI 36) through C5 (MIDI 72)
const ROLL_KEYS_ASC: RollKeyInfo[] = Array.from({ length: 37 }, (_, i) => {
  const midiNum = 36 + i;
  const name = NOTE_NAMES[midiNum % 12];
  const octave = Math.floor(midiNum / 12) - 1;
  const note = `${name}${octave}`;
  const isBlack = name.includes("#");
  const freq = 440 * Math.pow(2, (midiNum - 69) / 12);
  return { note, midiNum, freq, isBlack, isC: name === "C" };
});

// Top-to-bottom (C5 at top, C2 at bottom)
const ROLL_ROWS: RollKeyInfo[] = [...ROLL_KEYS_ASC].reverse();

function getMidiNoteFreq(noteName: string): number {
  const found = ROLL_KEYS_ASC.find((k) => k.note === noteName);
  return found ? found.freq : 261.63;
}

function parseMidiFile(buffer: ArrayBuffer): {
  notes: MidiRollNote[];
  detectedBpm: number | null;
} {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 14) return { notes: [], detectedBpm: null };

  const readUint32 = (offset: number) =>
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0;

  const readUint16 = (offset: number) => (bytes[offset] << 8) | bytes[offset + 1];

  const headerId = String.fromCharCode(...bytes.slice(0, 4));
  if (headerId !== "MThd") return { notes: [], detectedBpm: null };

  const headerLength = readUint32(4);
  const ticksPerQuarter = readUint16(12) || 480;
  const ticksPer16th = ticksPerQuarter / 4;

  let cursor = 8 + headerLength;
  const rawEvents: { tick: number; noteNum: number; channel: number; on: boolean }[] = [];
  let detectedBpm: number | null = null;

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
        const channel = status & 0x0f;

        if (eventType === 0x90 || eventType === 0x80) {
          const noteNum = bytes[pos++];
          const velocity = bytes[pos++];
          const isNoteOn = eventType === 0x90 && velocity > 0;
          rawEvents.push({ tick: absTick, noteNum, channel, on: isNoteOn });
        } else if (eventType === 0xa0 || eventType === 0xb0 || eventType === 0xe0) {
          pos += 2;
        } else if (eventType === 0xc0 || eventType === 0xd0) {
          pos += 1;
        } else if (status === 0xff) {
          const metaType = bytes[pos++];
          let metaLen = 0;
          while (pos < trackEnd) {
            const b = bytes[pos++];
            metaLen = (metaLen << 7) | (b & 0x7f);
            if ((b & 0x80) === 0) break;
          }
          // Meta Event 0x51 = Set Tempo (3 bytes, microseconds per quarter note)
          if (metaType === 0x51 && metaLen === 3 && pos + 3 <= trackEnd && detectedBpm === null) {
            const usPerQuarter =
              (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
            if (usPerQuarter > 0) {
              const bpm = Math.round(60_000_000 / usPerQuarter);
              detectedBpm = Math.min(240, Math.max(40, bpm));
            }
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

  const activeStarts = new Map<string, number>();
  const parsed: MidiRollNote[] = [];

  for (const ev of rawEvents) {
    let folded = ev.noteNum;
    while (folded < 36) folded += 12;
    while (folded > 72) folded -= 12;

    const matchedKey = ROLL_KEYS_ASC.find((k) => k.midiNum === folded);
    if (!matchedKey) continue;

    const mapKey = `${ev.channel}-${ev.noteNum}`;

    if (ev.on) {
      activeStarts.set(mapKey, ev.tick);
    } else if (activeStarts.has(mapKey)) {
      const startTick = activeStarts.get(mapKey)!;
      activeStarts.delete(mapKey);

      const startStep = Math.round(startTick / ticksPer16th);
      if (startStep >= TOTAL_STEPS) continue;

      const rawSteps = Math.max(1, Math.round((ev.tick - startTick) / ticksPer16th));
      const durationSteps = Math.min(TOTAL_STEPS - startStep, Math.min(32, rawSteps));

      parsed.push({
        id: `imp-${parsed.length}-${startStep}-${matchedKey.note}`,
        note: matchedKey.note,
        step: startStep,
        durationSteps,
      });
    }
  }

  return { notes: parsed.slice(0, 512), detectedBpm };
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
    waveformBars: "35,60,85,95,70,50,90,100,80,65,45,75,90,60,40,70,85,55,35,25,65,80,55,40",
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
    waveformBars: "25,40,55,70,85,95,90,85,80,75,85,90,80,70,60,50,45,35,30,20,40,55,45,30",
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
    waveformBars: "90,45,85,40,95,50,80,35,90,45,85,40,75,35,80,40,65,30,50,25,75,40,60,30",
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
    waveformBars: "20,30,45,60,75,85,95,100,95,90,85,80,75,70,60,50,40,30,25,15,35,45,30,20",
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
    waveformBars: "95,40,75,30,90,45,85,35,95,40,80,30,90,45,75,35,85,40,60,25,80,35,65,30",
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
    waveformBars: "75,85,70,60,80,90,75,65,85,80,70,60,75,85,70,55,45,35,25,20,60,70,50,35",
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

function LogicPianoRoll({
  darkMode,
  rollNotes,
  setRollNotes,
  rollBpm,
  setRollBpm,
  isRollPlaying,
  onTogglePlay,
  currentStep,
  onSeekStep,
  activeNotes,
  onTriggerNote,
  importedMidiName,
  onImportMidiBuffer,
  onClickImportButton,
  starterPatterns,
  onSelectStarterPattern,
  onClearNotes,
  onClose,
}: {
  darkMode: boolean;
  rollNotes: MidiRollNote[];
  setRollNotes: React.Dispatch<React.SetStateAction<MidiRollNote[]>>;
  rollBpm: number;
  setRollBpm: (bpm: number) => void;
  isRollPlaying: boolean;
  onTogglePlay: () => void;
  currentStep: number | null;
  onSeekStep: (step: number) => void;
  activeNotes: string[];
  onTriggerNote: (noteName: string, durationSec: number) => void;
  importedMidiName: string | null;
  onImportMidiBuffer: (buffer: ArrayBuffer, filename: string) => void;
  onClickImportButton: () => void;
  starterPatterns: Record<string, MidiRollNote[]>;
  onSelectStarterPattern: (name: string) => void;
  onClearNotes: () => void;
  onClose: () => void;
}) {
  const [panelHeight, setPanelHeight] = useState<number>(320);
  const [stepWidth, setStepWidth] = useState<number>(20);
  const [rowHeight, setRowHeight] = useState<number>(18);
  const [drawLengthSteps, setDrawLengthSteps] = useState<number>(4);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isDragOverMidi, setIsDragOverMidi] = useState(false);

  const [bpmInput, setBpmInput] = useState<string>(String(rollBpm));
  useEffect(() => {
    setBpmInput(String(rollBpm));
  }, [rollBpm]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);

  useEffect(() => {
    if (!hasAutoScrolledRef.current && scrollContainerRef.current) {
      hasAutoScrolledRef.current = true;
      scrollContainerRef.current.scrollTop = Math.max(0, 10 * rowHeight);
    }
  }, [rowHeight]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if ((e.key === "Backspace" || e.key === "Delete") && selectedNoteId) {
        e.preventDefault();
        setRollNotes((prev) => prev.filter((n) => n.id !== selectedNoteId));
        setSelectedNoteId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNoteId, setRollNotes]);

  const commitBpm = () => {
    const parsed = parseInt(bpmInput, 10);
    if (Number.isNaN(parsed)) {
      setBpmInput(String(rollBpm));
      return;
    }
    const clamped = Math.min(240, Math.max(40, parsed));
    setRollBpm(clamped);
    setBpmInput(String(clamped));
  };

  const handleStartPanelResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = panelHeight;

    const onMove = (moveEv: MouseEvent) => {
      const deltaY = startY - moveEv.clientY;
      const maxH = Math.floor(window.innerHeight * 0.72);
      setPanelHeight(Math.min(maxH, Math.max(180, startHeight + deltaY)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleNoteDragStart = (
    e: React.MouseEvent,
    note: MidiRollNote,
    mode: "move" | "resize"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedNoteId(note.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const origStep = note.step;
    const origDuration = note.durationSteps;
    const origRowIdx = ROLL_ROWS.findIndex((r) => r.note === note.note);
    let lastAuditionedRow = origRowIdx;

    const onMove = (moveEv: MouseEvent) => {
      const deltaSteps = Math.round((moveEv.clientX - startX) / stepWidth);

      if (mode === "resize") {
        const nextDur = Math.max(1, Math.min(TOTAL_STEPS - origStep, origDuration + deltaSteps));
        setRollNotes((prev) =>
          prev.map((n) => (n.id === note.id ? { ...n, durationSteps: nextDur } : n))
        );
      } else {
        const deltaRows = Math.round((moveEv.clientY - startY) / rowHeight);
        const nextRowIdx = Math.min(ROLL_ROWS.length - 1, Math.max(0, origRowIdx + deltaRows));
        const nextStep = Math.min(TOTAL_STEPS - origDuration, Math.max(0, origStep + deltaSteps));
        const nextNoteName = ROLL_ROWS[nextRowIdx].note;

        if (nextRowIdx !== lastAuditionedRow) {
          lastAuditionedRow = nextRowIdx;
          onTriggerNote(nextNoteName, 0.22);
        }

        setRollNotes((prev) =>
          prev.map((n) =>
            n.id === note.id ? { ...n, step: nextStep, note: nextNoteName } : n
          )
        );
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const step = Math.min(TOTAL_STEPS - 1, Math.max(0, Math.floor(x / stepWidth)));
    const rowIdx = Math.min(ROLL_ROWS.length - 1, Math.max(0, Math.floor(y / rowHeight)));
    const row = ROLL_ROWS[rowIdx];
    if (!row) return;

    const clampedDuration = Math.min(drawLengthSteps, TOTAL_STEPS - step);
    const newNote: MidiRollNote = {
      id: `${row.note}-${step}-${Date.now()}`,
      note: row.note,
      step,
      durationSteps: clampedDuration,
    };

    setRollNotes((prev) => [...prev, newNote]);
    setSelectedNoteId(newNote.id);
    onTriggerNote(row.note, 0.35);
  };

  const handleDropMidi = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverMidi(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".mid") && !file.name.toLowerCase().endsWith(".midi")) {
      alert("Please drop a valid .mid or .midi file.");
      return;
    }
    const buffer = await file.arrayBuffer();
    onImportMidiBuffer(buffer, file.name);
  };

  const rowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    ROLL_ROWS.forEach((r, idx) => map.set(r.note, idx));
    return map;
  }, []);

  const gridWidth = TOTAL_STEPS * stepWidth;
  const gridHeight = ROLL_ROWS.length * rowHeight;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragOverMidi) setIsDragOverMidi(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOverMidi(false);
        }
      }}
      onDrop={handleDropMidi}
      className={`relative border-b select-none ${
        darkMode ? "bg-[#111216] border-white/[0.08]" : "bg-slate-50 border-slate-200"
      }`}
    >
      {/* DRAGGABLE TOP RESIZE BAR */}
      <div
        onMouseDown={handleStartPanelResize}
        title="Drag up or down to resize Piano Roll"
        className="h-2.5 w-full cursor-ns-resize flex items-center justify-center group hover:bg-blue-500/15 transition-colors"
      >
        <div className="w-12 h-1 rounded-full bg-zinc-600/60 group-hover:bg-blue-400 transition-colors" />
      </div>

      {/* MIDI DRAG-OVER OVERLAY */}
      {isDragOverMidi && (
        <div className="absolute inset-0 z-40 bg-blue-600/20 backdrop-blur-[2px] border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
          <div className="px-5 py-3 rounded-2xl bg-[#0d0e12]/95 border border-blue-400 text-blue-300 text-sm font-bold shadow-xl">
            Drop .MID file to load notes &amp; auto-detect BPM
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 space-y-2">
        {/* TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onTogglePlay}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                isRollPlaying
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {isRollPlaying ? "■ Stop" : "▶ Play 8 Bars"}
            </button>

            {/* FREE-TYPE BPM INPUT */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="opacity-50 font-mono text-[11px]">BPM</span>
              <input
                type="text"
                inputMode="numeric"
                value={bpmInput}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                  setBpmInput(cleaned);
                }}
                onBlur={commitBpm}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitBpm();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                title="Type BPM (40–240) and press Enter"
                className={`w-14 px-2 py-1 rounded-md border text-xs font-mono text-center outline-none focus:border-blue-500 ${
                  darkMode ? "bg-zinc-900 border-white/15 text-zinc-100" : "bg-white border-slate-300"
                }`}
              />
            </div>

            {/* DEFAULT NOTE LENGTH */}
            <div className="flex items-center gap-1 text-xs">
              <span className="opacity-50 font-mono text-[11px] hidden sm:inline">NOTE</span>
              {[
                { label: "1/16", steps: 1 },
                { label: "1/8", steps: 2 },
                { label: "1/4", steps: 4 },
                { label: "1/2", steps: 8 },
              ].map((len) => (
                <button
                  key={len.steps}
                  onClick={() => setDrawLengthSteps(len.steps)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold border ${
                    drawLengthSteps === len.steps
                      ? "bg-blue-600 text-white border-blue-500"
                      : darkMode
                      ? "bg-zinc-900 border-white/[0.08] text-zinc-400 hover:text-white"
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  {len.label}
                </button>
              ))}
            </div>

            {/* STARTER PATTERNS */}
            <div className="hidden lg:flex items-center gap-1 pl-1">
              {Object.keys(starterPatterns).map((name) => (
                <button
                  key={name}
                  onClick={() => onSelectStarterPattern(name)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border ${
                    darkMode
                      ? "bg-white/[0.03] border-white/[0.08] text-zinc-300 hover:border-blue-500"
                      : "bg-white border-slate-200 text-slate-700 hover:border-blue-500"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT CONTROLS: ZOOM, SIZE, MIDI IMPORT, CLEAR */}
          <div className="flex flex-wrap items-center gap-1.5">
            {importedMidiName && (
              <span className="text-[11px] font-mono text-blue-400 max-w-[140px] truncate mr-1">
                🎵 {importedMidiName}
              </span>
            )}

            <div className="flex items-center rounded-lg border border-white/10 overflow-hidden text-[11px] font-mono">
              <button
                onClick={() => setStepWidth((w) => Math.max(10, w - 4))}
                title="Zoom Out Horizontally"
                className="px-2 py-1 hover:bg-white/10"
              >
                −
              </button>
              <span className="px-1.5 opacity-60 text-[10px]">ZOOM</span>
              <button
                onClick={() => setStepWidth((w) => Math.min(44, w + 4))}
                title="Zoom In Horizontally"
                className="px-2 py-1 hover:bg-white/10"
              >
                +
              </button>
            </div>

            <button
              onClick={() => {
                setPanelHeight((h) => (h < 420 ? 480 : 240));
                setRowHeight((r) => (r < 22 ? 22 : 16));
              }}
              title="Toggle Enlarged / Compact Piano Roll"
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                darkMode
                  ? "bg-white/[0.03] border-white/10 text-zinc-300 hover:border-blue-500"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              {panelHeight < 420 ? "⤢ Enlarge" : "⤡ Shrink"}
            </button>

            <button
              onClick={onClickImportButton}
              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                darkMode
                  ? "bg-white/[0.04] border-white/10 text-blue-400 hover:border-blue-500"
                  : "bg-white border-slate-300 text-blue-600 hover:border-blue-500"
              }`}
            >
              ↑ Import .MID
            </button>

            <button
              onClick={() => {
                onClearNotes();
                setSelectedNoteId(null);
              }}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                darkMode
                  ? "bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-rose-400"
                  : "bg-white border-slate-200 text-slate-600 hover:text-rose-600"
              }`}
            >
              Clear
            </button>

            <button
              onClick={onClose}
              className="px-2 py-1 rounded-lg text-xs opacity-60 hover:opacity-100"
              title="Close Piano Roll & Stop Audio"
            >
              ✕
            </button>
          </div>
        </div>

        {/* LOGIC PRO X STYLE CANVAS */}
        <div
          ref={scrollContainerRef}
          style={{ height: `${panelHeight}px` }}
          className={`rounded-xl border overflow-auto relative ${
            darkMode ? "border-white/[0.1] bg-[#16181d]" : "border-slate-300 bg-white"
          }`}
        >
          <div style={{ width: `${56 + gridWidth}px` }} className="relative">
            {/* STICKY TOP BAR RULER (BARS 1–8) */}
            <div
              className={`sticky top-0 z-30 flex h-6 border-b ${
                darkMode
                  ? "bg-[#1c1e26] border-white/10 text-zinc-400"
                  : "bg-slate-100 border-slate-300 text-slate-600"
              }`}
            >
              <div
                className={`sticky left-0 z-40 w-14 shrink-0 border-r flex items-center justify-center text-[9px] font-mono uppercase opacity-60 ${
                  darkMode ? "bg-[#1c1e26] border-white/10" : "bg-slate-100 border-slate-300"
                }`}
              >
                C2–C5
              </div>

              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickedStep = Math.min(
                    TOTAL_STEPS - 1,
                    Math.max(0, Math.floor((e.clientX - rect.left) / stepWidth))
                  );
                  onSeekStep(clickedStep);
                }}
                style={{ width: `${gridWidth}px` }}
                className="relative flex cursor-pointer"
                title="Click ruler to jump playhead"
              >
                {Array.from({ length: TOTAL_BARS }).map((_, barIdx) => (
                  <div
                    key={barIdx}
                    style={{ width: `${STEPS_PER_BAR * stepWidth}px` }}
                    className={`relative border-r flex items-center pl-1.5 text-[10px] font-mono font-bold ${
                      darkMode ? "border-white/15" : "border-slate-300"
                    }`}
                  >
                    <span>{barIdx + 1}</span>
                    {[1, 2, 3].map((beat) => (
                      <span
                        key={beat}
                        style={{ left: `${beat * 4 * stepWidth}px` }}
                        className="absolute bottom-0 h-2 border-l border-white/15 text-[8px] pl-1 opacity-40"
                      >
                        {stepWidth >= 18 ? `${barIdx + 1}.${beat + 1}` : ""}
                      </span>
                    ))}
                  </div>
                ))}

                {currentStep !== null && (
                  <div
                    style={{ left: `${currentStep * stepWidth}px` }}
                    className="absolute top-0 bottom-0 w-[2px] bg-blue-400 pointer-events-none"
                  >
                    <div className="w-2.5 h-2.5 -ml-[4px] bg-blue-400 rounded-b-sm" />
                  </div>
                )}
              </div>
            </div>

            {/* BODY: STICKY LEFT PIANO KEYS + INTERACTIVE NOTE GRID */}
            <div className="flex relative">
              <div className="sticky left-0 z-20 w-14 shrink-0 border-r border-white/10">
                {ROLL_ROWS.map((row) => {
                  const isActive = activeNotes.includes(row.note);
                  return (
                    <button
                      key={row.note}
                      onMouseDown={() => onTriggerNote(row.note, 0.35)}
                      style={{ height: `${rowHeight}px` }}
                      className={`w-full px-1.5 text-[9px] font-mono flex items-center justify-between border-b transition-colors ${
                        isActive
                          ? "bg-blue-500 text-white font-bold border-blue-400"
                          : row.isBlack
                          ? darkMode
                            ? "bg-[#0e0f13] text-zinc-500 border-white/[0.04] hover:bg-zinc-800"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                          : darkMode
                          ? "bg-[#e4e4e7] text-zinc-800 border-zinc-300 hover:bg-blue-100"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-blue-50"
                      }`}
                    >
                      <span className={row.isC ? "font-extrabold text-blue-600" : ""}>
                        {row.isC || !row.isBlack ? row.note : ""}
                      </span>
                      {row.isBlack && (
                        <span className="w-2 h-1.5 rounded-xs bg-black/50" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div
                onMouseDown={handleGridMouseDown}
                style={{ width: `${gridWidth}px`, height: `${gridHeight}px` }}
                className="relative cursor-crosshair"
              >
                {ROLL_ROWS.map((row, rIdx) => (
                  <div
                    key={row.note}
                    style={{ top: `${rIdx * rowHeight}px`, height: `${rowHeight}px` }}
                    className={`absolute inset-x-0 border-b pointer-events-none ${
                      row.isC
                        ? darkMode
                          ? "border-white/15 bg-white/[0.03]"
                          : "border-slate-300 bg-blue-50/30"
                        : row.isBlack
                        ? darkMode
                          ? "border-white/[0.04] bg-[#101216]"
                          : "border-slate-200/70 bg-slate-100/80"
                        : darkMode
                        ? "border-white/[0.04] bg-[#191b22]"
                        : "border-slate-200/70 bg-white"
                    }`}
                  />
                ))}

                {Array.from({ length: TOTAL_STEPS }).map((_, sIdx) => {
                  const isBar = sIdx % 16 === 0;
                  const isBeat = sIdx % 4 === 0;
                  return (
                    <div
                      key={sIdx}
                      style={{ left: `${sIdx * stepWidth}px` }}
                      className={`absolute top-0 bottom-0 border-l pointer-events-none ${
                        isBar
                          ? darkMode
                            ? "border-white/20"
                            : "border-slate-400"
                          : isBeat
                          ? darkMode
                            ? "border-white/10"
                            : "border-slate-300"
                          : darkMode
                          ? "border-white/[0.035]"
                          : "border-slate-200/60"
                      }`}
                    />
                  );
                })}

                {rollNotes.map((n) => {
                  const rowIdx = rowIndexMap.get(n.note);
                  if (rowIdx === undefined) return null;
                  const isSelected = selectedNoteId === n.id;

                  return (
                    <div
                      key={n.id}
                      onMouseDown={(e) => handleNoteDragStart(e, n, "move")}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setRollNotes((prev) => prev.filter((item) => item.id !== n.id));
                        if (selectedNoteId === n.id) setSelectedNoteId(null);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRollNotes((prev) => prev.filter((item) => item.id !== n.id));
                        if (selectedNoteId === n.id) setSelectedNoteId(null);
                      }}
                      style={{
                        left: `${n.step * stepWidth + 1}px`,
                        top: `${rowIdx * rowHeight + 1}px`,
                        width: `${Math.max(stepWidth - 2, n.durationSteps * stepWidth - 2)}px`,
                        height: `${rowHeight - 2}px`,
                      }}
                      title={`${n.note} • Drag to move, drag right edge to resize, double-click or right-click to delete`}
                      className={`absolute z-10 rounded-[4px] flex items-center justify-between pl-1.5 pr-1 cursor-grab active:cursor-grabbing shadow-sm transition-shadow ${
                        isSelected
                          ? "bg-gradient-to-r from-cyan-400 to-blue-500 ring-1 ring-white text-slate-950 font-bold"
                          : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold"
                      }`}
                    >
                      <span className="text-[9px] font-mono truncate pointer-events-none leading-none">
                        {n.durationSteps * stepWidth >= 26 ? n.note : ""}
                      </span>

                      <div
                        onMouseDown={(e) => handleNoteDragStart(e, n, "resize")}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 rounded-r-[4px]"
                      />
                    </div>
                  );
                })}

                {currentStep !== null && (
                  <div
                    style={{ left: `${currentStep * stepWidth}px` }}
                    className="absolute top-0 bottom-0 w-[2px] bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)] z-20 pointer-events-none"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono opacity-45">
          <span>
            Click grid to draw • Drag note to move • Drag right edge to resize • Double-click / Right-click / Delete to remove
          </span>
          <span className="hidden sm:inline">Drag &amp; drop any .MID file here (auto-detects BPM)</span>
        </div>
      </div>
    </div>
  );
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
        className={`relative w-8 h-8 rounded-full flex items-center justify-center cursor-ns-resize transition-shadow ${
          darkMode
            ? "bg-zinc-900 border border-white/10 shadow-inner hover:border-blue-500"
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
            stroke="#3b82f6"
            strokeWidth="3.5"
            strokeDasharray={`${(value / 100) * 94} 126`}
            strokeLinecap="round"
          />
        </svg>

        <div
          style={{ transform: `rotate(${angle}deg)` }}
          className={`w-5 h-5 rounded-full flex items-start justify-center pt-0.5 transition-transform duration-75 ${
            darkMode ? "bg-zinc-800 border border-white/10" : "bg-slate-50 border border-slate-200"
          }`}
        >
          <div className="w-0.5 h-1.5 rounded-full bg-blue-500" />
        </div>
      </div>
      <span className={`mt-1 text-[10px] font-medium leading-none ${darkMode ? "text-zinc-400" : "text-slate-700"}`}>
        {label}
      </span>
      <span className="text-[9px] font-mono text-blue-400 font-semibold leading-tight">{value}%</span>
    </div>
  );
}

export default function ProdPresetsMarketplace() {
  const supabase = useRef(createClient()).current;

  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("Home");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);

  const [packs, setPacks] = useState<Pack[]>(FALLBACK_PACKS);
  const [assets, setAssets] = useState<AudioAsset[]>(FALLBACK_ASSETS);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<SynthEngine>("All");
  const [selectedKey, setSelectedKey] = useState<string>("All");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Supabase Auth & Password Recovery State
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
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
  const [homeDeckVisible, setHomeDeckVisible] = useState(false);

  // Interactive 8-Bar MIDI Piano Roll Sequencer State
  const [pianoRollOpen, setPianoRollOpen] = useState(false);
  const [rollNotes, setRollNotes] = useState<MidiRollNote[]>(STARTER_PATTERNS["EDM Chords"]);
  const [rollBpm, setRollBpm] = useState<number>(128);
  const [isRollPlaying, setIsRollPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const playheadStepRef = useRef<number>(0);
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
  const fallbackTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeFallbackOscsRef = useRef<Set<OscillatorNode>>(new Set());
  const autoPlayAfterLoadRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const showSynthDeck = activeTab !== "Home" || homeDeckVisible || pianoRollOpen;

  const stopPreviewAudio = useCallback(() => {
    autoPlayAfterLoadRef.current = false;

    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    fallbackTimeoutsRef.current.forEach((t) => clearTimeout(t));
    fallbackTimeoutsRef.current = [];

    activeFallbackOscsRef.current.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // Already stopped
      }
    });
    activeFallbackOscsRef.current.clear();

    samplerRef.current?.releaseAll();
    setIsPlayingPreview(false);
  }, []);

  const stopAllAudio = useCallback(() => {
    stopPreviewAudio();
    setIsRollPlaying(false);
    setActiveNotes([]);
    setCurrentStep(null);
  }, [stopPreviewAudio]);

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
            "35,60,85,95,70,50,90,100,80,65,45,75,90,60,40,70,85,55,35,25,65,80,55,40",
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

  useEffect(() => {
    if (activeAsset.bpm && activeAsset.bpm >= 40 && activeAsset.bpm <= 240) {
      setRollBpm(activeAsset.bpm);
    }
  }, [activeAsset.id, activeAsset.bpm]);

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset");
        setAuthError(null);
        setAuthNotice(null);
        setAuthModalOpen(true);
      }

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

    if (authMode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: `${window.location.origin}/`,
      });
      setAuthLoading(false);
      if (error) {
        setAuthError(error.message);
        return;
      }
      setAuthNotice("Password reset link sent! Check your email inbox.");
      return;
    }

    if (authMode === "reset") {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      setAuthLoading(false);
      if (error) {
        setAuthError(error.message);
        return;
      }
      setNewPassword("");
      setAuthModalOpen(false);
      setAuthMode("signin");
      alert("Password updated! You are now signed in.");
      return;
    }

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

        activeFallbackOscsRef.current.add(osc1);
        activeFallbackOscsRef.current.add(osc2);
        osc1.onended = () => activeFallbackOscsRef.current.delete(osc1);
        osc2.onended = () => activeFallbackOscsRef.current.delete(osc2);

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

  const triggerTimedNote = useCallback(
    async (noteName: string, durationSec: number) => {
      if (activeAsset.previewPath) {
        await Tone.start();
        if (samplerRef.current && isSampleReady) {
          samplerRef.current.triggerAttackRelease(noteName, durationSec);
        }
      } else {
        triggerFallbackOsc(getMidiNoteFreq(noteName), durationSec);
      }
    },
    [activeAsset.previewPath, isSampleReady, triggerFallbackOsc]
  );

  useEffect(() => {
    if (!isRollPlaying) {
      setCurrentStep(null);
      return;
    }

    const stepMs = (60 / rollBpm / 4) * 1000;

    const tick = () => {
      const activeStep = playheadStepRef.current % TOTAL_STEPS;
      setCurrentStep(activeStep);

      const notesAtStep = rollNotes.filter((n) => n.step === activeStep);
      const activeNames: string[] = [];

      for (const item of notesAtStep) {
        const durSec = Math.max(0.12, (item.durationSteps * stepMs) / 1000);
        triggerTimedNote(item.note, durSec);
        activeNames.push(item.note);
      }

      setActiveNotes(activeNames);
      playheadStepRef.current = (activeStep + 1) % TOTAL_STEPS;
    };

    tick();
    const interval = setInterval(tick, stepMs);

    return () => {
      clearInterval(interval);
      setActiveNotes([]);
      setCurrentStep(null);
      samplerRef.current?.releaseAll();
      activeFallbackOscsRef.current.forEach((osc) => {
        try {
          osc.stop();
        } catch {
          // Already stopped
        }
      });
      activeFallbackOscsRef.current.clear();
    };
  }, [isRollPlaying, rollBpm, rollNotes, triggerTimedNote]);

  const handleImportMidiBuffer = async (buffer: ArrayBuffer, filename: string) => {
    const { notes, detectedBpm } = parseMidiFile(buffer);
    if (notes.length === 0) {
      alert("No playable notes found in that MIDI file.");
      return;
    }
    stopPreviewAudio();
    setRollNotes(notes);
    if (detectedBpm) {
      setRollBpm(detectedBpm);
    }
    setImportedMidiName(filename);
    setPianoRollOpen(true);
    playheadStepRef.current = 0;
    await Tone.start();
    setIsRollPlaying(true);
  };

  const handleImportMidiFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await handleImportMidiBuffer(buffer, file.name);
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
    if (!showSynthDeck) return;

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
  }, [showSynthDeck, handlePressNote, handleReleaseNote]);

  const handleTogglePlay = async (asset: AudioAsset) => {
    const wasPlayingSameAsset = activeAsset.id === asset.id && isPlayingPreview;

    // Always stop both the piano roll and any currently playing preview to prevent overlap
    stopAllAudio();
    setHomeDeckVisible(true);

    if (wasPlayingSameAsset) {
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
    const t1 = setTimeout(() => triggerFallbackOsc(asset.baseFreq * 1.25, 0.7), 220);
    const t2 = setTimeout(() => triggerFallbackOsc(asset.baseFreq * 1.5, 0.9), 440);
    fallbackTimeoutsRef.current = [t1, t2];
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
      setAuthMode("signin");
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
      setAuthMode("signin");
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

  const navItems: { label: TabType; icon: string }[] = [
    { label: "Home", icon: "⌂" },
    { label: "Presets", icon: "🎛" },
    { label: "Samples", icon: "〰" },
    { label: "Packs", icon: "▤" },
    { label: "My Library", icon: "↓" },
  ];

  const renderAssetRow = (item: AudioAsset) => {
    const isCurrent = activeAsset.id === item.id;
    const isRowPlaying = isCurrent && isPlayingPreview;
    const isOwned = ownedIds.includes(item.id);
    const bars = item.waveformBars.split(",").map(Number);

    return (
      <div
        key={item.id}
        onClick={() => {
          setActiveAsset(item);
          if (activeTab === "Home") setHomeDeckVisible(true);
        }}
        className={`group flex items-center justify-between gap-3 sm:gap-4 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
          isCurrent && showSynthDeck
            ? darkMode
              ? "bg-white/[0.06] ring-1 ring-blue-500/40"
              : "bg-blue-50/80 ring-1 ring-blue-500/30"
            : darkMode
            ? "hover:bg-white/[0.035]"
            : "hover:bg-white hover:shadow-2xs"
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePlay(item);
            }}
            className={`relative w-10 h-10 rounded-lg bg-gradient-to-br ${item.coverGradient} flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden`}
          >
            <span
              className={`text-[10px] font-extrabold transition-opacity ${
                isRowPlaying ? "opacity-0" : "group-hover:opacity-0"
              }`}
            >
              VP
            </span>
            <span
              className={`absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center text-xs transition-opacity ${
                isRowPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {isRowPlaying ? "■" : "▶"}
            </span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-semibold text-[13px] truncate transition-colors ${
                  isCurrent && showSynthDeck ? "text-blue-400" : "group-hover:text-blue-400"
                }`}
              >
                {item.filename}
              </span>
              {item.previewPath && (
                <span
                  title="Real Serum audio preview loaded"
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
                />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider opacity-45 mt-0.5 truncate">
              <span>{item.packTitle}</span>
              <span>•</span>
              <span>{item.engine}</span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center justify-between gap-[2px] h-7 flex-1 max-w-[185px] min-w-[72px] px-1">
          {bars.map((height, idx) => (
            <div
              key={idx}
              style={{ height: `${Math.max(16, height)}%` }}
              className={`flex-1 max-w-[2.5px] rounded-full transition-colors ${
                isRowPlaying
                  ? "bg-blue-400 animate-pulse"
                  : isCurrent && showSynthDeck
                  ? "bg-blue-500/85"
                  : darkMode
                  ? "bg-zinc-700/90 group-hover:bg-zinc-500"
                  : "bg-slate-300 group-hover:bg-blue-400"
              }`}
            />
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono uppercase tracking-wider opacity-55 shrink-0">
          <span className="w-10 text-right">{item.duration}</span>
          <span className="w-16 text-right">{item.bpm ? `${item.bpm} BPM` : "--"}</span>
          <span className="w-16 text-right">{item.musicalKey}</span>
        </div>

        <div className="hidden xl:flex items-center gap-1.5 w-32 justify-end shrink-0">
          {item.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider truncate ${
                darkMode ? "bg-white/[0.04] text-zinc-400" : "bg-slate-100 text-slate-600"
              }`}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0 w-32 sm:w-36">
          {activeTab === "My Library" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                alert(`Royalty-Free Commercial License Certificate generated for ${item.filename}`);
              }}
              title="Download Commercial License"
              className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono uppercase shrink-0 ${
                darkMode
                  ? "border-white/10 text-zinc-400 hover:text-white"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              LIC
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUnlockAsset(item);
            }}
            className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-bold tracking-wide uppercase inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
              isOwned
                ? darkMode
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
            }`}
          >
            {isOwned
              ? "↓ DOWNLOAD"
              : `↓ ${item.credits} ${item.credits === 1 ? "CREDIT" : "CREDITS"}`}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen flex transition-colors duration-200 ${
        !showSynthDeck ? "pb-12" : pianoRollOpen ? "pb-[430px]" : "pb-44"
      } ${darkMode ? "bg-[#09090b] text-zinc-100" : "bg-slate-50/70 text-slate-900"}`}
    >
      <input
        ref={midiFileInputRef}
        type="file"
        accept=".mid,.midi,audio/midi,audio/x-midi"
        onChange={handleImportMidiFile}
        className="hidden"
      />

      {/* SLEEK LEFT STUDIO SIDEBAR */}
      <aside
        className={`hidden md:flex flex-col justify-between w-56 shrink-0 sticky top-0 h-screen border-r px-3.5 py-5 select-none ${
          darkMode ? "bg-[#09090b] border-white/[0.06]" : "bg-white border-slate-200"
        }`}
      >
        <div className="space-y-6">
          <div
            onClick={() => {
              setSelectedPack(null);
              setHomeDeckVisible(false);
              setActiveTab("Home");
            }}
            className="flex items-center gap-2.5 px-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/25 font-extrabold text-xs tracking-tighter">
              VP
            </div>
            <div className="leading-none">
              <span className="font-bold text-base tracking-tight block">
                Virtual<span className="text-blue-500">Presets</span>
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest opacity-45">
                Sound Studio
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = activeTab === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setSelectedPack(null);
                    if (item.label === "Home") setHomeDeckVisible(false);
                    setActiveTab(item.label);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                    active
                      ? darkMode
                        ? "bg-white/[0.08] text-white font-semibold shadow-xs"
                        : "bg-blue-50 text-blue-700 font-semibold"
                      : darkMode
                      ? "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-xs opacity-75">{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {item.label === "My Library" && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                        active
                          ? "bg-blue-600 text-white"
                          : darkMode
                          ? "bg-white/[0.06] text-zinc-400"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {ownedIds.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
            <div className="px-3 text-[10px] font-semibold uppercase tracking-widest opacity-40">
              Synth Engines
            </div>
            {(["All", "Serum", "Analog Lab", "Vital", "Omnisphere"] as SynthEngine[]).map((eng) => {
              const isSelected = selectedEngine === eng && activeTab === "Presets";
              return (
                <button
                  key={eng}
                  onClick={() => {
                    setSelectedPack(null);
                    setActiveTab("Presets");
                    setSelectedEngine(eng);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    isSelected
                      ? "text-blue-400 font-semibold bg-blue-500/10"
                      : darkMode
                      ? "text-zinc-500 hover:text-zinc-300"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span>{eng === "All" ? "All Engines" : eng}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-white/[0.06]">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              darkMode
                ? "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-white"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Appearance</span>
            <span className="font-mono text-[11px]">{darkMode ? "☀ Light" : "☾ Dark"}</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className={`sticky top-0 z-20 backdrop-blur-xl border-b ${
            darkMode ? "bg-[#09090b]/85 border-white/[0.06]" : "bg-white/90 border-slate-200"
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-7 h-16 flex items-center justify-between gap-4">
            <div className="flex md:hidden items-center gap-2">
              <div
                onClick={() => {
                  setHomeDeckVisible(false);
                  setActiveTab("Home");
                }}
                className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs cursor-pointer"
              >
                VP
              </div>
              <select
                value={activeTab}
                onChange={(e) => {
                  const next = e.target.value as TabType;
                  setSelectedPack(null);
                  if (next === "Home") setHomeDeckVisible(false);
                  setActiveTab(next);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  darkMode ? "bg-zinc-900 border-white/10" : "bg-white border-slate-200"
                }`}
              >
                {navItems.map((n) => (
                  <option key={n.label} value={n.label}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs opacity-45">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab === "Home" && e.target.value.trim()) {
                    setActiveTab("Presets");
                  }
                }}
                placeholder="Search VirtualPresets..."
                className={`w-full pl-9 pr-4 py-2 rounded-full text-xs outline-none transition-all border ${
                  darkMode
                    ? "bg-white/[0.04] border-white/[0.06] text-zinc-100 placeholder:text-zinc-500 focus:bg-white/[0.07] focus:border-blue-500/60"
                    : "bg-slate-100 border-transparent text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500"
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] opacity-50 hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  if (user) {
                    setPaymentModalOpen(true);
                  } else {
                    setAuthMode("signin");
                    setAuthModalOpen(true);
                  }
                }}
                title="Top up credits"
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all ${
                  darkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-zinc-200 hover:border-blue-500/60"
                    : "bg-white border-slate-200 text-slate-800 hover:border-blue-500 shadow-2xs"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="font-mono tracking-tight">{credits} CREDITS</span>
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  +
                </span>
              </button>

              {user ? (
                <button
                  onClick={() => setAccountOpen(true)}
                  className={`flex items-center gap-2 p-1 pr-3 rounded-full border text-xs font-medium transition-colors ${
                    darkMode
                      ? "bg-white/[0.04] border-white/[0.08] hover:border-blue-500/60"
                      : "bg-white border-slate-200 hover:border-blue-500 shadow-2xs"
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center font-bold text-[11px] uppercase">
                    {user.email?.[0] ?? "P"}
                  </div>
                  <span className="hidden sm:inline max-w-[110px] truncate opacity-85">
                    {user.email}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthModalOpen(true);
                  }}
                  className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-sm shadow-blue-600/25"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>

        {/* MAIN CATALOG CANVAS */}
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-7 py-6 space-y-8">
          {checkoutBanner && (
            <div
              className={`rounded-xl border px-4 py-3 flex items-center justify-between text-xs font-medium ${
                checkoutBanner === "success"
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-zinc-900 border-white/10 text-zinc-300"
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

          {/* DEDICATED HOME PAGE */}
          {activeTab === "Home" && (
            <div className="space-y-9">
              <section
                className={`relative rounded-3xl border overflow-hidden p-7 sm:p-11 ${
                  darkMode
                    ? "bg-gradient-to-br from-[#111522] via-[#0d1018] to-[#09090b] border-white/[0.08]"
                    : "bg-gradient-to-br from-blue-50 via-white to-slate-50 border-slate-200 shadow-sm"
                }`}
              >
                <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-600/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl" />

                <div className="relative z-10 max-w-2xl space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[11px] font-mono uppercase tracking-wider font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Audition Live in Browser • Zero Subscriptions
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.08]">
                    The Best Presets In The Industry For The Synths You{" "}
                    <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                      Already Own
                    </span>
                  </h1>

                  <p
                    className={`text-sm sm:text-base leading-relaxed max-w-xl ${
                      darkMode ? "text-zinc-400" : "text-slate-600"
                    }`}
                  >
                    Play every Serum 2, Analog Lab, Vital, and Omnisphere preset directly on our
                    interactive MIDI keyboard and piano roll before spending a single credit.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      onClick={() => setActiveTab("Presets")}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/25 transition-all"
                    >
                      Browse All Presets →
                    </button>

                    <button
                      onClick={() => {
                        setHomeDeckVisible(true);
                        setPianoRollOpen(true);
                      }}
                      className={`px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors ${
                        darkMode
                          ? "bg-white/[0.04] border-white/10 text-zinc-200 hover:border-blue-500/60"
                          : "bg-white border-slate-200 text-slate-800 hover:border-blue-500"
                      }`}
                    >
                      🎹 Open MIDI Piano Roll
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-mono uppercase tracking-widest opacity-45">
                    Browse By Synth Engine
                  </h2>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {[
                    {
                      name: "Serum" as SynthEngine,
                      ext: ".SerumPreset / .fxp",
                      desc: "Chart-ready EDM leads, basses & plucks",
                      accent: "from-cyan-500 to-blue-600",
                    },
                    {
                      name: "Analog Lab" as SynthEngine,
                      ext: ".labx",
                      desc: "Warm vintage keys, pads & analog textures",
                      accent: "from-indigo-500 to-purple-600",
                    },
                    {
                      name: "Vital" as SynthEngine,
                      ext: ".vital",
                      desc: "Spectral wavetable leads & futuristic arps",
                      accent: "from-sky-500 to-indigo-600",
                    },
                    {
                      name: "Omnisphere" as SynthEngine,
                      ext: ".prt_omn",
                      desc: "Cinematic atmospheres & layered soundscapes",
                      accent: "from-blue-600 to-slate-800",
                    },
                  ].map((synth) => (
                    <div
                      key={synth.name}
                      onClick={() => {
                        setSelectedEngine(synth.name);
                        setActiveTab("Presets");
                      }}
                      className={`group rounded-2xl border p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${
                        darkMode
                          ? "bg-white/[0.025] border-white/[0.07] hover:border-blue-500/60"
                          : "bg-white border-slate-200 hover:border-blue-500 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`w-8 h-8 rounded-lg bg-gradient-to-br ${synth.accent} flex items-center justify-center text-white text-xs font-extrabold`}
                        >
                          {synth.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-mono opacity-45">{synth.ext}</span>
                      </div>
                      <h3 className="font-bold text-sm group-hover:text-blue-400 transition-colors">
                        {synth.name}
                      </h3>
                      <p
                        className={`text-xs mt-1 leading-relaxed ${
                          darkMode ? "text-zinc-400" : "text-slate-500"
                        }`}
                      >
                        {synth.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-mono uppercase tracking-widest opacity-45">
                    Featured Sound Packs
                  </h2>
                  <button
                    onClick={() => setActiveTab("Packs")}
                    className="text-[11px] font-medium text-blue-400 hover:underline"
                  >
                    View all packs →
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {packs.slice(0, 3).map((pack) => (
                    <div
                      key={pack.id}
                      onClick={() => {
                        setSelectedPack(pack);
                        setActiveTab("Presets");
                      }}
                      className={`group rounded-2xl overflow-hidden cursor-pointer border transition-all hover:-translate-y-0.5 ${
                        darkMode
                          ? "border-white/[0.07] bg-white/[0.02] hover:border-blue-500/60"
                          : "border-slate-200 bg-white hover:border-blue-500 shadow-2xs"
                      }`}
                    >
                      <div
                        className={`aspect-[16/9] w-full bg-gradient-to-br ${pack.coverGradient} p-4 flex flex-col justify-between`}
                      >
                        <span className="self-start px-2.5 py-0.5 rounded-md bg-black/45 backdrop-blur-md text-[10px] font-mono uppercase tracking-wider text-white">
                          {pack.genre}
                        </span>
                        <div>
                          <h3 className="font-bold text-base text-white group-hover:translate-x-0.5 transition-transform">
                            {pack.title}
                          </h3>
                          <p className="text-[11px] font-mono uppercase tracking-wider text-white/75">
                            By {pack.creator}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-mono uppercase tracking-widest opacity-45">
                    Trending Presets — Click Any Row to Audition
                  </h2>
                  <button
                    onClick={() => setActiveTab("Presets")}
                    className="text-[11px] font-medium text-blue-400 hover:underline"
                  >
                    Explore full catalog ({assets.length}) →
                  </button>
                </div>
                <div className="space-y-1">
                  {assets.slice(0, 6).map((item) => renderAssetRow(item))}
                </div>
              </section>
            </div>
          )}

          {/* CATALOG FILTER BAR */}
          {activeTab !== "Home" && activeTab !== "Packs" && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedEngine}
                    onChange={(e) => setSelectedEngine(e.target.value as SynthEngine)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium outline-none cursor-pointer transition-colors ${
                      darkMode
                        ? "bg-white/[0.04] border-white/[0.07] text-zinc-200 hover:border-white/20"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <option value="All">Synth: All</option>
                    <option value="Serum">Serum</option>
                    <option value="Analog Lab">Analog Lab</option>
                    <option value="Vital">Vital</option>
                    <option value="Omnisphere">Omnisphere</option>
                    <option value="WAV">WAV Audio</option>
                  </select>

                  <select
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium outline-none cursor-pointer transition-colors ${
                      darkMode
                        ? "bg-white/[0.04] border-white/[0.07] text-zinc-200 hover:border-white/20"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <option value="All">Key: Any</option>
                    <option value="C min">C Minor</option>
                    <option value="C# min">C# Minor</option>
                    <option value="D# min">D# Minor</option>
                    <option value="E min">E Minor</option>
                    <option value="F min">F Minor</option>
                    <option value="A min">A Minor</option>
                  </select>

                  {(selectedEngine !== "All" ||
                    selectedKey !== "All" ||
                    selectedTag ||
                    selectedPack) && (
                    <button
                      onClick={() => {
                        setSelectedEngine("All");
                        setSelectedKey("All");
                        setSelectedTag(null);
                        setSelectedPack(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>

                <div className="text-[11px] font-mono uppercase tracking-wider opacity-45">
                  {filteredAssets.length} Sounds
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {QUICK_TAGS.map((tag) => {
                  const active = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(active ? null : tag)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider whitespace-nowrap border transition-all ${
                        active
                          ? "bg-blue-600 border-blue-500 text-white font-semibold"
                          : darkMode
                          ? "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/15"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {active ? `✓ ${tag}` : `+ ${tag}`}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab !== "Home" && activeTab !== "Packs" && activeTab !== "My Library" && !selectedPack && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-mono uppercase tracking-widest opacity-45">
                  Featured Sound Packs
                </h2>
                <button
                  onClick={() => setActiveTab("Packs")}
                  className="text-[11px] font-medium text-blue-400 hover:underline"
                >
                  View all packs →
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {packs.slice(0, 4).map((pack) => (
                  <div
                    key={pack.id}
                    onClick={() => setSelectedPack(pack)}
                    className={`group relative rounded-2xl overflow-hidden cursor-pointer border transition-all hover:-translate-y-0.5 ${
                      darkMode
                        ? "border-white/[0.07] bg-zinc-900/60 hover:border-blue-500/60"
                        : "border-slate-200 bg-white hover:border-blue-500 shadow-2xs"
                    }`}
                  >
                    <div
                      className={`aspect-[16/10] w-full bg-gradient-to-br ${pack.coverGradient} p-3.5 flex flex-col justify-between relative overflow-hidden`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-md text-[9px] font-mono uppercase tracking-wider text-white/90">
                          {pack.genre}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white leading-snug drop-shadow-xs group-hover:translate-x-0.5 transition-transform">
                          {pack.title}
                        </h3>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-white/75 mt-0.5">
                          {pack.creator}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab !== "Home" && selectedPack && (
            <section
              className={`rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 ${
                darkMode ? "bg-white/[0.03] border-white/[0.08]" : "bg-blue-50/60 border-blue-100"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-xl bg-gradient-to-br ${selectedPack.coverGradient} flex items-center justify-center text-white shadow-lg shrink-0 font-extrabold text-sm`}
                >
                  VP
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-400">
                    {selectedPack.genre}
                  </span>
                  <h1 className="text-lg font-bold tracking-tight">{selectedPack.title}</h1>
                  <p className={`text-xs max-w-xl ${darkMode ? "text-zinc-400" : "text-slate-600"}`}>
                    {selectedPack.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPack(null)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium shrink-0 ${
                  darkMode
                    ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                ✕ Clear Pack
              </button>
            </section>
          )}

          {activeTab === "Packs" && !selectedPack && (
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  onClick={() => setSelectedPack(pack)}
                  className={`group rounded-2xl border p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${
                    darkMode
                      ? "bg-white/[0.02] border-white/[0.07] hover:border-blue-500/60"
                      : "bg-white border-slate-200 hover:border-blue-500 shadow-sm"
                  }`}
                >
                  <div
                    className={`aspect-square w-full rounded-xl bg-gradient-to-br ${pack.coverGradient} mb-3.5 flex items-center justify-center text-white relative overflow-hidden`}
                  >
                    <span className="text-3xl font-extrabold tracking-tight opacity-85 group-hover:scale-105 transition-transform">
                      VP
                    </span>
                    <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/50 backdrop-blur-md text-[10px] font-mono uppercase tracking-wider font-semibold">
                      {pack.genre}
                    </span>
                  </div>
                  <h3 className="font-bold text-base group-hover:text-blue-400 transition-colors">
                    {pack.title}
                  </h3>
                  <p className={`text-xs mt-1 line-clamp-2 ${darkMode ? "text-zinc-400" : "text-slate-500"}`}>
                    {pack.description}
                  </p>
                </div>
              ))}
            </section>
          )}

          {activeTab !== "Home" && !(activeTab === "Packs" && !selectedPack) && (
            <section className="space-y-1">
              {filteredAssets.map((item) => renderAssetRow(item))}

              {filteredAssets.length === 0 && (
                <div className="py-16 text-center text-sm opacity-50">
                  {activeTab === "My Library" && !user
                    ? "Sign in to view your saved presets and samples."
                    : "No presets or samples match your current filters."}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* BOTTOM DOCKED SYNTH DECK */}
      {showSynthDeck && (
        <footer
          className={`fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur-2xl transition-colors ${
            darkMode
              ? "bg-[#0d0e12]/95 border-white/[0.08] shadow-[0_-12px_40px_rgba(0,0,0,0.65)]"
              : "bg-white/95 border-slate-200 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]"
          }`}
        >
          {pianoRollOpen && (
            <LogicPianoRoll
              darkMode={darkMode}
              rollNotes={rollNotes}
              setRollNotes={setRollNotes}
              rollBpm={rollBpm}
              setRollBpm={setRollBpm}
              isRollPlaying={isRollPlaying}
              onTogglePlay={async () => {
                await Tone.start();
                if (isRollPlaying) {
                  stopAllAudio();
                } else {
                  stopPreviewAudio();
                  playheadStepRef.current = currentStep ?? 0;
                  setIsRollPlaying(true);
                }
              }}
              currentStep={currentStep}
              onSeekStep={(step) => {
                playheadStepRef.current = step;
                setCurrentStep(step);
              }}
              activeNotes={activeNotes}
              onTriggerNote={triggerTimedNote}
              importedMidiName={importedMidiName}
              onImportMidiBuffer={handleImportMidiBuffer}
              onClickImportButton={() => midiFileInputRef.current?.click()}
              starterPatterns={STARTER_PATTERNS}
              onSelectStarterPattern={(name) => {
                setRollNotes(STARTER_PATTERNS[name]);
                setImportedMidiName(null);
                playheadStepRef.current = 0;
              }}
              onClearNotes={() => {
                setRollNotes([]);
                setImportedMidiName(null);
              }}
              onClose={() => {
                stopAllAudio();
                setPianoRollOpen(false);
              }}
            />
          )}

          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
              <div className="flex items-center justify-between w-full lg:w-auto gap-3 min-w-[265px]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg bg-gradient-to-br ${activeAsset.coverGradient} flex items-center justify-center text-white text-[10px] font-extrabold shrink-0`}
                  >
                    VP
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-semibold">
                        {activeAsset.engine}
                      </span>
                      {activeAsset.previewPath && (
                        <span
                          className={`text-[10px] font-mono ${
                            sampleError
                              ? "text-rose-400"
                              : isSampleReady
                              ? "text-emerald-400"
                              : "text-amber-400 animate-pulse"
                          }`}
                        >
                          {sampleError
                            ? `• ${sampleError}`
                            : isSampleReady
                            ? "• Ready"
                            : "• Loading..."}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold truncate max-w-[185px] mt-0.5">
                      {activeAsset.filename}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleTogglePlay(activeAsset)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors"
                  >
                    {isPlayingPreview ? "■ Stop" : "▶ Play"}
                  </button>
                  <button
                    onClick={() => {
                      if (pianoRollOpen) {
                        stopAllAudio();
                        setPianoRollOpen(false);
                      } else {
                        setPianoRollOpen(true);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                      pianoRollOpen
                        ? "bg-blue-600/20 border-blue-500 text-blue-400"
                        : darkMode
                        ? "border-white/10 bg-white/[0.04] text-zinc-200 hover:border-blue-500"
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
                        ? "border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    ↺
                  </button>
                  {activeTab === "Home" && (
                    <button
                      onClick={() => {
                        stopAllAudio();
                        setPianoRollOpen(false);
                        setHomeDeckVisible(false);
                      }}
                      title="Close Synth Deck"
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium ${
                        darkMode
                          ? "border-white/10 text-zinc-400 hover:text-white"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      ✕
                    </button>
                  )}
                  <button
                    onClick={() => setDockMinimized(!dockMinimized)}
                    className={`lg:hidden px-2 py-1.5 rounded-lg border text-[11px] font-medium ${
                      darkMode ? "border-white/10 text-zinc-300" : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {dockMinimized ? "Show" : "Hide"}
                  </button>
                </div>
              </div>

              {!dockMinimized && (
                <>
                  <div
                    className={`flex items-center justify-center gap-3.5 sm:gap-4 px-3.5 py-1.5 rounded-xl border ${
                      darkMode ? "bg-white/[0.025] border-white/[0.07]" : "bg-slate-50 border-slate-200"
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
      )}

      {/* AUTH MODAL */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-2xl ${
              darkMode
                ? "bg-[#111216] border-white/10 text-zinc-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {authMode === "signin" && "Sign In to VirtualPresets"}
                  {authMode === "signup" && "Create Producer Account"}
                  {authMode === "forgot" && "Reset Your Password"}
                  {authMode === "reset" && "Set New Password"}
                </h3>
                <p className="text-xs opacity-60">
                  {authMode === "forgot"
                    ? "We'll email you a secure password reset link"
                    : authMode === "reset"
                    ? "Choose a new password for your studio account"
                    : "Sync your credits & preset library across devices"}
                </p>
              </div>
              <button
                onClick={() => setAuthModalOpen(false)}
                className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode !== "reset" && (
                <div>
                  <label className="text-xs font-semibold opacity-75 block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@studio.com"
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-blue-600 ${
                      darkMode ? "bg-zinc-950 border-white/10" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>
              )}

              {(authMode === "signin" || authMode === "signup") && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold opacity-75">Password</label>
                    {authMode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot");
                          setAuthError(null);
                          setAuthNotice(null);
                        }}
                        className="text-[11px] text-blue-400 hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-blue-600 ${
                      darkMode ? "bg-zinc-950 border-white/10" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>
              )}

              {authMode === "reset" && (
                <div>
                  <label className="text-xs font-semibold opacity-75 block mb-1">
                    New Password (min 6 characters)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-blue-600 ${
                      darkMode ? "bg-zinc-950 border-white/10" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>
              )}

              {authError && <p className="text-xs text-rose-400">{authError}</p>}
              {authNotice && <p className="text-xs text-emerald-400">{authNotice}</p>}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-colors"
              >
                {authLoading
                  ? "Please wait..."
                  : authMode === "signin"
                  ? "Sign In"
                  : authMode === "signup"
                  ? "Create Account"
                  : authMode === "forgot"
                  ? "Send Reset Link"
                  : "Update Password"}
              </button>
            </form>

            {authMode !== "reset" && (
              <div className="text-center text-xs opacity-75 pt-1">
                {authMode === "signin" ? (
                  <>
                    New to VirtualPresets?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signup");
                        setAuthError(null);
                        setAuthNotice(null);
                      }}
                      className="text-blue-400 font-semibold hover:underline"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Remembered your password?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signin");
                        setAuthError(null);
                        setAuthNotice(null);
                      }}
                      className="text-blue-400 font-semibold hover:underline"
                    >
                      Back to sign in
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STRIPE CREDIT CHECKOUT MODAL */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 space-y-5 shadow-2xl ${
              darkMode
                ? "bg-[#111216] border-white/10 text-zinc-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Top Up VirtualPresets Credits</h3>
                <p className="text-xs opacity-60">Instant delivery • Credits never expire</p>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-sm"
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
                        ? "border-blue-500 bg-blue-600/15 ring-1 ring-blue-500"
                        : darkMode
                        ? "border-white/[0.08] bg-zinc-950/60 hover:border-white/20"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase text-blue-400">{tier.tag}</div>
                    <div className="text-base font-extrabold mt-0.5 uppercase">{tier.cr} CREDITS</div>
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
                          ? "border-white/[0.08] bg-zinc-950/60 text-zinc-300 hover:border-white/20"
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
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition-colors uppercase"
            >
              {checkoutLoading
                ? "Redirecting to Stripe..."
                : `Continue to Stripe • Add ${selectedBundleCredits} CREDITS`}
            </button>
          </div>
        </div>
      )}

      {/* USER ACCOUNT DRAWER */}
      {accountOpen && user && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end">
          <div
            className={`w-full max-w-md h-full p-6 flex flex-col justify-between overflow-y-auto ${
              darkMode ? "bg-[#111216] text-zinc-100" : "bg-white text-slate-900"
            }`}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
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
                  className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white space-y-2">
                <div className="text-xs uppercase tracking-wider opacity-80 font-semibold">
                  Available Balance
                </div>
                <div className="text-3xl font-bold uppercase">{credits} CREDITS</div>
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setAccountOpen(false);
                      setPaymentModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white text-blue-700 text-xs font-bold hover:bg-blue-50 transition-colors uppercase"
                  >
                    + Buy More CREDITS
                  </button>
                  <button
                    onClick={() => {
                      setAccountOpen(false);
                      setActiveTab("My Library");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-black/25 text-white text-xs font-semibold hover:bg-black/35"
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
                          darkMode
                            ? "border-white/[0.07] bg-white/[0.02]"
                            : "border-slate-100 bg-slate-50"
                        }`}
                      >
                        <div>
                          <div className="font-medium">{entry.label}</div>
                          <div className="opacity-50 text-[11px]">{entry.date}</div>
                        </div>
                        <span
                          className={`font-mono font-bold uppercase ${
                            entry.delta > 0 ? "text-emerald-400" : "text-blue-400"
                          }`}
                        >
                          {entry.delta > 0 ? `+${entry.delta}` : entry.delta} CREDITS
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="opacity-60">100% Royalty-Free Licensing</span>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-rose-500 text-rose-400 font-semibold"
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
