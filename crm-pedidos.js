// ============================================================
// Pedidos del portal y lotes: preparación, asignación de lote, estatus
// ============================================================
const EST_PED_LABEL = {borrador:"Borrador", pendiente_pago:"Esperando pago", pagado:"Pagado", en_preparacion:"En preparación",
  en_ruta:"En ruta", entregado:"Entregado", cancelado:"Cancelado"};
const EST_PED_CLS = {pagado:"ok", en_preparacion:"ok", en_ruta:"ok", entregado:"ok", pendiente_pago:"warn", cancelado:"bad", borrador:""};
let PED = [], LOTES = [];

async function cargarPedidosCRM(){
  const [pe, lo] = await Promise.all([
    sb.from("pedidos").select("*, cuentas(nombre,municipio,telefono), direcciones(alias,calle,colonia,municipio,estado,cp,referencias,contacto,telefono), pedido_partidas(id,producto_id,descripcion,cantidad,unidad,precio_unitario,flete_unitario,importe,lote_id,orden)")
      .order("fecha",{ascending:false}).limit(200),
    sb.from("lotes").select("*").order("fecha_produccion",{ascending:false})
  ]);
  PED = pe.data||[]; LOTES = lo.data||[];
  pintarPedidosCRM(); pintarLotes();
  const n = PED.filter(p=>p.estatus==="pagado").length;
  $('#tabs button[data-v="pedidos"]').textContent = n ? `Pedidos (${n})` : "Pedidos";
}

function pintarPedidosCRM(){
  const f = $("#pe-filtro").value;
  const rows = PED.filter(p => !f || p.estatus===f);
  const body = $("#pe-body");
  if(!rows.length){ body.innerHTML = '<tr><td colspan="7" class="muted">Sin pedidos con ese estatus.</td></tr>'; return; }
  body.innerHTML = rows.map(p => `<tr data-ped="${p.id}" style="cursor:pointer">
    <td class="mono"><strong>${esc(p.folio)}</strong></td>
    <td class="mono">${new Date(p.fecha).toLocaleDateString("es-MX")}</td>
    <td>${esc(p.cuentas?.nombre||"")}<div class="muted" style="font-size:11.5px">${esc(p.cuentas?.municipio||"")}</div></td>
    <td>${p.incoterm==="lab_mina" ? "Recoge en banco" : esc(p.direcciones ? p.direcciones.alias+" · "+p.direcciones.municipio : "—")}
      <div class="muted" style="font-size:11.5px">${p.entrega_deseada ? "para el "+p.entrega_deseada : ""}</div></td>
    <td class="right mono"><strong>${mx(p.total)}</strong></td>
    <td><span class="tag ${EST_PED_CLS[p.estatus]||""}">${EST_PED_LABEL[p.estatus]||p.estatus}</span></td>
    <td class="muted" style="font-size:12px">${(p.pedido_partidas||[]).filter(x=>x.lote_id).length}/${(p.pedido_partidas||[]).length} con lote</td>
  </tr>`).join("");
  $$("#pe-body [data-ped]").forEach(tr => tr.onclick = () => abrirPedido(tr.dataset.ped));
}
$("#pe-filtro").onchange = pintarPedidosCRM;

