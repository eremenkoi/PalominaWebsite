// netlify/functions/fetchCampaigns.js

const fetch = require('node-fetch');

exports.handler = async (event) => {
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  // This should be the table ID for your Campaigns table!
  const TABLE_ID = 'tbl8Ctde8oJ1FGP4y';

  let filter = event.queryStringParameters && event.queryStringParameters.filter;
  if (!filter) {
    // Default filter if none is provided
    filter = '{Client} = "Sunday Gravy"';
  }

  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${encodeURIComponent(filter)}`;
  console.log("Requesting Campaigns URL:", url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.toString() })
    };
  }
};
