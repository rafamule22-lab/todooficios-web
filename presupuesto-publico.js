/* Vista pública de un presupuesto — TodoOficios.es
   Lee y actualiza SOLO la clave "presupuesto-publico:<id>" del almacén compartido,
   nunca los datos completos del profesional (negocio:<email>). */
(function(){
  "use strict";

  var CLOUD_NAMESPACE = 'todooficios:v1';
  var cloudClient = null, cloudEnabled = false, cloudInitPromise = null;

  function hasCloudConfig(){
    var cfg = window.TODOOFICIOS_LEGAL || {};
    if(!window.supabase || !window.supabase.createClient) return false;
    if(!cfg.supabaseUrl || cfg.supabaseUrl.indexOf('PENDIENTE_') === 0) return false;
    if(!cfg.supabaseAnonKey || cfg.supabaseAnonKey.indexOf('PENDIENTE_') === 0) return false;
    return true;
  }

  function initCloudClient(){
    if(cloudInitPromise) return cloudInitPromise;
    cloudInitPromise = (function(){
      if(!hasCloudConfig()) return Promise.resolve(null);
      var cfg = window.TODOOFICIOS_LEGAL;
      try {
        var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        return client.from('kv_store').select('key').limit(1).then(function(res){
          if(res.error) return null;
          cloudClient = client;
          cloudEnabled = true;
          return client;
        }).catch(function(){ return null; });
      } catch(e){ return Promise.resolve(null); }
    })();
    return cloudInitPromise;
  }

  function cloudGet(key){
    return initCloudClient().then(function(client){
      if(!client || !cloudEnabled) return null;
      return client.from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', key).maybeSingle()
        .then(function(res){ return (res.error || !res.data) ? null : res.data.value; })
        .catch(function(){ return null; });
    });
  }

  function cloudSet(key, value){
    return initCloudClient().then(function(client){
      if(!client || !cloudEnabled) return false;
      var payload = {namespace: CLOUD_NAMESPACE, key: key, value: value, updated_at: new Date().toISOString()};
      return client.from('kv_store').upsert(payload, {onConflict: 'namespace,key'})
        .then(function(res){ return !res.error; })
        .catch(function(){ return false; });
    });
  }

  /* presupuesto-publico:<id> está bloqueado para anon en kv_store (ver
     supabase/functions/account-auth): el propio id (shareId aleatorio) es la
     credencial, sin login, pero ya sin poder volcar la colección entera sin
     conocerlo. Si la función todavía no está desplegada, cae de vuelta a
     cloudGet/cloudSet de siempre (funciona mientras no se haya aplicado la
     migración que restringe esta key). */
  function securePresupuestoGet(key){
    return initCloudClient().then(function(client){
      if(!client || !cloudEnabled) return null;
      return client.functions.invoke('account-auth', {body: {action: 'get-public-presupuesto', key: key}})
        .then(function(res){
          if(!res.error && res.data && res.data.ok) return res.data.value;
          return cloudGet(key);
        })
        .catch(function(){ return cloudGet(key); });
    });
  }

  function securePresupuestoSet(key, value){
    return initCloudClient().then(function(client){
      if(!client || !cloudEnabled) return false;
      return client.functions.invoke('account-auth', {body: {action: 'save-public-presupuesto', key: key, value: value}})
        .then(function(res){
          if(!res.error && res.data && res.data.ok) return true;
          if(!res.error && res.data && !res.data.ok) return false;
          return cloudSet(key, value);
        })
        .catch(function(){ return cloudSet(key, value); });
    });
  }

  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function fmtEUR(n){
    return (Number(n)||0).toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
  }

  function fmtFechaES(iso){
    if(!iso) return '';
    try { return new Date(iso+'T00:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric'}); }
    catch(e){ return iso; }
  }

  function todayISO(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function diasHastaCaducar(p){
    try {
      var emision = new Date(p.fecha+'T00:00:00');
      var limite = new Date(emision);
      limite.setDate(limite.getDate() + (p.validezDias||30));
      var hoy = new Date(todayISO()+'T00:00:00');
      return Math.round((limite - hoy) / 86400000);
    } catch(e){ return 999; }
  }

  function estadoBannerHTML(p){
    if(p.estado === 'Aceptado'){
      return '<div class="status-banner ok"><strong>✓ Presupuesto aceptado</strong>' +
        (p.firmaNombre ? ' por ' + escapeHtml(p.firmaNombre) : '') + (p.firmaFecha ? ' el ' + fmtFechaES(p.firmaFecha) : '') + '.</div>';
    }
    if(p.estado === 'Rechazado'){
      return '<div class="status-banner bad"><strong>✕ Presupuesto rechazado</strong>' +
        (p.firmaNombre ? ' por ' + escapeHtml(p.firmaNombre) : '') + (p.firmaFecha ? ' el ' + fmtFechaES(p.firmaFecha) : '') + '.</div>';
    }
    return '';
  }

  function docHTML(p){
    var filasHTML = (p.partidas||[]).map(function(x){
      return '<tr><td>' + escapeHtml(x.descripcion) + '</td>' +
        '<td style="text-align:center;">' + escapeHtml(x.unidad) + '</td>' +
        '<td style="text-align:right;">' + x.cantidad + '</td>' +
        '<td style="text-align:right;">' + fmtEUR(x.precio) + '</td>' +
        '<td style="text-align:right;">' + (x.iva===undefined ? 0 : x.iva) + '%</td>' +
        '<td style="text-align:right;">' + fmtEUR(x.cantidad*x.precio) + '</td></tr>';
    }).join('');

    var desglose = p.ivaDesglose || [{pct:0, base:p.base, cuota:p.cuota}];

    return '<div class="doc">' +
      '<div class="doc-head">' +
        '<div class="doc-brand">' +
          '<div class="ic">' + (p.emisor && p.emisor.foto ? '<img src="' + p.emisor.foto + '">' : '<svg viewBox="0 0 24 24"><path d="M7 3.2h6.8l3.6 3.6v14H7z"/><path d="M13.8 3.2v3.6h3.6"/><path d="M9.3 12h5.4M9.3 15.2h5.4M9.3 18.4h3.2"/></svg>') + '</div>' +
          '<div><h2>' + escapeHtml(p.emisor?.nombre||'') + '</h2><div class="meta">' +
            (p.emisor?.nif ? 'NIF: ' + escapeHtml(p.emisor.nif) + '<br>' : '') +
            (p.emisor?.direccion ? escapeHtml(p.emisor.direccion) + '<br>' : '') +
            [p.emisor?.telefono, p.emisor?.email].filter(Boolean).map(escapeHtml).join(' · ') +
          '</div></div>' +
        '</div>' +
        '<div class="doc-num"><div class="n">Presupuesto ' + escapeHtml(p.numero) + '</div>' +
          '<div class="d">Fecha: ' + fmtFechaES(p.fecha) + '</div>' +
          '<div class="d">Válido ' + (p.validezDias||30) + ' días desde la emisión</div></div>' +
      '</div>' +
      '<div class="two-col">' +
        '<div class="box"><h3>Cliente</h3><div><strong>' + escapeHtml(p.cliente) + '</strong></div>' +
          (p.clienteNif ? '<div>NIF/DNI: ' + escapeHtml(p.clienteNif) + '</div>' : '') +
          (p.clienteDireccion ? '<div>' + escapeHtml(p.clienteDireccion) + '</div>' : '') +
          (p.clienteTelefono ? '<div>' + escapeHtml(p.clienteTelefono) + '</div>' : '') +
          (p.clienteEmail ? '<div>' + escapeHtml(p.clienteEmail) + '</div>' : '') +
        '</div>' +
        ((p.direccionObra || p.concepto) ? '<div class="box"><h3>Trabajo</h3>' +
          (p.concepto ? '<div><strong>' + escapeHtml(p.concepto) + '</strong></div>' : '') +
          (p.direccionObra ? '<div>Dirección de la obra: ' + escapeHtml(p.direccionObra) + '</div>' : '') +
        '</div>' : '') +
      '</div>' +
      '<table><thead><tr><th>Descripción</th><th style="text-align:center;">Ud.</th><th style="text-align:right;">Cant.</th><th style="text-align:right;">Precio</th><th style="text-align:right;">IVA</th><th style="text-align:right;">Importe</th></tr></thead>' +
        '<tbody>' + filasHTML + '</tbody></table>' +
      '<div class="totales">' +
        '<div><span>Subtotal</span><span>' + fmtEUR(p.base) + '</span></div>' +
        desglose.map(function(d){ return '<div><span>IVA (' + d.pct + '%)' + (desglose.length>1 ? ' — base ' + fmtEUR(d.base) : '') + '</span><span>' + fmtEUR(d.cuota) + '</span></div>'; }).join('') +
        (p.irpfAplica ? '<div><span>Retención IRPF (' + p.irpfPct + '%)</span><span>−' + fmtEUR(p.irpfImporte) + '</span></div>' : '') +
        '<div class="total"><span>TOTAL</span><span>' + fmtEUR(p.total) + '</span></div>' +
      '</div>' +
      '<div class="condiciones"><div><strong>Forma de pago:</strong> ' + escapeHtml(p.formaPago||'Transferencia bancaria') + '</div></div>' +
      ((p.fotos||[]).length ? '<div class="fotos"><h3>Fotos del trabajo</h3><div class="fotos-grid">' + p.fotos.map(function(f){ return '<img src="' + f + '">'; }).join('') + '</div></div>' : '') +
    '</div>';
  }

  function actionCardHTML(){
    return '<div class="action-card" id="actionCard">' +
      '<h3>¿Estás de acuerdo con este presupuesto?</h3>' +
      '<label>Tu nombre (para confirmar tu respuesta)</label>' +
      '<input type="text" id="firmaNombre" placeholder="Nombre y apellidos">' +
      '<div class="check-row"><input type="checkbox" id="firmaCheck" style="margin-top:2px;"><label for="firmaCheck" style="font-weight:400; margin:0;">He revisado las partidas, el precio y las condiciones de este presupuesto.</label></div>' +
      '<div class="action-btns">' +
        '<button type="button" class="btn btn-accept" id="btnAceptar">✓ Aceptar presupuesto</button>' +
        '<button type="button" class="btn btn-reject" id="btnRechazar">✕ Rechazar</button>' +
      '</div>' +
      '<div id="actionMsg"></div>' +
    '</div>';
  }

  function render(p, shareId){
    var app = document.getElementById('app');
    var expirado = p.estado === 'Pendiente' && diasHastaCaducar(p) < 0;
    var html = docHTML(p);
    if(p.estado !== 'Pendiente'){
      html += estadoBannerHTML(p);
    } else if(expirado){
      html += '<div class="status-banner warn"><strong>Este presupuesto ha caducado.</strong> Contacta directamente con el profesional si sigues interesado.</div>';
    } else {
      html += actionCardHTML();
    }
    html += '<footer>Presupuesto gestionado a través de <a href="index.html">TodoOficios.es</a>.</footer>';
    app.innerHTML = html;

    if(p.estado === 'Pendiente' && !expirado){
      var responder = function(nuevoEstado){
        var nombre = document.getElementById('firmaNombre').value.trim();
        var checked = document.getElementById('firmaCheck').checked;
        var msg = document.getElementById('actionMsg');
        msg.innerHTML = '';
        if(!nombre){ msg.innerHTML = '<div class="msg-err">Escribe tu nombre para confirmar la respuesta.</div>'; return; }
        if(!checked){ msg.innerHTML = '<div class="msg-err">Marca la casilla de revisión antes de continuar.</div>'; return; }
        document.getElementById('btnAceptar').disabled = true;
        document.getElementById('btnRechazar').disabled = true;
        var actualizado = Object.assign({}, p, {estado: nuevoEstado, firmaNombre: nombre, firmaFecha: todayISO()});
        securePresupuestoSet('presupuesto-publico:'+shareId, JSON.stringify(actualizado)).then(function(ok){
          if(!ok){
            msg.innerHTML = '<div class="msg-err">No se pudo enviar tu respuesta. Comprueba tu conexión e inténtalo de nuevo.</div>';
            document.getElementById('btnAceptar').disabled = false;
            document.getElementById('btnRechazar').disabled = false;
            return;
          }
          render(actualizado, shareId);
        });
      };
      document.getElementById('btnAceptar').addEventListener('click', function(){ responder('Aceptado'); });
      document.getElementById('btnRechazar').addEventListener('click', function(){ responder('Rechazado'); });
    }
  }

  function init(){
    var app = document.getElementById('app');
    var shareId = new URLSearchParams(location.search).get('id');
    if(!shareId){
      app.innerHTML = '<div class="state">Enlace incompleto: falta el identificador del presupuesto.</div>';
      return;
    }
    securePresupuestoGet('presupuesto-publico:'+shareId).then(function(raw){
      if(!raw){
        app.innerHTML = '<div class="state">No se ha encontrado este presupuesto. Puede que el enlace sea incorrecto o que el profesional lo haya retirado.</div>';
        return;
      }
      var p;
      try { p = JSON.parse(raw); } catch(e){ p = null; }
      if(!p){
        app.innerHTML = '<div class="state">No se ha podido leer este presupuesto.</div>';
        return;
      }
      render(p, shareId);
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
