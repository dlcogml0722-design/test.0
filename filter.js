// ============================================
//  나만의 성지순례 - Filter Module
// ============================================

let selectedWorkId = null;
let selectedTags = [];
let searchQuery = '';

function initFilter() {
  renderWorkChips();
  renderTagChips();
  bindFilterEvents();
}

function renderWorkChips() {
  const container = document.getElementById('workChips');
  if (!container) return;

  // "All" chip
  let html = `<button class="work-chip active" data-work-id="" onclick="selectWork('')">
    <span>${t('allWorks')}</span>
  </button>`;

  WORKS.forEach(work => {
    const thumbHtml = work.thumbnail
      ? `<img class="work-chip__thumb" src="${work.thumbnail}" alt="">`
      : `<span class="work-chip__emoji" style="font-size:1rem;">${work.emoji}</span>`;
    html += `<button class="work-chip" data-work-id="${work.id}" onclick="selectWork('${work.id}')">
      ${thumbHtml}
      <span>${getLocalizedField(work.title)}</span>
    </button>`;
  });

  container.innerHTML = html;
}

function renderTagChips() {
  const container = document.getElementById('tagChips');
  if (!container) return;

  let html = '';
  ALL_TAGS.forEach(tag => {
    const tagEmojis = {
      nightView: '🌃', photospot: '📸', dramaSite: '🎬', restaurant: '🍽️',
      cafe: '☕', park: '🌳', landmark: '🏛️', culture: '🎭',
      street: '🛣️', building: '🏢'
    };
    html += `<button class="chip" data-tag="${tag}" onclick="toggleTag('${tag}')">
      <span class="chip__emoji">${tagEmojis[tag] || '🏷️'}</span>
      <span>${t(tag)}</span>
    </button>`;
  });

  container.innerHTML = html;
}

function selectWork(workId) {
  selectedWorkId = workId || null;

  // Update chip UI
  document.querySelectorAll('.work-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.workId === (workId || ''));
  });

  updateSpotList();
}

function toggleTag(tag) {
  const idx = selectedTags.indexOf(tag);
  if (idx > -1) {
    selectedTags.splice(idx, 1);
  } else {
    selectedTags.push(tag);
  }

  // Update chip UI
  document.querySelectorAll('.chip[data-tag]').forEach(chip => {
    chip.classList.toggle('active', selectedTags.includes(chip.dataset.tag));
  });

  updateSpotList();
}

function setSearchQuery(query) {
  searchQuery = query.toLowerCase().trim();
  updateSpotList();
}

function getFilteredSpots() {
  let spots = [...SPOTS];

  // Filter by work
  if (selectedWorkId) {
    spots = spots.filter(s => s.workId === selectedWorkId);
  }

  // Filter by search query
  if (searchQuery) {
    spots = spots.filter(s => {
      const work = WORKS.find(w => w.id === s.workId);
      const workTitle = work ? Object.values(work.title).join(' ').toLowerCase() : '';
      const spotName = Object.values(s.name).join(' ').toLowerCase();
      const addressStr = Object.values(s.address || {}).join(' ').toLowerCase();
      const descStr = Object.values(s.description || {}).join(' ').toLowerCase();
      const sceneStr = Object.values(s.scene || {}).join(' ').toLowerCase();
      return (
        workTitle.includes(searchQuery) ||
        spotName.includes(searchQuery) ||
        addressStr.includes(searchQuery) ||
        descStr.includes(searchQuery) ||
        sceneStr.includes(searchQuery)
      );
    });
  }

  // Filter by tags (OR logic)
  if (selectedTags.length > 0) {
    spots = spots.filter(s => selectedTags.some(tag => s.tags.includes(tag)));
  }

  // Filter by radius — ONLY when GPS is acquired AND radius is not at max AND no work selected
  const radius = getSearchRadius();
  if (gpsAcquired && radius < 50000 && userPosition && !selectedWorkId) {
    spots = spots.filter(s => {
      const dist = getDistance(userPosition.lat, userPosition.lng, s.lat, s.lng);
      return dist <= radius;
    });
  }
  // If GPS not acquired or radius is max, show ALL spots regardless of distance

  // Sort: tag match count → open status → distance
  spots.sort((a, b) => {
    // Tag match count (descending)
    if (selectedTags.length > 0) {
      const aMatches = selectedTags.filter(tag => a.tags.includes(tag)).length;
      const bMatches = selectedTags.filter(tag => b.tags.includes(tag)).length;
      if (bMatches !== aMatches) return bMatches - aMatches;
    }

    // Open status (open first)
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;

    // Distance (ascending)
    if (userPosition) {
      const aDist = getDistance(userPosition.lat, userPosition.lng, a.lat, a.lng);
      const bDist = getDistance(userPosition.lat, userPosition.lng, b.lat, b.lng);
      return aDist - bDist;
    }

    return 0;
  });

  return spots;
}

function bindFilterEvents() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setSearchQuery(e.target.value);
        const clearBtn = document.getElementById('searchClear');
        if (clearBtn) {
          clearBtn.classList.toggle('visible', e.target.value.length > 0);
        }
      }, 200);
    });
  }

  // Search clear
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const input = document.getElementById('searchInput');
      if (input) {
        input.value = '';
        setSearchQuery('');
        clearBtn.classList.remove('visible');
      }
    });
  }

  // Filter toggle
  const filterBtn = document.getElementById('filterToggleBtn');
  const filterPanel = document.getElementById('filterPanel');
  if (filterBtn && filterPanel) {
    filterBtn.addEventListener('click', () => {
      const isOpen = filterPanel.classList.toggle('open');
      filterBtn.classList.toggle('active', isOpen);
      document.getElementById('workChips')?.classList.toggle('filter-open', isOpen);
    });
  }

  // Radius slider
  const slider = document.getElementById('radiusSlider');
  const radiusValue = document.getElementById('radiusValue');
  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (radiusValue) {
        if (val >= 50000) {
          radiusValue.textContent = currentLang === 'en' ? 'All' : currentLang === 'ja' ? '全て' : '전체';
        } else {
          radiusValue.textContent = val >= 1000 ? `${(val / 1000).toFixed(1)}km` : `${val}m`;
        }
      }
      setSearchRadius(val);
      updateSpotList();
    });
  }
}
