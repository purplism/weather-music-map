import * as Tone from "tone";

let engine = null;
let activeSettings = null;
let pendingSwitchId = null;
let isEnginePlaying = false;

let masterVolume = 0.7;

const OUTPUT_GAIN = 1.5;
const PARAM_TRANSITION_TIME = 0.25;
const STOP_FADE_TIME = 0.04;
const USE_GLOBAL_FILTER = true;
const USE_PAD_FILTER = true;
export async function unlockWeatherMusicAudio() {
  await Tone.start();
}

export function setWeatherMusicVolume(value) {
  masterVolume = Math.max(0, Math.min(1, value));

  if (engine?.masterGain) {
    engine.masterGain.gain.rampTo(masterVolume, 0.1);
  }
}

function restoreMasterVolume() {
  if (!engine?.masterGain) return;

  engine.masterGain.gain.cancelScheduledValues(Tone.now());
  engine.masterGain.gain.rampTo(masterVolume, 0.08);
}

function silenceMasterVolume() {
  if (!engine?.masterGain) return;

  engine.masterGain.gain.cancelScheduledValues(Tone.now());
  engine.masterGain.gain.rampTo(0, STOP_FADE_TIME);
}

function getSafeSettings(settings) {
  return {
    bpm: settings.bpm ?? 90,
    timeSignature: settings.timeSignature ?? [4, 4],
    tuning: settings.tuning ?? "12-TET",
    scale: settings.scale?.length ? settings.scale : ["C3", "D3", "G3", "A3"],
    bassNotes: settings.bassNotes?.length
      ? settings.bassNotes
      : ["C2", "G2", "A2", "G2"],
    padNotes: settings.padNotes?.length ? settings.padNotes : ["C3", "E3", "G3"],
    padChordProgression: settings.padChordProgression?.length
      ? settings.padChordProgression
      : [settings.padNotes?.length ? settings.padNotes : ["C3", "E3", "G3"]],
    padGain: settings.padGain ?? 0,
    padFilterDepth: settings.padFilterDepth ?? 0,
    padFilterBaseFrequency: settings.padFilterBaseFrequency ?? 2400,
    padFilterOctaves: settings.padFilterOctaves ?? 0.25,
    padFilterFrequency: settings.padFilterFrequency ?? 0.08,
    brightness: settings.brightness ?? 2000,
    reverbWet: settings.reverbWet ?? 0.3,
    chorusWet: settings.chorusWet ?? 0.2,
    delayWet: settings.delayWet ?? 0.2,
    delayFeedback: settings.delayFeedback ?? 0.2,
    distortionWet: settings.distortionWet ?? 0,
    melodyRelease: settings.melodyRelease ?? 0.8,
    rainIntensity: settings.rainIntensity ?? 0,
    lowPressurePercussion: settings.lowPressurePercussion ?? 0,
    highPressureDryness: settings.highPressureDryness ?? 0,
    melodyArpLength: settings.melodyArpLength ?? 3,
    melodySixteenthChance: settings.melodySixteenthChance ?? 0,
    melodyOctaveChance: settings.melodyOctaveChance ?? 0,
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

  if (USE_GLOBAL_FILTER) {
    engine.filter.frequency.cancelScheduledValues(time);
    engine.filter.frequency.setValueAtTime(engine.filter.frequency.value, time);
    engine.filter.frequency.linearRampToValueAtTime(safe.brightness, endTime);
  }

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

  engine.distortion.wet.cancelScheduledValues(time);
  engine.distortion.wet.setValueAtTime(engine.distortion.wet.value, time);
  engine.distortion.wet.linearRampToValueAtTime(safe.distortionWet, endTime);

  engine.chorus.wet.cancelScheduledValues(time);
  engine.chorus.wet.setValueAtTime(engine.chorus.wet.value, time);
  engine.chorus.wet.linearRampToValueAtTime(safe.chorusWet, endTime);

  engine.melodySynth.envelope.release = safe.melodyRelease;
  engine.melodySynth.modulationEnvelope.release = safe.melodyRelease * 0.85;

  engine.padGain.gain.cancelScheduledValues(time);
  engine.padGain.gain.setValueAtTime(engine.padGain.gain.value, time);
  engine.padGain.gain.linearRampToValueAtTime(safe.padGain, endTime);

  if (USE_PAD_FILTER) {
    engine.padAutoFilter.depth.cancelScheduledValues(time);
    engine.padAutoFilter.depth.setValueAtTime(
      engine.padAutoFilter.depth.value,
      time
    );
    engine.padAutoFilter.depth.linearRampToValueAtTime(
      safe.padFilterDepth,
      endTime
    );

    engine.padAutoFilter.frequency.cancelScheduledValues(time);
    engine.padAutoFilter.frequency.setValueAtTime(
      engine.padAutoFilter.frequency.value,
      time
    );
    engine.padAutoFilter.frequency.linearRampToValueAtTime(
      safe.padFilterFrequency,
      endTime
    );

    engine.padAutoFilter.baseFrequency = safe.padFilterBaseFrequency;
    engine.padAutoFilter.octaves = safe.padFilterOctaves;
  }
}

function transposeNoteByOctave(note) {
  if (typeof note === "number") {
    return note * 2;
  }

  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);

  if (!match) {
    return note;
  }

  return `${match[1]}${Number(match[2]) + 1}`;
}

