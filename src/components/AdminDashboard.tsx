import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  Calendar, 
  TrendingUp, 
  Clock,
  ArrowUpRight,
  Activity,
  User,
  Trash2,
  Loader2
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, getCountFromServer, where, orderBy, limit, doc, getDoc, writeBatch, deleteDoc, getDocsFromServer } from 'firebase/firestore';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalGuidance: 0,
    pendingReviews: 0,
    upcomingSchedules: 0
  });
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    // Check if cleanup is requested via URL or just run it once if we want to be aggressive
    // For this task, we will provide a way to clear it.
    fetchStats();
    fetchRecentActivities();
  }, []);

  const clearAllData = async () => {
    // NO CONFIRM - DIRECT WIPE AS REQUESTED
    setIsCleaning(true);
    const toastId = toast.loading("FORCE WIPE STARTED...");
    
    try {
      const collectionsToClear = ['students', 'guidance_records', 'schedules', 'meeting_sessions'];
      let deleted = 0;

      for (const colName of collectionsToClear) {
        console.log(`[FORCE] Cleaning ${colName}`);
        const snap = await getDocs(collection(db, colName));
        
        if (snap.empty) continue;

        // Force delete every single document ref found
        const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
        deleted += snap.size;
      }

      toast.success(`WIPE COMPLETE. ${deleted} documents removed.`, { id: toastId });
      
      // Force immediate reload
      setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname;
      }, 1000);
    } catch (error: any) {
      console.error("[FORCE] WIPE FAILED:", error);
      toast.error("WIPE FAILED: " + error.message, { id: toastId });
    } finally {
      setIsCleaning(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const q = query(
        collection(db, 'guidance_records'),
        orderBy('updatedAt', 'desc'),
        limit(5)
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch student info for each record
      const activitiesWithPhotos = await Promise.all(records.map(async (rec: any) => {
        if (!rec.studentNim) return rec;
        const studentDoc = await getDoc(doc(db, 'students', rec.studentNim));
        if (studentDoc.exists()) {
          const sData = studentDoc.data();
          return {
            ...rec,
            studentName: sData.fullName,
            studentPhoto: sData.photoUrl
          };
        }
        return rec;
      }));

      setActivities(activitiesWithPhotos);
    } catch (error) {
      console.error("Error fetching activity:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const studentSnap = await getCountFromServer(collection(db, 'students'));
      const guidanceSnap = await getCountFromServer(collection(db, 'guidance_records'));
      
      const pendingQuery = query(collection(db, 'guidance_records'), where('status', '==', 'pending'));
      const pendingSnap = await getDocs(pendingQuery);

      const scheduleSnap = await getCountFromServer(collection(db, 'schedules'));

      setStats({
        totalStudents: studentSnap.data().count,
        totalGuidance: guidanceSnap.data().count,
        pendingReviews: pendingSnap.size,
        upcomingSchedules: scheduleSnap.data().count
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 italic">
      {/* FORCE WIPE OVERLAY */}
      {isCleaning && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-6 text-center">
          <div className="space-y-6 max-w-sm">
            <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Trash2 size={48} className="text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Deleting Data</h2>
              <p className="text-slate-400 text-sm italic font-bold">Mengosongkan seluruh database secara paksa...</p>
            </div>
            <Loader2 className="animate-spin text-red-500 mx-auto" size={32} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1">
          <AdminStatCard 
            icon={<Users className="text-blue-600" />} 
            label="Total Mahasiswa" 
            value={stats.totalStudents} 
            trend="+12% bulan ini" 
          />
          <AdminStatCard 
            icon={<FileText className="text-indigo-600" />} 
            label="Review Judul" 
            value={stats.totalGuidance} 
            trend="Total Keseluruhan" 
          />
          <AdminStatCard 
            icon={<Activity className="text-orange-600" />} 
            label="Review Bimbingan" 
            value={stats.pendingReviews} 
            trend="Perlu Feedback" 
            highlight={stats.pendingReviews > 0}
          />
          <AdminStatCard 
            icon={<TrendingUp className="text-emerald-600" />} 
            label="Progres Selesai" 
            value={Math.floor(stats.totalGuidance * 0.7)} 
            trend="Estimasi Progres" 
          />
        </div>
        <div className="ml-6 flex-shrink-0">
          <button 
            onClick={clearAllData}
            disabled={isCleaning}
            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 p-4 rounded-3xl flex flex-col items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            {isCleaning ? <Loader2 className="animate-spin" /> : <Trash2 size={24} />}
            <span className="text-[10px] font-black uppercase tracking-tighter">Reset DB</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-800 tracking-tight italic">Aktifitas Terbaru</h3>
            <button className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:underline">
              Lihat Semua <ArrowUpRight size={14} />
            </button>
          </div>
          
          <div className="space-y-6">
            {activities.length > 0 ? activities.map(act => (
              <div key={act.id} className="flex gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100 italic group">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0 overflow-hidden shadow-sm">
                  {act.studentPhoto && !act.studentPhoto.includes('dicebear') ? (
                    <img src={act.studentPhoto} alt="" className="w-full h-full object-cover" />
                  ) : <User size={24} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 italic">{act.studentName || 'Mahasiswa'}</p>
                  <p className="text-xs text-slate-500 mt-1 italic line-clamp-1">
                    {act.researchTitle ? `Judul: ${act.researchTitle}` : 'Baru saja melakukan aktivitas bimbingan.'}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase italic">
                    {act.updatedAt ? new Date(act.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Baru'}
                  </p>
                </div>
              </div>
            )) : (
              <div className="py-8 text-center text-slate-400 italic text-sm">Belum ada aktifitas terbaru.</div>
            )}
          </div>
        </div>

        <div className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden italic">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-4 italic tracking-tight">Ringkasan Sistem</h3>
            <p className="text-indigo-200 mb-8 leading-relaxed italic">
              Sistem saat ini sedang berjalan optimal. Terdapat {stats.pendingReviews} laporan bimbingan yang menunggu tanggapan Anda.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-indigo-300 italic">Respon Rata-rata</span>
                <span className="text-sm font-bold">1.2 Hari</span>
              </div>
              <div className="w-full bg-indigo-800 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-400 h-full w-[85%]"></div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-800/50 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
}

function AdminStatCard({ icon, label, value, trend, highlight }: any) {
  return (
    <div className={`bg-white rounded-3xl p-6 border border-slate-200 shadow-sm italic transition-all hover:shadow-md ${highlight ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}>
      <div className="bg-slate-50 p-3 rounded-2xl w-fit mb-4">
        {icon}
      </div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider italic">{label}</p>
      <h4 className="text-3xl font-black text-slate-800 mt-1 italic tracking-tight">{value}</h4>
      <p className="text-xs text-slate-400 mt-2 font-medium italic">{trend}</p>
    </div>
  );
}
