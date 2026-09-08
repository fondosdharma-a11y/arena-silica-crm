// ============================================================
// Configuración
// ============================================================
const SB_URL = "https://pfsbltkdlnrkodvetfnu.supabase.co";
const SB_KEY = "sb_publishable_D-anC38mBEtdn9mEoxLtiA_3wjan8v2";
const EMPRESA = {
  nombre: "ARENSIL",
  lugar: "Lagos de Moreno, Jalisco",
  contacto: "Juan Pablo",
  tel: "322 310 2049",
  wa: "523223102049"
};
const sb = supabase.createClient(SB_URL, SB_KEY);

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const mx = n => "$" + (Number(n)||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});
const num = n => (Number(n)||0).toLocaleString("es-MX",{maximumFractionDigits:1});
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const SEG_LABEL = {construccion:"Construcción",filtracion_agua:"Filtración de agua",albercas:"Albercas",
  fundicion:"Fundición",vidrio_ceramica:"Vidrio y cerámica",sandblast:"Sandblast",deportivo:"Deportivo",
  pinturas:"Pinturas",distribuidor:"Distribuidor",otro:"Otro"};
const EST_LABEL = {prospecto:"Prospecto",contactado:"Contactado",calificado:"Calificado",
  cotizado:"Cotizado",cliente:"Cliente",inactivo:"Inactivo",descartado:"Descartado"};
const PRES_LABEL = {granel_ton:"Granel · tonelada",saco_25kg:"Saco 25 kg",saco_50kg:"Saco 50 kg",supersaco_1t:"Súper saco 1 t"};

let DB = {cuentas:[],productos:[],zonas:[],cotizaciones:[],agenda:[]};
let QLINES = [];

// ============================================================
// Auth
// ============================================================
async function boot(){
  if(location.hash && /access_token|error/.test(location.hash)) history.replaceState({},"",location.pathname);
  const {data:{session}} = await sb.auth.getSession();
  if(session){ showApp(session.user); } else { $("#login").classList.remove("hide"); }
}
// Solo entran los correos dados de alta como administración (tabla correos_admin → perfiles.rol = 'admin').
async function showApp(user){
  const {data:perfil} = await sb.from("perfiles").select("rol,nombre,avatar_url").eq("id",user.id).single();
  if(!perfil || perfil.rol !== "admin"){
    await sb.auth.signOut();
    $("#login").classList.remove("hide");
    $("#li-msg").textContent = "Esta cuenta no es de administración. Si eres cliente, entra en arensil.com/pedidos.";
    return;
  }
  $("#login").classList.add("hide");
  $("#app").classList.remove("hide");
  $("#who").textContent = (perfil.nombre ? perfil.nombre + " · " : "") + user.email;
  cargarTodo();
}
(async () => {
  try {
    const r = await fetch(SB_URL + "/auth/v1/settings", {headers:{apikey:SB_KEY}});
    const ext = (await r.json()).external || {};
    let activos = 0;
    $$("#social [data-prov]").forEach(b => { const on = !!ext[b.dataset.prov]; b.classList.toggle("hide", !on); if(on) activos++; });
    if(!activos){ $("#social").classList.add("hide"); $$(".sep").forEach(x=>x.classList.add("hide")); }
  } catch {}
})();
$$("#social [data-prov]").forEach(b => b.onclick = async () => {
  $("#li-msg").textContent = ""; b.disabled = true;
  const {error} = await sb.auth.signInWithOAuth({provider:b.dataset.prov, options:{redirectTo: location.origin + location.pathname}});
  if(error){ b.disabled = false; $("#li-msg").textContent = "No pudimos conectar con ese servicio: " + error.message; }
});
$("#li-in").onclick = async () => {
  const {error} = await sb.auth.signInWithPassword({email:$("#li-mail").value.trim(),password:$("#li-pass").value});
  if(error){ $("#li-msg").textContent = "No se pudo entrar: " + error.message; return; }
  const {data:{user}} = await sb.auth.getUser(); showApp(user);
};
$("#li-up").onclick = async () => {
  const {data,error} = await sb.auth.signUp({email:$("#li-mail").value.trim(),password:$("#li-pass").value, options:{emailRedirectTo: location.origin + location.pathname}});
  if(error){ $("#li-msg").textContent = "No se pudo crear: " + error.message; return; }
  $("#li-msg").textContent = data.session ? "Listo." : "Cuenta creada. Revisa tu correo para confirmarla y luego entra.";
  if(data.session) showApp(data.user);
};
$("#logout").onclick = async () => { await sb.auth.signOut(); location.reload(); };

// ============================================================
// Navegación
// ============================================================
$("#tabs").onclick = e => {
  const b = e.target.closest("button[data-v]"); if(!b) return;
  $$("#tabs button").forEach(x=>x.setAttribute("aria-current", x===b));
  $$("main > section").forEach(s=>s.classList.add("hide"));
  $("#v-"+b.dataset.v).classList.remove("hide");
};

// ============================================================
// Carga
// ============================================================
async function cargarTodo(){
  const [cu,pr,zo,co,ag] = await Promise.all([
    sb.from("cuentas").select("*").order("prioridad").order("potencial_ton_mes",{ascending:false,nullsFirst:false}),
    sb.from("productos").select("*").eq("activo",true).order("id"),
    sb.from("zonas_flete").select("*").order("km_desde_lagos"),
    sb.from("cotizaciones").select("*, cuentas(nombre)").order("creado_en",{ascending:false}).limit(100),
    sb.from("v_seguimientos_pendientes").select("*")
  ]);
  DB.cuentas = cu.data||[]; DB.productos = pr.data||[]; DB.zonas = zo.data||[];
  DB.cotizaciones = co.data||[]; DB.agenda = ag.data||[];
  llenarFiltros(); pintarTablero(); pintarProspectos(); pintarCatalogo();
  pintarCotizaciones(); pintarAgenda(); prepararCotizador();
}

function llenarFiltros(){
  const segs=[...new Set(DB.cuentas.map(c=>c.segmento))].sort();
  $("#p-seg").innerHTML = '<option value="">Todos</option>' + segs.map(s=>`<option value="${s}">${SEG_LABEL[s]||s}</option>`).join("");
  const edos=[...new Set(DB.cuentas.map(c=>c.estado).filter(Boolean))].sort();
  $("#p-edo").innerHTML = '<option value="">Todos</option>' + edos.map(s=>`<option>${esc(s)}</option>`).join("");
  const ests=[...new Set(DB.cuentas.map(c=>c.estatus))];
  $("#p-est").innerHTML = '<option value="">Todos</option>' + ests.map(s=>`<option value="${s}">${EST_LABEL[s]||s}</option>`).join("");
}

// ============================================================
// Tablero
// ============================================================
