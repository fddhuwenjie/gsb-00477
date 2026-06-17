import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Edit, Trash2, X, ArrowRightLeft } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_COLORS, formatDate, toast } from '../lib/utils.js';
import type { Equipment } from '../../shared/types.js';

export default function EquipmentPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [labs, setLabs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [category, status]);

  const loadData = async () => {
    try {
      const params: any = {};
      if (category) params.category = category;
      if (status) params.status = status;
      const data = await api.equipment.list(params);
      const filtered = search ? data.filter(e => 
        e.name.includes(search) || e.model.includes(search) || (e.purchase_no || '').includes(search)
      ) : data;
      setEquipment(filtered);
      const [l, u] = await Promise.all([api.equipment.labs(), api.auth.users()]);
      setLabs(l);
      setUsers(u);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  useEffect(() => {
    if (category || status) return;
    const t = setTimeout(() => loadData(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.equipment.update(editing.id, formData);
        toast('设备已更新', 'success');
      } else {
        await api.equipment.create(formData);
        toast('设备已创建', 'success');
      }
      setShowModal(false);
      setEditing(null);
      setFormData({});
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该设备？')) return;
    try {
      await api.equipment.remove(id);
      toast('设备已删除', 'success');
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="搜索设备名称/型号/编号" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">全部分类</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {user?.role === 'admin' && (
            <button className="btn-primary" onClick={() => { setEditing(null); setFormData({}); setShowModal(true); }}>
              <Plus size={16} className="mr-1" />添加设备
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {equipment.map(eq => (
          <div key={eq.id} className="card overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-40 bg-slate-100 overflow-hidden">
              {eq.photo_url ? (
                <img src={eq.photo_url} alt={eq.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">暂无图片</div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-800">{eq.name}</h3>
                <span className={`badge ${STATUS_COLORS[eq.status]}`}>{STATUS_LABELS[eq.status]}</span>
              </div>
              <p className="text-sm text-slate-500 mb-1">型号：{eq.model}</p>
              <p className="text-sm text-slate-500 mb-1">实验室：{eq.lab_name}</p>
              <p className="text-sm text-slate-500 mb-1">{CATEGORY_LABELS[eq.category]}</p>
              <p className="text-xs text-slate-400 mb-3">编号：{eq.purchase_no}</p>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1 h-8 text-xs" onClick={() => navigate(`/equipment/${eq.id}`)}>
                  <Eye size={14} className="mr-1" />详情
                </button>
                {user?.role === 'student' && (
                  <button className="btn-secondary flex-1 h-8 text-xs" onClick={() => navigate('/borrow', { state: { equipmentId: eq.id } })}>
                    <ArrowRightLeft size={14} className="mr-1" />申请借用
                  </button>
                )}
                {user?.role === 'admin' && (
                  <>
                    <button className="btn-secondary h-8 px-3" onClick={() => { setEditing(eq); setFormData(eq); setShowModal(true); }}>
                      <Edit size={14} />
                    </button>
                    <button className="btn-danger h-8 px-3" onClick={() => handleDelete(eq.id)}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editing ? '编辑设备' : '添加设备'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">设备名称 *</label>
                  <input className="input" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">型号 *</label>
                  <input className="input" required value={formData.model || ''} onChange={e => setFormData({ ...formData, model: e.target.value })} />
                </div>
                <div>
                  <label className="label">所属实验室 *</label>
                  <select className="input" required value={formData.lab_id || ''} onChange={e => setFormData({ ...formData, lab_id: Number(e.target.value) })}>
                    <option value="">请选择</option>
                    {labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">负责人</label>
                  <select className="input" value={formData.manager_id || ''} onChange={e => setFormData({ ...formData, manager_id: Number(e.target.value) })}>
                    <option value="">请选择</option>
                    {users.filter(u => u.role !== 'student').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">设备分类 *</label>
                  <select className="input" required value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    <option value="">请选择</option>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">状态</label>
                  <select className="input" value={formData.status || 'normal'} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">采购编号</label>
                  <input className="input" value={formData.purchase_no || ''} onChange={e => setFormData({ ...formData, purchase_no: e.target.value })} />
                </div>
                <div>
                  <label className="label">单价（元）</label>
                  <input type="number" className="input" value={formData.unit_price || ''} onChange={e => setFormData({ ...formData, unit_price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">购买日期</label>
                  <input type="date" className="input" value={formData.purchase_date || ''} onChange={e => setFormData({ ...formData, purchase_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">照片URL</label>
                  <input className="input" value={formData.photo_url || ''} onChange={e => setFormData({ ...formData, photo_url: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">使用注意事项</label>
                <textarea className="input min-h-[80px]" value={formData.precautions || ''} onChange={e => setFormData({ ...formData, precautions: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn-primary">确认提交</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
