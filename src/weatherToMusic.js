function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

export function weatherToMusic(weather) {
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

  let fullScale = [
    "C3",
    "D3",
    "G3",
    "A3",
    "C4",
    "D4",
    "G4",
    "A4",
    "C5",
    "D5",
    "G5",
    "A5",
    "C6",
    "D6",
  ];

  let bassNotes = ["C2", "G2", "A2", "G2"];

  if (isStormy) {
    scaleName = "stormy";
    fullScale = [
      "C3",
      "Eb3",
      "F#3",
      "G3",
      "Bb3",
      "C4",
      "Eb4",
      "F#4",
      "G4",
      "Bb4",
      "C5",
      "Eb5",
      "F#5",
      "G5",
    ];
    bassNotes = ["C2", "Bb1", "F#2", "G2"];
  } else if (isSnowy) {
    scaleName = "snowy";
    fullScale = [
      "D3",
      "E3",
      "F3",
      "A3",
      "C4",
      "D4",
      "E4",
      "F4",
      "A4",
      "C5",
      "D5",
      "E5",
      "F5",
      "A5",
    ];
    bassNotes = ["D2", "A2", "F2", "A2"];
  } else if (isFoggy || cloudCover > 80) {
    scaleName = "cloudy";
    fullScale = [
      "C3",
      "Eb3",
      "G3",
      "Ab3",
      "Bb3",
      "C4",
      "Eb4",
      "G4",
      "Ab4",
      "Bb4",
      "C5",
      "Eb5",
      "G5",
      "Ab5",
    ];
    bassNotes = ["C2", "Ab2", "Bb2", "G2"];
  } else if (isClear && temperature > 70) {
    scaleName = "warm clear";
    fullScale = [
      "C3",
      "D3",
      "E3",
      "G3",
      "A3",
      "C4",
      "D4",
      "E4",
      "G4",
      "A4",
      "C5",
      "D5",
      "E5",
      "G5",
    ];
    bassNotes = ["C2", "G2", "A2", "G2"];
  } else if (temperature < 40) {
    scaleName = "cold";
    fullScale = [
      "A2",
      "C3",
      "D3",
      "E3",
      "G3",
      "A3",
      "C4",
      "D4",
      "E4",
      "G4",
      "A4",
      "C5",
      "D5",
      "E5",
    ];
    bassNotes = ["A2", "E2", "G2", "E2"];
  }

  const scale = pickTemperatureRegister(fullScale, temperature);

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
    bpm,
    scaleName,
    fullScale,
    scale,
    bassNotes,
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