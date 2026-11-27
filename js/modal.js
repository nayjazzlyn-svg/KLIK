import { icon } from './icons.js';
import {
  changePassword,
  deletePendingRosterEntry,
  getCourses,
  getCurrentUser,
  getEffectiveRole,
  getStoreState,
  getVerifiedRole,
  getWorkspaceViewState,
  isAuthenticated,
  provisionRosterStudent,
  resetRosterActivationCode,
  seedCurrentClassSampleData,
  setRoleOverride,
  toggleRosterMemberStatus,
  updateMemberRole,
  upsertCourseCollection,
} from './state.js';

import { saveUserAvatar } from './firebase.js';

import { escapeHtml, sanitizeExternalUrl } from './utils.js';

let activeModal = null;
let keydownBound = false;

function getModalRoot() {
  return document.getElementById('modal-root');
}

function bindGlobalModalKeydown() {
  if (keydownBound) return;
  keydownBound = true;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeModal) {
      e.preventDefault();
      closeModal();
    }
  });
}

export function isModalOpen(id) {
  return Boolean(activeModal && activeModal.id === id);
}

export function closeModal() {
  const root = getModalRoot();
  const prev = activeModal;
  activeModal = null;
  if (root) {
    root.innerHTML = '';
  }
  document.body.style.overflow = '';
  if (prev && typeof prev.onClose === 'function') {
    prev.onClose();
  }
}

export function openModal({
  id = 'generic',
  title = '',
  subtitle = '',
  size = 'lg', // 'md' | 'lg' | 'xl' | '2xl'
  bodyHtml = '',
  footerHtml = '',
  onMount = null,
  onClose = null,
}) {
  bindGlobalModalKeydown();
  const root = getModalRoot();
  if (!root) return null;

  const sizeClass =
    size === 'md'
      ? 'klik-modal-dialog--md'
      : size === 'xl'
        ? 'klik-modal-dialog--xl'
        : size === '2xl'
          ? 'klik-modal-dialog--2xl'
          : 'klik-modal-dialog--lg';

  activeModal = { id, onClose };
  document.body.style.overflow = 'hidden';

  root.innerHTML = `
    <div class="klik-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="klik-modal-title">
      <div class="klik-modal-dialog ${sizeClass}" data-modal-dialog>
        <div class="klik-modal-head">
          <div style="min-width: 0;">
            <h2 id="klik-modal-title" class="klik-modal-title">${escapeHtml(title)}</h2>
            ${subtitle
      ? `<p class="klik-modal-subtitle">${escapeHtml(subtitle)}</p>`
      : ''
    }
          </div>
          <button
            type="button"
            class="klik-icon-btn"
            data-modal-close
            aria-label="Tutup dialog"
          >
            ${icon('x', 16)}
          </button>
        </div>
        <div class="klik-modal-body" data-modal-body>
          ${bodyHtml}
        </div>
        ${footerHtml
      ? `<div class="klik-modal-footer" data-modal-footer>${footerHtml}</div>`
      : ''
    }
      </div>
    </div>
  `;

  const backdrop = root.querySelector('.klik-modal-backdrop');
  const dialog = root.querySelector('[data-modal-dialog]');
  const closeBtn = root.querySelector('[data-modal-close]');

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });
  }
  if (dialog) {
    dialog.addEventListener('click', (e) => e.stopPropagation());
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal());
  }

  if (typeof onMount === 'function') {
    onMount(root);
  }

  return root;
}

export function openConfirmDialog({
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'danger',
  onConfirm,
}) {
  const btnClass =
    variant === 'danger' ? 'klik-btn klik-btn--danger' : 'klik-btn klik-btn--primary';

  openModal({
    id: 'confirm-dialog',
    title,
    size: 'md',
    bodyHtml: `
      <div style="display:flex;align-items:flex-start;gap:12px;">
        ${variant === 'danger'
        ? `<div style="margin-top:2px;display:flex;width:32px;height:32px;flex-shrink:0;align-items:center;justify-content:center;border-radius:6px;background:rgba(244,63,94,0.15);color:var(--rose-text);">${icon(
          'alertTriangle',
          16
        )}</div>`
        : ''
      }
        <p style="font-size:14px;line-height:1.6;color:var(--text-secondary);">${escapeHtml(
        description
      )}</p>
      </div>
    `,
    footerHtml: `
      <button type="button" class="klik-btn klik-btn--ghost-border" data-confirm-cancel>
        ${escapeHtml(cancelLabel)}
      </button>
      <button type="button" class="${btnClass}" data-confirm-ok>
        ${escapeHtml(confirmLabel)}
      </button>
    `,
    onMount: (root) => {
      root
        .querySelector('[data-confirm-cancel]')
        ?.addEventListener('click', () => closeModal());
      root
        .querySelector('[data-confirm-ok]')
        ?.addEventListener('click', () => {
          closeModal();
          if (typeof onConfirm === 'function') onConfirm();
        });
    },
  });
}

// ------------------------------------------------------------------
// Rich Text Editor (Vanilla contentEditable + toolbar)
// ------------------------------------------------------------------

