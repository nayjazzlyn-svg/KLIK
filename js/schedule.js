import { icon } from './icons.js';
import {
  closeModal,
  isModalOpen,
  openConfirmDialog,
  openCourseCollectionModal,
  openModal,
} from './modal.js';
import {
  addSchedule,
  clearNavTarget,
  deleteSchedule,
  editScheduleWithScope,
  getCourseById,
  getEffectiveRole,
  getStoreState,
  getWorkspaceViewState,
  toggleCancelScheduleInstance,
} from './state.js';
import {
  INDONESIAN_DAYS,
  INDONESIAN_SHORT_DAYS,
  addDays,
  escapeHtml,
  formatIndonesianFullDate,
  formatIndonesianShortDate,
  getInstanceStatusesForDate,
  getIsoWeekday,
  getStartOfWeekMonday,
  getWeekDates,
  parseLocalDateKey,
  resolveSchedulesForDate,
  sanitizeExternalUrl,
  timeToMinutes,
  toLocalDateKey,
} from './utils.js';

const START_HOUR = 7;
const END_HOUR = 19;
const HOUR_HEIGHT = 56;

const scheduleUi = {
  selectedDateKey: null,
  weekStart: null,
  detailInstanceKey: null,
  detailInstanceDate: null,
};

function ensureInitialized(now) {
  if (!scheduleUi.selectedDateKey) {
    scheduleUi.selectedDateKey = toLocalDateKey(now);
  }
  if (!scheduleUi.weekStart) {
    scheduleUi.weekStart = getStartOfWeekMonday(now);
  }
}

