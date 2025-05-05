// auth-check.js - Add this to index.html
document.addEventListener('DOMContentLoaded', function() {
  checkAuth();
  setupLogoutButton();

  // Replace the original loadCalendar, loadCampaigns, and loadJobsGallery functions
  window.originalLoadCalendar = window.loadCalendar;
  window.originalLoadCampaigns = window.loadCampaigns;
  window.originalLoadJobsGallery = window.loadJobsGallery;

  // Replace with authenticated versions
  window.loadCalendar = loadCalendarWithAuth;
  window.loadCampaigns = loadCampaignsWithAuth;
  window.loadJobsGallery = loadJobsGalleryWithAuth;
});

// Check if user is logged in
function checkAuth() {
  const token = localStorage.getItem('authToken');
  const agencyName = localStorage.getItem('agencyName');

  // If no token, redirect to login page
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }

  // Add user info element if it doesn't exist
  if (!document.getElementById('userInfo')) {
    const userControls = document.createElement('div');
    userControls.className = 'user-controls';
    userControls.innerHTML = `
      <div id="userInfo" class="user-info">Agency: ${agencyName || 'Unknown'}</div>
      <button id="logoutBtn" class="logout-btn">Log Out</button>
    `;

    // Add it to the top of the body, after the company header
    const globalHeader = document.querySelector('.global-header');
    if (globalHeader) {
      globalHeader.parentNode.insertBefore(userControls, globalHeader.nextSibling);
    } else {
      const firstChild = document.body.firstChild;
      document.body.insertBefore(userControls, firstChild);
    }

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .user-controls {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        margin-bottom: 15px;
        padding: 10px;
      }
      .user-info {
        margin-right: 15px;
        font-size: 14px;
        font-weight: bold;
      }
      .logout-btn {
        background: #6c757d;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
      }
      .logout-btn:hover {
        background: #5a6268;
      }
    `;
    document.head.appendChild(style);

    // Setup the logout button
    setupLogoutButton();
  } else {
    // Update user info if it exists
    document.getElementById('userInfo').textContent = `Agency: ${agencyName || 'Unknown'}`;
  }

  return true;
}

// Set up logout button
function setupLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

// Handle logout
function logout() {
  // Clear authentication data
  localStorage.removeItem('authToken');
  localStorage.removeItem('agencyId');
  localStorage.removeItem('agencyName');

  // Redirect to login page
  window.location.href = 'login.html';
}

// Modified fetchData function with authentication
async function fetchDataWithAuth(endpoint) {
  try {
    const token = localStorage.getItem('authToken');

    if (!token) {
      // No auth token, redirect to login
      window.location.href = 'login.html';
      return { error: 'Authentication required' };
    }

    const response = await fetch('/.netlify/functions/' + endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    // Check for authentication errors
    if (!response.ok) {
      if (response.status === 401) {
        // Auth error, redirect to login
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
        return { error: 'Authentication required' };
      }
      return { error: data.error || 'Server error' };
    }

    return data;
  } catch (err) {
    return { error: err.message };
  }
}

// Authenticated loadCalendar function
async function loadCalendarWithAuth() {
  const container = document.getElementById('calendarTableContainer');
  container.innerHTML = '<p>Loading contracts...</p>';
  try {
    if (currentRecords.length === 0) {
      const data = await fetchDataWithAuth('fetchJobs');
      if (data.error || !data.records) {
        container.innerHTML = '<p class="error">Error loading contracts: ' + (data.error || 'Unknown error') + '</p>';
        return;
      }

      // Store raw records and process them
      rawAirtableRecords = data.records;
      debug(`Received ${rawAirtableRecords.length} raw records from Airtable`);

      currentRecords = processRecords(rawAirtableRecords);
      const advertisers = extractAdvertisers();
      updateAdvertiserDropdowns(advertisers);

      // Update header with agency name if available
      if (data.agencyInfo && data.agencyInfo.name) {
        const agencyName = data.agencyInfo.name;
        document.title = `${agencyName} - PaloPay Client Portal`;
        const globalHeader = document.querySelector('.global-header');
        if (globalHeader) {
          const originalText = globalHeader.textContent.trim();
          globalHeader.textContent = `${originalText} - ${agencyName}`;
        }
      }
    }

    const filteredRecords = filterRecords(currentRecords);
    renderJobsTable(filteredRecords);
    renderTimeline(filteredRecords);

    // Center on today
    setTimeout(() => {
      const containerEl = document.getElementById('timeline-container');
      const todayMarker = containerEl.querySelector('.timeline-today');
      if (todayMarker) {
        containerEl.scrollLeft = todayMarker.offsetLeft - (containerEl.clientWidth / 2);
      }
    }, 100);
  } catch (err) {
    container.innerHTML = '<p class="error">Error loading contracts: ' + err.message + '</p>';
    debug(`Error in loadCalendar: ${err.message}`);
  }
}

// Authenticated loadCampaigns function
async function loadCampaignsWithAuth() {
  const container = document.getElementById('campaignGalleryContent');
  container.innerHTML = '<p>Loading campaigns...</p>';
  try {
    document.getElementById('campaignJobsContainer').style.display = 'none';
    if (currentRecords.length > 0) {
      renderCampaignsFromRecords();
      return;
    }

    const data = await fetchDataWithAuth('fetchJobs');
    if (data.error || !data.records) {
      container.innerHTML = '<p class="error">Error loading campaigns: ' + (data.error || 'Unknown error') + '</p>';
      return;
    }

    // Store raw records and process them
    rawAirtableRecords = data.records;
    currentRecords = processRecords(rawAirtableRecords);

    try {
      const advertisers = extractAdvertisers();
      updateAdvertiserDropdowns(advertisers);
    } catch (error) {
      debug(`Error during advertiser filter update: ${error.message}`);
    }

    renderCampaignsFromRecords();
  } catch (err) {
    container.innerHTML = '<p class="error">Error loading campaigns: ' + err.message + '</p>';
    debug(`Error in loadCampaigns: ${err.message}`);
  }
}

// Authenticated loadJobsGallery function
async function loadJobsGalleryWithAuth() {
  const container = document.querySelector('#jobsGalleryContent .jobs-table-wrapper');
  container.innerHTML = '<p>Loading jobs...</p>';
  try {
    if (currentRecords.length > 0) {
      renderJobsGallery();
      return;
    }

    const data = await fetchDataWithAuth('fetchJobs');
    if (data.error || !data.records) {
      container.innerHTML = '<p class="error">Error loading jobs: ' + (data.error || 'Unknown error') + '</p>';
      return;
    }

    // Store raw records and process them
    rawAirtableRecords = data.records;
    currentRecords = processRecords(rawAirtableRecords);

    const advertisers = extractAdvertisers();
    updateAdvertiserDropdowns(advertisers);
    renderJobsGallery();
  } catch (err) {
    container.innerHTML = '<p class="error">Error loading jobs: ' + err.message + '</p>';
    debug(`Error in loadJobsGallery: ${err.message}`);
  }
}