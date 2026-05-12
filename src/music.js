import * as Tone from "tone";

let melodySynth = null;
let bassSynth = null;
let padSynth = null;
let noiseSynth = null;

let melodyLoop = null;
let bassLoop = null;
let padLoop = null;
let rainLoop = null;
let stormLoop = null;

let reverb = null;
let filter = null;
let delay = null;

function disposePart(part) {
  if (part) {
    part.stop();
    part.dispose();
  }
}

function disposeNode(node) {
  if (node) {
    node.dispose();
  }
}

export async function playWeatherMusic(settings) {
  await Tone.start();

  stopWeatherMusic();

  Tone.Transport.bpm.value = settings.bpm;

  filter = new Tone.Filter({
    frequency: settings.brightness,
    type: "lowpass",
    rolloff: -24,
  }).toDestination();

  reverb = new Tone.Reverb({
    decay: settings.isFoggy ? 7 : settings.isRainy ? 4 : 2.5,
    wet: settings.reverbWet,
  }).connect(filter);

  delay = new Tone.FeedbackDelay({
    delayTime: "8n",
    feedback: settings.isStormy ? 0.45 : 0.25,
    wet: settings.isClear ? 0.15 : 0.3,
  }).connect(reverb);

  melodySynth = new Tone.Synth({
    oscillator: {
      type: settings.isSnowy ? "triangle" : settings.isStormy ? "sawtooth" : "sine",
    },
    envelope: {
      attack: 0.02,
      decay: 0.18,
      sustain: 0.25,
      release: 0.7,
    },
  }).connect(delay);

  bassSynth = new Tone.MonoSynth({
    oscillator: {
      type: "triangle",
    },
    filter: {
      Q: 1,
      type: "lowpass",
      rolloff: -24,
    },
    envelope: {
      attack: 0.04,
      decay: 0.25,
      sustain: 0.35,
      release: 1.2,
    },
    filterEnvelope: {
      attack: 0.02,
      decay: 0.2,
      sustain: 0.2,
      release: 1,
      baseFrequency: 120,
      octaves: 2,
    },
  }).connect(reverb);

  padSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: settings.isClear ? "sine" : "triangle",
    },
    envelope: {
      attack: 1.5,
      decay: 0.5,
      sustain: 0.6,
      release: 3,
    },
    volume: -16,
  }).connect(reverb);

  noiseSynth = new Tone.NoiseSynth({
    noise: {
      type: settings.isRainy ? "pink" : "white",
    },
    envelope: {
      attack: 0.001,
      decay: 0.08,
      sustain: 0,
      release: 0.05,
    },
    volume: settings.isStormy ? -12 : -22,
  }).connect(filter);

  let melodyIndex = 0;
  let bassIndex = 0;

  melodyLoop = new Tone.Loop((time) => {
    const step = melodyIndex % settings.scale.length;
    const note = settings.scale[step];

    const shouldPlay =
      settings.isStormy || settings.isRainy
        ? Math.random() > 0.25
        : Math.random() > 0.1;

    if (shouldPlay) {
      melodySynth.triggerAttackRelease(note, "8n", time);
    }

    melodyIndex += settings.windSpeed > 10 ? 2 : 1;
  }, settings.windSpeed > 12 ? "8n" : "4n");

  bassLoop = new Tone.Loop((time) => {
    const note = settings.bassNotes[bassIndex % settings.bassNotes.length];
    bassSynth.triggerAttackRelease(note, "2n", time);
    bassIndex++;
  }, "1m");

  padLoop = new Tone.Loop((time) => {
    const root = settings.scale[0];
    const third = settings.scale[2];
    const fifth = settings.scale[4] ?? settings.scale[3];

    padSynth.triggerAttackRelease([root, third, fifth], "2m", time);
  }, "2m");

  rainLoop = new Tone.Loop((time) => {
    if (settings.isRainy || settings.rainIntensity > 0) {
      if (Math.random() < 0.4 + settings.rainIntensity * 0.5) {
        noiseSynth.triggerAttackRelease("32n", time);
      }
    }
  }, "16n");

  stormLoop = new Tone.Loop((time) => {
    if (settings.isStormy && Math.random() > 0.65) {
      bassSynth.triggerAttackRelease(settings.bassNotes[0], "8n", time);
      noiseSynth.triggerAttackRelease("16n", time);
    }
  }, "2n");

  melodyLoop.start(0);
  bassLoop.start(0);
  padLoop.start(0);
  rainLoop.start(0);
  stormLoop.start(0);

  Tone.Transport.start();
}

export function stopWeatherMusic() {
  disposePart(melodyLoop);
  disposePart(bassLoop);
  disposePart(padLoop);
  disposePart(rainLoop);
  disposePart(stormLoop);

  disposeNode(melodySynth);
  disposeNode(bassSynth);
  disposeNode(padSynth);
  disposeNode(noiseSynth);
  disposeNode(reverb);
  disposeNode(filter);
  disposeNode(delay);

  melodyLoop = null;
  bassLoop = null;
  padLoop = null;
  rainLoop = null;
  stormLoop = null;

  melodySynth = null;
  bassSynth = null;
  padSynth = null;
  noiseSynth = null;

  reverb = null;
  filter = null;
  delay = null;

  Tone.Transport.stop();
  Tone.Transport.cancel();
}