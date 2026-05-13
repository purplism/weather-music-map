function normalizeLongitude(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export async function getWeather(lat, lon, signal) {
  const fixedLon = normalizeLongitude(lon);

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}` +
    `&longitude=${fixedLon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover,wind_speed_10m` +
    `&temperature_unit=fahrenheit` +
    `&wind_speed_unit=mph` +
    `&precipitation_unit=inch`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    console.error("Weather request failed:", url);
    throw new Error("Could not get weather data");
  }

  const data = await response.json();
  return data.current;
}