function getPitchFrequency(pitch) {
  return typeof pitch === "number" ? pitch : Tone.Frequency(pitch).toFrequency();
}

function applyTransportMeter(settings) {
  Tone.Transport.timeSignature = settings.timeSignature;
}

function createEngine() {
  const masterGain = new Tone.Gain(masterVolume).toDestination();
  const limiter = new Tone.Limiter(-1).connect(masterGain);
  const outputGain = new Tone.Gain(OUTPUT_GAIN).connect(limiter);

  const filter = new Tone.Filter({
    frequency: 2000,
    type: "lowpass",
    rolloff: -24,
  });
  const sharedOutput = USE_GLOBAL_FILTER ? filter : outputGain;

  if (USE_GLOBAL_FILTER) {
    filter.connect(outputGain);
  }

  const reverb = new Tone.Reverb({
    decay: 4,
    wet: 0.3,
  }).connect(sharedOutput);

  const delay = new Tone.FeedbackDelay({
    delayTime: "8n",
    feedback: 0.2,
    wet: 0.2,
  }).connect(reverb);

  const distortion = new Tone.Distortion({
    distortion: 0.32,
    wet: 0,
  }).connect(delay);

  const chorus = new Tone.Chorus({
    frequency: 1.2,
    delayTime: 3.5,
    depth: 0.4,
    wet: 0.2,
  }).connect(distortion);

  chorus.start();

  const melodySynth = new Tone.FMSynth({
    harmonicity: 1.8,
    modulationIndex: 3,
    oscillator: {
      type: "sine",
    },
    envelope: {
      attack: 0.004,
      decay: 0.25,
      sustain: 0.18,
      release: 0.8,
    },
    modulation: {
      type: "sine",
    },
    modulationEnvelope: {
      attack: 0.006,
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
  }).connect(outputGain);

  const padReverb = new Tone.Reverb({
    decay: 4,
    wet: 0.5,
  }).connect(sharedOutput);

  const padChorus = new Tone.Chorus({
    frequency: 1.2,
    delayTime: 3.5,
    depth: 0.4,
    wet: 0.25,
  }).connect(padReverb);

  padChorus.start();

  const padAutoFilter = new Tone.AutoFilter({
    frequency: 0.08,
    baseFrequency: 2400,
    octaves: 0.25,
    depth: 0,
    filter: {
      type: "lowpass",
      rolloff: -12,
      Q: 1,
    },
  });

  if (USE_PAD_FILTER) {
    padAutoFilter.connect(padChorus);
  }

  padAutoFilter.start();

  const padGain = new Tone.Gain(0).connect(
    USE_PAD_FILTER ? padAutoFilter : padChorus
  );

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
    volume: 0,
  }).connect(padGain);

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
    volume: -24,
  }).connect(sharedOutput);

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
    volume: -24,
  }).connect(delay);

  /*
  const kickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.035,
    octaves: 5.5,
    oscillator: {
      type: "sine",
    },
    envelope: {
      attack: 0.001,
      decay: 0.22,
      sustain: 0,
      release: 0.08,
    },
    volume: -18,
  }).connect(outputGain);

  const snareSynth = new Tone.NoiseSynth({
    noise: {
      type: "white",
    },
    envelope: {
      attack: 0.001,
      decay: 0.09,
      sustain: 0,
      release: 0.04,
    },
    volume: -26,
  }).connect(outputGain);

  const hatSynth = new Tone.MetalSynth({
    frequency: 260,
    envelope: {
      attack: 0.001,
      decay: 0.045,
      release: 0.015,
    },
    harmonicity: 4.2,
    modulationIndex: 16,
    resonance: 4500,
    octaves: 0.55,
    volume: -31,
  }).connect(outputGain);
  */

  let melodyIndex = 0;
  let bassIndex = 0;
  let sparkleIndex = 0;
  let bassStep = 0;
  let melodyStep = 0;
  let padChordIndex = 0;
  /* let drumStep = 0; */

  const melodyLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);

    const shouldSkipForSlowWind = settings.windSpeed <= 12 && melodyStep % 2 === 1;
    melodyStep++;

    if (shouldSkipForSlowWind) return;

    const chance = settings.isFoggy
      ? 0.55
      : settings.isStormy || settings.isRainy
      ? 0.75
      : 0.88;

    if (Math.random() < chance) {
      const duration = settings.tuning === "53-EDO" ? "4n" : settings.isFoggy ? "4n" : "8n";
      const arpLength = Math.max(3, Math.round(settings.melodyArpLength));
      const step = Math.max(1, settings.windSpeed > 10 ? 2 : 1);
      let noteTime = time;

      for (let i = 0; i < arpLength; i += 1) {
        const sourceNote = settings.scale[
          (melodyIndex + i * step) % settings.scale.length
        ];
        const arpNote =
          Math.random() < settings.melodyOctaveChance
            ? transposeNoteByOctave(sourceNote)
            : sourceNote;

        melodySynth.triggerAttackRelease(arpNote, duration, noteTime);

        const useSixteenth = Math.random() < settings.melodySixteenthChance;
        noteTime += Tone.Time(useSixteenth ? "16n" : "8n").toSeconds();
      }
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

    const chord =
      settings.padChordProgression[
        padChordIndex % settings.padChordProgression.length
      ];

    padSynth.triggerAttackRelease(chord, "2m", time);
    padChordIndex += 1;
  }, "2m");

  const rainLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);

    if (settings.isRainy || settings.rainIntensity > 0 || settings.isStormy) {
      const baseChance = settings.isStormy
        ? 0.78
        : 0.2 + settings.rainIntensity * 0.5;
      const chance = Math.max(
        0,
        Math.min(
          0.95,
          baseChance +
            settings.lowPressurePercussion * 0.4 -
            settings.highPressureDryness * 0.3
        )
      );

      if (Math.random() < chance) {
        rainSynth.triggerAttackRelease("32n", time);
      }
    }
  }, "16n");

  const stormLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);

    const accentChance = Math.max(
      0.18,
      Math.min(
        0.72,
        0.45 +
          settings.lowPressurePercussion * 0.35 -
          settings.highPressureDryness * 0.28
      )
    );

    if (
      (settings.isStormy || settings.lowPressurePercussion > 0.45) &&
      Math.random() < accentChance
    ) {
      rainSynth.triggerAttackRelease("16n", time);
    }
  }, "2n");

  /*
  const drumLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);
    const step = drumStep % 16;
    const lowPressure = settings.lowPressurePercussion;
    const windAmount = Math.min(1, settings.windSpeed / 35);

    if ([0, 6, 10].includes(step)) {
      kickSynth.triggerAttackRelease(step === 6 ? "G1" : "C1", "16n", time);
    }

    if (step === 4 || step === 12) {
      snareSynth.volume.value = -24;
      snareSynth.triggerAttackRelease("16n", time);
    } else if (
      (step === 3 || step === 11 || step === 15) &&
      Math.random() < lowPressure * 0.55
    ) {
      snareSynth.volume.value = -34;
      snareSynth.triggerAttackRelease("32n", time);
    }

    if (step % 2 === 0 || Math.random() < windAmount * 0.55) {
      hatSynth.volume.value = step % 4 === 0 ? -29 : -34;
      hatSynth.triggerAttackRelease("32n", time);
    }

    drumStep += 1;
  }, "16n");
  */

  const sparkleLoop = new Tone.Loop((time) => {
    if (!activeSettings) return;

    const settings = getSafeSettings(activeSettings);

    if (settings.isSnowy || settings.isClear) {
      const chance = settings.isSnowy ? 0.45 : 0.18;

      if (Math.random() < chance) {
        const note = settings.scale[sparkleIndex % settings.scale.length];
        sparkleSynth.frequency.setValueAtTime(
          getPitchFrequency(note),
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
    distortion,
    chorus,
    padReverb,
    padChorus,
    padGain,
    padAutoFilter,
    melodySynth,
    bassSynth,
    padSynth,
    rainSynth,
    sparkleSynth,
    /*
    kickSynth,
    snareSynth,
    hatSynth,
    */
    melodyLoop,
    bassLoop,
    padLoop,
    rainLoop,
    stormLoop,
    /* drumLoop, */
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
  /* engine.drumLoop.start(startTime); */
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
  /* engine.drumLoop.stop(); */
  engine.sparkleLoop.stop();

  isEnginePlaying = false;
}

export async function requestWeatherMusicChange(settings) {
  await Tone.start();

  const safeSettings = getSafeSettings(settings);
  ensureEngine();
  restoreMasterVolume();

  if (Tone.Transport.state !== "started") {
    activeSettings = safeSettings;
    applyTransportMeter(safeSettings);
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
    applyTransportMeter(safeSettings);

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
  silenceMasterVolume();
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
