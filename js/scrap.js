// ============================================
//  나만의 성지순례 - Scrap Module (localStorage)
// ============================================

const SCRAP_KEY = 'pilgrim_scraps';

function getScraps() {
  try {
    const data = localStorage.getItem(SCRAP_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveScraps(scraps) {
  localStorage.setItem(SCRAP_KEY, JSON.stringify(scraps));
  updateScrapBadge();
}

function isScraped(spotId) {
  return getScraps().includes(spotId);
}

function toggleScrap(spotId) {
  const scraps = getScraps();
  const idx = scraps.indexOf(spotId);

  if (idx > -1) {
    scraps.splice(idx, 1);
    showToast(t('toastScrapRemove'));
  } else {
    scraps.push(spotId);
    showToast(t('toastScrapAdd'));
  }

  saveScraps(scraps);
  updateSpotList();
  updateScrapUI(spotId);
  return scraps.includes(spotId);
}

function updateScrapBadge() {
  const badge = document.getElementById('scrapBadge');
  const count = getScraps().length;
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function updateScrapUI(spotId) {
  const scraped = isScraped(spotId);

  // Update card buttons
  document.querySelectorAll(`.spot-card__action-btn[data-scrap-id="${spotId}"]`).forEach(btn => {
    btn.classList.toggle('scrapped', scraped);
    btn.innerHTML = scraped ? '❤️' : '🤍';
  });

  // Update detail modal button
  const detailBtn = document.getElementById('detailScrapBtn');
  if (detailBtn && detailBtn.dataset.spotId === spotId) {
    detailBtn.classList.toggle('scrapped', scraped);
    detailBtn.innerHTML = scraped
      ? `❤️ <span>${t('scrapped')}</span>`
      : `🤍 <span>${t('scrap')}</span>`;
  }
}

function getScrapSpots() {
  const scraps = getScraps();
  return SPOTS.filter(s => scraps.includes(s.id));
}
