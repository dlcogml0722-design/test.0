// ============================================
//  나만의 성지순례 - App Main Controller
// ============================================

let currentView = 'map'; // 'map' | 'list' | 'scrap'
let bottomSheetState = 'peek'; // 'peek' | 'expanded' | 'collapsed'
let customSpots = []; // Stores user-added spots

// ── Initialize App ──
function initApp() {
  initI18n();
  initCustomSpots();
  initMap();
  initFilter();
  updateScrapBadge();
  bindAppEvents();
  initCustomSpotModal();

  updateSpotList();
  setTimeout(() => {
    updateSpotList();
  }, 200);
  setTimeout(() => {
    updateSpotList();
  }, 600);
}

// ── Bind Events ──
function bindAppEvents() {
  // Language switcher
  document.querySelectorAll('.lang-switcher__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      renderWorkChips();
      renderTagChips();
      updateSpotList();
    });
  });

  // Bottom nav (item listeners + container delegation for 100% fail-safe click response)
  const bottomNavContainer = document.getElementById('bottomNav');
  if (bottomNavContainer) {
    bottomNavContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.bottom-nav__item');
      if (item && item.dataset.view) {
        switchView(item.dataset.view);
      }
    });
  }

  document.querySelectorAll('.bottom-nav__item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      switchView(item.dataset.view);
    });
  });

  // GPS button
  const gpsBtn = document.getElementById('gpsBtn');
  if (gpsBtn) {
    gpsBtn.addEventListener('click', toggleGPSTracking);
  }

  // Bottom sheet click & header expansion
  const handle = document.querySelector('.bottom-sheet__handle');
  const header = document.querySelector('.bottom-sheet__header');
  const sheet = document.getElementById('bottomSheet');

  if (handle) handle.addEventListener('click', toggleBottomSheet);
  if (header) header.addEventListener('click', toggleBottomSheet);

  // Swipe gestures ONLY on handle & header area to prevent interfering with spotList scrolling
  let touchStartY = 0;
  const touchArea = handle || header;
  if (touchArea) {
    touchArea.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    touchArea.addEventListener('touchend', (e) => {
      const touchEndY = e.changedTouches[0].clientY;
      const diffY = touchStartY - touchEndY;
      if (diffY > 30 && bottomSheetState !== 'expanded') {
        sheet?.classList.add('expanded');
        sheet?.classList.remove('collapsed');
        bottomSheetState = 'expanded';
      } else if (diffY < -30 && bottomSheetState === 'expanded') {
        sheet?.classList.remove('expanded');
        sheet?.classList.remove('collapsed');
        bottomSheetState = 'peek';
      }
    }, { passive: true });
  }

  // Auto expand bottom sheet when user begins scrolling the spot list
  const spotListContainer = document.getElementById('spotList');
  if (spotListContainer) {
    spotListContainer.addEventListener('scroll', () => {
      if (spotListContainer.scrollTop > 5 && bottomSheetState !== 'expanded') {
        sheet?.classList.add('expanded');
        sheet?.classList.remove('collapsed');
        bottomSheetState = 'expanded';
      }
    }, { passive: true });
  }

  // Close detail on overlay click or close button click
  document.addEventListener('click', (e) => {
    if (
      e.target.classList.contains('spot-detail__overlay') || 
      e.target.classList.contains('spot-detail__close') || 
      e.target.closest('.spot-detail__close')
    ) {
      closeSpotDetail();
    }
  });
}

