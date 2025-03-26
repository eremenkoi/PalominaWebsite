// netlify/functions/fetchJobTracker.js

const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Get job number from query params
    const jobNumber = event.queryStringParameters?.jobNumber;

    if (!jobNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Job number is required" })
      };
    }

    console.log(`Fetching job details for ${jobNumber}`);

    // Fetch job details
    const job = await getJobDetails(jobNumber);

    if (!job) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Job not found" })
      };
    }

    // Fetch talent for this job
    const talent = await getTalentForJob(jobNumber);

    // Return data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        job,
        talent
      })
    };

  } catch (error) {
    console.error("Error fetching job details:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch job details: " + error.message })
    };
  }
};

// Get job details from Airtable
async function getJobDetails(jobNumber) {
  return new Promise((resolve, reject) => {
    base('tblavZRcB3OTb37vq').select({
      maxRecords: 1,
      filterByFormula: `{Job No.} = "${jobNumber}"`
    }).firstPage((err, records) => {
      if (err) {
        return reject(err);
      }

      if (records.length === 0) {
        console.log(`No job found with number ${jobNumber}`);
        return resolve(null);
      }

      const record = records[0];
      const fields = record.fields;

       // Now you'll see the 21 fields from "Job Tracker" table
        console.log("Raw fields:", fields);

      console.log(`Found job: ${fields["Job Name"] || "Unnamed Job"}`);

      // Format job data with your 21 columns
const job = {
  id: record.id,
  jobTrackerPrimaryID: fields["Job Tracker Primary ID"] || null,
  product: fields["Product"] || null,
  nameOfSpot: fields["Name of Spot"] || null,
  contractTerm: fields["Contract Term"] || null,
  firstOnAir: fields["First On Air"] || null,
  contractEnds: fields["Contract Ends (Calculated) Date For Sorting"]
    || fields["Contract Ends"]
    || null,
  campaignRelease: fields["Campaign Release/Usage"] || null,
  campaignMedia: fields["Campaign Media/Deliverables"] || null,
  territory: fields["Territory"] || null,
  jobNo: fields["Job No."] || null,
  type: fields["Type"] || null,
  headShot: fields["Head Shot"] || null,
  role: fields["Role"] || null,
  contractDOR: fields["Contract / DOR"] || null,
  jobSummary: fields["Job Summary"] || null,
  contractFee: fields["Contract Fee"] || null,
  loading: fields["Loading"] || null,
  options: fields["Options"] || null,
  rollover: fields["Rollover (inc VO)"] || null,
  voiceover: fields["Voiceover"] || null,
  notesJobTracker: fields["NOTES Job Tracker"] || null

      };

      resolve(job);
    });
  });
}

// Get client name from fields
function getClientName(fields) {
  // Try different possible field names
  return fields["Client"] ||
         fields["Advertiser"] ||
         (fields["Clients"] && Array.isArray(fields["Clients"]) ?
          (fields["Clients"][0]?.fields?.["Name"] || fields["Clients"][0]) : null);
}

// Get talent associated with this job
async function getTalentForJob(jobNumber) {
  return new Promise((resolve, reject) => {
    base('tblavZRcB3OTb37vq').select({
      filterByFormula: `{Job No.} = "${jobNumber}"`
    }).all((err, records) => {
      if (err) {
        return reject(err);
      }

      console.log(`Found ${records.length} talent records for job ${jobNumber}`);

      const talent = records.map(record => {
        const fields = record.fields;

        // Get person name safely
        let personName = extractPersonName(fields);

        // Get agency name safely
        let agencyName = extractAgencyName(fields);

        // Format contract fee
        let contractFee = null;
        if (fields["Contract Fee OLD"]) {
          const fee = parseFloat(fields["Contract Fee OLD"]);
          contractFee = isNaN(fee) ? fields["Contract Fee OLD"] : fee;
        }

        return {
          id: record.id,
          name: personName,
          agency: agencyName,
          type: fields["Type"] || "Freelance",
          role: fields["Role"] || "N/A",
          contractFee: contractFee,
          dealMemo: getDealMemoUrl(fields),
          contract: getContractUrl(fields)
        };
      });

      resolve(talent);
    });
  });
}

// Extract person name safely
function extractPersonName(fields) {
  // If the Person field exists and has data
  if (fields["Person"] && fields["Person"].length > 0) {
    const personField = fields["Person"];

    // If it's an array of objects (expanded)
    if (typeof personField[0] === 'object') {
      return personField[0]?.fields?.["Legal Name"] ||
             personField[0]?.fields?.["Name"] ||
             personField[0]?.id || "Unknown";
    }

    // If it's just a string field
    if (typeof fields["Name"] === 'string' && fields["Name"]) {
      return fields["Name"];
    }

    // Just an ID reference
    return `Person ${personField[0]}`;
  }

  return fields["Name"] || "Unknown";
}

// Extract agency name safely
function extractAgencyName(fields) {
  if (fields["Talent Agency"] && fields["Talent Agency"].length > 0) {
    const agencyField = fields["Talent Agency"];

    // If it's an array of objects (expanded)
    if (typeof agencyField[0] === 'object') {
      return agencyField[0]?.fields?.["Name"] || agencyField[0]?.id || "N/A";
    }

    // Just an ID reference
    return `Agency ${agencyField[0]}`;
  }

  return "N/A";
}

// Get deal memo URL safely
function getDealMemoUrl(fields) {
  if (fields["Deal Memo"] && Array.isArray(fields["Deal Memo"]) && fields["Deal Memo"].length > 0) {
    return fields["Deal Memo"][0]?.url || null;
  }
  return null;
}

// Get contract URL safely
function getContractUrl(fields) {
  if (fields["Contract / DOR"] && Array.isArray(fields["Contract / DOR"]) && fields["Contract / DOR"].length > 0) {
    return fields["Contract / DOR"][0]?.url || null;
  }
  return null;
}

// Format documents from job record
function formatDocuments(fields) {
  const documents = [];

  // Check for known attachment fields
  const fieldNames = [
    "Job Summary",
    "Contract / DOR",
    "Deal Memo"
  ];

  fieldNames.forEach(fieldName => {
    if (fields[fieldName] && Array.isArray(fields[fieldName])) {
      fields[fieldName].forEach(attachment => {
        if (attachment.url) {
          documents.push({
            name: attachment.filename || fieldName,
            url: attachment.url,
            type: attachment.type
          });
        }
      });
    }
  });

  return documents;
}