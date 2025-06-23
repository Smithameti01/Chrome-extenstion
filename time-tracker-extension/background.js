// Enhanced website classification
const productiveSites = [
  "github.com", "stackoverflow.com", "leetcode.com",
  "docs.google.com", "codecademy.com", "udemy.com",
  "coursera.org", "developer.mozilla.org", "w3schools.com",
  "freecodecamp.org", "gitlab.com", "bitbucket.org",
  "notion.so", "trello.com", "atlassian.com",
  "medium.com", "chat.openai.com", "codepen.io",
  "jsfiddle.net", "repl.it", "glitch.com"
];

const unproductiveSites = [
  "youtube.com", "netflix.com", "facebook.com",
  "twitter.com", "instagram.com", "reddit.com",
  "tiktok.com", "pinterest.com", "9gag.com",
  "twitch.tv", "dailymotion.com", "vimeo.com",
  "ebay.com", "amazon.com", "shopping.com"
];

let currentTab = null;
let startTime = null;
let currentDomain = null;
let isProductive = null;
let timeData = {};

// Initialize with sample data if empty
chrome.storage.local.get("timeData", (result) => {
  timeData = result.timeData || {};
  if (Object.keys(timeData).length === 0) {
    const today = getCurrentDate();
    timeData[today] = {
      productive: 0,
      unproductive: 0,
      neutral: 0,
      domains: {}
    };
    chrome.storage.local.set({ timeData });
  }
});

// Enhanced tab tracking
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, updateActiveTab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    updateActiveTab(tab);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    saveCurrentTabTime();
  } else {
    chrome.tabs.query({active: true, windowId}, ([tab]) => tab && updateActiveTab(tab));
  }
});

function updateActiveTab(tab) {
  saveCurrentTabTime();
  
  if (tab?.url) {
    try {
      const url = new URL(tab.url);
      currentTab = tab.id;
      currentDomain = url.hostname.replace('www.', '');
      isProductive = classifyWebsite(currentDomain);
      startTime = Date.now();
      
      console.log(`Tracking: ${currentDomain} (${getCategoryName(isProductive)})`);
    } catch (e) {
      console.error("URL parsing error:", e);
    }
  }
}

function saveCurrentTabTime() {
  if (currentTab && startTime && currentDomain) {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    if (timeSpent > 0) {
      updateTimeData(currentDomain, timeSpent, isProductive);
      syncWithBackend();
    }
    startTime = Date.now();
  }
}

function classifyWebsite(domain) {
  domain = domain.toLowerCase();
  if (productiveSites.some(site => domain.includes(site))) return true;
  if (unproductiveSites.some(site => domain.includes(site))) return false;
  return null;
}

function updateTimeData(domain, seconds, productive) {
  const today = getCurrentDate();
  
  if (!timeData[today]) {
    timeData[today] = {
      productive: 0,
      unproductive: 0,
      neutral: 0,
      domains: {}
    };
  }

  const category = productive === true ? 'productive' : 
                   productive === false ? 'unproductive' : 'neutral';
  
  timeData[today][category] += seconds;
  
  if (!timeData[today].domains[domain]) {
    timeData[today].domains[domain] = {
      time: 0,
      productive: productive
    };
  }
  
  timeData[today].domains[domain].time += seconds;
  
  chrome.storage.local.set({ timeData });
}

async function syncWithBackend() {
  try {
    await fetch('http://localhost:3000/api/realtime-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: currentDomain,
        seconds: Math.round((Date.now() - startTime) / 1000),
        productive: isProductive
      })
    });
  } catch (error) {
    console.error('Backend sync failed:', error);
  }
}

// Utility functions
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function getCategoryName(productive) {
  return productive === true ? 'Productive' : 
         productive === false ? 'Unproductive' : 'Neutral';
}

// Periodic saving
chrome.alarms.create('saveData', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'saveData') saveCurrentTabTime();
});

chrome.runtime.onSuspend.addListener(saveCurrentTabTime);