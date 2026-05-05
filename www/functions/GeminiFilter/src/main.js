import { Client, Account } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  // ── 1. Initialize Appwrite Client for session validation ─────────────────
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID);

  // ── 2. SECURITY: Authenticate the caller ─────────────────────────────────
  // Every valid request from CubbyCove's frontend contains the active user's
  // JWT in the Authorization header (set automatically by the Appwrite SDK).
  const jwt = req.headers['x-appwrite-user-jwt'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!jwt) {
    error('Rejected: No auth token supplied.');
    return res.json({ success: false, error: 'Authentication required.' }, 401);
  }

  // Verify the JWT is valid by creating a session-scoped client and calling account.get()
  const userClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setJWT(jwt);

  try {
    const account = new Account(userClient);
    const user = await account.get();
    log(`Authenticated request from user: ${user.$id} (${user.email || 'anonymous'})`);
  } catch (authErr) {
    error(`Rejected: Invalid JWT — ${authErr.message}`);
    return res.json({ success: false, error: 'Authentication failed. Please log in again.' }, 403);
  }

  // ── 3. Safely parse the prompt (handles both String and Object formats) ───
  let userPrompt = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    userPrompt = body?.prompt;
  } catch (err) {
    error('Failed to parse request body: ' + err.message);
    return res.json({ success: false, error: 'Invalid request format.' }, 400);
  }

  if (!userPrompt || typeof userPrompt !== 'string') {
    return res.json({ success: false, error: 'A non-empty "prompt" string is required.' }, 400);
  }

  // ── 4. Basic prompt length guard to prevent API abuse ────────────────────
  const MAX_PROMPT_LENGTH = 4000;
  if (userPrompt.length > MAX_PROMPT_LENGTH) {
    return res.json({ success: false, error: `Prompt too long. Maximum is ${MAX_PROMPT_LENGTH} characters.` }, 400);
  }

  // ── 5. Call AI providers (Gemini primary, Groq fallback) ─────────────────
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const groqApiKey   = process.env.GROQ_API_KEY;

  async function tryGemini(prompt) {
    if (!geminiApiKey) throw new Error('Gemini API Key missing from function environment variables.');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const data = await response.json();
    if (data.error) throw new Error(`Gemini Error: ${data.error.message}`);
    return data.candidates[0].content.parts[0].text;
  }

  async function tryGroq(prompt) {
    if (!groqApiKey) throw new Error('Groq API Key missing from function environment variables.');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(`Groq Error: ${data.error.message}`);
    return data.choices[0].message.content;
  }

  try {
    log('Attempting Gemini...');
    const result = await tryGemini(userPrompt);
    return res.json({ success: true, result, provider: 'gemini' });
  } catch (geminiErr) {
    error(`Gemini failed: ${geminiErr.message}`);

    if (groqApiKey) {
      try {
        log('Attempting Groq fallback...');
        const result = await tryGroq(userPrompt);
        return res.json({ success: true, result, provider: 'groq' });
      } catch (groqErr) {
        error(`Groq fallback failed: ${groqErr.message}`);
      }
    }

    return res.json({ success: false, error: 'All AI providers failed.' }, 500);
  }
};