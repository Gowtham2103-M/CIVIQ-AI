import  { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import Silk from "../../components/Silk";
import "./OfficerLogin.css";

const API_BASE_URL = "http://localhost:5000";

export const OfficerLogin = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email || !password) {
      setError("Please enter your official email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/officer/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Authentication failed.");
      }

      // Save officer session
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("officer_id", data.user.id || data.user.officer_id);

      setSuccess("Authentication successful. Redirecting to officer dashboard...");

      setTimeout(() => {
        navigate("/officer/dashboard");
      }, 600);
    } catch (err) {
      console.error("Officer login error:", err);
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="officer-auth-page">
      <div className="silk-background-layer">
        <Silk color="#2563EB" />
      </div>
      <div className="officer-auth-container">
        {/* Header / Brand */}
        <div className="auth-header">
          <div className="auth-brand-badge">
            <Shield className="auth-shield-icon" />
          </div>
          <h2>CivIQ AI Officer Portal</h2>
          <p>Authorized Municipal & Governance Access</p>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card-top">
            <UserCheck className="auth-card-icon" />
            <div>
              <h3>Officer Sign In</h3>
              <span>Access assigned civic complaints & governance metrics</span>
            </div>
          </div>

          {error && (
            <div className="auth-alert error">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="auth-alert success">
              <CheckCircle2 size={17} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="officer-email">Official Email</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={17} />
                <input
                  id="officer-email"
                  type="email"
                  placeholder="officer@civicguard.gov"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="officer-password">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={17} />
                <input
                  id="officer-password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="btn-spinner" size={17} />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="auth-card-divider" />

          <div className="auth-card-footer">
            <p>
              New municipal officer?{" "}
              <Link to="/officer/register" className="auth-link">
                Register officer account
              </Link>
            </p>
            <p className="citizen-switch">
              Citizen looking to file a complaint?{" "}
              <Link to="/login" className="auth-link secondary">
                Citizen Portal
              </Link>
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="auth-security-footer">
          <Shield size={14} />
          <span>Secured with Argon2 password hashing & JWT token verification</span>
        </div>
      </div>
    </div>
  );
};

export default OfficerLogin;
