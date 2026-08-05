/**
 * MfcAiReviewService.gs
 * ---------------------------------------------------------------------------
 * Generates the MFC WBR-review (weekly), daily-review, and monthly-review,
 * and answers Ask-AI questions - all grounded in the same MFC data
 * MfcAnalyticsService and DashboardService already serve to the dashboard
 * pages, via GeminiService.
 *
 * Reviews are NOT generated on every read. generate*Review() is called by
 * the time-driven triggers (see Code.gs's weeklyWbrReviewTrigger /
 * dailyReviewTrigger / monthlyReviewTrigger) or on demand via the *Now
 * POST actions, and store their result in PropertiesService. get*Review()
 * just reads that stored result - instant, no Gemini call, same
 * "precompute once, read many times" shape as every BigQuery snapshot
 * table in this app.
 *
 * v1 scope: only metrics that exist in a real endpoint today (availability,
 * orders/delivered-orders, category & product sales WoW growth, weekly AND
 * monthly threshold attainment). Nothing here invents nSFR or any other
 * metric this backend doesn't actually have.
 * ---------------------------------------------------------------------------
 */

const MfcAiReviewService = {
  WBR_PROPERTY_KEY: 'mfc_wbr_review_latest',
  DAILY_PROPERTY_KEY: 'mfc_daily_review_latest',
  MONTHLY_PROPERTY_KEY: 'mfc_monthly_review_latest',

  // Conservative cap on Ask-AI calls per rolling minute, kept comfortably
  // under the Gemini free tier's per-model RPM ceiling (check your actual
  // limit at https://aistudio.google.com/rate-limit and adjust if needed -
  // Google no longer publishes a static per-model table in the docs).
  ASK_AI_THROTTLE_PER_MINUTE: 8,

  /**
   * Generates and stores this week's WBR-review. Call target for
   * weeklyWbrReviewTrigger (Monday 9am) or generateMfcWbrReviewNow.
   * @return {Object}
   */
  generateWbrReview: function () {
    const context = MfcAiReviewService._buildContext_();
    const review = MfcAiReviewService._callGeminiForReview_(context, 'wbr');
    return MfcAiReviewService._saveReview_(MfcAiReviewService.WBR_PROPERTY_KEY, MfcAiReviewService._weekLabel_(), review);
  },

  /**
   * Generates and stores today's daily-review. Call target for
   * dailyReviewTrigger (daily 9am) or generateMfcDailyReviewNow.
   * @return {Object}
   */
  generateDailyReview: function () {
    const context = MfcAiReviewService._buildContext_();
    const review = MfcAiReviewService._callGeminiForReview_(context, 'daily');
    return MfcAiReviewService._saveReview_(MfcAiReviewService.DAILY_PROPERTY_KEY, MfcAiReviewService._dayLabel_(), review);
  },

  /**
   * Generates and stores this month's monthly-review (reviewing the month
   * that just ended). Call target for monthlyReviewTrigger (1st of month,
   * 9am) or generateMfcMonthlyReviewNow.
   * @return {Object}
   */
  generateMonthlyReview: function () {
    const context = MfcAiReviewService._buildContext_();
    const review = MfcAiReviewService._callGeminiForReview_(context, 'monthly');
    return MfcAiReviewService._saveReview_(MfcAiReviewService.MONTHLY_PROPERTY_KEY, MfcAiReviewService._monthLabel_(), review);
  },

  /**
   * Reads the last generated WBR-review. No Gemini call.
   * @return {Object}
   */
  getWbrReview: function () {
    return MfcAiReviewService._readReview_(MfcAiReviewService.WBR_PROPERTY_KEY);
  },

  /**
   * Reads the last generated daily-review. No Gemini call.
   * @return {Object}
   */
  getDailyReview: function () {
    return MfcAiReviewService._readReview_(MfcAiReviewService.DAILY_PROPERTY_KEY);
  },

  /**
   * Reads the last generated monthly-review. No Gemini call.
   * @return {Object}
   */
  getMonthlyReview: function () {
    return MfcAiReviewService._readReview_(MfcAiReviewService.MONTHLY_PROPERTY_KEY);
  },

  /**
   * Answers a grounded, multi-turn question about the MFC business.
   * @param {string} question
   * @param {Array<{role: string, text: string}>} history Prior turns in
   *   this session, oldest first, as sent back by the client (this backend
   *   is stateless - the client is the source of truth for conversation
   *   history).
   * @return {Object} {error, throttled, answer}
   */
  askAi: function (question, history) {
    const q = Utilities_.toSafeString(question);
    if (!q) throw new Error('A question is required.');

    if (!MfcAiReviewService._allowAskAiCall_()) {
      return {
        error: false,
        throttled: true,
        answer: "I'm getting a lot of questions right now - give me a few seconds and try again."
      };
    }

    const context = MfcAiReviewService._buildContext_();
    const systemInstruction = MfcAiReviewService._askAiSystemInstruction_(context);

    const turns = (history || [])
      .map(function (h) {
        return { role: h.role === 'model' ? 'model' : 'user', text: Utilities_.toSafeString(h.text) };
      })
      .filter(function (t) { return !!t.text; });
    turns.push({ role: 'user', text: q });

    const schema = {
      type: 'OBJECT',
      properties: { answer: { type: 'STRING' } },
      required: ['answer']
    };

    const result = GeminiService.generateJson(systemInstruction, turns, schema);
    return { error: false, throttled: false, answer: Utilities_.toSafeString(result.answer) };
  },

  /**
   * Pulls everything a review or an Ask-AI answer might need to cite, in
   * one compact bundle: availability (both stores), delivered orders (both
   * stores), the biggest WoW movers in category/product sales (not the
   * full catalog - keeps the prompt small and keeps the model's attention
   * on what's actually noteworthy), and the products furthest behind their
   * weekly AND monthly delivery thresholds.
   *
   * Every field here comes from an existing service (MfcAnalyticsService /
   * DashboardService) already used by the real dashboard pages - reused as-
   * is, including their own caching, rather than querying BigQuery again.
   * @return {Object}
   * @private
   */
  _buildContext_: function () {
    const category = MfcAnalyticsService.getCategorySalesReport({});
    const product = MfcAnalyticsService.getProductSalesReport({});
    const orders = MfcAnalyticsService.getOrders();
    const threshold = MfcAnalyticsService.getProductThresholdReport({});
    const dashboard = DashboardService.getDashboardData();

    return {
      // Absolute anchor for every relative label below (yesterday,
      // currentWeek, lastWeek, monthToDate, delivered7d/WoW figures).
      // Without this, the model has only field *names* to infer time
      // range from, no actual date - see MfcAiReviewService.gs header
      // comment for why this was added.
      asOfDate: MfcAiReviewService._asOfDate_(),
      // The one real data-freshness signal available anywhere in this
      // context - dashboard_snapshot.last_updated. The 4 MFC-specific
      // tables below (category/product sales, orders, threshold) carry no
      // snapshot timestamp of their own (they're straight `SELECT *`
      // copies in SnapshotService.gs with no timestamp column added), so
      // their freshness is NOT independently verifiable here - it relies
      // on SnapshotService.runDailySnapshot() actually having run today
      // before this generation trigger fires.
      availabilityDataLastUpdated: dashboard.summary ? dashboard.summary.lastUpdated : null,

      deliveredOrders: orders.orders,
      availability: {
        losf1: dashboard.losf1AvailabilityCard,
        mnlf1: dashboard.mnlf1AvailabilityCard,
        ultrafresh: dashboard.ultrafreshAvailabilityCard
      },
      topMovingCategories: MfcAiReviewService._topMovers_(category.categories, 'wowGrowthDelivered', 8),
      topMovingProducts: MfcAiReviewService._topMovers_(product.products, 'wowGrowthDelivered', 10),
      productsFurthestBehindWeeklyThreshold: MfcAiReviewService._atRiskThresholdProducts_(
        threshold.products, 10, 'weeklyThreshold', 'deliveredCurrentWeek'),
      productsFurthestBehindMonthlyThreshold: MfcAiReviewService._atRiskThresholdProducts_(
        threshold.products, 10, 'monthlyThreshold', 'deliveredMonthToDate')
    };
  },

  /**
   * @param {Array<Object>} rows
   * @param {string} key Numeric field to rank by absolute value.
   * @param {number} limit
   * @return {Array<Object>}
   * @private
   */
  _topMovers_: function (rows, key, limit) {
    return (rows || [])
      .slice()
      .sort(function (a, b) { return Math.abs(b[key]) - Math.abs(a[key]); })
      .slice(0, limit);
  },

  /**
   * Ranks products by how far behind a delivery threshold they are
   * (deliveredKey / thresholdKey, ascending) - computed from the two
   * numeric fields directly rather than trusting the *ThresholdMet string
   * columns, whose exact values ('Yes'/'No' vs true/false) aren't
   * confirmed against live data. Used for both the weekly and monthly
   * threshold, just with different field names.
   * @param {Array<Object>} rows
   * @param {number} limit
   * @param {string} thresholdKey e.g. 'weeklyThreshold' | 'monthlyThreshold'
   * @param {string} deliveredKey e.g. 'deliveredCurrentWeek' | 'deliveredMonthToDate'
   * @return {Array<Object>}
   * @private
   */
  _atRiskThresholdProducts_: function (rows, limit, thresholdKey, deliveredKey) {
    return (rows || [])
      .filter(function (r) { return r[thresholdKey] > 0; })
      .map(function (r) {
        const withAttainment = {};
        for (const k in r) withAttainment[k] = r[k];
        withAttainment.attainment = Utilities_.safeRatio(r[deliveredKey], r[thresholdKey]);
        return withAttainment;
      })
      .sort(function (a, b) { return a.attainment - b.attainment; })
      .slice(0, limit);
  },

  /**
   * @param {Object} context From _buildContext_().
   * @param {string} kind 'wbr' | 'daily' | 'monthly'
   * @return {Object} Parsed review matching _reviewSchema_().
   * @private
   */
  _callGeminiForReview_: function (context, kind) {
    const systemInstruction = MfcAiReviewService._reviewSystemInstruction_(kind);
    const periodNoun = kind === 'wbr' ? "this week's" : kind === 'monthly' ? "this month's" : "today's";
    const userTurn = 'Here is ' + periodNoun +
      ' MFC Nigeria data as JSON. Generate the review from it.\n\n' + JSON.stringify(context);
    return GeminiService.generateJson(systemInstruction, [{ role: 'user', text: userTurn }], MfcAiReviewService._reviewSchema_());
  },

  /**
   * @return {Object} Gemini responseSchema for a WBR/daily/monthly review.
   * @private
   */
  _reviewSchema_: function () {
    const bulletList = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          metric: { type: 'STRING' },
          detail: { type: 'STRING' }
        },
        required: ['metric', 'detail']
      }
    };

    return {
      type: 'OBJECT',
      properties: {
        overallSummary: { type: 'STRING' },
        stores: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              store: { type: 'STRING' },
              highlights: bulletList,
              lowlights: bulletList
            },
            required: ['store', 'highlights', 'lowlights']
          }
        },
        recommendedActions: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING' },
              reason: { type: 'STRING' },
              store: { type: 'STRING' }
            },
            required: ['action', 'reason', 'store']
          }
        }
      },
      required: ['overallSummary', 'stores', 'recommendedActions']
    };
  },

  /**
   * @param {string} kind 'wbr' | 'daily' | 'monthly'
   * @return {string}
   * @private
   */
  _reviewSystemInstruction_: function (kind) {
    let periodInstruction;
    if (kind === 'wbr') {
      periodInstruction = 'Compare this period to the prior one using week-over-week (WoW) figures from the data (e.g. wowGrowthDelivered, availability percentChange).';
    } else if (kind === 'monthly') {
      periodInstruction = 'This is a MONTHLY review. The data does NOT contain a month-over-month percentage - do not invent one. Report month-to-date delivered orders (deliveredOrders.*.monthToDate) against the monthly run rate (totalMonthRunRate), and use productsFurthestBehindMonthlyThreshold for at-risk SKUs. Use topMovingCategories/topMovingProducts (a recent-week WoW snapshot) only as supporting color on what has been moving lately within the month, not as a month-over-month figure.';
    } else {
      periodInstruction = 'This is a DAILY review. The data does NOT contain a day-over-day comparison - do not invent one. Instead report yesterday\'s absolute figures (deliveredOrders.*.yesterday) alongside progress against the current week (currentWeek vs lastWeek) and the run rate.';
    }

    return [
      'You are writing an internal business review for the MFC (Micro-Fulfillment Center) Nigeria team, in the exact style of their Weekly Business Review deck: short, punchy bullets, each stating a metric, its change, and a concrete driver - not vague prose.',
      'You MUST only use numbers, SKU/product names, and category names that literally appear in the JSON data provided in the next message. Never invent a number, percentage, SKU, or category that is not present there.',
      'The data\'s time labels (yesterday, currentWeek, lastWeek, monthToDate, delivered7d, WoW figures) are RELATIVE, not absolute dates - interpret every one of them relative to context.asOfDate, which is today\'s actual date. Never state or imply a specific calendar date yourself; only asOfDate is authoritative, and it is not something you compute.',
      'context.availabilityDataLastUpdated is when the availability figures were last refreshed. If it is more than 2 days older than context.asOfDate, do not present availability numbers as current - say plainly in overallSummary that availability data looks stale as of that timestamp, instead of writing highlights/lowlights as if it were fresh.',
      'If there is genuinely nothing noteworthy for lowlights, say so plainly (e.g. "No lowlights this period") rather than manufacturing an issue.',
      periodInstruction,
      'Cover both stores separately in the "stores" array: one entry with store "LOSF1 (Island)" using the losf1 fields in the data, one entry with store "MNLF1 (Mainland)" using the mnlf1 fields.',
      'For each highlight/lowlight, name the metric (e.g. "Weighted availability", "UF availability", "Delivered orders", "<Category> sales"), state its change with the actual number from the data, and explain the driver by naming the specific categories/products from topMovingCategories/topMovingProducts that moved it.',
      'Use productsFurthestBehindWeeklyThreshold (or productsFurthestBehindMonthlyThreshold for a monthly review) to flag at-risk SKUs as lowlights where relevant.',
      'recommendedActions must be concrete and actionable (e.g. "Follow up with supplier for <product> low fill rate", "Investigate <category> availability drop at MNLF1"), each with a one-line reason grounded in the data, tagged with the store it applies to ("LOSF1 (Island)", "MNLF1 (Mainland)", or "Both").',
      'Keep every bullet to one sentence. No preamble, no sign-off, no markdown formatting inside the text fields - plain sentences only.'
    ].join(' ');
  },

  /**
   * @param {Object} context From _buildContext_().
   * @return {string}
   * @private
   */
  _askAiSystemInstruction_: function (context) {
    return [
      'You are an assistant answering questions about the MFC (Micro-Fulfillment Center) Nigeria business, for anyone on the team who clicks in to ask.',
      'Answer ONLY using the JSON data below. If the answer isn\'t in the data, say plainly that you don\'t have that data rather than guessing or making up a number.',
      'The data\'s time labels (yesterday, currentWeek, lastWeek, monthToDate, delivered7d, WoW figures) are relative to data.asOfDate, today\'s actual date - use that to answer date-relative questions correctly, and mention if data.availabilityDataLastUpdated looks stale relative to it.',
      'Be concise and conversational - a few sentences unless the question specifically asks for a list or breakdown.',
      'Data:\n' + JSON.stringify(context)
    ].join(' ');
  },

  /**
   * @param {string} key
   * @param {string} periodLabel
   * @param {Object} review Parsed Gemini response matching _reviewSchema_().
   * @return {Object}
   * @private
   */
  _saveReview_: function (key, periodLabel, review) {
    const record = {
      generatedAt: new Date().toISOString(),
      periodLabel: periodLabel,
      review: review
    };
    PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(record));
    return { error: false, hasData: true, generatedAt: record.generatedAt, periodLabel: record.periodLabel, review: record.review };
  },

  /**
   * @param {string} key
   * @return {Object}
   * @private
   */
  _readReview_: function (key) {
    const raw = PropertiesService.getScriptProperties().getProperty(key);
    if (!raw) return { error: false, hasData: false, generatedAt: null, periodLabel: null, review: null };
    const record = JSON.parse(raw);
    return { error: false, hasData: true, generatedAt: record.generatedAt, periodLabel: record.periodLabel, review: record.review };
  },

  /**
   * @return {boolean} Whether this Ask-AI call is under the per-minute cap.
   * @private
   */
  _allowAskAiCall_: function () {
    const cache = CacheService.getScriptCache();
    const minuteKey = 'askai_calls_' + Math.floor(Date.now() / 60000);
    const current = Number(cache.get(minuteKey) || '0');
    if (current >= MfcAiReviewService.ASK_AI_THROTTLE_PER_MINUTE) return false;
    cache.put(minuteKey, String(current + 1), 70); // >60s so the bucket outlives its own minute window
    return true;
  },

  /**
   * The absolute date anchor sent to Gemini alongside every relative time
   * label in the context (yesterday, currentWeek, monthToDate, etc.) - see
   * the header comment on _buildContext_'s return value for why this
   * exists.
   * @return {string} e.g. "Sunday, August 2, 2026"
   * @private
   */
  _asOfDate_: function () {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy');
  },

  /**
   * @return {string} e.g. "Jul 21 - Jul 27, 2026" for the week just ended
   *   (this runs Monday 9am, reviewing the week that finished yesterday).
   * @private
   */
  _weekLabel_: function () {
    const tz = Session.getScriptTimeZone();
    const now = new Date();
    const day = now.getDay();
    const daysSinceMonday = (day === 0 ? 6 : day - 1);
    const mostRecentMonday = new Date(now);
    mostRecentMonday.setDate(now.getDate() - daysSinceMonday);
    const priorMonday = new Date(mostRecentMonday);
    priorMonday.setDate(mostRecentMonday.getDate() - 7);
    const priorSunday = new Date(priorMonday);
    priorSunday.setDate(priorMonday.getDate() + 6);
    return Utilities.formatDate(priorMonday, tz, 'MMM d') + ' - ' + Utilities.formatDate(priorSunday, tz, 'MMM d, yyyy');
  },

  /**
   * @return {string} e.g. "Saturday, Aug 1, 2026" - the day being reviewed
   *   (this runs 9am, reviewing yesterday).
   * @private
   */
  _dayLabel_: function () {
    const tz = Session.getScriptTimeZone();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return Utilities.formatDate(yesterday, tz, 'EEEE, MMM d, yyyy');
  },

  /**
   * @return {string} e.g. "July 2026" - the month just ended (this runs on
   *   the 1st at 9am, reviewing the month that finished yesterday).
   * @private
   */
  _monthLabel_: function () {
    const tz = Session.getScriptTimeZone();
    const now = new Date();
    // Day 0 of the current month = the last day of the previous month.
    const lastDayOfPriorMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return Utilities.formatDate(lastDayOfPriorMonth, tz, 'MMMM yyyy');
  }
};
