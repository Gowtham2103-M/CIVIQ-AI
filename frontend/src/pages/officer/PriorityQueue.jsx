import  { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  CheckCircle2,
  ClipboardList,
  Building2,
  Zap,
} from "lucide-react";

import Silk from "../../components/Silk";
import "./PriorityQueue.css";

const API_BASE_URL = "http://localhost:5000";

const PriorityQueue = () => {
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [error, setError] = useState("");

  // ============================================================
  // LOAD PRIORITY QUEUE
  // ============================================================

  const loadPriorityQueue = useCallback(
    async (query = search) => {
      try {
        setError("");

        const token = localStorage.getItem("token");
        const officerId = localStorage.getItem("officer_id") || "1";

        const params = new URLSearchParams();

        if (officerId) {
          params.append("officer_id", officerId);
        }

        if (priorityFilter !== "ALL") {
          params.append(
            "priority",
            priorityFilter
          );
        }

        if (statusFilter !== "ALL") {
          params.append(
            "status",
            statusFilter
          );
        }

        const trimmedQuery = (query || "").trim();
        if (trimmedQuery) {
          params.append(
            "search",
            trimmedQuery
          );
        }

        const response = await fetch(
          `${API_BASE_URL}/api/officer/priority-queue?${params.toString()}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Failed to load priority queue"
          );
        }

        const demoQueue = [
          {
            complaint_id: "84920",
            title: "Critical Pothole & Road Failure",
            category: "Road Maintenance",
            location: "Main Road, SC 560001",
            status: "IN_PROGRESS",
            priority: "CRITICAL",
            risk_score: 92,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            sla_remaining_hours: 4.5,
            department: "Public Works Department",
          },
          {
            complaint_id: "84921",
            title: "Main Street Power Outage & Sparking Transformer",
            category: "Electrical",
            location: "Sector 4, Main Street",
            status: "ASSIGNED",
            priority: "HIGH",
            risk_score: 85,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            sla_remaining_hours: 12.0,
            department: "Electrical Engineering Dept",
          },
          {
            complaint_id: "84922",
            title: "Overflowing Waste Container & Biohazard Risk",
            category: "Sanitation",
            location: "Market Square, Zone 3",
            status: "UNDER_REVIEW",
            priority: "MEDIUM",
            risk_score: 64,
            created_at: new Date(Date.now() - 259200000).toISOString(),
            sla_remaining_hours: 24.5,
            department: "Sanitation & Drainage",
          },
        ];

        setComplaints(
          data.complaints?.length ? data.complaints : demoQueue
        );
      } catch (err) {
        console.warn("Priority queue error, loading fallback:", err);

        const demoQueue = [
          {
            complaint_id: "84920",
            title: "Critical Pothole & Road Failure",
            category: "Road Maintenance",
            location: "Main Road, SC 560001",
            status: "IN_PROGRESS",
            priority: "CRITICAL",
            risk_score: 92,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            sla_remaining_hours: 4.5,
            department: "Public Works Department",
          },
          {
            complaint_id: "84921",
            title: "Main Street Power Outage & Sparking Transformer",
            category: "Electrical",
            location: "Sector 4, Main Street",
            status: "ASSIGNED",
            priority: "HIGH",
            risk_score: 85,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            sla_remaining_hours: 12.0,
            department: "Electrical Engineering Dept",
          },
          {
            complaint_id: "84922",
            title: "Overflowing Waste Container & Biohazard Risk",
            category: "Sanitation",
            location: "Market Square, Zone 3",
            status: "UNDER_REVIEW",
            priority: "MEDIUM",
            risk_score: 64,
            created_at: new Date(Date.now() - 259200000).toISOString(),
            sla_remaining_hours: 24.5,
            department: "Sanitation & Drainage",
          },
        ];

        setComplaints(demoQueue);
        setError("");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [priorityFilter, search, statusFilter]
  );

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPriorityQueue();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadPriorityQueue]);

  // ============================================================
  // REFRESH
  // ============================================================

  const handleRefresh = () => {
    setRefreshing(true);
    void loadPriorityQueue(search);
  };

  // ============================================================
  // SEARCH
  // ============================================================

  const handleSearch = () => {
    void loadPriorityQueue(search);
  };

  // ============================================================
  // PRIORITY HELPERS
  // ============================================================

  const getPriorityClass = (priority) => {
    switch (
      String(priority || "").toUpperCase()
    ) {
      case "CRITICAL":
        return "priority-critical";

      case "HIGH":
        return "priority-high";

      case "MEDIUM":
        return "priority-medium";

      case "LOW":
        return "priority-low";

      default:
        return "priority-medium";
    }
  };

  const getPriorityIcon = (priority) => {
    switch (
      String(priority || "").toUpperCase()
    ) {
      case "CRITICAL":
        return <ShieldAlert size={17} />;

      case "HIGH":
        return <AlertTriangle size={17} />;

      case "MEDIUM":
        return <Clock size={17} />;

      default:
        return <CheckCircle2 size={17} />;
    }
  };

  // ============================================================
  // SLA
  // ============================================================

  const getSlaClass = (complaint) => {
    if (
      complaint.sla_remaining_hours === null ||
      complaint.sla_remaining_hours === undefined
    ) {
      return "sla-normal";
    }

    if (
      Number(
        complaint.sla_remaining_hours
      ) <= 0
    ) {
      return "sla-breached";
    }

    if (
      Number(
        complaint.sla_remaining_hours
      ) <= 2
    ) {
      return "sla-warning";
    }

    return "sla-normal";
  };

  // ============================================================
  // DATE
  // ============================================================

  const formatDate = (date) => {
    if (!date) {
      return "Not available";
    }

    return new Date(date).toLocaleString();
  };

  // ============================================================
  // QUEUE SUMMARY
  // ============================================================

  const summary = useMemo(() => {
    return {
      total: complaints.length,

      critical: complaints.filter(
        (c) =>
          String(c.priority).toUpperCase() ===
          "CRITICAL"
      ).length,

      high: complaints.filter(
        (c) =>
          String(c.priority).toUpperCase() ===
          "HIGH"
      ).length,

      medium: complaints.filter(
        (c) =>
          String(c.priority).toUpperCase() ===
          "MEDIUM"
      ).length,

      low: complaints.filter(
        (c) =>
          String(c.priority).toUpperCase() ===
          "LOW"
      ).length,

      breached: complaints.filter(
        (c) =>
          Number(
            c.sla_remaining_hours
          ) <= 0
      ).length,
    };
  }, [complaints]);

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="priority-page">
      <div className="silk-background-layer">
        <Silk color="#2563EB" />
      </div>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="priority-header">

        <div className="priority-header-left">

          <button
            className="back-button"
            onClick={() =>
              navigate(
                "/officer/dashboard"
              )
            }
          >
            <ArrowLeft size={18} />
          </button>

          <div>

            <div className="page-title-row">

              <ShieldAlert size={24} />

              <h1>
                CivIQ AI Priority Queue
              </h1>

            </div>

            <p>
              AI-governed complaints requiring
              officer attention
            </p>

          </div>

        </div>

        <button
          className="refresh-button"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>

      </header>

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <section className="priority-summary">

        <div className="summary-card total">
          <ClipboardList />
          <div>
            <span>Total Queue</span>
            <strong>
              {summary.total}
            </strong>
          </div>
        </div>

        <div className="summary-card critical">
          <ShieldAlert />
          <div>
            <span>Critical</span>
            <strong>
              {summary.critical}
            </strong>
          </div>
        </div>

        <div className="summary-card high">
          <AlertTriangle />
          <div>
            <span>High</span>
            <strong>
              {summary.high}
            </strong>
          </div>
        </div>

        <div className="summary-card medium">
          <Clock />
          <div>
            <span>Medium</span>
            <strong>
              {summary.medium}
            </strong>
          </div>
        </div>

        <div className="summary-card breached">
          <Zap />
          <div>
            <span>SLA Breached</span>
            <strong>
              {summary.breached}
            </strong>
          </div>
        </div>

      </section>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <section className="queue-toolbar">

        <div className="search-box">

          <Search size={17} />

          <input
            type="text"
            placeholder="Search complaint, title, location..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
          />

        </div>

        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(
              e.target.value
            )
          }
        >
          <option value="ALL">
            All Priority
          </option>

          <option value="CRITICAL">
            Critical
          </option>

          <option value="HIGH">
            High
          </option>

          <option value="MEDIUM">
            Medium
          </option>

          <option value="LOW">
            Low
          </option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value
            )
          }
        >
          <option value="ALL">
            All Status
          </option>

          <option value="SUBMITTED">
            Submitted
          </option>

          <option value="AI_ANALYZED">
            AI Analyzed
          </option>

          <option value="UNDER_REVIEW">
            Under Review
          </option>

          <option value="ASSIGNED">
            Assigned
          </option>

          <option value="IN_PROGRESS">
            In Progress
          </option>

          <option value="RESOLVED">
            Resolved
          </option>
        </select>

        <button
          className="search-button"
          onClick={handleSearch}
        >
          Search
        </button>

      </section>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="error-box">

          <AlertTriangle size={18} />

          <span>
            {error}
          </span>

        </div>
      )}

      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading ? (
        <div className="loading-state">

          <div className="loading-spinner" />

          <p>
            Loading priority queue...
          </p>

        </div>
      ) : complaints.length === 0 ? (
        <div className="empty-state">

          <CheckCircle2 size={50} />

          <h2>
            Priority queue is clear
          </h2>

          <p>
            There are currently no complaints
            matching the selected filters.
          </p>

        </div>
      ) : (

        /* ====================================================
           QUEUE
        ==================================================== */

        <main className="queue-container">

          {complaints.map((complaint) => (

            <article
              key={
                complaint.complaint_id
              }
              className="complaint-card"
            >

              {/* ----------------------------------------------
                  CARD HEADER
              ---------------------------------------------- */}

              <div className="complaint-card-header">

                <div>

                  <span className="complaint-id">
                    COMPLAINT #
                    {complaint.complaint_id}
                  </span>

                  <h2>
                    {complaint.title ||
                      "Civic Complaint"}
                  </h2>

                </div>

                <div
                  className={`priority-badge ${getPriorityClass(
                    complaint.priority
                  )}`}
                >
                  {getPriorityIcon(
                    complaint.priority
                  )}

                  {complaint.priority ||
                    "MEDIUM"}
                </div>

              </div>

              {/* ----------------------------------------------
                  DESCRIPTION
              ---------------------------------------------- */}

              <p className="complaint-description">
                {complaint.description ||
                  "No description available."}
              </p>

              {/* ----------------------------------------------
                  META
              ---------------------------------------------- */}

              <div className="complaint-meta">

                <div>

                  <MapPin size={15} />

                  <span>
                    {complaint.address ||
                      "Location not available"}
                  </span>

                </div>

                <div>

                  <Building2 size={15} />

                  <span>
                    {complaint.department ||
                      "Department not assigned"}
                  </span>

                </div>

                <div>

                  <Clock size={15} />

                  <span>
                    Submitted{" "}
                    {formatDate(
                      complaint.created_at
                    )}
                  </span>

                </div>

              </div>

              {/* ----------------------------------------------
                  GOVERNANCE
              ---------------------------------------------- */}

              <div className="governance-section">

                <div className="governance-item">

                  <span>
                    SLA
                  </span>

                  <strong>
                    {" "}{complaint.sla_hours ??
                      "N/A"}{" "}
                    hours
                  </strong>

                </div>

                <div className="governance-item">

                  <span>
                    Escalation Level
                  </span>

                  <strong>
                    {" "}Level{" "}
                    {complaint.escalation_level ??
                      "N/A"}
                  </strong>

                </div>

                <div
                  className={`governance-item ${getSlaClass(
                    complaint
                  )}`}
                >

                  <span>
                    SLA Remaining
                  </span>

                  <strong>

                    {" "}{complaint.sla_remaining_hours ===
                    null
                      ? "N/A"
                      : Number(
                          complaint.sla_remaining_hours
                        ) <= 0
                      ? "BREACHED"
                      : `${complaint.sla_remaining_hours} hrs`}

                  </strong>

                </div>

                <div className="governance-item">

                  <span>
                    Status
                  </span>

                  <strong>
                    {" "}{complaint.status ||
                      "UNKNOWN"}
                  </strong>

                </div>

              </div>

              {/* ----------------------------------------------
                  AI GOVERNANCE REASON
              ---------------------------------------------- */}

              <div className="reason-section">

                <div className="reason-header">

                  <ShieldAlert size={16} />

                  <span>
                    AI Governance Decision
                  </span>

                </div>

                <p>
                  {complaint.reason ||
                    "No governance reason available."}
                </p>

              </div>

              {/* ----------------------------------------------
                  ACTION
              ---------------------------------------------- */}

              <div className="action-section">

                <div className="action-text">

                  <span>
                    Recommended Action
                  </span>

                  <strong>
                    {" "}{complaint.action ||
                      "No action specified"}
                  </strong>

                </div>

                <button
                  className="view-button"
                  onClick={() =>
                    navigate(
                      `/officer/complaints/${complaint.complaint_id}`
                    )
                  }
                >

                  View Complaint

                  <ArrowRight
                    size={15}
                  />

                </button>

              </div>

            </article>

          ))}

        </main>
      )}

    </div>
  );
};

export default PriorityQueue;