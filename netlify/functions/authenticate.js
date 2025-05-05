// netlify/functions/authenticate.js

const jwt = require('jsonwebtoken');
const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// JWT Secret should be set in Netlify environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key-change-this';

// Table ID for talent agencies
const AGENCY_TABLE_ID = 'tblcXDoQyz2efkRd3'; // Replace with your actual Talent Agencies table ID

exports.handler = async function(event, context) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { username, password } = requestBody;

    // Validate input
    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Username and password are required' })
      };
    }

    // Authenticate user
    const agency = await authenticateAgency(username, password);

    if (!agency) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        agencyId: agency.id,
        agencyName: agency.name,
        username: username
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return token in response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Authentication successful',
        token,
        agencyId: agency.id,
        agencyName: agency.name
      })
    };

  } catch (error) {
    console.error('Authentication error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// Function to authenticate an agency
async function authenticateAgency(username, password) {
  // In a real application, you would use a secure hashing algorithm
  // For this example, we'll look for agencies with matching credentials

  return new Promise((resolve, reject) => {
    try {
      // Query Airtable for an agency with the given username
      // This assumes you have Username and Password fields in your Talent Agencies table
      const formula = `{Username} = "${username}"`;

      base(AGENCY_TABLE_ID).select({
        filterByFormula: formula,
        maxRecords: 1
      }).firstPage((err, records) => {
        if (err) {
          console.error('Airtable query error:', err);
          return reject(err);
        }

        if (!records || records.length === 0) {
          return resolve(null); // No agency found with that username
        }

        const agency = records[0];
        const storedPassword = agency.fields.Password;

        // Check if password matches
        if (password === storedPassword) {
          // Return agency data
          resolve({
            id: agency.id,
            name: agency.fields.Name || 'Unknown Agency'
          });
        } else {
          resolve(null); // Password doesn't match
        }
      });
    } catch (error) {
      console.error('Authentication error:', error);
      reject(error);
    }
  });
}