import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, CalendarCheck, AlertTriangle, CheckCircle2, Users, CalendarClock, Wrench, ScanLine } from 'lucide-react';
import { api } from '../lib/api.js';
import { RESERVATION_STATUS_LABELS, RESERVATION_STATUS_COLORS, formatDate, formatDateTime, toast } from '../lib/utils.js';
import { useAuthStore } from '../store/auth.js';

interface StatCardProps {
  icon: any;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
}

function StatCard({ icon: Icon, label, value, color, bgColor }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<any>({});
  const [pendingReservations, setPendingReservations] = useState<any[]>([]);
  const [duePlans, setDuePlans] = useState<any[]>([]);
  const [openFaults, setOpenFaults] = useState<any[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ov, res] = await Promise.all([
        api.statistics.overview(),
        api.reservations.list({ status: 'pending' }),
      ]);
      setOverview(ov);
      setPendingReservations(res.slice(0, 5));
      try {
        const plans = await api.maintenance.dueSoon(30);
        setDuePlans(plans.slice(0, 5));
      } catch {}
      try {
        const faults = await api.usage.faults();
        setOpenFaults(faults.filter((f: any) => f.status !== 'resolved').slice(0, 5));
      } catch {}
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleCheckin = async () => {
    if (!equipmentId) {
      toast('请输入设备编号', 'error');
      return;
    }
    setCheckingIn(true);
    try {
      const log = await api.usage.checkin({ equipment_id: Number(equipmentId) });
      toast(`签到成功：${log.equipment_name}`, 'success');
      setEquipmentId('');
      navigate('/usage');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Cpu} label="设备总数" value={overview.totalEquipment || 0} color="text-sky-600" bgColor="bg-sky-50" />
        <StatCard icon={CheckCircle2} label="可用设备" value={overview.normalEquipment || 0} color="text-emerald-600" bgColor="bg-emerald-50" />
        <StatCard icon={CalendarCheck} label="待审批预约" value={overview.pendingReservations || 0} color="text-amber-600" bgColor="bg-amber-50" />
        <StatCard icon={AlertTriangle} label="待处理故障" value={overview.openFaults || 0} color="text-red-600" bgColor="bg-red-50" />
        <StatCard icon={CalendarClock} label="总预约数" value={overview.totalReservations || 0} color="text-indigo-600" bgColor="bg-indigo-50" />
        <StatCard icon={Users} label="学生用户" value={overview.totalUsers || 0} color="text-purple-600" bgColor="bg-purple-50" />
      </div>

      {user?.role === 'student' && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <ScanLine size={20} className="text-slate-700" />
            <h2 className="font-semibold text-slate-800">快速扫码签到</h2>
          </div>
          <div className="flex gap-3">
            <input
              type="number"
              className="input flex-1"
              placeholder="输入设备编号（ID）签到使用"
              value={equipmentId}
              onChange={e => setEquipmentId(e.target.value)}
            />
            <button className="btn-primary" onClick={handleCheckin} disabled={checkingIn}>
              {checkingIn ? '签到中...' : '确认签到'}
            </button>
            <button className="btn-secondary" onClick={() => navigate('/usage')}>查看使用记录</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-4">待审批预约</h2>
          {pendingReservations.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">暂无待审批预约</p>
          ) : (
            <div className="space-y-3">
              {pendingReservations.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{r.equipment_name}</span>
                      <span className={`badge ${RESERVATION_STATUS_COLORS[r.status]}`}>{RESERVATION_STATUS_LABELS[r.status]}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {r.student_name} · {formatDate(r.reserve_date)} · {r.time_slot === 'morning' ? '上午' : r.time_slot === 'afternoon' ? '下午' : '晚上'}
                    </p>
                  </div>
                  <button className="btn-secondary text-xs h-8" onClick={() => navigate('/reservation')}>查看</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-4">近期维护提醒</h2>
          {duePlans.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">暂无即将到期的维护计划</p>
          ) : (
            <div className="space-y-3">
              {duePlans.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div className="flex items-start gap-3">
                    <Wrench size={16} className="text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{p.equipment_name}</p>
                      <p className="text-xs text-slate-500">{p.content}</p>
                    </div>
                  </div>
                  <span className="text-xs text-amber-600 font-medium whitespace-nowrap ml-2">{formatDate(p.next_due_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6 lg:col-span-2">
          <h2 className="font-semibold text-slate-800 mb-4">故障报告</h2>
          {openFaults.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">暂无待处理故障</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>设备</th>
                  <th>报告人</th>
                  <th>描述</th>
                  <th>状态</th>
                  <th>报告时间</th>
                </tr>
              </thead>
              <tbody>
                {openFaults.map(f => (
                  <tr key={f.id}>
                    <td className="font-medium">{f.equipment_name}</td>
                    <td>{f.reporter_name}</td>
                    <td className="max-w-xs truncate">{f.description}</td>
                    <td><span className="badge bg-red-100 text-red-700">{f.status === 'reported' ? '已报告' : '处理中'}</span></td>
                    <td className="text-slate-500">{formatDateTime(f.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
