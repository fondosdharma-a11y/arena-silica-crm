function pintarCatalogo(){
  $("#cat-body").innerHTML = DB.productos.map(p=>{
    const m = p.costo_unitario ? (p.precio_lista - p.costo_unitario)/p.precio_lista*100 : null;
    return `<tr>
      <td class="mono">${esc(p.sku)}</td>
      <td>${esc(p.nombre)}<div class="muted" style="font-size:11.5px">${esc((p.ficha_tecnica||"").slice(0,90))}</div></td>
      <td>${esc(p.malla||"—")}</td><td>${PRES_LABEL[p.presentacion]}</td>
      <td class="right mono">${p.costo_unitario?mx(p.costo_unitario):"—"}</td>
      <td class="right mono"><strong>${mx(p.precio_lista)}</strong></td>
      <td class="right mono muted">${p.precio_piso?mx(p.precio_piso):"—"}</td>
      <td class="right mono"><span class="tag ${m>=55?"ok":m>=40?"warn":"bad"}">${m?m.toFixed(0)+"%":"—"}</span></td>
      <td>${p.requiere_certificado?'<span class="tag warn">sí</span>':""}</td>
    </tr>`;}).join("");
  $("#z-body").innerHTML = DB.zonas.map(z=>`<tr>
    <td><strong>${esc(z.nombre)}</strong> <span class="muted mono">${esc(z.clave)}</span></td>
    <td class="muted" style="font-size:12px">${esc(z.cobertura)}</td>
    <td class="right mono">${z.km_desde_lagos}</td>
    <td class="right mono muted">${mx(z.costo_torton_ton)}</td>
    <td class="right mono muted">${mx(z.costo_trailer_ton)}</td>
    <td class="right mono"><strong>${mx(z.precio_cliente_ton)}</strong></td>
  </tr>`).join("");
}

function prepararCotizador(){
  const sel = $("#q-cuenta"), prev = sel.value;
  sel.innerHTML = DB.cuentas.filter(c=>c.estatus!=="descartado")
    .map(c=>`<option value="${c.id}">${esc(c.nombre)} — ${esc(c.municipio||"")}</option>`).join("");
  $("#q-zona").innerHTML = DB.zonas.map(z=>`<option value="${z.id}">${esc(z.nombre)} · ${z.km_desde_lagos} km · ${mx(z.precio_cliente_ton)}/t</option>`).join("");
  if(prev) sel.value = prev;
  sincronizarZona();
  if(!QLINES.length) addLine();
}
function sincronizarZona(){
  const c = DB.cuentas.find(x=>x.id===$("#q-cuenta").value);
  if(c?.zona_flete_id) $("#q-zona").value = c.zona_flete_id;
  render();
}
$("#q-cuenta").onchange = sincronizarZona;
$("#q-zona").onchange = render;
$("#q-inco").onchange = render;
$("#q-add").onclick = () => { addLine(); };

