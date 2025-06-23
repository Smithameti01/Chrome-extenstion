document.addEventListener("DOMContentLoaded", () => {
  const isChromeExtension = typeof chrome !== "undefined" && chrome.storage;
  const timeChartCanvas = document.getElementById("timeChart");
  const dailyChartCanvas = document.getElementById("dailyChart");
  const domainTableBody = document.getElementById("domain-table-body");

  if (!timeChartCanvas || !dailyChartCanvas) {
    showError("Chart elements not found");
    return;
  }

  // Set canvas dimensions
  [timeChartCanvas, dailyChartCanvas].forEach(canvas => {
    canvas.width = canvas.offsetWidth;
    canvas.height = 400;
  });

  const ctx = {
    time: timeChartCanvas.getContext("2d"),
    daily: dailyChartCanvas.getContext("2d")
  };

  let charts = {
    time: null,
    daily: null
  };

  // Initialize with faster refresh (2 seconds)
  loadDataAndRender();
  const refreshInterval = setInterval(loadDataAndRender, 2000);

  window.addEventListener("beforeunload", () => {
    clearInterval(refreshInterval);
    Object.values(charts).forEach(chart => chart?.destroy());
  });

  async function loadDataAndRender() {
    try {
      const rawData = await (isChromeExtension ? getExtensionData() : getAPIData());
      const processedData = processData(rawData);
      
      renderCharts(processedData);
      renderDomainTable(processedData);
    } catch (error) {
      console.error("Data load error:", error);
      showError("Failed to load data");
    }
  }

  async function getExtensionData() {
    return new Promise(resolve => {
      chrome.storage.local.get("timeData", result => {
        resolve(result.timeData || {});
      });
    });
  }

  async function getAPIData() {
    const response = await fetch('http://localhost:3000/api/time-data');
    return response.json();
  }

  function processData(rawData) {
    const today = getCurrentDate();
    if (!rawData[today]) {
      rawData[today] = {
        productive: 0,
        unproductive: 0,
        neutral: 0,
        domains: {}
      };
    }
    return rawData;
  }

  function renderCharts(data) {
    const dates = Object.keys(data).sort().slice(-7);
    const today = getCurrentDate();
    const todayData = data[today] || { productive: 0, unproductive: 0, neutral: 0 };

    // Weekly data
    const weeklyData = {
      productive: dates.map(date => data[date]?.productive || 0),
      unproductive: dates.map(date => data[date]?.unproductive || 0),
      neutral: dates.map(date => data[date]?.neutral || 0)
    };

    // Destroy old charts
    Object.values(charts).forEach(chart => chart?.destroy());

    try {
      // Weekly chart
      charts.time = new Chart(ctx.time, {
        type: "bar",
        data: {
          labels: dates.map(formatDate),
          datasets: [
            createDataset("Productive", weeklyData.productive, "75, 192, 192"),
            createDataset("Unproductive", weeklyData.unproductive, "255, 99, 132"),
            createDataset("Neutral", weeklyData.neutral, "201, 203, 207")
          ]
        },
        options: createChartOptions("Weekly Time Breakdown", "bar")
      });

      // Daily chart
      charts.daily = new Chart(ctx.daily, {
        type: "pie",
        data: {
          labels: ["Productive", "Unproductive", "Neutral"],
          datasets: [{
            data: [todayData.productive, todayData.unproductive, todayData.neutral],
            backgroundColor: [
              "rgba(75, 192, 192, 0.7)",
              "rgba(255, 99, 132, 0.7)",
              "rgba(201, 203, 207, 0.7)"
            ],
            borderWidth: 1
          }]
        },
        options: createChartOptions(`Today's Productivity (${formatDate(today)})`, "pie")
      });
    } catch (error) {
      console.error("Chart error:", error);
    }
  }

  function renderDomainTable(data) {
    const today = getCurrentDate();
    const domains = Object.entries(data[today]?.domains || {})
      .sort((a, b) => b[1].time - a[1].time)
      .slice(0, 10);

    domainTableBody.innerHTML = domains.length ? "" : `
      <tr><td colspan="3">No browsing data yet</td></tr>`;

    domains.forEach(([domain, {time, productive}]) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${domain}</td>
        <td>${formatTime(time)}</td>
        <td class="${getProductivityClass(productive)}">
          ${getCategoryName(productive)}
        </td>`;
      domainTableBody.appendChild(row);
    });
  }

  // Helper functions
  function createDataset(label, data, rgb) {
    return {
      label,
      data,
      backgroundColor: `rgba(${rgb}, 0.7)`,
      borderColor: `rgba(${rgb}, 1)`,
      borderWidth: 1
    };
  }

  function createChartOptions(title, type) {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: title, font: { size: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (type === "pie") {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const percent = total ? Math.round(ctx.raw / total * 100) : 0;
                return `${ctx.label}: ${formatTime(ctx.raw)} (${percent}%)`;
              }
              return `${ctx.dataset.label}: ${formatTime(ctx.raw)}`;
            }
          }
        }
      }
    };

    if (type === "bar") {
      baseOptions.scales = {
        x: { stacked: true, grid: { display: false } },
        y: { 
          stacked: true, 
          beginAtZero: true,
          ticks: { callback: value => formatTime(value) }
        }
      };
    }

    return baseOptions;
  }

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours ? `${hours}h ${mins}m` : mins ? `${mins}m` : `${seconds}s`;
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  }

  function getCurrentDate() {
    return new Date().toISOString().split("T")[0];
  }

  function getCategoryName(productive) {
    return productive === true ? "Productive" :
           productive === false ? "Unproductive" : "Neutral";
  }

  function getProductivityClass(productive) {
    return productive === true ? "productive" :
           productive === false ? "unproductive" : "neutral";
  }

  function showError(message) {
    const container = document.querySelector(".container");
    if (!container) return;
    
    let errorDiv = container.querySelector(".error-message");
    if (!errorDiv) {
      errorDiv = document.createElement("div");
      errorDiv.className = "error-message";
      container.prepend(errorDiv);
    }
    errorDiv.textContent = message;
  }
});