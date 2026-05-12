import * as Tone from "tone";

let activeMusic = null;
let pendingSwitchId = null;

const TRANSITION_TIME = 0.35;

export async function unlockWeatherMusicAudio() {
  await Tone.start();
}

let masterVolume = 0.7;

export function setWeatherMusicVolume(value) {
  masterVolume = Math.max(0, Math.min(1, value));

  if (activeMusic?.gain) {
    activeMusic.gain.gain.rampTo(masterVolume, 0.1);
  }
}

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

function disposeMusic(music) {
  if (!music) return;

  disposePart(music.melodyLoop);
  disposePart(music.bassLoop);
  disposePart(music.padLoop);
  disposePart(music.rainLoop);
  disposePart(music.stormLoop);
  disposePart(music.sparkleLoop);

  disposeNode(music.melodySynth);
  disposeNode(music.bassSynth);
  disposeNode(music.padSynth);
  disposeNode(music.rainSynth);
  disposeNode(music.sparkleSynth);

  disposeNode(music.chorus);
  disposeNode(music.delay);
  disposeNode(music.reverb);
  disposeNode(music.filter);
  disposeNode(music.outputGain);
  disposeNode(music.limiter);
  disposeNode(music.gain);
}

function createWeatherMusic(settings, startTime) {
  const gain = new Tone.Gain(0).toDestination();

const limiter = new Tone.Limiter(-1).connect(gain);

const outputGain = new Tone.Gain(1.5).connect(limiter);

const filter = new Tone.Filter({
  frequency: settings.brightness,
  type: "lowpass",
  rolloff: -24,
}).connect(outputGain);

  const reverb = new Tone.Reverb({
  decay: settings.isFoggy
    ? 5 + settings.humidityAmount * 5
    : settings.isRainy
    ? 3 + settings.humidityAmount * 4
    : 2 + settings.humidityAmount * 3,
  wet: settings.reverbWet,
}).connect(filter);

  const delay = new Tone.FeedbackDelay({
  delayTime: settings.isStormy ? "16n" : "8n",
  feedback: settings.isStormy
    ? Math.min(0.6, settings.delayFeedback + 0.18)
    : settings.delayFeedback,
  wet: settings.delayWet,
}).connect(reverb);

  const chorus = new Tone.Chorus({
  frequency: settings.isFoggy ? 0.45 : 1.2 + settings.humidityAmount * 0.8,
  delayTime: 2.5 + settings.humidityAmount * 3,
  depth: settings.isFoggy
    ? 0.5 + settings.humidityAmount * 0.4
    : 0.2 + settings.humidityAmount * 0.55,
  wet: settings.chorusWet,
}).connect(delay);

  chorus.start(startTime);

  const melodySynth = new Tone.FMSynth({
    harmonicity: settings.isSnowy ? 2.8 : settings.isStormy ? 1.2 : 1.8,
    modulationIndex: settings.isStormy ? 8 : settings.isSnowy ? 5 : 2.5,
    oscillator: {
      type: settings.isStormy ? "sawtooth" : "sine",
    },
    envelope: {
      attack: settings.isFoggy ? 0.12 : 0.02,
      decay: 0.25,
      sustain: 0.18,
      release: settings.isFoggy ? 1.5 : 0.8,
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
    volume: settings.isStormy ? -13 : -10,
  }).connect(chorus);

  const bassSynth = new Tone.MonoSynth({
    oscillator: {
      type: settings.isStormy ? "sawtooth" : "triangle",
    },
    filter: {
      Q: settings.isStormy ? 2 : 1,
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
      baseFrequency: settings.isStormy ? 90 : 120,
      octaves: settings.isStormy ? 3 : 2,
    },
    volume: -15,
  }).connect(reverb);

  const padSynth = new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: settings.isFoggy ? 0.8 : 1.5,
    oscillator: {
      type: settings.isClear ? "sine" : "triangle",
    },
    envelope: {
      attack: settings.isFoggy ? 2.5 : 1.2,
      decay: 0.6,
      sustain: 0.65,
      release: settings.isFoggy ? 4 : 2.5,
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
    volume: settings.isFoggy ? -22 : -19,
  }).connect(reverb);

  const rainSynth = new Tone.NoiseSynth({
    noise: {
      type: settings.isRainy ? "pink" : "white",
    },
    envelope: {
      attack: 0.001,
      decay: settings.isStormy ? 0.12 : 0.06,
      sustain: 0,
      release: 0.04,
    },
    volume: settings.isStormy ? -20 : -30,
  }).connect(filter);

  const sparkleSynth = new Tone.MetalSynth({
    frequency: settings.isSnowy ? 260 : 180,
    envelope: {
      attack: 0.001,
      decay: settings.isSnowy ? 1.2 : 0.45,
      release: 0.25,
    },
    harmonicity: settings.isSnowy ? 7.5 : 4.2,
    modulationIndex: settings.isSnowy ? 18 : 10,
    resonance: settings.isSnowy ? 3000 : 1600,
    octaves: settings.isSnowy ? 1.8 : 1.2,
    volume: settings.isSnowy ? -22 : -28,
  }).connect(delay);

  let melodyIndex = 0;
  let bassIndex = 0;
  let sparkleIndex = 0;

  const melodyLoop = new Tone.Loop((time) => {
    const step = melodyIndex % settings.scale.length;
    const note = settings.scale[step];

    const shouldPlay =
      settings.isFoggy
        ? Math.random() > 0.45
        : settings.isStormy || settings.isRainy
        ? Math.random() > 0.25
        : Math.random() > 0.12;

    if (shouldPlay) {
      const duration = settings.isFoggy ? "4n" : "8n";
      melodySynth.triggerAttackRelease(note, duration, time);
    }

    melodyIndex += settings.windSpeed > 10 ? 2 : 1;
  }, settings.windSpeed > 12 ? "8n" : "4n");

  const bassLoop = new Tone.Loop((time) => {
    const note = settings.bassNotes[bassIndex % settings.bassNotes.length];
    bassSynth.triggerAttackRelease(note, settings.isStormy ? "4n" : "2n", time);
    bassIndex++;
  }, settings.isStormy ? "2n" : "1m");

  const padLoop = new Tone.Loop((time) => {
    const root = settings.scale[0];
    const third = settings.scale[2];
    const fifth = settings.scale[4] ?? settings.scale[3];

    padSynth.triggerAttackRelease([root, third, fifth], "2m", time);
  }, "2m");

  const rainLoop = new Tone.Loop((time) => {
    if (settings.isRainy || settings.rainIntensity > 0 || settings.isStormy) {
      const chance = settings.isStormy
        ? 0.8
        : 0.25 + settings.rainIntensity * 0.55;

      if (Math.random() < chance) {
        rainSynth.triggerAttackRelease("32n", time);
      }
    }
  }, settings.isStormy ? "16n" : "16n");

  const stormLoop = new Tone.Loop((time) => {
    if (settings.isStormy && Math.random() > 0.55) {
      bassSynth.triggerAttackRelease(settings.bassNotes[0], "8n", time);
      rainSynth.triggerAttackRelease("16n", time);
    }
  }, "2n");

  const sparkleLoop = new Tone.Loop((time) => {
    if (settings.isSnowy || settings.isClear) {
      const chance = settings.isSnowy ? 0.45 : 0.18;

      if (Math.random() < chance) {
        const note = settings.scale[sparkleIndex % settings.scale.length];
        sparkleSynth.frequency.setValueAtTime(Tone.Frequency(note).toFrequency(), time);
        sparkleSynth.triggerAttackRelease("16n", time);
        sparkleIndex += 2;
      }
    }
  }, settings.isSnowy ? "8n" : "2n");

  melodyLoop.start(startTime);
  bassLoop.start(startTime);
  padLoop.start(startTime);
  rainLoop.start(startTime);
  stormLoop.start(startTime);
  sparkleLoop.start(startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(
  masterVolume,
  startTime + TRANSITION_TIME
);

  return {
    gain,
    outputGain,
    limiter,
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

export async function requestWeatherMusicChange(settings) {
  await Tone.start();

  Tone.Transport.bpm.rampTo(settings.bpm, 0.5);

  if (Tone.Transport.state !== "started") {
    Tone.Transport.start();
  }

  if (pendingSwitchId !== null) {
    Tone.Transport.clear(pendingSwitchId);
    pendingSwitchId = null;
  }

  const switchTime = activeMusic
    ? Tone.Transport.nextSubdivision("4n")
    : Tone.now();

  const oldMusic = activeMusic;

  pendingSwitchId = Tone.Transport.scheduleOnce((time) => {
    const newMusic = createWeatherMusic(settings, time);
    activeMusic = newMusic;

    if (oldMusic) {
      oldMusic.gain.gain.cancelScheduledValues(time);
      oldMusic.gain.gain.setValueAtTime(oldMusic.gain.gain.value, time);
      oldMusic.gain.gain.linearRampToValueAtTime(0, time + TRANSITION_TIME);

      setTimeout(() => {
        disposeMusic(oldMusic);
      }, (TRANSITION_TIME + 0.2) * 1000);
    }

    pendingSwitchId = null;
  }, switchTime);
}

export function stopWeatherMusic() {
  if (pendingSwitchId !== null) {
    Tone.Transport.clear(pendingSwitchId);
    pendingSwitchId = null;
  }

  if (activeMusic) {
    const oldMusic = activeMusic;
    activeMusic = null;

    const now = Tone.now();

    oldMusic.gain.gain.cancelScheduledValues(now);
    oldMusic.gain.gain.setValueAtTime(oldMusic.gain.gain.value, now);
    oldMusic.gain.gain.linearRampToValueAtTime(0, now + 0.3);

    setTimeout(() => {
      disposeMusic(oldMusic);
      Tone.Transport.stop();
      Tone.Transport.cancel();
    }, 500);
  } else {
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }
}