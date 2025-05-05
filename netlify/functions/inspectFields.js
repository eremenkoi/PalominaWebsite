// netlify/functions/inspectFields.js
const Airtable = require('airtable');

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Initialize Airtable
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Missing Airtable credentials" })
      };
    }

    const base = new Airtable({ apiKey }).base(baseId);

    // Get the table ID from the query parameter
    const tableId = event.queryStringParameters?.tableId || 'tbl9O07R90s6qdgtK';

    console.log(`Inspecting fields for table: ${tableId}`);

    // Fetch a sample record to analyze fields
    const records = await base(tableId).select({
      maxRecords: 1
    }).firstPage();

    if (!records || records.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "No records found in table" })
      };
    }

    const sampleRecord = records[0];

    // Get field information
    const fieldNames = Object.keys(sampleRecord.fields);

    // Create more detailed field info
    const fieldInfo = {};
    fieldNames.forEach(fieldName => {
      const value = sampleRecord.fields[fieldName];
      const valueType = Array.isArray(value) ? 'array' : typeof value;

      // For arrays, try to determine the type of elements
      let elementType = null;
      if (Array.isArray(value) && value.length > 0) {
        const firstElement = value[0];
        elementType = typeof firstElement;

        // Check if it's a linked record (object with id)
        if (elementType === 'object' && firstElement !== null && firstElement.id) {
          elementType = 'linked_record';
        }
      }

      fieldInfo[fieldName] = {
        type: valueType,
        elementType: elementType,
        sample: truncateValue(value)
      };
    });

    // Get table schema information if available
    let tableSchema = null;
    try {
      // This is a more direct method but may not work with all Airtable APIs
      const schema = await base(tableId).schema;
      if (schema) {
        tableSchema = schema;
      }
    } catch (error) {
      console.log("Could not retrieve schema", error);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        tableId,
        fieldCount: fieldNames.length,
        fieldNames,
        fieldInfo,
        tableSchema: tableSchema
      })
    };

  } catch (error) {
    console.error("Error inspecting fields:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Error inspecting fields: " + error.message })
    };
  }
};

// Helper to truncate long values for display
function truncateValue(value) {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    // For arrays, truncate each element
    return '[' + value.slice(0, 3).map(item => {
      if (typeof item === 'object' && item !== null) {
        if (item.id) {
          return `{id: "${item.id}"}`;
        }
        return '{object}';
      }
      return truncateValue(item);
    }).join(', ') + (value.length > 3 ? `, ... (${value.length} items)` : '') + ']';
  }

  if (typeof value === 'object' && value !== null) {
    return '{object}';
  }

  if (typeof value === 'string') {
    return value.length > 50 ? value.substring(0, 47) + '...' : value;
  }

  return String(value);
}