/**
 * PriceGuardSnapshotService.gs
 * ---------------------------------------------------------------------------
 * Orchestrates the Price Guard daily pipeline. Mirrors the step
 * structure of the original project's executeDailyPipeline_() (in its
 * Code.gs) exactly - same 7 steps, same per-step report shape - just
 * reassembled from the PriceGuard*.gs services above instead of being
 * inlined in one function.
 *
 * Entry points:
 *   - runDailyPipeline(): the full 7-step pipeline. Called by both
 *     api_runPriceGuardDailySync() (on-demand from the dashboard) and
 *     priceGuardDailyPipelineTrigger() (the 8am WAT time trigger, see
 *     Code.gs) - exactly like the original's runDailySyncJob() /
 *     scheduledDailyJobTrigger() both calling executeDailyPipeline_().
 *   - rebuildReadSnapshots(): just steps 5-ish worth of snapshot
 *     rebuilds (matches + recommendations), for a fast manual refresh
 *     without re-running schema bootstrap / scraper dispatch / email.
 * ---------------------------------------------------------------------------
 */

const PriceGuardSnapshotService = {
  /**
   * Runs the full 7-step Price Guard daily pipeline.
   * @return {Object} report - {overall_success, steps, started_at, completed_at}
   */
  runDailyPipeline: function () {
    const report = {
      overall_success: false,
      steps: {},
      started_at: new Date().toISOString(),
      completed_at: null
    };

    try {
      Logger.log('[Price Guard 1/7] Ensuring BigQuery tables exist...');
      report.steps.schema = PriceGuardSchemaService.ensureTablesExist();

      Logger.log('[Price Guard 2/7] Refreshing internal product catalog...');
      report.steps.catalog = PriceGuardDataIngestionService.refreshInternalCatalog();

      Logger.log('[Price Guard 3/7] Ingesting partner competitor data (SPAR, SuperSaver)...');
      report.steps.partners = PriceGuardDataIngestionService.ingestPartnerCompetitors();

      Logger.log('[Price Guard 4/7] Dispatching scraper pipeline (Mano, Chowdeck)...');
      report.steps.scrapers = PriceGuardDataIngestionService.triggerScraperPipeline();

      Logger.log('[Price Guard 5/7] Computing and persisting daily metrics...');
      report.steps.metrics = PriceGuardMetricSnapshotService.computeAndPersistDailyMetrics();

      Logger.log('[Price Guard 6/7] Computing and persisting daily alerts...');
      report.steps.alerts = PriceGuardMetricSnapshotService.computeAndPersistAlerts();

      Logger.log('[Price Guard 6.5/7] Rebuilding matches + recommendations snapshots...');
      report.steps.read_snapshots = PriceGuardSnapshotService.rebuildReadSnapshots();

      Logger.log('[Price Guard 7/7] Sending daily alert digest...');
      const settings = PriceGuardSettingsService.getSettings();
      if (settings.notifications.send_daily_summary) {
        report.steps.email = { success: PriceGuardMailService.sendDailyAlertsDigest(), message: 'Email digest sent.' };
      } else {
        report.steps.email = { success: true, message: 'Email notifications disabled in settings.' };
      }

      // Steps 1-3, 5-6 are critical; step 4 (scraper dispatch) is best-effort,
      // same criteria as the original executeDailyPipeline_().
      report.overall_success = report.steps.catalog.success && report.steps.metrics.success;
    } catch (err) {
      Logger.log('Price Guard pipeline fatal error: ' + err.toString());
      report.steps.fatal_error = { success: false, message: err.toString() };
      report.overall_success = false;
    }

    report.completed_at = new Date().toISOString();
    return report;
  },

  /**
   * Rebuilds just the two "read" snapshots (matches_snapshot,
   * price_recommendations pending/history) without the rest of the
   * pipeline. Called after every recommendation write, and available as
   * its own on-demand action (api_runPriceGuardSnapshotNow).
   * @return {Object} {success}
   */
  rebuildReadSnapshots: function () {
    try {
      SnapshotService.rebuildMatchesSnapshot();
      SnapshotService.rebuildRecommendationsSnapshots();
      Utilities_.clearCache(['price_guard_recommendations_pending', 'price_guard_recommendations_history']);
      return { success: true };
    } catch (err) {
      Logger.log('PriceGuardSnapshotService.rebuildReadSnapshots failed: ' + err.toString());
      return { success: false, message: err.toString() };
    }
  },

  /**
   * Rebuilds just the recommendations snapshots (pending + history).
   * Called from PriceGuardPricingActionService after every write, kept
   * as its own method so a recommendation write doesn't also rebuild
   * matches_snapshot unnecessarily.
   */
  rebuildRecommendationsSnapshots: function () {
    SnapshotService.rebuildRecommendationsSnapshots();
  },

  /**
   * Returns Price Guard pipeline run status/last-run metadata.
   * @return {Object}
   */
  getPipelineStatus: function () {
    const props = PropertiesService.getScriptProperties();
    const lastRun = props.getProperty('PRICE_GUARD_LAST_PIPELINE_RUN');
    const lastStatus = props.getProperty('PRICE_GUARD_LAST_PIPELINE_STATUS');
    return {
      last_run: lastRun || 'Never',
      last_status: lastStatus || 'Unknown',
      project_id: CONFIG.BQ_PROJECT_ID,
      dataset: CONFIG.BQ_DATASET_PRICE_GUARD
    };
  }
};
