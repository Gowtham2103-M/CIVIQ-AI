import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileWarning,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import "./AdminDashboard.css";
import { adminRequest, clearAdminAuth } from "../../services/adminApi";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [admin, setAdmin] = useState({
    name: "System Admin",
    email: "admin@civiq.gov.in",
  });

  const [dashboard, setDashboard] = useState({
    totalComplaints: 0, pending: 0, inProgress: 0, resolved: 0,
    highPriority: 0, fraudSuspected: 0, unassigned: 0, activeOfficers: 0,
    trend: [], status: { pending: 0, inProgress: 0, resolved: 0, rejected: 0 },
    ai: { verified: 0, genuine: 0, suspicious: 0, accuracy: 0 },
    officers: [], alerts: [], complaints: [],
  });

  const loadAdmin = () => {
    try {
      const stored =
        localStorage.getItem("admin_user") ||
        sessionStorage.getItem("admin_user");

      if (stored) {
        setAdmin(JSON.parse(stored));
      }
    } catch {
      // Keep default admin information.
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const data = await adminRequest("/admin/dashboard");
      const summary = data.summary || {};
      setDashboard((current) => ({ ...current,
        totalComplaints: summary.total_complaints || 0,
        pending: summary.pending_complaints || 0,
        inProgress: summary.in_progress_complaints || 0,
        resolved: summary.resolved_complaints || 0,
        activeOfficers: summary.active_officers || 0,
        status: { pending: summary.pending_complaints || 0, inProgress: summary.in_progress_complaints || 0, resolved: summary.resolved_complaints || 0, rejected: summary.rejected_complaints || 0 },
        complaints: (data.recent_complaints || []).map((item) => ({ ...item, category: item.department || "General", location: item.address || "Unknown", priority: item.priority || "MEDIUM", officer: item.officer_name || "Unassigned", status: (item.status || "").replaceAll("_", " ") })),
      }));
    } catch (error) {
      console.error("Dashboard loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAdmin();
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const refreshDashboard = async () => {
    setRefreshing(true);

    await loadDashboard();

    setRefreshing(false);
  };

  const logout = () => {
    clearAdminAuth();
    navigate("/admin/login");
  };

  const handleMenuClick = (menu) => {
    setActiveMenu(menu);
    setSidebarOpen(false);

    if (menu === "dashboard") return;

    const routes = {
      complaints: "/admin/complaints",
      officers: "/admin/officers",
      ai: "/admin/ai-monitor",
      fraud: "/admin/fraud",
      analytics: "/admin/analytics",
      audit: "/admin/audit",
    };

    if (routes[menu]) {
      navigate(routes[menu]);
    }
  };

  const maxTrend = Math.max(
    ...dashboard.trend.map((item) => item.value)
  );

  const totalStatus =
    dashboard.status.pending +
    dashboard.status.inProgress +
    dashboard.status.resolved +
    dashboard.status.rejected;

  const getStatusPercentage = (value) => {
    if (!totalStatus) return 0;

    return Math.round((value / totalStatus) * 100);
  };

  const getInitials = (name) => {
    if (!name) return "AD";

    return name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner">
          <RefreshCw size={30} />
        </div>

        <p>Loading CivicGuard dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-layout">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>

        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <ShieldCheck size={25} />
          </div>

          <div>
            <h2>AI CivicGuard</h2>
            <span>ADMIN PANEL</span>
          </div>

          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">

          <p className="nav-label">MAIN</p>

          <button
            className={`nav-item ${
              activeMenu === "dashboard" ? "active" : ""
            }`}
            onClick={() => handleMenuClick("dashboard")}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-item ${
              activeMenu === "complaints" ? "active" : ""
            }`}
            onClick={() => handleMenuClick("complaints")}
          >
            <Activity size={19} />
            <span>Complaints</span>
            <span className="nav-count">
              {dashboard.pending}
            </span>
          </button>

          <button
            className={`nav-item ${
              activeMenu === "officers" ? "active" : ""
            }`}
            onClick={() => handleMenuClick("officers")}
          >
            <Users size={19} />
            <span>Officers</span>
          </button>

          <button
            className={`nav-item ${
              activeMenu === "analytics" ? "active" : ""
            }`}
            onClick={() => handleMenuClick("analytics")}
          >
            <BarChart3 size={19} />
            <span>Analytics</span>
          </button>

          <p className="nav-label">AI & SECURITY</p>

          <button
            className={`nav-item ${
              activeMenu === "ai" ? "active" : ""
            }`}
            onClick={() => handleMenuClick("ai")}
          >
            <Bot size={19} />
            <span>AI Monitoring</span>
          </button>

          <button
            className={`nav-item ${
              activeMenu === "fraud" ? "active" : ""
            }`}
            onClick={() => handleMenuClick("fraud")}
          >
            <ShieldAlert size={19} />
            <span>Fraud Alerts</span>

            {dashboard.fraudSuspected > 0 && (
              <span className="nav-alert-count">
                {dashboard.fraudSuspected}
              </span>
            )}
          </button>

          <p className="nav-label">SYSTEM</p>

          <button
            className={`nav-item ${
              activeMenu === "audit" ? "active" : ""
            }`}
            onClick={() => handleMenuClick("audit")}
          >
            <FileWarning size={19} />
            <span>Audit Logs</span>
          </button>

        </nav>

        <div className="sidebar-bottom">

          <div className="sidebar-system-status">
            <span className="online-dot" />
            <div>
              <strong>System Operational</strong>
              <small>All services running</small>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            <LogOut size={18} />
            Logout
          </button>

        </div>

      </aside>

      {/* =====================================================
          MAIN
          ===================================================== */}

      <main className="admin-main">

        {/* Header */}
        <header className="admin-header">

          <div className="header-left">

            <button
              className="mobile-menu-button"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            <div>
              <h1>Dashboard</h1>
              <p>Civic operations overview</p>
            </div>

          </div>

          <div className="header-right">

            <button
              className="refresh-button"
              onClick={refreshDashboard}
              disabled={refreshing}
            >
              <RefreshCw
                size={17}
                className={refreshing ? "spin" : ""}
              />

              <span>Refresh</span>
            </button>

            <button className="notification-button">
              <Bell size={20} />

              <span className="notification-dot" />
            </button>

            <div className="admin-profile">

              <div className="admin-avatar">
                {getInitials(admin.name)}
              </div>

              <div className="admin-profile-info">
                <strong>{admin.name}</strong>
                <span>Administrator</span>
              </div>

            </div>

          </div>

        </header>

        {/* Dashboard content */}
        <div className="dashboard-content">

          {/* Welcome */}
          <section className="welcome-section">

            <div>
              <h2>
                Good morning, {admin.name.split(" ")[0]} 👋
              </h2>

              <p>
                Here's what's happening across your civic
                complaint network today.
              </p>
            </div>

            <div className="system-badge">
              <span />
              Live System
            </div>

          </section>

          {/* =================================================
              KPI CARDS
              ================================================= */}

          <section className="kpi-grid">

            <KpiCard
              title="Total Complaints"
              value={dashboard.totalComplaints}
              icon={<Activity size={21} />}
              trend="+12.5%"
              trendType="up"
              description="vs last month"
            />

            <KpiCard
              title="Pending"
              value={dashboard.pending}
              icon={<Clock3 size={21} />}
              trend="+4.2%"
              trendType="warning"
              description="need attention"
            />

            <KpiCard
              title="In Progress"
              value={dashboard.inProgress}
              icon={<TrendingUp size={21} />}
              trend="+8.7%"
              trendType="up"
              description="being handled"
            />

            <KpiCard
              title="Resolved"
              value={dashboard.resolved}
              icon={<CheckCircle2 size={21} />}
              trend="+16.3%"
              trendType="up"
              description="successfully resolved"
            />

            <KpiCard
              title="High Priority"
              value={dashboard.highPriority}
              icon={<AlertTriangle size={21} />}
              trend="12 overdue"
              trendType="danger"
              description="require action"
            />

            <KpiCard
              title="Fraud Suspected"
              value={dashboard.fraudSuspected}
              icon={<ShieldAlert size={21} />}
              trend="7 new"
              trendType="danger"
              description="AI flagged"
            />

            <KpiCard
              title="Unassigned"
              value={dashboard.unassigned}
              icon={<UserCheck size={21} />}
              trend="23 urgent"
              trendType="warning"
              description="awaiting officer"
            />

            <KpiCard
              title="Active Officers"
              value={dashboard.activeOfficers}
              icon={<Users size={21} />}
              trend="94.2%"
              trendType="up"
              description="availability"
            />

          </section>

          {/* =================================================
              ANALYTICS
              ================================================= */}

          <section className="analytics-grid">

            {/* Complaint Trend */}
            <div className="dashboard-card trend-card">

              <div className="card-header">

                <div>
                  <h3>Complaint Trends</h3>
                  <p>Complaints received this week</p>
                </div>

                <div className="card-icon">
                  <TrendingUp size={19} />
                </div>

              </div>

              <div className="trend-chart">

                <div className="chart-y-axis">
                  <span>{maxTrend}</span>
                  <span>{Math.round(maxTrend * 0.75)}</span>
                  <span>{Math.round(maxTrend * 0.5)}</span>
                  <span>{Math.round(maxTrend * 0.25)}</span>
                  <span>0</span>
                </div>

                <div className="chart-area">

                  <div className="chart-grid-lines">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>

                  <div className="chart-bars">

                    {dashboard.trend.map((item) => (
                      <div
                        className="chart-bar-wrapper"
                        key={item.label}
                      >
                        <div
                          className="chart-bar"
                          style={{
                            height: `${Math.max(
                              8,
                              (item.value / maxTrend) * 100
                            )}%`,
                          }}
                          title={`${item.value} complaints`}
                        >
                          <span className="bar-tooltip">
                            {item.value}
                          </span>
                        </div>

                        <span className="bar-label">
                          {item.label}
                        </span>
                      </div>
                    ))}

                  </div>

                </div>

              </div>

            </div>

            {/* Complaint Status */}
            <div className="dashboard-card status-card">

              <div className="card-header">

                <div>
                  <h3>Complaint Status</h3>
                  <p>Current distribution</p>
                </div>

                <div className="card-icon">
                  <BarChart3 size={19} />
                </div>

              </div>

              <div className="status-total">
                <strong>
                  {dashboard.totalComplaints.toLocaleString()}
                </strong>

                <span>Total complaints</span>
              </div>

              <div className="status-list">

                <StatusRow
                  label="Resolved"
                  value={dashboard.status.resolved}
                  percentage={getStatusPercentage(
                    dashboard.status.resolved
                  )}
                  className="resolved"
                />

                <StatusRow
                  label="Pending"
                  value={dashboard.status.pending}
                  percentage={getStatusPercentage(
                    dashboard.status.pending
                  )}
                  className="pending"
                />

                <StatusRow
                  label="In Progress"
                  value={dashboard.status.inProgress}
                  percentage={getStatusPercentage(
                    dashboard.status.inProgress
                  )}
                  className="progress"
                />

                <StatusRow
                  label="Rejected"
                  value={dashboard.status.rejected}
                  percentage={getStatusPercentage(
                    dashboard.status.rejected
                  )}
                  className="rejected"
                />

              </div>

            </div>

          </section>

          {/* =================================================
              AI + ALERTS
              ================================================= */}

          <section className="middle-grid">

            {/* AI Monitoring */}
            <div className="dashboard-card ai-card">

              <div className="card-header">

                <div className="card-title-with-icon">
                  <div className="ai-card-icon">
                    <Bot size={21} />
                  </div>

                  <div>
                    <h3>AI Verification</h3>
                    <p>Automated complaint intelligence</p>
                  </div>
                </div>

                <button
                  className="view-link"
                  onClick={() => handleMenuClick("ai")}
                >
                  View details
                  <ChevronRight size={15} />
                </button>

              </div>

              <div className="ai-stats">

                <div className="ai-stat-main">
                  <div className="ai-ring">
                    <div>
                      <strong>
                        {dashboard.ai.accuracy}%
                      </strong>
                      <span>Accuracy</span>
                    </div>
                  </div>
                </div>

                <div className="ai-stat-list">

                  <div>
                    <span className="stat-dot verified" />
                    <span>AI Verified</span>
                    <strong>
                      {dashboard.ai.verified.toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    <span className="stat-dot genuine" />
                    <span>Genuine</span>
                    <strong>
                      {dashboard.ai.genuine.toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    <span className="stat-dot suspicious" />
                    <span>Suspicious</span>
                    <strong>
                      {dashboard.ai.suspicious.toLocaleString()}
                    </strong>
                  </div>

                </div>

              </div>

              <div className="ai-progress">
                <div>
                  <span>AI verification coverage</span>
                  <strong>67.6%</strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: "67.6%" }}
                  />
                </div>
              </div>

            </div>

            {/* Alerts */}
            <div className="dashboard-card alerts-card">

              <div className="card-header">

                <div>
                  <h3>Priority Alerts</h3>
                  <p>Items requiring attention</p>
                </div>

                <div className="alert-header-icon">
                  <Bell size={19} />
                </div>

              </div>

              <div className="alerts-list">

                {dashboard.alerts.map((alert, index) => (
                  <div
                    className={`alert-item ${alert.type}`}
                    key={index}
                  >

                    <div className="alert-icon">
                      {alert.type === "danger" ? (
                        <AlertTriangle size={18} />
                      ) : alert.type === "warning" ? (
                        <ShieldAlert size={18} />
                      ) : (
                        <UserCheck size={18} />
                      )}
                    </div>

                    <div className="alert-content">

                      <div className="alert-title-row">
                        <strong>{alert.title}</strong>

                        <span>{alert.count}</span>
                      </div>

                      <p>{alert.description}</p>

                    </div>

                    <ChevronRight size={16} />

                  </div>
                ))}

              </div>

            </div>

          </section>

          {/* =================================================
              OFFICER PERFORMANCE
              ================================================= */}

          <section className="dashboard-card officer-card">

            <div className="card-header">

              <div>
                <h3>Officer Performance</h3>
                <p>Current workload and resolution performance</p>
              </div>

              <button
                className="view-link"
                onClick={() => handleMenuClick("officers")}
              >
                View all officers
                <ChevronRight size={15} />
              </button>

            </div>

            <div className="table-wrapper">

              <table className="admin-table">

                <thead>
                  <tr>
                    <th>Officer</th>
                    <th>Department</th>
                    <th>Assigned</th>
                    <th>Resolved</th>
                    <th>Performance</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>

                  {dashboard.officers.map((officer) => {

                    const performance =
                      officer.assigned > 0
                        ? Math.round(
                            (officer.resolved /
                              officer.assigned) *
                              100
                          )
                        : 0;

                    return (
                      <tr key={officer.name}>

                        <td>
                          <div className="officer-name">

                            <div className="officer-avatar">
                              {getInitials(officer.name)}
                            </div>

                            <strong>{officer.name}</strong>

                          </div>
                        </td>

                        <td>
                          <span className="department-text">
                            {officer.department}
                          </span>
                        </td>

                        <td>
                          <strong>{officer.assigned}</strong>
                        </td>

                        <td>
                          <strong>{officer.resolved}</strong>
                        </td>

                        <td>

                          <div className="performance-cell">

                            <div className="performance-bar">
                              <div
                                style={{
                                  width: `${performance}%`,
                                }}
                              />
                            </div>

                            <span>{performance}%</span>

                          </div>

                        </td>

                        <td>
                          <span
                            className={`officer-status ${
                              officer.status === "Active"
                                ? "active"
                                : "busy"
                            }`}
                          >
                            <span />
                            {officer.status}
                          </span>
                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>

          </section>

          {/* =================================================
              RECENT COMPLAINTS
              ================================================= */}

          <section className="dashboard-card complaints-card">

            <div className="card-header">

              <div>
                <h3>Recent Complaints</h3>
                <p>Latest civic complaints received</p>
              </div>

              <button
                className="view-link"
                onClick={() => handleMenuClick("complaints")}
              >
                View all complaints
                <ChevronRight size={15} />
              </button>

            </div>

            <div className="complaint-search">

              <Search size={17} />

              <input
                type="text"
                placeholder="Search complaint ID, category or location..."
              />

            </div>

            <div className="table-wrapper">

              <table className="admin-table complaints-table">

                <thead>
                  <tr>
                    <th>Complaint</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Priority</th>
                    <th>Officer</th>
                    <th>Status</th>
                    <th>AI Score</th>
                  </tr>
                </thead>

                <tbody>

                  {dashboard.complaints.map((complaint) => (
                    <tr key={complaint.id}>

                      <td>
                        <button className="complaint-id">
                          {complaint.id}
                        </button>
                      </td>

                      <td>
                        <strong>
                          {complaint.category}
                        </strong>
                      </td>

                      <td>
                        <div className="location-cell">
                          <MapPin size={15} />
                          {complaint.location}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`priority-badge ${complaint.priority.toLowerCase()}`}
                        >
                          {complaint.priority}
                        </span>
                      </td>

                      <td>
                        {complaint.officer === "Unassigned" ? (
                          <span className="unassigned">
                            Unassigned
                          </span>
                        ) : (
                          complaint.officer
                        )}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${complaint.status
                            .toLowerCase()
                            .replace(" ", "-")}`}
                        >
                          {complaint.status}
                        </span>
                      </td>

                      <td>

                        <div
                          className={`ai-score ${
                            complaint.aiScore >= 95
                              ? "high"
                              : complaint.aiScore >= 90
                              ? "medium"
                              : "low"
                          }`}
                        >
                          <ShieldCheck size={14} />
                          {complaint.aiScore}%
                        </div>

                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>

          </section>

          {/* =================================================
              QUICK ACTIONS
              ================================================= */}

          <section className="quick-actions">

            <button
              onClick={() => handleMenuClick("complaints")}
            >
              <Activity size={20} />
              <div>
                <strong>Manage Complaints</strong>
                <span>Review and assign complaints</span>
              </div>
              <ChevronRight size={17} />
            </button>

            <button
              onClick={() => handleMenuClick("officers")}
            >
              <Users size={20} />
              <div>
                <strong>Manage Officers</strong>
                <span>Monitor officer workload</span>
              </div>
              <ChevronRight size={17} />
            </button>

            <button
              onClick={() => handleMenuClick("fraud")}
            >
              <ShieldAlert size={20} />
              <div>
                <strong>Review Fraud Alerts</strong>
                <span>Inspect AI flagged complaints</span>
              </div>
              <ChevronRight size={17} />
            </button>

          </section>

        </div>

      </main>

    </div>
  );
}

/* =========================================================
   KPI CARD
   ========================================================= */

function KpiCard({
  title,
  value,
  icon,
  trend,
  trendType,
  description,
}) {
  return (
    <div className="kpi-card">

      <div className="kpi-top">

        <div className="kpi-icon">
          {icon}
        </div>

        <span className={`kpi-trend ${trendType}`}>
          {trendType === "up" && <TrendingUp size={13} />}
          {trendType === "danger" && (
            <AlertTriangle size={13} />
          )}
          {trendType === "warning" && (
            <Clock3 size={13} />
          )}

          {trend}
        </span>

      </div>

      <div className="kpi-value">
        {typeof value === "number"
          ? value.toLocaleString()
          : value}
      </div>

      <div className="kpi-bottom">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>

    </div>
  );
}

/* =========================================================
   STATUS ROW
   ========================================================= */

function StatusRow({
  label,
  value,
  percentage,
  className,
}) {
  return (
    <div className="status-row">

      <div className="status-row-top">

        <div className="status-label">
          <span className={`status-dot ${className}`} />
          {label}
        </div>

        <strong>
          {value.toLocaleString()}
        </strong>

      </div>

      <div className="status-progress">

        <div
          className={`status-progress-fill ${className}`}
          style={{
            width: `${Math.max(2, percentage)}%`,
          }}
        />

      </div>

    </div>
  );
}