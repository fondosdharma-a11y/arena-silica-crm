function pintarTablero(){
  const act = DB.cuentas.filter(c=>c.estatus!=="descartado");
  const clientes = act.filter(c=>c.estatus==="cliente").length;
  const ton = act.reduce((s,c)=>s+(Number(c.potencial_ton_mes)||0),0);
  const p1 = act.filter(c=>c.prioridad===1).length;
  const pend = DB.agenda.filter(a=>a.dias_restantes<=0).length;
  $("#kpis").innerHTML = [
    ["Prospectos activos", act.length],
    ["Prioridad 1", p1],
    ["Clientes", clientes],
    ["Potencial t/mes", num(ton)],
    ["Cotizaciones", DB.cotizaciones.length],
    ["Seguimientos vencidos", pend]
  ].map(([l,n])=>`<div class="kpi"><div class="l">${l}</div><div class="n mono">${n}</div></div>`).join("");

  const bySeg = {};
  act.forEach(c=>{ bySeg[c.segmento]=(bySeg[c.segmento]||0)+(Number(c.potencial_ton_mes)||0); });
  const max = Math.max(1,...Object.values(bySeg));
  $("#seg-bars").innerHTML = Object.entries(bySeg).sort((a,b)=>b[1]-a[1]).map(([s,v])=>`
    <div style="margin-bottom:10px">
      <div class="row" style="justify-content:space-between;font-size:12.5px">
        <span>${SEG_LABEL[s]||s}</span><span class="mono muted">${num(v)} t</span></div>
      <div class="bar"><i style="width:${v/max*100}%"></i></div>
    </div>`).join("");

  $("#top-list").innerHTML = act.filter(c=>c.prioridad===1).slice(0,10).map(c=>`
    <div class="row" style="justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);cursor:pointer" data-id="${c.id}">
      <div><strong>${esc(c.nombre)}</strong><div class="muted" style="font-size:12px">${SEG_LABEL[c.segmento]} · ${esc(c.municipio||"")}</div></div>
      <span class="mono muted">${c.potencial_ton_mes?num(c.potencial_ton_mes)+" t":""}</span>
    </div>`).join("") || '<p class="muted">Sin prioridad 1.</p>';
  $("#top-list").onclick = e => { const r=e.target.closest("[data-id]"); if(r) abrirCuenta(r.dataset.id); };
}

function filtrados(){
  const q=$("#p-q").value.toLowerCase().trim(), seg=$("#p-seg").value, edo=$("#p-edo").value,
        est=$("#p-est").value, pri=$("#p-pri").value;
  return DB.cuentas.filter(c=>{
    if(seg && c.segmento!==seg) return false;
    if(edo && c.estado!==edo) return false;
    if(est ? c.estatus!==est : c.estatus==="descartado") return false;
    if(pri && String(c.prioridad)!==pri) return false;
    if(q && !([c.nombre,c.municipio,c.subsegmento,c.producto_objetivo,c.estado].join(" ").toLowerCase().includes(q))) return false;
    return true;
  });
}
function pintarProspectos(){
  const rows = filtrados();
  const zmap = Object.fromEntries(DB.zonas.map(z=>[z.id,z]));
  $("#p-body").innerHTML = rows.map(c=>{
    const z = zmap[c.zona_flete_id];
    return `<tr data-id="${c.id}">
      <td><strong>${esc(c.nombre)}</strong><div class="muted" style="font-size:11.5px">${esc(c.subsegmento||"")}</div></td>
      <td>${SEG_LABEL[c.segmento]||c.segmento}</td>
      <td>${esc(c.municipio||"")}<div class="muted" style="font-size:11.5px">${esc(c.estado||"")}</div></td>
      <td>${z?esc(z.nombre):"—"}<div class="muted mono" style="font-size:11.5px">${z?mx(z.precio_cliente_ton)+"/t":""}</div></td>
      <td class="right mono">${c.potencial_ton_mes?num(c.potencial_ton_mes):"—"}</td>
      <td class="mono" style="font-size:12px">${esc(c.producto_objetivo||"—")}</td>
      <td><span class="tag">${EST_LABEL[c.estatus]}</span></td>
      <td><span class="tag ${c.prioridad===1?"p1":c.prioridad===2?"p2":""}">${c.prioridad}</span></td>
    </tr>`;}).join("");
  $("#p-count").textContent = `${rows.length} de ${DB.cuentas.length} registros.`;
}
["p-q","p-seg","p-edo","p-est","p-pri"].forEach(id=>{
  $("#"+id).addEventListener("input", pintarProspectos);
});
$("#p-body").onclick = e => { const r=e.target.closest("tr[data-id]"); if(r) abrirCuenta(r.dataset.id); };

