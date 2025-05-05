// netlify/functions/fetchJobTracker.js

const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
// --- CONFIGURATION ---
const JOB_TABLE_ID = 'tbl9O07R90s6qdgtK'; // Your Job Tracker table ID
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
    // Get job number from query params - this is what's passed from the frontend
    const jobNumber = event.queryStringParameters?.jobNumber;

    if (!jobNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Job number parameter is required" })
      };
    }

    console.log(`[fetchJobTracker] Processing request for job number: ${jobNumber}`);

    // Fetch the job record directly from Airtable
    // Note: We're using "Job Number" or "Associated Jobs" field for the filter
    const jobRecords = await fetchJobRecords(jobNumber);

    if (!jobRecords || jobRecords.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `No job found with job number: ${jobNumber}` })
      };
    }

    // Get the first job record (should be only one)
    const jobRecord = jobRecords[0];

    // Extract talent agency IDs from the job record (if any)
    const talentAgencyIds = extractLinkedFieldIds(jobRecord.fields, "Talent Agency");

    // Fetch agency names if we have any IDs
    let agencyNameMap = {};
    if (talentAgencyIds.length > 0) {
      agencyNameMap = await fetchAgencyNames(talentAgencyIds);
    }

    // Fetch talent records linked to this job if we have "Job Tracker" or "Performer Recon" fields
    let talentRecords = [];

    // Check if we have Job Tracker or Performer Recon fields
    const jobTrackerIds = extractLinkedFieldIds(jobRecord.fields, "Job Tracker");
    const performerReconIds = extractLinkedFieldIds(jobRecord.fields, "Performer Recon");

    // Combine all IDs for talent records
    const allTalentIds = [...new Set([...jobTrackerIds, ...performerReconIds])];

    if (allTalentIds.length > 0) {
      // Fetch talent records
      talentRecords = await fetchTalentRecords(allTalentIds);
    }

    // Process the job and talent records into the expected format
    const { jobSummary, talentDetails } = processJobData(jobRecord, talentRecords, agencyNameMap);

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

// Fetch job records by job number
async function fetchJobRecords(jobNumber) {
  return new Promise((resolve, reject) => {
    // Try to match either by "Job Number" field or "Associated Jobs" field
    const formula = `OR({Job Number} = "${jobNumber}", FIND("${jobNumber}", {Associated Jobs}) > 0)`;
    console.log(`[fetchJobRecords] Using filter: ${formula}`);

    base(JOB_TABLE_ID)
      .select({
        filterByFormula: formula,
        maxRecords: 1
      })
      .firstPage((err, records) => {
        if (err) {
          console.error("[fetchJobRecords] Error:", err);
          return reject(err);
        }

        resolve(records || []);
      });
  });
}

// Fetch talent records by record IDs
async function fetchTalentRecords(recordIds) {
  if (!recordIds || recordIds.length === 0) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const formula = "OR(" + recordIds.map(id => `RECORD_ID() = "${id}"`).join(",") + ")";
    console.log(`[fetchTalentRecords] Using filter to fetch ${recordIds.length} talent records`);

    base(JOB_TABLE_ID)
      .select({
        filterByFormula: formula
      })
      .all((err, records) => {
        if (err) {
          console.error("[fetchTalentRecords] Error:", err);
          return reject(err);
        }

        resolve(records || []);
      });
  });
}

// Extract IDs from a linked record field
function extractLinkedFieldIds(fields, fieldName) {
  if (!fields || !fields[fieldName]) {
    return [];
  }

  const linkedField = fields[fieldName];

  if (Array.isArray(linkedField)) {
    return linkedField.filter(item => {
      // Handle both string IDs and object records
      if (typeof item === 'string' && item.startsWith('rec')) {
        return true;
      } else if (item && typeof item === 'object' && item.id) {
        return true;
      }
      return false;
    }).map(item => {
      // Extract the ID
      return typeof item === 'string' ? item : item.id;
    });
  } else if (typeof linkedField === 'string' && linkedField.startsWith('rec')) {
    return [linkedField];
  }

  return [];
}

// Fetch agency names by IDs
async function fetchAgencyNames(agencyIds) {
  if (!agencyIds || agencyIds.length === 0) {
    return {};
  }

  return new Promise((resolve, reject) => {
    const formula = "OR(" + agencyIds.map(id => `RECORD_ID() = "${id}"`).join(",") + ")";

    base(TALENT_AGENCIES_TABLE_ID)
      .select({
        filterByFormula: formula
      })
      .all((err, records) => {
        if (err) {
          console.error("[fetchAgencyNames] Error:", err);
          return reject(err);
        }

        // Create a map of agency IDs to names
        const agencyMap = {};
        (records || []).forEach(record => {
          agencyMap[record.id] = record.fields[AGENCY_NAME_FIELD] || record.id;
        });

        resolve(agencyMap);
      });
  });
}

