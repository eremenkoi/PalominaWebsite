// netlify/functions/fetchJobs.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Retrieve your Airtable credentials from environment variables.
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TABLE_NAME = 'tbl9O07R90s6qdgtK';

  // Basic checks
  if (!API_KEY) {
    console.error("Missing AIRTABLE_API_KEY environment variable");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server configuration error: Missing API key" })
    };
  }

  if (!BASE_ID) {
    console.error("Missing AIRTABLE_BASE_ID environment variable");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server configuration error: Missing base ID" })
    };
  }

  try {
    // Only show records where {Clients} = "DDB Melbourne"
    const enforcedFilter = '{Clients} = "DDB Melbourne"';

    // We want to expand these linked fields
    const expansions = ['Person', 'Talent Agency'];
    const expandParams = expansions
      .map(field => `expand[]=${encodeURIComponent(field)}`)
      .join('&');

    // Build the initial Airtable URL with filterByFormula, maxRecords, and expansions
    let url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`
      + `?filterByFormula=${encodeURIComponent(enforcedFilter)}`
      + `&maxRecords=1000`
      + `&${expandParams}`;

    console.log("AIRTABLE_API_KEY exists?", !!API_KEY);
    console.log("AIRTABLE_BASE_ID:", BASE_ID);
    console.log("TABLE_NAME:", TABLE_NAME);
    console.log("Filter formula:", enforcedFilter);
    console.log("Initial Requesting URL:", url);

    const allRecords = [];
    let offset;

    do {
      let pagedUrl = url;
      if (offset) {
        pagedUrl += `&offset=${offset}`;
      }
      console.log("Requesting URL:", pagedUrl);

      const response = await fetch(pagedUrl, {
        headers: { Authorization: `Bearer ${API_KEY}` }
      });

      console.log("Airtable response status:", response.status);

      // If Airtable responded with an error (e.g. invalid table name, 404, etc.),
      // we read the text and wrap it in a JSON object so the front-end can parse it.
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Airtable API error in fetchJobs:", response.status, errorText);
        return {
          statusCode: response.status,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: `Airtable API error: ${response.status}`,
            details: errorText
          })
        };
      }

      // Otherwise, parse as JSON
      const data = await response.json();
      console.log(`Received ${data.records ? data.records.length : 0} records from Airtable`);

      allRecords.push(...data.records);
      offset = data.offset;
      console.log("Offset:", offset);
    } while (offset);

    console.log(`Total records fetched: ${allRecords.length}`);

    // Return allRecords in a JSON object
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: allRecords })
    };
  } catch (error) {
    console.error("Error in fetchJobs:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Server error in fetchJobs function",
        details: error.toString()
      })
    };
  }
};
