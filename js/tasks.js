import { icon } from './icons.js';
import {
  closeModal,
  isModalOpen,
  mountRichTextEditor,
  openConfirmDialog,
  openCourseCollectionModal,
  openModal,
} from './modal.js';
import {
  clearNavTarget,
  createIndividualTask,
  deleteIndividualTask,
  getCourseById,
  getEffectiveRole,
  getStoreState,
  getTaskNote,
  getWorkspaceViewState,
  isTaskCompletedByCurrentUser,
  setTaskNote,
  toggleTaskCompletion,
  updateIndividualTask,
} from './state.js';
import {
  TASK_BUCKETS,
  classifyTaskBucket,
  escapeHtml,
  formatDateTimeLabel,
  sanitizeExternalUrl,
  sanitizeRichTextHtml,
  toDatetimeLocalInput,
} from './utils.js';

const tasksUi = {
  courseFilter: 'all',
  searchQuery: '',
  completedExpanded: false,
  detailTaskId: null,
};

function openTaskFormModal(editingTask = null) {
  const viewState = getWorkspaceViewState();
  const now = getStoreState().now;

  const defaultDl = new Date(now);
  defaultDl.setDate(defaultDl.getDate() + 3);
  defaultDl.setHours(23, 59, 0, 0);

  let formHasDeadline = editingTask ? Boolean(editingTask.deadline) : true;
  const initialDeadline = editingTask
    ? toDatetimeLocalInput(editingTask.deadline)
    : toDatetimeLocalInput(defaultDl.toISOString());
  let formDescHtml = editingTask ? editingTask.descriptionHtml : '';
  let formUseOverride = editingTask
    ? Boolean(editingTask.overrideCollectionUrl)
    : false;
  const initialCourseId = editingTask
    ? editingTask.courseId
    : viewState.courses[0]?.id ?? '';

  openModal({
    id: 'task-form',
    title: editingTask ? 'Edit Tugas Kelas' : 'Buat Tugas Kelas Baru',
    subtitle: editingTask
      ? 'Mengubah tugas akan mereset status selesai seluruh mahasiswa dan mengirim notifikasi.'
      : 'Tugas akan langsung muncul di Task Planner seluruh anggota kelas.',
    size: 'xl',
    bodyHtml: `
      <form id="klik-task-form" class="klik-stack-sm">
        <div>
          <label class="klik-label">Nama Tugas</label>
          <input
            type="text"
            name="title"
            value="${escapeHtml(editingTask?.title ?? '')}"
            placeholder="Misal: Implementasi Binary Search Tree"
            class="klik-input"
          />
        </div>

        <div class="klik-grid-form-2-resp">
          <div>
            <label class="klik-label">Mata Kuliah</label>
            <select name="courseId" class="klik-select">
              ${viewState.courses
                .map(
                  (c) =>
                    `<option value="${escapeHtml(c.id)}" ${
                      c.id === initialCourseId ? 'selected' : ''
                    }>${escapeHtml(c.name)}</option>`
                )
                .join('')}
            </select>
          </div>

          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <label class="klik-label" style="margin-bottom:0;">Deadline</label>
              <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);cursor:pointer;">
                <input type="checkbox" id="klik-tf-has-dl" ${
                  formHasDeadline ? 'checked' : ''
                } style="accent-color:var(--emerald);" />
                <span>Gunakan deadline</span>
              </label>
            </div>
            <input
              type="datetime-local"
              name="deadline"
              id="klik-tf-dl-input"
              value="${escapeHtml(initialDeadline)}"
              class="klik-input klik-input--sm mono ${
                formHasDeadline ? '' : 'hidden'
              }"
            />
            <div id="klik-tf-no-dl" class="${
              formHasDeadline ? 'hidden' : ''
            }" style="border-radius:6px;border:1px solid var(--border-subtle);background:rgba(19,21,25,0.6);padding:8px 12px;font-size:12px;color:var(--text-dim);">
              Tanpa deadline
            </div>
          </div>
        </div>

        <div>
          <label class="klik-label">Deskripsi Tugas</label>
          <div id="klik-tf-rte-host"></div>
        </div>

        <div class="klik-subpanel">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <p style="font-size:11px;color:var(--text-muted);">
              Destinasi pengumpulan otomatis diwariskan dari <span id="klik-tf-course-hint" style="color:var(--text-secondary);">${escapeHtml(
                getCourseById(initialCourseId)?.name ?? 'mata kuliah'
              )}</span>.
            </p>
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);cursor:pointer;flex-shrink:0;">
              <input type="checkbox" id="klik-tf-override-cb" ${
                formUseOverride ? 'checked' : ''
              } style="accent-color:var(--emerald);" />
              <span>Override link</span>
            </label>
          </div>
          <div id="klik-tf-override-fields" class="klik-grid-form-2-resp ${
            formUseOverride ? '' : 'hidden'
          }" style="margin-top:10px;">
            <input
              type="text"
              name="overrideLabel"
              value="${escapeHtml(editingTask?.overrideCollectionLabel ?? '')}"
              placeholder="Label link khusus"
              class="klik-input klik-input--sm"
            />
            <input
              type="url"
              name="overrideUrl"
              value="${escapeHtml(editingTask?.overrideCollectionUrl ?? '')}"
              placeholder="https://..."
              class="klik-input klik-input--sm"
            />
          </div>
        </div>

        <p id="klik-tf-err" class="hidden text-rose" style="font-size:12px;"></p>

        <div class="klik-modal-footer" style="margin:0 -20px -16px;padding:14px 20px;">
          <button type="button" class="klik-btn klik-btn--ghost-border" data-tf-cancel>Batal</button>
          <button type="submit" class="klik-btn klik-btn--primary">
            ${editingTask ? 'Simpan Perubahan' : 'Bagikan Tugas'}
          </button>
        </div>
      </form>
    `,
    onMount: (root) => {
      const form = root.querySelector('#klik-task-form');
      const rteHost = root.querySelector('#klik-tf-rte-host');
      const hasDlCb = root.querySelector('#klik-tf-has-dl');
      const dlInput = root.querySelector('#klik-tf-dl-input');
      const noDlBox = root.querySelector('#klik-tf-no-dl');
      const overrideCb = root.querySelector('#klik-tf-override-cb');
      const overrideFields = root.querySelector('#klik-tf-override-fields');
      const courseHint = root.querySelector('#klik-tf-course-hint');
      const errEl = root.querySelector('#klik-tf-err');

      const rte = mountRichTextEditor(
        rteHost,
        formDescHtml,
        (html) => {
          formDescHtml = html;
        }
      );

      form?.elements.courseId?.addEventListener('change', (e) => {
        const c = getCourseById(e.target.value);
        if (courseHint) courseHint.textContent = c?.name ?? 'mata kuliah';
      });

      hasDlCb?.addEventListener('change', (e) => {
        formHasDeadline = e.target.checked;
        dlInput?.classList.toggle('hidden', !formHasDeadline);
        noDlBox?.classList.toggle('hidden', formHasDeadline);
      });

      overrideCb?.addEventListener('change', (e) => {
        formUseOverride = e.target.checked;
        overrideFields?.classList.toggle('hidden', !formUseOverride);
      });

      root
        .querySelector('[data-tf-cancel]')
        ?.addEventListener('click', () => closeModal());

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = form.elements.title.value;
        const courseId = form.elements.courseId.value;
        const deadlineRaw = form.elements.deadline.value;
        const overrideLabel = form.elements.overrideLabel.value;
        const overrideUrl = form.elements.overrideUrl.value;

        const showErr = (msg) => {
          if (!errEl) return;
          errEl.className = 'text-rose';
          errEl.textContent = msg;
        };

        if (!title.trim()) {
          showErr('Nama tugas wajib diisi.');
          return;
        }
        if (!courseId) {
          showErr('Pilih mata kuliah.');
          return;
        }

        let deadlineIso = null;
        if (formHasDeadline) {
          if (!deadlineRaw) {
            showErr('Tentukan tanggal dan jam deadline atau matikan deadline.');
            return;
          }
          const parsed = new Date(deadlineRaw);
          if (Number.isNaN(parsed.getTime())) {
            showErr('Format deadline tidak valid.');
            return;
          }
          deadlineIso = parsed.toISOString();
        }

        const payload = {
          title,
          courseId,
          deadline: deadlineIso,
          descriptionHtml: rte.getHtml(),
          overrideCollectionLabel: formUseOverride ? overrideLabel : null,
          overrideCollectionUrl: formUseOverride ? overrideUrl : null,
        };

        if (editingTask) {
          updateIndividualTask(editingTask.id, payload);
        } else {
          createIndividualTask(payload);
        }
        closeModal();
      });
    },
  });
}

