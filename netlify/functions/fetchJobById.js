// netlify/functions/fetchJobById.js
const Airtable = require('airtable');

exports.handler = async function(event, context) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Get recordId from query parameter
    const recordId = event.queryStringParameters?.recordId;

    if (!recordId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Record ID is required" })
      };
    }

    console.log(`[fetchJobById] Fetching job with record ID: ${recordId}`);

    // Initialize Airtable
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Missing Airtable credentials" })
      };
    }

    const base = new Airtable({ apiKey }).base(baseId);

    // Fetch the job record by ID
    // Use the same table ID as in your fetchJobs function
    const JOBS_TABLE_ID = 'tbl9O07R90s6qdgtK'; // Replace with your actual table ID

    const record = await base(JOBS_TABLE_ID).find(recordId);

    if (!record) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Job record not found" })
      };
    }

    // Extract the job number from the record
    const jobNumber = record.fields["Job Number"] || null;

    if (!jobNumber) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Job number not found in record" })
      };
    }

    // Return the job number and any other basic info needed
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        recordId: record.id,
        jobNumber: jobNumber,
        jobName: record.fields["Job Name"] || "Unnamed Job"
      })
    };

  } catch (error) {
    console.error("[fetchJobById] Error:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch job: " + error.message })
    };
  }
};