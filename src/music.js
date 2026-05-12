import * as Tone from "tone";

let activeMusic = null;
let pendingSwitchId = null;

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

  disposeNode(music.melodySynth);
  disposeNode(music.bassSynth);
  disposeNode(music.padSynth);
  disposeNode(music.noiseSynth);

  disposeNode(music.delay);
  disposeNode(music.reverb);
  disposeNode(music.filter);
  disposeNode(music.gain);
}

function createWeatherMusic(settings, startTime) {
  const gain = new Tone.Gain(0).toDestination();

  const filter = new Tone.Filter({
    frequency: settings.brightness,
    type: "lowpass",
    rolloff: -24,
  }).connect(gain);

  const reverb = new Tone.Reverb({
    decay: settings.isFoggy ? 7 : settings.isRainy ? 4 : 2.5,
    wet: settings.reverbWet,
  }).connect(filter);

  const delay = new Tone.FeedbackDelay({
    delayTime: "8n",
    feedback: settings.isStormy ? 0.45 : 0.25,
    wet: settings.isClear ? 0.15 : 0.3,
  }).connect(reverb);

  const melodySynth = new Tone.Synth({
    oscillator: {
      type: settings.isSnowy
        ? "triangle"
        : settings.isStormy
        ? "sawtooth"
        : "sine",
    },
    envelope: {
      attack: 0.02,
      decay: 0.18,
      sustain: 0.25,
      release: 0.7,
    },
  }).connect(delay);

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

  const padSynth = new Tone.PolySynth(Tone.Synth, {
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

  const noiseSynth = new Tone.NoiseSynth({
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

  const melodyLoop = new Tone.Loop((time) => {
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

  const bassLoop = new Tone.Loop((time) => {
    const note = settings.bassNotes[bassIndex % settings.bassNotes.length];
    bassSynth.triggerAttackRelease(note, "2n", time);
    bassIndex++;
  }, "1m");

  const padLoop = new Tone.Loop((time) => {
    const root = settings.scale[0];
    const third = settings.scale[2];
    const fifth = settings.scale[4] ?? settings.scale[3];

    padSynth.triggerAttackRelease([root, third, fifth], "2m", time);
  }, "2m");

  const rainLoop = new Tone.Loop((time) => {
    if (settings.isRainy || settings.rainIntensity > 0) {
      if (Math.random() < 0.4 + settings.rainIntensity * 0.5) {
        noiseSynth.triggerAttackRelease("32n", time);
      }
    }
  }, "16n");

  const stormLoop = new Tone.Loop((time) => {
    if (settings.isStormy && Math.random() > 0.65) {
      bassSynth.triggerAttackRelease(settings.bassNotes[0], "8n", time);
      noiseSynth.triggerAttackRelease("16n", time);
    }
  }, "2n");

  melodyLoop.start(startTime);
  bassLoop.start(startTime);
  padLoop.start(startTime);
  rainLoop.start(startTime);
  stormLoop.start(startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(1, startTime + 0.35);

  return {
    gain,
    filter,
    reverb,
    delay,
    melodySynth,
    bassSynth,
    padSynth,
    noiseSynth,
    melodyLoop,
    bassLoop,
    padLoop,
    rainLoop,
    stormLoop,
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
      oldMusic.gain.gain.linearRampToValueAtTime(0, time + 0.35);

      setTimeout(() => {
        disposeMusic(oldMusic);
      }, 500);
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
    }, 400);
  } else {
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }
}