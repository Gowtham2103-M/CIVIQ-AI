import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Brain,
  ShieldAlert,
  Building2,
  Users,
  UserCog,
  BarChart3,
  LogOut,
  X,
  Shield,
  ArrowRightCircle,
  Bell
} from "lucide-react";
import "./Sidebar.css";

export const Sidebar = ({ mobileOpen, setMobileOpen, unreadCount = 0, assignedCount = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const officerName = user.full_name || user.name || "Officer";
  const officerDept = user.department || "Civic Administration";
  const officerDesignation = user.designation || "Officer";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("officer_id");
    navigate("/officer/login");
  };

  const navItems = [
    {
      to: "/officer/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
    },
    {
      to: "/officer/complaints",
      icon: ClipboardList,
      label: "Complaints",
      badge: assignedCount > 0 ? assignedCount : null,
    },
    {
      to: "/officer/ai-analysis",
      icon: Brain,
      label: "AI Analysis",
    },
    {
      to: "/officer/priority-queue",
      icon: ShieldAlert,
      label: "Priority Queue",
    },
    {
      to: "/officer/departments",
      icon: Building2,
      label: "Departments",
    },
    {
      to: "/officer/officers",
      icon: Users,
      label: "Officers",
    },
    {
      to: "/officer/field-workers",
      icon: UserCog,
      label: "Field Worker Management",
    },
    {
      to: "/officer/analytics",
      icon: BarChart3,
      label: "Analytics",
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="officer-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`officer-sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-icon-box">
            <Shield className="brand-icon" />
          </div>
          <div className="brand-text">
            <h3>CivIQ AI</h3>
            <span>Officer Portal</span>
          </div>
          {mobileOpen && (
            <button
              className="sidebar-close-btn"
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Officer Profile Badge */}
        <div className="sidebar-officer-badge">
          <div className="officer-avatar-circle">
            {officerName.charAt(0).toUpperCase()}
          </div>
          <div className="officer-meta">
            <h4>{officerName}</h4>
            <p>{officerDesignation}</p>
            <span className="officer-dept-tag">{officerDept}</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">MAIN NAVIGATION</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="nav-item-icon" />
                <span className="nav-item-label">{item.label}</span>
                {item.badge !== null && item.badge !== undefined && (
                  <span className="nav-item-badge">{item.badge}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="sidebar-footer">
          <NavLink to="/dashboard" className="sidebar-switch-portal">
            <ArrowRightCircle size={16} />
            <span>Citizen Portal</span>
          </NavLink>

          <button className="sidebar-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
