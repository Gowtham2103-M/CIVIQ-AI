import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Bell, 
  User, 
  ChevronDown, 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  HelpCircle, 
  LogOut, 
  Building2, 
  Landmark, 
  ShieldCheck, 
  ChevronRight, 
  Calendar
} from "lucide-react";
import "./CitizenDashboard.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const CitizenDashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem("user_id");
      const storedUser = localStorage.getItem("user");

      if (!userId) {
        setUser({ name: "Demo Citizen", email: "citizen@civicguard.org" });
        setLoading(false);
        return;
      }

      // Use user data from localStorage (stored during login)
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);
        } catch (err) {
          console.error("Error parsing stored user data:", err);
        }
      }

      // Fetch ONLY this citizen's complaints
      const token = localStorage.getItem("token");
      const accountStatusResponse = await fetch(
        `${API_BASE_URL}/api/violations/account-status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (accountStatusResponse.ok) {
        const accountStatus = await accountStatusResponse.json();
        if (
          accountStatus.account_status === "SUSPENDED" ||
          Number(accountStatus.violation_count) >= 3
        ) {
          navigate("/account-suspended", { replace: true });
          return;
        }
      }

      const complaintsResponse = await fetch(
        `${API_BASE_URL}/api/my-complaints`,
        {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        }
      );

      if (complaintsResponse.ok) {
        const complaintsData = await complaintsResponse.json();
        const complaintsList = complaintsData.complaints || [];
        setComplaints(complaintsList);
      } else {
        setComplaints([]);
      }

      // Fetch ONLY this citizen's notifications
      const notificationsResponse = await fetch(
        `${API_BASE_URL}/api/notifications`,
        {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        }
      );

      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json();
        setNotifications(notificationsData.notifications || []);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error("Dashboard data loading error:", error);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const demoComplaints = [
    {
      complaint_id: "84920",
      id: "84920",
      title: "Pothole Repair on Main Road",
      category: "Road & Maintenance",
      location: "Main Road, Near Metro Station Gate 2, SC 560001",
      status: "In Progress",
      description: "Dangerous deep pothole near Metro Station Gate 2 causing traffic congestion.",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      complaint_id: "84915",
      id: "84915",
      title: "Streetlight Malfunction on 4th Cross",
      category: "Electrical & Lighting",
      location: "4th Cross Road, Civic Nagar, SC 560002",
      status: "Assigned",
      description: "Non-functional streetlight grid creating dark zone along residential pathway.",
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      complaint_id: "84910",
      id: "84910",
      title: "Drainage Overflow Repair",
      category: "Sanitation & Drainage",
      location: "Civic Avenue, Sector 3, SC 560003",
      status: "Resolved",
      description: "Blocked storm drainage causing water logging after rain.",
      created_at: new Date(Date.now() - 259200000).toISOString(),
    },
  ];

  const demoNotifications = [
    {
      id: "notif-1",
      title: "Complaint #84920 Update",
      message: "Your complaint regarding 'Pothole on Main Road' has been assigned to Public Works Department.",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "notif-2",
      title: "Investigation Scheduled",
      message: "Field worker assigned to inspect the reported location today at 2:00 PM.",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const displayComplaints = complaints.length > 0 ? complaints : demoComplaints;
  const displayNotifications = notifications.length > 0 ? notifications : demoNotifications;

  useEffect(() => {
    (async () => {
      await fetchDashboardData();
    })();
  }, [fetchDashboardData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const profileMenu = document.querySelector(".profile-mini");
      const profileDropdown = document.querySelector(".profile-dropdown-menu");

      if (
        profileMenu &&
        profileDropdown &&
        !profileMenu.contains(event.target) &&
        !profileDropdown.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showProfileMenu]);

  const handleComplaintClick = (complaintId) => {
    navigate(`/complaints/${complaintId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    setShowProfileMenu(false);
    navigate("/login");
  };

  const handleProfileMenuToggle = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleMenuItemClick = (action) => {
    setShowProfileMenu(false);
    if (action === "profile") {
      navigate("/profile");
    }
  };

  // Latest complaint from database
  const lastComplaint =
    displayComplaints.length > 0 ? displayComplaints[0] : null;

  // Show latest 3 complaints on dashboard
  const recentComplaints = displayComplaints.slice(0, 3);

  // Show latest 3 notifications on dashboard
  const recentNotifications = displayNotifications.slice(0, 3);

  // Unread notification count
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  // Format database date
  const formatDate = (date) => {
    if (!date) return "Date unavailable";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="citizen-dashboard">
        <main className="citizen-main">
          <div className="dashboard-loading">
            Loading dashboard...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="citizen-dashboard">

      {/* ================= SIDEBAR ================= */}
      <aside className="citizen-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <ShieldCheck size={22} color="#FFFFFF" />
          </div>

          <div>
            <h2>CivIQ AI</h2>
            <p>Smarter Governance, Better Tomorrow</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">
            <LayoutDashboard size={18} />
            Dashboard
          </button>

          <button
            className="nav-item"
            onClick={() => navigate("/raise-complaint")}
          >
            <PlusCircle size={18} />
            Raise Complaint
          </button>

          <button
            className="nav-item"
            onClick={() => navigate("/my-complaints")}
          >
            <FileText size={18} />
            My Complaint
          </button>

          <button
            className="nav-item"
            onClick={() => navigate("/profile")}
          >
            <User size={18} />
            Profile
          </button>

          <button
            className="nav-item notification-nav"
            onClick={() => navigate("/notifications")}
          >
            <Bell size={18} />
            Notification

            {unreadNotificationCount > 0 && (
              <span className="notification-count">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          <button
            className="nav-item"
            onClick={() => navigate("/help-support")}
          >
            <HelpCircle size={18} />
            Help & Support
          </button>
        </nav>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="citizen-main">

        {/* ================= HEADER ================= */}
        <header className="citizen-header">
          <div className="mobile-menu">☰</div>

          <div className="header-spacer"></div>

          <button
            className="header-notification"
            onClick={() => navigate("/notifications")}
          >
            <Bell size={15} />

            {unreadNotificationCount > 0 && (
              <span>{unreadNotificationCount}</span>
            )}
          </button>

          <button
            className="profile-mini"
            onClick={handleProfileMenuToggle}
            type="button"
            title="Profile Menu"
          >
            <div className="header-profile-avatar">
              <User size={13} />
            </div>

            <div className="profile-info">
              <strong>
                {user?.name || user?.full_name || "User"}
              </strong>

              <small>{user?.email || "No email"}</small>
            </div>

            <span className="profile-dropdown-icon">
              <ChevronDown size={12} />
            </span>
          </button>

          {showProfileMenu && (
            <div className="profile-dropdown-menu">
              <div className="profile-dropdown-header">
                <div className="dropdown-avatar">
                  <User size={22} />
                </div>
                <div className="dropdown-info">
                  <strong>{user?.name || user?.full_name || "User"}</strong>
                  <small>{user?.email || "No email"}</small>
                </div>
              </div>

              <div className="profile-dropdown-divider"></div>

              <button
                className="dropdown-menu-item"
                onClick={() => handleMenuItemClick("profile")}
              >
                <User size={16} />
                View Profile
              </button>

              <button
                className="dropdown-menu-item logout"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </header>

        {/* ================= CONTENT ================= */}
        <section className="dashboard-content">

          {/* ================= WELCOME ================= */}
          <div className="welcome-banner">
            <div className="welcome-text">
              <h1>
                Welcome,{" "}
                {user?.name || user?.full_name || "Citizen"}{" "}
              </h1>

              <p>
                Together for a cleaner, safer and better community.
              </p>
            </div>

            <div className="city-illustration">
              <Landmark size={26} color="#FF007A" />
              <Building2 size={26} color="#00D2FF" />
              <ShieldCheck size={26} color="#FF007A" />
            </div>
          </div>

          {/* ================= LAST COMPLAINT ================= */}
          {lastComplaint ? (
            <section className="last-complaint-section">
              <div className="section-header">
                <div>
                  <span className="section-icon"><FileText size={18} /></span>
                  <h2>Your Last Complaint</h2>
                </div>

                <button
                  className="view-all"
                  onClick={() => navigate("/my-complaints")}
                >
                  View All Complaints →
                </button>
              </div>

              <div className="last-complaint-card">

                {lastComplaint.image_data_url ? (
                  <img
                    src={lastComplaint.image_data_url}
                    alt={lastComplaint.title || "Complaint"}
                    className="last-complaint-image"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="last-complaint-image no-image">
                    No Image
                  </div>
                )}

                <div className="last-complaint-info">

                  <div className="complaint-field">
                    <strong>Complaint ID:</strong>
                    <span>#{lastComplaint.complaint_id}</span>
                  </div>

                  <div className="complaint-field">
                    <strong>Title:</strong>
                    <span>
                      {lastComplaint.title || "Not provided"}
                    </span>
                  </div>

                  <div className="complaint-field">
                    <strong>Location:</strong>
                    <span>
                      {lastComplaint.location ||
                        lastComplaint.address ||
                        "Location unavailable"}
                    </span>
                  </div>

                  <div className="complaint-field">
                    <strong>Date:</strong>
                    <span>
                      <Calendar size={14} style={{ display: "inline", marginRight: "4px" }} />
                      {formatDate(
                        lastComplaint.created_at ||
                        lastComplaint.date
                      )}
                    </span>
                  </div>

                  {lastComplaint.description && (
                    <div className="complaint-field">
                      <strong>Description:</strong>
                      <p>
                        {lastComplaint.description}
                      </p>
                    </div>
                  )}

                  <div className="complaint-field">
                    <strong>Status:</strong>
                    <span
                      className={`status ${
                        (lastComplaint.status || "pending")
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                      }`}
                    >
                      {lastComplaint.status || "Pending"}
                    </span>
                  </div>

                  <button
                    className="track-button"
                    onClick={() =>
                      handleComplaintClick(
                        lastComplaint.id ||
                        lastComplaint.complaint_id
                      )
                    }
                  >
                    Track Complaint
                  </button>
                </div>
              </div>
            </section>
          ) : (

            /* ================= NO COMPLAINT ================= */
            <section className="no-complaint-card">
              <div className="no-complaint-icon"><FileText size={36} color="#FF007A" /></div>

              <h2>No complaints yet</h2>

              <p>
                You haven't raised any civic complaints yet.
                Help make your community better by reporting an issue.
              </p>

              <button
                onClick={() => navigate("/raise-complaint")}
                className="primary-button"
              >
                + Raise Your First Complaint
              </button>
            </section>
          )}

          {/* ================= TWO COLUMN ================= */}
          <div className="dashboard-grid">

            {/* ================= YOUR COMPLAINTS ================= */}
            <section className="complaints-section">
              <div className="section-header">
                <div>
                  <span className="section-icon"><FileText size={18} /></span>
                  <h2>Your Complaints</h2>
                </div>

                <button
                  className="view-all"
                  onClick={() => navigate("/my-complaints")}
                >
                  View All
                </button>
              </div>

              <div className="complaints-list">

                {recentComplaints.length > 0 ? (
                  recentComplaints.map((complaint) => {
                    const complaintId =
                      complaint.id || complaint.complaint_id;

                    return (
                      <div
                        className="complaint-row"
                        key={complaintId}
                        onClick={() =>
                          handleComplaintClick(complaintId)
                        }
                      >

                        {complaint.image_data_url ? (
                          <img
                            src={complaint.image_data_url}
                            alt={
                              complaint.title ||
                              complaint.category ||
                              "Complaint"
                            }
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="complaint-no-image">
                            <FileText size={24} color="#94A3B8" />
                          </div>
                        )}

                        <div className="complaint-row-info">
                          <div className="complaint-field">
                            <strong>ID:</strong>
                            <span>#{complaint.complaint_id}</span>
                          </div>

                          <div className="complaint-field">
                            <strong>Title:</strong>
                            <span>
                              {complaint.title || "Not provided"}
                            </span>
                          </div>

                          <div className="complaint-field">
                            <strong>Location:</strong>
                            <span>
                              {complaint.location ||
                                complaint.address ||
                                "Location unavailable"}
                            </span>
                          </div>

                          <div className="complaint-field">
                            <strong>Date:</strong>
                            <span>
                              <Calendar size={14} style={{ display: "inline", marginRight: "4px" }} />
                              {formatDate(
                                complaint.created_at ||
                                complaint.date
                              )}
                            </span>
                          </div>

                          {complaint.description && (
                            <div className="complaint-field">
                              <strong>Description:</strong>
                              <p className="complaint-description">
                                {complaint.description}
                              </p>
                            </div>
                          )}
                        </div>

                        <span
                          className={`status ${
                            (complaint.status || "pending")
                              .toLowerCase()
                              .replace(/\s+/g, "-")
                          }`}
                        >
                          {complaint.status || "Pending"}
                        </span>

                        <span className="arrow"><ChevronRight size={20} color="#FF007A" /></span>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-list">
                    No complaints found.
                  </div>
                )}

              </div>
            </section>

            {/* ================= RIGHT COLUMN ================= */}
            <aside className="right-column">

              {/* ================= QUICK ACTIONS ================= */}
              <section className="quick-actions">
                <h2>Quick Actions</h2>

                <div className="quick-grid">
                  <button
                    onClick={() => navigate("/raise-complaint")}
                  >
                    <span><PlusCircle size={24} color="#FF007A" /></span>
                    Raise
                    <br />
                    Complaint
                  </button>

                  <button
                    onClick={() => navigate("/my-complaints")}
                  >
                    <span><FileText size={24} color="#FF007A" /></span>
                    My
                    <br />
                    Complaint
                  </button>

                  <button
                    onClick={() => navigate("/profile")}
                  >
                    <span><User size={24} color="#FF007A" /></span>
                    Profile
                  </button>

                  <button
                    onClick={() => navigate("/help-support")}
                  >
                    <span><HelpCircle size={24} color="#FF007A" /></span>
                    Help & Support
                  </button>
                </div>
              </section>

              {/* ================= NOTIFICATIONS ================= */}
              <section className="notifications-section">
                <div className="section-header">
                  <div>
                    <span className="section-icon"><Bell size={18} /></span>
                    <h2>Recent Notifications</h2>
                  </div>

                  <button
                    className="view-all"
                    onClick={() => navigate("/notifications")}
                  >
                    View All
                  </button>
                </div>

                <div className="notification-list">

                  {recentNotifications.length > 0 ? (
                    recentNotifications.map(
                      (notification, index) => (
                        <div
                          className="notification-item"
                          key={
                            notification.id ||
                            notification.notification_id ||
                            index
                          }
                        >
                          <div
                            className={`notification-icon ${
                              notification.type || "info"
                            }`}
                          >
                            {notification.icon || "i"}
                          </div>

                          <div>
                            <p>
                              {notification.message ||
                                notification.text ||
                                "New notification"}
                            </p>

                            <small>
                              {notification.created_at
                                ? formatDate(
                                    notification.created_at
                                  )
                                : ""}
                            </small>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <div className="empty-list">
                      No notifications yet.
                    </div>
                  )}

                </div>
              </section>

            </aside>
          </div>
        </section>

        {/* ================= FOOTER ================= */}
        <footer className="citizen-footer">
          <p>
            © 2026 AI CivicGuard. All rights reserved.
          </p>

          <div>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Use</a>
            <a href="#">Contact Us</a>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default CitizenDashboard;