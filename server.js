const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const HYD_LAT = 17.2403;
const HYD_LON = 78.4294;
const RADIUS_NM = 135; // ~250 km

// In-memory route cache — routes don't change mid-flight, 4-hour TTL
const routeCache = new Map();

async function lookupRoute(callsign) {
  const cs = (callsign || '').trim();
  if (!cs || cs === 'N/A') return { origin: null, destination: null };

  const hit = routeCache.get(cs);
  if (hit && Date.now() - hit.ts < 4 * 3600_000) return hit;

  try {
    const res = await fetch(
      `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`,
      { timeout: 4000 }
    );
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    const fr = data?.response?.flightroute;
    const entry = {
      origin:      fr?.origin?.iata_code      ?? null,
      destination: fr?.destination?.iata_code ?? null,
      ts: Date.now(),
    };
    routeCache.set(cs, entry);
    return entry;
  } catch {
    const entry = { origin: null, destination: null, ts: Date.now() };
    routeCache.set(cs, entry);
    return entry;
  }
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/flights', async (req, res) => {
  const url = `https://api.adsb.lol/v2/lat/${HYD_LAT}/lon/${HYD_LON}/dist/${RADIUS_NM}`;

  try {
    const response = await fetch(url, { timeout: 10000 });
    if (!response.ok) {
      return res.status(502).json({ error: 'ADS-B API error', status: response.status });
    }
    const data = await response.json();
    const ac = data.ac || [];

    // Resolve routes for all aircraft in parallel (cache absorbs repeat calls)
    const callsigns = ac.map(a => (a.flight || '').trim());
    const routes = await Promise.all(callsigns.map(cs => lookupRoute(cs)));

    const flights = ac
      .map((a, i) => {
        const { origin, destination } = routes[i];

        return {
          icao24:        a.hex,
          callsign:      callsigns[i] || 'N/A',
          registration:  a.r  || '—',
          aircraft_type: a.t  || '—',
          latitude:      a.lat,
          longitude:     a.lon,
          altitude_m:    a.alt_geom ? Math.round(a.alt_geom * 0.3048) : null,
          on_ground:     a.alt_baro === 'ground' || !!a.gnd,
          velocity_kmh:  a.gs ? Math.round(a.gs * 1.852) : null,
          true_track:    a.track,
          vertical_rate: a.baro_rate,
          squawk:        a.squawk,
          distance_km:   a.dst ? Math.round(a.dst * 1.852) : null,
          origin,
          destination,
        };
      })
      .filter(Boolean);

    res.json({ count: flights.length, flights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/weather', async (req, res) => {
  const metarUrl   = 'https://aviationweather.gov/api/data/metar?ids=VOHS&format=json';
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${HYD_LAT}&longitude=${HYD_LON}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,pressure_msl,apparent_temperature,visibility&wind_speed_unit=kmh&timezone=Asia/Kolkata`;

  try {
    const [metarRes, weatherRes] = await Promise.all([
      fetch(metarUrl,   { timeout: 8000 }),
      fetch(weatherUrl, { timeout: 8000 }),
    ]);

    const [metarData, weatherData] = await Promise.all([
      metarRes.ok   ? metarRes.json()   : null,
      weatherRes.ok ? weatherRes.json() : null,
    ]);

    const metar   = metarData?.[0]   ?? null;
    const current = weatherData?.current ?? null;

    res.json({
      airport: {
        name:      'Rajiv Gandhi International Airport',
        icao:      'VOHS',
        iata:      'HYD',
        elevation: 607,
        city:      'Hyderabad, Telangana, IN',
      },
      metar: metar ? {
        raw:        metar.rawOb,
        temp:       metar.temp,
        dewpoint:   metar.dewp,
        wind_dir:   metar.wdir,
        wind_kt:    metar.wspd,
        visibility: metar.visib,
        altimeter:  metar.altim,
        flight_cat: metar.fltCat,
        clouds:     metar.clouds,
        obs_time:   metar.reportTime,
      } : null,
      weather: current ? {
        temp:       current.temperature_2m,
        feels_like: current.apparent_temperature,
        humidity:   current.relative_humidity_2m,
        wind_kmh:   current.wind_speed_10m,
        wind_dir:   current.wind_direction_10m,
        pressure:   current.pressure_msl,
        visibility: current.visibility,
        code:       current.weather_code,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Hyderabad Flight Tracker running on http://localhost:${PORT}`);
});
