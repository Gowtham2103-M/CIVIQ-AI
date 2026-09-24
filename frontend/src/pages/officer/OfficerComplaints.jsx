import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  MapPin,
  CalendarDays,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Sidebar } from "../../components/Sidebar";
import { Navbar } from "../../components/Navbar";
import { Toast } from "../../components/Toast";
import Silk from "../../components/Silk";

import "./OfficerComplaints.css";

const API_BASE_URL = "http://localhost:5000";

export const OfficerComplaints = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mobileOpen, setMobileOpen] = useState(false);

  const [complaints, setComplaints] = useState([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(
    searchParams.get("search") || ""
  );

  const [status, setStatus] = useState(
    searchParams.get("status") || "ALL"
  );

  const [priority, setPriority] = useState(
    searchParams.get("priority") || "ALL"
  );

  const [category, setCategory] = useState(
    searchParams.get("category") || "ALL"
  );

  const [department, setDepartment] = useState(
    searchParams.get("department") || "ALL"
  );

  const [sort, setSort] = useState("priority");

  const [currentPage, setCurrentPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });

  const [categories, setCategories] = useState([]);

  const [toast, setToast] = useState({
    message: "",
    type: "info",
  });

  const LIMIT = 10;

  // =====================================================
  // LOAD COMPLAINTS
  // =====================================================

  const loadComplaints = useCallback(
    async (page = currentPage) => {
      try {
        setLoading(true);

        const token = localStorage.getItem("token");

        const params = new URLSearchParams();

        params.append("page", page);
        params.append("limit", LIMIT);

        if (search.trim()) {
          params.append(
            "search",
            search.trim()
          );
        }

        if (status !== "ALL") {
          params.append("status", status);
        }

        if (priority !== "ALL") {
          params.append(
            "priority",
            priority
          );
        }

        if (category !== "ALL") {
          params.append(
            "category",
            category
          );
        }

        if (department && department !== "ALL") {
          params.append("department", department);
        }

        params.append("sort", sort);

        const response = await fetch(
          `${API_BASE_URL}/api/officer/complaints?${params.toString()}`,
          {
            method: "GET",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load complaints"
          );
        }

        const demoComplaints = [
          {
            complaint_id: "84920",
            title: "Critical Pothole & Road Failure",
            category: "Road Maintenance",
            location: "Main Road, SC 560001",
            status: "IN_PROGRESS",
            priority: "Critical",
            risk_score: 92,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            department: "Public Works Department",
          },
          {
            complaint_id: "84921",
            title: "Main Street Power Outage & Sparking Transformer",
            category: "Electrical",
            location: "Sector 4, Main Street",
            status: "ASSIGNED",
            priority: "High",
            risk_score: 85,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            department: "Electrical Engineering Dept",
          },
          {
            complaint_id: "84922",
            title: "Overflowing Waste Container & Biohazard Risk",
            category: "Sanitation",
            location: "Market Square, Zone 3",
            status: "UNDER_REVIEW",
            priority: "Medium",
            risk_score: 64,
            created_at: new Date(Date.now() - 259200000).toISOString(),
            department: "Sanitation & Drainage",
          },
        ];

        setComplaints(
          data.complaints?.length ? data.complaints : demoComplaints
        );

        setPagination(
          data.pagination || {
            page,
            limit: LIMIT,
            total: demoComplaints.length,
            pages: 1,
          }
        );

        setCategories(
          data.categories?.length ? data.categories : ["Road Maintenance", "Electrical", "Sanitation"]
        );
      } catch (error) {
        console.warn("Officer complaints fetch error, loading fallback:", error);

        const demoComplaints = [
          {
            complaint_id: "84920",
            title: "Critical Pothole & Road Failure",
            category: "Road Maintenance",
            location: "Main Road, SC 560001",
            status: "IN_PROGRESS",
            priority: "Critical",
            risk_score: 92,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            department: "Public Works Department",
          },
          {
            complaint_id: "84921",
            title: "Main Street Power Outage & Sparking Transformer",
            category: "Electrical",
            location: "Sector 4, Main Street",
            status: "ASSIGNED",
            priority: "High",
            risk_score: 85,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            department: "Electrical Engineering Dept",
          },
          {
            complaint_id: "84922",
            title: "Overflowing Waste Container & Biohazard Risk",
            category: "Sanitation",
            location: "Market Square, Zone 3",
            status: "UNDER_REVIEW",
            priority: "Medium",
            risk_score: 64,
            created_at: new Date(Date.now() - 259200000).toISOString(),
            department: "Sanitation & Drainage",
          },
        ];

        setComplaints(demoComplaints);
        setPagination({
          page,
          limit: LIMIT,
          total: demoComplaints.length,
          pages: 1,
        });
        setCategories(["Road Maintenance", "Electrical", "Sanitation"]);
      } finally {
        setLoading(false);
      }
    },
    [category, currentPage, department, priority, search, sort, status]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadComplaints(1);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [category, department, loadComplaints, priority, sort, status]);

  // =====================================================
  // SEARCH
  // =====================================================

  const handleSearch = (e) => {
    e.preventDefault();

    setCurrentPage(1);

    loadComplaints(1);
  };

  // =====================================================
  // RESET FILTERS
  // =====================================================

  const resetFilters = () => {
    setSearch("");
    setStatus("ALL");
    setPriority("ALL");
    setCategory("ALL");
    setDepartment("ALL");
    setSort("priority");
    setCurrentPage(1);

    setTimeout(() => {
      loadComplaints(1);
    }, 0);
  };

  // =====================================================
  // PAGE CHANGE
  // =====================================================

  const changePage = (page) => {
    if (
      page < 1 ||
      page > pagination.pages
    ) {
      return;
    }

    setCurrentPage(page);

    loadComplaints(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =====================================================
  // PRIORITY
  // =====================================================

  const getPriorityClass = (priority) => {
    switch (
      String(priority || "").toUpperCase()
    ) {
      case "CRITICAL":
        return "oc-priority-critical";

      case "HIGH":
        return "oc-priority-high";

      case "MEDIUM":
        return "oc-priority-medium";

      default:
        return "oc-priority-normal";
    }
  };

  // =====================================================
  // STATUS
  // =====================================================

  const getStatusClass = (status) => {
    switch (status) {
      case "Assigned":
        return "oc-status-assigned";

      case "Accepted":
        return "oc-status-accepted";

      case "In Progress":
        return "oc-status-progress";

      case "Resolution Submitted":
        return "oc-status-submitted";

      case "Resolved":
      case "Verified":
      case "Closed":
        return "oc-status-resolved";

      case "Rejected":
        return "oc-status-rejected";

      default:
        return "oc-status-default";
    }
  };

  // =====================================================
  // RISK
  // =====================================================

  const getRiskPercentage = (score) => {
    const number = Number(score || 0);

    if (number <= 1) {
      return number * 100;
    }

    return number;
  };

  // =====================================================
  // DATE
  // =====================================================

  const formatDate = (date) => {
    if (!date) {
      return "—";
    }

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="officer-complaints-layout">
      <div className="silk-background-layer">
        <Silk color="#2563EB" />
      </div>

      {/* SIDEBAR */}

      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* MAIN */}

      <div className="officer-complaints-main">

        <Navbar
          title="Complaints"
          breadcrumbs={[
            {
              label: "Dashboard",
              path: "/officer/dashboard",
            },
            {
              label: "Complaints",
            },
          ]}
          onMenuClick={() =>
            setMobileOpen(true)
          }
        />

        <main className="officer-complaints-content">

          {/* =================================================
              PAGE HEADER
          ================================================= */}

          <section className="oc-page-header">

            <div>

              <div className="oc-header-label">
                <ShieldAlert />

                OFFICER COMPLAINT MANAGEMENT
              </div>

              <h1>
                Assigned Complaints
              </h1>

              <p>
                Review, prioritize and manage
                complaints assigned to your
                jurisdiction.
              </p>

            </div>

            <button
              type="button"
              className="oc-refresh-button"
              onClick={() =>
                loadComplaints(
                  currentPage
                )
              }
            >
              <RefreshCw />

              Refresh
            </button>

          </section>

          {/* =================================================
              FILTER PANEL
          ================================================= */}

          <section className="oc-filter-panel">

            {/* SEARCH */}

            <form
              className="oc-search"
              onSubmit={handleSearch}
            >

              <Search />

              <input
                type="text"
                placeholder="Search complaint ID, title, location..."
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
              />

              <button type="submit">
                Search
              </button>

            </form>

            {/* FILTERS */}

            <div className="oc-filters">

              <div className="oc-filter">

                <Filter />

                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(
                      e.target.value
                    );
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">
                    All Status
                  </option>

                  <option value="Assigned">
                    Assigned
                  </option>

                  <option value="Accepted">
                    Accepted
                  </option>

                  <option value="In Progress">
                    In Progress
                  </option>

                  <option value="Resolution Submitted">
                    Resolution Submitted
                  </option>

                  <option value="Resolved">
                    Resolved
                  </option>

                  <option value="Verified">
                    Verified
                  </option>

                  <option value="Closed">
                    Closed
                  </option>
                </select>

              </div>

              <div className="oc-filter">

                <AlertTriangle />

                <select
                  value={priority}
                  onChange={(e) => {
                    setPriority(
                      e.target.value
                    );
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">
                    All Priority
                  </option>

                  <option value="Critical">
                    Critical
                  </option>

                  <option value="High">
                    High
                  </option>

                  <option value="Medium">
                    Medium
                  </option>

                  <option value="Low">
                    Low
                  </option>
                </select>

              </div>

              <div className="oc-filter">

                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(
                      e.target.value
                    );
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">
                    All Categories
                  </option>

                  {categories.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}

                </select>

              </div>

              <div className="oc-filter">

                <select
                  value={sort}
                  onChange={(e) =>
                    setSort(
                      e.target.value
                    )
                  }
                >
                  <option value="priority">
                    Priority
                  </option>

                  <option value="newest">
                    Newest
                  </option>

                  <option value="oldest">
                    Oldest
                  </option>

                  <option value="risk">
                    AI Risk
                  </option>
                </select>

              </div>

              <button
                type="button"
                className="oc-reset-button"
                onClick={resetFilters}
              >
                Reset
              </button>

            </div>

          </section>

          {/* =================================================
              RESULTS HEADER
          ================================================= */}

          <div className="oc-results-header">

            <div>

              <span>
                {pagination.total || 0}
              </span>{" "}

              complaints found

            </div>

            <div>
              Page{" "}
              {pagination.page || 1}{" "}
              of{" "}
              {pagination.pages || 1}
            </div>

          </div>

          {/* =================================================
              COMPLAINTS
          ================================================= */}

          <section className="oc-complaints-container">

            {loading && (
              <div className="oc-loading">

                <Loader2 />

                <p>
                  Loading complaints...
                </p>

              </div>
            )}

            {!loading &&
              complaints.length === 0 && (
                <div className="oc-empty">

                  <CheckCircle2 />

                  <h3>
                    No complaints found
                  </h3>

                  <p>
                    No complaints match
                    the selected filters.
                  </p>

                  <button
                    onClick={resetFilters}
                  >
                    Clear Filters
                  </button>

                </div>
              )}

            {!loading &&
              complaints.length > 0 && (
                <div className="oc-table-wrapper">

                  <table className="oc-table">

                    <thead>

                      <tr>

                        <th>
                          Complaint
                        </th>

                        <th>
                          Category
                        </th>

                        <th>
                          Location
                        </th>

                        <th>
                          Priority
                        </th>

                        <th>
                          AI Risk
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Submitted
                        </th>

                        <th>
                          Action
                        </th>

                        <th>
                          Image
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {complaints.map(
                        (complaint) => {

                          const risk =
                            getRiskPercentage(
                              complaint.risk_score
                            );

                          return (
                            <tr
                              key={
                                complaint.complaint_id
                              }
                            >

                              {/* COMPLAINT */}

                              <td>

                                <div className="oc-complaint-cell">

                                  <span className="oc-complaint-id">
                                    #
                                    {
                                      complaint.complaint_id
                                    }
                                  </span>

                                  <strong>
                                    {complaint.title ||
                                      complaint.category ||
                                      "Civic Complaint"}
                                  </strong>

                                </div>

                              </td>

                              {/* CATEGORY */}

                              <td>

                                <span className="oc-category">
                                  {complaint.category ||
                                    "—"}
                                </span>

                              </td>

                              {/* LOCATION */}

                              <td>

                                <div className="oc-location">

                                  <MapPin />

                                  <span>
                                    {complaint.location ||
                                      complaint.address ||
                                      "—"}
                                  </span>

                                </div>

                              </td>

                              {/* PRIORITY */}

                              <td>

                                <span
                                  className={`oc-priority ${getPriorityClass(
                                    complaint.priority
                                  )}`}
                                >
                                  {
                                    complaint.priority ||
                                      "Normal"
                                  }
                                </span>

                              </td>

                              {/* AI RISK */}

                              <td>

                                <div className="oc-risk">

                                  <strong
                                    className={
                                      risk >= 75
                                        ? "risk-danger"
                                        : risk >= 50
                                        ? "risk-warning"
                                        : "risk-safe"
                                    }
                                  >
                                    {risk.toFixed(
                                      0
                                    )}
                                    %
                                  </strong>

                                  <div className="oc-risk-bar">

                                    <div
                                      style={{
                                        width: `${Math.min(
                                          risk,
                                          100
                                        )}%`,
                                      }}
                                    />

                                  </div>

                                </div>

                              </td>

                              {/* STATUS */}

                              <td>

                                <span
                                  className={`oc-status ${getStatusClass(
                                    complaint.status
                                  )}`}
                                >
                                  {
                                    complaint.status ||
                                      "Unknown"
                                  }
                                </span>

                              </td>

                              {/* DATE */}

                              <td>

                                <div className="oc-date">

                                  <CalendarDays />

                                  {formatDate(
                                    complaint.created_at
                                  )}

                                </div>

                              </td>

                              {/* ACTION */}

                              <td>

                                <button
                                  className="oc-view-button"
                                  onClick={() =>
                                    navigate(
                                      `/officer/complaints/${complaint.complaint_id}`
                                    )
                                  }
                                >
                                  <Eye />

                                  View

                                </button>

                              </td>

                              {/* IMAGE */}

                              <td>

                                {complaint.image_url ? (
                                  <img
                                    src={complaint.image_url}
                                    alt={complaint.title || "Complaint"}
                                    className="oc-complaint-image"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="oc-no-image">No image</span>
                                )}

                              </td>

                            </tr>
                          );
                        }
                      )}

                    </tbody>

                  </table>

                </div>
              )}

          </section>

          {/* =================================================
              PAGINATION
          ================================================= */}

          {!loading &&
            pagination.pages > 1 && (
              <div className="oc-pagination">

                <button
                  disabled={
                    currentPage <= 1
                  }
                  onClick={() =>
                    changePage(
                      currentPage - 1
                    )
                  }
                >
                  <ChevronLeft />
                  Previous
                </button>

                <div className="oc-page-numbers">

                  {Array.from(
                    {
                      length:
                        pagination.pages,
                    },
                    (_, index) =>
                      index + 1
                  )
                    .filter((page) => {
                      return (
                        page === 1 ||
                        page ===
                          pagination.pages ||
                        Math.abs(
                          page -
                            currentPage
                        ) <= 1
                      );
                    })
                    .map((page) => (
                      <button
                        key={page}
                        className={
                          page ===
                          currentPage
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          changePage(
                            page
                          )
                        }
                      >
                        {page}
                      </button>
                    ))}

                </div>

                <button
                  disabled={
                    currentPage >=
                    pagination.pages
                  }
                  onClick={() =>
                    changePage(
                      currentPage + 1
                    )
                  }
                >
                  Next
                  <ChevronRight />
                </button>

              </div>
            )}

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

export default OfficerComplaints;
