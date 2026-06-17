import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, X, Download, Eye, LayoutTemplate } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { REPORT_DIMENSION_LABELS, REPORT_METRIC_LABELS, toast, formatDate } from '../lib/utils.js';
import type { ReportTemplate } from '../../shared/types.js';

const DIMENSION_KEYS = Object.keys(REPORT_DIMENSION_LABELS);
const METRIC_KEYS = Object.keys(REPORT_METRIC_LABELS);

export default function ReportPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'templates' | 'generate'>('templates');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState<any>({ name: '', dimensions: [], metrics: [], date_range_start: '', date_range_end: '' });

  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await api.reports.templates();
      setTemplates(data);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.reports.createTemplate(templateForm);
      toast('模板已创建', 'success');
      setShowCreateModal(false);
      setTemplateForm({ name: '', dimensions: [], metrics: [], date_range_start: '', date_range_end: '' });
      loadTemplates();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('确认删除该模板？')) return;
    try {
      await api.reports.deleteTemplate(id);
      toast('模板已删除', 'success');
      loadTemplates();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const toggleDimension = (dim: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(dim) ? list.filter(d => d !== dim) : [...list, dim]);
  };

  const toggleTemplateDimension = (dim: string) => {
    toggleDimension(dim, templateForm.dimensions, (v) => setTemplateForm({ ...templateForm, dimensions: v }));
  };

  const toggleTemplateMetric = (metric: string) => {
    const list = templateForm.metrics;
    setTemplateForm({
      ...templateForm,
      metrics: list.includes(metric) ? list.filter((m: string) => m !== metric) : [...list, metric],
    });
  };

  const toggleGenDimension = (dim: string) => {
    toggleDimension(dim, selectedDimensions, setSelectedDimensions);
  };

  const toggleGenMetric = (metric: string) => {
    toggleDimension(metric, selectedMetrics, setSelectedMetrics);
  };

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    if (!id) return;
    const tpl = templates.find(t => t.id === Number(id));
    if (tpl) {
      setSelectedDimensions([...tpl.dimensions]);
      setSelectedMetrics([...tpl.metrics]);
      setDateStart(tpl.date_range_start || '');
      setDateEnd(tpl.date_range_end || '');
    }
  };

  const handleGenerate = async () => {
    if (selectedDimensions.length === 0 || selectedMetrics.length === 0) {
      toast('请至少选择一个维度和一个指标', 'error');
      return;
    }
    try {
      const data = await api.reports.generate({
        dimensions: selectedDimensions,
        metrics: selectedMetrics,
        date_start: dateStart || undefined,
        date_end: dateEnd || undefined,
      });
      setPreviewData(data);
      toast('报表已生成', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleExportCsv = async () => {
    if (selectedDimensions.length === 0 || selectedMetrics.length === 0) {
      toast('请至少选择一个维度和一个指标', 'error');
      return;
    }
    try {
      const csv = await api.reports.exportCsv({
        dimensions: selectedDimensions.join(','),
        metrics: selectedMetrics.join(','),
        date_start: dateStart || undefined,
        date_end: dateEnd || undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast('CSV 已导出', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleExportPdf = async () => {
    if (selectedDimensions.length === 0 || selectedMetrics.length === 0) {
      toast('请至少选择一个维度和一个指标', 'error');
      return;
    }
    try {
      const html = await api.reports.exportPdf({
        dimensions: selectedDimensions.join(','),
        metrics: selectedMetrics.join(','),
        date_start: dateStart || undefined,
        date_end: dateEnd || undefined,
      });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
      toast('PDF 已打开', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const columns = [...selectedDimensions, ...selectedMetrics];

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex gap-1">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'templates' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            onClick={() => setActiveTab('templates')}
          >
            <LayoutTemplate size={14} className="inline mr-1.5 -mt-0.5" />
            报表模板
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'generate' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            onClick={() => setActiveTab('generate')}
          >
            <FileText size={14} className="inline mr-1.5 -mt-0.5" />
            生成报表
          </button>
        </div>
      </div>

      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="card p-4 flex items-center gap-3">
            <span className="text-sm text-slate-500">共 {templates.length} 个模板</span>
            <button className="btn-primary ml-auto" onClick={() => { setTemplateForm({ name: '', dimensions: [], metrics: [], date_range_start: '', date_range_end: '' }); setShowCreateModal(true); }}>
              <Plus size={16} className="mr-1" />新建模板
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>模板名称</th>
                  <th>维度</th>
                  <th>指标</th>
                  <th>时间范围</th>
                  <th>创建人</th>
                  {isAdmin && <th>操作</th>}
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="text-center text-slate-400 py-8">暂无模板</td>
                  </tr>
                ) : templates.map(tpl => (
                  <tr key={tpl.id}>
                    <td className="font-medium">{tpl.name}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {tpl.dimensions.map(d => (
                          <span key={d} className="badge bg-sky-100 text-sky-700">{REPORT_DIMENSION_LABELS[d] || d}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {tpl.metrics.map(m => (
                          <span key={m} className="badge bg-emerald-100 text-emerald-700">{REPORT_METRIC_LABELS[m] || m}</span>
                        ))}
                      </div>
                    </td>
                    <td className="text-sm text-slate-500">
                      {tpl.date_range_start && tpl.date_range_end
                        ? `${formatDate(tpl.date_range_start)} ~ ${formatDate(tpl.date_range_end)}`
                        : '不限'}
                    </td>
                    <td>{tpl.creator_name || '-'}</td>
                    {isAdmin && (
                      <td>
                        <button className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500" onClick={() => handleDeleteTemplate(tpl.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'generate' && (
        <div className="space-y-6">
          <div className="card p-5 space-y-5">
            <div>
              <label className="label">使用已保存模板</label>
              <select className="input" value={selectedTemplateId} onChange={e => handleTemplateSelect(e.target.value)}>
                <option value="">不使用模板</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="label">维度</label>
              <div className="flex flex-wrap gap-3">
                {DIMENSION_KEYS.map(dim => (
                  <label key={dim} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                      checked={selectedDimensions.includes(dim)}
                      onChange={() => toggleGenDimension(dim)}
                    />
                    {REPORT_DIMENSION_LABELS[dim]}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">指标</label>
              <div className="flex flex-wrap gap-3">
                {METRIC_KEYS.map(metric => (
                  <label key={metric} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                      checked={selectedMetrics.includes(metric)}
                      onChange={() => toggleGenMetric(metric)}
                    />
                    {REPORT_METRIC_LABELS[metric]}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">开始日期</label>
                <input type="date" className="input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              </div>
              <div>
                <label className="label">结束日期</label>
                <input type="date" className="input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={handleGenerate}>
                <Eye size={16} className="mr-1" />预览报表
              </button>
              <button className="btn-secondary" onClick={handleExportCsv}>
                <Download size={16} className="mr-1" />导出CSV
              </button>
              <button className="btn-secondary" onClick={handleExportPdf}>
                <FileText size={16} className="mr-1" />导出PDF
              </button>
            </div>
          </div>

          {previewData.length > 0 && (
            <div className="card overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th key={col}>{REPORT_DIMENSION_LABELS[col] || REPORT_METRIC_LABELS[col] || col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i}>
                      {columns.map(col => (
                        <td key={col}>{row[col] ?? '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">新建模板</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="label">模板名称 *</label>
                <input className="input" required value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">维度 *</label>
                <div className="flex flex-wrap gap-3">
                  {DIMENSION_KEYS.map(dim => (
                    <label key={dim} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                        checked={templateForm.dimensions.includes(dim)}
                        onChange={() => toggleTemplateDimension(dim)}
                      />
                      {REPORT_DIMENSION_LABELS[dim]}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">指标 *</label>
                <div className="flex flex-wrap gap-3">
                  {METRIC_KEYS.map(metric => (
                    <label key={metric} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                        checked={templateForm.metrics.includes(metric)}
                        onChange={() => toggleTemplateMetric(metric)}
                      />
                      {REPORT_METRIC_LABELS[metric]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">开始日期</label>
                  <input type="date" className="input" value={templateForm.date_range_start} onChange={e => setTemplateForm({ ...templateForm, date_range_start: e.target.value })} />
                </div>
                <div>
                  <label className="label">结束日期</label>
                  <input type="date" className="input" value={templateForm.date_range_end} onChange={e => setTemplateForm({ ...templateForm, date_range_end: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>取消</button>
                <button type="submit" className="btn-primary">确认创建</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