function abrirPedido(id){
  const p = PED.find(x=>x.id===id); if(!p) return;
  $("#scrim").classList.remove("hide"); $("#drawer").classList.remove("hide");
  $("#d-name").textContent = p.folio + " · " + (p.cuentas?.nombre||"");
  $("#d-sub").textContent = `${EST_PED_LABEL[p.estatus]||p.estatus} · ${new Date(p.fecha).toLocaleString("es-MX")}${p.pagado_en ? " · pagado " + new Date(p.pagado_en).toLocaleDateString("es-MX") : ""}`;
  const d = p.direcciones;
  const dir = p.incoterm==="lab_mina" ? "El cliente recoge en el banco (Lagos de Moreno)."
    : d ? `${esc(d.alias)} — ${esc([d.calle,d.colonia,d.municipio,d.estado,d.cp].filter(Boolean).join(", "))}${d.referencias?"<br>Ref.: "+esc(d.referencias):""}${d.contacto?"<br>Contacto en sitio: "+esc(d.contacto)+(d.telefono?" · "+esc(d.telefono):""):""}` : "Sin dirección.";
  const partidas = (p.pedido_partidas||[]).sort((a,b)=>a.orden-b.orden).map(x => {
    const lotes = LOTES.filter(l => l.producto_id===x.producto_id);
    return `<tr>
      <td>${esc(x.descripcion)}<div class="muted" style="font-size:11.5px">${num(x.cantidad)} ${esc(x.unidad)} × ${mx(x.precio_unitario)}${Number(x.flete_unitario)>0?" + "+mx(x.flete_unitario)+" flete":""}</div></td>
      <td class="right mono">${mx(x.importe)}</td>
      <td><select data-lote="${x.id}" style="min-width:150px">
        <option value="">Sin lote</option>
        ${lotes.map(l=>`<option value="${l.id}"${l.id===x.lote_id?" selected":""}>${esc(l.codigo)} · ${l.fecha_produccion||""}${l.fecha_analisis?"":" (sin análisis)"}</option>`).join("")}
      </select>${!lotes.length?'<div class="muted" style="font-size:11px">No hay lotes de este producto; créalo abajo en Lotes.</div>':""}</td>
    </tr>`;
  }).join("");
  $("#d-body").innerHTML = `
    <div class="card pad" style="margin-bottom:12px;font-size:13.5px"><strong>Entrega.</strong> ${dir}
      ${p.entrega_deseada?`<div class="muted" style="margin-top:4px">Fecha deseada: ${p.entrega_deseada}</div>`:""}
      ${p.cuentas?.telefono?`<div class="muted">Tel. cuenta: ${esc(p.cuentas.telefono)}</div>`:""}
      ${p.notas?`<div style="margin-top:6px">Notas: ${esc(p.notas)}</div>`:""}</div>
    <div class="tblwrap card"><table style="min-width:0"><thead><tr><th>Partida</th><th class="right">Importe</th><th>Lote</th></tr></thead><tbody>${partidas}</tbody></table></div>
    <div class="grid" style="margin-top:12px;gap:6px;font-size:13.5px">
      <div class="row" style="justify-content:space-between"><span class="muted">Producto</span><span class="mono">${mx(p.subtotal)}</span></div>
      <div class="row" style="justify-content:space-between"><span class="muted">Flete</span><span class="mono">${mx(p.flete_total)}</span></div>
      <div class="row" style="justify-content:space-between"><span class="muted">IVA</span><span class="mono">${mx(p.iva)}</span></div>
      <div class="row" style="justify-content:space-between;font-weight:650"><span>Total</span><span class="mono">${mx(p.total)}</span></div>
      <div class="muted" style="font-size:12px">${p.metodo_pago?"Pago: "+esc(p.metodo_pago):""}${p.stripe_pago_id?" · "+esc(p.stripe_pago_id):""}</div>
    </div>
    <div class="row" style="margin-top:16px;gap:8px;align-items:flex-end">
      <label class="f" style="flex:1;min-width:180px">Estatus
        <select id="pe-est">${Object.entries(EST_PED_LABEL).map(([k,v])=>`<option value="${k}"${k===p.estatus?" selected":""}>${v}</option>`).join("")}</select></label>
      <button class="btn" id="pe-save">Guardar</button>
    </div>
    <p class="muted" style="font-size:12px;margin-top:8px">Al marcar "Pagado" a mano (transferencia fuera de Stripe) se generan comisiones y avanza la recurrencia igual que con el pago en línea. "En ruta" y "Entregado" se muestran al cliente en su portal.</p>
    <div id="pe-msg"></div>`;
  $("#pe-save").onclick = async () => {
    const btn = $("#pe-save"); btn.disabled = true;
    const est = $("#pe-est").value;
    const errores = [];
    for (const sel of $$("#d-body [data-lote]")) {
      const {error} = await sb.from("pedido_partidas").update({lote_id: sel.value || null}).eq("id", sel.dataset.lote);
      if(error) errores.push(error.message);
    }
    if(est !== p.estatus){
      const upd = {estatus: est};
      if(est==="pagado" && !p.pagado_en){ upd.pagado_en = new Date().toISOString(); upd.metodo_pago = p.metodo_pago || "transferencia"; }
      const {error} = await sb.from("pedidos").update(upd).eq("id", p.id);
      if(error) errores.push(error.message);
      else await sb.from("agentes_bitacora").insert({agente:"jp", tipo:"accion", resumen:`Pedido ${p.folio}: ${EST_PED_LABEL[p.estatus]} → ${EST_PED_LABEL[est]}`, referencia:p.folio});
    }
    btn.disabled = false;
    if(errores.length){ $("#pe-msg").innerHTML = `<p style="color:var(--bad);font-size:13px">${esc(errores.join(" · "))}</p>`; return; }
    cerrarDrawer(); cargarPedidosCRM();
  };
}