function openAddScheduleModal(dayOfWeek, startHour) {
  const viewState = getWorkspaceViewState();
  const selectedObj = parseLocalDateKey(scheduleUi.selectedDateKey);
  const defaultDay = dayOfWeek ?? getIsoWeekday(selectedObj);
  const startH = startHour ?? 8;
  const endH = Math.min(21, startH + 2);

  openModal({
    id: 'schedule-add',
    title: 'Tambah Jadwal Rutin',
    subtitle:
      'Jadwal baru otomatis berulang setiap minggu pada hari yang dipilih.',
    size: 'lg',
    bodyHtml: `
      <form id="klik-add-sched-form" class="klik-stack-sm">
        <div>
          <label class="klik-label">Mata Kuliah</label>
          <select name="courseId" class="klik-select">
            ${
              viewState.courses.length === 0
                ? `<option value="">Belum ada mata kuliah</option>`
                : viewState.courses
                    .map(
                      (c) =>
                        `<option value="${escapeHtml(c.id)}">${escapeHtml(
                          c.name
                        )} (${escapeHtml(c.code)})</option>`
                    )
                    .join('')
            }
          </select>
        </div>

        <div class="klik-grid-form-3-resp">
          <div>
            <label class="klik-label">Hari</label>
            <select name="dayOfWeek" class="klik-select">
              ${INDONESIAN_DAYS.map(
                (day, idx) =>
                  `<option value="${idx + 1}" ${
                    idx + 1 === defaultDay ? 'selected' : ''
                  }>${escapeHtml(day)}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="klik-label">Jam Mulai</label>
            <input type="time" name="startTime" value="${String(startH).padStart(
              2,
              '0'
            )}:00" class="klik-input mono" />
          </div>
          <div>
            <label class="klik-label">Jam Selesai</label>
            <input type="time" name="endTime" value="${String(endH).padStart(
              2,
              '0'
            )}:00" class="klik-input mono" />
          </div>
        </div>

        <div>
          <label class="klik-label">Ruangan</label>
          <input type="text" name="room" placeholder="Misal: Gedung C · R.302" class="klik-input" />
        </div>

        <p id="klik-add-sched-err" class="hidden text-rose" style="font-size:12px;"></p>

        <div class="klik-modal-footer" style="margin:0 -20px -16px;padding:14px 20px;">
          <button type="button" class="klik-btn klik-btn--ghost-border" data-sched-cancel>Batal</button>
          <button type="submit" class="klik-btn klik-btn--primary">Simpan Jadwal</button>
        </div>
      </form>
    `,
    onMount: (root) => {
      root
        .querySelector('[data-sched-cancel]')
        ?.addEventListener('click', () => closeModal());
      root
        .querySelector('#klik-add-sched-form')
        ?.addEventListener('submit', (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const errEl = root.querySelector('#klik-add-sched-err');
          const courseId = form.elements.courseId.value;
          const day = Number(form.elements.dayOfWeek.value);
          const startTime = form.elements.startTime.value;
          const endTime = form.elements.endTime.value;
          const room = form.elements.room.value;

          const showErr = (msg) => {
            if (!errEl) return;
            errEl.className = 'text-rose';
            errEl.textContent = msg;
          };

          if (!courseId) {
            showErr('Pilih mata kuliah.');
            return;
          }
          if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
            showErr('Jam selesai harus lebih akhir dari jam mulai.');
            return;
          }
          if (!room.trim()) {
            showErr('Ruangan wajib diisi.');
            return;
          }

          addSchedule({
            courseId,
            dayOfWeek: day,
            startTime,
            endTime,
            room,
          });
          closeModal();
        });
    },
  });
}

function openEditScheduleModal(inst) {
  const viewState = getWorkspaceViewState();
  let editScope = 'this_only';

  const scopes = [
    {
      id: 'this_only',
      title: 'Pertemuan ini saja',
      desc: 'Membuat exception khusus tanggal ini tanpa mengubah minggu depan.',
    },
    {
      id: 'this_and_following',
      title: 'Pertemuan ini dan selanjutnya',
      desc: 'Memperbarui jadwal mulai tanggal ini ke minggu-minggu berikutnya.',
    },
    {
      id: 'all_recurring',
      title: 'Seluruh jadwal rutin',
      desc: 'Mengubah seluruh rangkaian jadwal rutin dari awal semester.',
    },
  ];

  openModal({
    id: 'schedule-edit',
    title: 'Edit Jadwal Kuliah',
    subtitle: `Tanggal pertemuan: ${formatIndonesianFullDate(
      parseLocalDateKey(inst.date)
    )}`,
    size: 'lg',
    bodyHtml: `
      <form id="klik-edit-sched-form" class="klik-stack-sm">
        <div>
          <label class="klik-label" style="margin-bottom:8px;">Terapkan perubahan untuk</label>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${scopes
              .map(
                (opt) => `
              <label class="klik-radio-card ${
                opt.id === editScope ? 'is-selected' : ''
              }" data-scope-card="${opt.id}">
                <input type="radio" name="scope" value="${opt.id}" ${
                  opt.id === editScope ? 'checked' : ''
                } style="margin-top:2px;accent-color:var(--emerald);" />
                <div>
                  <p style="font-size:12px;font-weight:500;color:var(--text-primary);">${escapeHtml(
                    opt.title
                  )}</p>
                  <p style="margin-top:2px;font-size:11px;color:var(--text-muted);">${escapeHtml(
                    opt.desc
                  )}</p>
                </div>
              </label>
            `
              )
              .join('')}
          </div>
        </div>

        <div>
          <label class="klik-label">Mata Kuliah</label>
          <select name="courseId" class="klik-select">
            ${viewState.courses
              .map(
                (c) =>
                  `<option value="${escapeHtml(c.id)}" ${
                    c.id === inst.courseId ? 'selected' : ''
                  }>${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="klik-grid-form-2">
          <div>
            <label class="klik-label">Jam Mulai</label>
            <input type="time" name="startTime" value="${escapeHtml(
              inst.startTime
            )}" class="klik-input mono" />
          </div>
          <div>
            <label class="klik-label">Jam Selesai</label>
            <input type="time" name="endTime" value="${escapeHtml(
              inst.endTime
            )}" class="klik-input mono" />
          </div>
        </div>

        <div>
          <label class="klik-label">Ruangan</label>
          <input type="text" name="room" value="${escapeHtml(
            inst.room
          )}" class="klik-input" />
        </div>

        <div id="klik-edit-reason-wrap">
          <label class="klik-label">Alasan Perubahan (Opsional)</label>
          <input type="text" name="reason" value="${escapeHtml(
            inst.exception?.reason ?? ''
          )}" placeholder="Misal: Pindah ruangan karena lab sedang digunakan" class="klik-input" />
        </div>

        <p id="klik-edit-sched-err" class="hidden text-rose" style="font-size:12px;"></p>

        <div class="klik-modal-footer" style="margin:0 -20px -16px;padding:14px 20px;">
          <button type="button" class="klik-btn klik-btn--ghost-border" data-edit-cancel>Batal</button>
          <button type="submit" class="klik-btn klik-btn--primary">Simpan Perubahan</button>
        </div>
      </form>
    `,
    onMount: (root) => {
      const form = root.querySelector('#klik-edit-sched-form');
      const reasonWrap = root.querySelector('#klik-edit-reason-wrap');
      const errEl = root.querySelector('#klik-edit-sched-err');

      form?.querySelectorAll('input[name="scope"]').forEach((radio) => {
        radio.addEventListener('change', (e) => {
          editScope = e.target.value;
          form.querySelectorAll('[data-scope-card]').forEach((card) => {
            card.classList.toggle(
              'is-selected',
              card.getAttribute('data-scope-card') === editScope
            );
          });
          if (reasonWrap) {
            reasonWrap.classList.toggle('hidden', editScope !== 'this_only');
          }
        });
      });

      root
        .querySelector('[data-edit-cancel]')
        ?.addEventListener('click', () => closeModal());

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const courseId = form.elements.courseId.value;
        const startTime = form.elements.startTime.value;
        const endTime = form.elements.endTime.value;
        const room = form.elements.room.value;
        const reason = form.elements.reason.value;

        const showErr = (msg) => {
          if (!errEl) return;
          errEl.className = 'text-rose';
          errEl.textContent = msg;
        };

        if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
          showErr('Jam selesai harus lebih akhir dari jam mulai.');
          return;
        }
        if (!room.trim()) {
          showErr('Ruangan wajib diisi.');
          return;
        }

        editScheduleWithScope({
          scheduleId: inst.scheduleId,
          instanceDate: inst.date,
          scope: editScope,
          courseId,
          startTime,
          endTime,
          room,
          reason,
        });
        closeModal();
      });
    },
  });
}

