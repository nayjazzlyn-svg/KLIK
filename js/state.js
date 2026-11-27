import { onAuthStateChanged } from 'firebase/auth';
import {
  activateProvisionedStudent,
  auth,
  changeUserPassword,
  createClassWithKomting,
  fetchClassMembership,
  fetchUserProfile,
  fsAddExternalMember,
  fsAddSchedule,
  fsCreateAnnouncement,
  fsCreateGroupActivity,
  fsCreateGroupTask,
  fsCreateIndividualTask,
  fsDeleteAnnouncement,
  fsDeleteGroupTask,
  fsDeleteIndividualTask,
  fsDeletePendingRosterEntry,
  fsDeleteSchedule,
  fsDeleteScheduleException,
  fsFinalizeGroup,
  fsJoinGroup,
  fsLeaveGroup,
  fsMarkAllNotificationsRead,
  fsMarkNotificationRead,
  fsProvisionRosterStudent,
  fsResetRosterActivationCode,
  fsSaveScheduleException,
  fsSplitScheduleThisAndFollowing,
  fsToggleGroupTaskCompletion,
  fsUpdateAllRecurringSchedule,
  fsUpdateAnnouncement,
  fsUpdateGroupTask,
  fsUpdateIndividualTask,
  fsUpdateMemberAccountStatus,
  fsUpdateMemberRole,
  fsUpsertCourseCollection,
  fsUpsertTaskCompletion,
  seedSampleClassData,
  signInWithNimAndPassword,
  signOutFirebase,
  subscribeToClassRoster,
  subscribeToClassWorkspace,
  testFirestoreConnection,
} from './firebase.js';
import {
  addDays,
  getIsoWeekday,
  getGroupEffectiveMaxCapacity,
  parseLocalDateKey,
  sanitizeRichTextHtml,
  toLocalDateKey,
} from './utils.js';

function createEmptySlice() {
  return {
    classInfo: null,
    memberships: [],
    memberUsers: [],
    rawCourses: [],
    courseCollections: {},
    schedules: [],
    scheduleExceptions: [],
    individualTasks: [],
    individualTaskCompletions: [],
    individualTaskNotes: {},
    groupActivities: [],
    groups: [],
    groupMembers: [],
    groupTasks: [],
    groupTaskCompletions: [],
    announcements: [],
    notifications: [],
  };
}

const state = {
  authReady: false,
  workspaceLoading: false,
  firebaseUser: null,
  userProfile: null,
  activeClassId: null,
  verifiedMemberRole: null,
  activeRoleOverride: null,
  authError: null,
  roster: [],
  slice: createEmptySlice(),
  activeSection: 'dashboard',
  navTarget: {},
  now: new Date(),
  sidebarCollapsed: false,
  mobileMenuOpen: false,
};

try {
  state.sidebarCollapsed =
    window.localStorage.getItem('klik.ui.sidebarCollapsed') === 'true';
} catch {
  state.sidebarCollapsed = false;
}

let authActionPending = false;
let workspaceUnsub = null;
let rosterUnsub = null;
let fallbackTimer = null;
const listeners = [];

export function subscribeStore(listener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) {
      listeners.splice(idx, 1);
    }
  };
}

function notify(reason = 'state') {
  listeners.forEach((fn) => fn(reason));
}

