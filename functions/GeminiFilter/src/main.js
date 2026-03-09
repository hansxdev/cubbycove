import { Client } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  // 1. Initialize Appwrite Client
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID);

  // 2. Safely extract the prompt (Handles both String and Object formats)
  let userPrompt = '';
  try {
    // Check if Appwrite already parsed it into an object for us
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    userPrompt = body.prompt;
  } catch (err) {
    error('Failed to parse request body: ' + err.message);
    return res.json({ success: false, error: 'Invalid request format.' }, 400);
  }

  if (!userPrompt) {
    return res.json({ success: false, error: 'Prompt is required.' }, 400);
  }

  // 3. Call the Gemini API securely
  const apiKey = process.env.GEMINI_API_KEY; 
  
  if (!apiKey) {
      error('API Key is missing from Environment Variables');
      return res.json({ success: false, error: 'Server configuration error.' }, 500);
  }
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: userPrompt }]
        }]
      })
    });

    const data = await response.json();
    
    // Check if Google returned an error
    if (data.error) {
        error(`Google API Error: ${data.error.message}`);
        return res.json({ success: false, error: 'Gemini API rejected the request.' }, 500);
    }

    const geminiText = data.candidates[0].content.parts[0].text;

    // 4. Send the result back
    return res.json({
      success: true,
      result: geminiText
    });

  } catch (err) {
    error(`Fetch Error: ${err.message}`);
    return res.json({ success: false, error: 'Failed to connect to Gemini.' }, 500);
  }
};