function openTaskDetailModal(task) {
  const isAdmin = getEffectiveRole() === 'admin';
  const course = getCourseById(task.courseId);
  tasksUi.detailTaskId = task.id;

  const effectiveCollection = task.overrideCollectionUrl
    ? {
        label: task.overrideCollectionLabel || 'Link Pengumpulan Khusus',
        url: sanitizeExternalUrl(task.overrideCollectionUrl),
        isOverride: true,
      }
    : course?.collection
    ? {
        label: course.collection.label,
        url: sanitizeExternalUrl(course.collection.url),
        isOverride: false,
      }
    : null;

  const initialNote = getTaskNote(task.id);
  const safeDescription = sanitizeRichTextHtml(task.descriptionHtml);

  openModal({
    id: 'task-detail',
    title: task.title,
    subtitle: `${course?.name ?? 'Mata Kuliah'} · ${formatDateTimeLabel(
      task.deadline
    )}`,
    size: 'xl',
    bodyHtml: `
      <div class="klik-stack-md">
        <div>
          <h3 class="text-muted" style="font-size:12px;font-weight:500;margin-bottom:8px;">
            Deskripsi &amp; Instruksi
          </h3>
          ${
            safeDescription
              ? `<div class="klik-richtext klik-subpanel" style="font-size:14px;line-height:1.6;color:var(--text-body);">${safeDescription}</div>`
              : `<p style="font-size:12px;color:var(--text-dim);">Tidak ada deskripsi tambahan.</p>`
          }
        </div>

        <div class="klik-subpanel">
          <p class="text-muted" style="font-size:12px;font-weight:500;">
            Link Pengumpulan ${
              effectiveCollection?.isOverride
                ? '(Khusus Tugas Ini)'
                : '(Diwariskan dari Mata Kuliah)'
            }
          </p>
          ${
            effectiveCollection
              ? `<a href="${escapeHtml(
                  effectiveCollection.url
                )}" target="_blank" rel="noreferrer" class="break-all" style="margin-top:6px;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--emerald-text);">
                  ${icon('link2', 14)}
                  <span>${escapeHtml(effectiveCollection.label)}</span>
                  ${icon('externalLink', 12)}
                </a>`
              : `<p style="margin-top:4px;font-size:12px;color:var(--text-dim);">Mata kuliah ini belum memiliki link pengumpulan.</p>`
          }
        </div>

        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <label for="klik-td-note" style="font-size:12px;font-weight:500;color:var(--text-muted);">
              Catatan Pribadi (Hanya Terlihat oleh Anda)
            </label>
            <span id="klik-td-saved" class="hidden text-emerald" style="font-size:11px;">Tersimpan</span>
          </div>
          <textarea
            id="klik-td-note"
            rows="3"
            placeholder="Tulis pengingat pribadi atau progres pengerjaan Anda..."
            class="klik-textarea klik-textarea--sm"
          >${escapeHtml(initialNote)}</textarea>
          <div style="margin-top:6px;display:flex;justify-content:flex-end;">
            <button type="button" id="klik-td-save-note" class="klik-btn klik-btn--ghost-border klik-btn--xs">
              Simpan Catatan
            </button>
          </div>
        </div>
      </div>
    `,
    footerHtml: isAdmin
      ? `
      <div style="display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;">
        <button type="button" id="klik-td-delete" class="klik-btn klik-btn--danger-ghost">
          ${icon('trash2', 14)}
          <span>Hapus Tugas</span>
        </button>
        <button type="button" id="klik-td-edit" class="klik-btn klik-btn--primary">
          ${icon('pencil', 14)}
          <span>Edit Tugas</span>
        </button>
      </div>
    `
      : '',
    onMount: (root) => {
      const noteEl = root.querySelector('#klik-td-note');
      const savedEl = root.querySelector('#klik-td-saved');
      const saveNoteNow = () => {
        if (!noteEl) return;
        setTaskNote(task.id, noteEl.value);
        savedEl?.classList.remove('hidden');
      };

      noteEl?.addEventListener('input', () => {
        savedEl?.classList.add('hidden');
      });
      noteEl?.addEventListener('blur', saveNoteNow);
      root
        .querySelector('#klik-td-save-note')
        ?.addEventListener('click', saveNoteNow);

      root.querySelector('#klik-td-delete')?.addEventListener('click', () => {
        closeModal();
        openConfirmDialog({
          title: 'Hapus Tugas Kelas',
          description:
            'Tugas ini akan dihapus dari Task Planner seluruh anggota kelas. Tindakan ini tidak dapat dibatalkan.',
          confirmLabel: 'Hapus Tugas',
          onConfirm: () => deleteIndividualTask(task.id),
        });
      });

      root.querySelector('#klik-td-edit')?.addEventListener('click', () => {
        openTaskFormModal(task);
      });
    },
    onClose: () => {
      tasksUi.detailTaskId = null;
    },
  });
}

