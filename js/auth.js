import { icon } from './icons.js';
import {
  activateAccount,
  clearAuthError,
  createClassAccount,
  getStoreState,
  loginWithNimPassword,
} from './state.js';
import { escapeHtml } from './utils.js';

const authUi = {
  mode: 'login', // 'login' | 'activate' | 'create_class'
  submitting: false,
  error: null,
  showForgotHelp: false,
  nim: '',
  password: '',
  confirmPassword: '',
  showPassword: false,
  classCode: '',
  activationCode: '',
  name: '',
  className: '',
  semester: 'Semester 5',
  academicYear: '2025/2026',
  seedSampleData: true,
};

function switchMode(container, nextMode) {
  authUi.mode = nextMode;
  authUi.error = null;
  clearAuthError();
  authUi.showForgotHelp = false;
  authUi.password = '';
  authUi.confirmPassword = '';
  authUi.showPassword = false;
  renderLoginScreen(container);
}

export function renderLoginScreen(container) {
  if (!container) return;
  const store = getStoreState();
  const displayedError = authUi.error ?? store.authError;

  container.innerHTML = `
    <div class="klik-auth-page">
      <div class="klik-auth-container">
        <div class="klik-auth-brand">
          <div class="klik-logo-badge klik-logo-badge--lg">K</div>
          <h1>KLIK</h1>
          <p>Semua Aktivitas Kelas, Satu Klik.</p>
        </div>

        ${
          authUi.mode === 'login'
            ? `
          <div class="klik-auth-card">
            <div class="klik-auth-card-head">
              <h2>Masuk ke Workspace Kelas</h2>
              <p>
                Gunakan NIM dan password akun kelas Anda untuk mengakses jadwal,
                tugas, kelompok, dan pengumuman.
              </p>
            </div>

            ${
              displayedError
                ? `<div role="alert" class="klik-alert klik-alert--error" style="margin-bottom:16px;">${escapeHtml(
                    displayedError
                  )}</div>`
                : ''
            }

            <form id="klik-auth-login-form" class="klik-stack-sm">
              <div>
                <label for="klik-login-nim" class="klik-label">Nomor Induk Mahasiswa (NIM)</label>
                <input
                  id="klik-login-nim"
                  type="text"
                  autocomplete="username"
                  value="${escapeHtml(authUi.nim)}"
                  placeholder="Contoh: 230104001"
                  class="klik-input klik-input--dark mono"
                />
              </div>

              <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                  <label for="klik-login-password" class="klik-label" style="margin-bottom:0;">Password</label>
                  <button type="button" id="klik-toggle-forgot" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--text-muted);cursor:pointer;">
                    ${icon('helpCircle', 12)}
                    <span>Lupa password?</span>
                  </button>
                </div>
                <div class="klik-input-wrap">
                  <input
                    id="klik-login-password"
                    type="${authUi.showPassword ? 'text' : 'password'}"
                    autocomplete="current-password"
                    value="${escapeHtml(authUi.password)}"
                    placeholder="Masukkan password Anda"
                    class="klik-input klik-input--dark klik-input-with-eye"
                  />
                  <button
                    type="button"
                    id="klik-toggle-pw-eye"
                    class="klik-input-eye-btn"
                    aria-label="${
                      authUi.showPassword
                        ? 'Sembunyikan password'
                        : 'Lihat password'
                    }"
                  >
                    ${icon(authUi.showPassword ? 'eyeOff' : 'eye', 16)}
                  </button>
                </div>
              </div>

              ${
                authUi.showForgotHelp
                  ? `
                <div class="klik-help-box">
                  <p class="klik-help-box-title">Bantuan Reset Password</p>
                  <p style="margin-top:4px;">
                    Karena akun masuk menggunakan NIM internal (tanpa alamat email eksternal),
                    tautan reset password via email tidak tersedia. Jika Anda masih ingat password
                    dan ingin menggantinya, gunakan menu <span style="color:var(--text-body);">Ubah Password</span>
                    setelah masuk. Jika lupa saat keluar, hubungi Komting untuk penanganan akun kelas.
                  </p>
                </div>
              `
                  : ''
              }

              <button type="submit" id="klik-auth-submit" class="klik-btn klik-btn--primary klik-btn--lg" ${
                authUi.submitting ? 'disabled' : ''
              }>
                <span>${authUi.submitting ? 'Memverifikasi...' : 'Masuk'}</span>
                ${icon('arrowRight', 16)}
              </button>
            </form>

            <div class="klik-auth-divider-links">
              <button type="button" id="klik-go-activate" class="klik-auth-switch-btn">
                <span style="display:flex;align-items:center;gap:8px;">
                  <span class="text-emerald">${icon('keyRound', 14)}</span>
                  <span>Belum aktivasi akun? Aktivasi dengan Kode</span>
                </span>
                <span class="text-dim">${icon('arrowRight', 14)}</span>
              </button>

              <button type="button" id="klik-go-create-class" class="klik-auth-subtle-link">
                <span style="display:flex;align-items:center;gap:6px;">
                  ${icon('plus', 14)}
                  <span>Buat workspace kelas baru (Komting)</span>
                </span>
                <span class="text-dim">${icon('arrowRight', 12)}</span>
              </button>
            </div>
          </div>
        `
            : authUi.mode === 'activate'
            ? `
          <div class="klik-auth-card">
            <button type="button" id="klik-back-login" class="klik-auth-back-btn">
              ${icon('arrowLeft', 14)}
              <span>Kembali ke Masuk</span>
            </button>

            <div class="klik-auth-card-head">
              <h2>Aktivasi Akun Mahasiswa</h2>
              <p>
                Masukkan Kode Kelas, NIM yang sudah didaftarkan Komting, dan Kode
                Aktivasi untuk membuat password akun Anda.
              </p>
            </div>

            ${
              displayedError
                ? `<div role="alert" class="klik-alert klik-alert--error" style="margin-bottom:16px;">${escapeHtml(
                    displayedError
                  )}</div>`
                : ''
            }

            <form id="klik-auth-activate-form" class="klik-stack-sm">
              <div class="klik-grid-form-2">
                <div>
                  <label for="klik-act-class-code" class="klik-label">Kode Kelas</label>
                  <input
                    id="klik-act-class-code"
                    type="text"
                    value="${escapeHtml(authUi.classCode)}"
                    placeholder="TI-3A"
                    style="text-transform:uppercase;"
                    class="klik-input klik-input--dark mono"
                  />
                </div>
                <div>
                  <label for="klik-act-code" class="klik-label">Kode Aktivasi</label>
                  <input
                    id="klik-act-code"
                    type="text"
                    value="${escapeHtml(authUi.activationCode)}"
                    placeholder="A7K9M2P4"
                    style="text-transform:uppercase;"
                    class="klik-input klik-input--dark mono"
                  />
                </div>
              </div>

              <div>
                <label for="klik-act-nim" class="klik-label">Nomor Induk Mahasiswa (NIM)</label>
                <input
                  id="klik-act-nim"
                  type="text"
                  value="${escapeHtml(authUi.nim)}"
                  placeholder="Contoh: 230104001"
                  class="klik-input klik-input--dark mono"
                />
              </div>

              <div>
                <label for="klik-act-password" class="klik-label">Password Baru (min. 6 karakter)</label>
                <div class="klik-input-wrap">
                  <input
                    id="klik-act-password"
                    type="${authUi.showPassword ? 'text' : 'password'}"
                    autocomplete="new-password"
                    value="${escapeHtml(authUi.password)}"
                    placeholder="Buat password akun Anda"
                    class="klik-input klik-input--dark klik-input-with-eye"
                  />
                  <button
                    type="button"
                    id="klik-toggle-pw-eye"
                    class="klik-input-eye-btn"
                    aria-label="${
                      authUi.showPassword
                        ? 'Sembunyikan password'
                        : 'Lihat password'
                    }"
                  >
                    ${icon(authUi.showPassword ? 'eyeOff' : 'eye', 16)}
                  </button>
                </div>
              </div>

              <div>
                <label for="klik-act-confirm" class="klik-label">Konfirmasi Password</label>
                <input
                  id="klik-act-confirm"
                  type="${authUi.showPassword ? 'text' : 'password'}"
                  autocomplete="new-password"
                  value="${escapeHtml(authUi.confirmPassword)}"
                  placeholder="Ulangi password baru"
                  class="klik-input klik-input--dark"
                />
              </div>

              <button type="submit" id="klik-auth-submit" class="klik-btn klik-btn--primary klik-btn--lg" ${
                authUi.submitting ? 'disabled' : ''
              }>
                <span>${
                  authUi.submitting
                    ? 'Mengaktifkan...'
                    : 'Aktifkan Akun & Masuk'
                }</span>
                ${icon('arrowRight', 16)}
              </button>
            </form>

            <p style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-subtle);font-size:11px;line-height:1.6;color:var(--text-dim);">
              Pendaftaran hanya diizinkan untuk NIM yang telah didaftarkan oleh Komting ke daftar anggota kelas.
            </p>
          </div>
        `
            : `
          <div class="klik-auth-card">
            <button type="button" id="klik-back-login" class="klik-auth-back-btn">
              ${icon('arrowLeft', 14)}
              <span>Kembali ke Masuk</span>
            </button>

            <div class="klik-auth-card-head">
              <h2>Buat Workspace Kelas Baru</h2>
              <p>
                Siapkan workspace kelas sekaligus akun Komting utama untuk
                mengelola jadwal, tugas, dan daftar mahasiswa.
              </p>
            </div>

            ${
              displayedError
                ? `<div role="alert" class="klik-alert klik-alert--error" style="margin-bottom:16px;">${escapeHtml(
                    displayedError
                  )}</div>`
                : ''
            }

            <form id="klik-auth-create-form" class="klik-stack-sm">
              <div class="klik-grid-form-2">
                <div>
                  <label for="klik-create-code" class="klik-label">Kode Kelas</label>
                  <input
                    id="klik-create-code"
                    type="text"
                    value="${escapeHtml(authUi.classCode)}"
                    placeholder="TI-3A"
                    style="text-transform:uppercase;"
                    class="klik-input klik-input--dark mono"
                  />
                </div>
                <div>
                  <label for="klik-create-nim" class="klik-label">NIM Komting</label>
                  <input
                    id="klik-create-nim"
                    type="text"
                    value="${escapeHtml(authUi.nim)}"
                    placeholder="230104001"
                    class="klik-input klik-input--dark mono"
                  />
                </div>
              </div>

              <div>
                <label for="klik-create-class-name" class="klik-label">Nama Kelas / Program Studi</label>
                <input
                  id="klik-create-class-name"
                  type="text"
                  value="${escapeHtml(authUi.className)}"
                  placeholder="Misal: Teknik Informatika 3A"
                  class="klik-input klik-input--dark"
                />
              </div>

              <div class="klik-grid-form-2">
                <div>
                  <label for="klik-create-semester" class="klik-label">Semester</label>
                  <input
                    id="klik-create-semester"
                    type="text"
                    value="${escapeHtml(authUi.semester)}"
                    placeholder="Semester 5"
                    class="klik-input klik-input--dark klik-input--sm"
                  />
                </div>
                <div>
                  <label for="klik-create-year" class="klik-label">Tahun Akademik</label>
                  <input
                    id="klik-create-year"
                    type="text"
                    value="${escapeHtml(authUi.academicYear)}"
                    placeholder="2025/2026"
                    class="klik-input klik-input--dark klik-input--sm mono"
                  />
                </div>
              </div>

              <div>
                <label for="klik-create-name" class="klik-label">Nama Lengkap Komting</label>
                <input
                  id="klik-create-name"
                  type="text"
                  value="${escapeHtml(authUi.name)}"
                  placeholder="Nama lengkap Anda"
                  class="klik-input klik-input--dark"
                />
              </div>

              <div class="klik-grid-form-2">
                <div>
                  <label for="klik-create-password" class="klik-label">Password</label>
                  <input
                    id="klik-create-password"
                    type="${authUi.showPassword ? 'text' : 'password'}"
                    autocomplete="new-password"
                    value="${escapeHtml(authUi.password)}"
                    placeholder="Min. 6 karakter"
                    class="klik-input klik-input--dark"
                  />
                </div>
                <div>
                  <label for="klik-create-confirm" class="klik-label">Konfirmasi Password</label>
                  <input
                    id="klik-create-confirm"
                    type="${authUi.showPassword ? 'text' : 'password'}"
                    autocomplete="new-password"
                    value="${escapeHtml(authUi.confirmPassword)}"
                    placeholder="Ulangi password"
                    class="klik-input klik-input--dark"
                  />
                </div>
              </div>

              <label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-muted);cursor:pointer;">
                <input type="checkbox" id="klik-create-show-pw" ${
                  authUi.showPassword ? 'checked' : ''
                } style="accent-color:var(--emerald);" />
                <span>Tampilkan password</span>
              </label>

              <label class="klik-subpanel" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;font-size:12px;color:var(--text-secondary);cursor:pointer;">
                <input type="checkbox" id="klik-create-seed" ${
                  authUi.seedSampleData ? 'checked' : ''
                } style="margin-top:2px;accent-color:var(--emerald);" />
                <span style="line-height:1.5;">
                  Isi contoh mata kuliah, jadwal &amp; tugas awal agar workspace siap langsung dieksplorasi
                </span>
              </label>

              <button type="submit" id="klik-auth-submit" class="klik-btn klik-btn--primary klik-btn--lg" ${
                authUi.submitting ? 'disabled' : ''
              }>
                <span>${
                  authUi.submitting
                    ? 'Membuat Workspace...'
                    : 'Buat Kelas & Jadi Komting'
                }</span>
                ${icon('arrowRight', 16)}
              </button>
            </form>
          </div>
        `
        }
      </div>
    </div>
  `;

  // Bind common listeners
  container
    .querySelector('#klik-go-activate')
    ?.addEventListener('click', () => switchMode(container, 'activate'));
  container
    .querySelector('#klik-go-create-class')
    ?.addEventListener('click', () => switchMode(container, 'create_class'));
  container
    .querySelector('#klik-back-login')
    ?.addEventListener('click', () => switchMode(container, 'login'));

  container
    .querySelector('#klik-toggle-forgot')
    ?.addEventListener('click', () => {
      authUi.showForgotHelp = !authUi.showForgotHelp;
      renderLoginScreen(container);
    });

  container
    .querySelector('#klik-toggle-pw-eye')
    ?.addEventListener('click', () => {
      authUi.showPassword = !authUi.showPassword;
      renderLoginScreen(container);
    });

  const clearErrorBanner = () => {
    authUi.error = null;
    clearAuthError();
    const alertEl = container.querySelector('[role="alert"]');
    if (alertEl) alertEl.remove();
  };

  if (authUi.mode === 'login') {
    const nimEl = container.querySelector('#klik-login-nim');
    const pwEl = container.querySelector('#klik-login-password');

    nimEl?.addEventListener('input', (e) => {
      authUi.nim = e.target.value;
      clearErrorBanner();
    });
    pwEl?.addEventListener('input', (e) => {
      authUi.password = e.target.value;
      clearErrorBanner();
    });

    container
      .querySelector('#klik-auth-login-form')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (authUi.submitting) return;
        authUi.error = null;
        clearAuthError();

        const cleanNim = authUi.nim.trim();
        if (!/^[A-Za-z0-9_-]{3,32}$/.test(cleanNim)) {
          authUi.error =
            'NIM harus terdiri dari 3–32 karakter (huruf, angka, tanda hubung -, atau _).';
          renderLoginScreen(container);
          return;
        }
        if (authUi.password.length < 6) {
          authUi.error = 'Password minimal 6 karakter.';
          renderLoginScreen(container);
          return;
        }

        authUi.submitting = true;
        renderLoginScreen(container);
        try {
          const res = await loginWithNimPassword(cleanNim, authUi.password);
          if (!res.ok) {
            authUi.error = res.error ?? 'NIM atau password tidak valid.';
          }
        } finally {
          authUi.submitting = false;
          if (!getStoreState().firebaseUser) {
            renderLoginScreen(container);
          }
        }
      });
  } else if (authUi.mode === 'activate') {
    const codeEl = container.querySelector('#klik-act-class-code');
    const actEl = container.querySelector('#klik-act-code');
    const nimEl = container.querySelector('#klik-act-nim');
    const pwEl = container.querySelector('#klik-act-password');
    const confEl = container.querySelector('#klik-act-confirm');

    codeEl?.addEventListener('input', (e) => {
      authUi.classCode = e.target.value.toUpperCase();
      e.target.value = authUi.classCode;
      clearErrorBanner();
    });
    actEl?.addEventListener('input', (e) => {
      authUi.activationCode = e.target.value.toUpperCase();
      e.target.value = authUi.activationCode;
      clearErrorBanner();
    });
    nimEl?.addEventListener('input', (e) => {
      authUi.nim = e.target.value;
      clearErrorBanner();
    });
    pwEl?.addEventListener('input', (e) => {
      authUi.password = e.target.value;
      clearErrorBanner();
    });
    confEl?.addEventListener('input', (e) => {
      authUi.confirmPassword = e.target.value;
      clearErrorBanner();
    });

    container
      .querySelector('#klik-auth-activate-form')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (authUi.submitting) return;
        authUi.error = null;
        clearAuthError();

        const cleanCode = authUi.classCode.trim().toUpperCase();
        const cleanNim = authUi.nim.trim();
        const cleanActivation = authUi.activationCode.trim().toUpperCase();

        if (!/^[A-Z0-9_-]{2,32}$/.test(cleanCode)) {
          authUi.error =
            'Kode kelas harus 2–32 karakter (huruf, angka, tanda hubung -, atau _).';
          renderLoginScreen(container);
          return;
        }
        if (!/^[A-Za-z0-9_-]{3,32}$/.test(cleanNim)) {
          authUi.error =
            'NIM harus terdiri dari 3–32 karakter (huruf, angka, tanda hubung -, atau _).';
          renderLoginScreen(container);
          return;
        }
        if (cleanActivation.length < 4) {
          authUi.error = 'Masukkan kode aktivasi yang diberikan oleh Komting.';
          renderLoginScreen(container);
          return;
        }
        if (authUi.password.length < 6) {
          authUi.error = 'Password baru minimal 6 karakter.';
          renderLoginScreen(container);
          return;
        }
        if (authUi.password !== authUi.confirmPassword) {
          authUi.error = 'Konfirmasi password tidak sesuai.';
          renderLoginScreen(container);
          return;
        }

        authUi.submitting = true;
        renderLoginScreen(container);
        try {
          const res = await activateAccount({
            nim: cleanNim,
            classCode: cleanCode,
            activationCode: cleanActivation,
            password: authUi.password,
          });
          if (!res.ok) {
            authUi.error = res.error ?? 'Gagal mengaktifkan akun.';
          }
        } finally {
          authUi.submitting = false;
          if (!getStoreState().firebaseUser) {
            renderLoginScreen(container);
          }
        }
      });
  } else {
    const codeEl = container.querySelector('#klik-create-code');
    const nimEl = container.querySelector('#klik-create-nim');
    const classNameEl = container.querySelector('#klik-create-class-name');
    const semEl = container.querySelector('#klik-create-semester');
    const yearEl = container.querySelector('#klik-create-year');
    const nameEl = container.querySelector('#klik-create-name');
    const pwEl = container.querySelector('#klik-create-password');
    const confEl = container.querySelector('#klik-create-confirm');
    const showPwCb = container.querySelector('#klik-create-show-pw');
    const seedCb = container.querySelector('#klik-create-seed');

    codeEl?.addEventListener('input', (e) => {
      authUi.classCode = e.target.value.toUpperCase();
      e.target.value = authUi.classCode;
      clearErrorBanner();
    });
    nimEl?.addEventListener('input', (e) => {
      authUi.nim = e.target.value;
      clearErrorBanner();
    });
    classNameEl?.addEventListener('input', (e) => {
      authUi.className = e.target.value;
      clearErrorBanner();
    });
    semEl?.addEventListener('input', (e) => {
      authUi.semester = e.target.value;
    });
    yearEl?.addEventListener('input', (e) => {
      authUi.academicYear = e.target.value;
    });
    nameEl?.addEventListener('input', (e) => {
      authUi.name = e.target.value;
      clearErrorBanner();
    });
    pwEl?.addEventListener('input', (e) => {
      authUi.password = e.target.value;
      clearErrorBanner();
    });
    confEl?.addEventListener('input', (e) => {
      authUi.confirmPassword = e.target.value;
      clearErrorBanner();
    });
    showPwCb?.addEventListener('change', (e) => {
      authUi.showPassword = e.target.checked;
      renderLoginScreen(container);
    });
    seedCb?.addEventListener('change', (e) => {
      authUi.seedSampleData = e.target.checked;
    });

    container
      .querySelector('#klik-auth-create-form')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (authUi.submitting) return;
        authUi.error = null;
        clearAuthError();

        const cleanCode = authUi.classCode.trim().toUpperCase();
        const cleanClassName = authUi.className.trim();
        const cleanSemester = authUi.semester.trim();
        const cleanYear = authUi.academicYear.trim();
        const cleanName = authUi.name.trim();
        const cleanNim = authUi.nim.trim();

        if (!/^[A-Z0-9_-]{2,32}$/.test(cleanCode)) {
          authUi.error =
            'Kode kelas harus 2–32 karakter (huruf, angka, tanda hubung -, atau _).';
          renderLoginScreen(container);
          return;
        }
        if (!cleanClassName) {
          authUi.error = 'Nama kelas wajib diisi.';
          renderLoginScreen(container);
          return;
        }
        if (!cleanSemester || !cleanYear) {
          authUi.error = 'Semester dan tahun akademik wajib diisi.';
          renderLoginScreen(container);
          return;
        }
        if (!cleanName) {
          authUi.error = 'Nama lengkap Komting wajib diisi.';
          renderLoginScreen(container);
          return;
        }
        if (!/^[A-Za-z0-9_-]{3,32}$/.test(cleanNim)) {
          authUi.error =
            'NIM harus terdiri dari 3–32 karakter (huruf, angka, tanda hubung -, atau _).';
          renderLoginScreen(container);
          return;
        }
        if (authUi.password.length < 6) {
          authUi.error = 'Password minimal 6 karakter.';
          renderLoginScreen(container);
          return;
        }
        if (authUi.password !== authUi.confirmPassword) {
          authUi.error = 'Konfirmasi password tidak sesuai.';
          renderLoginScreen(container);
          return;
        }

        authUi.submitting = true;
        renderLoginScreen(container);
        try {
          const res = await createClassAccount({
            nim: cleanNim,
            name: cleanName,
            password: authUi.password,
            classCode: cleanCode,
            className: cleanClassName,
            semester: cleanSemester,
            academicYear: cleanYear,
            seedSampleData: authUi.seedSampleData,
          });
          if (!res.ok) {
            authUi.error = res.error ?? 'Gagal membuat workspace kelas baru.';
          }
        } finally {
          authUi.submitting = false;
          if (!getStoreState().firebaseUser) {
            renderLoginScreen(container);
          }
        }
      });
  }
}
