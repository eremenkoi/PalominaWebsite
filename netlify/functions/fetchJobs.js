// netlify/functions/fetchJobs.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Retrieve your Airtable credentials from environment variables.
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TABLE_NAME = 'Jobs'; // Change this if your jobs table is named differently.

  // Use an optional filter passed as a query parameter.
  const { filter = '' } = event.queryStringParameters || {};

  // Construct the Airtable API URL for the Jobs table.
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}${filter ? '?filterByFormula=' + encodeURIComponent(filter) : ''}`;

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
    console.error('Error fetching jobs data from Airtable:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch jobs data.' })
    };
  }
};
