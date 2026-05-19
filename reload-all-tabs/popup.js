const reloadBtn = document.getElementById('reloadBtn');
const changeBtn = document.getElementById('changeBtn');
const shortcutDisplay = document.getElementById('shortcutDisplay');

// Read the actual assigned shortcut from Chrome and display it
async function loadShortcut() {
  const commands = await chrome.commands.getAll();
  const cmd = commands.find(c => c.name === 'reload-all-tabs');
  if (cmd && cmd.shortcut) {
    // Format: "Ctrl+Shift+R" -> individual key spans
    const parts = cmd.shortcut.split('+');
    shortcutDisplay.innerHTML = parts.map(p => `<span>${p}</span>`).join('+');
  } else {
    shortcutDisplay.innerHTML = '<span style="color:#555570;font-size:9px;">No shortcut set</span>';
  }
}

loadShortcut();

// Reload all tabs in current window
reloadBtn.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  for (const tab of tabs) {
    try {
      await chrome.tabs.reload(tab.id);
    } catch (e) {
      // Skip chrome:// or other restricted tabs
    }
  }
  window.close();
});

// Open Chrome's shortcut management page
changeBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
});
