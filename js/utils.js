import * as XLSX from 'xlsx';
import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

export const INDONESIAN_DAYS = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

export const INDONESIAN_SHORT_DAYS = [
  'Sen',
  'Sel',
  'Rab',
  'Kam',
  'Jum',
  'Sab',
  'Min',
];

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeExternalUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '#';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return '#';
  }
  return '#';
}

const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'UL',
  'OL',
  'LI',
  'H2',
  'H3',
  'DIV',
  'SPAN',
]);

export function sanitizeRichTextHtml(rawHtml) {
  if (!rawHtml) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return String(rawHtml).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const tag = node.tagName.toUpperCase();
    if (
      tag === 'SCRIPT' ||
      tag === 'STYLE' ||
      tag === 'IFRAME' ||
      tag === 'OBJECT'
    ) {
      return null;
    }

    if (ALLOWED_TAGS.has(tag)) {
      const cleanEl = document.createElement(tag.toLowerCase());
      Array.from(node.childNodes).forEach((child) => {
        const cleanedChild = cleanNode(child);
        if (cleanedChild) cleanEl.appendChild(cleanedChild);
      });
      return cleanEl;
    }

    const fragment = document.createDocumentFragment();
    Array.from(node.childNodes).forEach((child) => {
      const cleanedChild = cleanNode(child);
      if (cleanedChild) fragment.appendChild(cleanedChild);
    });
    return fragment;
  };

  const container = document.createElement('div');
  Array.from(doc.body.childNodes).forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) container.appendChild(cleaned);
  });

  return container.innerHTML;
}

