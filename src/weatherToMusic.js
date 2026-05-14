function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const NOTE_TO_SEMITONE = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const SEMITONE_TO_NOTE = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const MODE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

function noteFromAbsoluteSemitone(absoluteSemitone) {
  const octave = Math.floor(absoluteSemitone / 12);
  const semitone = ((absoluteSemitone % 12) + 12) % 12;

  return `${SEMITONE_TO_NOTE[semitone]}${octave}`;
}

function noteFromKey(key, octave, interval) {
  const rootSemitone = NOTE_TO_SEMITONE[key] ?? NOTE_TO_SEMITONE.C;

  return noteFromAbsoluteSemitone(octave * 12 + rootSemitone + interval);
}

function parseNote(note) {
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);

  if (!match) {
    return null;
  }

  const [, pitch, octaveText] = match;
  const semitone = NOTE_TO_SEMITONE[pitch];

  if (semitone === undefined) {
    return null;
  }

  return {
    absoluteSemitone: Number(octaveText) * 12 + semitone,
  };
}

function transposeNote(note, semitoneShift) {
  const parsed = parseNote(note);

  if (!parsed) {
    return note;
  }

  return noteFromAbsoluteSemitone(parsed.absoluteSemitone + semitoneShift);
}

function buildModeScale(key, mode, startOctave, noteCount) {
  const intervals = MODE_INTERVALS[mode] ?? MODE_INTERVALS.major;
  const notes = [];

  for (let octave = startOctave; notes.length < noteCount; octave += 1) {
    intervals.forEach((interval) => {
      if (notes.length < noteCount) {
        notes.push(noteFromKey(key, octave, interval));
      }
    });
  }

  return notes;
}

function buildBassNotes(key, mode, isStormy) {
  const intervals = MODE_INTERVALS[mode] ?? MODE_INTERVALS.major;
  const third = intervals[2];
  const fifth = intervals[4];
  const seventh = intervals[6];

  if (isStormy) {
    return [
      noteFromKey(key, 2, 0),
      noteFromKey(key, 1, seventh),
      noteFromKey(key, 2, fifth),
      noteFromKey(key, 2, 0),
    ];
  }

  return [
    noteFromKey(key, 2, 0),
    noteFromKey(key, 2, fifth),
    noteFromKey(key, 2, third),
    noteFromKey(key, 2, fifth),
  ];
}

function buildPadNotes(key, mode, inversionCount) {
  const intervals = MODE_INTERVALS[mode] ?? MODE_INTERVALS.major;
  const notes = [
    noteFromKey(key, 3, 0),
    noteFromKey(key, 3, intervals[2]),
    noteFromKey(key, 3, intervals[4]),
  ];

  for (let i = 0; i < inversionCount; i += 1) {
    const note = notes.shift();
    notes.push(transposeNote(note, 12));
  }

  return notes;
}

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

function getPadVolumeDb(windSpeed) {
  if (windSpeed <= 0) {
    return -Infinity;
  }

  const hurricaneAmount = clamp(windSpeed / 74, 0, 1);

  return -18 - 18 * Math.pow(1 - hurricaneAmount, 3.45);
}

function getTemperatureRegisterIndex(temperature) {
  const temp = clamp(temperature, 0, 115);

  if (temp < 30) {
    return 0;
  }

  if (temp < 45) {
    return 1;
  }

  if (temp < 60) {
    return 2;
  }

  if (temp < 75) {
    return 3;
  }

  if (temp < 90) {
    return 4;
  }

  return 5;
}

function pickTemperatureRegister(notes, temperature) {
  const registerIndex = getTemperatureRegisterIndex(temperature);

  return notes.slice(registerIndex * 2, registerIndex * 2 + 4);
}

