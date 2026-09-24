import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Building2,
  MapPin,
  RefreshCw,
  Activity,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./AdminAnalytics.css";
import { adminRequest } from "../../services/adminApi";

/*
const DEMO_DATA = {
  summary: {
    total: 1284,
    resolved: 936,
    pending: 214,
    inProgress: 134,
    avgResolution: 18.6,
    resolutionRate: 72.9,
    trend: 12.4,
  },

  monthlyTrend: [
    { month: "Mar", complaints: 142, resolved: 101 },
    { month: "Apr", complaints: 168, resolved: 119 },
    { month: "May", complaints: 187, resolved: 138 },
    { month: "Jun", complaints: 201, resolved: 151 },
    { month: "Jul", complaints: 226, resolved: 172 },
    { month: "Aug", complaints: 248, resolved: 190 },
  ],

  departments: [
    {
      name: "Roads",
      complaints: 342,
      resolved: 278,
      rate: 81.3,
      avgTime: 14.2,
    },
    {
      name: "Sanitation",
      complaints: 286,
      resolved: 231,
      rate: 80.8,
      avgTime: 11.8,
    },
    {
      name: "Electricity",
      complaints: 241,
      resolved: 176,
      rate: 73.0,
      avgTime: 17.4,
    },
    {
      name: "Water",
      complaints: 198,
      resolved: 139,
      rate: 70.2,
      avgTime: 21.1,
    },
    {
      name: "Drainage",
      complaints: 132,
      resolved: 86,
      rate: 65.2,
      avgTime: 25.7,
    },
  ],

  severity: [
    {
      name: "Critical",
      value: 86,
      percentage: 6.7,
    },
    {
      name: "High",
      value: 312,
      percentage: 24.3,
    },
    {
      name: "Medium",
      value: 531,
      percentage: 41.4,
    },
    {
      name: "Low",
      value: 355,
      percentage: 27.6,
    },
  ],

  hotspots: [
    {
      area: "Anna Nagar",
      complaints: 126,
      increase: 18,
      category: "Roads",
    },
    {
      area: "Velachery",
      complaints: 112,
      increase: 14,
      category: "Sanitation",
    },
    {
      area: "T Nagar",
      complaints: 98,
      increase: 9,
      category: "Electricity",
    },
    {
      area: "Adyar",
      complaints: 87,
      increase: -4,
      category: "Water",
    },
    {
      area: "Guindy",
      complaints: 76,
      increase: 7,
      category: "Roads",
    },
  ],

  insights: [
    {
      type: "warning",
      title: "Road complaints increasing",
      text: "Road-related complaints increased by 18% compared with the previous period.",
    },
    {
      type: "success",
      title: "Resolution performance improved",
      text: "Overall resolution rate is 72.9%, showing a positive improvement.",
    },
    {
      type: "critical",
      title: "Drainage needs attention",
      text: "Drainage has the lowest department resolution rate at 65.2%.",
    },
  ],
};
*/

