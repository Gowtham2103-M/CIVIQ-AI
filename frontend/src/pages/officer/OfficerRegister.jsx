import  { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Shield,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Building2,
  Briefcase,
  IdCard,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserPlus
} from "lucide-react";
import Silk from "../../components/Silk";
import "./OfficerRegister.css";

const API_BASE_URL = "http://localhost:5000";

const DEPARTMENTS = [
  "Roads & Infrastructure",
  "Electrical Department",
  "Water Supply & Sewerage",
  "Sanitation & Waste Management",
  "Public Health & Environment",
  "Town Planning & Building",
  "Civic Infrastructure & Maintenance Department",
  "Public Works Department",
  "Municipal Corporation / General Civic Administration"
];

const DESIGNATIONS = [
  "Assistant Engineer",
  "Junior Engineer",
  "Executive Engineer",
  "Ward Inspector",
  "Sanitary Inspector",
  "Nodal Officer",
  "Chief Municipal Officer",
  "Zonal Commissioner"
];

export const OfficerRegister = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    phone: "",
    address: "",
    city: "",
    district: "",
    state: "Karnataka",
    pincode: "",
    department: "Roads & Infrastructure",
    designation: "Assistant Engineer",
    employee_code: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.full_name || !formData.email || !formData.password || !formData.department) {
      setError("Please complete all required fields.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/officer/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Registration failed.");
      }

      setSuccess("Registration successful! Redirecting to login...");

      setTimeout(() => {
        navigate("/officer/login");
      }, 1200);
    } catch (err) {
      console.error("Officer registration error:", err);
      setError(err.message || "Failed to register officer account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="officer-register-page">
      <div className="silk-background-layer">
        <Silk color="#2563EB" />
      </div>
      <div className="officer-register-container">
        {/* Header */}
        <div className="reg-header">
          <div className="reg-brand-badge">
            <Shield className="reg-shield-icon" />
          </div>
          <h2>CivIQ AI Officer Registration</h2>
          <p>Register as an authorized civic administration officer</p>
        </div>

        {/* Card */}
        <div className="reg-card">
          <div className="reg-card-top">
            <UserPlus className="reg-card-icon" />
            <div>
              <h3>Officer Account Details</h3>
              <span>Official credentials and departmental assignment</span>
            </div>
          </div>

          {error && (
            <div className="reg-alert error">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="reg-alert success">
              <CheckCircle2 size={17} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="reg-form">
            {/* Row 1: Name & Email */}
            <div className="form-row">
              <div className="form-group">
                <label>Full Name *</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={17} />
                  <input
                    type="text"
                    name="full_name"
                    placeholder="e.g. Arun Kumar"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Official Email *</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={17} />
                  <input
                    type="email"
                    name="email"
                    placeholder="arun.kumar@civicguard.gov"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Passwords */}
            <div className="form-row">
              <div className="form-group">
                <label>Password *</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={17} />
                  <input
                    type="password"
                    name="password"
                    placeholder="Min 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Confirm Password *</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={17} />
                  <input
                    type="password"
                    name="confirm_password"
                    placeholder="Repeat password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Department & Designation */}
            <div className="form-row">
              <div className="form-group">
                <label>Department *</label>
                <div className="input-wrapper">
                  <Building2 className="input-icon" size={17} />
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    required
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Designation *</label>
                <div className="input-wrapper">
                  <Briefcase className="input-icon" size={17} />
                  <select
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                  >
                    {DESIGNATIONS.map((desig) => (
                      <option key={desig} value={desig}>
                        {desig}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 4: Phone & Employee Code */}
            <div className="form-row">
              <div className="form-group">
                <label>Official Phone Number</label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={17} />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Employee Code</label>
                <div className="input-wrapper">
                  <IdCard className="input-icon" size={17} />
                  <input
                    type="text"
                    name="employee_code"
                    placeholder="e.g. CG-OFF-2026-08"
                    value={formData.employee_code}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Row 5: Location Details */}
            <div className="form-row location-row">
              <div className="form-group">
                <label>City</label>
                <div className="input-wrapper">
                  <MapPin className="input-icon" size={17} />
                  <input
                    type="text"
                    name="city"
                    placeholder="Bengaluru"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>District</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    name="district"
                    placeholder="Bengaluru Urban"
                    value={formData.district}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Pincode</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    name="pincode"
                    placeholder="560001"
                    value={formData.pincode}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="reg-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="btn-spinner" size={17} />
                  <span>Registering Officer...</span>
                </>
              ) : (
                <>
                  <span>Create Officer Account</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="reg-card-footer">
            <p>
              Already registered?{" "}
              <Link to="/officer/login" className="reg-link">
                Sign in to Officer Portal
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficerRegister;
