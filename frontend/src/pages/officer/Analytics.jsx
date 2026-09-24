import  { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  XCircle,
  Loader2,
} from "lucide-react";

import "./Analytics.css";

const API_BASE_URL = "http://localhost:5000";

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/officer/analytics`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load analytics"
        );
      }

      setAnalytics(data);
    } catch (err) {
      console.error("Analytics error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAnalytics();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-loading">
          <Loader2 className="loading-icon" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div className="analytics-error">
          <XCircle size={40} />

          <h2>Unable to load analytics</h2>

          <p>{error}</p>

          <button onClick={fetchAnalytics}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const status = analytics.status_summary || {};
  const priority = analytics.priority_summary || {};
  const departments = analytics.department_summary || [];
  const monthly = analytics.monthly_summary || [];

  const total = Number(analytics.total_complaints || 0);

  const resolutionRate =
    total > 0
      ? ((Number(status.RESOLVED || 0) +
          Number(status.CLOSED || 0)) /
          total) *
        100
      : 0;

  return (
    <div className="analytics-page">

      {/* HEADER */}

      <div className="analytics-header">

        <div>
          <div className="analytics-title-row">
            <BarChart3 size={25} />

            <h1>Analytics</h1>
          </div>

          <p>
            Complaint, governance and departmental
            performance overview
          </p>
        </div>

        <button
          className="refresh-btn"
          onClick={fetchAnalytics}
        >
          <RefreshCw size={17} />
          Refresh
        </button>

      </div>


      {/* KPI CARDS */}

      <div className="analytics-kpi-grid">

        <div className="analytics-kpi-card">
          <div className="kpi-icon blue">
            <ClipboardList />
          </div>

          <div>
            <span>Total Complaints</span>
            <strong>{total}</strong>
          </div>
        </div>


        <div className="analytics-kpi-card">
          <div className="kpi-icon orange">
            <AlertTriangle />
          </div>

          <div>
            <span>High / Critical</span>

            <strong>
              {Number(priority.HIGH || 0) +
                Number(priority.CRITICAL || 0)}
            </strong>
          </div>
        </div>


        <div className="analytics-kpi-card">
          <div className="kpi-icon purple">
            <Clock />
          </div>

          <div>
            <span>In Progress</span>

            <strong>
              {Number(status.IN_PROGRESS || 0)}
            </strong>
          </div>
        </div>


        <div className="analytics-kpi-card">
          <div className="kpi-icon green">
            <CheckCircle2 />
          </div>

          <div>
            <span>Resolution Rate</span>

            <strong>
              {resolutionRate.toFixed(1)}%
            </strong>
          </div>
        </div>

      </div>


      {/* STATUS + PRIORITY */}

      <div className="analytics-two-column">

        {/* STATUS */}

        <div className="analytics-panel">

          <div className="panel-header">

            <div>
              <h2>Complaint Status</h2>
              <p>Current complaint lifecycle</p>
            </div>

            <ClipboardList size={21} />

          </div>

          <div className="status-list">

            {Object.entries(status).map(
              ([statusName, count]) => {

                const percentage =
                  total > 0
                    ? (Number(count) / total) * 100
                    : 0;

                return (
                  <div
                    className="status-item"
                    key={statusName}
                  >

                    <div className="status-top">

                      <span>
                        {statusName.replace(
                          /_/g,
                          " "
                        )}
                      </span>

                      <strong>
                        {count}
                      </strong>

                    </div>

                    <div className="progress-track">

                      <div
                        className="progress-fill"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />

                    </div>

                    <small>
                      {percentage.toFixed(1)}%
                    </small>

                  </div>
                );
              }
            )}

          </div>

        </div>


        {/* PRIORITY */}

        <div className="analytics-panel">

          <div className="panel-header">

            <div>
              <h2>Priority Distribution</h2>
              <p>AI/governance priority levels</p>
            </div>

            <ShieldCheck size={21} />

          </div>

          <div className="priority-grid">

            <div className="priority-box low">
              <span>LOW</span>
              <strong>
                {priority.LOW || 0}
              </strong>
            </div>

            <div className="priority-box medium">
              <span>MEDIUM</span>
              <strong>
                {priority.MEDIUM || 0}
              </strong>
            </div>

            <div className="priority-box high">
              <span>HIGH</span>
              <strong>
                {priority.HIGH || 0}
              </strong>
            </div>

            <div className="priority-box critical">
              <span>CRITICAL</span>
              <strong>
                {priority.CRITICAL || 0}
              </strong>
            </div>

          </div>

        </div>

      </div>


      {/* DEPARTMENTS */}

      <div className="analytics-panel">

        <div className="panel-header">

          <div>
            <h2>Department Performance</h2>

            <p>
              Complaints assigned through governance
            </p>
          </div>

          <Building2 size={21} />

        </div>


        {departments.length === 0 ? (

          <div className="empty-analytics">
            No department data available.
          </div>

        ) : (

          <div className="department-table-wrapper">

            <table className="department-table">

              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total</th>
                  <th>Assigned</th>
                  <th>In Progress</th>
                  <th>Resolved</th>
                  <th>Closed</th>
                </tr>
              </thead>

              <tbody>

                {departments.map((department) => (

                  <tr key={department.department}>

                    <td>
                      <div className="department-name">
                        <Building2 size={16} />
                        {department.department}
                      </div>
                    </td>

                    <td>
                      {department.total}
                    </td>

                    <td>
                      {department.assigned}
                    </td>

                    <td>
                      {department.in_progress}
                    </td>

                    <td className="success-text">
                      {department.resolved}
                    </td>

                    <td>
                      {department.closed}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </div>


      {/* MONTHLY TREND */}

      <div className="analytics-panel">

        <div className="panel-header">

          <div>
            <h2>Complaint Trend</h2>

            <p>
              Monthly complaint volume from database
            </p>
          </div>

          <TrendingUp size={21} />

        </div>


        {monthly.length === 0 ? (

          <div className="empty-analytics">
            No monthly complaint data available.
          </div>

        ) : (

          <div className="trend-chart">

            {monthly.map((month) => {

              const maxCount = Math.max(
                ...monthly.map(
                  (item) =>
                    Number(item.count || 0)
                ),
                1
              );

              const height =
                (Number(month.count) /
                  maxCount) *
                100;

              return (

                <div
                  className="trend-column"
                  key={month.month}
                >

                  <div className="trend-value">
                    {month.count}
                  </div>

                  <div className="trend-bar-wrapper">

                    <div
                      className="trend-bar"
                      style={{
                        height: `${height}%`,
                      }}
                    />

                  </div>

                  <span>
                    {month.month}
                  </span>

                </div>

              );
            })}

          </div>

        )}

      </div>


      {/* RESOLUTION */}

      <div className="analytics-two-column">

        <div className="analytics-panel resolution-card">

          <div className="panel-header">

            <div>
              <h2>Resolution Performance</h2>
              <p>Current resolution statistics</p>
            </div>

            <CheckCircle2 size={21} />

          </div>

          <div className="resolution-content">

            <div className="resolution-circle">

              <strong>
                {resolutionRate.toFixed(1)}%
              </strong>

              <span>
                Resolution Rate
              </span>

            </div>

            <div className="resolution-stats">

              <div>
                <span>Resolved</span>

                <strong>
                  {status.RESOLVED || 0}
                </strong>
              </div>

              <div>
                <span>Closed</span>

                <strong>
                  {status.CLOSED || 0}
                </strong>
              </div>

              <div>
                <span>Rejected</span>

                <strong>
                  {status.REJECTED || 0}
                </strong>
              </div>

            </div>

          </div>

        </div>


        <div className="analytics-panel">

          <div className="panel-header">

            <div>
              <h2>Governance Overview</h2>
              <p>AI governance decisions</p>
            </div>

            <ShieldCheck size={21} />

          </div>

          <div className="governance-stats">

            <div className="governance-stat">
              <span>Total Governance Records</span>

              <strong>
                {analytics.governance_total || 0}
              </strong>
            </div>

            <div className="governance-stat">
              <span>Assigned</span>

              <strong>
                {analytics.governance_assigned || 0}
              </strong>
            </div>

            <div className="governance-stat">
              <span>Escalated</span>

              <strong>
                {analytics.governance_escalated || 0}
              </strong>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

export default Analytics;