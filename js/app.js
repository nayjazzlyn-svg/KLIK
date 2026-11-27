import { renderAnnouncementsView } from './announcements.js';
import { renderLoginScreen } from './auth.js';
import { renderDashboard, tickDashboardCountdown } from './dashboard.js';
import { renderGroupsView } from './groups.js';
import { icon } from './icons.js';
import {
  openAvatarGalleryModal,
  openChangePasswordModal,
  openDevTestingModal,
  openRosterProvisioningModal,
  refreshCourseCollectionModalIfOpen,
  refreshDevModalIfOpen,
  refreshRosterModalIfOpen,
} from './modal.js';
import {
  renderHeaderNotifications,
  resetNotificationsPopover,
} from './notifications.js';
import { renderScheduleView } from './schedule.js';
import {
  getCurrentUser,
  getEffectiveRole,
  getMembershipTitle,
  getStoreState,
  getWorkspaceViewState,
  initStore,
  isAuthenticated,
  logout,
  navigateTo,
  setMobileMenuOpen,
  subscribeStore,
  toggleSidebarCollapse,
  updateClockNow,
} from './state.js';
import { renderTasksView } from './tasks.js';
import { escapeHtml } from './utils.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layoutDashboard' },
  { id: 'jadwal', label: 'Jadwal Kuliah', icon: 'calendarDays' },
  { id: 'tugas', label: 'Task Planner', icon: 'checkSquare' },
  { id: 'kelompok', label: 'Group Organizer', icon: 'users' },
  { id: 'pengumuman', label: 'Pengumuman', icon: 'megaphone' },
];

const SECTION_META = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Ringkasan aktivitas kelas hari ini',
  },
  jadwal: {
    title: 'Jadwal Kuliah',
    subtitle: 'Kalender bersama dan perubahan pertemuan kelas',
  },
  tugas: {
    title: 'Task Planner',
    subtitle: 'Daftar tugas individu kelas dan progres penyelesaian',
  },
  kelompok: {
    title: 'Group Organizer',
    subtitle: 'Pembentukan kelompok dan tugas kolaborasi mata kuliah',
  },
  pengumuman: {
    title: 'Pengumuman',
    subtitle: 'Pusat informasi resmi kelas',
  },
};

