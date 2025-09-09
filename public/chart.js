// ---------------- Slave Management ----------------
async function startSlaves() {
  console.log("▶ startSlaves() clicked");
  document.getElementById("logPanel").innerHTML = "🚀 Starting JMeter slaves...";
  document.getElementById("reportLink").innerHTML = "";
  try {
    const res = await fetch("/api/start-slaves");
    const data = await res.json();
    if (data.status === "started") streamLogs();
  } catch (err) {
    console.error("startSlaves() error:", err);
  }
}

async function stopSlaves() {
  console.log("🛑 stopSlaves() clicked");
  document.getElementById("logPanel").innerHTML = "🛑 Stopping JMeter slaves...";
  document.getElementById("reportLink").innerHTML = "";
  try {
    const res = await fetch("/api/stop-slaves");
    const data = await res.json();
    if (data.status === "stopping") streamLogs();
  } catch (err) {
    console.error("stopSlaves() error:", err);
  }
}

async function startTest() {
  console.log("▶ startTest() clicked");
  document.getElementById("logPanel").innerHTML = "🚀 Starting JMeter test...";
  document.getElementById("reportLink").innerHTML = "";
  try {
    const res = await fetch("/api/start-test");
    const data = await res.json();
    if (data.status === "started") streamLogs();
  } catch (err) {
    console.error("startTest() error:", err);
  }
}

