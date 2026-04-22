import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Search, User, Loader2, ChevronRight, LayoutGrid } from 'lucide-react';
import GuidanceSessions from './GuidanceSessions';
import { toast } from 'sonner';

export default function SessionReview() {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'students'), orderBy('fullName', 'asc')));
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      toast.error("Gagal memuat data mahasiswa");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.nim?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {selectedStudent ? (
        <div className="space-y-4">
          <button 
            onClick={() => setSelectedStudent(null)}
            className="text-xs font-black text-indigo-600 hover:underline uppercase italic flex items-center gap-1"
          >
            ← Kembali ke daftar mahasiswa
          </button>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
             {(() => {
               const s = students.find(std => std.nim === selectedStudent);
               return (
                 <>
                   <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200">
                     {s?.photoUrl && !s.photoUrl.includes('dicebear') ? (
                       <img src={s.photoUrl} alt="" className="w-full h-full object-cover" />
                     ) : <User size={24} />}
                   </div>
                   <div>
                     <h3 className="text-xl font-bold text-slate-800 italic">Review Bimbingan: {s?.fullName}</h3>
                     <p className="text-sm text-slate-500 italic">NIM: {selectedStudent}</p>
                   </div>
                 </>
               );
             })()}
          </div>
          <GuidanceSessions nim={selectedStudent} isAdmin={true} />
        </div>
      ) : (
        <>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                  <LayoutGrid size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 italic">Daftar Bimbingan Mahasiswa</h3>
                  <p className="text-sm text-slate-500 italic">Pilih mahasiswa untuk meninjau 8 pertemuan bimbingan.</p>
                </div>
             </div>
             <div className="relative w-full md:w-64">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
               <div className="col-span-full py-12 flex justify-center">
                 <Loader2 className="animate-spin text-indigo-600" size={32} />
               </div>
            ) : filteredStudents.map((s) => (
              <button
                key={s.nim}
                onClick={() => setSelectedStudent(s.nim)}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-300 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors overflow-hidden border border-slate-100">
                    {s.photoUrl && !s.photoUrl.includes('dicebear') ? (
                      <img src={s.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : <User size={20} />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800 truncate max-w-[150px] italic">{s.fullName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{s.nim}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
