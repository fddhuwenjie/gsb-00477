import { useState, useEffect } from 'react';
import { GraduationCap, Plus, CheckCircle2, XCircle, BookOpen, Award, X, ChevronRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { CATEGORY_LABELS, formatDate, toast } from '../lib/utils.js';
import type { Training, TrainingQualification } from '../../shared/types.js';

export default function TrainingPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'courses' | 'mine'>('courses');
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [qualifications, setQualifications] = useState<TrainingQualification[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [examResult, setExamResult] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<any>({ name: '', content: '', category: '', questions: [{}, {}, {}] });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [t, q] = await Promise.all([api.training.list(), api.training.qualifications()]);
      setTrainings(t);
      setQualifications(q);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const openTraining = async (id: number) => {
    try {
      const t = await api.training.get(id);
      setSelectedTraining(t);
      setAnswers({});
      setExamResult(null);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleTakeExam = async () => {
    if (!selectedTraining || !selectedTraining.questions) return;
    const unanswered = selectedTraining.questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      toast('请完成所有题目', 'error');
      return;
    }
    try {
      const result = await api.training.take(selectedTraining.id, answers);
      setExamResult(result);
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleCreateTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, content, category, questions } = createForm;
    if (!name || !content || !category) { toast('请填写培训基本信息', 'error'); return; }
    for (const q of questions) {
      if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_answer) {
        toast('请完善所有考核题目', 'error'); return;
      }
    }
    try {
      await api.training.create(createForm);
      toast('培训已发布', 'success');
      setShowCreateModal(false);
      setCreateForm({ name: '', content: '', category: '', questions: [{}, {}, {}] });
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const isQualified = (category: string) => {
    return qualifications.some(q => q.category === category && q.is_valid);
  };

  return (
    <div className="space-y-6">
      <div className="card p-4 flex items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['courses', 'mine'] as const).map(tab => (
            <button key={tab} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setActiveTab(tab)}>
              {tab === 'courses' ? '培训课程' : '我的资格证书'}
            </button>
          ))}
        </div>
        {user?.role === 'admin' && (
          <button className="btn-primary ml-auto" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} className="mr-1" />发布培训
          </button>
        )}
      </div>

      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {trainings.map(t => (
            <div key={t.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800">{t.name}</h3>
                  <span className="badge bg-sky-100 text-sky-700 mt-2">{CATEGORY_LABELS[t.category]}</span>
                </div>
                {isQualified(t.category) && <Award size={24} className="text-amber-500" />}
              </div>
              <p className="text-sm text-slate-500 line-clamp-3 min-h-[60px]">{t.content}</p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-400">{t.questions?.length || 3} 道考核题目</span>
                <button className="btn-primary h-8 text-xs" onClick={() => openTraining(t.id)}>
                  {isQualified(t.category) ? '复习查看' : '参加培训'}
                  <ChevronRight size={14} className="ml-1" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="card">
          {qualifications.length === 0 ? (
            <p className="text-slate-400 text-sm py-12 text-center">暂无培训资格，请先参加培训考核</p>
          ) : (
            <table className="table">
              <thead><tr><th>培训名称</th><th>设备分类</th><th>通过日期</th><th>有效期至</th><th>状态</th></tr></thead>
              <tbody>
                {qualifications.map(q => (
                  <tr key={q.id}>
                    <td className="font-medium">{q.training_name}</td>
                    <td>{CATEGORY_LABELS[q.category] || q.category}</td>
                    <td>{formatDate(q.passed_date)}</td>
                    <td>{formatDate(q.expiry_date)}</td>
                    <td>{q.is_valid ? <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle2 size={12} className="mr-1" />有效</span> : <span className="badge bg-slate-100 text-slate-600"><XCircle size={12} className="mr-1" />已过期</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedTraining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold">{selectedTraining.name}</h2>
                <span className="badge bg-sky-100 text-sky-700 mt-1">{CATEGORY_LABELS[selectedTraining.category]}</span>
              </div>
              <button onClick={() => setSelectedTraining(null)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              <div className="mb-6">
                <h3 className="font-medium mb-2 flex items-center gap-2"><BookOpen size={16} />培训内容</h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-lg">{selectedTraining.content}</p>
              </div>

              {selectedTraining.questions && !examResult && (
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2"><GraduationCap size={16} />在线考核（全部答对方可通过）</h3>
                  <div className="space-y-4">
                    {selectedTraining.questions.map((q, i) => (
                      <div key={q.id} className="bg-slate-50 p-4 rounded-lg">
                        <p className="font-medium mb-3">{i + 1}. {q.question_text}</p>
                        <div className="space-y-2">
                          {[['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]].map(([k, v]: any) => (
                            <label key={k} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-white transition-colors">
                              <input type="radio" name={`q_${q.id}`} value={k} checked={answers[q.id] === k} onChange={() => setAnswers({ ...answers, [q.id]: k })} />
                              <span className="text-sm"><strong>{k}.</strong> {v}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {examResult && (
                <div className={`rounded-xl p-6 text-center ${examResult.passed ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  {examResult.passed ? <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-3" /> : <XCircle size={48} className="mx-auto text-red-500 mb-3" />}
                  <h3 className={`text-xl font-bold mb-1 ${examResult.passed ? 'text-emerald-700' : 'text-red-700'}`}>{examResult.passed ? '考核通过！' : '考核未通过'}</h3>
                  <p className="text-sm text-slate-600 mb-2">答对 {examResult.correctCount} / {examResult.totalCount} 题</p>
                  <p className="text-sm text-slate-500">{examResult.message}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setSelectedTraining(null)}>关闭</button>
              {selectedTraining.questions && !examResult && user?.role === 'student' && (
                <button className="btn-primary" onClick={handleTakeExam}>提交考核</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">发布培训课程</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateTraining} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">培训名称 *</label>
                  <input className="input" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">设备分类 *</label>
                  <select className="input" value={createForm.category} onChange={e => setCreateForm({ ...createForm, category: e.target.value })}>
                    <option value="">请选择</option>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">培训内容 *</label>
                <textarea className="input min-h-[100px]" value={createForm.content} onChange={e => setCreateForm({ ...createForm, content: e.target.value })} placeholder="详细描述培训内容、操作规范、安全注意事项等" />
              </div>
              <div>
                <h3 className="font-medium mb-3">考核题目（3道选择题）*</h3>
                {createForm.questions.map((q: any, i: number) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-lg mb-3">
                    <p className="text-sm font-medium mb-2">第 {i + 1} 题</p>
                    <input className="input mb-2" placeholder="题目内容" value={q.question_text || ''} onChange={e => { const nq = [...createForm.questions]; nq[i].question_text = e.target.value; setCreateForm({ ...createForm, questions: nq }); }} />
                    <div className="grid grid-cols-2 gap-2">
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <input key={opt} className="input" placeholder={`选项 ${opt}`} value={q[`option_${opt.toLowerCase()}`] || ''} onChange={e => { const nq = [...createForm.questions]; nq[i][`option_${opt.toLowerCase()}`] = e.target.value; setCreateForm({ ...createForm, questions: nq }); }} />
                      ))}
                    </div>
                    <select className="input mt-2" value={q.correct_answer || ''} onChange={e => { const nq = [...createForm.questions]; nq[i].correct_answer = e.target.value; setCreateForm({ ...createForm, questions: nq }); }}>
                      <option value="">正确答案</option>
                      <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>取消</button>
                <button type="submit" className="btn-primary">发布培训</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
