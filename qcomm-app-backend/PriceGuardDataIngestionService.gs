/**
 * PriceGuardDataIngestionService.gs
 * ---------------------------------------------------------------------------
 * Migrated from the standalone Price Guard project's
 * DataIngestionService.gs. Two of its three steps are no-ops in the
 * source app (kept as no-ops here too, for parity + so the pipeline
 * report shape is unchanged):
 *
 *   1. refreshInternalCatalog - internal_products is refreshed by the
 *      external Glovo DWH pipeline, not by this backend.
 *   2. ingestPartnerCompetitors - spar_prices/supersaver_prices/
 *      mano_products/chowstore_products/raw_competitor_products are
 *      populated by the external Python scraper pipeline.
 *
 * The third step is real: dispatching the GitHub Actions workflow that
 * runs the Mano/Chowdeck scrapers.
 * ---------------------------------------------------------------------------
 */

const PriceGuardDataIngestionService = {
  /**
   * No-op: internal_products is externally managed. Preserved as a
   * distinct pipeline step (not silently dropped) so
   * PriceGuardSnapshotService's report shape matches the original.
   * @return {Object} {success, message}
   */
  refreshInternalCatalog: function () {
    return {
      success: true,
      message: 'Skipped: internal_products is externally managed by the Glovo DWH pipeline.'
    };
  },

  /**
   * No-op: competitor source tables are externally managed by the
   * Python scraper pipeline.
   * @return {Object} {success, results, message}
   */
  ingestPartnerCompetitors: function () {
    return {
      success: true,
      results: { spar: true, supersaver: true },
      message: 'Skipped: competitor tables are externally managed by the scraper pipeline.'
    };
  },

  /**
   * Dispatches the GitHub Actions workflow that runs the Mano/Chowdeck
   * Python scrapers and uploads their output to BigQuery. No-ops
   * gracefully if github.pat/repo aren't configured.
   * @return {Object} {success, message}
   */
  triggerScraperPipeline: function () {
    const settings = PriceGuardSettingsService.getSettings();

    if (!settings.github.pat || !settings.github.repo) {
      return {
        success: false,
        message: 'GitHub PAT or repo not configured in Price Guard settings. Scraper pipeline skipped.'
      };
    }

    try {
      const url = 'https://api.github.com/repos/' + settings.github.repo + '/dispatches';
      const headers = {
        Authorization: 'token ' + settings.github.pat,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'PriceGuard-QCommerce-Backend'
      };
      const payload = {
        event_type: 'run_scrapers',
        client_payload: {
          trigger_source: 'daily_pipeline',
          timestamp: new Date().toISOString()
        }
      };

      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        headers: headers,
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const code = response.getResponseCode();
      if (code === 204 || code === 200 || code === 201) {
        return { success: true, message: 'Scraper pipeline dispatched to GitHub Actions.' };
      }
      return { success: false, message: 'GitHub API returned code ' + code + ': ' + response.getContentText() };
    } catch (err) {
      return { success: false, message: 'Dispatch error: ' + err.toString() };
    }
  }
};
