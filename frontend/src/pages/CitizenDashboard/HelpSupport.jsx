import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  HelpCircle, 
  ArrowLeft, 
  PlusCircle, 
  FileText, 
  User, 
  Bell, 
  Mail, 
  Phone, 
  ShieldCheck, 
  LayoutDashboard, 
  LifeBuoy,
  Search,
  ChevronDown,
  ChevronUp,
  Send,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Droplets,
  Zap,
  Trash2
} from "lucide-react";
import "./HelpSupport.css";

const HelpSupport = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [inquirySubject, setInquirySubject] = useState("");
  const [inquiryCategory, setInquiryCategory] = useState("general");
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");

  const supportItems = [
    {
      icon: PlusCircle,
      title: "Raise a Complaint",
      description: "Report civic issues such as potholes, garbage dump, streetlights with photo proof and GPS coordinates.",
      action: () => navigate("/raise-complaint"),
      tag: "Submit Issue"
    },
    {
      icon: FileText,
      title: "Track Progress",
      description: "Monitor assigned field workers, view resolution evidence, and track SLA completion progress.",
      action: () => navigate("/my-complaints"),
      tag: "Live Tracking"
    },
    {
      icon: User,
      title: "Profile Management",
      description: "Update personal profile, address details, phone number, and change account security settings.",
      action: () => navigate("/profile"),
      tag: "Account Settings"
    },
    {
      icon: Bell,
      title: "Notifications & Alerts",
      description: "Check status change alerts, municipal notifications, and broadcast announcements.",
      action: () => navigate("/notifications"),
      tag: "Recent Updates"
    },
  ];

  const faqs = [
    {
      question: "How does AI CivicGuard automatically route and assign complaints?",
      answer: "When you submit a complaint with photo and location evidence, our AI engine categorizes the issue (e.g., Road Maintenance, Sanitation, Electrical) and routes it directly to the designated department and field worker in your zone for immediate action."
    },
    {
      question: "What evidence is required when raising a civic complaint?",
      answer: "We recommend taking a clear photo of the issue at the site and enabling location permissions on your device. The portal captures precise GPS coordinates to help field workers pinpoint the exact spot without delay."
    },
    {
      question: "What are the standard SLA timelines for complaint resolution?",
      answer: "Standard civic issues are assigned within 2-4 hours. Critical issues (e.g., open manholes, hazardous electrical wires) have a 24-hour resolution SLA, while standard road repairs typically take 48-72 hours."
    },
    {
      question: "Can I track the real-time status and resolution evidence?",
      answer: "Yes! Open the 'My Complaints' section from the sidebar to view status progression (Assigned → In Progress → Evidence Submitted → Resolved). You can also view the photo uploaded by the field worker upon completion."
    },
    {
      question: "What should I do if a complaint is closed without proper resolution?",
      answer: "If you are unsatisfied with the resolution evidence provided, you can use the 'Reopen Complaint' button on your complaint details page to escalate the issue back to the zonal officer."
    },
    {
      question: "How do I update my profile details and notification preferences?",
      answer: "Navigate to the 'Profile' section from the sidebar menu. You can edit your phone number, residential address, email preferences, and update your login password at any time."
    }
  ];

  const helplines = [
    {
      icon: Flame,
      title: "Fire & Rescue Control",
      number: "101 / 080-22971500",
      description: "24/7 Fire emergency & rescue ops"
    },
    {
      icon: Droplets,
      title: "Water Supply & Sewerage",
      number: "1916 / 080-22945100",
      description: "Pipeline bursts & severe blockage"
    },
    {
      icon: Zap,
      title: "Electricity Grid Support",
      number: "1912 / 080-22873333",
      description: "Power outages & fallen wires"
    },
    {
      icon: Trash2,
      title: "Sanitation & Waste Disposal",
      number: "1800-425-1080",
      description: "Garbage overflow & hygiene emergency"
    }
  ];

  const handleInquirySubmit = (e) => {
    e.preventDefault();
    if (!inquirySubject.trim() || !inquiryMessage.trim()) return;

    setSubmittedMessage("Thank you! Your support inquiry has been submitted. Ticket #SUP-" + Math.floor(10000 + Math.random() * 90000));
    setInquirySubject("");
    setInquiryMessage("");

    setTimeout(() => {
      setSubmittedMessage("");
    }, 6000);
  };

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="help-support-layout">
      {/* ================= SIDEBAR ================= */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <ShieldCheck size={22} color="#FFFFFF" />
          </div>
          <div>
            <h2>AI CivicGuard</h2>
            <span>Citizen Portal</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          <button onClick={() => navigate("/dashboard")} className="menu-item">
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button onClick={() => navigate("/raise-complaint")} className="menu-item">
            <PlusCircle size={18} />
            <span>Raise Complaint</span>
          </button>

          <button onClick={() => navigate("/my-complaints")} className="menu-item">
            <FileText size={18} />
            <span>My Complaints</span>
          </button>

          <button onClick={() => navigate("/notifications")} className="menu-item">
            <Bell size={18} />
            <span>Notifications</span>
          </button>

          <button onClick={() => navigate("/profile")} className="menu-item">
            <User size={18} />
            <span>Profile</span>
          </button>

          <button onClick={() => navigate("/help-support")} className="menu-item active">
            <HelpCircle size={18} />
            <span>Help & Support</span>
          </button>
        </nav>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="help-main-content">
        <div className="help-container">
          
          {/* HEADER HERO BANNER */}
          <div className="help-hero-banner">
            <div className="hero-top">
              <button className="back-button" onClick={() => navigate("/dashboard")}>
                <ArrowLeft size={16} />
                <span>Back to Dashboard</span>
              </button>
              <span className="help-badge">24/7 CITIZEN SUPPORT PORTAL</span>
            </div>

            <div className="hero-content">
              <div className="hero-text">
                <h1>How can we help you today?</h1>
                <p>
                  Explore quick guides, search frequently asked questions, access municipal helplines, or submit a support inquiry.
                </p>
              </div>

              {/* SEARCH BAR */}
              <div className="help-search-wrapper">
                <Search size={20} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search help topics, FAQs, resolution SLA, complaint status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* QUICK SERVICES GRID */}
          <div className="section-title-wrapper">
            <h2>Quick Portals & Guides</h2>
            <p>Access key citizen features with step-by-step guidance</p>
          </div>

          <div className="support-grid">
            {supportItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <div key={item.title} className="support-card" onClick={item.action}>
                  <div className="support-card-top">
                    <div className="support-icon-box">
                      <IconComponent size={24} color="#FF007A" />
                    </div>
                    <span className="card-tag">{item.tag}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              );
            })}
          </div>

          {/* FAQ SECTION & HELPLINES (2 COLUMN GRID) */}
          <div className="help-two-column">
            
            {/* FAQ ACCORDION */}
            <div className="faq-section-card">
              <div className="card-heading">
                <HelpCircle size={22} color="#00D2FF" />
                <div>
                  <h2>Frequently Asked Questions</h2>
                  <p>Quick answers to common citizen queries</p>
                </div>
              </div>

              <div className="faq-list">
                {filteredFaqs.length === 0 ? (
                  <div className="no-faq">No help articles match your search query.</div>
                ) : (
                  filteredFaqs.map((faq, index) => {
                    const isOpen = openFaqIndex === index;
                    return (
                      <div 
                        key={index} 
                        className={`faq-item ${isOpen ? "open" : ""}`}
                        onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                      >
                        <div className="faq-question">
                          <span>{faq.question}</span>
                          {isOpen ? <ChevronUp size={18} color="#FF007A" /> : <ChevronDown size={18} color="#94A3B8" />}
                        </div>
                        {isOpen && (
                          <div className="faq-answer">
                            <p>{faq.answer}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* HELPLINES & CONTACT SUPPORT */}
            <div className="side-support-column">
              
              {/* EMERGENCY HELPLINES */}
              <div className="helpline-card">
                <div className="card-heading">
                  <PhoneCall size={22} color="#FF007A" />
                  <div>
                    <h2>Emergency Helplines</h2>
                    <p>Direct municipal emergency response units</p>
                  </div>
                </div>

                <div className="helpline-grid">
                  {helplines.map((h, i) => {
                    const HIcon = h.icon;
                    return (
                      <div key={i} className="helpline-item">
                        <div className="helpline-icon">
                          <HIcon size={20} color="#00D2FF" />
                        </div>
                        <div>
                          <strong>{h.title}</strong>
                          <span className="helpline-num">{h.number}</span>
                          <small>{h.description}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DIRECT CONTACT STRIP */}
              <div className="contact-support-card">
                <div className="contact-header">
                  <h2>Civic Help Desk</h2>
                  <p>Our team is available 24/7 for escalation.</p>
                </div>

                <div className="contact-details">
                  <div className="contact-item">
                    <Mail size={18} color="#00D2FF" />
                    <span>support@civicguard.org</span>
                  </div>
                  <div className="contact-item">
                    <Phone size={18} color="#FF007A" />
                    <span>1800-CIVIC-GUARD</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* SUPPORT INQUIRY FORM */}
          <div className="inquiry-form-card">
            <div className="card-heading">
              <Send size={22} color="#00D2FF" />
              <div>
                <h2>Send a Direct Support Message</h2>
                <p>Have an unresolved issue or technical question? Send a message to our support team.</p>
              </div>
            </div>

            {submittedMessage && (
              <div className="inquiry-success">
                <CheckCircle2 size={20} color="#00D2FF" />
                <span>{submittedMessage}</span>
              </div>
            )}

            <form onSubmit={handleInquirySubmit} className="inquiry-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Inquiry Subject *</label>
                  <input
                    type="text"
                    placeholder="Brief title of your question or issue"
                    value={inquirySubject}
                    onChange={(e) => setInquirySubject(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={inquiryCategory}
                    onChange={(e) => setInquiryCategory(e.target.value)}
                  >
                    <option value="general">General Support</option>
                    <option value="technical">Technical Portal Issue</option>
                    <option value="complaint_query">Complaint Status Inquiry</option>
                    <option value="account">Account & Profile Assistance</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Detailed Description *</label>
                <textarea
                  rows={4}
                  placeholder="Describe your inquiry or issue in detail..."
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="submit-inquiry-btn">
                <Send size={18} />
                <span>Submit Support Inquiry</span>
              </button>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
};

export default HelpSupport;