function renderSidebarBody(isMobile) {
  const store = getStoreState();
  const viewState = getWorkspaceViewState();
  const currentUser = getCurrentUser();
  const effectiveRole = getEffectiveRole();
  const membershipTitle = getMembershipTitle();
  const isCompact = !isMobile && store.sidebarCollapsed;

  return `
    <div class="klik-sidebar-body">
      <div class="klik-sidebar-brand ${isCompact ? 'is-compact' : ''}">
        <div style="min-width:0;display:${isCompact ? 'none' : 'block'};">
          <div class="klik-sidebar-brand-row">
            <img
  src="public/klik-logo.svg.png"
  alt="KLIK"
  class="klik-logo-badge klik-logo-badge--sm"
/>
            <span class="klik-sidebar-brand-title">KLIK</span>
            <span class="klik-sidebar-brand-code">${escapeHtml(
    viewState.classInfo.code
  )}</span>
          </div>
          <p class="klik-sidebar-tagline truncate">Semua Aktivitas Kelas, Satu Klik.</p>
        </div>

        ${isCompact
      ? `<div class="klik-logo-badge klik-logo-badge--md" title="KLIK — Semua Aktivitas Kelas, Satu Klik.">K</div>`
      : ''
    }

        ${isMobile
      ? `<button type="button" class="klik-icon-btn" data-shell-close-mobile aria-label="Tutup menu">
                ${icon('x', 16)}
              </button>`
      : `<button type="button" class="klik-icon-btn ${isCompact ? 'hidden' : ''
      }" data-shell-toggle-collapse title="Ciutkan sidebar" aria-label="Ciutkan sidebar">
                ${icon('chevronLeft', 16)}
              </button>`
    }
      </div>

      ${isCompact
      ? `<div class="klik-sidebar-expand-row">
              <button type="button" class="klik-icon-btn" data-shell-toggle-collapse title="Lebarkan sidebar" aria-label="Lebarkan sidebar">
                ${icon('chevronRight', 16)}
              </button>
            </div>`
      : ''
    }

      <nav aria-label="Navigasi Utama" class="klik-nav">
        ${NAV_ITEMS.map((item) => {
      const isActive = store.activeSection === item.id;
      return `
            <button
              type="button"
              data-shell-nav="${item.id}"
              ${isCompact ? `title="${escapeHtml(item.label)}"` : ''}
              class="klik-nav-item ${isCompact ? 'is-compact' : ''} ${isActive ? 'is-active' : ''
        }"
            >
              ${icon(item.icon, 16)}
              ${!isCompact
          ? `<span class="truncate whitespace-nowrap">${escapeHtml(
            item.label
          )}</span>`
          : ''
        }
            </button>
          `;
    }).join('')}
      </nav>

      <div class="klik-sidebar-footer">
        <div class="klik-sidebar-user-row ${isCompact ? 'is-compact' : ''}">
          <div class="klik-sidebar-user-info" title="${escapeHtml(
      `${currentUser.name} (${currentUser.nim})`
    )}">
            <div class="klik-avatar" data-shell-open-avatar title="Pilih Avatar">
  ${escapeHtml(
      ({
        'avatar-1': '🦊',
        'avatar-2': '🐼',
        'avatar-3': '🐱',
        'avatar-4': '🐰',
        'avatar-5': '🐻',
        'avatar-6': '🐸',
        'avatar-7': '🐧',
        'avatar-8': '🦄',
      }[currentUser.avatarId] || currentUser.avatarInitials || 'MH')
    )}
</div>
            ${!isCompact
      ? `
              <div style="min-width:0;">
                <p class="truncate" style="font-size:12px;font-weight:500;color:var(--text-primary);">${escapeHtml(
        currentUser.name
      )}</p>
                <p class="truncate" style="font-size:11px;color:var(--text-muted);">
                  <span class="mono">${escapeHtml(currentUser.nim)}</span>
                  <span aria-hidden="true"> · </span>
                  <span style="color:${effectiveRole === 'admin'
        ? 'var(--emerald-text)'
        : 'var(--text-muted)'
      };">${escapeHtml(membershipTitle)}</span>
                </p>
              </div>
            `
      : ''
    }
          </div>

          <div class="klik-sidebar-actions ${isCompact ? 'is-compact' : ''}">
            <button type="button" class="klik-icon-btn" data-shell-change-pw title="Ubah Password" aria-label="Ubah Password">
              ${icon('keyRound', 16)}
            </button>
            <button type="button" class="klik-icon-btn klik-icon-btn--danger" data-shell-logout title="Keluar" aria-label="Keluar dari akun">
              ${icon('logOut', 16)}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderActiveSection(mainHost) {
  if (!mainHost) return;
  const activeSection = getStoreState().activeSection;

  if (activeSection === 'dashboard') {
    renderDashboard(mainHost);
  } else if (activeSection === 'jadwal') {
    renderScheduleView(mainHost);
  } else if (activeSection === 'tugas') {
    renderTasksView(mainHost);
  } else if (activeSection === 'kelompok') {
    renderGroupsView(mainHost);
  } else if (activeSection === 'pengumuman') {
    renderAnnouncementsView(mainHost);
  }
}

function renderWorkspaceShell(appRoot) {
  const store = getStoreState();
  const viewState = getWorkspaceViewState();
  const effectiveRole = getEffectiveRole();
  const meta = SECTION_META[store.activeSection] ?? SECTION_META.dashboard;

  // Preserve active input focus inside #app (e.g. search bar during live snapshot)
  const activeId = document.activeElement?.id || null;
  const selectionStart =
    document.activeElement && 'selectionStart' in document.activeElement
      ? document.activeElement.selectionStart
      : null;

  appRoot.innerHTML = `
    <div class="klik-shell">
      <aside class="klik-sidebar-desktop ${store.sidebarCollapsed ? 'is-collapsed' : ''
    }">
        <div class="klik-sidebar-sticky">
          ${renderSidebarBody(false)}
        </div>
      </aside>

      ${store.mobileMenuOpen
      ? `
        <div class="klik-mobile-drawer-backdrop" id="klik-mobile-backdrop">
          <aside class="klik-mobile-drawer" id="klik-mobile-drawer">
            ${renderSidebarBody(true)}
          </aside>
        </div>
      `
      : ''
    }

      <div class="klik-main-col">
        <header class="klik-header">
          <div class="klik-header-inner">
            <div class="klik-header-left">
              <button type="button" id="klik-open-mobile-menu" class="klik-mobile-menu-btn" aria-label="Buka menu navigasi">
                ${icon('menu', 20)}
              </button>

              <div class="klik-breadcrumb">
                <span class="klik-breadcrumb-title truncate">${escapeHtml(
      meta.title
    )}</span>
                <span class="klik-breadcrumb-sep text-sep" aria-hidden="true">/</span>
                <span class="klik-breadcrumb-meta truncate text-muted" style="font-size:12px;">
                  ${escapeHtml(viewState.classInfo.name)} · ${escapeHtml(
      viewState.classInfo.semester
    )}
                </span>
              </div>
            </div>

            <div class="klik-header-right">
              ${effectiveRole === 'admin'
      ? `
                <button
                  type="button"
                  id="klik-open-roster-btn"
                  class="klik-header-pill-btn"
                  title="Kelola anggota & kode aktivasi kelas"
                >
                  ${icon('users', 14, 'text-emerald')}
                  <span class="klik-header-pill-label">Anggota &amp; Aktivasi</span>
                </button>
              `
      : ''
    }
              <div id="klik-notif-host"></div>
            </div>
          </div>
        </header>

        <main class="klik-main">
          <div class="klik-main-inner" id="klik-main-content"></div>
        </main>
      </div>
    </div>
  `;

  // Bind shell interactions
  appRoot.querySelectorAll('[data-shell-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.getAttribute('data-shell-nav');
      if (section) {
        setMobileMenuOpen(false);
        navigateTo({ section });
      }
    });
  });

  appRoot.querySelectorAll('[data-shell-open-avatar]').forEach((btn) => {
    btn.addEventListener('click', () => openAvatarGalleryModal());
  });

  appRoot.querySelectorAll('[data-shell-close-mobile]').forEach((btn) => {
    btn.addEventListener('click', () => setMobileMenuOpen(false));
  });

  appRoot
    .querySelector('#klik-mobile-backdrop')
    ?.addEventListener('click', () => setMobileMenuOpen(false));

  appRoot
    .querySelector('#klik-mobile-drawer')
    ?.addEventListener('click', (e) => e.stopPropagation());

  appRoot
    .querySelector('#klik-open-mobile-menu')
    ?.addEventListener('click', () => setMobileMenuOpen(true));

  appRoot.querySelectorAll('[data-shell-change-pw]').forEach((btn) => {
    btn.addEventListener('click', () => openChangePasswordModal());
  });

  appRoot.querySelectorAll('[data-shell-logout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      resetNotificationsPopover();
      void logout();
    });
  });

  appRoot
    .querySelector('#klik-open-roster-btn')
    ?.addEventListener('click', () => openRosterProvisioningModal());

  const notifHost = appRoot.querySelector('#klik-notif-host');
  renderHeaderNotifications(notifHost);

  const mainContent = appRoot.querySelector('#klik-main-content');
  renderActiveSection(mainContent);

  // Restore focus if the user was typing in search filter during live snapshot
  if (activeId) {
    const restored = document.getElementById(activeId);
    if (restored && typeof restored.focus === 'function') {
      restored.focus();
      if (
        selectionStart !== null &&
        typeof restored.setSelectionRange === 'function'
      ) {
        try {
          restored.setSelectionRange(selectionStart, selectionStart);
        } catch {
          // Ignore inputs that don't support setSelectionRange
        }
      }
    }
  }
}

function renderBootScreen(appRoot, label) {
  appRoot.innerHTML = `
    <div class="klik-boot-screen">
      <div class="klik-logo-badge klik-logo-badge--lg" style="margin-bottom:16px;">K</div>
      <p style="font-size:14px;font-weight:500;color:var(--text-body);">${escapeHtml(
    label
  )}</p>
      <p style="margin-top:4px;font-size:12px;color:var(--text-dim);">KLIK — Semua Aktivitas Kelas, Satu Klik.</p>
    </div>
  `;
}

function renderApp(reason = 'state') {
  const appRoot = document.getElementById('app');
  if (!appRoot) return;

  const store = getStoreState();

  if (reason === 'roster') {
    refreshRosterModalIfOpen();
    return;
  }

  if (!store.authReady) {
    renderBootScreen(appRoot, 'Memeriksa sesi kelas...');
    return;
  }

  if (!isAuthenticated()) {
    resetNotificationsPopover();
    renderLoginScreen(appRoot);
    return;
  }

  if (store.workspaceLoading) {
    renderBootScreen(appRoot, 'Menghubungkan ke workspace kelas...');
    return;
  }

  renderWorkspaceShell(appRoot);
  refreshRosterModalIfOpen();
  refreshDevModalIfOpen();
  refreshCourseCollectionModalIfOpen();
}

function bindGlobalShortcuts() {
  window.addEventListener('keydown', (e) => {
    const keyD = e.key.toLowerCase() === 'd';
    if ((e.ctrlKey || e.metaKey || e.altKey) && e.shiftKey && keyD) {
      e.preventDefault();
      openDevTestingModal();
    }
  });
}

function startLiveClock() {
  let prevMinute = getStoreState().now.getMinutes();

  window.setInterval(() => {
    const nextNow = new Date();
    updateClockNow(nextNow);

    if (isAuthenticated() && !getStoreState().workspaceLoading) {
      tickDashboardCountdown();

      const nextMinute = nextNow.getMinutes();
      if (nextMinute !== prevMinute) {
        prevMinute = nextMinute;
        const activeTag = document.activeElement?.tagName;
        const isTyping =
          activeTag === 'INPUT' ||
          activeTag === 'TEXTAREA' ||
          document.activeElement?.isContentEditable;
        if (!isTyping) {
          const section = getStoreState().activeSection;
          if (
            section === 'dashboard' ||
            section === 'jadwal' ||
            section === 'tugas'
          ) {
            const mainContent = document.getElementById('klik-main-content');
            renderActiveSection(mainContent);
          }
        }
      }
    } else {
      prevMinute = nextNow.getMinutes();
    }
  }, 1000);
}

function bootstrap() {
  window.addEventListener('error', (e) => {
    console.error('KLIK runtime error:', e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('KLIK unhandled rejection:', e.reason);
  });

  bindGlobalShortcuts();
  subscribeStore((reason) => renderApp(reason));
  renderApp('boot');
  initStore();
  startLiveClock();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
