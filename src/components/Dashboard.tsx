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
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const ITEMS_PER_PAGE = 5;

interface DashboardProps {
  nim: string;
}

export default function Dashboard({ nim }: DashboardProps) {
  const [student, setStudent] = useState<any>(null);
  const [guidanceCount, setGuidanceCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Student
      const studentDoc = await getDoc(doc(db, 'students', nim));
      if (studentDoc.exists()) setStudent(studentDoc.data());

      // Fetch Guidance Count
      const gQuery = query(collection(db, 'guidance_records'), where('studentNim', '==', nim));
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
          label="Total Bimbingan" 
          value={guidanceCount.toString()} 
          suffix="Sesi"
        />
        <SummaryCard 
          icon={<Users className="text-blue-500" />} 
          label="Total Mahasiswa Bimbingan" 
          value={totalStudents.toString()} 
          suffix="Mahasiswa"
        />
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Recent Students List Section */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Users className="text-indigo-600" size={24} />
                <h3 className="text-xl font-bold text-slate-800 tracking-tight italic">Daftar Mahasiswa</h3>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 uppercase font-bold">
                    <th className="px-6 py-4 text-[10px] text-slate-500 tracking-widest italic">Nama Mahasiswa</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 tracking-widest italic">Judul Bimbingan</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 tracking-widest italic">Feedback</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 tracking-widest italic text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 tracking-widest italic text-right">Waktu Upload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 italic">
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic font-bold">
                        Belum ada data mahasiswa.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-100">
                              {s.photoUrl && !s.photoUrl.includes('dicebear') ? (
                                <img src={s.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : <User size={14} />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{s.fullName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-slate-600 font-medium line-clamp-2 max-w-[200px]">{s.researchTitle}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-[250px]">
                             {s.lastGuidanceAt ? (
                               <p className="text-[10px] text-slate-500 line-clamp-2 italic leading-relaxed">
                                 {s.lastFeedback || "Sedang diproses oleh admin/dosen."}
                               </p>
                             ) : (
                               <span className="text-[10px] text-slate-300 italic font-bold">Belum ada aktivitas</span>
                             )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                           {s.lastStatus === 'reviewed' ? (
                             <span className="bg-emerald-100 text-emerald-700 text-[8px] px-1.5 py-0.5 rounded font-black italic">DITERIMA</span>
                           ) : s.lastStatus === 'revision' ? (
                             <span className="bg-pink-100 text-pink-700 text-[8px] px-1.5 py-0.5 rounded font-black italic">REVISI</span>
                           ) : s.lastGuidanceAt ? (
                             <span className="bg-orange-100 text-orange-700 text-[8px] px-1.5 py-0.5 rounded font-black italic">MENUNGGU</span>
                           ) : (
                             <span className="text-slate-300">-</span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <p className="text-[10px] font-bold text-slate-600 tracking-tight italic">
                              {s.lastGuidanceAt ? new Date(s.lastGuidanceAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </p>
                            {s.lastGuidanceAt ? (
                              <span className="text-[8px] bg-emerald-100 text-emerald-600 px-1 rounded font-black uppercase mt-0.5">TERKIRIM</span>
                            ) : (
                              <span className="text-[8px] bg-slate-100 text-slate-400 px-1 rounded font-black uppercase mt-0.5">BELUM SUBMIT</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between mt-4 rounded-b-2xl">
                <p className="text-[10px] text-slate-500 font-bold uppercase italic">
                  Hal <span className="text-indigo-600">{currentPage}</span> / {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
