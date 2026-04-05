// GMIM Smirna - Sistem Informasi Digital
const SUPABASE_URL = 'https://vgjhlvzjwnhsgpozznrp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnamhsdnpqd25oc2dwb3p6bnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjM0NDIsImV4cCI6MjA4NzE5OTQ0Mn0.o4kikie_9ifzIEDKEoaA1jf5XHJkU8YUF6KkFpRWIfg';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {auth:{storageKey:'sb_pub'}});
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnamhsdnpqd25oc2dwb3p6bnJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYyMzQ0MiwiZXhwIjoyMDg3MTk5NDQyfQ.DaE12OxaUgyelrSD6TgyRO2UfMfDKKAyEAsCSLHNZJM';
const sbAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {auth:{storageKey:'sb_adm',persistSession:false,autoRefreshToken:false}});

let currentUser = null;
function isAdmin() { return currentUser && (currentUser.kolom === 0 || currentUser.kolom === -1); }
function isSuperAdmin() { return currentUser && currentUser.kolom === 0; }
let allJemaat = [];
let filteredJemaat = [];
let currentPage = 1;
let perPage = 25;

const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ===== URUTAN ANGGOTA KELUARGA =====
// Suami(1) → Istri(2) → Anak(3, tertua→termuda) → Orang Tua/Tanggungan(4) → Lainnya(5)
function sortAnggotaKeluarga(members) {
  // Normalisasi relasi (case-insensitive, trim)
  function getRelasiOrder(relasi) {
    const r = (relasi||'').trim().toLowerCase();
    if (r === 'suami') return 1;
    if (r === 'istri') return 2;
    if (r === 'anak') return 3;
    if (r === 'orang tua' || r === 'tanggungan') return 4;
    return 5;
  }
  return [...members].sort((a, b) => {
    const ra = getRelasiOrder(a.relasi);
    const rb = getRelasiOrder(b.relasi);
    if (ra !== rb) return ra - rb;
    // Sesama Anak: tertua → termuda (tanggal lahir lebih kecil = lebih tua)
    if (ra === 3) {
      const da = parseTanggal(a.tanggal_lahir);
      const db = parseTanggal(b.tanggal_lahir);
      if (da && db && !isNaN(da) && !isNaN(db)) return da.getTime() - db.getTime();
    }
    return 0;
  });
}

function parseTanggal(tglLahir) {
  if (!tglLahir) return null;
  const str = String(tglLahir).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) { const [y,m,d]=str.split('-').map(Number); return new Date(y,m-1,d); }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) { const [d,m,y]=str.split('-').map(Number); return new Date(y,m-1,d); }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) { const [d,m,y]=str.split('/').map(Number); return new Date(y,m-1,d); }
  if (/^\d{1,2}\s+\d{1,2}\s+\d{4}$/.test(str)) { const p=str.split(/\s+/).map(Number); return new Date(p[2],p[1]-1,p[0]); }
  const bulanIndo={januari:0,februari:1,maret:2,april:3,mei:4,juni:5,juli:6,agustus:7,september:8,oktober:9,november:10,desember:11};
  const m2=str.toLowerCase().match(/^(\d{1,2})[\s\-\/]+([a-z]+)[\s\-\/]+(\d{4})$/);
  if (m2) { const d=parseInt(m2[1]); const mo=bulanIndo[m2[2]]; const y=parseInt(m2[3]); if (mo!==undefined) return new Date(y,mo,d); }
  const fb=new Date(str); return isNaN(fb)?null:fb;
}

function formatTanggal(tgl) {
  if (!tgl) return '-';
  const d = parseTanggal(tgl);
  if (!d||isNaN(d)) return tgl;
  return `${String(d.getDate()).padStart(2,'0')} ${namaBulan[d.getMonth()]} ${d.getFullYear()}`;
}

function toInputDate(tgl) {
  if (!tgl) return '';
  const d = parseTanggal(tgl);
  if (!d||isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function hitungUmur(tgl) {
  if (!tgl) return '-';
  const lahir = parseTanggal(tgl);
  if (!lahir||isNaN(lahir)) return '⚠️ format tgl?';
  const today = new Date();
  let th=today.getFullYear()-lahir.getFullYear(), bl=today.getMonth()-lahir.getMonth(), hr=today.getDate()-lahir.getDate();
  if (hr<0) { bl--; hr+=new Date(today.getFullYear(),today.getMonth(),0).getDate(); }
  if (bl<0) { th--; bl+=12; }
  return `${th} th ${bl} bln ${hr} hr`;
}

function formatRp(n) { return 'Rp '+Number(n||0).toLocaleString('id-ID'); }

const CHURCH_PHOTO_URL = 'https://vgjhlvzjwnhsgpozznrp.supabase.co/storage/v1/object/public/foto/gedung%20gereja%20gmim%20smirna.jpg';

// ===== NAVIGATION =====
function showPublicPage() {
  document.getElementById('publicPage').style.display = 'block';
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'none';
  loadPublicData();
}

function showLoginPage() {
  document.getElementById('publicPage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
  if (CHURCH_PHOTO_URL) {
    document.getElementById('bgChurchImg').src = CHURCH_PHOTO_URL;
    document.getElementById('cardChurchImg').src = CHURCH_PHOTO_URL;
  }
}

function switchPubTab(tabId) {
  document.querySelectorAll('.pub-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.pub-tab-content').forEach(c => c.style.display = c.id === tabId ? 'block' : 'none');
  if (tabId === 'pub-bpmj') loadPubStruktur('bpmj');
  if (tabId === 'pub-pelayan') loadPubStruktur('pelayan');
  if (tabId === 'pub-komisi') loadPubStruktur('komisi');
  if (tabId === 'pub-aspirasi') loadPubAspirasi();
  if (tabId === 'pub-pengumuman') loadPubPengumuman();
  if (tabId === 'pub-berita') loadPubBerita();
}

// ===== PUBLIC DATA =====

// Helper: fetch publik via supabase client
async function sbFetch(table, params='') {
  try {
    let q = sb.from(table).select('*');
    // Parse params sederhana
    if (params.includes('aktif=eq.true')) q = q.eq('aktif', true);
    if (params.includes('order=created_at.desc')) q = q.order('created_at', {ascending:false});
    if (params.includes('order=urutan.asc')) q = q.order('urutan', {ascending:true});
    if (params.includes('order=tanggal.desc')) q = q.order('tanggal', {ascending:false});
    if (params.includes('limit=10')) q = q.limit(10);
    if (params.includes('limit=20')) q = q.limit(20);
    if (params.includes('limit=3')) q = q.limit(3);
    const res = await q;
    return res.data || [];
  } catch(e) { console.error('sbFetch error:', e.message); return []; }
}
async function loadPublicData() {
  // Load semua konten secara paralel
  loadPubPengumumanRingkasan();
  loadPubBerita();
  loadSidebarKehadiran();
  loadVisitorCounter();
  // Load jemaat untuk ulang tahun + info sidebar
  try {
    const { data } = await sb.from('jemaat')
      .select('nama_lengkap,tanggal_lahir,tanggal_nikah,kolom,lp,lansia,bipra,nama_keluarga,relasi')
      .order('kolom');
    if (data && data.length) {
      allJemaat = data;
      renderPubUltah(data);
      loadSidebarData();
    } else {
      const elH = document.getElementById('sideUltahHari');
      const elI = document.getElementById('sideInfoJemaat');
      if (elH) elH.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Tidak ada</div>';
      if (elI) elI.innerHTML = '<div style="color:var(--text-muted);font-size:13px">-</div>';
    }
  } catch(e) {
    const elH = document.getElementById('sideUltahHari');
    const elI = document.getElementById('sideInfoJemaat');
    if (elH) elH.innerHTML = '<div style="color:var(--text-muted);font-size:13px">-</div>';
    if (elI) elI.innerHTML = '<div style="color:var(--text-muted);font-size:13px">-</div>';
  }
}

function renderPubUltah(data) {
  const today = new Date();
  const todayM = today.getMonth(), todayD = today.getDate();
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

  const hariIni=[], mingguIni=[], bulanIni=[];
  data.forEach(j => {
    if (!j.tanggal_lahir) return;
    const d = parseTanggal(j.tanggal_lahir); if (!d||isNaN(d)) return;
    const bm=d.getMonth(), bd=d.getDate();
    const thisYear = new Date(today.getFullYear(), bm, bd);
    const diff = Math.ceil((thisYear - today)/(1000*60*60*24));
    if (bm===todayM && bd===todayD) hariIni.push({...j,diff:0});
    else if (bm===todayM || (diff > 0 && diff <= 7)) mingguIni.push({...j,diff});
    if (bm===todayM) bulanIni.push({...j,diff,bd});
  });
  bulanIni.sort((a,b)=>a.bd-b.bd);
  mingguIni.sort((a,b)=>a.diff-b.diff);

  const mkCard = (j,isToday) => `
    <div class="ultah-card ${isToday?'today':''}">
      <div class="uc-name">${isToday?'🎉 ':''}${j.nama_lengkap||'-'}</div>
      <div class="uc-info">Kolom ${j.kolom||'-'} &nbsp;·&nbsp; ${j.lp==='L'?'👦':'👧'} ${j.lp||'-'}</div>
      <div class="uc-hari">${isToday?'🎂 Hari ini berulang tahun!' : j.diff>0?`${j.diff} hari lagi`:j.diff===0?'Hari ini!':'Sudah lewat'}</div>
    </div>`;

  const _elUH = document.getElementById('pubUltahHariList');
  const _elUM = document.getElementById('pubUltahMingguList');
  const _elUB = document.getElementById('pubUltahBulanList');
  if (_elUH) _elUH.innerHTML = hariIni.length ? hariIni.map(j=>mkCard(j,true)).join('') : '<div style="color:rgba(255,255,255,0.4);font-size:14px">Tidak ada jemaat yang berulang tahun hari ini</div>';
  if (_elUM) _elUM.innerHTML = mingguIni.length ? mingguIni.map(j=>mkCard(j,false)).join('') : '<div style="color:rgba(255,255,255,0.4);font-size:14px">Tidak ada ulang tahun minggu ini</div>';
  if (_elUB) _elUB.innerHTML = bulanIni.length ? bulanIni.map(j=>mkCard(j,j.diff===0)).join('') : '<div style="color:rgba(255,255,255,0.4);font-size:14px">Tidak ada data</div>';

  // Update dashboard ulang tahun kalau sedang di admin
  renderDashUltah(hariIni, mingguIni, bulanIni);
}

function renderDashUltah(hari, minggu, bulan) {
  const mkRow = (j) => `<span style="display:inline-block;background:var(--accent-light);color:var(--primary);border-radius:20px;padding:2px 12px;font-size:13px;margin:2px;font-weight:600">${j.nama_lengkap} <span style="font-weight:400;color:var(--text-muted)">(Kol.${j.kolom})</span></span>`;
  const mkRowNikah = (n) => `<span style="display:inline-block;background:#fff7ed;color:#c2410c;border-radius:20px;padding:2px 12px;font-size:13px;margin:2px;font-weight:600">💍 ${n.nama_keluarga} <span style="font-weight:400;color:var(--text-muted)">(${n.tahunKe} thn · Kol.${n.kolom})</span></span>`;
  const h = document.getElementById('dashUltahHari');
  const m = document.getElementById('dashUltahMinggu');
  const b = document.getElementById('dashUltahBulan');
  if (h) h.innerHTML = `<strong style="color:var(--primary);font-size:14px">🎉 Hari ini:</strong> ${hari.length?hari.map(mkRow).join(''):'<span style="color:var(--text-muted);font-size:13px">Tidak ada</span>'}`;
  if (m) m.innerHTML = `<strong style="color:var(--primary);font-size:14px">📅 Minggu ini:</strong> ${minggu.length?minggu.map(mkRow).join(''):'<span style="color:var(--text-muted);font-size:13px">Tidak ada</span>'}`;
  if (b) b.innerHTML = `<strong style="color:var(--primary);font-size:14px">🗓️ Bulan ini:</strong> ${bulan.length?bulan.map(mkRow).join(''):'<span style="color:var(--text-muted);font-size:13px">Tidak ada</span>'}`;
  // Wedding anniversary dashboard
  const today = new Date();
  const todayM = today.getMonth(), todayD = today.getDate();
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate()+7);
  const familyNikah = {};
  allJemaat.forEach(j => {
    if (!j.tanggal_nikah || !j.nama_keluarga) return;
    if (familyNikah[j.nama_keluarga]) return;
    const d = parseTanggal(j.tanggal_nikah); if (!d||isNaN(d)) return;
    const bm=d.getMonth(), bd=d.getDate();
    const thisYear = new Date(today.getFullYear(), bm, bd);
    const diff = Math.ceil((thisYear-today)/(1000*60*60*24));
    const tahunKe = today.getFullYear()-d.getFullYear()+(diff<=0?0:-1);
    familyNikah[j.nama_keluarga] = {nama_keluarga:j.nama_keluarga,kolom:j.kolom,bm,bd,diff,tahunKe};
  });
  const nikahList = Object.values(familyNikah);
  const nHari = nikahList.filter(n=>n.bm===todayM&&n.bd===todayD);
  const nMinggu = nikahList.filter(n=>n.diff>0&&n.diff<=7);
  const nBulan = nikahList.filter(n=>n.bm===todayM).sort((a,b)=>a.bd-b.bd);
  const nh=document.getElementById('dashNikahHari'), nm=document.getElementById('dashNikahMinggu'), nb=document.getElementById('dashNikahBulan');
  if (nh) nh.innerHTML=`<strong style="color:#c2410c;font-size:14px">💍 Hari ini:</strong> ${nHari.length?nHari.map(mkRowNikah).join(''):'<span style="color:var(--text-muted);font-size:13px">Tidak ada</span>'}`;
  if (nm) nm.innerHTML=`<strong style="color:#c2410c;font-size:14px">📅 Minggu ini:</strong> ${nMinggu.length?nMinggu.map(mkRowNikah).join(''):'<span style="color:var(--text-muted);font-size:13px">Tidak ada</span>'}`;
  if (nb) nb.innerHTML=`<strong style="color:#c2410c;font-size:14px">🗓️ Bulan ini:</strong> ${nBulan.length?nBulan.map(mkRowNikah).join(''):'<span style="color:var(--text-muted);font-size:13px">Tidak ada</span>'}`;
}

// loadPubPengumuman sudah di-override di bawah

async function loadPubStruktur(jenis) {
  const tabelMap = {bpmj:'struktur_bpmj', pelayan:'pelayan_khusus', komisi:'komisi_kerja'};
  const gridMap = {bpmj:'pubBpmjGrid', pelayan:'pubPelayanGrid', komisi:'pubKomisiGrid'};
  const tabel = tabelMap[jenis], gridId = gridMap[jenis];
  const data = await sbFetch(tabel, 'aktif=eq.true&order=urutan.asc');
  const el = document.getElementById(gridId);
  if (!el) return;
  if (!data||!data.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:14px">Belum ada data</div>'; return; }
  el.innerHTML = data.map(s => {
    const fotoEl = s.foto_url ? `<img class="str-foto" src="${s.foto_url}" alt="${s.nama}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="str-foto-ph" style="display:none">👤</div>` : `<div class="str-foto-ph">👤</div>`;
    const jabatan = jenis==='komisi' ? `Ketua ${s.nama_komisi||''}` : s.jabatan||'';
    const nama = jenis==='komisi' ? s.nama_ketua||'' : s.nama||'';
    return `<div class="str-card">${fotoEl}<div class="str-jabatan">${jabatan}</div><div class="str-nama">${nama}</div></div>`;
  }).join('');
}

async function loadPubAspirasi() {
  const data = await sbFetch('aspirasi', 'order=created_at.desc&limit=20');
  const el = document.getElementById('pubAspirasiList');
  if (!data||!data.length) { el.innerHTML = '<div style="color:var(--text-muted)">Belum ada aspirasi</div>'; return; }
  const katLabel = {komentar:'💬 Komentar',usulan_pelayan:'🙏 Usulan Pelayan',koreksi:'✏️ Koreksi',lainnya:'📌 Lainnya'};
  el.innerHTML = data.map(a => `
    <div class="asp-item-pub">
      <div><span class="asp-pengirim">${a.nama||'-'}</span><span class="asp-kat">· Kolom ${a.kolom||'-'} · ${katLabel[a.kategori]||a.kategori||'-'}</span></div>
      <div class="asp-isi">${a.isi||''}</div>
      ${a.tanggapan ? `<div class="asp-tanggapan">💬 <strong>Tanggapan BPMJ:</strong> ${a.tanggapan}</div>` : ''}
    </div>`).join('');
}

async function submitAspirasi() {
  const nama = document.getElementById('aspNama').value.trim();
  const kolom = document.getElementById('aspKolom').value;
  const isi = document.getElementById('aspIsi').value.trim();
  if (!nama) { showToast('Nama wajib diisi', 'error'); return; }
  if (!kolom) { showToast('Kolom wajib dipilih', 'error'); return; }
  if (!isi) { showToast('Isi pesan wajib diisi', 'error'); return; }
  const { error } = await sb.from('aspirasi').insert({
    nama, kolom:parseInt(kolom), kategori:document.getElementById('aspKategori').value, isi, status:'baru'
  });
  if (error) { showToast('Gagal kirim: '+error.message, 'error'); return; }
  showToast('Aspirasi berhasil dikirim! 🙏', 'success');
  document.getElementById('aspNama').value='';
  document.getElementById('aspKolom').value='';
  document.getElementById('aspIsi').value='';
  loadPubAspirasi();
}

// ===== AUTH =====
async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errEl = document.getElementById('loginError'); errEl.style.display='none';
  if (!username||!password) { showLoginError('Username dan password wajib diisi'); return; }
  const {data,error} = await sb.from('akun_kolom').select('*').eq('username',username).eq('password',password).single();
  if (error||!data) { showLoginError('Username atau password salah'); return; }
  currentUser = data;
  document.getElementById('sidebarName').textContent = data.kolom===0?'Administrator BPMJ':data.kolom===-1?'Pegawai Gereja':`Kolom ${data.kolom}`;
  document.getElementById('sidebarRole').textContent = data.penatua||(data.kolom===0?'Admin Sistem':data.kolom===-1?'Admin Sistem':'Pengguna Kolom');
  if (isAdmin()) {
    document.getElementById('navPenatua').style.display='flex';
    document.getElementById('navAkun').style.display='flex';
    document.getElementById('navLog').style.display='flex';
  } else {
    document.getElementById('navPenatua').style.display='flex';
  }
  // Tampilkan tombol admin khusus superadmin
  ['kehadiranAdminBar','pengumumanAdminBar','bpmjAdminBar','pelayanAdminBar','komisiAdminBar','wartaAdminBar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isSuperAdmin() ? 'block' : 'none';
  });
  // Tampilkan menu slideshow & video hanya untuk superadmin
  const navSlide = document.getElementById('navSlideshow');
  if (navSlide) navSlide.style.display = isSuperAdmin() ? 'flex' : 'none';
  const navVid = document.getElementById('navVideo');
  if (navVid) navVid.style.display = isSuperAdmin() ? 'flex' : 'none';

  const btnSosmed = document.getElementById('btnSosmedAdmin');
  if (btnSosmed) btnSosmed.style.display = isSuperAdmin() ? 'block' : 'none';
  const btnEmail = document.getElementById('btnEmailAdmin');
  if (btnEmail) btnEmail.style.display = isSuperAdmin() ? 'block' : 'none';

  document.getElementById('publicPage').style.display='none';
  document.getElementById('loginPage').style.display='none';
  document.getElementById('mainApp').style.display='block';
  loadDashboard();
  loadJemaat();
  startDashAutoRefresh();
  startRealtimeSync();
}

function showLoginError(msg) { const el=document.getElementById('loginError'); el.textContent=msg; el.style.display='block'; }

function doLogout() {
  currentUser=null;
  stopDashAutoRefresh();
  stopRealtimeSync();
  showPublicPage();
  document.getElementById('loginUsername').value='';
  document.getElementById('loginPassword').value='';
}

document.addEventListener('keypress', e => {
  if (e.key==='Enter' && document.getElementById('loginPage').style.display==='flex') doLogin();
});

// ===== NAVIGATION ADMIN =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item,.nav-sub-item').forEach(n=>n.classList.remove('active'));
  const pg = document.getElementById('page-'+name);
  if (pg) pg.classList.add('active');
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  document.querySelectorAll('.nav-group').forEach(g=>g.classList.remove('open'));
  if (name==='keluarga') loadKeluarga();
  if (name==='penatua') loadPenatua();
  if (name==='akun') loadAkun();
  if (name==='peta') setTimeout(loadPeta,200);
  if (name==='ultah') loadUltah();
  if (name==='lansia') loadLansia();
  if (name==='log') loadLog();
  if (name==='kehadiran') loadKehadiran();
  if (name==='pengumuman') loadPengumumanAdmin();
  if (name==='aspirasi-admin') loadAspirasiAdmin();
  if (name==='struktur-bpmj') loadStrukturAdmin('bpmj');
  if (name==='pelayan-khusus') loadStrukturAdmin('pelayan');
  if (name==='komisi-kerja') loadStrukturAdmin('komisi');
  if (name==='berita') loadBeritaAdmin();
  if (name==='warta') loadWartaAdmin();
  if (name==='slideshow') loadSlideshowAdmin();
  if (name==='video-admin') loadVideoAdmin();
  if (window.innerWidth<768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarBackdrop').classList.remove('open'); }
}

function toggleNavGroup(id) {
  const g=document.getElementById(id); const isOpen=g.classList.contains('open');
  document.querySelectorAll('.nav-group').forEach(x=>x.classList.remove('open'));
  if (!isOpen) g.classList.add('open');
}

function toggleSidebar() {
  const s=document.getElementById('sidebar'); const b=document.getElementById('sidebarBackdrop');
  const isOpen=s.classList.contains('open');
  s.classList.toggle('open',!isOpen); b.classList.toggle('open',!isOpen);
}

let currentSubPage='per-kolom',subCurrentPage=1,subPerPage=25;

function showSubJemaat(sub) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item,.nav-sub-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+sub).classList.add('active');
  const subMap={'per-kolom':'subPerKolom','sidi':'subSidi','belum-sidi':'subBelumSidi','per-keluarga':'subPerKeluarga'};
  document.getElementById(subMap[sub]).classList.add('active');
  document.getElementById('navGroupJemaat').classList.add('open');
  currentSubPage=sub; subCurrentPage=1;
  if (sub==='per-keluarga') { renderSubKeluarga(); }
  else { populateKolomDropdowns(); renderSubJemaat(); }
  if (window.innerWidth<768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarBackdrop').classList.remove('open'); }
}

function populateKolomDropdowns() {
  const koloms=[...new Set(allJemaat.map(j=>j.kolom).filter(k=>k))].sort((a,b)=>a-b);
  ['filterKolomSub','filterKolomSidi','filterKolomBelumSidi'].forEach(id=>{
    const el=document.getElementById(id); if (!el) return;
    const cur=el.value;
    el.innerHTML='<option value="">Semua Kolom</option>'+koloms.map(k=>`<option value="${k}"${k==cur?' selected':''}>Kolom ${k}</option>`).join('');
  });
}

