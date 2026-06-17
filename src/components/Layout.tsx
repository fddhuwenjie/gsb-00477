import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Cpu, Calendar, ClipboardList, GraduationCap,
  BarChart3, Wrench, LogOut, Menu, X, User, ChevronRight,
  ArrowRightLeft, FolderKanban, FileBarChart
} from 'lucide-react';
import { useAuthStore } from '../store/auth.js';
import { ROLE_LABELS } from '../lib/utils.js';
import { toast } from '../lib/utils.js';

const navItems = [
  { path: '/dashboard', label: '仪表盘', icon: LayoutDashboard, roles: ['student', 'tutor', 'admin'] },
  { path: '/equipment', label: '设备管理', icon: Cpu, roles: ['student', 'tutor', 'admin'] },
  { path: '/reservation', label: '预约中心', icon: Calendar, roles: ['student', 'tutor', 'admin'] },
  { path: '/borrow', label: '跨室借用', icon: ArrowRightLeft, roles: ['student', 'tutor', 'admin'] },
  { path: '/project', label: '项目管理', icon: FolderKanban, roles: ['student', 'tutor', 'admin'] },
  { path: '/usage', label: '使用日志', icon: ClipboardList, roles: ['student', 'tutor', 'admin'] },
  { path: '/training', label: '培训管理', icon: GraduationCap, roles: ['student', 'tutor', 'admin'] },
  { path: '/report', label: '报表中心', icon: FileBarChart, roles: ['tutor', 'admin'] },
  { path: '/statistics', label: '统计分析', icon: BarChart3, roles: ['tutor', 'admin'] },
  { path: '/maintenance', label: '维护保养', icon: Wrench, roles: ['admin', 'tutor'] },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast('已退出登录', 'success');
    navigate('/login');
  };

  const visibleNav = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-slate-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center">
                <Cpu size={18} />
              </div>
              <span className="font-semibold">实验室管理系统</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : <X size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
          {visibleNav.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors mb-1 ${
                  active ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">
                <User size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user?.name}</div>
                <div className="text-xs text-slate-400">{user ? ROLE_LABELS[user.role] : ''}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              <span>退出登录</span>
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between">
          <h1 className="text-lg font-semibold text-slate-800">
            {visibleNav.find(i => location.pathname === i.path || location.pathname.startsWith(i.path + '/'))?.label || '实验室管理'}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">欢迎回来，{user?.name}</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