function detachWorkspaceListeners() {
  if (fallbackTimer) {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  if (workspaceUnsub) {
    workspaceUnsub();
    workspaceUnsub = null;
  }
  if (rosterUnsub) {
    rosterUnsub();
    rosterUnsub = null;
  }
}

function attachWorkspaceListeners() {
  detachWorkspaceListeners();
  if (
    !state.authReady ||
    !state.firebaseUser ||
    !state.activeClassId ||
    !state.verifiedMemberRole
  ) {
    state.roster = [];
    return;
  }

  state.workspaceLoading = true;
  let initialPatched = false;
  notify('workspace-loading');

  workspaceUnsub = subscribeToClassWorkspace(
    state.activeClassId,
    state.firebaseUser.uid,
    (patch) => {
      state.slice = { ...state.slice, ...patch };
      if (!initialPatched) {
        initialPatched = true;
        state.workspaceLoading = false;
      }
      notify('workspace-patch');
    }
  );

  fallbackTimer = window.setTimeout(() => {
    if (state.workspaceLoading) {
      state.workspaceLoading = false;
      notify('workspace-ready');
    }
  }, 1500);

  if (state.verifiedMemberRole === 'admin') {
    rosterUnsub = subscribeToClassRoster(state.activeClassId, (items) => {
      state.roster = items;
      notify('roster');
    });
  } else {
    state.roster = [];
  }
}

export function initStore() {
  void testFirestoreConnection();

  onAuthStateChanged(auth, async (fbUser) => {
    if (authActionPending) {
      return;
    }

    if (!fbUser) {
      detachWorkspaceListeners();
      state.firebaseUser = null;
      state.userProfile = null;
      state.activeClassId = null;
      state.verifiedMemberRole = null;
      state.activeRoleOverride = null;
      state.roster = [];
      state.slice = createEmptySlice();
      state.authReady = true;
      state.workspaceLoading = false;
      notify('auth');
      return;
    }

    state.workspaceLoading = true;
    notify('auth-loading');

    try {
      const profile = await fetchUserProfile(fbUser.uid);
      if (!profile || !profile.activeClassId || profile.status === 'disabled') {
        await signOutFirebase().catch(() => undefined);
        detachWorkspaceListeners();
        state.firebaseUser = null;
        state.userProfile = null;
        state.activeClassId = null;
        state.verifiedMemberRole = null;
        state.roster = [];
        state.slice = createEmptySlice();
        if (profile?.status === 'disabled') {
          state.authError = 'Akun Anda sedang dinonaktifkan oleh Komting.';
        }
        return;
      }

      const membership = await fetchClassMembership(
        profile.activeClassId,
        fbUser.uid
      );
      if (!membership || membership.status === 'disabled') {
        await signOutFirebase().catch(() => undefined);
        detachWorkspaceListeners();
        state.firebaseUser = null;
        state.userProfile = null;
        state.activeClassId = null;
        state.verifiedMemberRole = null;
        state.roster = [];
        state.slice = createEmptySlice();
        state.authError = 'Akun Anda sedang dinonaktifkan oleh Komting.';
        return;
      }

      state.firebaseUser = fbUser;
      state.userProfile = profile;
      state.activeClassId = profile.activeClassId;
      state.verifiedMemberRole = membership.role;
      state.authError = null;
      state.authReady = true;
      attachWorkspaceListeners();
    } catch {
      await signOutFirebase().catch(() => undefined);
      detachWorkspaceListeners();
      state.firebaseUser = null;
      state.userProfile = null;
      state.activeClassId = null;
      state.verifiedMemberRole = null;
      state.roster = [];
      state.slice = createEmptySlice();
      state.authError =
        'Sesi tidak valid atau akun dinonaktifkan. Silakan masuk kembali.';
    } finally {
      state.workspaceLoading = false;
      state.authReady = true;
      notify('auth');
    }
  });
}

// ------------------------------------------------------------------
// Computed Selectors using JS Arrays
// ------------------------------------------------------------------

export function getStoreState() {
  return state;
}

export function isAuthenticated() {
  return Boolean(
    state.firebaseUser &&
      state.userProfile &&
      state.activeClassId &&
      state.verifiedMemberRole
  );
}

export function getCourses() {
  return state.slice.rawCourses.map((c) => ({
    ...c,
    collection: state.slice.courseCollections[c.id] ?? null,
  }));
}

export function getCourseById(courseId) {
  return getCourses().find((c) => c.id === courseId);
}

export function getCurrentUser() {
  if (state.userProfile) return state.userProfile;
  return {
    id: state.firebaseUser?.uid ?? '',
    nim: '',
    name: state.firebaseUser?.displayName ?? 'Mahasiswa',
    email: state.firebaseUser?.email ?? '',
    avatarInitials: 'MH',
  };
}

export function getCurrentMembership() {
  const cur = getCurrentUser();
  return state.slice.memberships.find((m) => m.userId === cur.id);
}

export function getVerifiedRole() {
  const mem = getCurrentMembership();
  return mem?.role ?? state.verifiedMemberRole ?? 'mahasiswa';
}

export function getEffectiveRole() {
  const verified = getVerifiedRole();
  if (verified === 'admin' && state.activeRoleOverride === 'mahasiswa') {
    return 'mahasiswa';
  }
  return verified;
}

export function getMembershipTitle() {
  const effective = getEffectiveRole();
  const verified = getVerifiedRole();
  if (effective === 'mahasiswa' && verified === 'admin') {
    return 'Mahasiswa';
  }
  const mem = getCurrentMembership();
  return mem?.title ?? (effective === 'admin' ? 'Komting' : 'Mahasiswa');
}

export function getWorkspaceViewState() {
  const cur = getCurrentUser();
  return {
    classInfo: state.slice.classInfo ?? {
      id: state.activeClassId ?? '',
      code: '',
      name: 'Workspace Kelas',
      semester: '',
      academicYear: '',
    },
    users: state.slice.memberUsers.length > 0 ? state.slice.memberUsers : [cur],
    memberships: state.slice.memberships,
    currentUserId: cur.id,
    activeRoleOverride: state.activeRoleOverride,
    courses: getCourses(),
    schedules: state.slice.schedules,
    scheduleExceptions: state.slice.scheduleExceptions,
    individualTasks: state.slice.individualTasks,
    individualTaskCompletions: state.slice.individualTaskCompletions,
    individualTaskNotes: state.slice.individualTaskNotes,
    groupActivities: state.slice.groupActivities,
    groups: state.slice.groups,
    groupMembers: state.slice.groupMembers,
    groupTasks: state.slice.groupTasks,
    groupTaskCompletions: state.slice.groupTaskCompletions,
    announcements: state.slice.announcements,
    notifications: state.slice.notifications,
  };
}

export function getUserNotifications() {
  const cur = getCurrentUser();
  return state.slice.notifications
    .filter((n) => n.userId === cur.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function getUnreadNotificationsCount() {
  return getUserNotifications().filter((n) => !n.isRead).length;
}

export function isTaskCompletedByCurrentUser(taskId) {
  const cur = getCurrentUser();
  const task = state.slice.individualTasks.find((t) => t.id === taskId);
  const currentVersion = task?.version ?? 1;
  const rec = state.slice.individualTaskCompletions.find(
    (c) => c.taskId === taskId && c.userId === cur.id
  );
  return Boolean(rec?.completed && (rec.taskVersion ?? 1) === currentVersion);
}

export function getTaskNote(taskId) {
  const cur = getCurrentUser();
  return state.slice.individualTaskNotes[`${taskId}_${cur.id}`] ?? '';
}

export function isGroupTaskCompleted(groupTaskId, groupId) {
  const gt = state.slice.groupTasks.find((t) => t.id === groupTaskId);
  const currentVersion = gt?.version ?? 1;
  const rec = state.slice.groupTaskCompletions.find(
    (c) => c.groupTaskId === groupTaskId && c.groupId === groupId
  );
  return Boolean(rec?.completed && (rec.taskVersion ?? 1) === currentVersion);
}

// ------------------------------------------------------------------
// Navigation & UI Shell Actions
// ------------------------------------------------------------------

export function navigateTo(target) {
  state.activeSection = target.section;
  state.navTarget = {
    taskId: target.taskId ?? null,
    announcementId: target.announcementId ?? null,
    groupCourseId: target.groupCourseId ?? null,
    groupActivityId: target.groupActivityId ?? null,
    scheduleDate: target.scheduleDate ?? null,
  };
  notify('navigation');
}

export function clearNavTarget() {
  state.navTarget = {};
}

export function clearAuthError() {
  state.authError = null;
}

export function toggleSidebarCollapse() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  try {
    window.localStorage.setItem(
      'klik.ui.sidebarCollapsed',
      String(state.sidebarCollapsed)
    );
  } catch {
    // Ignore storage restriction
  }
  notify('shell');
}

export function setMobileMenuOpen(open) {
  state.mobileMenuOpen = Boolean(open);
  notify('shell');
}

export function updateClockNow(nextNow) {
  state.now = nextNow;
}

// ------------------------------------------------------------------
// Auth Actions
// ------------------------------------------------------------------

export async function loginWithNimPassword(nim, password) {
  state.authError = null;
  authActionPending = true;
  try {
    const fbUser = await signInWithNimAndPassword(nim, password);
    const profile = await fetchUserProfile(fbUser.uid);
    if (!profile || !profile.activeClassId) {
      await signOutFirebase().catch(() => undefined);
      return {
        ok: false,
        error:
          'Profil kelas untuk NIM ini belum lengkap. Gunakan menu Aktivasi Akun dengan Kode Aktivasi dari Komting.',
      };
    }
    if (profile.status === 'disabled') {
      await signOutFirebase().catch(() => undefined);
      return {
        ok: false,
        error: 'Akun Anda sedang dinonaktifkan oleh Komting.',
      };
    }

    let membership = null;
    try {
      membership = await fetchClassMembership(profile.activeClassId, fbUser.uid);
    } catch {
      membership = null;
    }
    if (!membership || membership.status === 'disabled') {
      await signOutFirebase().catch(() => undefined);
      return {
        ok: false,
        error:
          'Akses akun Anda pada kelas ini sedang dinonaktifkan. Hubungi Komting kelas.',
      };
    }

    state.firebaseUser = fbUser;
    state.userProfile = profile;
    state.activeClassId = profile.activeClassId;
    state.verifiedMemberRole = membership.role;
    state.activeSection = 'dashboard';
    state.navTarget = {};
    state.authReady = true;
    attachWorkspaceListeners();
    notify('auth');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal melakukan autentikasi NIM.',
    };
  } finally {
    authActionPending = false;
  }
}

export async function activateAccount(input) {
  state.authError = null;
  authActionPending = true;
  try {
    const res = await activateProvisionedStudent(input);
    state.firebaseUser = auth.currentUser;
    state.userProfile = res.profile;
    state.activeClassId = res.classId;
    state.verifiedMemberRole = res.role;
    state.activeSection = 'dashboard';
    state.navTarget = {};
    state.authReady = true;
    attachWorkspaceListeners();
    notify('auth');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal mengaktifkan akun mahasiswa.',
    };
  } finally {
    authActionPending = false;
  }
}

