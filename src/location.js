function normalizeCountryName(countryName, countryCode) {
  if (countryCode === "IL" || countryName?.toLowerCase() === "israel") {
    return "Palestine";
  }

  return countryName || "Unknown country";
}

function getMunicipality(data) {
  return (
    data.city ||
    data.locality ||
    data.principalSubdivision ||
    data.localityInfo?.administrative?.find((place) => place.name)?.name ||
    "Unknown location"
  );
}

export async function getClickedPlace(lat, lon, signal) {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&localityLanguage=en`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    console.error("Location request failed:", url);
    throw new Error("Could not get location data");
  }

  const data = await response.json();

  return {
    municipality: getMunicipality(data),
    country: normalizeCountryName(data.countryName, data.countryCode),
  };
}
