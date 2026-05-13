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
  AlertCircle,
  Eye,
  History,
  FileCheck,
  MessageSquare,
  Info
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
  const [viewingFile, setViewingFile] = useState<{ name: string, data: string, url?: string } | null>(null);
  
  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (viewingFile?.url) {
        URL.revokeObjectURL(viewingFile.url);
      }
    };
  }, [viewingFile]);
  
  // New Record Form
  const [newRecord, setNewRecord] = useState({
    researchTitle: '',
    background: '',
    problemStatement: '',
    researchObjective: '',
    methodology: '',
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
      if (file.size > 800 * 1024) { // Roughly 800KB to account for Base64 overhead (final size ~1MB)
        toast.error("Berkas terlalu besar", { 
          description: "Maksimal ukuran berkas adalah 800KB untuk memastikan penyimpanan stabil." 
        });
        e.target.value = ''; // Reset input
        return;
      }
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

  const handlePreview = (fileName: string, base64: string) => {
    try {
      if (base64 && base64.startsWith('data:')) {
        const parts = base64.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const byteCharacters = atob(parts[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: contentType });
        const url = URL.createObjectURL(blob);
        setViewingFile({ name: fileName, data: base64, url });
      } else if (base64) {
        // Fallback if data: prefix is somehow missing but it's valid base64
        setViewingFile({ name: fileName, data: base64 });
      } else {
        toast.error("Data berkas tidak valid atau kosong.");
      }
    } catch (e) {
      console.error("Preview error", e);
      setViewingFile({ name: fileName, data: base64 });
    }
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
          problemStatement: sData.problemStatement || '',
          researchObjective: sData.researchObjective || '',
          methodology: sData.methodology || '',
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
        problemStatement: newRecord.problemStatement,
        researchObjective: newRecord.researchObjective,
        methodology: newRecord.methodology,
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
          problemStatement: newRecord.problemStatement,
          researchObjective: newRecord.researchObjective,
          methodology: newRecord.methodology,
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
                problemStatement: latestRecord.problemStatement || '',
                researchObjective: latestRecord.researchObjective || '',
                methodology: latestRecord.methodology || '',
                universityName: latestRecord.universityName || '',
                programmingLanguage: latestRecord.programmingLanguage || '',
                databaseUsed: latestRecord.databaseUsed || '',
                notes: latestRecord.notes || '',
                attachmentName: latestRecord.attachmentName || '',
                attachmentData: latestRecord.attachmentData || ''
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
          {isLocked ? "Sedang Direview" : isRevision ? "Lakukan Revisi" : "Ajukan Judul Baru"}
        </button>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 uppercase">
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic text-left">Tanggal</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Judul Kerja Praktik</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic flex items-center gap-1 group cursor-help" title="MENUNGGU: Judul sedang dalam antrian review.&#10;REVISI: Perlu perbaikan berdasarkan masukan.&#10;DITERIMA: Judul disetujui, silakan lanjut bimbingan.">
                  Status <Info size={10} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                </th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic group cursor-help" title="Komentar, saran, atau alasan revisi dari dosen pembimbing akan ditampilkan di sini.">
                  <div className="flex items-center gap-1">
                    Umpan Balik <Info size={10} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-[10px] text-slate-400 tracking-widest font-black italic">Berkas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic font-medium">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Belum ada riwayat pengajuan.</td>
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
                        <span className="text-slate-300 italic">Belum ada tanggapan</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                       {r.attachmentName ? (
                         <button 
                          onClick={() => r.attachmentData && handlePreview(r.attachmentName, r.attachmentData)}
                          className="bg-slate-100 p-2 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                          title={r.attachmentName}
                         >
                           <Paperclip size={14} />
                         </button>
                       ) : "-"}
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
          <History size={20} className="text-indigo-600" /> Detail Riwayat Pengajuan
        </h4>
        <div className="space-y-4">
          {records.map((record, idx) => (
            <motion.div 
              key={record.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="group bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all relative overflow-hidden"
            >
              <div className="flex flex-col gap-6 italic">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-slate-50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-4 rounded-3xl text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <Calendar size={28} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] italic">{formatDate(record.createdAt)}</p>
                      <h4 className="text-xl font-black text-slate-800 mt-1 italic tracking-tight leading-tight">{record.researchTitle}</h4>
                      <p className="text-xs text-slate-400 font-bold italic mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 bg-slate-200 rounded-full" /> {record.universityName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                     {record.status === 'reviewed' ? (
                       <span className="bg-emerald-100 text-emerald-700 text-xs px-4 py-2 rounded-2xl font-black uppercase italic shadow-sm shadow-emerald-100">Diterima</span>
                     ) : record.status === 'revision' ? (
                       <span className="bg-pink-100 text-pink-700 text-xs px-4 py-2 rounded-2xl font-black uppercase italic shadow-sm shadow-pink-100">Perlu Revisi</span>
                     ) : (
                       <span className="bg-amber-100 text-amber-700 text-xs px-4 py-2 rounded-2xl font-black uppercase italic shadow-sm shadow-amber-100">Menunggu Review</span>
                     )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  <div className="md:col-span-7 space-y-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest flex items-center gap-2">
                        <span className="w-4 h-[2px] bg-indigo-100" /> Rumusan Masalah
                      </p>
                      <p className="text-sm text-slate-600 leading-relaxed italic font-medium bg-slate-50/50 p-6 rounded-3xl border border-slate-100/50">
                        {record.problemStatement || record.background}
                      </p>
                    </div>

                    {record.adminFeedback && (
                      <div className="bg-indigo-50 p-8 rounded-[2rem] border-2 border-indigo-100 relative overflow-hidden shadow-inner">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <MessageSquare size={80} />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="bg-indigo-600 p-1.5 rounded-lg">
                              <MessageSquare size={14} className="text-white" />
                            </div>
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest italic">Umpan Balik Dosen/Admin</p>
                          </div>
                          <p className="text-base text-slate-800 italic font-black leading-relaxed">"{record.adminFeedback}"</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-5 space-y-6">
                    <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">Informasi Teknis</p>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 italic mb-1">Objektif/Tujuan Penelitian:</p>
                            <p className="text-xs text-slate-800 font-bold italic">{record.researchObjective || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 italic mb-1">Metodologi:</p>
                            <p className="text-xs text-slate-800 font-bold italic">{record.methodology || '-'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2">
                             <span className="bg-white px-3 py-1.5 rounded-xl text-[10px] font-black border border-slate-200 italic text-indigo-600 shadow-sm">{record.programmingLanguage}</span>
                             <span className="bg-white px-3 py-1.5 rounded-xl text-[10px] font-black border border-slate-200 italic text-indigo-600 shadow-sm">{record.databaseUsed}</span>
                          </div>
                        </div>
                      </div>

                      {record.notes && (
                        <div className="pt-4 border-t border-slate-200/50">
                          <p className="text-[10px] font-black text-slate-400 uppercase italic mb-2 tracking-widest">Catatan Tambahan</p>
                          <p className="text-xs text-slate-500 italic leading-relaxed">{record.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-3xl">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                          <Paperclip size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase italic">Lampiran Dokumen</p>
                          <p className="text-xs text-slate-800 font-black italic max-w-[150px] truncate">{record.attachmentName || 'Tidak ada file'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {record.attachmentName && (
                          <>
                            <button 
                              onClick={() => record.attachmentData && handlePreview(record.attachmentName, record.attachmentData)}
                              className="bg-slate-900 text-white p-2.5 rounded-2xl hover:bg-indigo-600 transition-all shadow-lg active:scale-90"
                              title="Pratinjau"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={() => record.attachmentData && handleDownload(record.attachmentName, record.attachmentData)}
                              className="bg-indigo-50 text-indigo-600 p-2.5 rounded-2xl hover:bg-indigo-100 transition-all border border-indigo-100 active:scale-90"
                              title="Unduh"
                            >
                              <Download size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
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
                    {isRevision ? "Revisi Pengajuan Judul" : "Ajukan Judul Baru"}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 italic tracking-widest">Judul Dokumen / Penelitian</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Masukkan judul dokumen/penelitian Anda secara lengkap..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 italic font-bold text-slate-800"
                    value={newRecord.researchTitle}
                    onChange={(e) => setNewRecord({...newRecord, researchTitle: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic tracking-widest">Latar Belakang Singkat</label>
                    <textarea 
                      required
                      placeholder="Apa yang mendasari pemilihan judul ini?"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] text-sm italic"
                      value={newRecord.background}
                      onChange={(e) => setNewRecord({...newRecord, background: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic tracking-widest">Rumusan Masalah</label>
                    <textarea 
                      required
                      placeholder="Masalah apa yang ingin diselesaikan?"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] text-sm italic"
                      value={newRecord.problemStatement}
                      onChange={(e) => setNewRecord({...newRecord, problemStatement: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic tracking-widest">Tujuan Penelitian (Objektif)</label>
                    <textarea 
                      required
                      placeholder="Apa target atau hasil yang ingin dicapai?"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] text-sm italic"
                      value={newRecord.researchObjective}
                      onChange={(e) => setNewRecord({...newRecord, researchObjective: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic tracking-widest">Metodologi Pengembangan</label>
                    <textarea 
                      required
                      placeholder="Contoh: Waterfall, Agile, Scrum, atau Metode Penelitian lainnya..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] text-sm italic"
                      value={newRecord.methodology}
                      onChange={(e) => setNewRecord({...newRecord, methodology: e.target.value})}
                    />
                  </div>
                </div>

                <div className="bg-indigo-50/50 p-6 rounded-[2rem] border-2 border-indigo-100 space-y-4">
                  <h5 className="text-[10px] font-black text-indigo-600 uppercase italic tracking-[0.2em] mb-2 flex items-center gap-2">
                    <span className="w-4 h-[2px] bg-indigo-200" /> Spesifikasi Teknis Pendukung
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 italic">Instansi / Lokasi Penelitian</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Nama tempat KP"
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 italic text-xs"
                        value={newRecord.universityName}
                        onChange={(e) => setNewRecord({...newRecord, universityName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 italic">Bahasa Pemrograman</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Java, PHP, Python, dsb."
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 italic text-xs"
                        value={newRecord.programmingLanguage}
                        onChange={(e) => setNewRecord({...newRecord, programmingLanguage: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 italic">Sistem Basis Data</label>
                      <input 
                        type="text" 
                        required
                        placeholder="MySQL, PostgreSQL, Firebase..."
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 italic text-xs"
                        value={newRecord.databaseUsed}
                        onChange={(e) => setNewRecord({...newRecord, databaseUsed: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic tracking-widest">Pesan untuk Pembimbing</label>
                    <input 
                      type="text"
                      placeholder="Tambahkan catatan singkat (opsional)..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 italic text-sm"
                      value={newRecord.notes}
                      onChange={(e) => setNewRecord({...newRecord, notes: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 italic tracking-widest">Unggah Berkas (PDF/Dokumen)</label>
                    <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1 pr-3 cursor-pointer hover:bg-slate-100 transition-all h-[50px]">
                       <span className="flex-1 text-xs px-3 text-slate-400 italic truncate">
                         {newRecord.attachmentName || 'PDF/Docx maks. 800KB...'}
                       </span>
                       <div className="text-white text-[8px] font-black bg-slate-900 px-3 py-2 rounded-xl italic uppercase tracking-tighter">Pilih Berkas</div>
                       <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileChange}
                       />
                    </label>
                  </div>
                </div>

                <button 
                  type="submit"
                  className={cn(
                    "w-full text-white font-black py-4 rounded-3xl shadow-lg mt-2 transition-all active:scale-[0.98] italic tracking-widest uppercase",
                    isRevision ? "bg-pink-600 hover:bg-pink-700 shadow-pink-100" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  {isRevision ? "Kirim Revisi Sekarang" : "Ajukan Judul Sekarang"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  <Download className="text-indigo-600" />
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
                {viewingFile.data.toLowerCase().includes('image') || viewingFile.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img src={viewingFile.url || viewingFile.data} alt="Preview" className="max-w-full max-h-full object-contain p-4 shadow-2xl" />
                ) : viewingFile.data.toLowerCase().includes('pdf') || viewingFile.name.toLowerCase().endsWith('.pdf') ? (
                  <div className="w-full h-full flex flex-col">
                    <div className="bg-slate-800 p-2 flex justify-center">
                      <a 
                        href={viewingFile.url || viewingFile.data} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-white font-bold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-all italic flex items-center gap-2"
                      >
                        <Eye size={12} /> BUKA DI JENDELA BARU JIKA PRATINJAU KOSONG
                      </a>
                    </div>
                    <iframe 
                      src={viewingFile.url || viewingFile.data} 
                      className="w-full flex-1 border-none bg-white"
                      title="Document Preview"
                    />
                  </div>
                ) : (
                  <div className="text-center p-12 bg-white rounded-3xl shadow-xl border border-slate-100 max-w-sm mx-auto">
                    <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                       <AlertCircle size={40} />
                    </div>
                    <h4 className="text-lg font-black text-slate-800 italic uppercase mb-2">Pratinjau Terbatas</h4>
                    <p className="text-sm text-slate-500 italic mb-8 font-medium leading-relaxed">
                      Format <span className="text-indigo-600 font-bold">.{viewingFile.name.split('.').pop()}</span> tidak dapat ditampilkan langsung. Silakan unduh berkas untuk melihat konten lengkap.
                    </p>
                    <button 
                       onClick={() => handleDownload(viewingFile.name, viewingFile.data)}
                       className="w-full bg-slate-900 text-white font-black italic py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                    >
                      <Download size={18} /> UNDUH SEKARANG
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
