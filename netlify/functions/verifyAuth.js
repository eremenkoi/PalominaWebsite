// netlify/functions/verifyAuth.js

const jwt = require('jsonwebtoken');

// JWT Secret should be set in Netlify environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key-change-this';

// Function to verify a JWT token
function verifyToken(token) {
  try {
    if (!token) {
      return null;
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Function to extract the token from Authorization header
function extractToken(event) {
  // Try to get token from Authorization header
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' from the header
  }

  // Try to get token from query parameters
  const queryParams = event.queryStringParameters || {};
  if (queryParams.token) {
    return queryParams.token;
  }

  return null;
}

// Export the middleware
module.exports = {
  verifyAuth: function(event) {
    const token = extractToken(event);
    return verifyToken(token);
  }
};