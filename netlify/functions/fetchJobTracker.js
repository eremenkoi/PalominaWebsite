// netlify/functions/fetchJobTracker.js

const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
// --- CONFIGURATION ---
const JOB_TABLE_ID = 'tblavZRcB3OTb37vq'; // Your Job Tracker table ID
// !!! IMPORTANT: Replace with the ACTUAL Table ID or Name for your Talent Agencies table !!!
const TALENT_AGENCIES_TABLE_ID = 'tblcXDoQyz2efkRd3'; // e.g., 'tblKxeWAZXF3Bu2yu'
const AGENCY_NAME_FIELD = 'Name'; // The field containing the agency name in TALENT_AGENCIES_TABLE_ID
// --- END CONFIGURATION ---

exports.handler = async function(event, context) {
  // CORS headers - Adjust '*' for production if needed
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const jobNumber = event.queryStringParameters?.jobNumber;

    if (!jobNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Job number parameter is required" })
      };
    }

    console.log(`[fetchJobTracker] Processing request for job number: ${jobNumber}`);

    // Fetch ALL raw records associated with the job number
    const rawRecords = await fetchAllJobRecords(jobNumber);

    if (!rawRecords || rawRecords.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `No records found for job number: ${jobNumber}` })
      };
    }

    // --- START: Added Steps ---
    // 2. Extract unique Talent Agency IDs
    const uniqueAgencyIds = extractUniqueLinkedIds(rawRecords, 'Talent Agency');
    console.log(`[handler] Found ${uniqueAgencyIds.length} unique agency IDs.`);

    // 3. Fetch Agency Names for the extracted IDs
    let agencyNameMap = {}; // Initialize empty map
    if (uniqueAgencyIds.length > 0) {
      agencyNameMap = await fetchAgencyNames(uniqueAgencyIds); // Call the new helper
    }
    // --- END: Added Steps ---

    // Process the raw records into a structured response
    const { jobSummary, talentDetails } = processJobRecords(rawRecords, jobNumber, agencyNameMap); // Pass the map here

    // Return the structured data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        jobSummary,
        talentDetails
      })
    };

  } catch (error) {
    console.error("[fetchJobTracker] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch or process job details: " + error.message })
    };
  }
};

// --- Helper Functions ---

// Fetches all raw Airtable records for a given job number
async function fetchAllJobRecords(jobNumber) {
  return new Promise((resolve, reject) => {
    // This formula assumes 'jobNumber' is a Lookup/Rollup resulting in an array.
    // Adjust if 'jobNumber' is a simple text field or linked record name.
    const formula = `FIND("${jobNumber}", ARRAYJOIN({jobNumber}, ",")) > 0`;
    console.log(`[Airtable Fetch] Using filter: ${formula}`);

    const records = [];
    base(JOB_TABLE_ID).select({
      filterByFormula: formula,
      // Consider specifying needed fields: fields: ['jobNumber', 'Person', ...]
      // Consider sorting for predictability: sort: [{field: "createdTime", direction: "asc"}],
    }).eachPage(
      function page(pageRecords, fetchNextPage) {
        pageRecords.forEach(record => records.push(record));
        fetchNextPage();
      },
      function done(err) {
        if (err) {
          console.error("[Airtable Fetch] Error fetching pages:", err);
          return reject(err);
        }
        console.log(`[Airtable Fetch] Fetched ${records.length} raw records.`);
        resolve(records);
      }
    );
  });
}

// --- Add This Helper Function ---
// Extracts unique, valid Record IDs from a specific linked record field across multiple records
function extractUniqueLinkedIds(records, fieldName) {
    const idSet = new Set();
    records.forEach(record => {
        const linkedIds = record.fields[fieldName]; // This is often an array of IDs
        if (Array.isArray(linkedIds)) {
            linkedIds.forEach(id => {
                if (typeof id === 'string' && id.startsWith('rec')) {
                    idSet.add(id);
                }
            });
        } else if (typeof linkedIds === 'string' && linkedIds.startsWith('rec')) {
             idSet.add(linkedIds);
        }
    });
    return Array.from(idSet);
}