export default function AdminAnalytics() {
  const navigate = useNavigate();

  const [data, setData] = useState({ summary: { total: 0, resolved: 0, pending: 0, inProgress: 0, avgResolution: 0, resolutionRate: 0, trend: 0 }, monthlyTrend: [], departments: [], severity: [], hotspots: [], insights: [] });
  const [period, setPeriod] = useState("6 Months");
  const [department, setDepartment] = useState("All");
  const [loading, setLoading] = useState(false);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const result = await adminRequest("/admin/analytics");
      setData({ ...result,
        monthlyTrend: (Array.isArray(result.monthlyTrend) ? result.monthlyTrend : result.monthlyTrend?.monthly_data || []).map((item) => ({ month: item.month, complaints: item.complaints ?? item.received ?? 0, resolved: item.resolved ?? item.resolved_events ?? 0 })),
        departments: (result.departments || []).map((item) => ({ name: item.name || item.department, complaints: item.complaints ?? item.total ?? 0, resolved: item.resolved || 0, rate: item.rate ?? item.resolution_percentage ?? 0, avgTime: item.avgTime ?? item.average_resolution_hours ?? 0 })),
        hotspots: (result.hotspots || []).map((item) => ({ area: item.area || item.location || "Unknown", complaints: item.complaints || 0, increase: item.increase || 0, category: item.category || "General" })),
        insights: (result.insights || []).map((item) => ({ ...item, title: item.title || item.type || "Insight", text: item.text || item.message || "" })),
      });
    } catch (error) {
      console.error(
        "Analytics loading error:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnalytics();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const filteredDepartments = useMemo(() => {
    if (department === "All") {
      return data.departments;
    }

    return data.departments.filter(
      (item) =>
        item.name === department
    );
  }, [department, data.departments]);

  const maxComplaint = Math.max(1,
    ...data.monthlyTrend.map(
      (item) => item.complaints
    )
  );

  return (
    <div className="admin-analytics">

      {/* HEADER */}

      <header className="analytics-header">

        <div className="analytics-header-left">

          <button
            className="analytics-back"
            onClick={() =>
              navigate("/admin/dashboard")
            }
          >
            <ArrowLeft size={18} />
          </button>

          <div className="analytics-heading">

            <div className="analytics-heading-icon">
              <BarChart3 size={18} />
            </div>

            <div>
              <h1>Analytics</h1>
              <p>
                Civic performance and
                operational intelligence
              </p>
            </div>

          </div>

        </div>

        <div className="analytics-header-actions">

          <select
            value={period}
            onChange={(e) =>
              setPeriod(e.target.value)
            }
            className="period-select"
          >
            <option>7 Days</option>
            <option>30 Days</option>
            <option>3 Months</option>
            <option>6 Months</option>
            <option>1 Year</option>
          </select>

          <button
            className="analytics-refresh"
            onClick={loadAnalytics}
            disabled={loading}
          >
            <RefreshCw
              size={14}
              className={
                loading ? "spin" : ""
              }
            />
            Refresh
          </button>

        </div>

      </header>

      {/* CONTENT */}

      <main className="analytics-content">

        {/* SUMMARY */}

        <section className="analytics-summary">

          <SummaryCard
            icon={<Activity size={17} />}
            label="Total Complaints"
            value={data.summary.total}
            trend={data.summary.trend}
            trendLabel="vs previous period"
          />

          <SummaryCard
            icon={<CheckCircle2 size={17} />}
            label="Resolution Rate"
            value={`${data.summary.resolutionRate}%`}
            trend={8.2}
            trendLabel="improvement"
            positive
          />

          <SummaryCard
            icon={<Clock3 size={17} />}
            label="Avg Resolution Time"
            value={`${data.summary.avgResolution}h`}
            trend={-6.4}
            trendLabel="faster than before"
            positive
          />

          <SummaryCard
            icon={<AlertTriangle size={17} />}
            label="Pending Complaints"
            value={data.summary.pending}
            trend={-11.3}
            trendLabel="vs previous period"
            positive
          />

        </section>

        {/* TOP ROW */}

        <section className="analytics-grid analytics-grid-top">

          {/* TREND */}

          <div className="analytics-card trend-card">

            <CardHeader
              title="Complaint Trend"
              subtitle="Incoming vs resolved complaints"
            />

            <div className="chart-container">

              <div className="y-axis">
                <span>{maxComplaint}</span>
                <span>
                  {Math.round(
                    maxComplaint * 0.75
                  )}
                </span>
                <span>
                  {Math.round(
                    maxComplaint * 0.5
                  )}
                </span>
                <span>
                  {Math.round(
                    maxComplaint * 0.25
                  )}
                </span>
                <span>0</span>
              </div>

              <div className="line-chart">

                <div className="chart-lines">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>

                <div className="bars">

                  {data.monthlyTrend.map(
                    (item) => (
                      <div
                        className="bar-group"
                        key={item.month}
                      >

                        <div className="bar-values">

                          <div
                            className="bar complaint-bar"
                            style={{
                              height: `${
                                (item.complaints /
                                  maxComplaint) *
                                100
                              }%`,
                            }}
                            title={`Complaints: ${item.complaints}`}
                          />

                          <div
                            className="bar resolved-bar"
                            style={{
                              height: `${
                                (item.resolved /
                                  maxComplaint) *
                                100
                              }%`,
                            }}
                            title={`Resolved: ${item.resolved}`}
                          />

                        </div>

                        <span>
                          {item.month}
                        </span>

                      </div>
                    )
                  )}

                </div>

              </div>

            </div>

            <div className="chart-legend">

              <span>
                <i className="legend-blue" />
                Complaints
              </span>

              <span>
                <i className="legend-green" />
                Resolved
              </span>

            </div>

          </div>

          {/* SEVERITY */}

          <div className="analytics-card severity-card">

            <CardHeader
              title="Severity Distribution"
              subtitle="Complaints by priority"
            />

            <div className="severity-content">

              <div className="donut">

                <div className="donut-center">
                  <strong>
                    {data.summary.total}
                  </strong>
                  <span>Total</span>
                </div>

              </div>

              <div className="severity-list">

                {data.severity.map(
                  (item) => (
                    <div
                      className="severity-row"
                      key={item.name}
                    >

                      <div className="severity-label">

                        <i
                          className={`severity-dot ${item.name.toLowerCase()}`}
                        />

                        <span>
                          {item.name}
                        </span>

                      </div>

                      <strong>
                        {item.value}
                      </strong>

                      <span className="severity-percent">
                        {item.percentage}%
                      </span>

                    </div>
                  )
                )}

              </div>

            </div>

          </div>

        </section>

        {/* DEPARTMENT */}

        <section className="analytics-card department-card">

          <div className="department-header">

            <CardHeader
              title="Department Performance"
              subtitle="Resolution efficiency by department"
            />

            <select
              value={department}
              onChange={(e) =>
                setDepartment(
                  e.target.value
                )
              }
              className="department-select"
            >
              <option value="All">
                All Departments
              </option>

              {data.departments.map(
                (item) => (
                  <option
                    key={item.name}
                    value={item.name}
                  >
                    {item.name}
                  </option>
                )
              )}

            </select>

          </div>

          <div className="department-table">

            <div className="table-row table-head">

              <span>Department</span>
              <span>Complaints</span>
              <span>Resolved</span>
              <span>Resolution Rate</span>
              <span>Avg. Time</span>
              <span>Performance</span>

            </div>

            {filteredDepartments.map(
              (item) => (
                <div
                  className="table-row"
                  key={item.name}
                >

                  <div className="department-name">

                    <div className="department-icon">
                      <Building2 size={14} />
                    </div>

                    <strong>
                      {item.name}
                    </strong>

                  </div>

                  <span>
                    {item.complaints}
                  </span>

                  <span>
                    {item.resolved}
                  </span>

                  <div className="rate-cell">

                    <div className="rate-bar">
                      <i
                        style={{
                          width: `${item.rate}%`,
                        }}
                      />
                    </div>

                    <strong>
                      {item.rate}%
                    </strong>

                  </div>

                  <span>
                    {item.avgTime}h
                  </span>

                  <PerformanceBadge
                    rate={item.rate}
                  />

                </div>
              )
            )}

          </div>

        </section>

        {/* BOTTOM */}

        <section className="analytics-grid analytics-grid-bottom">

          {/* HOTSPOTS */}

          <div className="analytics-card hotspots-card">

            <CardHeader
              title="Complaint Hotspots"
              subtitle="Areas requiring attention"
            />

            <div className="hotspot-list">

              {data.hotspots.map(
                (item, index) => (
                  <div
                    className="hotspot"
                    key={item.area}
                  >

                    <div className="hotspot-rank">
                      {index + 1}
                    </div>

                    <div className="hotspot-icon">
                      <MapPin size={14} />
                    </div>

                    <div className="hotspot-main">

                      <strong>
                        {item.area}
                      </strong>

                      <span>
                        {item.category}
                      </span>

                    </div>

                    <div className="hotspot-number">

                      <strong>
                        {item.complaints}
                      </strong>

                      <span
                        className={
                          item.increase >= 0
                            ? "increase"
                            : "decrease"
                        }
                      >
                        {item.increase >= 0
                          ? "+"
                          : ""}
                        {item.increase}%
                      </span>

                    </div>

                  </div>
                )
              )}

            </div>

          </div>

          {/* AI INSIGHTS */}

          <div className="analytics-card insights-card">

            <div className="insights-heading">

              <div className="insights-icon">
                <Target size={17} />
              </div>

              <div>
                <h2>
                  AI Performance Insights
                </h2>

                <p>
                  Automated observations
                  from civic data
                </p>
              </div>

            </div>

            <div className="insights-list">

              {data.insights.map(
                (item, index) => (
                  <div
                    className={`insight ${item.type}`}
                    key={index}
                  >

                    <div className="insight-icon">

                      {item.type ===
                        "success" && (
                        <CheckCircle2
                          size={14}
                        />
                      )}

                      {item.type ===
                        "warning" && (
                        <TrendingUp
                          size={14}
                        />
                      )}

                      {item.type ===
                        "critical" && (
                        <AlertTriangle
                          size={14}
                        />
                      )}

                    </div>

                    <div>
                      <strong>
                        {item.title}
                      </strong>

                      <p>
                        {item.text}
                      </p>
                    </div>

                  </div>
                )
              )}

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

/* =========================================================
   COMPONENTS
   ========================================================= */

function SummaryCard({
  icon,
  label,
  value,
  trend,
  trendLabel,
  positive = false,
}) {
  const isPositive =
    positive ||
    trend > 0;

  return (
    <div className="summary-card">

      <div className="summary-icon">
        {icon}
      </div>

      <div className="summary-info">

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

        <div
          className={
            isPositive
              ? "trend-positive"
              : "trend-negative"
          }
        >
          {isPositive ? (
            <TrendingUp size={10} />
          ) : (
            <TrendingDown size={10} />
          )}

          {Math.abs(trend)}%

          <small>
            {trendLabel}
          </small>
        </div>

      </div>

    </div>
  );
}

function CardHeader({
  title,
  subtitle,
}) {
  return (
    <div className="card-header">

      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

    </div>
  );
}

function PerformanceBadge({
  rate,
}) {
  let label = "Needs Attention";
  let className = "needs-attention";

  if (rate >= 80) {
    label = "Excellent";
    className = "excellent";
  } else if (rate >= 70) {
    label = "Good";
    className = "good";
  }

  return (
    <span
      className={`performance-badge ${className}`}
    >
      {label}
    </span>
  );
}