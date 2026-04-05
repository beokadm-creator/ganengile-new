'use client';

import type { ChangeEvent, FormEvent, ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  ConsentKey,
  CONSENT_KEY_LABELS,
  CONSENT_LEGAL_BASIS,
} from '@/lib/consent-types';
import type { ConsentTemplateItem, ConsentVersionItem, ConsentFormData } from '@/lib/consent-types';

/* ─── helpers ──────────────────────────────────────────────────── */

function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function bumpVersion(current: string): string {
  const parts = current.split('.').map(Number);
  if (parts.length === 3 && parts.every((p) => !Number.isNaN(p))) {
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
  return '1.0.1';
}

const ALL_KEYS = Object.values(ConsentKey);

const EMPTY_FORM: ConsentFormData = {
  key: '',
  title: '',
  description: '',
  content: '',
  version: '1.0.0',
  category: 'required',
  sortOrder: 0,
  effectiveDate: new Date().toISOString().split('T')[0],
  changeNote: '',
};

/* ─── data fetching ────────────────────────────────────────────── */

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asTemplateItem(value: unknown): ConsentTemplateItem | null {
  const r = asRecord(value);
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    key: typeof r.key === 'string' ? r.key : r.id,
    title: typeof r.title === 'string' ? r.title : '',
    description: typeof r.description === 'string' ? r.description : '',
    content: typeof r.content === 'string' ? r.content : '',
    version: typeof r.version === 'string' ? r.version : '1.0.0',
    category: r.category === 'optional' ? 'optional' : 'required',
    sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
    effectiveDate: typeof r.effectiveDate === 'string' ? r.effectiveDate : null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : null,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
  };
}

function asVersionItem(value: unknown): ConsentVersionItem | null {
  const r = asRecord(value);
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    version: typeof r.version === 'string' ? r.version : '',
    content: typeof r.content === 'string' ? r.content : '',
    title: typeof r.title === 'string' ? r.title : '',
    description: typeof r.description === 'string' ? r.description : '',
    effectiveDate: typeof r.effectiveDate === 'string' ? r.effectiveDate : null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : null,
    createdBy: typeof r.createdBy === 'string' ? r.createdBy : '',
    changeNote: typeof r.changeNote === 'string' ? r.changeNote : '',
  };
}

async function fetchTemplates(): Promise<ConsentTemplateItem[]> {
  const res = await fetch('/api/admin/consents');
  if (!res.ok) return [];
  const json: unknown = await res.json();
  const record = asRecord(json);
  if (!Array.isArray(record?.items)) return [];
  return record.items.map(asTemplateItem).filter((item): item is ConsentTemplateItem => item !== null);
}

async function fetchVersions(id: string): Promise<ConsentVersionItem[]> {
  const res = await fetch(`/api/admin/consents/${encodeURIComponent(id)}/versions`);
  if (!res.ok) return [];
  const json: unknown = await res.json();
  const record = asRecord(json);
  if (!Array.isArray(record?.items)) return [];
  return record.items.map(asVersionItem).filter((item): item is ConsentVersionItem => item !== null);
}

