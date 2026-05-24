const INSIGHT_WEATHER_URL =
  "https://api.nasa.gov/insight_weather/?api_key=DEMO_KEY&feedtype=json&ver=1.0";

const FALLBACK_MARS_WEATHER = {
  temperature_2m: -80,
  relative_humidity_2m: 0,
  cloud_cover: 18,
  wind_speed_10m: 11,
  pressure_msl: 7.4,
  rain: 0,
  weather_code: 0,
  localTime: "Latest available Mars profile",
  marsSol: "fallback",
  marsSeason: "unknown",
  marsWeatherSource: "Fallback profile",
  marsWeatherStatus: "NASA InSight weather data unavailable",
  marsLocationName: "Elysium Planitia",
  isMars: true,
};

const MARS_TIME_PROFILES = {
  dawn: {
    label: "Dawn",
    temperatureOffset: -18,
    windMultiplier: 0.85,
    cloudCover: 22,
  },
  midday: {
    label: "Midday",
    temperatureOffset: 20,
    windMultiplier: 1.2,
    cloudCover: 8,
  },
  dusk: {
    label: "Dusk",
    temperatureOffset: -6,
    windMultiplier: 1.05,
    cloudCover: 16,
  },
  midnight: {
    label: "Midnight",
    temperatureOffset: -34,
    windMultiplier: 0.65,
    cloudCover: 28,
  },
};

const MARS_SEASON_PROFILES = {
  spring: {
    label: "Spring",
    temperatureOffset: 4,
    pressureOffset: 0.05,
    windMultiplier: 1.05,
  },
  summer: {
    label: "Summer",
    temperatureOffset: 14,
    pressureOffset: 0.16,
    windMultiplier: 1.18,
  },
  fall: {
    label: "Fall",
    temperatureOffset: -4,
    pressureOffset: -0.03,
    windMultiplier: 1,
  },
  winter: {
    label: "Winter",
    temperatureOffset: -18,
    pressureOffset: -0.22,
    windMultiplier: 0.88,
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function celsiusToFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

function metersPerSecondToMph(metersPerSecond) {
  return metersPerSecond * 2.236936;
}

function pascalsToHectopascals(pascals) {
  return pascals / 100;
}

function getAverage(solData, key) {
  return typeof solData?.[key]?.av === "number" ? solData[key].av : null;
}

function getLatestUsableSol(data) {
  const solKeys = Array.isArray(data?.sol_keys) ? data.sol_keys : [];

  return [...solKeys].reverse().find((sol) => {
    const solData = data[sol];

    return getAverage(solData, "AT") !== null || getAverage(solData, "PRE") !== null;
  });
}

function convertInsightSolToWeather(data, sol) {
  const solData = data[sol];
  const temperatureC = getAverage(solData, "AT");
  const pressurePa = getAverage(solData, "PRE");
  const windMps = getAverage(solData, "HWS");
  const windDirection = solData?.WD?.most_common?.compass_point;
  const temperatureF =
    temperatureC === null ? FALLBACK_MARS_WEATHER.temperature_2m : celsiusToFahrenheit(temperatureC);
  const pressureHpa =
    pressurePa === null ? FALLBACK_MARS_WEATHER.pressure_msl : pascalsToHectopascals(pressurePa);
  const windMph =
    windMps === null ? FALLBACK_MARS_WEATHER.wind_speed_10m : metersPerSecondToMph(windMps);

  return {
    ...FALLBACK_MARS_WEATHER,
    temperature_2m: Number(temperatureF.toFixed(1)),
    wind_speed_10m: Number(windMph.toFixed(1)),
    pressure_msl: Number(pressureHpa.toFixed(2)),
    cloud_cover: 12,
    localTime: `Sol ${sol}`,
    marsSol: sol,
    marsSeason: solData?.Season ?? "unknown",
    marsNorthernSeason: solData?.Northern_season ?? "",
    marsSouthernSeason: solData?.Southern_season ?? "",
    marsWindDirection: windDirection ?? "unknown",
    marsFirstUtc: solData?.First_UTC ?? "",
    marsLastUtc: solData?.Last_UTC ?? "",
    marsWeatherSource: "NASA InSight",
    marsWeatherStatus:
      "Latest available InSight sol. InSight is no longer collecting live weather.",
  };
}

function applyMarsControls(weather, options = {}) {
  const season = options.season ?? "fall";
  const timeOfDay = options.timeOfDay ?? "midday";
  const latitude = options.latitude ?? 0;
  const seasonProfile = MARS_SEASON_PROFILES[season] ?? MARS_SEASON_PROFILES.fall;
  const timeProfile = MARS_TIME_PROFILES[timeOfDay] ?? MARS_TIME_PROFILES.midday;
  const polarCooling = Math.abs(latitude) * 0.32;
  const winterHemisphereCooling =
    season === "winter" && Math.abs(latitude) > 35 ? Math.abs(latitude) * 0.08 : 0;
  const summerHemisphereWarming =
    season === "summer" && Math.abs(latitude) > 35 ? Math.abs(latitude) * 0.05 : 0;
  const temperature =
    weather.temperature_2m +
    seasonProfile.temperatureOffset +
    timeProfile.temperatureOffset -
    polarCooling -
    winterHemisphereCooling +
    summerHemisphereWarming;
  const windSpeed =
    weather.wind_speed_10m *
    seasonProfile.windMultiplier *
    timeProfile.windMultiplier;
  const pressure =
    weather.pressure_msl +
    seasonProfile.pressureOffset -
    Math.abs(latitude) * 0.003;
  const cloudCover = clamp(
    timeProfile.cloudCover + (season === "winter" ? 8 : 0) + Math.abs(latitude) * 0.08,
    0,
    70
  );

  return {
    ...weather,
    temperature_2m: Number(temperature.toFixed(1)),
    wind_speed_10m: Number(windSpeed.toFixed(1)),
    pressure_msl: Number(Math.max(4.5, pressure).toFixed(2)),
    cloud_cover: Number(cloudCover.toFixed(0)),
    localTime: `${timeProfile.label}, ${seasonProfile.label}`,
    marsSelectedSeason: season,
    marsSelectedSeasonLabel: seasonProfile.label,
    marsSelectedTimeOfDay: timeOfDay,
    marsSelectedTimeOfDayLabel: timeProfile.label,
    marsWeatherStatus: `${weather.marsWeatherStatus}; adjusted by selected season, local time, and latitude.`,
  };
}

export async function getMarsWeather(signal, options = {}) {
  try {
    const response = await fetch(INSIGHT_WEATHER_URL, { signal });

    if (!response.ok) {
      throw new Error("Could not get Mars weather data");
    }

    const data = await response.json();
    const latestSol = getLatestUsableSol(data);

    if (!latestSol) {
      throw new Error("Mars weather response did not include usable sol data");
    }

    return applyMarsControls(convertInsightSolToWeather(data, latestSol), options);
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    console.warn("Using fallback Mars weather:", error);
    return applyMarsControls(FALLBACK_MARS_WEATHER, options);
  }
}
