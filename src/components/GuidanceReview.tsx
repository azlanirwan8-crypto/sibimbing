import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  where,
  updateDoc, 
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  MessageSquare, 
  CheckCircle, 
  User, 
  Clock,
  Eye,
  Info,
  Paperclip, 
  Loader2,
  Trash2,
  FileDown,
  Download,
  Save,
  AlertCircle,
  X,
  History,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { formatDate, cn } from '../lib/utils';

export default function GuidanceReview() {
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveLoading, setSaveLoading] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ name: string, data: string, url?: string } | null>(null);
  
  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (viewingFile?.url) {
        URL.revokeObjectURL(viewingFile.url);
      }
    };
  }, [viewingFile]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [recordHistory, setRecordHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState({ pending: 0, reviewed: 0, revision: 0 });

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    // Calculate stats
    const p = records.filter(r => r.status === 'pending').length;
    const rev = records.filter(r => r.status === 'reviewed').length;
    const rs = records.filter(r => r.status === 'revision').length;
    setStats({ pending: p, reviewed: rev, revision: rs });
  }, [records]);

  const fetchHistory = async (nim: string) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'guidance_records'), 
        where('studentNim', '==', nim),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setRecordHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoadingHistory(false);
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
      const q = query(collection(db, 'guidance_records'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      
      // Calculate revision numbers per student
      const studentCounts: Record<string, number> = {};
      const allRecords = snap.docs.map(doc => {
        const data = doc.data();
        const nim = data.studentNim;
        studentCounts[nim] = (studentCounts[nim] || 0) + 1;
        
        return { 
          id: doc.id, 
          ...data,
          studentNim: data.studentNim,
          revisionNumber: studentCounts[nim] - 1, // 0 for original, 1 for first revision, etc.
          tempStatus: data.status,
          tempFeedback: data.adminFeedback || ''
        };
      });

      // Sort back to desc for UI and fetch photos
      const reversed = allRecords.reverse();
      const studentNims = [...new Set(reversed.map(r => r.studentNim))];
      const studentPhotos: Record<string, string> = {};
      
      for (const nim of studentNims) {
        if (nim) {
          const sSnap = await getDoc(doc(db, 'students', nim));
          if (sSnap.exists()) {
            studentPhotos[nim] = sSnap.data().photoUrl || '';
          }
        }
      }

      const recordsWithPhotos = reversed.map(r => ({
        ...r,
        studentPhoto: studentPhotos[r.studentNim]
      }));

      setRecords(recordsWithPhotos);
    } catch (error) {
      toast.error("Gagal memuat riwayat bimbingan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRecord = async (id: string, status: string, feedback: string) => {
    setSaveLoading(id);
    try {
      const recordRef = doc(db, 'guidance_records', id);
      const recordSnap = await getDoc(recordRef);
      
      await updateDoc(recordRef, {
        status,
        adminFeedback: feedback,
        updatedAt: new Date().toISOString()
      });

      // Sync feedback to student document for dashboard display
      if (recordSnap.exists()) {
        const studentNim = recordSnap.data().studentNim;
        if (studentNim) {
          await setDoc(doc(db, 'students', studentNim), {
            lastFeedback: feedback,
            lastStatus: status
          }, { merge: true });
        }
      }

      toast.success("Data bimbingan berhasil diperbarui");
      
      // Update local state instead of full fetch to preserve other record's temp states
      setRecords(prev => prev.map(r => r.id === id ? { 
        ...r, 
        status, 
        adminFeedback: feedback,
        tempStatus: status,
        tempFeedback: feedback
      } : r));

    } catch (error) {
      console.error("Error updating record:", error);
      toast.error("Gagal memperbarui data. Cek koneksi atau izin database.");
    } finally {
      setSaveLoading(null);
    }
  };

  const handleTempChange = (id: string, field: 'tempStatus' | 'tempFeedback', value: string) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const filteredRecords = records.filter(r => 
    r.studentFullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.studentNim?.includes(searchTerm) ||
    r.researchTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 italic font-medium">
      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-orange-50 border-2 border-orange-100 p-6 rounded-[2rem] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-orange-400 uppercase italic tracking-widest mb-1">Menunggu Review</p>
            <h4 className="text-3xl font-black text-orange-600 italic tracking-tighter">{stats.pending} Judul</h4>
          </div>
          <div className="bg-white p-3 rounded-2xl shadow-sm text-orange-500">
             <Clock size={24} />
          </div>
        </div>
        <div className="bg-emerald-50 border-2 border-emerald-100 p-6 rounded-[2rem] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-emerald-400 uppercase italic tracking-widest mb-1">Judul Diterima</p>
            <h4 className="text-3xl font-black text-emerald-600 italic tracking-tighter">{stats.reviewed} Judul</h4>
          </div>
          <div className="bg-white p-3 rounded-2xl shadow-sm text-emerald-500">
             <CheckCircle size={24} />
          </div>
        </div>
        <div className="bg-pink-50 border-2 border-pink-100 p-6 rounded-[2rem] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-pink-400 uppercase italic tracking-widest mb-1">Perlu Revisi</p>
            <h4 className="text-3xl font-black text-pink-600 italic tracking-tighter">{stats.revision} Judul</h4>
          </div>
          <div className="bg-white p-3 rounded-2xl shadow-sm text-pink-500">
             <AlertCircle size={24} />
          </div>
        </div>
      </div>
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
            <History size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 italic tracking-tight">Review Bimbingan Mahasiswa</h3>
            <p className="text-sm text-slate-500 italic">Validasi dan berikan feedback untuk progres penelitian mahasiswa.</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari Nama / NIM..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm italic"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 uppercase">
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Mahasiswa</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Detail Penelitian</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Dokumen</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic group cursor-help" title="PENDING (MENUNGGU): Memerlukan review.&#10;REVISION (REVISI): Mahasiswa perlu memperbaiki data.&#10;REVIEWED (DITERIMA): Judul disetujui.">
                  <div className="flex items-center gap-1">
                    Status <Info size={10} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic group cursor-help" title="Berikan feedback atau alasan jika status adalah REVISI. Mahasiswa akan melihat pesan ini di dashboard mereka.">
                  <div className="flex items-center gap-1">
                    Umpan Balik <Info size={10} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-[10px] text-slate-400 tracking-widest font-black italic">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    Tidak ada data pengajuan ditemukan.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200">
                          {r.studentPhoto && !r.studentPhoto.includes('dicebear') ? (
                            <img src={r.studentPhoto} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User size={14} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{r.studentFullName}</p>
                          <div className="flex items-center gap-2">
                             <p className="text-[10px] text-slate-400 font-bold">{r.studentNim}</p>
                             {r.revisionNumber > 0 && (
                               <span className="bg-pink-50 text-pink-500 text-[8px] px-1 rounded border border-pink-100 font-black italic">
                                 REVISI #{r.revisionNumber}
                               </span>
                             )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{r.researchTitle}</p>
                        <p className="text-[10px] text-indigo-600 font-bold uppercase">{r.universityName}</p>
                        <button 
                          onClick={() => {
                            setSelectedRecord({
                              ...r,
                              tempStatus: r.status,
                              tempFeedback: r.adminFeedback || ''
                            });
                            fetchHistory(r.studentNim);
                          }}
                          className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold hover:underline transition-colors"
                        >
                          <Eye size={12} />
                          Lihat Detail & Umpan Balik
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {r.attachmentName ? (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => r.attachmentData && handlePreview(r.attachmentName, r.attachmentData)}
                            className="bg-indigo-50 p-2 rounded-lg text-indigo-600 hover:bg-indigo-100 transition-colors tooltip"
                            title="Pratinjau Dokumen"
                          >
                            <Paperclip size={16} />
                          </button>
                          <button 
                            onClick={() => r.attachmentData && handleDownload(r.attachmentName, r.attachmentData)}
                            className="bg-slate-50 p-2 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Unduh"
                          >
                            <FileDown size={16} />
                          </button>
                          <span className="text-[10px] font-bold uppercase truncate max-w-[80px] text-slate-500">{r.attachmentName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[10px] italic">Tanpa Berkas</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        className={cn(
                          "text-[10px] font-black rounded-lg px-2 py-1.5 outline-none border transition-all cursor-pointer",
                          r.tempStatus === 'pending' && "bg-orange-50 border-orange-200 text-orange-600",
                          r.tempStatus === 'reviewed' && "bg-emerald-50 border-emerald-200 text-emerald-600",
                          r.tempStatus === 'revision' && "bg-pink-50 border-pink-200 text-pink-600"
                        )}
                        value={r.tempStatus}
                        onChange={(e) => handleTempChange(r.id, 'tempStatus', e.target.value)}
                      >
                        <option value="pending">MENUNGGU</option>
                        <option value="reviewed">DITERIMA</option>
                        <option value="revision">REVISI</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <textarea 
                        className="w-full min-w-[200px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300 min-h-[40px]"
                        placeholder="Berikan masukan..."
                        value={r.tempFeedback}
                        onChange={(e) => handleTempChange(r.id, 'tempFeedback', e.target.value)}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleUpdateRecord(r.id, r.tempStatus, r.tempFeedback)}
                        disabled={saveLoading === r.id || (r.status === r.tempStatus && (r.adminFeedback || '') === r.tempFeedback)}
                        className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-300 shadow-sm transition-all active:scale-95"
                      >
                        {saveLoading === r.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* RECORD DETAIL MODAL */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRecord(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] relative z-10 flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-100">
                    <Info size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 italic tracking-tight uppercase">Detail Pengajuan Judul</h3>
                    <p className="text-xs text-slate-500 italic">Review data lengkap dan berikan keputusan.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Student & Info */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 text-center">
                      <div className="w-24 h-24 rounded-3xl bg-white border-2 border-indigo-100 mx-auto overflow-hidden shadow-inner mb-4 flex items-center justify-center">
                        {selectedRecord.studentPhoto && !selectedRecord.studentPhoto.includes('dicebear') ? (
                          <img src={selectedRecord.studentPhoto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={40} className="text-slate-300" />
                        )}
                      </div>
                      <h4 className="font-black text-slate-800 italic leading-tight">{selectedRecord.studentFullName}</h4>
                      <p className="text-xs font-bold text-indigo-600 mt-1 uppercase tracking-wider">{selectedRecord.studentNim}</p>
                      <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-2">
                        <div className="text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase italic">Status</p>
                          <p className={cn(
                            "text-[10px] font-black italic mt-0.5",
                            selectedRecord.status === 'pending' ? "text-orange-500" :
                            selectedRecord.status === 'reviewed' ? "text-emerald-500" : "text-pink-500"
                          )}>
                            {selectedRecord.status.toUpperCase()}
                          </p>
                        </div>
                        <div className="text-center border-l border-slate-200">
                          <p className="text-[8px] font-black text-slate-400 uppercase italic">Versi</p>
                          <p className="text-[10px] font-black text-slate-800 italic mt-0.5">
                            {selectedRecord.revisionNumber === 0 ? 'ASLI' : `REVISI #${selectedRecord.revisionNumber}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100">
                      <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic mb-3">Instansi / Kampus</h5>
                      <p className="text-sm font-bold text-slate-700 italic leading-snug">{selectedRecord.universityName || "-"}</p>
                    </div>

                    {selectedRecord.attachmentName && (
                      <div className="bg-slate-900 rounded-3xl p-5 text-white">
                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-3">Dokumen Lampiran</h5>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 truncate">
                            <Paperclip size={16} className="text-indigo-400" />
                            <span className="text-xs font-bold italic truncate max-w-[120px]">{selectedRecord.attachmentName}</span>
                          </div>
                          <div className="flex gap-2">
                             <button 
                               onClick={() => handlePreview(selectedRecord.attachmentName, selectedRecord.attachmentData)}
                               className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                             >
                               <Eye size={14} className="text-indigo-400" />
                             </button>
                             <button 
                               onClick={() => handleDownload(selectedRecord.attachmentName, selectedRecord.attachmentData)}
                               className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
                             >
                               <FileDown size={14} />
                             </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Title & Feedback */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-3 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Judul Penelitian
                      </h5>
                      <h2 className="text-xl font-black text-slate-800 italic leading-relaxed">
                        "{selectedRecord.researchTitle}"
                      </h2>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
                      <div>
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-2 flex items-center gap-2 text-indigo-600">
                          <MessageSquare size={12} /> Latar Belakang
                        </h5>
                        <p className="text-slate-600 text-sm italic font-medium leading-loose whitespace-pre-wrap">
                          {selectedRecord.background || "-"}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-slate-100">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-2 flex items-center gap-2 text-indigo-600">
                          <AlertCircle size={12} /> Rumusan Masalah
                        </h5>
                        <p className="text-slate-600 text-sm italic font-medium leading-loose whitespace-pre-wrap">
                          {selectedRecord.problemStatement || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-6 rounded-3xl border border-slate-200">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-2 flex items-center gap-2 text-emerald-600">
                          <CheckCircle size={12} /> Tujuan Penelitian
                        </h5>
                        <p className="text-slate-600 text-sm italic font-medium leading-loose">
                          {selectedRecord.researchObjective || "-"}
                        </p>
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-slate-200">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-2 flex items-center gap-2 text-amber-600">
                          <Info size={12} /> Metodologi
                        </h5>
                        <p className="text-slate-600 text-sm italic font-medium leading-loose">
                          {selectedRecord.methodology || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                       <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-3">Spesifikasi Teknologi</h5>
                       <div className="flex flex-wrap gap-2">
                          <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 text-xs font-bold italic text-slate-700">
                             <span className="text-[8px] text-slate-400 uppercase block mb-0.5">Bahasa</span>
                             {selectedRecord.programmingLanguage || "-"}
                          </div>
                          <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 text-xs font-bold italic text-slate-700">
                             <span className="text-[8px] text-slate-400 uppercase block mb-0.5">Database</span>
                             {selectedRecord.databaseUsed || "-"}
                          </div>
                       </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border-2 border-indigo-50 space-y-4">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-4">Berikan Keputusan & Umpan Balik</h5>
                      
                      <div className="flex gap-3">
                        {['pending', 'reviewed', 'revision'].map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedRecord((prev: any) => ({ ...prev, tempStatus: s }))}
                            className={cn(
                              "flex-1 py-3 rounded-2xl text-[10px] font-black italic transition-all border-2",
                              selectedRecord.tempStatus === s ? (
                                s === 'pending' ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-100" :
                                s === 'reviewed' ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-100" :
                                "bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-100"
                              ) : (
                                "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                              )
                            )}
                          >
                            {s === 'pending' ? 'MENUNGGU' : s === 'reviewed' ? 'TERIMA JUDUL' : 'PERLU REVISI'}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase italic ml-1">Pesan Umpan Balik Untuk Mahasiswa</label>
                        <textarea 
                          rows={4}
                          className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic font-medium placeholder:text-slate-300"
                          placeholder="Tuliskan alasan penolakan atau catatan tambahan di sini..."
                          value={selectedRecord.tempFeedback}
                          onChange={(e) => setSelectedRecord((prev: any) => ({ ...prev, tempFeedback: e.target.value }))}
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                         <button 
                           onClick={() => setSelectedRecord(null)}
                           className="px-6 py-3 rounded-2xl text-slate-400 font-bold italic hover:bg-slate-100 transition-all"
                         >
                           Batal
                         </button>
                         <button 
                           onClick={() => {
                             handleUpdateRecord(selectedRecord.id, selectedRecord.tempStatus, selectedRecord.tempFeedback);
                             setSelectedRecord(null);
                           }}
                           disabled={saveLoading === selectedRecord.id || (selectedRecord.status === selectedRecord.tempStatus && (selectedRecord.adminFeedback || '') === selectedRecord.tempFeedback)}
                           className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black italic shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
                         >
                           {saveLoading === selectedRecord.id ? <Loader2 size={16} className="animate-spin" /> : <><Save size={18} /> SIMPAN KEPUTUSAN</>}
                         </button>
                      </div>
                    </div>

                    {/* VERSION HISTORY TIMELINE */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-6 flex items-center gap-2">
                        <History size={12} /> Riwayat Pengajuan Mahasiswa
                      </h5>
                      
                      {loadingHistory ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="animate-spin text-slate-300" />
                        </div>
                      ) : recordHistory.length > 1 ? (
                        <div className="space-y-6 relative ml-2">
                          <div className="absolute left-[3px] top-2 bottom-2 w-0.5 bg-slate-200" />
                          {recordHistory.map((h, idx) => (
                            <div key={h.id} className="relative pl-8">
                              <div className={cn(
                                "absolute left-0 top-1 w-2 h-2 rounded-full",
                                h.id === selectedRecord.id ? "bg-indigo-600 scale-150" : "bg-slate-300"
                              )} />
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] font-black text-slate-400 italic uppercase">
                                {formatDate(h.createdAt)} • {h.revisionNumber === 0 ? 'VERSI AWAL' : `REVISI #${h.revisionNumber}`}
                                </p>
                                <span className={cn(
                                  "text-[8px] font-black italic px-1.5 rounded uppercase",
                                  h.status === 'reviewed' ? "bg-emerald-50 text-emerald-500" :
                                  h.status === 'revision' ? "bg-pink-50 text-pink-500" : "bg-orange-50 text-orange-500"
                                )}>
                                  {h.status}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-700 italic line-clamp-1">{h.researchTitle}</p>
                              {h.adminFeedback && (
                                <p className="text-[10px] text-slate-500 italic mt-1 bg-white p-2 rounded-lg border border-slate-100 italic line-clamp-2">
                                  "{h.adminFeedback}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic text-center py-4">Belum ada riwayat perbaikan sebelumnya.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
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
                   <Paperclip size={14} /> UNDUH DOKUMEN
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
