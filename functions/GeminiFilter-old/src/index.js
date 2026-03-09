import fetch from 'node-fetch';

/**
 * Appwrite Function: GeminiFilter
 * 
 * Environment Variables Required:
 * - GEMINI_API_KEY: Your Google Gemini API Key
 */
export default async ({ req, res, log, error }) => {
    // Check if API key is configured
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        error("GEMINI_API_KEY environment variable is not set.");
        return res.json({ success: false, error: "Server Configuration Error" }, 500);
    }

    try {
        // Parse the request body
        let payload = req.body;
        if (typeof payload === 'string') {
            payload = JSON.parse(payload);
        }

        const action = payload.action || 'filter_message';
        const text = payload.text || payload.prompt || '';

        if (!text) {
            return res.json({ success: false, error: "No text provided to filter." }, 400);
        }

        log(`Processing action: ${action} for text length: ${text.length}`);

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        let promptText = '';

        if (action === 'filter_bio') {
            promptText = `You are a strict content moderator for a platform used by kids. 
Check the following user biography for profanity, inappropriate content, or personal contact info (like phone numbers/addresses).

Bio: "${text}"

Return a JSON object with exactly two fields:
1. "blocked" (boolean): true if the bio is inappropriate or has PII, false if it is completely safe.
2. "reason" (string): brief reason.`;
        } else {
            promptText = `You are a strict content moderator for a platform used by elementary school students. 
Check the following message for profanity, cyberbullying, or inappropriate content.

Message: "${text}"

Return a JSON object with exactly two fields:
1. "isSafe" (boolean): true if the message is completely safe, false if it contains profanity or bullying.
2. "reason" (string): a very brief reason for your decision.`;
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { responseMimeType: 'application/json' }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            error(`Gemini API Error: ${response.status} - ${errorData}`);
            return res.json({ success: false, error: "Failed to communicate with AI Service." }, 502);
        }

        const data = await response.json();
        const generatedText = data.candidates[0].content.parts[0].text;

        log(`Gemini response: ${generatedText}`);

        // Ensure valid JSON
        const evaluation = JSON.parse(generatedText);

        return res.json({
            success: true,
            result: evaluation
        });

    } catch (err) {
        error(`Function Error: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
