// netlify/functions/fetchAllJobs.js

const fetch = require('node-fetch');

exports.handler = async (event) => {
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  // The table ID for your Jobs table
  const TABLE_ID = 'tbl9O07R90s6qdgtK';

  // We fetch all records, expanding the "Campaign" field, limiting to 1000 records
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?expand[]=Campaign&maxRecords=1000`;

  console.log("fetchAllJobs => Requesting Airtable URL:", url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable error: ${response.status} ${errorText}`);
    }
    const data = await response.json();

    // Log how many records we got
    console.log(`fetchAllJobs => Received ${data.records ? data.records.length : 0} records from Airtable`);

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error("Error in fetchAllJobs:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.toString() })
    };
  }
};
