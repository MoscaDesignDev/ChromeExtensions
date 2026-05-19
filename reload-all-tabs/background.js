// Listen for the keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'reload-all-tabs') {
    await reloadAllTabs();
  }
});

// Also fire when toolbar icon is clicked (no popup needed from keyboard path)
chrome.action.onClicked.addListener(async () => {
  await reloadAllTabs();
});

async function reloadAllTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  for (const tab of tabs) {
    try {
      await chrome.tabs.reload(tab.id);
    } catch (e) {
      // Skip tabs that can't be reloaded (e.g. chrome:// pages)
    }
  }
}