export function mountRichTextEditor(
  containerEl,
  initialHtml = '',
  onChange = () => { },
  placeholder = 'Tulis instruksi atau deskripsi tugas...'
) {
  if (!containerEl) return { getHtml: () => '' };

  containerEl.innerHTML = `
    <div class="klik-rte-wrap">
      <div class="klik-rte-toolbar">
        <button type="button" class="klik-rte-btn" data-cmd="bold" title="Tebal">${icon(
    'bold',
    14
  )}</button>
        <button type="button" class="klik-rte-btn" data-cmd="italic" title="Miring">${icon(
    'italic',
    14
  )}</button>
        <button type="button" class="klik-rte-btn" data-cmd="underline" title="Garis bawah">${icon(
    'underline',
    14
  )}</button>
        <span style="margin:0 4px;height:16px;width:1px;background:rgba(255,255,255,0.1);"></span>
        <button type="button" class="klik-rte-btn" data-cmd="formatBlock" data-arg="h2" title="Subjudul">${icon(
    'heading2',
    14
  )}</button>
        <button type="button" class="klik-rte-btn" data-cmd="insertUnorderedList" title="Daftar poin">${icon(
    'list',
    14
  )}</button>
        <button type="button" class="klik-rte-btn" data-cmd="insertOrderedList" title="Daftar bernomor">${icon(
    'listOrdered',
    14
  )}</button>
        <span style="margin:0 4px;height:16px;width:1px;background:rgba(255,255,255,0.1);"></span>
        <button type="button" class="klik-rte-btn" data-cmd="undo" title="Urungkan">${icon(
    'undo2',
    14
  )}</button>
        <button type="button" class="klik-rte-btn" data-cmd="redo" title="Ulangi">${icon(
    'redo2',
    14
  )}</button>
      </div>
      <div
        class="klik-rte-area klik-richtext"
        contenteditable="true"
        data-placeholder="${escapeHtml(placeholder)}"
      ></div>
    </div>
  `;

  const editor = containerEl.querySelector('.klik-rte-area');
  if (editor) {
    editor.innerHTML = initialHtml || '';
    editor.addEventListener('input', () => {
      onChange(editor.innerHTML);
    });
  }

  containerEl.querySelectorAll('.klik-rte-btn').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    btn.addEventListener('click', () => {
      if (!editor) return;
      editor.focus();
      const cmd = btn.getAttribute('data-cmd');
      const arg = btn.getAttribute('data-arg') || undefined;
      if (cmd) {
        document.execCommand(cmd, false, arg);
        onChange(editor.innerHTML);
      }
    });
  });

  return {
    getHtml: () => (editor ? editor.innerHTML : ''),
  };
}

// ------------------------------------------------------------------
// Shared Modal 1: Course Collection Links
// ------------------------------------------------------------------

let ccEditingCourseId = null;

function renderCourseCollectionBody(root) {
  const body = root.querySelector('[data-modal-body]');
  if (!body) return;
  const courses = getCourses();

  if (courses.length === 0) {
    body.innerHTML = `
      <p style="font-size:12px;color:var(--text-muted);padding:16px 0;">
        Belum ada mata kuliah terdaftar di kelas ini.
      </p>
    `;
    return;
  }

  body.innerHTML = `
    <div class="klik-divide-list">
      ${courses
      .map((course) => {
        const isEditing = ccEditingCourseId === course.id;
        const colUrl = course.collection ? sanitizeExternalUrl(course.collection.url) : '#';
        return `
            <div style="padding:14px 0;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
                <div style="min-width:0;">
                  <div style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;color:var(--text-primary);">
                    <span>${escapeHtml(course.name)}</span>
                    <span class="mono" style="font-size:12px;color:var(--text-dim);">${escapeHtml(
          course.code
        )}</span>
                  </div>
                  ${!isEditing
            ? `
                    <div style="margin-top:4px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);">
                      ${icon('link2', 14)}
                      ${course.collection
              ? `<a href="${escapeHtml(
                colUrl
              )}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:4px;color:var(--emerald-text);" class="truncate">
                              <span class="truncate">${escapeHtml(
                course.collection.label
              )}</span>
                              ${icon('externalLink', 12)}
                            </a>`
              : `<span style="color:var(--text-dim);">Belum ada link pengumpulan</span>`
            }
                    </div>
                  `
            : ''
          }
                </div>
                ${!isEditing
            ? `<button type="button" class="klik-btn klik-btn--ghost-border klik-btn--sm" data-cc-edit="${escapeHtml(
              course.id
            )}">${course.collection ? 'Ubah' : 'Tambah Link'
            }</button>`
            : ''
          }
              </div>
              ${isEditing
            ? `
                <form data-cc-form class="klik-subpanel klik-stack-xs" style="margin-top:12px;">
                  <div class="klik-grid-form-2-resp">
                    <div>
                      <label class="klik-label" style="margin-bottom:4px;">Label Destinasi</label>
                      <input type="text" name="label" class="klik-input klik-input--sm" value="${escapeHtml(
              course.collection?.label ?? ''
            )}" placeholder="Misal: Google Drive Kelas / LMS Sipadu" />
                    </div>
                    <div>
                      <label class="klik-label" style="margin-bottom:4px;">URL Pengumpulan</label>
                      <input type="url" name="url" class="klik-input klik-input--sm" value="${escapeHtml(
              course.collection?.url ?? ''
            )}" placeholder="https://..." />
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:4px;">
                    <span style="font-size:11px;color:var(--text-dim);">Kosongkan URL untuk menghapus link.</span>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <button type="button" class="klik-btn klik-btn--sm" style="color:var(--text-muted);" data-cc-cancel>Batal</button>
                      <button type="submit" class="klik-btn klik-btn--primary klik-btn--sm">Simpan</button>
                    </div>
                  </div>
                </form>
              `
            : ''
          }
            </div>
          `;
      })
      .join('')}
    </div>
  `;

  body.querySelectorAll('[data-cc-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ccEditingCourseId = btn.getAttribute('data-cc-edit');
      renderCourseCollectionBody(root);
    });
  });

  body.querySelector('[data-cc-cancel]')?.addEventListener('click', () => {
    ccEditingCourseId = null;
    renderCourseCollectionBody(root);
  });

  body.querySelector('[data-cc-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!ccEditingCourseId) return;
    const form = e.currentTarget;
    const label = form.elements.label.value;
    const url = form.elements.url.value;
    upsertCourseCollection(ccEditingCourseId, label, url);
    ccEditingCourseId = null;
    renderCourseCollectionBody(root);
  });
}

