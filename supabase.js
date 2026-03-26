const SUPABASE_URL = 'https://slximhnkvcevjwrtdpns.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNseGltaG5rdmNldmp3cnRkcG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjY5NDcsImV4cCI6MjA5MDAwMjk0N30.b3mMYrhuRtMkiiczJg9yEX593VWmOdoXsf9-e4QYe1I';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ดึง members ทั้งหมด
async function getMembers() {
  const { data, error } = await db.from('members').select('*').order('sort_order', { ascending: true });
  if (error) console.error('getMembers error:', error);
  return data || [];
}

// ดึงรูปตาม member
async function getPhotos(memberId) {
  const { data, error } = await db.from('photos').select('*').eq('member_id', memberId).order('created_at', { ascending: false });
  if (error) console.error('getPhotos error:', error);
  return data || [];
}

// ดึงรูปทั้งหมด
async function getAllPhotos() {
  const { data, error } = await db.from('photos').select('*').order('created_at', { ascending: false });
  if (error) console.error('getAllPhotos error:', error);
  return data || [];
}

// อัปโหลดรูปไป Storage
async function uploadPhoto(file, memberId) {
  const ext = file.name.split('.').pop();
  const unique = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const path = `${memberId}/${unique}.${ext}`;
  const { data, error } = await db.storage.from('photos').upload(path, file);
  if (error) { console.error('upload error:', error); return null; }
  const { data: urlData } = db.storage.from('photos').getPublicUrl(path);
  return urlData.publicUrl;
}

// บันทึก photo record ลง DB
async function savePhotoRecord(memberId, url) {
  const { error } = await db.from('photos').insert({ member_id: memberId, url });
  if (error) console.error('savePhotoRecord error:', error);
}

// ลบรูป
async function deletePhoto(id, url) {
  const path = url.split('/photos/')[1];
  if (path) await db.storage.from('photos').remove([path]);
  await db.from('photos').delete().eq('id', id);
}

// อัปโหลด avatar
async function uploadAvatar(file, memberId) {
  const ext = file.name.split('.').pop();
  const path = `${memberId}.${ext}`;
  
  // ลองลบไฟล์เก่าทุกนามสกุล
  const exts = ['jpg','jpeg','png','webp','gif'];
  const removePaths = exts.map(e => `${memberId}.${e}`);
  await db.storage.from('avatars').remove(removePaths);
  
  const { data: upData, error: upError } = await db.storage.from('avatars').upload(path, file, { 
    cacheControl: '0',
    upsert: true 
  });
  if (upError) { console.error('avatar upload error:', upError); return null; }
  
  const { data } = db.storage.from('avatars').getPublicUrl(path);
  const url = data.publicUrl + '?v=' + Date.now();
  
  const { error: dbError } = await db.from('members').update({ avatar_url: url }).eq('id', memberId);
  if (dbError) { console.error('avatar db update error:', dbError); return null; }
  
  return url;
}

// ดึง settings
async function getSettings() {
  const { data } = await db.from('settings').select('*');
  const obj = {};
  (data || []).forEach(r => obj[r.key] = r.value);
  return obj;
}

// อัปเดต setting
async function updateSetting(key, value) {
  await db.from('settings').upsert({ key, value });
}

// Image optimization: convert public URL to resized/optimized URL
function thumbUrl(url, quality = 60) {
  if (!url || !url.includes('/object/public/')) return url;
  return url.replace('/object/public/', '/render/image/public/') + '?quality=' + quality;
}

// Tiny placeholder for blur-up effect (20px wide, very fast)
function tinyUrl(url) {
  if (!url || !url.includes('/object/public/')) return url;
  return url.replace('/object/public/', '/render/image/public/') + '?width=20&quality=20';
}

function fullUrl(url) {
  return url;
}
