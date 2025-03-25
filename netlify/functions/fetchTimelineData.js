// netlify/functions/fetchTimelineData.js

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Retrieve Airtable credentials from environment variables
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TABLE_NAME = 'tbl9O07R90s6qdgtK'; // Jobs Table ID

  // Get the optional client filter from query parameters.
  let client = event.queryStringParameters && event.queryStringParameters.client || "Sunday Gravy";

  // Build the filter formula to get records with both start and end dates
  const filterFormula = `AND({Client} = "${client}", NOT(ISBLANK({First On Air})), NOT(ISBLANK({Contract Ends (Calculated)})))`;

  // Request specific fields for the timeline
  const fields = [
    "Job Number",
    "Job Name",
    "First On Air",
    "Contract Term",
    "Contract Ends (Calculated)",
    "Advertiser",
    "Campaign"
  ];

  // Build the fields query parameter
  const fieldsQuery = fields.map(field => `fields[]=${encodeURIComponent(field)}`).join('&');

  // Request sorting by Contract Ends date (ascending - closest to expiry first)
  const sortQuery = `sort[0][field]=Contract+Ends+(Calculated)&sort[0][direction]=asc`;

  // Construct the full Airtable API URL
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(filterFormula)}&${fieldsQuery}&${sortQuery}`;

  console.log("Requesting URL:", url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Airtable API error in fetchTimelineData:", response.status, errorText);
      throw new Error(`Airtable API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Add a field indicating if a contract is expiring soon (30 days) or already expired
    const now = new Date();
    data.records.forEach(record => {
      if (record.fields["Contract Ends (Calculated)"]) {
        const endDate = new Date(record.fields["Contract Ends (Calculated)"]);
        const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
          record.fields.status = "expired";
        } else if (daysUntilExpiry < 30) {
          record.fields.status = "expiring";
        } else {
          record.fields.status = "active";
        }
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Error in fetchTimelineData:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.toString() })
    };
  }
};