function addLine(){
  QLINES.push({producto_id: DB.productos[0]?.id, cantidad: 1, precio: DB.productos[0]?.precio_lista||0});
  render();
}
function fleteTon(){
  if($("#q-inco").value==="lab_mina") return 0;
  const z = DB.zonas.find(z=>z.id===Number($("#q-zona").value));
  return z ? Number(z.precio_cliente_ton) : 0;
}
function render(){
  const zf = fleteTon();
  $("#q-lines").innerHTML = QLINES.map((l,i)=>{
    const p = DB.productos.find(p=>p.id===Number(l.producto_id));
    const fl = p ? zf * (Number(p.kg_por_unidad)/1000) : 0;
    const imp = (Number(l.cantidad)||0) * ((Number(l.precio)||0) + fl);
    return `<div class="q-line" data-i="${i}">
      <label class="f">Producto <select data-k="producto_id">${DB.productos.map(p2=>
        `<option value="${p2.id}" ${p2.id===Number(l.producto_id)?"selected":""}>${esc(p2.sku)} — ${esc(p2.nombre)}</option>`).join("")}</select></label>
      <label class="f">Cantidad <input type="number" step="0.01" min="0.01" data-k="cantidad" value="${l.cantidad}"></label>
      <label class="f">Precio unit. <input type="number" step="1" data-k="precio" value="${l.precio}"></label>
      <label class="f">Flete unit. <input value="${mx(fl)}" disabled></label>
      <label class="f">Importe <input value="${mx(imp)}" disabled></label>
      <button class="btn ghost sm" data-del="${i}" style="margin-bottom:2px">×</button>
    </div>`;}).join("");

  $$("#q-lines [data-k]").forEach(el=>{
    el.onchange = e => {
      const i = Number(e.target.closest("[data-i]").dataset.i), k = e.target.dataset.k;
      QLINES[i][k] = e.target.value;
      if(k==="producto_id"){
        const p = DB.productos.find(p=>p.id===Number(e.target.value));
        QLINES[i].precio = p?.precio_lista||0;
      }
      render();
    };
  });
  $$("#q-lines [data-del]").forEach(b=>b.onclick=()=>{QLINES.splice(Number(b.dataset.del),1);render();});

  let sub=0, fle=0, costo=0, avisos=[];
  QLINES.forEach(l=>{
    const p = DB.productos.find(p=>p.id===Number(l.producto_id)); if(!p) return;
    const q = Number(l.cantidad)||0, pu = Number(l.precio)||0;
    sub += q*pu; fle += q*zf*(Number(p.kg_por_unidad)/1000);
    costo += q*(Number(p.costo_unitario)||0);
    if(p.precio_piso && pu < Number(p.precio_piso))
      avisos.push(`${p.sku} está en ${mx(pu)}, por debajo del piso autorizado de ${mx(p.precio_piso)}.`);
    if(p.requiere_certificado)
      avisos.push(`${p.sku} exige certificado de laboratorio por lote antes de entregar.`);
  });
  $("#q-sub").textContent = mx(sub); $("#q-fle").textContent = mx(fle);
  $("#q-iva").textContent = mx((sub+fle)*.16); $("#q-tot").textContent = mx((sub+fle)*1.16);
  const mar = sub? (sub-costo)/sub*100 : 0;
  $("#q-mar").innerHTML = sub? `<span class="tag ${mar>=55?"ok":mar>=40?"warn":"bad"}">${mar.toFixed(0)} % · ${mx(sub-costo)}</span>` : "—";
  const al = $("#q-alert");
  if(avisos.length){ al.classList.remove("hide"); al.innerHTML = [...new Set(avisos)].join("<br>"); }
  else al.classList.add("hide");
}

$("#q-save").onclick = async () => {
  const cuenta_id = $("#q-cuenta").value;
  if(!cuenta_id || !QLINES.length) return alert("Elige cliente y agrega al menos una partida.");
  const {data:cot, error} = await sb.from("cotizaciones").insert({
    cuenta_id, incoterm: $("#q-inco").value,
    zona_flete_id: $("#q-inco").value==="lab_mina" ? null : Number($("#q-zona").value),
    vigencia_dias: Number($("#q-vig").value)||15
  }).select().single();
  if(error) return alert(error.message);
  const zf = fleteTon();
  const partidas = QLINES.map((l,i)=>{
    const p = DB.productos.find(p=>p.id===Number(l.producto_id));
    return {cotizacion_id: cot.id, producto_id: p.id,
      descripcion: `${p.nombre}${p.malla?" · "+p.malla:""} · ${PRES_LABEL[p.presentacion]}`,
      cantidad: Number(l.cantidad), unidad: p.unidad,
      precio_unitario: Number(l.precio), flete_unitario: zf*(Number(p.kg_por_unidad)/1000), orden:i+1};
  });
  const {error:e2} = await sb.from("cotizacion_partidas").insert(partidas);
  if(e2) return alert(e2.message);
  await sb.from("cuentas").update({estatus:"cotizado"}).eq("id",cuenta_id);
  alert("Cotización " + cot.folio + " guardada.");
  QLINES = []; addLine(); cargarTodo();
};

