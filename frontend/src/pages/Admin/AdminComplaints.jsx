import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import "./AdminComplaints.css";
import { adminRequest } from "../../services/adminApi";

/*
const DEMO_COMPLAINTS = [
  {
    id: "CMP10231",
    citizen: "Karthik Raj",
    category: "Road Damage",
    description:
      "Large pothole causing difficulty for vehicles and creating a safety risk.",
    location: "Anna Nagar, Chennai",
    district: "Chennai",
    priority: "High",
    status: "Pending",
    officer: "Arun Kumar",
    department: "Roads",
    createdAt: "20 Aug 2026, 09:42 AM",
    aiScore: 92,
    fraudScore: 8,
    aiStatus: "Verified",
  },
  {
    id: "CMP10230",
    citizen: "Priya S",
    category: "Street Light",
    description:
      "Street light has not been working for the last three days.",
    location: "T Nagar, Chennai",
    district: "Chennai",
    priority: "Medium",
    status: "In Progress",
    officer: "Priya Devi",
    department: "Electricity",
    createdAt: "20 Aug 2026, 08:31 AM",
    aiScore: 97,
    fraudScore: 3,
    aiStatus: "Verified",
  },
  {
    id: "CMP10229",
    citizen: "Manoj Kumar",
    category: "Garbage",
    description:
      "Garbage has not been collected from the residential area.",
    location: "Velachery, Chennai",
    district: "Chennai",
    priority: "Low",
    status: "Resolved",
    officer: "Rahul Kumar",
    department: "Sanitation",
    createdAt: "19 Aug 2026, 06:22 PM",
    aiScore: 99,
    fraudScore: 1,
    aiStatus: "Verified",
  },
  {
    id: "CMP10228",
    citizen: "Suresh B",
    category: "Water Leakage",
    description:
      "Water pipe leakage is causing water to accumulate on the road.",
    location: "Adyar, Chennai",
    district: "Chennai",
    priority: "High",
    status: "In Progress",
    officer: "Suresh B",
    department: "Water",
    createdAt: "19 Aug 2026, 04:15 PM",
    aiScore: 88,
    fraudScore: 12,
    aiStatus: "Verified",
  },
  {
    id: "CMP10227",
    citizen: "Divya R",
    category: "Drainage",
    description:
      "Blocked drainage is causing stagnant water near houses.",
    location: "Guindy, Chennai",
    district: "Chennai",
    priority: "Medium",
    status: "Pending",
    officer: "Unassigned",
    department: "Drainage",
    createdAt: "19 Aug 2026, 03:02 PM",
    aiScore: 91,
    fraudScore: 9,
    aiStatus: "Verified",
  },
  {
    id: "CMP10226",
    citizen: "Vignesh M",
    category: "Road Damage",
    description:
      "Road surface is damaged after recent rainfall.",
    location: "Mylapore, Chennai",
    district: "Chennai",
    priority: "High",
    status: "Pending",
    officer: "Unassigned",
    department: "Roads",
    createdAt: "19 Aug 2026, 01:47 PM",
    aiScore: 64,
    fraudScore: 71,
    aiStatus: "Suspicious",
  },
  {
    id: "CMP10225",
    citizen: "Anitha P",
    category: "Garbage",
    description:
      "Waste is overflowing from the public garbage collection point.",
    location: "Tambaram, Chennai",
    district: "Chennai",
    priority: "Medium",
    status: "Resolved",
    officer: "Meena Devi",
    department: "Sanitation",
    createdAt: "19 Aug 2026, 12:26 PM",
    aiScore: 96,
    fraudScore: 4,
    aiStatus: "Verified",
  },
  {
    id: "CMP10224",
    citizen: "Aravind K",
    category: "Street Light",
    description:
      "Multiple street lights are not functioning in the locality.",
    location: "Nungambakkam, Chennai",
    district: "Chennai",
    priority: "Medium",
    status: "In Progress",
    officer: "Kumaravel",
    department: "Electricity",
    createdAt: "19 Aug 2026, 10:11 AM",
    aiScore: 95,
    fraudScore: 5,
    aiStatus: "Verified",
  },
  {
    id: "CMP10223",
    citizen: "Hari S",
    category: "Water Leakage",
    description:
      "Major water leakage reported near the main road.",
    location: "Perambur, Chennai",
    district: "Chennai",
    priority: "High",
    status: "Pending",
    officer: "Unassigned",
    department: "Water",
    createdAt: "19 Aug 2026, 09:25 AM",
    aiScore: 59,
    fraudScore: 83,
    aiStatus: "Suspicious",
  },
  {
    id: "CMP10222",
    citizen: "Lakshmi V",
    category: "Drainage",
    description:
      "Drainage overflow during rainfall.",
    location: "Sholinganallur, Chennai",
    district: "Chennai",
    priority: "High",
    status: "Resolved",
    officer: "Ravi Kumar",
    department: "Drainage",
    createdAt: "18 Aug 2026, 07:32 PM",
    aiScore: 98,
    fraudScore: 2,
    aiStatus: "Verified",
  },
];
*/