function renderSubJemaat() {
  const sub=currentSubPage;
  const cfgMap={
    'per-kolom':{search:'searchPerKolom',kolom:'filterKolomSub',lp:'filterLPSub',body:'subJemaatBody',pag:'subPagination',showSidi:true,subtitle:'subtitlePerKolom'},
    'sidi':{search:'searchSidi',kolom:'filterKolomSidi',lp:'filterLPSidi',body:'sidiBody',pag:'sidiPagination',showSidi:false,subtitle:'subtitleSidi'},
    'belum-sidi':{search:'searchBelumSidi',kolom:'filterKolomBelumSidi',lp:'filterLPBelumSidi',body:'belumSidiBody',pag:'belumSidiPagination',showSidi:false,subtitle:'subtitleBelumSidi'},
  };
  const cfg=cfgMap[sub]; if (!cfg) return;
  const q=(document.getElementById(cfg.search)?.value||'').toLowerCase();
  const kolom=document.getElementById(cfg.kolom)?.value||'';
  const lp=document.getElementById(cfg.lp)?.value||'';
  let data=allJemaat.filter(j=>{
    if (sub==='sidi') return j.sidi==='sudah-sidi';
    if (sub==='belum-sidi') return j.sidi!=='sudah-sidi';
    return true;
  }).filter(j=>(!q||(j.nama_lengkap||'').toLowerCase().includes(q))&&(!kolom||String(j.kolom)===String(kolom))&&(!lp||j.lp===lp))
    .sort((a,b)=>(a.kolom||0)-(b.kolom||0)||(a.nama_lengkap||'').localeCompare(b.nama_lengkap||''));
  document.getElementById(cfg.subtitle).textContent=`${data.length} data ditemukan`;
  const pages=Math.ceil(data.length/subPerPage); if (subCurrentPage>pages) subCurrentPage=1;
  const start=(subCurrentPage-1)*subPerPage;
  const tbody=document.getElementById(cfg.body);
  if (!data.slice(start,start+subPerPage).length) { tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>'; document.getElementById(cfg.pag).innerHTML=''; return; }
  tbody.innerHTML=data.slice(start,start+subPerPage).map((j,i)=>`<tr>
    <td>${start+i+1}</td>
    <td><span class="badge badge-l" style="background:#e8f4f0;color:#2d6a4f">Kol ${j.kolom||'-'}</span></td>
    <td><strong>${j.nama_lengkap||'-'}</strong></td>
    <td><span class="badge ${j.lp==='L'?'badge-l':'badge-p'}">${j.lp||'-'}</span></td>
    <td>${formatTanggal(j.tanggal_lahir)}</td>
    <td>${hitungUmur(j.tanggal_lahir)}</td>
    <td>${j.pekerjaan||'-'}</td>
    <td><span class="badge ${j.baptis==='sudah-baptis'?'badge-baptis':'badge-belum'}">${j.baptis==='sudah-baptis'?'✓':'✗'}</span></td>
    ${cfg.showSidi?`<td><span class="badge ${j.sidi==='sudah-sidi'?'badge-baptis':'badge-belum'}">${j.sidi==='sudah-sidi'?'✓':'✗'}</span></td>`:''}
    <td>${j.relasi||'-'}</td>
    <td style="white-space:nowrap">${(isAdmin()||currentUser.kolom===j.kolom)?`<button class="btn btn-outline btn-sm" onclick="editJemaat(${j.id})">✏️</button> <button class="btn btn-danger btn-sm" onclick="deleteJemaat(${j.id},'${(j.nama_lengkap||'').replace(/'/g,"\\'")}')">🗑️</button>`:'—'}</td>
  </tr>`).join('');
  const pagEl=document.getElementById(cfg.pag);
  if (pages<=1){pagEl.innerHTML=`<span class="page-info">${data.length} data</span>`;return;}
  let html=`<button class="page-btn" onclick="subChangePage(${subCurrentPage-1})" ${subCurrentPage===1?'disabled':''}>‹</button>`;
  for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-subCurrentPage)<=2)html+=`<button class="page-btn ${i===subCurrentPage?'active':''}" onclick="subChangePage(${i})">${i}</button>`;else if(Math.abs(i-subCurrentPage)===3)html+=`<span style="padding:8px">...</span>`;}
  html+=`<button class="page-btn" onclick="subChangePage(${subCurrentPage+1})" ${subCurrentPage===pages?'disabled':''}>›</button><span class="page-info">${data.length} data</span>`;
  pagEl.innerHTML=html;
}

function subChangePage(p){subCurrentPage=p;renderSubJemaat();}
function changePerPage(v){perPage=parseInt(v);currentPage=1;renderTable();}
function changeSubPerPage(v){subPerPage=parseInt(v);subCurrentPage=1;renderSubJemaat();}

// ===== PER KELUARGA =====
function renderSubKeluarga() {
  const q=(document.getElementById('searchPerKeluarga')?.value||'').toLowerCase();
  const kolom=document.getElementById('filterKolomPerKeluarga')?.value||'';

  // Populate kolom dropdown
  const koloms=[...new Set(allJemaat.map(j=>j.kolom).filter(Boolean))].sort((a,b)=>a-b);
  const kEl=document.getElementById('filterKolomPerKeluarga');
  if (kEl) {
    const cur=kEl.value;
    kEl.innerHTML='<option value="">Semua Kolom</option>'+koloms.map(k=>`<option value="${k}"${String(k)===cur?' selected':''}>Kolom ${k}</option>`).join('');
  }

  // Filter data
  let data=allJemaat.filter(j=>{
    const matchQ=!q||
      (j.nama_lengkap||'').toLowerCase().includes(q)||
      (j.nama_keluarga||'').toLowerCase().includes(q)||
      (j.nik||'').includes(q);
    const matchKol=!kolom||String(j.kolom)===String(kolom);
    return matchQ && matchKol;
  });

  // Group by kolom → nama_keluarga
  const byKolom={};
  data.forEach(j=>{
    const k=j.kolom||0;
    const fam=j.nama_keluarga||'(Tanpa Nama Keluarga)';
    if(!byKolom[k])byKolom[k]={};
    if(!byKolom[k][fam])byKolom[k][fam]=[];
    byKolom[k][fam].push(j);
  });

  const totalKeluarga=[...new Set(data.map(j=>j.nama_keluarga).filter(Boolean))].length;
  const el=document.getElementById('subtitlePerKeluarga');
  if(el) el.textContent=`${totalKeluarga} keluarga — ${data.length} jemaat`;

  const container=document.getElementById('perKeluargaList');
  if(!container) return;
  if(!Object.keys(byKolom).length){
    container.innerHTML='<p style="text-align:center;padding:40px;color:var(--text-muted)">Tidak ada data ditemukan</p>';
    return;
  }

  container.innerHTML=Object.keys(byKolom).sort((a,b)=>Number(a)-Number(b)).map(kolom=>{
    const famKeys=Object.keys(byKolom[kolom]).sort();
    return `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--primary);color:white;padding:10px 16px;border-radius:10px 10px 0 0;font-weight:700;font-size:14px">
        <span>⛪ Kolom ${kolom}</span>
        <span style="font-size:12px;opacity:0.8;font-weight:400">${famKeys.length} keluarga</span>
      </div>
      <div style="border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f1f5f9;color:var(--text-muted);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px">
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);min-width:130px">Keluarga</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Nama Lengkap</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">L/P</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Tgl Lahir</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Umur</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Pekerjaan</th>
              <th style="padding:8px 12px;text-align:center;border-bottom:1px solid var(--border)">Baptis</th>
              <th style="padding:8px 12px;text-align:center;border-bottom:1px solid var(--border)">Sidi</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Relasi</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${famKeys.map(fam=>{
              const members=sortAnggotaKeluarga(byKolom[kolom][fam]);
              const rep=members[0]||{};
              const _noKK=(rep.no_kk||'').replace(/'/g,"\\'");
              const _alamat=(members.find(m=>m.alamat_rumah)||{}).alamat_rumah||'';
              const _alamatE=_alamat.replace(/'/g,"\\'");
              const _jemaat=(members.find(m=>m.jemaat_asal)||{}).jemaat_asal||'';
              const _jemaatE=_jemaat.replace(/'/g,"\\'");
              const _alamatKol=(members.find(m=>m.alamat_kolom)||{}).alamat_kolom||'';
              const _alamatKolE=_alamatKol.replace(/'/g,"\\'");
              const _kolomFam=rep.kolom||'';
              const _famEsc=(fam||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
              const canEdit=isAdmin()||currentUser.kolom===rep.kolom;
              return members.map((j,idx)=>{
                const isFirst=idx===0;
                const rowspan=members.length;
                const famCell=isFirst?`<td style="padding:10px 12px;font-weight:700;color:var(--primary);background:rgba(26,58,92,0.04);border-right:3px solid var(--accent);white-space:nowrap;vertical-align:top" rowspan="${rowspan}">
                  🏠 ${fam}
                  <br><small style="font-weight:400;color:var(--text-muted);font-size:11px">${rowspan} anggota</small>
                  ${canEdit?`<br><button class="btn btn-primary btn-sm" style="margin-top:7px;padding:3px 9px;font-size:11px" onclick="tambahAnggotaDariPerKeluarga('${_famEsc}',${_kolomFam},'${_noKK}','${_alamatE}','${_jemaatE}','${_alamatKolE}')">👤 + Anggota</button>`:''}
                </td>`:'';
                const borderTop=isFirst?'border-top:2px solid var(--accent-light)':'';
                return `<tr style="${borderTop}">
                  ${famCell}
                  <td style="padding:8px 12px;border-bottom:1px solid var(--border);font-weight:${isFirst?'700':'400'}">${j.nama_lengkap||'-'}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid var(--border)"><span class="badge ${j.lp==='L'?'badge-l':'badge-p'}">${j.lp||'-'}</span></td>
                  <td style="padding:8px 12px;border-bottom:1px solid var(--border);white-space:nowrap">${formatTanggal(j.tanggal_lahir)}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid var(--border);white-space:nowrap;font-size:12px;color:var(--text-muted)">${hitungUmur(j.tanggal_lahir)}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid var(--border)">${j.pekerjaan||'-'}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:center"><span class="badge ${j.baptis==='sudah-baptis'?'badge-baptis':'badge-belum'}">${j.baptis==='sudah-baptis'?'✓':'✗'}</span></td>
                  <td style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:center"><span class="badge ${j.sidi==='sudah-sidi'?'badge-baptis':'badge-belum'}">${j.sidi==='sudah-sidi'?'✓':'✗'}</span></td>
                  <td style="padding:8px 12px;border-bottom:1px solid var(--border)">
                    <span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;${j.relasi==='Suami'?'background:#dbeafe;color:#1e40af':j.relasi==='Istri'?'background:#fce7f3;color:#9d174d':j.relasi==='Anak'?'background:#fef9c3;color:#854d0e':'background:#e5e7eb;color:#374151'}">${j.relasi||'-'}</span>
                  </td>
                  <td style="padding:8px 12px;border-bottom:1px solid var(--border);white-space:nowrap">
                    ${canEdit?`<button class="btn btn-outline btn-sm" onclick="editJemaat(${j.id})">✏️</button> <button class="btn btn-danger btn-sm" onclick="deleteJemaat(${j.id},'${(j.nama_lengkap||'').replace(/'/g,"\\'")}')">🗑️</button>`:'—'}
                  </td>
                </tr>`;
              }).join('');
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

function tambahAnggotaDariPerKeluarga(namaKeluarga, kolom, noKK, alamatRumah, jemaatAsal, alamatKolom) {
  openModal(null, 'tambah-anggota');
  // Isi otomatis data keluarga ke form modal
  setTimeout(() => {
    const fKel = document.getElementById('fKeluarga');
    if (fKel) { fKel.value = namaKeluarga; fKel.readOnly = true; fKel.style.background='#f1f5f9'; fKel.style.fontWeight='700'; }
    const fKol = document.getElementById('fKolom'); if (fKol) fKol.value = kolom;
    const fKK  = document.getElementById('fNoKK');  if (fKK)  fKK.value  = noKK;
    const fAl  = document.getElementById('fAlamatRumah'); if (fAl)  fAl.value  = alamatRumah;
    const fJm  = document.getElementById('fJemaat'); if (fJm)  fJm.value  = jemaatAsal;
    const fAK  = document.getElementById('fAlamatKolom'); if (fAK)  fAK.value  = alamatKolom;
    document.getElementById('modalTitle').textContent = '👤 Tambah Anggota — ' + namaKeluarga;
  }, 50);
}

function exportExcelPerKeluarga() {
  const relasiOrder={'Suami':1,'Istri':2,'Anak':3,'Lainnya':4};
  const kolom=document.getElementById('filterKolomPerKeluarga')?.value||'';
  const q=(document.getElementById('searchPerKeluarga')?.value||'').toLowerCase();
  let data=[...allJemaat].filter(j=>{
    const matchQ=!q||(j.nama_lengkap||'').toLowerCase().includes(q)||(j.nama_keluarga||'').toLowerCase().includes(q);
    const matchKol=!kolom||String(j.kolom)===String(kolom);
    return matchQ&&matchKol;
  }).sort((a,b)=>(a.kolom||0)-(b.kolom||0)||(a.nama_keluarga||'').localeCompare(b.nama_keluarga||''));
  if(!data.length){alert('Tidak ada data');return;}
  const rows=data.map((j,i)=>({'No':i+1,'Kolom':j.kolom||'','Nama Keluarga':j.nama_keluarga||'','Nama Lengkap':j.nama_lengkap||'','Relasi':j.relasi||'','L/P':j.lp||'','Tgl Lahir':formatTanggal(j.tanggal_lahir),'Umur':hitungUmur(j.tanggal_lahir),'Pekerjaan':j.pekerjaan||'','Baptis':j.baptis==='sudah-baptis'?'Sudah':'Belum','Sidi':j.sidi==='sudah-sidi'?'Sudah':'Belum','Alamat':j.alamat_rumah||''}));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=Object.keys(rows[0]).map(k=>({wch:Math.max(k.length,...rows.map(r=>String(r[k]||'').length))+2}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Per Keluarga');
  XLSX.writeFile(wb,`Jemaat_Per_Keluarga_${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.xlsx`);
}

// ===== SUPABASE REALTIME — auto-refresh tanpa keluar/masuk =====
let _realtimeChannel = null;

function startRealtimeSync() {
  stopRealtimeSync();
  _realtimeChannel = sb.channel('jemaat-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jemaat' }, payload => {
      console.log('🔄 Realtime update:', payload.eventType);
      _applyRealtimeChange(payload);
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') console.log('✅ Realtime aktif');
    });
}

function stopRealtimeSync() {
  if (_realtimeChannel) {
    sb.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
  }
}

function _applyRealtimeChange(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;

  if (eventType === 'INSERT' && newRow) {
    // Tambah ke allJemaat jika belum ada
    if (!allJemaat.find(j => j.id === newRow.id)) {
      allJemaat.push(newRow);
    }
  } else if (eventType === 'UPDATE' && newRow) {
    const idx = allJemaat.findIndex(j => j.id === newRow.id);
    if (idx !== -1) allJemaat[idx] = newRow;
    else allJemaat.push(newRow);
  } else if (eventType === 'DELETE' && oldRow) {
    allJemaat = allJemaat.filter(j => j.id !== oldRow.id);
  }

  // Filter non-admin: hanya tampilkan kolom sendiri
  if (!isAdmin()) {
    allJemaat = allJemaat.filter(j => j.kolom === currentUser.kolom);
  }

  filteredJemaat = [...allJemaat];

  // Refresh tampilan halaman yang sedang aktif
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const pageId = activePage.id;

  if (pageId === 'page-jemaat') { filterJemaat(); }
  else if (pageId === 'page-per-kolom') { populateKolomDropdowns(); renderSubJemaat(); }
  else if (pageId === 'page-sidi') { currentSubPage='sidi'; populateKolomDropdowns(); renderSubJemaat(); }
  else if (pageId === 'page-belum-sidi') { currentSubPage='belum-sidi'; populateKolomDropdowns(); renderSubJemaat(); }
  else if (pageId === 'page-per-keluarga') { renderSubKeluarga(); }
  else if (pageId === 'page-keluarga') { allKeluargaData = [...allJemaat]; renderKeluarga(allKeluargaData); }
  else if (pageId === 'page-dashboard') { loadDashboard(); }
  else if (pageId === 'page-ultah') { loadUltah(); }
  else if (pageId === 'page-lansia') { loadLansia(); }

  // Selalu update data ultah publik
  renderPubUltah(allJemaat);

  // Toast indikator realtime (hanya untuk perubahan dari user lain)
  const oleh = newRow?.diinput_oleh || '-';
  if (oleh && oleh !== (currentUser?.username || '-')) {
    const aksiLabel = eventType==='INSERT'?'ditambahkan':eventType==='UPDATE'?'diperbarui':'dihapus';
    const nama = newRow?.nama_lengkap || oldRow?.nama_lengkap || 'data';
    showToast(`🔄 ${nama} ${aksiLabel} oleh ${oleh}`, 'success');
  }
}

// ===== JEMAAT =====
async function loadJemaat() {
  let allData = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    let q = sb.from('jemaat').select('*').order('kolom').order('id').range(from, from + batchSize - 1);
    if (!isAdmin()) q = q.eq('kolom', currentUser.kolom);
    const { data, error } = await q;
    if (error) { showToast('Gagal memuat data', 'error'); return; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  allJemaat = allData; filteredJemaat = [...allJemaat];
  document.getElementById('jemaatSubtitle').textContent=!isAdmin()?`Kolom ${currentUser.kolom} — ${allJemaat.length} jemaat`:`Semua kolom — ${allJemaat.length} jemaat`;
  renderTable();
  renderPubUltah(allJemaat);
}

function searchJemaat(){filterJemaat();}

function renderTable() {
  const start=(currentPage-1)*perPage;
  const tbody=document.getElementById('jemaatBody');
  if (!filteredJemaat.slice(start,start+perPage).length){tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>';document.getElementById('pagination').innerHTML='';return;}
  tbody.innerHTML=filteredJemaat.slice(start,start+perPage).map((j,i)=>`
    <tr>
      <td>${start+i+1}</td>
      <td><strong>${j.nama_lengkap||'-'}</strong>${j.kolom?`<br><small style="color:var(--text-muted)">Kolom ${j.kolom}</small>`:''}</td>
      <td><span class="badge ${j.lp==='L'?'badge-l':'badge-p'}">${j.lp||'-'}</span></td>
      <td>${formatTanggal(j.tanggal_lahir)}</td>
      <td>${hitungUmur(j.tanggal_lahir)}</td>
      <td>${j.pekerjaan||'-'}</td>
      <td><span class="badge ${j.baptis==='sudah-baptis'?'badge-baptis':'badge-belum'}">${j.baptis==='sudah-baptis'?'✓':'✗'}</span></td>
      <td><span class="badge ${j.sidi==='sudah-sidi'?'badge-baptis':'badge-belum'}">${j.sidi==='sudah-sidi'?'✓':'✗'}</span></td>
      <td>${j.relasi||'-'}</td>
      <td>${(isAdmin()||currentUser.kolom===j.kolom)?`<button class="btn btn-outline btn-sm" onclick="editJemaat(${j.id})">✏️</button> <button class="btn btn-danger btn-sm" onclick="deleteJemaat(${j.id},'${(j.nama_lengkap||'').replace(/'/g,"\\'")}')">🗑️</button>`:'—'}</td>
    </tr>`).join('');
  renderPagination();
}

function renderPagination() {
  const total=filteredJemaat.length,pages=Math.ceil(total/perPage),el=document.getElementById('pagination');
  if (pages<=1){el.innerHTML=`<span class="page-info">${total} data</span>`;return;}
  let html=`<button class="page-btn" onclick="changePage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
  for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-currentPage)<=2)html+=`<button class="page-btn ${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;else if(Math.abs(i-currentPage)===3)html+=`<span style="padding:8px">...</span>`;}
  html+=`<button class="page-btn" onclick="changePage(${currentPage+1})" ${currentPage===pages?'disabled':''}>›</button><span class="page-info">${total} data</span>`;
  el.innerHTML=html;
}

function changePage(p){const pages=Math.ceil(filteredJemaat.length/perPage);if(p<1||p>pages)return;currentPage=p;renderTable();}

function filterJemaat() {
  const q=document.getElementById('searchInput').value.toLowerCase();
  const lp=document.getElementById('filterLP').value,baptis=document.getElementById('filterBaptis').value,status=document.getElementById('filterStatus').value;
  filteredJemaat=allJemaat.filter(j=>(!q||(j.nama_lengkap||'').toLowerCase().includes(q)||(j.nik||'').includes(q)||(j.nama_keluarga||'').toLowerCase().includes(q))&&(!lp||j.lp===lp)&&(!baptis||j.baptis===baptis)&&(!status||(status==='baru'?j.status_jemaat==='baru':j.status_jemaat!=='baru')));
  currentPage=1; renderTable();
}

function openModal(data=null, mode=null) {
  document.getElementById('editId').value=data?data.id:'';
  const _titles={edit:'Edit Data Jemaat','keluarga-baru':'🏠 Tambah Keluarga Baru','tambah-anggota':'👤 Tambah Anggota Baru'}; document.getElementById('modalTitle').textContent=data?_titles.edit:(_titles[mode]||'Tambah Jemaat Baru');
  ['fKolom','fNo','fNama','fNik','fLp','fTempat','fTgl','fPekerjaan','fBaptis','fSidi','fKeluarga','fNoKK','fRelasi','fBipra','fLansia','fAlamatRumah','fJemaat','fAlamatKolom','fTglNikah'].forEach(id=>{
    const el=document.getElementById(id); if (!el) return;
    if (id==='fKolom') el.value=data?data.kolom:(currentUser.kolom||'');
    else if (id==='fTgl') el.value=data?toInputDate(data.tanggal_lahir):'';
    else if (id==='fTglNikah') el.value=data?toInputDate(data.tanggal_nikah):'';
    else el.value=data?(data[{fNo:'no',fNama:'nama_lengkap',fNik:'nik',fLp:'lp',fTempat:'tempat_lahir',fPekerjaan:'pekerjaan',fBaptis:'baptis',fSidi:'sidi',fKeluarga:'nama_keluarga',fNoKK:'no_kk',fRelasi:'relasi',fBipra:'bipra',fLansia:'lansia',fAlamatRumah:'alamat_rumah',fJemaat:'jemaat_asal',fAlamatKolom:'alamat_kolom'}[id]]||''):'';
  });
  // Toggle field tanggal nikah
  const relasi = data?data.relasi||'':'';
  const fieldNikah = document.getElementById('fieldTglNikah');
  if (fieldNikah) fieldNikah.style.display=(relasi==='Suami'||relasi==='Istri')?'block':'none';
  const statusEl=document.getElementById('fStatusJemaat');
  statusEl.disabled=currentUser.kolom!==0;
  statusEl.value=data?data.status_jemaat||'lama':'baru';
  document.getElementById('statusJemaatInfo').textContent=currentUser.kolom===0?'Anda dapat mengubah status ini.':'Status ditentukan otomatis.';
  const _fKel=document.getElementById('fKeluarga'); if(mode==='tambah-anggota'){_fKel.readOnly=true;_fKel.style.background='#f1f5f9';_fKel.style.fontWeight='700';}else{_fKel.readOnly=false;_fKel.style.background='';_fKel.style.fontWeight='';} document.getElementById('modalJemaat').classList.add('open');
}

function closeModal(){document.getElementById('modalJemaat').classList.remove('open');}

async function editJemaat(id){const j=allJemaat.find(x=>x.id===id);if(j)openModal(j);}

async function saveJemaat() {
  const id=document.getElementById('editId').value;
  const tgl=document.getElementById('fTgl').value;
  const namaKeluarga=document.getElementById('fKeluarga').value.trim();
  let statusJemaat=document.getElementById('fStatusJemaat').value;
  if (!id) {
    if (namaKeluarga) {
      const {data:ex}=await sb.from('jemaat').select('id').eq('nama_keluarga',namaKeluarga).limit(1);
      statusJemaat=ex&&ex.length?'lama':'baru';
    } else statusJemaat='baru';
    if (currentUser.kolom===0) statusJemaat=document.getElementById('fStatusJemaat').value;
  } else {
    if (currentUser.kolom!==0){const ex=allJemaat.find(x=>x.id===parseInt(id));statusJemaat=ex?ex.status_jemaat||'lama':'lama';}
  }
  const tglNikah=document.getElementById('fTglNikah')?.value||null;
  const payload={kolom:parseInt(document.getElementById('fKolom').value)||null,no:document.getElementById('fNo').value,nama_lengkap:document.getElementById('fNama').value,nik:document.getElementById('fNik').value,lp:document.getElementById('fLp').value,tempat_lahir:document.getElementById('fTempat').value,tanggal_lahir:tgl,umur:tgl?hitungUmur(tgl):'',pekerjaan:document.getElementById('fPekerjaan').value,baptis:document.getElementById('fBaptis').value,sidi:document.getElementById('fSidi').value,nama_keluarga:namaKeluarga,no_kk:document.getElementById('fNoKK').value,relasi:document.getElementById('fRelasi').value,tanggal_nikah:tglNikah||null,bipra:document.getElementById('fBipra').value,lansia:document.getElementById('fLansia').value,alamat_rumah:document.getElementById('fAlamatRumah').value,jemaat_asal:document.getElementById('fJemaat').value,alamat_kolom:document.getElementById('fAlamatKolom').value,status_jemaat:statusJemaat,updated_at:new Date().toISOString()};
  if (!isAdmin()&&payload.kolom!==currentUser.kolom){alert('⛔ Anda hanya dapat mengedit data Kolom '+currentUser.kolom);return;}
  if (!id){payload.diinput_oleh=currentUser?.username||'-';payload.waktu_input=new Date().toISOString();}
  try {
    let result=id?await sbAdmin.from('jemaat').update(payload).eq('id',id).select():await sbAdmin.from('jemaat').insert(payload).select();
    if (result.error){alert('❌ Gagal simpan:\n'+result.error.message);return;}
    showToast(id?'Data berhasil diperbarui ✅':'Jemaat berhasil ditambahkan ✅','success');
    const aksiJemaat = id?'edit':'tambah';
    const detailJemaat = `${aksiJemaat==='edit'?'Edit':'Tambah'}: ${payload.nama_lengkap} (Kolom ${payload.kolom})`;
    closeModal(); await catatLog(aksiJemaat, detailJemaat, id||null);
    await kirimNotifikasiEmail(aksiJemaat, 'Data Jemaat', detailJemaat);
    // Update local cache langsung (tidak perlu tunggu Realtime)
    if (result.data && result.data[0]) {
      const saved = result.data[0];
      if (id) { const idx=allJemaat.findIndex(x=>x.id===saved.id); if(idx!==-1) allJemaat[idx]=saved; else allJemaat.push(saved); }
      else { allJemaat.push(saved); }
      filteredJemaat=[...allJemaat];
    }
    await loadJemaat();
    loadDashboard();
    // Jika halaman Per Keluarga sedang aktif, refresh langsung
    const _actPg = document.querySelector('.page.active');
    if (_actPg && _actPg.id === 'page-per-keluarga') renderSubKeluarga();
  } catch(e){alert('❌ Error: '+e.message);}
}

async function deleteJemaat(id,nama) {
  const jemaat=allJemaat.find(x=>x.id===id);
  if (!isAdmin()&&jemaat&&jemaat.kolom!==currentUser.kolom){alert('⛔ Anda hanya dapat menghapus data Kolom '+currentUser.kolom);return;}
  if (!confirm(`Hapus data "${nama}"?`)) return;
  const {error}=await sbAdmin.from('jemaat').delete().eq('id',id);
  if (error){showToast('Gagal menghapus','error');return;}
  allJemaat=allJemaat.filter(j=>j.id!==id); filteredJemaat=[...allJemaat];
  showToast('Data berhasil dihapus','success'); await catatLog('hapus',`Hapus: ${nama}`,id);
  loadJemaat(); loadDashboard();
  const _actPg2 = document.querySelector('.page.active');
  if (_actPg2 && _actPg2.id === 'page-per-keluarga') renderSubKeluarga();
}

// ===== DASHBOARD =====
async function loadDashboard() {
  let allData = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    let q = sb.from('jemaat').select('*').range(from, from + batchSize - 1);
    if (!isAdmin()) q = q.eq('kolom', currentUser.kolom);
    const { data, error } = await q;
    if (error) { console.error('Dashboard error:', error.message); showToast('Gagal memuat dashboard: ' + error.message, 'error'); return; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  const data = allData;
  if (!data) return;
  const total=data.length;
  const jumlahBaru=data.filter(j=>j.status_jemaat==='baru').length;
  const jumlahLama=data.filter(j=>j.status_jemaat==='lama'||(!j.status_jemaat&&j.id)).length;
  document.getElementById('statTotal').textContent=total;
  document.getElementById('statL').textContent=data.filter(j=>j.lp==='L').length;
  document.getElementById('statP').textContent=data.filter(j=>j.lp==='P').length;
  document.getElementById('statLansia').textContent=data.filter(j=>j.lansia==='lansia').length;
  document.getElementById('statBaptis').textContent=data.filter(j=>j.baptis==='sudah-baptis').length;
  document.getElementById('statSidi').textContent=data.filter(j=>j.sidi==='sudah-sidi').length;
  document.getElementById('statBaru').textContent=jumlahBaru;
  document.getElementById('statLama').textContent=jumlahLama;
  const kategoriList=['bipra','pemuda','remaja','anak','bapak','ibu'];
  const katLabel={bipra:'Bipra',pemuda:'Pemuda',remaja:'Remaja',anak:'Anak',bapak:'Bapak',ibu:'Ibu'};
  const katIcon={bipra:'👩',pemuda:'🧑',remaja:'👦',anak:'👶',bapak:'👨',ibu:'👩‍🦱'};
  document.getElementById('statsKategori').innerHTML=kategoriList.map(k=>`<div class="stat-card"><div class="label">${katIcon[k]} ${katLabel[k]}</div><div class="value" style="font-size:28px">${data.filter(j=>j.bipra===k).length}</div><div class="sub">jemaat</div></div>`).join('');
  if (isAdmin()) {
    const byKolom={};
    data.forEach(j=>{if (!byKolom[j.kolom])byKolom[j.kolom]=0;byKolom[j.kolom]++;});
    document.getElementById('kolom-dash').innerHTML=`<div class="page-header" style="margin-top:16px"><h1 style="font-size:20px">Jemaat Per Kolom</h1></div><div class="stats-grid">${Object.keys(byKolom).sort((a,b)=>a-b).map(k=>`<div class="stat-card"><div class="label">Kolom ${k}</div><div class="value" style="font-size:28px">${byKolom[k]}</div><div class="sub">jemaat</div></div>`).join('')}</div>`;
  }
}

// ===== KEHADIRAN IBADAH =====
function getPundiLainnyaTotal(d) {
  try { return (JSON.parse(d.pundi_lainnya||'[]')).reduce((s,p)=>s+(parseInt(p.nilai)||0),0); }
  catch(e){ return d.pundi_puasa_diakonal||0; }
}
function getPundiLainnyaLabel(d) {
  try {
    const arr = JSON.parse(d.pundi_lainnya||'[]');
    if(!arr.length) return d.pundi_puasa_diakonal ? `Puasa Diak: ${formatRp(d.pundi_puasa_diakonal)}` : '-';
    return arr.map(p=>`${p.label}: ${formatRp(parseInt(p.nilai)||0)}`).join('<br>');
  } catch(e){ return d.pundi_puasa_diakonal ? formatRp(d.pundi_puasa_diakonal) : '-'; }
}

function tambahPundiLainnya(label, nilai) {
  const container = document.getElementById('pundiLainnyaList');
  const row = document.createElement('div');
  row.className = 'pundi-lainnya-row';
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 32px;gap:8px;margin-bottom:8px';
  row.innerHTML = `
    <input type="text" class="pundi-label-input" placeholder="Nama pundi (cth: Puasa Diakonal)" value="${label||''}" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit">
    <input type="number" class="pundi-nilai-input" placeholder="0" min="0" value="${nilai||0}" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit">
    <button type="button" onclick="hapusPundiLainnya(this)" style="background:#fee2e2;border:none;border-radius:6px;color:#991b1b;cursor:pointer;font-size:16px">×</button>`;
  container.appendChild(row);
}
function hapusPundiLainnya(btn) { btn.closest('.pundi-lainnya-row').remove(); }

function getPundiLainnyaFromForm() {
  const rows = document.querySelectorAll('#pundiLainnyaList .pundi-lainnya-row');
  const result = [];
  rows.forEach(row=>{
    const label = row.querySelector('.pundi-label-input').value.trim();
    const nilai = parseInt(row.querySelector('.pundi-nilai-input').value)||0;
    if(label) result.push({label, nilai});
  });
  return result;
}

async function loadKehadiran() {
  const bulan=document.getElementById('filterBulanKehadiran').value;
  const tbody=document.getElementById('kehadiranBody');
  if (!bulan){tbody.innerHTML='<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--text-muted)">Pilih bulan terlebih dahulu</td></tr>';return;}
  const [th,bl]=bulan.split('-');
  const start=`${th}-${bl}-01`, end=`${th}-${bl}-31`;
  const {data}=await sb.from('kehadiran_ibadah').select('*').gte('tanggal',start).lte('tanggal',end).order('tanggal').order('sesi');
  if (!data||!data.length){tbody.innerHTML='<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--text-muted)">Belum ada data kehadiran bulan ini</td></tr>';document.getElementById('kehadiranFoot').innerHTML='';document.getElementById('kehadiranSummary').innerHTML='';return;}
  const sesiIcon={subuh:'🌅',pagi:'☀️',malam:'🌙'};
  tbody.innerHTML=data.map(d=>`<tr>
    <td>${formatTanggal(d.tanggal)}</td>
    <td>${sesiIcon[d.sesi]||''} ${d.sesi}</td>
    <td style="text-align:center">${d.laki_laki||0}</td>
    <td style="text-align:center">${d.perempuan||0}</td>
    <td style="text-align:center;font-weight:700;color:var(--primary)">${(d.laki_laki||0)+(d.perempuan||0)}</td>
    <td>${d.kadim||'-'}</td>
    <td style="text-align:right">${formatRp(d.pundi_persembahan)}</td>
    <td style="text-align:right">${formatRp(d.pundi_diakonia)}</td>
    <td style="text-align:right">${formatRp(d.pundi_pembangunan)}</td>
    <td style="text-align:right">${formatRp(d.pundi_ekstra)}</td>
    <td style="font-size:11px;color:var(--text-muted)">${getPundiLainnyaLabel(d)}</td>
    <td style="white-space:nowrap">${isSuperAdmin()?`<button class="btn btn-outline btn-sm" onclick="editKehadiran(${d.id})">✏️</button> <button class="btn btn-danger btn-sm" onclick="deleteKehadiran(${d.id})">🗑️</button>`:'—'}</td>
  </tr>`).join('');
  const totL=data.reduce((s,d)=>s+(d.laki_laki||0),0);
  const totP=data.reduce((s,d)=>s+(d.perempuan||0),0);
  const totP2=data.reduce((s,d)=>s+(d.pundi_persembahan||0),0);
  const totD=data.reduce((s,d)=>s+(d.pundi_diakonia||0),0);
  const totPb=data.reduce((s,d)=>s+(d.pundi_pembangunan||0),0);
  const totE=data.reduce((s,d)=>s+(d.pundi_ekstra||0),0);
  const totLainnya=data.reduce((s,d)=>s+getPundiLainnyaTotal(d),0);
  document.getElementById('kehadiranFoot').innerHTML=`<tr><td colspan="2" style="padding:11px 14px">TOTAL</td><td style="text-align:center;padding:11px 14px">${totL}</td><td style="text-align:center;padding:11px 14px">${totP}</td><td style="text-align:center;padding:11px 14px;font-weight:700;color:var(--primary)">${totL+totP}</td><td style="padding:11px 14px"></td><td style="text-align:right;padding:11px 14px">${formatRp(totP2)}</td><td style="text-align:right;padding:11px 14px">${formatRp(totD)}</td><td style="text-align:right;padding:11px 14px">${formatRp(totPb)}</td><td style="text-align:right;padding:11px 14px">${formatRp(totE)}</td><td style="text-align:right;padding:11px 14px">${formatRp(totLainnya)}</td><td></td></tr>`;
  document.getElementById('kehadiranSummary').innerHTML=`
    <div class="kh-sum-card"><div class="kh-label">Total Hadir</div><div class="kh-val">${totL+totP}</div><div class="kh-sub">${totL} L + ${totP} P</div></div>
    <div class="kh-sum-card"><div class="kh-label">Persembahan</div><div class="kh-val" style="font-size:18px">${formatRp(totP2)}</div><div class="kh-sub">bulan ini</div></div>
    <div class="kh-sum-card"><div class="kh-label">Diakonia</div><div class="kh-val" style="font-size:18px">${formatRp(totD)}</div><div class="kh-sub">bulan ini</div></div>
    <div class="kh-sum-card"><div class="kh-label">Pembangunan</div><div class="kh-val" style="font-size:18px">${formatRp(totPb)}</div><div class="kh-sub">bulan ini</div></div>
    <div class="kh-sum-card"><div class="kh-label">Total Pundi</div><div class="kh-val" style="font-size:18px">${formatRp(totP2+totD+totPb+totE+totLainnya)}</div><div class="kh-sub">semua pundi</div></div>`;
}

function hitungTotalKehadiran() {
  const l=parseInt(document.getElementById('kLaki').value)||0;
  const p=parseInt(document.getElementById('kPerempuan').value)||0;
  document.getElementById('kTotal').value=l+p;
}

function openModalKehadiran(data=null) {
  document.getElementById('kehadiranEditId').value=data?data.id:'';
  document.getElementById('kehadiranModalTitle').textContent=data?'Edit Kehadiran':'Input Kehadiran Ibadah';
  document.getElementById('kTanggal').value=data?data.tanggal:'';
  document.getElementById('kSesi').value=data?data.sesi:'';
  document.getElementById('kLaki').value=data?data.laki_laki||0:0;
  document.getElementById('kPerempuan').value=data?data.perempuan||0:0;
  document.getElementById('kTotal').value=data?(data.laki_laki||0)+(data.perempuan||0):0;
  document.getElementById('kKadim').value=data?data.kadim||'':'';
  document.getElementById('kPersembahan').value=data?data.pundi_persembahan||0:0;
  document.getElementById('kDiakonia').value=data?data.pundi_diakonia||0:0;
  document.getElementById('kPembangunan').value=data?data.pundi_pembangunan||0:0;
  document.getElementById('kEkstra').value=data?data.pundi_ekstra||0:0;
  document.getElementById('kCatatan').value=data?data.catatan||'':'';
  // Init pundi lainnya
  const container = document.getElementById('pundiLainnyaList');
  container.innerHTML = '<div class="pundi-lainnya-row" style="display:grid;grid-template-columns:1fr 1fr 32px;gap:8px;margin-bottom:8px"><input type="text" class="pundi-label-input" placeholder="Nama pundi (cth: Puasa Diakonal)" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit"><input type="number" class="pundi-nilai-input" placeholder="0" min="0" value="0" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit"><button type="button" onclick="hapusPundiLainnya(this)" style="background:#fee2e2;border:none;border-radius:6px;color:#991b1b;cursor:pointer;font-size:16px">×</button></div>';
  if (data) {
    try {
      const lainnya = JSON.parse(data.pundi_lainnya||'[]');
      if (lainnya.length > 0) {
        container.innerHTML = '';
        lainnya.forEach(p => tambahPundiLainnya(p.label, p.nilai));
      } else if (data.pundi_puasa_diakonal) {
        // Migrasi data lama
        container.innerHTML = '';
        tambahPundiLainnya('Pundi Puasa Diakonal', data.pundi_puasa_diakonal);
      }
    } catch(e) {
      if (data.pundi_puasa_diakonal) {
        container.innerHTML = '';
        tambahPundiLainnya('Pundi Puasa Diakonal', data.pundi_puasa_diakonal);
      }
    }
  }
  document.getElementById('modalKehadiran').classList.add('open');
}

function closeModalKehadiran(){document.getElementById('modalKehadiran').classList.remove('open');}

async function saveKehadiran() {
  const id=document.getElementById('kehadiranEditId').value;
  const tanggal=document.getElementById('kTanggal').value;
  const sesi=document.getElementById('kSesi').value;
  if (!tanggal||!sesi){showToast('Tanggal dan sesi wajib diisi','error');return;}
  const pundiLainnya = getPundiLainnyaFromForm();
  const payload={
    tanggal,sesi,
    laki_laki:parseInt(document.getElementById('kLaki').value)||0,
    perempuan:parseInt(document.getElementById('kPerempuan').value)||0,
    kadim:document.getElementById('kKadim').value||null,
    pundi_persembahan:parseInt(document.getElementById('kPersembahan').value)||0,
    pundi_diakonia:parseInt(document.getElementById('kDiakonia').value)||0,
    pundi_pembangunan:parseInt(document.getElementById('kPembangunan').value)||0,
    pundi_ekstra:parseInt(document.getElementById('kEkstra').value)||0,
    pundi_puasa_diakonal:0,
    pundi_lainnya:JSON.stringify(pundiLainnya),
    catatan:document.getElementById('kCatatan').value,
    diinput_oleh:currentUser?.username||'-'
  };
  const result=id?await sbAdmin.from('kehadiran_ibadah').update(payload).eq('id',id):await sbAdmin.from('kehadiran_ibadah').insert(payload);
  if (result.error){showToast('Gagal simpan: '+result.error.message,'error');return;}
  const aksi = id ? 'edit' : 'tambah';
  const lainnyaStr = pundiLainnya.map(p=>`${p.label}: ${formatRp(p.nilai)}`).join(', ');
  const detail = `${aksi==='edit'?'Edit':'Input'} Kehadiran ${sesi} ${formatTanggal(tanggal)} | Hadir: ${payload.laki_laki+payload.perempuan} | Persembahan: ${formatRp(payload.pundi_persembahan)} | Pembangunan: ${formatRp(payload.pundi_pembangunan)}${lainnyaStr?' | '+lainnyaStr:''}`;
  await catatLog(aksi, detail, null);
  await kirimNotifikasiEmail(aksi, 'Kehadiran Ibadah', detail);
  showToast('Kehadiran berhasil disimpan ✅','success');
  closeModalKehadiran(); loadKehadiran();
}

let allKehadiranData=[];
async function editKehadiran(id) {
  const {data}=await sb.from('kehadiran_ibadah').select('*').eq('id',id).single();
  if (data) openModalKehadiran(data);
}

async function deleteKehadiran(id) {
  if (!confirm('Hapus data kehadiran ini?')) return;
  await sbAdmin.from('kehadiran_ibadah').delete().eq('id',id);
  showToast('Data kehadiran dihapus','success'); loadKehadiran();
}

function exportExcelKehadiran() {
  const rows=[];
  document.querySelectorAll('#kehadiranBody tr').forEach(tr=>{
    const tds=tr.querySelectorAll('td'); if (tds.length<2) return;
    rows.push({'Tanggal':tds[0].textContent,'Sesi':tds[1].textContent,'L':tds[2].textContent,'P':tds[3].textContent,'Total':tds[4].textContent,'Kadim':tds[5].textContent,'Persembahan':tds[6].textContent,'Diakonia':tds[7].textContent,'Pembangunan':tds[8].textContent,'Ekstra':tds[9].textContent,'Lainnya':tds[10].textContent});
  });
  if (!rows.length){alert('Tidak ada data');return;}
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Kehadiran');
  XLSX.writeFile(wb,`Kehadiran_${document.getElementById('filterBulanKehadiran').value||'semua'}.xlsx`);
}

// ===== PENGUMUMAN =====
async function loadAspirasiAdmin() {
  const kat=document.getElementById('filterKatAsp').value;
  const stat=document.getElementById('filterStatAsp').value;
  let q=sb.from('aspirasi').select('*').order('created_at',{ascending:false});
  if (kat) q=q.eq('kategori',kat);
  if (stat) q=q.eq('status',stat);
  const {data}=await q;
  const el=document.getElementById('aspirasiAdminList');
  if (!data||!data.length){el.innerHTML='<div style="color:var(--text-muted);padding:32px;text-align:center">Belum ada aspirasi</div>';return;}
  const katLabel={komentar:'💬 Komentar',usulan_pelayan:'🙏 Usulan Pelayan',koreksi:'✏️ Koreksi',lainnya:'📌 Lainnya'};
  el.innerHTML=data.map(a=>`
    <div class="asp-admin-card">
      <div class="asp-meta">
        <span class="asp-nama">${a.nama||'-'}</span>
        <span class="asp-kolom">Kolom ${a.kolom||'-'}</span>
        <span class="asp-kat-badge">${katLabel[a.kategori]||a.kategori||'-'}</span>
        <span class="asp-status asp-status-${a.status||'baru'}">${a.status==='baru'?'🔴 Baru':a.status==='dibaca'?'🟡 Dibaca':'🟢 Ditanggapi'}</span>
        <span class="asp-tgl">${new Date(a.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span>
      </div>
      <div class="asp-isi-text">${a.isi||''}</div>
      ${a.tanggapan?`<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px;margin-top:10px;font-size:13px;color:var(--success)">💬 <strong>Tanggapan:</strong> ${a.tanggapan}</div>`:''}
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
        ${isAdmin()?`<button class="btn btn-outline btn-sm" onclick="tandaiDibaca(${a.id})">👁️ Tandai Dibaca</button><button class="btn btn-primary btn-sm" onclick="openTanggapan(${a.id},'${(a.isi||'').replace(/'/g,"\\'").replace(/\n/g,' ')}')">💬 Tanggapi</button><button class="btn btn-danger btn-sm" onclick="deleteAspirasi(${a.id})">🗑️</button>`:''}
      </div>
    </div>`).join('');
}

async function tandaiDibaca(id){await sbAdmin.from('aspirasi').update({status:'dibaca'}).eq('id',id);loadAspirasiAdmin();}
async function deleteAspirasi(id){if(!confirm('Hapus aspirasi ini?'))return;await sbAdmin.from('aspirasi').delete().eq('id',id);showToast('Aspirasi dihapus','success');loadAspirasiAdmin();}

function openTanggapan(id,isi) {
  document.getElementById('tanggapanAspId').value=id;
  document.getElementById('tanggapanAspIsi').textContent=isi;
  document.getElementById('tanggapanIsi').value='';
  document.getElementById('modalTanggapan').classList.add('open');
}

async function saveTanggapan() {
  const id=document.getElementById('tanggapanAspId').value;
  const isi=document.getElementById('tanggapanIsi').value.trim();
  if (!isi){showToast('Tanggapan wajib diisi','error');return;}
  await sbAdmin.from('aspirasi').update({tanggapan:isi,status:'ditanggapi'}).eq('id',id);
  showToast('Tanggapan berhasil dikirim ✅','success');
  document.getElementById('modalTanggapan').classList.remove('open');
  loadAspirasiAdmin();
}

// ===== STRUKTUR (BPMJ / PELAYAN / KOMISI) =====
const tabelMap={bpmj:'struktur_bpmj',pelayan:'pelayan_khusus',komisi:'komisi_kerja'};
const gridAdminMap={bpmj:'bpmjAdminGrid',pelayan:'pelayanAdminGrid',komisi:'komisiAdminGrid'};

async function loadStrukturAdmin(jenis) {
  const tabel=tabelMap[jenis], gridId=gridAdminMap[jenis];
  const {data}=await sb.from(tabel).select('*').order('urutan');
  const el=document.getElementById(gridId);
  if (!data||!data.length){el.innerHTML='<div style="color:var(--text-muted);padding:32px">Belum ada data. Klik "+ Tambah" untuk menambahkan.</div>';return;}
  el.innerHTML=data.map(s=>{
    const fotoEl=s.foto_url?`<img class="sad-foto" src="${s.foto_url}" alt="${s.nama||s.nama_ketua}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="sad-foto-ph" style="display:none">👤</div>`:`<div class="sad-foto-ph">👤</div>`;
    const jabatan=jenis==='komisi'?`Ketua ${s.nama_komisi||''}`:(s.jabatan||'');
    const nama=jenis==='komisi'?(s.nama_ketua||''):(s.nama||'');
    return `<div class="str-admin-card">
      ${fotoEl}
      <div class="sad-jabatan">${jabatan}</div>
      <div class="sad-nama">${nama}</div>
      ${isSuperAdmin()?`<div class="sad-actions"><button class="btn btn-outline btn-sm" onclick="editStruktur('${jenis}',${s.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="deleteStruktur('${jenis}',${s.id})">🗑️</button></div>`:''}
    </div>`;
  }).join('');
}

function openModalStruktur(jenis,data=null) {
  document.getElementById('strukturEditId').value=data?data.id:'';
  document.getElementById('strukturJenis').value=jenis;
  const isKomisi=jenis==='komisi';
  document.getElementById('fieldNamaKomisi').style.display=isKomisi?'block':'none';
  document.getElementById('fieldJabatan').style.display=isKomisi?'none':'block';
  document.getElementById('sNamaLabel').textContent=isKomisi?'Nama Ketua *':'Nama Lengkap *';
  const titles={bpmj:'Anggota BPMJ',pelayan:'Pelayan Khusus',komisi:'Komisi Kerja'};
  document.getElementById('strukturModalTitle').textContent=(data?'Edit ':'Tambah ')+titles[jenis];
  document.getElementById('sNama').value=data?(isKomisi?data.nama_ketua||'':data.nama||''):'';
  document.getElementById('sJabatan').value=data?data.jabatan||'':'';
  document.getElementById('sUrutan').value=data?data.urutan||1:1;
  document.getElementById('sNamaKomisi').value=data?data.nama_komisi||'':'';
  document.getElementById('sFotoUrl').value=data?data.foto_url||'':'';
  document.getElementById('sFotoFile').value='';
  document.getElementById('sFotoPreview').style.display='none';
  if (data&&data.foto_url){document.getElementById('sFotoImg').src=data.foto_url;document.getElementById('sFotoPreview').style.display='block';}
  document.getElementById('modalStruktur').classList.add('open');
}

function closeModalStruktur(){document.getElementById('modalStruktur').classList.remove('open');}

document.getElementById('sFotoFile').addEventListener('change', function() {
  const file=this.files[0]; if (!file) return;
  if (file.size>5*1024*1024){showToast('Ukuran foto maks 5MB','error');this.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    // Kompres foto ke max 300x300 px sebelum disimpan
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      const MAX=300; let w=img.width,h=img.height;
      if(w>h){if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}}else{if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}}
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      const compressed=canvas.toDataURL('image/jpeg',0.8);
      document.getElementById('sFotoImg').src=compressed;
      document.getElementById('sFotoPreview').style.display='block';
      document.getElementById('sFotoUrl').value=compressed;
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
});

async function saveStruktur() {
  const id=document.getElementById('strukturEditId').value;
  const jenis=document.getElementById('strukturJenis').value;
  const isKomisi=jenis==='komisi';
  const nama=document.getElementById('sNama').value.trim();
  if (!nama){showToast('Nama wajib diisi','error');return;}
  const fotoUrl=document.getElementById('sFotoUrl').value;
  // Simpan base64 langsung ke database (tidak perlu Supabase Storage)
  let finalFotoUrl=fotoUrl||null;

  const payload={urutan:parseInt(document.getElementById('sUrutan').value)||1,foto_url:finalFotoUrl||null,aktif:true};
  if (isKomisi){payload.nama_ketua=nama;payload.nama_komisi=document.getElementById('sNamaKomisi').value.trim();}
  else{payload.nama=nama;payload.jabatan=document.getElementById('sJabatan').value.trim();}

  const tabel=tabelMap[jenis];
  const result=id?await sbAdmin.from(tabel).update(payload).eq('id',id):await sbAdmin.from(tabel).insert(payload);
  if (result.error){showToast('Gagal simpan: '+result.error.message,'error');return;}
  showToast('Data berhasil disimpan ✅','success');
  closeModalStruktur(); loadStrukturAdmin(jenis);
}



async function editStruktur(jenis,id) {
  const {data}=await sb.from(tabelMap[jenis]).select('*').eq('id',id).single();
  if (data) openModalStruktur(jenis,data);
}

async function deleteStruktur(jenis,id) {
  if (!confirm('Hapus data ini?')) return;
  await sbAdmin.from(tabelMap[jenis]).delete().eq('id',id);
  showToast('Data dihapus','success'); loadStrukturAdmin(jenis);
}

// ===== ULANG TAHUN ADMIN =====
async function loadUltah() {
  const bulanEl=document.getElementById('filterBulanUltah'), kolomEl=document.getElementById('filterKolomUltah');
  if (!bulanEl.options.length) {
    const bln=new Date().getMonth();
    bulanEl.innerHTML=namaBulan.map((b,i)=>`<option value="${i+1}" ${i===bln?'selected':''}>${b}</option>`).join('');
    const koloms=[...new Set(allJemaat.map(j=>j.kolom).filter(Boolean))].sort((a,b)=>a-b);
    kolomEl.innerHTML='<option value="">Semua Kolom</option>'+koloms.map(k=>`<option value="${k}">Kolom ${k}</option>`).join('');
  }
  const bulan=parseInt(bulanEl.value), kolom=kolomEl.value;
  const today=new Date();
  const filtered=allJemaat.filter(j=>{
    if (!j.tanggal_lahir) return false;
    const d=parseTanggal(j.tanggal_lahir); if (!d||isNaN(d)) return false;
    return (d.getMonth()+1)===bulan&&(!kolom||String(j.kolom)===kolom);
  }).sort((a,b)=>parseTanggal(a.tanggal_lahir).getDate()-parseTanggal(b.tanggal_lahir).getDate());
  document.getElementById('ultahSubtitle').textContent=`${filtered.length} jemaat berulang tahun bulan ini`;
  const koloms=[...new Set(allJemaat.map(j=>j.kolom).filter(Boolean))].sort((a,b)=>a-b);
  const cur=kolomEl.value;
  kolomEl.innerHTML='<option value="">Semua Kolom</option>'+koloms.map(k=>`<option value="${k}" ${String(k)===cur?'selected':''}>${'Kolom '+k}</option>`).join('');
  document.getElementById('ultahBody').innerHTML=!filtered.length?'<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>':filtered.map((j,i)=>{
    const d=parseTanggal(j.tanggal_lahir);
    const thisYear=new Date(today.getFullYear(),d.getMonth(),d.getDate());
    const diff=Math.ceil((thisYear-today)/(1000*60*60*24));
    const hariLabel=diff===0?'<span style="color:#dc2626;font-weight:700">🎉 Hari ini!</span>':diff>0?`${diff} hari lagi`:`${Math.abs(diff)} hari lalu`;
    return `<tr><td>${i+1}</td><td><strong>${j.nama_lengkap||'-'}</strong></td><td><span class="badge ${j.lp==='L'?'badge-l':'badge-p'}">${j.lp||'-'}</span></td><td>${formatTanggal(j.tanggal_lahir)}</td><td>${hitungUmur(j.tanggal_lahir)}</td><td>Kolom ${j.kolom||'-'}</td><td>${j.nama_keluarga||'-'}</td><td>${hariLabel}</td></tr>`;
  }).join('');
}

function exportExcelUltah(){
  const rows=[];
  document.querySelectorAll('#ultahBody tr').forEach(tr=>{const tds=tr.querySelectorAll('td');if(tds.length>1)rows.push({'No':tds[0].textContent,'Nama':tds[1].textContent,'L/P':tds[2].textContent,'Tgl Lahir':tds[3].textContent,'Umur':tds[4].textContent,'Kolom':tds[5].textContent,'Keluarga':tds[6].textContent,'Hari':tds[7].textContent});});
  if (!rows.length){alert('Tidak ada data');return;}
  const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'UlangTahun');
  XLSX.writeFile(wb,`UlangTahun_${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.xlsx`);
}

// Toggle field tanggal nikah di modal (muncul saat relasi Suami/Istri)
function toggleTglNikah() {
  const v = document.getElementById('fRelasi').value;
  const f = document.getElementById('fieldTglNikah');
  if (f) f.style.display = (v==='Suami'||v==='Istri') ? 'block' : 'none';
}

// Switch tab Ulang Tahun / Perkawinan
function switchUltahMainTab(tab) {
  document.getElementById('sectionUltah').style.display = tab==='ultah'?'block':'none';
  document.getElementById('sectionNikah').style.display = tab==='nikah'?'block':'none';
  const btnU=document.getElementById('tabUltahBtn'), btnN=document.getElementById('tabNikahBtn');
  btnU.style.borderBottomColor = tab==='ultah'?'var(--primary)':'transparent';
  btnU.style.color = tab==='ultah'?'var(--primary)':'var(--text-muted)';
  btnN.style.borderBottomColor = tab==='nikah'?'#c2410c':'transparent';
  btnN.style.color = tab==='nikah'?'#c2410c':'var(--text-muted)';
  if (tab==='nikah') loadUltahNikah();
}

// Load tabel ulang tahun perkawinan
function loadUltahNikah() {
  const bulanEl=document.getElementById('filterBulanNikah');
  const kolomEl=document.getElementById('filterKolomNikah');
  const today=new Date();
  if (!bulanEl.options.length) {
    const bln=today.getMonth();
    bulanEl.innerHTML=namaBulan.map((b,i)=>`<option value="${i+1}" ${i===bln?'selected':''}>${b}</option>`).join('');
    const koloms=[...new Set(allJemaat.map(j=>j.kolom).filter(Boolean))].sort((a,b)=>a-b);
    kolomEl.innerHTML='<option value="">Semua Kolom</option>'+koloms.map(k=>`<option value="${k}">Kolom ${k}</option>`).join('');
  }
  const bulan=parseInt(bulanEl.value), kolom=kolomEl.value;
  const familyNikah={};
  allJemaat.forEach(j=>{
    if(!j.tanggal_nikah||!j.nama_keluarga)return;
    if(familyNikah[j.nama_keluarga])return;
    const d=parseTanggal(j.tanggal_nikah);if(!d||isNaN(d))return;
    if((d.getMonth()+1)!==bulan)return;
    if(kolom&&String(j.kolom)!==kolom)return;
    const thisYear=new Date(today.getFullYear(),d.getMonth(),d.getDate());
    const diff=Math.ceil((thisYear-today)/(1000*60*60*24));
    const tahunKe=today.getFullYear()-d.getFullYear()+(diff<=0?0:-1);
    const suami=allJemaat.find(x=>x.nama_keluarga===j.nama_keluarga&&x.relasi==='Suami');
    const istri=allJemaat.find(x=>x.nama_keluarga===j.nama_keluarga&&x.relasi==='Istri');
    familyNikah[j.nama_keluarga]={nama_keluarga:j.nama_keluarga,kolom:j.kolom,tanggal_nikah:j.tanggal_nikah,diff,bd:d.getDate(),tahunKe,suami:suami?.nama_lengkap||'-',istri:istri?.nama_lengkap||'-'};
  });
  const list=Object.values(familyNikah).sort((a,b)=>a.bd-b.bd);
  const sub=document.getElementById('nikahSubtitle');
  if(sub) sub.textContent=`${list.length} keluarga berulang tahun perkawinan bulan ini`;
  document.getElementById('nikahBody').innerHTML=!list.length
    ?'<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data perkawinan bulan ini</td></tr>'
    :list.map((n,i)=>{
      const isH=n.diff===0;
      const d=parseTanggal(n.tanggal_nikah);
      const tgl=d?`${d.getDate()} ${namaBulan[d.getMonth()]} ${d.getFullYear()}`:'-';
      const ket=isH?'<span style="color:#dc2626;font-weight:700">💍 Hari ini!</span>':n.diff>0?`${n.diff} hari lagi`:`${Math.abs(n.diff)} hari lalu`;
      return `<tr ${isH?'style="background:#fff7ed"':''}><td>${i+1}</td><td><strong>${n.nama_keluarga||'-'}</strong></td><td>${n.suami}</td><td>${n.istri}</td><td>${tgl}</td><td><strong>${n.tahunKe}</strong> tahun</td><td>Kolom ${n.kolom||'-'}</td><td>${ket}</td></tr>`;
    }).join('');
}

// Export Excel Perkawinan
function exportExcelNikah(){
  const rows=[];
  document.querySelectorAll('#nikahBody tr').forEach(tr=>{
    const tds=tr.querySelectorAll('td');
    if(tds.length>1)rows.push({'No':tds[0].textContent,'Keluarga':tds[1].textContent,'Suami':tds[2].textContent,'Istri':tds[3].textContent,'Tgl Nikah':tds[4].textContent,'Usia Pernikahan':tds[5].textContent,'Kolom':tds[6].textContent,'Hari':tds[7].textContent});
  });
  if(!rows.length){alert('Tidak ada data');return;}
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'UltahPerkawinan');
  XLSX.writeFile(wb,`UltahPerkawinan_${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.xlsx`);
}

// ===== LANSIA =====
async function loadLansia() {
  const q=(document.getElementById('searchLansia')?.value||'').toLowerCase();
  const kolom=document.getElementById('filterKolomLansia')?.value||'';
  const lp=document.getElementById('filterLPLansia')?.value||'';
  const koloms=[...new Set(allJemaat.map(j=>j.kolom).filter(Boolean))].sort((a,b)=>a-b);
  const kEl=document.getElementById('filterKolomLansia'); const cur=kEl.value;
  kEl.innerHTML='<option value="">Semua Kolom</option>'+koloms.map(k=>`<option value="${k}" ${String(k)===cur?'selected':''}>${'Kolom '+k}</option>`).join('');
  const filtered=allJemaat.filter(j=>{
    const isL=j.lansia==='lansia'||(()=>{if(!j.tanggal_lahir)return false;const d=parseTanggal(j.tanggal_lahir);if(!d||isNaN(d))return false;return new Date().getFullYear()-d.getFullYear()>=60;})();
    return isL&&(!q||(j.nama_lengkap||'').toLowerCase().includes(q))&&(!kolom||String(j.kolom)===kolom)&&(!lp||j.lp===lp);
  }).sort((a,b)=>(a.kolom||0)-(b.kolom||0)||(a.nama_lengkap||'').localeCompare(b.nama_lengkap||''));
  document.getElementById('lansiaSubtitle').textContent=`${filtered.length} jemaat lansia`;
  document.getElementById('lansiaBody').innerHTML=!filtered.length?'<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>':filtered.map((j,i)=>`<tr><td>${i+1}</td><td><strong>${j.nama_lengkap||'-'}</strong></td><td><span class="badge ${j.lp==='L'?'badge-l':'badge-p'}">${j.lp||'-'}</span></td><td>${formatTanggal(j.tanggal_lahir)}</td><td>${hitungUmur(j.tanggal_lahir)}</td><td>Kolom ${j.kolom||'-'}</td><td>${j.nama_keluarga||'-'}</td><td>${j.alamat_rumah||'-'}</td></tr>`).join('');
}

function exportExcelLansia(){
  const rows=[];
  document.querySelectorAll('#lansiaBody tr').forEach(tr=>{const tds=tr.querySelectorAll('td');if(tds.length>1)rows.push({'No':tds[0].textContent,'Nama':tds[1].textContent,'L/P':tds[2].textContent,'Tgl Lahir':tds[3].textContent,'Umur':tds[4].textContent,'Kolom':tds[5].textContent,'Keluarga':tds[6].textContent,'Alamat':tds[7].textContent});});
  if (!rows.length){alert('Tidak ada data');return;}
  const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Lansia');
  XLSX.writeFile(wb,`Lansia_${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.xlsx`);
}

// ===== KELUARGA =====
let allKeluargaData=[];
async function loadKeluarga() {
  const list=document.getElementById('keluargaList');
  list.innerHTML='<div class="loading"><div class="spinner"></div><p style="margin-top:12px">Memuat data keluarga...</p></div>';
  let q=sb.from('jemaat').select('*').order('kolom').order('nama_keluarga').order('relasi');
  if (!isAdmin()) q=q.eq('kolom',currentUser.kolom);
  const {data}=await q; if (!data) return;
  allKeluargaData=data;
  const kolomSet=[...new Set(data.map(j=>j.kolom).filter(Boolean))].sort((a,b)=>a-b);
  const sel=document.getElementById('filterKolomKeluarga');
  sel.innerHTML='<option value="">Semua Kolom</option>'+kolomSet.map(k=>`<option value="${k}">Kolom ${k}</option>`).join('');
  const total=[...new Set(data.map(j=>j.nama_keluarga).filter(Boolean))].length;
  document.getElementById('keluargaSubtitle').textContent=`${total} keluarga — ${data.length} jemaat`;
  renderKeluarga(data);
}

function filterKeluarga(){const q=document.getElementById('searchKeluarga').value.toLowerCase();const kolom=document.getElementById('filterKolomKeluarga').value;renderKeluarga(allKeluargaData.filter(j=>(!q||(j.nama_keluarga||'').toLowerCase().includes(q))&&(!kolom||String(j.kolom)===kolom)));}

function renderKeluarga(data) {
  const list=document.getElementById('keluargaList');
  const byKolom={};
  data.forEach(j=>{const k=j.kolom||0,fam=j.nama_keluarga||'(Tanpa Nama Keluarga)';if(!byKolom[k])byKolom[k]={};if(!byKolom[k][fam])byKolom[k][fam]=[];byKolom[k][fam].push(j);});
  if (!Object.keys(byKolom).length){list.innerHTML='<p style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</p>';return;}
  list.innerHTML=Object.keys(byKolom).sort((a,b)=>a-b).map(kolom=>{
    const famKeys=Object.keys(byKolom[kolom]).sort();
    return `<div class="keluarga-kolom"><div class="keluarga-kolom-title"><span>⛪ Kolom ${kolom}</span><span style="font-size:13px;opacity:0.8">${famKeys.length} keluarga</span></div><div class="keluarga-cards">${famKeys.map(fam=>{
      const members=sortAnggotaKeluarga(byKolom[kolom][fam]);
      const noKK=members.find(m=>m.no_kk)?.no_kk||'';
      const alamatRumah=members.find(m=>m.alamat_rumah)?.alamat_rumah||'';
      const statusJemaat=members.find(m=>m.status_jemaat)?.status_jemaat||'lama';
      const jemaatAsal=members.find(m=>m.jemaat_asal)?.jemaat_asal||'';
      const alamatKolom=members.find(m=>m.alamat_kolom)?.alamat_kolom||'';
      const memberIds=members.map(m=>m.id).join(',');
      const _fam=fam.replace(/"/g,'&quot;');
      const _al=(alamatRumah||'').replace(/"/g,'&quot;');
      const _ja=(jemaatAsal||'').replace(/"/g,'&quot;');
      const _ak=(alamatKolom||'').replace(/"/g,'&quot;');
      const _anggota=members.map(m=>'<div class="anggota-item"><span class="anggota-relasi">'+(m.relasi||'-')+'</span><span class="anggota-name">'+(m.nama_lengkap||'-')+'</span><span class="anggota-lp">'+(m.lp||'')+'</span><span class="anggota-umur">'+(m.tanggal_lahir?hitungUmur(m.tanggal_lahir):'')+'</span></div>').join('');
      const _info=((alamatRumah?'<div>🏠 <b>Alamat:</b> '+alamatRumah+'</div>':'')+(jemaatAsal?'<div>⛪ <b>Jemaat Asal:</b> '+jemaatAsal+'</div>':'')+(alamatKolom?'<div>📍 <b>Kolom Wilayah:</b> '+alamatKolom+'</div>':''))||'<div style="color:#aaa;font-style:italic">Belum ada data alamat — klik Edit Alamat</div>';
      return '<div class="keluarga-card" data-fam="'+_fam+'" data-ids="'+memberIds+'" data-alamat="'+_al+'" data-jemaat="'+_ja+'" data-kolom-wil="'+_ak+'">'
        +'<div class="keluarga-card-header"><h4>🏠 '+fam+'</h4><div style="display:flex;gap:6px;align-items:center">'+(noKK?'<span class="kk-badge">KK: '+noKK+'</span>':'')
        +'<span style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;'+(statusJemaat==='baru'?'background:#fef3c7;color:#92400e':'background:#d1fae5;color:#065f46')+'">'+(statusJemaat==='baru'?'🆕 Baru':'✅ Lama')+'</span></div></div>'
        +'<div class="keluarga-anggota">'+_anggota+'</div>'
        +'<div style="margin:8px 16px;padding:8px 10px;background:rgba(26,58,92,0.04);border-radius:6px;border:1px solid var(--border);font-size:12px;color:var(--text-muted)">'+_info+'</div>'
        +'<div class="keluarga-footer">'+members.length+' anggota &nbsp;|&nbsp; Kolom '+kolom+' &nbsp;|&nbsp;'
        +'<button class="btn btn-primary btn-sm" style="padding:3px 10px;font-size:12px" onclick="tambahAnggotaKeluarga(this)">👤 + Anggota</button>'
        +'<button class="btn btn-outline btn-sm" style="padding:3px 10px;font-size:12px;margin-left:4px" onclick="cetakKartuKeluarga(this)">🖨️ Cetak KK</button>'
        +'<button class="btn btn-outline btn-sm" style="padding:3px 10px;font-size:12px;margin-left:4px" onclick="bukaModalPetaCard(this)">📍 Peta</button>'
        +'<button class="btn btn-outline btn-sm" style="padding:3px 10px;font-size:12px;margin-left:4px;color:var(--primary);border-color:var(--primary)" onclick="bukaModalAlamatCard(this)">✏️ Edit Alamat</button>'
        +'</div></div>';
    }).join('')}</div></div>`;
  }).join('');
}


// ===== TAMBAH ANGGOTA KE KELUARGA YANG ADA =====
function tambahAnggotaKeluarga(btn) {
  const card = btn.closest('.keluarga-card');
  const namaKeluarga = card.dataset.fam;
  const anggota = allKeluargaData.find(j => j.nama_keluarga === namaKeluarga);
  openModal(null, 'tambah-anggota');
  document.getElementById('fKeluarga').value = namaKeluarga;
  if (anggota) {
    document.getElementById('fKolom').value = anggota.kolom || '';
    document.getElementById('fNoKK').value = anggota.no_kk || '';
    document.getElementById('fAlamatRumah').value = anggota.alamat_rumah || '';
    document.getElementById('fJemaat').value = anggota.jemaat_asal || '';
    document.getElementById('fAlamatKolom').value = anggota.alamat_kolom || '';
  }
  document.getElementById('modalTitle').textContent = '👤 Tambah Anggota — ' + namaKeluarga;
}

// ===== EDIT ALAMAT KELUARGA =====
function bukaModalAlamatCard(btn) {
  const card = btn.closest('.keluarga-card');
  document.getElementById('modalAlamatNama').textContent = '🏠 ' + card.dataset.fam;
  document.getElementById('modalAlamatIds').value = card.dataset.ids;
  document.getElementById('modalAlamatRumah').value = card.dataset.alamat || '';
  document.getElementById('modalAlamatJemaat').value = card.dataset.jemaat || '';
  document.getElementById('modalAlamatKolom').value = card.dataset.kolomWil || '';
  document.getElementById('modalAlamat').classList.add('open');
}

function bukaModalPetaCard(btn) {
  bukaModalPeta(btn.closest('.keluarga-card').dataset.fam);
}

async function simpanAlamatKeluarga() {
  const ids = document.getElementById('modalAlamatIds').value.split(',').map(Number).filter(Boolean);
  const alamat_rumah = document.getElementById('modalAlamatRumah').value.trim();
  const jemaat_asal = document.getElementById('modalAlamatJemaat').value.trim();
  const alamat_kolom = document.getElementById('modalAlamatKolom').value.trim();
  if (!ids.length) { showToast('Tidak ada anggota keluarga', 'error'); return; }
  const btn = document.querySelector('#modalAlamat .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
  try {
    const { error } = await sbAdmin.from('jemaat')
      .update({ alamat_rumah, jemaat_asal, alamat_kolom, updated_at: new Date().toISOString() })
      .in('id', ids);
    if (error) { showToast('Gagal simpan: ' + error.message, 'error'); return; }
    showToast('Alamat keluarga berhasil disimpan ✅', 'success');
    document.getElementById('modalAlamat').classList.remove('open');
    loadKeluarga();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Simpan'; }
  }
}

// Fix cetakKartuKeluarga to accept button element
const _cetakOri = window._cetakOri;

// ===== PENATUA =====
async function loadPenatua() {
  const {data}=await sb.from('akun_kolom').select('*').gt('kolom',0).order('kolom');
  if (!data) return;
  document.getElementById('penataGrid').innerHTML=data.map(a=>`<div class="profile-card"><div class="kolom-num">Kolom ${a.kolom}</div><h3>${a.username}</h3><div class="role-section"><div class="role-label">⛪ Penatua</div><div class="role-name">${a.penatua||'<em style="color:var(--text-muted)">Belum diisi</em>'}</div></div><div class="role-section"><div class="role-label">🙏 Diaken</div><div class="role-name">${a.diaken||'<em style="color:var(--text-muted)">Belum diisi</em>'}</div></div>${isAdmin()?`<button class="btn-edit-profile" onclick="openAkunModal(${a.kolom})">✏️ Edit</button>`:''}</div>`).join('');
}

// ===== AKUN =====
async function loadAkun() {
  const {data}=await sb.from('akun_kolom').select('*').order('kolom');
  if (!data) return;
  document.getElementById('akunBody').innerHTML=data.map(a=>`<tr><td>${a.kolom===0?'Admin 1':a.kolom===-1?'Admin 2':`Kolom ${a.kolom}`}</td><td>${a.username}</td><td><span id="pwd_${a.kolom}" style="font-family:monospace">••••••••</span> <button class="btn btn-outline btn-sm" style="padding:3px 8px;font-size:11px" onclick="togglePwd(${a.kolom},'${(a.password||'').replace(/'/g,"\\'")}')">👁️</button></td><td>${a.penatua||'-'}</td><td>${a.diaken||'-'}</td><td style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" onclick="openAkunModal(${a.kolom})">✏️</button>${isAdmin()&&a.kolom!==0&&a.kolom!==-1?`<button class="btn btn-danger btn-sm" onclick="deleteAkun(${a.kolom},'${(a.username||'').replace(/'/g,"\\'")}')">🗑️</button>`:''}</td></tr>`).join('');
}

async function deleteAkun(kolom,username){if(!confirm(`Hapus akun "${username}"?`))return;const {error}=await sbAdmin.from('akun_kolom').delete().eq('kolom',kolom);if(error){showToast('Gagal','error');return;}showToast('Akun dihapus','success');loadAkun();}
function togglePwd(kolom,pwd){const el=document.getElementById('pwd_'+kolom);if(!el)return;el.textContent=el.textContent.includes('•')?pwd:'••••••••';}

async function openAkunModal(kolom=null) {
  document.getElementById('aPenatua').value='';document.getElementById('aDiaken').value='';document.getElementById('aPassword').value='';document.getElementById('aKolomBaru').value='';document.getElementById('aUsernameBaru').value='';
  if (kolom!==null) {
    document.getElementById('akunMode').value='edit';document.getElementById('akunKolom').value=kolom;
    document.getElementById('akunModalTitle').textContent=kolom===0?'Edit Akun Admin 1':kolom===-1?'Edit Akun Admin 2':`Edit Akun Kolom ${kolom}`;
    document.getElementById('fieldKolomBaru').style.display='none';document.getElementById('fieldUsernameBaru').style.display='none';
    document.getElementById('aPasswordLabel').textContent='Password Baru (kosongkan jika tidak diubah)';
    const {data}=await sb.from('akun_kolom').select('*').eq('kolom',kolom).single();
    if (data){document.getElementById('aPenatua').value=data.penatua||'';document.getElementById('aDiaken').value=data.diaken||'';}
  } else {
    document.getElementById('akunMode').value='add';document.getElementById('akunKolom').value='';document.getElementById('akunModalTitle').textContent='+ Tambah Akun Baru';
    document.getElementById('fieldKolomBaru').style.display='block';document.getElementById('fieldUsernameBaru').style.display='block';
    document.getElementById('aPasswordLabel').textContent='Password *';
  }
  document.getElementById('modalAkun').classList.add('open');
}

function closeAkunModal(){document.getElementById('modalAkun').classList.remove('open');}

async function saveAkun() {
  const mode=document.getElementById('akunMode').value;
  if (mode==='add') {
    const kolomBaru=document.getElementById('aKolomBaru').value.trim(),usernameBaru=document.getElementById('aUsernameBaru').value.trim(),pwd=document.getElementById('aPassword').value.trim();
    if (kolomBaru===''){showToast('Nomor kolom wajib','error');return;}
    if (!usernameBaru){showToast('Username wajib','error');return;}
    if (!pwd){showToast('Password wajib','error');return;}
    const kolomNum=parseInt(kolomBaru);
    const {data:ex}=await sb.from('akun_kolom').select('kolom').eq('kolom',kolomNum).maybeSingle();
    if (ex){showToast(`Kolom ${kolomNum} sudah ada`,'error');return;}
    const {error}=await sbAdmin.from('akun_kolom').insert({kolom:kolomNum,username:usernameBaru,password:pwd,penatua:document.getElementById('aPenatua').value||null,diaken:document.getElementById('aDiaken').value||null});
    if (error){showToast('Gagal: '+error.message,'error');return;}
    showToast('Akun berhasil ditambahkan ✅','success');closeAkunModal();loadAkun();return;
  }
  const kolom=parseInt(document.getElementById('akunKolom').value);
  const payload={penatua:document.getElementById('aPenatua').value,diaken:document.getElementById('aDiaken').value};
  const pwd=document.getElementById('aPassword').value; if (pwd) payload.password=pwd;
  const {error}=await sbAdmin.from('akun_kolom').update(payload).eq('kolom',kolom);
  if (error){showToast('Gagal','error');return;}
  showToast('Akun berhasil diperbarui','success');closeAkunModal();loadAkun();loadPenatua();
}

// ===== PETA =====
let petaMap=null,petaModalMap=null,allMarkers=[],currentPetaKeluarga=null;
async function loadPeta() {
  if (!petaMap) {
    petaMap=L.map('petaMap').setView([1.4748,124.8421],13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(petaMap);
  } else petaMap.eachLayer(l=>{if(l instanceof L.Marker)petaMap.removeLayer(l);});
  const kolomFilter=document.getElementById('filterKolomPeta').value;
  const statusFilter=document.getElementById('filterStatusPeta').value;
  const koloms=[...new Set(allJemaat.map(j=>j.kolom).filter(Boolean))].sort((a,b)=>a-b);
  const cur=document.getElementById('filterKolomPeta').value;
  document.getElementById('filterKolomPeta').innerHTML='<option value="">Semua Kolom</option>'+koloms.map(k=>`<option value="${k}" ${String(k)===cur?'selected':''}>Kolom ${k}</option>`).join('');
  const {data}=await sb.from('jemaat').select('nama_keluarga,kolom,lat,lng,status_jemaat').order('nama_keluarga');
  if (!data) return;
  const byFam={};
  data.forEach(j=>{if(!byFam[j.nama_keluarga])byFam[j.nama_keluarga]=j;});
  Object.values(byFam).forEach(j=>{
    if (!j.lat||!j.lng) return;
    if (kolomFilter&&String(j.kolom)!==kolomFilter) return;
    if (statusFilter&&j.status_jemaat!==statusFilter) return;
    const color=j.status_jemaat==='baru'?'#f59e0b':'#10b981';
    const icon=L.divIcon({html:`<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,iconSize:[14,14],iconAnchor:[7,7],className:''});
    L.marker([j.lat,j.lng],{icon}).addTo(petaMap).bindPopup(`<strong>${j.nama_keluarga||'-'}</strong><br>Kolom ${j.kolom||'-'}<br>${j.status_jemaat==='baru'?'🆕 Jemaat Baru':'✅ Jemaat Lama'}`);
  });
}

function filterPeta(){loadPeta();}
let petaModalMapObj=null,petaMarker=null;
function bukaModalPeta(namaKeluarga){
  currentPetaKeluarga=namaKeluarga;
  const j=allKeluargaData.find(x=>x.nama_keluarga===namaKeluarga);
  document.getElementById('petaModalTitle').textContent='📍 '+namaKeluarga;
  document.getElementById('petaLat').value=j?.lat||'';document.getElementById('petaLng').value=j?.lng||'';
  document.getElementById('modalPeta').classList.add('open');
  setTimeout(()=>{
    if (!petaModalMapObj){petaModalMapObj=L.map('petaModalMap').setView([j?.lat||1.4748,j?.lng||124.8421],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(petaModalMapObj);petaModalMapObj.on('click',e=>{petaMarker&&petaModalMapObj.removeLayer(petaMarker);petaMarker=L.marker(e.latlng).addTo(petaModalMapObj);document.getElementById('petaLat').value=e.latlng.lat.toFixed(6);document.getElementById('petaLng').value=e.latlng.lng.toFixed(6);});}
    else {petaModalMapObj.setView([j?.lat||1.4748,j?.lng||124.8421],15);}
    if (j?.lat&&j?.lng){petaMarker&&petaModalMapObj.removeLayer(petaMarker);petaMarker=L.marker([j.lat,j.lng]).addTo(petaModalMapObj);}
    petaModalMapObj.invalidateSize();
  },300);
}

function closePetaModal(){document.getElementById('modalPeta').classList.remove('open');}

async function cariAlamatPeta(){const q=document.getElementById('petaCariAlamat').value.trim();if(!q)return;const res=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`);const data=await res.json();if(data&&data[0]){const lat=parseFloat(data[0].lat),lng=parseFloat(data[0].lon);petaModalMapObj.setView([lat,lng],16);petaMarker&&petaModalMapObj.removeLayer(petaMarker);petaMarker=L.marker([lat,lng]).addTo(petaModalMapObj);document.getElementById('petaLat').value=lat.toFixed(6);document.getElementById('petaLng').value=lng.toFixed(6);}else alert('Alamat tidak ditemukan');}

async function gunakanLokasiSaya(){navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{const {latitude:lat,longitude:lng}=p.coords;petaModalMapObj.setView([lat,lng],16);petaMarker&&petaModalMapObj.removeLayer(petaMarker);petaMarker=L.marker([lat,lng]).addTo(petaModalMapObj);document.getElementById('petaLat').value=lat.toFixed(6);document.getElementById('petaLng').value=lng.toFixed(6);}):alert('Geolocation tidak tersedia');}

async function simpanKoordinat(){
  const lat=parseFloat(document.getElementById('petaLat').value),lng=parseFloat(document.getElementById('petaLng').value);
  if (!lat||!lng){showToast('Pilih lokasi terlebih dahulu','error');return;}
  const {error}=await sbAdmin.from('jemaat').update({lat,lng}).eq('nama_keluarga',currentPetaKeluarga);
  if (error){showToast('Gagal menyimpan lokasi','error');return;}
  showToast('Lokasi berhasil disimpan ✅','success');closePetaModal();loadPeta();
}

// ===== CETAK KK =====
function cetakKartuKeluarga(arg){const namaKeluarga=(typeof arg==='string')?arg:arg.closest('.keluarga-card').dataset.fam;
  const members=allKeluargaData.filter(j=>j.nama_keluarga===namaKeluarga);if(!members.length)return;
  const rep=members[0];
  const sorted=sortAnggotaKeluarga(members);
  document.getElementById('kkNamaKeluarga').textContent=namaKeluarga;
  document.getElementById('kkNoKK').textContent=rep.no_kk||'-';
  document.getElementById('kkKolom').textContent='Kolom '+(rep.kolom||'-');
  document.getElementById('kkStatus').textContent=rep.status_jemaat==='baru'?'🆕 Jemaat Baru':'✅ Jemaat Lama';
  document.getElementById('kkAlamat').textContent=rep.alamat_rumah||'-';
  document.getElementById('kkJemaat').textContent=rep.jemaat_asal||'-';
  document.getElementById('kkWilayah').textContent=rep.alamat_kolom||'-';
  document.getElementById('kkTanggalCetak').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const io=members.find(m=>m.diinput_oleh);
  document.getElementById('kkInfoInput').textContent=io?`Diinput: ${io.diinput_oleh} — ${new Date(io.waktu_input).toLocaleString('id-ID')}`:'Data lama';
  document.getElementById('kkAnggotaBody').innerHTML=sorted.map(m=>`<tr><td style="padding:6px;border-bottom:1px solid #e5e7eb">${m.nama_lengkap||'-'}</td><td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:center">${m.lp||'-'}</td><td style="padding:6px;border-bottom:1px solid #e5e7eb">${formatTanggal(m.tanggal_lahir)}</td><td style="padding:6px;border-bottom:1px solid #e5e7eb">${hitungUmur(m.tanggal_lahir)}</td><td style="padding:6px;border-bottom:1px solid #e5e7eb">${m.relasi||'-'}</td><td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:center">${m.baptis==='sudah-baptis'?'✓':'-'}</td><td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:center">${m.sidi==='sudah-sidi'?'✓':'-'}</td></tr>`).join('');
  // Generate QR Code tanda tangan digital
  _generateKKQr('kkQrKetua', 'Ketua BPMJ GMIM Smirna|Pdt. Alfius Mangode, M.Th.|' + namaKeluarga + '|' + new Date().toISOString().slice(0,10));
  _generateKKQr('kkQrSekretaris', 'Sekretaris BPMJ GMIM Smirna|Pnt. Dr. Ir. Ari Berty Rondonuwu, M.Sc.M.Si.|' + namaKeluarga + '|' + new Date().toISOString().slice(0,10));

  document.getElementById('modalCetakKK').classList.add('open');
}

function cetakKK() {
  const konten = document.getElementById('kartuKeluargaPrint');
  if (!konten) { window.print(); return; }

  // Clone konten agar tidak merusak DOM asli
  const clone = konten.cloneNode(true);

  // Konversi canvas QR di DOM asli ke dataURL, lalu masukkan ke clone sebagai img
  ['kkQrKetua','kkQrSekretaris'].forEach(qrId => {
    const origEl = document.getElementById(qrId);
    const cloneEl = clone.querySelector('#' + qrId);
    if (!origEl || !cloneEl) return;
    const canvas = origEl.querySelector('canvas');
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      cloneEl.innerHTML = '<img src="' + dataUrl + '" style="width:72px;height:72px;display:block;margin:0 auto;">';
    }
  });

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(el => el.outerHTML).join('\n');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Kartu Keluarga GMIM Smirna</title>
${styles}
<style>
  @page { size: A5 portrait; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { margin:0; padding:0; background:#fff; font-family:'Source Sans 3',Arial,sans-serif; }
  :root { --primary:#1a3a5c; --accent:#c8a96e; --accent-light:#e8d5a3; --text:#1a1a2e; --text-muted:#6b7280; --border:#ddd5c0; }
  #kartuKeluargaPrint { border:2px solid #1a3a5c; border-radius:8px; padding:14px; font-size:11px; color:#1a1a2e; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  table { width:100%; border-collapse:collapse; font-size:10px; margin-bottom:8px; }
  thead tr { background:#1a3a5c !important; color:#fff !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  thead th { padding:5px 4px; color:#fff !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  tbody td { padding:5px 4px; border-bottom:1px solid #e5e7eb; }
  img { display:block; }
</style>
</head>
<body>${clone.outerHTML}</body>
</html>`;

  const win = window.open('', '_blank', 'width=700,height=900');
  win.document.write(html);
  win.document.close();
  win.onload = function() {
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 500);
  };
}

function _generateKKQr(elId, text) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(el, {
      text: text,
      width: 72,
      height: 72,
      colorDark: '#1a3a5c',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    // QRCode.js menghasilkan canvas + img — sembunyikan img, tampilkan canvas saja
    setTimeout(() => {
      const img = el.querySelector('img');
      const canvas = el.querySelector('canvas');
      if (img) img.style.display = 'none';
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.width = '72px';
        canvas.style.height = '72px';
      }
    }, 100);
  } else {
    const size = 72;
    const data = text.split('').map(c => c.charCodeAt(0));
    const bars = [];
    let x = 2, barW = 2;
    for (let i = 0; i < Math.min(data.length, 30); i++) {
      const h = 20 + (data[i] % 40);
      bars.push('<rect x="' + x + '" y="' + ((size - h) / 2) + '" width="' + barW + '" height="' + h + '" fill="#1a3a5c"/>');
      x += barW + (data[i] % 2 === 0 ? 1 : 2);
      if (x > size - 4) break;
    }
    el.innerHTML = '<svg width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg" style="border:1px solid #e5e7eb;border-radius:4px;display:block;margin:0 auto">' + bars.join('') + '</svg>';
  }
}

// ===== IMPORT =====
let importData=[];
function previewImport(){
  const file=document.getElementById('importFile').files[0];if(!file){showToast('Pilih file Excel terlebih dahulu','error');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    const wb=XLSX.read(e.target.result,{type:'binary'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const json=XLSX.utils.sheet_to_json(ws,{defval:''});
    importData=json;
    document.getElementById('importInfo').textContent=`${json.length} baris data ditemukan`;
    const keys=Object.keys(json[0]||{});
    document.getElementById('importPreviewHead').innerHTML='<tr>'+keys.map(k=>`<th>${k}</th>`).join('')+'</tr>';
    document.getElementById('importPreviewBody').innerHTML=json.slice(0,5).map(r=>'<tr>'+keys.map(k=>`<td>${r[k]}</td>`).join('')+'</tr>').join('');
    document.getElementById('importPreview').style.display='block';
    document.getElementById('btnDoImport').style.display='inline-flex';
  };
  reader.readAsBinaryString(file);
}

async function doImport(){
  if (!importData.length){showToast('Tidak ada data untuk diimport','error');return;}
  document.getElementById('importProgress').style.display='block';
  document.getElementById('btnDoImport').disabled=true;
  let sukses=0,gagal=0;
  for (let i=0;i<importData.length;i++) {
    const r=importData[i];
    let tgl=r.tanggal_lahir;
    if (typeof tgl==='number'){const d=new Date((tgl-25569)*86400*1000);tgl=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
    const namaKel=String(r.nama_keluarga||'');
    let isKeluargaBaru=false;
    if (namaKel){const{data:ex}=await sb.from('jemaat').select('id').eq('nama_keluarga',namaKel).limit(1);isKeluargaBaru=!ex||ex.length===0;}
    const payload={kolom:parseInt(r.kolom)||null,no:String(r.no||''),nama_lengkap:String(r.nama_lengkap||''),nik:String(r.nik||''),lp:String(r.lp||''),tempat_lahir:String(r.tempat_lahir||''),tanggal_lahir:tgl,pekerjaan:String(r.pekerjaan||''),baptis:String(r.baptis||''),sidi:String(r.sidi||''),nama_keluarga:namaKel,no_kk:String(r.no_kk||''),relasi:String(r.relasi||''),bipra:String(r.bipra||''),lansia:String(r.lansia||''),alamat_rumah:String(r.alamat_rumah||''),jemaat_asal:String(r.jemaat_asal||''),alamat_kolom:String(r.alamat_kolom||''),status_jemaat:isKeluargaBaru?'baru':'lama',diinput_oleh:currentUser?.username||'-',waktu_input:new Date().toISOString(),updated_at:new Date().toISOString()};
    const {error}=await sbAdmin.from('jemaat').insert(payload);
    if (error)gagal++;else sukses++;
    const pct=Math.round(((i+1)/importData.length)*100);
    document.getElementById('importProgressBar').style.width=pct+'%';
    document.getElementById('importProgressText').textContent=`${i+1} / ${importData.length} — ${sukses} berhasil, ${gagal} gagal`;
  }
  showToast(`Import selesai: ${sukses} berhasil, ${gagal} gagal`,sukses>0?'success':'error');
  document.getElementById('btnDoImport').disabled=false;
  await loadJemaat(); await loadDashboard(); await catatLog('import',`Import ${sukses} data dari Excel`,null);
}

// ===== LOG =====
// ===== EMAIL NOTIFIKASI ADMIN =====
async function kirimNotifikasiEmail(aksi, modul, detail) {
  try {
    const {data} = await sb.from('pengumuman').select('isi').eq('judul','_email_notif').limit(1);
    if (!data || !data[0] || !data[0].isi) return;
    const emailTarget = data[0].isi.trim();
    if (!emailTarget || !emailTarget.includes('@')) return;

    const now = new Date();
    const tgl = now.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
    const jam = now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const user = currentUser?.username || '-';
    const kolom = currentUser?.kolom !== undefined ? `Kolom ${currentUser.kolom}` : '-';
    const aksiIcon = aksi==='tambah'?'➕':aksi==='edit'?'✏️':aksi==='hapus'?'🗑️':aksi==='test'?'🧪':'📝';

    const subject = `[SID GMIM Smirna] ${aksiIcon} ${aksi.toUpperCase()} ${modul}`;
    const body = `╔══════════════════════════════════════╗\n  NOTIFIKASI SISTEM INFORMASI DIGITAL\n  GMIM "Smirna" Malalayang Dua\n╚══════════════════════════════════════╝\n\n📅 Tanggal  : ${tgl}\n⏰ Jam      : ${jam}\n👤 Pengguna : ${user} (${kolom})\n📋 Modul    : ${modul}\n🔔 Aksi     : ${aksi.toUpperCase()}\n\n📄 Detail:\n${detail}\n\n${'─'.repeat(40)}\nSistem Informasi Digital GMIM "Smirna"\nMalalayang Dua · smirnamalalayangdua.org`;

    // Catat ke log
    await sbAdmin.from('log_perubahan').insert({
      aksi:'notif_email',
      keterangan:`[${aksi.toUpperCase()}] ${modul}: ${detail.substring(0,200)}`,
      id_jemaat:null, oleh:user, kolom_user:currentUser?.kolom??null,
      waktu:new Date().toISOString()
    }).catch(()=>{});

    // Kirim via EmailJS jika tersedia
    if (window.emailjs && window._emailjsCfg) {
      await window.emailjs.send(
        window._emailjsCfg.serviceId,
        window._emailjsCfg.templateId,
        { to_email:emailTarget, subject, message:body, from_name:'SID GMIM Smirna' }
      ).catch(()=>{});
    }
  } catch(e) {}
}

async function catatLog(aksi,keterangan,idJemaat){try{await sbAdmin.from('log_perubahan').insert({aksi,keterangan,id_jemaat:idJemaat||null,oleh:currentUser?.username||'-',kolom_user:currentUser?.kolom??null,waktu:new Date().toISOString()});}catch(e){}}

async function loadLog(){
  const aksi=document.getElementById('filterLogAksi').value,kolom=document.getElementById('filterLogKolom').value;
  const koloms=[...new Set(allJemaat.map(j=>j.kolom).filter(Boolean))].sort((a,b)=>a-b);
  const kEl=document.getElementById('filterLogKolom');const cur=kEl.value;
  kEl.innerHTML='<option value="">Semua Kolom</option>'+koloms.map(k=>`<option value="${k}" ${String(k)===cur?'selected':''}>${'Kolom '+k}</option>`).join('');
  let q=sb.from('log_perubahan').select('*').order('waktu',{ascending:false}).limit(200);
  if (aksi) q=q.eq('aksi',aksi);if (kolom) q=q.eq('kolom_user',parseInt(kolom));
  const {data,error}=await q;
  if (error){document.getElementById('logBody').innerHTML='<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--danger)">Tabel log belum dibuat.</td></tr>';return;}
  const aksiIcon={tambah:'➕',edit:'✏️',hapus:'🗑️',import:'📥'};
  document.getElementById('logBody').innerHTML=!data?.length?'<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Belum ada riwayat</td></tr>':data.map(l=>`<tr><td style="font-size:12px;white-space:nowrap">${new Date(l.waktu).toLocaleString('id-ID')}</td><td><span class="badge" style="background:#e0e7ff;color:#3730a3">${aksiIcon[l.aksi]||''} ${l.aksi}</span></td><td>${l.oleh||'-'}</td><td>${l.kolom_user!==null?'Kolom '+l.kolom_user:'-'}</td><td style="font-size:13px">${l.keterangan||'-'}</td></tr>`).join('');
}

// ===== EXPORT EXCEL =====
function exportExcel(mode){
  let sumber=allJemaat,namaFile='Data_Jemaat';
  if (mode==='sidi'){sumber=allJemaat.filter(j=>j.sidi==='sudah-sidi');namaFile='Jemaat_Sudah_Sidi';}
  if (mode==='belum-sidi'){sumber=allJemaat.filter(j=>j.sidi!=='sudah-sidi');namaFile='Jemaat_Belum_Sidi';}
  if (mode==='per-kolom'){namaFile='Jemaat_Per_Kolom';}
  if (mode==='jemaat'){sumber=filteredJemaat;namaFile='Data_Jemaat';}
  if (['per-kolom','sidi','belum-sidi'].includes(mode)){
    const cfgMap={'per-kolom':{search:'searchPerKolom',kolom:'filterKolomSub',lp:'filterLPSub'},'sidi':{search:'searchSidi',kolom:'filterKolomSidi',lp:'filterLPSidi'},'belum-sidi':{search:'searchBelumSidi',kolom:'filterKolomBelumSidi',lp:'filterLPBelumSidi'}};
    const cfg=cfgMap[mode];const q=(document.getElementById(cfg.search)?.value||'').toLowerCase();const kolom=document.getElementById(cfg.kolom)?.value||'';const lp=document.getElementById(cfg.lp)?.value||'';
    sumber=sumber.filter(j=>(!q||(j.nama_lengkap||'').toLowerCase().includes(q))&&(!kolom||String(j.kolom)===String(kolom))&&(!lp||j.lp===lp)).sort((a,b)=>(a.kolom||0)-(b.kolom||0));
  }
  const data=sumber.map((j,i)=>({'No':i+1,'Kolom':j.kolom||'','Nama Lengkap':j.nama_lengkap||'','L/P':j.lp||'','Tempat Lahir':j.tempat_lahir||'','Tanggal Lahir':formatTanggal(j.tanggal_lahir),'Umur':hitungUmur(j.tanggal_lahir),'Pekerjaan':j.pekerjaan||'','Baptis':j.baptis==='sudah-baptis'?'Sudah Baptis':'Belum Baptis','Sidi':j.sidi==='sudah-sidi'?'Sudah Sidi':'Belum Sidi','Nama Keluarga':j.nama_keluarga||'','No KK':j.no_kk||'','Relasi':j.relasi||'','Kategori':j.bipra||'','Lansia':j.lansia==='lansia'?'Lansia':'','Alamat':j.alamat_rumah||'','Status':j.status_jemaat==='baru'?'Jemaat Baru':'Jemaat Lama'}));
  if (!data.length){alert('Tidak ada data');return;}
  const ws=XLSX.utils.json_to_sheet(data);ws['!cols']=Object.keys(data[0]).map(k=>({wch:Math.max(k.length,...data.map(r=>String(r[k]||'').length))+2}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,namaFile.replace(/_/g,' '));
  XLSX.writeFile(wb,`${namaFile}_${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.xlsx`);
}

// ===== UTILS =====
function showToast(msg,type='success'){const t=document.getElementById('toast');t.textContent=msg;t.className=`toast ${type} show`;setTimeout(()=>t.classList.remove('show'),3000);}
function printTable(){window.print();}


// ===== LAMPIRAN PENGUMUMAN =====
document.addEventListener('DOMContentLoaded', () => {
  const lampiranFile = document.getElementById('pLampiranFile');
  if (lampiranFile) {
    lampiranFile.addEventListener('change', function() {
      const file = this.files[0]; if (!file) return;
      if (file.size > 10*1024*1024) { showToast('Ukuran file maks 10MB', 'error'); this.value=''; return; }
      document.getElementById('pLampiranNama').textContent = '📎 ' + file.name;
      document.getElementById('pLampiranInfo').style.display = 'flex';
      document.getElementById('pLampiranNamaAsli').value = file.name;
    });
  }
  const bFotoFile = document.getElementById('bFotoFile');
  if (bFotoFile) {
    bFotoFile.addEventListener('change', function() {
      const file = this.files[0]; if (!file) return;
      if (file.size > 5*1024*1024) { showToast('Ukuran foto maks 5MB', 'error'); this.value=''; return; }
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 800; let w = img.width, h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          document.getElementById('bFotoImg').src = compressed;
          document.getElementById('bFotoPreview').style.display = 'block';
          document.getElementById('bFotoUrl').value = compressed;
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
});

function hapusLampiranPengumuman() {
  document.getElementById('pLampiranFile').value = '';
  document.getElementById('pLampiranInfo').style.display = 'none';
  document.getElementById('pLampiranUrl').value = '';
  document.getElementById('pLampiranNamaAsli').value = '';
}

async function uploadLampiran(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `pengumuman/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const { data, error } = await sb.storage.from('Dokumen').upload(fileName, file, { upsert: true });
  if (error) { showToast('Gagal upload lampiran: ' + error.message, 'error'); return null; }
  const { data: urlData } = sb.storage.from('Dokumen').getPublicUrl(fileName);
  return urlData.publicUrl;
}

// ===== PENGUMUMAN (override dengan lampiran) =====
async function savePengumuman() {
  const id = document.getElementById('pengumumanEditId').value;
  const judul = document.getElementById('pJudul').value.trim();
  const isi = document.getElementById('pIsi').value.trim();
  if (!judul || !isi) { showToast('Judul dan isi wajib diisi', 'error'); return; }

  let lampiranUrl = document.getElementById('pLampiranUrl').value || null;
  let lampiranNama = document.getElementById('pLampiranNamaAsli').value || null;
  const lampiranFile = document.getElementById('pLampiranFile').files[0];

  // Upload lampiran baru jika ada
  if (lampiranFile) {
    document.getElementById('pUploadProgress').style.display = 'block';
    document.getElementById('pUploadBar').style.width = '40%';
    document.getElementById('pUploadText').textContent = 'Mengupload lampiran...';
    lampiranUrl = await uploadLampiran(lampiranFile);
    lampiranNama = lampiranFile.name;
    document.getElementById('pUploadBar').style.width = '100%';
    if (!lampiranUrl) { document.getElementById('pUploadProgress').style.display = 'none'; return; }
  }

  const payload = {
    judul, isi,
    tanggal_mulai: document.getElementById('pMulai').value || null,
    tanggal_selesai: document.getElementById('pSelesai').value || null,
    aktif: document.getElementById('pAktif').value === 'true',
    dibuat_oleh: currentUser?.username || '-',
    lampiran_url: lampiranUrl,
    lampiran_nama: lampiranNama
  };

  const result = id
    ? await sbAdmin.from('pengumuman').update(payload).eq('id', id)
    : await sbAdmin.from('pengumuman').insert(payload);

  document.getElementById('pUploadProgress').style.display = 'none';
  if (result.error) { showToast('Gagal simpan: ' + result.error.message, 'error'); return; }
  showToast('Pengumuman berhasil disimpan ✅', 'success');
  closeModalPengumuman(); loadPengumumanAdmin();
}

// Override openModalPengumuman untuk reset lampiran
const _origOpenModalPengumuman = openModalPengumuman;
function openModalPengumuman(data = null) {
  document.getElementById('pengumumanEditId').value = data ? data.id : '';
  document.getElementById('pengumumanModalTitle').textContent = data ? 'Edit Pengumuman' : 'Tambah Pengumuman';
  document.getElementById('pJudul').value = data ? data.judul || '' : '';
  document.getElementById('pIsi').value = data ? data.isi || '' : '';
  document.getElementById('pMulai').value = data ? data.tanggal_mulai || '' : '';
  document.getElementById('pSelesai').value = data ? data.tanggal_selesai || '' : '';
  document.getElementById('pAktif').value = data ? String(data.aktif) : 'true';
  document.getElementById('pLampiranFile').value = '';
  document.getElementById('pLampiranUrl').value = data ? data.lampiran_url || '' : '';
  document.getElementById('pLampiranNamaAsli').value = data ? data.lampiran_nama || '' : '';
  document.getElementById('pUploadProgress').style.display = 'none';
  if (data && data.lampiran_nama) {
    document.getElementById('pLampiranNama').textContent = '📎 ' + data.lampiran_nama;
    document.getElementById('pLampiranInfo').style.display = 'flex';
  } else {
    document.getElementById('pLampiranInfo').style.display = 'none';
  }
  document.getElementById('modalPengumuman').classList.add('open');
}

// Override loadPengumumanAdmin untuk tampilkan lampiran
async function loadPengumumanAdmin() {
  const { data } = await sb.from('pengumuman').select('*').order('created_at', { ascending: false });
  const el = document.getElementById('pengumumanAdminList');
  if (!data || !data.length) { el.innerHTML = '<div style="color:var(--text-muted);padding:32px;text-align:center">Belum ada pengumuman</div>'; return; }
  el.innerHTML = data.map(p => `
    <div class="peng-admin-card">
      <div class="peng-admin-title">${p.judul || ''}</div>
      <div class="peng-admin-isi">${p.isi || ''}</div>
      ${p.lampiran_url ? `<div style="margin-top:10px"><a class="lampiran-link" href="${p.lampiran_url}" target="_blank">📎 ${p.lampiran_nama || 'Lihat Lampiran'}</a></div>` : ''}
      <div class="peng-admin-meta">
        <span>${p.tanggal_mulai ? '📅 ' + formatTanggal(p.tanggal_mulai) : ''}</span>
        <span>${p.tanggal_selesai ? 's/d ' + formatTanggal(p.tanggal_selesai) : ''}</span>
        <span style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;${p.aktif ? 'background:#d1fae5;color:#065f46' : 'background:#fee2e2;color:#991b1b'}">${p.aktif ? '✅ Aktif' : '❌ Nonaktif'}</span>
        <div style="margin-left:auto;display:flex;gap:6px">
          ${isSuperAdmin() ? `<button class="btn btn-outline btn-sm" onclick="editPengumuman(${p.id})">✏️ Edit</button><button class="btn btn-danger btn-sm" onclick="deletePengumuman(${p.id})">🗑️</button>` : ''}
        </div>
      </div>
    </div>`).join('');
}

// Override loadPubPengumuman untuk tampilkan lampiran
async function loadPubPengumuman() {
  const { data } = await sb.from('pengumuman').select('*').eq('aktif', true).not('judul','like','_%').order('created_at', { ascending: false }).limit(10);
  const el = document.getElementById('pubPengumumanList');
  if (!el) return;
  if (!data || !data.length) { el.innerHTML = '<div style="color:var(--text-muted)">Belum ada pengumuman</div>'; return; }
  el.innerHTML = data.map(p => `
    <div class="peng-card">
      <div class="peng-title">${p.judul || ''}</div>
      <div class="peng-isi">${p.isi || ''}</div>
      ${p.lampiran_url ? `<div style="margin-top:10px"><a class="lampiran-link" href="${p.lampiran_url}" target="_blank" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:var(--accent-light)">📎 ${p.lampiran_nama || 'Lihat Lampiran'}</a></div>` : ''}
      <div class="peng-tgl">${p.tanggal_mulai ? '📅 ' + formatTanggal(p.tanggal_mulai) : ''} ${p.tanggal_selesai ? ' s/d ' + formatTanggal(p.tanggal_selesai) : ''}</div>
    </div>`).join('');
}

// ===== BERITA =====
async function loadBeritaAdmin() {
  const { data } = await sb.from('berita').select('*').order('created_at', { ascending: false });
  const el = document.getElementById('beritaAdminList');
  const bar = document.getElementById('beritaAdminBar');
  if (bar) bar.style.display = isSuperAdmin() ? 'block' : 'none';
  if (!data || !data.length) { el.innerHTML = '<div style="color:var(--text-muted);padding:32px;text-align:center">Belum ada berita. Klik "+ Tulis Berita" untuk menambahkan.</div>'; return; }
  const katIcon = { kegiatan:'⛪', sosial:'🤝', pengembangan:'🏗️', informasi:'ℹ️', lainnya:'📌' };
  const katLabel = { kegiatan:'Kegiatan Ibadah', sosial:'Kegiatan Sosial', pengembangan:'Pengembangan', informasi:'Informasi Umum', lainnya:'Lainnya' };
  el.innerHTML = data.map(b => `
    <div class="berita-admin-card">
      ${b.foto_url ? `<img class="ba-foto" src="${b.foto_url}" alt="${b.judul}" onerror="this.style.display='none'">` : `<div class="ba-foto-ph">📰</div>`}
      <div class="ba-body">
        <div class="ba-kat">${katIcon[b.kategori] || '📌'} ${katLabel[b.kategori] || b.kategori || '-'}</div>
        <div class="ba-judul">${b.judul || ''}</div>
        <div class="ba-isi">${(b.isi || '').substring(0, 150)}${(b.isi || '').length > 150 ? '...' : ''}</div>
        <div class="ba-meta">
          <span>✍️ ${b.ditulis_oleh || '-'}</span>
          <span>📅 ${new Date(b.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</span>
          <span style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;${b.aktif ? 'background:#d1fae5;color:#065f46' : 'background:#fee2e2;color:#991b1b'}">${b.aktif ? '✅ Aktif' : '❌ Tersembunyi'}</span>
          <div style="margin-left:auto;display:flex;gap:6px">
            ${isSuperAdmin() ? `<button class="btn btn-outline btn-sm" onclick="editBerita(${b.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="deleteBerita(${b.id})">🗑️</button>` : ''}
          </div>
        </div>
      </div>
    </div>`).join('');
}

async function loadPubBerita() {
  const el = document.getElementById('pubBeritaList');
  if (!el) return;
  const data = await sbFetch('berita', 'aktif=eq.true&order=created_at.desc&limit=20');
  if (!data.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Belum ada berita</div>'; return; }
  const katIcon = { kegiatan:'⛪', sosial:'🤝', pengembangan:'🏗️', informasi:'ℹ️', lainnya:'📌' };
  const katLabel = { kegiatan:'Kegiatan Ibadah', sosial:'Kegiatan Sosial', pengembangan:'Pengembangan', informasi:'Informasi Umum', lainnya:'Lainnya' };
  el.innerHTML = data.map(b => {
    const stripped = (b.isi||'').replace(/<[^>]+>/g,'');
    const preview = stripped.length > 120 ? stripped.substring(0,120)+'...' : stripped;
    return `
    <div class="berita-pub-card" onclick="openBeritaDetail(${b.id})">
      ${b.foto_url ? `<img class="bp-foto" src="${b.foto_url}" alt="${b.judul}" onerror="this.style.display='none'">` : ''}
      <div class="bp-body">
        <div class="bp-kat">${katIcon[b.kategori]||'📌'} ${katLabel[b.kategori]||b.kategori||'-'}</div>
        <div class="bp-judul">${b.judul||''}</div>
        <div class="bp-isi">${preview}</div>
        <span class="bp-baca">Baca selengkapnya →</span>
        <div class="bp-tgl">✍️ ${b.ditulis_oleh||'-'} &nbsp;·&nbsp; 📅 ${new Date(b.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</div>
      </div>
    </div>`;
  }).join('');
}

// ===== BERITA DETAIL =====
let _beritaCache = {};

async function openBeritaDetail(id) {
  document.getElementById('beritaDetailOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  const box = document.getElementById('beritaDetailBox');
  box.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted)">Memuat...</div>';

  // Fetch berita
  let b = _beritaCache[id];
  if (!b) {
    const res = await sbFetch('berita', `id=eq.${id}&limit=1`);
    b = res[0]; _beritaCache[id] = b;
  }
  if (!b) { box.innerHTML='<div style="padding:40px;text-align:center">Berita tidak ditemukan</div>'; return; }

  const katIcon = { kegiatan:'⛪', sosial:'🤝', pengembangan:'🏗️', informasi:'ℹ️', lainnya:'📌' };
  const katLabel = { kegiatan:'Kegiatan Ibadah', sosial:'Kegiatan Sosial', pengembangan:'Pengembangan', informasi:'Informasi Umum', lainnya:'Lainnya' };

  // Load reactions
  const reactions = JSON.parse(localStorage.getItem('berita_reactions')||'{}');
  const myReaction = reactions[id] || null;

  // Load comments dari Supabase (tabel aspirasi digunakan, kategori=berita_komentar)
  let komentar = [];
  try {
    komentar = await sbFetch('aspirasi', `kategori=eq.berita_${id}&order=created_at.asc`);
  } catch(e){}

  // Like/dislike counts dari localStorage (simple client-side)
  const likes = parseInt(localStorage.getItem(`bl_${id}`)||'0');
  const dislikes = parseInt(localStorage.getItem(`bd_${id}`)||'0');

  box.innerHTML = `
    ${b.foto_url?`<img class="berita-detail-foto" src="${b.foto_url}" alt="${b.judul}">`:''}
    <div class="berita-detail-body">
      <div class="berita-detail-kat">${katIcon[b.kategori]||'📌'} ${katLabel[b.kategori]||b.kategori||'-'}</div>
      <div class="berita-detail-judul">${b.judul||''}</div>
      <div class="berita-detail-meta">
        <span>✍️ ${b.ditulis_oleh||'BPMJ'}</span>
        <span>📅 ${new Date(b.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</span>
      </div>
      <div class="berita-detail-isi">${b.isi||''}</div>

      <!-- LIKE / DISLIKE -->
      <div class="berita-reaction-bar">
        <button class="btn-reaction ${myReaction==='like'?'liked':''}" onclick="reactBerita(${id},'like')" id="btnLike${id}">
          👍 Suka &nbsp;<span id="likeCount${id}">${likes}</span>
        </button>
        <button class="btn-reaction ${myReaction==='dislike'?'disliked':''}" onclick="reactBerita(${id},'dislike')" id="btnDislike${id}">
          👎 Tidak Suka &nbsp;<span id="dislikeCount${id}">${dislikes}</span>
        </button>
        <span class="reaction-count">💬 ${komentar.length} komentar</span>
      </div>

      <!-- KOMENTAR -->
      <div class="komentar-section">
        <h4>💬 Komentar</h4>
        <div class="komentar-input-wrap">
          <input type="text" id="komNama${id}" placeholder="Nama Anda (wajib)" maxlength="60">
          <textarea id="komIsi${id}" placeholder="Tulis komentar..."></textarea>
          <button class="btn btn-primary" style="width:fit-content" onclick="kirimKomentar(${id})">📤 Kirim Komentar</button>
        </div>
        <div id="komentarList${id}">
          ${komentar.length===0?'<div class="komentar-empty">Belum ada komentar. Jadilah yang pertama!</div>':
            komentar.map(k=>`
              <div class="komentar-item">
                <span class="komentar-nama">${k.nama||'Anonim'}</span>
                <span class="komentar-waktu">${new Date(k.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span>
                <div class="komentar-isi">${k.isi||''}</div>
              </div>`).join('')
          }
        </div>
      </div>
    </div>`;
}

function closeBeritaDetail() {
  document.getElementById('beritaDetailOverlay').classList.remove('open');
  document.body.style.overflow='';
}

function reactBerita(id, type) {
  const reactions = JSON.parse(localStorage.getItem('berita_reactions')||'{}');
  const prev = reactions[id];
  if (prev === type) return; // already reacted

  let likes = parseInt(localStorage.getItem(`bl_${id}`)||'0');
  let dislikes = parseInt(localStorage.getItem(`bd_${id}`)||'0');

  if (prev === 'like') likes = Math.max(0, likes-1);
  if (prev === 'dislike') dislikes = Math.max(0, dislikes-1);
  if (type === 'like') likes++;
  if (type === 'dislike') dislikes++;

  localStorage.setItem(`bl_${id}`, likes);
  localStorage.setItem(`bd_${id}`, dislikes);
  reactions[id] = type;
  localStorage.setItem('berita_reactions', JSON.stringify(reactions));

  document.getElementById(`likeCount${id}`).textContent = likes;
  document.getElementById(`dislikeCount${id}`).textContent = dislikes;
  document.getElementById(`btnLike${id}`).className = 'btn-reaction'+(type==='like'?' liked':'');
  document.getElementById(`btnDislike${id}`).className = 'btn-reaction'+(type==='dislike'?' disliked':'');
  showToast(type==='like'?'Terima kasih! 👍':'Terima kasih atas masukannya! 👎','success');
}

async function kirimKomentar(id) {
  const nama = document.getElementById(`komNama${id}`).value.trim();
  const isi = document.getElementById(`komIsi${id}`).value.trim();
  if (!nama) { showToast('Nama wajib diisi','error'); return; }
  if (!isi) { showToast('Komentar wajib diisi','error'); return; }

  const payload = { nama, isi, kategori:`berita_${id}`, kolom:null, status:'baru', dibuat_oleh:'publik' };
  const { error } = await sb.from('aspirasi').insert(payload);
  if (error) { showToast('Gagal mengirim komentar','error'); return; }

  showToast('Komentar berhasil dikirim! ✅','success');
  document.getElementById(`komNama${id}`).value='';
  document.getElementById(`komIsi${id}`).value='';

  // Refresh komentar
  const komentar = await sbFetch('aspirasi', `kategori=eq.berita_${id}&order=created_at.asc`);
  const el = document.getElementById(`komentarList${id}`);
  if (el) el.innerHTML = komentar.map(k=>`
    <div class="komentar-item">
      <span class="komentar-nama">${k.nama||'Anonim'}</span>
      <span class="komentar-waktu">${new Date(k.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span>
      <div class="komentar-isi">${k.isi||''}</div>
    </div>`).join('');
}

function openModalBerita(data = null) {
  document.getElementById('beritaEditId').value = data ? data.id : '';
  document.getElementById('beritaModalTitle').textContent = data ? 'Edit Berita' : 'Tulis Berita Baru';
  document.getElementById('bJudul').value = data ? data.judul || '' : '';
  document.getElementById('bKategori').value = data ? data.kategori || 'kegiatan' : 'kegiatan';
  document.getElementById('bAktif').value = data ? String(data.aktif) : 'true';
  document.getElementById('bFotoUrl').value = data ? data.foto_url || '' : '';
  document.getElementById('bFotoFile').value = '';
  if (data && data.foto_url) {
    document.getElementById('bFotoImg').src = data.foto_url;
    document.getElementById('bFotoPreview').style.display = 'block';
  } else {
    document.getElementById('bFotoPreview').style.display = 'none';
  }
  // Set Quill content
  if (window._quillBerita) {
    window._quillBerita.root.innerHTML = data ? (data.isi || '') : '';
  }
  document.getElementById('modalBerita').classList.add('open');
  // Init Quill jika belum
  if (!window._quillBerita) {
    window._quillBerita = new Quill('#bIsiEditor', {
      theme: 'snow',
      placeholder: 'Tulis isi berita di sini...',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['link'],
          ['clean']
        ]
      }
    });
    if (data && data.isi) window._quillBerita.root.innerHTML = data.isi || '';
  }
}

function closeModalBerita() { document.getElementById('modalBerita').classList.remove('open'); }

async function editBerita(id) {
  const { data } = await sb.from('berita').select('*').eq('id', id).single();
  if (data) openModalBerita(data);
}

async function deleteBerita(id) {
  if (!confirm('Hapus berita ini?')) return;
  await sbAdmin.from('berita').delete().eq('id', id);
  showToast('Berita dihapus', 'success'); loadBeritaAdmin();
}

async function saveBerita() {
  const id = document.getElementById('beritaEditId').value;
  const judul = document.getElementById('bJudul').value.trim();
  const isi = window._quillBerita ? window._quillBerita.root.innerHTML.trim() : document.getElementById('bIsi').value.trim();
  const isiText = window._quillBerita ? window._quillBerita.getText().trim() : isi;
  if (!judul || !isiText) { showToast('Judul dan isi wajib diisi', 'error'); return; }
  const payload = {
    judul, isi,
    kategori: document.getElementById('bKategori').value,
    foto_url: document.getElementById('bFotoUrl').value || null,
    aktif: document.getElementById('bAktif').value === 'true',
    ditulis_oleh: currentUser?.username || '-'
  };
  const result = id
    ? await sbAdmin.from('berita').update(payload).eq('id', id)
    : await sbAdmin.from('berita').insert(payload);
  if (result.error) { showToast('Gagal simpan: ' + result.error.message, 'error'); return; }
  showToast('Berita berhasil disimpan ✅', 'success');
  await kirimNotifikasiEmail(id?'edit':'tambah','Berita',`${id?'Edit':'Tambah'} Berita: "${judul}" (${payload.kategori})`);
  closeModalBerita(); loadBeritaAdmin();
}


// ===== PUBLIC NAV SECTION =====
function switchPubSection(sec, el) {
  document.querySelectorAll('.pub-nav-link').forEach(a => a.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('[id^="pub-section-"]').forEach(d => d.style.display = 'none');
  const target = document.getElementById('pub-section-' + sec);
  if (target) target.style.display = 'block';
  if (sec === 'bpmj') loadPubStruktur('bpmj');
  if (sec === 'pelayan') loadPubStruktur('pelayan');
  if (sec === 'komisi') loadPubStruktur('komisi');
  if (sec === 'aspirasi') loadPubAspirasi();
  if (sec === 'warta') loadPubWarta();
  if (sec === 'pengumuman-full') loadPubPengumuman();
  if (sec === 'home') { loadPubPengumumanRingkasan(); loadPubWartaBeranda(); }
  if (sec === 'video') loadPubVideo();
}

async function loadPubWartaBeranda() {
  const el = document.getElementById('pubWartaGridBeranda');
  if (!el) return;
  el.innerHTML = '<div class="pub-loading" style="grid-column:1/-1">Memuat warta jemaat...</div>';
  try {
    const { data } = await sb.from('warta_jemaat').select('*').order('slot').limit(WARTA_SLOTS);
    const slotData = {};
    (data || []).forEach(w => { slotData[w.slot] = w; });
    let html = '';
    for (let i = 1; i <= WARTA_SLOTS; i++) {
      const w = slotData[i];
      const ket = (w && w.keterangan) ? w.keterangan : `Warta ${i}`;
      if (w && w.foto_url) {
        html += `<div class="warta-box" onclick="openWartaLightbox('${w.foto_url}')">
          <img src="${w.foto_url}" alt="${ket}">
          <div class="warta-badge">📋 ${i}</div>
          <div class="warta-zoom-hint">🔍 Klik untuk perbesar</div>
          ${w.pdf_url ? `<a class="warta-pdf-btn" href="${w.pdf_url}" target="_blank" download onclick="event.stopPropagation()">📥 Download PDF</a>` : ''}
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:8px 10px 6px;font-size:11px;color:white;font-weight:600;text-align:center;pointer-events:none">${ket}</div>
        </div>`;
      } else {
        html += `<div class="warta-box" style="cursor:default">
          <div class="warta-empty">
            <div class="warta-icon">📋</div>
            <span style="font-weight:600;color:var(--text-muted)">${ket}</span>
            <span style="font-size:11px">Belum tersedia</span>
          </div>
          <div class="warta-badge">📋 ${i}</div>
        </div>`;
      }
    }
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:32px">Gagal memuat warta jemaat</div>';
  }
}

async function loadSidebarData() {
  const today = new Date();
  const todayM = today.getMonth(), todayD = today.getDate();

  // Load langsung dari Supabase - tidak bergantung allJemaat
  const elHari = document.getElementById('sideUltahHari');
  if (elHari) elHari.innerHTML = '<div style="color:var(--text-muted);font-size:12px">Memuat...</div>';

  try {
    const { data: jemaatData } = await sb.from('jemaat')
      .select('nama_lengkap,tanggal_lahir,kolom,lp')
      .order('kolom');

    const dataUntuk = jemaatData || allJemaat || [];
    const hariIni = [], mingguIni = [];
    console.log('SidebarData: loaded', dataUntuk.length, 'jemaat, today=', todayM+1, '/', todayD);
    if (dataUntuk.length > 0) console.log('Sample:', dataUntuk[0].nama_lengkap, dataUntuk[0].tanggal_lahir);

    dataUntuk.forEach(j => {
      if (!j.tanggal_lahir) return;
      const d = parseTanggal(j.tanggal_lahir); if (!d || isNaN(d)) return;
      const bm = d.getMonth(), bd = d.getDate();
      if (bm === todayM && bd === todayD) {
        hariIni.push({...j});
      } else {
        const thisYear = new Date(today.getFullYear(), bm, bd);
        const diff = Math.ceil((thisYear - new Date(today.getFullYear(), todayM, todayD)) / (1000*60*60*24));
        if (diff > 0 && diff <= 7) mingguIni.push({...j, diff});
      }
    });
    mingguIni.sort((a,b) => a.diff - b.diff);

    // Simpan untuk modal
    window._ultahMinggu = mingguIni;
    if (jemaatData) {
      window._ultahBulan = jemaatData.filter(j => {
        if (!j.tanggal_lahir) return false;
        const d = parseTanggal(j.tanggal_lahir); if (!d||isNaN(d)) return false;
        return d.getMonth() === todayM;
      }).sort((a,b) => parseTanggal(a.tanggal_lahir).getDate() - parseTanggal(b.tanggal_lahir).getDate());
    }

    console.log('hariIni:', hariIni.length, hariIni.map(j=>j.nama_lengkap));
    const elHari = document.getElementById('sideUltahHari');
  if (elHari) {
    if (hariIni.length) {
      elHari.innerHTML = hariIni.map(j => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--border)">
          <span style="font-size:20px">🎂</span>
          <div style="flex:1">
            <div style="font-weight:700;color:var(--primary);font-size:13px;line-height:1.3">${j.nama_lengkap}</div>
            <div style="font-size:11px;color:var(--accent);font-weight:600">🎉 Selamat Ulang Tahun! · Kolom ${j.kolom}</div>
          </div>
        </div>`).join('') + `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;text-align:center">${hariIni.length} jemaat berulang tahun hari ini</div>`;
    } else {
      elHari.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Tidak ada hari ini</div>';
    }
  }
  // Simpan data untuk modal
  window._ultahMinggu = mingguIni;
  window._ultahBulan = allJemaat.filter(j => {
    if (!j.tanggal_lahir) return false;
    const d = parseTanggal(j.tanggal_lahir); if (!d||isNaN(d)) return false;
    return d.getMonth() === today.getMonth();
  }).sort((a,b) => parseTanggal(a.tanggal_lahir).getDate() - parseTanggal(b.tanggal_lahir).getDate());

  } catch(e) {
    console.error('loadSidebarData error:', e.message);
  }

  // Info jemaat
  const elInfo = document.getElementById('sideInfoJemaat');
  if (elInfo && allJemaat.length) {
    const total = allJemaat.length;
    const l = allJemaat.filter(j => j.lp==='L').length;
    const p = allJemaat.filter(j => j.lp==='P').length;
    const lansia = allJemaat.filter(j => j.lansia==='lansia').length;
    const kols = [...new Set(allJemaat.map(j=>j.kolom).filter(Boolean))].length;
    elInfo.innerHTML = `
      <div class="pub-info-row"><span class="pub-info-label">Total Jemaat</span><span class="pub-info-val">${total}</span></div>
      <div class="pub-info-row"><span class="pub-info-label">👦 Laki-laki</span><span class="pub-info-val">${l}</span></div>
      <div class="pub-info-row"><span class="pub-info-label">👧 Perempuan</span><span class="pub-info-val">${p}</span></div>
      <div class="pub-info-row"><span class="pub-info-label">👴 Lansia</span><span class="pub-info-val">${lansia}</span></div>
      <div class="pub-info-row"><span class="pub-info-label">⛪ Jumlah Kolom</span><span class="pub-info-val">${kols}</span></div>`;
  }
}

// Kehadiran & info dimuat terpisah (tidak perlu tunggu jemaat)
async function loadSidebarKehadiran() {
  const elKh = document.getElementById('sideKehadiran');
  if (!elKh) return;
  try {
    const { data, error } = await sb.from('kehadiran_ibadah')
      .select('tanggal,sesi,laki_laki,perempuan,kadim,pundi_persembahan,pundi_diakonia,pundi_pembangunan,pundi_ekstra')
      .order('tanggal', {ascending:false})
      .limit(4);
    if (error || !data || !data.length) {
      elKh.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Belum ada data</div>';
      return;
    }
    const sesiIcon = {subuh:'🌅', pagi:'☀️', malam:'🌙'};
    elKh.innerHTML = data.map(d => {
      const totLainnya = 0;
      let lainnyaHtml = '';
      return `
      <div style="padding:6px 0;border-bottom:1px dashed var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:13px;font-weight:600;color:var(--primary)">${sesiIcon[d.sesi]||''} ${d.sesi}</span>
          <span style="font-size:11px;color:var(--text-muted)">${formatTanggal(d.tanggal)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:11px">
          <div style="background:#dbeafe;border-radius:4px;padding:3px 6px;text-align:center">
            <div style="color:#1e40af;font-weight:700">${d.laki_laki||0}</div>
            <div style="color:#60a5fa">L</div>
          </div>
          <div style="background:#fce7f3;border-radius:4px;padding:3px 6px;text-align:center">
            <div style="color:#9d174d;font-weight:700">${d.perempuan||0}</div>
            <div style="color:#f472b6">P</div>
          </div>
          <div style="background:var(--accent-light);border-radius:4px;padding:3px 6px;text-align:center">
            <div style="color:var(--primary);font-weight:700">${(d.laki_laki||0)+(d.perempuan||0)}</div>
            <div style="color:var(--accent)">Tot</div>
          </div>
        </div>
        ${d.kadim ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">👤 Kadim: ${d.kadim}</div>` : ''}
        <div style="margin-top:6px;padding-top:5px;border-top:1px dashed var(--border)">
          <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px">Persembahan</div>
          ${d.pundi_persembahan ? `<div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between"><span>🙏 Persembahan</span><span style="font-weight:600;color:var(--primary)">${Number(d.pundi_persembahan).toLocaleString('id-ID')}</span></div>` : ''}
          ${d.pundi_diakonia ? `<div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between"><span>🤝 Diakonia</span><span style="font-weight:600;color:var(--primary)">${Number(d.pundi_diakonia).toLocaleString('id-ID')}</span></div>` : ''}
          ${d.pundi_pembangunan ? `<div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between"><span>🏗️ Pembangunan</span><span style="font-weight:600;color:var(--primary)">${Number(d.pundi_pembangunan).toLocaleString('id-ID')}</span></div>` : ''}
          ${d.pundi_ekstra ? `<div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between"><span>➕ Ekstra</span><span style="font-weight:600;color:var(--primary)">${Number(d.pundi_ekstra).toLocaleString('id-ID')}</span></div>` : ''}
          ${lainnyaHtml}
          <div style="font-size:11px;display:flex;justify-content:space-between;margin-top:3px;padding-top:3px;border-top:1px solid var(--border)">
            <span style="font-weight:700;color:var(--primary)">Total Pundi</span>
            <span style="font-weight:700;color:var(--accent)">${Number((d.pundi_persembahan||0)+(d.pundi_diakonia||0)+(d.pundi_pembangunan||0)+(d.pundi_ekstra||0)+totLainnya).toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    elKh.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Belum ada data</div>';
  }
}
// ===== MODAL ULANG TAHUN PUBLIK =====
function showUltahModal(mode) {
  const isMinggu = mode === 'minggu';
  const title = isMinggu ? '📅 Ulang Tahun Minggu Ini' : '🗓️ Ulang Tahun Bulan Ini';

  // Hitung langsung dari allJemaat
  const today = new Date();
  const todayM = today.getMonth(), todayD = today.getDate();
  let list = [];

  allJemaat.forEach(j => {
    if (!j.tanggal_lahir) return;
    const d = parseTanggal(j.tanggal_lahir);
    if (!d || isNaN(d)) return;
    const bm = d.getMonth(), bd = d.getDate();
    const thisYear = new Date(today.getFullYear(), bm, bd);
    const diff = Math.ceil((thisYear - today) / (1000*60*60*24));
    if (isMinggu) {
      if ((bm === todayM && bd === todayD) || (diff > 0 && diff <= 7))
        list.push({...j, diff: bm===todayM&&bd===todayD ? 0 : diff});
    } else {
      if (bm === todayM) list.push({...j, diff: bm===todayM&&bd===todayD ? 0 : diff, bd});
    }
  });
  list.sort((a,b) => (a.bd||0)-(b.bd||0) || a.diff-b.diff);

  // Buat modal dinamis
  let modal = document.getElementById('modalUltahPub');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalUltahPub';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.onclick = e => { if(e.target===modal) modal.remove(); };
    document.body.appendChild(modal);
  }

  const rows = list.length ? list.map(j => {
    const d = parseTanggal(j.tanggal_lahir);
    const tgl = d ? `${String(d.getDate()).padStart(2,'0')} ${namaBulan[d.getMonth()]}` : '-';
    const diff = j.diff !== undefined ? (j.diff===0?'<span style="color:#dc2626;font-weight:700">Hari ini!</span>':`<span style="color:var(--success)">${j.diff} hari lagi</span>`) : '';
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${tgl}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:600">${j.nama_lengkap||'-'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:var(--text-muted)">Kol. ${j.kolom||'-'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${diff}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--text-muted)">Tidak ada data</td></tr>';

  modal.innerHTML = `
    <div style="background:white;border-radius:14px;width:100%;max-width:580px;max-height:85vh;overflow-y:auto;padding:24px;box-shadow:0 24px 64px rgba(0,0,0,0.3)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="font-family:'Playfair Display',serif;font-size:20px;color:var(--primary)">${title}</h2>
        <button onclick="document.getElementById('modalUltahPub').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text-muted)">×</button>
      </div>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">${list.length} jemaat</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead style="background:var(--primary);color:white">
          <tr>
            <th style="padding:8px 10px;text-align:left">Tanggal</th>
            <th style="padding:8px 10px;text-align:left">Nama</th>
            <th style="padding:8px 10px;text-align:left">Kolom</th>
            <th style="padding:8px 10px;text-align:left">Keterangan</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ===== WARTA JEMAAT =====
const WARTA_SLOTS = 4;

async function loadPubWarta() {
  const el = document.getElementById('pubWartaGrid');
  if (!el) return;
  el.innerHTML = '<div class="pub-loading" style="grid-column:1/-1">Memuat warta jemaat...</div>';
  try {
    const { data } = await sb.from('warta_jemaat').select('*').order('slot').limit(WARTA_SLOTS);
    const slotData = {};
    (data || []).forEach(w => { slotData[w.slot] = w; });
    let html = '';
    for (let i = 1; i <= WARTA_SLOTS; i++) {
      const w = slotData[i];
      const ket = (w && w.keterangan) ? w.keterangan : `Warta ${i}`;
      if (w && w.foto_url) {
        html += `<div class="warta-box" onclick="openWartaLightbox('${w.foto_url}')">
          <img src="${w.foto_url}" alt="${ket}" onerror="this.parentElement.innerHTML='<div class=\\'warta-empty\\'><div class=\\'warta-icon\\'>📋</div><span>${ket}</span></div>'">
          <div class="warta-badge">📋 ${i}</div>
          <div class="warta-zoom-hint">🔍 Klik untuk perbesar</div>
          ${w.pdf_url ? `<a class="warta-pdf-btn" href="${w.pdf_url}" target="_blank" download onclick="event.stopPropagation()">📥 Download PDF</a>` : ''}
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:8px 10px 6px;font-size:11px;color:white;font-weight:600;text-align:center;pointer-events:none">${ket}</div>
        </div>`;
      } else {
        html += `<div class="warta-box" style="cursor:default">
          <div class="warta-empty">
            <div class="warta-icon">📋</div>
            <span style="font-weight:600;color:var(--text-muted)">${ket}</span>
            <span style="font-size:11px">Belum tersedia</span>
          </div>
          <div class="warta-badge">📋 ${i}</div>
        </div>`;
      }
    }
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:32px">Gagal memuat warta jemaat</div>';
  }
}

function openWartaLightbox(url) {
  const lb = document.getElementById('wartaLightbox');
  const img = document.getElementById('wartaLightboxImg');
  if (!lb || !img) return;
  img.src = url;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeWartaLightbox() {
  const lb = document.getElementById('wartaLightbox');
  if (!lb) return;
  lb.classList.remove('open');
  document.body.style.overflow = '';
}

// Keyboard close for lightbox
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeWartaLightbox();
});

// Pengumuman Ringkasan (tampilan beranda - hanya judul)
async function loadPubPengumumanRingkasan() {
  const el = document.getElementById('pubPengumumanRingkasanList');
  if (!el) return;
  el.innerHTML = '<div class="pub-loading">Memuat...</div>';
  try {
    const { data } = await sb.from('pengumuman').select('id,judul,tanggal_mulai').eq('aktif', true).not('judul','like','_%').order('created_at', { ascending: false }).limit(4);
    if (!data || !data.length) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Belum ada pengumuman</div>';
      return;
    }
    el.innerHTML = data.map(p => `
      <div class="peng-ringkasan-card" onclick="goPengumumanFull()">
        <span class="pr-icon">📢</span>
        <span class="pr-title">${p.judul || 'Pengumuman'}</span>
        <span class="pr-date">${p.tanggal_mulai ? new Date(p.tanggal_mulai).toLocaleDateString('id-ID', { day:'2-digit', month:'short' }) : ''}</span>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Gagal memuat</div>';
  }
}

function goHomeSection() {
  document.querySelectorAll('[id^="pub-section-"]').forEach(d => d.style.display = 'none');
  const t = document.getElementById('pub-section-home');
  if (t) t.style.display = 'block';
  document.querySelectorAll('.pub-nav-link').forEach(a => a.classList.remove('active'));
  const homeLink = document.querySelector('.pub-nav-link[onclick*="home"]');
  if (homeLink) homeLink.classList.add('active');
  loadPubPengumumanRingkasan();
}

function goPengumumanFull() {
  document.querySelectorAll('[id^="pub-section-"]').forEach(d => d.style.display = 'none');
  const t = document.getElementById('pub-section-pengumuman-full');
  if (t) t.style.display = 'block';
  loadPubPengumuman();
}

// Admin: Load Warta
async function loadWartaAdmin() {
  const el = document.getElementById('wartaAdminGrid');
  const bar = document.getElementById('wartaAdminBar');
  if (!el) return;
  if (bar) bar.style.display = isSuperAdmin() ? 'block' : 'none';
  el.innerHTML = '<div class="pub-loading" style="grid-column:1/-1">Memuat data warta...</div>';
  try {
    const { data } = await sb.from('warta_jemaat').select('*').order('slot');
    const slotData = {};
    (data || []).forEach(w => { slotData[w.slot] = w; });
    let html = '';
    for (let i = 1; i <= WARTA_SLOTS; i++) {
      const w = slotData[i];
      const tgl = w && w.updated_at ? new Date(w.updated_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';
      const ket = (w && w.keterangan) ? w.keterangan : '';
      const pdfInfo = w && w.pdf_url ? '📄 PDF tersedia' : '📄 Belum ada PDF';
      const pdfColor = w && w.pdf_url ? 'var(--success)' : 'var(--text-muted)';
      html += `<div class="warta-admin-card">
        ${w && w.foto_url ? `<img src="${w.foto_url}" alt="Warta ${i}" onclick="openWartaLightbox('${w.foto_url}')" onerror="this.style.display='none'">` : `<div style="height:200px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:40px;color:var(--text-muted)">📋</div>`}
        <div class="wac-keterangan-label">📝 Keterangan Warta ${i}</div>
        <div class="wac-keterangan-wrap">
          <input type="text" class="wac-keterangan-input" id="wartaKet_${i}"
            value="${ket.replace(/"/g,'&quot;')}"
            placeholder="Contoh: Warta Jemaat 22 Maret 2026"
            ${isSuperAdmin() ? `onblur="simpanKeteranganWarta(${i})"` : 'readonly style="background:#f9f9f9;color:var(--text-muted)"'}>
          ${isSuperAdmin() ? `<button class="btn btn-primary btn-sm" onclick="simpanKeteranganWarta(${i})" title="Simpan keterangan">💾</button>` : ''}
        </div>
        <div class="wac-info">
          <span class="wac-slot">Warta ${i}</span>
          <span class="wac-tgl">${w ? tgl : 'Kosong'}</span>
          <span style="font-size:11px;color:${pdfColor}">${pdfInfo}</span>
          ${isSuperAdmin() ? `
            <label style="margin-left:auto">
              <input type="file" accept="image/*" style="display:none" onchange="uploadWarta(${i}, this)">
              <span class="btn btn-outline btn-sm" style="cursor:pointer">🖼️ Upload Gambar</span>
            </label>
            <label>
              <input type="file" accept="application/pdf" style="display:none" onchange="uploadWartaPdf(${i}, this)">
              <span class="btn btn-outline btn-sm" style="cursor:pointer">📄 Upload PDF</span>
            </label>
            ${w && w.pdf_url ? `<button class="btn btn-danger btn-sm" onclick="hapusWartaPdf(${i})">🗑️ PDF</button>` : ''}
            ${w ? `<button class="btn btn-danger btn-sm" onclick="hapusWarta(${i})">🗑️</button>` : ''}
          ` : ''}
        </div>
      </div>`;
    }
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = '<div style="color:var(--text-muted);padding:32px;text-align:center">Gagal memuat data warta</div>';
  }
}

async function simpanKeteranganWarta(slot) {
  const ket = document.getElementById(`wartaKet_${slot}`)?.value.trim() || '';
  const { data: existing } = await sb.from('warta_jemaat').select('slot').eq('slot', slot).single().catch(()=>({data:null}));
  let err;
  if (existing) {
    ({ error: err } = await sbAdmin.from('warta_jemaat').update({ keterangan: ket }).eq('slot', slot));
  } else {
    ({ error: err } = await sbAdmin.from('warta_jemaat').insert({ slot: slot, keterangan: ket, updated_at: new Date().toISOString() }));
  }
  if (err) { showToast('Gagal simpan keterangan: ' + err.message, 'error'); return; }
  showToast(`Keterangan Warta ${slot} disimpan ✅`, 'success');
}

async function uploadWarta(slot, input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 8 * 1024 * 1024) { showToast('Ukuran gambar maksimal 8MB', 'error'); return; }
  showToast('Mengupload gambar...', 'info');
  const fileName = `warta/slot${slot}_${Date.now()}.${file.name.split('.').pop()}`;
  const { data: upData, error: upErr } = await sbAdmin.storage.from('foto').upload(fileName, file, { upsert: true });
  if (upErr) { showToast('Upload gagal: ' + upErr.message, 'error'); return; }
  const { data: urlData } = sbAdmin.storage.from('foto').getPublicUrl(fileName);
  const fotoUrl = urlData.publicUrl;
  // Upsert ke tabel warta_jemaat
  const { error: dbErr } = await sbAdmin.from('warta_jemaat').upsert({ slot: slot, foto_url: fotoUrl, updated_at: new Date().toISOString() }, { onConflict: 'slot' });
  if (dbErr) { showToast('Gagal simpan: ' + dbErr.message, 'error'); return; }
  showToast(`Warta ${slot} berhasil diupload ✅`, 'success');
  loadWartaAdmin();
}

async function hapusWarta(slot) {
  if (!confirm(`Hapus gambar Warta ${slot}?`)) return;
  const { error } = await sbAdmin.from('warta_jemaat').delete().eq('slot', slot);
  if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
  showToast(`Warta ${slot} dihapus`, 'success');
  loadWartaAdmin();
}

// ===== VISITOR COUNTER =====
async function loadVisitorCounter() {
  const fmt = n => {
    n = parseInt(n)||0;
    if (n>=1000000) return (n/1000000).toFixed(1)+'M';
    if (n>=1000) return (n/1000).toFixed(1)+'K';
    return String(n);
  };
  const setVal = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=fmt(v); };

  const today    = new Date().toISOString().split('T')[0];
  const weekAgo  = new Date(Date.now()-7*24*60*60*1000).toISOString().split('T')[0];

  // ── Sistem localStorage sebagai sumber utama (selalu bekerja) ──
  const LS_KEY = 'sid_visitor_v2';
  let lsData = {};
  try { lsData = JSON.parse(localStorage.getItem(LS_KEY)||'{}'); } catch(e){}

  // Tambah kunjungan hari ini (per session)
  const sessionKey = 'sid_sess_'+today;
  if (!sessionStorage.getItem(sessionKey)) {
    sessionStorage.setItem(sessionKey,'1');
    // Catat di localStorage per tanggal
    if (!lsData.days) lsData.days = {};
    lsData.days[today] = (lsData.days[today]||0) + 1;
    lsData.total = (lsData.total||0) + 1;
    // Bersihkan hari lebih dari 90 hari
    const cutoff = new Date(Date.now()-90*24*60*60*1000).toISOString().split('T')[0];
    Object.keys(lsData.days).forEach(d=>{ if(d<cutoff) delete lsData.days[d]; });
    try { localStorage.setItem(LS_KEY, JSON.stringify(lsData)); } catch(e){}

    // Juga coba insert ke Supabase (gunakan kolom yang ada di skema)
    try {
      await sbAdmin.from('log_perubahan').insert({
        aksi: 'visitor',
        keterangan: 'kunjungan_publik',
        oleh: 'publik',
        waktu: new Date().toISOString()
      });
    } catch(e) { /* Supabase optional — tidak masalah jika gagal */ }
  }

  // Hitung dari localStorage
  const todayLS  = (lsData.days&&lsData.days[today]) ? lsData.days[today] : 0;
  const weekLS   = Object.entries(lsData.days||{}).filter(([d])=>d>=weekAgo).reduce((s,[,v])=>s+v,0);
  const totalLS  = lsData.total||0;

  // Tampilkan dari localStorage dulu (cepat, pasti ada)
  setVal('visitorHariIni', todayLS);
  setVal('visitorMinggu',  weekLS);
  setVal('visitorTotal',   totalLS);

  // Coba ambil data lebih akurat dari Supabase (opsional)
  try {
    let todaySB=0, weekSB=0, totalSB=0;
    const [r1,r2,r3] = await Promise.all([
      sbAdmin.from('log_perubahan').select('*',{count:'exact',head:true}).eq('aksi','visitor').eq('waktu', today).catch(()=>null),
      sbAdmin.from('log_perubahan').select('*',{count:'exact',head:true}).eq('aksi','visitor').gte('waktu', weekAgo).catch(()=>null),
      sbAdmin.from('log_perubahan').select('*',{count:'exact',head:true}).eq('aksi','visitor').catch(()=>null),
    ]);
    // Hanya update jika Supabase mengembalikan angka lebih besar (lebih akurat lintas device)
    if (r1&&r1.count) todaySB=r1.count;
    if (r2&&r2.count) weekSB=r2.count;
    if (r3&&r3.count) totalSB=r3.count;
    if (totalSB > totalLS) {
      setVal('visitorHariIni', Math.max(todayLS,todaySB));
      setVal('visitorMinggu',  Math.max(weekLS,weekSB));
      setVal('visitorTotal',   totalSB);
    }
  } catch(e) { /* Supabase tidak tersedia — tampilkan localStorage */ }
}

// ===== SOCIAL MEDIA =====
async function loadSosmed() {
  try {
    // Cek tabel pengumuman untuk link sosmed (simpan sebagai pengumuman khusus dengan judul='_sosmed')
    const {data} = await sb.from('pengumuman').select('*').eq('judul','_sosmed').limit(1);
    if (data && data[0] && data[0].isi) {
      const links = JSON.parse(data[0].isi);
      const map = {fb:'sosmedFb',ig:'sosmedIg',tt:'sosmedTt',yt:'sosmedYt',wa:'sosmedWa'};
      let hasAny = false;
      Object.keys(map).forEach(key=>{
        const el=document.getElementById(map[key]);
        if(el && links[key]) { el.href=links[key]; el.style.display='inline-flex'; hasAny=true; }
      });
      // Tampilkan bar sosmed hanya jika ada minimal 1 link
      const bar = document.getElementById('sosmedBar');
      if(bar && hasAny) bar.style.display='flex';
    }
  } catch(e){}
}

// ===== SOSMED ADMIN (untuk super admin atur link) =====
async function saveSosmedLinks() {
  const fb=document.getElementById('sosmedAdminFb')?.value.trim()||'';
  const ig=document.getElementById('sosmedAdminIg')?.value.trim()||'';
  const tt=document.getElementById('sosmedAdminTt')?.value.trim()||'';
  const yt=document.getElementById('sosmedAdminYt')?.value.trim()||'';
  const wa=document.getElementById('sosmedAdminWa')?.value.trim()||'';
  const payload={judul:'_sosmed',isi:JSON.stringify({fb,ig,tt,yt,wa}),aktif:true,dibuat_oleh:'admin'};
  const {data:existing}=await sb.from('pengumuman').select('id').eq('judul','_sosmed').limit(1);
  if(existing&&existing[0]) {
    await sbAdmin.from('pengumuman').update(payload).eq('id',existing[0].id);
  } else {
    await sbAdmin.from('pengumuman').insert(payload);
  }
  showToast('Link media sosial disimpan ✅','success');
  document.getElementById('modalSosmed').classList.remove('open');
  loadSosmed();
}

async function openEmailModal() {
  document.getElementById('modalEmail').classList.add('open');
  try {
    // Load email target
    const {data:d1}=await sb.from('pengumuman').select('isi').eq('judul','_email_notif').limit(1);
    if(d1&&d1[0]) document.getElementById('emailNotifTarget').value=d1[0].isi||'';
    // Load EmailJS config
    const {data:d2}=await sb.from('pengumuman').select('isi').eq('judul','_emailjs_config').limit(1);
    if(d2&&d2[0]) {
      const cfg=JSON.parse(d2[0].isi||'{}');
      document.getElementById('emailjsServiceId').value=cfg.serviceId||'';
      document.getElementById('emailjsTemplateId').value=cfg.templateId||'';
      document.getElementById('emailjsPublicKey').value=cfg.publicKey||'';
    }
  } catch(e){}
}

async function saveEmailSettings() {
  const emailTarget=document.getElementById('emailNotifTarget').value.trim();
  const serviceId=document.getElementById('emailjsServiceId').value.trim();
  const templateId=document.getElementById('emailjsTemplateId').value.trim();
  const publicKey=document.getElementById('emailjsPublicKey').value.trim();

  // Save email target
  const p1={judul:'_email_notif',isi:emailTarget,aktif:true,dibuat_oleh:'admin'};
  const {data:e1}=await sb.from('pengumuman').select('id').eq('judul','_email_notif').limit(1);
  if(e1&&e1[0]) await sbAdmin.from('pengumuman').update(p1).eq('id',e1[0].id);
  else await sbAdmin.from('pengumuman').insert(p1);

  // Save EmailJS config
  if(serviceId && templateId && publicKey) {
    const cfg=JSON.stringify({serviceId,templateId,publicKey});
    const p2={judul:'_emailjs_config',isi:cfg,aktif:true,dibuat_oleh:'admin'};
    const {data:e2}=await sb.from('pengumuman').select('id').eq('judul','_emailjs_config').limit(1);
    if(e2&&e2[0]) await sbAdmin.from('pengumuman').update(p2).eq('id',e2[0].id);
    else await sbAdmin.from('pengumuman').insert(p2);
    // Init EmailJS
    await initEmailJS();
  }
  showToast('Pengaturan email disimpan ✅','success');
  document.getElementById('modalEmail').classList.remove('open');
}

async function initEmailJS() {
  try {
    const {data}=await sb.from('pengumuman').select('isi').eq('judul','_emailjs_config').limit(1);
    if(!data||!data[0]) return;
    const cfg=JSON.parse(data[0].isi||'{}');
    if(!cfg.publicKey) return;
    if(!window.emailjs) {
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        s.onload=res; s.onerror=rej;
        document.head.appendChild(s);
      });
    }
    window.emailjs.init({publicKey:cfg.publicKey});
    window._emailjsCfg=cfg;
  } catch(e){}
}

async function testNotifikasiEmail() {
  showToast('Mengirim test email...','info');
  await kirimNotifikasiEmail('test','Sistem','Ini adalah test notifikasi email dari SID GMIM Smirna. Jika Anda menerima email ini, berarti sistem notifikasi sudah berjalan dengan baik! ✅');
  showToast('Test email terkirim! Cek inbox Anda.','success');
}

async function openSosmedModal() {
  document.getElementById('modalSosmed').classList.add('open');
  try {
    const {data}=await sb.from('pengumuman').select('*').eq('judul','_sosmed').limit(1);
    if(data&&data[0]&&data[0].isi) {
      const links=JSON.parse(data[0].isi);
      ['fb','ig','tt','yt','wa'].forEach(k=>{
        const el=document.getElementById('sosmedAdmin'+k.charAt(0).toUpperCase()+k.slice(1));
        if(el) el.value=links[k]||'';
      });
    }
  } catch(e){}
}

// ===== VIDEO YOUTUBE =====
function extractYoutubeId(url) {
  if (!url) return null;
  url = url.trim();
  // Format: youtu.be/ID
  let m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  // Format: youtube.com/watch?v=ID
  m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  // Format: youtube.com/embed/ID
  m = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  // Format: youtube.com/shorts/ID
  m = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}

function youtubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function youtubeEmbed(videoId) {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

// --- PUBLIC ---
async function loadPubVideo() {
  const grid = document.getElementById('pubVideoGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="pub-loading">Memuat video...</div>';
  try {
    const { data } = await sb.from('video_youtube').select('*').order('created_at', { ascending: false }).limit(4);
    if (!data || !data.length) {
      grid.innerHTML = '<div style="color:var(--text-muted);padding:32px;text-align:center;grid-column:1/-1">Belum ada video.</div>';
      return;
    }
    grid.innerHTML = data.map(v => {
      const vid = extractYoutubeId(v.url);
      if (!vid) return '';
      return `<div class="video-card">
        <div class="video-embed">
          <iframe src="${youtubeEmbed(vid)}" allowfullscreen loading="lazy" title="${v.judul||''}"></iframe>
        </div>
        <div class="video-info">
          <div class="video-title">${v.judul||'Video Jemaat'}</div>
          ${v.deskripsi ? `<div class="video-desc">${v.deskripsi}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = `<div style="color:red;padding:32px;grid-column:1/-1">Error: ${e.message}</div>`;
  }
}

// --- ADMIN ---
async function loadVideoAdmin() {
  const list = document.getElementById('videoAdminList');
  if (!list) return;
  list.innerHTML = '<div class="pub-loading">Memuat...</div>';
  try {
    const { data } = await sbAdmin.from('video_youtube').select('*').order('created_at', { ascending: false });
    if (!data || !data.length) {
      list.innerHTML = '<div style="color:var(--text-muted);padding:24px;text-align:center">Belum ada video. Tambahkan di atas.</div>';
      return;
    }
    list.innerHTML = data.map(v => {
      const vid = extractYoutubeId(v.url);
      const thumb = vid ? youtubeThumbnail(vid) : '';
      return `<div class="video-admin-item">
        ${thumb ? `<img src="${thumb}" class="video-admin-thumb" onerror="this.style.display='none'">` : ''}
        <div class="video-admin-info">
          <div class="video-admin-title">${v.judul||'(tanpa judul)'}</div>
          ${v.deskripsi ? `<div class="video-admin-url" style="margin-bottom:2px">${v.deskripsi}</div>` : ''}
          <div class="video-admin-url">${v.url}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${new Date(v.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
        <button onclick="hapusVideo(${v.id})" style="flex-shrink:0;background:none;border:1px solid var(--danger);color:var(--danger);border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">🗑️ Hapus</button>
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<div style="color:red">Error: ${e.message}</div>`;
  }
}

async function simpanVideo() {
  const url = document.getElementById('videoUrl').value.trim();
  const judul = document.getElementById('videoJudul').value.trim();
  const desc = document.getElementById('videoDesc').value.trim();
  if (!url) { showToast('Link YouTube wajib diisi', 'error'); return; }
  if (!judul) { showToast('Judul wajib diisi', 'error'); return; }
  const vid = extractYoutubeId(url);
  if (!vid) { showToast('Link YouTube tidak valid. Coba copy ulang dari browser.', 'error'); return; }
  // Cek max 4 video
  const { data: existing } = await sbAdmin.from('video_youtube').select('id');
  if (existing && existing.length >= 4) {
    showToast('Maksimal 4 video. Hapus video lama terlebih dahulu.', 'error');
    return;
  }
  const { error } = await sbAdmin.from('video_youtube').insert({ url, judul, deskripsi: desc||null });
  if (error) { showToast('Gagal simpan: ' + error.message, 'error'); return; }
  showToast('Video berhasil ditambahkan ✅', 'success');
  document.getElementById('videoUrl').value = '';
  document.getElementById('videoJudul').value = '';
  document.getElementById('videoDesc').value = '';
  loadVideoAdmin();
}

async function hapusVideo(id) {
  if (!confirm('Hapus video ini?')) return;
  const { error } = await sbAdmin.from('video_youtube').delete().eq('id', id);
  if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
  showToast('Video dihapus ✅', 'success');
  loadVideoAdmin();
}

// ===== SLIDESHOW ADMIN =====
async function loadSlideshowAdmin() {
  const grid = document.getElementById('slideshowGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="color:var(--text-muted);padding:32px;text-align:center">Memuat...</div>';
  try {
    const { data } = await sbAdmin.from('foto_slideshow').select('*').order('urutan', { ascending: true });
    if (!data || !data.length) {
      grid.innerHTML = '<div style="color:var(--text-muted);padding:32px;text-align:center;grid-column:1/-1">Belum ada foto. Klik "Tambah Foto" untuk upload.</div>';
      return;
    }
    grid.innerHTML = data.map(f => `
      <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--card)">
        <div style="position:relative;height:150px;background:#eee">
          <img src="${f.foto_url}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<div style=padding:32px;text-align:center;color:#999>Foto tidak ditemukan</div>'">
          <button onclick="hapusSlideshow(${f.id},'${f.foto_url}')" style="position:absolute;top:8px;right:8px;background:rgba(220,38,38,0.9);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px">🗑️ Hapus</button>
        </div>
        <div style="padding:10px;font-size:12px;color:var(--text-muted)">
          <input type="number" value="${f.urutan||0}" min="1" max="99" style="width:50px;padding:4px;border:1px solid var(--border);border-radius:4px;margin-right:8px" onchange="updateUrutanSlideshow(${f.id},this.value)">
          <span>Urutan</span>
        </div>
      </div>`).join('');
  } catch(e) {
    grid.innerHTML = `<div style="color:red;padding:32px;grid-column:1/-1">Error: ${e.message}</div>`;
  }
}

async function uploadSlideshow(input) {
  if (!input.files || !input.files.length) return;
  // Cek jumlah foto saat ini
  const { data: existing } = await sbAdmin.from('foto_slideshow').select('id');
  if (existing && existing.length + input.files.length > 6) {
    showToast(`Maksimal 6 foto. Saat ini ada ${existing.length} foto.`, 'error');
    return;
  }
  let successCount = 0;
  let urutan = (existing ? existing.length : 0) + 1;
  for (const file of Array.from(input.files)) {
    if (file.size > 5 * 1024 * 1024) { showToast(`${file.name}: ukuran maks 5MB`, 'error'); continue; }
    showToast(`Mengupload ${file.name}...`, 'info');
    const ext = file.name.split('.').pop().toLowerCase();
    const fileName = `slideshow/slide_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await sbAdmin.storage.from('foto').upload(fileName, file, { upsert: false });
    if (upErr) { showToast(`Upload ${file.name} gagal: ${upErr.message}`, 'error'); continue; }
    const { data: urlData } = sbAdmin.storage.from('foto').getPublicUrl(fileName);
    const { error: dbErr } = await sbAdmin.from('foto_slideshow').insert({ foto_url: urlData.publicUrl, urutan: urutan++, storage_path: fileName });
    if (dbErr) { showToast(`Simpan ${file.name} gagal: ${dbErr.message}`, 'error'); continue; }
    successCount++;
  }
  if (successCount > 0) showToast(`${successCount} foto berhasil diupload ✅`, 'success');
  loadSlideshowAdmin();
  input.value = '';
}

async function hapusSlideshow(id, fotoUrl) {
  if (!confirm('Hapus foto ini dari slideshow?')) return;
  // Hapus dari storage
  try {
    const { data: row } = await sbAdmin.from('foto_slideshow').select('storage_path').eq('id', id).single();
    if (row && row.storage_path) await sbAdmin.storage.from('foto').remove([row.storage_path]);
  } catch(e) {}
  const { error } = await sbAdmin.from('foto_slideshow').delete().eq('id', id);
  if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
  showToast('Foto dihapus ✅', 'success');
  loadSlideshowAdmin();
}

async function updateUrutanSlideshow(id, urutan) {
  await sbAdmin.from('foto_slideshow').update({ urutan: parseInt(urutan) }).eq('id', id);
  showToast('Urutan disimpan', 'success');
}

// ===== HERO SLIDESHOW =====
async function initHeroSlideshow() {
  const heroBg = document.getElementById('pubHeroBg');
  if (!heroBg) return;

  // Coba ambil foto dari database
  let photos = [];
  try {
    const { data } = await sb.from('foto_slideshow').select('foto_url').order('urutan', { ascending: true });
    if (data && data.length) photos = data.map(d => d.foto_url);
  } catch(e) {}

  // Fallback: gunakan foto gereja bawaan
  if (!photos.length) {
    photos = ['https://vgjhlvzjwnhsgpozznrp.supabase.co/storage/v1/object/public/foto/gedung%20gereja%20gmim%20smirna.jpg'];
  }

  // Rebuild slides di DOM
  heroBg.innerHTML = '';
  photos.forEach((url, i) => {
    const img = document.createElement('img');
    img.src = url;
    img.className = 'hero-slide' + (i === 0 ? ' slide-active' : '');
    img.alt = `Foto ${i+1}`;
    img.onerror = () => img.style.display = 'none';
    heroBg.appendChild(img);
  });

  if (photos.length < 2) return; // Tidak perlu slideshow jika hanya 1 foto

  let current = 0;
  setInterval(() => {
    const slides = heroBg.querySelectorAll('.hero-slide');
    const valid = Array.from(slides).filter(s => s.style.display !== 'none');
    if (valid.length < 2) return;
    valid[current % valid.length].classList.remove('slide-active');
    current = (current + 1) % valid.length;
    valid[current].classList.add('slide-active');
  }, 4000);
}

// ===== AUTO REFRESH DASHBOARD =====
let _dashRefreshTimer = null;
function startDashAutoRefresh() {
  stopDashAutoRefresh();
  _dashRefreshTimer = setInterval(() => {
    const dashPage = document.getElementById('page-dashboard');
    if (dashPage && dashPage.classList.contains('active') && currentUser) {
      loadDashboard();
    }
  }, 5 * 60 * 1000); // setiap 5 menit
}
function stopDashAutoRefresh() {
  if (_dashRefreshTimer) { clearInterval(_dashRefreshTimer); _dashRefreshTimer = null; }
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  // Set default bulan kehadiran
  const now=new Date();
  document.getElementById('filterBulanKehadiran').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  showPublicPage();
  loadPubWartaBeranda();
  loadVisitorCounter();
  loadSosmed();
  initEmailJS();
  // Mulai slideshow (async, ambil dari database)
  initHeroSlideshow();
});

// Set email di footer via JS (agar tidak diblokir Cloudflare)
(function(){const e=document.getElementById('footerEmail');if(e){const p=['gmimsmirnamalabar','gmail','com'];const addr=p[0]+'@'+p[1]+'.'+p[2];e.textContent=addr;e.style.cursor='pointer';e.title='Klik untuk kirim email';e.onclick=()=>window.location='mailto:'+addr;}})();

// ===== PWA =====
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const btn=document.getElementById('btnInstallPWA');if(btn)btn.style.display='flex';});
window.addEventListener('appinstalled',()=>{const btn=document.getElementById('btnInstallPWA');if(btn)btn.style.display='none';deferredPrompt=null;});
function installPWA(){if(!deferredPrompt){alert('Aplikasi sudah terinstall atau gunakan Chrome.');return;}deferredPrompt.prompt();deferredPrompt.userChoice.then(choice=>{if(choice.outcome==='accepted')showToast('Aplikasi berhasil diinstall! 🎉','success');deferredPrompt=null;document.getElementById('btnInstallPWA').style.display='none';});}

if ('serviceWorker' in navigator) {
  window.addEventListener('load',()=>{
    // Unregister SW lama agar tidak cache file usang, lalu register ulang
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    }).finally(() => {
      navigator.serviceWorker.register('./sw.js').then(()=>console.log('✅ PWA aktif')).catch(()=>console.log('ℹ️ SW tidak tersedia'));
    });
  });
}



// ===== MODAL KELUARGA BARU (2 LANGKAH) =====
let _mkbDataKeluarga = {};
let _mkbAnggotaList = [];
let _mkbAnggotaCount = 0;

function openModalKeluargaBaru() {
  _mkbDataKeluarga = {};
  _mkbAnggotaList = [];
  _mkbAnggotaCount = 0;
  // Reset langkah 1
  ['mkbNamaKeluarga','mkbKolom','mkbNoKK','mkbAlamat','mkbJemaat','mkbKolomWil'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  if(currentUser && currentUser.kolom) document.getElementById('mkbKolom').value=currentUser.kolom||'';
  // Reset langkah 2
  mkbResetFormAnggota();
  document.getElementById('mkbDaftarAnggota').innerHTML='';
  // Tampilkan langkah 1
  mkbTampilLangkah(1);
  document.getElementById('modalKeluargaBaru').classList.add('open');
}

function closeMKB() {
  document.getElementById('modalKeluargaBaru').classList.remove('open');
}

function mkbTampilLangkah(n) {
  document.getElementById('mkbLangkah1').style.display = n===1?'block':'none';
  document.getElementById('mkbLangkah2').style.display = n===2?'block':'none';
  document.getElementById('mkbSubtitle').textContent = n===1?'Langkah 1 dari 2 — Data Keluarga':'Langkah 2 dari 2 — Tambah Anggota';
  // Tab styling
  const t1=document.getElementById('mkbStep1Tab'), t2=document.getElementById('mkbStep2Tab');
  t1.style.color = n===1?'var(--primary)':'var(--text-muted)';
  t1.style.borderBottom = n===1?'2px solid var(--primary)':'2px solid transparent';
  t1.style.fontWeight = n===1?'700':'400';
  t2.style.color = n===2?'var(--primary)':'var(--text-muted)';
  t2.style.borderBottom = n===2?'2px solid var(--primary)':'2px solid transparent';
  t2.style.fontWeight = n===2?'700':'400';
}

function mkbLanjutLangkah2() {
  const nama = document.getElementById('mkbNamaKeluarga').value.trim();
  const kolom = document.getElementById('mkbKolom').value.trim();
  if (!nama) { showToast('Nama Keluarga wajib diisi!','error'); document.getElementById('mkbNamaKeluarga').focus(); return; }
  if (!kolom) { showToast('Kolom wajib diisi!','error'); document.getElementById('mkbKolom').focus(); return; }
  _mkbDataKeluarga = {
    nama_keluarga: nama,
    kolom: parseInt(kolom),
    no_kk: document.getElementById('mkbNoKK').value.trim(),
    alamat_rumah: document.getElementById('mkbAlamat').value.trim(),
    jemaat_asal: document.getElementById('mkbJemaat').value.trim(),
    alamat_kolom: document.getElementById('mkbKolomWil').value.trim(),
  };
  _mkbAnggotaList = [];
  _mkbAnggotaCount = 0;
  document.getElementById('mkbInfoNama').textContent = '🏠 ' + nama;
  document.getElementById('mkbInfoKolom').textContent = 'Kolom ' + kolom;
  document.getElementById('mkbDaftarAnggota').innerHTML = '';
  mkbResetFormAnggota();
  mkbUpdateAnggotaLabel();
  mkbTampilLangkah(2);
}

function mkbKembali() {
  mkbTampilLangkah(1);
}

function mkbResetFormAnggota() {
  ['mkbaNama','mkbaNik','mkbaTempat','mkbaPekerjaan','mkbaNo'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['mkbaLp','mkbaBaptis','mkbaSidi','mkbaRelasi','mkbaBipra','mkbaLansia'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.selectedIndex=0;
  });
  const tgl=document.getElementById('mkbaTgl'); if(tgl) tgl.value='';
  // Relasi default: anggota pertama = Suami
  if(_mkbAnggotaCount===0 && document.getElementById('mkbaRelasi')) {
    document.getElementById('mkbaRelasi').value='Suami';
    const lp=document.getElementById('mkbaLp'); if(lp) lp.value='L';
  }
}

function mkbUpdateAnggotaLabel() {
  const n = _mkbAnggotaCount + 1;
  const label = n===1?'Anggota ke-1 (Kepala Keluarga / Suami)':'Anggota ke-'+n;
  document.getElementById('mkbAnggotaLabel').textContent = label;
  const btnSelesai = document.getElementById('mkbBtnSelesai');
  if (btnSelesai) btnSelesai.style.display = _mkbAnggotaCount>0?'inline-flex':'none';
}

async function mkbSimpanAnggota() {
  const nama = document.getElementById('mkbaNama').value.trim();
  if (!nama) { showToast('Nama Lengkap anggota wajib diisi!','error'); document.getElementById('mkbaNama').focus(); return; }
  const tgl = document.getElementById('mkbaTgl').value;
  const payload = {
    kolom: _mkbDataKeluarga.kolom,
    no: document.getElementById('mkbaNo').value.trim(),
    nama_lengkap: nama,
    nik: document.getElementById('mkbaNik').value.trim(),
    lp: document.getElementById('mkbaLp').value,
    tempat_lahir: document.getElementById('mkbaTempat').value.trim(),
    tanggal_lahir: tgl||null,
    umur: tgl?hitungUmur(tgl):'',
    pekerjaan: document.getElementById('mkbaPekerjaan').value.trim(),
    baptis: document.getElementById('mkbaBaptis').value,
    sidi: document.getElementById('mkbaSidi').value,
    nama_keluarga: _mkbDataKeluarga.nama_keluarga,
    no_kk: _mkbDataKeluarga.no_kk,
    relasi: document.getElementById('mkbaRelasi').value,
    bipra: document.getElementById('mkbaBipra').value,
    lansia: document.getElementById('mkbaLansia').value,
    alamat_rumah: _mkbDataKeluarga.alamat_rumah,
    jemaat_asal: _mkbDataKeluarga.jemaat_asal,
    alamat_kolom: _mkbDataKeluarga.alamat_kolom,
    status_jemaat: 'baru',
    diinput_oleh: currentUser?.username||'-',
    waktu_input: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  try {
    const {error} = await sbAdmin.from('jemaat').insert([payload]);
    if (error) throw error;
    _mkbAnggotaList.push(nama);
    _mkbAnggotaCount++;
    // Tampilkan daftar anggota yang sudah disimpan
    const daftar = document.getElementById('mkbDaftarAnggota');
    daftar.innerHTML = _mkbAnggotaList.map((n,i)=>
      `<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.25);border-radius:6px;font-size:13px;">
        <span style="color:#15803d;font-weight:700;">✓</span>
        <span style="color:var(--text);">${i===0?'👑 ':''}<strong>${n}</strong></span>
      </div>`
    ).join('');
    showToast(`${nama} berhasil ditambahkan ✅`,'success');
    mkbResetFormAnggota();
    mkbUpdateAnggotaLabel();
    document.getElementById('mkbaNama').focus();
    logAktivitas('tambah', `Anggota keluarga ${_mkbDataKeluarga.nama_keluarga}: ${nama}`);
  } catch(e) {
    showToast('Gagal menyimpan: '+e.message,'error');
  }
}

async function mkbSelesai() {
  if (_mkbAnggotaList.length===0) { showToast('Tambahkan minimal 1 anggota dulu!','error'); return; }
  closeMKB();
  showToast(`Keluarga ${_mkbDataKeluarga.nama_keluarga} berhasil ditambahkan dengan ${_mkbAnggotaList.length} anggota! 🎉`,'success');
  if (typeof loadJemaat==='function') loadJemaat();
  if (typeof loadKeluarga==='function') loadKeluarga();
}
