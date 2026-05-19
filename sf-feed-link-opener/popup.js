const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const countBadge = document.getElementById('countBadge');
const scanBtn    = document.getElementById('scanBtn');
const openBtn    = document.getElementById('openBtn');
const tabList    = document.getElementById('tabList');

let foundProducts = [];

const SCAN_SCRIPT = function () {
  const titleEl = document.querySelector('#original_post_title');
  const productName = titleEl ? titleEl.value : 'Unknown Product';

  const allItems = document.querySelectorAll(
    '#mwb-salesforce-order-feed-meta-box #mwb-feed-list-meta-box-wrap .mwb-feed-list-item'
  );

  const urls = [];

  allItems.forEach(item => {
    const titleDiv = item.querySelector('.item-title');
    if (!titleDiv) return;

    if (titleDiv.textContent.trim().includes('Product2 Feed')) {
      const link = item.querySelector('.item-data a.item-id-link');
      if (link && link.href) {
        urls.push(link.href);
      }
    }
  });

  return { productName, urls, total: allItems.length };
};

function setStatus(state, text) {
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = text;
}

function truncate(str, max) {
  if (!str) return 'Untitled Tab';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function renderTabItem(tab, state, message, splitLine) {
  const existing = document.getElementById('tabrow-' + tab.id);
  const icon = state === 'found' ? '✓' : state === 'missing' ? '—' : '▶';
  const name = truncate(tab.title, 34);

  let inner;
  if (splitLine && message) {
    inner = `<span class="tab-name">${name}<br><span class="tab-sub">— ${message}</span></span>`;
  } else {
    inner = `<span class="tab-name">${name}</span>`;
  }

  if (existing) {
    existing.className = 'tab-item ' + state;
    existing.querySelector('.tab-icon').textContent = icon;
    existing.innerHTML = `<span class="tab-icon">${icon}</span>${inner}`;
    return;
  }

  const el = document.createElement('div');
  el.className = 'tab-item ' + state;
  el.id = 'tabrow-' + tab.id;
  el.innerHTML = `<span class="tab-icon">${icon}</span>${inner}`;
  tabList.appendChild(el);
}

scanBtn.addEventListener('click', async () => {
  foundProducts = [];
  openBtn.disabled = true;
  tabList.innerHTML = '';
  tabList.style.display = 'none';
  countBadge.style.display = 'none';
  setStatus('scanning', 'Scanning tabs…');
  scanBtn.disabled = true;

  const tabs = await chrome.tabs.query({ currentWindow: true });

  if (tabs.length === 0) {
    setStatus('error', 'No tabs found in this window.');
    scanBtn.disabled = false;
    return;
  }

  tabList.style.display = 'block';

  for (const tab of tabs) {
    renderTabItem(tab, 'scanning', '', false);

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: SCAN_SCRIPT
      });

      const data = results && results[0] && results[0].result;

      if (data && data.urls.length > 0) {
        foundProducts.push({ productName: data.productName, urls: data.urls });
        const label = data.urls.length === 1 ? '1 link found' : `${data.urls.length} links found`;
        renderTabItem(tab, 'found', label, data.urls.length > 1);
      } else {
        renderTabItem(tab, 'missing', 'No Product2 Feed links', false);
      }
    } catch (err) {
      renderTabItem(tab, 'missing', 'Could not scan', false);
    }

    await sleep(200);
  }

  scanBtn.disabled = false;

  const totalUrls = foundProducts.reduce((sum, p) => sum + p.urls.length, 0);

  if (totalUrls === 0) {
    setStatus('none', `No Product2 Feed links found across ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`);
    countBadge.style.display = 'none';
    return;
  }

  setStatus('ready', `Found ${totalUrls} link${totalUrls !== 1 ? 's' : ''} across ${foundProducts.length} product${foundProducts.length !== 1 ? 's' : ''}`);
  countBadge.textContent = `${totalUrls} Product2 Feed link${totalUrls !== 1 ? 's' : ''} ready to open`;
  countBadge.style.display = 'block';
  openBtn.disabled = false;
});

openBtn.addEventListener('click', async () => {
  if (foundProducts.length === 0) return;

  const totalUrls = foundProducts.reduce((sum, p) => sum + p.urls.length, 0);

  let message = `Open Product2 Feed Links\n\nThis will open ${totalUrls} tab${totalUrls !== 1 ? 's' : ''} in a new window:\n\n`;

  foundProducts.forEach(p => {
    message += `${p.productName}\n`;
    if (p.urls.length > 1) {
      p.urls.forEach((url, i) => {
        message += `  - Variation ${i + 1}\n`;
      });
    }
  });

  message += `\nProceed?`;

  const confirmed = confirm(message);
  if (!confirmed) return;

  const allUrls = foundProducts.flatMap(p => p.urls);

  const newWindow = await chrome.windows.create({ url: allUrls[0], focused: true });

  for (let i = 1; i < allUrls.length; i++) {
    await chrome.tabs.create({ windowId: newWindow.id, url: allUrls[i] });
  }

  setStatus('done', `Opened ${allUrls.length} tab${allUrls.length !== 1 ? 's' : ''} in new window`);
});
