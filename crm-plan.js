// ============================================================
// Plan de hoy: los borradores del agente comercial, listos para ejecutar y registrar
// ============================================================
async function cargarPlanHoy(){
  const desde = new Date(); desde.setHours(desde.getHours()-36);
  const {data} = await sb.from("agentes_bitacora")
    .select("id,resumen,referencia,detalle,creado_en")
    .eq("agente","comercial").eq("tipo","borrador").gte("creado_en", desde.toISOString())
    .order("creado_en");
  const rows = (data||[]).filter(r => !(r.detalle||{}).hecho);
  const porCuenta = {};
  rows.forEach(r => { const d=r.detalle||{}; const k=d.cuenta_id||r.referencia; (porCuenta[k] ||= {nombre:r.referencia, cuenta_id:d.cuenta_id, telefono:d.telefono, contacto:d.contacto, items:[]}).items.push(r); });
  const cont = $("#plan-hoy"); if(!cont) return;
  const cuentas = Object.values(porCuenta);
  $("#plan-n").textContent = cuentas.length ? `${cuentas.length} cuentas` : "";
  if(!cuentas.length){ cont.innerHTML = '<p class="muted" style="font-size:13px">Sin plan cargado. El agente comercial lo deja aquí de lunes a viernes a las 8:00; también puedes trabajar desde Agenda y Prospectos.</p>'; return; }
  cont.innerHTML = cuentas.map((c,i) => {
    const tel = (c.telefono||"").replace(/\D/g,""); const tel52 = tel.length===10 ? "52"+tel : tel;
    const cta = DB.cuentas.find(x=>x.id===c.cuenta_id);
    const items = c.items.map(r => {
      const d=r.detalle||{}; const wa = d.canal==="whatsapp";
      const btnWa = wa && tel ? `<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${tel52}?text=${encodeURIComponent((d.texto||"").replace(/\[nombre\]/g, c.contacto||""))}">Abrir WhatsApp</a>` : "";
      return `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:13px"><strong>${esc(r.resumen.replace(" · "+c.nombre,""))}</strong> <span class="muted">· ${d.canal||""}</span>${d.nota?` <span class="muted" style="font-size:11.5px">— ${esc(d.nota)}</span>`:""}</summary>
        <pre style="white-space:pre-wrap;font:inherit;font-size:12.5px;margin:6px 0;background:var(--accent-soft,#f4e9e0);padding:8px;border-radius:6px">${esc(d.texto||"")}</pre>
        <div class="row" style="gap:6px">${btnWa}<button class="btn ghost sm" data-copy="${r.id}">Copiar texto</button></div>
        <textarea data-txt="${r.id}" style="display:none">${esc(d.texto||"")}</textarea></details>`;
    }).join("");
    return `<div class="card pad" style="margin-bottom:10px" data-plan="${c.cuenta_id||i}">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px">
        <div><strong>${esc(c.nombre)}</strong>${cta?` <span class="muted" style="font-size:12px">· ${SEG_LABEL[cta.segmento]||cta.segmento} · ${esc(cta.municipio||"")}</span>`:""}
          <div class="muted" style="font-size:12px">${tel?`<a href="tel:+${tel52}">${esc(c.telefono)}</a>`:"sin teléfono"}${c.contacto?" · "+esc(c.contacto):""}</div></div>
        <div class="row" style="gap:6px">${c.cuenta_id?`<button class="btn ghost sm" data-ver="${c.cuenta_id}">Ficha</button>`:""}<button class="btn sm" data-reg="${c.cuenta_id||""}" data-ids="${c.items.map(r=>r.id).join(",")}" data-nombre="${esc(c.nombre)}">Registrar toque</button></div>
      </div>${items}</div>`;
  }).join("");
  $$("#plan-hoy [data-copy]").forEach(b => b.onclick = () => { const t=$(`[data-txt="${b.dataset.copy}"]`); navigator.clipboard.writeText(t.value).then(()=>{ b.textContent="Copiado"; setTimeout(()=>b.textContent="Copiar texto",1500); }); });
  $$("#plan-hoy [data-ver]").forEach(b => b.onclick = () => abrirCuenta(b.dataset.ver));
  $$("#plan-hoy [data-reg]").forEach(b => b.onclick = () => registrarToque(b.dataset.reg, b.dataset.ids.split(","), b.dataset.nombre));
}

