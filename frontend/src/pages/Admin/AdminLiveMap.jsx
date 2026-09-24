import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Map,
  RefreshCw,
  Search,
  Filter,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  X,
  Navigation,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./AdminLiveMap.css";

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

import { adminRequest } from "../../services/adminApi";

/*
const DEMO_COMPLAINTS = [
  {
    id: "CMP-1001",
    title: "Pothole on main road",
    category: "Roads",
    severity: "High",
    status: "Pending",
    officer: "Arun Kumar",
    location: "Anna Nagar",
    lat: 13.085,
    lng: 80.21,
    time: "10 min ago",
  },
  {
    id: "CMP-1002",
    title: "Street light not working",
    category: "Electricity",
    severity: "Medium",
    status: "In Progress",
    officer: "Priya Devi",
    location: "T Nagar",
    lat: 13.0418,
    lng: 80.2341,
    time: "18 min ago",
  },
  {
    id: "CMP-1003",
    title: "Garbage accumulation",
    category: "Sanitation",
    severity: "High",
    status: "Pending",
    officer: "Rahul Kumar",
    location: "Velachery",
    lat: 12.9815,
    lng: 80.218,
    time: "25 min ago",
  },
  {
    id: "CMP-1004",
    title: "Water leakage",
    category: "Water",
    severity: "Critical",
    status: "Pending",
    officer: "Suresh B",
    location: "Adyar",
    lat: 13.0067,
    lng: 80.257,
    time: "32 min ago",
  },
  {
    id: "CMP-1005",
    title: "Blocked drainage",
    category: "Drainage",
    severity: "Medium",
    status: "Resolved",
    officer: "Meena Devi",
    location: "Mylapore",
    lat: 13.0339,
    lng: 80.2676,
    time: "45 min ago",
  },
  {
    id: "CMP-1006",
    title: "Road damage",
    category: "Roads",
    severity: "Critical",
    status: "In Progress",
    officer: "Ravi Kumar",
    location: "Guindy",
    lat: 13.0067,
    lng: 80.2206,
    time: "51 min ago",
  },
  {
    id: "CMP-1007",
    title: "Garbage not collected",
    category: "Sanitation",
    severity: "Low",
    status: "Resolved",
    officer: "Divya R",
    location: "Nungambakkam",
    lat: 13.0569,
    lng: 80.2425,
    time: "1 hr ago",
  },
  {
    id: "CMP-1008",
    title: "Street light issue",
    category: "Electricity",
    severity: "Medium",
    status: "Pending",
    officer: "Priya Devi",
    location: "Egmore",
    lat: 13.0732,
    lng: 80.2609,
    time: "1 hr ago",
  },
];
*/

const STATUS_OPTIONS = [
  "All",
  "Pending",
  "In Progress",
  "Resolved",
];

const SEVERITY_OPTIONS = [
  "All",
  "Critical",
  "High",
  "Medium",
  "Low",
];

