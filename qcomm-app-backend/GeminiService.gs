/**
 * GeminiService.gs
 * ---------------------------------------------------------------------------
 * Thin wrapper around the Gemini API (generateContent) - the same role
 * BigQueryService.gs plays for BigQuery: every call to Gemini goes through
 * here so auth, retries, and JSON-mode config only live in one place.
 *
 * The API key is read fresh from PropertiesService on every call - never
 * cached, never in CONFIG - so it never ends up committed to source. Set it
 * once via Apps Script editor -> Project Settings -> Script Properties ->
 * add GEMINI_API_KEY (get a free key at https://aistudio.google.com/apikey).
 * ---------------------------------------------------------------------------
 */

const GeminiService = {
  /**
   * Calls Gemini's generateContent with structured JSON output and returns
   * the parsed object. Every caller in this app wants JSON back (a review
   * object, or {answer: "..."} for Ask-AI) rather than free text, so this
   * is the only entry point - there's no plain-text variant.
   * @param {string} systemInstruction Grounding/behavior instructions - the
   *   data context and anti-hallucination rules live here, not in `turns`.
   * @param {Array<{role: string, text: string}>} turns Conversation turns,
   *   oldest first. role is 'user' or 'model'. A single-shot call (review
   *   generation) just passes one 'user' turn.
   * @param {Object} responseSchema Gemini responseSchema (JSON Schema
   *   subset) describing the expected JSON shape.
   * @return {Object} The parsed JSON response.
   */
  generateJson: function (systemInstruction, turns, responseSchema) {
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in Script Properties. See GeminiService.gs header for setup.');
    }

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.GEMINI_MODEL + ':generateContent';

    const payload = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: turns.map(function (t) {
        return { role: t.role, parts: [{ text: t.text }] };
      }),
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      }
    };

    const response = GeminiService._fetchWithRetry(url, apiKey, payload);
    return GeminiService._extractJson(response);
  },

  /**
   * @param {string} url
   * @param {string} apiKey
   * @param {Object} payload
   * @return {Object} Parsed Gemini API response body.
   * @private
   */
  _fetchWithRetry: function (url, apiKey, payload) {
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    let res = UrlFetchApp.fetch(url, options);

    // One retry on rate-limit / transient server errors - the free tier's
    // low RPM ceiling means a single burst (e.g. two people opening Ask-AI
    // at once, or a trigger overlapping a manual "regenerate" click) can
    // trip a 429.
    if (res.getResponseCode() === 429 || res.getResponseCode() >= 500) {
      Utilities.sleep(2000);
      res = UrlFetchApp.fetch(url, options);
    }

    if (res.getResponseCode() !== 200) {
      throw new Error('Gemini API request failed (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 500));
    }

    return JSON.parse(res.getContentText());
  },

  /**
   * Pulls the model's text out of a generateContent response and parses it
   * as JSON (safe because generationConfig.responseMimeType forces the
   * model to return a JSON string, not markdown-fenced text).
   * @param {Object} response Raw generateContent response body.
   * @return {Object}
   * @private
   */
  _extractJson: function (response) {
    const candidate = response.candidates && response.candidates[0];
    const text = candidate && candidate.content && candidate.content.parts &&
      candidate.content.parts[0] && candidate.content.parts[0].text;
    if (!text) {
      throw new Error('Gemini API returned no content. Response: ' + JSON.stringify(response).slice(0, 500));
    }
    return JSON.parse(text);
  }
};
