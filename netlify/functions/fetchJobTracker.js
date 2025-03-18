// netlify/functions/fetchJobTracker.js

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Retrieve Airtable credentials from environment variables
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  // Table ID for your Job Tracker table
  const TABLE_NAME = 'tblavZRcB3OTb37vq';
  // View ID for the "SUNDAY GRAVY ALL" view
  const VIEW_ID = 'viwMK8zq2ybPr623t';

  // The jobNumber parameter from the query string
  const { jobNumber } = event.queryStringParameters || {};
  if (!jobNumber) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "jobNumber parameter is required" })
    };
  }

  // Filter formula: match records where {Job No.} equals the clicked jobNumber
  const filterFormula = `{Job No.} = "${jobNumber}"`;

  // The fields you want to display. Must exactly match your Airtable field names.
  const desiredFields = [
    "Job Tracker Primary ID",
    "Person",
    "Job No.",
    "Campaign Media/Release (from Job No.)",
    "Campaign Usage (from Job No.)",
    "Shoot Location (from Job No.)",
    "Clients (from Job No.)",
    "Campaign",
    "Job Description / Product Details",
    "Talent Agency",
    "Talent Agent #1 Email (from Name copy) (from Talent Agency) 2",
    "Agent Email (Will be replaced by a lookup field from Agency)",
    "Type",
    "[WILL BE REDUNDANT] Advertiser",
    "Name of Spot (Will be a lookup field from Job Version)",
    "Final Spot (MP4) (Will be a lookup field from Job Versions)",
    "Head Shot",
    "Role",
    "Contract Fee (from Performer Recon Link) 2",
    "Loading (from Performer Recon Link) 2",
    "DTA (from Performer Recon Link) 3",
    "Voiceover (from Performer Recon Link) 3",
    "Options (from Performer Recon Link) 3",
    "Rollover (inc VO) (from Performer Recon Link) 3",
    "Cancellation (from Performer Recon Link) 2",
    "Night Loading (from Performer Recon Link) 2",
    "BSF (from Performer Recon Link) 2",
    "Contract Fee (replaced by lookup and will be removed completely once all records are validated)",
    "Loading (replaced by lookup and will be removed completely once all records are validated)",
    "Loading / Usage Taken Up",
    "First On Air (from Job No.) 2",
    "Contract Term (from Job No.) 2",
    "Contract Ends (Calculated) DATE (from Job No.) 2",
    "Deal Memo (from auto copy)",
    "Contract / DOR (from auto copy)",
    "Rollover Period (Will be hidden and a new Job Version will be created representing the Rollover)",
    "Rollover Ends (Will be hidden and a new Job Version will be created representing the Rollover)",
    "Rollover Fee (Will be hidden and a new Job Version will be created representing the Rollover)",
    "Options (Will be hidden and a new Job Version will be created representing the Options Taken)",
    "Option Fee (Will be hidden and a new Job Version will be created representing the Options Taken)",
    "Contracted Release (should go into Jobs and be a lookup here)",
    "Contracted Executions (should go into Jobs and be a lookup here)",
    "NOTES Job Tracker"
  ];

  // Convert desired fields into query parameters: fields[]=...
  const fieldsQuery = desiredFields.map(field => `fields[]=${encodeURIComponent(field)}`).join('&');

  // Expand certain linked fields so we get primary field names instead of recIDs
  // (Adjust these to match your actual linked fields: "Job No.", "Person", "Talent Agency", etc.)
  const expandFields = [
    "Job No.",
    "Person",
    "Talent Agency",
    "Clients (from Job No.)",
    "Campaign"
  ];
  const expandQuery = expandFields.map(e => `expand[]=${encodeURIComponent(e)}`).join('&');

  // Build the query string with the view, filter, fields, and expand parameters
  const query = `?view=${VIEW_ID}&filterByFormula=${encodeURIComponent(filterFormula)}&${fieldsQuery}&${expandQuery}`;
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}${query}`;

  console.log("Requesting URL:", url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Airtable API error in fetchJobTracker:", response.status, errorText);
      throw new Error(`Airtable API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Error in fetchJobTracker:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.toString() })
    };
  }
};
