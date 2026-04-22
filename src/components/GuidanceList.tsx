import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc,
  orderBy,
  doc,
  getDoc,
  setDoc,
  Timestamp 
} from 'firebase/firestore';
import { 
  Plus, 
  FileText, 
  Download, 
  Calendar, 
  MoreVertical, 
  CheckCircle2, 
  Paperclip,
  Loader2,
  X,
  History,
  FileCheck,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { formatDate, cn } from '../lib/utils';

interface GuidanceListProps {
  nim: string;
}

export default function GuidanceList({ nim }: GuidanceListProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [studentName, setStudentName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New Record Form
  const [newRecord, setNewRecord] = useState({
    researchTitle: '',
    background: '',
    universityName: '',
    programmingLanguage: '',
    databaseUsed: '',
    notes: '',
    attachmentName: '',
    attachmentData: '' // Added for Base64
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewRecord(prev => ({
          ...prev, 
          attachmentName: file.name,
          attachmentData: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = (fileName: string, base64: string) => {
    if (!base64) {
      toast.error("Berkas tidak ditemukan");
      return;
    }
    const link = document.createElement('a');
    link.href = base64;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      // Fetch Student Info
      const studentSnap = await getDoc(doc(db, 'students', nim));
      if (studentSnap.exists()) {
        const sData = studentSnap.data();
        setStudentName(sData.fullName);
        setNewRecord(prev => ({
          ...prev,
          researchTitle: sData.researchTitle || '',
          universityName: sData.universityName || '',
          programmingLanguage: sData.programmingLanguage || '',
          databaseUsed: sData.databaseUsed || ''
        }));
      }

      const q = query(
        collection(db, 'guidance_records'), 
        where('studentNim', '==', nim),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat riwayat bimbingan");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [nim]);

  const latestRecord = records[0];
  const isRevision = latestRecord?.status === 'revision';
  const isLocked = records.length > 0 && latestRecord?.status !== 'revision';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      toast.error("Anda sudah mengirimkan data bimbingan. Tunggu hasil review.");
      return;
    }

    try {
      const guidanceData = {
        studentNim: nim,
        studentFullName: studentName,
        researchTitle: newRecord.researchTitle,
        background: newRecord.background,
        universityName: newRecord.universityName,
        programmingLanguage: newRecord.programmingLanguage,
        databaseUsed: newRecord.databaseUsed,
        notes: newRecord.notes,
        status: 'pending', 
        attachmentName: newRecord.attachmentName || 'Dokumen_Penelitian.pdf',
        attachmentData: newRecord.attachmentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sessionDate: new Date().toISOString()
      };

      // Always add a new record to preserve history/revisions
      await addDoc(collection(db, 'guidance_records'), guidanceData);

      // Update student's profile and last activity
      const studentRef = doc(db, 'students', nim);
      try {
        await setDoc(studentRef, { 
          researchTitle: newRecord.researchTitle,
          background: newRecord.background,
          universityName: newRecord.universityName,
          programmingLanguage: newRecord.programmingLanguage,
          databaseUsed: newRecord.databaseUsed,
          lastGuidanceAt: new Date().toISOString(),
          lastStatus: 'pending' // Reset status on student doc too
        }, { merge: true });
      } catch (err) {
        console.error("Failed to update student profile", err);
      }

      toast.success(isRevision ? "Revisi berhasil terkirim!" : "Data bimbingan berhasil dikirim!");
      setShowAddModal(false);
      fetchRecords();
    } catch (error) {
      toast.error("Gagal mengirim data");
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 italic font-medium">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
            <History size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 italic tracking-tight">Pengajuan Judul Penelitian</h3>
            <p className="text-sm text-slate-500 italic">Kirim dan pantau status pengajuan judul penelitian Anda di sini.</p>
          </div>
        </div>
        <button 
          onClick={() => {
            if (isLocked) {
              toast.error("Anda sudah mengirimkan data bimbingan.");
              return;
            }
            if (isRevision) {
              setNewRecord({
                researchTitle: latestRecord.researchTitle || '',
                background: latestRecord.background || '',
                universityName: latestRecord.universityName || '',
                programmingLanguage: latestRecord.programmingLanguage || '',
                databaseUsed: latestRecord.databaseUsed || '',
                notes: latestRecord.notes || '',
                attachmentName: latestRecord.attachmentName || ''
              });
            }
            setShowAddModal(true);
          }}
          disabled={isLocked}
          className={cn(
            "font-bold py-3 px-6 rounded-2xl flex items-center gap-2 shadow-lg transition-all active:scale-95",
            isLocked ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100",
            isRevision && "bg-pink-600 hover:bg-pink-700 text-white shadow-pink-100"
          )}
        >
          {isLocked ? (
            <CheckCircle2 size={20} />
          ) : isRevision ? (
            <FileText size={20} />
          ) : (
            <Plus size={20} />
          )}
          {isLocked ? "Sedang Direview" : isRevision ? "Lakukan Revisi" : "Kirim Judul"}
        </button>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 uppercase">
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Tanggal</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Judul KP</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Status</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Feedback Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic font-medium">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Belum ada riwayat bimbingan.</td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-slate-600 italic">{formatDate(r.createdAt)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700 italic max-w-xs truncate">{r.researchTitle}</td>
                    <td className="px-6 py-4 italic">
                      {r.status === 'reviewed' ? (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-1 rounded-lg font-bold">DITERIMA</span>
                      ) : r.status === 'revision' ? (
                        <span className="bg-pink-100 text-pink-700 text-[10px] px-2 py-1 rounded-lg font-bold">REVISI</span>
                      ) : (
                        <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-lg font-bold">MENUNGGU</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs italic">
                      {r.adminFeedback ? (
                        <div className="flex items-center gap-2 text-indigo-600 font-bold bg-indigo-50 p-2 rounded-xl border border-indigo-100 italic">
                          <MessageSquare size={12} /> {r.adminFeedback}
                        </div>
                      ) : (
                        <span className="text-slate-300 italic">Belum ada feedback</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100">
        <h4 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 italic">
          <History size={20} className="text-indigo-600" /> Detil Riwayat
        </h4>
        <div className="space-y-4">
          {records.map((record, idx) => (
            <motion.div 
              key={record.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row gap-6 italic">
                <div className="flex-shrink-0">
                  <div className="bg-slate-50 p-4 rounded-2xl text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <Calendar size={24} />
                  </div>
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest italic">{formatDate(record.createdAt)}</p>
                      <h4 className="text-lg font-bold text-slate-800 mt-1 italic tracking-tight">{record.researchTitle}</h4>
                      <p className="text-xs text-slate-500 font-bold italic mt-0.5">{record.universityName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       {record.status === 'reviewed' ? (
                         <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-1 rounded-lg font-bold uppercase italic">Diterima</span>
                       ) : record.status === 'revision' ? (
                         <span className="bg-pink-100 text-pink-700 text-[10px] px-2 py-1 rounded-lg font-bold uppercase italic">Perlu Revisi</span>
                       ) : (
                         <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-lg font-bold uppercase italic">Sedang Antre</span>
                       )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase italic mb-1">Latar Belakang</p>
                      <p className="text-sm text-slate-600 leading-relaxed italic">{record.background}</p>
                    </div>
                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase italic mb-1">Teknologi</p>
                      <div className="flex gap-2">
                         <span className="bg-white px-2 py-1 rounded-lg text-xs font-bold border border-slate-200 italic">{record.programmingLanguage}</span>
                         <span className="bg-white px-2 py-1 rounded-lg text-xs font-bold border border-slate-200 italic">{record.databaseUsed}</span>
                      </div>
                      {record.notes && (
                        <div className="mt-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase italic mb-1">Catatan</p>
                          <p className="text-xs text-slate-500 italic">{record.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>                  
                  {record.adminFeedback && (
                    <div className="bg-indigo-50 p-6 rounded-2xl border-l-4 border-indigo-400 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare size={16} className="text-indigo-600" />
                        <p className="text-xs font-bold text-indigo-600 uppercase italic">Feedback dari Dosen/Admin</p>
                      </div>
                      <p className="text-sm text-slate-700 italic font-bold leading-relaxed">{record.adminFeedback}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {record.attachmentName && (
                      <button 
                        onClick={() => handleDownload(record.attachmentName, record.attachmentData)}
                        className={cn(
                          "flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold group/file cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition-colors border border-transparent hover:border-indigo-200",
                          !record.attachmentData && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Paperclip size={14} />
                        <span className="italic">{record.attachmentName}</span>
                        <Download size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal Add */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden italic"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                    <FileCheck size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight italic">
                    {isRevision ? "Revisi Judul" : "Kirim Judul"}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic">Judul KP (Tugas Akhir)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Masukkan judul penelitian Anda..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 italic"
                    value={newRecord.researchTitle}
                    onChange={(e) => setNewRecord({...newRecord, researchTitle: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic">Latar Belakang</label>
                  <textarea 
                    required
                    placeholder="Tuliskan latar belakang singkat penelitian Anda..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] text-sm italic"
                    value={newRecord.background}
                    onChange={(e) => setNewRecord({...newRecord, background: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic">Nama PT (tempat praktek)</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Contoh: UNIKOM"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 italic text-sm"
                      value={newRecord.universityName}
                      onChange={(e) => setNewRecord({...newRecord, universityName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic">Bahasa Pemrograman</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Contoh: PHP, Java, Python"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 italic text-sm"
                      value={newRecord.programmingLanguage}
                      onChange={(e) => setNewRecord({...newRecord, programmingLanguage: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic">Database Digunakan</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Contoh: MySQL, PostgreSQL"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 italic text-sm"
                      value={newRecord.databaseUsed}
                      onChange={(e) => setNewRecord({...newRecord, databaseUsed: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic">Upload Dokumen (PDF/Word)</label>
                    <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1 pr-3 cursor-pointer hover:bg-slate-100 transition-all">
                       <span className="flex-1 text-xs px-3 text-slate-400 italic truncate">
                         {newRecord.attachmentName || 'Pilih file (pdf/docx)...'}
                       </span>
                       <div className="text-indigo-600 text-[10px] font-bold bg-white px-2 py-1 rounded-lg border border-slate-200 italic">UPLOAD</div>
                       <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileChange}
                       />
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic">Catatan / Note</label>
                  <textarea 
                    placeholder="Tambahkan catatan jika ada..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px] text-sm italic"
                    value={newRecord.notes}
                    onChange={(e) => setNewRecord({...newRecord, notes: e.target.value})}
                  />
                </div>

                <button 
                  type="submit"
                  className={cn(
                    "w-full text-white font-bold py-4 rounded-2xl shadow-lg mt-2 transition-all active:scale-[0.98] italic",
                    isRevision ? "bg-pink-600 hover:bg-pink-700 shadow-pink-100" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  Submit Judul
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
