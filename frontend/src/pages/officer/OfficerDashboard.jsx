import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  ClipboardList,
  AlertTriangle,
  Wrench,
  Send,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  BarChart3,
  Clock,
  MapPin,
  Play,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Sidebar } from "../../components/Sidebar";
import { Navbar } from "../../components/Navbar";
import { Toast } from "../../components/Toast";
import Silk from "../../components/Silk";

import "./OfficerDashboard.css";

const API_BASE_URL = "http://localhost:5000";

const DashboardStat = ({
  title,
  value,
  icon: Icon,
  iconClass,
  trend,
  active,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`officer-stat-card ${
        active ? "stat-active" : ""
      }`}
    >
      <div className="stat-card-content">
        <div>
          <p className="stat-title">{title}</p>
          <p className="stat-value">{value ?? 0}</p>
          <p className="stat-trend">{trend || ""}</p>
        </div>

        <div className={`stat-icon ${iconClass}`}>
          <Icon />
        </div>
      </div>
    </button>
  );
};

const DashboardComplaintCard = ({
  complaint,
  actionLoading,
  onAction,
}) => {
  const priority = complaint.priority || "Normal";
  const riskScore = Number(complaint.risk_score || 0);
  const riskPercentage =
    riskScore <= 1 ? riskScore * 100 : riskScore;

  let priorityClass = "priority-normal";

  if (priority === "Critical") {
    priorityClass = "priority-critical";
  } else if (priority === "High") {
    priorityClass = "priority-high";
  } else if (priority === "Medium") {
    priorityClass = "priority-medium";
  }

  let actionLabel = "View";

  if (complaint.status === "Assigned") {
    actionLabel = "Accept";
  } else if (complaint.status === "Accepted") {
    actionLabel = "Start Work";
  } else if (complaint.status === "In Progress") {
    actionLabel = "View Details";
  }

  const isActionLoading =
    actionLoading ===
    `${complaint.complaint_id}-${
      complaint.status === "Assigned" ? "Accepted" : "In Progress"
    }`;

  return (
    <div className="complaint-card">
      {complaint.image_url && (
        <div className="complaint-image-container">
          <img 
            src={complaint.image_url} 
            alt={complaint.title || "Complaint"}
            className="complaint-image"
            loading="lazy"
          />
        </div>
      )}

      <div className="complaint-header">
        <div>
          <p className="complaint-id">#{complaint.complaint_id}</p>
          <h4>
            {complaint.title || complaint.category || "Civic Complaint"}
          </h4>
        </div>

        <span className={`priority-badge ${priorityClass}`}>
          {priority}
        </span>
      </div>

      {(complaint.location || complaint.address) && (
        <div className="complaint-location">
          <MapPin />
          <span>{complaint.location || complaint.address}</span>
        </div>
      )}

      <div className="complaint-info">
        <div>
          <span>Status</span>
          <strong>{complaint.status || "Unknown"}</strong>
        </div>

        <div>
          <span>AI Risk</span>
          <strong
            className={
              riskPercentage >= 75 ? "risk-high" : "risk-normal"
            }
          >
            {riskPercentage.toFixed(0)}%
          </strong>
        </div>
      </div>

      <button
        className="complaint-action"
        disabled={isActionLoading}
        onClick={() => onAction(complaint)}
      >
        {isActionLoading ? (
          <Loader2 className="button-spinner" />
        ) : complaint.status === "Assigned" ? (
          <CheckCircle />
        ) : complaint.status === "Accepted" ? (
          <Play />
        ) : (
          <ArrowRight />
        )}

        {actionLabel}
      </button>
    </div>
  );
};

