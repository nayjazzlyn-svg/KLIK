import { addDays, getIsoWeekday, toLocalDateKey } from './utils.js';

function isoAtLocal(baseDate, dayOffset, hours, minutes) {
  const d = addDays(baseDate, dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export function createInitialDemoData(referenceNow = new Date()) {
  const today = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate()
  );
  const todayIsoWeekday = getIsoWeekday(today);
  const mondayOfThisWeek = addDays(today, -(todayIsoWeekday - 1));
  const wednesdayKey = toLocalDateKey(addDays(mondayOfThisWeek, 2));
  const thursdayKey = toLocalDateKey(addDays(mondayOfThisWeek, 3));

  const classInfo = {
    id: 'cls-ti3a',
    code: 'TI-3A',
    name: 'Teknik Informatika 3A',
    semester: 'Semester 3',
    academicYear: '2026/2027',
  };

  const courses = [
    {
      id: 'crs-sd',
      classId: classInfo.id,
      code: 'IF2301',
      name: 'Struktur Data',
      lecturer: 'Dr. Hendra Kusuma, M.Kom.',
      credits: 3,
      collection: {
        id: 'col-sd',
        courseId: 'crs-sd',
        label: 'LMS Sipadu — Struktur Data',
        url: 'https://sipadu.kampus.ac.id/course/struktur-data-3a',
        updatedAt: isoAtLocal(today, -14, 9, 0),
      },
    },
    {
      id: 'crs-so',
      classId: classInfo.id,
      code: 'IF2302',
      name: 'Sistem Operasi',
      lecturer: 'Ir. Rina Kartika, M.T.',
      credits: 3,
      collection: {
        id: 'col-so',
        courseId: 'crs-so',
        label: 'Google Drive Folder Kelas SO',
        url: 'https://drive.google.com/drive/folders/sistem-operasi-ti3a',
        updatedAt: isoAtLocal(today, -10, 10, 0),
      },
    },
    {
      id: 'crs-mn',
      classId: classInfo.id,
      code: 'IF2303',
      name: 'Metode Numerik',
      lecturer: 'Dr. Arif Hidayat, M.Si.',
      credits: 3,
      collection: {
        id: 'col-mn',
        courseId: 'crs-mn',
        label: 'Google Classroom Metode Numerik',
        url: 'https://classroom.google.com/c/metode-numerik-ti3a',
        updatedAt: isoAtLocal(today, -8, 13, 0),
      },
    },
    {
      id: 'crs-pw',
      classId: classInfo.id,
      code: 'IF2304',
      name: 'Pemrograman Web',
      lecturer: 'Dimas Prasetyo, S.Kom., M.Cs.',
      credits: 4,
      collection: {
        id: 'col-pw',
        courseId: 'crs-pw',
        label: 'GitHub Classroom & Drive PemWeb',
        url: 'https://drive.google.com/drive/folders/pemrograman-web-3a',
        updatedAt: isoAtLocal(today, -6, 15, 0),
      },
    },
    {
      id: 'crs-md',
      classId: classInfo.id,
      code: 'IF2305',
      name: 'Matematika Diskrit',
      lecturer: 'Prof. Dr. Ratna Sari, M.Sc.',
      credits: 3,
      collection: {
        id: 'col-md',
        courseId: 'crs-md',
        label: 'LMS Sipadu — Matdis',
        url: 'https://sipadu.kampus.ac.id/course/matdis-3a',
        updatedAt: isoAtLocal(today, -12, 8, 30),
      },
    },
    {
      id: 'crs-bd',
      classId: classInfo.id,
      code: 'IF2306',
      name: 'Basis Data',
      lecturer: 'Yusuf Maulana, M.Kom.',
      credits: 3,
      collection: {
        id: 'col-bd',
        courseId: 'crs-bd',
        label: 'Google Drive Tugas Basis Data',
        url: 'https://drive.google.com/drive/folders/basis-data-ti3a',
        updatedAt: isoAtLocal(today, -5, 11, 0),
      },
    },
  ];

  const schedules = [
    {
      id: 'sch-1',
      classId: classInfo.id,
      courseId: 'crs-sd',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:40',
      room: 'Gedung C · R.302',
    },
    {
      id: 'sch-2',
      classId: classInfo.id,
      courseId: 'crs-md',
      dayOfWeek: 1,
      startTime: '13:00',
      endTime: '14:40',
      room: 'Gedung A · R.204',
    },
    {
      id: 'sch-3',
      classId: classInfo.id,
      courseId: 'crs-so',
      dayOfWeek: 2,
      startTime: '09:00',
      endTime: '10:40',
      room: 'Gedung C · R.305',
    },
    {
      id: 'sch-4',
      classId: classInfo.id,
      courseId: 'crs-pw',
      dayOfWeek: 2,
      startTime: '13:30',
      endTime: '15:50',
      room: 'Lab Komputasi 2',
    },
    {
      id: 'sch-5',
      classId: classInfo.id,
      courseId: 'crs-mn',
      dayOfWeek: 3,
      startTime: '08:30',
      endTime: '10:10',
      room: 'Gedung B · R.108',
    },
    {
      id: 'sch-6',
      classId: classInfo.id,
      courseId: 'crs-bd',
      dayOfWeek: 3,
      startTime: '11:00',
      endTime: '12:40',
      room: 'Lab Basis Data',
    },
    {
      id: 'sch-7',
      classId: classInfo.id,
      courseId: 'crs-sd',
      dayOfWeek: 3,
      startTime: '15:00',
      endTime: '16:40',
      room: 'Lab Algoritma 1',
    },
    {
      id: 'sch-8',
      classId: classInfo.id,
      courseId: 'crs-pw',
      dayOfWeek: 4,
      startTime: '08:00',
      endTime: '09:40',
      room: 'Gedung C · R.301',
    },
    {
      id: 'sch-9',
      classId: classInfo.id,
      courseId: 'crs-so',
      dayOfWeek: 4,
      startTime: '13:00',
      endTime: '14:40',
      room: 'Lab Sistem Jaringan',
    },
    {
      id: 'sch-10',
      classId: classInfo.id,
      courseId: 'crs-mn',
      dayOfWeek: 5,
      startTime: '08:00',
      endTime: '09:40',
      room: 'Gedung B · R.108',
    },
    {
      id: 'sch-11',
      classId: classInfo.id,
      courseId: 'crs-bd',
      dayOfWeek: 5,
      startTime: '13:30',
      endTime: '15:10',
      room: 'Gedung C · R.304',
    },
    {
      id: 'sch-12',
      classId: classInfo.id,
      courseId: 'crs-md',
      dayOfWeek: 6,
      startTime: '09:00',
      endTime: '10:40',
      room: 'Gedung A · R.201',
    },
  ];

  const scheduleExceptions = [
    {
      id: 'exc-1',
      scheduleId: 'sch-7',
      date: wednesdayKey,
      type: 'modified',
      overrideStartTime: '15:30',
      overrideEndTime: '17:10',
      overrideRoom: 'Lab Komputasi 1',
      reason: 'Lab Algoritma 1 dipakai seminar proposal; pindah ke Lab Komputasi 1.',
      createdAt: isoAtLocal(today, -1, 14, 0),
    },
    {
      id: 'exc-2',
      scheduleId: 'sch-9',
      date: thursdayKey,
      type: 'cancelled',
      reason:
        'Ir. Rina Kartika menghadiri konferensi; diganti penugasan mandiri di Task Planner.',
      createdAt: isoAtLocal(today, -1, 16, 15),
    },
  ];

  const individualTasks = [
    {
      id: 'tsk-1',
      classId: classInfo.id,
      courseId: 'crs-mn',
      title: 'Implementasi Metode Newton-Raphson (Python)',
      descriptionHtml:
        '<p>Buat program Python untuk mencari akar persamaan non-linear menggunakan metode <b>Newton-Raphson</b>.</p><ul><li>Tampilkan tabel iterasi (x_n, f(x_n), error relatif).</li><li>Bandingkan konvergensi dengan metode Bagi Dua pada laporan PDF singkat.</li></ul>',
      deadline: isoAtLocal(today, -1, 23, 59),
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -6, 9, 0),
      updatedAt: isoAtLocal(today, -6, 9, 0),
    },
    {
      id: 'tsk-2',
      classId: classInfo.id,
      courseId: 'crs-sd',
      title: 'Latihan Binary Search Tree & Traversal',
      descriptionHtml:
        '<p>Selesaikan implementasi operasi <b>insert</b>, <b>delete</b>, serta traversal <i>preorder, inorder, postorder</i> tanpa library eksternal.</p><p>Unggah file <code>bst_nim.cpp</code> ke LMS Sipadu sebelum pukul 23:59.</p>',
      deadline: isoAtLocal(today, 0, 23, 59),
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -4, 10, 30),
      updatedAt: isoAtLocal(today, -4, 10, 30),
    },
    {
      id: 'tsk-3',
      classId: classInfo.id,
      courseId: 'crs-so',
      title: 'Analisis Penjadwalan CPU (SJF & Round Robin)',
      descriptionHtml:
        '<p>Hitung rata-rata <b>Waiting Time</b> dan <b>Turnaround Time</b> dari 5 proses uji yang dibagikan di kelas.</p><ol><li>Gambarkan Gantt Chart untuk SJF Preemptive.</li><li>Bandingkan dengan Round Robin (quantum = 3 ms).</li></ol>',
      deadline: isoAtLocal(today, 1, 21, 0),
      createdBy: 'usr-2',
      createdAt: isoAtLocal(today, -3, 14, 0),
      updatedAt: isoAtLocal(today, -3, 14, 0),
    },
    {
      id: 'tsk-4',
      classId: classInfo.id,
      courseId: 'crs-pw',
      title: 'Desain REST API & Validasi Skema JSON',
      descriptionHtml:
        '<p>Rancang spesifikasi endpoint REST untuk modul manajemen inventaris kampus lengkap dengan contoh payload request &amp; response error (400, 404, 422).</p>',
      deadline: isoAtLocal(today, 3, 23, 59),
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -2, 11, 20),
      updatedAt: isoAtLocal(today, -2, 11, 20),
    },
    {
      id: 'tsk-5',
      classId: classInfo.id,
      courseId: 'crs-bd',
      title: 'Normalisasi Skema ERD hingga 3NF',
      descriptionHtml:
        '<p>Ubah studi kasus faktur transaksi perpustakaan dari bentuk UNF menjadi 1NF, 2NF, dan 3NF beserta diagram relasi akhirnya.</p>',
      deadline: isoAtLocal(today, 5, 17, 0),
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -1, 16, 0),
      updatedAt: isoAtLocal(today, -1, 16, 0),
    },
    {
      id: 'tsk-6',
      classId: classInfo.id,
      courseId: 'crs-md',
      title: 'Pembuktian Induksi Matematika & Graf Planar',
      descriptionHtml:
        '<p>Kerjakan soal latihan bab 4 nomor 1–6 di kertas folio bergaris atau ketik rapi menggunakan LaTeX, lalu ekspor ke format PDF.</p>',
      deadline: isoAtLocal(today, 11, 23, 59),
      createdBy: 'usr-2',
      createdAt: isoAtLocal(today, -1, 9, 45),
      updatedAt: isoAtLocal(today, -1, 9, 45),
    },
    {
      id: 'tsk-7',
      classId: classInfo.id,
      courseId: 'crs-pw',
      title: 'Eksplorasi Mandiri: Optimasi Query & Indexing',
      descriptionHtml:
        '<p>Bacaan persiapan praktikum minggu depan mengenai penggunaan <i>composite index</i> pada PostgreSQL. Tidak wajib dikumpulkan, namun akan diujikan pada kuis lisan.</p>',
      deadline: null,
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -5, 13, 0),
      updatedAt: isoAtLocal(today, -5, 13, 0),
    },
    {
      id: 'tsk-8',
      classId: classInfo.id,
      courseId: 'crs-sd',
      title: 'Resume Kompleksitas Waktu & Big-O Notation',
      descriptionHtml:
        '<p>Buat ringkasan 2 halaman mengenai analisis kompleksitas kasus terbaik, rata-rata, dan terburuk untuk Merge Sort dan Quick Sort.</p>',
      deadline: isoAtLocal(today, -3, 23, 59),
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -9, 8, 0),
      updatedAt: isoAtLocal(today, -9, 8, 0),
    },
  ];

  const groupActivities = [
    {
      id: 'ga-pw',
      classId: classInfo.id,
      courseId: 'crs-pw',
      name: 'Proyek Aplikasi Kampus',
      totalParticipants: 14,
      groupCount: 3,
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -7, 10, 0),
    },
    {
      id: 'ga-sd',
      classId: classInfo.id,
      courseId: 'crs-sd',
      name: 'Mini Riset Tree & Graph',
      totalParticipants: 11,
      groupCount: 3,
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -5, 12, 0),
    },
    {
      id: 'ga-so',
      classId: classInfo.id,
      courseId: 'crs-so',
      name: 'CBR 1 — Arsitektur Kernel',
      totalParticipants: 9,
      groupCount: 3,
      createdBy: 'usr-2',
      createdAt: isoAtLocal(today, -15, 9, 0),
    },
  ];

  const groups = [
    { id: 'grp-pw-1', activityId: 'ga-pw', groupNumber: 1, isFinal: false, finalizedAt: null, finalizedBy: null },
    { id: 'grp-pw-2', activityId: 'ga-pw', groupNumber: 2, isFinal: false, finalizedAt: null, finalizedBy: null },
    { id: 'grp-pw-3', activityId: 'ga-pw', groupNumber: 3, isFinal: false, finalizedAt: null, finalizedBy: null },
    { id: 'grp-sd-1', activityId: 'ga-sd', groupNumber: 1, isFinal: false, finalizedAt: null, finalizedBy: null },
    { id: 'grp-sd-2', activityId: 'ga-sd', groupNumber: 2, isFinal: false, finalizedAt: null, finalizedBy: null },
    { id: 'grp-sd-3', activityId: 'ga-sd', groupNumber: 3, isFinal: false, finalizedAt: null, finalizedBy: null },
    { id: 'grp-so-1', activityId: 'ga-so', groupNumber: 1, isFinal: false, finalizedAt: null, finalizedBy: null },
    { id: 'grp-so-2', activityId: 'ga-so', groupNumber: 2, isFinal: false, finalizedAt: null, finalizedBy: null },
    { id: 'grp-so-3', activityId: 'ga-so', groupNumber: 3, isFinal: false, finalizedAt: null, finalizedBy: null },
  ];

  const groupTasks = [
    {
      id: 'gt-1',
      activityId: 'ga-pw',
      title: 'Proposal Topik & Pembagian Fitur',
      descriptionHtml:
        '<p>Kumpulkan dokumen proposal 2 halaman berisi latar belakang masalah, daftar fitur MVP, dan pembagian peran tiap anggota kelompok.</p>',
      deadline: isoAtLocal(today, 2, 23, 59),
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -6, 14, 0),
      updatedAt: isoAtLocal(today, -6, 14, 0),
    },
    {
      id: 'gt-2',
      activityId: 'ga-pw',
      title: 'Repositori GitHub & Wireframe Awal',
      descriptionHtml:
        '<p>Inisialisasi repository kelompok dengan <i>README.md</i> dan tautan Figma wireframe utama.</p>',
      deadline: isoAtLocal(today, 8, 23, 59),
      overrideCollectionLabel: 'Form Submit Repo Proyek PemWeb',
      overrideCollectionUrl: 'https://forms.gle/pemweb-repo-ti3a',
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -4, 10, 0),
      updatedAt: isoAtLocal(today, -4, 10, 0),
    },
    {
      id: 'gt-3',
      activityId: 'ga-sd',
      title: 'Benchmark Performa AVL vs Red-Black Tree',
      descriptionHtml:
        '<p>Uji 10.000 operasi insert dan search pada kedua struktur pohon serta sajikan grafik perbandingan waktu eksekusi.</p>',
      deadline: isoAtLocal(today, 6, 21, 0),
      createdBy: 'usr-1',
      createdAt: isoAtLocal(today, -3, 9, 0),
      updatedAt: isoAtLocal(today, -3, 9, 0),
    },
    {
      id: 'gt-4',
      activityId: 'ga-so',
      title: 'Laporan Final & Slide Presentasi CBR 1',
      descriptionHtml:
        '<p>Finalisasi review arsitektur kernel Linux vs Windows NT dalam format PDF dan slide presentasi.</p>',
      deadline: isoAtLocal(today, -9, 23, 59),
      createdBy: 'usr-2',
      createdAt: isoAtLocal(today, -14, 15, 0),
      updatedAt: isoAtLocal(today, -14, 15, 0),
    },
  ];

  const announcements = [
    {
      id: 'ann-1',
      classId: classInfo.id,
      courseId: 'crs-sd',
      title: 'Perubahan Ruangan Praktikum Struktur Data Minggu Ini',
      content:
        'Teman-teman TI-3A, praktikum Struktur Data hari Rabu minggu ini dipindah ke Lab Komputasi 1 dan dimulai pukul 15:30 WIB karena Lab Algoritma 1 sedang digunakan untuk seminar proposal. Pastikan laptop masing-masing sudah terpasang compiler C++/Python sebelum sesi dimulai.',
      authorId: 'usr-1',
      publishedAt: isoAtLocal(today, 0, 8, 15),
      updatedAt: isoAtLocal(today, 0, 8, 15),
    },
    {
      id: 'ann-2',
      classId: classInfo.id,
      courseId: null,
      title: 'Pendataan Anggota Kelompok Proyek Tengah Semester',
      content:
        'Batas pengisian anggota kelompok pada modul Group Organizer untuk mata kuliah Pemrograman Web dan Struktur Data adalah Jumat pukul 21:00 WIB. Bagi teman-teman yang belum bergabung di kelompok manapun, silakan pilih kelompok yang masih tersedia. Jika ada mahasiswa lintas kelas yang bergabung, hubungi Komting untuk ditambahkan sebagai anggota eksternal.',
      authorId: 'usr-1',
      publishedAt: isoAtLocal(today, -1, 13, 30),
      updatedAt: isoAtLocal(today, -1, 13, 30),
    },
    {
      id: 'ann-3',
      classId: classInfo.id,
      courseId: 'crs-so',
      title: 'Perkuliahan Sistem Operasi Hari Kamis Ditiadakan',
      content:
        'Berdasarkan informasi dari Ibu Rina Kartika, pertemuan Sistem Operasi hari Kamis minggu ini ditiadakan karena beliau menghadiri konferensi akademik. Sebagai gantinya, silakan kerjakan tugas analisis penjadwalan CPU yang sudah dibagikan di Task Planner.',
      authorId: 'usr-2',
      publishedAt: isoAtLocal(today, -2, 16, 40),
      updatedAt: isoAtLocal(today, -2, 16, 40),
    },
  ];

  return {
    classInfo,
    courses,
    schedules,
    scheduleExceptions,
    individualTasks,
    groupActivities,
    groups,
    groupTasks,
    announcements,
  };
}
