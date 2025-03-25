// netlify/functions/fetchCampaigns.js

const fetch = require('node-fetch');

exports.handler = async (event) => {
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  // This should be the table ID for your Campaigns table!
  const TABLE_ID = 'tbl8Ctde8oJ1FGP4y';

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

    // For Client="Sunday Gravy" filter, use a simplified approach to avoid 422 errors
    let url;
    let useClientFilter = false;

    if (!filter || filter === '{Client} = "Sunday Gravy"') {
      // Fetch all records without filtering (up to 100)
      url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?maxRecords=100`;
      useClientFilter = filter === '{Client} = "Sunday Gravy"';
    } else {
      // For specific filters, use the filterByFormula as normal
      url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${encodeURIComponent(filter)}`;
    }

    console.log("Requesting Campaigns URL:", url);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    console.log("Airtable response status for campaigns:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Airtable error in fetchCampaigns:", response.status, errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Airtable error: ${response.status}`, details: errorText })
      };
    }

    let data = await response.json();
    console.log(`Received ${data.records ? data.records.length : 0} campaign records from Airtable`);

    // If we need to filter by client on the server side
    if (useClientFilter && data.records) {
      data.records = data.records.filter(record => {
        return record.fields &&
               record.fields.Client &&
               record.fields.Client.includes("Sunday Gravy");
      });
      console.log(`After client filtering: ${data.records.length} campaign records remaining`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error("Error in fetchCampaigns:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.toString() })
    };
  }
};