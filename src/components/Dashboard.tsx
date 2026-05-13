import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  addDoc,
  Timestamp,
  getCountFromServer,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Plus, 
  X,
  Loader2,
  AlertCircle,
  FileText,
  User,
  ChevronLeft,
  ChevronRight,
  Activity,
  History,
  Info,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import StudentHistory from './StudentHistory';

const ITEMS_PER_PAGE = 5;

interface DashboardProps {
  nim: string;
  setActiveView?: (view: string) => void;
}

export default function Dashboard({ nim, setActiveView }: DashboardProps) {
  const [student, setStudent] = useState<any>(null);
  const [guidanceCount, setGuidanceCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Student
      const studentDoc = await getDoc(doc(db, 'students', nim));
      if (studentDoc.exists()) setStudent(studentDoc.data());

      // Fetch Approved Guidance Sessions Count (The 8-session track)
      const gQuery = query(
        collection(db, 'meeting_sessions'), 
        where('studentNim', '==', nim),
        where('status', '==', 'approved')
      );
      const gSnap = await getDocs(gQuery);
      setGuidanceCount(gSnap.size);

      // Fetch Total Students
      const studentCountSnap = await getCountFromServer(collection(db, 'students'));
      setTotalStudents(studentCountSnap.data().count);

      // Fetch All Students (sorted by last activity)
      const recentQuery = query(
        collection(db, 'students'), 
        orderBy('lastGuidanceAt', 'desc'),
      );
      // Note: If some students don't have lastGuidanceAt, we might need a fallback sort or secondary query
      // but Firestore ordering often skips documents missing the field.
      // To show EVERYONE, we might need to fetch without specific order or handle missing fields.
      // Let's fetch all and sort in JS for a better user experience with small/medium dataset.
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentsList = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort: students with lastGuidanceAt first (desc), then by createdAt (desc)
      studentsList.sort((a: any, b: any) => {
        const timeA = a.lastGuidanceAt || a.createdAt || 0;
        const timeB = b.lastGuidanceAt || b.createdAt || 0;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      setAllStudents(studentsList);

    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat data dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [nim]);

  const totalPages = Math.ceil(allStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = allStudents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 italic font-medium">
      {/* Welcome Message */}
      {student && (
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 rounded-3xl text-white shadow-lg overflow-hidden relative">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold italic tracking-tight mb-2">{getGreeting()}, {student.fullName}</h2>
          </div>
          <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 flex items-center justify-center">
            {student.photoUrl && !student.photoUrl.includes('dicebear') ? (
              <img src={student.photoUrl} alt="" className="w-40 h-40 object-cover rounded-full" referrerPolicy="no-referrer" />
            ) : <User size={120} />}
          </div>
        </div>
      )}

      {/* Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SummaryCard 
          icon={<CheckCircle className="text-emerald-500" />} 
          label="Total Bimbingan Selesai" 
          value={guidanceCount.toString()} 
          suffix="Sesi"
        />
        <SummaryCard 
          icon={<Clock className="text-amber-500" />} 
          label="Target Sisa Bimbingan" 
          value={Math.max(0, 8 - guidanceCount).toString()} 
          suffix="Sesi"
        />
      </div>

      {/* Personal Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 bg-indigo-600 rounded-bl-3xl translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform">
             <FileText size={80} />
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase italic tracking-widest mb-4">Status Pengajuan Judul</h3>
          {student?.lastStatus ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {student.lastStatus === 'reviewed' ? (
                  <CheckCircle className="text-emerald-500" size={32} />
                ) : student.lastStatus === 'revision' ? (
                  <AlertCircle className="text-pink-500" size={32} />
                ) : (
                  <Clock className="text-orange-500 animate-pulse" size={32} />
                )}
                <div>
                  <p className="text-lg font-bold text-slate-800 italic">
                    {student.lastStatus === 'reviewed' ? 'Judul Diterima' : 
                     student.lastStatus === 'revision' ? 'Perlu Revisi Judul' : 'Menunggu Review'}
                  </p>
                  <p className="text-xs text-slate-500 italic truncate max-w-[200px]">{student.researchTitle}</p>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase italic mb-1">Umpan Balik Pembimbing</p>
                <p className="text-xs text-slate-700 italic font-bold leading-relaxed">{student.lastFeedback || "Belum ada umpan balik dari pembimbing."}</p>
              </div>
            </div>
          ) : (
             <div className="py-8 text-center">
               <p className="text-sm text-slate-400 italic">Anda belum mengirimkan pengajuan judul.</p>
             </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 bg-emerald-600 rounded-bl-3xl translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform">
             <TrendingUp size={80} />
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase italic tracking-widest mb-4">Progres Bimbingan 8 Sesi</h3>
          <div className="flex flex-col h-full justify-center">
             <div className="space-y-4">
                <div className="space-y-2">
                   <div className="flex justify-between items-end">
                      <p className="text-2xl font-black text-slate-800 italic">{guidanceCount} <span className="text-xs font-bold text-slate-400">/ 8</span></p>
                      <p className="text-xs font-bold text-emerald-600 italic">{Math.round((guidanceCount / 8) * 100)}% Selesai</p>
                   </div>
                   <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200 p-0.5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(guidanceCount / 8) * 100}%` }}
                        className="bg-emerald-500 h-full rounded-full"
                      />
                   </div>
                </div>

                {guidanceCount >= 8 ? (
                  <motion.button 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => toast.info("Laporan Sedang Disiapkan", { description: "Menunggu template laporan resmi dari institusi." })}
                    className="w-full bg-emerald-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase italic tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                  >
                    <FileDown size={14} /> Cetak Laporan Bimbingan PDF
                  </motion.button>
                ) : (
                  <p className="text-[10px] text-slate-400 italic font-bold text-center">Selesaikan minimal 8 sesi bimbingan untuk cetak laporan & daftar sidang.</p>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* PERSONAL FEEDBACK & QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 bg-indigo-600 rounded-bl-3xl translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform">
             <Activity size={80} />
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase italic tracking-widest mb-6 flex items-center gap-2">
            <Activity size={16} /> Aktivitas Terakhir Saya
          </h3>
          
          <div className="space-y-6 relative ml-2">
            <div className="absolute left-[3px] top-2 bottom-2 w-0.5 bg-slate-100" />
            {allStudents.filter(s => s.nim === nim).map((s, idx) => (
              <div key={idx} className="space-y-4">
                {s.lastGuidanceAt ? (
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1 w-2 h-2 rounded-full bg-indigo-600" />
                    <p className="text-[10px] font-black text-slate-400 italic uppercase">
                      {new Date(s.lastGuidanceAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • TERAKHIR DIPERBARUI
                    </p>
                    <p className="text-sm font-bold text-slate-700 italic mt-1 line-clamp-1">
                      {s.researchTitle}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
                       <CheckCircle className="text-indigo-600" size={12} />
                       <span className="text-[10px] font-black text-indigo-600 uppercase italic">Update Berhasil</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-xs text-slate-400 italic font-bold">Belum ada aktivitas terekam.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-xl">
           <div className="relative z-10">
              <h3 className="text-lg font-black italic tracking-tight uppercase mb-2">Aksi Cepat</h3>
              <p className="text-xs text-slate-400 italic mb-8 font-medium leading-relaxed">Berinteraksi dengan bimbingan Anda secara instan menggunakan menu di bawah ini.</p>
              
              <div className="space-y-3">
                 <button 
                  onClick={() => setActiveView?.('proposals')}
                  className="w-full bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-2xl flex items-center justify-between transition-all group/btn"
                 >
                    <div className="flex items-center gap-3">
                       <div className="bg-indigo-500 p-2 rounded-xl text-white">
                          <Plus size={18} />
                       </div>
                       <span className="text-xs font-black italic uppercase tracking-tighter">Ajukan Judul Baru</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-500 group-hover/btn:translate-x-1 transition-transform" />
                 </button>

                 <button 
                  onClick={() => {
                    if (student?.lastStatus !== 'reviewed') {
                      toast.error("Akses Terkunci", { description: "Selesaikan pengajuan judul terlebih dahulu." });
                      return;
                    }
                    setActiveView?.('sessions');
                  }}
                  className={cn(
                    "w-full border border-white/10 p-4 rounded-2xl flex items-center justify-between transition-all group/btn",
                    student?.lastStatus === 'reviewed' ? "bg-white/10 hover:bg-white/20" : "opacity-30 cursor-not-allowed"
                  )}
                 >
                    <div className="flex items-center gap-3">
                       <div className="bg-emerald-500 p-2 rounded-xl text-white">
                          <CheckCircle size={18} />
                       </div>
                       <span className="text-xs font-black italic uppercase tracking-tighter">Update Log Sesi Bimbingan</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-500 group-hover/btn:translate-x-1 transition-transform" />
                 </button>

                 <button 
                  onClick={() => setShowHistory(true)}
                  className="w-full bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-2xl flex items-center justify-between transition-all group/btn"
                 >
                    <div className="flex items-center gap-3">
                       <div className="bg-orange-500 p-2 rounded-xl text-white">
                          <History size={18} />
                       </div>
                       <span className="text-xs font-black italic uppercase tracking-tighter">Lihat Riwayat Lengkap</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-500 group-hover/btn:translate-x-1 transition-transform" />
                 </button>
              </div>
           </div>
           
           <div className="absolute bottom-0 right-0 p-8 opacity-10 blur-2xl bg-indigo-600 w-32 h-32 rounded-full translate-x-12 translate-y-12" />
        </div>
      </div>

      {/* ACADEMIC TIPS & GUIDELINES */}
      <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
           <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
              <Info size={24} />
           </div>
           <div>
              <h3 className="text-xl font-black text-slate-800 italic uppercase italic tracking-tight">Kebutuhan Kelulusan</h3>
              <p className="text-xs text-slate-400 font-bold italic uppercase tracking-widest">Pastikan poin-poin di bawah ini terpenuhi</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <AcademicRequirement 
              icon={<ClipboardList className="text-emerald-500" size={16} />}
              title="Judul Disetujui"
              desc="Status pengajuan judul harus DISETUJUI oleh pembimbing utama."
              completed={student?.lastStatus === 'reviewed'}
           />
           <AcademicRequirement 
              icon={<FileText className="text-blue-500" size={16} />}
              title="8 Sesi Bimbingan"
              desc="Lengkapi minimal 8 log bimbingan yang telah divalidasi dosen."
              completed={guidanceCount >= 8}
           />
           <AcademicRequirement 
              icon={<Activity className="text-indigo-500" size={16} />}
              title="Draft Dokumen"
              desc="Pastikan draft akhir sudah terunggah pada sesi ke-8 bimbingan."
              completed={guidanceCount >= 8}
           />
           <AcademicRequirement 
              icon={<Users className="text-purple-500" size={16} />}
              title="Izin Sidang"
              desc="Dosen akan memberikan status SELESAI jika Anda layak maju sidang."
              completed={false}
           />
        </div>
      </div>

      <AnimatePresence>
        {showHistory && student && (
          <StudentHistory 
            nim={nim} 
            name={student.fullName} 
            onClose={() => setShowHistory(false)} 
          />
        )}
      </AnimatePresence>

    </div>
  );
}

function AcademicRequirement({ icon, title, desc, completed }: { icon: React.ReactNode, title: string, desc: string, completed: boolean }) {
  return (
    <div className={cn(
      "p-6 rounded-[2rem] border-2 transition-all group",
      completed ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"
    )}>
      <div className="flex items-center justify-between mb-3">
         <div className="bg-white p-2 rounded-xl shadow-sm text-slate-400 group-hover:scale-110 transition-transform">
            {icon}
         </div>
         {completed && <CheckCircle size={14} className="text-emerald-500" />}
      </div>
      <h5 className="text-xs font-black text-slate-800 italic uppercase tracking-tight mb-1">{title}</h5>
      <p className="text-[10px] text-slate-400 font-bold italic leading-relaxed line-clamp-3">{desc}</p>
    </div>
  );
}

function SummaryCard({ icon, label, value, suffix }: { icon: React.ReactNode, label: string, value: string, suffix?: string }) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm italic">
      <div className="bg-slate-50 p-3 rounded-2xl w-fit mb-4">
        {icon}
      </div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
        {suffix && <span className="text-sm text-slate-400 font-medium italic">{suffix}</span>}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-slate-700 font-medium leading-relaxed italic">{value}</p>
    </div>
  );
}
