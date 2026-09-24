import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Shield, ChevronRight, LogOut } from "lucide-react";
import "./Navbar.css";

export const Navbar = ({
  title = "Officer Portal",
  breadcrumbs = [],
  onMenuClick
}) => {
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const officerName = user.full_name || user.name || "Officer";
  const officerEmail = user.email || "Email unavailable";
  const officerInitials = officerName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "O";

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("officer_id");
    setProfileOpen(false);
    navigate("/officer/login");
  };

  return (
    <header className="officer-navbar">
      <div className="navbar-left">
        <button
          type="button"
          className="navbar-menu-toggle"
          onClick={onMenuClick}
          aria-label="Open Navigation"
        >
          <Menu size={20} />
        </button>

        <div className="navbar-headings">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="navbar-breadcrumbs">
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="breadcrumb-item">
                  {idx > 0 && <ChevronRight size={12} className="breadcrumb-separator" />}
                  {crumb.path ? (
                    <Link to={crumb.path} className="breadcrumb-link">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="breadcrumb-current">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className="navbar-title">{title}</h1>
        </div>
      </div>

      <div className="navbar-right">
        <Link to="/officer/ai-analysis" className="navbar-icon-btn" title="AI Governance Status">
          <Shield size={18} />
        </Link>

        <div className="navbar-profile" ref={profileRef}>
          <button
            type="button"
            className={`navbar-user-chip ${profileOpen ? "is-open" : ""}`}
            onClick={() => setProfileOpen((isOpen) => !isOpen)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label={`Open profile menu for ${officerName}`}
          >
            <div className="navbar-user-avatar">{officerInitials}</div>
            <span className="navbar-user-details">
              <strong className="navbar-user-name">{officerName}</strong>
              <span className="navbar-user-email">{officerEmail}</span>
            </span>
            <ChevronRight className="navbar-profile-chevron" size={15} />
          </button>

          {profileOpen && (
            <div className="navbar-profile-menu" role="menu">
              <div className="navbar-profile-summary">
                <div className="navbar-profile-summary-avatar">{officerInitials}</div>
                <div>
                  <strong>{officerName}</strong>
                  <span>{officerEmail}</span>
                </div>
              </div>
              <div className="navbar-profile-divider" />
              <button type="button" className="navbar-profile-menu-item" onClick={handleLogout} role="menuitem">
                <LogOut size={16} />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
