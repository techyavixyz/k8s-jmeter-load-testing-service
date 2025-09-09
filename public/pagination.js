// Pagination functionality for tables
let currentPodPage = 1;
let currentNodePage = 1;
let currentTimelinePage = 1;
const itemsPerPage = 10;

let allPods = [];
let allNodes = [];
let allTimelineEvents = [];

// Pod pagination
function updatePodTable() {
  const tbody = document.querySelector("#podResources tbody");
  tbody.innerHTML = "";
  
  const startIndex = (currentPodPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = allPods.slice(startIndex, endIndex);
  
  pageData.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${p.name}</td><td>${p.cpu}</td><td>${p.mem}</td>`;
    tbody.appendChild(row);
  });
  
  // Update pagination info
  const totalPages = Math.ceil(allPods.length / itemsPerPage);
  document.getElementById("podPageInfo").textContent = `Page ${currentPodPage} of ${totalPages}`;
  
  // Update button states
  const prevBtn = document.querySelector('.table-card:nth-child(2) .pagination-btn:first-child');
  const nextBtn = document.querySelector('.table-card:nth-child(2) .pagination-btn:last-child');
  
  prevBtn.disabled = currentPodPage === 1;
  nextBtn.disabled = currentPodPage === totalPages || totalPages === 0;
}

function previousPodPage() {
  if (currentPodPage > 1) {
    currentPodPage--;
    updatePodTable();
  }
}

function nextPodPage() {
  const totalPages = Math.ceil(allPods.length / itemsPerPage);
  if (currentPodPage < totalPages) {
    currentPodPage++;
    updatePodTable();
  }
}

// Node pagination
function updateNodeTable() {
  const tbody = document.querySelector("#nodeResources tbody");
  tbody.innerHTML = "";
  
  const startIndex = (currentNodePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = allNodes.slice(startIndex, endIndex);
  
  pageData.forEach(n => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${n.name}</td><td>${n.cpu} (${n.cpuPerc})</td><td>${n.mem} (${n.memPerc})</td>`;
    tbody.appendChild(row);
  });
  
  // Update pagination info
  const totalPages = Math.ceil(allNodes.length / itemsPerPage);
  document.getElementById("nodePageInfo").textContent = `Page ${currentNodePage} of ${totalPages}`;
  
  // Update button states
  const prevBtn = document.querySelector('.table-card:nth-child(3) .pagination-btn:first-child');
  const nextBtn = document.querySelector('.table-card:nth-child(3) .pagination-btn:last-child');
  
  prevBtn.disabled = currentNodePage === 1;
  nextBtn.disabled = currentNodePage === totalPages || totalPages === 0;
}

function previousNodePage() {
  if (currentNodePage > 1) {
    currentNodePage--;
    updateNodeTable();
  }
}

function nextNodePage() {
  const totalPages = Math.ceil(allNodes.length / itemsPerPage);
  if (currentNodePage < totalPages) {
    currentNodePage++;
    updateNodeTable();
  }
}

// Timeline pagination
function updateTimelineTable() {
  const tbody = document.querySelector("#timeline tbody");
  const rows = Array.from(tbody.children);
  
  // Store all timeline events
  allTimelineEvents = rows.map(row => ({
    time: row.children[0].textContent,
    event: row.children[1].textContent,
    pods: row.children[2].textContent
  }));
  
  // Clear and repopulate with paginated data
  tbody.innerHTML = "";
  
  const startIndex = (currentTimelinePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = allTimelineEvents.slice(startIndex, endIndex);
  
  pageData.forEach(event => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${event.time}</td><td>${event.event}</td><td>${event.pods}</td>`;
    tbody.appendChild(row);
  });
}

// Override the original functions to use pagination
function updatePodResources(pods) {
  allPods = pods;
  currentPodPage = 1; // Reset to first page when data updates
  updatePodTable();
}

function updateNodeResources(nodes) {
  allNodes = nodes;
  currentNodePage = 1; // Reset to first page when data updates
  updateNodeTable();
}

// Override addEvent to handle timeline pagination
const originalAddEvent = window.addEvent;
window.addEvent = function(ts, msg, pods = "") {
  const tbody = document.querySelector("#timeline tbody");
  const row = document.createElement("tr");
  row.innerHTML = `<td>${new Date(ts).toLocaleTimeString()}</td><td>${msg}</td><td>${pods}</td>`;
  tbody.prepend(row);
  
  // Update timeline pagination after adding new event
  updateTimelineTable();
};