// --- Add This Helper Function ---
// Fetches names from the Agencies table for a list of IDs
async function fetchAgencyNames(agencyIds) {
    // Use the constants defined at the top of the file
    if (!TALENT_AGENCIES_TABLE_ID || TALENT_AGENCIES_TABLE_ID === 'tblYOUR_AGENCY_TABLE_ID') { // Basic check
        console.warn("[fetchAgencyNames] TALENT_AGENCIES_TABLE_ID is not configured correctly. Skipping name fetch.");
        return {}; // Return empty map if not configured
    }
    if (!agencyIds || agencyIds.length === 0) return {};

    const batchSize = 100; // Process IDs in batches
    const agencyNameMap = {};
    console.log(`[fetchAgencyNames] Attempting to fetch names for ${agencyIds.length} IDs from table ${TALENT_AGENCIES_TABLE_ID}.`);

    try {
        for (let i = 0; i < agencyIds.length; i += batchSize) {
            const batchIds = agencyIds.slice(i, i + batchSize);
            const formula = "OR(" + batchIds.map(id => `RECORD_ID()='${id}'`).join(',') + ")";
            // console.log(`[fetchAgencyNames] Fetching batch ${i/batchSize + 1} using formula (first part): ${formula.substring(0,100)}...`); // Log formula carefully

            const agencyRecords = await base(TALENT_AGENCIES_TABLE_ID).select({
                filterByFormula: formula,
                fields: [AGENCY_NAME_FIELD] // Only fetch the specified name field
            }).all();

            agencyRecords.forEach(record => {
                // Use nullish coalescing to handle cases where the name field might be empty/null in Airtable
                agencyNameMap[record.id] = record.fields[AGENCY_NAME_FIELD] ?? null;
            });
        }
        console.log(`[fetchAgencyNames] Successfully mapped ${Object.keys(agencyNameMap).length} agency names.`);
    } catch (error) {
         console.error(`[fetchAgencyNames] Error fetching agency names:`, error);
         // Return partially filled map on error
    }
    return agencyNameMap;
}

// Processes raw Airtable records into jobSummary and talentDetails
function processJobRecords(rawRecords, requestedJobNumber, agencyNameMap = {}) { // Add agencyNameMap parameter
  if (!rawRecords || rawRecords.length === 0) {
    return { jobSummary: null, talentDetails: [] };
  }

  // --- Create Job Summary (Aggregated/Derived Info) ---
  const firstRecordFields = rawRecords[0].fields;
  const jobSummary = {
    jobNumber: requestedJobNumber,
    // Aggregate common fields or use first record as fallback
    jobName: getCommonFieldValue(rawRecords, "Job Name") ?? getArrayValue(firstRecordFields["Job Description / Product Details"]) ?? "Unnamed Job",
    jobDescription: getCommonFieldValue(rawRecords, "Job Description / Product Details") ?? getArrayValue(firstRecordFields["Job Description / Product Details"]),
    product: getCommonFieldValue(rawRecords, "Product") ?? firstRecordFields["Product"],
    advertiser: getCommonFieldValue(rawRecords, "Advertiser"), // Usually consistent
    client: getCommonClientName(rawRecords), // Attempt to find consistent client
    campaignRelease: getCommonFieldValue(rawRecords, "Campaign Release/Usage"),
    campaignMedia: getCommonFieldValue(rawRecords, "Campaign Media/Deliverables"),
    territory: getCommonFieldValue(rawRecords, "Territory"),
    // Derive overall date range
    firstOnAir: getMinDate(rawRecords, "First On Air"),
    contractEnd: getMaxDate(rawRecords, "Contract Ends"),
    notesJobTracker: getCommonFieldValue(rawRecords, "NOTES Job Tracker"),
    // Add other potentially common job-level fields if needed
  };

  // --- Create Talent Details (Specific Info Per Record) ---
  const talentDetails = rawRecords.map(record => {
    const fields = record.fields;
    const personName = extractLinkedName(fields["Person"], ["Legal Name", "Name"]);
    // Get the Agency ID from the record's field
    const agencyId = getArrayValue(fields["Talent Agency"]); // Get the first ID

    // Look up the name in the map passed to this function
    const agencyName = agencyId ? (agencyNameMap[agencyId] || null) : null;

    // Consolidate fee logic
    let feeValue = fields["Contract Fee"] ?? fields["Rollover (inc VO)"] ?? fields["Rollover (TO RETIRE)"] ?? fields["Contract Fee OLD"];
    feeValue = getArrayValue(feeValue); // Handle potential array from rollup
    const parsedFee = parseFloat(feeValue);
    const contractFee = isNaN(parsedFee) ? feeValue : parsedFee; // Keep original string if not number (e.g., "TBD")

    return {
      id: record.id, // Specific record ID
      jobTrackerPrimaryID: fields["Job Tracker Primary ID"], // Keep specific ID if needed
      name: personName || "Unknown",
      agency: agencyName, // Use the new formula field directly,
      type: fields["Type"] || "Unknown",
      role: fields["Role"] || "N/A",
      contractFee: contractFee,
      firstOnAir: getArrayValue(fields["First On Air"]), // Date specific to this record
      contractEnd: getArrayValue(fields["Contract Ends"]), // Date specific to this record
      contractTerm: getArrayValue(fields["Contract Term"]), // Term specific to this record
      dealMemoUrl: getAttachmentUrl(fields["Deal Memo"]),
      contractUrl: getAttachmentUrl(fields["Contract / DOR"]),
      headShot: getAttachmentObject(fields["Head Shot"]), // Pass thumbnail/URL object
      // Include other relevant fields PER talent record if needed
      // e.g., loading: fields["Loading"], options: fields["Options"], etc.
    };
  });

  console.log("[Process Records] Generated jobSummary:", jobSummary);
  console.log(`[Process Records] Generated ${talentDetails.length} talentDetails.`);

  return { jobSummary, talentDetails };
}


