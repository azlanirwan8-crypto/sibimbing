import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, deleteDoc, doc, setDoc, writeBatch, getDocsFromServer } from 'firebase/firestore';
import { 
  Users, 
  Download, 
  Plus, 
  Search, 
  MoreVertical, 
  Trash2, 
  UserPlus,
  User,
  Loader2,
  FileSpreadsheet,
  Upload,
  X,
  FileUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ProfileUpdate from './ProfileUpdate';

const ITEMS_PER_PAGE = 10;

export default function StudentManagement() {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [academicYear, setAcademicYear] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudentNim, setSelectedStudentNim] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'students'));
      // Force server-only fetch to verify wipe
      const snap = await getDocsFromServer(q);
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      toast.error("Gagal memuat data mahasiswa");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !academicYear) {
      toast.error("Pilih file dan tentukan Tahun Ajaran dahulu");
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        if (!dataBuffer) throw new Error("Gagal membaca file buffer");

        const wb = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (!data || data.length === 0) {
          toast.error("File Excel ini tidak berisi data.");
          setIsImporting(false);
          return;
        }

        // 1. Optimize: Map columns ONCE instead of per-row
        const firstRow = data[0];
        const keys = Object.keys(firstRow);
        
        const getMappedKey = (searchKeys: string[]) => {
          return keys.find(k => 
            searchKeys.some(sk => 
              k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(sk.replace(/[^a-z0-9]/g, ''))
            )
          );
        };

        const nimKey = getMappedKey(['nim', 'nomorinduk', 'idmahasiswa']);
        const nameKey = getMappedKey(['nama', 'fullname', 'name', 'lengkap']);
        const titleKey = getMappedKey(['judul', 'title', 'skripsi', 'penelitian']);
        const fieldKey = getMappedKey(['bidang', 'field', 'research']);
        const univKey = getMappedKey(['pt', 'kampus', 'universitas', 'university', 'ptn', 'pts']);

        if (!nimKey) {
          toast.error("Kolom 'NIM' tidak ditemukan. Harap pastikan header kolom sudah benar.");
          setIsImporting(false);
          return;
        }

        // 2. Optimization: Process in chunks of 500 (Firestore batch limit)
        const CHUNK_SIZE = 500;
        let successCount = 0;

        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          let batchCount = 0;

          for (const row of chunk) {
            const nim = String(row[nimKey] || '').trim();
            if (!nim) continue;

            const studentRef = doc(db, 'students', nim);
            batch.set(studentRef, {
              nim,
              fullName: String(row[nameKey || ''] || 'Mahasiswa Baru').trim(),
              researchTitle: String(row[titleKey || ''] || 'Belum Ditentukan').trim(),
              researchField: String(row[fieldKey || ''] || 'Umum').trim(),
              universityName: String(row[univKey || ''] || 'Universitas').trim(),
              academicYear: academicYear,
              createdAt: new Date().toISOString()
            }, { merge: true });
            batchCount++;
          }

          if (batchCount > 0) {
            await batch.commit();
            successCount += batchCount;
          }
        }

        if (successCount === 0) {
          toast.error("Tidak ada data valid yang diimpor.");
        } else {
          toast.success(`Berhasil mengimpor ${successCount} mahasiswa untuk TA ${academicYear}`);
          setShowImportModal(false);
          fetchStudents();
        }
      } catch (error) {
        console.error("Import Error:", error);
        toast.error("Terjadi kesalahan saat memproses file Excel.");
      } finally {
        setIsImporting(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    const dataToExport = students.map(({ nim, fullName, academicYear }) => ({
      'NIM': nim,
      'Nama Lengkap': fullName,
      'Tahun Ajaran': academicYear || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mahasiswa');
    XLSX.writeFile(wb, 'Data_Mahasiswa_Bimbingan.xlsx');
    toast.success("Data berhasil diekspor ke Excel");
  };

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.nim.includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-6 italic">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 italic">Daftar Mahasiswa</h3>
            <p className="text-sm text-slate-500 italic">Total {students.length} Mahasiswa terdaftar.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowImportModal(true)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold py-3 px-6 rounded-2xl flex items-center gap-2 border border-indigo-100 transition-all"
          >
            <Upload size={20} /> Import Data
          </button>
          <button 
            onClick={handleExport}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold py-3 px-6 rounded-2xl flex items-center gap-2 border border-emerald-100 transition-all"
          >
            <FileSpreadsheet size={20} /> Ekspor Excel
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Cari mahasiswa berdasarkan nama atau NIM..."
          className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm italic"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 uppercase font-black">
                <th className="px-6 py-4 text-[10px] text-slate-500 tracking-widest italic">NIM</th>
                <th className="px-6 py-4 text-[10px] text-slate-500 tracking-widest italic">Nama Lengkap</th>
                <th className="px-6 py-4 text-[10px] text-slate-500 tracking-widest italic text-right">Tahun Ajaran</th>
                <th className="px-6 py-4 text-[10px] text-slate-500 tracking-widest italic text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-indigo-600" />
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">
                    Tidak ada data mahasiswa ditemukan.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{student.nim}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                          {student.photoUrl && !student.photoUrl.includes('dicebear') ? (
                            <img src={student.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <User size={14} />
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium text-slate-700 truncate">{student.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="bg-slate-100 px-2 py-1 rounded-lg text-slate-600 font-bold tracking-tight text-xs uppercase">TA {student.academicYear || '-'}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedStudentNim(student.nim)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black py-1.5 px-3 rounded-lg shadow-sm transition-all uppercase tracking-tighter"
                      >
                        Detail / Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between italic">
            <p className="text-xs text-slate-500 font-medium">
              Menampilkan <span className="font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)}</span> dari <span className="font-bold">{filteredStudents.length}</span> Mahasiswa
            </p>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "w-8 h-8 rounded-xl text-xs font-bold transition-all",
                    currentPage === page 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                      : "text-slate-600 hover:bg-white hover:border hover:border-slate-200"
                  )}
                >
                  {page}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isImporting && setShowImportModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md relative z-10 shadow-2xl flex flex-col italic"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                    <FileUp size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 italic">Import Mahasiswa</h3>
                </div>
                <button 
                  onClick={() => setShowImportModal(false)} 
                  disabled={isImporting}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase italic ml-1">Pilih Tahun Ajaran</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 italic"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                  >
                    <option value="">-- Pilih Tahun Ajaran --</option>
                    <option value="2023/2024">2023/2024</option>
                    <option value="2024/2025">2024/2025</option>
                    <option value="2025/2026">2025/2026</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase italic ml-1">Upload File Excel (.xlsx)</label>
                  <label className={cn(
                    "w-full h-32 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all",
                    isImporting && "opacity-50 cursor-not-allowed"
                  )}>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      className="hidden" 
                      disabled={isImporting || !academicYear}
                      onChange={handleFileUpload}
                    />
                    <Download className="text-slate-400 mb-2" size={32} />
                    <p className="text-sm font-bold text-slate-500 italic">Klik untuk pilih file</p>
                    <p className="text-[10px] text-slate-400 mt-1 italic">Format: NIM, Nama</p>
                  </label>
                </div>

                {isImporting && (
                  <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold animate-pulse italic">
                    <Loader2 className="animate-spin" size={16} /> Sedang memproses data...
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Detail / Update Password Modal */}
      <AnimatePresence>
        {selectedStudentNim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudentNim(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <ProfileUpdate 
                nim={selectedStudentNim} 
                isModal={true}
                onlyPassword={true}
                onComplete={() => {
                  setSelectedStudentNim(null);
                  fetchStudents();
                }} 
                onCancel={() => setSelectedStudentNim(null)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
