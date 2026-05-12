import * as Tone from "tone";

let engine = null;
let activeSettings = null;
let pendingSwitchId = null;
let isEnginePlaying = false;

let masterVolume = 0.7;

const OUTPUT_GAIN = 1.5;
const PARAM_TRANSITION_TIME = 0.25;

export async function unlockWeatherMusicAudio() {
  await Tone.start();
}

export function setWeatherMusicVolume(value) {
  masterVolume = Math.max(0, Math.min(1, value));

  if (engine?.masterGain) {
    engine.masterGain.gain.rampTo(masterVolume, 0.1);
  }
}

function getSafeSettings(settings) {
  return {
    bpm: settings.bpm ?? 90,
    scale: settings.scale?.length ? settings.scale : ["C3", "D3", "G3", "A3"],
    bassNotes: settings.bassNotes?.length
      ? settings.bassNotes
      : ["C2", "G2", "A2", "G2"],
    brightness: settings.brightness ?? 2000,
    reverbWet: settings.reverbWet ?? 0.3,
    chorusWet: settings.chorusWet ?? 0.2,
    delayWet: settings.delayWet ?? 0.2,
    delayFeedback: settings.delayFeedback ?? 0.2,
    rainIntensity: settings.rainIntensity ?? 0,
    windSpeed: settings.windSpeed ?? 0,
    isRainy: settings.isRainy ?? false,
    isStormy: settings.isStormy ?? false,
    isSnowy: settings.isSnowy ?? false,
    isFoggy: settings.isFoggy ?? false,
    isClear: settings.isClear ?? false,
  };
}

function updateEffectParameters(settings, time) {
  if (!engine) return;

  const safe = getSafeSettings(settings);
  const endTime = time + PARAM_TRANSITION_TIME;

  engine.filter.frequency.cancelScheduledValues(time);
  engine.filter.frequency.setValueAtTime(engine.filter.frequency.value, time);
  engine.filter.frequency.linearRampToValueAtTime(safe.brightness, endTime);

  engine.reverb.wet.cancelScheduledValues(time);
  engine.reverb.wet.setValueAtTime(engine.reverb.wet.value, time);
  engine.reverb.wet.linearRampToValueAtTime(safe.reverbWet, endTime);

  engine.delay.wet.cancelScheduledValues(time);
  engine.delay.wet.setValueAtTime(engine.delay.wet.value, time);
  engine.delay.wet.linearRampToValueAtTime(safe.delayWet, endTime);

  engine.delay.feedback.cancelScheduledValues(time);
  engine.delay.feedback.setValueAtTime(engine.delay.feedback.value, time);
  engine.delay.feedback.linearRampToValueAtTime(
    safe.isStormy ? Math.min(0.6, safe.delayFeedback + 0.18) : safe.delayFeedback,
    endTime
  );

  engine.chorus.wet.cancelScheduledValues(time);
  engine.chorus.wet.setValueAtTime(engine.chorus.wet.value, time);
  engine.chorus.wet.linearRampToValueAtTime(safe.chorusWet, endTime);
}