function openCancelSessionModal(inst) {
  openModal({
    id: 'schedule-cancel',
    title: 'Batalkan Pertemuan Ini',
    subtitle:
      'Jadwal tetap ditampilkan di kalender dengan status Dibatalkan agar anggota kelas mengetahui alasannya.',
    size: 'md',
    bodyHtml: `
      <form id="klik-cancel-sched-form" class="klik-stack-sm">
        <div>
          <label class="klik-label">Alasan Pembatalan</label>
          <textarea name="reason" rows="3" placeholder="Misal: Dosen berhalangan hadir, diganti tugas mandiri." class="klik-textarea"></textarea>
        </div>
        <div class="klik-modal-footer" style="margin:0 -20px -16px;padding:14px 20px;">
          <button type="button" class="klik-btn klik-btn--ghost-border" data-cancel-close>Batal</button>
          <button type="submit" class="klik-btn klik-btn--danger">Batalkan Pertemuan</button>
        </div>
      </form>
    `,
    onMount: (root) => {
      root
        .querySelector('[data-cancel-close]')
        ?.addEventListener('click', () => closeModal());
      root
        .querySelector('#klik-cancel-sched-form')
        ?.addEventListener('submit', (e) => {
          e.preventDefault();
          const reason = e.currentTarget.elements.reason.value;
          toggleCancelScheduleInstance(inst.scheduleId, inst.date, reason);
          closeModal();
        });
    },
  });
}