function renderTaskListHost(listHost) {
  if (!listHost) return;

  const store = getStoreState();
  const viewState = getWorkspaceViewState();
  const now = store.now;
  const isAdmin = getEffectiveRole() === 'admin';
  const q = tasksUi.searchQuery.trim().toLowerCase();

  const filteredTasks = viewState.individualTasks.filter((t) => {
    if (tasksUi.courseFilter !== 'all' && t.courseId !== tasksUi.courseFilter) {
      return false;
    }
    if (q) {
      const course = getCourseById(t.courseId);
      const hay = `${t.title} ${course?.name ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const bucketMap = new Map();
  TASK_BUCKETS.forEach((b) => bucketMap.set(b.key, []));
  filteredTasks.forEach((task) => {
    const completed = isTaskCompletedByCurrentUser(task.id);
    const bucket = classifyTaskBucket(task, completed, now);
    bucketMap.get(bucket)?.push(task);
  });

  bucketMap.forEach((list, key) => {
    list.sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
    bucketMap.set(key, list);
  });

  const nonEmptyCount = TASK_BUCKETS.filter(
    (b) => (bucketMap.get(b.key)?.length ?? 0) > 0
  ).length;

  if (nonEmptyCount === 0) {
    listHost.innerHTML = `
      <div class="klik-empty">
        <div class="klik-empty-icon">${icon('checkSquare', 18)}</div>
        <h3>Tidak ada tugas ditemukan</h3>
        <p>${
          tasksUi.searchQuery || tasksUi.courseFilter !== 'all'
            ? 'Ubah kata kunci pencarian atau filter mata kuliah.'
            : 'Belum ada tugas individu yang dibagikan untuk kelas ini.'
        }</p>
        ${
          isAdmin
            ? `<div style="margin-top:16px;"><button type="button" id="klik-tasks-empty-create" class="klik-btn klik-btn--primary">+ Buat Tugas Pertama</button></div>`
            : ''
        }
      </div>
    `;
    listHost
      .querySelector('#klik-tasks-empty-create')
      ?.addEventListener('click', () => openTaskFormModal(null));
    return;
  }

  listHost.innerHTML = `
    <div class="klik-stack-md">
      ${TASK_BUCKETS.map((bucket) => {
        const tasks = bucketMap.get(bucket.key) ?? [];
        if (tasks.length === 0) return '';

        const isCompletedSection = bucket.key === 'selesai';
        const isOpen = !isCompletedSection || tasksUi.completedExpanded;

        return `
          <section class="klik-card klik-card--overflow-hidden">
            ${
              isCompletedSection
                ? `
              <button type="button" id="klik-tasks-toggle-completed" class="klik-collapse-head">
                <div style="display:flex;align-items:center;gap:8px;">
                  ${icon(
                    tasksUi.completedExpanded ? 'chevronDown' : 'chevronRight',
                    16,
                    'text-muted'
                  )}
                  <span class="${bucket.toneClass}" style="font-size:12px;font-weight:600;">${escapeHtml(
                    bucket.label
                  )}</span>
                  <span class="mono tabular-nums text-dim" style="font-size:12px;">${
                    tasks.length
                  }</span>
                </div>
                <span class="text-dim" style="font-size:11px;">
                  ${tasksUi.completedExpanded ? 'Sembunyikan' : 'Tampilkan'}
                </span>
              </button>
            `
                : `
              <div class="klik-card-head klik-card-head--alt">
                <div style="display:flex;align-items:center;gap:8px;">
                  <h2 class="${bucket.toneClass}" style="font-size:12px;font-weight:600;">${escapeHtml(
                    bucket.label
                  )}</h2>
                  <span class="mono tabular-nums text-dim" style="font-size:12px;">${
                    tasks.length
                  }</span>
                </div>
              </div>
            `
            }

            ${
              isOpen
                ? `
              <div class="klik-divide-list">
                ${tasks
                  .map((task) => {
                    const course = getCourseById(task.courseId);
                    const completed = isTaskCompletedByCurrentUser(task.id);
                    const dlColor =
                      bucket.key === 'terlambat'
                        ? 'var(--rose-text)'
                        : bucket.key === 'hari_ini'
                        ? 'var(--amber-text)'
                        : 'var(--text-muted)';

                    return `
                      <div
                        class="klik-task-row ${completed ? 'is-completed' : ''}"
                        role="button"
                        tabindex="0"
                        data-task-open="${escapeHtml(task.id)}"
                      >
                        <div style="display:flex;align-items:center;gap:14px;min-width:0;">
                          <button
                            type="button"
                            data-task-toggle="${escapeHtml(task.id)}"
                            aria-label="${
                              completed
                                ? `Tandai ${escapeHtml(
                                    task.title
                                  )} belum selesai`
                                : `Tandai ${escapeHtml(task.title)} selesai`
                            }"
                            class="klik-checkbox-box ${
                              completed ? 'is-checked' : ''
                            }"
                          >
                            ${completed ? icon('check', 14, '', 2.5) : ''}
                          </button>

                          <div style="min-width:0;">
                            <p class="truncate" style="font-size:14px;font-weight:500;color:${
                              completed
                                ? 'var(--text-muted)'
                                : 'var(--text-primary)'
                            };${
                      completed ? 'text-decoration:line-through;' : ''
                    }">
                              ${escapeHtml(task.title)}
                            </p>
                            <p class="truncate" style="margin-top:2px;font-size:12px;color:var(--text-muted);">
                              ${escapeHtml(course?.name ?? 'Mata Kuliah')}
                            </p>
                          </div>
                        </div>

                        <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                          <span class="mono tabular-nums whitespace-nowrap" style="font-size:12px;color:${dlColor};">
                            ${escapeHtml(formatDateTimeLabel(task.deadline))}
                          </span>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            `
                : ''
            }
          </section>
        `;
      }).join('')}
    </div>
  `;

  listHost
    .querySelector('#klik-tasks-toggle-completed')
    ?.addEventListener('click', () => {
      tasksUi.completedExpanded = !tasksUi.completedExpanded;
      renderTaskListHost(listHost);
    });

  listHost.querySelectorAll('[data-task-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskCompletion(btn.getAttribute('data-task-toggle'));
    });
  });

  listHost.querySelectorAll('[data-task-open]').forEach((row) => {
    const openDetail = () => {
      const id = row.getAttribute('data-task-open');
      const task = viewState.individualTasks.find((t) => t.id === id);
      if (task) openTaskDetailModal(task);
    };
    row.addEventListener('click', openDetail);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail();
      }
    });
  });
}

export function renderTasksView(container) {
  if (!container) return;

  const store = getStoreState();
  const viewState = getWorkspaceViewState();
  const isAdmin = getEffectiveRole() === 'admin';

  // Handle deep navigation from Dashboard or Notification
  if (store.navTarget.taskId) {
    const target = viewState.individualTasks.find(
      (t) => t.id === store.navTarget.taskId
    );
    clearNavTarget();
    if (target) {
      window.setTimeout(() => openTaskDetailModal(target), 0);
    }
  }

  // If detail modal was open and task was deleted externally, close gracefully
  if (isModalOpen('task-detail') && tasksUi.detailTaskId) {
    const stillExists = viewState.individualTasks.some(
      (t) => t.id === tasksUi.detailTaskId
    );
    if (!stillExists) {
      closeModal();
    }
  }

  container.innerHTML = `
    <div class="klik-stack-md">
      <!-- Toolbar -->
      <div class="klik-toolbar">
        <div class="klik-toolbar-group" style="flex:1;">
          <div class="klik-search-wrap">
            <span class="klik-search-icon">${icon('search', 14)}</span>
            <input
              type="text"
              id="klik-tasks-search"
              value="${escapeHtml(tasksUi.searchQuery)}"
              placeholder="Cari tugas atau mata kuliah..."
              class="klik-input klik-input--surface klik-search-input"
            />
          </div>

          <select id="klik-tasks-filter" aria-label="Filter mata kuliah" class="klik-select klik-input--surface klik-select--sm" style="width:auto;">
            <option value="all" ${
              tasksUi.courseFilter === 'all' ? 'selected' : ''
            }>Semua Mata Kuliah</option>
            ${viewState.courses
              .map(
                (c) =>
                  `<option value="${escapeHtml(c.id)}" ${
                    tasksUi.courseFilter === c.id ? 'selected' : ''
                  }>${escapeHtml(c.name)}</option>`
              )
              .join('')}
          </select>
        </div>

        ${
          isAdmin
            ? `
          <div class="klik-toolbar-group">
            <button type="button" id="klik-tasks-collections" class="klik-btn klik-btn--secondary">
              ${icon('link2', 14, 'text-muted')}
              <span>Link Pengumpulan</span>
            </button>
            <button type="button" id="klik-tasks-create" class="klik-btn klik-btn--primary">
              ${icon('plus', 14)}
              <span>Buat Tugas</span>
            </button>
          </div>
        `
            : ''
        }
      </div>

      <div id="klik-tasks-list-host"></div>
    </div>
  `;

  const listHost = container.querySelector('#klik-tasks-list-host');
  renderTaskListHost(listHost);

  container
    .querySelector('#klik-tasks-search')
    ?.addEventListener('input', (e) => {
      tasksUi.searchQuery = e.target.value;
      renderTaskListHost(listHost);
    });

  container
    .querySelector('#klik-tasks-filter')
    ?.addEventListener('change', (e) => {
      tasksUi.courseFilter = e.target.value;
      renderTaskListHost(listHost);
    });

  container
    .querySelector('#klik-tasks-collections')
    ?.addEventListener('click', () => openCourseCollectionModal());

  container
    .querySelector('#klik-tasks-create')
    ?.addEventListener('click', () => openTaskFormModal(null));
}