function streamLogs() {
  console.log("📡 streamLogs() started");
  const logPanel = document.getElementById("logPanel");
  const evtSource = new EventSource("/api/logs");

  evtSource.onmessage = function(event) {
    if (event.data.startsWith("REPORT_LINK::")) {
      let path = event.data.replace("REPORT_LINK::", "").trim();
      path = path.replace(/^\/reports\//, "");
      document.getElementById("reportLink").innerHTML =
        `<a href="http://164.52.211.192/${path}/index.html" target="_blank">📊 Open JMeter Report</a>`;
    } else {
      logPanel.innerHTML += event.data + "<br/>";
      logPanel.scrollTop = logPanel.scrollHeight;
    }
  };
}

function downloadCSV() {
  window.location.href = "/api/download";
}

// ---------------- Slave Status ----------------
async function checkSlaveStatus() {
  try {
    const res = await fetch("/api/slave-status");
    const slaves = await res.json();
    const tbody = document.querySelector("#slaveStatus tbody");
    tbody.innerHTML = "";
    slaves.forEach(s => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${s.ip}</td><td style="color:${s.status === "RUNNING" ? "lightgreen" : "red"}">${s.status}</td>`;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("checkSlaveStatus() error:", err);
  }
}
setInterval(checkSlaveStatus, 10000);
checkSlaveStatus();

// ---------------- Charts Setup ----------------
const labels = [];
const podsData = [];
const cpuData = [];
const memData = [];
const ingressData = [];
let podMap = {};
let nodeMap = {};

function makeChart(id, label, dataset) {
  return new Chart(document.getElementById(id), {
    type: "line",
    data: { labels, datasets: [{ label, data: dataset, fill: false, borderWidth: 2 }] },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

// Pod charts
const podsChart = makeChart("podsChart", "Pods", podsData);
const cpuChart = makeChart("cpuChart", "CPU (mCores)", cpuData);
const memChart = makeChart("memChart", "Memory (MiB)", memData);
const ingressChart = makeChart("ingressChart", "Ingress Requests", ingressData);

// Per-pod charts
const perPodCpuChart = new Chart(document.getElementById("perPodCpuChart"), {
  type: "line", data: { labels, datasets: [] },
  options: { responsive: true, scales: { y: { beginAtZero: true } } }
});
const perPodMemChart = new Chart(document.getElementById("perPodMemChart"), {
  type: "line", data: { labels, datasets: [] },
  options: { responsive: true, scales: { y: { beginAtZero: true } } }
});

// Node charts
const nodeCpuChart = new Chart(document.getElementById("nodeCpuChart"), {
  type: "line", data: { labels, datasets: [] },
  options: { responsive: true, scales: { y: { beginAtZero: true } } }
});
const nodeMemChart = new Chart(document.getElementById("nodeMemChart"), {
  type: "line", data: { labels, datasets: [] },
  options: { responsive: true, scales: { y: { beginAtZero: true } } }
});

// ---------------- Tables ----------------
function addEvent(ts, msg, pods = "") {
  const tbody = document.querySelector("#timeline tbody");
  const row = document.createElement("tr");
  row.innerHTML = `<td>${new Date(ts).toLocaleTimeString()}</td><td>${msg}</td><td>${pods}</td>`;
  tbody.prepend(row);
}

function updatePodResources(pods) {
  const tbody = document.querySelector("#podResources tbody");
  tbody.innerHTML = "";
  pods.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${p.name}</td><td>${p.cpu}</td><td>${p.mem}</td>`;
    tbody.appendChild(row);
  });
}

function updateNodeResources(nodes) {
  const tbody = document.querySelector("#nodeResources tbody");
  tbody.innerHTML = "";
  nodes.forEach(n => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${n.name}</td><td>${n.cpu} (${n.cpuPerc})</td><td>${n.mem} (${n.memPerc})</td>`;
    tbody.appendChild(row);
  });
}

// ---------------- Fetch Metrics ----------------
async function fetchMetrics() {
  try {
    const res = await fetch("/api/metrics");
    const data = await res.json();
    const ts = new Date().toISOString();

    // Detect scaling
    const newPods = data.filter(p => !podMap[p.name]);
    if (newPods.length > 0) addEvent(ts, `Pods scaled up to ${data.length}`, newPods.map(p => p.name).join(", "));
    const removedPods = Object.keys(podMap).filter(name => !data.find(p => p.name === name));
    if (removedPods.length > 0) addEvent(ts, `Pods scaled down to ${data.length}`, removedPods.join(", "));

    podMap = {};
    data.forEach(p => { podMap[p.name] = { cpu: p.cpu, mem: p.mem }; });

    // Charts update
    labels.push(new Date(ts).toLocaleTimeString());
    podsData.push(data.length);
    const totalCpu = data.reduce((sum, p) => sum + parseInt(p.cpu), 0);
    const totalMem = data.reduce((sum, p) => sum + parseInt(p.mem), 0);
    cpuData.push(totalCpu);
    memData.push(totalMem);
    ingressData.push(Math.floor(Math.random() * 5000));

    podsChart.update(); cpuChart.update(); memChart.update(); ingressChart.update();

    // ✅ Per-pod CPU/Memory update
    // remove datasets for deleted pods
    perPodCpuChart.data.datasets = perPodCpuChart.data.datasets.filter(d => data.find(p => p.name === d.label));
    perPodMemChart.data.datasets = perPodMemChart.data.datasets.filter(d => data.find(p => p.name === d.label));

    data.forEach(p => {
      // CPU
      let cpuDs = perPodCpuChart.data.datasets.find(d => d.label === p.name);
      if (!cpuDs) {
        cpuDs = { label: p.name, data: [], borderWidth: 2 };
        perPodCpuChart.data.datasets.push(cpuDs);
      }
      cpuDs.data.push(parseInt(p.cpu));

      // MEM
      let memDs = perPodMemChart.data.datasets.find(d => d.label === p.name);
      if (!memDs) {
        memDs = { label: p.name, data: [], borderWidth: 2 };
        perPodMemChart.data.datasets.push(memDs);
      }
      memDs.data.push(parseInt(p.mem));
    });

    perPodCpuChart.update();
    perPodMemChart.update();

    updatePodResources(data);
  } catch (err) {
    console.error("fetchMetrics() error:", err);
  }
}

async function fetchNodes() {
  try {
    const res = await fetch("/api/nodes");
    const nodes = await res.json();
    const ts = new Date().toISOString();
    labels.push(new Date(ts).toLocaleTimeString());

    const newNodes = nodes.filter(n => !nodeMap[n.name]);
    if (newNodes.length > 0) addEvent(ts, `Nodes increased to ${nodes.length}`, newNodes.map(n => n.name).join(", "));
    const removedNodes = Object.keys(nodeMap).filter(name => !nodes.find(n => n.name === name));
    if (removedNodes.length > 0) addEvent(ts, `Nodes decreased to ${nodes.length}`, removedNodes.join(", "));

    nodeMap = {};
    nodes.forEach(n => { nodeMap[n.name] = { cpu: n.cpu, mem: n.mem }; });

    nodes.forEach(n => {
      let datasetCpu = nodeCpuChart.data.datasets.find(d => d.label === n.name);
      if (!datasetCpu) {
        datasetCpu = { label: n.name, data: [], borderWidth: 2 };
        nodeCpuChart.data.datasets.push(datasetCpu);
      }
      datasetCpu.data.push(parseInt(n.cpu));

      let datasetMem = nodeMemChart.data.datasets.find(d => d.label === n.name);
      if (!datasetMem) {
        datasetMem = { label: n.name, data: [], borderWidth: 2 };
        nodeMemChart.data.datasets.push(datasetMem);
      }
      datasetMem.data.push(parseInt(n.mem));
    });

    nodeCpuChart.update();
    nodeMemChart.update();
    updateNodeResources(nodes);
  } catch (err) {
    console.error("fetchNodes() error:", err);
  }
}

// Polling
setInterval(fetchMetrics, 2000);
setInterval(fetchNodes, 5000);

// ---------------- Label Selector Management ----------------
let CURRENT_LABEL_SELECTOR = "app=imgproxy-imgproxy";
let CURRENT_NAMESPACE = "prod";

async function loadCurrentConfig() {
  try {
    const selectorRes = await fetch("/api/label-selector");
    const selectorData = await selectorRes.json();
    CURRENT_LABEL_SELECTOR = selectorData.selector;
    CURRENT_NAMESPACE = selectorData.namespace;
    
    document.getElementById("currentSelector").value = CURRENT_LABEL_SELECTOR;
    document.getElementById("currentNamespace").value = CURRENT_NAMESPACE;
  } catch (err) {
    console.error("loadCurrentConfig() error:", err);
  }
}

async function loadAvailableLabels() {
  try {
    const res = await fetch("/api/available-labels");
    const data = await res.json();
    const select = document.getElementById("availableLabels");
    select.innerHTML = '<option value="">Select from available labels...</option>';
    
    data.labels.forEach(label => {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("loadAvailableLabels() error:", err);
  }
}

function selectAvailableLabel() {
  const select = document.getElementById("availableLabels");
  const selectedLabel = select.value;
  if (selectedLabel) {
    document.getElementById("newSelector").value = selectedLabel;
  }
}

function setExampleSelector(selector) {
  document.getElementById("newSelector").value = selector;
}

async function updateNamespace() {
  const newNamespace = document.getElementById("newNamespace").value.trim();
  if (!newNamespace) {
    alert("Please enter a namespace");
    return;
  }

  console.log(`🏷️ updateNamespace() to: ${newNamespace}`);
  document.getElementById("namespaceStatus").innerText = "🔄 Updating namespace...";
  
  try {
    const res = await fetch("/api/namespace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ namespace: newNamespace })
    });
    const data = await res.json();
    
    if (data.status === "updated") {
      CURRENT_NAMESPACE = newNamespace;
      document.getElementById("currentNamespace").value = newNamespace;
      document.getElementById("newNamespace").value = "";
      document.getElementById("namespaceStatus").innerText = "✅ Namespace updated successfully";
      
      // Reload available labels for new namespace
      await loadAvailableLabels();
      
      alert(`✅ Namespace updated to: ${newNamespace}`);
    } else {
      document.getElementById("namespaceStatus").innerText = "❌ Update failed";
    }
  } catch (err) {
    console.error("updateNamespace() error:", err);
    document.getElementById("namespaceStatus").innerText = "❌ Update failed";
  }
}

async function updateLabelSelector() {
  const newSelector = document.getElementById("newSelector").value.trim();
  if (!newSelector) {
    alert("Please enter a label selector");
    return;
  }

  console.log(`🏷️ updateLabelSelector() to: ${newSelector}`);
  document.getElementById("selectorStatus").innerText = "🔄 Updating label selector...";
  
  try {
    const res = await fetch("/api/label-selector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selector: newSelector })
    });
    const data = await res.json();
    
    if (data.status === "updated") {
      CURRENT_LABEL_SELECTOR = newSelector;
      document.getElementById("currentSelector").value = newSelector;
      document.getElementById("newSelector").value = "";
      document.getElementById("selectorStatus").innerText = "✅ Label selector updated successfully";
      
      // Clear existing data and restart monitoring
      labels.length = 0;
      podsData.length = 0;
      cpuData.length = 0;
      memData.length = 0;
      ingressData.length = 0;
      
      // Clear per-pod charts
      perPodCpuChart.data.datasets = [];
      perPodMemChart.data.datasets = [];
      
      // Update all charts
      podsChart.update();
      cpuChart.update();
      memChart.update();
      ingressChart.update();
      perPodCpuChart.update();
      perPodMemChart.update();
      
      alert(`✅ Label selector updated to: ${newSelector}`);
    } else {
      document.getElementById("selectorStatus").innerText = "❌ Update failed";
    }
  } catch (err) {
    console.error("updateLabelSelector() error:", err);
    document.getElementById("selectorStatus").innerText = "❌ Update failed";
  }
}

// Initialize current selector display
document.addEventListener('DOMContentLoaded', function() {
  loadCurrentConfig();
  loadAvailableLabels();
});
