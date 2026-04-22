/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Calendar as CalendarIcon, 
  Bell, 
  User, 
  Plus,
  BookOpen,
  Code,
  Database,
  School,
  LogOut,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import Dashboard from './components/Dashboard';
import GuidanceList from './components/GuidanceList';
import LandingPage from './components/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import StudentManagement from './components/StudentManagement';
import GuidanceReview from './components/GuidanceReview';
import GuidanceSessions from './components/GuidanceSessions';
import SessionReview from './components/SessionReview';
import ProfileUpdate from './components/ProfileUpdate';
import { cn } from './lib/utils';
import { db } from './lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';

export type StudentView = 'dashboard' | 'proposals' | 'sessions';
export type AdminView = 'dashboard' | 'students' | 'proposals_review' | 'sessions_review';

export default function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [nim, setNim] = useState<string | null>(localStorage.getItem('student_nim'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(true);
  const [isVerifyingProfile, setIsVerifyingProfile] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);

  const isAdmin = nim === '15081992';

  useEffect(() => {
    if (nim) {
      localStorage.setItem('student_nim', nim);
      if (!isAdmin) {
        checkUpcomingSchedules(nim);
        verifyProfile(nim);
        
        // Setup real-time listener for status changes
        const unsub = onSnapshot(doc(db, 'students', nim), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setProposalStatus(data.lastStatus || null);
            setStudentPhoto(data.photoUrl || null);
            setIsProfileComplete(data.isProfileComplete === true);
          }
        });
        return () => unsub();
      }
    } else {
      localStorage.removeItem('student_nim');
    }
  }, [nim, isAdmin]);

  const verifyProfile = async (studentNim: string) => {
    setIsVerifyingProfile(true);
    try {
      const snap = await getDoc(doc(db, 'students', studentNim));
      if (snap.exists()) {
        const data = snap.data();
        setIsProfileComplete(data.isProfileComplete === true);
        setStudentPhoto(data.photoUrl || null);
        setProposalStatus(data.lastStatus || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsVerifyingProfile(false);
    }
  };

  const checkUpcomingSchedules = async (studentNim: string) => {
    try {
      const q = query(
        collection(db, 'schedules'), 
        where('studentNim', '==', studentNim),
        where('start', '>=', new Date().toISOString())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast.info(`Anda memiliki ${snap.size} jadwal bimbingan mendatang!`, {
          description: "Cek kalender Anda untuk melihat detailnya.",
          duration: 10000,
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => {
    setNim(null);
    setActiveView('dashboard');
    toast.success("Anda telah keluar");
  };

  if (!nim) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans">
        <LandingPage onLogin={(nim) => setNim(nim)} />
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Admin Sidebar Nav
  const adminNav = (
    <nav className="flex-1 px-4 space-y-2 mt-4">
      <NavItem 
        icon={<LayoutDashboard size={20} />} 
        label="Dashboard" 
        active={activeView === 'dashboard'} 
        onClick={() => setActiveView('dashboard')}
        collapsed={!isSidebarOpen}
      />
      <NavItem 
        icon={<User size={20} />} 
        label="Data Mahasiswa" 
        active={activeView === 'students'} 
        onClick={() => setActiveView('students')}
        collapsed={!isSidebarOpen}
      />
      <NavItem 
        icon={<FileText size={20} />} 
        label="Review Judul" 
        active={activeView === 'proposals_review'} 
        onClick={() => setActiveView('proposals_review')}
        collapsed={!isSidebarOpen}
      />
      <NavItem 
        icon={<CalendarIcon size={20} />} 
        label="Review Bimbingan" 
        active={activeView === 'sessions_review'} 
        onClick={() => setActiveView('sessions_review')}
        collapsed={!isSidebarOpen}
      />
    </nav>
  );

  // Student Sidebar Nav
  const studentNav = (
    <nav className="flex-1 px-4 space-y-2 mt-4 text-slate-900 italic font-medium">
      <NavItem 
        icon={<LayoutDashboard size={20} />} 
        label="Dashboard" 
        active={activeView === 'dashboard'} 
        onClick={() => setActiveView('dashboard')}
        collapsed={!isSidebarOpen}
      />
      <NavItem 
        icon={<FileText size={20} />} 
        label="Pengajuan Judul" 
        active={activeView === 'proposals'} 
        onClick={() => setActiveView('proposals')}
        collapsed={!isSidebarOpen}
      />
      <NavItem 
        icon={<CalendarIcon size={20} />} 
        label="Bimbingan" 
        active={activeView === 'sessions'} 
        onClick={() => {
          if (proposalStatus !== 'reviewed') {
            toast.error("Akses Terkunci", {
              description: "Menu bimbingan baru bisa diakses setelah pengajuan judul Anda DITERIMA/DISETUJUI oleh dosen pembimbing."
            });
            return;
          }
          setActiveView('sessions');
        }}
        collapsed={!isSidebarOpen}
        disabled={proposalStatus !== 'reviewed'}
      />
    </nav>
  );

  const renderContent = () => {
    if (isAdmin) {
      switch (activeView) {
        case 'students': return <StudentManagement />;
        case 'proposals_review': return <GuidanceReview />;
        case 'sessions_review': return <SessionReview />;
        default: return <AdminDashboard />;
      }
    } else {
      switch (activeView) {
        case 'proposals': return <GuidanceList nim={nim} />;
        case 'sessions': return <GuidanceSessions nim={nim} />;
        default: return <Dashboard nim={nim} />;
      }
    }
  };

  const getHeaderTitle = () => {
    if (isAdmin) {
      switch (activeView) {
        case 'students': return 'Master Data Mahasiswa';
        case 'proposals_review': return 'Review Pengajuan Judul';
        case 'sessions_review': return 'Review Pertemuan Bimbingan';
        default: return 'Admin Overview';
      }
    }
    switch (activeView) {
      case 'proposals': return 'Pengajuan Judul Penelitian';
      case 'sessions': return 'Bimbingan (8 Pertemuan)';
      default: return 'Overview Dashboard';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Toaster position="top-right" richColors />

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="h-full bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm"
      >
        <div className="p-6 flex items-center justify-between">
          <div className={cn("flex items-center gap-2", !isSidebarOpen && "justify-center w-full")}>
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <BookOpen size={24} />
            </div>
            {isSidebarOpen && <h1 className="font-bold text-xl tracking-tight">SiBimbing {isAdmin && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded ml-1 italic">Admin</span>}</h1>}
          </div>
        </div>

        {isAdmin ? adminNav : studentNav}

        <div className="p-4 border-t border-slate-100">
          <div 
            onClick={() => !isAdmin && setIsProfileModalOpen(true)}
            className={cn(
              "flex items-center gap-3 p-3 bg-slate-50 rounded-2xl transition-all", 
              !isSidebarOpen && "justify-center",
              !isAdmin && "cursor-pointer hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 overflow-hidden border border-slate-200">
              {isAdmin ? <User size={20} /> : (
                studentPhoto && !studentPhoto.includes('dicebear') ? (
                  <img src={studentPhoto} alt="Profil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : <User size={20} />
              )}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-slate-800">{isAdmin ? 'Administrator' : `NIM: ${nim}`}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {!isAdmin && <span className="text-[9px] text-indigo-600 font-bold uppercase italic">Lihat Profil</span>}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogout();
                    }}
                    className="text-[10px] text-slate-500 hover:text-red-600 flex items-center gap-1 font-bold uppercase italic"
                  >
                    <LogOut size={10} /> Keluar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
             <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
             >
              <div className="w-5 h-0.5 bg-slate-600 mb-1" />
              <div className="w-5 h-0.5 bg-slate-600 mb-1" />
              <div className="w-3 h-0.5 bg-slate-600" />
             </button>
             <h2 className="text-lg font-semibold text-slate-800">
               {getHeaderTitle()}
             </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 hidden md:block">{isAdmin ? 'Admin Panel' : 'Mahasiswa'}</span>
              <div className="w-8 h-8 rounded-full bg-slate-200"></div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 scroll-smooth overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${isAdmin ? 'admin' : 'student'}-${activeView}-${isProfileComplete}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isVerifyingProfile ? (
                <div className="h-64 flex flex-col items-center justify-center italic">
                  <Loader2 className="animate-spin text-indigo-600 mb-2" />
                  <p className="text-sm text-slate-400">Memverifikasi profil...</p>
                </div>
              ) : !isAdmin && !isProfileComplete ? (
                <ProfileUpdate nim={nim!} onComplete={() => setIsProfileComplete(true)} />
              ) : (
                renderContent()
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <ProfileUpdate 
                nim={nim!} 
                isModal={true}
                onComplete={() => setIsProfileModalOpen(false)} 
                onCancel={() => setIsProfileModalOpen(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
  disabled?: boolean;
}

function NavItem({ icon, label, active, onClick, collapsed, disabled }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-sans relative group",
        active 
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
          : disabled 
            ? "text-slate-300 cursor-not-allowed"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        collapsed && "justify-center px-0"
      )}
    >
      <span className={cn(active ? "text-white" : disabled ? "text-slate-200" : "text-slate-500")}>{icon}</span>
      {!collapsed && <span className="font-medium text-sm">{label}</span>}
      {!collapsed && active && <ChevronRight size={14} className="ml-auto opacity-60" />}
      {!collapsed && disabled && (
        <div className="ml-auto opacity-40">
          <Plus size={12} className="rotate-45" />
        </div>
      )}
    </button>
  );
}
