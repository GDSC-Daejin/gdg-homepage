// 랭킹전 효과음·배경음악(브라우저 전용). 볼·명중·기절은 PokéRogue 샘플을 쓰고, 없으면 Web Audio 합성음으로 대체한다.
import type { BattleMotion } from "@/lib/pokedex/battle-effects";
import { BATTLE_BGM, BATTLE_SOUND_SAMPLES } from "./ranking-battle-assets";
import type { ImpactTier } from "./ranking-battle-fx";

type SampleName = keyof typeof BATTLE_SOUND_SAMPLES;

export type BattleSound =
  | { kind: "toss" }
  | { kind: "charge" }
  | { kind: "attack"; motion: BattleMotion }
  | { kind: "hit"; tier: ImpactTier }
  | { kind: "faint" }
  | { kind: "sendout" }
  | { kind: "victory" };

export const SOUND_STORAGE_KEY = "pokedex-ranking-battle-sound";
export const MUSIC_STORAGE_KEY = "pokedex-ranking-battle-music";

/** 저장된 선택을 읽는다. 저장소 접근이 막히면 기본값(켜짐)을 쓴다. */
export function readSoundPreference(key: string = SOUND_STORAGE_KEY) {
  try {
    return window.localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}

export function writeSoundPreference(enabled: boolean, key: string = SOUND_STORAGE_KEY) {
  try {
    window.localStorage.setItem(key, enabled ? "on" : "off");
  } catch {
    // 저장하지 못해도 이번 화면에서는 선택이 유지된다.
  }
}

/** 샘플로 낼 소리와 시각(1배속 기준 초). null이면 합성음을 쓴다. 볼 연출 타이밍(선공 1.15초, 볼 열림 0.38초)에 맞춘다. */
export function sampleCues(sound: BattleSound): { sample: SampleName; at: number }[] | null {
  switch (sound.kind) {
    case "toss": return [{ sample: "throw", at: 0 }, { sample: "hitWeak", at: 0.48 }, { sample: "throw", at: 1.15 }, { sample: "release", at: 1.53 }];
    case "sendout": return [{ sample: "throw", at: 0 }, { sample: "release", at: 0.38 }];
    case "hit": return [{ sample: sound.tier === "strong" ? "hitStrong" : sound.tier === "weak" ? "hitWeak" : "hit", at: 0 }];
    case "faint": return [{ sample: "faint", at: 0 }];
    case "charge": return [{ sample: "charge", at: 0 }];
    default: return null;
  }
}

type Tone = { type: OscillatorType; from: number; to: number; at: number; length: number; volume: number };
type Noise = { at: number; length: number; volume: number; filter: BiquadFilterType; from: number; to: number };

/** 소리마다 음(오실레이터)과 잡음 조각을 정한다. 시간 단위는 1배속 기준 초. */
export function soundRecipe(sound: BattleSound): { tones: Tone[]; noises: Noise[] } {
  const tone = (type: OscillatorType, from: number, to: number, at: number, length: number, volume: number): Tone => ({ type, from, to, at, length, volume });
  const noise = (at: number, length: number, volume: number, filter: BiquadFilterType, from: number, to: number): Noise => ({ at, length, volume, filter, from, to });
  switch (sound.kind) {
    // 선공 결정: 볼이 날아가는 소리 → 맞부딪치는 소리 → 반짝임 → 등장(약 1.15초)
    case "toss": return {
      tones: [tone("triangle", 2_100, 1_800, 0.48, 0.09, 0.22), tone("sine", 3_200, 3_000, 0.48, 0.12, 0.1), tone("triangle", 1_319, 1_319, 0.62, 0.1, 0.12), tone("triangle", 1_760, 1_760, 0.72, 0.16, 0.12), tone("square", 520, 1_320, 1.17, 0.14, 0.1), tone("sine", 1_320, 1_760, 1.31, 0.12, 0.1)],
      noises: [noise(0, 0.42, 0.2, "highpass", 1_200, 3_500), noise(0.48, 0.06, 0.35, "bandpass", 3_000, 2_000)],
    };
    case "charge": return { tones: [tone("sine", 280, 880, 0, 0.26, 0.18)], noises: [] };
    case "sendout": return { tones: [tone("square", 520, 1_320, 0.02, 0.14, 0.12), tone("sine", 1_320, 1_760, 0.16, 0.12, 0.12)], noises: [noise(0, 0.06, 0.35, "highpass", 2_000, 4_000)] };
    case "faint": return { tones: [tone("square", 660, 140, 0, 0.62, 0.14)], noises: [] };
    case "victory": return { tones: [523, 659, 784, 1_047].map((frequency, index) => tone("triangle", frequency, frequency, index * 0.12, index === 3 ? 0.42 : 0.14, 0.2)), noises: [] };
    case "hit":
      if (sound.tier === "strong") return { tones: [tone("sine", 160, 50, 0, 0.26, 0.5), tone("triangle", 1_400, 1_100, 0.02, 0.2, 0.16)], noises: [noise(0, 0.16, 0.6, "lowpass", 3_000, 600)] };
      if (sound.tier === "weak") return { tones: [tone("sine", 120, 70, 0, 0.12, 0.25)], noises: [noise(0, 0.06, 0.2, "lowpass", 900, 400)] };
      return { tones: [tone("sine", 140, 60, 0, 0.18, 0.4)], noises: [noise(0, 0.12, 0.45, "lowpass", 2_200, 500)] };
    case "attack":
      switch (sound.motion) {
        case "flame": return { tones: [], noises: [noise(0, 0.34, 0.35, "bandpass", 600, 2_200)] };
        case "splash": return { tones: [tone("sine", 900, 400, 0.05, 0.1, 0.12), tone("sine", 1_100, 500, 0.17, 0.1, 0.1)], noises: [noise(0, 0.3, 0.3, "lowpass", 1_600, 400)] };
        case "bolt": return { tones: [tone("sawtooth", 1_200, 300, 0, 0.26, 0.1), tone("square", 90, 60, 0, 0.26, 0.08)], noises: [noise(0, 0.22, 0.25, "highpass", 3_000, 5_000)] };
        case "leaf": return { tones: [], noises: [noise(0, 0.32, 0.28, "highpass", 1_500, 4_000)] };
        case "strike": return { tones: [], noises: [noise(0, 0.16, 0.4, "bandpass", 400, 1_400)] };
        case "wave": return { tones: [tone("sine", 420, 640, 0, 0.36, 0.14), tone("sine", 630, 960, 0, 0.36, 0.08)], noises: [] };
      }
  }
}

export type BattleAudio = ReturnType<typeof createBattleAudio>;

/**
 * AudioContext는 사용자 입력 이후에만 만든다(`unlock`). 일시정지는 suspend, 건너뛰기는 stopAll, 화면 이탈은 close.
 */
export function createBattleAudio() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let bus: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let closed = false;
  const samples = new Map<SampleName, AudioBuffer>();

  function loadSamples(audio: AudioContext) {
    for (const [name, url] of Object.entries(BATTLE_SOUND_SAMPLES) as [SampleName, string][]) {
      void fetch(url)
        .then((response) => response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status))))
        .then((data) => audio.decodeAudioData(data))
        .then((buffer) => { samples.set(name, buffer); })
        .catch(() => {
          // 샘플을 못 받으면 그 소리는 합성음으로 낸다.
        });
    }
  }

  function unlock() {
    if (closed || typeof window === "undefined" || !("AudioContext" in window)) return null;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      bus = context.createGain();
      bus.connect(master);
      noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.5), context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
      loadSamples(context);
    }
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    return context;
  }

  function play(sound: BattleSound, speed: number) {
    if (!context || !bus || !noiseBuffer || context.state === "closed") return;
    const now = context.currentTime + 0.01;
    const cues = sampleCues(sound);
    if (cues && cues.every((cue) => samples.has(cue.sample))) {
      for (const cue of cues) {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = samples.get(cue.sample)!;
        // 2배속이면 샘플도 빠르게(짧게) 낸다.
        source.playbackRate.value = speed;
        gain.gain.value = 0.9;
        source.connect(gain).connect(bus);
        source.start(now + cue.at / speed);
      }
      return;
    }
    const recipe = soundRecipe(sound);
    for (const item of recipe.tones) {
      const start = now + item.at / speed;
      const end = start + item.length / speed;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = item.type;
      oscillator.frequency.setValueAtTime(item.from, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(item.to, 1), end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(item.volume, start + Math.min(0.015, (end - start) / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(bus);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
    for (const item of recipe.noises) {
      const start = now + item.at / speed;
      const end = start + item.length / speed;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = noiseBuffer;
      filter.type = item.filter;
      filter.frequency.setValueAtTime(item.from, start);
      filter.frequency.exponentialRampToValueAtTime(item.to, end);
      gain.gain.setValueAtTime(item.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      source.connect(filter).connect(gain).connect(bus);
      source.start(start);
      source.stop(end + 0.02);
    }
  }

  /** 재생 중인 소리를 모두 끊는다(건너뛰기·다시 보기·끄기). */
  function stopAll() {
    if (!context || !master || !bus) return;
    bus.disconnect();
    bus = context.createGain();
    bus.connect(master);
  }

  return {
    unlock,
    play,
    stopAll,
    get ready() { return Boolean(context) && context?.state !== "closed"; },
    suspend() { if (context?.state === "running") void context.suspend().catch(() => undefined); },
    resume() { if (context?.state === "suspended") void context.resume().catch(() => undefined); },
    close() {
      closed = true;
      stopAll();
      void context?.close().catch(() => undefined);
      context = null;
    },
  };
}

/** 재생 단계에 맞는 효과음. 결과 보기로 건너뛴 결과에는 소리를 내지 않는다. */
export function soundForStep(phase: string, motion: BattleMotion, tier: ImpactTier, skipped: boolean): BattleSound | null {
  if (phase === "intro") return { kind: "toss" };
  if (phase === "sendout") return { kind: "sendout" };
  if (phase === "charge") return { kind: "charge" };
  if (phase === "attack") return { kind: "attack", motion };
  if (phase === "impact") return { kind: "hit", tier };
  if (phase === "recall") return { kind: "faint" };
  if (phase === "result") return skipped ? null : { kind: "victory" };
  return null;
}

export type BattleMusic = ReturnType<typeof createBattleMusic>;

/**
 * 전투 배경음악. 처음 재생할 때 <audio>를 만들어 스트리밍하고, 실패(자동 재생 차단·네트워크)하면 조용히 무음으로 진행한다.
 */
export function createBattleMusic(url: string = BATTLE_BGM) {
  let audio: HTMLAudioElement | null = null;
  let closed = false;
  const element = () => {
    if (!audio) {
      audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0.3;
      audio.preload = "auto";
    }
    return audio;
  };
  return {
    play() {
      if (closed || typeof window === "undefined") return;
      const music = element();
      if (!music.paused) return;
      void music.play().catch(() => undefined);
    },
    pause() { audio?.pause(); },
    /** 처음부터 다시 틀 수 있게 멈춘다(결과·건너뛰기·다시 보기). */
    stop() {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    },
    get playing() { return Boolean(audio && !audio.paused); },
    close() {
      closed = true;
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio = null;
    },
  };
}
