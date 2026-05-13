import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  X, 
  FileText, 
  MessageCircle, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  User,
  Activity
} from 'lucide-react';
import { formatDate, cn, safeToDate } from '../lib/utils';

interface StudentHistoryProps {
  nim: string;
  name: string;
  onClose: () => void;
}

export default function StudentHistory({ nim, name, onClose }: StudentHistoryProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [nim]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Title Submissions
      const titleQ = query(collection(db, 'guidance_records'), where('studentNim', '==', nim));
      const titleSnap = await getDocs(titleQ);
      const titleEvents = titleSnap.docs.map(doc => ({
        id: doc.id,
        type: 'title',
        date: safeToDate(doc.data().createdAt),
        ...doc.data()
      }));

      // 2. Fetch Guidance Sessions (8 Tracks)
      const sessionQ = query(collection(db, 'meeting_sessions'), where('studentNim', '==', nim));
      const sessionSnap = await getDocs(sessionQ);
      const sessionEvents = sessionSnap.docs.map(doc => ({
        id: doc.id,
        type: 'session',
        date: safeToDate(doc.data().createdAt || doc.data().sessionDate),
        ...doc.data()
      }));

      // Merge and sort
      const allEvents = [...titleEvents, ...sessionEvents].sort((a, b) => b.date.getTime() - a.date.getTime());
      setEvents(allEvents);
    } catch (error) {
      console.error("History Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] relative z-10 flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b bg-slate-50 relative">
          <div className="flex items-center gap-5">
            <div className="bg-indigo-600 p-3.5 rounded-2xl text-white shadow-xl shadow-indigo-100">
              <History size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 italic tracking-tight uppercase">History Perjalanan</h3>
              <p className="text-xs text-slate-500 font-bold italic mt-1 bg-white inline-block px-3 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">
                {nim} — {name}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-xs font-black text-slate-400 italic animate-pulse">MEMUAT LOG AKTIVITAS...</p>
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-8 relative ml-4">
              <div className="absolute left-[7px] top-4 bottom-4 w-0.5 bg-slate-100" />
              {events.map((event, idx) => (
                <div key={event.id} className="relative pl-12 group">
                  {/* Timeline Dot */}
                  <div className={cn(
                    "absolute left-0 top-1 w-4 h-4 rounded-full border-4 border-white shadow-sm transition-transform group-hover:scale-125 z-10",
                    event.type === 'title' ? "bg-indigo-500" : "bg-emerald-500"
                  )} />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 italic uppercase bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        {formatDate(event.date)}
                      </p>
                      <span className={cn(
                        "text-[8px] font-black italic px-2 py-0.5 rounded-full uppercase tracking-tighter",
                        event.status === 'approved' || event.status === 'reviewed' ? "bg-emerald-100 text-emerald-600" :
                        event.status === 'revision' ? "bg-pink-100 text-pink-600" : "bg-orange-100 text-orange-600"
                      )}>
                        {event.status}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-3xl hover:border-indigo-200 transition-colors shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-xl mt-1 text-white",
                          event.type === 'title' ? "bg-indigo-500" : "bg-emerald-500"
                        )}>
                          {event.type === 'title' ? <FileText size={14} /> : <Activity size={14} />}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-black text-slate-800 italic uppercase tracking-tight mb-1">
                            {event.type === 'title' ? `PENGAJUAN JUDUL (REV #${event.revisionNumber})` : `BIMBINGAN SESI #${event.sessionNumber}`}
                          </h4>
                          <p className="text-sm font-bold text-slate-600 italic leading-snug">
                            {event.type === 'title' ? event.researchTitle : event.subject}
                          </p>
                          
                          {(event.adminFeedback || event.notes) && (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <div className="flex items-start gap-2">
                                <MessageCircle size={10} className="text-slate-400 mt-0.5" />
                                <p className="text-[10px] text-slate-500 italic font-bold leading-relaxed">
                                  "{event.adminFeedback || event.notes}"
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <Activity size={64} className="text-slate-200 mb-4" />
              <p className="text-sm font-bold text-slate-400 italic">Belum ada riwayat aktivitas ditemukan.</p>
            </div>
          )}
        </div>
        
        <div className="p-6 bg-slate-50 border-t flex justify-center">
            <button 
              onClick={onClose}
              className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest italic"
            >
              Kembali ke Management
            </button>
        </div>
      </motion.div>
    </div>
  );
}
