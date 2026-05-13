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

function buildPadNotes(key, mode) {
  const intervals = MODE_INTERVALS[mode] ?? MODE_INTERVALS.major;

  return [
    noteFromKey(key, 3, 0),
    noteFromKey(key, 3, intervals[2]),
    noteFromKey(key, 3, intervals[4]),
  ];
}

function pickTemperatureRegister(notes, temperature) {
  const temp = clamp(temperature, 0, 115);

  if (temp < 30) {
    // Very cold: lowest available register, but not sub-bass
    return notes.slice(0, 4);
  }

  if (temp < 45) {
    // Cold
    return notes.slice(2, 6);
  }

  if (temp < 60) {
    // Cool
    return notes.slice(4, 8);
  }

  if (temp < 75) {
    // Mild
    return notes.slice(6, 10);
  }

  if (temp < 90) {
    // Warm
    return notes.slice(8, 12);
  }

  // Very hot
  return notes.slice(10, 14);
}

export function weatherToMusic(weather, selectedKey = "C", selectedMode = "major") {
  const temperature = weather.temperature_2m ?? 60;
  const windSpeed = weather.wind_speed_10m ?? 0;
  const cloudCover = weather.cloud_cover ?? 0;
  const rain = weather.rain ?? 0;
  const humidity = weather.relative_humidity_2m ?? 50;
  const weatherCode = weather.weather_code ?? 0;

  const isRainy =
    rain > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode);

  const isStormy = [95, 96, 99].includes(weatherCode);
  const isSnowy = [71, 73, 75, 77, 85, 86].includes(weatherCode);
  const isFoggy = [45, 48].includes(weatherCode);
  const isClear = weatherCode === 0;

  const bpm = Math.min(150, Math.max(55, 65 + windSpeed * 3));

  let scaleName = "neutral";
  let startOctave = 3;

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
    startOctave = 2;
  }

  const fullScale = buildModeScale(selectedKey, selectedMode, startOctave, 14);
  const scale = pickTemperatureRegister(fullScale, temperature);
  const bassNotes = buildBassNotes(selectedKey, selectedMode, isStormy);
  const padNotes = buildPadNotes(selectedKey, selectedMode);

  const brightness = Math.max(500, 3500 - cloudCover * 28);
  const humidityAmount = clamp(humidity / 100, 0, 1);

const reverbWet = 0.12 + humidityAmount * 0.55;
const chorusWet = 0.08 + humidityAmount * 0.35;
const delayWet = 0.08 + humidityAmount * 0.3;
const delayFeedback = 0.12 + humidityAmount * 0.25;
  const rainIntensity = Math.min(1, rain * 8);
  const stormIntensity = isStormy ? 1 : 0;

  return {
    temperature,
    windSpeed,
    cloudCover,
    rain,
    humidity,
    weatherCode,
    selectedKey,
    selectedMode,
    bpm,
    scaleName,
    fullScale,
    scale,
    bassNotes,
    padNotes,
    brightness,
    reverbWet,
    humidityAmount,
    chorusWet,
    delayWet,
    delayFeedback,
    rainIntensity,
    stormIntensity,
    isRainy,
    isStormy,
    isSnowy,
    isFoggy,
    isClear,
  };
}
