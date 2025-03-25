// netlify/functions/fetchJobDetails.js

const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Get job number from query params
    const jobNumber = event.queryStringParameters?.jobNumber;

    if (!jobNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Job number is required" })
      };
    }

    // Fetch job details
    const job = await getJobDetails(jobNumber);

    if (!job) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Job not found" })
      };
    }

    // Fetch talent for this job
    const talent = await getTalentForJob(jobNumber);

    // Return data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        job,
        talent
      })
    };

  } catch (error) {
    console.error("Error fetching job details:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch job details: " + error.message })
    };
  }
};

// Get job details from Airtable
async function getJobDetails(jobNumber) {
  return new Promise((resolve, reject) => {
    base('Jobs').select({
      maxRecords: 1,
      filterByFormula: `{Job Number} = "${jobNumber}"`
    }).firstPage((err, records) => {
      if (err) {
        return reject(err);
      }

      if (records.length === 0) {
        return resolve(null);
      }

      const record = records[0];
      const fields = record.fields;

      // Format job data
      const job = {
        id: record.id,
        jobNumber: fields["Job Number"] || jobNumber,
        jobName: fields["Job Name"] || "Unnamed Job",
        firstOnAir: fields["First On Air"] || null,
        contractEnd: fields["Contract Ends (Calculated) Date For Sorting"] || null,
        contractTerm: fields["Contract Term"] || null,
        client: fields["Client"] || fields["Advertiser"] || null,
        campaign: fields["Campaign"] || null,
        territory: fields["Territory"] || "Australia",
        usageRights: fields["Campaign Release/Usage"] || null,
        jobDescription: fields["Job Description / Product Details"] || null,

        // Add any other fields needed for the job details page
        documents: formatDocuments(fields)
      };

      resolve(job);
    });
  });
}

// Get talent associated with this job
async function getTalentForJob(jobNumber) {
  return new Promise((resolve, reject) => {
    base('Talent').select({
      filterByFormula: `{Job No.} = "${jobNumber}"`
    }).all((err, records) => {
      if (err) {
        return reject(err);
      }

      const talent = records.map(record => {
        const fields = record.fields;

        // Get person name from Person lookup
        let personName = "Unknown";
        if (fields["Person"] && fields["Person"].length > 0) {
          // Check if we have Person fields expanded
          if (typeof fields["Person"][0] === 'object') {
            personName = fields["Person"][0]?.fields?.["Legal Name"] ||
                          fields["Person"][0]?.fields?.["Name"] ||
                          fields["Person"][0]?.id;
          } else {
            // Just have the ID
            personName = `Person ${fields["Person"][0]}`;
          }
        }

        // Get agency name from Talent Agency lookup
        let agencyName = "N/A";
        if (fields["Talent Agency"] && fields["Talent Agency"].length > 0) {
          // Check if we have Agency fields expanded
          if (typeof fields["Talent Agency"][0] === 'object') {
            agencyName = fields["Talent Agency"][0]?.fields?.["Name"] ||
                          fields["Talent Agency"][0]?.id;
          } else {
            // Just have the ID
            agencyName = `Agency ${fields["Talent Agency"][0]}`;
          }
        }

        return {
          id: record.id,
          name: personName,
          agency: agencyName,
          type: fields["Type"] || "Freelance",
          role: fields["Role"] || "N/A",
          contractFee: fields["Contract Fee OLD"] || null,
          dealMemo: fields["Deal Memo"] ? fields["Deal Memo"][0]?.url : null,
          contract: fields["Contract / DOR"] ? fields["Contract / DOR"][0]?.url : null
        };
      });

      resolve(talent);
    });
  });
}

// Format documents from job record
function formatDocuments(fields) {
  const documents = [];

  // Check for attachments
  const fieldNames = ["Job Summary", "Contract Ends (Calculated) DATE (from Job No.) 2"];

  fieldNames.forEach(fieldName => {
    if (fields[fieldName] && Array.isArray(fields[fieldName])) {
      fields[fieldName].forEach(attachment => {
        if (attachment.url) {
          documents.push({
            name: attachment.filename || fieldName,
            url: attachment.url,
            type: attachment.type
          });
        }
      });
    }
  });

  return documents;
}