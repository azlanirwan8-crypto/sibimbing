import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { User, Phone, Lock, Upload, Loader2, Save, Camera, X } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface ProfileUpdateProps {
  nim: string;
  onComplete: () => void;
  onCancel?: () => void;
  isModal?: boolean;
  onlyPassword?: boolean;
}

export default function ProfileUpdate({ nim, onComplete, onCancel, isModal = false, onlyPassword = false }: ProfileUpdateProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    photoUrl: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchExistingData();
  }, [nim]);

  const fetchExistingData = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'students', nim));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData(prev => ({
          ...prev,
          fullName: data.fullName || '',
          phoneNumber: data.phoneNumber || '',
          photoUrl: data.photoUrl || ''
        }));
        if (data.photoUrl) setPreview(data.photoUrl);
      }
    } catch (error) {
      console.error("Error fetching student data:", error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Password konfirmasi tidak cocok");
      return;
    }

    if (!onlyPassword && (!formData.fullName || !formData.phoneNumber)) {
      toast.error("Harap isi semua data wajib");
      return;
    }

    // Password only required if not already set or specifically being changed
    if (!formData.password && !isModal) {
      toast.error("Password wajib diisi");
      return;
    }

    setIsLoading(true);
    try {
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      if (!onlyPassword) {
        updateData.fullName = formData.fullName;
        updateData.phoneNumber = formData.phoneNumber;
        updateData.photoUrl = formData.photoUrl || '';
        updateData.isProfileComplete = true;
      }

      if (formData.password) {
        updateData.password = formData.password;
      }

      await setDoc(doc(db, 'students', nim), updateData, { merge: true });
      
      toast.success(onlyPassword ? "Password berhasil diperbarui!" : "Biodata berhasil diperbarui!");
      onComplete();
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Gagal melakukan pembaruan. Pastikan ukuran foto tidak terlalu besar.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="max-w-2xl mx-auto h-64 flex flex-col items-center justify-center italic">
        <Loader2 className="animate-spin text-indigo-600 mb-2" />
        <p className="text-sm text-slate-400">Memuat data profil...</p>
      </div>
    );
  }

  return (
    <div className={cn("max-w-2xl mx-auto italic font-medium", isModal && "max-w-4xl")}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 relative"
      >
        {isModal && (
          <button 
            onClick={onCancel}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X size={24} />
          </button>
        )}

        <div className="text-center mb-10">
          {onlyPassword && (
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-indigo-200 overflow-hidden">
              {preview ? <img src={preview} alt="Profile" className="w-full h-full object-cover" /> : <User size={40} />}
            </div>
          )}
          <h2 className="text-2xl font-black text-slate-800 tracking-tight italic">
            {onlyPassword ? 'Reset Password Mahasiswa' : isModal ? 'Update Biodata Mahasiswa' : 'Lengkapi Biodata Mahasiswa'}
          </h2>
          <p className="text-slate-500 mt-2 italic shadow-sm bg-slate-50 py-1 px-4 rounded-full inline-block">
            {onlyPassword ? `NIM: ${nim} - ${formData.fullName}` : isModal ? 'Kelola informasi profil dan keamanan akun Anda.' : 'Silakan isi data diri Anda untuk pertama kali sebelum melanjutkan.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!onlyPassword && (
            <div className="flex flex-col items-center mb-8">
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Camera size={32} className="text-slate-300" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg cursor-pointer transform transition-transform group-hover:scale-110">
                  <Upload size={14} />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 600000) {
                          toast.error("Ukuran foto tidak boleh lebih dari 600KB");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          setPreview(base64String);
                          setFormData({...formData, photoUrl: base64String});
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest italic">Upload Foto Profil</p>
            </div>
          )}

          {!onlyPassword && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1 italic tracking-widest">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    required
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic text-sm"
                    placeholder="Masukkan nama lengkap..."
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1 italic tracking-widest">Nomor WA / HP</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    required
                    type="tel" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic text-sm"
                    placeholder="Contoh: 081234567..."
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}

          <div className={cn("grid grid-cols-1 gap-6 pt-2", !onlyPassword && "md:grid-cols-2")}>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1 italic tracking-widest">Password Baru</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  required
                  type="password" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic text-sm"
                  placeholder="Buat password baru..."
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1 italic tracking-widest">Konfirmasi Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  required
                  type="password" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic text-sm"
                  placeholder="Ulangi password..."
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-6 italic"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <><Save size={20} /> {onlyPassword ? 'SIMPAN PASSWORD BARU' : 'SIMPAN BIODATA & LANJUT'}</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
