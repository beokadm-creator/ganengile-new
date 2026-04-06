'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, JSX } from 'react';
import {
  ConsentKey,
  CONSENT_KEY_LABELS,
  CONSENT_LEGAL_BASIS,
} from '@/lib/consent-types';
import type {
  ConsentTemplateItem,
  ConsentVersionItem,
  ConsentFormData,
} from '@/lib/consent-types';
import { formatDate } from '@/lib/format';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ALL_KEYS = Object.values(ConsentKey);

const EMPTY_FORM: ConsentFormData = {
  key: ConsentKey.SERVICE_TERMS,
  title: '',
  description: '',
  content: '',
  version: '1.0.0',
  category: 'required',
  sortOrder: 0,
  effectiveDate: new Date().toISOString().split('T')[0],
  changeNote: '',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function bumpVersion(current: string): string {
  const parts = current.split('.');
  const major = parts[0] ?? '1';
  const minor = parts[1] ?? '0';
  const patch = parseInt(parts[2] ?? '0', 10) + 1;
  return `${major}.${minor}.${patch}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asTemplateItem(value: unknown): ConsentTemplateItem | null {
  const r = asRecord(value);
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id as string,
    key: typeof r.key === 'string' ? (r.key as string) : (r.id as string),
    title: typeof r.title === 'string' ? (r.title as string) : '',
    description: typeof r.description === 'string' ? (r.description as string) : '',
    content: typeof r.content === 'string' ? (r.content as string) : '',
    version: typeof r.version === 'string' ? (r.version as string) : '1.0.0',
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
    id: r.id as string,
    version: typeof r.version === 'string' ? (r.version as string) : '',
    content: typeof r.content === 'string' ? (r.content as string) : '',
    title: typeof r.title === 'string' ? (r.title as string) : '',
    description: typeof r.description === 'string' ? (r.description as string) : '',
    effectiveDate: typeof r.effectiveDate === 'string' ? r.effectiveDate : null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : null,
    createdBy: typeof r.createdBy === 'string' ? (r.createdBy as string) : '',
    changeNote: typeof r.changeNote === 'string' ? (r.changeNote as string) : '',
  };
}

/* ------------------------------------------------------------------ */
/*  Data fetching                                                      */
/* ------------------------------------------------------------------ */

async function fetchTemplates(): Promise<ConsentTemplateItem[]> {
  const response = await fetch('/api/admin/consents');
  if (!response.ok) throw new Error('약관 목록을 불러오지 못했습니다.');
  const json: unknown = await response.json();
  const record = asRecord(json);
  if (!record || !Array.isArray(record.items)) return [];
  return (record.items as unknown[])
    .map(asTemplateItem)
    .filter((item): item is ConsentTemplateItem => item !== null);
}

async function fetchVersions(id: string): Promise<ConsentVersionItem[]> {
  const response = await fetch(`/api/admin/consents/${id}/versions`);
  if (!response.ok) return [];
  const json: unknown = await response.json();
  const record = asRecord(json);
  if (!record || !Array.isArray(record.items)) return [];
  return (record.items as unknown[])
    .map(asVersionItem)
    .filter((item): item is ConsentVersionItem => item !== null);
}

async function saveTemplate(formData: ConsentFormData): Promise<void> {
  const response = await fetch('/api/admin/consents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  if (!response.ok) {
    const err: unknown = await response.json();
    const record = asRecord(err);
    throw new Error(
      typeof record?.error === 'string' ? record.error : '저장에 실패했습니다.',
    );
  }
}

async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`/api/admin/consents/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('삭제에 실패했습니다.');
}

/* ================================================================== */
/*  Page Component                                                     */
/* ================================================================== */

export default function ConsentsPage(): JSX.Element {
  const [templates, setTemplates] = useState<ConsentTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'required' | 'optional'
  >('all');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConsentFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<Record<string, ConsentVersionItem[]>>({});
  const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  /* ---- Load templates ---- */
  const loadAll = useCallback(async () => {
    try {
      setErrorMsg('');
      setLoading(true);
      const items = await fetchTemplates();
      setTemplates(items);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '약관 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /* ---- Filtering ---- */
  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        q === '' ||
        t.title.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q);
      const matchesCategory =
        categoryFilter === 'all' || t.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, categoryFilter]);

  /* ---- Stats ---- */
  const stats = useMemo(
    () => ({
      total: templates.length,
      required: templates.filter((t) => t.category === 'required').length,
      optional: templates.filter((t) => t.category === 'optional').length,
    }),
    [templates],
  );

  /* ---- Form helpers ---- */
  function updateForm<K extends keyof ConsentFormData>(
    key: K,
    value: ConsentFormData[K],
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate(): void {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(template: ConsentTemplateItem): void {
    setEditingId(template.id);
    setForm({
      key: template.key,
      title: template.title,
      description: template.description,
      content: template.content,
      version: bumpVersion(template.version),
      category: template.category,
      sortOrder: template.sortOrder,
      effectiveDate: new Date().toISOString().split('T')[0],
      changeNote: '',
    });
    setShowModal(true);
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      await saveTemplate(form);
      setShowModal(false);
      await loadAll();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteConfirmId) return;
    try {
      await deleteTemplate(deleteConfirmId);
      setDeleteConfirmId(null);
      await loadAll();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '삭제에 실패했습니다.',
      );
    }
  }

  /* ---- Version history ---- */
  async function toggleVersions(id: string): Promise<void> {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (versions[id]) return;
    setLoadingVersions((prev) => ({ ...prev, [id]: true }));
    try {
      const items = await fetchVersions(id);
      setVersions((prev) => ({ ...prev, [id]: items }));
    } catch {
      setVersions((prev) => ({ ...prev, [id]: [] }));
    } finally {
      setLoadingVersions((prev) => ({ ...prev, [id]: false }));
    }
  }

  /* ---- Render ---- */
  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            consent management
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            약관 동의 관리
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            서비스 이용약관, 개인정보처리방침 등 국내 법령에 따라 온보딩에서
            동의받아야 하는 항목의 버전을 관리합니다. 약관을 수정하면 이전
            버전이 자동으로 보관됩니다.
          </p>
        </section>

        {/* Error banner */}
        {errorMsg ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {errorMsg}
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="ml-3 font-semibold text-rose-900 hover:text-rose-600"
            >
              닫기
            </button>
          </div>
        ) : null}

        {/* Stats */}
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard title="전체 약관" value={`${stats.total}건`} hint="등록된 약관 템플릿 수" />
          <StatCard title="필수 동의" value={`${stats.required}건`} hint="법적 필수 동의 항목" />
          <StatCard title="선택 동의" value={`${stats.optional}건`} hint="선택적 마케팅·광고 동의" />
        </section>

        {/* Toolbar */}
        <section className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="약관명 또는 키로 검색..."
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(e.target.value)
            }
            className="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <select
            value={categoryFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setCategoryFilter(
                e.target.value as 'all' | 'required' | 'optional',
              )
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">전체</option>
            <option value="required">필수</option>
            <option value="optional">선택</option>
          </select>
          <div className="flex-1" />
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            새 약관 추가
          </button>
        </section>

        {/* Content */}
        {loading ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            약관 목록을 불러오는 중입니다.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            {searchQuery || categoryFilter !== 'all'
              ? '검색 조건에 맞는 약관이 없습니다.'
              : '등록된 약관이 없습니다. "새 약관 추가" 버튼으로 시작하세요.'}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((template) => (
              <ConsentCard
                key={template.id}
                template={template}
                expanded={expandedId === template.id}
                versions={versions[template.id] ?? []}
                loadingVersions={loadingVersions[template.id] ?? false}
                onToggleVersions={() => void toggleVersions(template.id)}
                onEdit={() => openEdit(template)}
                onDelete={() => setDeleteConfirmId(template.id)}
              />
            ))}
          </div>
        )}

        {/* Legal reference */}
        <section className="rounded-[24px] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            legal reference
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">
            법적 근거 참고
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            각 동의 항목의 근거 법령과 조항입니다. 약관 내용에 법적 근거를
            포함해야 합니다.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {ALL_KEYS.map((key) => {
              const basis = CONSENT_LEGAL_BASIS[key];
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-100 bg-stone-50 p-4"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {CONSENT_KEY_LABELS[key]}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{key}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {basis.law} {basis.article}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Create/Edit Modal */}
      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  consent form
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  {editingId ? '약관 수정' : '새 약관 등록'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                닫기
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                약관 키
                <select
                  value={form.key}
                  onChange={(e) => updateForm('key', e.target.value)}
                  disabled={editingId !== null}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
                >
                  {ALL_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {CONSENT_KEY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                버전
                <input
                  type="text"
                  value={form.version}
                  onChange={(e) => updateForm('version', e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                카테고리
                <select
                  value={form.category}
                  onChange={(e) =>
                    updateForm(
                      'category',
                      e.target.value as 'required' | 'optional',
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="required">필수</option>
                  <option value="optional">선택</option>
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                정렬 순서
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    updateForm('sortOrder', Number(e.target.value))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                제목
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateForm('title', e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                설명
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                약관 본문
                <textarea
                  rows={8}
                  value={form.content}
                  onChange={(e) => updateForm('content', e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                시행일
                <input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => updateForm('effectiveDate', e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                변경 메모
                <input
                  type="text"
                  value={form.changeNote ?? ''}
                  onChange={(e) => updateForm('changeNote', e.target.value)}
                  placeholder="이번 변경 사유"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !form.key || !form.title || !form.content}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              confirm delete
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">약관 삭제</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              <strong>
                {templates.find((t) => t.id === deleteConfirmId)?.title ??
                  deleteConfirmId}
              </strong>{' '}
              약관을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/*  Sub-components                                                      */
/* ================================================================== */

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}): JSX.Element {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p>
    </div>
  );
}

function ConsentCard({
  template,
  expanded,
  versions: versionList,
  loadingVersions,
  onToggleVersions,
  onEdit,
  onDelete,
}: {
  template: ConsentTemplateItem;
  expanded: boolean;
  versions: ConsentVersionItem[];
  loadingVersions: boolean;
  onToggleVersions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const categoryBadge =
    template.category === 'required' ? (
      <span className="inline-flex rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
        필수
      </span>
    ) : (
      <span className="inline-flex rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
        선택
      </span>
    );

  const legal = CONSENT_LEGAL_BASIS[template.key as ConsentKey];

  return (
    <div className="rounded-[24px] bg-white p-6 shadow-sm">
      {/* Top row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-900">
            {template.title || template.key}
          </h3>
          {categoryBadge}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleVersions}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {expanded ? '이력 닫기' : '버전 이력'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            수정
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            삭제
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <DetailItem label="키" value={template.key} mono />
        <DetailItem label="버전" value={template.version} />
        <DetailItem label="시행일" value={formatDate(template.effectiveDate)} />
      </div>

      {template.description ? (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {template.description}
        </p>
      ) : null}

      {legal ? (
        <p className="mt-2 text-xs text-slate-500">
          근거: {legal.law} {legal.article}
        </p>
      ) : null}

      <div className="mt-2 flex gap-4 text-xs text-slate-400">
        <span>등록: {formatDate(template.createdAt)}</span>
        <span>수정: {formatDate(template.updatedAt)}</span>
      </div>

      {/* Version history */}
      {expanded ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            version history
          </p>
          {loadingVersions ? (
            <p className="mt-3 text-sm text-slate-400">
              버전 이력을 불러오는 중입니다.
            </p>
          ) : versionList.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              이전 버전 이력이 없습니다.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">버전</th>
                    <th className="px-4 py-3 text-left">제목</th>
                    <th className="px-4 py-3 text-left">변경 메모</th>
                    <th className="px-4 py-3 text-left">시행일</th>
                    <th className="px-4 py-3 text-left">작성자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versionList.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {v.version}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{v.title}</td>
                      <td className="max-w-[240px] px-4 py-3 text-slate-500">
                        {v.changeNote || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(v.effectiveDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {v.createdBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-100 bg-stone-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 text-sm text-slate-700 ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value || '-'}
      </p>
    </div>
  );
}
