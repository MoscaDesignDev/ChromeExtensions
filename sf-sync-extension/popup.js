const PRICEBOOK_SCRIPT = function () {
  try {
    var s = document.getElementById('mwb-salesforce-manual-sync-select');
    if (!s) return { success: false, reason: 'Sync select not found — may not be a WC product page' };
    s.value = '81960';
    var b = document.getElementById('mwb-salesforce-manual-sync-button');
    if (!b) return { success: false, reason: 'Sync button not found' };
    b.click();
    return { success: true };
  } catch (e) {
    return { success: false, reason: e.message };
  }
};

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const runBtn = document.getElementById('runBtn');
const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const tabList = document.getElementById('tabList');
const delayInput = document.getElementById('delayInput');

function setStatus(state, text) {
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = text;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function truncate(str, max) {
  if (!str) return 'Untitled Tab';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function addTabItem(tab, state, message) {
  const existing = document.getElementById('tab-' + tab.id);
  if (existing) {
    existing.className = 'tab-item ' + state;
    existing.querySelector('.tab-icon').textContent = state === 'success' ? '✓' : state === 'error' ? '✗' : '▶';
    existing.querySelector('.tab-name').textContent = truncate(tab.title, 32) + (message ? ' — ' + message : '');
    return;
  }
  const el = document.createElement('div');
  el.className = 'tab-item ' + state;
  el.id = 'tab-' + tab.id;
  el.innerHTML = `
    <span class="tab-icon">${state === 'success' ? '✓' : state === 'error' ? '✗' : '▶'}</span>
    <span class="tab-name">${truncate(tab.title, 32)}${message ? ' — ' + message : ''}</span>
  `;
  tabList.appendChild(el);
}

runBtn.addEventListener('click', async () => {
  const delay = parseInt(delayInput.value) || 1500;

  // Get all tabs in the current window
  const tabs = await chrome.tabs.query({ currentWindow: true });

  if (tabs.length === 0) {
    setStatus('error', 'No tabs found in this window.');
    return;
  }

  // Confirmation prompt
  const confirmed = confirm(
    `SF Pricebook Sync\n\nThis will run the Pricebook sync on ${tabs.length} tab${tabs.length !== 1 ? 's' : ''} in this window.\n\nTabs will be processed sequentially with a ${delay}ms delay between each.\n\nProceed?`
  );

  if (!confirmed) {
    setStatus('', 'Sync cancelled.');
    return;
  }

  // Setup UI
  runBtn.disabled = true;
  tabList.innerHTML = '';
  tabList.style.display = 'block';
  progressWrap.style.display = 'block';
  progressLabel.textContent = `0 / ${tabs.length}`;
  progressFill.style.width = '0%';
  setStatus('running', `Running on ${tabs.length} tabs…`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    addTabItem(tab, 'running', '');

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: PRICEBOOK_SCRIPT
      });

      const result = results && results[0] && results[0].result;

      if (result && result.success) {
        addTabItem(tab, 'success', 'Synced');
        successCount++;
      } else {
        const reason = (result && result.reason) || 'Unknown error';
        addTabItem(tab, 'error', reason);
        skippedCount++;
      }
    } catch (err) {
      addTabItem(tab, 'error', 'Could not execute script');
      errorCount++;
    }

    // Update progress
    const done = i + 1;
    progressLabel.textContent = `${done} / ${tabs.length}`;
    progressFill.style.width = ((done / tabs.length) * 100) + '%';

    // Delay before next tab (skip delay on last tab)
    if (i < tabs.length - 1) {
      await sleep(delay);
    }
  }

  // Done
  setStatus('done', `Complete — ${successCount} synced, ${skippedCount} skipped, ${errorCount} errors`);
  runBtn.disabled = false;
  runBtn.textContent = '↺ Run Again';

  // Completion alert
  alert(
    `SF Pricebook Sync Complete\n\n✓ Synced: ${successCount}\n— Skipped (not a product page): ${skippedCount}\n✗ Errors: ${errorCount}\n\nTotal tabs processed: ${tabs.length}`
  );
});