export function weatherToMusic(weather, selectedKey = "C", selectedMode = "major") {
  const temperature = weather.temperature_2m ?? 60;
  const windSpeed = weather.wind_speed_10m ?? 0;
  const cloudCover = weather.cloud_cover ?? 0;
  const rain = weather.rain ?? 0;
  const humidity = weather.relative_humidity_2m ?? 50;
  const weatherCode = weather.weather_code ?? 0;
  const pressure = weather.pressure_msl ?? 1013;

  const isRainy =
    rain > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode);

  const isStormy = [95, 96, 99].includes(weatherCode);
  const isSnowy = [71, 73, 75, 77, 85, 86].includes(weatherCode);
  const isFoggy = [45, 48].includes(weatherCode);
  const isClear = weatherCode === 0;

  const bpm = Math.min(150, Math.max(55, 65 + windSpeed * 3));

  let scaleName = "neutral";

  if (isStormy) {
    scaleName = "stormy";
  } else if (isSnowy) {
    scaleName = "snowy";
  } else if (isFoggy || cloudCover > 80) {
    scaleName = "cloudy";
  } else if (isClear && temperature > 70) {
    scaleName = "warm clear";
  } else if (temperature < 40) {
    scaleName = "cold";
  }

  const fullScale = buildModeScale(selectedKey, selectedMode, 3, 14);
  const scale = pickTemperatureRegister(fullScale, temperature);
  const bassNotes = buildBassNotes(selectedKey, selectedMode, isStormy);
  const padInversion = Math.floor(getTemperatureRegisterIndex(temperature) / 2);
  const padNotes = buildPadNotes(selectedKey, selectedMode, padInversion);

  const brightness = Math.max(2200, 6500 - cloudCover * 35);
  const humidityAmount = clamp(humidity / 100, 0, 1);

  const reverbWet = 0.08 + humidityAmount * 0.28;
  const chorusWet = 0.05 + humidityAmount * 0.18;
  const delayWet = 0.04 + humidityAmount * 0.16;
  const delayFeedback = 0.1 + humidityAmount * 0.14;
  const melodyRelease = 0.35 + humidityAmount * 1.05;
  const rainIntensity = Math.min(1, rain * 8);
  const stormIntensity = isStormy ? 1 : 0;
  const lowPressurePercussion = clamp((1013 - pressure) / 28, 0, 1);
  const highPressureDryness = clamp((pressure - 1013) / 22, 0, 1);
  const melodyArpLength = 3 + Math.round(lowPressurePercussion * 3);
  const melodySixteenthChance = humidityAmount * 0.5;
  const melodyOctaveChance = lowPressurePercussion * 0.45;
  const padVolumeDb = getPadVolumeDb(windSpeed);
  const padGain = windSpeed <= 0 ? 0 : dbToGain(padVolumeDb);
  const padFilterDepth = clamp(
    lowPressurePercussion * 1.2 - highPressureDryness * 0.25,
    0,
    1
  );
  const padFilterBaseFrequency = 2400 - lowPressurePercussion * 1700;
  const padFilterOctaves = 0.25 + lowPressurePercussion * 2.75;
  const padFilterFrequency = 0.08 + lowPressurePercussion * 0.7;
  const distortionWet = isRainy ? Math.min(0.35, 0.08 + rainIntensity * 0.27) : 0;

  return {
    temperature,
    windSpeed,
    cloudCover,
    rain,
    humidity,
    weatherCode,
    pressure,
    selectedKey,
    selectedMode,
    bpm,
    scaleName,
    fullScale,
    scale,
    bassNotes,
    padInversion,
    padNotes,
    padGain,
    padVolumeDb,
    padFilterDepth,
    padFilterBaseFrequency,
    padFilterOctaves,
    padFilterFrequency,
    brightness,
    reverbWet,
    humidityAmount,
    chorusWet,
    delayWet,
    delayFeedback,
    distortionWet,
    melodyRelease,
    rainIntensity,
    stormIntensity,
    lowPressurePercussion,
    highPressureDryness,
    melodyArpLength,
    melodySixteenthChance,
    melodyOctaveChance,
    isRainy,
    isStormy,
    isSnowy,
    isFoggy,
    isClear,
  };
}