export function openCourseCollectionModal() {
  ccEditingCourseId = null;
  openModal({
    id: 'course-collection',
    title: 'Link Pengumpulan Mata Kuliah',
    subtitle:
      'Link utama per mata kuliah yang otomatis diwariskan ke Task Planner dan Group Task.',
    size: '2xl',
    bodyHtml: '',
    onMount: (root) => {
      renderCourseCollectionBody(root);
    },
    onClose: () => {
      ccEditingCourseId = null;
    },
  });
}

export function refreshCourseCollectionModalIfOpen() {
  if (!isModalOpen('course-collection')) return;
  const root = getModalRoot();
  if (root && !ccEditingCourseId) {
    renderCourseCollectionBody(root);
  }
}

// ------------------------------------------------------------------
// Shared Modal 2: Change Password
// ------------------------------------------------------------------

export function openChangePasswordModal() {
  const currentUser = getCurrentUser();
  let showPasswords = false;
  let saving = false;

  openModal({
    id: 'change-password',
    title: 'Ubah Password Akun',
    subtitle: `NIM ${currentUser.nim} · ${currentUser.name}`,
    size: 'md',
    bodyHtml: `
      <form id="klik-change-pw-form" class="klik-stack-sm">
        <div id="klik-chg-alert" class="hidden"></div>

        <div>
          <label for="klik-chg-current-pw" class="klik-label">Password Saat Ini</label>
          <div class="klik-input-wrap">
            <input
              id="klik-chg-current-pw"
              type="password"
              autocomplete="current-password"
              placeholder="Masukkan password saat ini"
              class="klik-input klik-input--dark klik-input-with-eye"
            />
            <button type="button" id="klik-chg-toggle-eye" class="klik-input-eye-btn" aria-label="Lihat password">
              ${icon('eye', 16)}
            </button>
          </div>
        </div>

        <div>
          <label for="klik-chg-new-pw" class="klik-label">Password Baru (min. 6 karakter)</label>
          <input
            id="klik-chg-new-pw"
            type="password"
            autocomplete="new-password"
            placeholder="Masukkan password baru"
            class="klik-input klik-input--dark"
          />
        </div>

        <div>
          <label for="klik-chg-confirm-pw" class="klik-label">Konfirmasi Password Baru</label>
          <input
            id="klik-chg-confirm-pw"
            type="password"
            autocomplete="new-password"
            placeholder="Ulangi password baru"
            class="klik-input klik-input--dark"
          />
        </div>

        <div class="klik-modal-footer" style="margin:0 -20px -16px;padding:14px 20px;">
          <button type="button" class="klik-btn klik-btn--ghost-border" data-chg-close>Tutup</button>
          <button type="submit" id="klik-chg-submit" class="klik-btn klik-btn--primary">Simpan Password Baru</button>
        </div>
      </form>
    `,
    onMount: (root) => {
      const form = root.querySelector('#klik-change-pw-form');
      const alertEl = root.querySelector('#klik-chg-alert');
      const curInput = root.querySelector('#klik-chg-current-pw');
      const newInput = root.querySelector('#klik-chg-new-pw');
      const confInput = root.querySelector('#klik-chg-confirm-pw');
      const eyeBtn = root.querySelector('#klik-chg-toggle-eye');
      const submitBtn = root.querySelector('#klik-chg-submit');

      const showError = (msg) => {
        if (!alertEl) return;
        alertEl.className = 'klik-alert klik-alert--error';
        alertEl.setAttribute('role', 'alert');
        alertEl.textContent = msg;
      };

      const showSuccess = () => {
        if (!alertEl) return;
        alertEl.className = 'klik-alert klik-alert--success';
        alertEl.removeAttribute('role');
        alertEl.innerHTML = `${icon(
          'checkCircle2',
          16
        )}<span>Password berhasil diperbarui. Gunakan password baru untuk login berikutnya.</span>`;
      };

      const clearAlert = () => {
        if (!alertEl) return;
        alertEl.className = 'hidden';
        alertEl.innerHTML = '';
      };

      [curInput, newInput, confInput].forEach((el) => {
        el?.addEventListener('input', clearAlert);
      });

      eyeBtn?.addEventListener('click', () => {
        showPasswords = !showPasswords;
        const type = showPasswords ? 'text' : 'password';
        if (curInput) curInput.type = type;
        if (newInput) newInput.type = type;
        if (confInput) confInput.type = type;
        eyeBtn.innerHTML = icon(showPasswords ? 'eyeOff' : 'eye', 16);
        eyeBtn.setAttribute(
          'aria-label',
          showPasswords ? 'Sembunyikan password' : 'Lihat password'
        );
      });

      root
        .querySelector('[data-chg-close]')
        ?.addEventListener('click', () => closeModal());

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (saving) return;

        const currentPassword = curInput?.value ?? '';
        const newPassword = newInput?.value ?? '';
        const confirmPassword = confInput?.value ?? '';

        if (!currentPassword) {
          showError('Password saat ini wajib diisi.');
          return;
        }
        if (newPassword.length < 6) {
          showError('Password baru minimal 6 karakter.');
          return;
        }
        if (newPassword !== confirmPassword) {
          showError('Konfirmasi password baru tidak sesuai.');
          return;
        }
        if (newPassword === currentPassword) {
          showError('Password baru harus berbeda dari password saat ini.');
          return;
        }

        saving = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Menyimpan...';
        }
        try {
          const res = await changePassword(currentPassword, newPassword);
          if (!res.ok) {
            showError(res.error ?? 'Gagal memperbarui password.');
            return;
          }
          showSuccess();
          if (curInput) curInput.value = '';
          if (newInput) newInput.value = '';
          if (confInput) confInput.value = '';
        } finally {
          saving = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Simpan Password Baru';
          }
        }
      });
    },
  });
}

// ------------------------------------------------------------------
// Shared Modal 3: Roster Provisioning (Komting Admin)
// ------------------------------------------------------------------

const rosterModalState = {
  nim: '',
  name: '',
  role: 'mahasiswa',
  searchQuery: '',
  submitting: false,
  busyNimKey: null,
  error: null,
  issuedBanner: null,
  copiedId: null,
};

