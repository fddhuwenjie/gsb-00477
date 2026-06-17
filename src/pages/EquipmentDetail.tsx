import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, AlertTriangle, Wrench, Info, Package, Users, Crown } from 'lucide-react';
import { api } from '../lib/api.js';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_COLORS, formatDate, formatDateTime, toast, WAITLIST_STATUS_LABELS, WAITLIST_STATUS_COLORS, TIME_SLOT_LABELS } from '../lib/utils.js';
import type { Equipment, UsageLog, MaintenanceRecord, Consumable, ConsumableUsage, Waitlist } from '../../shared/types.js';
import { useAuthStore } from '../store/auth.js';

export default function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [lifecycle, setLifecycle] = useState<any>(null);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [usageHistories, setUsageHistories] = useState<Record<number, ConsumableUsage[]>>({});
  const [waitlist, setWaitlist] = useState<Waitlist[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Consumable | null>(null);
  const [addForm, setAddForm] = useState({ name: '', current_stock: 0, safety_stock: 0, unit: '', unit_price: 0, supplier: '' });
  const [restockForm, setRestockForm] = useState({ quantity: 0, unit_price: 0 });
  const { user } = useAuthStore();
  const [tab, setTab] = useState('info');

  useEffect(() => {
    if (id) loadData(Number(id));
  }, [id]);

  useEffect(() => {
    if (tab === 'waitlist' && id) {
      loadWaitlist(Number(id));
    }
  }, [tab, id]);

  const loadData = async (eqId: number) => {
    try {
      const [eq, lg, rc, lc, cons] = await Promise.all([
        api.equipment.get(eqId),
        api.usage.logs().then(l => l.filter(x => x.equipment_id === eqId)),
        api.maintenance.records(eqId),
        api.maintenance.lifecycle(eqId),
        api.consumables.list({ equipment_id: eqId }),
      ]);
      setEquipment(eq);
      setLogs(lg);
      setRecords(rc);
      setLifecycle(lc);
      setConsumables(cons);
      const histories: Record<number, ConsumableUsage[]> = {};
      await Promise.all(cons.map(async c => {
        try {
          histories[c.id] = await api.consumables.usageHistory(c.id);
        } catch { histories[c.id] = []; }
      }));
      setUsageHistories(histories);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const loadWaitlist = async (eqId: number) => {
    try {
      const data = await api.waitlist.list({ equipment_id: eqId, status: 'waiting' });
      setWaitlist(data);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  if (!equipment) return <div className="text-center py-20 text-slate-500">加载中...</div>;

  return (
    <div className="space-y-6">
      <button className="btn-secondary" onClick={() => navigate('/equipment')}>
        <ArrowLeft size={16} className="mr-1" />返回列表
      </button>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
          <div className="lg:col-span-1 h-64 lg:h-auto bg-slate-100">
            {equipment.photo_url ? (
              <img src={equipment.photo_url} alt={equipment.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">暂无图片</div>
            )}
          </div>
          <div className="lg:col-span-2 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-800">{equipment.name}</h1>
                <p className="text-slate-500 mt-1">{equipment.model}</p>
              </div>
              <span className={`badge ${STATUS_COLORS[equipment.status]}`}>{STATUS_LABELS[equipment.status]}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500">设备分类</p><p className="font-medium">{CATEGORY_LABELS[equipment.category]}</p></div>
              <div><p className="text-slate-500">所属实验室</p><p className="font-medium">{equipment.lab_name}</p></div>
              <div><p className="text-slate-500">负责人</p><p className="font-medium">{equipment.manager_name}</p></div>
              <div><p className="text-slate-500">采购编号</p><p className="font-medium">{equipment.purchase_no || '-'}</p></div>
              <div><p className="text-slate-500">单价</p><p className="font-medium">{equipment.unit_price ? `¥${Number(equipment.unit_price).toLocaleString()}` : '-'}</p></div>
              <div><p className="text-slate-500">购买日期</p><p className="font-medium">{equipment.purchase_date ? formatDate(equipment.purchase_date) : '-'}</p></div>
            </div>
          </div>
        </div>
      </div>

      {lifecycle && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5"><p className="text-sm text-slate-500">累计使用时长</p><p className="text-xl font-bold mt-2">{lifecycle.totalUsageTime?.hours || 0}小时{lifecycle.totalUsageTime?.minutes || 0}分</p></div>
          <div className="card p-5"><p className="text-sm text-slate-500">使用次数</p><p className="text-xl font-bold mt-2">{lifecycle.usageCount || 0}次</p></div>
          <div className="card p-5"><p className="text-sm text-slate-500">累计维护成本</p><p className="text-xl font-bold mt-2 text-emerald-600">¥{Number(lifecycle.totalMaintenanceCost || 0).toLocaleString()}</p></div>
          <div className="card p-5"><p className="text-sm text-slate-500">故障次数</p><p className="text-xl font-bold mt-2 text-red-600">{lifecycle.faultCount || 0}次</p></div>
        </div>
      )}

      <div className="card">
        <div className="flex border-b border-slate-200 px-4">
          {[
            { k: 'info', label: '注意事项', icon: Info },
            { k: 'usage', label: '使用记录', icon: Calendar },
            { k: 'maint', label: '维护记录', icon: Wrench },
            { k: 'consumable', label: '耗材库存', icon: Package },
            { k: 'waitlist', label: '候补队列', icon: Users },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button key={t.k} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.k ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setTab(t.k)}>
                <Icon size={16} />{t.label}
              </button>
            );
          })}
        </div>
        <div className="p-5">
          {tab === 'info' && (
            <div className="whitespace-pre-wrap text-slate-600 leading-relaxed">
              {equipment.precautions || '暂无注意事项'}
            </div>
          )}
          {tab === 'usage' && (
            logs.length === 0 ? <p className="text-slate-400 text-sm py-8 text-center">暂无使用记录</p> : (
              <table className="table">
                <thead><tr><th>使用人</th><th>签到时间</th><th>签退时间</th><th>实验内容</th><th>样品数</th><th>状态</th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td>{l.user_name}</td>
                      <td>{formatDateTime(l.checkin_time)}</td>
                      <td>{l.checkout_time ? formatDateTime(l.checkout_time) : '-'}</td>
                      <td className="max-w-xs truncate">{l.experiment_content || '-'}</td>
                      <td>{l.sample_count || 0}</td>
                      <td>{l.has_anomaly ? <span className="badge bg-red-100 text-red-700">有异常</span> : <span className="badge bg-emerald-100 text-emerald-700">正常</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {tab === 'maint' && (
            records.length === 0 ? <p className="text-slate-400 text-sm py-8 text-center">暂无维护记录</p> : (
              <table className="table">
                <thead><tr><th>维护日期</th><th>维护人</th><th>维护内容</th><th>更换配件</th><th>费用</th></tr></thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id}>
                      <td>{formatDate(r.maintenance_date)}</td>
                      <td>{r.maintainer_name || '-'}</td>
                      <td className="max-w-xs truncate">{r.content}</td>
                      <td>{r.replaced_parts || '-'}</td>
                      <td className="font-medium">¥{Number(r.cost || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {tab === 'consumable' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-700">耗材清单</h3>
                {user?.role === 'admin' && (
                  <button className="btn-primary text-sm" onClick={() => setShowAddModal(true)}>添加耗材</button>
                )}
              </div>
              {consumables.length === 0 ? <p className="text-slate-400 text-sm py-8 text-center">暂无耗材</p> : (
                <table className="table">
                  <thead><tr><th>耗材名称</th><th>当前库存</th><th>安全库存线</th><th>单位</th><th>单价</th><th>供应商</th><th>状态</th>{user?.role === 'admin' && <th>操作</th>}</tr></thead>
                  <tbody>
                    {consumables.map(c => {
                      const isLow = c.current_stock < c.safety_stock;
                      return (
                        <tr key={c.id} className={isLow ? 'bg-amber-50' : ''}>
                          <td className="font-medium">{c.name}</td>
                          <td>{c.current_stock}</td>
                          <td>{c.safety_stock}</td>
                          <td>{c.unit}</td>
                          <td>¥{Number(c.unit_price).toLocaleString()}</td>
                          <td>{c.supplier || '-'}</td>
                          <td>{isLow ? <span className="badge bg-red-100 text-red-700">库存不足</span> : <span className="badge bg-emerald-100 text-emerald-700">正常</span>}</td>
                          {user?.role === 'admin' && (
                            <td><button className="text-sky-600 text-sm hover:underline" onClick={() => { setRestockTarget(c); setRestockForm({ quantity: 0, unit_price: c.unit_price }); }}>入库</button></td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {consumables.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">耗材使用记录</h3>
                  {Object.values(usageHistories).flat().length === 0 ? <p className="text-slate-400 text-sm py-4 text-center">暂无使用记录</p> : (
                    <table className="table">
                      <thead><tr><th>耗材名称</th><th>使用人</th><th>使用数量</th><th>使用时间</th></tr></thead>
                      <tbody>
                        {consumables.map(c => (usageHistories[c.id] || []).map(u => (
                          <tr key={u.id}>
                            <td>{c.name}</td>
                            <td>{u.user_name || '-'}</td>
                            <td>{u.quantity}</td>
                            <td>{formatDateTime(u.used_at)}</td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
          {tab === 'waitlist' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-700">候补排队情况</h3>
                <span className="text-xs text-slate-500">共 {waitlist.length} 人排队中</span>
              </div>
              {waitlist.length === 0 ? (
                <p className="text-slate-400 text-sm py-8 text-center">暂无候补排队</p>
              ) : (
                <div className="space-y-4">
                  {['morning', 'afternoon', 'evening'].map(slot => {
                    const slotWaitlist = waitlist
                      .filter(w => w.time_slot === slot)
                      .sort((a, b) => (a.position || 999) - (b.position || 999));
                    if (slotWaitlist.length === 0) return null;
                    return (
                      <div key={slot} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-medium text-slate-700">{TIME_SLOT_LABELS[slot as keyof typeof TIME_SLOT_LABELS]}</span>
                          <span className="text-xs text-slate-500">{slotWaitlist.length}人</span>
                        </div>
                        <div className="space-y-2">
                          {slotWaitlist.map(w => (
                            <div key={w.id} className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${w.position === 1 ? 'bg-amber-100 text-amber-700' : w.position && w.position <= 3 ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700'}`}>
                                {w.position === 1 ? <Crown size={12} /> : w.position}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">
                                  {user?.role === 'student' ? '***' : w.student_name}
                                </p>
                                <p className="text-xs text-slate-500">{formatDate(w.reserve_date)}</p>
                              </div>
                              <span className={`badge ${WAITLIST_STATUS_COLORS[w.status]}`}>
                                {WAITLIST_STATUS_LABELS[w.status]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {user?.role === 'student' && (
                <p className="text-xs text-slate-400 mt-4 text-center">
                  提示：学生仅可查看自己的排队记录
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">添加耗材</h3>
            <div className="space-y-3">
              <div><label className="block text-sm text-slate-600 mb-1">耗材名称</label><input className="input" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="block text-sm text-slate-600 mb-1">当前库存</label><input type="number" className="input" value={addForm.current_stock} onChange={e => setAddForm(f => ({ ...f, current_stock: Number(e.target.value) }))} /></div>
              <div><label className="block text-sm text-slate-600 mb-1">安全库存线</label><input type="number" className="input" value={addForm.safety_stock} onChange={e => setAddForm(f => ({ ...f, safety_stock: Number(e.target.value) }))} /></div>
              <div><label className="block text-sm text-slate-600 mb-1">单位</label><input className="input" value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} /></div>
              <div><label className="block text-sm text-slate-600 mb-1">单价</label><input type="number" className="input" value={addForm.unit_price} onChange={e => setAddForm(f => ({ ...f, unit_price: Number(e.target.value) }))} /></div>
              <div><label className="block text-sm text-slate-600 mb-1">供应商</label><input className="input" value={addForm.supplier} onChange={e => setAddForm(f => ({ ...f, supplier: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
              <button className="btn-primary" onClick={async () => {
                try {
                  await api.consumables.create({ ...addForm, equipment_id: Number(id) });
                  toast('耗材已添加', 'success');
                  setShowAddModal(false);
                  setAddForm({ name: '', current_stock: 0, safety_stock: 0, unit: '', unit_price: 0, supplier: '' });
                  loadData(Number(id));
                } catch (err: any) { toast(err.message, 'error'); }
              }}>确认</button>
            </div>
          </div>
        </div>
      )}

      {restockTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRestockTarget(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">入库 - {restockTarget.name}</h3>
            <div className="space-y-3">
              <div><label className="block text-sm text-slate-600 mb-1">入库数量</label><input type="number" className="input" value={restockForm.quantity} onChange={e => setRestockForm(f => ({ ...f, quantity: Number(e.target.value) }))} /></div>
              <div><label className="block text-sm text-slate-600 mb-1">单价</label><input type="number" className="input" value={restockForm.unit_price} onChange={e => setRestockForm(f => ({ ...f, unit_price: Number(e.target.value) }))} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button className="btn-secondary" onClick={() => setRestockTarget(null)}>取消</button>
              <button className="btn-primary" onClick={async () => {
                try {
                  await api.consumables.restock(restockTarget.id, restockForm);
                  toast('入库成功', 'success');
                  setRestockTarget(null);
                  loadData(Number(id));
                } catch (err: any) { toast(err.message, 'error'); }
              }}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
