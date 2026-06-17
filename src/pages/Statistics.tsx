import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Cpu, AlertTriangle, Building2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { CATEGORY_LABELS, URGENCY_LABELS, FAULT_STATUS_LABELS, toast } from '../lib/utils.js';

export default function StatisticsPage() {
  const [usageRates, setUsageRates] = useState<any[]>([]);
  const [popular, setPopular] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [faultStats, setFaultStats] = useState<any>({});
  const [overview, setOverview] = useState<any>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [u, p, l, us, f, o] = await Promise.all([
        api.statistics.usageRate(),
        api.statistics.popularEquip(),
        api.statistics.labFrequency(),
        api.statistics.userRanking(),
        api.statistics.faultStats(),
        api.statistics.overview(),
      ]);
      setUsageRates(u);
      setPopular(p);
      setLabs(l);
      setUsers(us);
      setFaultStats(f);
      setOverview(o);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const maxUsage = Math.max(...usageRates.map(x => x.usage_rate || 0), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center"><Cpu size={20} className="text-sky-600" /></div>
            <div>
              <p className="text-xs text-slate-500">设备总数</p>
              <p className="text-2xl font-bold">{overview.totalEquipment || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><TrendingUp size={20} className="text-emerald-600" /></div>
            <div>
              <p className="text-xs text-slate-500">总预约数</p>
              <p className="text-2xl font-bold">{overview.totalReservations || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><Users size={20} className="text-amber-600" /></div>
            <div>
              <p className="text-xs text-slate-500">学生用户</p>
              <p className="text-2xl font-bold">{overview.totalUsers || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><AlertTriangle size={20} className="text-red-600" /></div>
            <div>
              <p className="text-xs text-slate-500">待处理故障</p>
              <p className="text-2xl font-bold">{overview.openFaults || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-5 flex items-center gap-2"><BarChart3 size={18} />本月设备使用率</h2>
          <div className="space-y-4">
            {usageRates.map(u => (
              <div key={u.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-slate-500">{u.usage_rate || 0}% ({u.used_slots || 0}/{u.total_slots}时段)</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all"
                    style={{ width: `${(u.usage_rate || 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-5 flex items-center gap-2"><Cpu size={18} />热门设备排行</h2>
          {popular.length === 0 ? <p className="text-slate-400 text-sm py-8 text-center">暂无数据</p> : (
            <div className="space-y-3">
              {popular.slice(0, 8).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="text-sm text-slate-500">{CATEGORY_LABELS[p.category]}</span>
                  <span className="text-sm font-semibold text-sky-600">{p.reservation_count} 次</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-5 flex items-center gap-2"><Building2 size={18} />实验室使用频率</h2>
          <div className="space-y-3">
            {labs.map(l => (
              <div key={l.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{l.name}</span>
                    <span className="text-sm font-semibold text-sky-600">{l.usage_count} 次</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, l.usage_count * 10)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-5 flex items-center gap-2"><Users size={18} />用户使用排行</h2>
          {users.length === 0 ? <p className="text-slate-400 text-sm py-8 text-center">暂无数据</p> : (
            <div className="space-y-3">
              {users.slice(0, 8).map((u, i) => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                  <span className="flex-1 font-medium">{u.name}</span>
                  <span className="text-sm text-slate-500">预约 {u.reservation_count} 次</span>
                  <span className="text-sm font-semibold text-emerald-600">使用 {u.usage_count} 次</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6 lg:col-span-2">
          <h2 className="font-semibold text-slate-800 mb-5 flex items-center gap-2"><AlertTriangle size={18} />故障统计</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">按紧急程度</h3>
              <div className="space-y-2">
                {(faultStats.byUrgency || []).map((f: any) => (
                  <div key={f.urgency} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                    <span>{URGENCY_LABELS[f.urgency] || f.urgency}</span>
                    <span className="font-semibold text-red-600">{f.count}</span>
                  </div>
                ))}
                {(faultStats.byUrgency || []).length === 0 && <p className="text-slate-400 text-sm">暂无数据</p>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">按处理状态</h3>
              <div className="space-y-2">
                {(faultStats.byStatus || []).map((f: any) => (
                  <div key={f.status} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                    <span>{FAULT_STATUS_LABELS[f.status] || f.status}</span>
                    <span className="font-semibold text-sky-600">{f.count}</span>
                  </div>
                ))}
                {(faultStats.byStatus || []).length === 0 && <p className="text-slate-400 text-sm">暂无数据</p>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">按设备</h3>
              <div className="space-y-2">
                {(faultStats.byEquipment || []).map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                    <span className="truncate max-w-[120px]">{f.name}</span>
                    <span className="font-semibold text-amber-600">{f.fault_count}</span>
                  </div>
                ))}
                {(faultStats.byEquipment || []).length === 0 && <p className="text-slate-400 text-sm">暂无数据</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