const OFFICERS = [
  "Arun Kumar",
  "Priya Devi",
  "Rahul Kumar",
  "Suresh B",
  "Meena Devi",
  "Kumaravel",
  "Ravi Kumar",
];

export default function AdminComplaints() {
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [aiFilter, setAiFilter] = useState("All");

  const [selectedComplaint, setSelectedComplaint] =
    useState(null);

  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);

  const ITEMS_PER_PAGE = 8;

  const loadComplaints = async () => {
    try {
      setLoading(true);

      const data = await adminRequest(`/admin/complaints?limit=100`);
      setComplaints((data.complaints || []).map((item) => ({ ...item, id: String(item.id), citizen: item.citizen || "", category: item.category || "General", location: item.address || "Unknown", officer: item.officer_name || "Unassigned", status: (item.status || "").replaceAll("_", " "), priority: item.priority || "MEDIUM", aiStatus: "Unknown" })));
    } catch (error) {
      console.error(
        "Complaint loading error:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadComplaints();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const refreshComplaints = async () => {
    setRefreshing(true);

    await loadComplaints();

    setRefreshing(false);
  };

  const categories = useMemo(() => {
    return [
      "All",
      ...new Set(
        complaints.map((complaint) => complaint.category)
      ),
    ];
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    const query = search.trim().toLowerCase();

    return complaints.filter((complaint) => {
      const matchesSearch =
        !query ||
        complaint.id.toLowerCase().includes(query) ||
        complaint.citizen.toLowerCase().includes(query) ||
        complaint.category.toLowerCase().includes(query) ||
        complaint.location.toLowerCase().includes(query) ||
        complaint.officer.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        complaint.status === statusFilter;

      const matchesPriority =
        priorityFilter === "All" ||
        complaint.priority === priorityFilter;

      const matchesCategory =
        categoryFilter === "All" ||
        complaint.category === categoryFilter;

      const matchesAI =
        aiFilter === "All" ||
        complaint.aiStatus === aiFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory &&
        matchesAI
      );
    });
  }, [
    complaints,
    search,
    statusFilter,
    priorityFilter,
    categoryFilter,
    aiFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredComplaints.length / ITEMS_PER_PAGE
    )
  );

  const visibleComplaints = filteredComplaints.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setPriorityFilter("All");
    setCategoryFilter("All");
    setAiFilter("All");
  };

  const updateStatus = async (id, status) => {
    await adminRequest(`/admin/complaints/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    setComplaints((current) =>
      current.map((complaint) =>
        complaint.id === id
          ? { ...complaint, status }
          : complaint
      )
    );

    setSelectedComplaint((current) =>
      current?.id === id
        ? { ...current, status }
        : current
    );
  };

  const assignOfficer = (id, officer) => {
    setComplaints((current) =>
      current.map((complaint) =>
        complaint.id === id
          ? {
              ...complaint,
              officer,
              status:
                officer !== "Unassigned" &&
                complaint.status === "Pending"
                  ? "In Progress"
                  : complaint.status,
            }
          : complaint
      )
    );

    setSelectedComplaint((current) =>
      current?.id === id
        ? {
            ...current,
            officer,
            status:
              officer !== "Unassigned" &&
              current.status === "Pending"
                ? "In Progress"
                : current.status,
          }
        : current
    );
  };

  const stats = {
    total: complaints.length,
    pending: complaints.filter(
      (c) => c.status === "Pending"
    ).length,
    progress: complaints.filter(
      (c) => c.status === "In Progress"
    ).length,
    resolved: complaints.filter(
      (c) => c.status === "Resolved"
    ).length,
    high: complaints.filter(
      (c) => c.priority === "High"
    ).length,
    suspicious: complaints.filter(
      (c) => c.aiStatus === "Suspicious"
    ).length,
  };

  return (
    <div className="admin-complaints-page">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="complaints-header">

        <div className="header-title-area">

          <button
            className="back-button"
            onClick={() =>
              navigate("/admin/dashboard")
            }
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h1>Complaints</h1>

            <p>
              Manage, monitor and assign civic complaints
            </p>
          </div>

        </div>

        <div className="header-actions">

          <button
            className="refresh-btn"
            onClick={refreshComplaints}
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing ? "refresh-spin" : ""
              }
            />

            <span>Refresh</span>
          </button>

          <button
            className="dashboard-btn"
            onClick={() =>
              navigate("/admin/dashboard")
            }
          >
            Dashboard
          </button>

        </div>

      </header>

      {/* =====================================================
          CONTENT
          ===================================================== */}

      <main className="complaints-content">

        {/* ===================================================
            SUMMARY CARDS
            =================================================== */}

        <section className="complaint-summary">

          <SummaryCard
            label="Total Complaints"
            value={stats.total}
            icon={<CheckCircle2 size={19} />}
            type="blue"
          />

          <SummaryCard
            label="Pending"
            value={stats.pending}
            icon={<Clock3 size={19} />}
            type="orange"
          />

          <SummaryCard
            label="In Progress"
            value={stats.progress}
            icon={<RefreshCw size={19} />}
            type="purple"
          />

          <SummaryCard
            label="Resolved"
            value={stats.resolved}
            icon={<CheckCircle2 size={19} />}
            type="green"
          />

          <SummaryCard
            label="High Priority"
            value={stats.high}
            icon={<AlertTriangle size={19} />}
            type="red"
          />

          <SummaryCard
            label="AI Suspicious"
            value={stats.suspicious}
            icon={<ShieldAlert size={19} />}
            type="dark"
          />

        </section>

        {/* ===================================================
            FILTER TOOLBAR
            =================================================== */}

        <section className="complaints-toolbar">

          <div className="search-box">

            <Search size={17} />

            <input
              type="text"
              placeholder="Search complaint ID, citizen, location..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

            {search && (
              <button
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            )}

          </div>

          <button
            className={`filter-toggle ${
              showFilters ? "active" : ""
            }`}
            onClick={() =>
              setShowFilters(!showFilters)
            }
          >
            <Filter size={16} />
            Filters

            {(statusFilter !== "All" ||
              priorityFilter !== "All" ||
              categoryFilter !== "All" ||
              aiFilter !== "All") && (
              <span className="filter-count">
                {
                  [
                    statusFilter !== "All",
                    priorityFilter !== "All",
                    categoryFilter !== "All",
                    aiFilter !== "All",
                  ].filter(Boolean).length
                }
              </span>
            )}
          </button>

          <div className="result-count">
            {filteredComplaints.length} complaints
          </div>

        </section>

        {/* ===================================================
            FILTER PANEL
            =================================================== */}

        {showFilters && (
          <section className="filter-panel">

            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                "All",
                "Pending",
                "In Progress",
                "Resolved",
                "Rejected",
              ]}
            />

            <FilterSelect
              label="Priority"
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                "All",
                "High",
                "Medium",
                "Low",
              ]}
            />

            <FilterSelect
              label="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categories}
            />

            <FilterSelect
              label="AI Verification"
              value={aiFilter}
              onChange={setAiFilter}
              options={[
                "All",
                "Verified",
                "Suspicious",
              ]}
            />

            <button
              className="reset-filter"
              onClick={resetFilters}
            >
              Reset filters
            </button>

          </section>
        )}

        {/* ===================================================
            TABLE
            =================================================== */}

        <section className="complaints-table-card">

          {loading ? (
            <div className="table-loading">

              <RefreshCw
                size={25}
                className="refresh-spin"
              />

              <p>Loading complaints...</p>

            </div>
          ) : visibleComplaints.length === 0 ? (
            <div className="empty-state">

              <Search size={34} />

              <h3>No complaints found</h3>

              <p>
                Try changing your search or filters.
              </p>

              <button onClick={resetFilters}>
                Clear filters
              </button>

            </div>
          ) : (
            <div className="table-scroll">

              <table className="complaints-table">

                <thead>

                  <tr>
                    <th>Complaint</th>
                    <th>Citizen</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Priority</th>
                    <th>Officer</th>
                    <th>Status</th>
                    <th>AI</th>
                    <th>Action</th>
                  </tr>

                </thead>

                <tbody>

                  {visibleComplaints.map(
                    (complaint) => (
                      <ComplaintRow
                        key={complaint.id}
                        complaint={complaint}
                        onView={() =>
                          setSelectedComplaint(
                            complaint
                          )
                        }
                      />
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

          {/* =================================================
              PAGINATION
              ================================================= */}

          {filteredComplaints.length > 0 && (
            <div className="pagination">

              <span>
                Showing{" "}
                <strong>
                  {(page - 1) *
                    ITEMS_PER_PAGE +
                    1}
                </strong>{" "}
                to{" "}
                <strong>
                  {Math.min(
                    page * ITEMS_PER_PAGE,
                    filteredComplaints.length
                  )}
                </strong>{" "}
                of{" "}
                <strong>
                  {filteredComplaints.length}
                </strong>
              </span>

              <div className="pagination-buttons">

                <button
                  disabled={page === 1}
                  onClick={() =>
                    setPage((p) =>
                      Math.max(1, p - 1)
                    )
                  }
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, i) => i + 1
                )
                  .slice(
                    Math.max(0, page - 3),
                    Math.min(totalPages, page + 2)
                  )
                  .map((number) => (
                    <button
                      key={number}
                      className={
                        page === number
                          ? "current"
                          : ""
                      }
                      onClick={() =>
                        setPage(number)
                      }
                    >
                      {number}
                    </button>
                  ))}

                <button
                  disabled={page === totalPages}
                  onClick={() =>
                    setPage((p) =>
                      Math.min(
                        totalPages,
                        p + 1
                      )
                    )
                  }
                >
                  <ChevronRight size={16} />
                </button>

              </div>

            </div>
          )}

        </section>

      </main>

      {/* =====================================================
          DETAILS MODAL
          ===================================================== */}

      {selectedComplaint && (
        <ComplaintDetailsModal
          complaint={selectedComplaint}
          onClose={() =>
            setSelectedComplaint(null)
          }
          onStatusChange={updateStatus}
          onOfficerChange={assignOfficer}
        />
      )}

    </div>
  );
}

/* =========================================================
   SUMMARY CARD
   ========================================================= */

function SummaryCard({
  label,
  value,
  icon,
  type,
}) {
  return (
    <div className="summary-card">

      <div className={`summary-icon ${type}`}>
        {icon}
      </div>

      <div>
        <strong>
          {value.toLocaleString()}
        </strong>

        <span>{label}</span>
      </div>

    </div>
  );
}

/* =========================================================
   FILTER SELECT
   ========================================================= */

function FilterSelect({
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
   TABLE ROW
   ========================================================= */

function ComplaintRow({
  complaint,
  onView,
}) {
  return (
    <tr>

      <td>

        <button
          className="complaint-id-link"
          onClick={onView}
        >
          {complaint.id}
        </button>

        <span className="complaint-date">
          {complaint.createdAt}
        </span>

      </td>

      <td>

        <div className="citizen-cell">

          <div className="citizen-avatar">
            {getInitials(complaint.citizen)}
          </div>

          <span>{complaint.citizen}</span>

        </div>

      </td>

      <td>
        <span className="category-name">
          {complaint.category}
        </span>
      </td>

      <td>

        <div className="location-cell">

          <MapPin size={14} />

          <span>{complaint.location}</span>

        </div>

      </td>

      <td>

        <span
          className={`priority ${
            complaint.priority.toLowerCase()
          }`}
        >
          <span />
          {complaint.priority}
        </span>

      </td>

      <td>

        {complaint.officer === "Unassigned" ? (
          <span className="unassigned-officer">
            Unassigned
          </span>
        ) : (
          <div className="officer-cell">
            <UserRound size={14} />
            {complaint.officer}
          </div>
        )}

      </td>

      <td>

        <span
          className={`complaint-status ${
            complaint.status
              .toLowerCase()
              .replace(" ", "-")
          }`}
        >
          {complaint.status}
        </span>

      </td>

      <td>

        <div
          className={`ai-score ${
            complaint.aiStatus === "Suspicious"
              ? "suspicious"
              : complaint.aiScore >= 95
              ? "excellent"
              : "verified"
          }`}
        >
          {complaint.aiStatus ===
          "Suspicious" ? (
            <ShieldAlert size={13} />
          ) : (
            <Bot size={13} />
          )}

          {complaint.aiScore}%
        </div>

      </td>

      <td>

        <button
          className="view-button"
          onClick={onView}
          title="View complaint"
        >
          <Eye size={16} />
        </button>

      </td>

    </tr>
  );
}

/* =========================================================
   DETAILS MODAL
   ========================================================= */

function ComplaintDetailsModal({
  complaint,
  onClose,
  onStatusChange,
  onOfficerChange,
}) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={onClose}
    >

      <div
        className="complaint-modal"
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >

        {/* Modal header */}

        <div className="modal-header">

          <div>

            <span className="modal-label">
              COMPLAINT DETAILS
            </span>

            <h2>{complaint.id}</h2>

          </div>

          <button
            className="modal-close"
            onClick={onClose}
          >
            <X size={20} />
          </button>

        </div>

        {/* Status strip */}

        <div className="modal-status-strip">

          <div>

            <span>Current Status</span>

            <strong>
              {complaint.status}
            </strong>

          </div>

          <div>

            <span>Priority</span>

            <strong
              className={`modal-priority ${complaint.priority.toLowerCase()}`}
            >
              {complaint.priority}
            </strong>

          </div>

          <div>

            <span>AI Verification</span>

            <strong>
              {complaint.aiScore}%
            </strong>

          </div>

        </div>

        {/* Modal body */}

        <div className="modal-body">

          {/* Citizen */}

          <div className="detail-section">

            <h3>
              <UserRound size={16} />
              Citizen Information
            </h3>

            <div className="detail-grid">

              <DetailItem
                label="Name"
                value={complaint.citizen}
              />

              <DetailItem
                label="Complaint ID"
                value={complaint.id}
              />

            </div>

          </div>

          {/* Complaint */}

          <div className="detail-section">

            <h3>
              <AlertTriangle size={16} />
              Complaint Information
            </h3>

            <div className="detail-grid">

              <DetailItem
                label="Category"
                value={complaint.category}
              />

              <DetailItem
                label="Department"
                value={complaint.department}
              />

              <DetailItem
                label="Location"
                value={complaint.location}
              />

              <DetailItem
                label="Submitted"
                value={complaint.createdAt}
              />

            </div>

            <div className="description-box">

              <span>Description</span>

              <p>
                {complaint.description}
              </p>

            </div>

          </div>

          {/* AI */}

          <div className="detail-section">

            <h3>
              <Bot size={16} />
              AI Verification
            </h3>

            <div className="ai-detail-grid">

              <div className="ai-detail-item">

                <div className="ai-detail-icon verified">
                  <ShieldCheck size={17} />
                </div>

                <div>
                  <span>Authenticity Score</span>
                  <strong>
                    {complaint.aiScore}%
                  </strong>
                </div>

              </div>

              <div className="ai-detail-item">

                <div className="ai-detail-icon fraud">
                  <ShieldAlert size={17} />
                </div>

                <div>
                  <span>Fraud Risk</span>
                  <strong>
                    {complaint.fraudScore}%
                  </strong>
                </div>

              </div>

            </div>

            {complaint.aiStatus ===
              "Suspicious" && (
              <div className="fraud-warning">

                <ShieldAlert size={18} />

                <div>
                  <strong>
                    AI flagged this complaint
                  </strong>

                  <p>
                    The complaint has a high
                    fraud-risk score and should
                    be manually reviewed.
                  </p>
                </div>

              </div>
            )}

          </div>

          {/* Assignment */}

          <div className="detail-section">

            <h3>
              <UserRound size={16} />
              Officer Assignment
            </h3>

            <div className="assignment-controls">

              <label>
                Assigned Officer
              </label>

              <select
                value={complaint.officer}
                onChange={(e) =>
                  onOfficerChange(
                    complaint.id,
                    e.target.value
                  )
                }
              >

                <option value="Unassigned">
                  Unassigned
                </option>

                {OFFICERS.map((officer) => (
                  <option
                    key={officer}
                    value={officer}
                  >
                    {officer}
                  </option>
                ))}

              </select>

            </div>

          </div>

          {/* Status */}

          <div className="detail-section">

            <h3>
              <Clock3 size={16} />
              Update Status
            </h3>

            <div className="status-buttons">

              {[
                "Pending",
                "In Progress",
                "Resolved",
                "Rejected",
              ].map((status) => (
                <button
                  key={status}
                  className={
                    complaint.status === status
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    onStatusChange(
                      complaint.id,
                      status
                    )
                  }
                >
                  {status}
                </button>
              ))}

            </div>

          </div>

        </div>

        {/* Footer */}

        <div className="modal-footer">

          <button
            className="modal-cancel"
            onClick={onClose}
          >
            Close
          </button>

          <button
            className="modal-save"
            onClick={onClose}
          >
            Save Changes
          </button>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   DETAIL ITEM
   ========================================================= */

function DetailItem({
  label,
  value,
}) {
  return (
    <div className="detail-item">

      <span>{label}</span>

      <strong>{value}</strong>

    </div>
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function getInitials(name) {
  if (!name) return "NA";

  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}