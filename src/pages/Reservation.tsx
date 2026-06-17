import { useState, useEffect } from 'react';
import { Plus, Check, X, Clock, XCircle, CalendarPlus, FileX, CalendarX, Users, FolderOpen } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { CATEGORY_LABELS, RESERVATION_STATUS_LABELS, RESERVATION_STATUS_COLORS, WAITLIST_STATUS_LABELS, WAITLIST_STATUS_COLORS, TIME_SLOT_LABELS, formatDate, toast } from '../lib/utils.js';
import type { Reservation, Equipment, User, Waitlist, Project } from '../../shared/types.js';

export default function ReservationPage() {
  const { user } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [tutors, setTutors] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'approve' | 'waitlist'>('list');
  const [waitlist, setWaitlist] = useState<Waitlist[]>([]);
  const [slotAvailable, setSlotAvailable] = useState<boolean | null>(null);
  const [waitlistCount, setWaitlistCount] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, [filter]);

  useEffect(() => {
    if (activeTab === 'waitlist') loadWaitlist();
  }, [activeTab]);

  useEffect(() => {
    if (formData.equipment_id && formData.reserve_date && formData.time_slot) {
      checkSlotAvailability();
      checkWaitlistCount();
    } else {
      setSlotAvailable(null);
      setWaitlistCount(0);
    }
  }, [formData.equipment_id, formData.reserve_date, formData.time_slot]);

  const loadData = async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.status = filter;
      const data = await api.reservations.list(params);
      setReservations(data);
      const [eq, us, proj] = await Promise.all([
        api.equipment.list({ status: 'normal' }),
        api.auth.users(),
        user?.role === 'student' ? api.projects.list() : Promise.resolve([])
      ]);
      setEquipment(eq);
      setTutors(us.filter(u => u.role === 'tutor'));
      setProjects(proj);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipment_id || !formData.tutor_id || !formData.reserve_date || !formData.time_slot || !formData.purpose) {
      toast('请填写所有必填项', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.reservations.create(formData);
      toast('预约已提交，等待导师审批', 'success');
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
    try { await api.reservations.approve(id); toast('已通过', 'success'); loadData(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  const handleReject = async (id: number) => {
    try { await api.reservations.reject(id); toast('已驳回', 'success'); loadData(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('确认取消该预约？')) return;
    try { await api.reservations.cancel(id); toast('已取消', 'success'); loadData(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  const loadWaitlist = async () => {
    try {
      const data = await api.waitlist.list();
      setWaitlist(data);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const checkSlotAvailability = async () => {
    try {
      const result = await api.reservations.check(formData.equipment_id, formData.reserve_date, formData.time_slot);
      setSlotAvailable(result.available);
    } catch {
      setSlotAvailable(null);
    }
  };

  const checkWaitlistCount = async () => {
    try {
      const data = await api.waitlist.list({ equipment_id: formData.equipment_id, reserve_date: formData.reserve_date, time_slot: formData.time_slot, status: 'waiting' });
      setWaitlistCount(data.length);
    } catch {
      setWaitlistCount(0);
    }
  };

  const handleWaitlistJoin = async () => {
    setSubmitting(true);
    try {
      await api.waitlist.join(formData);
      toast('已加入候补', 'success');
      setShowModal(false);
      setFormData({});
      setSlotAvailable(null);
      setWaitlistCount(0);
      loadWaitlist();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWaitlistCancel = async (id: number) => {
    if (!confirm('确认退出候补？')) return;
    try { await api.waitlist.cancel(id); toast('已退出候补', 'success'); loadWaitlist(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  const pendingList = reservations.filter(r => r.status === 'pending');
  const filtered = filter !== 'all' ? reservations : reservations;

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['list', 'approve', ...(user?.role === 'student' ? ['waitlist' as const] : [])] as const).map(t => (
            <button key={t} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setActiveTab(t)}>
              {t === 'list' ? '预约列表' : t === 'approve' ? `待审批 (${pendingList.length})` : '我的候补'}
            </button>
          ))}
        </div>
        {activeTab === 'list' && (
          <>
            <select className="input w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">全部状态</option>
              {Object.entries(RESERVATION_STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
            {user?.role === 'student' && (
              <button className="btn-primary ml-auto" onClick={() => setShowModal(true)}>
                <Plus size={16} className="mr-1" />新建预约
              </button>
            )}
          </>
        )}
      </div>

      {activeTab === 'approve' ? (
        user?.role === 'student' ? (
          <div className="card p-12 text-center text-slate-500">
            <FileX size={40} className="mx-auto mb-3 text-slate-300" />
            学生无权审批预约
          </div>
        ) : (
          <div className="card">
            {pendingList.length === 0 ? (
              <p className="text-slate-400 text-sm py-12 text-center">暂无待审批预约</p>
            ) : (
              <table className="table">
                <thead><tr><th>设备</th><th>学生</th><th>日期</th><th>时段</th><th>使用目的</th><th>操作</th></tr></thead>
                <tbody>
                  {pendingList.map(r => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.equipment_name}</td>
                      <td>{r.student_name}</td>
                      <td>{formatDate(r.reserve_date)}</td>
                      <td>{TIME_SLOT_LABELS[r.time_slot].split(' ')[0]}</td>
                      <td className="max-w-sm truncate">{r.purpose}</td>
                      <td className="flex gap-2">
                        <button className="btn-success h-8 text-xs" onClick={() => handleApprove(r.id)}><Check size={14} className="mr-1" />通过</button>
                        <button className="btn-danger h-8 text-xs" onClick={() => handleReject(r.id)}><X size={14} className="mr-1" />驳回</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      ) : activeTab === 'waitlist' ? (
        <div className="card">
          {waitlist.length === 0 ? (
            <p className="text-slate-400 text-sm py-12 text-center">暂无候补记录</p>
          ) : (
            <table className="table">
              <thead><tr><th>设备名称</th><th>预约日期</th><th>时段</th><th>目的</th><th>排队位置</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {waitlist.map(w => (
                  <tr key={w.id}>
                    <td className="font-medium">{w.equipment_name}</td>
                    <td>{formatDate(w.reserve_date)}</td>
                    <td>{TIME_SLOT_LABELS[w.time_slot].split(' ')[0]}</td>
                    <td className="max-w-xs truncate">{w.purpose}</td>
                    <td>{w.position ?? '-'}</td>
                    <td><span className={`badge ${WAITLIST_STATUS_COLORS[w.status]}`}>{WAITLIST_STATUS_LABELS[w.status]}</span></td>
                    <td>
                      {w.status === 'waiting' && (
                        <button className="btn-secondary h-7 text-xs" onClick={() => handleWaitlistCancel(w.id)}>取消</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card">
          {filtered.length === 0 ? (
            <p className="text-slate-400 text-sm py-12 text-center">暂无预约记录</p>
          ) : (
            <table className="table">
              <thead><tr><th>设备</th><th>学生</th><th>导师</th><th>关联项目</th><th>日期</th><th>时段</th><th>目的</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.equipment_name}</td>
                    <td>{r.student_name}</td>
                    <td>{r.tutor_name}</td>
                    <td>{r.project_name ? <span className="badge bg-sky-100 text-sky-700">{r.project_name}</span> : '-'}</td>
                    <td>{formatDate(r.reserve_date)}</td>
                    <td>{TIME_SLOT_LABELS[r.time_slot].split(' ')[0]}</td>
                    <td className="max-w-xs truncate">{r.purpose}</td>
                    <td><span className={`badge ${RESERVATION_STATUS_COLORS[r.status]}`}>{RESERVATION_STATUS_LABELS[r.status]}</span></td>
                    <td>
                      {r.status === 'pending' && user?.role === 'student' && (
                        <button className="btn-secondary h-7 text-xs" onClick={() => handleCancel(r.id)}>取消</button>
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
              <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarPlus size={20} />新建预约</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">选择设备 *</label>
                <select className="input" value={formData.equipment_id || ''} onChange={e => setFormData({ ...formData, equipment_id: Number(e.target.value) })}>
                  <option value="">请选择设备</option>
                  {equipment.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({CATEGORY_LABELS[e.category]})</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">注意：预约前需通过该类设备的安全培训</p>
              </div>
              <div>
                <label className="label">选择导师审批 *</label>
                <select className="input" value={formData.tutor_id || ''} onChange={e => setFormData({ ...formData, tutor_id: Number(e.target.value) })}>
                  <option value="">请选择导师</option>
                  {tutors.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">预约日期 *</label>
                  <input type="date" className="input" min={new Date().toISOString().split('T')[0]} value={formData.reserve_date || ''} onChange={e => setFormData({ ...formData, reserve_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">预约时段 *</label>
                  <select className="input" value={formData.time_slot || ''} onChange={e => setFormData({ ...formData, time_slot: e.target.value })}>
                    <option value="">请选择</option>
                    {Object.entries(TIME_SLOT_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
              </div>
              {slotAvailable === false && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-amber-700">该时段已被预约，您可以选择加入候补</span>
                  <button type="button" className="btn-secondary h-8 text-xs" disabled={submitting} onClick={handleWaitlistJoin}>加入候补</button>
                </div>
              )}
              {waitlistCount > 0 && slotAvailable !== false && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Users size={14} />
                  <span>当前排队 {waitlistCount} 人</span>
                </div>
              )}
              <div>
                <label className="label">使用目的 *</label>
                <textarea className="input min-h-[80px]" placeholder="请详细描述实验或使用目的" value={formData.purpose || ''} onChange={e => setFormData({ ...formData, purpose: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? '提交中...' : '提交预约'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
