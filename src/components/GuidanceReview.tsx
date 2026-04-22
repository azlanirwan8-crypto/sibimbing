import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  updateDoc, 
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  MessageSquare, 
  CheckCircle, 
  User, 
  Paperclip, 
  Loader2,
  Trash2,
  FileDown,
  Save,
  AlertCircle,
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

  useEffect(() => {
    fetchRecords();
  }, []);

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
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Detil Penelitian</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Dokumen</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Status</th>
                <th className="px-6 py-4 text-[10px] text-slate-400 tracking-widest font-black italic">Feedback Admin</th>
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
                    Tidak ada data bimbingan ditemukan.
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
                          onClick={() => toast.info(`Latar Belakang: ${r.background}`, { duration: 5000 })}
                          className="text-[10px] text-slate-400 underline hover:text-indigo-500 transition-colors"
                        >
                          Lihat Latar Belakang
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {r.attachmentName ? (
                        <button 
                          onClick={() => {
                            toast.success(`Mengunduh file: ${r.attachmentName}`);
                            const element = document.createElement('a');
                            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent("Isi dokumen mock."));
                            element.setAttribute('download', r.attachmentName);
                            element.style.display = 'none';
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
                          }}
                          className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 transition-colors border-none bg-transparent cursor-pointer"
                        >
                          <FileDown size={16} />
                          <span className="text-[10px] font-bold uppercase truncate max-w-[100px]">{r.attachmentName}</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px] italic">No File</span>
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
    </div>
  );
}
