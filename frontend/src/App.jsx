import { Routes, Route } from "react-router-dom";
import AnimatedGradient from "./components/AnimatedGradient";

// Public Pages
import Home from "./pages/Home/home";
import Login from "./pages/login/Login";
import Registration from "./pages/login/Registration";

// Citizen Pages
import CitizenDashboard from "./pages/CitizenDashboard/CitizenDashboard";
import RaiseComplaint from "./pages/CitizenDashboard/RaiseComplaint";
import MyComplaints from "./pages/CitizenDashboard/MyComplaints";
import Profile from "./pages/CitizenDashboard/Profile";
import Notifications from "./pages/CitizenDashboard/Notifications";
import ComplaintTracking from "./pages/CitizenDashboard/ComplaintTracking";
import HelpSupport from "./pages/CitizenDashboard/HelpSupport";
import AccountSuspended from "./pages/CitizenDashboard/AccountSuspended";

// Officer Pages
import OfficerLogin from "./pages/officer/OfficerLogin";
import OfficerRegister from "./pages/officer/OfficerRegister";
import OfficerDashboard from "./pages/officer/OfficerDashboard";
import OfficerComplaints from "./pages/officer/OfficerComplaints";
import OfficerComplaintDetails from "./pages/officer/OfficerComplaintDetails";
import AIAnalysis from "./pages/officer/AIAnalysis";
import PriorityQueue from "./pages/officer/PriorityQueue";
import Departments from "./pages/officer/Departments";
import Officers from "./pages/officer/Officers";
import FieldWorkerManagement from "./pages/officer/FieldWorkerManagement";
import Analytics from "./pages/officer/Analytics";
import FieldWorkerLogin from "./pages/fieldworker/FieldWorkerLogin";
import FieldWorkerDashboard from "./pages/fieldworker/FieldWorkerDashboard";
import FieldWorkerComplaint from "./pages/fieldworker/FieldWorkerComplaint";
import AdminLogin from "./pages/Admin/AdminLogin";

export default function App() {
  return (
    <>
      <div 
        className="gradient-bg-container"
        style={{ 
          position: "fixed", 
          inset: 0, 
          zIndex: 0, 
          pointerEvents: "none", 
          opacity: 0.65,
          overflow: "hidden"
        }}
      >
        <AnimatedGradient 
          config={{
            preset: "custom",
            color1: "#0A0C14",
            color2: "#180B28",
            color3: "#FF007A",
            rotation: -45,
            proportion: 60,
            scale: 0.6,
            speed: 15,
            distortion: 40,
            swirl: 80,
            swirlIterations: 10,
            softness: 100,
            shape: "Edge",
            shapeSize: 50
          }}
          noise={{ opacity: 0.4 }}
        />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Registration />} />

          {/* Citizen Pages */}
          <Route path="/dashboard" element={<CitizenDashboard />} />
          <Route path="/raise-complaint" element={<RaiseComplaint />} />
          <Route path="/my-complaints" element={<MyComplaints />} />
          <Route path="/complaints/:complaintId" element={<ComplaintTracking />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/help-support" element={<HelpSupport />} />
          <Route path="/account-suspended" element={<AccountSuspended />} />
          <Route path="/citizen/account-suspended" element={<AccountSuspended />} />

          {/* Officer Pages */}
          <Route path="/officer/login" element={<OfficerLogin />} />
          <Route path="/officer/register" element={<OfficerRegister />} />
          <Route path="/officer/dashboard" element={<OfficerDashboard />} />
          <Route path="/officer/complaints" element={<OfficerComplaints />} />
          <Route path="/officer/complaints/:complaintId" element={<OfficerComplaintDetails />} />
          <Route path="/officer/ai-analysis" element={<AIAnalysis />} />
          <Route path="/officer/priority-queue" element={<PriorityQueue />} />
          <Route path="/officer/departments" element={<Departments />} />
          <Route path="/officer/officers" element={<Officers />} />
          <Route path="/officer/field-workers" element={<FieldWorkerManagement />} />
          <Route path="/officer/analytics" element={<Analytics />} />

          {/* Field Worker Pages */}
          <Route path="/field-worker/login" element={<FieldWorkerLogin />} />
          <Route path="/field-worker/dashboard" element={<FieldWorkerDashboard />} />
          <Route path="/field-worker/complaint/:complaintId" element={<FieldWorkerComplaint />} />

          {/* Admin Pages */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<OfficerDashboard />} />
          <Route path="/admin/complaints" element={<OfficerComplaints />} />
          <Route path="/admin/officers" element={<Officers />} />
          <Route path="/admin/live-map" element={<AIAnalysis />} />
        </Routes>
      </div>
    </>
  );
}