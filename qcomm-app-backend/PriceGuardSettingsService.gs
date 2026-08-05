/**
 * PriceGuardSettingsService.gs
 * ---------------------------------------------------------------------------
 * Migrated from the standalone Price Guard project's SettingsService.gs,
 * unchanged. Manages alert thresholds, notification recipients, GitHub
 * Actions dispatch config, and enabled competitors - stored in Script
 * Properties (not BigQuery), same as the source app.
 * ---------------------------------------------------------------------------
 */

const PriceGuardSettingsService = {
  DEFAULT_SETTINGS: {
    thresholds: {
      price_spike_warning: 0.20,
      price_spike_high: 0.40,
      price_spike_critical: 0.70,

      cost_spike_warning: 0.20,
      cost_spike_high: 0.40,
      cost_spike_critical: 0.70,

      competitor_premium_warning: 0.25,
      competitor_premium_high: 0.50,
      competitor_premium_critical: 1.00
    },
    notifications: {
      email_recipients: '',
      slack_webhook: '',
      send_daily_summary: true
    },
    github: {
      pat: '',
      repo: ''
    },
    competitors: {
      mano: true,
      chowstore: true,
      spar: true,
      supersaver: true
    }
  },

  /**
   * Returns the active settings, deep-merged over DEFAULT_SETTINGS.
   * @return {Object}
   */
  getSettings: function () {
    const props = PropertiesService.getScriptProperties();
    const saved = props.getProperty('PRICE_GUARD_SYSTEM_SETTINGS');
    if (!saved) return PriceGuardSettingsService.DEFAULT_SETTINGS;

    try {
      const parsed = JSON.parse(saved);
      return PriceGuardSettingsService._mergeDeep(PriceGuardSettingsService.DEFAULT_SETTINGS, parsed);
    } catch (e) {
      return PriceGuardSettingsService.DEFAULT_SETTINGS;
    }
  },

  /**
   * Persists a settings object.
   * @param {Object} settings
   * @return {boolean}
   */
  saveSettings: function (settings) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('PRICE_GUARD_SYSTEM_SETTINGS', JSON.stringify(settings));
    return true;
  },

  /**
   * @param {Object} target
   * @param {Object} source
   * @return {Object}
   * @private
   */
  _mergeDeep: function (target, source) {
    const output = Object.assign({}, target);
    if (PriceGuardSettingsService._isObject(target) && PriceGuardSettingsService._isObject(source)) {
      Object.keys(source).forEach(function (key) {
        if (PriceGuardSettingsService._isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = PriceGuardSettingsService._mergeDeep(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    return output;
  },

  /**
   * @param {*} item
   * @return {boolean}
   * @private
   */
  _isObject: function (item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }
};
