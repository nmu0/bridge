import { initAuthUI, showToast } from './nav-auth.js';
import { supabase } from './supabase-client.js';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

let currentUser = null;

const fileInput = document.getElementById('resumeFile');
const uploadBtn = document.getElementById('uploadBtn');
const statusEl = document.getElementById('resumeStatus');

const { openAuthModal } = initAuthUI((user) => {
  currentUser = user;
  renderResumeState();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) statusEl.textContent = `Selected: ${file.name}`;
  uploadBtn.disabled = !file || !currentUser;
});

uploadBtn.addEventListener('click', async () => {
  if (!currentUser) {
    openAuthModal('login');
    showToast('Log in first to upload a resume.');
    return;
  }

  const file = fileInput.files[0];
  if (!file) return;

  if (file.type !== 'application/pdf') {
    showToast('Please upload a PDF file.');
    return;
  }
  if (file.size > MAX_SIZE) {
    showToast('File is too large — 5MB max.');
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading…';

  const path = `${currentUser.id}/resume.pdf`;
  const { error } = await supabase.storage
    .from('resumes')
    .upload(path, file, { upsert: true, contentType: 'application/pdf' });

  uploadBtn.textContent = 'Upload resume';

  if (error) {
    uploadBtn.disabled = false;
    showToast(`Upload failed: ${error.message}`);
    return;
  }

  showToast('Resume uploaded.');
  fileInput.value = '';
  await renderResumeState();
});

async function renderResumeState() {
  if (!currentUser) {
    statusEl.textContent = 'Log in to upload a resume.';
    uploadBtn.disabled = true;
    return;
  }

  const { data, error } = await supabase.storage
    .from('resumes')
    .list(currentUser.id, { search: 'resume.pdf' });

  if (error || !data || data.length === 0) {
    statusEl.textContent = 'No resume uploaded yet.';
    uploadBtn.disabled = !fileInput.files[0];
    return;
  }

  const path = `${currentUser.id}/resume.pdf`;
  const { data: urlData } = await supabase.storage
    .from('resumes')
    .createSignedUrl(path, 60 * 60);

  const uploadedAt = new Date(data[0].created_at || data[0].updated_at).toLocaleDateString();
  statusEl.innerHTML = `Current resume: <a href="${urlData?.signedUrl}" target="_blank">${data[0].name}</a> · uploaded ${uploadedAt}`;
  uploadBtn.disabled = !fileInput.files[0];
}
