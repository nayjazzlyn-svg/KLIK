import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { createInitialDemoData } from './demoData.js';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const OperationType = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
});

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testFirestoreConnection() {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error(
        'Please check your Firebase configuration. Firestore client is offline.'
      );
    }
  }
}

export function makeSafeId(prefix) {
  const cleanPrefix = String(prefix).replace(/[^a-zA-Z0-9_-]/g, '');
  return `${cleanPrefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'MH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function toIsoString(val) {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (
    typeof val === 'object' &&
    val !== null &&
    typeof val.toDate === 'function'
  ) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function clampStr(val, maxLen) {
  return String(val ?? '').trim().slice(0, maxLen);
}

export function validateNimFormat(rawNim) {
  const cleaned = String(rawNim ?? '').trim();
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(cleaned)) {
    throw new Error(
      'NIM harus terdiri dari 3–32 karakter (huruf, angka, tanda hubung -, atau _).'
    );
  }
  return cleaned;
}

export function normalizeNimKey(rawNim) {
  return validateNimFormat(rawNim).toLowerCase();
}

export function nimToInternalEmail(rawNim) {
  return `${normalizeNimKey(rawNim)}@klik.internal`;
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateActivationCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(8);
  window.crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((v) => alphabet[v % alphabet.length])
    .join('');
}

export function mapFirebaseAuthError(error) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  const msg = error instanceof Error ? error.message : String(error);

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'NIM atau password tidak valid.';
  }
  if (code === 'auth/user-disabled') {
    return 'Akun Anda sedang dinonaktifkan.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa menit lalu coba lagi.';
  }
  if (code === 'auth/weak-password') {
    return 'Password terlalu lemah. Gunakan minimal 6 karakter.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'NIM ini sudah memiliki akun aktif. Silakan masuk melalui tab Masuk.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Provider Email/Password belum diaktifkan di Firebase Console proyek ini.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Gagal terhubung ke server autentikasi. Periksa koneksi internet Anda.';
  }
  return msg || 'Terjadi kesalahan saat memproses autentikasi.';
}

// ------------------------------------------------------------------
// Authentication, Controlled Provisioning & Profile Lookups
// ------------------------------------------------------------------

export async function signInWithNimAndPassword(nim, password) {
  const internalEmail = nimToInternalEmail(nim);
  try {
    const cred = await signInWithEmailAndPassword(auth, internalEmail, password);
    return cred.user;
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error));
  }
}

export async function signOutFirebase() {
  await signOut(auth);
}

export async function changeUserPassword(currentPassword, newPassword) {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email) {
    throw new Error('Sesi pengguna tidak aktif.');
  }
  if (newPassword.length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }
  try {
    const cred = EmailAuthProvider.credential(fbUser.email, currentPassword);
    await reauthenticateWithCredential(fbUser, cred);
    await updatePassword(fbUser, newPassword);
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      throw new Error('Password saat ini tidak sesuai.');
    }
    throw new Error(mapFirebaseAuthError(error));
  }
}

export async function fetchUserProfile(uid) {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: d.uid,
      nim: d.nim,
      name: d.name,
      email: d.email,
      avatarInitials: d.avatarInitials,
      avatarId: d.avatarId ?? null,
      activeClassId: d.activeClassId ?? undefined,
      role: d.role ?? 'mahasiswa',
      status: d.status ?? 'active',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchClassMembership(classId, uid) {
  const path = `classes/${classId}/members/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'classes', classId, 'members', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: `${classId}_${uid}`,
      classId: d.classId,
      userId: d.userId,
      role: d.role,
      title: d.title,
      status: d.status ?? 'active',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function lookupClassByCode(rawCode) {
  const normalizedCode = String(rawCode ?? '').trim().toUpperCase();
  if (!normalizedCode) return null;
  const path = `classDirectory/${normalizedCode}`;
  try {
    const snap = await getDoc(doc(db, 'classDirectory', normalizedCode));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      classId: d.classId,
      code: d.code,
      name: d.name,
      semester: d.semester,
      academicYear: d.academicYear,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function activateProvisionedStudent(params) {
  const cleanNim = validateNimFormat(params.nim);
  const nimKey = cleanNim.toLowerCase();
  const internalEmail = `${nimKey}@klik.internal`;
  const normalizedClassCode = clampStr(
    String(params.classCode ?? '').toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
    32
  );
  const cleanActivationCode = String(params.activationCode ?? '')
    .trim()
    .toUpperCase();

  if (normalizedClassCode.length < 2) {
    throw new Error('Kode kelas minimal 2 karakter.');
  }
  if (!cleanActivationCode) {
    throw new Error('Kode aktivasi dari Komting wajib diisi.');
  }
  if (!params.password || params.password.length < 6) {
    throw new Error('Password minimal 6 karakter.');
  }

  let fbUser = null;
  let createdNewAuthUser = false;

  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      internalEmail,
      params.password
    );
    fbUser = cred.user;
    createdNewAuthUser = true;
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
    if (code === 'auth/email-already-in-use') {
      try {
        const signInCred = await signInWithEmailAndPassword(
          auth,
          internalEmail,
          params.password
        );
        const existingProfile = await getDoc(
          doc(db, 'users', signInCred.user.uid)
        );
        if (existingProfile.exists()) {
          await signOut(auth);
          throw new Error(
            'NIM ini sudah aktif. Silakan masuk menggunakan tab Masuk.'
          );
        }
        fbUser = signInCred.user;
      } catch (resumeErr) {
        if (
          resumeErr instanceof Error &&
          resumeErr.message.includes('NIM ini sudah aktif')
        ) {
          throw resumeErr;
        }
        throw new Error(
          'NIM ini sudah terdaftar sebelumnya. Gunakan menu Masuk atau pastikan password sesuai.'
        );
      }
    } else {
      throw new Error(mapFirebaseAuthError(error));
    }
  }

  const cleanupFailedAuth = async () => {
    if (!fbUser) return;
    try {
      if (createdNewAuthUser) {
        await deleteUser(fbUser);
      } else {
        await signOut(auth);
      }
    } catch {
      await signOut(auth).catch(() => undefined);
    }
  };

  try {
    const dir = await lookupClassByCode(normalizedClassCode);
    if (!dir) {
      throw new Error(
        `Kode kelas "${normalizedClassCode}" tidak ditemukan. Periksa kembali kode kelas dari Komting.`
      );
    }

    const codeHash = await sha256Hex(
      `${normalizedClassCode}:${nimKey}:${cleanActivationCode}`
    );
    const ticketSnap = await getDoc(
      doc(db, 'classes', dir.classId, 'activationTickets', codeHash)
    );

    if (!ticketSnap.exists()) {
      throw new Error(
        'NIM atau kode aktivasi tidak valid. Pastikan Komting telah mendaftarkan NIM Anda pada kelas ini.'
      );
    }

    const ticket = ticketSnap.data();
    if (ticket.nimKey !== nimKey || ticket.status !== 'pending') {
      throw new Error(
        'Kode aktivasi tidak berlaku atau akun NIM ini sudah diaktifkan.'
      );
    }

    const uid = fbUser.uid;
    const assignedName = String(ticket.name);
    const assignedRole = ticket.role;
    const assignedTitle = String(ticket.title);
    const initials = getInitials(assignedName);

    const batch = writeBatch(db);

    batch.set(doc(db, 'classes', dir.classId, 'activationClaims', nimKey), {
      nimKey,
      classId: dir.classId,
      uid,
      codeHash,
      claimedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'classes', dir.classId, 'roster', nimKey), {
      status: 'active',
      claimedByUid: uid,
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'classes', dir.classId, 'activationTickets', codeHash), {
      status: 'active',
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'classes', dir.classId, 'members', uid), {
      userId: uid,
      classId: dir.classId,
      nim: String(ticket.nim),
      name: assignedName,
      avatarInitials: initials,
      role: assignedRole,
      title: assignedTitle,
      status: 'active',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'users', uid), {
      uid,
      nim: String(ticket.nim),
      name: assignedName,
      email: internalEmail,
      avatarInitials: initials,
      activeClassId: dir.classId,
      role: assignedRole,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    return {
      profile: {
        id: uid,
        nim: String(ticket.nim),
        name: assignedName,
        email: internalEmail,
        avatarInitials: initials,
        activeClassId: dir.classId,
        role: assignedRole,
        status: 'active',
      },
      classId: dir.classId,
      role: assignedRole,
    };
  } catch (error) {
    await cleanupFailedAuth();
    if (error instanceof Error) {
      if (error.message.includes('Missing or insufficient permissions')) {
        throw new Error(
          'Aktivasi ditolak oleh aturan keamanan: pastikan NIM dan kode aktivasi sesuai data Komting.'
        );
      }
      throw error;
    }
    throw new Error('Gagal mengaktifkan akun mahasiswa.');
  }
}

export async function createClassWithKomting(params) {
  const cleanNim = validateNimFormat(params.nim);
  const nimKey = cleanNim.toLowerCase();
  const internalEmail = `${nimKey}@klik.internal`;
  const cleanName = clampStr(params.name, 120);
  const initials = getInitials(cleanName);
  const normalizedCode = clampStr(
    String(params.classCode ?? '').toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
    32
  );

  if (!cleanName) {
    throw new Error('Nama lengkap wajib diisi.');
  }
  if (!params.password || params.password.length < 6) {
    throw new Error('Password minimal 6 karakter.');
  }
  if (normalizedCode.length < 2) {
    throw new Error(
      'Kode kelas minimal 2 karakter (huruf/angka/tanda hubung, misal TI-3A).'
    );
  }
  if (!String(params.className ?? '').trim()) {
    throw new Error('Nama kelas wajib diisi.');
  }

  let fbUser = null;
  let createdNewAuthUser = false;

  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      internalEmail,
      params.password
    );
    fbUser = cred.user;
    createdNewAuthUser = true;
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error));
  }

  const cleanupFailedAuth = async () => {
    if (!fbUser) return;
    try {
      if (createdNewAuthUser) {
        await deleteUser(fbUser);
      } else {
        await signOut(auth);
      }
    } catch {
      await signOut(auth).catch(() => undefined);
    }
  };

  try {
    const existingDir = await lookupClassByCode(normalizedCode);
    if (existingDir) {
      throw new Error(
        `Kode kelas "${normalizedCode}" sudah digunakan. Silakan gunakan kode kelas lain atau aktivasi akun pada kelas tersebut.`
      );
    }

    const uid = fbUser.uid;
    const classId = makeSafeId('cls');
    const creatorCodeHash = await sha256Hex(
      `${normalizedCode}:${nimKey}:${generateActivationCode()}`
    );

    const batch = writeBatch(db);

    batch.set(doc(db, 'classes', classId), {
      id: classId,
      code: normalizedCode,
      name: clampStr(params.className, 120),
      semester: clampStr(params.semester, 64),
      academicYear: clampStr(params.academicYear, 32),
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'classDirectory', normalizedCode), {
      classId,
      code: normalizedCode,
      name: clampStr(params.className, 120),
      semester: clampStr(params.semester, 64),
      academicYear: clampStr(params.academicYear, 32),
      createdBy: uid,
    });

    batch.set(doc(db, 'classes', classId, 'members', uid), {
      userId: uid,
      classId,
      nim: cleanNim,
      name: cleanName,
      avatarInitials: initials,
      role: 'admin',
      title: 'Komting',
      status: 'active',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'classes', classId, 'roster', nimKey), {
      nim: cleanNim,
      nimKey,
      classId,
      name: cleanName,
      role: 'admin',
      title: 'Komting',
      status: 'active',
      activationCodeHash: creatorCodeHash,
      claimedByUid: uid,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'users', uid), {
      uid,
      nim: cleanNim,
      name: cleanName,
      email: internalEmail,
      avatarInitials: initials,
      activeClassId: classId,
      role: 'admin',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    if (params.seedSampleData) {
      await seedSampleClassData(classId, uid, normalizedCode);
    }

    return {
      profile: {
        id: uid,
        nim: cleanNim,
        name: cleanName,
        email: internalEmail,
        avatarInitials: initials,
        activeClassId: classId,
        role: 'admin',
        status: 'active',
      },
      classId,
    };
  } catch (error) {
    await cleanupFailedAuth();
    if (error instanceof Error) throw error;
    throw new Error('Gagal membuat workspace kelas baru.');
  }
}

export async function seedSampleClassData(classId, adminUid, classCode) {
  const demo = createInitialDemoData(new Date());

  const batch1 = writeBatch(db);
  demo.courses.forEach((c) => {
    const courseRef = doc(db, 'classes', classId, 'courses', c.id);
    batch1.set(courseRef, {
      id: c.id,
      classId,
      code: c.code,
      name: c.name,
      lecturer: c.lecturer,
      credits: c.credits,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (c.collection) {
      const colRef = doc(db, 'classes', classId, 'courseCollections', c.id);
      batch1.set(colRef, {
        id: c.collection.id,
        courseId: c.id,
        label: c.collection.label,
        url: c.collection.url,
        updatedAt: serverTimestamp(),
      });
    }
  });

  demo.schedules.forEach((s) => {
    const schRef = doc(db, 'classes', classId, 'schedules', s.id);
    batch1.set(schRef, {
      id: s.id,
      classId,
      courseId: s.courseId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch1.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `classes/${classId}/seed1`);
  }

  const batch2 = writeBatch(db);

  demo.scheduleExceptions.forEach((exc) => {
    const excRef = doc(db, 'classes', classId, 'scheduleExceptions', exc.id);
    batch2.set(excRef, {
      id: exc.id,
      classId,
      scheduleId: exc.scheduleId,
      date: exc.date,
      type: exc.type,
      overrideCourseId: exc.overrideCourseId ?? null,
      overrideStartTime: exc.overrideStartTime ?? null,
      overrideEndTime: exc.overrideEndTime ?? null,
      overrideRoom: exc.overrideRoom ?? null,
      reason: exc.reason ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  demo.individualTasks.forEach((t) => {
    const taskRef = doc(db, 'classes', classId, 'individualTasks', t.id);
    batch2.set(taskRef, {
      id: t.id,
      classId,
      courseId: t.courseId,
      title: t.title,
      descriptionHtml: t.descriptionHtml,
      deadline: t.deadline ?? null,
      overrideCollectionLabel: t.overrideCollectionLabel ?? null,
      overrideCollectionUrl: t.overrideCollectionUrl ?? null,
      version: 1,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  demo.groupActivities.forEach((ga) => {
    const gaRef = doc(db, 'classes', classId, 'groupActivities', ga.id);
    batch2.set(gaRef, {
      id: ga.id,
      classId,
      courseId: ga.courseId,
      name: ga.name,
      totalParticipants: ga.totalParticipants,
      groupCount: ga.groupCount,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
    });
  });

  demo.groups.forEach((g) => {
    const gRef = doc(db, 'classes', classId, 'groups', g.id);
    batch2.set(gRef, {
      id: g.id,
      classId,
      activityId: g.activityId,
      groupNumber: g.groupNumber,
      isFinal: false,
      finalizedAt: null,
      finalizedBy: null,
    });
  });

  demo.announcements.forEach((ann) => {
    const annRef = doc(db, 'classes', classId, 'announcements', ann.id);
    batch2.set(annRef, {
      id: ann.id,
      classId,
      courseId: ann.courseId ?? null,
      title: ann.title,
      content: ann.content.replace(/TI-3A/g, classCode),
      authorId: adminUid,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch2.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `classes/${classId}/seed2`);
  }

  const batch3 = writeBatch(db);
  demo.groupTasks.forEach((gt) => {
    const gtRef = doc(db, 'classes', classId, 'groupTasks', gt.id);
    batch3.set(gtRef, {
      id: gt.id,
      classId,
      activityId: gt.activityId,
      title: gt.title,
      descriptionHtml: gt.descriptionHtml,
      deadline: gt.deadline ?? null,
      overrideCollectionLabel: gt.overrideCollectionLabel ?? null,
      overrideCollectionUrl: gt.overrideCollectionUrl ?? null,
      version: 1,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const firstAnn = demo.announcements[0];
  if (firstAnn) {
    const ntfId = makeSafeId('ntf');
    batch3.set(doc(db, 'classes', classId, 'notifications', ntfId), {
      id: ntfId,
      classId,
      userId: adminUid,
      type: 'announcement_new',
      title: 'Workspace kelas siap digunakan',
      message: `Kelas ${classCode} berhasil terhubung ke Cloud Firestore.`,
      targetSection: 'pengumuman',
      targetId: firstAnn.id,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch3.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `classes/${classId}/seed3`);
  }
}

// ------------------------------------------------------------------
// Real-Time Firestore Listeners per Active Class
// ------------------------------------------------------------------

export function subscribeToClassWorkspace(classId, userId, onPatch) {
  const unsubs = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'classes', classId),
      (snap) => {
        if (!snap.exists()) {
          onPatch({ classInfo: null });
          return;
        }
        const d = snap.data();
        onPatch({
          classInfo: {
            id: d.id,
            code: d.code,
            name: d.name,
            semester: d.semester,
            academicYear: d.academicYear,
          },
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, `classes/${classId}`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'members'),
      (snap) => {
        const memberships = [];
        const memberUsers = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          memberships.push({
            id: `${classId}_${d.userId}`,
            classId: d.classId,
            userId: d.userId,
            role: d.role,
            title: d.title,
            status: d.status ?? 'active',
          });
          memberUsers.push({
            id: d.userId,
            nim: d.nim,
            name: d.name,
            email: '',
            avatarInitials: d.avatarInitials,
            activeClassId: classId,
            role: d.role,
            status: d.status ?? 'active',
          });
        });
        onPatch({ memberships, memberUsers });
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `classes/${classId}/members`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'courses'),
      (snap) => {
        const rawCourses = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          rawCourses.push({
            id: d.id,
            classId: d.classId,
            code: d.code,
            name: d.name,
            lecturer: d.lecturer,
            credits: d.credits,
          });
        });
        onPatch({ rawCourses });
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `classes/${classId}/courses`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'courseCollections'),
      (snap) => {
        const map = {};
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          map[d.courseId] = {
            id: d.id,
            courseId: d.courseId,
            label: d.label,
            url: d.url,
            updatedAt: toIsoString(d.updatedAt),
          };
        });
        onPatch({ courseCollections: map });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/courseCollections`
        )
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'schedules'),
      (snap) => {
        const schedules = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          schedules.push({
            id: d.id,
            classId: d.classId,
            courseId: d.courseId,
            dayOfWeek: d.dayOfWeek,
            startTime: d.startTime,
            endTime: d.endTime,
            room: d.room,
            effectiveFrom: d.effectiveFrom ?? undefined,
            effectiveUntil: d.effectiveUntil ?? undefined,
          });
        });
        onPatch({ schedules });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/schedules`
        )
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'scheduleExceptions'),
      (snap) => {
        const scheduleExceptions = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          scheduleExceptions.push({
            id: d.id,
            scheduleId: d.scheduleId,
            date: d.date,
            type: d.type,
            overrideCourseId: d.overrideCourseId ?? undefined,
            overrideStartTime: d.overrideStartTime ?? undefined,
            overrideEndTime: d.overrideEndTime ?? undefined,
            overrideRoom: d.overrideRoom ?? undefined,
            reason: d.reason ?? undefined,
            createdAt: toIsoString(d.createdAt),
          });
        });
        onPatch({ scheduleExceptions });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/scheduleExceptions`
        )
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'individualTasks'),
      (snap) => {
        const individualTasks = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          individualTasks.push({
            id: d.id,
            classId: d.classId,
            courseId: d.courseId,
            title: d.title,
            descriptionHtml: d.descriptionHtml,
            deadline: d.deadline ?? null,
            overrideCollectionLabel: d.overrideCollectionLabel ?? null,
            overrideCollectionUrl: d.overrideCollectionUrl ?? null,
            version: typeof d.version === 'number' ? d.version : 1,
            createdBy: d.createdBy,
            createdAt: toIsoString(d.createdAt),
            updatedAt: toIsoString(d.updatedAt),
          });
        });
        onPatch({ individualTasks });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/individualTasks`
        )
    )
  );

  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'classes', classId, 'taskCompletions'),
        where('userId', '==', userId)
      ),
      (snap) => {
        const individualTaskCompletions = [];
        const individualTaskNotes = {};
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          individualTaskCompletions.push({
            id: d.id,
            taskId: d.taskId,
            userId: d.userId,
            taskVersion: typeof d.taskVersion === 'number' ? d.taskVersion : 1,
            completed: Boolean(d.completed),
            completedAt: d.completedAt ?? null,
          });
          if (typeof d.note === 'string' && d.note.length > 0) {
            individualTaskNotes[`${d.taskId}_${d.userId}`] = d.note;
          }
        });
        onPatch({ individualTaskCompletions, individualTaskNotes });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/taskCompletions`
        )
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'groupActivities'),
      (snap) => {
        const groupActivities = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          groupActivities.push({
            id: d.id,
            classId: d.classId,
            courseId: d.courseId,
            name: d.name ?? '',
            totalParticipants: d.totalParticipants,
            groupCount: d.groupCount,
            createdBy: d.createdBy,
            createdAt: toIsoString(d.createdAt),
          });
        });
        onPatch({ groupActivities });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/groupActivities`
        )
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'groups'),
      (snap) => {
        const groups = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          groups.push({
            id: d.id,
            activityId: d.activityId,
            groupNumber: d.groupNumber,
            isFinal: Boolean(d.isFinal),
            finalizedAt: d.finalizedAt ?? null,
            finalizedBy: d.finalizedBy ?? null,
          });
        });
        onPatch({ groups });
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `classes/${classId}/groups`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'groupMembers'),
      (snap) => {
        const groupMembers = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          groupMembers.push({
            id: d.id,
            groupId: d.groupId,
            activityId: d.activityId,
            userId: d.userId ?? null,
            fullName: d.fullName,
            nim: d.nim ?? null,
            isExternal: Boolean(d.isExternal),
            joinedAt: toIsoString(d.joinedAt),
          });
        });
        onPatch({ groupMembers });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/groupMembers`
        )
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'groupTasks'),
      (snap) => {
        const groupTasks = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          groupTasks.push({
            id: d.id,
            activityId: d.activityId,
            title: d.title,
            descriptionHtml: d.descriptionHtml,
            deadline: d.deadline ?? null,
            overrideCollectionLabel: d.overrideCollectionLabel ?? null,
            overrideCollectionUrl: d.overrideCollectionUrl ?? null,
            version: typeof d.version === 'number' ? d.version : 1,
            createdBy: d.createdBy,
            createdAt: toIsoString(d.createdAt),
            updatedAt: toIsoString(d.updatedAt),
          });
        });
        onPatch({ groupTasks });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/groupTasks`
        )
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'groupTaskCompletions'),
      (snap) => {
        const groupTaskCompletions = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          groupTaskCompletions.push({
            id: d.id,
            groupTaskId: d.groupTaskId,
            groupId: d.groupId,
            taskVersion: typeof d.taskVersion === 'number' ? d.taskVersion : 1,
            completed: Boolean(d.completed),
            completedBy: d.completedBy ?? null,
            completedAt: d.completedAt ?? null,
          });
        });
        onPatch({ groupTaskCompletions });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/groupTaskCompletions`
        )
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'classes', classId, 'announcements'),
      (snap) => {
        const announcements = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          announcements.push({
            id: d.id,
            classId: d.classId,
            courseId: d.courseId ?? null,
            title: d.title,
            content: d.content,
            authorId: d.authorId,
            publishedAt: toIsoString(d.publishedAt),
            updatedAt: toIsoString(d.updatedAt),
          });
        });
        onPatch({ announcements });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/announcements`
        )
    )
  );

  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'classes', classId, 'notifications'),
        where('userId', '==', userId)
      ),
      (snap) => {
        const notifications = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          notifications.push({
            id: d.id,
            userId: d.userId,
            type: d.type,
            title: d.title,
            message: d.message,
            targetSection: d.targetSection,
            targetId: d.targetId,
            isRead: Boolean(d.isRead),
            createdAt: toIsoString(d.createdAt),
          });
        });
        onPatch({ notifications });
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `classes/${classId}/notifications`
        )
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