// ── View Switching ──
function switchView(view) {
  currentView = view;

  // Update bottom nav active state
  document.querySelectorAll('.bottom-nav__item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  // Update content
  updateSpotList();

  // Update bottom sheet title
  const title = document.getElementById('bottomSheetTitle');
  if (title) {
    if (view === 'scrap') {
      title.textContent = t('tabScrap');
    } else {
      title.textContent = t('spotListTitle');
    }
  }

  // Expand bottom sheet for list/scrap view
  const bottomSheet = document.getElementById('bottomSheet');
  if (view === 'list' || view === 'scrap') {
    bottomSheet?.classList.add('expanded');
    bottomSheet?.classList.remove('collapsed');
    bottomSheetState = 'expanded';
    const spotListContainer = document.getElementById('spotList');
    if (spotListContainer) spotListContainer.scrollTop = 0;
  } else {
    bottomSheet?.classList.remove('expanded');
    bottomSheet?.classList.remove('collapsed');
    bottomSheetState = 'peek';
  }
}
window.switchView = switchView;

// ── Toggle Bottom Sheet ──
function toggleBottomSheet() {
  const sheet = document.getElementById('bottomSheet');
  if (!sheet) return;

  if (bottomSheetState === 'expanded') {
    sheet.classList.remove('expanded');
    sheet.classList.remove('collapsed');
    bottomSheetState = 'peek';
  } else if (bottomSheetState === 'peek') {
    sheet.classList.add('expanded');
    sheet.classList.remove('collapsed');
    bottomSheetState = 'expanded';
  } else {
    sheet.classList.remove('collapsed');
    sheet.classList.remove('expanded');
    bottomSheetState = 'peek';
  }
}

// ── Update Spot List ──
function updateSpotList() {
  let spots;

  if (currentView === 'scrap') {
    spots = getScrapSpots();
  } else {
    spots = getFilteredSpots();
  }

  // Update markers on map
  renderMarkers(spots);

  // Render cards
  const container = document.getElementById('spotList');
  if (!container) return;

  // Update count
  const countEl = document.getElementById('spotCount');
  if (countEl) {
    countEl.textContent = t('spotCount', { n: spots.length });
  }

  if (spots.length === 0) {
    const isScrap = currentView === 'scrap';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">${isScrap ? '💝' : '🗺️'}</div>
        <div class="empty-state__title">${t(isScrap ? 'emptyScrapTitle' : 'emptyTitle')}</div>
        <div class="empty-state__desc">${t(isScrap ? 'emptyScrapDesc' : 'emptyDesc')}</div>
      </div>`;
    return;
  }

  container.innerHTML = spots.map((spot, i) => {
    const work = WORKS.find(w => w.id === spot.workId);
    const dist = getDistanceFromUser(spot.lat, spot.lng);
    const distStr = formatDistance(dist);
    const scraped = isScraped(spot.id);
    const walkTime = formatTravelTime(dist, 'walking', currentLang);
    const transitTime = formatTravelTime(dist, 'transit', currentLang);

    // Image for card (using spot image, work thumbnail, or placeholder)
    const imgSrc = spot.image || work?.thumbnail || '';
    const cardImage = imgSrc
      ? `<img class="spot-card__image" src="${imgSrc}" alt="" onerror="this.outerHTML='<div class=\\'spot-card__image\\' style=\\'display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:${work?.color || '#333'}15;\\'>${work?.emoji || '📍'}</div>'">`
      : `<div class="spot-card__image" style="display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:${work?.color || '#333'}15;">${work?.emoji || '📍'}</div>`;

    return `
      <div class="spot-card" data-spot-id="${spot.id}" onclick="openSpotDetail('${spot.id}')" style="animation-delay:${i * 60}ms">
        ${cardImage}
        <div class="spot-card__info">
          <div class="spot-card__work">${work ? getLocalizedField(work.title) : ''}</div>
          <div class="spot-card__name">${getLocalizedField(spot.name)}</div>
          <div class="spot-card__scene">${getLocalizedField(spot.scene)}</div>
          <div class="spot-card__meta">
            <span class="spot-card__distance">📍 ${distStr}</span>
            <span class="spot-card__hours ${spot.isOpen ? 'spot-card__open' : 'spot-card__closed'}">
              🕐 ${spot.isOpen ? t('openNow') : t('closed')}
            </span>
          </div>
          <div class="spot-card__meta" style="margin-top:2px;">
            <span class="spot-card__distance">🚶 ${walkTime}</span>
            <span class="spot-card__distance">🚌 ${transitTime}</span>
          </div>
        </div>
        <div class="spot-card__actions" onclick="event.stopPropagation()">
          <button class="spot-card__action-btn ${scraped ? 'scrapped' : ''}" data-scrap-id="${spot.id}" onclick="toggleScrap('${spot.id}')">
            ${scraped ? '❤️' : '🤍'}
          </button>
          <button class="spot-card__action-btn nav-btn" onclick="flyToSpotFromCard('${spot.id}')" title="${t('navigate')}">
            🧭
          </button>
        </div>
      </div>`;
  }).join('');
}

function flyToSpotFromCard(spotId) {
  const spot = SPOTS.find(s => s.id === spotId);
  if (spot) {
    flyToSpot(spot.lat, spot.lng);
    highlightMarker(spotId);

    // Draw route line on map when clicking navigation button
    const refPosition = userPosition || { lat: 37.5665, lng: 126.9780 };
    drawRouteLine([refPosition.lat, refPosition.lng], [spot.lat, spot.lng]);

    switchView('map');
  }
}

// ── Spot Detail Modal ──
function openSpotDetail(spotId) {
  const spot = SPOTS.find(s => s.id === spotId);
  if (!spot) return;

  const work = WORKS.find(w => w.id === spot.workId);
  const scraped = isScraped(spotId);
  const dist = getDistanceFromUser(spot.lat, spot.lng);
  const distStr = formatDistance(dist);

  const modal = document.getElementById('spotDetail');
  if (!modal) return;

  // Image in detail (using spot image or work thumbnail)
  const imgSrc = spot.image || work?.thumbnail || '';
  const imageEl = modal.querySelector('.spot-detail__image');
  if (imgSrc) {
    imageEl.innerHTML = `<img src="${imgSrc}" alt="" style="width:100%;height:100%;object-fit:contain;background:#0d0d1a;" onerror="this.remove();this.parentElement.style.cssText='display:flex;align-items:center;justify-content:center;font-size:5rem;background:${work?.color || '#333'}20;';this.parentElement.textContent='${work?.emoji || '📍'}';">`;
    imageEl.style.cssText = '';
  } else {
    imageEl.innerHTML = '';
    imageEl.style.cssText = `display:flex;align-items:center;justify-content:center;font-size:5rem;background:${work?.color || '#333'}20;`;
    imageEl.textContent = work?.emoji || '📍';
  }

  modal.querySelector('.spot-detail__work-tag').textContent = work ? getLocalizedField(work.title) : '';
  modal.querySelector('.spot-detail__name').textContent = getLocalizedField(spot.name);
  modal.querySelector('.spot-detail__scene').textContent = getLocalizedField(spot.scene);
  modal.querySelector('.spot-detail__description-text').textContent = getLocalizedField(spot.description);

  // Info grid
  modal.querySelector('.spot-detail__distance-value').textContent = distStr;
  modal.querySelector('.spot-detail__hours-value').textContent = getLocalizedField(spot.openHours);

  // Address
  modal.querySelector('.spot-detail__address-text').textContent = getLocalizedField(spot.address);

  // Tags
  const tagsContainer = modal.querySelector('.spot-detail__tags');
  tagsContainer.innerHTML = spot.tags.map(tag =>
    `<span class="spot-detail__tag">${t(tag)}</span>`
  ).join('');

  // Nav info
  const navContainer = modal.querySelector('.nav-info');
  navContainer.innerHTML = getNavInfoHTML(spot);

  // Auto draw route on map when detail opens
  const refPosition = userPosition || { lat: 37.5665, lng: 126.9780 };
  drawRouteLine([refPosition.lat, refPosition.lng], [spot.lat, spot.lng]);

  // Scrap button
  const scrapBtn = document.getElementById('detailScrapBtn');
  if (scrapBtn) {
    scrapBtn.dataset.spotId = spotId;
    scrapBtn.className = `detail-btn detail-btn--secondary ${scraped ? 'scrapped' : ''}`;
    scrapBtn.innerHTML = scraped
      ? `❤️ <span>${t('scrapped')}</span>`
      : `🤍 <span>${t('scrap')}</span>`;
    scrapBtn.onclick = () => toggleScrap(spotId);
  }

  // Share button
  const shareBtn = document.getElementById('detailShareBtn');
  if (shareBtn) {
    shareBtn.onclick = () => shareSpot(spotId);
  }

  // Navigate button
  const navBtn = document.getElementById('detailNavBtn');
  if (navBtn) {
    navBtn.onclick = () => {
      flyToSpot(spot.lat, spot.lng);
      highlightMarker(spotId);
      closeSpotDetail();
    };
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
}

function closeSpotDetail() {
  const modal = document.getElementById('spotDetail');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
    clearRouteLine(); // Clear polyline when detail closed
  }
}

window.openSpotDetail = openSpotDetail;
window.closeSpotDetail = closeSpotDetail;

// Global ESC key listener to close modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSpotDetail();
    const customModal = document.getElementById('customSpotModal');
    if (customModal) customModal.classList.remove('active');
  }
});

// ── Share Spot Function ──
function shareSpot(spotId) {
  const spot = SPOTS.find(s => s.id === spotId);
  if (!spot) return;

  const work = WORKS.find(w => w.id === spot.workId);
  const spotName = getLocalizedField(spot.name);
  const workTitle = work ? getLocalizedField(work.title) : '';
  const googleUrl = `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`;
  const textToCopy = `[나만의 성지순례] ${workTitle} - ${spotName}\n📍 ${getLocalizedField(spot.address)}\n🔗 ${googleUrl}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast(t('toastShareCopied'));
    }).catch(() => {
      showToast(t('toastShareCopied'));
    });
  } else {
    showToast(t('toastShareCopied'));
  }
}