export default function AdminLiveMap() {
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState([]);

  const [selectedComplaint, setSelectedComplaint] =
    useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [severity, setSeverity] = useState("All");

  const [showFilters, setShowFilters] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] =
    useState(false);

  const loadComplaints = async () => {
    try {
      setLoading(true);

      const data = await adminRequest("/admin/live-map");
      setComplaints((data.complaints || []).filter((item) => item.latitude != null && item.longitude != null).map((item) => ({ ...item, lat: Number(item.latitude), lng: Number(item.longitude), title: item.title || `Complaint ${item.id}`, location: item.location || "Unknown", severity: item.severity || "MEDIUM", status: (item.status || "").replaceAll("_", " "), officer: item.officer_name || "Unassigned" })));
    } catch (error) {
      console.error(
        "Map data error:",
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

  const refreshMap = async () => {
    setRefreshing(true);
    await loadComplaints();
    setRefreshing(false);
  };

  const filteredComplaints = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return complaints.filter((item) => {
      const matchesSearch =
        !query ||
        item.id
          .toLowerCase()
          .includes(query) ||
        item.title
          .toLowerCase()
          .includes(query) ||
        item.location
          .toLowerCase()
          .includes(query) ||
        item.category
          .toLowerCase()
          .includes(query) ||
        item.officer
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        status === "All" ||
        item.status === status;

      const matchesSeverity =
        severity === "All" ||
        item.severity === severity;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSeverity
      );
    });
  }, [
    complaints,
    search,
    status,
    severity,
  ]);

  const stats = {
    total: complaints.length,

    pending: complaints.filter(
      (item) => item.status === "Pending"
    ).length,

    progress: complaints.filter(
      (item) =>
        item.status === "In Progress"
    ).length,

    resolved: complaints.filter(
      (item) => item.status === "Resolved"
    ).length,

    critical: complaints.filter(
      (item) =>
        item.severity === "Critical"
    ).length,
  };

  const center = {
    lat: 13.0827,
    lng: 80.2707,
  };

  return (
    <div className="admin-live-map">

      {/* HEADER */}

      <header className="map-header">

        <div className="map-header-left">

          <button
            className="map-back"
            onClick={() =>
              navigate("/admin/dashboard")
            }
          >
            <ArrowLeft size={18} />
          </button>

          <div className="map-title">

            <div className="map-title-icon">
              <Map size={18} />
            </div>

            <div>
              <h1>Live Map</h1>

              <p>
                Real-time civic complaint
                monitoring
              </p>
            </div>

          </div>

        </div>

        <div className="map-header-actions">

          <div className="live-indicator">
            <span />
            LIVE
          </div>

          <button
            className="map-refresh"
            onClick={refreshMap}
            disabled={refreshing}
          >
            <RefreshCw
              size={15}
              className={
                refreshing
                  ? "spin"
                  : ""
              }
            />
            Refresh
          </button>

        </div>

      </header>

      {/* MAIN */}

      <main className="map-content">

        {/* STATS */}

        <section className="map-stats">

          <MapStat
            label="Total Complaints"
            value={stats.total}
            icon={<MapPin size={17} />}
          />

          <MapStat
            label="Pending"
            value={stats.pending}
            icon={<Clock3 size={17} />}
          />

          <MapStat
            label="In Progress"
            value={stats.progress}
            icon={<Navigation size={17} />}
          />

          <MapStat
            label="Resolved"
            value={stats.resolved}
            icon={<CheckCircle2 size={17} />}
          />

          <MapStat
            label="Critical"
            value={stats.critical}
            icon={<AlertTriangle size={17} />}
          />

        </section>

        {/* MAP AREA */}

        <section className="map-layout">

          {/* MAP */}

          <div className="map-container">

            <GoogleMap
              center={center}
              complaints={
                filteredComplaints
              }
              selectedComplaint={
                selectedComplaint
              }
              onSelect={
                setSelectedComplaint
              }
            />

            {/* MAP SEARCH */}

            <div className="map-search">

              <Search size={15} />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search complaint, location or officer..."
              />

              {search && (
                <button
                  onClick={() =>
                    setSearch("")
                  }
                >
                  <X size={13} />
                </button>
              )}

            </div>

            {/* FILTER BUTTON */}

            <button
              className={`map-filter-button ${
                showFilters
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setShowFilters(
                  !showFilters
                )
              }
            >
              <Filter size={14} />
              Filters
            </button>

            {/* FILTER PANEL */}

            {showFilters && (
              <div className="map-filter-panel">

                <FilterSelect
                  label="Status"
                  value={status}
                  options={STATUS_OPTIONS}
                  onChange={setStatus}
                />

                <FilterSelect
                  label="Severity"
                  value={severity}
                  options={
                    SEVERITY_OPTIONS
                  }
                  onChange={setSeverity}
                />

                <button
                  className="clear-map-filters"
                  onClick={() => {
                    setStatus("All");
                    setSeverity("All");
                    setSearch("");
                  }}
                >
                  Clear
                </button>

              </div>
            )}

            {/* LEGEND */}

            <div className="map-legend">

              <strong>
                Severity
              </strong>

              <LegendItem
                type="critical"
                label="Critical"
              />

              <LegendItem
                type="high"
                label="High"
              />

              <LegendItem
                type="medium"
                label="Medium"
              />

              <LegendItem
                type="low"
                label="Low"
              />

            </div>

          </div>

          {/* RIGHT PANEL */}

          <aside className="complaints-panel">

            <div className="panel-header">

              <div>
                <h2>
                  Live Complaints
                </h2>

                <p>
                  {filteredComplaints.length}{" "}
                  complaints on map
                </p>
              </div>

              <span className="panel-live">
                LIVE
              </span>

            </div>

            <div className="complaint-list">

              {loading ? (
                <div className="panel-loading">

                  <RefreshCw
                    className="spin"
                    size={22}
                  />

                  <span>
                    Loading...
                  </span>

                </div>
              ) : filteredComplaints.length ===
                0 ? (
                <div className="no-map-results">

                  <MapPin size={28} />

                  <strong>
                    No complaints
                  </strong>

                  <span>
                    Change your filters
                    to see results.
                  </span>

                </div>
              ) : (
                filteredComplaints.map(
                  (complaint) => (
                    <ComplaintCard
                      key={complaint.id}
                      complaint={complaint}
                      selected={
                        selectedComplaint?.id ===
                        complaint.id
                      }
                      onClick={() =>
                        setSelectedComplaint(
                          complaint
                        )
                      }
                    />
                  )
                )
              )}

            </div>

          </aside>

        </section>

      </main>

    </div>
  );
}

/* =========================================================
   GOOGLE MAP
   ========================================================= */

function GoogleMap({
  center,
  complaints,
  selectedComplaint,
  onSelect,
}) {
  const createMap = useCallback(() => {
    const element =
      document.getElementById(
        "admin-google-map"
      );

    if (!element) return;

    const map =
      new window.google.maps.Map(
        element,
        {
          center,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        }
      );

    complaints.forEach((item) => {
      const marker =
        new window.google.maps.Marker({
          position: {
            lat: item.lat,
            lng: item.lng,
          },
          map,
          title: item.title,
          icon: getMarkerIcon(
            item.severity
          ),
        });

      marker.addListener(
        "click",
        () => onSelect(item)
      );
    });

    if (selectedComplaint) {
      map.panTo({
        lat: selectedComplaint.lat,
        lng: selectedComplaint.lng,
      });

      map.setZoom(15);
    }
  }, [center, complaints, selectedComplaint, onSelect]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;

    if (window.google && window.google.maps) {
      createMap();
      return;
    }

    const existingScript = document.querySelector(
      'script[data-google-maps="true"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", createMap);
      return () => existingScript.removeEventListener("load", createMap);
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "true";
    script.onload = createMap;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [createMap]);

  useEffect(() => {
    if (window.google && window.google.maps) {
      createMap();
    }
  }, [createMap, complaints, selectedComplaint]);

  if (GOOGLE_MAPS_API_KEY) {
    return (
      <div
        id="admin-google-map"
        className="real-map"
      />
    );
  }

  return (
    <div className="map-placeholder">

      <div className="placeholder-grid" />

      {complaints.map((item) => (
        <button
          key={item.id}
          className={`fake-marker ${getSeverityClass(
            item.severity
          )}`}
          style={{
            left: getFakeLeft(item.lng),
            top: getFakeTop(item.lat),
          }}
          onClick={() =>
            onSelect(item)
          }
          title={item.title}
        >
          <MapPin size={22} />
        </button>
      ))}

      <div className="map-placeholder-center">

        <Map size={30} />

        <strong>
          Live Complaint Map
        </strong>

        <span>
          Add your Google Maps API key
          to enable the live map.
        </span>

      </div>

      <div className="map-city-label">
        Chennai
      </div>

    </div>
  );
}

/* =========================================================
   MAP STAT
   ========================================================= */

function MapStat({
  label,
  value,
  icon,
}) {
  return (
    <div className="map-stat">

      <div className="map-stat-icon">
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
   COMPLAINT CARD
   ========================================================= */

function ComplaintCard({
  complaint,
  selected,
  onClick,
}) {
  return (
    <button
      className={`complaint-card ${
        selected
          ? "selected"
          : ""
      }`}
      onClick={onClick}
    >

      <div
        className={`complaint-marker ${getSeverityClass(
          complaint.severity
        )}`}
      >
        <MapPin size={15} />
      </div>

      <div className="complaint-main">

        <div className="complaint-top">

          <strong>
            {complaint.title}
          </strong>

          <span
            className={`severity-badge ${getSeverityClass(
              complaint.severity
            )}`}
          >
            {complaint.severity}
          </span>

        </div>

        <span className="complaint-id">
          {complaint.id}
        </span>

        <div className="complaint-location">

          <MapPin size={11} />

          {complaint.location}

        </div>

        <div className="complaint-meta">

          <span>
            {complaint.category}
          </span>

          <span>
            {complaint.status}
          </span>

        </div>

        <div className="complaint-footer">

          <span>
            Officer:{" "}
            <strong>
              {complaint.officer}
            </strong>
          </span>

          <span>
            {complaint.time}
          </span>

        </div>

      </div>

    </button>
  );
}

/* =========================================================
   FILTER SELECT
   ========================================================= */

function FilterSelect({
  label,
  value,
  options,
  onChange,
}) {
  return (
    <label>

      <span>{label}</span>

      <select
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
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
   LEGEND
   ========================================================= */

function LegendItem({
  type,
  label,
}) {
  return (
    <span className="legend-item">

      <i
        className={`legend-dot ${type}`}
      />

      {label}

    </span>
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function getSeverityClass(
  severity
) {
  return severity
    .toLowerCase()
    .replace(" ", "-");
}

function getMarkerIcon(
  severity
) {
  const colors = {
    Critical: "#dc2626",
    High: "#ea580c",
    Medium: "#d97706",
    Low: "#16a34a",
  };

  const color =
    colors[severity] ||
    "#2563eb";

  return {
    path:
      window.google.maps.SymbolPath
        .CIRCLE,

    fillColor: color,
    fillOpacity: 1,

    strokeColor: "#ffffff",
    strokeWeight: 2,

    scale: 9,
  };
}

function getFakeLeft(lng) {
  const minLng = 80.18;
  const maxLng = 80.31;

  return `${Math.max(
    8,
    Math.min(
      92,
      ((lng - minLng) /
        (maxLng - minLng)) *
        100
    )
  )}%`;
}

function getFakeTop(lat) {
  const minLat = 12.96;
  const maxLat = 13.11;

  return `${Math.max(
    8,
    Math.min(
      88,
      100 -
        ((lat - minLat) /
          (maxLat - minLat)) *
          100
    )
  )}%`;
}