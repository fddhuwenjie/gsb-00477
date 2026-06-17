import { useState, useEffect } from 'react';
import { Plus, Users, Cpu, BarChart3, Trash2, X, FolderOpen } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { formatDate, toast } from '../lib/utils.js';
import type { Project } from '../../shared/types.js';

export default function ProjectPage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [usageStats, setUsageStats] = useState<any>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await api.projects.list();
      setProjects(data);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const loadAuxiliary = async () => {
    try {
      const [u, eq] = await Promise.all([api.auth.users(), api.equipment.list()]);
      setUsers(u);
      setEquipmentList(eq);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const selectProject = async (project: Project) => {
    if (selected?.id === project.id) {
      setSelected(null);
      setUsageStats(null);
      return;
    }
    setSelected(project);
    try {
      const stats = await api.projects.usageStats(project.id);
      setUsageStats(stats);
    } catch {
      setUsageStats(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.projects.create(formData);
      toast('项目已创建', 'success');
      setShowCreateModal(false);
      setFormData({});
      loadProjects();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该项目？')) return;
    try {
      await api.projects.remove(id);
      toast('项目已删除', 'success');
      if (selected?.id === id) {
        setSelected(null);
        setUsageStats(null);
      }
      loadProjects();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleAddMember = async () => {
    if (!selected || !selectedStudent) return;
    try {
      await api.projects.addMember(selected.id, Number(selectedStudent));
      toast('成员已添加', 'success');
      setShowMemberModal(false);
      setSelectedStudent('');
      const data = await api.projects.list();
      const updated = data.find((p: Project) => p.id === selected.id);
      if (updated) setSelected(updated);
      setProjects(data);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleRemoveMember = async (studentId: number) => {
    if (!selected) return;
    try {
      await api.projects.removeMember(selected.id, studentId);
      toast('成员已移除', 'success');
      const data = await api.projects.list();
      const updated = data.find((p: Project) => p.id === selected.id);
      if (updated) setSelected(updated);
      setProjects(data);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleAddEquipment = async () => {
    if (!selected || !selectedEquipment) return;
    try {
      await api.projects.addEquipment(selected.id, Number(selectedEquipment));
      toast('设备已关联', 'success');
      setShowEquipModal(false);
      setSelectedEquipment('');
      const data = await api.projects.list();
      const updated = data.find((p: Project) => p.id === selected.id);
      if (updated) setSelected(updated);
      setProjects(data);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleRemoveEquipment = async (equipmentId: number) => {
    if (!selected) return;
    try {
      await api.projects.removeEquipment(selected.id, equipmentId);
      toast('设备已移除', 'success');
      const data = await api.projects.list();
      const updated = data.find((p: Project) => p.id === selected.id);
      if (updated) setSelected(updated);
      setProjects(data);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const openCreateModal = async () => {
    await loadAuxiliary();
    setFormData({});
    setShowCreateModal(true);
  };

  const openMemberModal = async () => {
    await loadAuxiliary();
    setSelectedStudent('');
    setShowMemberModal(true);
  };

  const openEquipModal = async () => {
    await loadAuxiliary();
    setSelectedEquipment('');
    setShowEquipModal(true);
  };

  const tutors = users.filter(u => u.role === 'tutor');
  const students = users.filter(u => u.role === 'student');
  const isAdmin = user?.role === 'admin';
  const isTutor = user?.role === 'tutor';
  const canManage = isAdmin || isTutor;

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FolderOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <span className="input pl-9 block py-2 bg-slate-50">共 {projects.length} 个项目</span>
        </div>
        {canManage && (
          <button className="btn-primary ml-auto" onClick={openCreateModal}>
            <Plus size={16} className="mr-1" />创建项目
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map(p => (
          <div
            key={p.id}
            className={`card overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${selected?.id === p.id ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => selectProject(p)}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-800">{p.name}</h3>
                {isAdmin && (
                  <button className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-500 mb-1">导师：{p.tutor_name || '-'}</p>
              <p className="text-sm text-slate-500 mb-1">{formatDate(p.start_date)} ~ {formatDate(p.end_date)}</p>
              {p.description && <p className="text-sm text-slate-400 mb-2 line-clamp-2">{p.description}</p>}
              <div className="flex gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Users size={12} />{(p.members || []).length} 成员</span>
                <span className="flex items-center gap-1"><Cpu size={12} />{(p.equipment_list || []).length} 设备</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <span className="badge bg-blue-100 text-blue-700">{selected.tutor_name || '-'}</span>
            </div>
            {selected.description && <p className="text-sm text-slate-500 mb-4">{selected.description}</p>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-slate-700 flex items-center gap-2"><Users size={16} />成员列表</h3>
                  {canManage && (
                    <button className="btn-secondary text-xs h-7" onClick={openMemberModal}>
                      <Plus size={14} className="mr-1" />添加成员
                    </button>
                  )}
                </div>
                {(selected.members || []).length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">暂无成员</p>
                ) : (
                  <div className="space-y-2">
                    {(selected.members || []).map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-sm">{m.student_name || `学生 #${m.student_id}`}</span>
                        {canManage && (
                          <button className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500" onClick={() => handleRemoveMember(m.student_id)}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-slate-700 flex items-center gap-2"><Cpu size={16} />关联设备</h3>
                  {canManage && (
                    <button className="btn-secondary text-xs h-7" onClick={openEquipModal}>
                      <Plus size={14} className="mr-1" />关联设备
                    </button>
                  )}
                </div>
                {(selected.equipment_list || []).length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">暂无关联设备</p>
                ) : (
                  <div className="space-y-2">
                    {(selected.equipment_list || []).map(eq => (
                      <div key={eq.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-sm">{eq.equipment_name || `设备 #${eq.equipment_id}`}</span>
                        {canManage && (
                          <button className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500" onClick={() => handleRemoveEquipment(eq.equipment_id)}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-medium text-slate-700 flex items-center gap-2 mb-4"><BarChart3 size={16} />使用统计</h3>
            {usageStats && usageStats.members && usageStats.members.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>成员</th>
                    <th>使用次数</th>
                    <th>预约次数</th>
                  </tr>
                </thead>
                <tbody>
                  {usageStats.members.map((s: any, i: number) => (
                    <tr key={i}>
                      <td className="font-medium">{s.student_name || `学生 #${s.student_id}`}</td>
                      <td>{s.usage_count ?? 0}</td>
                      <td>{s.reservation_count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">暂无使用统计数据</p>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">创建项目</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">项目名称 *</label>
                <input className="input" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="label">指导导师 *</label>
                <select className="input" required value={formData.tutor_id || ''} onChange={e => setFormData({ ...formData, tutor_id: Number(e.target.value) })}>
                  <option value="">请选择导师</option>
                  {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">开始日期 *</label>
                  <input type="date" className="input" required value={formData.start_date || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">结束日期 *</label>
                  <input type="date" className="input" required value={formData.end_date || ''} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">项目描述</label>
                <textarea className="input min-h-[80px]" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>取消</button>
                <button type="submit" className="btn-primary">确认创建</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMemberModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">添加成员</h2>
              <button onClick={() => setShowMemberModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">选择学生 *</label>
                <select className="input" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                  <option value="">请选择学生</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-secondary" onClick={() => setShowMemberModal(false)}>取消</button>
                <button className="btn-primary" onClick={handleAddMember} disabled={!selectedStudent}>确认添加</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEquipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">关联设备</h2>
              <button onClick={() => setShowEquipModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">选择设备 *</label>
                <select className="input" value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)}>
                  <option value="">请选择设备</option>
                  {equipmentList.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-secondary" onClick={() => setShowEquipModal(false)}>取消</button>
                <button className="btn-primary" onClick={handleAddEquipment} disabled={!selectedEquipment}>确认关联</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
