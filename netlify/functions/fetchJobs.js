// netlify/functions/fetchJobs.js

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Retrieve your Airtable credentials from environment variables.
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  // Use the table ID for the Jobs table
  const TABLE_NAME = 'tbl9O07R90s6qdgtK';

  // Add validation for environment variables
  if (!API_KEY) {
    console.error("Missing AIRTABLE_API_KEY environment variable");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error: Missing API key" })
    };
  }

  if (!BASE_ID) {
    console.error("Missing AIRTABLE_BASE_ID environment variable");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error: Missing base ID" })
    };
  }

  try {
    // Get the optional filter from query parameters
    let filter = event.queryStringParameters && event.queryStringParameters.filter;

    // If no filter is provided or the filter is for Client="Sunday Gravy", use a simplified approach
    // Instead of filtering, we'll fetch all records and then filter on the server side if needed
    let url;
    let useClientFilter = false;

    if (!filter || filter === '{Client} = "Sunday Gravy"') {
      // Fetch all records without filtering
      url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?maxRecords=100`;
      useClientFilter = filter === '{Client} = "Sunday Gravy"';
    } else {
      // For specific job number filters, use the filterByFormula as normal
      url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(filter)}`;
    }

    console.log("AIRTABLE_API_KEY exists?", !!API_KEY);
    console.log("AIRTABLE_BASE_ID:", BASE_ID);
    console.log("TABLE_NAME:", TABLE_NAME);
    console.log("Filter formula:", filter || "Fetching all records");
    console.log("Requesting URL:", url);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    // Log the status code for debugging
    console.log("Airtable response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Airtable API error in fetchJobs:", response.status, errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: `Airtable API error: ${response.status}`,
          details: errorText
        })
      };
    }

    let data = await response.json();
    console.log(`Received ${data.records ? data.records.length : 0} records from Airtable`);

    // If we need to filter by client on the server side
    if (useClientFilter && data.records) {
      data.records = data.records.filter(record => {
        // Check if Client field exists and equals "Sunday Gravy"
        return record.fields &&
               record.fields.Client &&
               record.fields.Client.includes("Sunday Gravy");
      });
      console.log(`After client filtering: ${data.records.length} records remaining`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Error in fetchJobs:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server error in fetchJobs function",
        details: error.toString()
      })
    };
  }
};