export async function createClassAccount(input) {
  state.authError = null;
  authActionPending = true;
  try {
    const res = await createClassWithKomting(input);
    state.firebaseUser = auth.currentUser;
    state.userProfile = res.profile;
    state.activeClassId = res.classId;
    state.verifiedMemberRole = 'admin';
    state.activeSection = 'dashboard';
    state.navTarget = {};
    state.authReady = true;
    attachWorkspaceListeners();
    notify('auth');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal membuat workspace kelas baru.',
    };
  } finally {
    authActionPending = false;
  }
}

export async function changePassword(currentPassword, newPassword) {
  try {
    await changeUserPassword(currentPassword, newPassword);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Gagal memperbarui password.',
    };
  }
}

export async function logout() {
  detachWorkspaceListeners();
  await signOutFirebase();
  state.firebaseUser = null;
  state.userProfile = null;
  state.activeClassId = null;
  state.verifiedMemberRole = null;
  state.activeRoleOverride = null;
  state.roster = [];
  state.authError = null;
  state.slice = createEmptySlice();
  notify('auth');
}

// ------------------------------------------------------------------
// Roster, Role & Workspace CRUD Actions
// ------------------------------------------------------------------

export async function provisionRosterStudent(input) {
  if (!state.activeClassId || !state.firebaseUser || !state.slice.classInfo?.code) {
    return { ok: false, error: 'Workspace kelas belum siap.' };
  }
  try {
    const res = await fsProvisionRosterStudent({
      classId: state.activeClassId,
      classCode: state.slice.classInfo.code,
      adminUid: state.firebaseUser.uid,
      nim: input.nim,
      name: input.name,
      role: input.role,
      title: input.title,
    });
    return { ok: true, ...res };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal menambahkan mahasiswa ke daftar kelas.',
    };
  }
}

