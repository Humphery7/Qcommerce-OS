import DataTable from '../../../components/ui/DataTable';
import StatusChip from '../../../components/ui/StatusChip';

const PAGES_GUIDE = [
  { page: 'Dashboard', whatItDoes: 'Executive summary with overall gross margin, total gross profit, revenue at risk, and alert counts. Includes a pricing metrics bar/line chart and competitor price index breakdown.', howToUse: 'View at a glance your pricing health. KPI cards show aggregate metrics; the chart breaks down revenue and margin by product. Click Run Sync Job to trigger a fresh data pull.' },
  { page: 'Products Catalog', whatItDoes: 'Searchable table of all internal products with current margin, price index, competitor gap, risk score, and historical margin trend columns.', howToUse: 'Use the search box to filter products. Each row shows key metrics; compare selling prices against market median. Sort columns by clicking headers.' },
  { page: 'Pricing Alerts', whatItDoes: 'Queue of pricing anomalies and margin alerts triggered when thresholds are breached (price spikes, cost spikes, competitor premiums).', howToUse: "Review each alert's severity (Critical, High, Warning). Investigate flagged products and take corrective pricing action. Alerts are color-coded for triage." },
  { page: 'Pricing Actions', whatItDoes: 'Submit, review, and action pricing recommendations. Tracks proposed price changes and their approval status.', howToUse: 'Create new pricing action requests with recommended prices and rationale. Approve or reject pending actions. Monitor the status of all submitted actions.' },
  { page: 'Revenue Leakage', whatItDoes: 'Highlights valuable items facing potential demand drop due to being priced significantly above the market median (price index > 120).', howToUse: 'Review the list of at-risk products and their revenue exposure. Prioritise price reductions on high-revenue items with the largest competitor gap.' },
  { page: 'Opportunity Finder', whatItDoes: 'Identifies items priced below the market median with room for margin expansion (opportunity score > 50).', howToUse: 'Sort by opportunity score to find the best candidates for price increases. Consider raising prices incrementally to capture additional margin without losing competitiveness.' },
  { page: 'Supplier Health', whatItDoes: 'Scorecard for each supplier showing average margin, total profit, product count, and health score (100 minus average risk score).', howToUse: 'Identify underperforming suppliers. Low health scores indicate high-risk products from that supplier. Use this data to inform supplier negotiations and reviews.' },
  { page: 'Category Health', whatItDoes: 'Scorecard for each product category showing average margin, volume metrics, and health score based on aggregated risks.', howToUse: 'Spot categories with thinning margins or elevated risk. Adjust category-level pricing strategy or promotional focus accordingly.' },
  { page: 'Market Matrix', whatItDoes: 'Comparative price index analysis per competitor. Shows how your pricing stacks up against Mano, Chowstore, SPAR, and SuperSaver.', howToUse: 'View average competitor price index in the bar chart. Identify which competitors are undercutting or overpricing relative to your catalog.' },
  { page: 'Match Management', whatItDoes: 'Approve, reject, or manually match competitor listings to internal SKUs; trigger a rematch when the automated matcher gets it wrong.', howToUse: 'Use the manual matching console for one-off corrections. Review the pending queue and approve or rematch each row.' },
  { page: 'System Settings', whatItDoes: 'Alert thresholds, notification channels, GitHub pipeline integration, tracked competitors, and manual pipeline controls.', howToUse: 'Adjust critical thresholds and save. Use Data Pipeline controls to force a snapshot refresh or a full daily sync on demand.' }
];

