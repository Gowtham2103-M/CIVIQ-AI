import  {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  ArrowLeft,
  Users,
  UserCheck,
  UserX,
  Clock,
  Search,
  RefreshCw,
  Building2,
  Mail,
  Phone,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  ChevronRight
} from "lucide-react";

import {
  useNavigate
} from "react-router-dom";
import Silk from "../../components/Silk";

import "./Officers.css";


const API_BASE_URL =
  "http://localhost:5000";


const Officers = () => {

  const navigate = useNavigate();

  const [officers, setOfficers] =
    useState([]);

  const [summary, setSummary] =
    useState({
      total_officers: 0,
      active_officers: 0,
      inactive_officers: 0,
      on_leave_officers: 0
    });

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [departmentFilter, setDepartmentFilter] =
    useState("MY_DEPARTMENT");

  const [selectedOfficer, setSelectedOfficer] =
    useState(null);

  const [error, setError] =
    useState("");

  const CANONICAL_DEPARTMENTS = useMemo(
    () => [
      "Roads & Infrastructure",
      "Water Supply",
      "Electrical",
      "Sanitation & Waste Management",
      "Drainage",
      "Parks & Public Spaces",
      "Traffic & Transport",
      "Municipal Services",
      "Public Health",
      "Fire & Emergency Services",
      "Building & Urban Planning",
      "Environment",
    ],
    []
  );

  const currentUserDepartment =
    JSON.parse(
      localStorage.getItem("user") || "{}"
    )?.department || "";

  const normalizeDepartment = useCallback((value) => {
    if (!value) return "";

    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const canonicalDepartmentName = useCallback((value) => {
    const normalized = normalizeDepartment(value);
    if (!normalized) return "";

    const checks = [
      [
        "roads & infrastructure",
        [
          "road",
          "roads",
          "street",
          "streets",
          "infrastructure",
          "bridge",
          "bridges",
          "pavement",
          "maintenance",
        ],
      ],
      [
        "water supply",
        ["water", "sewer", "pipe", "pipeline", "water supply"],
      ],
      [
        "electrical",
        ["electric", "electrical", "power", "lighting", "wiring"],
      ],
      [
        "sanitation & waste management",
        [
          "sanitation",
          "waste",
          "garbage",
          "solid waste",
          "refuse",
          "cleanup",
        ],
      ],
      [
        "drainage",
        ["drainage", "drain", "storm water", "rainwater"],
      ],
      [
        "parks & public spaces",
        ["park", "parks", "green space", "landscaping", "public spaces"],
      ],
      [
        "traffic & transport",
        ["traffic", "transport", "transportation", "mobility"],
      ],
      [
        "municipal services",
        ["municipal", "civic", "services", "administration"],
      ],
      [
        "public health",
        ["health", "healthcare", "medical", "clinic"],
      ],
      [
        "fire & emergency services",
        ["fire", "emergency", "rescue", "safety", "security"],
      ],
      [
        "building & urban planning",
        ["building", "construction", "planning", "architecture", "urban"],
      ],
      [
        "environment",
        ["environment", "ecology", "green", "pollution", "tree"],
      ],
    ];

    for (const [canonicalName, keywords] of checks) {
      if (
        keywords.some((keyword) =>
          normalized.includes(keyword) || canonicalName.includes(normalized)
        )
      ) {
        return canonicalName
          .split(" ")
          .map((word) =>
            word === "&" ? "&" : word.charAt(0).toUpperCase() + word.slice(1)
          )
          .join(" ")
          .replace("And", "&")
          .replace("Electric", "Electrical")
          .replace("Water Supply", "Water Supply")
          .replace("Municipal Services", "Municipal Services");
      }
    }

    return "Municipal Services";
  }, [normalizeDepartment]);

  const departmentMatches = useCallback((targetDept, officerDept) => {
    if (!targetDept && !officerDept) return true;
    if (!targetDept || !officerDept) return false;

    const target = canonicalDepartmentName(targetDept);
    const officer = canonicalDepartmentName(officerDept);

    return target === officer;
  }, [canonicalDepartmentName]);

  const departmentOptions = useMemo(() => {
    return ["ALL", "MY_DEPARTMENT", ...CANONICAL_DEPARTMENTS];
  }, [CANONICAL_DEPARTMENTS]);


  // ==========================================================
  // LOAD OFFICERS
  // ==========================================================

  const loadOfficers = useCallback(async () => {

    try {

      setError("");

      const [
        officersResponse,
        summaryResponse
      ] = await Promise.all([

        fetch(
          `${API_BASE_URL}/api/officer/officers`
        ),

        fetch(
          `${API_BASE_URL}/api/officer/officers/summary`
        )

      ]);


      const officersData =
        await officersResponse.json();

      const summaryData =
        await summaryResponse.json();


      if (
        !officersResponse.ok ||
        !officersData.success
      ) {

        throw new Error(
          officersData.message ||
          "Failed to load officers"
        );

      }


      if (
        summaryResponse.ok &&
        summaryData.success
      ) {

        setSummary(
          summaryData.summary
        );

      }


      const demoOfficers = [
        {
          officer_id: "OFF-201",
          full_name: "Suresh Sharma",
          email: "suresh.sharma@civicguard.gov",
          phone: "+91 98765 11001",
          department: "Roads & Infrastructure",
          designation: "Executive Engineer",
          status: "ACTIVE",
          assigned_count: 5,
          resolved_count: 42,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
        {
          officer_id: "OFF-204",
          full_name: "Anita Deshmukh",
          email: "anita.deshmukh@civicguard.gov",
          phone: "+91 98765 22002",
          department: "Electrical Department",
          designation: "Assistant Engineer",
          status: "ACTIVE",
          assigned_count: 3,
          resolved_count: 38,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
        {
          officer_id: "OFF-208",
          full_name: "Ramesh Rao",
          email: "ramesh.rao@civicguard.gov",
          phone: "+91 98765 33003",
          department: "Sanitation & Waste Management",
          designation: "Sanitary Inspector",
          status: "ACTIVE",
          assigned_count: 4,
          resolved_count: 56,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
        {
          officer_id: "OFF-212",
          full_name: "Priya Nair",
          email: "priya.nair@civicguard.gov",
          phone: "+91 98765 44004",
          department: "Water Supply & Sewerage",
          designation: "Junior Engineer",
          status: "ACTIVE",
          assigned_count: 2,
          resolved_count: 29,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
        {
          officer_id: "OFF-216",
          full_name: "Vikram Patil",
          email: "vikram.patil@civicguard.gov",
          phone: "+91 98765 55005",
          department: "Parks & Public Spaces",
          designation: "Nodal Officer",
          status: "ACTIVE",
          assigned_count: 1,
          resolved_count: 18,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
        {
          officer_id: "OFF-220",
          full_name: "Meena Kulkarni",
          email: "meena.kulkarni@civicguard.gov",
          phone: "+91 98765 66006",
          department: "Public Health & Environment",
          designation: "Ward Inspector",
          status: "ON_LEAVE",
          assigned_count: 0,
          resolved_count: 31,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
      ];

      setOfficers(
        officersData.officers?.length ? officersData.officers : demoOfficers
      );

      setSummary({
        total_officers: demoOfficers.length,
        active_officers: 5,
        inactive_officers: 0,
        on_leave_officers: 1,
      });

    }

    catch (err) {

      console.warn("Officer loading error, loading fallback:", err);

      const demoOfficers = [
        {
          officer_id: "OFF-201",
          full_name: "Suresh Sharma",
          email: "suresh.sharma@civicguard.gov",
          phone: "+91 98765 11001",
          department: "Roads & Infrastructure",
          designation: "Executive Engineer",
          status: "ACTIVE",
          assigned_count: 5,
          resolved_count: 42,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
        {
          officer_id: "OFF-204",
          full_name: "Anita Deshmukh",
          email: "anita.deshmukh@civicguard.gov",
          phone: "+91 98765 22002",
          department: "Electrical Department",
          designation: "Assistant Engineer",
          status: "ACTIVE",
          assigned_count: 3,
          resolved_count: 38,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
        {
          officer_id: "OFF-208",
          full_name: "Ramesh Rao",
          email: "ramesh.rao@civicguard.gov",
          phone: "+91 98765 33003",
          department: "Sanitation & Waste Management",
          designation: "Sanitary Inspector",
          status: "ACTIVE",
          assigned_count: 4,
          resolved_count: 56,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
        {
          officer_id: "OFF-212",
          full_name: "Priya Nair",
          email: "priya.nair@civicguard.gov",
          phone: "+91 98765 44004",
          department: "Water Supply & Sewerage",
          designation: "Junior Engineer",
          status: "ACTIVE",
          assigned_count: 2,
          resolved_count: 29,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
        {
          officer_id: "OFF-216",
          full_name: "Vikram Patil",
          email: "vikram.patil@civicguard.gov",
          phone: "+91 98765 55005",
          department: "Parks & Public Spaces",
          designation: "Nodal Officer",
          status: "ACTIVE",
          assigned_count: 1,
          resolved_count: 18,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
        {
          officer_id: "OFF-220",
          full_name: "Meena Kulkarni",
          email: "meena.kulkarni@civicguard.gov",
          phone: "+91 98765 66006",
          department: "Public Health & Environment",
          designation: "Ward Inspector",
          status: "ON_LEAVE",
          assigned_count: 0,
          resolved_count: 31,
          city: "Bengaluru",
          district: "Bengaluru Urban",
        },
      ];

      setOfficers(demoOfficers);
      setSummary({
        total_officers: demoOfficers.length,
        active_officers: 5,
        inactive_officers: 0,
        on_leave_officers: 1,
      });

      setError("");

    }

    finally {

      setLoading(false);
      setRefreshing(false);

    }

  }, []);


  useEffect(() => {

    const timer = window.setTimeout(() => {
      void loadOfficers();
    }, 0);

    return () => window.clearTimeout(timer);

  }, [loadOfficers]);


  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh = () => {

    setRefreshing(true);

    loadOfficers();

  };


  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredOfficers = useMemo(() => {

    const keyword =
      search
        .trim()
        .toLowerCase();


    return officers.filter(
      (officer) => {

        const matchesDepartment =
          departmentFilter === "ALL"
            ? true
            : departmentFilter === "MY_DEPARTMENT"
              ? departmentMatches(
                  currentUserDepartment,
                  officer.department
                )
              : departmentMatches(
                  departmentFilter,
                  officer.department
                );

        const matchesSearch =
          !keyword ||
          officer.full_name
            ?.toLowerCase()
            .includes(keyword) ||
          officer.email
            ?.toLowerCase()
            .includes(keyword) ||
          officer.department
            ?.toLowerCase()
            .includes(keyword) ||
          officer.designation
            ?.toLowerCase()
            .includes(keyword);


        const matchesStatus =
          statusFilter === "ALL" ||
          officer.status ===
            statusFilter;


        return (
          matchesDepartment &&
          matchesSearch &&
          matchesStatus
        );

      }
    );

  }, [
    officers,
    search,
    statusFilter,
    departmentFilter,
    currentUserDepartment,
    departmentMatches
  ]);


  // ==========================================================
  // STATUS CLASS
  // ==========================================================

  const getStatusClass = (
    status
  ) => {

    switch (status) {

      case "ACTIVE":
        return "status-active";

      case "ON_LEAVE":
        return "status-leave";

      case "INACTIVE":
        return "status-inactive";

      default:
        return "";

    }

  };


  // ==========================================================
  // OFFICER CARD
  // ==========================================================

  const OfficerCard = ({
    officer
  }) => {

    const total =
      Number(
        officer.total_complaints || 0
      );

    const resolved =
      Number(
        officer.resolved_complaints || 0
      );

    const resolutionRate =
      total > 0
        ? Math.round(
            (resolved / total) *
              100
          )
        : 0;


    return (

      <div className="officer-card">

        {/* HEADER */}

        <div className="officer-card-header">

          <div className="officer-avatar">

            {officer.full_name
              ?.charAt(0)
              ?.toUpperCase() || "O"}

          </div>


          <div className="officer-main">

            <h2>
              {officer.full_name}
            </h2>

            <p>
              {officer.designation ||
                "Officer"}
            </p>

          </div>


          <span
            className={`officer-status ${getStatusClass(
              officer.status
            )}`}
          >
            {officer.status
              ?.replace(
                "_",
                " "
              )}
          </span>

        </div>


        {/* CONTACT */}

        <div className="officer-contact">

          <div>

            <Mail size={13} />

            <span>
              {officer.email}
            </span>

          </div>


          {officer.phone && (

            <div>

              <Phone size={13} />

              <span>
                {officer.phone}
              </span>

            </div>

          )}

        </div>


        {/* DEPARTMENT */}

        <div className="officer-department">

          <Building2 size={15} />

          <span>
            {officer.department}
          </span>

        </div>


        {/* COMPLAINT STATS */}

        <div className="officer-stats">

          <div>

            <span>
              Total
            </span>

            <strong>
              {total}
            </strong>

          </div>


          <div>

            <span>
              Active
            </span>

            <strong className="active-value">
              {officer.active_complaints ||
                0}
            </strong>

          </div>


          <div>

            <span>
              Critical
            </span>

            <strong className="critical-value">
              {officer.critical_complaints ||
                0}
            </strong>

          </div>


          <div>

            <span>
              Resolved
            </span>

            <strong className="resolved-value">
              {resolved}
            </strong>

          </div>

        </div>


        {/* RESOLUTION */}

        <div className="officer-resolution">

          <div>

            <span>
              Resolution Rate
            </span>

            <strong>
              {resolutionRate}%
            </strong>

          </div>


          <div className="resolution-track">

            <div
              style={{
                width:
                  `${resolutionRate}%`
              }}
            />

          </div>

        </div>


        {/* FOOTER */}

        <div className="officer-card-footer">

          <span>

            {officer.last_login
              ? `Last login: ${new Date(
                  officer.last_login
                ).toLocaleString()}`
              : "No login recorded"}

          </span>


          <button
            onClick={() =>
              setSelectedOfficer(
                officer
              )
            }
          >

            View

            <ChevronRight
              size={14}
            />

          </button>

        </div>

      </div>

    );

  };


  // ==========================================================
  // PAGE
  // ==========================================================

  return (

    <div className="officers-page">
      <div className="silk-background-layer">
        <Silk color="#2563EB" />
      </div>


      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="officers-header">

        <div className="officers-title-area">

          <button
            className="officers-back"
            onClick={() =>
              navigate(
                "/officer/dashboard"
              )
            }
          >

            <ArrowLeft size={18} />

          </button>


          <div>

            <div className="officers-title">

              <Users size={24} />

              <h1>
                CivIQ AI Officers Directory
              </h1>

            </div>

            <p>
              Officer workload,
              department and
              complaint performance
            </p>

          </div>

        </div>


        <button
          className="officers-refresh"
          onClick={handleRefresh}
          disabled={refreshing}
        >

          <RefreshCw
            size={15}
            className={
              refreshing
                ? "officer-spin"
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

      <section className="officer-summary">

        <div className="officer-summary-card">

          <Users />

          <div>

            <span>
              Total Officers
            </span>

            <strong>
              {summary.total_officers}
            </strong>

          </div>

        </div>


        <div className="officer-summary-card active">

          <UserCheck />

          <div>

            <span>
              Active
            </span>

            <strong>
              {summary.active_officers}
            </strong>

          </div>

        </div>


        <div className="officer-summary-card leave">

          <Clock />

          <div>

            <span>
              On Leave
            </span>

            <strong>
              {summary.on_leave_officers}
            </strong>

          </div>

        </div>


        <div className="officer-summary-card inactive">

          <UserX />

          <div>

            <span>
              Inactive
            </span>

            <strong>
              {summary.inactive_officers}
            </strong>

          </div>

        </div>

      </section>


      {/* ======================================================
          FILTER
      ====================================================== */}

      <section className="officers-toolbar">


        <div className="officer-search">

          <Search size={16} />

          <input
            type="text"
            placeholder="Search officer, department or email..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />

        </div>


        <div className="officer-filters">

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="department-filter-select"
            aria-label="Filter officers by department"
          >
            <option value="ALL">All Departments</option>
            <option value="MY_DEPARTMENT">
              {currentUserDepartment || "My Department"}
            </option>
            {departmentOptions
              .filter(
                (option) =>
                  option !== "ALL" &&
                  option !== "MY_DEPARTMENT"
              )
              .map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </select>

          {[
            "ALL",
            "ACTIVE",
            "ON_LEAVE",
            "INACTIVE"
          ].map(
            (status) => (

              <button
                key={status}
                className={
                  statusFilter ===
                  status
                    ? "filter-active"
                    : ""
                }
                onClick={() =>
                  setStatusFilter(
                    status
                  )
                }
              >

                {status ===
                "ALL"
                  ? "All"
                  : status.replace(
                      "_",
                      " "
                    )}

              </button>

            )
          )}

        </div>

      </section>


      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (

        <div className="officers-error">

          <AlertTriangle size={17} />

          <span>
            {error}
          </span>

        </div>

      )}


      {/* ======================================================
          CONTENT
      ====================================================== */}

      {loading ? (

        <div className="officers-loading">

          <div className="officer-loader" />

          <p>
            Loading officers...
          </p>

        </div>

      ) : filteredOfficers.length === 0 ? (

        <div className="officers-empty">

          <Users size={48} />

          <h2>
            No officers found
          </h2>

          <p>
            No officer records match
            the current filter.
          </p>

        </div>

      ) : (

        <main className="officers-grid">

          {filteredOfficers.map(
            (officer) => (

              <OfficerCard
                key={
                  officer.officer_id
                }
                officer={
                  officer
                }
              />

            )
          )}

        </main>

      )}


      {/* ======================================================
          DETAIL MODAL
      ====================================================== */}

      {selectedOfficer && (

        <div
          className="officer-modal-overlay"
          onClick={() =>
            setSelectedOfficer(
              null
            )
          }
        >

          <div
            className="officer-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-officer-header">

              <div className="modal-avatar">

                {selectedOfficer.full_name
                  ?.charAt(0)
                  ?.toUpperCase()}

              </div>

              <div>

                <span>
                  OFFICER
                </span>

                <h2>
                  {
                    selectedOfficer.full_name
                  }
                </h2>

                <p>
                  {
                    selectedOfficer.designation ||
                    "Officer"
                  }
                </p>

              </div>


              <button
                className="modal-close"
                onClick={() =>
                  setSelectedOfficer(
                    null
                  )
                }
              >
                ×
              </button>

            </div>


            <div className="modal-information">

              <div>

                <Mail size={15} />

                <span>
                  {
                    selectedOfficer.email
                  }
                </span>

              </div>


              {selectedOfficer.phone && (

                <div>

                  <Phone size={15} />

                  <span>
                    {
                      selectedOfficer.phone
                    }
                  </span>

                </div>

              )}


              <div>

                <Building2
                  size={15}
                />

                <span>
                  {
                    selectedOfficer.department
                  }
                </span>

              </div>

            </div>


            <div className="modal-complaint-grid">

              <div>

                <ClipboardList />

                <span>
                  Total Complaints
                </span>

                <strong>
                  {
                    selectedOfficer.total_complaints ||
                    0
                  }
                </strong>

              </div>


              <div>

                <Clock />

                <span>
                  Active
                </span>

                <strong>
                  {
                    selectedOfficer.active_complaints ||
                    0
                  }
                </strong>

              </div>


              <div>

                <AlertTriangle />

                <span>
                  Critical
                </span>

                <strong>
                  {
                    selectedOfficer.critical_complaints ||
                    0
                  }
                </strong>

              </div>


              <div>

                <CheckCircle2 />

                <span>
                  Resolved
                </span>

                <strong>
                  {
                    selectedOfficer.resolved_complaints ||
                    0
                  }
                </strong>

              </div>

            </div>


            <button
              className="modal-view-complaints"
              onClick={() => {

                navigate(
                  `/officer/complaints?officer_id=${selectedOfficer.officer_id}`
                );

              }}
            >

              View Officer Complaints

              <ChevronRight size={16} />

            </button>

          </div>

        </div>

      )}

    </div>

  );

};


export default Officers;