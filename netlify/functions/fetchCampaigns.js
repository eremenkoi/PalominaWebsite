// netlify/functions/fetchCampaigns.js
// At the top of your function file
console.log("AIRTABLE_API_KEY exists?", !!process.env.AIRTABLE_API_KEY);
console.log("AIRTABLE_BASE_ID:", process.env.AIRTABLE_BASE_ID);



// If you're using Node.js versions below 18, you may need to install node-fetch:
// npm install node-fetch
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Retrieve sensitive credentials from environment variables
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID; // Ensure you add this in Netlify's settings too
  const TABLE_NAME = 'tbl8Ctde8oJ1FGP4y'; // Change this if your table has a different name

  // Optionally use a filter passed as a query parameter (e.g., for filtering campaigns)
  const { filter = '' } = event.queryStringParameters || {};

  // Construct the Airtable API URL
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}${filter ? '?filterByFormula=' + encodeURIComponent(filter) : ''}`;

  // Before calling fetch:
console.log("Requesting URL:", url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });
    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error fetching data from Airtable:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch data.' })
    };
  }
};
