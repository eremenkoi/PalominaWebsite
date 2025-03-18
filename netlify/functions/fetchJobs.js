// netlify/functions/fetchJobs.js

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Retrieve your Airtable credentials from environment variables.
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  // Use the table ID for the Jobs table (as confirmed to work in Postman)
  const TABLE_NAME = 'tbl9O07R90s6qdgtK';

  // Get the optional filter from query parameters.
  let filter = event.queryStringParameters && event.queryStringParameters.filter;

  // If no filter is provided, default to filtering by Client.
  if (!filter) {
    filter = '{Client} = "Sunday Gravy"';
  }

  // Build the query string without a view parameter.
  const query = `?filterByFormula=${encodeURIComponent(filter)}`;

  // Construct the full Airtable API URL.
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}${query}`;

  console.log("AIRTABLE_API_KEY exists?", !!API_KEY);
  console.log("AIRTABLE_BASE_ID:", BASE_ID);
  console.log("Requesting URL:", url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Airtable API error in fetchJobs:", response.status, errorText);
      throw new Error(`Airtable API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Error in fetchJobs:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.toString() })
    };
  }
};