async function copyRosterText(text, id) {
  try {
    await navigator.clipboard.writeText(text);
    rosterModalState.copiedId = id;
    refreshRosterModalIfOpen();
    window.setTimeout(() => {
      if (rosterModalState.copiedId === id) {
        rosterModalState.copiedId = null;
        refreshRosterModalIfOpen();
      }
    }, 2000);
  } catch {
    // Ignore clipboard failure
  }
}

function renderRosterListSection(root) {
  const listWrap = root.querySelector('#klik-roster-list-wrap');
  const countsEl = root.querySelector('#klik-roster-counts');
  if (!listWrap) return;

  const store = getStoreState();
  const roster = store.roster;
  const currentUser = getCurrentUser();

  let active = 0;
  let pending = 0;
  let disabled = 0;
  roster.forEach((r) => {
    if (r.status === 'active') active += 1;
    else if (r.status === 'pending') pending += 1;
    else disabled += 1;
  });

  if (countsEl) {
    countsEl.textContent = `${active} aktif · ${pending} menunggu aktivasi · ${disabled} dinonaktifkan`;
  }

  const q = rosterModalState.searchQuery.trim().toLowerCase();
  const list = q
    ? roster.filter(
      (r) =>
        r.nim.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    )
    : roster;

  const order = { pending: 0, active: 1, disabled: 2 };
  const filtered = [...list].sort((a, b) => {
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    return a.nim.localeCompare(b.nim);
  });

  if (filtered.length === 0) {
    listWrap.innerHTML = `
      <div style="padding:32px 16px;text-align:center;font-size:12px;color:var(--text-muted);">
        ${roster.length === 0
        ? 'Belum ada anggota lain di daftar kelas.'
        : 'Tidak ada mahasiswa yang cocok dengan pencarian.'
      }
      </div>
    `;
    return;
  }

  listWrap.innerHTML = `
    <div class="klik-divide-list">
      ${filtered
      .map((entry) => {
        const isSelf = entry.claimedByUid === currentUser.id;
        const isBusy = rosterModalState.busyNimKey === entry.nimKey;

        return `
            <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;font-size:12px;">
              <div style="min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span class="truncate" style="font-weight:500;color:var(--text-primary);">${escapeHtml(
          entry.name
        )}</span>
                  ${isSelf
            ? `<span style="font-size:11px;color:var(--emerald-text);">(Anda)</span>`
            : ''
          }
                  ${entry.role === 'admin'
            ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--emerald-text);">${icon(
              'shield',
              12
            )}<span>${escapeHtml(entry.title)}</span></span>`
            : ''
          }
                </div>
                <div style="margin-top:2px;display:flex;align-items:center;gap:8px;font-size:11px;">
                  <span class="mono" style="color:var(--text-muted);">${escapeHtml(
            entry.nim
          )}</span>
                  <span style="color:var(--text-sep);">·</span>
                  ${entry.status === 'active'
            ? `<span class="text-emerald">Aktif</span>`
            : entry.status === 'pending'
              ? `<span class="text-amber">Menunggu Aktivasi</span>`
              : `<span class="text-rose">Dinonaktifkan</span>`
          }
                </div>
              </div>

              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                ${entry.status === 'pending'
            ? `
                  <button type="button" class="klik-btn klik-btn--ghost-border klik-btn--xs" data-roster-reset="${escapeHtml(
              entry.nimKey
            )}" ${isBusy ? 'disabled' : ''}>
                    ${icon('refreshCw', 12)}
                    <span>Buat Ulang Kode</span>
                  </button>
                  <button type="button" class="klik-btn klik-btn--ghost-border klik-btn--xs" style="padding:4px 6px;" data-roster-del="${escapeHtml(
              entry.nimKey
            )}" aria-label="Hapus ${escapeHtml(entry.name)}" ${isBusy ? 'disabled' : ''
            }>
                    ${icon('trash2', 14)}
                  </button>
                `
            : ''
          }
                ${entry.status !== 'pending' && entry.claimedByUid && !isSelf
            ? `
                  <button type="button" class="klik-btn klik-btn--ghost-border klik-btn--xs" data-roster-role="${escapeHtml(
              entry.nimKey
            )}" ${isBusy ? 'disabled' : ''}>
                    ${entry.role === 'admin'
              ? 'Jadikan Mahasiswa'
              : 'Jadikan Komting'
            }
                  </button>
                  <button type="button" class="klik-btn ${entry.status === 'active'
              ? 'klik-btn--danger-outline'
              : 'klik-btn--emerald-outline'
            } klik-btn--xs" data-roster-status="${escapeHtml(
              entry.nimKey
            )}" ${isBusy ? 'disabled' : ''}>
                    ${entry.status === 'active'
              ? `${icon('userX', 12)}<span>Nonaktifkan</span>`
              : `${icon('userCheck', 12)}<span>Aktifkan</span>`
            }
                  </button>
                `
            : ''
          }
              </div>
            </div>
          `;
      })
      .join('')}
    </div>
  `;

  listWrap.querySelectorAll('[data-roster-reset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.getAttribute('data-roster-reset');
      const entry = getStoreState().roster.find((r) => r.nimKey === key);
      if (!entry) return;
      rosterModalState.error = null;
      rosterModalState.busyNimKey = entry.nimKey;
      renderRosterBannerAndError(root);
      renderRosterListSection(root);
      try {
        const res = await resetRosterActivationCode(entry);
        if (!res.ok) {
          rosterModalState.error =
            res.error ?? 'Gagal membuat ulang kode aktivasi.';
        } else if (res.activationCode) {
          rosterModalState.issuedBanner = {
            nim: entry.nim,
            name: entry.name,
            activationCode: res.activationCode,
          };
        }
      } finally {
        rosterModalState.busyNimKey = null;
        if (isModalOpen('roster-provisioning')) {
          renderRosterBannerAndError(root);
          renderRosterListSection(root);
        }
      }
    });
  });

  listWrap.querySelectorAll('[data-roster-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.getAttribute('data-roster-del');
      const entry = getStoreState().roster.find((r) => r.nimKey === key);
      if (!entry) return;
      rosterModalState.error = null;
      rosterModalState.busyNimKey = entry.nimKey;
      renderRosterBannerAndError(root);
      renderRosterListSection(root);
      try {
        const res = await deletePendingRosterEntry(entry);
        if (!res.ok) {
          rosterModalState.error =
            res.error ?? 'Gagal menghapus mahasiswa dari daftar.';
        }
      } finally {
        rosterModalState.busyNimKey = null;
        if (isModalOpen('roster-provisioning')) {
          renderRosterBannerAndError(root);
          renderRosterListSection(root);
        }
      }
    });
  });

  listWrap.querySelectorAll('[data-roster-role]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.getAttribute('data-roster-role');
      const entry = getStoreState().roster.find((r) => r.nimKey === key);
      if (!entry || !entry.claimedByUid) return;
      rosterModalState.error = null;
      rosterModalState.busyNimKey = entry.nimKey;
      renderRosterBannerAndError(root);
      renderRosterListSection(root);
      try {
        const nextRole = entry.role === 'admin' ? 'mahasiswa' : 'admin';
        const nextTitle = nextRole === 'admin' ? 'Komting' : 'Mahasiswa';
        await updateMemberRole(entry.claimedByUid, nextRole, nextTitle);
      } catch (err) {
        rosterModalState.error =
          err instanceof Error ? err.message : 'Gagal mengubah role anggota.';
      } finally {
        rosterModalState.busyNimKey = null;
        if (isModalOpen('roster-provisioning')) {
          renderRosterBannerAndError(root);
          renderRosterListSection(root);
        }
      }
    });
  });

  listWrap.querySelectorAll('[data-roster-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.getAttribute('data-roster-status');
      const entry = getStoreState().roster.find((r) => r.nimKey === key);
      if (!entry) return;
      rosterModalState.error = null;
      rosterModalState.busyNimKey = entry.nimKey;
      renderRosterBannerAndError(root);
      renderRosterListSection(root);
      try {
        const res = await toggleRosterMemberStatus(entry);
        if (!res.ok) {
          rosterModalState.error = res.error ?? 'Gagal mengubah status akun.';
        }
      } finally {
        rosterModalState.busyNimKey = null;
        if (isModalOpen('roster-provisioning')) {
          renderRosterBannerAndError(root);
          renderRosterListSection(root);
        }
      }
    });
  });
}

function renderRosterBannerAndError(root) {
  const viewState = getWorkspaceViewState();
  const bannerWrap = root.querySelector('#klik-roster-banner-wrap');
  const errorEl = root.querySelector('#klik-roster-error');
  const copyClassBtn = root.querySelector('#klik-roster-copy-code');

  if (copyClassBtn) {
    copyClassBtn.innerHTML =
      rosterModalState.copiedId === 'classCode'
        ? `${icon('check', 14, 'text-emerald')}<span>Disalin</span>`
        : `${icon('copy', 14, 'text-muted')}<span>${escapeHtml(
          viewState.classInfo.code
        )}</span>`;
  }

  if (bannerWrap) {
    const b = rosterModalState.issuedBanner;
    if (!b) {
      bannerWrap.innerHTML = '';
    } else {
      bannerWrap.innerHTML = `
        <div style="border-radius:6px;border:1px solid rgba(16,185,129,0.35);background:rgba(16,185,129,0.1);padding:14px;font-size:12px;">
          <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;">
            <div style="display:flex;flex-direction:column;gap:4px;">
              <p style="font-weight:600;color:var(--emerald-soft);display:flex;align-items:center;gap:6px;">
                ${icon('keyRound', 14)}
                <span>Kode Aktivasi untuk ${escapeHtml(
        b.name
      )} (<span class="mono">${escapeHtml(b.nim)}</span>)</span>
              </p>
              <p style="font-size:11px;color:rgba(167,243,208,0.85);">
                Salin dan kirimkan sekarang. Demi keamanan, sistem hanya menyimpan hash kode dan tidak menampilkannya kembali setelah ditutup.
              </p>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <code class="mono" style="border-radius:4px;border:1px solid rgba(16,185,129,0.3);background:var(--bg-main);padding:4px 10px;font-size:14px;font-weight:700;letter-spacing:0.05em;color:var(--emerald-soft);">
                ${escapeHtml(b.activationCode)}
              </code>
              <button type="button" id="klik-roster-copy-invite" class="klik-btn klik-btn--primary klik-btn--sm">
                ${rosterModalState.copiedId === 'inviteText'
          ? `${icon('check', 14)}<span>Tersalin</span>`
          : `${icon('copy', 14)}<span>Salin Undangan</span>`
        }
              </button>
            </div>
          </div>
        </div>
      `;
      bannerWrap
        .querySelector('#klik-roster-copy-invite')
        ?.addEventListener('click', () => {
          void copyRosterText(
            `Aktivasi Akun KLIK\nKode Kelas: ${viewState.classInfo.code}\nNIM: ${b.nim}\nKode Aktivasi: ${b.activationCode}`,
            'inviteText'
          );
        });
    }
  }

  if (errorEl) {
    if (rosterModalState.error) {
      errorEl.className = 'klik-alert klik-alert--error';
      errorEl.setAttribute('role', 'alert');
      errorEl.textContent = rosterModalState.error;
    } else {
      errorEl.className = 'hidden';
      errorEl.textContent = '';
    }
  }
}

export function openRosterProvisioningModal() {
  const viewState = getWorkspaceViewState();
  const isVerifiedAdmin = getVerifiedRole() === 'admin';
  rosterModalState.error = null;

  openModal({
    id: 'roster-provisioning',
    title: 'Anggota & Aktivasi Akun Kelas',
    subtitle: `${viewState.classInfo.name} · Kode Kelas: ${viewState.classInfo.code}`,
    size: '2xl',
    bodyHtml: !isVerifiedAdmin
      ? `
        <div class="klik-subpanel" style="font-size:12px;color:var(--text-muted);">
          Pengelolaan daftar mahasiswa dan kode aktivasi hanya dapat diakses oleh Komting/Admin kelas yang terverifikasi.
        </div>
      `
      : `
        <div class="klik-stack-md">
          <div class="klik-subpanel" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;font-size:12px;">
            <div style="display:flex;flex-direction:column;gap:2px;">
              <p style="color:var(--text-muted);">
                Bagikan <span style="color:var(--text-body);">Kode Kelas</span> dan <span style="color:var(--text-body);">Kode Aktivasi</span> kepada mahasiswa agar dapat membuat password akun masing-masing.
              </p>
              <p id="klik-roster-counts" style="font-size:11px;color:var(--text-dim);"></p>
            </div>
            <button type="button" id="klik-roster-copy-code" class="klik-btn klik-btn--surface klik-btn--sm mono"></button>
          </div>

          <div id="klik-roster-banner-wrap"></div>
          <div id="klik-roster-error" class="hidden"></div>

          <form id="klik-roster-add-form" class="klik-subpanel klik-stack-xs">
            <p style="font-size:12px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
              <span class="text-emerald">${icon('userPlus', 14)}</span>
              <span>Daftarkan Mahasiswa Baru</span>
            </p>
            <div class="klik-roster-grid">
              <div class="klik-col-3">
                <input
                  type="text"
                  name="nim"
                  value="${escapeHtml(rosterModalState.nim)}"
                  placeholder="NIM (misal 230104002)"
                  aria-label="NIM Mahasiswa"
                  class="klik-input klik-input--dark klik-input--sm mono"
                />
              </div>
              <div class="klik-col-4">
                <input
                  type="text"
                  name="name"
                  value="${escapeHtml(rosterModalState.name)}"
                  placeholder="Nama lengkap mahasiswa"
                  aria-label="Nama Lengkap Mahasiswa"
                  class="klik-input klik-input--dark klik-input--sm"
                />
              </div>
              <div class="klik-col-3">
                <select name="role" aria-label="Peran Anggota" class="klik-select klik-input--dark klik-select--sm">
                  <option value="mahasiswa" ${rosterModalState.role === 'mahasiswa' ? 'selected' : ''
      }>Mahasiswa</option>
                  <option value="admin" ${rosterModalState.role === 'admin' ? 'selected' : ''
      }>Komting (Admin)</option>
                </select>
              </div>
              <div class="klik-col-2">
                <button type="submit" id="klik-roster-add-submit" class="klik-btn klik-btn--primary klik-btn--sm" style="width:100%;">
                  Tambah
                </button>
              </div>
            </div>
          </form>

          <div class="klik-stack-xs">
            <div class="klik-search-wrap klik-search-wrap--full">
              <span class="klik-search-icon">${icon('search', 14)}</span>
              <input
                type="text"
                id="klik-roster-search"
                value="${escapeHtml(rosterModalState.searchQuery)}"
                placeholder="Cari berdasarkan NIM atau nama mahasiswa..."
                class="klik-input klik-input--sm klik-search-input"
              />
            </div>

            <div id="klik-roster-list-wrap" class="klik-roster-scroll"></div>
          </div>
        </div>
      `,
    onMount: (root) => {
      if (!isVerifiedAdmin) return;
      renderRosterBannerAndError(root);
      renderRosterListSection(root);

      root
        .querySelector('#klik-roster-copy-code')
        ?.addEventListener('click', () => {
          void copyRosterText(getWorkspaceViewState().classInfo.code, 'classCode');
        });

      const addForm = root.querySelector('#klik-roster-add-form');
      const nimInput = addForm?.elements.nim;
      const nameInput = addForm?.elements.name;
      const roleSelect = addForm?.elements.role;
      const addSubmit = root.querySelector('#klik-roster-add-submit');

      nimInput?.addEventListener('input', (e) => {
        rosterModalState.nim = e.target.value;
        if (rosterModalState.error) {
          rosterModalState.error = null;
          renderRosterBannerAndError(root);
        }
      });
      nameInput?.addEventListener('input', (e) => {
        rosterModalState.name = e.target.value;
        if (rosterModalState.error) {
          rosterModalState.error = null;
          renderRosterBannerAndError(root);
        }
      });
      roleSelect?.addEventListener('change', (e) => {
        rosterModalState.role = e.target.value;
      });

      addForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (rosterModalState.submitting) return;
        rosterModalState.error = null;

        const cleanNim = rosterModalState.nim.trim();
        const cleanName = rosterModalState.name.trim();
        if (!/^[A-Za-z0-9_-]{3,32}$/.test(cleanNim)) {
          rosterModalState.error =
            'NIM harus terdiri dari 3–32 karakter (huruf, angka, tanda hubung -, atau _).';
          renderRosterBannerAndError(root);
          return;
        }
        if (!cleanName) {
          rosterModalState.error = 'Nama lengkap mahasiswa wajib diisi.';
          renderRosterBannerAndError(root);
          return;
        }

        rosterModalState.submitting = true;
        if (addSubmit) {
          addSubmit.disabled = true;
          addSubmit.textContent = '...';
        }
        try {
          const res = await provisionRosterStudent({
            nim: cleanNim,
            name: cleanName,
            role: rosterModalState.role,
            title: rosterModalState.role === 'admin' ? 'Komting' : 'Mahasiswa',
          });
          if (!res.ok) {
            rosterModalState.error =
              res.error ?? 'Gagal menambahkan mahasiswa ke daftar kelas.';
            renderRosterBannerAndError(root);
            return;
          }
          if (res.activationCode && res.nim && res.name) {
            rosterModalState.issuedBanner = {
              nim: res.nim,
              name: res.name,
              activationCode: res.activationCode,
            };
          }
          rosterModalState.nim = '';
          rosterModalState.name = '';
          rosterModalState.role = 'mahasiswa';
          if (nimInput) nimInput.value = '';
          if (nameInput) nameInput.value = '';
          if (roleSelect) roleSelect.value = 'mahasiswa';
          if (isModalOpen('roster-provisioning')) {
            renderRosterBannerAndError(root);
            renderRosterListSection(root);
          }
        } finally {
          rosterModalState.submitting = false;
          if (addSubmit) {
            addSubmit.disabled = false;
            addSubmit.textContent = 'Tambah';
          }
        }
      });

      root
        .querySelector('#klik-roster-search')
        ?.addEventListener('input', (e) => {
          rosterModalState.searchQuery = e.target.value;
          renderRosterListSection(root);
        });
    },
  });
}

export function refreshRosterModalIfOpen() {
  if (!isModalOpen('roster-provisioning')) return;
  const root = getModalRoot();
  if (!root) return;
  renderRosterBannerAndError(root);
  renderRosterListSection(root);
}

// ------------------------------------------------------------------
// Shared Modal 4: Dev / Role Testing Modal (Ctrl+Shift+D / Alt+Shift+D)
// ------------------------------------------------------------------

const devModalState = {
  busyId: null,
  seeding: false,
  error: null,
};

function renderDevModalContent(root) {
  const body = root.querySelector('[data-modal-body]');
  if (!body) return;

  const authed = isAuthenticated();
  if (!authed) {
    body.innerHTML = `
      <div class="klik-stack-xs" style="font-size:12px;color:var(--text-muted);">
        <p>
          Masuk terlebih dahulu dengan NIM dan password akun kelas untuk mengakses pratinjau role serta manajemen anggota kelas.
        </p>
        <p style="font-size:11px;color:var(--text-dim);">
          Shortcut: Ctrl+Shift+D / Alt+Shift+D
        </p>
      </div>
    `;
    return;
  }

  const viewState = getWorkspaceViewState();
  const currentUser = getCurrentUser();
  const verifiedRole = getVerifiedRole();
  const effectiveRole = getEffectiveRole();
  const isVerifiedAdmin = verifiedRole === 'admin';

  body.innerHTML = `
    <div class="klik-stack-sm">
      <div>
        <p style="margin-bottom:8px;font-size:12px;font-weight:500;color:var(--text-secondary);">
          Pratinjau Tampilan Antarmuka
        </p>
        ${isVerifiedAdmin
      ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;border-radius:6px;border:1px solid var(--border-default);background:var(--bg-input);padding:4px;">
            <button type="button" data-dev-role="admin" class="klik-segmented-btn" style="width:100%;text-align:center;${viewState.activeRoleOverride === null
        ? 'background:rgba(16,185,129,0.2);color:var(--emerald-soft);'
        : ''
      }">Komting (Asli)</button>
            <button type="button" data-dev-role="mahasiswa" class="klik-segmented-btn" style="width:100%;text-align:center;${viewState.activeRoleOverride === 'mahasiswa'
        ? 'background:var(--bg-tab-active);color:var(--text-primary);'
        : ''
      }">Pratinjau Mahasiswa</button>
          </div>
          <p style="margin-top:6px;font-size:11px;line-height:1.5;color:var(--text-muted);">
            Mode UI aktif: <span style="font-weight:500;color:var(--text-primary);">${effectiveRole === 'admin' ? 'Komting' : 'Mahasiswa'
      }</span>. Hak akses tulis tetap divalidasi oleh Firestore Security Rules.
          </p>
        `
      : `
          <div class="klik-subpanel" style="font-size:12px;color:var(--text-muted);">
            Akun Anda terdaftar sebagai <span style="font-weight:500;color:var(--text-primary);">Mahasiswa</span>. Pratinjau dan pengelolaan role hanya tersedia untuk Komting/Admin terverifikasi.
          </div>
        `
    }
      </div>

      ${isVerifiedAdmin
      ? `
        <div>
          <p style="margin-bottom:8px;font-size:12px;font-weight:500;color:var(--text-secondary);">
            Anggota Kelas (${escapeHtml(
        viewState.classInfo.code || viewState.classInfo.name
      )})
          </p>
          <div class="klik-dev-scroll klik-divide-list">
            ${viewState.memberships
        .map((mem) => {
          const u = viewState.users.find((x) => x.id === mem.userId);
          const isSelf = mem.userId === currentUser.id;
          const isBusy = devModalState.busyId === mem.userId;
          return `
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;font-size:12px;">
                    <div style="min-width:0;">
                      <p class="truncate" style="font-weight:500;color:var(--text-primary);">
                        ${escapeHtml(u?.name ?? 'Anggota')}
                        ${isSelf
              ? `<span style="font-size:11px;color:var(--emerald-text);">(Anda)</span>`
              : ''
            }
                      </p>
                      <p class="mono" style="font-size:11px;color:var(--text-muted);">${escapeHtml(
              u?.nim ?? mem.userId
            )}</p>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                      <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--text-muted);">
                        ${mem.role === 'admin'
              ? icon('shield', 12, 'text-emerald')
              : icon('user', 12)
            }
                        <span>${escapeHtml(mem.title)}</span>
                      </span>
                      ${!isSelf
              ? `<button type="button" class="klik-btn klik-btn--ghost-border klik-btn--xs" data-dev-toggle-mem="${escapeHtml(
                mem.userId
              )}" data-dev-cur-role="${escapeHtml(mem.role)}" ${isBusy ? 'disabled' : ''
              }>${isBusy
                ? '...'
                : mem.role === 'admin'
                  ? 'Jadikan Mahasiswa'
                  : 'Jadikan Komting'
              }</button>`
              : ''
            }
                    </div>
                  </div>
                `;
        })
        .join('')}
          </div>
        </div>
      `
      : ''
    }

      ${devModalState.error
      ? `<p role="alert" style="font-size:12px;color:var(--rose-text);">${escapeHtml(
        devModalState.error
      )}</p>`
      : ''
    }

      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;">
        <span style="font-size:11px;color:var(--text-dim);">Shortcut: Ctrl+Shift+D / Alt+Shift+D</span>
        ${isVerifiedAdmin && viewState.courses.length === 0
      ? `<button type="button" id="klik-dev-seed" class="klik-btn klik-btn--emerald-outline klik-btn--sm" ${devModalState.seeding ? 'disabled' : ''
      }>
                ${icon('database', 14)}
                <span>${devModalState.seeding ? 'Mengisi...' : 'Isi Contoh Data Kelas'
      }</span>
              </button>`
      : ''
    }
      </div>
    </div>
  `;

  body.querySelectorAll('[data-dev-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = btn.getAttribute('data-dev-role');
      setRoleOverride(r === 'mahasiswa' ? 'mahasiswa' : null);
      renderDevModalContent(root);
    });
  });

  body.querySelectorAll('[data-dev-toggle-mem]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uid = btn.getAttribute('data-dev-toggle-mem');
      const curRole = btn.getAttribute('data-dev-cur-role');
      if (!uid) return;
      devModalState.error = null;
      devModalState.busyId = uid;
      renderDevModalContent(root);
      try {
        const nextRole = curRole === 'admin' ? 'mahasiswa' : 'admin';
        const nextTitle = nextRole === 'admin' ? 'Komting' : 'Mahasiswa';
        await updateMemberRole(uid, nextRole, nextTitle);
      } catch (err) {
        devModalState.error =
          err instanceof Error
            ? err.message
            : 'Gagal mengubah role anggota di Firestore.';
      } finally {
        devModalState.busyId = null;
        if (isModalOpen('dev-testing')) {
          renderDevModalContent(root);
        }
      }
    });
  });

  body.querySelector('#klik-dev-seed')?.addEventListener('click', async () => {
    devModalState.error = null;
    devModalState.seeding = true;
    renderDevModalContent(root);
    try {
      await seedCurrentClassSampleData();
      closeModal();
    } catch (err) {
      devModalState.error =
        err instanceof Error ? err.message : 'Gagal mengisi contoh data kelas.';
      if (isModalOpen('dev-testing')) {
        renderDevModalContent(root);
      }
    } finally {
      devModalState.seeding = false;
    }
  });
}

