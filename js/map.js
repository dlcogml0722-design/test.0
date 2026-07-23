// ============================================
//  나만의 성지순례 - Map Module (Leaflet.js)
// ============================================

let map = null;
let markers = [];
let userMarker = null;
let radiusCircle = null;
let routeLine = null; // Polyline for routing
let userPosition = null;
let gpsAcquired = false; // true only when real GPS was obtained
let isTracking = false;
let activeMarkerId = null;

// Default center: Seoul City Hall
const DEFAULT_CENTER = [37.5665, 126.9780];
const DEFAULT_ZOOM = 12;

function initMap() {
  // Set default position immediately so navigation always works
  userPosition = { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };

  map = L.map('map', {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: false,
    attributionControl: true
  });

  // Dark tile layer (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/copyright">OpenStreetMap</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Zoom control on right
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Try to get user location
  requestGPS();
}

function requestGPS() {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      gpsAcquired = true;
      updateUserMarker();
      updateRadiusCircle();
      map.setView([userPosition.lat, userPosition.lng], 13);
      isTracking = true;
      updateGPSButton();
      // Trigger spot list update
      if (typeof updateSpotList === 'function') updateSpotList();
    },
    (err) => {
      console.warn('GPS error:', err.message);
      // Keep default Seoul position (already set in initMap)
      gpsAcquired = false;
      if (typeof updateSpotList === 'function') updateSpotList();
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

function updateUserMarker() {
  if (!userPosition || !map || !gpsAcquired) return;

  if (userMarker) {
    userMarker.setLatLng([userPosition.lat, userPosition.lng]);
  } else {
    const userIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div class="user-marker"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    userMarker = L.marker([userPosition.lat, userPosition.lng], { icon: userIcon, zIndexOffset: 1000 });
    userMarker.addTo(map);
  }
}

function updateRadiusCircle() {
  if (!userPosition || !map || !gpsAcquired) return;
  const radius = getSearchRadius();
  if (radius >= 50000) {
    // Don't show circle at max radius
    if (radiusCircle) {
      map.removeLayer(radiusCircle);
      radiusCircle = null;
    }
    return;
  }

  if (radiusCircle) {
    radiusCircle.setLatLng([userPosition.lat, userPosition.lng]);
    radiusCircle.setRadius(radius);
  } else {
    radiusCircle = L.circle([userPosition.lat, userPosition.lng], {
      radius: radius,
      color: 'rgba(124, 45, 255, 0.3)',
      fillColor: 'rgba(124, 45, 255, 0.08)',
      fillOpacity: 1,
      weight: 1,
      dashArray: '5, 5'
    }).addTo(map);
  }
}

function getSearchRadius() {
  const slider = document.getElementById('radiusSlider');
  return slider ? parseInt(slider.value) : 50000;
}

function setSearchRadius(radius) {
  if (gpsAcquired) {
    updateRadiusCircle();
  }
}

function renderMarkers(spots) {
  // Clear existing markers
  markers.forEach(m => map.removeLayer(m.marker));
  markers = [];

  spots.forEach((spot, index) => {
    const work = WORKS.find(w => w.id === spot.workId);
    if (!work) return;

    // Use thumbnail image if available, otherwise emoji
    const hasThumb = work.thumbnail;
    const markerContent = hasThumb
      ? `<img src="${work.thumbnail}" alt="" style="width:100%;height:100%;object-fit:cover;">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;background:${work.color}20;">${work.emoji}</div>`;

    const markerHtml = `
      <div class="marker-inner" style="border-color: ${work.color}" data-spot-id="${spot.id}">
        ${markerContent}
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-marker',
      html: markerHtml,
      iconSize: [44, 52],
      iconAnchor: [22, 52],
      popupAnchor: [0, -52]
    });

    const marker = L.marker([spot.lat, spot.lng], { icon: icon });

    marker.on('click', () => {
      activeMarkerId = spot.id;
      highlightMarker(spot.id);
      drawRouteLine([userPosition.lat, userPosition.lng], [spot.lat, spot.lng]);
      if (typeof openSpotDetail === 'function') openSpotDetail(spot.id);
      map.setView([spot.lat, spot.lng], 15, { animate: true });
    });

    marker.addTo(map);
    markers.push({ marker, spotId: spot.id });
  });
}

function highlightMarker(spotId) {
  markers.forEach(m => {
    const inner = m.marker.getElement()?.querySelector('.marker-inner');
    if (inner) {
      inner.classList.toggle('active', m.spotId === spotId);
    }
  });
}

// Draw ACTUAL route line using OSRM API (falling back to straight line if error)
function drawRouteLine(startLatLng, endLatLng) {
  clearRouteLine();
  if (!map) return;

  // Show a loading/temporary straight line first
  routeLine = L.polyline([startLatLng, endLatLng], {
    color: '#ab6dff',
    weight: 4,
    opacity: 0.5,
    dashArray: '5, 10',
    lineJoin: 'round'
  }).addTo(map);

  // Auto fit bounds initially
  const initialBounds = L.latLngBounds([startLatLng, endLatLng]);
  map.fitBounds(initialBounds, { padding: [100, 100], maxZoom: 15 });

  // Fetch actual road routing coordinates from OSRM (driving/walking fallback)
  // Format: {lng},{lat};{lng},{lat}
  const url = `https://router.project-osrm.org/route/v1/driving/${startLatLng[1]},${startLatLng[0]};${endLatLng[1]},${endLatLng[0]}?overview=full&geometries=geojson`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        // Clear temp dashed line
        if (routeLine) {
          map.removeLayer(routeLine);
        }

        const coords = data.routes[0].geometry.coordinates;
        // OSRM returns [lng, lat], Leaflet wants [lat, lng]
        const latLngs = coords.map(c => [c[1], c[0]]);

        routeLine = L.polyline(latLngs, {
          color: '#ab6dff',
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round',
          className: 'active-route-line'
        }).addTo(map);

        // Fit bounds to actual complex path
        const pathBounds = L.latLngBounds(latLngs);
        map.fitBounds(pathBounds, { padding: [80, 80], maxZoom: 16 });
      }
    })
    .catch(err => {
      console.warn('OSRM routing failed, keeping straight dashed line:', err);
      // Fallback: make the temporary dashed line solid and brighter
      routeLine.setStyle({
        color: '#ab6dff',
        weight: 4,
        opacity: 0.8,
        dashArray: null
      });
    });
}

function clearRouteLine() {
  if (routeLine && map) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
}

function flyToSpot(lat, lng) {
  if (map) {
    map.flyTo([lat, lng], 16, { animate: true, duration: 0.8 });
  }
}

function flyToUser() {
  if (userPosition && map) {
    map.flyTo([userPosition.lat, userPosition.lng], 14, { animate: true, duration: 0.8 });
  }
}

function toggleGPSTracking() {
  if (isTracking) {
    flyToUser();
  } else {
    requestGPS();
  }
}

function updateGPSButton() {
  const btn = document.getElementById('gpsBtn');
  if (btn) {
    btn.classList.toggle('tracking', isTracking);
  }
}

// Haversine distance in meters
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
