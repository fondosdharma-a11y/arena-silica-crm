// ============================================================
// Chat del sitio · conversaciones, transcripción y conocimiento
// ============================================================
let CHAT = { convs: [], abierta: null, filtro: "todas", conocimiento: [] };

async function cargarChat(){
  if(!$("#ch-lista")) return;
  let q = sb.from("chat_conversaciones").select("*").order("ultimo_en", {ascending:false}).limit(120);
  if(CHAT.filtro === "escaladas") q = q.eq("escalada", true).eq("atendida", false);
  if(CHAT.filtro === "sin_atender") q = q.eq("atendida", false);
  const {data, error} = await q;
  if(error){ $("#ch-lista").innerHTML = `<p class="muted" style="font-size:13px">${esc(error.message)}</p>`; return; }
  CHAT.convs = data || [];
  const porAtender = CHAT.convs.filter(c => c.escalada && !c.atendida).length;
  const et = $("#ch-n"); if(et) et.textContent = porAtender ? `${porAtender} con datos sin atender` : "";
  pintarListaChat();
}

function cuando(t){
  const h = (Date.now() - new Date(t)) / 36e5;
  if(h < 1) return "hace menos de 1 h";
  if(h < 24) return "hace " + Math.round(h) + " h";
  return new Date(t).toLocaleDateString("es-MX", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});
}

function pintarListaChat(){
  const cont = $("#ch-lista");
  if(!CHAT.convs.length){
    cont.innerHTML = '<p class="muted" style="font-size:13px">Sin conversaciones en este filtro. El chat vive en la burbuja de arensil.com.</p>';
    $("#ch-detalle").innerHTML = "";
    return;
  }
  cont.innerHTML = CHAT.convs.map(c => {
    const quien = c.nombre || c.empresa || "Visitante";
    const marca = c.escalada && !c.atendida ? "border-left:4px solid var(--warn,#a8761b)" : "border-left:4px solid var(--linea,#e3ded6)";
    const sel = CHAT.abierta === c.id ? "background:#fbf7f1" : "";
    return `<button class="ch-item" data-conv="${c.id}" style="${marca};${sel};display:block;width:100%;text-align:left;border:0;border-radius:10px;padding:10px 12px;margin-bottom:6px;cursor:pointer;font:inherit">
      <div class="row" style="justify-content:space-between;gap:8px">
        <strong style="font-size:13.5px">${esc(quien)}</strong>
        <span class="muted" style="font-size:11.5px">${esc(cuando(c.ultimo_en || c.creado_en))}</span>
      </div>
      <div class="muted" style="font-size:12px;margin-top:2px">${c.mensajes_count || 0} respuestas${c.origen ? " · " + esc(c.origen) : ""}${c.escalada ? " · dejó datos" : ""}${c.atendida ? " · atendida" : ""}</div>
    </button>`;
  }).join("");
  $$("#ch-lista [data-conv]").forEach(b => b.onclick = () => abrirConversacion(b.dataset.conv));
  if(CHAT.abierta && CHAT.convs.some(c => c.id === CHAT.abierta)) abrirConversacion(CHAT.abierta);
}

