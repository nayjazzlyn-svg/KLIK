import { icon } from './icons.js';
import {
  getCourseById,
  getCurrentUser,
  getStoreState,
  getWorkspaceViewState,
  isTaskCompletedByCurrentUser,
  navigateTo,
} from './state.js';
import {
  INDONESIAN_DAYS,
  escapeHtml,
  findClassFocus,
  formatAnnouncementDate,
  formatCountdown,
  formatDateTimeLabel,
  formatIndonesianFullDate,
  getDeadlineBadgeLabel,
  getGreetingByHour,
  getInstanceStatusesForDate,
  isActivityArchived,
  parseLocalDateKey,
  resolveSchedulesForDate,
  toLocalDateKey,
} from './utils.js';

let lastFocusTargetMs = null;
let lastFocusMode = null;

export function tickDashboardCountdown() {
  const el = document.getElementById('klik-focus-countdown');
  if (!el || !lastFocusTargetMs) return;
  const now = getStoreState().now;
  el.textContent = formatCountdown(lastFocusTargetMs, now.getTime());
}

export function renderDashboard(container) {
  if (!container) return;

  const store = getStoreState();
  const viewState = getWorkspaceViewState();
  const now = store.now;
  const currentUser = getCurrentUser();

  const greeting = getGreetingByHour(now.getHours());
  const fullDateLabel = formatIndonesianFullDate(now);
  const firstName = (currentUser.name || 'Mahasiswa').split(' ')[0];

  // B. Class Focus
  const classFocus = findClassFocus(
    now,
    viewState.schedules,
    viewState.scheduleExceptions
  );
  const focusCourse = classFocus
    ? getCourseById(classFocus.instance.courseId)
    : undefined;
  const focusCountdown = classFocus
    ? formatCountdown(classFocus.targetTime.getTime(), now.getTime())
    : '';

  if (classFocus) {
    lastFocusTargetMs = classFocus.targetTime.getTime();
    lastFocusMode = classFocus.status;
  } else {
    lastFocusTargetMs = null;
    lastFocusMode = null;
  }

  let focusDayLabel = '';
  if (classFocus) {
    if (classFocus.isToday) {
      focusDayLabel = 'Hari ini';
    } else {
      const targetDate = parseLocalDateKey(classFocus.instance.date);
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      if (toLocalDateKey(targetDate) === toLocalDateKey(tomorrow)) {
        focusDayLabel = `Besok · ${INDONESIAN_DAYS[classFocus.instance.dayOfWeek - 1]}`;
      } else {
        focusDayLabel = formatIndonesianFullDate(targetDate);
      }
    }
  }

  // C. Agenda Hari Ini
  const todayAgenda = resolveSchedulesForDate(
    now,
    viewState.schedules,
    viewState.scheduleExceptions
  );
  const todayStatusMap = getInstanceStatusesForDate(todayAgenda, now);

  // D. Tugas Mendatang (max 3, unfinished, NO checkboxes)
  const upcomingTasks = viewState.individualTasks
    .filter((t) => !isTaskCompletedByCurrentUser(t.id))
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    })
    .slice(0, 3);

  // E. Kelompok Mata Kuliah Saya (max 3)
  const myGroupActivities = viewState.groupActivities
    .map((activity) => {
      const course = getCourseById(activity.courseId);
      const activityGroups = viewState.groups.filter(
        (g) => g.activityId === activity.id
      );
      const archived = isActivityArchived(activityGroups);
      const myMembership = viewState.groupMembers.find(
        (m) => m.activityId === activity.id && m.userId === currentUser.id
      );
      const myGroup = myMembership
        ? activityGroups.find((g) => g.id === myMembership.groupId)
        : undefined;
      return { activity, course, archived, myGroup };
    })
    .sort((a, b) => {
      const score = (x) => (x.archived ? 0 : 2) + (x.myGroup ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, 3);

  // F. Pengumuman Terbaru (max 2)
  const latestAnnouncements = [...viewState.announcements]
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 2);

  container.innerHTML = `
    <div class="klik-stack-lg">
      <!-- Greeting Header -->
      <div>
        <p class="text-emerald tabular-nums" style="font-size:12px;font-weight:500;">${escapeHtml(
          fullDateLabel
        )}</p>
        <h1 style="margin-top:4px;font-size:24px;font-weight:600;letter-spacing:-0.025em;color:var(--text-primary);">
          ${escapeHtml(greeting)}, ${escapeHtml(firstName)}.
        </h1>
        <p style="margin-top:4px;font-size:14px;color:var(--text-muted);">
          Pantau perkuliahan, tenggat tugas, kelompok, dan informasi kelas ${escapeHtml(
            viewState.classInfo.code
          )} di satu tempat.
        </p>
      </div>

      <!-- Class Focus Panel -->
      <section aria-label="Fokus Kuliah Berikutnya">
        ${
          classFocus && focusCourse
            ? `
          <div class="klik-focus-card">
            <div class="klik-focus-inner">
              <div style="min-width:0;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:12px;">
                  <span id="klik-focus-status" class="klik-tag klik-tag--mono ${
                    lastFocusMode === 'BERLANGSUNG'
                      ? 'klik-tag--emerald'
                      : 'klik-tag--amber'
                  }">${escapeHtml(classFocus.status)}</span>
                  <span class="text-muted">${escapeHtml(focusDayLabel)}</span>
                  ${
                    classFocus.instance.isModified
                      ? `<span style="color:var(--text-sep);" aria-hidden="true">·</span>
                         <span class="text-amber" style="font-weight:500;">Jadwal Berubah</span>`
                      : ''
                  }
                </div>

                <h2 class="klik-focus-title truncate">${escapeHtml(
                  focusCourse.name
                )}</h2>

                <div class="klik-focus-meta">
                  <span class="mono tabular-nums" style="display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);">
                    ${icon('clock', 14, 'text-dim')}
                    ${escapeHtml(classFocus.instance.startTime)} – ${escapeHtml(
                classFocus.instance.endTime
              )}
                  </span>
                  <span style="display:inline-flex;align-items:center;gap:6px;">
                    ${icon('mapPin', 14, 'text-dim')}
                    ${escapeHtml(classFocus.instance.room)}
                  </span>
                  <span class="text-dim">${escapeHtml(
                    focusCourse.lecturer
                  )}</span>
                </div>
              </div>

              <div class="klik-focus-countdown-col">
                <div style="text-align:inherit;">
                  <p style="font-size:11px;color:var(--text-muted);">
                    ${
                      classFocus.status === 'BERLANGSUNG'
                        ? 'Selesai dalam'
                        : 'Dimulai dalam'
                    }
                  </p>
                  <p id="klik-focus-countdown" class="klik-focus-countdown">${escapeHtml(
                    focusCountdown
                  )}</p>
                </div>
                <button type="button" id="klik-dash-goto-focus-sched" class="klik-btn klik-btn--surface klik-btn--sm">
                  <span>Lihat Jadwal</span>
                  ${icon('arrowRight', 14)}
                </button>
              </div>
            </div>
          </div>
        `
            : `
          <div class="klik-empty">
            <div class="klik-empty-icon">${icon('calendarDays', 18)}</div>
            <h3>Belum ada jadwal kuliah terdaftar</h3>
            <p>Tambahkan jadwal perkuliahan kelas di menu Jadwal Kuliah untuk mengaktifkan fokus kuliah real-time.</p>
            <div style="margin-top:16px;">
              <button type="button" id="klik-dash-goto-jadwal" class="klik-btn klik-btn--primary">
                Buka Jadwal Kuliah
              </button>
            </div>
          </div>
        `
        }
      </section>

      <!-- Row 2: Agenda Hari Ini + Tugas Mendatang -->
      <div class="klik-grid-2">
        <section class="klik-card">
          <div class="klik-card-head">
            <h2 class="klik-card-title">Agenda Hari Ini</h2>
            <button type="button" class="klik-card-link-btn" data-dash-nav="jadwal-today">
              <span>Kalender</span>
              ${icon('arrowRight', 14)}
            </button>
          </div>
          <div class="klik-card-body">
            ${
              todayAgenda.length === 0
                ? `
              <div class="klik-empty klik-empty--compact">
                <div class="klik-empty-icon">${icon('calendarDays', 18)}</div>
                <h3>Tidak ada kuliah hari ini</h3>
                <p>Hari ini bebas dari jadwal perkuliahan rutin. Manfaatkan waktu untuk menyelesaikan tugas.</p>
              </div>
            `
                : `
              <div class="klik-divide-list klik-divide-pad">
                ${todayAgenda
                  .map((inst) => {
                    const course = getCourseById(inst.courseId);
                    const status =
                      todayStatusMap.get(inst.instanceKey) ?? 'Nanti';
                    const isMuted =
                      status === 'Selesai' || status === 'Dibatalkan';
                    const isOngoing = status === 'Berlangsung';
                    const isNext = status === 'Berikutnya';
                    const statusColor = isOngoing
                      ? 'var(--emerald-text)'
                      : isNext
                      ? 'var(--amber-text)'
                      : status === 'Dibatalkan'
                      ? 'var(--rose-text)'
                      : 'var(--text-dim)';
                    const titleColor = isOngoing
                      ? 'var(--emerald-soft)'
                      : inst.isCancelled
                      ? 'var(--text-muted)'
                      : 'var(--text-primary)';
                    return `
                      <button
                        type="button"
                        data-dash-sched-date="${escapeHtml(inst.date)}"
                        style="width:100%;text-align:left;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;cursor:pointer;opacity:${
                          isMuted ? '0.55' : '1'
                        };"
                      >
                        <div style="display:flex;align-items:flex-start;gap:14px;min-width:0;">
                          <div class="mono tabular-nums" style="width:92px;flex-shrink:0;padding-top:2px;font-size:12px;color:var(--text-muted);">
                            ${escapeHtml(inst.startTime)}–${escapeHtml(
                      inst.endTime
                    )}
                          </div>
                          <div style="min-width:0;">
                            <p class="truncate" style="font-size:14px;font-weight:500;color:${titleColor};${
                      inst.isCancelled ? 'text-decoration:line-through;' : ''
                    }">
                              ${escapeHtml(course?.name ?? 'Mata Kuliah')}
                            </p>
                            <p class="truncate" style="margin-top:2px;font-size:12px;color:var(--text-muted);">
                              ${escapeHtml(inst.room)}${
                      inst.isModified ? ' · Berubah' : ''
                    }
                            </p>
                          </div>
                        </div>
                        <span class="whitespace-nowrap" style="flex-shrink:0;font-size:11px;font-weight:500;color:${statusColor};">
                          ${escapeHtml(status)}
                        </span>
                      </button>
                    `;
                  })
                  .join('')}
              </div>
            `
            }
          </div>
        </section>

        <section class="klik-card">
          <div class="klik-card-head">
            <h2 class="klik-card-title">Tugas Mendatang</h2>
            <button type="button" class="klik-card-link-btn" data-dash-nav="tugas">
              <span>Task Planner</span>
              ${icon('arrowRight', 14)}
            </button>
          </div>
          <div class="klik-card-body">
            ${
              upcomingTasks.length === 0
                ? `
              <div class="klik-empty klik-empty--compact">
                <div class="klik-empty-icon">${icon('checkSquare', 18)}</div>
                <h3>Semua tugas sudah selesai</h3>
                <p>Tidak ada tugas aktif yang tertunda untuk saat ini.</p>
              </div>
            `
                : `
              <div class="klik-divide-list klik-divide-pad">
                ${upcomingTasks
                  .map((task) => {
                    const course = getCourseById(task.courseId);
                    const dl = getDeadlineBadgeLabel(task, now);
                    const toneColor =
                      dl.tone === 'danger'
                        ? 'var(--rose-text)'
                        : dl.tone === 'warning'
                        ? 'var(--amber-text)'
                        : 'var(--text-muted)';
                    return `
                      <button
                        type="button"
                        data-dash-task-id="${escapeHtml(task.id)}"
                        style="width:100%;text-align:left;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;cursor:pointer;"
                      >
                        <div style="min-width:0;">
                          <p class="truncate" style="font-size:14px;font-weight:500;color:var(--text-primary);">
                            ${escapeHtml(task.title)}
                          </p>
                          <div style="margin-top:4px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);">
                            <span>${escapeHtml(
                              course?.name ?? 'Mata Kuliah'
                            )}</span>
                            <span aria-hidden="true">·</span>
                            <span class="mono tabular-nums" style="font-size:11px;">${escapeHtml(
                              formatDateTimeLabel(task.deadline)
                            )}</span>
                          </div>
                        </div>
                        <span class="whitespace-nowrap" style="flex-shrink:0;font-size:11px;font-weight:500;color:${toneColor};">
                          ${escapeHtml(dl.label)}
                        </span>
                      </button>
                    `;
                  })
                  .join('')}
              </div>
            `
            }
          </div>
        </section>
      </div>

      <!-- Row 3: Kelompok Mata Kuliah Saya + Pengumuman Terbaru -->
      <div class="klik-grid-2">
        <section class="klik-card">
          <div class="klik-card-head">
            <h2 class="klik-card-title">Kelompok Mata Kuliah Saya</h2>
            <button type="button" class="klik-card-link-btn" data-dash-nav="kelompok">
              <span>Group Organizer</span>
              ${icon('arrowRight', 14)}
            </button>
          </div>
          <div class="klik-card-body">
            ${
              myGroupActivities.length === 0
                ? `
              <div class="klik-empty klik-empty--compact">
                <div class="klik-empty-icon">${icon('users', 18)}</div>
                <h3>Belum ada aktivitas kelompok</h3>
                <p>Pembentukan kelompok yang dibuat Komting akan muncul di sini.</p>
              </div>
            `
                : `
              <div class="klik-divide-list klik-divide-pad">
                ${myGroupActivities
                  .map(({ activity, course, archived, myGroup }) => {
                    const actTitle =
                      activity.name.trim() ||
                      `Pembentukan Kelompok ${course?.name ?? ''}`;
                    return `
                      <button
                        type="button"
                        data-dash-group-course="${escapeHtml(
                          activity.courseId
                        )}"
                        data-dash-group-act="${escapeHtml(activity.id)}"
                        style="width:100%;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;"
                      >
                        <div style="min-width:0;">
                          <p class="truncate" style="font-size:14px;font-weight:500;color:var(--text-primary);">
                            ${escapeHtml(course?.name ?? 'Mata Kuliah')}
                          </p>
                          <p class="truncate" style="margin-top:2px;font-size:12px;color:var(--text-muted);">
                            ${escapeHtml(actTitle)}${archived ? ' · Arsip' : ''}
                          </p>
                        </div>
                        <span class="whitespace-nowrap tabular-nums" style="flex-shrink:0;font-size:12px;font-weight:500;color:${
                          myGroup ? 'var(--emerald-text)' : 'var(--amber-text)'
                        };">
                          ${
                            myGroup
                              ? `Kelompok ${myGroup.groupNumber}`
                              : 'Belum bergabung'
                          }
                        </span>
                      </button>
                    `;
                  })
                  .join('')}
              </div>
            `
            }
          </div>
        </section>

        <section class="klik-card">
          <div class="klik-card-head">
            <h2 class="klik-card-title">Pengumuman Terbaru</h2>
            <button type="button" class="klik-card-link-btn" data-dash-nav="pengumuman">
              <span>Semua Pengumuman</span>
              ${icon('arrowRight', 14)}
            </button>
          </div>
          <div class="klik-card-body">
            ${
              latestAnnouncements.length === 0
                ? `
              <div class="klik-empty klik-empty--compact">
                <div class="klik-empty-icon">${icon('megaphone', 18)}</div>
                <h3>Belum ada pengumuman</h3>
                <p>Pengumuman kelas terbaru akan ditampilkan di sini.</p>
              </div>
            `
                : `
              <div class="klik-divide-list klik-divide-pad">
                ${latestAnnouncements
                  .map((ann) => {
                    const course = ann.courseId
                      ? getCourseById(ann.courseId)
                      : undefined;
                    return `
                      <button
                        type="button"
                        data-dash-ann-id="${escapeHtml(ann.id)}"
                        style="width:100%;text-align:left;display:block;cursor:pointer;"
                      >
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--text-muted);">
                          <span class="text-emerald" style="font-weight:500;">${escapeHtml(
                            course ? course.name : 'Umum'
                          )}</span>
                          <span class="tabular-nums">${escapeHtml(
                            formatAnnouncementDate(ann.publishedAt)
                          )}</span>
                        </div>
                        <h3 class="line-clamp-1" style="margin-top:4px;font-size:14px;font-weight:500;color:var(--text-primary);">
                          ${escapeHtml(ann.title)}
                        </h3>
                        <p class="line-clamp-2" style="margin-top:4px;font-size:12px;line-height:1.6;color:var(--text-muted);">
                          ${escapeHtml(ann.content)}
                        </p>
                      </button>
                    `;
                  })
                  .join('')}
              </div>
            `
            }
          </div>
        </section>
      </div>
    </div>
  `;

  // Wire dashboard click handlers
  container
    .querySelector('#klik-dash-goto-focus-sched')
    ?.addEventListener('click', () => {
      if (classFocus) {
        navigateTo({
          section: 'jadwal',
          scheduleDate: classFocus.instance.date,
        });
      }
    });

  container
    .querySelector('#klik-dash-goto-jadwal')
    ?.addEventListener('click', () => navigateTo({ section: 'jadwal' }));

  container.querySelectorAll('[data-dash-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-dash-nav');
      if (target === 'jadwal-today') {
        navigateTo({ section: 'jadwal', scheduleDate: toLocalDateKey(now) });
      } else if (target) {
        navigateTo({ section: target });
      }
    });
  });

  container.querySelectorAll('[data-dash-sched-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo({
        section: 'jadwal',
        scheduleDate: btn.getAttribute('data-dash-sched-date'),
      });
    });
  });

  container.querySelectorAll('[data-dash-task-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo({
        section: 'tugas',
        taskId: btn.getAttribute('data-dash-task-id'),
      });
    });
  });

  container.querySelectorAll('[data-dash-group-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo({
        section: 'kelompok',
        groupCourseId: btn.getAttribute('data-dash-group-course'),
        groupActivityId: btn.getAttribute('data-dash-group-act'),
      });
    });
  });

  container.querySelectorAll('[data-dash-ann-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo({
        section: 'pengumuman',
        announcementId: btn.getAttribute('data-dash-ann-id'),
      });
    });
  });
}
