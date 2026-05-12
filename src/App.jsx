import { playWeatherMusic, stopWeatherMusic } from "./music";
import { weatherToMusic } from "./weatherToMusic";
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Marker,
} from "react-leaflet";
import L from "leaflet";
import { getWeather } from "./weather";
import "leaflet/dist/leaflet.css";
import "./App.css";

const palestineLabelIcon = L.divIcon({
  className: "palestine-label",
  html: "Palestine",
  iconSize: [90, 28],
  iconAnchor: [45, 14],
});

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      const lat = e.latlng.lat;
      const lon = ((((e.latlng.lng + 180) % 360) + 360) % 360) - 180;
      onMapClick(lat, lon);
    },
  });

  return null;
}

function RadarLayer({ radarUrl }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom());
    },
  });

  if (!radarUrl || zoom > 7) {
    return null;
  }

  return (
    <TileLayer
      key="radar-layer"
      attribution='Radar &copy; RainViewer'
      url={radarUrl}
      opacity={0.55}
      maxZoom={7}
      maxNativeZoom={7}
      zIndex={300}
    />
  );
}

function App() {
  const [clickedLocation, setClickedLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [radarUrl, setRadarUrl] = useState("");
  const [mapStyle, setMapStyle] = useState("default");
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  useEffect(() => {
    async function loadRadar() {
      try {
        const response = await fetch(
          "https://api.rainviewer.com/public/weather-maps.json"
        );

        const data = await response.json();
        const latestRadarFrame = data.radar.past[data.radar.past.length - 1];

        const url = `${data.host}${latestRadarFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;

        setRadarUrl(url);
      } catch (error) {
        console.error("Could not load radar:", error);
      }
    }

    loadRadar();
  }, []);

  async function handleMapClick(lat, lon) {
    setClickedLocation({ lat, lon });
    setWeather(null);
    setWeatherError("");
    setLoadingWeather(true);

    try {
      const currentWeather = await getWeather(lat, lon);
      setWeather(currentWeather);

      const musicSettings = weatherToMusic(currentWeather);
      console.log("Music settings:", musicSettings);
      console.log("Weather:", currentWeather);

      playWeatherMusic(musicSettings);
      setIsMusicPlaying(true);
    } catch (error) {
      console.error(error);
      setWeatherError("Could not load weather for this location.");
    } finally {
      setLoadingWeather(false);
    }
  }

  function handlePauseMusic() {
    stopWeatherMusic();
    setIsMusicPlaying(false);
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h1>Weather Music Map</h1>
        <p>Click anywhere on the map.</p>

        <div className="control-box">
          <h2>Map Style</h2>

          <button
            className={mapStyle === "default" ? "active-button" : ""}
            onClick={() => setMapStyle("default")}
          >
            Default
          </button>

          <button
            className={mapStyle === "satellite" ? "active-button" : ""}
            onClick={() => setMapStyle("satellite")}
          >
            Satellite
          </button>
        </div>

        <div className="control-box">
          <h2>Music</h2>

          <button onClick={handlePauseMusic} disabled={!isMusicPlaying}>
            Pause Music
          </button>
        </div>

        {clickedLocation ? (
          <div className="location-box">
            <p>
              <strong>Latitude:</strong> {clickedLocation.lat.toFixed(4)}
            </p>
            <p>
              <strong>Longitude:</strong> {clickedLocation.lon.toFixed(4)}
            </p>
          </div>
        ) : (
          <p>No location selected yet.</p>
        )}

        {loadingWeather && <p>Loading weather...</p>}

        {weatherError && <p>{weatherError}</p>}

        {weather && (
          <div className="weather-box">
            <h2>Current Weather</h2>
            <p>
              <strong>Temperature:</strong> {weather.temperature_2m} °F
            </p>
            <p>
              <strong>Humidity:</strong> {weather.relative_humidity_2m}%
            </p>
            <p>
              <strong>Cloud Cover:</strong> {weather.cloud_cover}%
            </p>
            <p>
              <strong>Wind Speed:</strong> {weather.wind_speed_10m} mph
            </p>
            <p>
              <strong>Rain:</strong> {weather.rain} in
            </p>
            <p>
              <strong>Weather Code:</strong> {weather.weather_code}
            </p>
          </div>
        )}
      </div>

      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        worldCopyJump={true}
        className="map"
      >
        {mapStyle === "default" && (
          <TileLayer
            key="default-map"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            zIndex={100}
          />
        )}

        {mapStyle === "satellite" && (
          <TileLayer
            key="satellite-map"
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            zIndex={100}
          />
        )}

        <RadarLayer radarUrl={radarUrl} />

        {/* <TileLayer
          key="labels-layer"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          zIndex={400}
        /> */}

        <Marker
          position={[31.8, 35.2]}
          icon={palestineLabelIcon}
          interactive={false}
          zIndexOffset={1000}
        />

        <ClickHandler onMapClick={handleMapClick} />
      </MapContainer>
    </div>
  );
}

export default App;