async function saveTemplate(formData: ConsentFormData): Promise<boolean> {
  const res = await fetch('/api/admin/consents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  return res.ok;
}

async function deleteTemplate(id: string): Promise<boolean> {
  const res = await fetch(`/api/admin/consents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.ok;
}

/* ─── page ─────────────────────────────────────────────────────── */

export default function ConsentsPage(): ReactElement {
  const [templates, setTemplates] = useState<ConsentTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConsentFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<ConsentVersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const items = await fetchTemplates();
    setTemplates(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleToggleVersions = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null);
        setVersions([]);
        return;
      }
      setExpandedId(id);
      setLoadingVersions(true);
      const items = await fetchVersions(id);
      setVersions(items);
      setLoadingVersions(false);
    },
    [expandedId]
  );

  const handleOpenCreate = useCallback(() => {
    setEditingId(null);
    setErrorMsg('');
    setForm({ ...EMPTY_FORM, effectiveDate: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  }, []);

  const handleOpenEdit = useCallback(
    (template: ConsentTemplateItem) => {
      setEditingId(template.id);
      setErrorMsg('');
      setForm({
        key: template.key,
        title: template.title,
        description: template.description,
        content: template.content,
        version: template.version,
        category: template.category,
        sortOrder: template.sortOrder,
        effectiveDate: template.effectiveDate
          ? new Date(template.effectiveDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        changeNote: '',
      });
      setShowModal(true);
    },
    []
  );

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingId(null);
    setErrorMsg('');
    setForm({ ...EMPTY_FORM });
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof ConsentFormData, value: string | number) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleKeySelect = useCallback((key: string) => {
    const label = CONSENT_KEY_LABELS[key as ConsentKey] ?? '';
    setForm((prev) => ({
      ...prev,
      key,
      title: prev.title || label,
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setErrorMsg('');

      const ok = await saveTemplate({
        ...form,
        version: editingId ? bumpVersion(form.version) : form.version,
      });

      if (ok) {
        await loadTemplates();
        handleCloseModal();
      } else {
        setErrorMsg('저장에 실패했습니다. 다시 시도해주세요.');
      }
      setSaving(false);
    },
    [editingId, form, loadTemplates, handleCloseModal]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await deleteTemplate(id);
      if (ok) {
        setDeleteConfirmId(null);
        await loadTemplates();
      }
    },
    [loadTemplates]
  );

  const usedKeys = new Set(templates.map((t) => t.key));
  const availableKeys = editingId ? ALL_KEYS : ALL_KEYS.filter((k) => !usedKeys.has(k));
  const requiredItems = templates.filter((t) => t.category === 'required');
  const optionalItems = templates.filter((t) => t.category === 'optional');

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[28px] bg-[#0f172a] px-7 py-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
            legal &amp; compliance
          </p>
          <h1 className="mt-3 text-3xl font-bold">약관 관리</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            온보딩에서 사용자에게 동의받는 약관과 정책을 관리합니다. 버전을 업데이트하면 이전 버전이 자동으로 보관됩니다.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              + 새 약관 추가
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-4 md:grid-cols-4">
          <StatCard title="전체 약관" value={`${templates.length}`} hint="등록된 동의 항목 수" />
          <StatCard title="필수 동의" value={`${requiredItems.length}`} hint="법정 필수 동의 항목" />
          <StatCard title="선택 동의" value={`${optionalItems.length}`} hint="마케팅·광고 동의 항목" />
          <StatCard title="미등록 키" value={`${ALL_KEYS.length - templates.length}`} hint="아직 등록되지 않은 ConsentKey" />
        </section>

        {/* Required Consents */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">필수 동의 항목</h2>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
              {requiredItems.length}
            </span>
          </div>
          {loading ? (
            <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
              불러오는 중...
            </div>
          ) : (
            <div className="space-y-3">
              {requiredItems.map((item) => (
                <ConsentCard
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  versions={expandedId === item.id ? versions : []}
                  loadingVersions={loadingVersions}
                  deleteConfirmId={deleteConfirmId}
                  onEdit={() => handleOpenEdit(item)}
                  onDelete={() => setDeleteConfirmId(item.id)}
                  onConfirmDelete={() => handleDelete(item.id)}
                  onCancelDelete={() => setDeleteConfirmId(null)}
                  onToggleVersions={() => handleToggleVersions(item.id)}
                />
              ))}
              {requiredItems.length === 0 ? (
                <div className="rounded-[24px] bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
                  필수 동의 항목이 아직 등록되지 않았습니다.
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* Optional Consents */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">선택 동의 항목</h2>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-700">
              {optionalItems.length}
            </span>
          </div>
          <div className="space-y-3">
            {optionalItems.map((item) => (
              <ConsentCard
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                versions={expandedId === item.id ? versions : []}
                loadingVersions={loadingVersions}
                deleteConfirmId={deleteConfirmId}
                onEdit={() => handleOpenEdit(item)}
                onDelete={() => setDeleteConfirmId(item.id)}
                onConfirmDelete={() => handleDelete(item.id)}
                onCancelDelete={() => setDeleteConfirmId(null)}
                onToggleVersions={() => handleToggleVersions(item.id)}
              />
            ))}
            {optionalItems.length === 0 ? (
              <div className="rounded-[24px] bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
                선택 동의 항목이 아직 등록되지 않았습니다.
              </div>
            ) : null}
          </div>
        </section>

        {/* Consent Key Reference */}
        <section className="rounded-[24px] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            consent key reference
          </p>
          <h2 className="mt-2 text-lg font-bold text-slate-900">ConsentKey 전체 목록</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {ALL_KEYS.map((key) => {
              const legal = CONSENT_LEGAL_BASIS[key];
              const registered = usedKeys.has(key);
              return (
                <div
                  key={key}
                  className={`rounded-2xl border p-4 ${
                    registered
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-100 bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {CONSENT_KEY_LABELS[key]}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        registered
                          ? 'bg-emerald-200 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {registered ? '등록됨' : '미등록'}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">{key}</p>
                  {legal && (
                    <p className="mt-2 text-xs text-slate-500">
                      {legal.law} {legal.article}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Modal Overlay */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-16 pb-10">
            <div className="w-full max-w-2xl rounded-[24px] bg-white p-8 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {editingId ? 'edit template' : 'new template'}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {editingId ? '약관 수정' : '새 약관 등록'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-50"
                >
                  닫기
                </button>
              </div>

              {errorMsg && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {/* Key */}
                <div>
                  <label htmlFor="consent-key" className="mb-1.5 block text-sm font-semibold text-slate-700">
                    약관 키 (ConsentKey)
                  </label>
                  {editingId ? (
                    <input
                      id="consent-key"
                      type="text"
                      value={form.key}
                      readOnly
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-600"
                    />
                  ) : (
                    <select
                      id="consent-key"
                      value={form.key}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => handleKeySelect(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-stone-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    >
                      <option value="">선택해주세요</option>
                      {availableKeys.map((k) => (
                        <option key={k} value={k}>
                          {k} — {CONSENT_KEY_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Title + Description */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="consent-title" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      제목
                    </label>
                    <input
                      id="consent-title"
                      type="text"
                      value={form.title}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('title', e.target.value)}
                      placeholder="예: 서비스 이용약관"
                      className="w-full rounded-xl border border-slate-200 bg-stone-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="consent-desc" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      설명
                    </label>
                    <input
                      id="consent-desc"
                      type="text"
                      value={form.description}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('description', e.target.value)}
                      placeholder="약관에 대한 간단한 설명"
                      className="w-full rounded-xl border border-slate-200 bg-stone-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                </div>

                {/* Content */}
                <div>
                  <label htmlFor="consent-content" className="mb-1.5 block text-sm font-semibold text-slate-700">
                    약관 본문
                  </label>
                  <textarea
                    id="consent-content"
                    rows={10}
                    value={form.content}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleFieldChange('content', e.target.value)}
                    placeholder="전체 약관 텍스트를 입력하세요"
                    className="w-full rounded-xl border border-slate-200 bg-stone-50 px-4 py-2.5 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                {/* Version + Category + Sort Order */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="consent-version" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      버전
                    </label>
                    <input
                      id="consent-version"
                      type="text"
                      value={editingId ? bumpVersion(form.version) : form.version}
                      readOnly
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-600"
                    />
                    {editingId && (
                      <p className="mt-1 text-xs text-slate-400">
                        {form.version} → {bumpVersion(form.version)} 자동 증가
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="consent-category" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      카테고리
                    </label>
                    <select
                      id="consent-category"
                      value={form.category}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        handleFieldChange('category', e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-stone-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    >
                      <option value="required">필수 (required)</option>
                      <option value="optional">선택 (optional)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="consent-sort" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      정렬 순서
                    </label>
                    <input
                      id="consent-sort"
                      type="number"
                      value={form.sortOrder}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleFieldChange('sortOrder', Number(e.target.value))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-stone-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                </div>

                {/* Effective Date + Change Note */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="consent-date" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      시행일
                    </label>
                    <input
                      id="consent-date"
                      type="date"
                      value={form.effectiveDate}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleFieldChange('effectiveDate', e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-stone-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                  {editingId && (
                    <div>
                      <label htmlFor="consent-note" className="mb-1.5 block text-sm font-semibold text-slate-700">
                        변경 사유
                      </label>
                      <input
                        id="consent-note"
                        type="text"
                        value={form.changeNote ?? ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleFieldChange('changeNote', e.target.value)
                        }
                        placeholder="예: 개인정보처리방침 개정"
                        className="w-full rounded-xl border border-slate-200 bg-stone-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                      />
                    </div>
                  )}
                </div>

                {/* Submit */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !form.key || !form.title || !form.content}
                    className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? '저장 중...' : editingId ? '수정하기' : '등록하기'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── sub-components ───────────────────────────────────────────── */

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}): ReactElement {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold text-slate-900">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-500">{hint}</p>
    </div>
  );
}

function ConsentCard({
  item,
  expanded,
  versions,
  loadingVersions,
  deleteConfirmId,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onToggleVersions,
}: {
  item: ConsentTemplateItem;
  expanded: boolean;
  versions: ConsentVersionItem[];
  loadingVersions: boolean;
  deleteConfirmId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onToggleVersions: () => void;
}): ReactElement {
  const legal = CONSENT_LEGAL_BASIS[item.key as ConsentKey];
  const isDeleting = deleteConfirmId === item.id;

  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                item.category === 'required'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-sky-100 text-sky-700'
              }`}
            >
              {item.category === 'required' ? '필수' : '선택'}
            </span>
          </div>
          {item.description && (
            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              키: <span className="font-mono text-slate-600">{item.key}</span>
            </span>
            <span>
              버전: <span className="font-semibold text-slate-700">{item.version}</span>
            </span>
            {legal && (
              <span>
                법적 근거: <span className="text-slate-600">{legal.law} {legal.article}</span>
              </span>
            )}
            <span>시행일: {formatDate(item.effectiveDate)}</span>
            <span>정렬: {item.sortOrder}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            수정
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            삭제
          </button>
        </div>
      </div>

      {/* Version toggle */}
      <div className="border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          onClick={onToggleVersions}
          className="text-xs font-semibold text-cyan-700 hover:text-cyan-800"
        >
          {expanded ? '버전 이력 닫기' : '버전 이력 보기'}
        </button>
      </div>

      {/* Version history */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
          {loadingVersions ? (
            <p className="text-xs text-slate-400">이력을 불러오는 중...</p>
          ) : versions.length === 0 ? (
            <p className="text-xs text-slate-400">이전 버전 이력이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-900">v{v.version}</span>
                    <span className="text-slate-400">{formatDateTime(v.createdAt)}</span>
                    {v.changeNote && (
                      <span className="text-slate-500">— {v.changeNote}</span>
                    )}
                  </div>
                  {v.title && (
                    <p className="mt-1 text-sm text-slate-600">{v.title}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {isDeleting && (
        <div className="border-t border-rose-200 bg-rose-50 px-5 py-4">
          <p className="text-sm font-semibold text-rose-900">정말 삭제하시겠습니까?</p>
          <p className="mt-1 text-sm text-rose-600">
            이 약관의 버전 이력도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirmDelete}
              className="rounded-xl bg-rose-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700"
            >
              삭제 확인
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