function openScheduleDetailModal(inst) {
  const isAdmin = getEffectiveRole() === 'admin';
  const course = getCourseById(inst.courseId);
  scheduleUi.detailInstanceKey = inst.instanceKey;
  scheduleUi.detailInstanceDate = inst.date;

  const colUrl = course?.collection
    ? sanitizeExternalUrl(course.collection.url)
    : '#';

  openModal({
    id: 'schedule-detail',
    title: course?.name ?? 'Detail Jadwal',
    subtitle: `${formatIndonesianFullDate(parseLocalDateKey(inst.date))} · ${
      course?.code ?? ''
    }`,
    size: 'lg',
    bodyHtml: `
      <div class="klik-stack-sm">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;">
          ${
            inst.isCancelled
              ? `<span class="klik-tag klik-tag--rose">Dibatalkan</span>`
              : inst.isModified
              ? `<span class="klik-tag klik-tag--amber">Berubah (Khusus Tanggal Ini)</span>`
              : `<span class="klik-tag klik-tag--neutral">Jadwal Rutin</span>`
          }
          <span class="text-muted">${escapeHtml(course?.credits ?? '')} SKS · ${escapeHtml(
      course?.lecturer ?? ''
    )}</span>
        </div>

        <div class="klik-subpanel klik-grid-form-2-resp">
          <div style="display:flex;align-items:center;gap:10px;font-size:12px;">
            <span class="text-dim">${icon('clock', 16)}</span>
            <div>
              <p class="text-muted">Waktu</p>
              <p class="mono tabular-nums" style="margin-top:2px;font-size:14px;color:var(--text-primary);">
                ${escapeHtml(inst.startTime)} – ${escapeHtml(inst.endTime)} WIB
              </p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:12px;">
            <span class="text-dim">${icon('mapPin', 16)}</span>
            <div>
              <p class="text-muted">Ruangan</p>
              <p style="margin-top:2px;font-size:14px;color:var(--text-primary);">${escapeHtml(
                inst.room
              )}</p>
            </div>
          </div>
        </div>

        ${
          inst.exception?.reason
            ? `
          <div class="klik-subpanel" style="font-size:12px;color:var(--text-secondary);">
            <p class="text-muted" style="font-weight:500;margin-bottom:4px;">Catatan Perubahan:</p>
            <p>${escapeHtml(inst.exception.reason)}</p>
          </div>
        `
            : ''
        }

        <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;">
          <p class="text-muted" style="font-size:12px;font-weight:500;margin-bottom:6px;">
            Link Pengumpulan Mata Kuliah
          </p>
          ${
            course?.collection
              ? `
            <a href="${escapeHtml(
              colUrl
            )}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--emerald-text);">
              ${icon('link2', 14)}
              <span>${escapeHtml(course.collection.label)}</span>
              ${icon('externalLink', 12)}
            </a>
          `
              : `<p style="font-size:12px;color:var(--text-dim);">Belum ada destinasi pengumpulan yang ditetapkan.</p>`
          }
        </div>
      </div>
    `,
    footerHtml: isAdmin
      ? `
      <div style="display:flex;width:100%;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">
        <button type="button" id="klik-sd-delete" class="klik-btn klik-btn--danger-ghost">
          ${icon('trash2', 14)}
          <span>Hapus Rutin</span>
        </button>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
          ${
            inst.isCancelled
              ? `<button type="button" id="klik-sd-restore" class="klik-btn klik-btn--ghost-border" style="color:var(--emerald-soft);">
                  ${icon('rotateCcw', 14)}
                  <span>Pulihkan Pertemuan</span>
                </button>`
              : `<button type="button" id="klik-sd-cancel" class="klik-btn klik-btn--danger-outline">
                  ${icon('ban', 14)}
                  <span>Batalkan Sesi Ini</span>
                </button>`
          }
          <button type="button" id="klik-sd-edit" class="klik-btn klik-btn--primary">
            ${icon('pencil', 14)}
            <span>Edit Jadwal</span>
          </button>
        </div>
      </div>
    `
      : '',
    onMount: (root) => {
      root.querySelector('#klik-sd-delete')?.addEventListener('click', () => {
        closeModal();
        openConfirmDialog({
          title: 'Hapus Jadwal Rutin',
          description:
            'Seluruh rangkaian jadwal rutin ini beserta catatan perubahannya akan dihapus dari kalender kelas. Lanjutkan?',
          confirmLabel: 'Hapus Jadwal',
          onConfirm: () => deleteSchedule(inst.scheduleId),
        });
      });

      root.querySelector('#klik-sd-restore')?.addEventListener('click', () => {
        toggleCancelScheduleInstance(inst.scheduleId, inst.date);
      });

      root.querySelector('#klik-sd-cancel')?.addEventListener('click', () => {
        openCancelSessionModal(inst);
      });

      root.querySelector('#klik-sd-edit')?.addEventListener('click', () => {
        openEditScheduleModal(inst);
      });
    },
    onClose: () => {
      scheduleUi.detailInstanceKey = null;
      scheduleUi.detailInstanceDate = null;
    },
  });
}

