import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { 
  Calendar, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MessageSquare, 
  Paperclip, 
  Upload, 
  Loader2,
  X,
  FileDown,
  Plus,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { formatDate, cn } from '../lib/utils';

interface Session {
  id: string;
  sessionNumber: number;
  status: 'not_started' | 'pending' | 'revision' | 'approved';
  lastFeedback: string;
  lastAttachmentName: string;
  history: any[];
}

interface GuidanceSessionsProps {
  nim: string;
  isAdmin?: boolean;
}

export default function GuidanceSessions({ nim, isAdmin = false }: GuidanceSessionsProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  
  // Form state
  const [uploadLoading, setUploadLoading] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  // Admin states
  const [adminFeedback, setAdminFeedback] = useState('');
  const [adminStatus, setAdminStatus] = useState<'revision' | 'approved'>('approved');
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const [attachmentData, setAttachmentData] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudentPhoto = async () => {
      try {
        const snap = await getDoc(doc(db, 'students', nim));
        if (snap.exists()) {
          setStudentPhoto(snap.data().photoUrl || null);
        }
      } catch (e) { console.error(e); }
    };
    fetchStudentPhoto();

    // Generate 8 empty sessions by default
    const defaultSessions: Session[] = Array.from({ length: 8 }, (_, i) => ({
      id: `${nim}-s${i + 1}`,
      sessionNumber: i + 1,
      status: 'not_started',
      lastFeedback: '',
      lastAttachmentName: '',
      history: []
    }));

    const unsub = onSnapshot(query(collection(db, 'meeting_sessions'), where('studentNim', '==', nim)), 
      (snap) => {
        const dbSessions = snap.docs.map(doc => doc.data() as Session);
        const merged = defaultSessions.map(ds => {
          const found = dbSessions.find(s => s.sessionNumber === ds.sessionNumber);
          return found ? found : ds;
        });
        setSessions(merged);
        setIsLoading(false);
      },
      (error) => {
        console.error("Firestore onSnapshot error:", error);
        toast.error("Gagal sinkronisasi data bimbingan. Periksa koneksi.");
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [nim]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = (fileName: string, base64: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async (sessionNumber: number) => {
    if (!attachmentName || !notes || !attachmentData) {
      toast.error("Harap isi deskripsi dan pilih file");
      return;
    }

    setUploadLoading(sessionNumber);
    try {
      const sessionRef = doc(db, 'meeting_sessions', `${nim}-s${sessionNumber}`);
      const sessionSnap = await getDoc(sessionRef);
      
      const newHistoryItem = {
        type: 'student_upload',
        timestamp: new Date().toISOString(),
        notes,
        attachmentName,
        attachmentData // Base64
      };

      const existingHistory = sessionSnap.exists() ? sessionSnap.data().history || [] : [];
      
      const sessionData = {
        studentNim: nim,
        sessionNumber,
        status: 'pending',
        lastAttachmentName: attachmentName,
        lastFeedback: '', // Clear old feedback when student uploads new revision
        history: [...existingHistory, newHistoryItem]
      };

      await setDoc(sessionRef, sessionData, { merge: true });
      
      toast.success(`Progress pertemuan ${sessionNumber} berhasil dikirim!`);
      setNotes('');
      setAttachmentName('');
      setAttachmentData(null);
      setExpandedSession(null);
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengirim progress");
    } finally {
      setUploadLoading(null);
    }
  };

  const handleAdminReview = async (sessionNumber: number) => {
    if (!adminFeedback) {
      toast.error("Harap berikan feedback");
      return;
    }

    setUploadLoading(sessionNumber);
    try {
      const sessionRef = doc(db, 'meeting_sessions', `${nim}-s${sessionNumber}`);
      const sessionSnap = await getDoc(sessionRef);
      
      const newHistoryItem = {
        type: 'admin_feedback',
        timestamp: new Date().toISOString(),
        feedback: adminFeedback,
        status: adminStatus
      };

      const existingHistory = sessionSnap.exists() ? sessionSnap.data().history || [] : [];
      
      await updateDoc(sessionRef, {
        status: adminStatus,
        lastFeedback: adminFeedback,
        history: [...existingHistory, newHistoryItem]
      });
      
      toast.success(`Review pertemuan ${sessionNumber} berhasil disimpan!`);
      setAdminFeedback('');
      setExpandedSession(null);
    } catch (error) {
      console.error(error);
      toast.error("Gagal menyimpan review");
    } finally {
      setUploadLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sessions.map((session, idx) => {
          const isLockedBySequence = session.sessionNumber > 1 && sessions[session.sessionNumber - 2].status !== 'approved';
          
          return (
          <motion.div
            key={session.sessionNumber}
            layout
            className={cn(
              "bg-white rounded-3xl border transition-all duration-300 overflow-hidden shadow-sm italic font-medium",
              session.status === 'not_started' && "border-slate-100",
              session.status === 'pending' && "border-orange-400 ring-4 ring-orange-100 bg-orange-50/20",
              session.status === 'revision' && "border-pink-200 ring-4 ring-pink-50",
              session.status === 'approved' && "border-emerald-200 ring-4 ring-emerald-50",
              isLockedBySequence && "opacity-60 bg-slate-50 border-slate-200",
              expandedSession === session.sessionNumber && "md:col-span-2 lg:col-span-2 row-span-2 border-indigo-200 ring-4 ring-indigo-50"
            )}
          >
            <div 
              className={cn(
                "p-5 cursor-pointer flex items-center justify-between",
                isLockedBySequence && "cursor-not-allowed"
              )}
              onClick={() => {
                if (isLockedBySequence) {
                  toast.error(`Pertemuan ${session.sessionNumber-1} harus disetujui terlebih dahulu.`);
                  return;
                }
                setExpandedSession(expandedSession === session.sessionNumber ? null : session.sessionNumber);
              }}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  isLockedBySequence ? "bg-slate-200 text-slate-400" :
                  session.status === 'approved' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                )}>
                  {isLockedBySequence ? <Clock size={20} /> : session.status === 'approved' ? <CheckCircle2 size={24} /> : <span className="font-black text-lg">0{session.sessionNumber}</span>}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 tracking-tight italic">Pertemuan {session.sessionNumber}</h4>
                  <div className="flex items-center gap-1.5">
                    {isLockedBySequence ? <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Terkunci</span> : (
                      <>
                        {session.status === 'not_started' && <span className="text-[10px] text-slate-400 uppercase font-black">Belum Mulai</span>}
                        {session.status === 'pending' && <span className="text-[10px] text-orange-500 uppercase font-black font-black animate-pulse">Menunggu Review</span>}
                        {session.status === 'revision' && <span className="text-[10px] text-pink-500 uppercase font-black">Perlu Revisi</span>}
                        {session.status === 'approved' && <span className="text-[10px] text-emerald-500 uppercase font-black">Disetujui / Lanjut</span>}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-slate-300">
                {isLockedBySequence ? null : expandedSession === session.sessionNumber ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>

            <AnimatePresence>
              {expandedSession === session.sessionNumber && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-5 border-t border-slate-100"
                >
                  <div className="pt-4 space-y-4">
                    {/* History Thread - Newest First */}
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-hide mb-4 flex flex-col">
                      {session.history.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4 italic font-bold">Belum ada diskusi untuk pertemuan ini.</p>
                      ) : (
                        [...session.history].reverse().map((h, i) => (
                          <div key={i} className="flex gap-3 mb-4">
                            {h.type === 'student_upload' && (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center overflow-hidden border border-indigo-200">
                                {studentPhoto ? <img src={studentPhoto} alt="" className="w-full h-full object-cover" /> : <User size={14} className="text-indigo-600" />}
                              </div>
                            )}
                            <div className={cn(
                              "flex-1 p-4 rounded-2xl text-xs space-y-1 relative shadow-sm",
                              h.type === 'student_upload' ? "bg-indigo-50 border border-indigo-100" : "bg-slate-50 border border-slate-100 text-right",
                              i === 0 && session.status === 'pending' && "ring-2 ring-orange-400"
                            )}>
                               <div className="flex items-center justify-between gap-4 mb-1">
                                 <p className="text-[8px] text-slate-400 font-black uppercase italic">{formatDate(h.timestamp)}</p>
                                 {i === 0 && <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded italic font-black uppercase tracking-tighter">Terbaru</span>}
                               </div>
                               <p className="font-bold text-slate-700 italic leading-relaxed">{h.notes || h.feedback}</p>
                               {h.attachmentName && (
                                 <button 
                                   onClick={() => h.attachmentData && handleDownload(h.attachmentName, h.attachmentData)}
                                   className={cn(
                                     "flex items-center gap-1 mt-3 font-bold transition-all p-1.5 rounded-lg border",
                                     h.type === 'admin_feedback' ? "ml-auto bg-slate-100 border-slate-200 text-slate-600" : "bg-indigo-100 border-indigo-200 text-indigo-600",
                                     !h.attachmentData && "opacity-50 cursor-not-allowed"
                                   )}
                                 >
                                   <Paperclip size={10} />
                                   <span className="truncate max-w-[200px] border-b border-current pb-0.5">{h.attachmentName}</span>
                                   <FileDown size={10} className="ml-1" />
                                 </button>
                               )}
                            </div>
                            {h.type === 'admin_feedback' && (
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center border border-slate-200">
                                <User size={14} className="text-slate-400" />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {!isAdmin ? (
                      // Student Form
                      session.status !== 'approved' && (
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <h5 className="text-xs font-black text-slate-400 uppercase italic mb-2">Kirim Progres Revisi</h5>
                          <textarea 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic min-h-[60px]"
                            placeholder="Deskripsikan revisi atau progres Anda..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                          <div className="flex items-center gap-3">
                            <label className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 cursor-pointer hover:bg-slate-100 transition-colors">
                              <Upload size={14} className="text-indigo-600" />
                              <span className="text-[10px] text-slate-400 truncate font-bold uppercase italic">
                                {attachmentName || (session.sessionNumber === 8 ? 'Upload Bukti Bimbingan' : 'Upload Berkas Revisi')}
                              </span>
                              <input 
                                type="file" 
                                className="hidden" 
                                onChange={handleFileChange}
                              />
                            </label>
                            <button 
                              onClick={() => handleUpload(session.sessionNumber)}
                              disabled={uploadLoading === session.sessionNumber}
                              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition-all flex items-center gap-2"
                            >
                              {uploadLoading === session.sessionNumber ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                              KIRIM
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      // Admin Review Form
                      session.status === 'pending' && (
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <h5 className="text-xs font-black text-indigo-600 uppercase italic mb-2">Berikan Review Admin</h5>
                          <textarea 
                            className="w-full bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic min-h-[60px]"
                            placeholder="Ketik feedback Anda di sini..."
                            value={adminFeedback}
                            onChange={(e) => setAdminFeedback(e.target.value)}
                          />
                          <div className="flex items-center gap-3">
                            <select 
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold uppercase italic outline-none"
                              value={adminStatus}
                              onChange={(e) => setAdminStatus(e.target.value as any)}
                            >
                              <option value="approved">LANJUT (Disetujui)</option>
                              <option value="revision">REVISI ULANG</option>
                            </select>
                            <button 
                              onClick={() => handleAdminReview(session.sessionNumber)}
                              disabled={uploadLoading === session.sessionNumber}
                              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase shadow-lg shadow-indigo-100 transition-all"
                            >
                              {uploadLoading === session.sessionNumber ? <Loader2 size={14} className="animate-spin" /> : 'Selesai Review'}
                            </button>
                          </div>
                        </div>
                      )
                    )}

                    {session.status === 'approved' && session.sessionNumber === 8 && (
                       <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                         <p className="text-[10px] text-emerald-600 font-black uppercase italic mb-1">Status Final</p>
                         <p className="text-xs text-emerald-700 italic font-bold">Bimbingan Selesai. Silakan unduh bukti bimbingan untuk ditandatangani.</p>
                         <button className="mt-3 flex items-center gap-2 text-indigo-600 font-bold text-[10px] uppercase hover:underline">
                           <FileDown size={14} /> Download Lembar Bukti Bimbingan
                         </button>
                       </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })}
      </div>
    </div>
  );
}