export const OfficerDashboard = () => {
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);

  const [dashboard, setDashboard] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const [activeStatFilter, setActiveStatFilter] = useState("all");

  const [toast, setToast] = useState({
    message: "",
    type: "info",
  });

  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_BASE_URL}/api/officer/dashboard`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load dashboard");
      }

      setDashboard(data);
    } catch (error) {
      console.error("Dashboard error:", error);

      setToast({
        message: error.message || "Unable to load dashboard",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  // =====================================================
  // STATUS ACTION
  // =====================================================

  const updateComplaintStatus = async (
    complaintId,
    newStatus
  ) => {
    try {
      setActionLoading(`${complaintId}-${newStatus}`);

      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_BASE_URL}/api/officer/complaints/${complaintId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update complaint"
        );
      }

      setToast({
        message: `Complaint #${complaintId} updated to ${newStatus}`,
        type: "success",
      });

      await loadDashboard();
    } catch (error) {
      console.error(error);

      setToast({
        message:
          error.message || "Unable to update complaint",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // =====================================================
  // COMPLAINT ACTION
  // =====================================================

  const handleComplaintAction = (complaint) => {
    if (complaint.status === "Assigned") {
      updateComplaintStatus(
        complaint.complaint_id,
        "Accepted"
      );
      return;
    }

    if (complaint.status === "Accepted") {
      updateComplaintStatus(
        complaint.complaint_id,
        "In Progress"
      );
      return;
    }

    navigate(
      `/officer/complaints/${complaint.complaint_id}`
    );
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="officer-loading">
        <Loader2 className="loading-spinner" />

        <p>Loading officer dashboard...</p>
      </div>
    );
  }

  // =====================================================
  // SAFE DEFAULTS
  // =====================================================

  const stats = dashboard?.statistics || {};

  const officer = dashboard?.officer || {};

  const performance =
    dashboard?.performance || {};

  const priorityQueue =
    dashboard?.priority_queue || [];

  const unreadNotifications =
    dashboard?.unread_notifications || 0;

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="officer-layout">

      <div className="silk-background-layer">
        <Silk color="#2563EB" />
      </div>

      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        unreadCount={unreadNotifications}
        assignedCount={
          stats.assigned_complaints || 0
        }
      />

      <div className="officer-main">

        <Navbar
          title="Officer Dashboard"
          breadcrumbs={[
            {
              label: "Dashboard",
            },
          ]}
          onMenuClick={() =>
            setMobileOpen(true)
          }
          unreadCount={unreadNotifications}
        />

        <main className="officer-content">

          {/* =========================================
              WELCOME
          ========================================= */}

          <section className="officer-welcome">

            <div className="welcome-glow" />

            <div className="welcome-content">

              <div>
                <div className="welcome-label">
                  <span>
                    {officer.department ||
                      "Civic Administration"}
                  </span>

                  <span className="online-dot" />
                </div>

                <h2>
                  Welcome back,{" "}
                  {officer.full_name ||
                    "Officer"}
                </h2>

                <p>
                  {officer.jurisdiction
                    ? `Jurisdiction: ${officer.jurisdiction}.`
                    : "Manage and resolve citizen complaints assigned to you."}
                </p>
              </div>

              <Link
                to="/officer/complaints"
                className="primary-button"
              >
                <ClipboardList />

                View All Complaints

                <span>
                  ({stats.total_complaints || 0})
                </span>
              </Link>

            </div>
          </section>

          {/* =========================================
              STATISTICS
          ========================================= */}

          <section className="stats-grid">

            <DashboardStat
              title="Assigned Complaints"
              value={
                stats.assigned_complaints
              }
              icon={ClipboardList}
              iconClass="blue-icon"
              trend="Currently assigned"
              active={
                activeStatFilter ===
                "assigned"
              }
              onClick={() => {
                setActiveStatFilter(
                  "assigned"
                );

                navigate(
                  "/officer/complaints?status=Assigned"
                );
              }}
            />

            <DashboardStat
              title="High Priority"
              value={
                stats.high_priority
              }
              icon={AlertTriangle}
              iconClass="red-icon"
              trend="Requires attention"
              active={
                activeStatFilter === "high"
              }
              onClick={() => {
                setActiveStatFilter("high");

                navigate(
                  "/officer/complaints?priority=High"
                );
              }}
            />

            <DashboardStat
              title="In Progress"
              value={
                stats.in_progress
              }
              icon={Wrench}
              iconClass="indigo-icon"
              trend="Active work"
              active={
                activeStatFilter ===
                "progress"
              }
              onClick={() => {
                setActiveStatFilter(
                  "progress"
                );

                navigate(
                  "/officer/complaints?status=In%20Progress"
                );
              }}
            />

            <DashboardStat
              title="Resolution Pending"
              value={
                stats.resolution_pending
              }
              icon={Send}
              iconClass="purple-icon"
              trend="Awaiting verification"
              active={
                activeStatFilter ===
                "pending"
              }
              onClick={() => {
                setActiveStatFilter(
                  "pending"
                );

                navigate(
                  "/officer/complaints?status=Resolution%20Submitted"
                );
              }}
            />

            <DashboardStat
              title="Resolved"
              value={
                stats.resolved
              }
              icon={CheckCircle2}
              iconClass="green-icon"
              trend="Successfully resolved"
              active={
                activeStatFilter ===
                "resolved"
              }
              onClick={() => {
                setActiveStatFilter(
                  "resolved"
                );

                navigate(
                  "/officer/complaints?status=Resolved"
                );
              }}
            />

          </section>

          {/* =========================================
              MAIN CONTENT
          ========================================= */}

          <section className="dashboard-columns">

            {/* PRIORITY QUEUE */}

            <div className="priority-section">

              <div className="section-heading">

                <div>
                  <h3>
                    <ShieldAlert />
                    Priority Queue
                  </h3>

                  <p>
                    AI-identified high-risk
                    complaints requiring attention
                  </p>
                </div>

                <Link
                  to="/officer/complaints?priority=High"
                  className="view-link"
                >
                  View All
                  <ArrowRight />
                </Link>

              </div>

              <div className="complaints-grid">

                {priorityQueue
                  .slice(0, 4)
                  .map((complaint) => (
                    <DashboardComplaintCard
                      key={complaint.complaint_id}
                      complaint={complaint}
                      actionLoading={actionLoading}
                      onAction={handleComplaintAction}
                    />
                  ))}

                {priorityQueue.length ===
                  0 && (
                  <div className="empty-state">

                    <CheckCircle2 />

                    <h4>
                      No priority complaints
                    </h4>

                    <p>
                      There are currently no
                      high-risk complaints
                      requiring immediate action.
                    </p>

                  </div>
                )}

              </div>

            </div>

            {/* PERFORMANCE */}

            <div className="performance-section">

              <div className="section-heading">

                <div>
                  <h3>
                    <BarChart3 />
                    Performance
                  </h3>

                  <p>
                    Current officer performance
                  </p>
                </div>

                <span className="period-label">
                  This Month
                </span>

              </div>

              <div className="performance-card">

                {/* SLA */}

                <div className="performance-item">

                  <div className="performance-label">

                    <span>
                      SLA Compliance
                    </span>

                    <strong>
                      {performance.sla_compliance ??
                        0}
                      %
                    </strong>

                  </div>

                  <div className="progress-bar">
                    <div
                      style={{
                        width: `${Math.min(
                          performance.sla_compliance ||
                            0,
                          100
                        )}%`,
                      }}
                    />
                  </div>

                </div>

                {/* RESOLUTION TIME */}

                <div className="performance-item">

                  <div className="performance-label">

                    <span>
                      Average Resolution Time
                    </span>

                    <strong>
                      {performance.avg_resolution_hours ??
                        0}{" "}
                      Hours
                    </strong>

                  </div>

                  <div className="progress-bar">
                    <div
                      style={{
                        width: `${Math.min(
                          performance.resolution_progress ||
                            0,
                          100
                        )}%`,
                      }}
                    />
                  </div>

                </div>

                <div className="performance-divider" />

                <div className="performance-small-grid">

                  <div>
                    <strong>
                      {performance.closed_count ??
                        0}
                    </strong>

                    <span>
                      Complaints Closed
                    </span>
                  </div>

                  <div>
                    <strong>
                      {performance.ai_verification_rate ??
                        0}
                      %
                    </strong>

                    <span>
                      AI Verification Pass
                    </span>
                  </div>

                </div>

                <div className="sla-info">

                  <Clock />

                  <p>
                    {performance.next_sla_message ||
                      "No pending SLA alerts."}
                  </p>

                </div>

              </div>

            </div>

          </section>

          {/* REFRESH */}

          <button
            className="refresh-dashboard"
            onClick={loadDashboard}
          >
            <RefreshCw />

            Refresh Dashboard
          </button>

        </main>

      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() =>
          setToast({
            message: "",
            type: "info",
          })
        }
      />

    </div>
  );
};

export default OfficerDashboard;
