import { icon } from './icons.js';
import {
  closeModal,
  mountRichTextEditor,
  openConfirmDialog,
  openModal,
} from './modal.js';
import {
  addExternalMember,
  clearNavTarget,
  createGroupActivity,
  createGroupTask,
  deleteGroupTask,
  deleteGroupActivity,
  finalizeGroup,
  getCourseById,
  getCurrentUser,
  getEffectiveRole,
  getStoreState,
  getWorkspaceViewState,
  isGroupTaskCompleted,
  joinGroup,
  leaveGroup,
  toggleGroupTaskCompletion,
  updateGroupTask,
} from './state.js';
import {
  computeActivityCapacityPlan,
  escapeHtml,
  exportActivityToExcel,
  exportActivityToWord,
  formatDateTimeLabel,
  getGroupEffectiveMaxCapacity,
  isActivityArchived,
  sanitizeExternalUrl,
  sanitizeRichTextHtml,
  toDatetimeLocalInput,
} from './utils.js';

const groupsUi = {
  tab: 'aktif', // 'aktif' | 'arsip'
  selectedCourseId: null,
  selectedActivityId: null,
  actionError: null,
};

function openCreateActivityModal(container, defaultCourseId = null) {
  const viewState = getWorkspaceViewState();
  const initialCourse = defaultCourseId || viewState.courses[0]?.id || '';
  let submitting = false;

  openModal({
    id: 'group-create-activity',
    title: 'Buat Pembentukan Kelompok',
    subtitle:
      'Kapasitas dibagi otomatis dan merata. Jumlah peserta dan kelompok terkunci setelah dibuat.',
    size: 'md',
    bodyHtml: `
      <form id="klik-ga-create-form" class="klik-stack-sm">
        <div>
          <label class="klik-label">Mata Kuliah</label>
          <select name="courseId" class="klik-select">
            ${viewState.courses
        .map(
          (c) =>
            `<option value="${escapeHtml(c.id)}" ${c.id === initialCourse ? 'selected' : ''
            }>${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`
        )
        .join('')}
          </select>
        </div>

        <div>
          <label class="klik-label">Nama Aktivitas (Opsional)</label>
          <input type="text" name="name" placeholder="Misal: CBR 1, Mini Riset, Tugas 2" class="klik-input" />
        </div>

        <div class="klik-grid-form-2">
          <div>
            <label class="klik-label">Jumlah Peserta</label>
            <input type="number" name="participants" min="1" value="41" class="klik-input mono" />
          </div>
          <div>
            <label class="klik-label">Jumlah Kelompok</label>
            <input type="number" name="groupCount" min="1" value="7" class="klik-input mono" />
          </div>
        </div>

        <p id="klik-ga-err" class="hidden text-rose" style="font-size:12px;"></p>

        <div class="klik-modal-footer" style="margin:0 -20px -16px;padding:14px 20px;">
          <button type="button" class="klik-btn klik-btn--ghost-border" data-ga-cancel>Batal</button>
          <button type="submit" id="klik-ga-submit" class="klik-btn klik-btn--primary">Buat Aktivitas</button>
        </div>
      </form>
    `,
    onMount: (root) => {
      root
        .querySelector('[data-ga-cancel]')
        ?.addEventListener('click', () => closeModal());
      root
        .querySelector('#klik-ga-create-form')
        ?.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (submitting) return;
          const form = e.currentTarget;
          const errEl = root.querySelector('#klik-ga-err');
          const submitBtn = root.querySelector('#klik-ga-submit');
          const courseId = form.elements.courseId.value;
          const name = form.elements.name.value;
          const participants = Number(form.elements.participants.value);
          const groupCount = Number(form.elements.groupCount.value);

          const showErr = (msg) => {
            if (!errEl) return;
            errEl.className = 'text-rose';
            errEl.textContent = msg;
          };

          if (!courseId) {
            showErr('Pilih mata kuliah.');
            return;
          }
          if (!Number.isInteger(participants) || participants < 1) {
            showErr('Jumlah peserta harus berupa bilangan bulat minimal 1.');
            return;
          }
          if (!Number.isInteger(groupCount) || groupCount < 1) {
            showErr('Jumlah kelompok harus berupa bilangan bulat minimal 1.');
            return;
          }
          if (groupCount > participants) {
            showErr('Jumlah kelompok tidak boleh melebihi jumlah peserta.');
            return;
          }

          submitting = true;
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Membuat...';
          }
          try {
            const created = await createGroupActivity({
              courseId,
              name,
              totalParticipants: participants,
              groupCount,
            });
            closeModal();
            groupsUi.tab = 'aktif';
            groupsUi.selectedCourseId = created.courseId;
            groupsUi.selectedActivityId = created.id;
            groupsUi.actionError = null;
            renderGroupsView(container);
          } catch (err) {
            showErr(
              err instanceof Error
                ? err.message
                : 'Gagal membuat aktivitas kelompok.'
            );
          } finally {
            submitting = false;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Buat Aktivitas';
            }
          }
        });
    },
  });
}

