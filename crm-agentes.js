// ============================================================
// Dirección: escalamientos de los agentes, bitácora y cumplimiento
// ============================================================
const AG_LABEL = {director:"Director", comercial:"Comercial", operacion:"Operación", calidad:"Calidad",
  inteligencia:"Inteligencia", marketing:"Marketing", cumplimiento:"Cumplimiento", sistema:"Sistema", jp:"JP"};
const TIPO_LABEL = {accion:"Acción", decision:"Decisión", escalamiento:"Escalamiento", reporte:"Reporte", alerta:"Alerta", borrador:"Borrador"};

async function cargarDireccion(){
  const [esc, bit, cum, cfg] = await Promise.all([
    sb.from("agentes_bitacora").select("*").eq("escalado", true).eq("resuelto", false).order("creado_en", {ascending:false}),
    sb.from("agentes_bitacora").select("id,agente,tipo,resumen,detalle,referencia,creado_en").order("creado_en", {ascending:false}).limit(80),
    sb.from("cumplimiento_vencimientos").select("*").order("id"),
    sb.from("config_publica").select("*").order("clave")
  ]);
  pintarEscalamientos(esc.data||[]);
  pintarBitacora(bit.data||[]);
  pintarCumplimiento(cum.data||[]);
  pintarConfig(cfg.data||[]);
  const n = (esc.data||[]).length;
  const tab = $('#tabs button[data-v="direccion"]');
  tab.textContent = n ? `Dirección (${n})` : "Dirección";
}

function pintarEscalamientos(rows){
  const cont = $("#esc-lista");
  if(!rows.length){ cont.innerHTML = '<p class="muted" style="font-size:13px">Sin decisiones pendientes. Los agentes te avisarán aquí cuando algo salga de sus límites.</p>'; return; }
  cont.innerHTML = rows.map(r => {
    const d = r.detalle || {};
    const op = Array.isArray(d.opciones) ? d.opciones.map((o,i)=>`<li>${esc(typeof o==="string"?o:JSON.stringify(o))}</li>`).join("") : "";
    return `<div class="card pad" style="margin-bottom:12px;border-left:4px solid var(--terra)">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><span class="tag">${AG_LABEL[r.agente]||esc(r.agente)}</span> <strong style="margin-left:6px">${esc(r.resumen)}</strong>
          <div class="muted" style="font-size:12px;margin-top:3px">${new Date(r.creado_en).toLocaleString("es-MX")}${r.referencia?" · "+esc(r.referencia):""}${d.fecha_limite?" · límite "+esc(d.fecha_limite):""}</div></div>
      </div>
      ${d.contexto?`<p style="font-size:13.5px;margin-top:10px"><strong>Contexto.</strong> ${esc(d.contexto)}</p>`:""}
      ${op?`<div style="font-size:13.5px;margin-top:8px"><strong>Opciones.</strong><ul style="margin:4px 0 0 18px;padding:0">${op}</ul></div>`:""}
      ${d.recomendacion?`<p style="font-size:13.5px;margin-top:8px"><strong>Recomendación.</strong> ${esc(d.recomendacion)}</p>`:""}
      ${d.si_no_se_decide?`<p class="muted" style="font-size:12.5px;margin-top:6px">Si no se decide: ${esc(d.si_no_se_decide)}</p>`:""}
      <div class="row" style="margin-top:12px;gap:8px">
        <input placeholder="Tu decisión (se guarda en la bitácora y los agentes la leen)" data-res-txt="${r.id}" style="flex:1;min-width:220px">
        <button class="btn sm" data-res="${r.id}">Resolver</button>
      </div>
    </div>`;
  }).join("");
  $$("#esc-lista [data-res]").forEach(b => b.onclick = async () => {
    const txt = $(`[data-res-txt="${b.dataset.res}"]`).value.trim();
    if(!txt) return alert("Escribe tu decisión antes de resolver.");
    b.disabled = true;
    const {error} = await sb.from("agentes_bitacora").update({resuelto:true, resolucion:txt, resuelto_en:new Date().toISOString()}).eq("id", b.dataset.res);
    if(error){ b.disabled=false; return alert(error.message); }
    await sb.from("agentes_bitacora").insert({agente:"jp", tipo:"decision", resumen:"Decisión de JP: "+txt.slice(0,120), detalle:{escalamiento_id:b.dataset.res, texto:txt}});
    cargarDireccion();
  });
}

