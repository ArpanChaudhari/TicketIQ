// TicketIQ frontend.
// Set API_BASE_URL to your FastAPI server address.
const API_BASE_URL = "http://localhost:8000";
const REQUEST_TIMEOUT = 30000;
const QUERY_TIMEOUT = 90000;

// Example questions to help the user get started
const EXAMPLE_QUESTIONS = [
  "Show me all Critical tickets not resolved within 12 hours.",
  "How many tickets are currently Open?",
  "Show me all High-priority tickets.",
  "Which category has the most support tickets?",
  "Show me tickets with customer ratings below 3.",
  "Which agents have the highest number of unresolved tickets?",
];

// Global variables to store our data locally so we don't have to fetch it every time
let anomaliesData = [];
let ticketsData = [];
let lastQueryResult = null;

/**
 * Helper function to quickly get an HTML element by its ID.
 */
function getElement(id) {
  return document.getElementById(id);
}

/**
 * Escapes special characters to prevent XSS (Cross-Site Scripting).
 * This ensures that any data we display doesn't break the HTML.
 */
function escapeHTML(value) {
  if (value === null || value === undefined) {
    return "";
  }
  
  const stringValue = String(value);
  const escapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  
  return stringValue.replace(/[&<>"']/g, function(character) {
    return escapeMap[character];
  });
}

/**
 * Makes column names look nicer (e.g., 'ticket_id' becomes 'ticket id').
 */
function makePretty(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replaceAll("_", " ");
}

/**
 * Normalizes text for easy comparison (lowercase, trimmed, spaces instead of underscores).
 */
function normalizeText(value) {
  return makePretty(value).trim().toLowerCase();
}

/**
 * Shows a message in a specific container on the page.
 */
function showMessage(elementId, text = "", messageType = "info") {
  const element = getElement(elementId);
  element.textContent = text;
  
  if (text !== "") {
    element.className = `message ${messageType}`;
  } else {
    element.className = "message"; // Clear classes if there is no text
  }
}

/**
 * Shows a small toast popup message at the bottom of the screen.
 */
function showToast(text) {
  const element = getElement("toast");
  element.textContent = text;
  element.style.display = "block";
  
  // Hide the toast after 3 seconds
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(function() {
    element.style.display = "none";
  }, 3000);
}

/**
 * Makes an HTTP request to our FastAPI backend.
 */
async function apiRequest(endpoint, options = {}) {
  // Setup a timeout so the request doesn't hang forever
  const controller = new AbortController();
  const timeoutLimit = options.timeout || REQUEST_TIMEOUT;
  const timeoutId = setTimeout(function() {
    controller.abort();
  }, timeoutLimit);

  try {
    // Configure headers for JSON data
    const headers = {};
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }
    
    // Add any custom headers passed in options
    Object.assign(headers, options.headers || {});

    // Make the actual fetch request
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: options.method || "GET",
      body: options.body,
      headers: headers,
      signal: controller.signal
    });

    // Read the response text
    const rawText = await response.text();
    let data;
    
    // Try to parse the response as JSON
    try {
      if (rawText !== "") {
        data = JSON.parse(rawText);
      } else {
        data = null;
      }
    } catch (parseError) {
      // If it's not JSON, just keep the raw text
      data = rawText;
    }

    // Check if the server returned an error (like a 404 or 500 status)
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      if (data !== null && typeof data === "object") {
        errorMessage = data.detail || data.message || errorMessage;
      } else if (typeof data === "string") {
        errorMessage = data;
      }
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    // Handle the abort timeout specifically
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Check that the API is running.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Finds the actual array of data inside a complex API response object.
 */
function extractRecords(payload, possibleKeys) {
  // If it's already an array, return it
  if (Array.isArray(payload)) {
    return payload;
  }
  
  // If it's not an object, there are no records
  if (payload === null || typeof payload !== "object") {
    return [];
  }
  
  // Search through common keys to find the array of data
  for (const key of possibleKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }
  
  return [];
}

/**
 * Makes sure data is an array of objects so we can put it in a table.
 */
function recordsToRows(data) {
  if (Array.isArray(data)) {
    // Make sure each item in the array is an object
    return data.map(function(item) {
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        return item; // It's already an object
      } else {
        return { value: item }; // Wrap primitive values in an object
      }
    });
  }
  
  // If it's a single object, wrap it in an array
  if (data !== null && typeof data === "object") {
    return [data];
  }
  
  return [];
}