$("#q-print").onclick = () => {
  const c = DB.cuentas.find(x=>x.id===$("#q-cuenta").value);
  const zf = fleteTon(), z = DB.zonas.find(z=>z.id===Number($("#q-zona").value));
  let sub=0, fle=0;
  const rows = QLINES.map(l=>{
    const p = DB.productos.find(p=>p.id===Number(l.producto_id)); if(!p) return "";
    const q=Number(l.cantidad)||0, pu=Number(l.precio)||0, f=zf*(Number(p.kg_por_unidad)/1000);
    sub+=q*pu; fle+=q*f;
    return `<tr><td>${esc(p.nombre)}${p.malla?" · "+esc(p.malla):""}<br><span style="font-size:11px;color:#666">${esc(p.sku)} · ${PRES_LABEL[p.presentacion]}</span></td>
      <td class="right">${num(q)} ${esc(p.unidad)}</td><td class="right">${mx(pu)}</td>
      <td class="right">${mx(f)}</td><td class="right">${mx(q*(pu+f))}</td></tr>`;
  }).join("");
  $("#printsheet").innerHTML = `
    <div style="font-family:ui-sans-serif,system-ui;padding:32px;max-width:760px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #8C4A22;padding-bottom:14px">
        <div style="display:flex;gap:12px;align-items:flex-start">
          <svg width="32" height="36" viewBox="-95 -108 190 216"><path d="M0,-100 L86.6,-50 L86.6,50 L0,0 Z" fill="#E9CFA4"/><path d="M86.6,50 L0,100 L-86.6,50 L0,0 Z" fill="#8C4A22"/><path d="M-86.6,50 L-86.6,-50 L0,-100 L0,0 Z" fill="#C98A3C"/><path d="M0,-44 L38.11,-22 L38.11,22 L0,44 L-38.11,22 L-38.11,-22 Z" fill="#F4E3C8"/></svg>
          <div><h1 style="font-size:22px;margin:0;letter-spacing:.08em">${EMPRESA.nombre}</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#555">Banco de arena sílica · ${EMPRESA.lugar}<br>
          ${EMPRESA.contacto} · Tel. y WhatsApp ${EMPRESA.tel}</p></div>
        </div>
        <div style="text-align:right;font-size:12px">
          <strong style="font-size:15px">COTIZACIÓN</strong><br>
          ${new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"})}<br>
          Vigencia: ${$("#q-vig").value} días</div>
      </div>
      <p style="font-size:13px;margin:16px 0 4px"><strong>Para:</strong> ${esc(c?.nombre||"")} — ${esc(c?.municipio||"")}, ${esc(c?.estado||"")}</p>
      <p style="font-size:12px;color:#555;margin:0 0 14px">
        Entrega: ${$("#q-inco").value==="lab_mina"
          ? "Carga en mina, Lagos de Moreno. El cliente pone la unidad."
          : "Entregada en planta del cliente · "+esc(z?.nombre||"")+" · "+(z?.km_desde_lagos||0)+" km"}<br>
        Tiempo de entrega: 48 a 72 horas hábiles a partir de la confirmación.<br>
        Condiciones: contado contra entrega. Crédito sujeto a autorización.</p>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="background:#F4E3C8">
          <th style="text-align:left;padding:7px">Producto</th><th style="text-align:right;padding:7px">Cantidad</th>
          <th style="text-align:right;padding:7px">Precio</th><th style="text-align:right;padding:7px">Flete</th>
          <th style="text-align:right;padding:7px">Importe</th></tr></thead>
        <tbody>${rows}</tbody></table>
      <div style="margin-top:14px;text-align:right;font-size:13px">
        <div>Producto: <strong>${mx(sub)}</strong></div>
        <div>Flete: <strong>${mx(fle)}</strong></div>
        <div>IVA 16 %: <strong>${mx((sub+fle)*.16)}</strong></div>
        <div style="font-size:17px;border-top:1px solid #ccc;margin-top:6px;padding-top:6px">
          Total: <strong>${mx((sub+fle)*1.16)}</strong></div>
      </div>
      <p style="font-size:11px;color:#666;margin-top:22px;border-top:1px solid #ddd;padding-top:10px">
        Precios en pesos mexicanos. Cada entrega se acompaña de remisión con número de lote.
        Análisis de laboratorio disponible bajo solicitud para los grados que lo requieren.</p>
    </div>`;
  $("#printsheet").style.display="block";
  window.print();
  setTimeout(()=>{$("#printsheet").style.display="none";},500);
};

