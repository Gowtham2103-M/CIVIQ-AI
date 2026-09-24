import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, AlertTriangle, ArrowLeft, Mail, Phone, HelpCircle, CreditCard } from "lucide-react";
import Silk from "../../components/Silk";
import "./AccountSuspended.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const AccountSuspended = () => {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [transactionId, setTransactionId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAccountStatus = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("Please log in again to view your account status.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/violations/account-status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load account status.");
        }

        if (data.account_status !== "SUSPENDED") {
          navigate("/dashboard", { replace: true });
          return;
        }

        setAccount(data);
      } catch (statusError) {
        setError(statusError.message || "Unable to load account status.");
      } finally {
        setLoading(false);
      }
    };

    void loadAccountStatus();
  }, [navigate]);

  const confirmPayment = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!transactionId.trim()) {
      setError("Enter the transaction ID from your completed payment.");
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/api/violations/payment-confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction_id: transactionId.trim(),
            payment_method: paymentMethod,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Payment confirmation failed.");
      }

      setMessage("Payment confirmed. Your account has been unlocked.");
      setTimeout(() => navigate("/dashboard", { replace: true }), 900);
    } catch (paymentError) {
      setError(paymentError.message || "Payment confirmation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="account-suspended-page">
      <div className="silk-background-layer">
        <Silk color="#10B981" />
      </div>

      <div className="suspended-container">
        <div className="suspended-card">
          <div className="suspended-icon-box">
            <ShieldAlert size={40} className="suspended-icon" />
          </div>

          <div className="suspended-badge">ACCOUNT STATUS: SUSPENDED</div>

          <h1>Account Temporarily Suspended</h1>

          {loading ? (
            <p className="suspended-description">Loading account status...</p>
          ) : (
            <>
              <p className="suspended-description">
                Your account reached three unwanted image upload violations and is locked until the penalty is paid.
              </p>

              <div className="penalty-box">
                <span>Unlock penalty</span>
                <strong>₹{Number(account?.penalty_amount || 0).toFixed(2)}</strong>
                <small>{account?.violation_count || 3} violations recorded</small>
              </div>

              <form className="payment-form" onSubmit={confirmPayment}>
                <label htmlFor="payment-method">Payment method</label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="NETBANKING">Net banking</option>
                </select>

                <label htmlFor="transaction-id">Transaction ID</label>
                <input
                  id="transaction-id"
                  value={transactionId}
                  onChange={(event) => setTransactionId(event.target.value)}
                  placeholder="Enter completed payment transaction ID"
                  autoComplete="off"
                />

                {error && <p className="payment-error">{error}</p>}
                {message && <p className="payment-success">{message}</p>}

                <button className="pay-unlock-btn" type="submit" disabled={submitting}>
                  <CreditCard size={17} />
                  <span>{submitting ? "Confirming payment..." : "Confirm payment and unlock"}</span>
                </button>
              </form>
            </>
          )}

          <div className="suspended-reasons-box">
            <h3>Possible Reasons for Suspension</h3>
            <ul>
              <li>
                <AlertTriangle size={15} />
                <span>Multiple automated or duplicate complaint submissions</span>
              </li>
              <li>
                <AlertTriangle size={15} />
                <span>Pending identity or contact detail verification</span>
              </li>
              <li>
                <AlertTriangle size={15} />
                <span>Administrative flag by municipal compliance officers</span>
              </li>
            </ul>
          </div>

          <div className="suspended-actions">
            <button className="primary-support-btn" onClick={() => navigate("/help-support")}>
              <HelpCircle size={17} />
              <span>Contact Support & Appeal</span>
            </button>

            <button className="secondary-home-btn" onClick={() => navigate("/")}>
              <ArrowLeft size={17} />
              <span>Back to Home</span>
            </button>
          </div>

          <div className="suspended-contact-info">
            <div>
              <Mail size={14} />
              <span>compliance@civiq.ai</span>
            </div>
            <div>
              <Phone size={14} />
              <span>+91 1800-11-CIVIC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSuspended;
