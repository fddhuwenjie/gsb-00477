import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Lock, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../store/auth.js';
import { toast } from '../lib/utils.js';

const presetUsers = [
  { username: 'admin', password: 'admin123', label: '管理员 (admin/admin123)' },
  { username: 'tutor1', password: 'tutor123', label: '导师李教授 (tutor1/tutor123)' },
  { username: 'tutor2', password: 'tutor123', label: '导师王副教授 (tutor2/tutor123)' },
  { username: 'student1', password: 'stu123', label: '学生张三 (student1/stu123)' },
  { username: 'student2', password: 'stu123', label: '学生李四 (student2/stu123)' },
];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, checkAuth, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      toast('登录成功', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      toast(err.message || '登录失败', 'error');
    }
  };

  const handlePreset = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>
      
      <div className="relative w-full max-w-md">
        <div className="card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-lg shadow-sky-500/30 mb-4">
              <Cpu size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">实验室设备预约系统</h1>
            <p className="text-slate-500 text-sm mt-1">高校实验室综合管理平台</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">用户名</label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="input pl-9"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                />
              </div>
            </div>
            <div>
              <label className="label">密码</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className="input pl-9"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码"
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary w-full h-10"
              disabled={loading || !username || !password}
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-3">快速选择账号:</p>
            <div className="flex flex-wrap gap-2">
              {presetUsers.map(u => (
                <button
                  key={u.username}
                  onClick={() => handlePreset(u.username, u.password)}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