function openExternalMemberModal(activityId, groupId) {
  openModal({
    id: 'group-add-external',
    title: 'Tambah Anggota Eksternal',
    subtitle:
      'Untuk anggota di luar daftar akun kelas (mahasiswa lintas kelas/pertukaran).',
    size: 'md',
    bodyHtml: `
      <form id="klik-ext-member-form" class="klik-stack-sm">
        <div>
          <label class="klik-label">Nama Lengkap</label>
          <input
            type="text"
            name="fullName"
            placeholder="Misal: Ahmad Fikri (Kelas 3B)"
            class="klik-input"
            autofocus
          />
        </div>
        <p id="klik-ext-err" class="hidden text-rose" style="font-size:12px;"></p>
        <div class="klik-modal-footer" style="margin:0 -20px -16px;padding:14px 20px;">
          <button type="button" class="klik-btn klik-btn--ghost-border" data-ext-cancel>Batal</button>
          <button type="submit" class="klik-btn klik-btn--primary">Tambahkan</button>
        </div>
      </form>
    `,
    onMount: (root) => {
      const form = root.querySelector('#klik-ext-member-form');
      const errEl = root.querySelector('#klik-ext-err');
      root
        .querySelector('[data-ext-cancel]')
        ?.addEventListener('click', () => closeModal());
      form?.elements.fullName?.focus();
      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const res = addExternalMember(
          activityId,
          groupId,
          form.elements.fullName.value
        );
        if (!res.ok) {
          if (errEl) {
            errEl.className = 'text-rose';
            errEl.textContent = res.error ?? 'Gagal menambahkan anggota.';
          }
          return;
        }
        closeModal();
      });
    },
  });
}

function openGroupTaskDetailModal(gt, course) {
  const effUrl = gt.overrideCollectionUrl
    ? sanitizeExternalUrl(gt.overrideCollectionUrl)
    : course?.collection
      ? sanitizeExternalUrl(course.collection.url)
      : null;
  const effLabel = gt.overrideCollectionUrl
    ? gt.overrideCollectionLabel || gt.overrideCollectionUrl
    : course?.collection?.label;
  const safeHtml = sanitizeRichTextHtml(gt.descriptionHtml);

  openModal({
    id: 'group-task-detail',
    title: gt.title,
    subtitle: `${course?.name ?? ''} · ${formatDateTimeLabel(gt.deadline)}`,
    size: 'lg',
    bodyHtml: `
      <div class="klik-stack-sm">
        ${safeHtml
        ? `<div class="klik-richtext klik-subpanel" style="font-size:14px;line-height:1.6;color:var(--text-body);">${safeHtml}</div>`
        : `<p style="font-size:12px;color:var(--text-dim);">Tidak ada deskripsi tambahan.</p>`
      }

        <div class="klik-subpanel">
          <p class="text-muted" style="font-size:12px;font-weight:500;">
            Link Pengumpulan ${gt.overrideCollectionUrl
        ? '(Override Tugas Kelompok)'
        : '(Diwariskan dari Mata Kuliah)'
      }
          </p>
          ${effUrl
        ? `<a href="${escapeHtml(
          effUrl
        )}" target="_blank" rel="noreferrer" class="break-all" style="margin-top:6px;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--emerald-text);">
                  ${icon('link2', 14)}
                  <span>${escapeHtml(effLabel)}</span>
                  ${icon('externalLink', 12)}
                </a>`
        : `<p style="margin-top:4px;font-size:12px;color:var(--text-dim);">Belum ada destinasi pengumpulan yang ditetapkan.</p>`
      }
        </div>
      </div>
    `,
  });
}