// ── Custom Spot Registration & AI Location Resolution ──

const LOCATION_PRESETS = [
  { keywords: ['홍대', '마포', '연남', '상수', '신촌'], lat: 37.5563, lng: 126.9226 },
  { keywords: ['성수', '뚝섬', '서울숲', '성동구'], lat: 37.5445, lng: 127.0560 },
  { keywords: ['강남', '신논현', '역삼', '삼성'], lat: 37.4979, lng: 127.0276 },
  { keywords: ['이태원', '해방촌', '녹사평', '용산'], lat: 37.5345, lng: 126.9940 },
  { keywords: ['명동', '남산', '을지로', '중구'], lat: 37.5610, lng: 126.9860 },
  { keywords: ['종로', '안국', '북촌', '삼청동', '인사동'], lat: 37.5790, lng: 126.9840 },
  { keywords: ['여의도', '한강', '영등포'], lat: 37.5280, lng: 126.9240 },
  { keywords: ['잠실', '송파', '석촌'], lat: 37.5130, lng: 127.1025 },
  { keywords: ['부산', '해운대', '광안리', '초량', '수영'], lat: 35.1588, lng: 129.1604 },
  { keywords: ['김천', '경북'], lat: 36.1265, lng: 128.0838 }
];

function resolveCoordinates(addressText) {
  const text = (addressText || '').toLowerCase();
  for (const preset of LOCATION_PRESETS) {
    if (preset.keywords.some(kw => text.includes(kw))) {
      const latOffset = (Math.random() - 0.5) * 0.003;
      const lngOffset = (Math.random() - 0.5) * 0.003;
      return { lat: preset.lat + latOffset, lng: preset.lng + lngOffset };
    }
  }

  // Fallback around current user center or Seoul
  const baseLat = userPosition ? userPosition.lat : 37.5665;
  const baseLng = userPosition ? userPosition.lng : 126.9780;
  return {
    lat: baseLat + (Math.random() - 0.5) * 0.012,
    lng: baseLng + (Math.random() - 0.5) * 0.012
  };
}

