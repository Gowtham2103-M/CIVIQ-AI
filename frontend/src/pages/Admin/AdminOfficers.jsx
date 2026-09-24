import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Filter,
  Eye,
  UserRound,
  Building2,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  X,
  Mail,
  Phone,
  MapPin,
  BriefcaseBusiness,
} from "lucide-react";
import "./AdminOfficers.css";
import { adminRequest } from "../../services/adminApi";

/*
const DEMO_OFFICERS = [
  {
    id: 1,
    name: "Arun Kumar",
    email: "arun.kumar@civiq.gov.in",
    phone: "+91 98765 43210",
    employeeCode: "CIV1001",
    department: "Roads",
    designation: "Field Officer",
    district: "Chennai",
    status: "Active",
    complaints: 42,
    resolved: 36,
    pending: 4,
    overdue: 2,
    performance: 92,
    joined: "12 Jan 2024",
  },
  {
    id: 2,
    name: "Priya Devi",
    email: "priya.devi@civiq.gov.in",
    phone: "+91 98765 43211",
    employeeCode: "CIV1002",
    department: "Electricity",
    designation: "Senior Officer",
    district: "Chennai",
    status: "Active",
    complaints: 38,
    resolved: 35,
    pending: 2,
    overdue: 1,
    performance: 95,
    joined: "08 Mar 2023",
  },
  {
    id: 3,
    name: "Rahul Kumar",
    email: "rahul.kumar@civiq.gov.in",
    phone: "+91 98765 43212",
    employeeCode: "CIV1003",
    department: "Sanitation",
    designation: "Field Officer",
    district: "Chennai",
    status: "Active",
    complaints: 51,
    resolved: 43,
    pending: 6,
    overdue: 2,
    performance: 88,
    joined: "19 Jun 2024",
  },
  {
    id: 4,
    name: "Suresh B",
    email: "suresh.b@civiq.gov.in",
    phone: "+91 98765 43213",
    employeeCode: "CIV1004",
    department: "Water",
    designation: "Field Officer",
    district: "Chennai",
    status: "Active",
    complaints: 35,
    resolved: 29,
    pending: 5,
    overdue: 1,
    performance: 84,
    joined: "14 Sep 2024",
  },
  {
    id: 5,
    name: "Meena Devi",
    email: "meena.devi@civiq.gov.in",
    phone: "+91 98765 43214",
    employeeCode: "CIV1005",
    department: "Sanitation",
    designation: "Senior Officer",
    district: "Chennai",
    status: "Active",
    complaints: 46,
    resolved: 44,
    pending: 2,
    overdue: 0,
    performance: 97,
    joined: "21 Feb 2022",
  },
  {
    id: 6,
    name: "Kumaravel",
    email: "kumaravel@civiq.gov.in",
    phone: "+91 98765 43215",
    employeeCode: "CIV1006",
    department: "Electricity",
    designation: "Field Officer",
    district: "Chennai",
    status: "Inactive",
    complaints: 29,
    resolved: 22,
    pending: 5,
    overdue: 2,
    performance: 78,
    joined: "11 Nov 2023",
  },
  {
    id: 7,
    name: "Ravi Kumar",
    email: "ravi.kumar@civiq.gov.in",
    phone: "+91 98765 43216",
    employeeCode: "CIV1007",
    department: "Drainage",
    designation: "Field Officer",
    district: "Chennai",
    status: "Active",
    complaints: 41,
    resolved: 38,
    pending: 3,
    overdue: 0,
    performance: 94,
    joined: "05 Apr 2023",
  },
  {
    id: 8,
    name: "Divya R",
    email: "divya.r@civiq.gov.in",
    phone: "+91 98765 43217",
    employeeCode: "CIV1008",
    department: "Roads",
    designation: "Field Officer",
    district: "Chennai",
    status: "On Leave",
    complaints: 31,
    resolved: 27,
    pending: 3,
    overdue: 1,
    performance: 86,
    joined: "17 Jul 2024",
  },
];
*/

