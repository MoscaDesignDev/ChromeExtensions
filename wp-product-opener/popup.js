const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const countBadge = document.getElementById('countBadge');
const scanBtn    = document.getElementById('scanBtn');
const adminBtn   = document.getElementById('adminBtn');
const storeBtn   = document.getElementById('storeBtn');

// Holds the URLs found after scanning
let foundAdminUrls = [];
let foundStoreUrls = [];

// Script injected into the active tab to scrape checked product URLs
const SCAN_SCRIPT = function () {
  const checkboxes = document.querySelectorAll(
    '.wp-list-table #the-list tr .check-column input[type="checkbox"]'
  );

  const adminUrls = [];
  const storeUrls = [];

  checkboxes.forEach(checkbox => {
    if (!checkbox.checked) return;

    const row = checkbox.closest('tr');
    if (!row) return;

    const editLink  = row.querySelector('.column-name .row-actions .edit a');
    const viewLink  = row.querySelector('.column-name .row-actions .view a');

    if (editLink && editLink.href)  adminUrls.push(editLink.href);
    if (viewLink && viewLink.href)  storeUrls.push(viewLink.href);
  });

  return { adminUrls, storeUrls, total: checkboxes.length };
};

function setStatus(state, text) {
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = text;
}

function setButtonsEnabled(enabled) {
  adminBtn.disabled = !enabled;
  storeBtn.disabled = !enabled;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// --- SCAN ---
scanBtn.addEventListener('click', async () => {
  foundAdminUrls = [];
  foundStoreUrls = [];
  setButtonsEnabled(false);
  countBadge.style.display = 'none';
  setStatus('', 'Scanning page…');

  const tab = await getActiveTab();

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: SCAN_SCRIPT
    });
  } catch (err) {
    setStatus('error', 'Cannot scan this page. Must be on WP Admin products list.');
    return;
  }

  const data = results && results[0] && results[0].result;

  if (!data) {
    setStatus('error', 'No data returned — are you on the WP Admin products page?');
    return;
  }

  if (data.adminUrls.length === 0) {
    setStatus('none', `No checked products found (${data.total} products visible)`);
    countBadge.style.display = 'none';
    return;
  }

  foundAdminUrls = data.adminUrls;
  foundStoreUrls = data.storeUrls;

  setStatus('ready', `Found ${foundAdminUrls.length} checked product${foundAdminUrls.length !== 1 ? 's' : ''}`);
  countBadge.textContent = `${foundAdminUrls.length} product${foundAdminUrls.length !== 1 ? 's' : ''} selected — choose URL type to open`;
  countBadge.style.display = 'block';
  setButtonsEnabled(true);
});

// --- OPEN ADMIN URLs ---
adminBtn.addEventListener('click', async () => {
  if (foundAdminUrls.length === 0) return;

  const confirmed = confirm(
    `Open Admin Editing URLs\n\nThis will open ${foundAdminUrls.length} product${foundAdminUrls.length !== 1 ? 's' : ''} in a new window with ${foundAdminUrls.length} tab${foundAdminUrls.length !== 1 ? 's' : ''}.\n\nProceed?`
  );
  if (!confirmed) return;

  // Open new window with first URL, then add the rest as tabs
  const newWindow = await chrome.windows.create({ url: foundAdminUrls[0], focused: true });

  for (let i = 1; i < foundAdminUrls.length; i++) {
    await chrome.tabs.create({ windowId: newWindow.id, url: foundAdminUrls[i] });
  }

  setStatus('ready', `Opened ${foundAdminUrls.length} admin tab${foundAdminUrls.length !== 1 ? 's' : ''} in new window`);
});

// --- OPEN STORE URLs ---
storeBtn.addEventListener('click', async () => {
  if (foundStoreUrls.length === 0) {
    alert('No store URLs were found for the checked products.');
    return;
  }

  const confirmed = confirm(
    `Open Store URLs\n\nThis will open ${foundStoreUrls.length} product${foundStoreUrls.length !== 1 ? 's' : ''} in a new window with ${foundStoreUrls.length} tab${foundStoreUrls.length !== 1 ? 's' : ''}.\n\nProceed?`
  );
  if (!confirmed) return;

  const newWindow = await chrome.windows.create({ url: foundStoreUrls[0], focused: true });

  for (let i = 1; i < foundStoreUrls.length; i++) {
    await chrome.tabs.create({ windowId: newWindow.id, url: foundStoreUrls[i] });
  }

  setStatus('ready', `Opened ${foundStoreUrls.length} store tab${foundStoreUrls.length !== 1 ? 's' : ''} in new window`);
});
