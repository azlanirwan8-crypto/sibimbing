import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { BookOpen, User, School, Code, Database, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

const registerSchema = z.object({
  fullName: z.string().min(3, "Nama lengkap minimal 3 karakter"),
  nim: z.string().min(5, "NIM minimal 5 karakter"),
  researchTitle: z.string().min(10, "Judul penelitian minimal 10 karakter"),
  researchField: z.string().min(3, "Bidang penelitian minimal 3 karakter"),
  background: z.string().min(10, "Latar belakang minimal 10 karakter"),
  universityName: z.string().min(3, "Nama PT minimal 3 karakter"),
  programmingLanguage: z.string().min(1, "Wajib diisi"),
  databaseUsed: z.string().min(1, "Wajib diisi"),
});

type RegisterForm = z.infer<typeof registerSchema>;

interface LandingPageProps {
  onLogin: (nim: string) => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginNim, setLoginNim] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema)
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginNim) return;
    
    setIsLoading(true);
    try {
      // 1. Check Admin
      if (loginNim === '15081992') {
        toast.success("Halo Admin! Selamat bekerja.");
        onLogin(loginNim);
        return;
      }

      // 2. Check Student
      const docRef = doc(db, 'students', loginNim);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const studentData = docSnap.data();
        const correctPassword = studentData.password || 'unsia123';
        
        if (loginPassword === correctPassword) {
          toast.success(`Selamat datang, ${studentData.fullName}`);
          onLogin(loginNim);
        } else {
          toast.error("Password salah. Gunakan 'unsia123' jika baru pertama kali.");
        }
      } else {
        toast.error("NIM tidak terdaftar dalam sistem.");
      }
    } catch (error) {
      toast.error("Gagal melakukan pengecekan data");
    } finally {
      setIsLoading(false);
    }
  };

  const onRegisterSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'students', data.nim), {
        ...data,
        createdAt: new Date().toISOString()
      });
      toast.success("Pendaftaran berhasil!");
      onLogin(data.nim);
    } catch (error) {
      toast.error("Terjadi kesalahan saat mendaftar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-50"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl shadow-indigo-100 border border-slate-100 flex flex-col md:flex-row overflow-hidden"
      >
        {/* Left Side - Promo */}
        <div className="md:w-5/12 bg-indigo-600 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="bg-white/20 p-3 rounded-2xl w-fit mb-6">
              <BookOpen size={32} />
            </div>
            <h2 className="text-3xl font-bold mb-4 tracking-tight leading-tight">SiBimbing</h2>
            <p className="text-indigo-100 text-lg">
              Solusi cerdas pencatatan bimbingan tugas akhir & skripsi mahasiswa.
            </p>
          </div>
          


          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Right Side - Forms */}
        <div className="md:w-7/12 p-8 sm:p-12">
          {!isRegistering ? (
            <div className="h-full flex flex-col justify-center">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Masuk ke Dashboard</h3>
              <p className="text-slate-500 mb-8">Masukkan NIM Anda untuk mengakses data bimbingan.</p>
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 italic tracking-widest">NIM Mahasiswa</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Masukkan NIM..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all italic text-sm"
                      value={loginNim}
                      onChange={(e) => setLoginNim(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 italic tracking-widest">Password</label>
                  <div className="relative">
                    <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="password" 
                      placeholder="Masukkan Password..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all italic text-sm"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 italic ml-1 mt-1">
                    Password default: <span className="font-bold text-indigo-600">unsia123</span>
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <>MASUK DASHBOARD <ArrowRight size={20} /></>}
                </button>
              </form>


            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-slate-800">Pendaftaran Baru</h3>
                <button 
                  onClick={() => setIsRegistering(false)}
                  className="text-indigo-600 text-sm font-bold hover:underline"
                >
                  Batal
                </button>
              </div>
              
              <form onSubmit={handleSubmit(onRegisterSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput label="Nama Lengkap" icon={<User size={18}/>} placeholder="John Doe" {...register('fullName')} error={errors.fullName?.message} />
                  <FormInput label="NIM" icon={<FileText size={18}/>} placeholder="12345678" {...register('nim')} error={errors.nim?.message} />
                </div>

                <FormInput label="Judul Penelitian" icon={<BookOpen size={18}/>} placeholder="Analisis Implementasi..." {...register('researchTitle')} error={errors.researchTitle?.message} />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput label="Bidang Penelitian" icon={<FileText size={18}/>} placeholder="Web Development" {...register('researchField')} error={errors.researchField?.message} />
                  <FormInput label="Nama Perguruan Tinggi" icon={<School size={18}/>} placeholder="Universitas..." {...register('universityName')} error={errors.universityName?.message} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput label="Bahasa Pemrograman" icon={<Code size={18}/>} placeholder="TypeScript, PHP" {...register('programmingLanguage')} error={errors.programmingLanguage?.message} />
                  <FormInput label="Database" icon={<Database size={18}/>} placeholder="PostgreSQL, MongoDB" {...register('databaseUsed')} error={errors.databaseUsed?.message} />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Latar Belakang</label>
                  <textarea 
                    {...register('background')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] text-sm"
                    placeholder="Jelaskan secara singkat latar belakang penelitian..."
                  ></textarea>
                  {errors.background && <p className="text-red-500 text-xs mt-1">{errors.background.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Lampiran (PDF/Word)</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors cursor-pointer group">
                    <FileText className="mx-auto text-slate-300 group-hover:text-indigo-400 mb-2" size={32} />
                    <p className="text-xs text-slate-500">Klik untuk unggah draf proposal penelitian</p>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all mt-4 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : "Selesaikan Pendaftaran"}
                </button>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

const FormInput = React.forwardRef<HTMLInputElement, any>(({ label, icon, error, ...props }, ref) => (
  <div className="space-y-2">
    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">{label}</label>
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
      <input 
        ref={ref}
        {...props}
        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
      />
    </div>
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
));
FormInput.displayName = 'FormInput';