const OFFICER_STATUS = [
  "All",
  "Active",
  "Inactive",
  "On Leave",
];

export default function AdminOfficers() {
  const navigate = useNavigate();

  const [officers, setOfficers] = useState([]);

  const [search, setSearch] = useState("");
  const [department, setDepartment] =
    useState("All");

  const [status, setStatus] = useState("All");

  const [selectedOfficer, setSelectedOfficer] =
    useState(null);

  const [showFilters, setShowFilters] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] =
    useState(false);

  const loadOfficers = async () => {
    try {
      setLoading(true);

      const data = await adminRequest(`/admin/officers?limit=100`);
      setOfficers((data.officers || []).map((item) => ({ ...item, name: item.full_name || "", email: item.email || "", employeeCode: item.employee_code || "", department: item.department || "General", district: item.district || "", status: (item.status || "").replaceAll("_", " "), complaints: Number(item.complaints || 0), resolved: Number(item.resolved || 0), pending: Number(item.pending || 0), overdue: 0, performance: item.complaints ? Math.round((Number(item.resolved || 0) / Number(item.complaints)) * 100) : 0 })));
    } catch (error) {
      console.error(
        "Officer loading error:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOfficers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const refreshOfficers = async () => {
    setRefreshing(true);
    await loadOfficers();
    setRefreshing(false);
  };

  const departments = useMemo(() => {
    return [
      "All",
      ...new Set(
        officers.map(
          (officer) => officer.department
        )
      ),
    ];
  }, [officers]);

  const filteredOfficers = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return officers.filter((officer) => {
      const matchesSearch =
        !query ||
        officer.name
          .toLowerCase()
          .includes(query) ||
        officer.email
          .toLowerCase()
          .includes(query) ||
        officer.employeeCode
          .toLowerCase()
          .includes(query) ||
        officer.department
          .toLowerCase()
          .includes(query) ||
        officer.district
          .toLowerCase()
          .includes(query);

      const matchesDepartment =
        department === "All" ||
        officer.department === department;

      const matchesStatus =
        status === "All" ||
        officer.status === status;

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesStatus
      );
    });
  }, [
    officers,
    search,
    department,
    status,
  ]);

  const stats = {
    total: officers.length,

    active: officers.filter(
      (officer) =>
        officer.status === "Active"
    ).length,

    inactive: officers.filter(
      (officer) =>
        officer.status === "Inactive"
    ).length,

    leave: officers.filter(
      (officer) =>
        officer.status === "On Leave"
    ).length,

    complaints: officers.reduce(
      (sum, officer) =>
        sum + officer.complaints,
      0
    ),

    resolved: officers.reduce(
      (sum, officer) =>
        sum + officer.resolved,
      0
    ),

    overdue: officers.reduce(
      (sum, officer) =>
        sum + officer.overdue,
      0
    ),

    averagePerformance:
      officers.length
        ? Math.round(
            officers.reduce(
              (sum, officer) =>
                sum + officer.performance,
              0
            ) / officers.length
          )
        : 0,
  };

  const resetFilters = () => {
    setSearch("");
    setDepartment("All");
    setStatus("All");
  };

  const updateStatus = async (officer) => {
    const nextStatus = officer.status === "Active" ? "INACTIVE" : "ACTIVE";
    await adminRequest(`/admin/officers/${officer.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    const displayStatus = nextStatus === "ACTIVE" ? "Active" : "Inactive";
    setOfficers((current) => current.map((item) => item.id === officer.id ? { ...item, status: displayStatus } : item));
    setSelectedOfficer((current) => current && current.id === officer.id ? { ...current, status: displayStatus } : current);
  };

  const viewOfficer = async (officer) => {
    setSelectedOfficer(officer);
    try {
      const data = await adminRequest(`/admin/officers/${officer.id}`);
      const detail = data.officer || {};
      setSelectedOfficer((current) => current && current.id === officer.id ? { ...current, ...detail, name: detail.full_name || current.name, employeeCode: detail.employee_code || current.employeeCode, status: (detail.status || current.status).replaceAll("_", " ") } : current);
    } catch (error) {
      console.error("Officer details loading error:", error);
    }
  };

  return (
    <div className="admin-officers-page">

      {/* HEADER */}

      <header className="officers-header">

        <div className="header-left">

          <button
            className="back-button"
            onClick={() =>
              navigate("/admin/dashboard")
            }
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h1>Officers</h1>

            <p>
              Manage departments, workload and
              officer performance
            </p>
          </div>

        </div>

        <div className="header-actions">

          <button
            className="refresh-button"
            onClick={refreshOfficers}
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

            Refresh
          </button>

          <button
            className="dashboard-button"
            onClick={() =>
              navigate("/admin/dashboard")
            }
          >
            Dashboard
          </button>

        </div>

      </header>

      <main className="officers-content">

        {/* STATS */}

        <section className="officer-stats">

          <StatCard
            icon={<UserRound size={18} />}
            label="Total Officers"
            value={stats.total}
            type="blue"
          />

          <StatCard
            icon={<CheckCircle2 size={18} />}
            label="Active"
            value={stats.active}
            type="green"
          />

          <StatCard
            icon={<Clock3 size={18} />}
            label="On Leave"
            value={stats.leave}
            type="orange"
          />

          <StatCard
            icon={<BriefcaseBusiness size={18} />}
            label="Assigned Complaints"
            value={stats.complaints}
            type="purple"
          />

          <StatCard
            icon={<CheckCircle2 size={18} />}
            label="Resolved"
            value={stats.resolved}
            type="teal"
          />

          <StatCard
            icon={<AlertTriangle size={18} />}
            label="Overdue"
            value={stats.overdue}
            type="red"
          />

        </section>

        {/* PERFORMANCE OVERVIEW */}

        <section className="performance-banner">

          <div className="performance-icon">
            <CheckCircle2 size={21} />
          </div>

          <div className="performance-info">

            <span>
              Overall Officer Performance
            </span>

            <strong>
              {stats.averagePerformance}%
            </strong>

          </div>

          <div className="performance-progress">

            <div
              className="performance-progress-fill"
              style={{
                width: `${stats.averagePerformance}%`,
              }}
            />

          </div>

          <span className="performance-caption">
            Based on resolution efficiency
          </span>

        </section>

        {/* TOOLBAR */}

        <section className="officers-toolbar">

          <div className="search-wrapper">

            <Search size={16} />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search officer, employee ID, department..."
            />

            {search && (
              <button
                onClick={() =>
                  setSearch("")
                }
              >
                <X size={14} />
              </button>
            )}

          </div>

          <button
            className={`filter-button ${
              showFilters
                ? "active"
                : ""
            }`}
            onClick={() =>
              setShowFilters(!showFilters)
            }
          >
            <Filter size={15} />
            Filters
          </button>

          <span className="officer-count">
            {filteredOfficers.length} officers
          </span>

        </section>

        {/* FILTERS */}

        {showFilters && (
          <section className="filter-panel">

            <FilterField
              label="Department"
              value={department}
              onChange={setDepartment}
              options={departments}
            />

            <FilterField
              label="Status"
              value={status}
              onChange={setStatus}
              options={OFFICER_STATUS}
            />

            <button
              className="reset-button"
              onClick={resetFilters}
            >
              Reset Filters
            </button>

          </section>
        )}

        {/* TABLE */}

        <section className="officers-table-card">

          {loading ? (
            <div className="loading-state">

              <RefreshCw
                size={24}
                className="spin"
              />

              <p>
                Loading officers...
              </p>

            </div>
          ) : filteredOfficers.length ===
            0 ? (
            <div className="empty-state">

              <UserRound size={35} />

              <h3>
                No officers found
              </h3>

              <p>
                Try changing the search or
                filters.
              </p>

              <button
                onClick={resetFilters}
              >
                Clear Filters
              </button>

            </div>
          ) : (
            <div className="table-scroll">

              <table className="officers-table">

                <thead>

                  <tr>
                    <th>Officer</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Workload</th>
                    <th>Resolved</th>
                    <th>Performance</th>
                    <th>Action</th>
                  </tr>

                </thead>

                <tbody>

                  {filteredOfficers.map(
                    (officer) => (
                      <OfficerRow
                        key={officer.id}
                        officer={officer}
                        onView={() => void viewOfficer(officer)}
                      />
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

      </main>

      {/* DETAILS MODAL */}

      {selectedOfficer && (
        <OfficerModal
          officer={selectedOfficer}
          onToggleStatus={() => updateStatus(selectedOfficer)}
          onClose={() =>
            setSelectedOfficer(null)
          }
        />
      )}

    </div>
  );
}

/* =========================================================
   STAT CARD
   ========================================================= */

function StatCard({
  icon,
  label,
  value,
  type,
}) {
  return (
    <div className="stat-card">

      <div
        className={`stat-icon ${type}`}
      >
        {icon}
      </div>

      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>

    </div>
  );
}

/* =========================================================
   FILTER FIELD
   ========================================================= */

function FilterField({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <label className="filter-field">

      <span>{label}</span>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>

    </label>
  );
}

/* =========================================================
   OFFICER ROW
   ========================================================= */

function OfficerRow({
  officer,
  onView,
}) {
  return (
    <tr>

      <td>

        <div className="officer-profile">

          <div className="officer-avatar">
            {getInitials(officer.name)}
          </div>

          <div>

            <button
              className="officer-name"
              onClick={onView}
            >
              {officer.name}
            </button>

            <span className="employee-code">
              {officer.employeeCode}
            </span>

          </div>

        </div>

      </td>

      <td>

        <div className="department-cell">
          <Building2 size={14} />
          {officer.department}
        </div>

      </td>

      <td>
        <span className="designation">
          {officer.designation}
        </span>
      </td>

      <td>

        <div className="location-cell">

          <MapPin size={13} />

          {officer.district}

        </div>

      </td>

      <td>

        <span
          className={`officer-status ${statusClass(
            officer.status
          )}`}
        >
          <span />
          {officer.status}
        </span>

      </td>

      <td>

        <div className="workload-cell">

          <strong>
            {officer.complaints}
          </strong>

          <span>
            {officer.pending} pending
          </span>

        </div>

      </td>

      <td>

        <div className="resolved-cell">

          <strong>
            {officer.resolved}
          </strong>

          <span>
            {Math.round(
              (officer.resolved /
                officer.complaints) *
                100
            )}
            %
          </span>

        </div>

      </td>

      <td>

        <div className="performance-cell">

          <div className="performance-value">
            <strong>
              {officer.performance}%
            </strong>
          </div>

          <div className="mini-progress">
            <div
              style={{
                width: `${officer.performance}%`,
              }}
            />
          </div>

        </div>

      </td>

      <td>

        <button
          className="view-officer"
          onClick={onView}
          title="View officer"
        >
          <Eye size={15} />
        </button>

      </td>

    </tr>
  );
}

/* =========================================================
   OFFICER MODAL
   ========================================================= */

function OfficerModal({
  officer,
  onClose,
  onToggleStatus,
}) {
  const resolutionRate = Math.round(
    (officer.resolved /
      officer.complaints) *
      100
  );

  return (
    <div
      className="modal-overlay"
      onMouseDown={onClose}
    >

      <div
        className="officer-modal"
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >

        {/* HEADER */}

        <div className="modal-header">

          <div className="modal-officer-title">

            <div className="large-avatar">
              {getInitials(
                officer.name
              )}
            </div>

            <div>

              <span>
                OFFICER PROFILE
              </span>

              <h2>
                {officer.name}
              </h2>

              <p>
                {officer.employeeCode}
              </p>

            </div>

          </div>

          <button
            className="close-modal"
            onClick={onClose}
          >
            <X size={19} />
          </button>

        </div>

        {/* BODY */}

        <div className="modal-content">

          {/* STATUS */}

          <div className="modal-status">

            <span
              className={`officer-status ${statusClass(
                officer.status
              )}`}
            >
              <span />
              {officer.status}
            </span>

            <span className="modal-department">
              {officer.department}
            </span>

            <button type="button" className="modal-action-button" onClick={onToggleStatus}>
              {officer.status === "Active" ? "Deactivate" : "Activate"}
            </button>

          </div>

          {/* CONTACT */}

          <div className="modal-section">

            <h3>
              Contact Information
            </h3>

            <div className="contact-grid">

              <ContactItem
                icon={<Mail size={15} />}
                label="Email"
                value={officer.email}
              />

              <ContactItem
                icon={<Phone size={15} />}
                label="Phone"
                value={officer.phone}
              />

              <ContactItem
                icon={<MapPin size={15} />}
                label="District"
                value={officer.district}
              />

              <ContactItem
                icon={
                  <BriefcaseBusiness
                    size={15}
                  />
                }
                label="Designation"
                value={
                  officer.designation
                }
              />

            </div>

          </div>

          {/* PERFORMANCE */}

          <div className="modal-section">

            <h3>
              Performance Overview
            </h3>

            <div className="modal-metrics">

              <Metric
                label="Total Assigned"
                value={
                  officer.complaints
                }
              />

              <Metric
                label="Resolved"
                value={
                  officer.resolved
                }
              />

              <Metric
                label="Pending"
                value={
                  officer.pending
                }
              />

              <Metric
                label="Overdue"
                value={
                  officer.overdue
                }
              />

            </div>

            <div className="large-performance">

              <div className="large-performance-header">

                <span>
                  Resolution Rate
                </span>

                <strong>
                  {resolutionRate}%
                </strong>

              </div>

              <div className="large-progress">

                <div
                  style={{
                    width: `${resolutionRate}%`,
                  }}
                />

              </div>

            </div>

            <div className="large-performance">

              <div className="large-performance-header">

                <span>
                  AI Performance Score
                </span>

                <strong>
                  {officer.performance}%
                </strong>

              </div>

              <div className="large-progress">

                <div
                  style={{
                    width: `${officer.performance}%`,
                  }}
                />

              </div>

            </div>

          </div>

          {/* EMPLOYEE */}

          <div className="modal-section">

            <h3>
              Employment
            </h3>

            <div className="employment-info">

              <div>
                <span>
                  Employee Code
                </span>

                <strong>
                  {officer.employeeCode}
                </strong>
              </div>

              <div>
                <span>
                  Joined
                </span>

                <strong>
                  {officer.joined}
                </strong>
              </div>

              <div>
                <span>
                  Department
                </span>

                <strong>
                  {officer.department}
                </strong>
              </div>

            </div>

          </div>

        </div>

        {/* FOOTER */}

        <div className="modal-footer">

          <button
            className="close-button"
            onClick={onClose}
          >
            Close
          </button>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   CONTACT ITEM
   ========================================================= */

function ContactItem({
  icon,
  label,
  value,
}) {
  return (
    <div className="contact-item">

      <div className="contact-icon">
        {icon}
      </div>

      <div>

        <span>{label}</span>

        <strong>{value}</strong>

      </div>

    </div>
  );
}

/* =========================================================
   METRIC
   ========================================================= */

function Metric({
  label,
  value,
}) {
  return (
    <div className="metric">

      <strong>{value}</strong>

      <span>{label}</span>

    </div>
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function statusClass(status) {
  if (status === "Active") return "active";
  if (status === "Inactive") return "inactive";
  return "leave";
}