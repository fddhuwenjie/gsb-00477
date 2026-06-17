import { useState, useEffect } from 'react';
import { Plus, Check, X, RotateCcw, FileX } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { BORROW_STATUS_LABELS, BORROW_STATUS_COLORS, formatDate, toast } from '../lib/utils.js';
import type { EquipmentBorrow, Equipment } from '../../shared/types.js';

export default function BorrowPage() {
  const { user } = useAuthStore();
  const [borrows, setBorrows] = useState<EquipmentBorrow[]>([]);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'approve'>('list');

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.status = filter;
      const data = await api.borrows.list(params);
      setBorrows(data);
      const [eq, l] = await Promise.all([api.equipment.list({ status: 'normal' }), api.equipment.labs()]);
      setEquipment(eq);
      setLabs(l);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipment_id || !formData.from_lab_id || !formData.to_lab_id || !formData.borrow_date || !formData.return_date) {
      toast('请填写所有必填项', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.borrows.create(formData);
      toast('借用申请已提交', 'success');
      setShowModal(false);
      setFormData({});
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    try { await api.borrows.approve(id); toast('已批准', 'success'); loadData(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  const handleReject = async (id: number) => {
    try { await api.borrows.reject(id); toast('已驳回', 'success'); loadData(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  const handleReturn = async (id: number) => {
    if (!confirm('确认归还该设备？')) return;
    try { await api.borrows.returnBorrow(id); toast('已归还', 'success'); loadData(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  const pendingList = borrows.filter(b => b.status === 'pending');
  const filtered = filter !== 'all' ? borrows : borrows;

  const handleEquipmentChange = (equipmentId: number) => {
    const eq = equipment.find(e => e.id === equipmentId);
    setFormData({ ...formData, equipment_id: equipmentId, from_lab_id: eq?.lab_id || '' });
  };

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['list', 'approve'] as const).map(t => (
            <button key={t} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setActiveTab(t)}>
              {t === 'list' ? '借用记录' : `待审批 (${pendingList.length})`}
            </button>
          ))}
        </div>
        {activeTab === 'list' && (
          <>
            <select className="input w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">全部状态</option>
              {Object.entries(BORROW_STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
            {user?.role === 'student' && (
              <button className="btn-primary ml-auto" onClick={() => setShowModal(true)}>
                <Plus size={16} className="mr-1" />申请借用
              </button>
            )}
          </>
        )}
      </div>

      {activeTab === 'approve' ? (
        user?.role === 'student' ? (
          <div className="card p-12 text-center text-slate-500">
            <FileX size={40} className="mx-auto mb-3 text-slate-300" />
            学生无权审批借用
          </div>
        ) : (
          <div className="card">
            {pendingList.length === 0 ? (
              <p className="text-slate-400 text-sm py-12 text-center">暂无待审批借用申请</p>
            ) : (
              <table className="table">
                <thead><tr><th>设备名称</th><th>借用人</th><th>借出实验室</th><th>借入实验室</th><th>借用日期</th><th>归还日期</th><th>操作</th></tr></thead>
                <tbody>
                  {pendingList.map(b => (
                    <tr key={b.id}>
                      <td className="font-medium">{b.equipment_name}</td>
                      <td>{b.borrower_name}</td>
                      <td>{b.from_lab_name}</td>
                      <td>{b.to_lab_name}</td>
                      <td>{formatDate(b.borrow_date)}</td>
                      <td>{formatDate(b.return_date)}</td>
                      <td className="flex gap-2">
                        <button className="btn-success h-8 text-xs" onClick={() => handleApprove(b.id)}><Check size={14} className="mr-1" />批准</button>
                        <button className="btn-danger h-8 text-xs" onClick={() => handleReject(b.id)}><X size={14} className="mr-1" />驳回</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      ) : (
        <div className="card">
          {filtered.length === 0 ? (
            <p className="text-slate-400 text-sm py-12 text-center">暂无借用记录</p>
          ) : (
            <table className="table">
              <thead><tr><th>设备名称</th><th>借用人</th><th>借出实验室</th><th>借入实验室</th><th>借用日期</th><th>归还日期</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.equipment_name}</td>
                    <td>{b.borrower_name}</td>
                    <td>{b.from_lab_name}</td>
                    <td>{b.to_lab_name}</td>
                    <td>{formatDate(b.borrow_date)}</td>
                    <td>{formatDate(b.return_date)}</td>
                    <td><span className={`badge ${BORROW_STATUS_COLORS[b.status]}`}>{BORROW_STATUS_LABELS[b.status]}</span></td>
                    <td>
                      {b.status === 'approved' && (user?.role === 'admin' || user?.role === 'tutor') && (
                        <button className="btn-secondary h-7 text-xs" onClick={() => handleReturn(b.id)}>
                          <RotateCcw size={14} className="mr-1" />归还
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Plus size={20} />申请借用</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">选择设备 *</label>
                <select className="input" value={formData.equipment_id || ''} onChange={e => handleEquipmentChange(Number(e.target.value))}>
                  <option value="">请选择设备</option>
                  {equipment.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">借出实验室 *</label>
                <input className="input bg-slate-50" readOnly value={labs.find(l => l.id === formData.from_lab_id)?.name || ''} placeholder="选择设备后自动填充" />
                <input type="hidden" value={formData.from_lab_id || ''} />
              </div>
              <div>
                <label className="label">借入实验室 *</label>
                <select className="input" value={formData.to_lab_id || ''} onChange={e => setFormData({ ...formData, to_lab_id: Number(e.target.value) })}>
                  <option value="">请选择实验室</option>
                  {labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">借用日期 *</label>
                  <input type="date" className="input" min={new Date().toISOString().split('T')[0]} value={formData.borrow_date || ''} onChange={e => setFormData({ ...formData, borrow_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">归还日期 *</label>
                  <input type="date" className="input" min={formData.borrow_date || new Date().toISOString().split('T')[0]} value={formData.return_date || ''} onChange={e => setFormData({ ...formData, return_date: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? '提交中...' : '提交申请'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