// ------------------------------------------------------------------
// Firestore Write Operations
// ------------------------------------------------------------------

export async function saveUserAvatar(uid, avatarId) {
  const path = `users/${uid}`;

  try {
    await updateDoc(doc(db, 'users', uid), {
      avatarId: avatarId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error saveUserAvatar:', error.code, error.message);
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function fsUpsertCourseCollection(
  classId,
  courseId,
  courseName,
  existingCollectionId,
  label,
  url
) {
  const path = `classes/${classId}/courseCollections/${courseId}`;
  const cleanUrl = clampStr(url, 500);
  const cleanLabel = clampStr(label || `Pengumpulan ${courseName}`, 150);

  try {
    if (!cleanUrl) {
      await deleteDoc(doc(db, 'classes', classId, 'courseCollections', courseId));
      return;
    }
    const id = existingCollectionId ?? makeSafeId('col');
    await setDoc(doc(db, 'classes', classId, 'courseCollections', courseId), {
      id,
      courseId,
      label: cleanLabel,
      url: cleanUrl,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsAddSchedule(classId, input) {
  const id = makeSafeId('sch');
  const path = `classes/${classId}/schedules/${id}`;
  try {
    await setDoc(doc(db, 'classes', classId, 'schedules', id), {
      id,
      classId,
      courseId: input.courseId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      room: clampStr(input.room, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fsSaveScheduleException(
  classId,
  existingExceptionId,
  payload
) {
  const id = existingExceptionId ?? makeSafeId('exc');
  const path = `classes/${classId}/scheduleExceptions/${id}`;
  try {
    if (existingExceptionId) {
      await updateDoc(
        doc(db, 'classes', classId, 'scheduleExceptions', id),
        {
          type: payload.type,
          overrideCourseId: payload.overrideCourseId ?? null,
          overrideStartTime: payload.overrideStartTime ?? null,
          overrideEndTime: payload.overrideEndTime ?? null,
          overrideRoom: payload.overrideRoom
            ? clampStr(payload.overrideRoom, 120)
            : null,
          reason: payload.reason ? clampStr(payload.reason, 500) : null,
          updatedAt: serverTimestamp(),
        }
      );
    } else {
      await setDoc(doc(db, 'classes', classId, 'scheduleExceptions', id), {
        id,
        classId,
        scheduleId: payload.scheduleId,
        date: payload.date,
        type: payload.type,
        overrideCourseId: payload.overrideCourseId ?? null,
        overrideStartTime: payload.overrideStartTime ?? null,
        overrideEndTime: payload.overrideEndTime ?? null,
        overrideRoom: payload.overrideRoom
          ? clampStr(payload.overrideRoom, 120)
          : null,
        reason: payload.reason ? clampStr(payload.reason, 500) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteScheduleException(classId, exceptionId) {
  const path = `classes/${classId}/scheduleExceptions/${exceptionId}`;
  try {
    await deleteDoc(doc(db, 'classes', classId, 'scheduleExceptions', exceptionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fsSplitScheduleThisAndFollowing(
  classId,
  oldSchedule,
  dayBeforeKey,
  instanceDate,
  newDayOfWeek,
  input,
  futureExceptionIds
) {
  const batch = writeBatch(db);
  const oldRef = doc(db, 'classes', classId, 'schedules', oldSchedule.id);
  batch.update(oldRef, {
    effectiveUntil: dayBeforeKey,
    updatedAt: serverTimestamp(),
  });

  const newId = makeSafeId('sch');
  const newRef = doc(db, 'classes', classId, 'schedules', newId);
  batch.set(newRef, {
    id: newId,
    classId,
    courseId: input.courseId,
    dayOfWeek: newDayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    room: clampStr(input.room, 120),
    effectiveFrom: instanceDate,
    effectiveUntil: oldSchedule.effectiveUntil ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  futureExceptionIds.forEach((excId) => {
    batch.delete(doc(db, 'classes', classId, 'scheduleExceptions', excId));
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `classes/${classId}/schedules`
    );
  }
}

export async function fsUpdateAllRecurringSchedule(classId, scheduleId, input) {
  const path = `classes/${classId}/schedules/${scheduleId}`;
  try {
    await updateDoc(doc(db, 'classes', classId, 'schedules', scheduleId), {
      courseId: input.courseId,
      startTime: input.startTime,
      endTime: input.endTime,
      room: clampStr(input.room, 120),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fsDeleteSchedule(classId, scheduleId, exceptionIds) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'classes', classId, 'schedules', scheduleId));
  exceptionIds.forEach((excId) => {
    batch.delete(doc(db, 'classes', classId, 'scheduleExceptions', excId));
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `classes/${classId}/schedules/${scheduleId}`
    );
  }
}

export async function fsUpsertTaskCompletion(
  classId,
  taskId,
  userId,
  taskVersion,
  completed,
  note,
  existsInDb
) {
  const docId = `${taskId}_${userId}`;
  const path = `classes/${classId}/taskCompletions/${docId}`;
  const completedAt = completed ? new Date().toISOString() : null;
  const cleanNote = String(note ?? '').slice(0, 2000);

  try {
    if (existsInDb) {
      await updateDoc(doc(db, 'classes', classId, 'taskCompletions', docId), {
        taskVersion,
        completed,
        completedAt,
        note: cleanNote,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'classes', classId, 'taskCompletions', docId), {
        id: docId,
        classId,
        taskId,
        userId,
        taskVersion,
        completed,
        completedAt,
        note: cleanNote,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsCreateIndividualTask(
  classId,
  createdBy,
  memberUserIds,
  courseName,
  input
) {
  const taskId = makeSafeId('tsk');
  const cleanTitle = clampStr(input.title, 200);
  const batch = writeBatch(db);

  batch.set(doc(db, 'classes', classId, 'individualTasks', taskId), {
    id: taskId,
    classId,
    courseId: input.courseId,
    title: cleanTitle,
    descriptionHtml: String(input.descriptionHtml ?? '').slice(0, 12000),
    deadline: input.deadline ?? null,
    overrideCollectionLabel: input.overrideCollectionLabel
      ? clampStr(input.overrideCollectionLabel, 150)
      : null,
    overrideCollectionUrl: input.overrideCollectionUrl
      ? clampStr(input.overrideCollectionUrl, 500)
      : null,
    version: 1,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  memberUserIds.forEach((uid) => {
    const ntfId = makeSafeId('ntf');
    batch.set(doc(db, 'classes', classId, 'notifications', ntfId), {
      id: ntfId,
      classId,
      userId: uid,
      type: 'task_new',
      title: 'Tugas baru',
      message: clampStr(`${cleanTitle} · ${courseName}`, 300),
      targetSection: 'tugas',
      targetId: taskId,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `classes/${classId}/individualTasks/${taskId}`
    );
  }
}

export async function fsUpdateIndividualTask(
  classId,
  taskId,
  nextVersion,
  memberUserIds,
  courseName,
  input
) {
  const cleanTitle = clampStr(input.title, 200);
  const batch = writeBatch(db);

  batch.update(doc(db, 'classes', classId, 'individualTasks', taskId), {
    courseId: input.courseId,
    title: cleanTitle,
    descriptionHtml: String(input.descriptionHtml ?? '').slice(0, 12000),
    deadline: input.deadline ?? null,
    overrideCollectionLabel: input.overrideCollectionLabel
      ? clampStr(input.overrideCollectionLabel, 150)
      : null,
    overrideCollectionUrl: input.overrideCollectionUrl
      ? clampStr(input.overrideCollectionUrl, 500)
      : null,
    version: nextVersion,
    updatedAt: serverTimestamp(),
  });

  memberUserIds.forEach((uid) => {
    const ntfId = makeSafeId('ntf');
    batch.set(doc(db, 'classes', classId, 'notifications', ntfId), {
      id: ntfId,
      classId,
      userId: uid,
      type: 'task_updated',
      title: 'Tugas diperbarui',
      message: clampStr(
        `${cleanTitle} · ${courseName} (status selesai di-reset)`,
        300
      ),
      targetSection: 'tugas',
      targetId: taskId,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `classes/${classId}/individualTasks/${taskId}`
    );
  }
}

export async function fsDeleteIndividualTask(classId, taskId) {
  const path = `classes/${classId}/individualTasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'classes', classId, 'individualTasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fsCreateGroupActivity(classId, createdBy, input) {
  const activityId = makeSafeId('ga');
  const totalParticipants = Math.max(1, Math.floor(input.totalParticipants));
  const groupCount = Math.max(1, Math.floor(input.groupCount));
  const cleanName = clampStr(input.name, 150);

  const batch = writeBatch(db);
  batch.set(doc(db, 'classes', classId, 'groupActivities', activityId), {
    id: activityId,
    classId,
    courseId: input.courseId,
    name: cleanName,
    totalParticipants,
    groupCount,
    createdBy,
    createdAt: serverTimestamp(),
  });

  for (let i = 1; i <= groupCount; i += 1) {
    const groupId = makeSafeId('grp');
    batch.set(doc(db, 'classes', classId, 'groups', groupId), {
      id: groupId,
      classId,
      activityId,
      groupNumber: i,
      isFinal: false,
      finalizedAt: null,
      finalizedBy: null,
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `classes/${classId}/groupActivities/${activityId}`
    );
  }

  return {
    id: activityId,
    classId,
    courseId: input.courseId,
    name: cleanName,
    totalParticipants,
    groupCount,
    createdBy,
    createdAt: new Date().toISOString(),
  };
}

export async function fsJoinGroup(
  classId,
  activityId,
  targetGroupId,
  previousMemberDocIds,
  user
) {
  const memberDocId = `${targetGroupId}_${user.id}`;
  const batch = writeBatch(db);

  previousMemberDocIds.forEach((prevId) => {
    batch.delete(doc(db, 'classes', classId, 'groupMembers', prevId));
  });

  batch.set(doc(db, 'classes', classId, 'groupMembers', memberDocId), {
    id: memberDocId,
    classId,
    activityId,
    groupId: targetGroupId,
    userId: user.id,
    fullName: clampStr(user.name, 120),
    nim: clampStr(user.nim, 32),
    isExternal: false,
    joinedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `classes/${classId}/groupMembers/${memberDocId}`
    );
  }
}

export async function fsLeaveGroup(classId, memberDocId) {
  const path = `classes/${classId}/groupMembers/${memberDocId}`;
  try {
    await deleteDoc(doc(db, 'classes', classId, 'groupMembers', memberDocId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fsFinalizeGroup(classId, groupId, finalizedByUid) {
  const path = `classes/${classId}/groups/${groupId}`;
  try {
    await updateDoc(doc(db, 'classes', classId, 'groups', groupId), {
      isFinal: true,
      finalizedAt: new Date().toISOString(),
      finalizedBy: finalizedByUid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fsAddExternalMember(
  classId,
  activityId,
  groupId,
  fullName
) {
  const memberId = makeSafeId('ext');
  const path = `classes/${classId}/groupMembers/${memberId}`;
  try {
    await setDoc(doc(db, 'classes', classId, 'groupMembers', memberId), {
      id: memberId,
      classId,
      activityId,
      groupId,
      userId: null,
      fullName: clampStr(fullName, 120),
      nim: null,
      isExternal: true,
      joinedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fsCreateGroupTask(classId, createdBy, input) {
  const id = makeSafeId('gt');
  const path = `classes/${classId}/groupTasks/${id}`;
  try {
    await setDoc(doc(db, 'classes', classId, 'groupTasks', id), {
      id,
      classId,
      activityId: input.activityId,
      title: clampStr(input.title, 200),
      descriptionHtml: String(input.descriptionHtml ?? '').slice(0, 12000),
      deadline: input.deadline ?? null,
      overrideCollectionLabel: input.overrideCollectionLabel
        ? clampStr(input.overrideCollectionLabel, 150)
        : null,
      overrideCollectionUrl: input.overrideCollectionUrl
        ? clampStr(input.overrideCollectionUrl, 500)
        : null,
      version: 1,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fsUpdateGroupTask(
  classId,
  groupTaskId,
  nextVersion,
  input
) {
  const path = `classes/${classId}/groupTasks/${groupTaskId}`;
  try {
    await updateDoc(doc(db, 'classes', classId, 'groupTasks', groupTaskId), {
      title: clampStr(input.title, 200),
      descriptionHtml: String(input.descriptionHtml ?? '').slice(0, 12000),
      deadline: input.deadline ?? null,
      overrideCollectionLabel: input.overrideCollectionLabel
        ? clampStr(input.overrideCollectionLabel, 150)
        : null,
      overrideCollectionUrl: input.overrideCollectionUrl
        ? clampStr(input.overrideCollectionUrl, 500)
        : null,
      version: nextVersion,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fsDeleteGroupTask(classId, groupTaskId) {
  const path = `classes/${classId}/groupTasks/${groupTaskId}`;
  try {
    await deleteDoc(doc(db, 'classes', classId, 'groupTasks', groupTaskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fsToggleGroupTaskCompletion(
  classId,
  groupTaskId,
  groupId,
  taskVersion,
  nextCompleted,
  actorUid,
  existsInDb
) {
  const docId = `${groupTaskId}_${groupId}`;
  const path = `classes/${classId}/groupTaskCompletions/${docId}`;
  try {
    if (existsInDb) {
      await updateDoc(
        doc(db, 'classes', classId, 'groupTaskCompletions', docId),
        {
          taskVersion,
          completed: nextCompleted,
          completedBy: nextCompleted ? actorUid : null,
          completedAt: nextCompleted ? new Date().toISOString() : null,
          updatedAt: serverTimestamp(),
        }
      );
    } else {
      await setDoc(doc(db, 'classes', classId, 'groupTaskCompletions', docId), {
        id: docId,
        classId,
        groupTaskId,
        groupId,
        taskVersion,
        completed: nextCompleted,
        completedBy: nextCompleted ? actorUid : null,
        completedAt: nextCompleted ? new Date().toISOString() : null,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsCreateAnnouncement(
  classId,
  authorId,
  memberUserIds,
  input
) {
  const annId = makeSafeId('ann');
  const cleanTitle = clampStr(input.title, 200);
  const batch = writeBatch(db);

  batch.set(doc(db, 'classes', classId, 'announcements', annId), {
    id: annId,
    classId,
    courseId: input.courseId ?? null,
    title: cleanTitle,
    content: clampStr(input.content, 8000),
    authorId,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  memberUserIds.forEach((uid) => {
    const ntfId = makeSafeId('ntf');
    batch.set(doc(db, 'classes', classId, 'notifications', ntfId), {
      id: ntfId,
      classId,
      userId: uid,
      type: 'announcement_new',
      title: 'Pengumuman baru',
      message: clampStr(cleanTitle, 300),
      targetSection: 'pengumuman',
      targetId: annId,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `classes/${classId}/announcements/${annId}`
    );
  }
}

export async function fsUpdateAnnouncement(classId, announcementId, input) {
  const path = `classes/${classId}/announcements/${announcementId}`;
  try {
    await updateDoc(
      doc(db, 'classes', classId, 'announcements', announcementId),
      {
        title: clampStr(input.title, 200),
        content: clampStr(input.content, 8000),
        courseId: input.courseId ?? null,
        updatedAt: serverTimestamp(),
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fsDeleteAnnouncement(classId, announcementId) {
  const path = `classes/${classId}/announcements/${announcementId}`;
  try {
    await deleteDoc(doc(db, 'classes', classId, 'announcements', announcementId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fsMarkNotificationRead(classId, notificationId) {
  const path = `classes/${classId}/notifications/${notificationId}`;
  try {
    await updateDoc(
      doc(db, 'classes', classId, 'notifications', notificationId),
      { isRead: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fsMarkAllNotificationsRead(classId, notificationIds) {
  if (notificationIds.length === 0) return;
  const batch = writeBatch(db);
  notificationIds.forEach((id) => {
    batch.update(doc(db, 'classes', classId, 'notifications', id), {
      isRead: true,
    });
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `classes/${classId}/notifications`
    );
  }
}

export async function fsUpdateMemberRole(
  classId,
  targetUserId,
  targetNim,
  role,
  title
) {
  const path = `classes/${classId}/members/${targetUserId}`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'classes', classId, 'members', targetUserId), {
    role,
    title: clampStr(title, 64),
    updatedAt: serverTimestamp(),
  });
  if (targetNim) {
    const nimKey = targetNim.trim().toLowerCase();
    batch.update(doc(db, 'classes', classId, 'roster', nimKey), {
      role,
      title: clampStr(title, 64),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToClassRoster(classId, onRoster) {
  return onSnapshot(
    collection(db, 'classes', classId, 'roster'),
    (snap) => {
      const items = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          nim: d.nim,
          nimKey: d.nimKey,
          classId: d.classId,
          name: d.name,
          role: d.role,
          title: d.title,
          status: d.status,
          activationCodeHash: d.activationCodeHash,
          claimedByUid: d.claimedByUid ?? null,
          createdBy: d.createdBy,
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
        });
      });
      items.sort((a, b) => a.nim.localeCompare(b.nim));
      onRoster(items);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `classes/${classId}/roster`)
  );
}

export async function fsProvisionRosterStudent(params) {
  const cleanNim = validateNimFormat(params.nim);
  const nimKey = cleanNim.toLowerCase();
  const cleanName = clampStr(params.name, 120);
  if (!cleanName) {
    throw new Error('Nama mahasiswa wajib diisi.');
  }

  const normalizedClassCode = params.classCode.trim().toUpperCase();
  const activationCode = generateActivationCode();
  const codeHash = await sha256Hex(
    `${normalizedClassCode}:${nimKey}:${activationCode}`
  );

  const existingSnap = await getDoc(
    doc(db, 'classes', params.classId, 'roster', nimKey)
  );
  if (existingSnap.exists()) {
    throw new Error(`NIM ${cleanNim} sudah terdaftar pada kelas ini.`);
  }

  const role = params.role ?? 'mahasiswa';
  const title = clampStr(
    params.title ?? (role === 'admin' ? 'Komting' : 'Mahasiswa'),
    64
  );

  const batch = writeBatch(db);
  batch.set(doc(db, 'classes', params.classId, 'roster', nimKey), {
    nim: cleanNim,
    nimKey,
    classId: params.classId,
    name: cleanName,
    role,
    title,
    status: 'pending',
    activationCodeHash: codeHash,
    claimedByUid: null,
    createdBy: params.adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'classes', params.classId, 'activationTickets', codeHash), {
    id: codeHash,
    classId: params.classId,
    nim: cleanNim,
    nimKey,
    name: cleanName,
    role,
    title,
    status: 'pending',
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return { nim: cleanNim, name: cleanName, activationCode };
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `classes/${params.classId}/roster/${nimKey}`
    );
  }
}

export async function fsResetRosterActivationCode(params) {
  if (params.entry.status !== 'pending' || params.entry.claimedByUid) {
    throw new Error(
      'Kode aktivasi hanya dapat dibuat ulang untuk akun yang belum diaktifkan.'
    );
  }

  const normalizedClassCode = params.classCode.trim().toUpperCase();
  const newCode = generateActivationCode();
  const newHash = await sha256Hex(
    `${normalizedClassCode}:${params.entry.nimKey}:${newCode}`
  );

  const batch = writeBatch(db);
  batch.delete(
    doc(
      db,
      'classes',
      params.classId,
      'activationTickets',
      params.entry.activationCodeHash
    )
  );
  batch.set(doc(db, 'classes', params.classId, 'activationTickets', newHash), {
    id: newHash,
    classId: params.classId,
    nim: params.entry.nim,
    nimKey: params.entry.nimKey,
    name: params.entry.name,
    role: params.entry.role,
    title: params.entry.title,
    status: 'pending',
    updatedAt: serverTimestamp(),
  });
  batch.update(
    doc(db, 'classes', params.classId, 'roster', params.entry.nimKey),
    {
      activationCodeHash: newHash,
      status: 'pending',
      claimedByUid: null,
      updatedAt: serverTimestamp(),
    }
  );

  try {
    await batch.commit();
    return newCode;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `classes/${params.classId}/roster/${params.entry.nimKey}`
    );
  }
}

export async function fsUpdateMemberAccountStatus(params) {
  if (!params.entry.claimedByUid) {
    throw new Error('Akun mahasiswa ini belum diaktifkan.');
  }
  const batch = writeBatch(db);
  batch.update(
    doc(db, 'classes', params.classId, 'roster', params.entry.nimKey),
    {
      status: params.nextStatus,
      updatedAt: serverTimestamp(),
    }
  );
  batch.update(
    doc(db, 'classes', params.classId, 'members', params.entry.claimedByUid),
    {
      status: params.nextStatus,
      updatedAt: serverTimestamp(),
    }
  );
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `classes/${params.classId}/members/${params.entry.claimedByUid}`
    );
  }
}

export async function fsDeletePendingRosterEntry(params) {
  if (params.entry.status !== 'pending' || params.entry.claimedByUid) {
    throw new Error(
      'Hanya entri yang belum diaktifkan yang dapat dihapus dari daftar. Untuk akun aktif, gunakan Nonaktifkan.'
    );
  }
  const batch = writeBatch(db);
  batch.delete(
    doc(db, 'classes', params.classId, 'roster', params.entry.nimKey)
  );
  batch.delete(
    doc(
      db,
      'classes',
      params.classId,
      'activationTickets',
      params.entry.activationCodeHash
    )
  );
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `classes/${params.classId}/roster/${params.entry.nimKey}`
    );
  }
}