// ---------------- lotes
function pintarLotes(){
  const body = $("#lo-body");
  if(!LOTES.length){ body.innerHTML = '<tr><td colspan="7" class="muted">Sin lotes. Registra el primero cuando salga producción del banco.</td></tr>'; return; }
  body.innerHTML = LOTES.map(l => {
    const p = DB.productos.find(x=>x.id===l.producto_id);
    return `<tr>
      <td class="mono"><strong>${esc(l.codigo)}</strong></td>
      <td>${esc(p ? p.nombre + (p.malla?" · "+p.malla:"") : "producto "+l.producto_id)}</td>
      <td class="mono">${l.fecha_produccion||"—"}</td>
      <td class="right mono">${l.toneladas!=null?num(l.toneladas)+" t":"—"}</td>
      <td class="mono">${l.sio2_pct!=null?Number(l.sio2_pct).toFixed(2)+" %":"—"} / ${l.fe2o3_pct!=null?Number(l.fe2o3_pct).toFixed(3)+" %":"—"}</td>
      <td>${l.fecha_analisis?`<span class="tag ok">analizado</span>`:`<span class="tag warn">sin análisis</span>`}</td>
      <td><button class="btn ghost sm" data-lote-edit="${l.id}">Editar</button></td>
    </tr>`;
  }).join("");
  $$("#lo-body [data-lote-edit]").forEach(b => b.onclick = () => formLote(LOTES.find(l=>l.id===b.dataset.loteEdit)));
}
$("#lo-nuevo").onclick = () => formLote(null);

