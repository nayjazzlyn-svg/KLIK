import { icon } from './icons.js';
import {
  closeModal,
  isModalOpen,
  openConfirmDialog,
  openModal,
} from './modal.js';
import {
  clearNavTarget,
  createAnnouncement,
  deleteAnnouncement,
  getCourseById,
  getEffectiveRole,
  getStoreState,
  getWorkspaceViewState,
  updateAnnouncement,
} from './state.js';
import { escapeHtml, formatAnnouncementDate } from './utils.js';

const annUi = {
  courseFilter: 'all',
  searchQuery: '',
  detailAnnId: null,
};

function openAnnouncementFormModal(editingAnn = null) {
  const viewState = getWorkspaceViewState();

  openModal({
    id: 'announcement-form',
    title: editingAnn ? 'Edit Pengumuman' : 'Buat Pengumuman Baru',
    subtitle: editingAnn
      ? 'Perbarui isi pengumuman untuk seluruh anggota kelas.'
      : 'Pengumuman baru otomatis muncul di daftar dan mengirim notifikasi kelas.',
    size: 'lg',
    bodyHtml: `
      <form id="klik-ann-form" class="klik-stack-sm">
        <div>
          <label class="klik-label">Judul Pengumuman</label>
          <input
            type="text"
            name="title"
            value="${escapeHtml(editingAnn?.title ?? '')}"
            placeholder="Misal: Jadwal Pengumpulan Laporan Akhir"
            class="klik-input"
          />
        </div>

        <div>
          <label class="klik-label">Mata Kuliah (Opsional)</label>
          <select name="courseId" class="klik-select">
            <option value="" ${
              !editingAnn?.courseId ? 'selected' : ''
            }>Umum (Seluruh Kelas)</option>
            ${viewState.courses
              .map(
                (c) =>
                  `<option value="${escapeHtml(c.id)}" ${
                    editingAnn?.courseId === c.id ? 'selected' : ''
                  }>${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`
              )
              .join('')}
          </select>
        </div>

        <div>
          <label class="klik-label">Isi Pengumuman</label>
          <textarea
            name="content"
            rows="6"
            placeholder="Tulis informasi yang jelas dan ringkas untuk mahasiswa..."
            class="klik-textarea"
          >${escapeHtml(editingAnn?.content ?? '')}</textarea>
        </div>

        <p id="klik-ann-err" class="hidden text-rose" style="font-size:12px;"></p>

        <div class="klik-modal-footer" style="margin:0 -20px -16px;padding:14px 20px;">
          <button type="button" class="klik-btn klik-btn--ghost-border" data-ann-cancel>Batal</button>
          <button type="submit" class="klik-btn klik-btn--primary">
            ${editingAnn ? 'Simpan Perubahan' : 'Terbitkan'}
          </button>
        </div>
      </form>
    `,
    onMount: (root) => {
      root
        .querySelector('[data-ann-cancel]')
        ?.addEventListener('click', () => closeModal());

      root
        .querySelector('#klik-ann-form')
        ?.addEventListener('submit', (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const errEl = root.querySelector('#klik-ann-err');
          const title = form.elements.title.value;
          const courseId = form.elements.courseId.value;
          const content = form.elements.content.value;

          const showErr = (msg) => {
            if (!errEl) return;
            errEl.className = 'text-rose';
            errEl.textContent = msg;
          };

          if (!title.trim()) {
            showErr('Judul pengumuman wajib diisi.');
            return;
          }
          if (!content.trim()) {
            showErr('Isi pengumuman wajib diisi.');
            return;
          }

          const payload = {
            title,
            content,
            courseId: courseId || null,
          };

          if (editingAnn) {
            updateAnnouncement(editingAnn.id, payload);
          } else {
            createAnnouncement(payload);
          }
          closeModal();
        });
    },
  });
}

function openAnnouncementDetailModal(ann) {
  const viewState = getWorkspaceViewState();
  const isAdmin = getEffectiveRole() === 'admin';
  const course = ann.courseId ? getCourseById(ann.courseId) : undefined;
  const author = viewState.users.find((u) => u.id === ann.authorId);
  annUi.detailAnnId = ann.id;

  openModal({
    id: 'announcement-detail',
    title: ann.title,
    subtitle: `${course ? course.name : 'Umum'} · ${formatAnnouncementDate(
      ann.publishedAt
    )}${author ? ` · oleh ${author.name}` : ''}`,
    size: 'xl',
    bodyHtml: `
      <div class="whitespace-pre-line" style="font-size:14px;line-height:1.65;color:var(--text-body);">
        ${escapeHtml(ann.content)}
      </div>
    `,
    footerHtml: isAdmin
      ? `
      <div style="display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;">
        <button type="button" id="klik-ad-delete" class="klik-btn klik-btn--danger-ghost">
          ${icon('trash2', 14)}
          <span>Hapus</span>
        </button>
        <button type="button" id="klik-ad-edit" class="klik-btn klik-btn--primary">
          ${icon('pencil', 14)}
          <span>Edit Pengumuman</span>
        </button>
      </div>
    `
      : '',
    onMount: (root) => {
      root.querySelector('#klik-ad-delete')?.addEventListener('click', () => {
        closeModal();
        openConfirmDialog({
          title: 'Hapus Pengumuman',
          description:
            'Pengumuman ini akan dihapus secara permanen dari pusat informasi kelas. Lanjutkan?',
          confirmLabel: 'Hapus Pengumuman',
          onConfirm: () => deleteAnnouncement(ann.id),
        });
      });

      root.querySelector('#klik-ad-edit')?.addEventListener('click', () => {
        openAnnouncementFormModal(ann);
      });
    },
    onClose: () => {
      annUi.detailAnnId = null;
    },
  });
}

function renderAnnouncementsListHost(listHost) {
  if (!listHost) return;

  const viewState = getWorkspaceViewState();
  const isAdmin = getEffectiveRole() === 'admin';
  const q = annUi.searchQuery.trim().toLowerCase();

  const sortedAnnouncements = [...viewState.announcements]
    .filter((a) => {
      if (annUi.courseFilter === 'general' && a.courseId !== null) {
        return false;
      }
      if (
        annUi.courseFilter !== 'all' &&
        annUi.courseFilter !== 'general' &&
        a.courseId !== annUi.courseFilter
      ) {
        return false;
      }
      if (q) {
        const course = a.courseId ? getCourseById(a.courseId) : undefined;
        const hay = `${a.title} ${a.content} ${
          course?.name ?? 'umum'
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

  if (sortedAnnouncements.length === 0) {
    listHost.innerHTML = `
      <div class="klik-empty">
        <div class="klik-empty-icon">${icon('megaphone', 18)}</div>
        <h3>Belum ada pengumuman</h3>
        <p>${
          annUi.searchQuery || annUi.courseFilter !== 'all'
            ? 'Tidak ada pengumuman yang sesuai dengan filter saat ini.'
            : 'Informasi penting dan pembaruan kelas dari Komting akan tampil di sini.'
        }</p>
        ${
          isAdmin
            ? `<div style="margin-top:16px;"><button type="button" id="klik-ann-empty-create" class="klik-btn klik-btn--primary">+ Buat Pengumuman</button></div>`
            : ''
        }
      </div>
    `;
    listHost
      .querySelector('#klik-ann-empty-create')
      ?.addEventListener('click', () => openAnnouncementFormModal(null));
    return;
  }

  listHost.innerHTML = `
    <div class="klik-card">
      <div class="klik-divide-list">
        ${sortedAnnouncements
          .map((ann) => {
            const course = ann.courseId
              ? getCourseById(ann.courseId)
              : undefined;
            const author = viewState.users.find((u) => u.id === ann.authorId);

            return `
              <article
                class="klik-ann-row"
                role="button"
                tabindex="0"
                data-ann-open="${escapeHtml(ann.id)}"
              >
                <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;font-size:12px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="text-emerald" style="font-weight:500;">${escapeHtml(
                      course ? course.name : 'Umum'
                    )}</span>
                    ${
                      author
                        ? `<span style="color:var(--text-sep);" aria-hidden="true">·</span>
                           <span class="text-muted">${escapeHtml(
                             author.name
                           )}</span>`
                        : ''
                    }
                  </div>
                  <time class="mono tabular-nums text-dim" style="font-size:11px;">
                    ${escapeHtml(formatAnnouncementDate(ann.publishedAt))}
                  </time>
                </div>

                <h2 class="klik-ann-title" style="margin-top:6px;font-size:16px;font-weight:600;color:var(--text-primary);transition:color 0.15s;">
                  ${escapeHtml(ann.title)}
                </h2>

                <p class="line-clamp-2 text-muted" style="margin-top:6px;font-size:14px;line-height:1.6;">
                  ${escapeHtml(ann.content)}
                </p>
              </article>
            `;
          })
          .join('')}
      </div>
    </div>
  `;

  listHost.querySelectorAll('[data-ann-open]').forEach((card) => {
    const openDetail = () => {
      const id = card.getAttribute('data-ann-open');
      const ann = viewState.announcements.find((a) => a.id === id);
      if (ann) openAnnouncementDetailModal(ann);
    };
    card.addEventListener('click', openDetail);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail();
      }
    });
  });
}

export function renderAnnouncementsView(container) {
  if (!container) return;

  const store = getStoreState();
  const viewState = getWorkspaceViewState();
  const isAdmin = getEffectiveRole() === 'admin';

  if (store.navTarget.announcementId) {
    const target = viewState.announcements.find(
      (a) => a.id === store.navTarget.announcementId
    );
    clearNavTarget();
    if (target) {
      window.setTimeout(() => openAnnouncementDetailModal(target), 0);
    }
  }

  if (isModalOpen('announcement-detail') && annUi.detailAnnId) {
    const exists = viewState.announcements.some(
      (a) => a.id === annUi.detailAnnId
    );
    if (!exists) {
      closeModal();
    }
  }

  container.innerHTML = `
    <div class="klik-stack-md">
      <div class="klik-toolbar">
        <div class="klik-toolbar-group" style="flex:1;">
          <div class="klik-search-wrap">
            <span class="klik-search-icon">${icon('search', 14)}</span>
            <input
              type="text"
              id="klik-ann-search"
              value="${escapeHtml(annUi.searchQuery)}"
              placeholder="Cari pengumuman..."
              class="klik-input klik-input--surface klik-search-input"
            />
          </div>

          <select id="klik-ann-filter" aria-label="Filter kategori pengumuman" class="klik-select klik-input--surface klik-select--sm" style="width:auto;">
            <option value="all" ${
              annUi.courseFilter === 'all' ? 'selected' : ''
            }>Semua Kategori</option>
            <option value="general" ${
              annUi.courseFilter === 'general' ? 'selected' : ''
            }>Umum Kelas</option>
            ${viewState.courses
              .map(
                (c) =>
                  `<option value="${escapeHtml(c.id)}" ${
                    annUi.courseFilter === c.id ? 'selected' : ''
                  }>${escapeHtml(c.name)}</option>`
              )
              .join('')}
          </select>
        </div>

        ${
          isAdmin
            ? `
          <button type="button" id="klik-ann-create" class="klik-btn klik-btn--primary" style="align-self:flex-start;">
            ${icon('plus', 14)}
            <span>Buat Pengumuman</span>
          </button>
        `
            : ''
        }
      </div>

      <div id="klik-ann-list-host"></div>
    </div>
  `;

  const listHost = container.querySelector('#klik-ann-list-host');
  renderAnnouncementsListHost(listHost);

  container
    .querySelector('#klik-ann-search')
    ?.addEventListener('input', (e) => {
      annUi.searchQuery = e.target.value;
      renderAnnouncementsListHost(listHost);
    });

  container
    .querySelector('#klik-ann-filter')
    ?.addEventListener('change', (e) => {
      annUi.courseFilter = e.target.value;
      renderAnnouncementsListHost(listHost);
    });

  container
    .querySelector('#klik-ann-create')
    ?.addEventListener('click', () => openAnnouncementFormModal(null));
}
