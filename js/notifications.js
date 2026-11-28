import { icon } from './icons.js';
import {
  getUnreadNotificationsCount,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  navigateTo,
} from './state.js';
import { escapeHtml, formatAnnouncementDate } from './utils.js';

let notifOpen = false;
let globalBound = false;

function closePopover() {
  if (!notifOpen) return;
  notifOpen = false;
  const host = document.getElementById('klik-notif-host');
  if (host) {
    renderHeaderNotifications(host);
  }
}

function bindGlobalCloseListeners() {
  if (globalBound) return;
  globalBound = true;

  document.addEventListener('mousedown', (e) => {
    if (!notifOpen) return;
    const host = document.getElementById('klik-notif-host');
    if (host && !host.contains(e.target)) {
      closePopover();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && notifOpen) {
      closePopover();
    }
  });
}

export function resetNotificationsPopover() {
  notifOpen = false;
}

export function renderHeaderNotifications(container) {
  if (!container) return;
  bindGlobalCloseListeners();

  const notifications = getUserNotifications();
  const unreadCount = getUnreadNotificationsCount();

  container.innerHTML = `
    <div class="klik-notif-wrap">
      <button
        type="button"
        id="klik-notif-bell"
        class="klik-notif-btn"
        aria-label="Buka pusat notifikasi"
        aria-expanded="${notifOpen ? 'true' : 'false'}"
      >
        ${icon('bell', 16)}
        ${
          unreadCount > 0
            ? `<span class="klik-notif-badge">${
                unreadCount > 9 ? '9+' : unreadCount
              }</span>`
            : ''
        }
      </button>

      ${
        notifOpen
          ? `
        <div class="klik-notif-popover">
          <div class="klik-notif-popover-head">
            <div>
              <h3 style="font-size:12px;font-weight:600;color:var(--text-primary);">Notifikasi Kelas</h3>
              <p style="font-size:11px;color:var(--text-muted);">
                ${
                  unreadCount > 0
                    ? `${unreadCount} belum dibaca`
                    : 'Semua sudah dibaca'
                }
              </p>
            </div>
            ${
              unreadCount > 0
                ? `<button type="button" id="klik-notif-mark-all" style="display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:4px 8px;font-size:11px;font-weight:500;color:var(--emerald-text);cursor:pointer;">
                    ${icon('checkCheck', 14)}
                    <span>Tandai dibaca</span>
                  </button>`
                : ''
            }
          </div>

          <div class="klik-notif-list">
            ${
              notifications.length === 0
                ? `<div style="padding:32px 16px;text-align:center;font-size:12px;color:var(--text-muted);">
                    Belum ada notifikasi terbaru.
                  </div>`
                : notifications
                    .map(
                      (notif) => `
                  <button
                    type="button"
                    data-notif-id="${escapeHtml(notif.id)}"
                    class="klik-notif-item ${
                      notif.isRead ? 'is-read' : 'is-unread'
                    }"
                  >
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;">
                      <span style="font-weight:500;color:${
                        notif.isRead
                          ? 'var(--text-muted)'
                          : 'var(--emerald-text)'
                      };">${escapeHtml(notif.title)}</span>
                      <span class="tabular-nums" style="color:var(--text-dim);">${escapeHtml(
                        formatAnnouncementDate(notif.createdAt)
                      )}</span>
                    </div>
                    <p class="line-clamp-2" style="margin-top:4px;font-size:12px;font-weight:500;color:var(--text-body);">
                      ${escapeHtml(notif.message)}
                    </p>
                  </button>
                `
                    )
                    .join('')
            }
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;

  container.querySelector('#klik-notif-bell')?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifOpen = !notifOpen;
    renderHeaderNotifications(container);
  });

  container
    .querySelector('#klik-notif-mark-all')
    ?.addEventListener('click', (e) => {
      e.stopPropagation();
      markAllNotificationsRead();
    });

  container.querySelectorAll('[data-notif-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-notif-id');
      const target = notifications.find((n) => n.id === id);
      if (!target) return;
      markNotificationRead(target.id);
      notifOpen = false;
      renderHeaderNotifications(container);

      if (target.targetSection === 'tugas') {
        navigateTo({ section: 'tugas', taskId: target.targetId });
      } else if (target.targetSection === 'pengumuman') {
        navigateTo({ section: 'pengumuman', announcementId: target.targetId });
      } else {
        navigateTo({ section: target.targetSection });
      }
    });
  });
}