/**
 * Finds the name of a specific column, ignoring case and underscores.
 */
function findColumn(rows, possibleNames) {
  if (rows.length === 0) {
    return null;
  }
  
  const columns = Object.keys(rows[0]);
  
  for (const name of possibleNames) {
    const foundColumn = columns.find(function(col) {
      return normalizeText(col) === normalizeText(name);
    });
    
    if (foundColumn) {
      return foundColumn;
    }
  }
  
  return null;
}

/**
 * Fills a <select> dropdown with unique options from the dataset.
 */
function setOptions(selectId, values, allLabel = "All") {
  const selectElement = getElement(selectId);
  const currentSelection = selectElement.value;
  
  // Filter out empty or null values
  const validValues = values.filter(function(v) {
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
  
  // Convert all values to strings and remove duplicates using a Set
  const uniqueValues = [...new Set(validValues.map(String))];
  
  // Sort alphabetically
  uniqueValues.sort(function(a, b) {
    return a.localeCompare(b);
  });
  
  // Build the HTML for the dropdown options
  let html = `<option value="">${escapeHTML(allLabel)}</option>`;
  for (const val of uniqueValues) {
    html += `<option value="${escapeHTML(val)}">${escapeHTML(val)}</option>`;
  }
  
  selectElement.innerHTML = html;
  
  // Restore the previous selection if it still exists
  let optionExists = false;
  for (let i = 0; i < selectElement.options.length; i++) {
    if (selectElement.options[i].value === currentSelection) {
      optionExists = true;
      break;
    }
  }
  
  if (optionExists) {
    selectElement.value = currentSelection;
  }
}

/**
 * Converts a Javascript value into a string for display in a table cell.
 */
function cellValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Builds an HTML table to display data rows.
 */
function renderTable(containerId, inputRows, emptyText = "No records to display.") {
  const rows = recordsToRows(inputRows);
  const container = getElement(containerId);
  
  // If there are no rows, display the empty text message
  if (rows.length === 0) {
    container.innerHTML = `<p class="muted small">${escapeHTML(emptyText)}</p>`;
    return;
  }
  
  // Get all unique column names from all rows
  const columnsSet = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnsSet.add(key);
    }
  }
  const columns = Array.from(columnsSet);
  
  // Build the Table Header HTML
  let headerHtml = "<tr>";
  for (const col of columns) {
    headerHtml += `<th title="${escapeHTML(col)}">${escapeHTML(makePretty(col))}</th>`;
  }
  headerHtml += "</tr>";
  
  // Build the Table Body HTML
  let bodyHtml = "";
  for (const row of rows) {
    bodyHtml += "<tr>";
    for (const col of columns) {
      const val = cellValue(row[col]);
      bodyHtml += `<td title="${escapeHTML(val)}">${escapeHTML(val)}</td>`;
    }
    bodyHtml += "</tr>";
  }
  
  // Put it all together inside the container
  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          ${headerHtml}
        </thead>
        <tbody>
          ${bodyHtml}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Displays a statistic in a dashboard card.
 */
function renderMetric(containerId, label, value, kicker) {
  getElement(containerId).innerHTML = `
    <div class="stat-card">
      <div class="stat-kicker">${escapeHTML(kicker)}</div>
      <div class="stat-label">${escapeHTML(label)}</div>
      <div class="stat-value">${escapeHTML(value)}</div>
    </div>
  `;
}

/**
 * Counts how many times each value appears in a specific column.
 * Example: How many 'High', 'Medium', and 'Low' priority tickets exist?
 */
function countBy(rows, column) {
  if (!column) {
    return [];
  }
  
  const countsMap = new Map();
  
  for (const row of rows) {
    let label;
    if (row[column] === null || row[column] === undefined || row[column] === "") {
      label = "Unknown";
    } else {
      label = String(row[column]);
    }
    
    // Increment the count for this label
    const currentCount = countsMap.get(label) || 0;
    countsMap.set(label, currentCount + 1);
  }
  
  // Convert the Map to an Array and sort from highest to lowest count
  const results = [];
  for (const [label, count] of countsMap.entries()) {
    results.push({ label: label, count: count });
  }
  
  results.sort(function(a, b) {
    return b.count - a.count;
  });
  
  return results;
}

/**
 * Builds HTML cards for each category count (e.g. Anomaly Types).
 */
function renderCountCards(containerId, counts) {
  if (counts.length === 0) {
    getElement(containerId).innerHTML = `<p class="muted small">No anomaly data available.</p>`;
    return;
  }
  
  let html = "";
  for (const item of counts) {
    html += `
      <article class="anomaly-card">
        <div class="card-kicker">Signal group</div>
        <div class="card-label">${escapeHTML(item.label)}</div>
        <div class="card-count">${item.count.toLocaleString()}</div>
      </article>
    `;
  }
  
  getElement(containerId).innerHTML = html;
}

/**
 * Downloads a list of rows as a CSV file to the user's computer.
 */
function downloadCSV(rows, filename) {
  if (rows.length === 0) {
    showToast("No rows to download.");
    return;
  }
  
  // Get all unique columns
  const columnsSet = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnsSet.add(key);
    }
  }
  const columns = Array.from(columnsSet);
  
  // Helper to safely format values for CSV
  function formatForCSV(value) {
    const stringVal = cellValue(value);
    // Escape double quotes by doubling them, and wrap the whole string in quotes
    return `"${stringVal.replace(/"/g, '""')}"`;
  }
  
  // Build the CSV string
  const csvLines = [];
  
  // Add Header Row
  const headerStrings = columns.map(formatForCSV);
  csvLines.push(headerStrings.join(","));
  
  // Add Data Rows
  for (const row of rows) {
    const rowValues = [];
    for (const col of columns) {
      rowValues.push(formatForCSV(row[col]));
    }
    csvLines.push(rowValues.join(","));
  }
  
  const finalCsvString = csvLines.join("\r\n");
  
  // Create a Blob (file data) and trigger a download
  const blob = new Blob(["\uFEFF" + finalCsvString], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Filters a list of rows based on matching criteria.
 */
function filteredRows(rows, filters) {
  return rows.filter(function(row) {
    // Check every filter condition
    for (const [column, requiredValue] of Object.entries(filters)) {
      // If a filter is selected, but the row doesn't match, exclude this row
      if (requiredValue !== "") {
        const rowValue = String(row[column] ?? "");
        if (rowValue !== requiredValue) {
          return false; // Row does not match, throw it out
        }
      }
    }
    return true; // Row passed all filters!
  });
}

/**
 * Switches the active tab/page on the screen.
 */
function showPage(pageName) {
  // Hide all pages, and show the target one
  const allPages = document.querySelectorAll(".page");
  for (const page of allPages) {
    if (page.id === `page-${pageName}`) {
      page.classList.add("active");
    } else {
      page.classList.remove("active");
    }
  }
  
  // Update the sidebar navigation buttons
  const allNavItems = document.querySelectorAll(".nav-item");
  for (const item of allNavItems) {
    if (item.dataset.page === pageName) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  }
  
  // Close the mobile menu if it is open
  getElement("sidebar").classList.remove("open");
  
  // Load data for the selected page if we haven't already
  if (pageName === "anomalies" && anomaliesData.length === 0) {
    loadAnomalies();
  }
  if (pageName === "explorer" && ticketsData.length === 0) {
    loadTickets();
  }
}

/**
 * Checks if the FastAPI backend is running and connects to it.
 */
async function checkConnection() {
  const statusElement = getElement("connectionStatus");
  const ticketCountElement = getElement("ticketCount");
  
  statusElement.className = "connection-status";
  statusElement.innerHTML = '<span class="status-dot"></span> Checking...';
  
  try {
    const healthData = await apiRequest("/api/health");
    
    // Connection Successful!
    statusElement.classList.add("connected");
    statusElement.innerHTML = '<span class="status-dot"></span> Connected';
    
    let count = null;
    if (healthData !== null && typeof healthData === "object") {
      count = healthData.ticket_count;
    }
    
    if (count !== null) {
      ticketCountElement.textContent = `${Number(count).toLocaleString()} tickets available`;
    } else {
      ticketCountElement.textContent = "";
    }

    // Refresh current page data if it was already loaded
    if (anomaliesData.length > 0) {
      loadAnomalies();
    }
    if (ticketsData.length > 0) {
      loadTickets();
    }
    
  } catch (error) {
    // Connection Failed!
    statusElement.classList.add("disconnected");
    statusElement.innerHTML = '<span class="status-dot"></span> Disconnected';
    ticketCountElement.textContent = "Start the TicketIQ API to reconnect.";
  }
}

/**
 * Sends the user's natural language question to the LLM backend.
 */
async function askTicketIQ() {
  const inputElement = getElement("questionInput");
  const question = inputElement.value.trim();
  
  if (question === "") {
    showMessage("queryMessage", "Enter a question before asking TicketIQ.", "error");
    return;
  }
  
  const askButton = getElement("askButton");
  askButton.disabled = true;
  askButton.textContent = "Analyzing...";
  
  showMessage("queryMessage", "Analyzing your tickets...", "info");
  
  try {
    const response = await apiRequest("/api/query", {
      method: "POST",
      body: JSON.stringify({ question: question }),
      timeout: QUERY_TIMEOUT,
    });
    
    lastQueryResult = response;
    renderQueryResult(lastQueryResult);
    showMessage("queryMessage", "Analysis complete.", "success");
    
  } catch (error) {
    showMessage("queryMessage", `Could not reach TicketIQ API (${API_BASE_URL}). ${error.message}`, "error");
  } finally {
    // Reset the button state
    askButton.disabled = false;
    askButton.innerHTML = "Ask TicketIQ <span>&rarr;</span>";
  }
}

/**
 * Displays the answer returned by the LLM.
 */
function renderQueryResult(result) {
  getElement("queryResultSection").hidden = false;
  
  // Extract the actual answer from the response object
  let answer = result;
  if (result !== null && typeof result === "object") {
    if (result.answer !== undefined) {
      answer = result.answer;
    } else if (result.result !== undefined) {
      answer = result.result;
    }
  }
  
  const targetContainer = getElement("queryResult");
  const countBadge = getElement("queryResultCount");

  if (Array.isArray(answer)) {
    // Scenario 1: The answer is an array (a table of data)
    countBadge.textContent = `${answer.length.toLocaleString()} rows`;
    renderTable("queryResult", answer, "No tabular results were found.");
    if (answer.length > 0) {
      addDownloadButton(targetContainer, answer, "ticketiq_query_results.csv");
    }
    
  } else if (answer !== null && typeof answer === "object") {
    // Scenario 2: The answer is an object containing an array inside it
    const arrayKeys = ["tickets", "data", "results", "records", "rows"];
    let foundArrayKey = null;
    
    for (const key of arrayKeys) {
      if (Array.isArray(answer[key])) {
        foundArrayKey = key;
        break;
      }
    }
    
    if (foundArrayKey !== null) {
      const dataArray = answer[foundArrayKey];
      countBadge.textContent = `${dataArray.length.toLocaleString()} rows`;
      renderTable("queryResult", dataArray, "No tabular results were found.");
      if (dataArray.length > 0) {
        addDownloadButton(targetContainer, dataArray, "ticketiq_query_results.csv");
      }
    } else {
      // Scenario 3: The answer is a single object (1 row)
      countBadge.textContent = "1 row";
      renderTable("queryResult", [answer], "No tabular results were found.");
    }
    
  } else {
    // Scenario 4: The answer is a simple text string or number
    countBadge.textContent = "";
    targetContainer.innerHTML = `<div class="answer-box">${escapeHTML(answer)}</div>`;
  }
}

/**
 * Adds a "Download CSV" button to the UI dynamically.
 */
function addDownloadButton(container, rows, filename) {
  const button = document.createElement("button");
  button.className = "btn primary download-btn";
  button.textContent = "\u2193 Download query results"; // Down arrow
  
  button.addEventListener("click", function() {
    downloadCSV(recordsToRows(rows), filename);
  });
  
  container.appendChild(button);
}

/**
 * Loads the anomaly data from the backend.
 */
async function loadAnomalies() {
  showMessage("anomalyMessage", "Loading anomaly data...", "info");
  
  try {
    const payload = await apiRequest("/api/anomalies");
    
    // Extract the list of anomalies from the response
    anomaliesData = extractRecords(payload, ["anomalies", "data", "results", "records"]);
    
    // Automatically find which column names the API used for Type and Severity
    const typeCol = findColumn(anomaliesData, ["anomaly_type", "type", "anomaly"]);
    const severityCol = findColumn(anomaliesData, ["severity", "anomaly_severity"]);
    
    // Calculate total anomalies
    let totalCount = anomaliesData.length;
    if (payload !== null && typeof payload === "object" && payload.total_count !== undefined) {
      totalCount = Number(payload.total_count);
    }
    
    // Calculate critical anomalies
    let criticalCount = 0;
    if (severityCol) {
      criticalCount = anomaliesData.filter(function(row) {
        return normalizeText(row[severityCol]) === "critical";
      }).length;
    }
    
    // Render the top summary metrics
    getElement("anomalyMetrics").innerHTML = `
      <div class="stat-card">
        <div class="stat-kicker">All signals</div>
        <div class="stat-label">Total anomalies</div>
        <div class="stat-value">${totalCount.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-kicker">Needs attention</div>
        <div class="stat-label">Critical anomalies</div>
        <div class="stat-value">${criticalCount.toLocaleString()}</div>
      </div>
    `;
    
    // Render the breakdowns by Type and Severity
    const typeCounts = countBy(anomaliesData, typeCol);
    const severityCounts = countBy(anomaliesData, severityCol);
    
    renderCountCards("typeCards", typeCounts);
    renderTable("typeTable", typeCounts.map(x => ({ anomaly_type: x.label, count: x.count })));
    
    renderCountCards("severityCards", severityCounts);
    renderTable("severityTable", severityCounts.map(x => ({ severity: x.label, count: x.count })));
    
    // Populate the dropdown filters
    const allTypes = typeCol ? anomaliesData.map(r => r[typeCol]) : [];
    setOptions("anomalyTypeFilter", allTypes);
    
    const allSeverities = severityCol ? anomaliesData.map(r => r[severityCol]) : [];
    setOptions("anomalySeverityFilter", allSeverities);
    
    // Save which column each filter maps to
    getElement("anomalyTypeFilter").dataset.column = typeCol || "";
    getElement("anomalySeverityFilter").dataset.column = severityCol || "";
    
    // Display the filtered table
    renderFilteredAnomalies();
    
    if (anomaliesData.length > 0) {
      showMessage("anomalyMessage", "", "info"); // Clear the message
    } else {
      showMessage("anomalyMessage", "No anomalies were returned by the API.", "info");
    }
    
  } catch (error) {
    showMessage("anomalyMessage", `Could not load anomalies from ${API_BASE_URL}. ${error.message}`, "error");
  }
}

/**
 * Refreshes the anomalies table when the user changes a filter dropdown.
 */
function renderFilteredAnomalies() {
  const typeSelect = getElement("anomalyTypeFilter");
  const severitySelect = getElement("anomalySeverityFilter");
  
  // Read the selected values and which columns they correspond to
  const typeCol = typeSelect.dataset.column;
  const severityCol = severitySelect.dataset.column;
  
  const filters = {};
  if (typeCol) {
    filters[typeCol] = typeSelect.value;
  }
  if (severityCol) {
    filters[severityCol] = severitySelect.value;
  }
  
  // Filter the raw data
  const matchingRows = filteredRows(anomaliesData, filters);
  
  // Check if the user has actually selected any filter
  let hasFilter = false;
  for (const val of Object.values(filters)) {
    if (val !== "") hasFilter = true;
  }
  
  // Update the UI
  const countDisplay = getElement("filteredAnomalyCount");
  const downloadButton = getElement("downloadAnomalies");
  
  if (hasFilter) {
    countDisplay.textContent = `${matchingRows.length.toLocaleString()} matching anomalies`;
    renderTable("filteredAnomalies", matchingRows, "No anomalies match the selected filters.");
    
    downloadButton.hidden = matchingRows.length === 0;
    downloadButton.onclick = function() {
      downloadCSV(matchingRows, "ticketiq_filtered_anomalies.csv");
    };
  } else {
    countDisplay.textContent = "";
    getElement("filteredAnomalies").innerHTML = '<p class="muted small">Choose an anomaly type or severity to display matching records.</p>';
    downloadButton.hidden = true;
  }
}

/**
 * Loads the raw ticket data from the backend.
 */
async function loadTickets() {
  showMessage("ticketsMessage", "Loading tickets...", "info");
  
  try {
    const payload = await apiRequest("/api/tickets");
    ticketsData = extractRecords(payload, ["tickets", "data", "results", "records"]);
    
    if (ticketsData.length === 0) {
      getElement("ticketMetric").innerHTML = "";
      getElement("ticketTable").innerHTML = "";
      getElement("ticketShownCount").textContent = "";
      showMessage("ticketsMessage", "No tickets were returned by the API.", "info");
      return;
    }
    
    // Display total metric
    renderMetric("ticketMetric", "Total tickets", ticketsData.length.toLocaleString(), "Current dataset");
    
    // Populate the dropdown filters for Category, Priority, and Status
    const filterFields = ["category", "priority", "status"];
    
    for (const field of filterFields) {
      const actualColumnName = findColumn(ticketsData, [field]);
      const selectElement = getElement(`${field}Filter`);
      
      selectElement.dataset.column = actualColumnName || "";
      
      const allValues = actualColumnName ? ticketsData.map(r => r[actualColumnName]) : [];
      setOptions(selectElement.id, allValues);
      
      selectElement.disabled = !actualColumnName; // Disable if column doesn't exist
    }
    
    renderFilteredTickets();
    showMessage("ticketsMessage", ""); // Clear message on success
    
  } catch (error) {
    showMessage("ticketsMessage", `Could not load tickets from ${API_BASE_URL}. ${error.message}`, "error");
  }
}

/**
 * Refreshes the tickets table when the user changes a filter dropdown.
 */
function renderFilteredTickets() {
  const filterFields = ["category", "priority", "status"];
  const filters = {};
  
  // Read all the currently selected values from the dropdowns
  for (const field of filterFields) {
    const selectElement = getElement(`${field}Filter`);
    const columnName = selectElement.dataset.column;
    
    if (columnName) {
      filters[columnName] = selectElement.value;
    }
  }
  
  // Apply the filters to the data
  const matchingRows = filteredRows(ticketsData, filters);
  
  // Update the UI
  getElement("ticketShownCount").textContent = `${matchingRows.length.toLocaleString()} shown`;
  renderTable("ticketTable", matchingRows, "No tickets match the selected filters.");
  
  const downloadButton = getElement("downloadTickets");
  downloadButton.hidden = matchingRows.length === 0;
  downloadButton.onclick = function() {
    downloadCSV(matchingRows, "ticketiq_filtered_tickets.csv");
  };
}

/**
 * This function runs automatically when the webpage first loads.
 * It sets up all the button clicks and initializes the app.
 */
function initialize() {
  // Setup the sidebar
  document.querySelector(".sidebar").id = "sidebar";
  
  // Render the example questions buttons
  let examplesHtml = "";
  for (let i = 0; i < EXAMPLE_QUESTIONS.length; i++) {
    examplesHtml += `<button class="example-btn" data-example="${i}">${escapeHTML(EXAMPLE_QUESTIONS[i])}</button>`;
  }
  getElement("examples").innerHTML = examplesHtml;
  
  // When an example is clicked, fill the input box
  getElement("examples").addEventListener("click", function(event) {
    const button = event.target.closest("[data-example]");
    if (button) {
      const questionIndex = Number(button.dataset.example);
      const inputElement = getElement("questionInput");
      
      inputElement.value = EXAMPLE_QUESTIONS[questionIndex];
      inputElement.focus();
    }
  });
  
  // Setup Navigation Tab clicks
  const navButtons = document.querySelectorAll(".nav-item");
  for (const button of navButtons) {
    button.addEventListener("click", function() {
      showPage(button.dataset.page);
    });
  }
  
  // Setup top-level button clicks
  getElement("checkConnection").addEventListener("click", checkConnection);
  getElement("askButton").addEventListener("click", askTicketIQ);
  
  // Allow hitting Ctrl+Enter or Cmd+Enter to submit a question
  getElement("questionInput").addEventListener("keydown", function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      askTicketIQ();
    }
  });
  
  // Setup Data Refresh buttons
  getElement("refreshAnomalies").addEventListener("click", loadAnomalies);
  getElement("refreshTickets").addEventListener("click", loadTickets);
  
  // Setup Dropdown Filter changes
  getElement("anomalyTypeFilter").addEventListener("change", renderFilteredAnomalies);
  getElement("anomalySeverityFilter").addEventListener("change", renderFilteredAnomalies);
  
  getElement("categoryFilter").addEventListener("change", renderFilteredTickets);
  getElement("priorityFilter").addEventListener("change", renderFilteredTickets);
  getElement("statusFilter").addEventListener("change", renderFilteredTickets);
  
  // Setup mobile menu
  getElement("mobileMenu").addEventListener("click", function() {
    getElement("sidebar").classList.toggle("open");
  });
  
  // Initial check to verify if API is running
  checkConnection();
}

// Wait for the browser to finish loading the HTML before running our code
document.addEventListener("DOMContentLoaded", initialize);