function pintarCotizaciones(){
  $("#c-body").innerHTML = DB.cotizaciones.map(c=>`<tr>
    <td class="mono"><strong>${esc(c.folio)}</strong></td>
    <td>${esc(c.cuentas?.nombre||"")}</td>
    <td class="mono">${c.fecha}</td>
    <td>${c.incoterm==="lab_mina"?"Recoge en mina":"Entregada"}</td>
    <td class="right mono">${mx(c.subtotal)}</td>
    <td class="right mono">${mx(c.flete_total)}</td>
    <td class="right mono"><strong>${mx(c.total)}</strong></td>
    <td><select data-cot-est="${c.id}" style="font-size:12px">${["borrador","enviada","aceptada","rechazada","vencida"].map(e=>`<option value="${e}"${e===c.estatus?" selected":""}>${COT_EST_LABEL[e]}</option>`).join("")}</select></td>
  </tr>`).join("") || '<tr><td colspan="8" class="muted">Todavía no hay cotizaciones.</td></tr>';
  $$("#c-body [data-cot-est]").forEach(sel => sel.onchange = async () => {
    const {error} = await sb.from("cotizaciones").update({estatus: sel.value, actualizado_en: new Date().toISOString()}).eq("id", sel.dataset.cotEst);
    if(error) return alert(error.message);
    const c = DB.cotizaciones.find(x=>x.id===sel.dataset.cotEst); if(c) c.estatus = sel.value;
  });
}
// "Enviada" es la que el cliente ve en su portal (arensil.com/pedidos → Cotizaciones) y puede aceptar: se vuelve pedido con los precios cotizados.
const COT_EST_LABEL = {borrador:"Borrador (interna)", enviada:"Enviada · visible al cliente", aceptada:"Aceptada", rechazada:"Rechazada", vencida:"Vencida"};
function pintarAgenda(){
  $("#a-body").innerHTML = DB.agenda.map(a=>{
    const d = a.dias_restantes;
    const cls = d<0?"bad":d<=2?"warn":"ok";
    const tel = (a.telefono||"").replace(/\D/g,"");
    return `<tr>
      <td><span class="tag ${cls}">${a.fecha_siguiente}</span><div class="muted" style="font-size:11.5px">${d<0?Math.abs(d)+" días tarde":d===0?"hoy":"en "+d+" días"}</div></td>
      <td>${esc(a.cuenta)}</td><td>${a.tipo}</td>
      <td>${esc(a.siguiente_paso||"")}</td>
      <td class="muted" style="font-size:12px">${esc((a.resumen||"").slice(0,80))}</td>
      <td>${tel?`<a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/52${tel}">WhatsApp</a>`:""}</td>
    </tr>`;}).join("");
  $("#a-empty").textContent = DB.agenda.length ? "" : "No hay seguimientos programados. Al registrar una actividad, pon fecha de siguiente contacto para que aparezca aquí.";
}

boot();