export function stripHtmlToText(html) {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return String(html)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function toLocalDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * ISO weekday: 1 = Senin, ..., 7 = Minggu
 */
export function getIsoWeekday(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function getStartOfWeekMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const isoDay = getIsoWeekday(d);
  return addDays(d, -(isoDay - 1));
}

export function getWeekDates(weekStartMonday) {
  const list = [];
  for (let i = 0; i < 7; i += 1) {
    list.push(addDays(weekStartMonday, i));
  }
  return list;
}

export function getGreetingByHour(hour) {
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function formatIndonesianFullDate(date) {
  const dayName = INDONESIAN_DAYS[getIsoWeekday(date) - 1];
  const day = date.getDate();
  const month = INDONESIAN_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName}, ${day} ${month} ${year}`;
}

export function formatIndonesianShortDate(date) {
  const day = date.getDate();
  const month = INDONESIAN_MONTHS[date.getMonth()].slice(0, 3);
  return `${day} ${month}`;
}

export function formatDateTimeLabel(isoString) {
  if (!isoString) return 'Tanpa deadline';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return 'Tanpa deadline';
  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const tomorrowKey = toLocalDateKey(addDays(now, 1));
  const targetKey = toLocalDateKey(d);
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;

  if (targetKey === todayKey) return `Hari ini, ${timeStr}`;
  if (targetKey === tomorrowKey) return `Besok, ${timeStr}`;
  const dayName = INDONESIAN_SHORT_DAYS[getIsoWeekday(d) - 1];
  return `${dayName}, ${d.getDate()} ${INDONESIAN_MONTHS[d.getMonth()].slice(
    0,
    3
  )} · ${timeStr}`;
}

export function formatAnnouncementDate(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const targetKey = toLocalDateKey(d);
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;

  if (targetKey === todayKey) return `Hari ini, ${timeStr}`;
  return `${d.getDate()} ${INDONESIAN_MONTHS[d.getMonth()].slice(
    0,
    3
  )} ${d.getFullYear()} · ${timeStr}`;
}

export function toDatetimeLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function timeToMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function buildDateTime(date, timeHHMM) {
  const [h, m] = String(timeHHMM).split(':').map(Number);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    h || 0,
    m || 0,
    0,
    0
  );
}

export function formatCountdown(targetMs, nowMs) {
  const diff = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (days > 0) {
    return `${days}h ${String(hours).padStart(2, '0')}j ${String(
      minutes
    ).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}d`;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0'
  )}:${String(seconds).padStart(2, '0')}`;
}

export function resolveSchedulesForDate(date, schedules, exceptions) {
  const dateKey = toLocalDateKey(date);
  const weekday = getIsoWeekday(date);

  const matching = schedules.filter((sch) => {
    if (sch.dayOfWeek !== weekday) return false;
    if (sch.effectiveFrom && dateKey < sch.effectiveFrom) return false;
    if (sch.effectiveUntil && dateKey > sch.effectiveUntil) return false;
    return true;
  });

  const resolved = matching.map((sch) => {
    const exc = exceptions.find(
      (e) => e.scheduleId === sch.id && e.date === dateKey
    );
    const isCancelled = exc?.type === 'cancelled';
    const isModified = exc?.type === 'modified';

    return {
      instanceKey: `${sch.id}_${dateKey}`,
      scheduleId: sch.id,
      date: dateKey,
      courseId: exc?.overrideCourseId ?? sch.courseId,
      dayOfWeek: weekday,
      startTime: exc?.overrideStartTime ?? sch.startTime,
      endTime: exc?.overrideEndTime ?? sch.endTime,
      room: exc?.overrideRoom ?? sch.room,
      isModified,
      isCancelled,
      exception: exc,
    };
  });

  return resolved.sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
}

export function getInstanceStatusesForDate(instances, now) {
  const statusMap = new Map();
  const todayKey = toLocalDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let markedNext = false;

  instances.forEach((inst) => {
    if (inst.isCancelled) {
      statusMap.set(inst.instanceKey, 'Dibatalkan');
      return;
    }

    if (inst.date < todayKey) {
      statusMap.set(inst.instanceKey, 'Selesai');
      return;
    }

    if (inst.date > todayKey) {
      statusMap.set(inst.instanceKey, 'Nanti');
      return;
    }

    const startMin = timeToMinutes(inst.startTime);
    const endMin = timeToMinutes(inst.endTime);

    if (nowMinutes >= startMin && nowMinutes < endMin) {
      statusMap.set(inst.instanceKey, 'Berlangsung');
    } else if (nowMinutes >= endMin) {
      statusMap.set(inst.instanceKey, 'Selesai');
    } else if (!markedNext) {
      statusMap.set(inst.instanceKey, 'Berikutnya');
      markedNext = true;
    } else {
      statusMap.set(inst.instanceKey, 'Nanti');
    }
  });

  return statusMap;
}

export function findClassFocus(now, schedules, exceptions) {
  const todayKey = toLocalDateKey(now);
  const nowMs = now.getTime();

  const todayInstances = resolveSchedulesForDate(
    now,
    schedules,
    exceptions
  ).filter((inst) => !inst.isCancelled);

  for (let i = 0; i < todayInstances.length; i += 1) {
    const inst = todayInstances[i];
    const start = buildDateTime(now, inst.startTime);
    const end = buildDateTime(now, inst.endTime);
    if (nowMs >= start.getTime() && nowMs < end.getTime()) {
      return {
        instance: inst,
        status: 'BERLANGSUNG',
        targetTime: end,
        isToday: true,
      };
    }
    if (nowMs < start.getTime()) {
      return {
        instance: inst,
        status: 'UP NEXT',
        targetTime: start,
        isToday: true,
      };
    }
  }

  for (let offset = 1; offset <= 14; offset += 1) {
    const futureDate = addDays(now, offset);
    const futureInstances = resolveSchedulesForDate(
      futureDate,
      schedules,
      exceptions
    ).filter((inst) => !inst.isCancelled);

    if (futureInstances.length > 0) {
      const first = futureInstances[0];
      return {
        instance: first,
        status: 'UP NEXT',
        targetTime: buildDateTime(futureDate, first.startTime),
        isToday: first.date === todayKey,
      };
    }
  }

  return null;
}

export const TASK_BUCKETS = [
  { key: 'terlambat', label: 'Terlambat', toneClass: 'text-rose' },
  { key: 'hari_ini', label: 'Hari ini', toneClass: 'text-amber' },
  { key: 'besok', label: 'Besok', toneClass: 'text-amber-soft' },
  { key: 'tujuh_hari', label: '7 Hari ke Depan', toneClass: 'text-body' },
  { key: 'mendatang', label: 'Deadline Mendatang', toneClass: 'text-secondary' },
  { key: 'tanpa_deadline', label: 'Tanpa Deadline', toneClass: 'text-muted' },
  { key: 'selesai', label: 'Selesai', toneClass: 'text-emerald' },
];

export function classifyTaskBucket(task, isCompleted, now) {
  if (isCompleted) return 'selesai';
  if (!task.deadline) return 'tanpa_deadline';

  const deadlineDate = new Date(task.deadline);
  if (Number.isNaN(deadlineDate.getTime())) return 'tanpa_deadline';

  if (deadlineDate.getTime() < now.getTime()) {
    return 'terlambat';
  }

  const todayKey = toLocalDateKey(now);
  const tomorrowKey = toLocalDateKey(addDays(now, 1));
  const sevenDaysEndKey = toLocalDateKey(addDays(now, 7));
  const deadlineKey = toLocalDateKey(deadlineDate);

  if (deadlineKey === todayKey) return 'hari_ini';
  if (deadlineKey === tomorrowKey) return 'besok';
  if (deadlineKey <= sevenDaysEndKey) return 'tujuh_hari';
  return 'mendatang';
}

export function getDeadlineBadgeLabel(task, now) {
  if (!task.deadline) {
    return { label: 'Tanpa deadline', tone: 'neutral' };
  }
  const deadlineDate = new Date(task.deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  if (diffMs < 0) {
    return { label: 'Terlambat', tone: 'danger' };
  }

  const todayKey = toLocalDateKey(now);
  const tomorrowKey = toLocalDateKey(addDays(now, 1));
  const deadlineKey = toLocalDateKey(deadlineDate);

  if (deadlineKey === todayKey) {
    return { label: 'Hari ini', tone: 'warning' };
  }
  if (deadlineKey === tomorrowKey) {
    return { label: 'Besok', tone: 'warning' };
  }

  const diffDays = Math.ceil(diffMs / 86400000);
  return { label: `${diffDays} hari lagi`, tone: 'neutral' };
}

/**
 * Quotient / remainder capacity distribution:
 * e.g. 41 participants, 7 groups -> 6 groups max 6, 1 group max 5.
 */
export function computeActivityCapacityPlan(totalParticipants, groupCount) {
  const safeCount = Math.max(1, groupCount);
  const safeParticipants = Math.max(0, totalParticipants);
  const smallCap = Math.floor(safeParticipants / safeCount);
  const remainder = safeParticipants % safeCount;
  const largeCap = remainder > 0 ? smallCap + 1 : smallCap;

  return {
    smallCap,
    largeCap,
    largeGroupQuota: remainder,
    smallGroupQuota: safeCount - remainder,
  };
}

export function getGroupEffectiveMaxCapacity(
  group,
  allActivityGroups,
  allActivityMembers,
  activity
) {
  const plan = computeActivityCapacityPlan(
    activity.totalParticipants,
    activity.groupCount
  );

  const memberCounts = new Map();
  allActivityGroups.forEach((g) => {
    memberCounts.set(g.id, 0);
  });
  allActivityMembers.forEach((m) => {
    memberCounts.set(m.groupId, (memberCounts.get(m.groupId) ?? 0) + 1);
  });

  const thisCount = memberCounts.get(group.id) ?? 0;

  if (plan.largeGroupQuota === 0) {
    return group.isFinal ? Math.max(thisCount, plan.smallCap) : plan.smallCap;
  }

  if (group.isFinal) {
    return thisCount > plan.smallCap ? plan.largeCap : plan.smallCap;
  }

  let otherLargeClaimed = 0;
  allActivityGroups.forEach((g) => {
    if (g.id === group.id) return;
    const count = memberCounts.get(g.id) ?? 0;
    if (count > plan.smallCap) {
      otherLargeClaimed += 1;
    }
  });

  if (thisCount > plan.smallCap) {
    return plan.largeCap;
  }

  if (otherLargeClaimed >= plan.largeGroupQuota) {
    return plan.smallCap;
  }

  return plan.largeCap;
}

export function isGroupFull(
  group,
  allActivityGroups,
  allActivityMembers,
  activity
) {
  const count = allActivityMembers.filter((m) => m.groupId === group.id).length;
  const maxCap = getGroupEffectiveMaxCapacity(
    group,
    allActivityGroups,
    allActivityMembers,
    activity
  );
  return count >= maxCap;
}

export function isActivityArchived(groups) {
  return groups.length > 0 && groups.every((g) => g.isFinal);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFileSlug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '');
}

export function exportActivityToExcel(activity, course, groups, members) {
  const sortedGroups = [...groups].sort((a, b) => a.groupNumber - b.groupNumber);
  const activityLabel =
    activity.name.trim() || `Pembentukan Kelompok ${course.name}`;

  const rows = [];

  sortedGroups.forEach((g) => {
    const groupMembers = members.filter((m) => m.groupId === g.id);
    const maxCap = getGroupEffectiveMaxCapacity(g, sortedGroups, members, activity);

    if (groupMembers.length === 0) {
      rows.push({
        'Mata Kuliah': course.name,
        Aktivitas: activityLabel,
        'Nomor Kelompok': `Kelompok ${g.groupNumber}`,
        Kapasitas: `${groupMembers.length} / ${maxCap}`,
        Status: g.isFinal ? 'Final' : 'Terbuka',
        'Nama Anggota': '(Kosong)',
        NIM: '-',
        Tipe: '-',
      });
    } else {
      groupMembers.forEach((m) => {
        rows.push({
          'Mata Kuliah': course.name,
          Aktivitas: activityLabel,
          'Nomor Kelompok': `Kelompok ${g.groupNumber}`,
          Kapasitas: `${groupMembers.length} / ${maxCap}`,
          Status: g.isFinal ? 'Final' : 'Terbuka',
          'Nama Anggota': m.fullName,
          NIM: m.isExternal ? '-' : m.nim ?? '-',
          Tipe: m.isExternal ? 'Eksternal' : 'Internal',
        });
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Kelompok');

  const summaryRows = sortedGroups.map((g) => {
    const groupMembers = members.filter((m) => m.groupId === g.id);
    const maxCap = getGroupEffectiveMaxCapacity(g, sortedGroups, members, activity);
    const internalCount = groupMembers.filter((m) => !m.isExternal).length;
    const externalCount = groupMembers.filter((m) => m.isExternal).length;
    return {
      Kelompok: `Kelompok ${g.groupNumber}`,
      Status: g.isFinal ? 'Final' : 'Terbuka',
      Terisi: groupMembers.length,
      Kapasitas: maxCap,
      Internal: internalCount,
      Eksternal: externalCount,
    };
  });
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan');

  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = `KLIK_${sanitizeFileSlug(course.name)}_${sanitizeFileSlug(
    activityLabel
  )}.xlsx`;
  triggerDownload(blob, filename);
}

export async function exportActivityToWord(activity, course, groups, members) {
  const sortedGroups = [...groups].sort((a, b) => a.groupNumber - b.groupNumber);
  const activityLabel =
    activity.name.trim() || `Pembentukan Kelompok ${course.name}`;

  const sectionsChildren = [
    new Paragraph({
      text: `${course.name} — ${activityLabel}`,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Dosen: ${course.lecturer}  ·  Total Peserta: ${activity.totalParticipants}  ·  Jumlah Kelompok: ${activity.groupCount}`,
          color: '555555',
          size: 20,
        }),
      ],
      spacing: { after: 320 },
    }),
  ];

  sortedGroups.forEach((g) => {
    const groupMembers = members.filter((m) => m.groupId === g.id);
    const maxCap = getGroupEffectiveMaxCapacity(g, sortedGroups, members, activity);

    sectionsChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Kelompok ${g.groupNumber}`,
            bold: true,
            size: 24,
          }),
          new TextRun({
            text: `   (Kapasitas: ${groupMembers.length}/${maxCap} · Status: ${
              g.isFinal ? 'Final' : 'Terbuka'
            })`,
            color: '555555',
            size: 20,
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );

    const tableRows = [
      new TableRow({
        tableHeader: true,
        children: ['No', 'Nama Lengkap', 'NIM', 'Tipe'].map(
          (headerText) =>
            new TableCell({
              shading: { fill: 'F3F4F6' },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: headerText, bold: true, size: 20 })],
                }),
              ],
            })
        ),
      }),
    ];

    if (groupMembers.length === 0) {
      tableRows.push(
        new TableRow({
          children: ['-', 'Belum ada anggota', '-', '-'].map(
            (cellText) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: cellText, size: 20, color: '777777' })],
                  }),
                ],
              })
          ),
        })
      );
    } else {
      groupMembers.forEach((m, index) => {
        const vals = [
          String(index + 1),
          m.fullName,
          m.isExternal ? '-' : m.nim ?? '-',
          m.isExternal ? 'Eksternal' : 'Internal',
        ];
        tableRows.push(
          new TableRow({
            children: vals.map(
              (cellText) =>
                new TableCell({
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
                    left: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
                    right: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
                  },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cellText, size: 20 })],
                    }),
                  ],
                })
            ),
          })
        );
      });
    }

    sectionsChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      })
    );
  });

  const doc = new Document({
    sections: [{ children: sectionsChildren }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `KLIK_${sanitizeFileSlug(course.name)}_${sanitizeFileSlug(
    activityLabel
  )}.docx`;
  triggerDownload(blob, filename);
}