function pintarBitacora(rows){
  const body = $("#bit-body");
  if(!rows.length){ body.innerHTML = '<tr><td colspan="4" class="muted">La bitácora está vacía. El primer brief del director llega mañana a las 7:30.</td></tr>'; return; }
  body.innerHTML = rows.map(r => {
    const d = r.detalle || {};
    const texto = d.texto ? `<details style="margin-top:4px"><summary style="cursor:pointer;font-size:12px;color:var(--terra)">Ver texto</summary><pre style="white-space:pre-wrap;font:inherit;font-size:12.5px;margin:6px 0 0">${esc(d.texto)}</pre></details>` : "";
    return `<tr>
      <td class="mono" style="white-space:nowrap">${new Date(r.creado_en).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"})}</td>
      <td><span class="tag">${AG_LABEL[r.agente]||esc(r.agente)}</span></td>
      <td>${TIPO_LABEL[r.tipo]||esc(r.tipo)}</td>
      <td>${esc(r.resumen)}${r.referencia?` <span class="muted">· ${esc(r.referencia)}</span>`:""}${texto}</td>
    </tr>`;
  }).join("");
}

function pintarConfig(rows){
  const orden = ["pago_beneficiario","pago_banco","pago_clabe","pago_instrucciones","whatsapp"];
  rows.sort((a,b)=>orden.indexOf(a.clave)-orden.indexOf(b.clave));
  $("#cfg-grid").innerHTML = rows.map(r => `<label class="f">${esc(r.etiqueta||r.clave)}<input data-cfg="${esc(r.clave)}" value="${esc(r.valor||"")}"${r.clave==="pago_clabe"?' inputmode="numeric" maxlength="18"':""}></label>`).join("");
  $("#cfg-save").onclick = async () => {
    const clabe = ($('[data-cfg="pago_clabe"]')?.value||"").trim();
    if(clabe && !/^\d{18}$/.test(clabe)) return $("#cfg-msg").innerHTML = '<p style="color:var(--bad);font-size:13px">La CLABE debe tener 18 dígitos.</p>';
    $("#cfg-save").disabled = true;
    const errores = [];
    for (const inp of $$("#cfg-grid [data-cfg]")) {
      const {error} = await sb.from("config_publica").update({valor: inp.value.trim() || null, actualizado_en: new Date().toISOString()}).eq("clave", inp.dataset.cfg);
      if(error) errores.push(error.message);
    }
    $("#cfg-save").disabled = false;
    $("#cfg-msg").innerHTML = errores.length ? `<p style="color:var(--bad);font-size:13px">${esc(errores.join(" · "))}</p>` : '<p style="color:var(--ok,#2a7);font-size:13px">Guardado. El portal ya lo muestra a los clientes.</p>';
  };
}

function pintarCumplimiento(rows){
  const body = $("#cum-body");
  const hoy = new Date().toISOString().slice(0,10);
  body.innerHTML = rows.map(r => {
    const venc = r.fecha_vencimiento || "";
    const cls = r.estatus==="vencido" || (venc && venc < hoy) ? "bad" : (venc && venc <= new Date(Date.now()+60*864e5).toISOString().slice(0,10)) ? "warn" : r.estatus==="vigente" ? "ok" : "";
    return `<tr>
      <td><strong>${esc(r.concepto)}</strong><div class="muted" style="font-size:11.5px">${esc(r.autoridad||"")}${r.periodicidad?" · "+esc(r.periodicidad):""}</div></td>
      <td><input type="date" value="${venc}" data-cum-fecha="${r.id}" style="width:150px"></td>
      <td><select data-cum-est="${r.id}">${["pendiente","vigente","vencido","no_aplica"].map(e=>`<option value="${e}"${e===r.estatus?" selected":""}>${e.replace("_"," ")}</option>`).join("")}</select></td>
      <td><span class="tag ${cls}">${esc(r.estatus.replace("_"," "))}</span></td>
      <td><button class="btn ghost sm" data-cum-save="${r.id}">Guardar</button></td>
    </tr>`;
  }).join("");
  $$("#cum-body [data-cum-save]").forEach(b => b.onclick = async () => {
    const id = b.dataset.cumSave;
    const fecha = $(`[data-cum-fecha="${id}"]`).value || null;
    const estatus = $(`[data-cum-est="${id}"]`).value;
    b.disabled = true;
    const {error} = await sb.from("cumplimiento_vencimientos").update({fecha_vencimiento:fecha, estatus, actualizado_en:new Date().toISOString()}).eq("id", Number(id));
    b.disabled = false;
    if(error) return alert(error.message);
    cargarDireccion();
  });
}

// La pestaña se carga al abrirla (no en cada arranque, para no frenar el tablero).
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest('button[data-v="direccion"]'); if(b) cargarDireccion();
});
// Y el contador de pendientes se actualiza al entrar.
sb.auth.getSession().then(({data:{session}}) => {
  if(!session) return;
  sb.from("agentes_bitacora").select("id", {count:"exact", head:true}).eq("escalado", true).eq("resuelto", false)
    .then(({count}) => { if(count) $('#tabs button[data-v="direccion"]').textContent = `Dirección (${count})`; });
});
