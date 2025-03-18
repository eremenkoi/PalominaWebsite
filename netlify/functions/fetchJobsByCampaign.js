// netlify/functions/fetchJobsByCampaign.js

const fetch = require('node-fetch');

exports.handler = async (event) => {
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TABLE_ID = 'tbl9O07R90s6qdgtK'; // Jobs Table ID

  // Read campaignId from the query parameters
  const { campaignId } = event.queryStringParameters || {};
  if (!campaignId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "campaignId parameter is required" })
    };
  }

  // Filter formula to match jobs where {Campaign} = "recXYZ"
  const filterFormula = `{Campaign} = "${campaignId}"`;

  // Build the Airtable API request URL
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${encodeURIComponent(filterFormula)}`;
  console.log("fetchJobsByCampaign => Requesting Airtable URL:", url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Airtable error: ${response.status} ${errText}`);
    }
    const data = await response.json();

    console.log(`fetchJobsByCampaign => Found ${data.records.length} records`);
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error("Error in fetchJobsByCampaign:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.toString() })
    };
  }
};
