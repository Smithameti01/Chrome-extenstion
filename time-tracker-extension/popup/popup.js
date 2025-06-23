document.addEventListener('DOMContentLoaded', () => {
    const productiveTimeEl = document.getElementById('productive-time');
    const unproductiveTimeEl = document.getElementById('unproductive-time');
    const dashboardBtn = document.getElementById('dashboard-btn');
  
    // Load and display today's data
    chrome.storage.local.get('timeData', (result) => {
      const today = new Date().toISOString().split('T')[0];
      const todayData = result.timeData?.[today] || { productive: 0, unproductive: 0 };
      
      productiveTimeEl.textContent = formatTime(todayData.productive || 0);
      unproductiveTimeEl.textContent = formatTime(todayData.unproductive || 0);
    });
  
    // Format seconds to hours and minutes
    function formatTime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  
    // Open dashboard
    dashboardBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    });
  });