const METRICS_GLOSSARY = [
  { metric: 'Current Margin %', formula: '(selling_price - cost_price) ÷ selling_price × 100', interpretation: 'The percentage profit on each sale. Higher values indicate healthier pricing vs. cost. Negative values mean the product is sold at a loss.' },
  { metric: 'Margin Last Month / Last 2 Months', formula: 'Same formula using prior period price and cost values.', interpretation: 'Shows how margins are trending over time. A declining trend may signal cost inflation or competitive pressure.' },
  { metric: 'Gross Profit (Latest / Last Month / Last 2 Months)', formula: '(selling_price - cost_price) × quantity_sold', interpretation: 'Total profit contribution in Naira. Used to rank products by their absolute financial impact.' },
  { metric: 'Profit Contribution %', formula: 'product_gross_profit ÷ total_gross_profit × 100', interpretation: 'What share of total profit each product contributes. Helps prioritise high-impact items.' },
  { metric: 'Market Median Price', formula: 'Median of competitor prices (Mano, Chowstore, SPAR, SuperSaver) for the matched product.', interpretation: 'The midpoint of competitor pricing. Used as the benchmark for price index and competitor gap calculations.' },
  { metric: 'Price Index', formula: '(selling_price ÷ market_median_price) × 100', interpretation: 'Your price relative to the market. Index = 100 means you match the median; > 100 means you are priced above competitors; < 100 means you are priced below. Values above 120 trigger revenue-at-risk flags.' },
  { metric: 'Competitor Gap', formula: 'selling_price - market_median_price', interpretation: 'The absolute Naira difference between your price and the market median. A positive gap means you are more expensive; a negative gap means you are cheaper.' },
  { metric: 'Competitor Count', formula: 'Number of competitors with valid matched prices for the product.', interpretation: 'Indicates market coverage. Products matched against more competitors have more reliable price index and gap values.' },
  { metric: 'Revenue At Risk', formula: 'selling_price × quantity_sold (for products with price_index > 120)', interpretation: 'Revenue exposure from products priced significantly above market. These items risk demand loss as customers switch to cheaper competitors.' },
  { metric: 'Margin Leakage', formula: 'If margin < 0: (cost - sell) × qty. If price_index < 85: (median - sell) × qty.', interpretation: 'Lost profit from selling below cost or well below the market median. Reducing leakage improves overall profitability.' },
  { metric: 'Opportunity Score', formula: '0–100 score based on (median - sell) × qty ÷ 1000, capped and normalised. Higher when price_index < 90 and quantity > 0.', interpretation: 'Measures margin expansion potential. Products with high scores are priced below market with good sales volume — ideal candidates for price increases.' },
  { metric: 'Risk Score', formula: '0–100 composite: cost spike >20% (+15), >40% (+35); price spike >20% (+15), >40% (+35); negative margin (+40); margin drop >5pp (+20); price index >120 (+15), >140 (+30). If revenue > ₦500,000, ×1.25.', interpretation: '0–30 Low risk · 31–60 Medium risk · 61–80 High risk · 81–100 Critical risk.' },
  { metric: 'Supplier Health Score', formula: 'max(0, 100 - avg_risk_score_per_supplier)', interpretation: "A 0-100 score reflecting supplier reliability. Higher is better. Scores drop when a supplier's products consistently have high risk scores." },
  { metric: 'Category Health Score', formula: 'max(0, 100 - avg_risk_score_per_category)', interpretation: 'A 0-100 score reflecting category pricing health. Higher is better. Declining scores indicate deteriorating margins or rising risks within that category.' }
];

// Matches the original doc's own 3-tier description verbatim. Note this
// doesn't line up 1:1 with getPriceGuardAlerts' real severity filter values
// (critical/high/warning, no "info") -- this table is reference prose, not
// wired to the live filter, so it's left exactly as documented.
const SEVERITY_LEVELS = [
  { severity: 'CRITICAL', colour: 'Red', tone: 'critical', meaning: 'Immediate attention required. Price spike >70%, cost spike >70%, or competitor premium >100% of configured thresholds.' },
  { severity: 'WARNING', colour: 'Yellow', tone: 'warning', meaning: 'Notable but not urgent. Minor threshold exceedances (e.g., price spike >20%, cost spike >20%).' },
  { severity: 'INFO', colour: 'Green', tone: 'positive', meaning: 'Informational. Products operating within normal parameters. No action required.' }
];

function DocCard({ title, children }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card">
      <h3 className="text-[15px] font-semibold text-on-surface mb-3">{title}</h3>
      {children}
    </section>
  );
}

export default function PriceGuardDocumentationPage() {
  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Documentation</h1>
        <p className="text-[12px] text-secondary mt-0.5">User guide, page descriptions, and metric definitions</p>
      </div>

      <DocCard title="About Price Guard">
        <p className="text-[13px] text-on-surface leading-relaxed">
          Price Guard is a competitive pricing intelligence and analytics platform that monitors product pricing
          across multiple competitors (Mano, Chowstore, SPAR, SuperSaver), detects pricing anomalies, identifies
          revenue risks and margin expansion opportunities, and tracks supplier and category performance. The
          system is powered by Google Apps Script and BigQuery, with automated daily data ingestion from
          competitor scrapers.
        </p>
        <div className="flex items-start gap-1.5 mt-3 text-[11px] text-secondary">
          <span className="material-symbols-outlined text-[14px] mt-0.5">info</span>
          <span>All data reflects the past 3 months of collected pricing information.</span>
        </div>
      </DocCard>

      <DocCard title="Pages Guide">
        <DataTable
          columns={[
            { key: 'page', header: 'Page' },
            { key: 'whatItDoes', header: 'What It Does' },
            { key: 'howToUse', header: 'How To Use' }
          ]}
          rows={PAGES_GUIDE}
          rowKey="page"
        />
      </DocCard>

      <DocCard title="Metrics Glossary">
        <DataTable
          columns={[
            { key: 'metric', header: 'Metric' },
            { key: 'formula', header: 'Formula / Calculation', mono: true },
            { key: 'interpretation', header: 'Interpretation' }
          ]}
          rows={METRICS_GLOSSARY}
          rowKey="metric"
        />
      </DocCard>

      <DocCard title="Alert Severity Levels">
        <DataTable
          columns={[
            { key: 'severity', header: 'Severity', render: (r) => <StatusChip tone={r.tone}>{r.severity}</StatusChip> },
            { key: 'colour', header: 'Colour' },
            { key: 'meaning', header: 'Meaning' }
          ]}
          rows={SEVERITY_LEVELS}
          rowKey="severity"
        />
      </DocCard>
    </div>
  );
}
