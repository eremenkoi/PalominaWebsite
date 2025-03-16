const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Retrieve credentials from environment variables.
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  // Use the table ID for Campaigns (replace with correct value if needed)
  const TABLE_NAME = 'tbl8Ctde8oJ1FGP4y';

  // Get filter from query parameters (if any)
  const { filter = '' } = event.queryStringParameters || {};

  // Build the query string.
  let query = filter ? `?filterByFormula=${encodeURIComponent(filter)}` : '?';
  // Append expand parameters for linked fields.
  query += `&expand[]=Client&expand[]=Associated%20Jobs`;

  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}${query}`;
  console.log("Requesting URL:", url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Airtable API error:", response.status, errorText);
      throw new Error(`Airtable API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Error in fetchCampaigns:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.toString() })
    };
  }
};