export function renderScheduleView(container) {
  if (!container) return;

  const store = getStoreState();
  const viewState = getWorkspaceViewState();
  const now = store.now;
  const isAdmin = getEffectiveRole() === 'admin';
  const todayKey = toLocalDateKey(now);

  ensureInitialized(now);

  // Handle deep navigation from Dashboard
  if (store.navTarget.scheduleDate) {
    const targetDate = parseLocalDateKey(store.navTarget.scheduleDate);
    scheduleUi.selectedDateKey = store.navTarget.scheduleDate;
    scheduleUi.weekStart = getStartOfWeekMonday(targetDate);
    clearNavTarget();
  }

  // If detail modal is currently open, keep its contents fresh from live Firestore data
  if (
    isModalOpen('schedule-detail') &&
    scheduleUi.detailInstanceKey &&
    scheduleUi.detailInstanceDate
  ) {
    const refreshed = resolveSchedulesForDate(
      parseLocalDateKey(scheduleUi.detailInstanceDate),
      viewState.schedules,
      viewState.scheduleExceptions
    );
    const match = refreshed.find(
      (r) => r.instanceKey === scheduleUi.detailInstanceKey
    );
    if (match) {
      openScheduleDetailModal(match);
    } else {
      closeModal();
    }
  }

  const weekDates = getWeekDates(scheduleUi.weekStart);
  const firstDay = weekDates[0];
  const lastDay = weekDates[6];
  const weekRangeLabel = `${formatIndonesianShortDate(
    firstDay
  )} – ${formatIndonesianShortDate(lastDay)} ${lastDay.getFullYear()}`;

  const weekInstancesByDate = new Map();
  weekDates.forEach((d) => {
    const key = toLocalDateKey(d);
    weekInstancesByDate.set(
      key,
      resolveSchedulesForDate(
        d,
        viewState.schedules,
        viewState.scheduleExceptions
      )
    );
  });

  const selectedDateObj = parseLocalDateKey(scheduleUi.selectedDateKey);
  const selectedDayInstances = resolveSchedulesForDate(
    selectedDateObj,
    viewState.schedules,
    viewState.scheduleExceptions
  );
  const selectedDayStatuses = getInstanceStatusesForDate(
    selectedDayInstances,
    now
  );

  const hoursList = Array.from(
    { length: END_HOUR - START_HOUR + 1 },
    (_, i) => START_HOUR + i
  );
  const totalGridHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  // Preserve vertical scroll inside time-grid across updates
  const prevGridScroll =
    container.querySelector('.klik-schedule-grid-body')?.scrollTop ?? 0;

  container.innerHTML = `
    <div class="klik-stack-md">
      <!-- Toolbar -->
      <div class="klik-toolbar">
        <div class="klik-toolbar-group">
          <div class="klik-week-nav">
            <button type="button" id="klik-sched-prev-week" class="klik-icon-btn" aria-label="Minggu sebelumnya">
              ${icon('chevronLeft', 16)}
            </button>
            <button type="button" id="klik-sched-today" class="klik-segmented-btn" style="padding:4px 10px;color:var(--text-body);">
              Hari Ini
            </button>
            <button type="button" id="klik-sched-next-week" class="klik-icon-btn" aria-label="Minggu berikutnya">
              ${icon('chevronRight', 16)}
            </button>
          </div>
          <span class="tabular-nums" style="font-size:14px;font-weight:500;color:var(--text-secondary);padding:0 4px;">
            ${escapeHtml(weekRangeLabel)}
          </span>
        </div>

        ${
          isAdmin
            ? `
          <div class="klik-toolbar-group">
            <button type="button" id="klik-sched-collections" class="klik-btn klik-btn--secondary">
              ${icon('link2', 14, 'text-muted')}
              <span>Link Pengumpulan</span>
            </button>
            <button type="button" id="klik-sched-add" class="klik-btn klik-btn--primary">
              ${icon('plus', 14)}
              <span>Tambah Jadwal</span>
            </button>
          </div>
        `
            : ''
        }
      </div>

      <!-- Main Split -->
      <div class="klik-schedule-split">
        <!-- Desktop Weekly Time-Grid -->
        <div class="klik-schedule-desktop">
          <div class="klik-schedule-grid-head">
            <div class="klik-schedule-gutter-head">WIB</div>
            ${weekDates
              .map((d, idx) => {
                const dateKey = toLocalDateKey(d);
                const isToday = dateKey === todayKey;
                const isSelected = dateKey === scheduleUi.selectedDateKey;
                return `
                  <button
                    type="button"
                    data-sched-select-day="${escapeHtml(dateKey)}"
                    class="klik-schedule-day-btn ${
                      isSelected ? 'is-selected' : ''
                    }"
                  >
                    <p style="font-size:11px;font-weight:500;color:var(--text-muted);">${escapeHtml(
                      INDONESIAN_SHORT_DAYS[idx]
                    )}</p>
                    <p class="klik-day-num ${isToday ? 'is-today' : ''} ${
                  !isToday && isSelected ? 'is-selected' : ''
                }">${d.getDate()}</p>
                  </button>
                `;
              })
              .join('')}
          </div>

          <div class="klik-schedule-grid-body">
            <div class="klik-schedule-time-gutter" style="height:${totalGridHeight}px;">
              ${hoursList
                .slice(0, -1)
                .map(
                  (hour) => `
                  <div class="klik-schedule-hour-label" style="height:${HOUR_HEIGHT}px;">
                    ${String(hour).padStart(2, '0')}:00
                  </div>
                `
                )
                .join('')}
            </div>

            ${weekDates
              .map((d, dayIdx) => {
                const dateKey = toLocalDateKey(d);
                const dayInstances = weekInstancesByDate.get(dateKey) ?? [];
                const dayStatuses = getInstanceStatusesForDate(
                  dayInstances,
                  now
                );
                const isSelected = dateKey === scheduleUi.selectedDateKey;

                return `
                  <div
                    class="klik-schedule-day-col ${
                      isSelected ? 'is-selected' : ''
                    }"
                    style="height:${totalGridHeight}px;"
                    data-sched-col-date="${escapeHtml(dateKey)}"
                  >
                    ${hoursList
                      .slice(0, -1)
                      .map(
                        (hour) => `
                        <div
                          class="klik-schedule-slot ${
                            isAdmin ? 'is-admin' : ''
                          }"
                          style="height:${HOUR_HEIGHT}px;"
                          data-sched-slot-date="${escapeHtml(dateKey)}"
                          data-sched-slot-day="${dayIdx + 1}"
                          data-sched-slot-hour="${hour}"
                          ${
                            isAdmin
                              ? `title="Klik untuk tambah jadwal ${escapeHtml(
                                  INDONESIAN_DAYS[dayIdx]
                                )} pukul ${String(hour).padStart(2, '0')}:00"`
                              : ''
                          }
                        ></div>
                      `
                      )
                      .join('')}

                    ${dayInstances
                      .map((inst) => {
                        const course = getCourseById(inst.courseId);
                        const status =
                          dayStatuses.get(inst.instanceKey) ?? 'Nanti';
                        const startMin = timeToMinutes(inst.startTime);
                        const endMin = timeToMinutes(inst.endTime);
                        const gridStartMin = START_HOUR * 60;
                        const topPx = Math.max(
                          0,
                          ((startMin - gridStartMin) / 60) * HOUR_HEIGHT
                        );
                        const heightPx = Math.max(
                          34,
                          ((endMin - startMin) / 60) * HOUR_HEIGHT - 2
                        );

                        const blockClass = inst.isCancelled
                          ? 'is-cancelled'
                          : status === 'Berlangsung'
                          ? 'is-ongoing'
                          : inst.isModified
                          ? 'is-modified'
                          : status === 'Selesai'
                          ? 'is-done'
                          : '';

                        return `
                          <button
                            type="button"
                            class="klik-schedule-block ${blockClass}"
                            style="top:${topPx + 1}px;height:${heightPx}px;"
                            data-sched-block="${escapeHtml(inst.instanceKey)}"
                            data-sched-block-date="${escapeHtml(dateKey)}"
                          >
                            <div style="min-width:0;width:100%;">
                              <span class="truncate" style="display:block;font-size:11px;font-weight:600;line-height:1.25;${
                                inst.isCancelled
                                  ? 'text-decoration:line-through;'
                                  : ''
                              }">
                                ${escapeHtml(course?.name ?? 'Mata Kuliah')}
                              </span>
                              <p class="truncate" style="margin-top:2px;font-size:10px;color:var(--text-muted);">
                                ${escapeHtml(inst.room)}
                              </p>
                            </div>
                            ${
                              heightPx >= 52
                                ? `
                              <div class="mono tabular-nums" style="display:flex;width:100%;align-items:center;justify-content:space-between;gap:4px;font-size:10px;">
                                <span style="color:var(--text-muted);">${escapeHtml(
                                  inst.startTime
                                )}</span>
                                ${
                                  inst.isCancelled
                                    ? `<span class="text-rose" style="font-family:var(--font-sans);font-weight:500;">Dibatalkan</span>`
                                    : inst.isModified
                                    ? `<span class="text-amber" style="font-family:var(--font-sans);font-weight:500;">Berubah</span>`
                                    : status === 'Berlangsung'
                                    ? `<span class="text-emerald" style="font-family:var(--font-sans);font-weight:500;">Berlangsung</span>`
                                    : ''
                                }
                              </div>
                            `
                                : ''
                            }
                          </button>
                        `;
                      })
                      .join('')}
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <!-- Mobile 7-Day Selector -->
        <div class="klik-mobile-day-strip">
          ${weekDates
            .map((d, idx) => {
              const key = toLocalDateKey(d);
              const isSelected = key === scheduleUi.selectedDateKey;
              const isToday = key === todayKey;
              const hasClasses = (weekInstancesByDate.get(key) ?? []).length > 0;
              return `
                <button
                  type="button"
                  data-sched-select-day="${escapeHtml(key)}"
                  class="klik-mobile-day-btn ${
                    isSelected ? 'is-selected' : ''
                  }"
                >
                  <span style="font-size:10px;">${escapeHtml(
                    INDONESIAN_SHORT_DAYS[idx]
                  )}</span>
                  <span class="klik-day-num ${isToday ? 'is-today' : ''}" style="margin-top:4px;">${d.getDate()}</span>
                  <span class="klik-mobile-day-dot ${
                    hasClasses ? 'has-classes' : ''
                  }"></span>
                </button>
              `;
            })
            .join('')}
        </div>

        <!-- Daily Detail Aside -->
        <aside class="klik-schedule-aside">
          <div class="klik-card-head" style="padding:14px 16px;">
            <div>
              <h2 class="klik-card-title">${escapeHtml(
                formatIndonesianFullDate(selectedDateObj)
              )}</h2>
              <p style="margin-top:2px;font-size:12px;color:var(--text-muted);">
                ${
                  selectedDayInstances.length > 0
                    ? `${selectedDayInstances.length} sesi perkuliahan`
                    : 'Tidak ada perkuliahan'
                }
              </p>
            </div>
            ${
              isAdmin
                ? `<button type="button" id="klik-sched-aside-add" class="klik-btn klik-btn--ghost-border klik-btn--sm">+ Tambah</button>`
                : ''
            }
          </div>

          <div style="padding:16px;">
            ${
              selectedDayInstances.length === 0
                ? `
              <div class="klik-empty klik-empty--compact">
                <div class="klik-empty-icon">${icon('calendarDays', 18)}</div>
                <h3>Hari ini kosong</h3>
                <p>Belum ada jadwal kuliah rutin pada tanggal yang dipilih.</p>
              </div>
            `
                : `
              <div class="klik-divide-list klik-divide-pad">
                ${selectedDayInstances
                  .map((inst) => {
                    const course = getCourseById(inst.courseId);
                    const status =
                      selectedDayStatuses.get(inst.instanceKey) ?? 'Nanti';
                    const statusColor =
                      status === 'Berlangsung'
                        ? 'var(--emerald-text)'
                        : status === 'Berikutnya'
                        ? 'var(--amber-text)'
                        : status === 'Dibatalkan'
                        ? 'var(--rose-text)'
                        : 'var(--text-dim)';
                    return `
                      <button
                        type="button"
                        data-sched-aside-inst="${escapeHtml(inst.instanceKey)}"
                        style="width:100%;text-align:left;cursor:pointer;display:block;"
                      >
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;">
                          <span class="mono tabular-nums text-muted">${escapeHtml(
                            inst.startTime
                          )} – ${escapeHtml(inst.endTime)}</span>
                          <div style="display:flex;align-items:center;gap:8px;">
                            ${
                              inst.isModified && !inst.isCancelled
                                ? `<span class="text-amber" style="font-size:11px;font-weight:500;">Berubah</span>`
                                : ''
                            }
                            <span style="font-size:11px;font-weight:500;color:${statusColor};">${escapeHtml(
                      status
                    )}</span>
                          </div>
                        </div>
                        <p style="margin-top:4px;font-size:14px;font-weight:500;color:${
                          inst.isCancelled
                            ? 'var(--text-muted)'
                            : 'var(--text-primary)'
                        };${
                      inst.isCancelled ? 'text-decoration:line-through;' : ''
                    }">
                          ${escapeHtml(course?.name ?? 'Mata Kuliah')}
                        </p>
                        <p style="margin-top:2px;font-size:12px;color:var(--text-muted);">
                          ${escapeHtml(inst.room)} · ${escapeHtml(
                      course?.lecturer ?? ''
                    )}
                        </p>
                        ${
                          inst.exception?.reason
                            ? `<p style="margin-top:6px;font-size:11px;color:var(--text-muted);background:#1b1f26;border-radius:4px;padding:6px 10px;border:1px solid var(--border-subtle);">${escapeHtml(
                                inst.exception.reason
                              )}</p>`
                            : ''
                        }
                      </button>
                    `;
                  })
                  .join('')}
              </div>
            `
            }
          </div>
        </aside>
      </div>
    </div>
  `;

  const gridBody = container.querySelector('.klik-schedule-grid-body');
  if (gridBody && prevGridScroll > 0) {
    gridBody.scrollTop = prevGridScroll;
  }

  // Event bindings
  container
    .querySelector('#klik-sched-prev-week')
    ?.addEventListener('click', () => {
      const next = addDays(scheduleUi.weekStart, -7);
      scheduleUi.weekStart = next;
      scheduleUi.selectedDateKey = toLocalDateKey(next);
      renderScheduleView(container);
    });

  container
    .querySelector('#klik-sched-today')
    ?.addEventListener('click', () => {
      scheduleUi.weekStart = getStartOfWeekMonday(now);
      scheduleUi.selectedDateKey = todayKey;
      renderScheduleView(container);
    });

  container
    .querySelector('#klik-sched-next-week')
    ?.addEventListener('click', () => {
      const next = addDays(scheduleUi.weekStart, 7);
      scheduleUi.weekStart = next;
      scheduleUi.selectedDateKey = toLocalDateKey(next);
      renderScheduleView(container);
    });

  container
    .querySelector('#klik-sched-collections')
    ?.addEventListener('click', () => openCourseCollectionModal());

  container
    .querySelector('#klik-sched-add')
    ?.addEventListener('click', () => openAddScheduleModal());

  container
    .querySelector('#klik-sched-aside-add')
    ?.addEventListener('click', () =>
      openAddScheduleModal(getIsoWeekday(selectedDateObj))
    );

  container.querySelectorAll('[data-sched-select-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      scheduleUi.selectedDateKey = btn.getAttribute('data-sched-select-day');
      renderScheduleView(container);
    });
  });

  container.querySelectorAll('[data-sched-slot-date]').forEach((slot) => {
    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      const dateKey = slot.getAttribute('data-sched-slot-date');
      const day = Number(slot.getAttribute('data-sched-slot-day'));
      const hour = Number(slot.getAttribute('data-sched-slot-hour'));
      scheduleUi.selectedDateKey = dateKey;
      if (isAdmin) {
        openAddScheduleModal(day, hour);
      } else {
        renderScheduleView(container);
      }
    });
  });

  container.querySelectorAll('[data-sched-block]').forEach((block) => {
    block.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = block.getAttribute('data-sched-block');
      const dateKey = block.getAttribute('data-sched-block-date');
      scheduleUi.selectedDateKey = dateKey;
      const list = weekInstancesByDate.get(dateKey) ?? [];
      const inst = list.find((item) => item.instanceKey === key);
      renderScheduleView(container);
      if (inst) openScheduleDetailModal(inst);
    });
  });

  container.querySelectorAll('[data-sched-aside-inst]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-sched-aside-inst');
      const inst = selectedDayInstances.find((item) => item.instanceKey === key);
      if (inst) openScheduleDetailModal(inst);
    });
  });
}
