// ============================================
//  나만의 성지순례 - Navigation Module (Google Maps Integrated)
// ============================================

let currentNavMode = 'walking'; // 'walking' | 'transit' | 'driving'

const SPEED = {
  walking: 4.5,   // km/h
  transit: 25.0,  // km/h
  driving: 40.0   // km/h
};

function estimateTravelTime(distanceMeters, mode = 'walking') {
  const distanceKm = distanceMeters / 1000;
  const speed = SPEED[mode] || SPEED.walking;
  const hours = distanceKm / speed;
  const minutes = Math.max(1, Math.round(hours * 60));

  if (minutes < 1) return { text: '1분', raw: 1 };
  if (minutes < 60) return { text: `${minutes}분`, raw: minutes };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return { text: `${h}시간`, raw: minutes };
  return { text: `${h}시간 ${m}분`, raw: minutes };
}

function formatTravelTime(distanceMeters, mode, lang) {
  const distanceKm = distanceMeters / 1000;
  const speed = SPEED[mode] || SPEED.walking;
  const hours = distanceKm / speed;
  const minutes = Math.max(1, Math.round(hours * 60));

  if (lang === 'en') {
    if (minutes < 1) return '1 min';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  if (lang === 'ja') {
    if (minutes < 1) return '1分';
    if (minutes < 60) return `${minutes}分`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}時間` : `${h}時間${m}分`;
  }

  return estimateTravelTime(distanceMeters, mode).text;
}

function getNavInfoHTML(spot) {
  const refPosition = userPosition || { lat: 37.5665, lng: 126.9780 };
  const dist = getDistance(refPosition.lat, refPosition.lng, spot.lat, spot.lng);

  const gpsLabel = gpsAcquired ? '' : (
    currentLang === 'en' ? ' (from Seoul)' :
      currentLang === 'ja' ? '（ソウルから）' :
        ' (서울 기준)'
  );

  const modes = [
    { key: 'walking', icon: '🚶', label: t('walking') },
    { key: 'transit', icon: '🚌', label: t('transit') },
    { key: 'driving', icon: '🚗', label: t('driving') }
  ];

  let html = `<div style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); margin-bottom: var(--space-3);">`;
  html += modes.map(mode => {
    const time = formatTravelTime(dist, mode.key, currentLang);
    const isSelected = mode.key === currentNavMode;
    return `<div class="nav-info__item ${isSelected ? 'selected' : ''}" data-mode="${mode.key}" onclick="selectNavigationMode('${mode.key}', ${spot.lat}, ${spot.lng}, '${encodeURIComponent(getLocalizedField(spot.name))}')">
      <span class="nav-info__icon">${mode.icon}</span>
      <span class="nav-info__mode">${mode.label}</span>
      <span class="nav-info__time">${t('estimatedTime', { t: time })}</span>
      <span class="nav-info__dist">${formatDistance(dist)}${gpsLabel}</span>
    </div>`;
  }).join('');
  html += `</div>`;

  const googleModeMap = { walking: 'walking', transit: 'transit', driving: 'driving' };
  const googleMode = googleModeMap[currentNavMode] || 'walking';
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${refPosition.lat},${refPosition.lng}&destination=${spot.lat},${spot.lng}&travelmode=${googleMode}`;

  const transitText = getLocalizedField(spot.transitRoute);
  const transitTitle = currentLang === 'en' ? 'Google Maps Navigation' : currentLang === 'ja' ? 'Googleマップナビ' : '구글 지도 기반 길안내';

  html += `
    <div style="grid-column: 1 / -1; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: var(--space-3); margin-top: var(--space-2); animation: fadeIn 0.3s ease-out;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
        <div style="display:flex; align-items:center; gap: 6px; font-size:var(--text-xs); font-weight:var(--weight-bold); color:var(--primary-300);">
          <span>🌐</span>
          <span>${transitTitle}</span>
        </div>
        <span style="font-size:10px; padding:2px 6px; background:rgba(66, 133, 244, 0.2); border-radius:4px; color:#4285f4; font-weight:bold;">
          ${modes.find(m => m.key === currentNavMode)?.icon} ${modes.find(m => m.key === currentNavMode)?.label} 선택됨
        </span>
      </div>
      ${transitText ? `<div style="font-size:var(--text-sm); color:var(--text-secondary); line-height:1.5; word-break:keep-all; margin-bottom:10px;">${transitText}</div>` : ''}
      <a id="googleNavBtn" href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display:flex; align-items:center; justify-content:center; gap:6px; width:100%; padding: 10px; font-size:var(--text-xs); background:linear-gradient(135deg, #4285f4, #34a853); border:none; border-radius:var(--radius-sm); color:#ffffff; font-weight:var(--weight-bold); text-decoration:none; box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3); transition: transform 0.2s;">
        🌐 ${t('googleMaps')} ${t('navigate')} ↗
      </a>
    </div>
  `;

  return html;
}

function selectNavigationMode(mode, spotLat, spotLng, encodedSpotName) {
  currentNavMode = mode;

  // Update selected UI
  document.querySelectorAll('.nav-info__item').forEach(item => {
    item.classList.toggle('selected', item.dataset.mode === mode);
  });

  // Update Google Maps button link
  const refPosition = userPosition || { lat: 37.5665, lng: 126.9780 };
  const googleBtn = document.getElementById('googleNavBtn');
  if (googleBtn) {
    const googleModeMap = { walking: 'walking', transit: 'transit', driving: 'driving' };
    const googleMode = googleModeMap[mode] || 'walking';
    googleBtn.href = `https://www.google.com/maps/dir/?api=1&origin=${refPosition.lat},${refPosition.lng}&destination=${spotLat},${spotLng}&travelmode=${googleMode}`;
  }

  // Draw or highlight route on map
  drawRouteLine([refPosition.lat, refPosition.lng], [spotLat, spotLng]);
}

function getDistanceFromUser(lat, lng) {
  const refPosition = userPosition || { lat: 37.5665, lng: 126.9780 };
  return getDistance(refPosition.lat, refPosition.lng, lat, lng);
}