function registrarToque(cuentaId, ids, nombre){
  const en2 = new Date(Date.now()+2*864e5).toISOString().slice(0,10);
  $("#scrim").classList.remove("hide"); $("#drawer").classList.remove("hide");
  $("#d-name").textContent = "Registrar toque · " + nombre;
  $("#d-sub").textContent = "Queda en actividades con fecha de siguiente contacto (así aparece en Agenda) y el plan de hoy lo da por hecho.";
  $("#d-body").innerHTML = `
    <div class="grid">
      <div class="row">
        <label class="f" style="flex:1;min-width:140px">Canal <select id="t-tipo"><option value="llamada">Llamada</option><option value="whatsapp">WhatsApp</option><option value="correo">Correo</option><option value="visita">Visita</option></select></label>
        <label class="f" style="flex:1;min-width:140px">Resultado <select id="t-res">
          <option value="Conseguí nombre y WhatsApp del comprador">Conseguí nombre y WhatsApp del comprador</option>
          <option value="Envié precio y ficha técnica por WhatsApp">Envié precio y ficha técnica por WhatsApp</option>
          <option value="No contestan; reintentar">No contestan; reintentar</option>
          <option value="Piden que llame en otro momento">Piden que llame en otro momento</option>
          <option value="Piden muestra">Piden muestra</option>
          <option value="Piden cotización formal">Piden cotización formal</option>
          <option value="Ya tienen proveedor; quedamos como segunda fuente">Ya tienen proveedor; quedamos como segunda fuente</option>
          <option value="No les interesa">No les interesa</option></select></label>
      </div>
      <label class="f">Detalle (nombre del comprador, celular, lo que dijo) <input id="t-det" placeholder="Ej. Compras: Ing. Pérez, 477 123 4567, hoy usan arena de Monterrey a $3,400"></label>
      <div class="row">
        <label class="f" style="flex:2;min-width:200px">Siguiente paso <input id="t-next" value="Toque 3: ¿pudo verlo? + ofrecer muestra"></label>
        <label class="f" style="flex:1;min-width:140px">Fecha siguiente <input id="t-fecha" type="date" value="${en2}"></label>
      </div>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn ghost" onclick="cerrarDrawer()">Cancelar</button><button class="btn" id="t-save">Guardar</button></div>
      <div id="t-msg"></div>
    </div>`;
  $("#t-save").onclick = async () => {
    const btn=$("#t-save"); btn.disabled=true;
    const res = $("#t-res").value, det = $("#t-det").value.trim();
    const resumen = det ? `${res}. ${det}` : res;
    if(cuentaId){
      const {error} = await sb.from("actividades").insert({cuenta_id: cuentaId, tipo: $("#t-tipo").value, resumen, siguiente_paso: $("#t-next").value.trim()||null, fecha_siguiente: $("#t-fecha").value||null, completada: !$("#t-fecha").value});
      if(error){ btn.disabled=false; return $("#t-msg").innerHTML = `<p style="color:var(--bad);font-size:13px">${esc(error.message)}</p>`; }
      const cta = DB.cuentas.find(x=>x.id===cuentaId);
      if(cta && cta.estatus==="prospecto") await sb.from("cuentas").update({estatus:"contactado"}).eq("id",cuentaId);
      if(res.startsWith("No les interesa")) await sb.from("cuentas").update({estatus:"inactivo"}).eq("id",cuentaId);
    }
    for(const id of ids.filter(Boolean)){
      const {data:r} = await sb.from("agentes_bitacora").select("detalle").eq("id",id).single();
      await sb.from("agentes_bitacora").update({detalle: {...(r?.detalle||{}), hecho:true, hecho_en:new Date().toISOString(), resultado:res}}).eq("id",id);
    }
    await sb.from("agentes_bitacora").insert({agente:"jp", tipo:"accion", resumen:`Toque registrado · ${nombre}: ${res}`, referencia:nombre, detalle:{cuenta_id:cuentaId, siguiente:$("#t-next").value, fecha_siguiente:$("#t-fecha").value}});
    cerrarDrawer(); cargarPlanHoy(); cargarTodo();
  };
}

$("#tabs").addEventListener("click", e => { if(e.target.closest('button[data-v="tablero"]')) cargarPlanHoy(); });