// Process job and talent data into expected format
function processJobData(jobRecord, talentRecords, agencyNameMap) {
  if (!jobRecord) {
    return { jobSummary: null, talentDetails: [] };
  }

  const fields = jobRecord.fields;

  // Create job summary
  const jobSummary = {
    id: jobRecord.id,
    jobNumber: fields["Job Number"] || fields["Associated Jobs"] || "Unknown",
    jobName: fields["Job Name"] || "Unnamed Job",
    product: fields["Advertiser"] || fields["Client"] || "",
    firstOnAir: fields["First On Air"] || null,
    contractEnd: fields["Contract Ends"] || fields["Contract Ends (Calculated) Date For Sorting"] || null,
    contractTerm: Array.isArray(fields["Contract Term"]) ? fields["Contract Term"].join(', ') : fields["Contract Term"] || null,
    client: fields["Client"] || fields["Clients"] || fields["Advertiser"] || "",
    campaign: fields["Campaign"] || "",
    territory: fields["Territory"] || Array.isArray(fields["Shoot Location"]) ? fields["Shoot Location"].join(', ') : fields["Shoot Location"] || "Australia",
    usageRights: fields["Campaign Release/Media"] || "",
    jobDescription: fields["Job Description - Product Details"] || fields["Final Spot"] || "",
    campaignRelease: fields["Campaign Release/Media"] || "",
    campaignMedia: fields["Campaign Deliverables"] || fields["Final Spot"] || "",
    notesJobTracker: fields["Jobs Notes"] || ""
  };

  // Process talent records
  const talentDetails = [];

  // First, add any talent from the linked records
  talentRecords.forEach(record => {
    const talentFields = record.fields;

    // Get agency ID and name
    const agencyIds = extractLinkedFieldIds(talentFields, "Talent Agency");
    let agencyName = "Unknown Agency";

    if (agencyIds.length > 0 && agencyNameMap[agencyIds[0]]) {
      agencyName = agencyNameMap[agencyIds[0]];
    }

    // Get person name, either from direct field or lookup
    let personName = talentFields["Person"] || talentFields["Name"] || "Unknown";
    if (Array.isArray(personName)) {
      // Try to extract name from array
      if (personName.length > 0) {
        if (typeof personName[0] === 'object' && personName[0].fields) {
          personName = personName[0].fields["Legal Name"] || personName[0].fields["Name"] || "Unknown";
        } else {
          personName = personName[0];
        }
      }
    }

    // Get contract fee
    let contractFee = talentFields["Contract Fee"] ||
                     talentFields["Contract Fee OLD"] ||
                     null;

    // Get head shot
    const headShot = talentFields["Head Shot"] ?
                    (Array.isArray(talentFields["Head Shot"]) ? talentFields["Head Shot"][0] : talentFields["Head Shot"]) :
                    null;

    talentDetails.push({
      id: record.id,
      jobTrackerPrimaryID: record.id,
      name: personName,
      agency: agencyName,
      type: talentFields["Type"] || "Unknown",
      role: talentFields["Role"] || "N/A",
      contractFee: contractFee,
      firstOnAir: talentFields["First On Air"] || fields["First On Air"] || null,
      contractEnd: talentFields["Contract Ends"] || talentFields["Contract Ends (Calculated)"] ||
                  fields["Contract Ends"] || fields["Contract Ends (Calculated) Date For Sorting"] || null,
      contractTerm: talentFields["Contract Term"] || fields["Contract Term"] || null,
      dealMemoUrl: getAttachmentUrl(talentFields["Deal Memo"]),
      contractUrl: getAttachmentUrl(talentFields["Contract / DOR"]),
      headShot: getAttachmentObject(headShot),
      loading: talentFields["Loading"] || talentFields["Option/Loading Details"] || null,
      options: talentFields["Options"] || null,
      rolloverFee: talentFields["Rollover (inc VO)"] || null,
      voiceover: talentFields["Voiceover Usage"] || null
    });
  });

  // If no talent records but we have performer information directly on the job
  if (talentDetails.length === 0) {
    // We might want to add a placeholder talent record based on job data
    talentDetails.push({
      id: jobRecord.id,
      jobTrackerPrimaryID: jobRecord.id,
      name: "See Job Details",
      agency: "N/A",
      type: fields["Type"] || "Unknown",
      role: "N/A",
      contractFee: fields["Total Performer Fees"] || null,
      firstOnAir: fields["First On Air"] || null,
      contractEnd: fields["Contract Ends"] || fields["Contract Ends (Calculated) Date For Sorting"] || null,
      contractTerm: fields["Contract Term"] || null,
      dealMemoUrl: null,
      contractUrl: null,
      headShot: null
    });
  }

  console.log(`[processJobData] Generated job summary and ${talentDetails.length} talent details`);

  return { jobSummary, talentDetails };
}

// Get first attachment URL
function getAttachmentUrl(fieldValue) {
  if (!fieldValue) {
    return null;
  }

  if (Array.isArray(fieldValue) && fieldValue.length > 0) {
    return fieldValue[0].url || null;
  }

  return fieldValue.url || null;
}

// Get attachment object with thumbnails
function getAttachmentObject(attachment) {
  if (!attachment) {
    return null;
  }

  if (attachment.url) {
    return {
      url: attachment.url,
      filename: attachment.filename || 'attachment',
      thumbnails: attachment.thumbnails || null
    };
  }

  return null;
}