import { useState, useEffect } from 'react';
import { Wrench, Calendar, Plus, X, Clipboard, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { MAINTENANCE_FREQUENCY_LABELS, formatDate, formatDateTime, toast } from '../lib/utils.js';
import type { MaintenancePlan, MaintenanceRecord, Equipment } from '../../shared/types.js';

export default function MaintenancePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'plans' | 'records'>('plans');
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [planForm, setPlanForm] = useState<any>({});
  const [recordForm, setRecordForm] = useState<any>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [p, r, e] = await Promise.all([api.maintenance.plans(), api.maintenance.records(), api.equipment.list()]);
      setPlans(p);
      setRecords(r);
      setEquipment(e);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.equipment_id || !planForm.frequency || !planForm.content || !planForm.next_due_date) {
      toast('请填写完整', 'error'); return;
    }
    try {
      await api.maintenance.createPlan(planForm);
      toast('维护计划已创建', 'success');
      setShowPlanModal(false);
      setPlanForm({});
      loadData();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordForm.equipment_id || !recordForm.maintenance_date || !recordForm.content) {
      toast('请填写完整', 'error'); return;
    }
    try {
      await api.maintenance.createRecord(recordForm);
      toast('维护记录已添加', 'success');
      setShowRecordModal(false);
      setRecordForm({});
      loadData();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const isDueSoon = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  };

  const totalCost = records.reduce((s, r) => s + Number(r.cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="card p-4 flex items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['plans', 'records'] as const).map(t => (
            <button key={t} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setActiveTab(t)}>
              {t === 'plans' ? '维护计划' : '维护记录'}
            </button>
          ))}
        </div>
        {user?.role === 'admin' && (
          <div className="ml-auto flex gap-2">
            <button className="btn-secondary" onClick={() => setShowRecordModal(true)}><Clipboard size={16} className="mr-1" />添加记录</button>
            <button className="btn-primary" onClick={() => setShowPlanModal(true)}><Plus size={16} className="mr-1" />新建计划</button>
          </div>
        )}
      </div>

      {activeTab === 'plans' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-5">
              <p className="text-sm text-slate-500">活跃计划</p>
              <p className="text-2xl font-bold mt-2 text-emerald-600">{plans.filter(p => p.is_active).length}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">7天内到期</p>
              <p className="text-2xl font-bold mt-2 text-amber-600">{plans.filter(p => p.is_active && isDueSoon(p.next_due_date)).length}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">维护记录总数</p>
              <p className="text-2xl font-bold mt-2 text-sky-600">{records.length}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">累计维护成本</p>
              <p className="text-2xl font-bold mt-2 text-indigo-600">¥{totalCost.toLocaleString()}</p>
            </div>
          </div>

          <div className="card">
            {plans.length === 0 ? (
              <p className="text-slate-400 text-sm py-12 text-center">暂无维护计划</p>
            ) : (
              <table className="table">
                <thead><tr><th>设备</th><th>维护频率</th><th>维护内容</th><th>下次到期</th><th>状态</th></tr></thead>
                <tbody>
                  {plans.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.equipment_name}</td>
                      <td>{MAINTENANCE_FREQUENCY_LABELS[p.frequency]}</td>
                      <td className="max-w-xs truncate">{p.content}</td>
                      <td className={isDueSoon(p.next_due_date) && p.is_active ? 'text-amber-600 font-medium' : ''}>
                        {isDueSoon(p.next_due_date) && p.is_active && <AlertCircle size={14} className="inline mr-1 text-amber-500" />}
                        {formatDate(p.next_due_date)}
                      </td>
                      <td>{p.is_active ? <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle2 size={12} className="mr-1" />进行中</span> : <span className="badge bg-slate-100 text-slate-600">已停用</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {activeTab === 'records' && (
        <div className="card">
          {records.length === 0 ? (
            <p className="text-slate-400 text-sm py-12 text-center">暂无维护记录</p>
          ) : (
            <table className="table">
              <thead><tr><th>维护日期</th><th>设备</th><th>维护人</th><th>维护内容</th><th>更换配件</th><th>费用</th></tr></thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>{formatDate(r.maintenance_date)}</td>
                    <td className="font-medium">{r.equipment_name}</td>
                    <td>{r.maintainer_name || '-'}</td>
                    <td className="max-w-xs truncate">{r.content}</td>
                    <td>{r.replaced_parts || '-'}</td>
                    <td className="font-medium text-emerald-600">¥{Number(r.cost || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Wrench size={20} />新建维护计划</h2>
              <button onClick={() => setShowPlanModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <label className="label">关联设备 *</label>
                <select className="input" value={planForm.equipment_id || ''} onChange={e => setPlanForm({ ...planForm, equipment_id: Number(e.target.value) })}>
                  <option value="">请选择</option>
                  {equipment.map(eq => (<option key={eq.id} value={eq.id}>{eq.name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">维护频率 *</label>
                  <select className="input" value={planForm.frequency || ''} onChange={e => setPlanForm({ ...planForm, frequency: e.target.value })}>
                    <option value="">请选择</option>
                    {Object.entries(MAINTENANCE_FREQUENCY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
                <div>
                  <label className="label">下次到期日 *</label>
                  <input type="date" className="input" value={planForm.next_due_date || ''} onChange={e => setPlanForm({ ...planForm, next_due_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">维护内容 *</label>
                <textarea className="input min-h-[80px]" value={planForm.content || ''} onChange={e => setPlanForm({ ...planForm, content: e.target.value })} placeholder="描述维护工作内容" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowPlanModal(false)}>取消</button>
                <button type="submit" className="btn-primary">创建计划</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRecordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Clipboard size={20} />添加维护记录</h2>
              <button onClick={() => setShowRecordModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateRecord} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">设备 *</label>
                  <select className="input" value={recordForm.equipment_id || ''} onChange={e => setRecordForm({ ...recordForm, equipment_id: Number(e.target.value) })}>
                    <option value="">请选择</option>
                    {equipment.map(eq => (<option key={eq.id} value={eq.id}>{eq.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="label">维护日期 *</label>
                  <input type="date" className="input" value={recordForm.maintenance_date || ''} onChange={e => setRecordForm({ ...recordForm, maintenance_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">维护内容 *</label>
                <textarea className="input min-h-[80px]" value={recordForm.content || ''} onChange={e => setRecordForm({ ...recordForm, content: e.target.value })} placeholder="描述执行的维护工作" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">更换配件</label>
                  <input className="input" value={recordForm.replaced_parts || ''} onChange={e => setRecordForm({ ...recordForm, replaced_parts: e.target.value })} placeholder="如：滤芯x2" />
                </div>
                <div>
                  <label className="label flex items-center gap-1"><DollarSign size={14} />费用 (元)</label>
                  <input type="number" className="input" min={0} value={recordForm.cost || ''} onChange={e => setRecordForm({ ...recordForm, cost: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowRecordModal(false)}>取消</button>
                <button type="submit" className="btn-primary">添加记录</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