$("#p-new").onclick = async () => {
  const nombre = prompt("Nombre de la empresa:"); if(!nombre) return;
  const {error} = await sb.from("cuentas").insert({nombre, segmento:"otro", estatus:"prospecto", prioridad:3});
  if(error) return alert(error.message);
  cargarTodo();
};

let CUR = null;
async function abrirCuenta(id){
  CUR = DB.cuentas.find(c=>c.id===id); if(!CUR) return;
  $("#scrim").classList.remove("hide"); $("#drawer").classList.remove("hide");
  $("#d-name").textContent = CUR.nombre;
  $("#d-sub").textContent = [SEG_LABEL[CUR.segmento], CUR.subsegmento, [CUR.municipio,CUR.estado].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  $("#d-body").innerHTML = '<p class="muted">Cargando…</p>';
  const [ct,ac] = await Promise.all([
    sb.from("contactos").select("*").eq("cuenta_id",id),
    sb.from("actividades").select("*").eq("cuenta_id",id).order("fecha",{ascending:false}).limit(30)
  ]);
  const z = DB.zonas.find(z=>z.id===CUR.zona_flete_id);
  const tel = (CUR.telefono||"").replace(/\D/g,"");
  $("#d-body").innerHTML = `
    <div class="row">
      ${tel?`<a class="btn sm" href="tel:+52${tel}">Llamar</a>
             <a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/52${tel}?text=${encodeURIComponent(waMsg(CUR))}">WhatsApp</a>`:'<span class="muted">Sin teléfono registrado</span>'}
      ${CUR.sitio_web?`<a class="btn ghost sm" target="_blank" rel="noopener" href="https://${CUR.sitio_web.replace(/^https?:\/\//,"")}">Sitio</a>`:""}
      <button class="btn ghost sm" id="d-cot">Cotizar</button>
    </div>

    <div class="sec"><h3>Ficha</h3>
      <div class="row" style="gap:14px">
        <label class="f">Estatus <select id="d-est">${Object.entries(EST_LABEL).map(([k,v])=>`<option value="${k}" ${k===CUR.estatus?"selected":""}>${v}</option>`).join("")}</select></label>
        <label class="f">Prioridad <select id="d-pri">${[1,2,3,4,5].map(p=>`<option ${p===CUR.prioridad?"selected":""}>${p}</option>`).join("")}</select></label>
        <label class="f">t/mes <input id="d-ton" type="number" step="0.1" value="${CUR.potencial_ton_mes??""}" style="width:110px"></label>
      </div>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0">
        Zona ${z?esc(z.nombre)+" · "+z.km_desde_lagos+" km · flete "+mx(z.precio_cliente_ton)+"/t":"sin asignar"}<br>
        Producto objetivo: <span class="mono">${esc(CUR.producto_objetivo||"—")}</span>
      </p>
      ${CUR.notas?`<p style="font-size:13px;margin:10px 0 0">${esc(CUR.notas)}</p>`:""}
      ${CUR.fuente_url?`<p class="muted" style="font-size:11.5px;margin:6px 0 0"><a href="${esc(CUR.fuente_url)}" target="_blank" rel="noopener">Fuente</a></p>`:""}
    </div>

    <div class="sec"><h3>Contactos</h3>
      ${(ct.data||[]).map(c=>`<div style="padding:6px 0;border-bottom:1px solid var(--line)">
        <strong>${esc(c.nombre)}</strong> <span class="muted">${esc(c.puesto||"")}</span>
        <div class="muted mono" style="font-size:12px">${esc(c.telefono||"")} ${esc(c.email||"")}</div></div>`).join("")
        || '<p class="muted" style="font-size:13px">Sin contactos. El primer objetivo de la llamada es conseguir el nombre del comprador.</p>'}
      <button class="btn ghost sm" id="d-newct" style="margin-top:8px">+ Contacto</button>
    </div>

    <div class="sec"><h3>Registrar actividad</h3>
      <div class="grid">
        <div class="row">
          <label class="f">Tipo <select id="d-tipo">
            <option value="llamada">Llamada</option><option value="whatsapp">WhatsApp</option>
            <option value="correo">Correo</option><option value="visita">Visita</option>
            <option value="muestra">Muestra</option><option value="nota">Nota</option></select></label>
          <label class="f" style="flex:1;min-width:150px">Siguiente contacto <input id="d-fecha" type="date"></label>
        </div>
        <label class="f">Qué pasó <textarea id="d-res" rows="2" placeholder="Con quién hablé, qué necesita, qué compra hoy y a quién"></textarea></label>
        <label class="f">Siguiente paso <input id="d-next" placeholder="Enviar cotización de 20 t malla 20-30"></label>
        <button class="btn" id="d-save">Guardar actividad</button>
      </div>
    </div>

    <div class="sec"><h3>Historial</h3>
      ${(ac.data||[]).map(a=>`<div class="act">
        <div style="font-size:12px" class="muted">${new Date(a.fecha).toLocaleDateString("es-MX")} · ${a.tipo}</div>
        <div style="font-size:13px">${esc(a.resumen)}</div>
        ${a.siguiente_paso?`<div class="muted" style="font-size:12px">→ ${esc(a.siguiente_paso)} ${a.fecha_siguiente?"("+a.fecha_siguiente+")":""}</div>`:""}
      </div>`).join("") || '<p class="muted" style="font-size:13px">Sin actividad registrada.</p>'}
    </div>`;

  $("#d-est").onchange = $("#d-pri").onchange = $("#d-ton").onchange = async () => {
    await sb.from("cuentas").update({
      estatus: $("#d-est").value, prioridad: Number($("#d-pri").value),
      potencial_ton_mes: $("#d-ton").value===""?null:Number($("#d-ton").value)
    }).eq("id", CUR.id);
    cargarTodo();
  };
  $("#d-save").onclick = async () => {
    if(!$("#d-res").value.trim()) return alert("Escribe qué pasó.");
    const {error} = await sb.from("actividades").insert({
      cuenta_id: CUR.id, tipo: $("#d-tipo").value, resumen: $("#d-res").value.trim(),
      siguiente_paso: $("#d-next").value.trim()||null,
      fecha_siguiente: $("#d-fecha").value||null,
      completada: !$("#d-fecha").value
    });
    if(error) return alert(error.message);
    if(CUR.estatus==="prospecto") await sb.from("cuentas").update({estatus:"contactado"}).eq("id",CUR.id);
    abrirCuenta(CUR.id); cargarTodo();
  };
  $("#d-newct").onclick = async () => {
    const nombre = prompt("Nombre del contacto:"); if(!nombre) return;
    const puesto = prompt("Puesto (opcional):")||null;
    const telefono = prompt("Teléfono (opcional):")||null;
    await sb.from("contactos").insert({cuenta_id:CUR.id,nombre,puesto,telefono});
    abrirCuenta(CUR.id);
  };
  $("#d-cot").onclick = () => {
    cerrarDrawer();
    $$("#tabs button").forEach(x=>x.setAttribute("aria-current", x.dataset.v==="cotizador"));
    $$("main > section").forEach(s=>s.classList.add("hide"));
    $("#v-cotizador").classList.remove("hide");
    $("#q-cuenta").value = CUR.id; sincronizarZona();
  };
}
function waMsg(c){
  return `Buen día. Le escribe ${EMPRESA.contacto} de ${EMPRESA.nombre}, banco de arena sílica en ${EMPRESA.lugar}. `
    + `Trabajamos con ${esc(c.subsegmento||SEG_LABEL[c.segmento]||"empresas como la suya")} y quería preguntarle quién ve la compra de arena sílica en ${c.nombre}. `
    + `Entregamos en ${c.municipio||"su zona"} y le puedo pasar precio y ficha técnica hoy mismo.`;
}
function cerrarDrawer(){ $("#scrim").classList.add("hide"); $("#drawer").classList.add("hide"); }
$("#scrim").onclick = cerrarDrawer; $("#d-close").onclick = cerrarDrawer;