function openGroupTaskFormModal(activity, course, editingGt = null) {
  const dl = new Date();
  dl.setDate(dl.getDate() + 5);
  dl.setHours(23, 59, 0, 0);

  let hasDeadline = editingGt ? Boolean(editingGt.deadline) : true;
  const initialDl = editingGt
    ? toDatetimeLocalInput(editingGt.deadline)
    : toDatetimeLocalInput(dl.toISOString());
  let descHtml = editingGt ? editingGt.descriptionHtml : '';
  let useOverride = editingGt ? Boolean(editingGt.overrideCollectionUrl) : false;

  openModal({
    id: 'group-task-form',
    title: editingGt ? 'Edit Tugas Kelompok' : 'Buat Tugas Kelompok',
    subtitle: editingGt
      ? 'Mengedit tugas akan mereset status selesai seluruh kelompok untuk tugas ini.'
      : 'Tugas muncul di seluruh kelompok dengan status penyelesaian per kelompok.',
    size: 'xl',
    bodyHtml: `
      <form id="klik-gt-form" class="klik-stack-sm">
        <div>
          <label class="klik-label">Nama Tugas Kelompok</label>
          <input
            type="text"
            name="title"
            value="${escapeHtml(editingGt?.title ?? '')}"
            placeholder="Misal: Laporan Mini Riset Bab 1–3"
            class="klik-input"
          />
        </div>

        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <label class="klik-label" style="margin-bottom:0;">Deadline</label>
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);cursor:pointer;">
              <input type="checkbox" id="klik-gt-has-dl" ${hasDeadline ? 'checked' : ''
      } style="accent-color:var(--emerald);" />
              <span>Gunakan deadline</span>
            </label>
          </div>
          <input
            type="datetime-local"
            name="deadline"
            id="klik-gt-dl-input"
            value="${escapeHtml(initialDl)}"
            class="klik-input klik-input--sm mono ${hasDeadline ? '' : 'hidden'
      }"
          />
          <div id="klik-gt-no-dl" class="${hasDeadline ? 'hidden' : ''
      }" style="border-radius:6px;border:1px solid var(--border-subtle);background:rgba(19,21,25,0.6);padding:8px 12px;font-size:12px;color:var(--text-dim);">
            Tanpa deadline
          </div>
        </div>

        <div>
          <label class="klik-label">Deskripsi</label>
          <div id="klik-gt-rte-host"></div>
        </div>

        <div class="klik-subpanel">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-size:11px;color:var(--text-muted);">
              Destinasi pengumpulan diwariskan dari ${escapeHtml(
        course?.name ?? 'mata kuliah'
      )}.
            </span>
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);cursor:pointer;flex-shrink:0;">
              <input type="checkbox" id="klik-gt-override-cb" ${useOverride ? 'checked' : ''
      } style="accent-color:var(--emerald);" />
              <span>Override destinasi</span>
            </label>
          </div>
          <div id="klik-gt-override-fields" class="klik-grid-form-2-resp ${useOverride ? '' : 'hidden'
      }" style="margin-top:10px;">
            <input
              type="text"
              name="overrideLabel"
              value="${escapeHtml(editingGt?.overrideCollectionLabel ?? '')}"
              placeholder="Label destinasi khusus"
              class="klik-input klik-input--sm"
            />
            <input
              type="url"
              name="overrideUrl"
              value="${escapeHtml(editingGt?.overrideCollectionUrl ?? '')}"
              placeholder="https://..."
              class="klik-input klik-input--sm"
            />
          </div>
        </div>

        <p id="klik-gt-err" class="hidden text-rose" style="font-size:12px;"></p>

        <div class="klik-modal-footer" style="margin:0 -20px -16px;padding:14px 20px;">
          <button type="button" class="klik-btn klik-btn--ghost-border" data-gt-cancel>Batal</button>
          <button type="submit" class="klik-btn klik-btn--primary">
            ${editingGt ? 'Simpan Perubahan' : 'Buat Tugas Kelompok'}
          </button>
        </div>
      </form>
    `,
    onMount: (root) => {
      const form = root.querySelector('#klik-gt-form');
      const rteHost = root.querySelector('#klik-gt-rte-host');
      const hasDlCb = root.querySelector('#klik-gt-has-dl');
      const dlInput = root.querySelector('#klik-gt-dl-input');
      const noDlBox = root.querySelector('#klik-gt-no-dl');
      const overrideCb = root.querySelector('#klik-gt-override-cb');
      const overrideFields = root.querySelector('#klik-gt-override-fields');
      const errEl = root.querySelector('#klik-gt-err');

      const rte = mountRichTextEditor(rteHost, descHtml, (html) => {
        descHtml = html;
      });

      hasDlCb?.addEventListener('change', (e) => {
        hasDeadline = e.target.checked;
        dlInput?.classList.toggle('hidden', !hasDeadline);
        noDlBox?.classList.toggle('hidden', hasDeadline);
      });

      overrideCb?.addEventListener('change', (e) => {
        useOverride = e.target.checked;
        overrideFields?.classList.toggle('hidden', !useOverride);
      });

      root
        .querySelector('[data-gt-cancel]')
        ?.addEventListener('click', () => closeModal());

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = form.elements.title.value;
        const deadlineRaw = form.elements.deadline.value;
        const overrideLabel = form.elements.overrideLabel.value;
        const overrideUrl = form.elements.overrideUrl.value;

        const showErr = (msg) => {
          if (!errEl) return;
          errEl.className = 'text-rose';
          errEl.textContent = msg;
        };

        if (!title.trim()) {
          showErr('Nama tugas kelompok wajib diisi.');
          return;
        }
        let deadlineIso = null;
        if (hasDeadline) {
          if (!deadlineRaw) {
            showErr('Tentukan deadline atau nonaktifkan deadline.');
            return;
          }
          const d = new Date(deadlineRaw);
          if (Number.isNaN(d.getTime())) {
            showErr('Format deadline tidak valid.');
            return;
          }
          deadlineIso = d.toISOString();
        }

        const payload = {
          title,
          deadline: deadlineIso,
          descriptionHtml: rte.getHtml(),
          overrideCollectionLabel: useOverride ? overrideLabel : null,
          overrideCollectionUrl: useOverride ? overrideUrl : null,
        };

        if (editingGt) {
          updateGroupTask(editingGt.id, payload);
        } else {
          createGroupTask({ activityId: activity.id, ...payload });
        }
        closeModal();
      });
    },
  });
}