// Safely gets the first element of an array field, or the value itself
function getArrayValue(fieldValue) {
  return (Array.isArray(fieldValue) && fieldValue.length > 0) ? fieldValue[0] : fieldValue;
}

// Gets a field value if it's consistent across all records
function getCommonFieldValue(records, fieldName) {
  if (!records || records.length === 0) return undefined;
  const firstValue = getArrayValue(records[0].fields[fieldName]);
  for (let i = 1; i < records.length; i++) {
    if (getArrayValue(records[i].fields[fieldName]) !== firstValue) {
      return undefined; // Values differ
    }
  }
  return firstValue; // All values are the same
}

// Extracts name from a linked record field (handles ID or expanded object)
function extractLinkedName(fieldValue, nameFields = ["Name"]) {
    const value = getArrayValue(fieldValue); // Get first item/ID from potential array
    if (!value) return null; // No value found

    if (typeof value === 'object' && value !== null && value.fields) {
        // Expanded record object - Name likely available
        for (const nameField of nameFields) {
            if (value.fields[nameField]) {
                // Found the name in the specified fields
                return value.fields[nameField];
            }
        }
        // Expanded object, but couldn't find name field, return ID as fallback
        console.warn(`Expanded record ${value.id} missing fields: ${nameFields.join(', ')}`);
        return value.id;
    } else if (typeof value === 'string' && value.startsWith('rec')) {
        // Just a record ID string - Return null or a placeholder
        // Returning null allows the frontend to group under "Unknown" or similar.
        // console.log(`Found only Record ID for linked field: ${value}`);
        return null; // ** CHANGED: Return null instead of "ID: rec..." **
        // Or, return a placeholder: return `Agency ID: ${value}`;
    }
    // Fallback if it's neither object nor rec ID (maybe name stored directly?)
    return typeof value === 'string' ? value : null;
}

// Gets the earliest valid date from a field across records
function getMinDate(records, fieldName) {
  let minDate = null;
  records.forEach(record => {
    const dateValue = getArrayValue(record.fields[fieldName]);
    if (dateValue) {
      try {
        const currentDate = new Date(dateValue);
        if (!isNaN(currentDate.getTime()) && (minDate === null || currentDate < minDate)) {
          minDate = currentDate;
        }
      } catch (e) { /* ignore */ }
    }
  });
  return minDate ? minDate.toISOString().split('T')[0] : null; // YYYY-MM-DD
}

// Gets the latest valid date from a field across records
function getMaxDate(records, fieldName) {
  let maxDate = null;
  records.forEach(record => {
    const dateValue = getArrayValue(record.fields[fieldName]);
    if (dateValue) {
      try {
        const currentDate = new Date(dateValue);
        if (!isNaN(currentDate.getTime()) && (maxDate === null || currentDate > maxDate)) {
          maxDate = currentDate;
        }
      } catch (e) { /* ignore */ }
    }
  });
  return maxDate ? maxDate.toISOString().split('T')[0] : null; // YYYY-MM-DD
}

// Get the first attachment URL
function getAttachmentUrl(fieldValue) {
  const attachment = getArrayValue(fieldValue);
  return attachment?.url ?? null;
}

// Get the first attachment object (including thumbnails if available)
function getAttachmentObject(fieldValue) {
    const attachment = getArrayValue(fieldValue);
    // Return relevant parts or the whole object
    if (attachment?.url) {
        return {
            url: attachment.url,
            filename: attachment.filename,
            thumbnails: attachment.thumbnails // Contains small, large, full
        };
    }
    return null;
}


// Attempts to find a common client name
function getCommonClientName(records) {
    // Try 'Clients' field first (might be Lookup returning name or ID)
    let clientName = getCommonFieldValue(records, "Clients");

    // If 'Clients' gave an ID or was inconsistent, try 'Advertiser'
    if (!clientName || (typeof clientName === 'string' && clientName.startsWith('rec'))) {
        clientName = getCommonFieldValue(records, "Advertiser");
    }

    // If 'Client' field exists and is consistent, it might be useful too
    if (!clientName) {
        clientName = getCommonFieldValue(records, "Client");
    }

    // Ensure the final result isn't an array if it came from a lookup
    return getArrayValue(clientName);
}