const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const countBadge = document.getElementById('countBadge');
const skuInput   = document.getElementById('skuInput');
const parseBtn   = document.getElementById('parseBtn');
const openBtn    = document.getElementById('openBtn');

const BASE_URL = 'https://moscadesign.com/wp-admin/edit.php';
const QUERY_PARAMS = 'post_status=all&post_type=product&action=-1&seo_filter&readability_filter&product_type&stock_status&product_brand&paged=1&action2=-1';

let parsedTerms = [];

function setStatus(state, text) {
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = text;
}

function buildSearchUrl(term) {
  return `${BASE_URL}?s=${encodeURIComponent(term)}&${QUERY_PARAMS}`;
}

function parseInput() {
  const raw = skuInput.value;
  const lines = raw.split('\n');
  const terms = lines
    .map(line => line.trim())
    .filter(line => line.length > 0);
  return [...new Set(terms)]; // deduplicate
}

// Auto-parse as user types
skuInput.addEventListener('input', () => {
  const terms = parseInput();
  if (terms.length > 0) {
    parsedTerms = terms;
    setStatus('ready', `${terms.length} term${terms.length !== 1 ? 's' : ''} ready`);
    countBadge.textContent = `${terms.length} search tab${terms.length !== 1 ? 's' : ''} will open`;
    countBadge.style.display = 'block';
    openBtn.disabled = false;
  } else {
    parsedTerms = [];
    setStatus('', 'Paste SKUs or names below, one per line');
    countBadge.style.display = 'none';
    openBtn.disabled = true;
  }
});

// Parse button — explicit trigger
parseBtn.addEventListener('click', () => {
  const terms = parseInput();

  if (terms.length === 0) {
    setStatus('none', 'No terms found — paste at least one SKU or name');
    countBadge.style.display = 'none';
    openBtn.disabled = true;
    return;
  }

  parsedTerms = terms;
  setStatus('ready', `${terms.length} term${terms.length !== 1 ? 's' : ''} parsed`);
  countBadge.textContent = `${terms.length} search tab${terms.length !== 1 ? 's' : ''} ready to open`;
  countBadge.style.display = 'block';
  openBtn.disabled = false;
});

// Open button
openBtn.addEventListener('click', async () => {
  if (parsedTerms.length === 0) return;

  const confirmed = confirm(
    `Open WP Admin Search Tabs\n\nThis will open ${parsedTerms.length} search tab${parsedTerms.length !== 1 ? 's' : ''} in a new window:\n\n` +
    parsedTerms.slice(0, 10).map(t => `  • ${t}`).join('\n') +
    (parsedTerms.length > 10 ? `\n  … and ${parsedTerms.length - 10} more` : '') +
    `\n\nProceed?`
  );

  if (!confirmed) return;

  const urls = parsedTerms.map(buildSearchUrl);

  const newWindow = await chrome.windows.create({ url: urls[0], focused: true });

  for (let i = 1; i < urls.length; i++) {
    await chrome.tabs.create({ windowId: newWindow.id, url: urls[i] });
  }

  setStatus('done', `Opened ${urls.length} tab${urls.length !== 1 ? 's' : ''} in new window`);
});
