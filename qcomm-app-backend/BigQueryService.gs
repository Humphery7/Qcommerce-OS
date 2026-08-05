/**
 * BigQueryService.gs
 * ---------------------------------------------------------------------------
 * Thin wrapper around the BigQuery Advanced Service. Every other service
 * (DashboardService, SupplierService, ProductService, SnapshotService) goes
 * through BigQueryService.runQuery() so query execution, job polling, and
 * row-shaping only live in one place.
 *
 * NOTE: this file was missing from the project (every other service called
 * BigQueryService.runQuery(), but no file defined it), so the app could not
 * run at all. This is a from-scratch implementation using the standard
 * Apps Script "insert job, poll until DONE, page through getQueryResults"
 * pattern, driven entirely by the settings already defined in CONFIG.
 * ---------------------------------------------------------------------------
 */

const BigQueryService = {
  /**
   * Runs a standard SQL query against the configured BigQuery project and
   * returns the results as an array of plain JS objects (one per row,
   * keyed by column name). Handles job polling and pagination internally.
   * @param {string} sql
   * @return {Array<Object>}
   */
  runQuery: function (sql) {
    const projectId = CONFIG.BQ_PROJECT_ID;

    let job = BigQuery.Jobs.insert(
      {
        configuration: {
          query: {
            query: sql,
            useLegacySql: false
          }
        },
        jobReference: {
          projectId: projectId,
          location: CONFIG.BQ_LOCATION
        }
      },
      projectId
    );

    const jobId = job.jobReference.jobId;
    const location = job.jobReference.location || CONFIG.BQ_LOCATION;

    job = BigQueryService._waitForJob(projectId, jobId, location);

    const status = job.status;
    if (status && status.errorResult) {
      throw new Error('BigQuery job failed: ' + status.errorResult.message);
    }

    return BigQueryService._collectAllRows(projectId, jobId, location);
  },

  /**
   * Polls Jobs.get until the job's status.state is DONE or the configured
   * timeout is reached.
   * @param {string} projectId
   * @param {string} jobId
   * @param {string} location
   * @return {Object} The final job resource.
   * @private
   */
  _waitForJob: function (projectId, jobId, location) {
    const deadline = Date.now() + CONFIG.BQ_JOB_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const job = BigQuery.Jobs.get(projectId, jobId, { location: location });
      if (job.status && job.status.state === 'DONE') {
        return job;
      }
      Utilities.sleep(CONFIG.BQ_POLL_INTERVAL_MS);
    }

    throw new Error('BigQuery job ' + jobId + ' did not finish within ' + CONFIG.BQ_JOB_TIMEOUT_MS + 'ms');
  },

  /**
   * Pages through getQueryResults for a finished job and converts every
   * row into a plain object keyed by column name.
   * @param {string} projectId
   * @param {string} jobId
   * @param {string} location
   * @return {Array<Object>}
   * @private
   */
  _collectAllRows: function (projectId, jobId, location) {
    const allRows = [];
    let pageToken = null;
    let schemaFields = null;

    do {
      const options = {
        maxResults: CONFIG.BQ_MAX_RESULTS,
        location: location
      };
      if (pageToken) options.pageToken = pageToken;

      const response = BigQuery.Jobs.getQueryResults(projectId, jobId, options);

      if (!schemaFields && response.schema && response.schema.fields) {
        schemaFields = response.schema.fields;
      }

      if (response.rows && schemaFields) {
        response.rows.forEach(function (row) {
          allRows.push(BigQueryService._rowToObject(row, schemaFields));
        });
      }

      pageToken = response.pageToken || null;
    } while (pageToken);

    return allRows;
  },

  /**
   * Converts a single BigQuery API row (array of {v: value} cells) into a
   * plain object using the query's schema for field names.
   *
   * TIMESTAMP columns get special handling: the BigQuery REST API returns
   * them as a raw string of Unix epoch seconds (e.g. "1737038400.123456"),
   * which `new Date(...)` on the client cannot parse ("Invalid Date").
   * Those are converted here into a proper ISO 8601 string so every
   * timestamp column - dashboard_snapshot.last_updated,
   * supplier_prices.snapshot_generated_at, etc. - is client-ready without
   * every call site needing to know about this quirk.
   * @param {Object} row
   * @param {Array<Object>} schemaFields
   * @return {Object}
   * @private
   */
  _rowToObject: function (row, schemaFields) {
    const obj = {};
    row.f.forEach(function (cell, i) {
      const field = schemaFields[i];
      obj[field.name] = BigQueryService._convertCellValue(cell.v, field.type);
    });
    return obj;
  },

  /**
   * @param {*} value Raw cell value from the BigQuery API.
   * @param {string} type The column's declared BigQuery type (e.g. 'TIMESTAMP').
   * @return {*} The value, converted to an ISO 8601 string for TIMESTAMP
   *   columns; returned unchanged for every other type.
   * @private
   */
  _convertCellValue: function (value, type) {
    if (type !== 'TIMESTAMP' || value === null || value === undefined || value === '') {
      return value;
    }
    const epochSeconds = Number(value);
    if (isNaN(epochSeconds)) return value;
    return new Date(epochSeconds * 1000).toISOString();
  },

  /**
   * Loads rows into a BigQuery table via a load job (BigQuery.Jobs.insert
   * with configuration.load), not a streaming insert. Load jobs always
   * validate/write against the table's current live schema, unlike
   * Tabledata.insertAll (the old streaming approach here), which reads
   * from a schema cache that can lag for several minutes after an
   * ALTER TABLE ADD COLUMN - that lag is what caused
   * "no such field: avg_margin_this_month" even after the column had
   * already been added to computed_daily_metrics. Load jobs also have no
   * 500-row batch limit (unlike streaming inserts), so all rows go in a
   * single job.
   * @param {string} fullTableId Fully qualified `project.dataset.table` (no backticks).
   * @param {Array<Object>} rows Row objects keyed by column name.
   * @param {string} writeDisposition 'WRITE_APPEND' or 'WRITE_TRUNCATE'.
   * @return {boolean} true on success, false on failure.
   * @private
   */
  _loadRows: function (fullTableId, rows, writeDisposition) {
    if (!rows || rows.length === 0) return true;

    const parts = fullTableId.split('.');
    if (parts.length !== 3) {
      console.error('BigQueryService._loadRows: invalid table id ' + fullTableId);
      return false;
    }

    try {
      const ndjson = rows.map(function (row) { return JSON.stringify(row); }).join('\n');
      const blob = Utilities.newBlob(ndjson, 'application/octet-stream', parts[2] + '.json');

      let job = BigQuery.Jobs.insert(
        {
          configuration: {
            load: {
              destinationTable: { projectId: parts[0], datasetId: parts[1], tableId: parts[2] },
              sourceFormat: 'NEWLINE_DELIMITED_JSON',
              writeDisposition: writeDisposition
            }
          },
          jobReference: {
            projectId: CONFIG.BQ_PROJECT_ID,
            location: CONFIG.BQ_LOCATION
          }
        },
        CONFIG.BQ_PROJECT_ID,
        blob
      );

      const jobId = job.jobReference.jobId;
      const location = job.jobReference.location || CONFIG.BQ_LOCATION;
      job = BigQueryService._waitForJob(CONFIG.BQ_PROJECT_ID, jobId, location);

      const status = job.status;
      if (status && status.errorResult) {
        console.error('BigQueryService._loadRows: load job failed: ' + status.errorResult.message);
        if (status.errors && status.errors.length > 0) {
          console.error('BigQueryService._loadRows errors: ' + JSON.stringify(status.errors.slice(0, 3)));
        }
        return false;
      }
      return true;
    } catch (err) {
      console.error('BigQueryService._loadRows failed: ' + err.message);
      return false;
    }
  },

  /**
   * Appends rows to a BigQuery table via a load job. Added for
   * PriceGuardMetricSnapshotService/PriceGuardPricingActionService, which
   * compute rows in Apps Script memory and need to write them directly
   * (there's no source table to CREATE TABLE ... AS SELECT from - unlike
   * every other snapshot rebuild in this codebase).
   * @param {string} fullTableId Fully qualified `project.dataset.table` (no backticks).
   * @param {Array<Object>} rows Row objects keyed by column name.
   * @return {boolean} true on success, false on failure.
   */
  insertRows: function (fullTableId, rows) {
    return BigQueryService._loadRows(fullTableId, rows, 'WRITE_APPEND');
  },

  /**
   * Replaces a table's entire contents with fresh rows in a single
   * WRITE_TRUNCATE load job (truncate + load, atomically) - used to
   * replace a whole day's snapshot without needing a
   * CREATE OR REPLACE TABLE AS SELECT, since the rows here come from JS
   * computation, not a BigQuery source query.
   * @param {string} fullTableId Fully qualified `project.dataset.table`.
   * @param {Array<Object>} rows
   * @return {boolean}
   */
  overwriteRows: function (fullTableId, rows) {
    if (!rows || rows.length === 0) {
      // Nothing to load - still need to actually empty the table, since
      // a load job with zero rows is a no-op rather than a truncate.
      const parts = fullTableId.split('.');
      if (parts.length !== 3) {
        console.error('BigQueryService.overwriteRows: invalid table id ' + fullTableId);
        return false;
      }
      try {
        BigQueryService.runQuery('TRUNCATE TABLE `' + parts[0] + '.' + parts[1] + '.' + parts[2] + '`');
        return true;
      } catch (err) {
        console.error('BigQueryService.overwriteRows: truncate failed: ' + err.message);
        return false;
      }
    }

    return BigQueryService._loadRows(fullTableId, rows, 'WRITE_TRUNCATE');
  }
};
