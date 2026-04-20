/* ============================================
   admin.js — Shanom Portfolio Admin Panel
   ============================================ */

let editingId = null;
let worksCache = [];

// ===== Auth State Listener =====
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('adminPage').style.display = 'block';
    loadWorks();
  } else {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('adminPage').style.display = 'none';
  }
});

// ===== Login =====
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');
  const errEl = document.getElementById('loginError');

  if (!email || !password) {
    showLoginError('กรุณากรอก email และ password');
    return;
  }

  btn.disabled = true;
  btnText.textContent = 'กำลัง login...';
  errEl.style.display = 'none';

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    btn.disabled = false;
    btnText.textContent = 'Login';
    const msg = err.code === 'auth/invalid-credential'
      ? 'Email หรือ Password ไม่ถูกต้อง'
      : 'เกิดข้อผิดพลาด: ' + err.message;
    showLoginError(msg);
  }
}

// Allow Enter key to login
document.addEventListener('DOMContentLoaded', () => {
  ['loginEmail', 'loginPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  });
});

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

// ===== Logout =====
async function handleLogout() {
  if (confirm('ออกจากระบบ?')) {
    await auth.signOut();
  }
}

// ===== Load Works from Firestore =====
async function loadWorks() {
  const loader = document.getElementById('tableLoader');
  const table = document.getElementById('worksTable');
  const emptyState = document.getElementById('emptyState');

  loader.style.display = 'flex';
  table.style.display = 'none';
  emptyState.style.display = 'none';

  try {
    const snapshot = await db.collection('works').orderBy('createdAt', 'desc').get();
    worksCache = [];
    snapshot.forEach(doc => {
      worksCache.push({ id: doc.id, ...doc.data() });
    });

    renderTable(worksCache);
    updateStats(worksCache);
  } catch (err) {
    showToast('โหลดข้อมูลไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    loader.style.display = 'none';
  }
}

function renderTable(works) {
  const tbody = document.getElementById('worksTableBody');
  const table = document.getElementById('worksTable');
  const emptyState = document.getElementById('emptyState');

  tbody.innerHTML = '';

  if (works.length === 0) {
    emptyState.style.display = 'block';
    table.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  table.style.display = 'table';

  works.forEach(work => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escHtml(work.title || '—')}</strong></td>
      <td><span class="type-badge ${work.type || 'music'}">${work.type === 'lyrics' ? '🎥 Lyrics Video' : '🎵 เพลง'}</span></td>
      <td>${escHtml(work.genre || '—')}</td>
      <td>${escHtml(work.year || '—')}</td>
      <td>
        <div class="actions">
          <button class="btn-edit" onclick="openModal('${work.id}')">✏️ แก้ไข</button>
          <button class="btn-delete" onclick="deleteWork('${work.id}', '${escHtml(work.title || '')}')">🗑️ ลบ</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateStats(works) {
  const music = works.filter(w => w.type === 'music').length;
  const lyrics = works.filter(w => w.type === 'lyrics').length;
  document.getElementById('statTotal').textContent = works.length;
  document.getElementById('statMusic').textContent = music;
  document.getElementById('statLyrics').textContent = lyrics;
}

// ===== Modal =====
function openModal(id = null) {
  editingId = id;
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = id ? 'แก้ไขผลงาน' : 'เพิ่มผลงาน';
  document.getElementById('saveBtnText').textContent = id ? 'บันทึกการแก้ไข' : 'บันทึก';

  // Populate form if editing
  if (id) {
    const work = worksCache.find(w => w.id === id);
    if (work) {
      document.getElementById('fTitle').value = work.title || '';
      document.getElementById('fDesc').value = work.description || '';
      document.getElementById('fType').value = work.type || 'music';
      document.getElementById('fColor').value = work.colorVariant || '';
      document.getElementById('fGenre').value = work.genre || '';
      document.getElementById('fYear').value = work.year || '';
      document.getElementById('fTag').value = work.tag || '';
      document.getElementById('fYoutube').value = work.youtube || '';
    }
  } else {
    clearForm();
  }

  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
  clearForm();
}

function clearForm() {
  ['fTitle', 'fDesc', 'fGenre', 'fYear', 'fTag', 'fYoutube'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('fType').value = 'music';
  document.getElementById('fColor').value = '';
}

// Close modal on overlay click
document.getElementById('modalOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// ===== Save Work =====
async function saveWork() {
  const title = document.getElementById('fTitle').value.trim();
  if (!title) {
    showToast('กรุณาใส่ชื่อผลงาน', 'error');
    return;
  }

  const data = {
    title,
    description: document.getElementById('fDesc').value.trim(),
    type: document.getElementById('fType').value,
    colorVariant: document.getElementById('fColor').value,
    genre: document.getElementById('fGenre').value.trim(),
    year: document.getElementById('fYear').value.trim(),
    tag: document.getElementById('fTag').value.trim(),
    youtube: document.getElementById('fYoutube').value.trim(),
  };

  const saveBtn = document.getElementById('saveBtn');
  const saveTxt = document.getElementById('saveBtnText');
  saveBtn.disabled = true;
  saveTxt.textContent = 'กำลังบันทึก...';

  try {
    if (editingId) {
      await db.collection('works').doc(editingId).update(data);
      showToast('แก้ไขเรียบร้อยแล้ว ✓', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('works').add(data);
      showToast('เพิ่มผลงานเรียบร้อยแล้ว ✓', 'success');
    }
    closeModal();
    await loadWorks();
  } catch (err) {
    showToast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveTxt.textContent = editingId ? 'บันทึกการแก้ไข' : 'บันทึก';
  }
}

// ===== Delete Work =====
async function deleteWork(id, title) {
  if (!confirm(`ลบ "${title}" ออก?\n\nไม่สามารถเรียกคืนได้`)) return;
  try {
    await db.collection('works').doc(id).delete();
    showToast('ลบเรียบร้อยแล้ว', 'success');
    await loadWorks();
  } catch (err) {
    showToast('ลบไม่สำเร็จ: ' + err.message, 'error');
  }
}

// ===== Toast =====
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ' ' + type : '');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

// ===== Helpers =====
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
