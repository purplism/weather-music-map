import {
  requestWeatherMusicChange,
  stopWeatherMusic,
  resetWeatherMusic,
  setWeatherMusicVolume,
  unlockWeatherMusicAudio,
} from "./music";
import { weatherToMusic } from "./weatherToMusic";
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Marker,
  AttributionControl,
} from "react-leaflet";
import L from "leaflet";
import { getClickedPlace } from "./location";
import { getWeather } from "./weather";
import "leaflet/dist/leaflet.css";
import "./App.css";

const RADAR_MAX_ZOOM = 7;
const RADAR_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MUSIC_KEYS = [
  "C",
  "C#",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];
const MUSIC_MODES = ["major", "minor"];

const selectedLocationIcon = L.divIcon({
  className: "selected-location-pin",
  html: "📍",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function normalizeLongitude(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function getRandomLocation() {
  const lat = -60 + Math.random() * 135; // -60 to 75
  const lon = -180 + Math.random() * 360;

  return { lat, lon };
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      const lat = e.latlng.lat;
      const lon = normalizeLongitude(e.latlng.lng);

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

  if (!radarUrl || zoom > RADAR_MAX_ZOOM) {
    return null;
  }

  return (
    <TileLayer
      key="radar-layer"
      attribution='Radar &copy; RainViewer'
      url={radarUrl}
      opacity={0.55}
      maxZoom={RADAR_MAX_ZOOM}
      maxNativeZoom={RADAR_MAX_ZOOM}
      zIndex={300}
    />
  );
}

function formatRadarTime(frame, isLatest) {
  if (!frame) {
    return "Unavailable";
  }

  const time = new Date(frame.time * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return isLatest ? `Latest (${time})` : time;
}

function App() {
  const [clickedLocation, setClickedLocation] = useState(null);
  const [clickedPlace, setClickedPlace] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [radarFrames, setRadarFrames] = useState([]);
  const [selectedRadarFrameIndex, setSelectedRadarFrameIndex] = useState(0);
  const [mapStyle, setMapStyle] = useState("default");
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [selectedKey, setSelectedKey] = useState("C");
  const [selectedMode, setSelectedMode] = useState("major");
  const [volume, setVolume] = useState(0.7);

  const latestRequestId = useRef(0);
  const weatherAbortController = useRef(null);
  const latestRadarPath = useRef("");
  const radarFrameCount = useRef(0);
  const selectedRadarFrameIndexRef = useRef(0);

  const selectedRadarFrame = radarFrames[selectedRadarFrameIndex];
  const selectedRadarTime = formatRadarTime(
    selectedRadarFrame,
    selectedRadarFrameIndex === radarFrames.length - 1
  );

  useEffect(() => {
    async function refreshRadar() {
      try {
        const response = await fetch(
          "https://api.rainviewer.com/public/weather-maps.json"
        );

        const data = await response.json();
        const frames = data.radar.past ?? [];
        const latestRadarFrame = frames[frames.length - 1];
        if (!latestRadarFrame || latestRadarFrame.path === latestRadarPath.current) {
          return;
        }

        const wasViewingLatest =
          radarFrameCount.current === 0 ||
          selectedRadarFrameIndexRef.current >= radarFrameCount.current - 1;
        const nextRadarFrames = frames.map((frame) => ({
          ...frame,
          url: `${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
        }));
        const nextFrameIndex = wasViewingLatest
          ? nextRadarFrames.length - 1
          : Math.min(
              selectedRadarFrameIndexRef.current,
              nextRadarFrames.length - 1
            );

        latestRadarPath.current = latestRadarFrame.path;
        radarFrameCount.current = nextRadarFrames.length;
        selectedRadarFrameIndexRef.current = nextFrameIndex;

        setRadarFrames(nextRadarFrames);
        setSelectedRadarFrameIndex(nextFrameIndex);
      } catch (error) {
        console.error("Could not load radar:", error);
      }
    }

    refreshRadar();
    const radarRefreshId = window.setInterval(
      refreshRadar,
      RADAR_REFRESH_INTERVAL_MS
    );

    return () => {
      window.clearInterval(radarRefreshId);
    };
  }, []);

  useEffect(() => {
    return () => {
      weatherAbortController.current?.abort();
    };
  }, []);

  async function handleMapClick(lat, lon) {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    weatherAbortController.current?.abort();
    const controller = new AbortController();
    weatherAbortController.current = controller;

    try {
      await unlockWeatherMusicAudio();
    } catch (error) {
      console.warn("Audio unlock failed:", error);
    }

    if (requestId !== latestRequestId.current) {
      return;
    }

    setClickedLocation({ lat, lon });
    setClickedPlace(null);
    setWeather(null);
    setWeatherError("");
    setLoadingWeather(true);

    getClickedPlace(lat, lon, controller.signal)
      .then((place) => {
        if (requestId === latestRequestId.current) {
          setClickedPlace(place);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      });

    try {
      const currentWeather = await getWeather(lat, lon, controller.signal);

      if (requestId !== latestRequestId.current) {
        return;
      }

      setWeather(currentWeather);

      const musicSettings = weatherToMusic(
        currentWeather,
        selectedKey,
        selectedMode
      );
      console.log("Music settings:", musicSettings);
      console.log("Weather:", currentWeather);

      // Since pause/play reset is working, do the same reset automatically
      // before starting the next location's music.
      resetWeatherMusic();

      await requestWeatherMusicChange(musicSettings);

      setIsMusicPlaying(true);
    } catch (error) {
      if (error.name === "AbortError" || requestId !== latestRequestId.current) {
        return;
      }

      console.error(error);
      setWeatherError("Could not load weather for this location.");
      setIsMusicPlaying(false);
    } finally {
      if (requestId === latestRequestId.current) {
        weatherAbortController.current = null;
        setLoadingWeather(false);
      }
    }
  }

  function handleMusicButtonClick() {
    if (isMusicPlaying) {
      latestRequestId.current += 1;
      weatherAbortController.current?.abort();
      weatherAbortController.current = null;

      stopWeatherMusic();

      setIsMusicPlaying(false);
      setLoadingWeather(false);
      setWeatherError("");
      setClickedPlace(null);

      return;
    }

    if (clickedLocation) {
      handleMapClick(clickedLocation.lat, clickedLocation.lon);
      return;
    }

    const randomLocation = getRandomLocation();
    handleMapClick(randomLocation.lat, randomLocation.lon);
  }

  function handleVolumeChange(e) {
    const newVolume = Number(e.target.value);

    setVolume(newVolume);
    setWeatherMusicVolume(newVolume);
  }

  function handleRadarFrameChange(e) {
    const nextFrameIndex = Number(e.target.value);

    selectedRadarFrameIndexRef.current = nextFrameIndex;
    setSelectedRadarFrameIndex(nextFrameIndex);
  }

  async function updateCurrentMusic(nextKey, nextMode) {
    if (!weather || !isMusicPlaying) {
      return;
    }

    const musicSettings = weatherToMusic(weather, nextKey, nextMode);

    try {
      await requestWeatherMusicChange(musicSettings);
    } catch (error) {
      console.error("Could not update music key or mode:", error);
    }
  }

  function handleKeyChange(e) {
    const newKey = e.target.value;

    setSelectedKey(newKey);
    updateCurrentMusic(newKey, selectedMode);
  }

  function handleModeChange(e) {
    const newMode = e.target.value;

    setSelectedMode(newMode);
    updateCurrentMusic(selectedKey, newMode);
  }

  const musicTitle = clickedPlace
    ? `🎵${clickedPlace.municipality}, ${clickedPlace.country}🎵`
    : "Music";

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

          {radarFrames.length > 0 && (
            <div className="volume-control">
              <label htmlFor="radar-time-slider">
                Radar: {selectedRadarTime}
              </label>

              <input
                id="radar-time-slider"
                type="range"
                min="0"
                max={radarFrames.length - 1}
                step="1"
                value={selectedRadarFrameIndex}
                onChange={handleRadarFrameChange}
                onInput={handleRadarFrameChange}
              />
            </div>
          )}
        </div>

        <div className="control-box">
          <h2>{musicTitle}</h2>

          <button
            className="music-toggle-button"
            onClick={handleMusicButtonClick}
          >
            {isMusicPlaying ? "❚❚" : "▶"}
          </button>

          <label className="select-control" htmlFor="music-key">
            Key
            <select id="music-key" value={selectedKey} onChange={handleKeyChange}>
              {MUSIC_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>

          <label className="select-control" htmlFor="music-mode">
            Mode
            <select
              id="music-mode"
              value={selectedMode}
              onChange={handleModeChange}
            >
              {MUSIC_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode[0].toUpperCase() + mode.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <div className="volume-control">
            <label htmlFor="volume-slider">
              Volume: {Math.round(volume * 100)}%
            </label>

            <input
              id="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
            />
          </div>
        </div>

        {!clickedLocation && <p>No location selected yet.</p>}

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
              <strong>Pressure:</strong> {weather.pressure_msl} hPa
            </p>
            <p>
              <strong>Rain:</strong> {weather.rain} in
            </p>
            <p>
              <strong>Local Time:</strong> {weather.localTime}
            </p>
            {clickedLocation && (
              <>
                <p>
                  <strong>Latitude:</strong> {clickedLocation.lat.toFixed(4)}
                </p>
                <p>
                  <strong>Longitude:</strong> {clickedLocation.lon.toFixed(4)}
                </p>
              </>
            )}
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
        attributionControl={false}
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

        <RadarLayer radarUrl={selectedRadarFrame?.url ?? ""} />

        {/* <TileLayer
          key="labels-layer"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          zIndex={400}
        /> */}

        {clickedLocation && (
          <Marker
            position={[clickedLocation.lat, clickedLocation.lon]}
            icon={selectedLocationIcon}
            interactive={false}
            zIndexOffset={1200}
          />
        )}

        <AttributionControl position="bottomright" prefix={false} />

        <ClickHandler onMapClick={handleMapClick} />
      </MapContainer>
    </div>
  );
}

export default App;