export function renderGroupsView(container) {
  if (!container) return;

  const store = getStoreState();
  const viewState = getWorkspaceViewState();
  const currentUser = getCurrentUser();
  const isAdmin = getEffectiveRole() === 'admin';

  // Deep navigation from Dashboard
  if (store.navTarget.groupActivityId || store.navTarget.groupCourseId) {
    if (store.navTarget.groupActivityId) {
      const act = viewState.groupActivities.find(
        (a) => a.id === store.navTarget.groupActivityId
      );
      if (act) {
        const actGroups = viewState.groups.filter((g) => g.activityId === act.id);
        groupsUi.tab = isActivityArchived(actGroups) ? 'arsip' : 'aktif';
        groupsUi.selectedCourseId = act.courseId;
        groupsUi.selectedActivityId = act.id;
      }
    } else if (store.navTarget.groupCourseId) {
      groupsUi.selectedCourseId = store.navTarget.groupCourseId;
      groupsUi.selectedActivityId = null;
    }
    groupsUi.actionError = null;
    clearNavTarget();
  }

  const activitiesWithStatus = viewState.groupActivities.map((act) => {
    const actGroups = viewState.groups.filter((g) => g.activityId === act.id);
    return {
      activity: act,
      groups: actGroups,
      archived: isActivityArchived(actGroups),
    };
  });

  const activeActivity =
    viewState.groupActivities.find((a) => a.id === groupsUi.selectedActivityId) ??
    null;

  // ------------------------------------------------------------------
  // Level 3: Activity Detail
  // ------------------------------------------------------------------
  if (activeActivity) {
    const course = getCourseById(activeActivity.courseId);
    const activityLabel =
      activeActivity.name.trim() ||
      `Pembentukan Kelompok ${course?.name ?? ''}`;
    const activityGroups = viewState.groups
      .filter((g) => g.activityId === activeActivity.id)
      .sort((a, b) => a.groupNumber - b.groupNumber);
    const activityMembers = viewState.groupMembers.filter(
      (m) => m.activityId === activeActivity.id
    );
    const activityTasks = viewState.groupTasks.filter(
      (gt) => gt.activityId === activeActivity.id
    );
    const isAllFinal = isActivityArchived(activityGroups);
    const capPlan = computeActivityCapacityPlan(
      activeActivity.totalParticipants,
      activeActivity.groupCount
    );

    const myMem = activityMembers.find((m) => m.userId === currentUser.id);
    const myGroup = myMem
      ? activityGroups.find((g) => g.id === myMem.groupId)
      : undefined;

    container.innerHTML = `
      <div class="klik-stack-lg">
        <!-- Activity Header -->
        <div class="klik-flex-lg-row" style="display:flex;flex-direction:column;gap:16px;border-bottom:1px solid rgba(255,255,255,0.07);padding-bottom:20px;">
          <div>
            <button type="button" id="klik-grp-back-course" class="klik-auth-back-btn" style="margin-bottom:0;">
              ${icon('arrowLeft', 14)}
              <span>Kembali ke ${escapeHtml(
      course?.name ?? 'Daftar Aktivitas'
    )}</span>
            </button>

            <div style="margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
              <h1 style="font-size:20px;font-weight:600;letter-spacing:-0.02em;color:var(--text-primary);">
                ${escapeHtml(activityLabel)}
              </h1>
              ${isAllFinal
        ? `<span class="klik-tag klik-tag--neutral">${icon(
          'archive',
          12
        )}<span>Arsip (Semua Final)</span></span>`
        : ''
      }
            </div>

            <div style="margin-top:4px;display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font-size:12px;color:var(--text-muted);">
              <span>${escapeHtml(course?.name ?? '')}</span>
              <span aria-hidden="true">·</span>
              <span class="mono tabular-nums">${activeActivity.totalParticipants
      } peserta · ${activeActivity.groupCount} kelompok</span>
              <span aria-hidden="true">·</span>
              <span class="text-dim" style="display:inline-flex;align-items:center;gap:4px;">
                ${icon('lock', 12)}
                ${capPlan.largeGroupQuota > 0
        ? `${capPlan.largeGroupQuota}× maks ${capPlan.largeCap}, ${capPlan.smallGroupQuota}× maks ${capPlan.smallCap} (dinamis)`
        : `Maks ${capPlan.smallCap} per kelompok`
      }
              </span>
            </div>
          </div>

          ${isAdmin
        ? `
            <div class="klik-toolbar-group">
              <button type="button" id="klik-grp-add-task" class="klik-btn klik-btn--secondary">
                ${icon('plus', 14)}
                <span>Tambah Tugas Kelompok</span>
              </button>
              ${isAllFinal && course
          ? `
                <button type="button" id="klik-grp-export-xlsx" class="klik-btn klik-btn--primary">
                  ${icon('fileSpreadsheet', 14)}
                  <span>Export .xlsx</span>
                </button>
                <button type="button" id="klik-grp-export-docx" class="klik-btn klik-btn--emerald-outline">
                  ${icon('fileText', 14)}
                  <span>Export .docx</span>
                </button>
              `
          : `
                <span class="klik-btn klik-btn--secondary" style="opacity:0.7;cursor:default;color:var(--text-dim);" title="Export Excel/Word hanya aktif setelah seluruh kelompok pada aktivitas ini berstatus Final.">
                  ${icon('download', 14)}
                  <span>Export terkunci (belum semua final)</span>
                </span>
              `
        }
            </div>
          `
        : ''
      }
        </div>

        ${groupsUi.actionError
        ? `<div class="klik-alert klik-alert--error">${escapeHtml(
          groupsUi.actionError
        )}</div>`
        : ''
      }

        ${activityTasks.length > 0
        ? `
          <section class="klik-card" style="padding:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;">
              <h2 style="font-size:12px;font-weight:600;color:var(--text-primary);">Daftar Tugas Kelompok Aktivitas Ini</h2>
              <span style="font-size:11px;color:var(--text-muted);">Checklist dikerjakan per kelompok pada kartu di bawah</span>
            </div>
            <div class="klik-divide-list">
              ${activityTasks
          .map((gt) => {
            const effUrl = gt.overrideCollectionUrl
              ? sanitizeExternalUrl(gt.overrideCollectionUrl)
              : course?.collection
                ? sanitizeExternalUrl(course.collection.url)
                : null;
            const effLabel = gt.overrideCollectionUrl
              ? gt.overrideCollectionLabel || 'Link Khusus'
              : course?.collection?.label;
            const doneCount = activityGroups.filter((g) =>
              isGroupTaskCompleted(gt.id, g.id)
            ).length;

            return `
                    <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;">
                      <div style="min-width:0;">
                        <button type="button" data-gt-detail="${escapeHtml(
              gt.id
            )}" style="font-size:14px;font-weight:500;color:var(--text-primary);text-align:left;cursor:pointer;">
                          ${escapeHtml(gt.title)}
                        </button>
                        <div style="margin-top:2px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);">
                          <span class="mono tabular-nums" style="font-size:11px;">${escapeHtml(
              formatDateTimeLabel(gt.deadline)
            )}</span>
                          ${effUrl
                ? `<span aria-hidden="true">·</span>
                                 <a href="${escapeHtml(
                  effUrl
                )}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:4px;color:var(--emerald-text);">
                                   <span>${escapeHtml(effLabel)}</span>
                                   ${icon('externalLink', 12)}
                                 </a>`
                : ''
              }
                        </div>
                      </div>

                      <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                        <span class="mono tabular-nums text-muted" style="font-size:12px;">
                          ${doneCount}/${activityGroups.length} kelompok selesai
                        </span>
                        ${isAdmin
                ? `
                          <div style="display:flex;align-items:center;gap:4px;">
                            <button type="button" data-gt-edit="${escapeHtml(
                  gt.id
                )}" class="klik-icon-btn" title="Edit tugas kelompok">
                              ${icon('pencil', 14)}
                            </button>
                            <button type="button" data-gt-del="${escapeHtml(
                  gt.id
                )}" class="klik-icon-btn klik-icon-btn--danger" title="Hapus tugas kelompok">
                              ${icon('trash2', 14)}
                            </button>
                          </div>
                        `
                : ''
              }
                      </div>
                    </div>
                  `;
          })
          .join('')}
            </div>
          </section>
        `
        : ''
      }

        <!-- Groups Grid -->
        <div class="klik-groups-grid">
          ${activityGroups
        .map((group) => {
          const members = activityMembers.filter(
            (m) => m.groupId === group.id
          );
          const maxCap = getGroupEffectiveMaxCapacity(
            group,
            activityGroups,
            activityMembers,
            activeActivity
          );
          const isFull = members.length >= maxCap;
          const isMyGroup = myGroup?.id === group.id;
          const lockedInOtherFinal = Boolean(
            myGroup && myGroup.id !== group.id && myGroup.isFinal
          );
          const canJoin =
            !group.isFinal && !isFull && !isMyGroup && !lockedInOtherFinal;
          const canChecklist = isAdmin || isMyGroup;

          const statusLabel = group.isFinal
            ? 'Final'
            : isFull
              ? 'Penuh'
              : 'Terbuka';
          const badgeClass = group.isFinal
            ? 'klik-tag--neutral'
            : isFull
              ? 'klik-tag--amber'
              : 'klik-tag--emerald';

          return `
                <div class="klik-group-card ${isMyGroup ? 'is-mine' : ''}">
                  <div class="klik-group-card-head">
                    <div>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <h3 style="font-size:14px;font-weight:600;color:var(--text-primary);">
                          Kelompok ${group.groupNumber}
                        </h3>
                        ${isMyGroup
              ? `<span class="text-emerald" style="font-size:11px;font-weight:500;">· Kelompok Saya</span>`
              : ''
            }
                      </div>
                      <p class="mono tabular-nums text-muted" style="margin-top:2px;font-size:12px;">
                        Kapasitas ${members.length} / ${maxCap}
                      </p>
                    </div>
                    <span class="klik-tag ${badgeClass}">${statusLabel}</span>
                  </div>

                  <div class="klik-group-card-body">
                    <div>
                      <p class="text-muted" style="font-size:11px;font-weight:500;margin-bottom:8px;">Anggota</p>
                      ${members.length === 0
              ? `<p style="font-size:12px;color:var(--text-dim);padding:8px 0;">Belum ada anggota di kelompok ini.</p>`
              : `
                        <ul class="klik-divide-list" style="list-style:none;padding:0;">
                          ${members
                .map(
                  (m) => `
                            <li style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;font-size:12px;">
                              <span class="truncate" style="color:${m.userId === currentUser.id
                      ? 'var(--emerald-soft)'
                      : 'var(--text-body)'
                    };font-weight:${m.userId === currentUser.id ? '500' : '400'
                    };">
                                ${escapeHtml(m.fullName)}
                              </span>
                              ${m.isExternal
                      ? `<span class="text-amber" style="flex-shrink:0;font-size:11px;font-weight:500;">Eksternal</span>`
                      : `<span class="mono tabular-nums text-dim" style="flex-shrink:0;font-size:11px;">${escapeHtml(
                        m.nim
                      )}</span>`
                    }
                            </li>
                          `
                )
                .join('')}
                        </ul>
                      `
            }
                    </div>

                    ${activityTasks.length > 0
              ? `
                      <div style="border-top:1px solid var(--border-subtle);padding-top:12px;">
                        <p class="text-muted" style="font-size:11px;font-weight:500;margin-bottom:8px;">Tugas Kelompok</p>
                        <div style="display:flex;flex-direction:column;gap:6px;">
                          ${activityTasks
                .map((gt) => {
                  const done = isGroupTaskCompleted(
                    gt.id,
                    group.id
                  );
                  return `
                                <div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;">
                                  <button
                                    type="button"
                                    ${canChecklist ? '' : 'disabled'}
                                    data-gt-check="${escapeHtml(gt.id)}"
                                    data-gt-check-grp="${escapeHtml(group.id)}"
                                    title="${canChecklist
                      ? 'Ubah status selesai kelompok ini'
                      : 'Hanya anggota kelompok ini atau Komting yang dapat checklist'
                    }"
                                    class="klik-checkbox-box klik-checkbox-box--sm ${done ? 'is-checked' : ''
                    }"
                                  >
                                    ${done ? icon('check', 12, '', 2.5) : ''}
                                  </button>
                                  <button
                                    type="button"
                                    data-gt-detail="${escapeHtml(gt.id)}"
                                    style="text-align:left;line-height:1.35;cursor:pointer;color:${done
                      ? 'var(--text-dim)'
                      : 'var(--text-secondary)'
                    };${done ? 'text-decoration:line-through;' : ''
                    }"
                                  >
                                    ${escapeHtml(gt.title)}
                                  </button>
                                </div>
                              `;
                })
                .join('')}
                        </div>
                      </div>
                    `
              : ''
            }
                  </div>

                  ${!group.isFinal
              ? `
                    <div class="klik-group-card-foot">
                      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
                        ${canJoin
                ? `<button type="button" data-grp-join="${escapeHtml(
                  group.id
                )}" class="klik-btn klik-btn--primary klik-btn--sm">${myGroup ? 'Pindah ke Sini' : 'Gabung'
                }</button>`
                : ''
              }
                        ${isMyGroup
                ? `<button type="button" data-grp-leave="${escapeHtml(
                  group.id
                )}" class="klik-btn klik-btn--ghost-border klik-btn--sm">Keluar</button>`
                : ''
              }
                        ${isAdmin && !isFull
                ? `<button type="button" data-grp-ext="${escapeHtml(
                  group.id
                )}" class="klik-btn klik-btn--ghost-border klik-btn--sm">
                                ${icon('userPlus', 14)}
                                <span>Tambah Eksternal</span>
                              </button>`
                : ''
              }
                      </div>

                      ${isAdmin || isMyGroup
                ? `<button type="button" data-grp-finalize="${escapeHtml(
                  group.id
                )}" class="klik-btn klik-btn--ghost-border klik-btn--sm">Selesai</button>`
                : ''
              }
                    </div>
                  `
              : ''
            }
                </div>
              `;
        })
        .join('')}
        </div>
      </div>
    `;

    container
      .querySelector('#klik-grp-back-course')
      ?.addEventListener('click', () => {
        groupsUi.selectedActivityId = null;
        groupsUi.actionError = null;
        renderGroupsView(container);
      });

    container
      .querySelector('#klik-grp-add-task')
      ?.addEventListener('click', () =>
        openGroupTaskFormModal(activeActivity, course, null)
      );

    container
      .querySelector('#klik-grp-export-xlsx')
      ?.addEventListener('click', () => {
        if (course) {
          exportActivityToExcel(
            activeActivity,
            course,
            activityGroups,
            activityMembers
          );
        }
      });

    container
      .querySelector('#klik-grp-export-docx')
      ?.addEventListener('click', () => {
        if (course) {
          void exportActivityToWord(
            activeActivity,
            course,
            activityGroups,
            activityMembers
          );
        }
      });

    container.querySelectorAll('[data-gt-detail]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gt = activityTasks.find(
          (t) => t.id === btn.getAttribute('data-gt-detail')
        );
        if (gt) openGroupTaskDetailModal(gt, course);
      });
    });

    container.querySelectorAll('[data-gt-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gt = activityTasks.find(
          (t) => t.id === btn.getAttribute('data-gt-edit')
        );
        if (gt) openGroupTaskFormModal(activeActivity, course, gt);
      });
    });

    container.querySelectorAll('[data-gt-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gtId = btn.getAttribute('data-gt-del');
        openConfirmDialog({
          title: 'Hapus Tugas Kelompok',
          description:
            'Tugas ini akan dihapus dari seluruh kelompok pada aktivitas ini. Lanjutkan?',
          confirmLabel: 'Hapus Tugas',
          onConfirm: () => deleteGroupTask(gtId),
        });
      });
    });

    container.querySelectorAll('[data-gt-check]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gtId = btn.getAttribute('data-gt-check');
        const grpId = btn.getAttribute('data-gt-check-grp');
        if (gtId && grpId) toggleGroupTaskCompletion(gtId, grpId);
      });
    });

    container.querySelectorAll('[data-grp-join]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = joinGroup(
          activeActivity.id,
          btn.getAttribute('data-grp-join')
        );
        groupsUi.actionError = res.ok ? null : res.error ?? null;
        if (!res.ok) renderGroupsView(container);
      });
    });

    container.querySelectorAll('[data-grp-leave]').forEach((btn) => {
      btn.addEventListener('click', () => {
        leaveGroup(activeActivity.id, btn.getAttribute('data-grp-leave'));
        groupsUi.actionError = null;
      });
    });

    container.querySelectorAll('[data-grp-ext]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openExternalMemberModal(
          activeActivity.id,
          btn.getAttribute('data-grp-ext')
        );
      });
    });

    container.querySelectorAll('[data-grp-finalize]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const grpId = btn.getAttribute('data-grp-finalize');
        openConfirmDialog({
          title: 'Finalisasi Kelompok',
          description:
            'Setelah ditandai Selesai, kelompok ini menjadi final. Anggota tidak dapat keluar, pindah, atau bertambah lagi, namun daftar anggota tetap dapat dilihat. Lanjutkan?',
          confirmLabel: 'Tandai Final',
          variant: 'primary',
          onConfirm: () => {
            if (grpId) finalizeGroup(grpId);
          },
        });
      });
    });

    return;
  }

  // ------------------------------------------------------------------
  // Level 2: Course Activity List
  // ------------------------------------------------------------------
  const selectedCourse = groupsUi.selectedCourseId
    ? getCourseById(groupsUi.selectedCourseId)
    : undefined;

  if (selectedCourse) {
    const wantArchived = groupsUi.tab === 'arsip';
    const courseActivitiesInTab = activitiesWithStatus.filter(
      (x) =>
        x.activity.courseId === selectedCourse.id &&
        x.archived === wantArchived
    );

    container.innerHTML = `
      <div class="klik-stack-md">
        <div class="klik-toolbar">
          <div>
            <button type="button" id="klik-grp-back-courses" class="klik-auth-back-btn" style="margin-bottom:0;">
              ${icon('arrowLeft', 14)}
              <span>Kembali ke Daftar Mata Kuliah</span>
            </button>
            <h1 style="margin-top:8px;font-size:20px;font-weight:600;letter-spacing:-0.02em;color:var(--text-primary);">
              ${escapeHtml(selectedCourse.name)}
            </h1>
            <p style="margin-top:2px;font-size:12px;color:var(--text-muted);">
              ${escapeHtml(selectedCourse.code)} · ${escapeHtml(
      selectedCourse.lecturer
    )}
            </p>
          </div>

          ${isAdmin && groupsUi.tab === 'aktif'
        ? `
            <button type="button" id="klik-grp-create-course-act" class="klik-btn klik-btn--primary">
              ${icon('plus', 14)}
              <span>Buat Pembentukan Kelompok</span>
            </button>
          `
        : ''
      }
        </div>

        ${courseActivitiesInTab.length === 0
        ? `
          <div class="klik-empty">
            <div class="klik-empty-icon">${icon('users', 18)}</div>
            <h3>Tidak ada aktivitas di tab ${groupsUi.tab === 'aktif' ? 'Aktif' : 'Arsip'
        }</h3>
            <p>Belum ada aktivitas pembentukan kelompok pada kategori ini untuk mata kuliah tersebut.</p>
          </div>
        `
        : `
          <div class="klik-card">
  <div class="klik-divide-list">
    ${courseActivitiesInTab
          .map(({ activity, groups, archived }) => {
            const title =
              activity.name.trim() ||
              `Pembentukan Kelompok ${selectedCourse.name}`;

            const finalCount = groups.filter((g) => g.isFinal).length;

            const myMem = viewState.groupMembers.find(
              (m) =>
                m.activityId === activity.id &&
                m.userId === currentUser.id
            );

            const myGrp = myMem
              ? groups.find((g) => g.id === myMem.groupId)
              : undefined;

            return `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 0;">
            <button
              type="button"
              class="klik-list-row-btn"
              data-grp-open-act="${escapeHtml(activity.id)}"
              style="flex:1;"
            >
              <div style="min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <h3 class="truncate" style="font-size:14px;font-weight:500;color:var(--text-primary);">
                    ${escapeHtml(title)}
                  </h3>
                  ${archived
                ? `<span class="text-muted" style="font-size:11px;">· Arsip</span>`
                : ''
              }
                </div>

                <p class="mono tabular-nums text-muted" style="margin-top:4px;font-size:12px;">
                  ${activity.totalParticipants} peserta ·
                  ${activity.groupCount} kelompok ·
                  ${finalCount}/${groups.length} final
                </p>
              </div>

              <span
                class="whitespace-nowrap"
                style="flex-shrink:0;font-size:12px;font-weight:500;color:${myGrp ? 'var(--emerald-text)' : 'var(--amber-text)'
              };"
              >
                ${myGrp
                ? `Kelompok ${myGrp.groupNumber}`
                : 'Belum bergabung'
              }
              </span>
            </button>

            ${isAdmin
                ? `<button
                    type="button"
                    class="klik-btn klik-btn-danger"
                    data-grp-delete-act="${escapeHtml(activity.id)}"
                  >Hapus</button>`
                : ''
              }
          </div>
        `;
          })
          .join('')}
  </div>
</div>
        `
      }
      </div>
    `;

    container
      .querySelector('#klik-grp-back-courses')
      ?.addEventListener('click', () => {
        groupsUi.selectedCourseId = null;
        renderGroupsView(container);
      });

    container
      .querySelector('#klik-grp-create-course-act')
      ?.addEventListener('click', () =>
        openCreateActivityModal(container, selectedCourse.id)
      );

    container.querySelectorAll('[data-grp-open-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        groupsUi.selectedActivityId = btn.getAttribute('data-grp-open-act');
        groupsUi.actionError = null;
        renderGroupsView(container);
      });
    });

    container.querySelectorAll('[data-grp-delete-act]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();

        const activityId = btn.getAttribute('data-grp-delete-act');

        if (!confirm('Yakin ingin menghapus aktivitas pembentukan kelompok ini beserta seluruh data kelompoknya?')) {
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Menghapus...';

        try {
          await deleteGroupActivity(activityId);
          groupsUi.selectedActivityId = null;
          groupsUi.actionError = null;
          renderGroupsView(container);
        } catch (error) {
          alert(error.message || 'Gagal menghapus aktivitas.');
          btn.disabled = false;
          btn.textContent = 'Hapus';
        }
      });
    });

    return;
  }

  // ------------------------------------------------------------------
  // Level 1: Course List with Aktif / Arsip tabs
  // ------------------------------------------------------------------
  const wantArchived = groupsUi.tab === 'arsip';
  const courseIdsWithActivities = new Set(
    activitiesWithStatus
      .filter((x) => x.archived === wantArchived)
      .map((x) => x.activity.courseId)
  );
  const visibleCourses = viewState.courses.filter((c) =>
    courseIdsWithActivities.has(c.id)
  );

  container.innerHTML = `
    <div class="klik-stack-md">
      <div class="klik-toolbar">
        <div class="klik-segmented">
          <button type="button" data-grp-tab="aktif" class="klik-segmented-btn ${groupsUi.tab === 'aktif' ? 'is-active' : ''
    }">Aktif</button>
          <button type="button" data-grp-tab="arsip" class="klik-segmented-btn ${groupsUi.tab === 'arsip' ? 'is-active' : ''
    }">Arsip</button>
        </div>

        ${isAdmin
      ? `
          <button type="button" id="klik-grp-create-main" class="klik-btn klik-btn--primary" style="align-self:flex-start;">
            ${icon('plus', 14)}
            <span>Buat Pembentukan Kelompok</span>
          </button>
        `
      : ''
    }
      </div>

      ${visibleCourses.length === 0
      ? `
        <div class="klik-empty">
          <div class="klik-empty-icon">${icon(
        groupsUi.tab === 'aktif' ? 'users' : 'archive',
        18
      )}</div>
          <h3>${groupsUi.tab === 'aktif'
        ? 'Belum ada pembentukan kelompok aktif'
        : 'Belum ada aktivitas yang diarsipkan'
      }</h3>
          <p>${groupsUi.tab === 'aktif'
        ? 'Hanya mata kuliah yang memiliki aktivitas pembentukan kelompok yang ditampilkan di sini.'
        : 'Aktivitas otomatis pindah ke Arsip ketika seluruh kelompoknya telah berstatus Final.'
      }</p>
          ${isAdmin && groupsUi.tab === 'aktif'
        ? `<div style="margin-top:16px;"><button type="button" id="klik-grp-empty-create" class="klik-btn klik-btn--primary">+ Buat Pembentukan Kelompok</button></div>`
        : ''
      }
        </div>
      `
      : `
        <div class="klik-card">
          <div class="klik-divide-list">
            ${visibleCourses
        .map((course) => {
          const courseActs = activitiesWithStatus.filter(
            (x) =>
              x.activity.courseId === course.id &&
              x.archived === wantArchived
          );
          return `
                  <button type="button" class="klik-list-row-btn" data-grp-course="${escapeHtml(
            course.id
          )}">
                    <div style="min-width:0;">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <h2 class="truncate" style="font-size:14px;font-weight:600;color:var(--text-primary);">${escapeHtml(
            course.name
          )}</h2>
                        <span class="mono text-dim" style="font-size:12px;">${escapeHtml(
            course.code
          )}</span>
                      </div>
                      <p class="truncate text-muted" style="margin-top:4px;font-size:12px;">${escapeHtml(
            course.lecturer
          )}</p>
                    </div>
                    <div style="flex-shrink:0;text-align:right;">
                      <span class="text-emerald tabular-nums" style="font-size:12px;font-weight:500;">${courseActs.length
            } aktivitas</span>
                    </div>
                  </button>
                `;
        })
        .join('')}
          </div>
        </div>
      `
    }
    </div>
  `;

  container.querySelectorAll('[data-grp-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      groupsUi.tab = btn.getAttribute('data-grp-tab');
      groupsUi.selectedCourseId = null;
      groupsUi.selectedActivityId = null;
      groupsUi.actionError = null;
      renderGroupsView(container);
    });
  });

  container
    .querySelector('#klik-grp-create-main')
    ?.addEventListener('click', () => openCreateActivityModal(container));

  container
    .querySelector('#klik-grp-empty-create')
    ?.addEventListener('click', () => openCreateActivityModal(container));

  container.querySelectorAll('[data-grp-course]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const courseId = btn.getAttribute('data-grp-course');
      const courseActs = activitiesWithStatus.filter(
        (x) => x.activity.courseId === courseId && x.archived === wantArchived
      );
      groupsUi.selectedCourseId = courseId;
      if (courseActs.length === 1) {
        groupsUi.selectedActivityId = courseActs[0].activity.id;
      }
      renderGroupsView(container);
    });
  });
}