export function openDevTestingModal() {
  devModalState.error = null;
  openModal({
    id: 'dev-testing',
    title: 'Utilitas Role & Testing Kelas',
    subtitle:
      'Pengaturan pratinjau antarmuka dan peran anggota yang divalidasi oleh Firestore Security Rules.',
    size: 'md',
    bodyHtml: '',
    onMount: (root) => {
      renderDevModalContent(root);
    },
  });
}

export function refreshDevModalIfOpen() {
  if (!isModalOpen('dev-testing')) return;
  const root = getModalRoot();
  if (root) {
    renderDevModalContent(root);
  }
}

export function openAvatarGalleryModal() {
  const avatars = [
    { id: 'avatar-1', emoji: '🦊', name: 'Rubah' },
    { id: 'avatar-2', emoji: '🐼', name: 'Panda' },
    { id: 'avatar-3', emoji: '🐱', name: 'Kucing' },
    { id: 'avatar-4', emoji: '🐰', name: 'Kelinci' },
    { id: 'avatar-5', emoji: '🐻', name: 'Beruang' },
    { id: 'avatar-6', emoji: '🐸', name: 'Katak' },
    { id: 'avatar-7', emoji: '🐧', name: 'Penguin' },
    { id: 'avatar-8', emoji: '🦄', name: 'Unicorn' },
  ];

  let selectedAvatar = null;

  openModal({
    id: 'avatar-gallery',
    title: 'Pilih Avatar',
    subtitle: 'Pilih avatar untuk profil KLIK kamu.',
    size: 'md',
    bodyHtml: `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
        ${avatars.map((avatar) => `
  <button type="button"
    data-avatar-choice="${avatar.id}"
    style="padding:16px;border:2px solid var(--border-color);border-radius:12px;background:var(--surface);cursor:pointer;">
    <div style="font-size:32px;">${avatar.emoji}</div>
    <div style="font-size:12px;margin-top:6px;">${avatar.name}</div>
  </button>
`).join('')}
      </div>

      <div style="margin-top:16px;text-align:center;">
        <p data-avatar-selected-label>Belum ada avatar dipilih</p>
      </div>
    `,
    footerHtml: `
      <button type="button" class="klik-btn klik-btn--primary" disabled data-avatar-save>
        Simpan Avatar
      </button>
    `,
    onMount(root) {
      const choices = root.querySelectorAll('[data-avatar-choice]');
      const saveBtn = root.querySelector('[data-avatar-save]');
      const label = root.querySelector('[data-avatar-selected-label]');

      choices.forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedAvatar = btn.dataset.avatarChoice;

          choices.forEach((choice) => {
            choice.style.borderColor = 'var(--border-color)';
          });

          btn.style.borderColor = 'var(--primary)';
          label.textContent = `Avatar dipilih: ${selectedAvatar}`;
          saveBtn.disabled = false;
        });
      });

      saveBtn.addEventListener('click', async () => {
        if (!selectedAvatar) return;

        const user = getCurrentUser();

        if (!user?.id) {
          label.textContent = 'Pengguna tidak ditemukan.';
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Menyimpan...';

        try {
          await saveUserAvatar(user.id, selectedAvatar);
          label.textContent = 'Avatar berhasil disimpan!';
          saveBtn.textContent = 'Tersimpan';

          setTimeout(() => closeModal(), 800);
        } catch (error) {
          console.error('Gagal menyimpan avatar:', error);
          label.textContent = 'Gagal menyimpan avatar.';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Simpan Avatar';
        }
      });
    },
  });
}