function initCustomSpots() {
  try {
    const saved = localStorage.getItem('pilgrim_custom_spots');
    if (saved) {
      customSpots = JSON.parse(saved);
      customSpots.forEach(spot => {
        if (!SPOTS.some(s => s.id === spot.id)) {
          SPOTS.push(spot);

          // Add dynamic work if not existing
          if (!WORKS.some(w => w.id === spot.workId)) {
            const workTitleStr = getLocalizedField(spot.workTitle) || '사용자 제보 작품';
            WORKS.push({
              id: spot.workId,
              title: { ko: workTitleStr, en: workTitleStr, ja: workTitleStr },
              platform: 'webtoon',
              genre: 'drama',
              thumbnail: spot.image || 'assets/images/garbage_time.png',
              color: '#ab6dff',
              emoji: '📍',
              tags: ['photospot']
            });
          }
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load custom spots:', e);
  }
}

function initCustomSpotModal() {
  const modal = document.getElementById('customSpotModal');
  const openBtn = document.getElementById('openAddSpotBtn');
  const closeBtn = document.getElementById('closeAddSpotBtn');
  const overlay = document.getElementById('closeAddSpotOverlay');
  const form = document.getElementById('customSpotForm');

  if (!modal) return;

  const openModal = () => modal.classList.add('active');
  const closeModal = () => modal.classList.remove('active');

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const workTitle = document.getElementById('spotWorkTitle').value.trim();
      const spotName = document.getElementById('spotNameInput').value.trim();
      const address = document.getElementById('spotAddressInput').value.trim();
      const desc = document.getElementById('spotDescInput').value.trim();

      if (!workTitle || !spotName || !address) return;

      // Find matching work or create new work ID
      let matchedWork = WORKS.find(w =>
        getLocalizedField(w.title).toLowerCase().includes(workTitle.toLowerCase()) ||
        workTitle.toLowerCase().includes(getLocalizedField(w.title).toLowerCase())
      );

      let workId;
      if (matchedWork) {
        workId = matchedWork.id;
      } else {
        workId = 'work-custom-' + Date.now();
        matchedWork = {
          id: workId,
          title: { ko: workTitle, en: workTitle, ja: workTitle },
          platform: 'webtoon',
          genre: 'drama',
          thumbnail: 'assets/images/garbage_time.png',
          color: '#7c2dff',
          emoji: '📍',
          tags: ['photospot']
        };
        WORKS.push(matchedWork);
      }

      const coords = resolveCoordinates(address);
      const newSpotId = 'spot-custom-' + Date.now();

      const newSpot = {
        id: newSpotId,
        workId: workId,
        workTitle: { ko: workTitle, en: workTitle, ja: workTitle },
        name: { ko: spotName, en: spotName, ja: spotName },
        description: { ko: desc, en: desc, ja: desc },
        scene: { ko: desc, en: desc, ja: desc },
        lat: coords.lat,
        lng: coords.lng,
        address: { ko: address, en: address, ja: address },
        tags: ['photospot', 'landmark'],
        openHours: { ko: '24시간', en: '24 Hours', ja: '24時間' },
        isOpen: true,
        image: matchedWork.thumbnail || 'assets/images/garbage_time.png',
        transitRoute: {
          ko: `${address} 인근 위치`,
          en: `Near ${address}`,
          ja: `${address} 付近`
        }
      };

      SPOTS.push(newSpot);
      customSpots.push(newSpot);

      try {
        localStorage.setItem('pilgrim_custom_spots', JSON.stringify(customSpots));
        fetch('/api/spots/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSpot)
        }).catch(() => { });
      } catch (err) {
        console.warn('Failed to save to localStorage:', err);
      }

      // Reset form & close modal
      form.reset();
      closeModal();

      // Show toast
      showToast(t('toastSpotAdded'));

      // Update UI & Map
      renderWorkChips();
      renderTagChips();
      updateSpotList();

      // Focus on the newly added spot
      flyToSpot(newSpot.lat, newSpot.lng);
      highlightMarker(newSpotId);
      setTimeout(() => openSpotDetail(newSpotId), 400);
    });
  }
}

// ── Toast ──
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('show');

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// ── Start ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