export async function resetRosterActivationCode(entry) {
  if (!state.activeClassId || !state.slice.classInfo?.code) {
    return { ok: false, error: 'Workspace kelas belum siap.' };
  }
  try {
    const activationCode = await fsResetRosterActivationCode({
      classId: state.activeClassId,
      classCode: state.slice.classInfo.code,
      entry,
    });
    return { ok: true, activationCode };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal membuat ulang kode aktivasi.',
    };
  }
}

export async function toggleRosterMemberStatus(entry) {
  if (!state.activeClassId) {
    return { ok: false, error: 'Workspace kelas tidak aktif.' };
  }
  try {
    const nextStatus = entry.status === 'active' ? 'disabled' : 'active';
    await fsUpdateMemberAccountStatus({
      classId: state.activeClassId,
      entry,
      nextStatus,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal mengubah status akun anggota.',
    };
  }
}

export async function deletePendingRosterEntry(entry) {
  if (!state.activeClassId) {
    return { ok: false, error: 'Workspace kelas tidak aktif.' };
  }
  try {
    await fsDeletePendingRosterEntry({
      classId: state.activeClassId,
      entry,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal menghapus entri mahasiswa.',
    };
  }
}

export function setRoleOverride(role) {
  state.activeRoleOverride = role;
  notify('role-override');
}

export async function updateMemberRole(userId, role, title) {
  if (!state.activeClassId) return;
  const targetMember =
    state.slice.memberUsers.find((u) => u.id === userId) ??
    state.roster.find((r) => r.claimedByUid === userId);
  const targetNim = targetMember?.nim ?? '';
  await fsUpdateMemberRole(
    state.activeClassId,
    userId,
    targetNim,
    role,
    title
  );
}

export async function seedCurrentClassSampleData() {
  if (!state.activeClassId || !state.firebaseUser || !state.slice.classInfo) {
    return;
  }
  await seedSampleClassData(
    state.activeClassId,
    state.firebaseUser.uid,
    state.slice.classInfo.code
  );
}

export function upsertCourseCollection(courseId, label, url) {
  if (!state.activeClassId) return;
  const course = getCourseById(courseId);
  void fsUpsertCourseCollection(
    state.activeClassId,
    courseId,
    course?.name ?? 'Mata Kuliah',
    course?.collection?.id,
    label,
    url
  );
}

// Schedules
export function addSchedule(input) {
  if (!state.activeClassId) return;
  void fsAddSchedule(state.activeClassId, input);
}

export function editScheduleWithScope(input) {
  if (!state.activeClassId) return;
  const target = state.slice.schedules.find((s) => s.id === input.scheduleId);
  if (!target) return;

  if (input.scope === 'this_only') {
    const existingExc = state.slice.scheduleExceptions.find(
      (e) => e.scheduleId === input.scheduleId && e.date === input.instanceDate
    );
    void fsSaveScheduleException(state.activeClassId, existingExc?.id, {
      scheduleId: input.scheduleId,
      date: input.instanceDate,
      type: 'modified',
      overrideCourseId: input.courseId,
      overrideStartTime: input.startTime,
      overrideEndTime: input.endTime,
      overrideRoom: input.room,
      reason: input.reason || 'Perubahan khusus pertemuan ini.',
    });
    return;
  }

  if (input.scope === 'this_and_following') {
    const instanceDateObj = parseLocalDateKey(input.instanceDate);
    const dayBeforeKey = toLocalDateKey(addDays(instanceDateObj, -1));
    const futureExcIds = state.slice.scheduleExceptions
      .filter((e) => e.scheduleId === target.id && e.date >= input.instanceDate)
      .map((e) => e.id);
    void fsSplitScheduleThisAndFollowing(
      state.activeClassId,
      target,
      dayBeforeKey,
      input.instanceDate,
      getIsoWeekday(instanceDateObj),
      {
        courseId: input.courseId,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room,
      },
      futureExcIds
    );
    return;
  }

  void fsUpdateAllRecurringSchedule(state.activeClassId, target.id, {
    courseId: input.courseId,
    startTime: input.startTime,
    endTime: input.endTime,
    room: input.room,
  });
}

export function toggleCancelScheduleInstance(scheduleId, date, reason) {
  if (!state.activeClassId) return;
  const existingExc = state.slice.scheduleExceptions.find(
    (e) => e.scheduleId === scheduleId && e.date === date
  );
  if (existingExc && existingExc.type === 'cancelled') {
    void fsDeleteScheduleException(state.activeClassId, existingExc.id);
    return;
  }
  void fsSaveScheduleException(state.activeClassId, existingExc?.id, {
    scheduleId,
    date,
    type: 'cancelled',
    reason: reason || 'Pertemuan dibatalkan oleh pengajar/komting.',
  });
}

export function deleteSchedule(scheduleId) {
  if (!state.activeClassId) return;
  const excIds = state.slice.scheduleExceptions
    .filter((e) => e.scheduleId === scheduleId)
    .map((e) => e.id);
  void fsDeleteSchedule(state.activeClassId, scheduleId, excIds);
}

// Individual Tasks
export function toggleTaskCompletion(taskId) {
  const cur = getCurrentUser();
  if (!state.activeClassId || !cur.id) return;
  const task = state.slice.individualTasks.find((t) => t.id === taskId);
  const currentVersion = task?.version ?? 1;
  const existingRec = state.slice.individualTaskCompletions.find(
    (c) => c.taskId === taskId && c.userId === cur.id
  );
  const currentlyDone = Boolean(
    existingRec?.completed && (existingRec.taskVersion ?? 1) === currentVersion
  );
  const note = state.slice.individualTaskNotes[`${taskId}_${cur.id}`] ?? '';

  void fsUpsertTaskCompletion(
    state.activeClassId,
    taskId,
    cur.id,
    currentVersion,
    !currentlyDone,
    note,
    Boolean(existingRec)
  );
}

export function setTaskNote(taskId, note) {
  const cur = getCurrentUser();
  if (!state.activeClassId || !cur.id) return;
  const task = state.slice.individualTasks.find((t) => t.id === taskId);
  const currentVersion = task?.version ?? 1;
  const existingRec = state.slice.individualTaskCompletions.find(
    (c) => c.taskId === taskId && c.userId === cur.id
  );
  const currentlyDone = Boolean(
    existingRec?.completed && (existingRec.taskVersion ?? 1) === currentVersion
  );

  void fsUpsertTaskCompletion(
    state.activeClassId,
    taskId,
    cur.id,
    currentVersion,
    currentlyDone,
    note,
    Boolean(existingRec)
  );
}

export function createIndividualTask(input) {
  const cur = getCurrentUser();
  if (!state.activeClassId || !cur.id) return;
  const course = getCourseById(input.courseId);
  const memberIds = state.slice.memberships.map((m) => m.userId);
  void fsCreateIndividualTask(
    state.activeClassId,
    cur.id,
    memberIds,
    course?.name ?? 'Mata Kuliah',
    {
      ...input,
      descriptionHtml: sanitizeRichTextHtml(input.descriptionHtml),
    }
  );
}

export function updateIndividualTask(taskId, input) {
  if (!state.activeClassId) return;
  const existing = state.slice.individualTasks.find((t) => t.id === taskId);
  const nextVersion = (existing?.version ?? 1) + 1;
  const course = getCourseById(input.courseId);
  const memberIds = state.slice.memberships.map((m) => m.userId);
  void fsUpdateIndividualTask(
    state.activeClassId,
    taskId,
    nextVersion,
    memberIds,
    course?.name ?? 'Mata Kuliah',
    {
      ...input,
      descriptionHtml: sanitizeRichTextHtml(input.descriptionHtml),
    }
  );
}

export function deleteIndividualTask(taskId) {
  if (!state.activeClassId) return;
  void fsDeleteIndividualTask(state.activeClassId, taskId);
}

// Group Organizer
export async function createGroupActivity(input) {
  const cur = getCurrentUser();
  if (!state.activeClassId || !cur.id) {
    throw new Error('Kelas tidak aktif.');
  }
  return fsCreateGroupActivity(state.activeClassId, cur.id, input);
}

export function joinGroup(activityId, groupId) {
  const cur = getCurrentUser();
  if (!state.activeClassId || !cur.id) {
    return { ok: false, error: 'Sesi pengguna tidak aktif.' };
  }
  const activity = state.slice.groupActivities.find((a) => a.id === activityId);
  const targetGroup = state.slice.groups.find((g) => g.id === groupId);
  if (!activity || !targetGroup) {
    return { ok: false, error: 'Kelompok tidak ditemukan.' };
  }
  if (targetGroup.isFinal) {
    return {
      ok: false,
      error: 'Kelompok ini sudah final dan tidak menerima anggota baru.',
    };
  }

  const activityGroups = state.slice.groups.filter(
    (g) => g.activityId === activityId
  );
  const activityMembers = state.slice.groupMembers.filter(
    (m) => m.activityId === activityId
  );

  const previousMemberships = activityMembers.filter(
    (m) => m.userId === cur.id
  );
  for (let i = 0; i < previousMemberships.length; i += 1) {
    const prev = previousMemberships[i];
    const g = activityGroups.find((grp) => grp.id === prev.groupId);
    if (g?.isFinal) {
      return {
        ok: false,
        error: 'Anda sudah tergabung di kelompok yang telah final.',
      };
    }
  }

  const currentCount = activityMembers.filter(
    (m) => m.groupId === groupId
  ).length;
  const maxCap = getGroupEffectiveMaxCapacity(
    targetGroup,
    activityGroups,
    activityMembers,
    activity
  );
  if (currentCount >= maxCap) {
    return { ok: false, error: 'Kapasitas kelompok sudah penuh.' };
  }

  void fsJoinGroup(
    state.activeClassId,
    activityId,
    groupId,
    previousMemberships.map((m) => m.id),
    cur
  );
  return { ok: true };
}

export function leaveGroup(activityId, groupId) {
  const cur = getCurrentUser();
  if (!state.activeClassId || !cur.id) return;
  const grp = state.slice.groups.find((g) => g.id === groupId);
  if (grp?.isFinal) return;
  const memberDoc = state.slice.groupMembers.find(
    (m) =>
      m.activityId === activityId &&
      m.groupId === groupId &&
      m.userId === cur.id
  );
  if (memberDoc) {
    void fsLeaveGroup(state.activeClassId, memberDoc.id);
  }
}

export function finalizeGroup(groupId) {
  const cur = getCurrentUser();
  if (!state.activeClassId || !cur.id) return;
  void fsFinalizeGroup(state.activeClassId, groupId, cur.id);
}

export function addExternalMember(activityId, groupId, fullName) {
  if (!state.activeClassId) return { ok: false, error: 'Kelas tidak aktif.' };
  const cleaned = String(fullName ?? '').trim();
  if (!cleaned) {
    return {
      ok: false,
      error: 'Nama lengkap anggota eksternal wajib diisi.',
    };
  }
  const activity = state.slice.groupActivities.find((a) => a.id === activityId);
  const targetGroup = state.slice.groups.find((g) => g.id === groupId);
  if (!activity || !targetGroup) {
    return { ok: false, error: 'Kelompok tidak ditemukan.' };
  }
  if (targetGroup.isFinal) {
    return { ok: false, error: 'Kelompok sudah final.' };
  }

  const activityGroups = state.slice.groups.filter(
    (g) => g.activityId === activityId
  );
  const activityMembers = state.slice.groupMembers.filter(
    (m) => m.activityId === activityId
  );
  const currentCount = activityMembers.filter(
    (m) => m.groupId === groupId
  ).length;
  const maxCap = getGroupEffectiveMaxCapacity(
    targetGroup,
    activityGroups,
    activityMembers,
    activity
  );
  if (currentCount >= maxCap) {
    return { ok: false, error: 'Kapasitas kelompok sudah penuh.' };
  }

  void fsAddExternalMember(state.activeClassId, activityId, groupId, cleaned);
  return { ok: true };
}

export function createGroupTask(input) {
  const cur = getCurrentUser();
  if (!state.activeClassId || !cur.id) return;
  void fsCreateGroupTask(state.activeClassId, cur.id, {
    ...input,
    descriptionHtml: sanitizeRichTextHtml(input.descriptionHtml),
  });
}

export function updateGroupTask(groupTaskId, input) {
  if (!state.activeClassId) return;
  const existing = state.slice.groupTasks.find((gt) => gt.id === groupTaskId);
  const nextVersion = (existing?.version ?? 1) + 1;
  void fsUpdateGroupTask(state.activeClassId, groupTaskId, nextVersion, {
    ...input,
    descriptionHtml: sanitizeRichTextHtml(input.descriptionHtml),
  });
}

export function deleteGroupTask(groupTaskId) {
  if (!state.activeClassId) return;
  void fsDeleteGroupTask(state.activeClassId, groupTaskId);
}

export function toggleGroupTaskCompletion(groupTaskId, groupId) {
  const cur = getCurrentUser();
  if (!state.activeClassId || !cur.id) return;
  const gt = state.slice.groupTasks.find((t) => t.id === groupTaskId);
  const currentVersion = gt?.version ?? 1;
  const existingRec = state.slice.groupTaskCompletions.find(
    (c) => c.groupTaskId === groupTaskId && c.groupId === groupId
  );
  const currentlyDone = Boolean(
    existingRec?.completed && (existingRec.taskVersion ?? 1) === currentVersion
  );
  void fsToggleGroupTaskCompletion(
    state.activeClassId,
    groupTaskId,
    groupId,
    currentVersion,
    !currentlyDone,
    cur.id,
    Boolean(existingRec)
  );
}

// Announcements
export function createAnnouncement(input) {
  const cur = getCurrentUser();
  if (!state.activeClassId || !cur.id) return;
  const memberIds = state.slice.memberships.map((m) => m.userId);
  void fsCreateAnnouncement(state.activeClassId, cur.id, memberIds, input);
}

export function updateAnnouncement(announcementId, input) {
  if (!state.activeClassId) return;
  void fsUpdateAnnouncement(state.activeClassId, announcementId, input);
}

export function deleteAnnouncement(announcementId) {
  if (!state.activeClassId) return;
  void fsDeleteAnnouncement(state.activeClassId, announcementId);
}

// Notifications
export function markNotificationRead(notificationId) {
  if (!state.activeClassId) return;
  void fsMarkNotificationRead(state.activeClassId, notificationId);
}

export function markAllNotificationsRead() {
  if (!state.activeClassId) return;
  const unreadIds = getUserNotifications()
    .filter((n) => !n.isRead)
    .map((n) => n.id);
  void fsMarkAllNotificationsRead(state.activeClassId, unreadIds);
}
