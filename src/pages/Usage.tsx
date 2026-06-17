import { useState, useEffect } from 'react';
import { ScanLine, ClipboardList, AlertTriangle, Check, X, Play, Square, Package } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { URGENCY_LABELS, URGENCY_COLORS, FAULT_STATUS_LABELS, FAULT_STATUS_COLORS, formatDateTime, toast } from '../lib/utils.js';
import type { UsageLog, FaultReport, Equipment, Consumable } from '../../shared/types.js';

export default function UsagePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'logs' | 'checkin' | 'fault'>('logs');
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [faults, setFaults] = useState<FaultReport[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [activeLog, setActiveLog] = useState<UsageLog | null>(null);
  const [logForm, setLogForm] = useState({ experiment_content: '', equipment_status: '正常', has_anomaly: false, sample_count: 0 });
  const [showFaultModal, setShowFaultModal] = useState(false);
  const [faultForm, setFaultForm] = useState({ equipment_id: '', description: '', urgency: 'medium' });
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [consumableUsage, setConsumableUsage] = useState<Record<number, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeLog) {
      api.consumables.list({ equipment_id: activeLog.equipment_id }).then(setConsumables).catch(() => setConsumables([]));
    } else {
      setConsumables([]);
      setConsumableUsage({});
    }
  }, [activeLog]);

  const loadData = async () => {
    try {
      const [l, f, e] = await Promise.all([api.usage.logs(), api.usage.faults(), api.equipment.list()]);
      setLogs(l);
      setFaults(f);
      setEquipment(e);
      const active = l.find(x => !x.checkout_time && x.user_id === user?.id);
      if (active) setActiveLog(active);
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
      setActiveLog(log);
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLog) return;
    try {
      await api.usage.checkout({ log_id: activeLog.id, ...logForm });
      const usageEntries = Object.entries(consumableUsage).filter(([, qty]) => qty > 0);
      await Promise.all(usageEntries.map(([id, quantity]) => api.consumables.recordUsage(Number(id), { quantity, usage_log_id: activeLog.id })));
      toast('使用日志已提交', 'success');
      setActiveLog(null);
      setLogForm({ experiment_content: '', equipment_status: '正常', has_anomaly: false, sample_count: 0 });
      setConsumableUsage({});
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleSubmitFault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faultForm.equipment_id || !faultForm.description) {
      toast('请填写完整', 'error');
      return;
    }
    try {
      await api.usage.reportFault({ ...faultForm, equipment_id: Number(faultForm.equipment_id) });
      toast('故障报告已提交', 'success');
      setShowFaultModal(false);
      setFaultForm({ equipment_id: '', description: '', urgency: 'medium' });
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleUpdateFault = async (id: number, status: string) => {
    try {
      await api.usage.updateFault(id, { status });
      toast('已更新状态', 'success');
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['logs', 'checkin', 'fault'] as const).map(t => (
            <button key={t} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setActiveTab(t)}>
              {t === 'logs' ? '使用记录' : t === 'checkin' ? '扫码签到' : '故障报告'}
            </button>
          ))}
        </div>
        {(user?.role === 'student' || user?.role === 'tutor') && (
          <button className="btn-warning ml-auto" onClick={() => setShowFaultModal(true)}>
            <AlertTriangle size={16} className="mr-1" />报告故障
          </button>
        )}
      </div>

      {activeTab === 'checkin' && (
        <div className="card p-8">
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-lg shadow-sky-500/30 mb-6">
              <ScanLine size={44} className="text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2">设备签到</h2>
            <p className="text-sm text-slate-500 mb-6 text-center">输入设备编号（ID）确认签到开始使用<br />模拟扫码签到功能</p>
            
            {activeLog ? (
              <div className="w-full max-w-md">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Play size={16} className="text-emerald-600" />
                    <span className="font-semibold text-emerald-700">正在使用中</span>
                  </div>
                  <p className="text-lg font-medium">{activeLog.equipment_name}</p>
                  <p className="text-sm text-slate-500 mt-1">签到时间：{formatDateTime(activeLog.checkin_time)}</p>
                </div>
                <form onSubmit={handleCheckout} className="space-y-4">
                  <div>
                    <label className="label">实验内容</label>
                    <textarea className="input min-h-[80px]" required value={logForm.experiment_content} onChange={e => setLogForm({ ...logForm, experiment_content: e.target.value })} placeholder="请描述实验内容和结果" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">设备状态</label>
                      <select className="input" value={logForm.equipment_status} onChange={e => setLogForm({ ...logForm, equipment_status: e.target.value })}>
                        <option value="正常">正常</option>
                        <option value="轻微异常">轻微异常</option>
                        <option value="故障">故障</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">样品数量</label>
                      <input type="number" className="input" min={0} value={logForm.sample_count} onChange={e => setLogForm({ ...logForm, sample_count: Number(e.target.value) })} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" checked={logForm.has_anomaly} onChange={e => setLogForm({ ...logForm, has_anomaly: e.target.checked })} />
                    <span className="text-sm text-slate-700">存在异常情况</span>
                  </label>
                  {consumables.length > 0 && (
                    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Package size={16} />
                        <span>耗材消耗</span>
                      </div>
                      {consumables.map(c => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className="flex-1 text-sm text-slate-600">{c.name}</span>
                          <span className="text-xs text-slate-400">库存: {c.current_stock}{c.unit}</span>
                          <input
                            type="number"
                            className="input w-20 text-sm"
                            min={0}
                            max={c.current_stock}
                            value={consumableUsage[c.id] || 0}
                            onChange={e => setConsumableUsage({ ...consumableUsage, [c.id]: Number(e.target.value) })}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="submit" className="btn-primary w-full">
                    <Square size={16} className="mr-1" />结束使用并提交日志
                  </button>
                </form>
              </div>
            ) : (
              <div className="w-full max-w-md">
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input flex-1 text-lg py-3"
                    placeholder="请输入设备编号（如 1, 2, 3...）"
                    value={equipmentId}
                    onChange={e => setEquipmentId(e.target.value)}
                  />
                  <button className="btn-primary px-6" onClick={handleCheckin} disabled={checkingIn}>
                    {checkingIn ? '签到中...' : '确认签到'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-3 text-center">提示：设备列表页面可查看设备编号</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card">
          {logs.length === 0 ? (
            <p className="text-slate-400 text-sm py-12 text-center">暂无使用记录</p>
          ) : (
            <table className="table">
              <thead><tr><th>设备</th><th>使用人</th><th>签到时间</th><th>签退时间</th><th>实验内容</th><th>样品</th><th>状态</th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.equipment_name}</td>
                    <td>{l.user_name}</td>
                    <td>{formatDateTime(l.checkin_time)}</td>
                    <td>{l.checkout_time ? formatDateTime(l.checkout_time) : <span className="badge bg-emerald-100 text-emerald-700">使用中</span>}</td>
                    <td className="max-w-xs truncate">{l.experiment_content || '-'}</td>
                    <td>{l.sample_count || 0}</td>
                    <td>{l.has_anomaly ? <span className="badge bg-red-100 text-red-700">有异常</span> : <span className="badge bg-emerald-100 text-emerald-700">正常</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'fault' && (
        <div className="card">
          {faults.length === 0 ? (
            <p className="text-slate-400 text-sm py-12 text-center">暂无故障报告</p>
          ) : (
            <table className="table">
              <thead><tr><th>设备</th><th>报告人</th><th>描述</th><th>紧急程度</th><th>状态</th><th>报告时间</th><th>操作</th></tr></thead>
              <tbody>
                {faults.map(f => (
                  <tr key={f.id}>
                    <td className="font-medium">{f.equipment_name}</td>
                    <td>{f.reporter_name}</td>
                    <td className="max-w-xs truncate">{f.description}</td>
                    <td><span className={`badge ${URGENCY_COLORS[f.urgency]}`}>{URGENCY_LABELS[f.urgency]}</span></td>
                    <td><span className={`badge ${FAULT_STATUS_COLORS[f.status]}`}>{FAULT_STATUS_LABELS[f.status]}</span></td>
                    <td className="text-slate-500">{formatDateTime(f.created_at)}</td>
                    <td>
                      {user?.role === 'admin' && f.status !== 'resolved' && (
                        <div className="flex gap-2">
                          {f.status === 'reported' && (
                            <button className="btn-secondary h-7 text-xs" onClick={() => handleUpdateFault(f.id, 'processing')}>开始处理</button>
                          )}
                          <button className="btn-success h-7 text-xs" onClick={() => handleUpdateFault(f.id, 'resolved')}>标记解决</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showFaultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle size={20} className="text-amber-500" />提交故障报告</h2>
              <button onClick={() => setShowFaultModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitFault} className="space-y-4">
              <div>
                <label className="label">故障设备 *</label>
                <select className="input" value={faultForm.equipment_id} onChange={e => setFaultForm({ ...faultForm, equipment_id: e.target.value })}>
                  <option value="">请选择设备</option>
                  {equipment.map(e => (<option key={e.id} value={e.id}>{e.name}</option>))}
                </select>
              </div>
              <div>
                <label className="label">故障描述 *</label>
                <textarea className="input min-h-[100px]" value={faultForm.description} onChange={e => setFaultForm({ ...faultForm, description: e.target.value })} placeholder="请详细描述故障情况" />
              </div>
              <div>
                <label className="label">紧急程度</label>
                <select className="input" value={faultForm.urgency} onChange={e => setFaultForm({ ...faultForm, urgency: e.target.value })}>
                  {Object.entries(URGENCY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowFaultModal(false)}>取消</button>
                <button type="submit" className="btn-warning">提交报告</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
