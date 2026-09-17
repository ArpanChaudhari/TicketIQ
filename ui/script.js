// TicketIQ frontend. Set API_BASE_URL to your FastAPI server address.
const API_BASE_URL = "http://localhost:8000";
const REQUEST_TIMEOUT = 30000;
const QUERY_TIMEOUT = 90000;

const EXAMPLE_QUESTIONS = [
  "Show me all Critical tickets not resolved within 12 hours.",
  "How many tickets are currently Open?",
  "Show me all High-priority tickets.",
  "Which category has the most support tickets?",
  "Show me tickets with customer ratings below 3.",
  "Which agents have the highest number of unresolved tickets?"
];

let anomaliesData = [];
let ticketsData = [];
let lastQueryResult = null;

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));
const pretty = (value) => String(value ?? "").replaceAll("_", " ");
const normalized = (value) => pretty(value).trim().toLowerCase();

function showMessage(id, text = "", type = "info") {
  const el = $(id);
  el.textContent = text;
  el.className = text ? `message ${type}` : "message";
}
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.style.display = "none", 3000);
}
async function apiRequest(endpoint, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || REQUEST_TIMEOUT);
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options, signal: controller.signal,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) {
      const detail = data && typeof data === "object" ? (data.detail || data.message) : data;
      throw new Error(detail || `HTTP ${response.status}`);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Request timed out. Check that the API is running.");
    throw error;
  } finally { clearTimeout(timeout); }
}
function extractRecords(payload, keys) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of keys) if (Array.isArray(payload[key])) return payload[key];
  return [];
}
function recordsToRows(data) {
  if (Array.isArray(data)) return data.map(v => (v && typeof v === "object" && !Array.isArray(v)) ? v : { value: v });
  if (data && typeof data === "object") return [data];
  return [];
}
function findColumn(rows, names) {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]);
  for (const name of names) {
    const found = keys.find(k => normalized(k) === normalized(name));
    if (found) return found;
  }
  return null;
}
function setOptions(selectId, values, allLabel = "All") {
  const select = $(selectId);
  const current = select.value;
  select.innerHTML = `<option value="">${esc(allLabel)}</option>` +
    [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== "").map(String))]
      .sort((a, b) => a.localeCompare(b))
      .map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  if ([...select.options].some(o => o.value === current)) select.value = current;
}
function renderTable(containerId, inputRows, emptyText = "No records to display.") {
  const rows = recordsToRows(inputRows);
  const container = $(containerId);
  if (!rows.length) { container.innerHTML = `<p class="muted small">${esc(emptyText)}</p>`; return; }
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  container.innerHTML = `<div class="table-wrap"><table><thead><tr>${columns.map(c => `<th title="${esc(c)}">${esc(pretty(c))}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(c => `<td title="${esc(cellValue(row[c]))}">${esc(cellValue(row[c]))}</td>`).join("")}</tr>`).join("")
    }</tbody></table></div>`;
}
function cellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function renderMetric(containerId, label, value, kicker) {
  $(containerId).innerHTML = `<div class="stat-card"><div class="stat-kicker">${esc(kicker)}</div><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div></div>`;
}
function countBy(rows, column) {
  const counts = new Map();
  if (!column) return [];
  rows.forEach(row => {
    const label = row[column] == null || row[column] === "" ? "Unknown" : String(row[column]);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}
function renderCountCards(containerId, counts) {
  $(containerId).innerHTML = counts.length ? counts.map(({ label, count }) => `
    <article class="anomaly-card"><div class="card-kicker">Signal group</div><div class="card-label">${esc(label)}</div><div class="card-count">${count.toLocaleString()}</div></article>
  `).join("") : `<p class="muted small">No anomaly data available.</p>`;
}
function downloadCSV(rows, filename) {
  if (!rows.length) { toast("No rows to download."); return; }
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const quote = value => `"${cellValue(value).replace(/"/g, '""')}"`;
  const csv = [columns.map(quote).join(","), ...rows.map(row => columns.map(c => quote(row[c])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function filteredRows(rows, filters) {
  return rows.filter(row => Object.entries(filters).every(([column, selected]) =>
    !selected || String(row[column] ?? "") === selected));
}
function showPage(name) {
  document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.id === `page-${name}`));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === name));
  $("sidebar").classList.remove("open");
  if (name === "anomalies" && !anomaliesData.length) loadAnomalies();
  if (name === "explorer" && !ticketsData.length) loadTickets();
}
async function checkConnection() {
  const status = $("connectionStatus");
  status.className = "connection-status";
  status.innerHTML = '<span class="status-dot"></span> Checking…';
  try {
    const health = await apiRequest("/api/health");
    status.classList.add("connected");
    status.innerHTML = '<span class="status-dot"></span> Connected';
    const count = health && typeof health === "object" ? health.ticket_count : null;
    $("ticketCount").textContent = count == null ? "" : `${Number(count).toLocaleString()} tickets available`;
  } catch (error) {
    status.classList.add("disconnected");
    status.innerHTML = '<span class="status-dot"></span> Disconnected';
    $("ticketCount").textContent = "Start the TicketIQ API to reconnect.";
  }
}
async function askTicketIQ() {
  const question = $("questionInput").value.trim();
  if (!question) { showMessage("queryMessage", "Enter a question before asking TicketIQ.", "error"); return; }
  const button = $("askButton");
  button.disabled = true; button.textContent = "Analyzing…";
  showMessage("queryMessage", "Analyzing your tickets…", "info");
  try {
    lastQueryResult = await apiRequest("/api/query", {
      method: "POST", body: JSON.stringify({ question }), timeout: QUERY_TIMEOUT
    });
    renderQueryResult(lastQueryResult);
    showMessage("queryMessage", "Analysis complete.", "success");
  } catch (error) {
    showMessage("queryMessage", `Could not reach TicketIQ API (${API_BASE_URL}). ${error.message}`, "error");
  } finally { button.disabled = false; button.innerHTML = 'Ask TicketIQ <span>→</span>'; }
}
function renderQueryResult(result) {
  $("queryResultSection").hidden = false;
  const answer = result && typeof result === "object" ? (result.answer ?? result.result ?? result) : result;
  const target = $("queryResult");
  if (Array.isArray(answer)) {
    renderTable("queryResult", answer, "No tabular results were found.");
    if (answer.length) addDownloadButton(target, answer, "ticketiq_query_results.csv");
  } else if (answer && typeof answer === "object") {
    const key = ["tickets", "data", "results", "records", "rows"].find(k => Array.isArray(answer[k]));
    if (key) {
      renderTable("queryResult", answer[key], "No tabular results were found.");
      if (answer[key].length) addDownloadButton(target, answer[key], "ticketiq_query_results.csv");
    } else target.innerHTML = `<div class="answer-box">${esc(JSON.stringify(answer, null, 2))}</div>`;
  } else target.innerHTML = `<div class="answer-box">${esc(answer)}</div>`;
}
function addDownloadButton(container, rows, filename) {
  const button = document.createElement("button");
  button.className = "btn primary download-btn"; button.textContent = "↓ Download query results";
  button.addEventListener("click", () => downloadCSV(recordsToRows(rows), filename));
  container.appendChild(button);
}
async function loadAnomalies() {
  showMessage("anomalyMessage", "Loading anomaly data…", "info");
  try {
    const payload = await apiRequest("/api/anomalies");
    anomaliesData = extractRecords(payload, ["anomalies", "data", "results", "records"]);
    const typeCol = findColumn(anomaliesData, ["anomaly_type", "type", "anomaly"]);
    const severityCol = findColumn(anomaliesData, ["severity", "anomaly_severity"]);
    const total = payload && typeof payload === "object" && payload.total_count != null ? Number(payload.total_count) : anomaliesData.length;
    const critical = severityCol ? anomaliesData.filter(r => normalized(r[severityCol]) === "critical").length : 0;
    $("anomalyMetrics").innerHTML = `
      <div class="stat-card"><div class="stat-kicker">All signals</div><div class="stat-label">Total anomalies</div><div class="stat-value">${total.toLocaleString()}</div></div>
      <div class="stat-card"><div class="stat-kicker">Needs attention</div><div class="stat-label">Critical anomalies</div><div class="stat-value">${critical.toLocaleString()}</div></div>`;
    const typeCounts = countBy(anomaliesData, typeCol), severityCounts = countBy(anomaliesData, severityCol);
    renderCountCards("typeCards", typeCounts); renderTable("typeTable", typeCounts.map(x => ({ anomaly_type: x.label, count: x.count })));
    renderCountCards("severityCards", severityCounts); renderTable("severityTable", severityCounts.map(x => ({ severity: x.label, count: x.count })));
    setOptions("anomalyTypeFilter", typeCol ? anomaliesData.map(r => r[typeCol]) : []);
    setOptions("anomalySeverityFilter", severityCol ? anomaliesData.map(r => r[severityCol]) : []);
    $("anomalyTypeFilter").dataset.column = typeCol || "";
    $("anomalySeverityFilter").dataset.column = severityCol || "";
    renderFilteredAnomalies();
    showMessage("anomalyMessage", anomaliesData.length ? "" : "No anomalies were returned by the API.", "info");
  } catch (error) {
    showMessage("anomalyMessage", `Could not load anomalies from ${API_BASE_URL}. ${error.message}`, "error");
  }
}
function renderFilteredAnomalies() {
  const typeSelect = $("anomalyTypeFilter"), severitySelect = $("anomalySeverityFilter");
  const typeCol = typeSelect.dataset.column, severityCol = severitySelect.dataset.column;
  const filters = {};
  if (typeCol) filters[typeCol] = typeSelect.value;
  if (severityCol) filters[severityCol] = severitySelect.value;
  const rows = filteredRows(anomaliesData, filters);
  const hasFilter = Object.values(filters).some(Boolean);
  $("filteredAnomalyCount").textContent = hasFilter ? `${rows.length.toLocaleString()} matching anomalies` : "";
  if (!hasFilter) $("filteredAnomalies").innerHTML = '<p class="muted small">Choose an anomaly type or severity to display matching records.</p>';
  else renderTable("filteredAnomalies", rows, "No anomalies match the selected filters.");
  $("downloadAnomalies").hidden = !hasFilter || !rows.length;
  $("downloadAnomalies").onclick = () => downloadCSV(rows, "ticketiq_filtered_anomalies.csv");
}
async function loadTickets() {
  showMessage("ticketsMessage", "Loading tickets…", "info");
  try {
    const payload = await apiRequest("/api/tickets");
    ticketsData = extractRecords(payload, ["tickets", "data", "results", "records"]);
    if (!ticketsData.length) {
      $("ticketMetric").innerHTML = ""; $("ticketTable").innerHTML = "";
      $("ticketShownCount").textContent = "";
      showMessage("ticketsMessage", "No tickets were returned by the API.", "info"); return;
    }
    renderMetric("ticketMetric", "Total tickets", ticketsData.length.toLocaleString(), "Current dataset");
    for (const field of ["category", "priority", "status"]) {
      const column = findColumn(ticketsData, [field]);
      const selectId = `${field}Filter`;
      $(selectId).dataset.column = column || "";
      setOptions(selectId, column ? ticketsData.map(r => r[column]) : []);
      $(selectId).disabled = !column;
    }
    renderFilteredTickets();
    showMessage("ticketsMessage", "");
  } catch (error) {
    showMessage("ticketsMessage", `Could not load tickets from ${API_BASE_URL}. ${error.message}`, "error");
  }
}
function renderFilteredTickets() {
  const filters = {};
  ["category", "priority", "status"].forEach(field => {
    const select = $(`${field}Filter`);
    if (select.dataset.column) filters[select.dataset.column] = select.value;
  });
  const rows = filteredRows(ticketsData, filters);
  $("ticketShownCount").textContent = `${rows.length.toLocaleString()} shown`;
  renderTable("ticketTable", rows, "No tickets match the selected filters.");
  $("downloadTickets").hidden = !rows.length;
  $("downloadTickets").onclick = () => downloadCSV(rows, "ticketiq_filtered_tickets.csv");
}

function initialize() {
  // Sidebar id is assigned here to keep markup simple.
  document.querySelector(".sidebar").id = "sidebar";
  $("examples").innerHTML = EXAMPLE_QUESTIONS.map((q, i) => `<button class="example-btn" data-example="${i}">${esc(q)}</button>`).join("");
  $("examples").addEventListener("click", event => {
    const button = event.target.closest("[data-example]");
    if (button) { $("questionInput").value = EXAMPLE_QUESTIONS[Number(button.dataset.example)]; $("questionInput").focus(); }
  });
  document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));
  $("checkConnection").addEventListener("click", checkConnection);
  $("askButton").addEventListener("click", askTicketIQ);
  $("questionInput").addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") askTicketIQ(); });
  $("refreshAnomalies").addEventListener("click", loadAnomalies);
  $("refreshTickets").addEventListener("click", loadTickets);
  $("anomalyTypeFilter").addEventListener("change", renderFilteredAnomalies);
  $("anomalySeverityFilter").addEventListener("change", renderFilteredAnomalies);
  ["categoryFilter", "priorityFilter", "statusFilter"].forEach(id => $(id).addEventListener("change", renderFilteredTickets));
  $("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  checkConnection();
}
document.addEventListener("DOMContentLoaded", initialize);
