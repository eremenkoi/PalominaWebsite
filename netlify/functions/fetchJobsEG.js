// netlify/functions/fetchJobsEG.js
const Airtable = require('airtable');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY})
      .base(process.env.AIRTABLE_BASE_ID);

    // We only want Jobs whose Job Number begins with "EG"
    // Using Airtable's REGEX_MATCH formula:
    const records = await base('Jobs').select({
      // If your table is literally named "Jobs"
      filterByFormula: `REGEX_MATCH({Job Number}, '^EG')`
    }).all();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ records })
    };

  } catch (error) {
    console.error("Error fetching EG Jobs:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