function formLote(l){
  const v = k => l && l[k]!=null ? esc(String(l[k])) : "";
  $("#scrim").classList.remove("hide"); $("#drawer").classList.remove("hide");
  $("#d-name").textContent = l ? "Lote " + l.codigo : "Nuevo lote";
  $("#d-sub").textContent = "Los datos de análisis aparecen en el certificado que el cliente descarga desde su portal.";
  $("#d-body").innerHTML = `
    <div class="grid">
      <div class="row">
        <label class="f" style="flex:1;min-width:140px">Código <input id="l-codigo" value="${v("codigo")}" placeholder="ARS-2609-01"></label>
        <label class="f" style="flex:2;min-width:200px">Producto <select id="l-prod">${DB.productos.map(p=>`<option value="${p.id}"${l&&l.producto_id===p.id?" selected":""}>${esc(p.nombre)}${p.malla?" · "+esc(p.malla):""}</option>`).join("")}</select></label>
      </div>
      <div class="row">
        <label class="f" style="flex:1;min-width:140px">Fecha de producción <input id="l-fprod" type="date" value="${v("fecha_produccion")}"></label>
        <label class="f" style="flex:1;min-width:120px">Toneladas <input id="l-ton" type="number" step="0.1" value="${v("toneladas")}"></label>
      </div>
      <div class="row">
        <label class="f" style="flex:1;min-width:100px">SiO₂ % <input id="l-sio2" type="number" step="0.01" value="${v("sio2_pct")}"></label>
        <label class="f" style="flex:1;min-width:100px">Fe₂O₃ % <input id="l-fe" type="number" step="0.001" value="${v("fe2o3_pct")}"></label>
        <label class="f" style="flex:1;min-width:100px">Al₂O₃ % <input id="l-al" type="number" step="0.01" value="${v("al2o3_pct")}"></label>
        <label class="f" style="flex:1;min-width:100px">Humedad % <input id="l-hum" type="number" step="0.01" value="${v("humedad_pct")}"></label>
      </div>
      <div class="row">
        <label class="f" style="flex:2;min-width:200px">Granulometría <input id="l-gran" value="${v("granulometria")}" placeholder="Malla 16–40, 94 % retenido"></label>
        <label class="f" style="flex:1;min-width:100px">AFS <input id="l-afs" type="number" step="0.1" value="${v("afs")}"></label>
      </div>
      <div class="row">
        <label class="f" style="flex:2;min-width:200px">Laboratorio <input id="l-lab" value="${v("laboratorio")}"></label>
        <label class="f" style="flex:1;min-width:140px">Fecha de análisis <input id="l-fan" type="date" value="${v("fecha_analisis")}"></label>
      </div>
      <label class="f">URL del reporte del laboratorio <input id="l-url" value="${v("certificado_url")}" placeholder="https://…"></label>
      <label class="f">Notas internas (no las ve el cliente) <input id="l-notas" value="${v("notas")}"></label>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn ghost" onclick="cerrarDrawer()">Cancelar</button><button class="btn" id="l-save">Guardar lote</button></div>
      <div id="l-msg"></div>
    </div>`;
  $("#l-save").onclick = async () => {
    const n = s => { const x = $(s).value.trim(); return x==="" ? null : Number(x); };
    const t = s => $(s).value.trim() || null;
    const row = {codigo:t("#l-codigo"), producto_id:Number($("#l-prod").value), fecha_produccion:t("#l-fprod"), toneladas:n("#l-ton"),
      sio2_pct:n("#l-sio2"), fe2o3_pct:n("#l-fe"), al2o3_pct:n("#l-al"), humedad_pct:n("#l-hum"), granulometria:t("#l-gran"), afs:n("#l-afs"),
      laboratorio:t("#l-lab"), fecha_analisis:t("#l-fan"), certificado_url:t("#l-url"), notas:t("#l-notas")};
    if(!row.codigo) return $("#l-msg").innerHTML = '<p style="color:var(--bad);font-size:13px">El código es obligatorio.</p>';
    $("#l-save").disabled = true;
    const q = l ? sb.from("lotes").update(row).eq("id", l.id) : sb.from("lotes").insert(row);
    const {error} = await q;
    $("#l-save").disabled = false;
    if(error) return $("#l-msg").innerHTML = `<p style="color:var(--bad);font-size:13px">${esc(error.message)}</p>`;
    cerrarDrawer(); cargarPedidosCRM();
  };
}

$("#tabs").addEventListener("click", e => { if(e.target.closest('button[data-v="pedidos"]')) cargarPedidosCRM(); });
sb.auth.getSession().then(({data:{session}}) => {
  if(!session) return;
  sb.from("pedidos").select("id",{count:"exact",head:true}).in("estatus",["pendiente_pago","pagado"])
    .then(({count}) => { if(count) $('#tabs button[data-v="pedidos"]').textContent = `Pedidos (${count})`; });
});
