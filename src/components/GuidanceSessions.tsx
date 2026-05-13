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
  User,
  Link as LinkIcon,
  Eye,
  Send
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
  const [docLink, setDocLink] = useState('');

  // Admin states
  const [adminFeedback, setAdminFeedback] = useState('');
  const [adminStatus, setAdminStatus] = useState<'revision' | 'approved'>('approved');
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const [attachmentData, setAttachmentData] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ name: string, data: string } | null>(null);

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

  const handlePreview = (fileName: string, base64: string) => {
    setViewingFile({ name: fileName, data: base64 });
  };

  const handleUpload = async (sessionNumber: number) => {
    if (!notes) {
      toast.error("Harap isi deskripsi progress");
      return;
    }

    if (!attachmentName && !docLink) {
      toast.error("Harap pilih berkas atau masukkan tautan dokumen");
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
        attachmentData, // Base64
        docLink // Google Docs/Drive link
      };

      const existingHistory = sessionSnap.exists() ? sessionSnap.data().history || [] : [];
      
      const sessionData = {
        studentNim: nim,
        sessionNumber,
        status: 'pending',
        lastAttachmentName: attachmentName || 'Tautan Dokumen',
        lastFeedback: '', // Clear old feedback when student uploads new revision
        history: [...existingHistory, newHistoryItem]
      };

      await setDoc(sessionRef, sessionData, { merge: true });
      
      // Update student's last activity and pending status
      await updateDoc(doc(db, 'students', nim), {
        lastGuidanceAt: new Date().toISOString(),
        hasPendingSession: true
      });
      
      toast.success(`Progress sesi bimbingan ${sessionNumber} berhasil dikirim!`);
      setNotes('');
      setAttachmentName('');
      setAttachmentData(null);
      setDocLink('');
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

      // Check if there are any other pending sessions for this student
      const pendingSnap = await getDocs(query(
        collection(db, 'meeting_sessions'), 
        where('studentNim', '==', nim), 
        where('status', '==', 'pending')
      ));
      
      if (pendingSnap.empty) {
        await updateDoc(doc(db, 'students', nim), {
          hasPendingSession: false
        });
      }
      
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

  const approvedCount = sessions.filter(s => s.status === 'approved').length;
  const isCompleted = approvedCount >= 8;

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {isCompleted && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-100"
          >
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase italic tracking-widest mb-3">
                  <CheckCircle2 size={12} /> Bimbingan Selesai
                </div>
                <h3 className="text-2xl font-black italic tracking-tight mb-2">Selamat! Anda Telah Menyelesaikan 8 Sesi.</h3>
                <p className="text-sm text-slate-400 font-medium italic opacity-80">Seluruh sesi telah divalidasi pembimbing. Silakan unduh laporan bimbingan akhir Anda.</p>
              </div>
              <button 
                onClick={() => toast.info("Menunggu Template", { description: "Hubungi Admin/Sistem Analis untuk upload template laporan institusi." })}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase italic tracking-widest shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-3 shrink-0"
              >
                <FileDown size={18} /> Cetak Laporan PDF
              </button>
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-10 bg-indigo-500 w-40 h-40 rounded-full blur-3xl translate-x-10 -translate-y-10" />
            <div className="absolute bottom-0 left-0 p-8 opacity-10 bg-emerald-500 w-40 h-40 rounded-full blur-3xl -translate-x-10 translate-y-10" />
          </motion.div>
        )}
      </AnimatePresence>

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
                  <h4 className="font-bold text-slate-800 tracking-tight italic">Sesi Bimbingan {session.sessionNumber}</h4>
                  <div className="flex items-center gap-1.5">
                    {isLockedBySequence ? <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Terkunci</span> : (
                      <>
                        {session.status === 'not_started' && <span className="text-[10px] text-slate-400 uppercase font-black">Belum Dimulai</span>}
                        {session.status === 'pending' && <span className="text-[10px] text-orange-500 uppercase font-black animate-pulse">Menunggu Review</span>}
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
                               <div className="flex flex-wrap items-center gap-2 mt-3 font-bold">
                                 {h.attachmentName && (
                                   <>
                                     <button 
                                       onClick={() => h.attachmentData && handlePreview(h.attachmentName, h.attachmentData)}
                                       className={cn(
                                         "flex items-center gap-1 transition-all p-1.5 rounded-lg border text-[10px] uppercase",
                                         h.type === 'admin_feedback' ? "bg-slate-100 border-slate-200 text-indigo-600" : "bg-white border-indigo-200 text-indigo-600",
                                         !h.attachmentData && "opacity-50 cursor-not-allowed"
                                       )}
                                     >
                                       <Eye size={12} />
                                       <span className="truncate max-w-[100px]">Pratinjau</span>
                                     </button>
                                     <button 
                                       onClick={() => h.attachmentData && handleDownload(h.attachmentName, h.attachmentData)}
                                       className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 transition-colors"
                                       title="Unduh Berkas"
                                     >
                                       <FileDown size={14} />
                                     </button>
                                   </>
                                 )}
                                 {h.docLink && (
                                   <a 
                                     href={h.docLink}
                                     target="_blank"
                                     rel="noreferrer"
                                     className="flex items-center gap-1.5 bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] uppercase shadow-sm hover:bg-indigo-700 transition-all"
                                   >
                                     <LinkIcon size={12} />
                                     Buka Tautan
                                   </a>
                                 )}
                               </div>
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
                        <div className="space-y-4 pt-6 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                             <h5 className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">Kirim Progres Bimbingan</h5>
                             <span className="text-[9px] font-bold text-slate-300 italic">Sesi {session.sessionNumber}</span>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[8px] font-black text-slate-400 uppercase italic ml-1 tracking-tighter">Deskripsi Progress / Catatan</label>
                              <textarea 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic min-h-[80px] font-medium"
                                placeholder="Jelaskan apa saja yang sudah dikerjakan atau direvisi..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                               <div className="space-y-1">
                                 <label className="text-[8px] font-black text-slate-400 uppercase italic ml-1 tracking-tighter">Lampiran Berkas (Opsional)</label>
                                 <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 cursor-pointer hover:bg-slate-50 transition-all border-dashed">
                                   <Upload size={14} className="text-indigo-600" />
                                   <span className="text-[9px] text-slate-400 truncate font-bold uppercase italic flex-1">
                                     {attachmentName || 'Pilih Berkas PDF/Docx'}
                                   </span>
                                   {attachmentName && (
                                     <button 
                                       type="button"
                                       onClick={(e) => {
                                         e.preventDefault();
                                         e.stopPropagation();
                                         setAttachmentName('');
                                         setAttachmentData(null);
                                       }}
                                       className="p-1 hover:bg-slate-200 rounded-full text-slate-400"
                                     >
                                       <X size={12} />
                                     </button>
                                   )}
                                   <input 
                                     type="file" 
                                     className="hidden" 
                                     onChange={handleFileChange}
                                   />
                                 </label>
                               </div>
                               <div className="space-y-1">
                                 <label className="text-[8px] font-black text-slate-400 uppercase italic ml-1 tracking-tighter">Tautan Dokumen (Google Drive/Docs)</label>
                                 <div className="relative">
                                    <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                      type="url"
                                      className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-8 pr-3 text-[10px] focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic font-bold"
                                      placeholder="https://docs.google.com/..."
                                      value={docLink}
                                      onChange={(e) => setDocLink(e.target.value)}
                                    />
                                 </div>
                               </div>
                            </div>
                          </div>

                          <button 
                            onClick={() => handleUpload(session.sessionNumber)}
                            disabled={uploadLoading === session.sessionNumber}
                            className="w-full bg-slate-900 text-white py-3 rounded-2xl text-xs font-black shadow-xl shadow-slate-200 hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 uppercase italic tracking-widest"
                          >
                            {uploadLoading === session.sessionNumber ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <>
                                <Send size={14} />
                                Kirim Progres Sesi {session.sessionNumber}
                              </>
                            )}
                          </button>
                        </div>
                      )
                    ) : (
                      // Admin Review Form
                      session.status === 'pending' && (
                        <div className="space-y-4 pt-6 border-t border-slate-200">
                          <h5 className="text-[10px] font-black text-indigo-600 uppercase italic mb-2 tracking-[0.2em] flex items-center gap-2">
                             <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping" /> Review Pembimbing
                          </h5>
                          <textarea 
                            className="w-full bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic min-h-[100px] font-bold text-slate-800"
                            placeholder="Ketik umpan balik bimbingan di sini..."
                            value={adminFeedback}
                            onChange={(e) => setAdminFeedback(e.target.value)}
                          />
                          <div className="flex items-center gap-3">
                            <select 
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] font-black uppercase italic outline-none cursor-pointer"
                              value={adminStatus}
                              onChange={(e) => setAdminStatus(e.target.value as any)}
                            >
                              <option value="approved">DISETUJUI / LANJUT SESI BERIKUTNYA</option>
                              <option value="revision">REVISI / ULANGI SESI INI</option>
                            </select>
                            <button 
                              onClick={() => handleAdminReview(session.sessionNumber)}
                              disabled={uploadLoading === session.sessionNumber}
                              className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase italic shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                            >
                              {uploadLoading === session.sessionNumber ? <Loader2 size={16} className="animate-spin" /> : 'Simpan Review'}
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

      {/* DOCUMENT PREVIEW MODAL */}
      <AnimatePresence>
        {viewingFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingFile(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] relative z-10 flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <FileDown className="text-indigo-600" />
                  <h3 className="font-bold text-slate-800 italic truncate max-w-[200px] md:max-w-md">{viewingFile.name}</h3>
                </div>
                <button 
                  onClick={() => setViewingFile(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 bg-slate-200 relative overflow-auto flex items-center justify-center">
                {viewingFile.data.includes('image') ? (
                  <img src={viewingFile.data} alt="Preview" className="max-w-full max-h-full object-contain" />
                ) : viewingFile.data.includes('pdf') || viewingFile.data.includes('application/msword') || viewingFile.data.includes('wordprocessingml') ? (
                  <iframe 
                    src={viewingFile.data} 
                    className="w-full h-full border-none"
                    title="Document Preview"
                  />
                ) : (
                  <div className="text-center p-8">
                    <AlertCircle size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-600 font-bold italic">Preview tidak tersedia untuk format ini.</p>
                    <button 
                       onClick={() => handleDownload(viewingFile.name, viewingFile.data)}
                       className="mt-4 text-indigo-600 font-bold hover:underline"
                    >
                      Klik di sini untuk mengunduh
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4 bg-white border-t flex justify-end">
                 <button 
                  onClick={() => handleDownload(viewingFile.name, viewingFile.data)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-black italic shadow-lg shadow-indigo-100 flex items-center gap-2"
                 >
                   <Paperclip size={14} /> DOWNLOAD DOKUMEN
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
