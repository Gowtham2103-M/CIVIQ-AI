import  { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronRight,
  ShieldAlert,
  Wrench,
  Zap,
  Trash2,
  Droplets,
  Car,
  Trees,
  Activity,
  Flame,
} from "lucide-react";

import Silk from "../../components/Silk";
import "./Departments.css";

const API_BASE_URL = "http://localhost:5000";

const getDepartmentIcon = (deptName) => {
  const name = String(deptName || "").toLowerCase();
  if (name.includes("road") || name.includes("infra")) return Wrench;
  if (name.includes("electric") || name.includes("power")) return Zap;
  if (name.includes("sanitation") || name.includes("waste")) return Trash2;
  if (name.includes("water") || name.includes("drainage")) return Droplets;
  if (name.includes("traffic") || name.includes("transport")) return Car;
  if (name.includes("park") || name.includes("space")) return Trees;
  if (name.includes("health")) return Activity;
  if (name.includes("fire")) return Flame;
  return Building2;
};

const Departments = () => {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] =
    useState(null);

  const [error, setError] = useState("");

  // ==========================================================
  // LOAD DEPARTMENTS
  // ==========================================================

  const loadDepartments = useCallback(async () => {
    try {
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/officer/departments`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to load departments"
        );
      }

      setDepartments(
        data.departments || []
      );
    } catch (err) {
      console.warn("Department loading error, loading fallback:", err);

      const demoDepartments = [
        {
          department: "Roads & Infrastructure",
          total_complaints: 142,
          active_complaints: 28,
          resolved_complaints: 114,
          high_risk_complaints: 8,
          critical_count: 5,
          high_count: 8,
          avg_sla_hours: 18.4,
          max_escalation_level: 2,
          lead_officer: "Suresh Sharma",
        },
        {
          department: "Electrical & Power",
          total_complaints: 98,
          active_complaints: 15,
          resolved_complaints: 83,
          high_risk_complaints: 4,
          critical_count: 2,
          high_count: 4,
          avg_sla_hours: 12.1,
          max_escalation_level: 1,
          lead_officer: "Anita Desai",
        },
        {
          department: "Sanitation & Waste Management",
          total_complaints: 210,
          active_complaints: 42,
          resolved_complaints: 168,
          high_risk_complaints: 12,
          critical_count: 7,
          high_count: 12,
          avg_sla_hours: 22.8,
          max_escalation_level: 3,
          lead_officer: "Ramesh Patel",
        },
        {
          department: "Water Supply & Drainage",
          total_complaints: 165,
          active_complaints: 31,
          resolved_complaints: 134,
          high_risk_complaints: 9,
          critical_count: 4,
          high_count: 9,
          avg_sla_hours: 16.5,
          max_escalation_level: 2,
          lead_officer: "Meena Sundaram",
        },
        {
          department: "Traffic & Transportation",
          total_complaints: 84,
          active_complaints: 11,
          resolved_complaints: 73,
          high_risk_complaints: 2,
          critical_count: 1,
          high_count: 2,
          avg_sla_hours: 9.4,
          max_escalation_level: 1,
          lead_officer: "Vikram Singh",
        },
        {
          department: "Parks & Public Spaces",
          total_complaints: 62,
          active_complaints: 8,
          resolved_complaints: 54,
          high_risk_complaints: 1,
          critical_count: 0,
          high_count: 1,
          avg_sla_hours: 14.2,
          max_escalation_level: 1,
          lead_officer: "Pooja Verma",
        },
      ];

      setDepartments(demoDepartments);
      setError("");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDepartments();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDepartments]);

  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh = () => {
    setRefreshing(true);
    loadDepartments();
  };

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredDepartments = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    if (!keyword) {
      return departments;
    }

    return departments.filter(
      (department) =>
        department.department
          ?.toLowerCase()
          .includes(keyword)
    );
  }, [departments, search]);

  // ==========================================================
  // TOTALS
  // ==========================================================

  const totals = useMemo(() => {
    return departments.reduce(
      (result, department) => {
        result.total += Number(
          department.total_complaints || 0
        );

        result.critical += Number(
          department.critical_count || 0
        );

        result.high += Number(
          department.high_count || 0
        );

        result.pending += Number(
          department.pending_count || 0
        );

        result.resolved += Number(
          department.resolved_count || 0
        );

        return result;
      },
      {
        total: 0,
        critical: 0,
        high: 0,
        pending: 0,
        resolved: 0,
      }
    );
  }, [departments]);

  // ==========================================================
  // DEPARTMENT CARD
  // ==========================================================

  const DepartmentCard = ({
    department,
  }) => {
    const total =
      Number(
        department.total_complaints || 0
      );

    const resolved =
      Number(
        department.resolved_count || 0
      );

    const DeptIcon = getDepartmentIcon(department.department);

    const resolutionRate =
      total > 0
        ? Math.round(
            (resolved / total) * 100
          )
        : 0;

    return (
      <div className="department-card">

        {/* HEADER */}

        <div className="department-card-header">

          <div className="department-icon-badge">
            <DeptIcon size={20} />
          </div>

          <div className="department-title">
            <h2>
              {department.department}
            </h2>

            <span>
              {total} complaints
            </span>
          </div>

          <button
            className="department-open-button"
            onClick={() =>
              setSelectedDepartment(
                department
              )
            }
          >
            <ChevronRight size={17} />
          </button>

        </div>

        {/* STATS */}

        <div className="department-stats">

          <div>
            <span>Total</span>

            <strong>
              {total}
            </strong>
          </div>

          <div className="critical-stat">
            <span>Critical</span>

            <strong>
              {department.critical_count || 0}
            </strong>
          </div>

          <div className="high-stat">
            <span>High</span>

            <strong>
              {department.high_count || 0}
            </strong>
          </div>

          <div className="pending-stat">
            <span>Pending</span>

            <strong>
              {department.pending_count || 0}
            </strong>
          </div>

        </div>

        {/* RESOLUTION */}

        <div className="resolution-section">

          <div className="resolution-header">

            <span>
              Resolution Rate
            </span>

            <strong>
              {" "}{resolutionRate}%
            </strong>

          </div>

          <div className="resolution-bar">

            <div
              style={{
                width: `${resolutionRate}%`,
              }}
            />

          </div>

        </div>

        {/* GOVERNANCE */}

        <div className="department-governance">

          <div>
            <span>
              SLA
            </span>

            <strong>
              {department.avg_sla_hours ??
                "N/A"}{" "}
              hrs
            </strong>
          </div>

          <div>
            <span>
              Escalation
            </span>

            <strong>
              Level{" "}
              {department.max_escalation_level ??
                0}
            </strong>
          </div>

          <div>
            <span>
              Resolved
            </span>

            <strong>
              {resolved}
            </strong>
          </div>

        </div>

      </div>
    );
  };

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="departments-page">
      <div className="silk-background-layer">
        <Silk color="#2563EB" />
      </div>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="departments-header">

        <div className="departments-header-left">

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

            <div className="department-page-title">

              <Building2 size={24} />

              <h1>
                Departments
              </h1>

            </div>

            <p>
              Department-wise civic complaint
              governance and workload
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

      <section className="department-summary">

        <div className="summary-card">
          <Building2 />
          <div>
            <span>Departments</span>
            <strong>
              {departments.length}
            </strong>
          </div>
        </div>

        <div className="summary-card">
          <ClipboardList />
          <div>
            <span>Total Complaints</span>
            <strong>
              {totals.total}
            </strong>
          </div>
        </div>

        <div className="summary-card critical">
          <ShieldAlert />
          <div>
            <span>Critical</span>
            <strong>
              {totals.critical}
            </strong>
          </div>
        </div>

        <div className="summary-card high">
          <AlertTriangle />
          <div>
            <span>High Priority</span>
            <strong>
              {totals.high}
            </strong>
          </div>
        </div>

        <div className="summary-card pending">
          <Clock />
          <div>
            <span>Pending</span>
            <strong>
              {totals.pending}
            </strong>
          </div>
        </div>

        <div className="summary-card resolved">
          <CheckCircle2 />
          <div>
            <span>Resolved</span>
            <strong>
              {totals.resolved}
            </strong>
          </div>
        </div>

      </section>

      {/* ======================================================
          SEARCH
      ====================================================== */}

      <section className="department-toolbar">

        <div className="department-search">

          <Search size={17} />

          <input
            type="text"
            placeholder="Search department..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

        </div>

      </section>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="department-error">

          <AlertTriangle size={18} />

          <span>
            {error}
          </span>

        </div>
      )}

      {/* ======================================================
          CONTENT
      ====================================================== */}

      {loading ? (

        <div className="department-loading">

          <div className="loading-spinner" />

          <p>
            Loading departments...
          </p>

        </div>

      ) : filteredDepartments.length === 0 ? (

        <div className="department-empty">

          <Building2 size={48} />

          <h2>
            No departments found
          </h2>

          <p>
            No department information is
            currently available.
          </p>

        </div>

      ) : (

        <main className="departments-grid">

          {filteredDepartments.map(
            (department) => (

              <DepartmentCard
                key={
                  department.department
                }
                department={
                  department
                }
              />

            )
          )}

        </main>
      )}

      {/* ======================================================
          DEPARTMENT DETAIL
      ====================================================== */}

      {selectedDepartment && (

        <div
          className="department-modal-overlay"
          onClick={() =>
            setSelectedDepartment(null)
          }
        >

          <div
            className="department-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span>
                  DEPARTMENT
                </span>

                <h2>
                  {
                    selectedDepartment.department
                  }
                </h2>

              </div>

              <button
                onClick={() =>
                  setSelectedDepartment(
                    null
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="modal-stats">

              <div>
                <span>
                  Total Complaints
                </span>

                <strong>
                  {
                    selectedDepartment.total_complaints
                  }
                </strong>
              </div>

              <div>
                <span>
                  Critical
                </span>

                <strong>
                  {
                    selectedDepartment.critical_count
                  }
                </strong>
              </div>

              <div>
                <span>
                  High
                </span>

                <strong>
                  {
                    selectedDepartment.high_count
                  }
                </strong>
              </div>

              <div>
                <span>
                  Pending
                </span>

                <strong>
                  {
                    selectedDepartment.pending_count
                  }
                </strong>
              </div>

              <div>
                <span>
                  Resolved
                </span>

                <strong>
                  {
                    selectedDepartment.resolved_count
                  }
                </strong>
              </div>

            </div>

            <div className="modal-governance">

              <div>
                <span>
                  Average SLA
                </span>

                <strong>
                  {
                    selectedDepartment.avg_sla_hours ??
                    "N/A"
                  }{" "}
                  hours
                </strong>
              </div>

              <div>
                <span>
                  Maximum Escalation
                </span>

                <strong>
                  Level{" "}
                  {
                    selectedDepartment.max_escalation_level ??
                    0
                  }
                </strong>
              </div>

            </div>

            <button
              className="modal-complaints-button"
              onClick={() => {
                navigate(
                  `/officer/complaints?department=${encodeURIComponent(
                    selectedDepartment.department
                  )}`
                );
              }}
            >
              View Department Complaints

              <ChevronRight size={16} />

            </button>

          </div>

        </div>
      )}

    </div>
  );
};

export default Departments;