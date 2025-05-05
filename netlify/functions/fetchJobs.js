// netlify/functions/fetchJobs.js
const fetch = require('node-fetch');
const Airtable = require('airtable');
const { verifyAuth } = require('./verifyAuth');

exports.handler = async (event, context) => {
  // Retrieve Airtable credentials from environment variables
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const JOBS_TABLE_ID = 'tbl9O07R90s6qdgtK'; // Your Jobs table ID
  const TALENT_AGENCIES_TABLE_ID = 'tblcXDoQyz2efkRd3'; // Your Talent Agencies table ID

  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Basic checks
  if (!API_KEY) {
    console.error("Missing AIRTABLE_API_KEY environment variable");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server configuration error: Missing API key" })
    };
  }

  if (!BASE_ID) {
    console.error("Missing AIRTABLE_BASE_ID environment variable");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server configuration error: Missing base ID" })
    };
  }

  // Initialize Airtable
  const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

  // Verify authentication
  const auth = verifyAuth(event);
  if (!auth) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Authentication required" })
    };
  }

  try {
    // Get agency ID from authentication data
    const agencyId = auth.agencyId;
    const agencyName = auth.agencyName;

    console.log(`Fetching jobs for agency: ${agencyName} (${agencyId})`);

    // STEP 1: Get the Linked Jobs Formula from the agency record
    let linkedJobsString = '';
    try {
      // Fetch the agency record to get the Linked Jobs Formula
      const agencyRecord = await base(TALENT_AGENCIES_TABLE_ID).find(agencyId);

      // Get the formula field value
      linkedJobsString = agencyRecord.fields['Linked Jobs Formula'] || '';

      console.log(`Linked Jobs for agency: ${linkedJobsString}`);

      // If no linked jobs, return empty result
      if (!linkedJobsString) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            records: [],
            agencyInfo: {
              id: agencyId,
              name: agencyName
            },
            message: "No linked jobs found for this agency"
          })
        };
      }
    } catch (error) {
      console.error("Error fetching agency record:", error);

      // Fallback - fetch all DDB Melbourne jobs
      console.log("Error fetching agency record. Falling back to DDB Melbourne jobs.");

      const enforcedFilter = `{Clients} = "DDB Melbourne"`;
      const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(JOBS_TABLE_ID)}?filterByFormula=${encodeURIComponent(enforcedFilter)}&maxRecords=1000`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${API_KEY}` }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Airtable API error in fetchJobs:", response.status, errorText);
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({
            error: `Airtable API error: ${response.status}`,
            details: errorText
          })
        };
      }

      const data = await response.json();
      console.log(`Fetched ${data.records ? data.records.length : 0} jobs using fallback filter`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          records: data.records || [],
          agencyInfo: {
            id: agencyId,
            name: agencyName
          },
          message: "Using fallback data - error fetching agency record"
        })
      };
    }

    // STEP 2: Parse the linked jobs string into an array of job IDs/numbers
    // Format: "Hyundai IONIQ, MF0001, EGP0125, TPB1553452725"
    // We need to split by comma, and trim each value
    const linkedJobs = linkedJobsString.split(',').map(job => job.trim());

    console.log(`Parsed linked jobs: ${JSON.stringify(linkedJobs)}`);

    // STEP 3: Fetch jobs that match any of the linked job identifiers
    // Build a formula that matches any of the job identifiers in the Job Number field only
    const jobConditions = linkedJobs.map(jobId => {
      // Escape any special characters in the job ID
      const escapedJobId = jobId.replace(/"/g, '\\"');
      return `{Job Number} = "${escapedJobId}"`;
    });

    // Combine conditions with OR
    const formula = `OR(${jobConditions.join(',')})`;

    console.log(`Query formula: ${formula}`);

    // Fetch the jobs from Airtable
    const jobRecords = await base(JOBS_TABLE_ID).select({
      filterByFormula: formula
    }).all();

    console.log(`Found ${jobRecords.length} jobs for agency ${agencyName}`);

    // Convert Airtable records to the expected format
    const formattedRecords = jobRecords.map(record => ({
      id: record.id,
      fields: record.fields
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        records: formattedRecords,
        agencyInfo: {
          id: agencyId,
          name: agencyName
        }
      })
    };
  } catch (error) {
    console.error("Error in fetchJobs:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Server error in fetchJobs function",
        details: error.toString()
      })
    };
  }
};