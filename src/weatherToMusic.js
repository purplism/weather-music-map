export function weatherToMusic(weather) {
  const temperature = weather.temperature_2m ?? 60;
  const windSpeed = weather.wind_speed_10m ?? 0;
  const cloudCover = weather.cloud_cover ?? 0;
  const rain = weather.rain ?? 0;
  const humidity = weather.relative_humidity_2m ?? 50;
  const weatherCode = weather.weather_code ?? 0;

  const isRainy = rain > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode);
  const isStormy = [95, 96, 99].includes(weatherCode);
  const isSnowy = [71, 73, 75, 77, 85, 86].includes(weatherCode);
  const isFoggy = [45, 48].includes(weatherCode);
  const isClear = weatherCode === 0;

  const bpm = Math.min(150, Math.max(55, 65 + windSpeed * 3));

  let scaleName = "neutral";
  let scale = ["C3", "D3", "G3", "A3", "C4", "D4", "G4", "A4"];
  let bassNotes = ["C2", "G2", "A2", "G2"];

  if (isStormy) {
    scaleName = "stormy";
    scale = ["C3", "Eb3", "F#3", "G3", "Bb3", "C4", "Eb4", "F#4"];
    bassNotes = ["C2", "Bb1", "F#1", "G1"];
  } else if (isSnowy) {
    scaleName = "snowy";
    scale = ["D4", "E4", "F4", "A4", "C5", "D5", "E5", "F5"];
    bassNotes = ["D2", "A2", "F2", "A2"];
  } else if (isFoggy || cloudCover > 80) {
    scaleName = "cloudy";
    scale = ["C3", "Eb3", "G3", "Ab3", "Bb3", "C4", "Eb4", "G4"];
    bassNotes = ["C2", "Ab1", "Bb1", "G1"];
  } else if (isClear && temperature > 70) {
    scaleName = "warm clear";
    scale = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"];
    bassNotes = ["C2", "G2", "A2", "G2"];
  } else if (temperature < 40) {
    scaleName = "cold";
    scale = ["A3", "C4", "D4", "E4", "G4", "A4", "C5", "D5"];
    bassNotes = ["A1", "E2", "G2", "E2"];
  }

  const brightness = Math.max(500, 3500 - cloudCover * 28);
  const reverbWet = Math.min(0.75, 0.15 + humidity / 140);
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
    scale,
    bassNotes,
    brightness,
    reverbWet,
    rainIntensity,
    stormIntensity,
    isRainy,
    isStormy,
    isSnowy,
    isFoggy,
    isClear,
  };
}