function createEngine() {
  const masterGain = new Tone.Gain(masterVolume).toDestination();
  const limiter = new Tone.Limiter(-1).connect(masterGain);
  const outputGain = new Tone.Gain(OUTPUT_GAIN).connect(limiter);

  const filter = new Tone.Filter({
    frequency: 2000,
    type: "lowpass",
    rolloff: -24,
  }).connect(outputGain);

  const reverb = new Tone.Reverb({
    decay: 4,
    wet: 0.3,
  }).connect(filter);

  const delay = new Tone.FeedbackDelay({
    delayTime: "8n",
    feedback: 0.2,
    wet: 0.2,
  }).connect(reverb);

  const chorus = new Tone.Chorus({
    frequency: 1.2,
    delayTime: 3.5,
    depth: 0.4,
    wet: 0.2,
  }).connect(delay);

  chorus.start();

  const melodySynth = new Tone.FMSynth({
    harmonicity: 1.8,
    modulationIndex: 3,
    oscillator: {
      type: "sine",
    },
    envelope: {
      attack: 0.02,
      decay: 0.25,
      sustain: 0.18,
      release: 0.8,
    },
    modulation: {
      type: "sine",
    },
    modulationEnvelope: {
      attack: 0.04,
      decay: 0.2,
      sustain: 0.15,
      release: 0.7,
    },
    volume: -10,
  }).connect(chorus);

  const bassSynth = new Tone.MonoSynth({
    oscillator: {
      type: "triangle",
    },
    filter: {
      Q: 1,
      type: "lowpass",
      rolloff: -24,
    },
    envelope: {
      attack: 0.03,
      decay: 0.22,
      sustain: 0.28,
      release: 1.1,
    },
    filterEnvelope: {
      attack: 0.02,
      decay: 0.25,
      sustain: 0.18,
      release: 1,
      baseFrequency: 120,
      octaves: 2,
    },
    volume: -15,
  }).connect(reverb);

  const padSynth = new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: 1.3,
    oscillator: {
      type: "triangle",
    },
    envelope: {
      attack: 1.2,
      decay: 0.6,
      sustain: 0.65,
      release: 2.5,
    },
    modulation: {
      type: "sine",
    },
    modulationEnvelope: {
      attack: 1,
      decay: 0.4,
      sustain: 0.5,
      release: 2,
    },
    volume: -21,
  }).connect(reverb);

  const rainSynth = new Tone.NoiseSynth({
    noise: {
      type: "pink",
    },
    envelope: {
      attack: 0.001,
      decay: 0.06,
      sustain: 0,
      release: 0.04,
    },
    volume: -30,
  }).connect(filter);

  const sparkleSynth = new Tone.MetalSynth({
    frequency: 220,
    envelope: {
      attack: 0.001,
      decay: 0.6,
      release: 0.25,
    },
    harmonicity: 5,
    modulationIndex: 12,
    resonance: 1800,
    octaves: 1.4,
    volume: -27,
  }).connect(delay);

  let melodyIndex = 0;
  let bassIndex = 0;
  let sparkleIndex = 0;
  let bassStep = 0;
  let melodyStep = 0;

  const melodyLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);
    const note = settings.scale[melodyIndex % settings.scale.length];

    const shouldSkipForSlowWind = settings.windSpeed <= 12 && melodyStep % 2 === 1;
    melodyStep++;

    if (shouldSkipForSlowWind) return;

    const chance = settings.isFoggy
      ? 0.55
      : settings.isStormy || settings.isRainy
      ? 0.75
      : 0.88;

    if (Math.random() < chance) {
      const duration = settings.isFoggy ? "4n" : "8n";
      melodySynth.triggerAttackRelease(note, duration, time);
    }

    melodyIndex += settings.windSpeed > 10 ? 2 : 1;
  }, "8n");

  const bassLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);

    if (!settings.isStormy && bassStep % 2 === 1) {
      bassStep++;
      return;
    }

    const note = settings.bassNotes[bassIndex % settings.bassNotes.length];
    bassSynth.triggerAttackRelease(note, settings.isStormy ? "4n" : "2n", time);

    bassIndex++;
    bassStep++;
  }, "2n");

  const padLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);

    const root = settings.scale[0];
    const third = settings.scale[2] ?? settings.scale[1];
    const fifth = settings.scale[4] ?? settings.scale[3] ?? settings.scale[0];

    padSynth.triggerAttackRelease([root, third, fifth], "2m", time);
  }, "2m");

  const rainLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);

    if (settings.isRainy || settings.rainIntensity > 0 || settings.isStormy) {
      const chance = settings.isStormy
        ? 0.8
        : 0.25 + settings.rainIntensity * 0.55;

      if (Math.random() < chance) {
        rainSynth.triggerAttackRelease("32n", time);
      }
    }
  }, "16n");

  const stormLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);

    if (settings.isStormy && Math.random() > 0.55) {
      bassSynth.triggerAttackRelease(settings.bassNotes[0], "8n", time);
      rainSynth.triggerAttackRelease("16n", time);
    }
  }, "2n");

  const sparkleLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);

    if (settings.isSnowy || settings.isClear) {
      const chance = settings.isSnowy ? 0.45 : 0.18;

      if (Math.random() < chance) {
        const note = settings.scale[sparkleIndex % settings.scale.length];
        sparkleSynth.frequency.setValueAtTime(
          Tone.Frequency(note).toFrequency(),
          time
        );
        sparkleSynth.triggerAttackRelease("16n", time);
        sparkleIndex += 2;
      }
    }
  }, "2n");

  return {
    masterGain,
    limiter,
    outputGain,
    filter,
    reverb,
    delay,
    chorus,
    melodySynth,
    bassSynth,
    padSynth,
    rainSynth,
    sparkleSynth,
    melodyLoop,
    bassLoop,
    padLoop,
    rainLoop,
    stormLoop,
    sparkleLoop,
  };
}

function ensureEngine() {
  if (!engine) {
    engine = createEngine();
  }

  return engine;
}

function startLoops(startTime) {
  if (!engine || isEnginePlaying) return;

  engine.melodyLoop.start(startTime);
  engine.bassLoop.start(startTime);
  engine.padLoop.start(startTime);
  engine.rainLoop.start(startTime);
  engine.stormLoop.start(startTime);
  engine.sparkleLoop.start(startTime);

  isEnginePlaying = true;
}

function stopLoops() {
  if (!engine) return;

  engine.melodyLoop.stop();
  engine.bassLoop.stop();
  engine.padLoop.stop();
  engine.rainLoop.stop();
  engine.stormLoop.stop();
  engine.sparkleLoop.stop();

  isEnginePlaying = false;
}

export async function requestWeatherMusicChange(settings) {
  await Tone.start();

  const safeSettings = getSafeSettings(settings);
  ensureEngine();

  if (Tone.Transport.state !== "started") {
    activeSettings = safeSettings;
    Tone.Transport.bpm.value = safeSettings.bpm;

    updateEffectParameters(safeSettings, Tone.now());
    startLoops(0);
    Tone.Transport.start();

    return;
  }

  if (pendingSwitchId !== null) {
    Tone.Transport.clear(pendingSwitchId);
    pendingSwitchId = null;
  }

  const switchTime = Tone.Transport.nextSubdivision("4n");

  pendingSwitchId = Tone.Transport.scheduleOnce((time) => {
    activeSettings = safeSettings;

    Tone.Transport.bpm.cancelScheduledValues(time);
    Tone.Transport.bpm.setValueAtTime(Tone.Transport.bpm.value, time);
    Tone.Transport.bpm.linearRampToValueAtTime(safeSettings.bpm, time + 0.25);

    updateEffectParameters(safeSettings, time);

    pendingSwitchId = null;
  }, switchTime);
}

export function stopWeatherMusic() {
  if (pendingSwitchId !== null) {
    Tone.Transport.clear(pendingSwitchId);
    pendingSwitchId = null;
  }

  stopLoops();
  Tone.Transport.stop();
  Tone.Transport.cancel();

  activeSettings = null;
}

export function resetWeatherMusic() {
  if (pendingSwitchId !== null) {
    Tone.Transport.clear(pendingSwitchId);
    pendingSwitchId = null;
  }

  stopLoops();
  Tone.Transport.stop();
  Tone.Transport.cancel();

  activeSettings = null;
}