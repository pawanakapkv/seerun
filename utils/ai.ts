const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export async function detectComplexity(code: string): Promise<{ time: string, space: string }> {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing Gemini API Key. Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.");
  }

  const prompt = `You are an expert computer scientist. Analyze the following code and determine its Big-O Time and Space complexity.
Respond ONLY with a valid JSON object in this exact format: {"time": "O(n)", "space": "O(1)"}. Do not wrap it in markdown blockquotes.

Code:
${code}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error("Failed to parse response from Gemini");
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Gemini returned invalid JSON");
  }
}
