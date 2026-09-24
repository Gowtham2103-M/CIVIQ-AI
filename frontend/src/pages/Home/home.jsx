import { useState, useEffect } from "react";
import "./home.css";
import { useNavigate } from "react-router-dom";

function createRipple(e) {
  const button = e.currentTarget;
  const circle = document.createElement("span");
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;
  const rect = button.getBoundingClientRect();

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${e.clientX - rect.left - radius}px`;
  circle.style.top = `${e.clientY - rect.top - radius}px`;
  circle.classList.add("ripple-effect");

  const existingRipple = button.getElementsByClassName("ripple-effect")[0];

  if (existingRipple) {
    existingRipple.remove();
  }

  button.appendChild(circle);
}

function Preloader() {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setFadeOut(true);
    }, 1000);

    const timer2 = setTimeout(() => {
      setLoading(false);
    }, 1600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  if (!loading) return null;

  return (
    <div className={`site-preloader ${fadeOut ? "fade-out" : ""}`}>
      <div className="preloader-brand">
        <span className="preloader-mark">CIQ</span>
        <span className="preloader-name">CivIQ AI</span>
      </div>

      <div className="preloader-bar-bg">
        <div className="preloader-bar-fill"></div>
      </div>

      <div className="preloader-sub">
        AI-Powered Civic Intelligence Platform
      </div>
    </div>
  );
}

function NavTransitionOverlay({ active }) {
  return (
    <div className={`nav-transition-overlay ${active ? "active" : ""}`}>
      <div className="nav-transition-spinner"></div>
    </div>
  );
}

function Navbar({ onNavClick }) {
  return (
    <nav className="navbar">
      <div className="logo">CivIQ AI</div>

      <ul className="nav-links">
        <li><a href="#home">Home</a></li>
        <li><a href="#problem">Challenges</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#workflow">How It Works</a></li>
        <li><a href="#benefits">Impact</a></li>
        <li><a href="#screenshots">Platform</a></li>
      </ul>

      <div className="nav-actions">
        <button
          className="start-btn"
          onClick={(e) => {
            createRipple(e);
            onNavClick("/login");
          }}
        >
          Get Started
        </button>
      </div>
    </nav>
  );
}

function Hero({ onNavClick }) {
  return (
    <section id="home" className="hero">
      <div className="hero-left">
        <h1>
          Smarter Cities.
          <br />
          Faster <span>Solutions.</span>
        </h1>

        <p>
          CivIQ AI is an AI-powered civic issue management platform that
          helps citizens report public problems, intelligently analyzes
          complaints, prioritizes urgent issues, and connects them with the
          right authorities for faster resolution.
        </p>

        <button
          className="hero-btn"
          onClick={(e) => {
            createRipple(e);
            onNavClick("/login");
          }}
        >
          Report an Issue
        </button>
      </div>

      <div className="hero-right">
        <div className="glow-image-wrapper">
          <img
            src="https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=900"
            alt="Smart city civic management"
          />
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const problems = [
    {
      title: "Slow Issue Reporting",
      desc: "Citizens often face complicated and time-consuming processes to report civic problems.",
    },
    {
      title: "Wrong Department Routing",
      desc: "Complaints may be manually sent to the wrong department, causing unnecessary delays.",
    },
    {
      title: "No Smart Prioritization",
      desc: "Critical issues may not receive immediate attention based on their severity and risk.",
    },
    {
      title: "Poor Complaint Tracking",
      desc: "Citizens often do not know the current status or progress of their reported issues.",
    },
    {
      title: "Lack of Accountability",
      desc: "Without transparent tracking, monitoring complaint resolution becomes difficult.",
    },
    {
      title: "Repeated Civic Issues",
      desc: "Authorities may struggle to identify recurring problems and high-risk locations.",
    },
  ];

  return (
    <section id="problem" className="problem">
      <h2>Challenges We Solve</h2>

      <p className="title">
        CivIQ AI transforms traditional civic complaint management with
        intelligent automation and transparent tracking.
      </p>

      <div className="problem-grid">
        {problems.map((item, index) => (
          <div className="problem-card" key={index}>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      title: "AI Complaint Analysis",
      desc: "AI analyzes complaint descriptions and uploaded images to identify the civic issue.",
      icon: "AI",
    },
    {
      title: "Smart Department Routing",
      desc: "Automatically route complaints to the most appropriate government department.",
      icon: "RT",
    },
    {
      title: "Priority Scoring",
      desc: "Assess severity and risk to help authorities focus on urgent civic problems first.",
      icon: "PS",
    },
    {
      title: "Image Analysis",
      desc: "Analyze uploaded images to identify visible issues and damaged infrastructure.",
      icon: "IM",
    },
    {
      title: "Complaint Tracking",
      desc: "Citizens can monitor complaint status from submission to resolution.",
      icon: "TR",
    },
    {
      title: "Resolution Verification",
      desc: "Support AI-assisted verification and citizen confirmation before closing a complaint.",
      icon: "VR",
    },
  ];

  return (
    <section id="features" className="features">
      <h2>Core Features</h2>

      <p className="features-sub">
        Intelligent tools that connect citizens, AI systems and government
        authorities to improve civic issue resolution.
      </p>

      <div className="feature-grid">
        {features.map((item, index) => (
          <div className="feature-card" key={index}>
            <div className="feature-icon">{item.icon}</div>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Workflow() {
  const stepsTop = [
    { num: 1, title: "Citizen Reports an Issue" },
    { num: 2, title: "Upload Description and Evidence" },
    { num: 3, title: "AI Analyzes the Complaint" },
    { num: 4, title: "Issue Category Identified" },
    { num: 5, title: "Severity and Risk Scored" },
  ];

  // Bottom row displayed right-to-left (6 under 5, flowing to 9 under 1)
  const stepsBottom = [
    { num: 9, title: "Citizen Confirms Resolution" },
    { num: 8, title: "Resolution is Verified" },
    { num: 7, title: "Officer Reviews and Takes Action" },
    { num: 6, title: "Smart Department Routing" },
  ];

  return (
    <section id="workflow" className="workflow">
      <h2 className="workflow-title">How CivIQ AI Works</h2>

      <p className="workflow-sub">
        From reporting a civic issue to verifying its resolution, CivIQ AI
        creates a smarter and more transparent workflow.
      </p>

      <div className="pipeline-container">
        {/* SVG Glowing U-Shape Water Flowing Pipe Chain running BELOW number tags */}
        <svg className="pipeline-svg" viewBox="0 0 1000 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pipeWaterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF007A" />
              <stop offset="50%" stopColor="#E60067" />
              <stop offset="100%" stopColor="#00D2FF" />
            </linearGradient>

            <filter id="pipeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Dark Base Outer Pipe Line Below Number Tags: (100,85) to (900,85) -> U-bend -> (900,225) to (100,225) */}
          <path
            d="M 100 85 L 900 85 C 975 85, 975 225, 900 225 L 100 225"
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Animated Glowing Water Flowing Path */}
          <path
            d="M 100 85 L 900 85 C 975 85, 975 225, 900 225 L 100 225"
            fill="none"
            stroke="url(#pipeWaterGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="18 14"
            className="flowing-water-path"
            filter="url(#pipeGlow)"
          />
        </svg>

        {/* Top Row: Nodes 1 to 5 */}
        <div className="pipeline-row top-row">
          {stepsTop.map((item) => (
            <div className="pipeline-node" key={item.num}>
              <div className="node-circle-wrap">
                <div className="node-circle">{item.num}</div>
                <div className="node-stem"></div>
              </div>
              <p className="node-text">{item.title}</p>
            </div>
          ))}
        </div>

        {/* Bottom Row: Nodes 9 to 6 (Left to Right on screen: 9, 8, 7, 6) */}
        <div className="pipeline-row bottom-row">
          {stepsBottom.map((item) => (
            <div className="pipeline-node" key={item.num}>
              <div className="node-circle-wrap">
                <div className="node-circle">{item.num}</div>
                <div className="node-stem"></div>
              </div>
              <p className="node-text">{item.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  const benefits = [
    {
      title: "Smarter City Management",
      desc: "Use AI insights to identify civic problems and improve public services.",
      icon: "01",
    },
    {
      title: "Faster Resolution",
      desc: "Reduce delays through automated analysis, prioritization and department routing.",
      icon: "02",
    },
    {
      title: "Better Prioritization",
      desc: "Ensure high-risk and urgent civic issues receive attention first.",
      icon: "03",
    },
    {
      title: "Full Transparency",
      desc: "Provide clear complaint tracking for citizens, officers and administrators.",
      icon: "04",
    },
    {
      title: "Actionable Insights",
      desc: "Analyze complaint patterns, recurring issues and departmental performance.",
      icon: "05",
    },
    {
      title: "Citizen Trust",
      desc: "Build confidence through faster responses, accountability and visible progress.",
      icon: "06",
    },
  ];

  return (
    <section id="benefits" className="benefits">
      <h2>Why Choose CivIQ AI?</h2>

      <p className="benefits-sub">
        Building a more responsive, transparent and intelligent connection
        between citizens and public authorities.
      </p>

      <div className="benefit-grid">
        {benefits.map((item, index) => (
          <div className="benefit-card" key={index}>
            <div className="benefit-icon">{item.icon}</div>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Screenshots() {
  const images = [
    {
      title: "Citizen Dashboard",
      image:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900",
    },
    {
      title: "AI Complaint Analysis",
      image:
        "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=900",
    },
    {
      title: "Government Analytics",
      image:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900",
    },
  ];

  return (
    <section id="screenshots" className="screenshots">
      <h2>One Platform. Every Stakeholder.</h2>

      <p className="screenshots-sub">
        CivIQ AI provides dedicated experiences for citizens, government
        officers and administrators.
      </p>

      <div className="screen-grid">
        {images.map((item, index) => (
          <div className="screen-card" key={index}>
            <div className="glow-image-wrapper">
              <img src={item.image} alt={item.title} />
            </div>
            <h3>{item.title}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="footer" className="footer">
      <div className="footer-container">
        <div>
          <div className="footer-logo">CivIQ AI</div>

          <p className="footer-about">
            CivIQ AI is an AI-powered civic intelligence platform designed
            to make public issue reporting, routing, prioritization, tracking
            and resolution smarter, faster and more transparent.
          </p>
        </div>

        <div>
          <h4>Platform</h4>
          <ul>
            <li>Citizen Dashboard</li>
            <li>Officer Portal</li>
            <li>Admin Dashboard</li>
            <li>Analytics</li>
          </ul>
        </div>

        <div>
          <h4>Features</h4>
          <ul>
            <li>Raise Complaint</li>
            <li>AI Analysis</li>
            <li>Smart Routing</li>
            <li>Complaint Tracking</li>
          </ul>
        </div>

        <div>
          <h4>Support</h4>
          <ul>
            <li>Help Center</li>
            <li>FAQ</li>
            <li>Contact Us</li>
            <li>Privacy Policy</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="copyright">
          © 2026 CivIQ AI. Building Smarter Cities with AI.
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavClick = (path) => {
    setIsNavigating(true);

    setTimeout(() => {
      navigate(path);
    }, 450);
  };

  return (
    <div className="home-wrapper">
      <Preloader />

      <NavTransitionOverlay active={isNavigating} />

      <Navbar onNavClick={handleNavClick} />

      <Hero onNavClick={handleNavClick} />
      <Problem />
      <Features />
      <Workflow />
      <Benefits />
      <Screenshots />
      <Footer />
    </div>
  );
}