async function abrirConversacion(id){
  CHAT.abierta = id;
  const c = CHAT.convs.find(x => x.id === id);
  const cont = $("#ch-detalle");
  if(!c){ cont.innerHTML = ""; return; }
  cont.innerHTML = '<p class="muted" style="font-size:13px">Cargando…</p>';
  const {data:msjs} = await sb.from("chat_mensajes").select("rol,texto,creado_en")
    .eq("conversacion_id", id).order("creado_en", {ascending:true});
  const tel = (c.telefono || "").replace(/\D/g, "");
  const tel52 = tel.length === 10 ? "52" + tel : tel;
  const saludo = `Hola${c.nombre ? " " + c.nombre : ""}, le escribe Juan Pablo de ARENSIL (arena sílica, Lagos de Moreno). Vi su conversación en el sitio y le doy seguimiento:`;
  const burbujas = (msjs || []).map(m => {
    const mio = m.rol === "asistente";
    return `<div style="max-width:84%;${mio ? "" : "margin-left:auto;"}margin-bottom:8px;padding:8px 11px;border-radius:12px;font-size:13px;white-space:pre-wrap;
      background:${mio ? "#fff" : "#8C4A22"};color:${mio ? "inherit" : "#fff"};border:${mio ? "1px solid var(--linea,#e3ded6)" : "0"}">
      ${esc(m.texto)}</div>`;
  }).join("") || '<p class="muted" style="font-size:13px">Sin mensajes.</p>';

  cont.innerHTML = `<div class="card pad">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px">
      <div>
        <strong>${esc(c.nombre || c.empresa || "Visitante del chat")}</strong>
        <div class="muted" style="font-size:12.5px;margin-top:2px">
          ${c.empresa ? esc(c.empresa) + " · " : ""}${tel ? `<a href="tel:+${tel52}">${esc(c.telefono)}</a>` : "sin teléfono"}${c.email ? " · " + esc(c.email) : ""}
        </div>
        <div class="muted" style="font-size:12px;margin-top:2px">Empezó ${esc(cuando(c.creado_en))}${c.origen ? " en " + esc(c.origen) : ""}</div>
      </div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        ${tel ? `<a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/${tel52}?text=${encodeURIComponent(saludo)}">WhatsApp</a>` : ""}
        ${c.solicitud_id ? "" : `<button class="btn ghost sm" id="ch-sol" ${tel || c.email ? "" : "disabled"}>Pasar a solicitud</button>`}
        <button class="btn sm" id="ch-att">${c.atendida ? "Marcar sin atender" : "Marcar atendida"}</button>
      </div>
    </div>
    <div style="background:#f7f5f1;border-radius:12px;padding:12px;max-height:440px;overflow-y:auto">${burbujas}</div>
    ${c.solicitud_id ? '<p class="muted" style="font-size:12px;margin-top:8px">Ya generó una solicitud; aparece en el tablero.</p>' : ""}
  </div>`;

  const att = $("#ch-att");
  if(att) att.onclick = async () => {
    att.disabled = true;
    const {error} = await sb.from("chat_conversaciones").update({atendida: !c.atendida}).eq("id", c.id);
    if(error){ att.disabled = false; return alert(error.message); }
    await cargarChat();
  };
  const sol = $("#ch-sol");
  if(sol) sol.onclick = async () => {
    sol.disabled = true;
    const ultimo = (msjs || []).filter(m => m.rol === "cliente").slice(-1)[0];
    const {data:nueva, error} = await sb.from("solicitudes_web").insert({
      nombre: c.nombre || "Visitante del chat", empresa: c.empresa,
      telefono: c.telefono || "sin teléfono", email: c.email,
      mensaje: ultimo ? ultimo.texto.slice(0, 600) : null, origen: "chat del sitio"
    }).select().single();
    if(error){ sol.disabled = false; return alert(error.message); }
    await sb.from("chat_conversaciones").update({solicitud_id: nueva.id, escalada: true}).eq("id", c.id);
    await cargarChat();
    if(typeof cargarSolicitudes === "function") cargarSolicitudes();
  };
}

// ---------- Conocimiento que usa el asistente ----------
async function cargarConocimiento(){
  const cont = $("#ch-kb"); if(!cont) return;
  const {data, error} = await sb.from("chat_conocimiento").select("*").order("categoria").order("orden");
  if(error){ cont.innerHTML = `<p class="muted" style="font-size:13px">${esc(error.message)}</p>`; return; }
  CHAT.conocimiento = data || [];
  cont.innerHTML = CHAT.conocimiento.map(k => `<tr${k.activo ? "" : ' style="opacity:.5"'}>
    <td style="font-size:12px">${esc(k.categoria)}</td>
    <td><input data-kb="${k.id}" data-campo="pregunta" value="${esc(k.pregunta)}" style="width:100%;font-size:12.5px"></td>
    <td><textarea data-kb="${k.id}" data-campo="respuesta" rows="2" style="width:100%;font-size:12.5px">${esc(k.respuesta)}</textarea></td>
    <td><input data-kb="${k.id}" data-campo="claves" value="${esc(k.claves || "")}" style="width:100%;font-size:12px" placeholder="palabras, separadas, por comas"></td>
    <td class="right"><label style="font-size:12px"><input type="checkbox" data-act="${k.id}" ${k.activo ? "checked" : ""}> activo</label></td>
  </tr>`).join("");

  let guardando = null;
  const guarda = async (id, campo, valor) => {
    clearTimeout(guardando);
    guardando = setTimeout(async () => {
      const {error} = await sb.from("chat_conocimiento").update({[campo]: valor, actualizado_en: new Date().toISOString()}).eq("id", id);
      const av = $("#ch-kb-msg");
      if(av) av.textContent = error ? "No se guardó: " + error.message : "Guardado.";
      setTimeout(() => { if(av) av.textContent = ""; }, 2500);
    }, 700);
  };
  $$("#ch-kb [data-kb]").forEach(el => el.oninput = () => guarda(el.dataset.kb, el.dataset.campo, el.value));
  $$("#ch-kb [data-act]").forEach(el => el.onchange = async () => {
    await sb.from("chat_conocimiento").update({activo: el.checked}).eq("id", el.dataset.act);
    cargarConocimiento();
  });
}

async function nuevoConocimiento(){
  const pregunta = prompt("¿Qué pregunta contesta?");
  if(!pregunta) return;
  const respuesta = prompt("¿Qué debe responder el asistente? (2 a 4 renglones, de usted, sin prometer nada que no exista)");
  if(!respuesta) return;
  const claves = prompt("Palabras clave separadas por comas (las que escribiría el cliente)") || "";
  const {error} = await sb.from("chat_conocimiento").insert({
    categoria: "empresa", pregunta, respuesta, claves, activo: true, orden: 99
  });
  if(error) return alert(error.message);
  cargarConocimiento();
}

// ---------- Interruptores ----------
async function cargarChatConfig(){
  const cont = $("#ch-cfg"); if(!cont) return;
  const {data} = await sb.from("config_publica").select("clave,valor").like("clave", "chat%");
  const c = Object.fromEntries((data || []).map(x => [x.clave, x.valor]));
  const activo = (c.chat_activo || "si") === "si";
  cont.innerHTML = `<label style="font-size:13px"><input type="checkbox" id="ch-on" ${activo ? "checked" : ""}> Chat encendido en el sitio</label>
    <span class="muted" style="font-size:12px;margin-left:14px">Tope por conversación: ${esc(c.chat_max_mensajes_conversacion || "30")} · por hora e IP: ${esc(c.chat_max_mensajes_hora_ip || "40")} · por día: ${esc(c.chat_max_mensajes_dia || "600")}</span>`;
  $("#ch-on").onchange = async e => {
    const {error} = await sb.from("config_publica").update({valor: e.target.checked ? "si" : "no"}).eq("clave", "chat_activo");
    if(error){ alert(error.message); e.target.checked = !e.target.checked; }
  };
}

$("#tabs").addEventListener("click", e => {
  const b = e.target.closest('button[data-v="chat"]');
  if(!b) return;
  cargarChat(); cargarConocimiento(); cargarChatConfig();
});
document.addEventListener("DOMContentLoaded", () => {
  const f = $("#ch-filtro");
  if(f) f.onchange = () => { CHAT.filtro = f.value; CHAT.abierta = null; cargarChat(); };
  const n = $("#ch-kb-nuevo");
  if(n) n.onclick = nuevoConocimiento;
});
