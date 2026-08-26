/* Calculadora eléctrica — TodoOficios.es
   Motor genérico de calculadoras + catálogo de fórmulas.
   Todo el cálculo ocurre en el cliente, sin backend. */
(function(){
  "use strict";

  /* ---------- Utilidades numéricas ---------- */
  function fmt(n, d){
    d = d === undefined ? 4 : d;
    if(!Number.isFinite(n)) return '—';
    if(n === 0) return '0';
    var abs = Math.abs(n);
    if(abs >= 100000 || abs < 0.0001){
      return n.toExponential(3).replace('e+', '×10^').replace('e-', '×10^-');
    }
    var r = Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
    return String(r);
  }
  function gn(v, key){
    var raw = v[key];
    if(raw === undefined || raw === null || raw === '') throw new Error('Falta el valor "' + key + '"');
    var n = parseFloat(raw);
    if(!Number.isFinite(n)) throw new Error('"' + key + '" debe ser numérico');
    return n;
  }
  function gnOpt(v, key, def){
    var raw = v[key];
    if(raw === undefined || raw === null || raw === '') return def;
    var n = parseFloat(raw);
    return Number.isFinite(n) ? n : def;
  }
  function gv(v, key, def){
    var raw = v[key];
    return (raw === undefined || raw === null || raw === '') ? def : raw;
  }
  function must(cond, msg){ if(!cond) throw new Error(msg); }
  function escapeHtml(str){
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
  function faseMul(tipo){ return tipo === 'trifasico' ? Math.sqrt(3) : (tipo === 'trifasico_ln' ? 1 : 2); }

  var RHO = { cobre: 0.017241, aluminio: 0.028264 }; // Ω·mm²/m a 20°C

  /* ---------- Tablas de componentes ---------- */
  var COLOR_DIGITO = [
    {n:'Negro', v:0}, {n:'Marrón', v:1}, {n:'Rojo', v:2}, {n:'Naranja', v:3}, {n:'Amarillo', v:4},
    {n:'Verde', v:5}, {n:'Azul', v:6}, {n:'Violeta', v:7}, {n:'Gris', v:8}, {n:'Blanco', v:9}
  ];
  var COLOR_MULT = COLOR_DIGITO.map(function(c){ return {n:c.n, m: Math.pow(10, c.v)}; })
    .concat([{n:'Oro', m:0.1}, {n:'Plata', m:0.01}]);
  var COLOR_TOL = [
    {n:'Marrón', t:1}, {n:'Rojo', t:2}, {n:'Verde', t:0.5}, {n:'Azul', t:0.25}, {n:'Violeta', t:0.1},
    {n:'Gris', t:0.05}, {n:'Oro', t:5}, {n:'Plata', t:10}, {n:'Ninguno', t:20}
  ];
  function opts(arr, key, label){
    return arr.map(function(x){ return {value: x[key !== undefined ? key : 'n'], label: label ? label(x) : x.n}; });
  }
  function optsNombres(arr){ return arr.map(function(x){ return {value: x.n, label: x.n}; }); }
  function porNombre(arr, n){ var r = arr.filter(function(x){ return x.n === n; })[0]; if(!r) throw new Error('Color no reconocido'); return r; }

  var UNIDADES_CAP = [
    {n:'pF', f:1e-12}, {n:'nF', f:1e-9}, {n:'µF', f:1e-6}
  ];

  /* ---------- Categorías ---------- */
  var ICONS = {
    rayo: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
    bricks: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1"/><rect x="13" y="13" width="7.5" height="7.5" rx="1"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z"/>',
    house: '<path d="M4 11.5 12 4l8 7.5M6 10v9h12v-9"/>',
    ruler: '<path d="M3 21 21 3"/><path d="M7 17l2 2M11 13l2 2M15 9l2 2"/>',
    gauge: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5 9 10M8.3 13.5H7M17 13.5h-1.3M9.6 7.6l.6 1M14.4 7.6l-.6 1"/>',
    plug: '<path d="M8 3v4M16 3v4"/><rect x="6" y="7" width="12" height="6.5" rx="2"/><path d="M12 13.5v3a3 3 0 0 1-3 3H7.5"/>',
    chip: '<rect x="4" y="9" width="16" height="6" rx="1.3"/><path d="M4 12H1.3M22.7 12H20M7.3 9v6M10.6 9v6M13.4 9v6M16.7 9v6"/>',
    coil: '<path d="M2.5 12c1.4 0 1.4-4.2 2.8-4.2S6.7 12 8.1 12s1.4-4.2 2.8-4.2S12.3 12 13.7 12s1.4-4.2 2.8-4.2S17.9 12 19.3 12s1.4-4.2 2.2-4.2"/>',
    battery: '<rect x="3" y="8" width="15" height="8" rx="1.4"/><path d="M18 10.3h2.7v3.4H18"/><path d="M7 12h6"/>',
    tiles: '<path d="M3 8h18M3 16h18M8 3v18M16 3v18"/>',
    brush: '<path d="M20 4c-4 0-9 1-12.5 4.5S3 16 3 20c4 0 9-1 12.5-4.5S20 8 20 4Z"/><circle cx="8.5" cy="15.5" r="1.4"/>'
  };
  var GRUPOS = [
    {id:'electricidad', nombre:'Electricidad', icon:'rayo', color:'#C77C1E'},
    {id:'construccion', nombre:'Materiales y construcción', icon:'bricks', color:'#7458C2'},
    {id:'instalaciones', nombre:'Instalaciones', icon:'wrench', color:'#C05A3A'},
    {id:'reformas', nombre:'Reformas', icon:'house', color:'#2E8F6E'},
    {id:'geometria', nombre:'Geometría y conversores', icon:'ruler', color:'#3E5FBF'},
    {id:'avanzado', nombre:'Electrónica avanzada (opcional)', icon:'chip', color:'#8f8878', colapsado:true}
  ];
  var CATEGORIAS = [
    {id:'fundamentales', grupo:'electricidad', nombre:'Fundamentales', icon:'gauge', desc:'Ley de Ohm, potencias, resistencia e impedancia'},
    {id:'instalacion', grupo:'electricidad', nombre:'Instalación y conductores', icon:'plug', desc:'Dimensionamiento, caídas de tensión, cortocircuitos y protecciones'},
    {id:'componentes', grupo:'avanzado', nombre:'Componentes electrónicos', icon:'chip', desc:'Códigos de colores, SMD, condensadores, fusibles y más'},
    {id:'transformadores', grupo:'avanzado', nombre:'Transformadores y potencia', icon:'coil', desc:'Relación de transformación y corrección del factor de potencia'},
    {id:'utilidades', grupo:'avanzado', nombre:'Utilidades', icon:'battery', desc:'Baterías, antenas, CCTV, sensores y efecto Joule'},
    {id:'materiales', grupo:'construccion', nombre:'Materiales de obra', icon:'bricks', desc:'Ladrillos, mortero, cemento, hormigón, yeso, pladur y aislamiento'},
    {id:'suelos', grupo:'construccion', nombre:'Suelos y revestimientos', icon:'tiles', desc:'Baldosas, tarima, rodapié, mortero cola y juntas'},
    {id:'pintura', grupo:'construccion', nombre:'Pintura', icon:'brush', desc:'Superficie a pintar, litros necesarios y coste orientativo'},
    {id:'fontaneria', grupo:'instalaciones', nombre:'Fontanería', icon:'wrench', desc:'Tuberías, puntos de agua, pendientes y depósitos'},
    {id:'reformas', grupo:'reformas', nombre:'Reformas', icon:'house', desc:'Estimación de materiales completa para una estancia'},
    {id:'geometria', grupo:'geometria', nombre:'Geometría y conversores', icon:'ruler', desc:'Áreas, volúmenes, escaleras, pendientes y conversión de unidades'}
  ];
  function grupoDe(cat){ return GRUPOS.filter(function(g){ return g.id === cat.grupo; })[0]; }
  function catIconHTML(cat, size){
    var g = grupoDe(cat);
    var s = size || 32;
    return '<span class="cec-mic" style="background:' + g.color + '; width:' + s + 'px; height:' + s + 'px;"><svg viewBox="0 0 24 24">' + ICONS[cat.icon] + '</svg></span>';
  }
  function grupoIconHTML(g, size){
    var s = size || 26;
    return '<span class="cec-mic" style="background:' + g.color + '; width:' + s + 'px; height:' + s + 'px;"><svg viewBox="0 0 24 24">' + ICONS[g.icon] + '</svg></span>';
  }
  function calcIconHTML(c, size){
    if(c.icono) return '<span class="cec-mic-formula">' + c.icono + '</span>';
    var cat = CATEGORIAS.filter(function(x){ return x.id === c.cat; })[0];
    return catIconHTML(cat, size);
  }

  /* ============================================================
     CATEGORÍA: FUNDAMENTALES
     ============================================================ */
  var FUNDAMENTALES = [
    {
      id:'ohm', cat:'fundamentales', icono:'Ω', titulo:'Ley de Ohm',
      info:'Rellena dos valores cualesquiera (V, I o R) y se calcula el tercero. V = I·R',
      fields:[
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'I', label:'Corriente', unit:'A', type:'number'},
        {key:'R', label:'Resistencia', unit:'Ω', type:'number'}
      ],
      compute:function(v){
        var V = gnOpt(v,'V',null), I = gnOpt(v,'I',null), R = gnOpt(v,'R',null);
        var n = [V,I,R].filter(function(x){ return x !== null; }).length;
        must(n === 2, 'Rellena exactamente dos de los tres campos');
        if(V === null) V = I * R;
        else if(I === null) { must(R !== 0, 'La resistencia no puede ser 0'); I = V / R; }
        else R = (I === 0) ? Infinity : V / I;
        return [
          {label:'Tensión', value: fmt(V), unit:'V'},
          {label:'Corriente', value: fmt(I), unit:'A'},
          {label:'Resistencia', value: fmt(R), unit:'Ω'}
        ];
      }
    },
    {
      id:'corriente', cat:'fundamentales', icono:'A', titulo:'Cálculo de la corriente',
      info:'A partir de la potencia activa, la tensión y el factor de potencia. Iₘₒₙₒ = P/(V·cosφ); Iₜᵣᵢf = P/(√3·V·cosφ)',
      fields:[
        {key:'P', label:'Potencia activa', unit:'W', type:'number'},
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'cosphi', label:'Factor de potencia (cosφ)', unit:'', type:'number', def:1},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'monofasico'}
      ],
      compute:function(v){
        var P = gn(v,'P'), V = gn(v,'V'), cf = gnOpt(v,'cosphi',1), tipo = gv(v,'tipo','monofasico');
        must(V !== 0, 'La tensión no puede ser 0'); must(cf !== 0, 'El cosφ no puede ser 0');
        var I = tipo === 'trifasico' ? P/(Math.sqrt(3)*V*cf) : P/(V*cf);
        return [{label:'Corriente', value: fmt(I), unit:'A'}];
      }
    },
    {
      id:'tension', cat:'fundamentales', icono:'V', titulo:'Cálculo de la tensión',
      info:'A partir de la potencia activa, la corriente y el factor de potencia. Vₘₒₙₒ = P/(I·cosφ); Vₜᵣᵢf = P/(√3·I·cosφ)',
      fields:[
        {key:'P', label:'Potencia activa', unit:'W', type:'number'},
        {key:'I', label:'Corriente', unit:'A', type:'number'},
        {key:'cosphi', label:'Factor de potencia (cosφ)', unit:'', type:'number', def:1},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'monofasico'}
      ],
      compute:function(v){
        var P = gn(v,'P'), I = gn(v,'I'), cf = gnOpt(v,'cosphi',1), tipo = gv(v,'tipo','monofasico');
        must(I !== 0, 'La corriente no puede ser 0'); must(cf !== 0, 'El cosφ no puede ser 0');
        var V = tipo === 'trifasico' ? P/(Math.sqrt(3)*I*cf) : P/(I*cf);
        return [{label:'Tensión', value: fmt(V), unit:'V'}];
      }
    },
    {
      id:'resistencia', cat:'fundamentales', icono:'Ω', titulo:'Cálculo de la resistencia',
      info:'Ley de Ohm: R = V / I',
      fields:[
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'I', label:'Corriente', unit:'A', type:'number'}
      ],
      compute:function(v){
        var V = gn(v,'V'), I = gn(v,'I');
        must(I !== 0, 'La corriente no puede ser 0');
        return [{label:'Resistencia', value: fmt(V/I), unit:'Ω'}];
      }
    },
    {
      id:'potencia_activa', cat:'fundamentales', icono:'W', titulo:'Cálculo de la potencia activa',
      info:'Pₘₒₙₒ = V·I·cosφ; Pₜᵣᵢf = √3·V·I·cosφ',
      fields:[
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'I', label:'Corriente', unit:'A', type:'number'},
        {key:'cosphi', label:'Factor de potencia (cosφ)', unit:'', type:'number', def:1},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'monofasico'}
      ],
      compute:function(v){
        var V = gn(v,'V'), I = gn(v,'I'), cf = gnOpt(v,'cosphi',1), tipo = gv(v,'tipo','monofasico');
        var P = tipo === 'trifasico' ? Math.sqrt(3)*V*I*cf : V*I*cf;
        return [{label:'Potencia activa', value: fmt(P), unit:'W'}];
      }
    },
    {
      id:'potencia_aparente', cat:'fundamentales', icono:'VA', titulo:'Cálculo de la potencia aparente',
      info:'Sₘₒₙₒ = V·I; Sₜᵣᵢf = √3·V·I',
      fields:[
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'I', label:'Corriente', unit:'A', type:'number'},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'monofasico'}
      ],
      compute:function(v){
        var V = gn(v,'V'), I = gn(v,'I'), tipo = gv(v,'tipo','monofasico');
        var S = tipo === 'trifasico' ? Math.sqrt(3)*V*I : V*I;
        return [{label:'Potencia aparente', value: fmt(S), unit:'VA'}];
      }
    },
    {
      id:'potencia_reactiva', cat:'fundamentales', icono:'var', titulo:'Cálculo de la potencia reactiva',
      info:'Q = √(S² − P²), a partir de la potencia aparente y activa',
      fields:[
        {key:'S', label:'Potencia aparente', unit:'VA', type:'number'},
        {key:'P', label:'Potencia activa', unit:'W', type:'number'}
      ],
      compute:function(v){
        var S = gn(v,'S'), P = gn(v,'P');
        var d = S*S - P*P;
        must(d >= 0, 'La potencia activa no puede ser mayor que la aparente');
        return [{label:'Potencia reactiva', value: fmt(Math.sqrt(d)), unit:'var'}];
      }
    },
    {
      id:'factor_potencia', cat:'fundamentales', icono:'cosφ', titulo:'Cálculo del factor de potencia',
      info:'cosφ = P / S',
      fields:[
        {key:'P', label:'Potencia activa', unit:'W', type:'number'},
        {key:'S', label:'Potencia aparente', unit:'VA', type:'number'}
      ],
      compute:function(v){
        var P = gn(v,'P'), S = gn(v,'S');
        must(S !== 0, 'La potencia aparente no puede ser 0');
        return [{label:'Factor de potencia', value: fmt(P/S), unit:''}];
      }
    },
    {
      id:'impedancia', cat:'fundamentales', icono:'Z', titulo:'Cálculo de la impedancia',
      info:'Z = √(R² + X²)',
      fields:[
        {key:'R', label:'Resistencia', unit:'Ω', type:'number'},
        {key:'X', label:'Reactancia', unit:'Ω', type:'number'}
      ],
      compute:function(v){
        var R = gn(v,'R'), X = gn(v,'X');
        var Z = Math.sqrt(R*R + X*X);
        var fi = Math.atan2(X,R) * 180/Math.PI;
        return [{label:'Impedancia', value: fmt(Z), unit:'Ω'}, {label:'Ángulo de fase', value: fmt(fi,2), unit:'°'}];
      }
    },
    {
      id:'reactancia', cat:'fundamentales', icono:'X', titulo:'Cálculo de la reactancia',
      info:'Inductiva: Xl = 2πfL. Capacitiva: Xc = 1/(2πfC)',
      fields:[
        {key:'tipo', label:'Tipo de elemento', type:'select', options:[
          {value:'inductor', label:'Bobina (inductor)'}, {value:'condensador', label:'Condensador'}
        ], def:'inductor'},
        {key:'f', label:'Frecuencia', unit:'Hz', type:'number', def:50},
        {key:'L', label:'Inductancia (L) — si es bobina', unit:'H', type:'number'},
        {key:'C', label:'Capacidad (C) — si es condensador', unit:'F', type:'number'}
      ],
      compute:function(v){
        var f = gn(v,'f'), tipo = gv(v,'tipo','inductor');
        must(f > 0, 'La frecuencia debe ser mayor que 0');
        if(tipo === 'inductor'){
          var L = gn(v,'L');
          return [{label:'Reactancia inductiva Xl', value: fmt(2*Math.PI*f*L), unit:'Ω'}];
        }
        var C = gn(v,'C');
        must(C !== 0, 'La capacidad no puede ser 0');
        return [{label:'Reactancia capacitiva Xc', value: fmt(1/(2*Math.PI*f*C)), unit:'Ω'}];
      }
    },
    {
      id:'corriente_empleo', cat:'fundamentales', icono:'Ib', titulo:'Corriente de empleo (Ib)',
      info:'Ib = (P·ku·ks) / (V·cosφ) — potencia instalada corregida por factores de utilización (ku) y simultaneidad (ks)',
      fields:[
        {key:'P', label:'Potencia instalada', unit:'W', type:'number'},
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'cosphi', label:'Factor de potencia (cosφ)', unit:'', type:'number', def:1},
        {key:'ku', label:'Factor de utilización (ku)', unit:'', type:'number', def:1},
        {key:'ks', label:'Factor de simultaneidad (ks)', unit:'', type:'number', def:1},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'monofasico'}
      ],
      compute:function(v){
        var P = gn(v,'P'), V = gn(v,'V'), cf = gnOpt(v,'cosphi',1), ku = gnOpt(v,'ku',1), ks = gnOpt(v,'ks',1), tipo = gv(v,'tipo','monofasico');
        must(V !== 0 && cf !== 0, 'Tensión y cosφ no pueden ser 0');
        var Ib = tipo === 'trifasico' ? (P*ku*ks)/(Math.sqrt(3)*V*cf) : (P*ku*ks)/(V*cf);
        return [{label:'Corriente de empleo (Ib)', value: fmt(Ib), unit:'A'}];
      }
    }
  ];

  /* ============================================================
     CATEGORÍA: INSTALACIÓN Y CONDUCTORES
     ============================================================ */
  var INSTALACION = [
    {
      id:'cuadro_mando_general', cat:'instalacion', icono:'⏚', titulo:'Cuadro de mando general de la vivienda (REBT)',
      contieneMaterial:true,
      info:'Lista de protecciones (IGA, diferenciales, automáticos) y metros de cable por circuito según el grado de electrificación de la ITC-BT-25. Valores orientativos y editables: comprueba siempre el proyecto y la normativa vigente antes de comprar el material.',
      fields:[
        {key:'suministro', label:'Tipo de suministro', type:'select', options:[
          {value:'mono', label:'Monofásico (230V)'}, {value:'tri', label:'Trifásico (400V)'}
        ], def:'mono'},
        {key:'grado', label:'Grado de electrificación', type:'select', options:[
          {value:'basica', label:'Básica (mín. 5.750 W) — circuitos C1 a C5'},
          {value:'elevada', label:'Elevada (mín. 9.200 W) — C1 a C5 + circuitos adicionales'}
        ], def:'basica'},
        {key:'m_c1', label:'C1 · Iluminación', unit:'m', type:'number', def:25},
        {key:'m_c2', label:'C2 · Tomas de uso general y frigorífico', unit:'m', type:'number', def:40},
        {key:'m_c3', label:'C3 · Cocina y horno', unit:'m', type:'number', def:6},
        {key:'m_c4', label:'C4 · Lavadora, lavavajillas y termo eléctrico', unit:'m', type:'number', def:8},
        {key:'m_c5', label:'C5 · Baño y auxiliar de cocina', unit:'m', type:'number', def:10},
        {key:'m_c7', label:'C7 · Calefacción (solo si es grado elevado; 0 = no incluir)', unit:'m', type:'number', def:0},
        {key:'m_c8', label:'C8 · Aire acondicionado (0 = no incluir)', unit:'m', type:'number', def:0},
        {key:'m_c9', label:'C9 · Secadora independiente (0 = no incluir)', unit:'m', type:'number', def:0},
        {key:'m_c10', label:'C10 · Automatización y seguridad (0 = no incluir)', unit:'m', type:'number', def:0},
        {key:'m_c11', label:'C11 · Punto adicional de tomas/baño (0 = no incluir)', unit:'m', type:'number', def:0},
        {key:'m_c12', label:'C12 · Punto adicional de cocina/electrodomésticos (0 = no incluir)', unit:'m', type:'number', def:0},
        {key:'dps', label:'Protección contra sobretensiones (DPS, ITC-BT-23)', type:'select', options:[
          {value:'no', label:'No incluir'}, {value:'si', label:'Incluir'}
        ], def:'no'}
      ],
      compute:function(v){
        var suministro = gv(v,'suministro','mono'), grado = gv(v,'grado','basica'), dps = gv(v,'dps','no');
        var esElevada = grado === 'elevada';
        var polosPrincipal = suministro === 'tri' ? '4P (tetrapolar)' : '2P (bipolar)';
        var polosCircuito = '2P (bipolar)'; // los circuitos de una vivienda son monofásicos aunque el suministro general sea trifásico

        var CIRCUITOS = [
          {id:'C1', nombre:'Iluminación', pia:10, mm2:1.5, key:'m_c1', siempre:true},
          {id:'C2', nombre:'Tomas de uso general y frigorífico', pia:16, mm2:2.5, key:'m_c2', siempre:true},
          {id:'C3', nombre:'Cocina y horno', pia:25, mm2:6, key:'m_c3', siempre:true},
          {id:'C4', nombre:'Lavadora, lavavajillas y termo eléctrico', pia:20, mm2:4, key:'m_c4', siempre:true},
          {id:'C5', nombre:'Baño y auxiliar de cocina', pia:16, mm2:2.5, key:'m_c5', siempre:true},
          {id:'C7', nombre:'Calefacción', pia:16, mm2:2.5, key:'m_c7'},
          {id:'C8', nombre:'Aire acondicionado', pia:25, mm2:6, key:'m_c8'},
          {id:'C9', nombre:'Secadora independiente', pia:16, mm2:2.5, key:'m_c9'},
          {id:'C10', nombre:'Automatización y seguridad', pia:10, mm2:1.5, key:'m_c10'},
          {id:'C11', nombre:'Punto adicional de tomas/baño', pia:16, mm2:2.5, key:'m_c11'},
          {id:'C12', nombre:'Punto adicional de cocina/electrodomésticos', pia:20, mm2:4, key:'m_c12'}
        ];

        // Los circuitos C1-C5 siempre se incluyen; los C7-C12 solo si tienen metros > 0 y el grado es elevado
        var incluidos = CIRCUITOS.map(function(def){
          var metros = gnOpt(v, def.key, 0);
          if(!def.siempre){
            if(!esElevada || metros <= 0) return null;
          }
          return {id:def.id, nombre:def.nombre, pia:def.pia, mm2:def.mm2, metros:metros};
        }).filter(Boolean);

        must(incluidos.some(function(c){ return c.metros > 0; }), 'Indica al menos los metros de cable de un circuito');

        var igaA = esElevada ? 63 : 40;
        var numDiferenciales = esElevada ? 2 : 1;

        var res = [];
        res.push({label:'Suministro', value: suministro === 'tri' ? 'Trifásico (400V)' : 'Monofásico (230V)', unit:''});
        res.push({label:'Grado de electrificación', value: esElevada ? 'Elevada' : 'Básica', unit:''});
        res.push({label:'IGA (interruptor general automático)', value: igaA + 'A, ' + polosPrincipal, unit:''});
        res.push({label:'Diferencial(es) 30mA (tipo AC/A)', value: numDiferenciales + ' × 40A, ' + polosPrincipal, unit:''});
        if(esElevada) res.push({label:'Distribución habitual de diferenciales', value:'1º: C1, C2, C5, C7, C8, C10, C11 · 2º: C3, C4, C9, C12', unit:''});
        if(dps === 'si') res.push({label:'Protector de sobretensiones (DPS tipo 2)', value:'1', unit:'ud, ITC-BT-23'});

        var porAmperaje = {};
        incluidos.forEach(function(c){
          if(c.metros <= 0) return;
          porAmperaje[c.pia] = (porAmperaje[c.pia]||0) + 1;
        });
        Object.keys(porAmperaje).map(Number).sort(function(a,b){ return a-b; }).forEach(function(a){
          res.push({label:'Automático (PIA) ' + polosCircuito + ' · ' + a + 'A', value: porAmperaje[a], unit:'uds'});
        });

        var porSeccion = {};
        incluidos.forEach(function(c){
          if(c.metros <= 0) return;
          porSeccion[c.mm2] = (porSeccion[c.mm2]||0) + c.metros;
        });
        Object.keys(porSeccion).map(Number).sort(function(a,b){ return a-b; }).forEach(function(s){
          res.push({label:'Cable ' + s + 'mm²', value: fmt(porSeccion[s],1), unit:'m'});
        });

        res.push({label:'Circuitos incluidos', value: incluidos.filter(function(c){ return c.metros>0; }).map(function(c){ return c.id + ' ' + c.nombre; }).join(' · '), unit:''});

        return res;
      }
    },
    {
      id:'dimensionamiento_conductores', cat:'instalacion', icono:'⏚', titulo:'Dimensionamiento de conductores',
      info:'Sección orientativa por densidad de corriente admisible según material y método de instalación (valores simplificados; verifica siempre con las tablas de tu normativa vigente).',
      fields:[
        {key:'Ib', label:'Corriente de empleo', unit:'A', type:'number'},
        {key:'material', label:'Material', type:'select', options:[{value:'cobre',label:'Cobre'},{value:'aluminio',label:'Aluminio'}], def:'cobre'},
        {key:'metodo', label:'Método de instalación', type:'select', options:[
          {value:'enterrado', label:'Enterrado / bajo tubo empotrado'},
          {value:'bandeja', label:'Al aire / bandeja perforada'},
          {value:'tubo_superficie', label:'Bajo tubo en superficie'}
        ], def:'bandeja'}
      ],
      compute:function(v){
        var Ib = gn(v,'Ib'), material = gv(v,'material','cobre'), metodo = gv(v,'metodo','bandeja');
        must(Ib > 0, 'La corriente debe ser mayor que 0');
        var densidad = { enterrado: 5, tubo_superficie: 6, bandeja: 8 }[metodo];
        if(material === 'aluminio') densidad *= 0.78;
        var S = Ib / densidad;
        var normalizadas = [1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300];
        var Snorm = normalizadas.filter(function(x){ return x >= S; })[0] || normalizadas[normalizadas.length-1];
        return [
          {label:'Sección mínima calculada', value: fmt(S,2), unit:'mm²'},
          {label:'Sección normalizada recomendada', value: fmt(Snorm,2), unit:'mm²'}
        ];
      }
    },
    {
      id:'dimensionamiento_conductores_protecciones', cat:'instalacion', icono:'⏚', titulo:'Dimensionamiento de conductores y coordinación con protecciones',
      info:'Comprueba la regla de coordinación Ib ≤ In ≤ Iz (IEC 60364-4-43 / REBT ITC-BT-22)',
      fields:[
        {key:'Ib', label:'Corriente de empleo', unit:'A', type:'number'},
        {key:'In', label:'Corriente nominal de la protección', unit:'A', type:'number'},
        {key:'Iz', label:'Corriente admisible del conductor', unit:'A', type:'number'}
      ],
      compute:function(v){
        var Ib = gn(v,'Ib'), In = gn(v,'In'), Iz = gn(v,'Iz');
        var ok1 = Ib <= In, ok2 = In <= Iz;
        var res = [
          {label:'Ib ≤ In', value: ok1 ? 'Cumple' : 'NO cumple', unit:''},
          {label:'In ≤ Iz', value: ok2 ? 'Cumple' : 'NO cumple', unit:''}
        ];
        res.push({label:'Coordinación global', value: (ok1 && ok2) ? 'Correcta' : 'Revisar sección o protección', unit:''});
        return res;
      }
    },
    {
      id:'caida_tension', cat:'instalacion', icono:'ΔV', titulo:'Cálculo de la caída de tensión',
      info:'ΔU% = (2·ρ·L·I·cosφ)/(S·V)·100 [monofásico]; ΔU% = (√3·ρ·L·I·cosφ)/(S·V)·100 [trifásico]',
      fields:[
        {key:'L', label:'Longitud del cable (L, un sentido)', unit:'m', type:'number'},
        {key:'I', label:'Corriente', unit:'A', type:'number'},
        {key:'S', label:'Sección del conductor', unit:'mm²', type:'number'},
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'cosphi', label:'Factor de potencia (cosφ)', unit:'', type:'number', def:1},
        {key:'material', label:'Material', type:'select', options:[{value:'cobre',label:'Cobre'},{value:'aluminio',label:'Aluminio'}], def:'cobre'},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'monofasico'}
      ],
      compute:function(v){
        var L = gn(v,'L'), I = gn(v,'I'), S = gn(v,'S'), V = gn(v,'V'), cf = gnOpt(v,'cosphi',1);
        var material = gv(v,'material','cobre'), tipo = gv(v,'tipo','monofasico');
        must(S !== 0 && V !== 0, 'La sección y la tensión no pueden ser 0');
        var rho = RHO[material];
        var k = tipo === 'trifasico' ? Math.sqrt(3) : 2;
        var dU = (k*rho*L*I*cf)/S;
        var dUp = (dU/V)*100;
        return [
          {label:'Caída de tensión', value: fmt(dU,3), unit:'V'},
          {label:'Caída de tensión relativa', value: fmt(dUp,3), unit:'%'}
        ];
      }
    },
    {
      id:'longitud_max_dv', cat:'instalacion', icono:'Lmax', titulo:'Longitud máxima del cable (ΔV)',
      info:'Longitud máxima para no superar la caída de tensión admisible',
      fields:[
        {key:'dVp_max', label:'Caída de tensión admisible', unit:'%', type:'number', def:3},
        {key:'I', label:'Corriente', unit:'A', type:'number'},
        {key:'S', label:'Sección del conductor', unit:'mm²', type:'number'},
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'cosphi', label:'Factor de potencia (cosφ)', unit:'', type:'number', def:1},
        {key:'material', label:'Material', type:'select', options:[{value:'cobre',label:'Cobre'},{value:'aluminio',label:'Aluminio'}], def:'cobre'},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'monofasico'}
      ],
      compute:function(v){
        var dVp = gn(v,'dVp_max'), I = gn(v,'I'), S = gn(v,'S'), V = gn(v,'V'), cf = gnOpt(v,'cosphi',1);
        var material = gv(v,'material','cobre'), tipo = gv(v,'tipo','monofasico');
        must(I !== 0 && cf !== 0, 'La corriente y el cosφ no pueden ser 0');
        var rho = RHO[material];
        var k = tipo === 'trifasico' ? Math.sqrt(3) : 2;
        var dV = (dVp/100)*V;
        var L = (dV*S)/(k*rho*I*cf);
        return [{label:'Longitud máxima', value: fmt(L,2), unit:'m'}];
      }
    },
    {
      id:'longitud_max_icc', cat:'instalacion', icono:'Lmax', titulo:'Longitud máxima del cable (Icc)',
      info:'Longitud máxima para garantizar la corriente mínima de cortocircuito que hace disparar la protección: L = (0.8·V) / (√3·ρ·Icc_min/S) [orientativo, factor 0.8 por caída de tensión de red]',
      fields:[
        {key:'V', label:'Tensión de fase', unit:'V', type:'number'},
        {key:'Icc_min', label:'Corriente mínima de disparo de la protección', unit:'A', type:'number'},
        {key:'S', label:'Sección del conductor', unit:'mm²', type:'number'},
        {key:'material', label:'Material', type:'select', options:[{value:'cobre',label:'Cobre'},{value:'aluminio',label:'Aluminio'}], def:'cobre'}
      ],
      compute:function(v){
        var V = gn(v,'V'), Icc = gn(v,'Icc_min'), S = gn(v,'S'), material = gv(v,'material','cobre');
        must(Icc > 0 && S > 0, 'La corriente y la sección deben ser mayores que 0');
        var rho = RHO[material];
        var L = (0.8*V*S)/(Math.sqrt(3)*rho*Icc);
        return [{label:'Longitud máxima (orientativa)', value: fmt(L,2), unit:'m'}];
      }
    },
    {
      id:'capacidad_corriente_aislados', cat:'instalacion', icono:'Iz', titulo:'Capacidad de corriente de conductores aislados',
      info:'Iz corregida por temperatura ambiente y agrupamiento respecto a la ampacidad de catálogo (valores orientativos; consulta las tablas oficiales de tu normativa).',
      fields:[
        {key:'Iz0', label:'Ampacidad de catálogo (a 30°C, 1 circuito)', unit:'A', type:'number'},
        {key:'temp', label:'Temperatura ambiente', unit:'°C', type:'number', def:30},
        {key:'n_circuitos', label:'Nº de circuitos agrupados', unit:'', type:'number', def:1}
      ],
      compute:function(v){
        var Iz0 = gn(v,'Iz0'), temp = gnOpt(v,'temp',30), n = gnOpt(v,'n_circuitos',1);
        must(n >= 1, 'Debe haber al menos 1 circuito');
        var ft = Math.sqrt(Math.max(0.1, (70-temp)/(70-30)));
        var fg = n <= 1 ? 1 : (n <= 4 ? 0.8 : (n <= 9 ? 0.7 : 0.6));
        return [{label:'Corriente admisible corregida (Iz)', value: fmt(Iz0*ft*fg,2), unit:'A'}];
      }
    },
    {
      id:'capacidad_corriente_barras', cat:'instalacion', icono:'A', titulo:'Capacidad de corriente de barras colectoras',
      info:'Estimación por densidad de corriente típica en barras de cobre al aire (3–6 A/mm² según ventilación; valor orientativo, no sustituye ensayo de calentamiento).',
      fields:[
        {key:'ancho', label:'Ancho de la barra', unit:'mm', type:'number'},
        {key:'espesor', label:'Espesor de la barra', unit:'mm', type:'number'},
        {key:'densidad', label:'Densidad de corriente admisible', unit:'A/mm²', type:'number', def:4}
      ],
      compute:function(v){
        var a = gn(v,'ancho'), e = gn(v,'espesor'), d = gnOpt(v,'densidad',4);
        var S = a*e;
        return [
          {label:'Sección de la barra', value: fmt(S,2), unit:'mm²'},
          {label:'Corriente admisible estimada', value: fmt(S*d,1), unit:'A'}
        ];
      }
    },
    {
      id:'dimensionamiento_conductos_bandejas', cat:'instalacion', icono:'⏚', titulo:'Dimensionamiento de conductos y bandejas de cables',
      info:'Factor de llenado recomendado ≤ 40% en tubos (varios cables) y ≤ 35% en bandejas, según la práctica habitual de instalación.',
      fields:[
        {key:'area_cables', label:'Suma de áreas de los cables (Ø exterior)', unit:'mm²', type:'number'},
        {key:'tipo', label:'Canalización', type:'select', options:[
          {value:'tubo', label:'Tubo / conducto'}, {value:'bandeja', label:'Bandeja portacables'}
        ], def:'tubo'}
      ],
      compute:function(v){
        var area = gn(v,'area_cables'), tipo = gv(v,'tipo','tubo');
        var factor = tipo === 'tubo' ? 0.40 : 0.35;
        var areaNecesaria = area/factor;
        return [{label:'Área interior mínima necesaria', value: fmt(areaNecesaria,1), unit:'mm²'},
                {label:'Factor de llenado usado', value: fmt(factor*100,0), unit:'%'}];
      }
    },
    {
      id:'dimensionamiento_protecciones', cat:'instalacion', icono:'In', titulo:'Dimensionamiento de dispositivos de protección',
      info:'Selecciona el calibre normalizado que cumple Ib ≤ In ≤ Iz',
      fields:[
        {key:'Ib', label:'Corriente de empleo', unit:'A', type:'number'},
        {key:'Iz', label:'Corriente admisible del conductor', unit:'A', type:'number'}
      ],
      compute:function(v){
        var Ib = gn(v,'Ib'), Iz = gn(v,'Iz');
        must(Ib <= Iz, 'Ib no puede ser mayor que Iz: la sección del conductor es insuficiente');
        var calibres = [6,10,16,20,25,32,40,50,63,80,100,125,160,200,250];
        var In = calibres.filter(function(c){ return c >= Ib && c <= Iz; })[0];
        must(In !== undefined, 'No hay un calibre normalizado que cumpla Ib ≤ In ≤ Iz con estos datos');
        return [{label:'Calibre normalizado recomendado', value: fmt(In,0), unit:'A'}];
      }
    },
    {
      id:'proteccion_cortocircuito', cat:'instalacion', icono:'k²S²', titulo:'Protección de cables ante cortocircuito',
      info:'Comprueba que la energía dejada pasar por la protección (I²t) no supere la admisible por el cable: I²t ≤ k²·S²',
      fields:[
        {key:'k', label:'Constante k del aislamiento (PVC≈115, XLPE≈143)', unit:'', type:'number', def:115},
        {key:'S', label:'Sección del conductor', unit:'mm²', type:'number'},
        {key:'I2t', label:'Energía dejada pasar por la protección', unit:'A²·s', type:'number'}
      ],
      compute:function(v){
        var k = gn(v,'k'), S = gn(v,'S'), I2t = gn(v,'I2t');
        var admisible = k*k*S*S;
        return [
          {label:'Energía admisible del cable (k²S²)', value: fmt(admisible,0), unit:'A²·s'},
          {label:'Resultado', value: I2t <= admisible ? 'Protección adecuada' : 'NO adecuada: revisar sección o protección', unit:''}
        ];
      }
    },
    {
      id:'energia_especifica_cable', cat:'instalacion', icono:'k²S²', titulo:'Energía específica admisible del cable',
      info:'k²·S², la energía máxima que el conductor soporta durante un cortocircuito sin dañarse',
      fields:[
        {key:'k', label:'Constante k del aislamiento (PVC≈115, XLPE≈143)', unit:'', type:'number', def:115},
        {key:'S', label:'Sección del conductor', unit:'mm²', type:'number'}
      ],
      compute:function(v){
        var k = gn(v,'k'), S = gn(v,'S');
        return [{label:'Energía específica admisible', value: fmt(k*k*S*S,0), unit:'A²·s'}];
      }
    },
    {
      id:'temperatura_cable', cat:'instalacion', icono:'θ', titulo:'Cálculo de la temperatura del cable',
      info:'θ ≈ θamb + (θmax − θamb)·(I/Iz)² — estimación del calentamiento del conductor en servicio continuo',
      fields:[
        {key:'I', label:'Corriente real de servicio', unit:'A', type:'number'},
        {key:'Iz', label:'Corriente admisible del cable', unit:'A', type:'number'},
        {key:'temp_amb', label:'Temperatura ambiente', unit:'°C', type:'number', def:30},
        {key:'temp_max', label:'Temperatura máxima del aislamiento', unit:'°C', type:'number', def:70}
      ],
      compute:function(v){
        var I = gn(v,'I'), Iz = gn(v,'Iz'), ta = gnOpt(v,'temp_amb',30), tm = gnOpt(v,'temp_max',70);
        must(Iz !== 0, 'Iz no puede ser 0');
        var theta = ta + (tm-ta)*Math.pow(I/Iz,2);
        return [{label:'Temperatura estimada del conductor', value: fmt(theta,1), unit:'°C'}];
      }
    },
    {
      id:'perdidas_potencia_cables', cat:'instalacion', icono:'Ploss', titulo:'Pérdidas de potencia en cables',
      info:'Monofásico: P = 2·I²·R·L. Trifásico: P = 3·I²·R·L, con R = ρ/S',
      fields:[
        {key:'I', label:'Corriente', unit:'A', type:'number'},
        {key:'L', label:'Longitud (un sentido)', unit:'m', type:'number'},
        {key:'S', label:'Sección del conductor', unit:'mm²', type:'number'},
        {key:'material', label:'Material', type:'select', options:[{value:'cobre',label:'Cobre'},{value:'aluminio',label:'Aluminio'}], def:'cobre'},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'monofasico'}
      ],
      compute:function(v){
        var I = gn(v,'I'), L = gn(v,'L'), S = gn(v,'S'), material = gv(v,'material','cobre'), tipo = gv(v,'tipo','monofasico');
        must(S !== 0, 'La sección no puede ser 0');
        var Rc = (RHO[material]*L)/S;
        var n = tipo === 'trifasico' ? 3 : 2;
        return [{label:'Pérdidas de potencia', value: fmt(n*I*I*Rc,2), unit:'W'}];
      }
    },
    {
      id:'corriente_neutro', cat:'instalacion', icono:'In', titulo:'Corriente del neutro',
      info:'Suma vectorial de las tres corrientes de fase desfasadas 120° (sistema trifásico desequilibrado)',
      fields:[
        {key:'I1', label:'Corriente fase 1', unit:'A', type:'number'},
        {key:'I2', label:'Corriente fase 2', unit:'A', type:'number'},
        {key:'I3', label:'Corriente fase 3', unit:'A', type:'number'}
      ],
      compute:function(v){
        var I1 = gn(v,'I1'), I2 = gn(v,'I2'), I3 = gn(v,'I3');
        var ax = I1, ay = 0;
        var bx = I2*Math.cos(-2*Math.PI/3), by = I2*Math.sin(-2*Math.PI/3);
        var cx = I3*Math.cos(2*Math.PI/3), cy = I3*Math.sin(2*Math.PI/3);
        var x = ax+bx+cx, y = ay+by+cy;
        return [{label:'Corriente del neutro', value: fmt(Math.sqrt(x*x+y*y),2), unit:'A'}];
      }
    },
    {
      id:'caida_tension_cargas_distribuidas', cat:'instalacion', icono:'ΔV', titulo:'Caída de tensión con cargas distribuidas',
      info:'ΔU = (k·ρ/S)·Σ(Iᵢ·Lᵢ), método de los momentos eléctricos para cargas repartidas a lo largo de la línea',
      fields:[
        {key:'S', label:'Sección del conductor', unit:'mm²', type:'number'},
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'material', label:'Material', type:'select', options:[{value:'cobre',label:'Cobre'},{value:'aluminio',label:'Aluminio'}], def:'cobre'},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'monofasico'},
        {key:'IL1', label:'Carga 1: I (A) × L (m), formato "I,L"', unit:'', type:'text'},
        {key:'IL2', label:'Carga 2: I (A) × L (m), formato "I,L"', unit:'', type:'text'},
        {key:'IL3', label:'Carga 3: I (A) × L (m), formato "I,L"', unit:'', type:'text'}
      ],
      compute:function(v){
        var S = gn(v,'S'), V = gn(v,'V'), material = gv(v,'material','cobre'), tipo = gv(v,'tipo','monofasico');
        var rho = RHO[material], k = tipo === 'trifasico' ? Math.sqrt(3) : 2;
        var momento = 0, huboAlguna = false;
        ['IL1','IL2','IL3'].forEach(function(key){
          var raw = gv(v,key,'');
          if(!raw) return;
          var parts = raw.split(',');
          if(parts.length !== 2) throw new Error('Usa el formato "I,L" (ej: 10,25) en ' + key);
          var I = parseFloat(parts[0]), L = parseFloat(parts[1]);
          if(!Number.isFinite(I) || !Number.isFinite(L)) throw new Error('Valores no numéricos en ' + key);
          momento += I*L; huboAlguna = true;
        });
        must(huboAlguna, 'Introduce al menos una carga');
        must(S !== 0 && V !== 0, 'La sección y la tensión no pueden ser 0');
        var dU = (k*rho/S)*momento;
        return [{label:'Caída de tensión total', value: fmt(dU,3), unit:'V'},
                {label:'Caída de tensión relativa', value: fmt((dU/V)*100,3), unit:'%'}];
      }
    },
    {
      id:'dimensionamiento_cargas_distribuidas', cat:'instalacion', icono:'⏚', titulo:'Dimensionamiento de conductores con cargas distribuidas',
      info:'Sección mínima para no superar la caída de tensión admisible con el momento eléctrico total Σ(Iᵢ·Lᵢ)',
      fields:[
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'dVp_max', label:'Caída de tensión admisible', unit:'%', type:'number', def:3},
        {key:'material', label:'Material', type:'select', options:[{value:'cobre',label:'Cobre'},{value:'aluminio',label:'Aluminio'}], def:'cobre'},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'monofasico'},
        {key:'momento', label:'Momento eléctrico total Σ(I·L)', unit:'A·m', type:'number'}
      ],
      compute:function(v){
        var V = gn(v,'V'), dVp = gn(v,'dVp_max'), material = gv(v,'material','cobre'), tipo = gv(v,'tipo','monofasico'), momento = gn(v,'momento');
        var rho = RHO[material], k = tipo === 'trifasico' ? Math.sqrt(3) : 2;
        must(V !== 0 && dVp !== 0, 'La tensión y la caída admisible no pueden ser 0');
        var dU = (dVp/100)*V;
        var S = (k*rho*momento)/dU;
        var normalizadas = [1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300];
        var Snorm = normalizadas.filter(function(x){ return x >= S; })[0] || normalizadas[normalizadas.length-1];
        return [{label:'Sección mínima calculada', value: fmt(S,2), unit:'mm²'},
                {label:'Sección normalizada recomendada', value: fmt(Snorm,2), unit:'mm²'}];
      }
    },
    {
      id:'puesta_tierra', cat:'instalacion', icono:'⏚', titulo:'Sistema de puesta a tierra y coordinación con diferencial',
      info:'Resistencia de electrodo simplificada R = ρ_terreno/L, y comprobación de la sensibilidad del diferencial: R·I_sensibilidad ≤ tensión de contacto admisible (24V local húmedo / 50V local seco)',
      fields:[
        {key:'rho_terreno', label:'Resistividad del terreno', unit:'Ω·m', type:'number', def:100},
        {key:'L', label:'Longitud de la pica/electrodo', unit:'m', type:'number', def:2},
        {key:'I_sens', label:'Sensibilidad del diferencial', unit:'A', type:'number', def:0.03},
        {key:'Vc_max', label:'Tensión de contacto admisible', unit:'V', type:'number', def:24}
      ],
      compute:function(v){
        var rho = gn(v,'rho_terreno'), L = gn(v,'L'), Is = gn(v,'I_sens'), Vc = gn(v,'Vc_max');
        must(L !== 0, 'La longitud no puede ser 0');
        var Rt = rho/L;
        var Vcontacto = Rt*Is;
        return [
          {label:'Resistencia de tierra estimada', value: fmt(Rt,2), unit:'Ω'},
          {label:'Tensión de contacto en defecto', value: fmt(Vcontacto,2), unit:'V'},
          {label:'Resultado', value: Vcontacto <= Vc ? 'Coordinación correcta' : 'Añade más electrodos: tensión de contacto excesiva', unit:''}
        ];
      }
    },
    {
      id:'cortocircuito_minimo', cat:'instalacion', icono:'Icc', titulo:'Corriente de cortocircuito mínima',
      info:'Icc_min ≈ 0.8·V / (√3·Z_bucle), estimación al final de la línea con caída de tensión de red del 20% (orientativo)',
      fields:[
        {key:'V', label:'Tensión de fase', unit:'V', type:'number'},
        {key:'Z', label:'Impedancia total del bucle de defecto', unit:'Ω', type:'number'}
      ],
      compute:function(v){
        var V = gn(v,'V'), Z = gn(v,'Z');
        must(Z !== 0, 'La impedancia no puede ser 0');
        return [{label:'Corriente de cortocircuito mínima', value: fmt((0.8*V)/(Math.sqrt(3)*Z),1), unit:'A'}];
      }
    },
    {
      id:'cortocircuito_punto_especifico', cat:'instalacion', icono:'Icc', titulo:'Corriente de cortocircuito en un punto específico',
      info:'Icc = V / (√3·Ztotal), con Ztotal = Zorigen + ρ·L/S (impedancia acumulada hasta el punto de defecto)',
      fields:[
        {key:'V', label:'Tensión de fase', unit:'V', type:'number'},
        {key:'Z_origen', label:'Impedancia en el origen de la línea', unit:'Ω', type:'number', def:0},
        {key:'L', label:'Longitud hasta el punto', unit:'m', type:'number'},
        {key:'S', label:'Sección del conductor', unit:'mm²', type:'number'},
        {key:'material', label:'Material', type:'select', options:[{value:'cobre',label:'Cobre'},{value:'aluminio',label:'Aluminio'}], def:'cobre'}
      ],
      compute:function(v){
        var V = gn(v,'V'), Zo = gnOpt(v,'Z_origen',0), L = gn(v,'L'), S = gn(v,'S'), material = gv(v,'material','cobre');
        must(S !== 0, 'La sección no puede ser 0');
        var Zt = Zo + (RHO[material]*L)/S;
        must(Zt !== 0, 'La impedancia total no puede ser 0');
        return [{label:'Impedancia total hasta el punto', value: fmt(Zt,4), unit:'Ω'},
                {label:'Corriente de cortocircuito', value: fmt(V/(Math.sqrt(3)*Zt),1), unit:'A'}];
      }
    },
    {
      id:'cortocircuito_subestacion', cat:'instalacion', icono:'Icc', titulo:'Corriente de cortocircuito con subestación (transformador)',
      info:'Icc = Sn / (√3·Un·Ucc%), a partir de la potencia del transformador y su tensión de cortocircuito porcentual',
      fields:[
        {key:'Sn', label:'Potencia nominal del transformador', unit:'kVA', type:'number'},
        {key:'Un', label:'Tensión nominal secundaria', unit:'V', type:'number'},
        {key:'Ucc', label:'Tensión de cortocircuito del transformador (Ucc%)', unit:'%', type:'number', def:4}
      ],
      compute:function(v){
        var Sn = gn(v,'Sn')*1000, Un = gn(v,'Un'), Ucc = gn(v,'Ucc')/100;
        must(Un !== 0 && Ucc !== 0, 'La tensión y Ucc% no pueden ser 0');
        var Icc = Sn/(Math.sqrt(3)*Un*Ucc);
        return [{label:'Corriente de cortocircuito en bornes', value: fmt(Icc,0), unit:'A'}];
      }
    },
    {
      id:'riesgo_sobretension', cat:'instalacion', titulo:'Evaluación del riesgo de sobretensiones de origen atmosférico',
      info:'Estimación simplificada del riesgo relativo según densidad de rayos de la zona y nivel de protección; solo orientativa — el cálculo completo de riesgo conforme a IEC 62305-2 requiere un estudio detallado por un técnico.',
      fields:[
        {key:'Ng', label:'Densidad de rayos de la zona', unit:'rayos/km²/año', type:'number', def:2.5},
        {key:'area_influencia', label:'Área de captación equivalente', unit:'km²', type:'number'},
        {key:'nivel_proteccion', label:'Nivel de protección (SPD) instalado', type:'select', options:[
          {value:'0', label:'Sin protección'}, {value:'0.9', label:'Tipo 1 (eficacia ≈ 90%)'},
          {value:'0.95', label:'Tipo 1+2 (eficacia ≈ 95%)'}, {value:'0.98', label:'Tipo 1+2+3 (eficacia ≈ 98%)'}
        ], def:'0'}
      ],
      compute:function(v){
        var Ng = gn(v,'Ng'), area = gn(v,'area_influencia'), ef = gnOpt(v,'nivel_proteccion',0);
        var Nd = Ng*area;
        var Nres = Nd*(1-ef);
        return [
          {label:'Frecuencia de impactos esperada (Nd)', value: fmt(Nd,4), unit:'eventos/año'},
          {label:'Frecuencia residual con la protección', value: fmt(Nres,4), unit:'eventos/año'},
          {label:'Nota', value:'Orientativo — valida el riesgo real con un estudio IEC 62305-2', unit:''}
        ];
      }
    },
    {
      id:'proteccion_alumbrado_emergencia', cat:'instalacion', icono:'⏚', titulo:'Protección para líneas de alumbrado de emergencia',
      info:'Corriente de empleo y sección orientativa para líneas de alumbrado de emergencia (REBT ITC-BT-28 / UNE 23033): circuito independiente, normalmente protegido con magnetotérmico dedicado.',
      fields:[
        {key:'P', label:'Potencia total de las luminarias', unit:'W', type:'number'},
        {key:'V', label:'Tensión', unit:'V', type:'number', def:230},
        {key:'longitud', label:'Longitud del circuito', unit:'m', type:'number'}
      ],
      compute:function(v){
        var P = gn(v,'P'), V = gn(v,'V'), L = gn(v,'longitud');
        must(V !== 0, 'La tensión no puede ser 0');
        var I = P/V;
        var densidad = 6;
        var S = Math.max(1.5, I/densidad);
        var normalizadas = [1.5,2.5,4,6,10];
        var Snorm = normalizadas.filter(function(x){ return x >= S; })[0] || 10;
        return [
          {label:'Corriente estimada', value: fmt(I,2), unit:'A'},
          {label:'Sección mínima recomendada', value: fmt(Snorm,1), unit:'mm² (mínimo 1.5 mm² por normativa)'},
          {label:'Nota', value:'Usa cable resistente al fuego y protección magnetotérmica independiente del alumbrado normal', unit:''}
        ];
      }
    }
  ];

  /* ============================================================
     CATEGORÍA: COMPONENTES ELECTRÓNICOS
     ============================================================ */
  var COMPONENTES = [
    {
      id:'color_resistencia_bandas', cat:'componentes', icono:'▬', titulo:'Código de colores de resistencias',
      info:'4 bandas: (10·d1 + d2) × multiplicador, con tolerancia',
      fields:[
        {key:'b1', label:'Banda 1 (1ª cifra)', type:'select', options: optsNombres(COLOR_DIGITO), def:'Marrón'},
        {key:'b2', label:'Banda 2 (2ª cifra)', type:'select', options: optsNombres(COLOR_DIGITO), def:'Negro'},
        {key:'b3', label:'Banda 3 (multiplicador)', type:'select', options: optsNombres(COLOR_MULT), def:'Rojo'},
        {key:'b4', label:'Banda 4 (tolerancia)', type:'select', options: optsNombres(COLOR_TOL), def:'Oro'}
      ],
      compute:function(v){
        var d1 = porNombre(COLOR_DIGITO, gv(v,'b1','Marrón')).v;
        var d2 = porNombre(COLOR_DIGITO, gv(v,'b2','Negro')).v;
        var mult = porNombre(COLOR_MULT, gv(v,'b3','Rojo')).m;
        var tol = porNombre(COLOR_TOL, gv(v,'b4','Oro')).t;
        var valor = (d1*10+d2)*mult;
        return [{label:'Valor de la resistencia', value: fmt(valor,3), unit:'Ω'},
                {label:'Tolerancia', value:'±'+tol, unit:'%'}];
      }
    },
    {
      id:'valor_a_colores', cat:'componentes', icono:'▬', titulo:'Colores de una resistencia según su valor',
      info:'Introduce el valor en ohmios y obtén las bandas de color de 4 bandas',
      fields:[
        {key:'valor', label:'Valor de la resistencia', unit:'Ω', type:'number'}
      ],
      compute:function(v){
        var valor = gn(v,'valor');
        must(valor > 0, 'El valor debe ser mayor que 0');
        var exp = Math.floor(Math.log10(valor));
        var mantisaExp = exp - 1;
        var mant = Math.round(valor / Math.pow(10, mantisaExp));
        if(mant >= 100){ mant = Math.round(mant/10); mantisaExp += 1; }
        var d1 = Math.floor(mant/10), d2 = mant%10;
        var multVal = Math.pow(10, mantisaExp);
        var c1 = COLOR_DIGITO.filter(function(c){return c.v===d1;})[0];
        var c2 = COLOR_DIGITO.filter(function(c){return c.v===d2;})[0];
        var c3 = COLOR_MULT.filter(function(c){return Math.abs(c.m-multVal)<1e-9;})[0];
        return [
          {label:'Banda 1', value: c1?c1.n:'—', unit:''},
          {label:'Banda 2', value: c2?c2.n:'—', unit:''},
          {label:'Banda 3 (multiplicador)', value: c3?c3.n:'fuera de rango', unit:''},
          {label:'Valor reconstruido', value: fmt(d1*10*multVal + d2*multVal,3), unit:'Ω'}
        ];
      }
    },
    {
      id:'resistencia_smd', cat:'componentes', icono:'SMD', titulo:'Código de resistencias SMD',
      info:'Código de 3 dígitos: los dos primeros son las cifras y el tercero el multiplicador (ej. 472 = 47×10² = 4700Ω). Con 4 dígitos, los tres primeros son cifras.',
      fields:[
        {key:'codigo', label:'Código impreso (ej: 472, 1002, 4R7)', type:'text'}
      ],
      compute:function(v){
        var raw = (gv(v,'codigo','') + '').trim().toUpperCase();
        must(raw.length >= 3, 'Introduce un código de al menos 3 caracteres');
        if(raw.indexOf('R') !== -1){
          var partes = raw.split('R');
          var val = parseFloat(partes[0]+'.'+(partes[1]||'0'));
          must(Number.isFinite(val), 'Código no válido');
          return [{label:'Valor', value: fmt(val,3), unit:'Ω'}];
        }
        must(/^\d+$/.test(raw), 'El código debe ser numérico (o usar "R" como coma decimal)');
        var mult = parseInt(raw[raw.length-1],10);
        var cifras = raw.slice(0,-1);
        var valor = parseInt(cifras,10) * Math.pow(10, mult);
        return [{label:'Valor', value: fmt(valor,3), unit:'Ω'}];
      }
    },
    {
      id:'codigo_condensador', cat:'componentes', icono:'⎓', titulo:'Código de condensadores (EIA de 3 dígitos)',
      info:'Los dos primeros dígitos son las cifras y el tercero el multiplicador, resultado en picofaradios (ej. 104 = 10×10⁴ pF = 100 nF = 0.1 µF)',
      fields:[
        {key:'codigo', label:'Código impreso (3 dígitos, ej: 104)', type:'text'}
      ],
      compute:function(v){
        var raw = (gv(v,'codigo','') + '').trim();
        must(/^\d{3}$/.test(raw), 'Introduce exactamente 3 dígitos');
        var cifras = parseInt(raw.slice(0,2),10), mult = parseInt(raw[2],10);
        var pF = cifras*Math.pow(10,mult);
        return [
          {label:'Valor', value: fmt(pF,2), unit:'pF'},
          {label:'Equivalente', value: fmt(pF/1000,4), unit:'nF'},
          {label:'Equivalente', value: fmt(pF/1e6,6), unit:'µF'}
        ];
      }
    },
    {
      id:'tabla_condensadores', cat:'componentes', icono:'⎓', titulo:'Tabla de códigos de tolerancia de condensadores',
      info:'Letra de tolerancia habitual impresa junto al código EIA',
      fields:[
        {key:'letra', label:'Letra de tolerancia', type:'select', options:[
          {value:'B',label:'B — ±0.1 pF'},{value:'C',label:'C — ±0.25 pF'},{value:'D',label:'D — ±0.5 pF'},
          {value:'F',label:'F — ±1%'},{value:'G',label:'G — ±2%'},{value:'J',label:'J — ±5%'},
          {value:'K',label:'K — ±10%'},{value:'M',label:'M — ±20%'},{value:'Z',label:'Z — +80%/-20%'}
        ], def:'K'}
      ],
      compute:function(v){
        var tabla = {B:'±0.1 pF',C:'±0.25 pF',D:'±0.5 pF',F:'±1%',G:'±2%',J:'±5%',K:'±10%',M:'±20%',Z:'+80% / −20%'};
        var letra = gv(v,'letra','K');
        return [{label:'Tolerancia', value: tabla[letra], unit:''}];
      }
    },
    {
      id:'codigo_inductor', cat:'componentes', icono:'L', titulo:'Código alfanumérico de inductores',
      info:'Igual que el código EIA de condensadores pero el resultado se expresa en microhenrios (µH)',
      fields:[
        {key:'codigo', label:'Código impreso (3 dígitos, ej: 101)', type:'text'}
      ],
      compute:function(v){
        var raw = (gv(v,'codigo','') + '').trim();
        must(/^\d{3}$/.test(raw), 'Introduce exactamente 3 dígitos');
        var cifras = parseInt(raw.slice(0,2),10), mult = parseInt(raw[2],10);
        return [{label:'Valor', value: fmt(cifras*Math.pow(10,mult),2), unit:'µH'}];
      }
    },
    {
      id:'fusibles', cat:'componentes', icono:'⏛', titulo:'Fusibles (marcado, cartucho, tipos D/NH, automoción)',
      info:'Consulta rápida de calibres normalizados habituales por tipo de fusible',
      fields:[
        {key:'tipo', label:'Tipo de fusible', type:'select', options:[
          {value:'D', label:'Tipo D (rosca DIAZED)'}, {value:'NH', label:'Tipo NH (cuchillas)'},
          {value:'cartucho', label:'Cilíndrico (cartucho 5×20 / 10×38)'}, {value:'automocion', label:'Automoción (hoja/mini)'}
        ], def:'D'}
      ],
      compute:function(v){
        var tabla = {
          D: '2, 4, 6, 10, 16, 20, 25, 35, 50, 63 A',
          NH: '16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400 A',
          cartucho: '0.5, 1, 2, 3.15, 5, 6.3, 8, 10, 16, 20 A',
          automocion: '5, 7.5, 10, 15, 20, 25, 30, 40 A'
        };
        return [{label:'Calibres normalizados habituales', value: tabla[gv(v,'tipo','D')], unit:''}];
      }
    },
    {
      id:'suma_resistencias', cat:'componentes', icono:'ΣR', titulo:'Suma de resistencias',
      info:'Serie: R = R1+R2+…  Paralelo: 1/R = 1/R1+1/R2+…',
      fields:[
        {key:'modo', label:'Conexión', type:'select', options:[{value:'serie',label:'Serie'},{value:'paralelo',label:'Paralelo'}], def:'serie'},
        {key:'R1', label:'R1', unit:'Ω', type:'number'},
        {key:'R2', label:'R2', unit:'Ω', type:'number'},
        {key:'R3', label:'R3 (opcional)', unit:'Ω', type:'number'},
        {key:'R4', label:'R4 (opcional)', unit:'Ω', type:'number'}
      ],
      compute:function(v){
        var modo = gv(v,'modo','serie');
        var vals = ['R1','R2','R3','R4'].map(function(k){ return gnOpt(v,k,null); }).filter(function(x){ return x!==null; });
        must(vals.length >= 2, 'Introduce al menos dos resistencias');
        var total;
        if(modo === 'serie') total = vals.reduce(function(a,b){ return a+b; },0);
        else { must(vals.every(function(x){return x!==0;}), 'Ninguna resistencia puede ser 0 en paralelo'); total = 1/vals.reduce(function(a,b){ return a+1/b; },0); }
        return [{label:'Resistencia equivalente', value: fmt(total,4), unit:'Ω'}];
      }
    },
    {
      id:'suma_condensadores', cat:'componentes', icono:'ΣC', titulo:'Suma de condensadores',
      info:'Paralelo: C = C1+C2+…  Serie: 1/C = 1/C1+1/C2+… (al revés que las resistencias)',
      fields:[
        {key:'modo', label:'Conexión', type:'select', options:[{value:'paralelo',label:'Paralelo'},{value:'serie',label:'Serie'}], def:'paralelo'},
        {key:'C1', label:'C1', unit:'µF', type:'number'},
        {key:'C2', label:'C2', unit:'µF', type:'number'},
        {key:'C3', label:'C3 (opcional)', unit:'µF', type:'number'},
        {key:'C4', label:'C4 (opcional)', unit:'µF', type:'number'}
      ],
      compute:function(v){
        var modo = gv(v,'modo','paralelo');
        var vals = ['C1','C2','C3','C4'].map(function(k){ return gnOpt(v,k,null); }).filter(function(x){ return x!==null; });
        must(vals.length >= 2, 'Introduce al menos dos condensadores');
        var total;
        if(modo === 'paralelo') total = vals.reduce(function(a,b){ return a+b; },0);
        else { must(vals.every(function(x){return x!==0;}), 'Ningún condensador puede ser 0 en serie'); total = 1/vals.reduce(function(a,b){ return a+1/b; },0); }
        return [{label:'Capacidad equivalente', value: fmt(total,4), unit:'µF'}];
      }
    },
    {
      id:'divisor_tension', cat:'componentes', icono:'÷V', titulo:'Divisor de tensión',
      info:'Vout = Vin · R2 / (R1 + R2)',
      fields:[
        {key:'Vin', label:'Tensión de entrada', unit:'V', type:'number'},
        {key:'R1', label:'R1 (superior)', unit:'Ω', type:'number'},
        {key:'R2', label:'R2 (inferior)', unit:'Ω', type:'number'}
      ],
      compute:function(v){
        var Vin = gn(v,'Vin'), R1 = gn(v,'R1'), R2 = gn(v,'R2');
        must(R1+R2 !== 0, 'La suma de resistencias no puede ser 0');
        return [{label:'Tensión de salida (Vout)', value: fmt(Vin*R2/(R1+R2),3), unit:'V'}];
      }
    },
    {
      id:'divisor_corriente', cat:'componentes', icono:'÷A', titulo:'Divisor de corriente',
      info:'I2 = I · R1 / (R1 + R2) — la corriente se reparte de forma inversamente proporcional a cada rama',
      fields:[
        {key:'I', label:'Corriente total', unit:'A', type:'number'},
        {key:'R1', label:'R1 (rama 1)', unit:'Ω', type:'number'},
        {key:'R2', label:'R2 (rama 2)', unit:'Ω', type:'number'}
      ],
      compute:function(v){
        var I = gn(v,'I'), R1 = gn(v,'R1'), R2 = gn(v,'R2');
        must(R1+R2 !== 0, 'La suma de resistencias no puede ser 0');
        return [{label:'Corriente por R1', value: fmt(I*R2/(R1+R2),4), unit:'A'},
                {label:'Corriente por R2', value: fmt(I*R1/(R1+R2),4), unit:'A'}];
      }
    },
    {
      id:'resistencia_led', cat:'componentes', icono:'LED', titulo:'Resistencia para LED',
      info:'R = (Vs − Vled) / Iled',
      fields:[
        {key:'Vs', label:'Tensión de la fuente', unit:'V', type:'number'},
        {key:'Vled', label:'Tensión directa del LED', unit:'V', type:'number', def:2},
        {key:'Iled', label:'Corriente del LED', unit:'mA', type:'number', def:20}
      ],
      compute:function(v){
        var Vs = gn(v,'Vs'), Vled = gn(v,'Vled'), Iled = gn(v,'Iled')/1000;
        must(Vs > Vled, 'La tensión de la fuente debe ser mayor que la del LED');
        must(Iled !== 0, 'La corriente no puede ser 0');
        var R = (Vs-Vled)/Iled;
        return [{label:'Resistencia necesaria', value: fmt(R,1), unit:'Ω'},
                {label:'Potencia disipada por la resistencia', value: fmt(R*Iled*Iled,3), unit:'W'}];
      }
    },
    {
      id:'resistencia_reducir_tension', cat:'componentes', icono:'R', titulo:'Resistencia para reducir la tensión',
      info:'R = (Vin − Vout) / I',
      fields:[
        {key:'Vin', label:'Tensión de entrada', unit:'V', type:'number'},
        {key:'Vout', label:'Tensión deseada', unit:'V', type:'number'},
        {key:'I', label:'Corriente de la carga', unit:'A', type:'number'}
      ],
      compute:function(v){
        var Vin = gn(v,'Vin'), Vout = gn(v,'Vout'), I = gn(v,'I');
        must(I !== 0, 'La corriente no puede ser 0');
        var R = (Vin-Vout)/I;
        return [{label:'Resistencia necesaria', value: fmt(R,3), unit:'Ω'},
                {label:'Potencia a disipar', value: fmt((Vin-Vout)*I,3), unit:'W'}];
      }
    },
    {
      id:'zener_estabilizador', cat:'componentes', icono:'Z', titulo:'Diodo Zener como estabilizador de tensión',
      info:'Rs = (Vin − Vz) / (Iz + Iload) — resistencia de serie para polarizar el zener y alimentar la carga',
      fields:[
        {key:'Vin', label:'Tensión de entrada', unit:'V', type:'number'},
        {key:'Vz', label:'Tensión del zener', unit:'V', type:'number'},
        {key:'Iz', label:'Corriente de polarización del zener', unit:'mA', type:'number', def:10},
        {key:'Iload', label:'Corriente de la carga', unit:'mA', type:'number', def:0}
      ],
      compute:function(v){
        var Vin = gn(v,'Vin'), Vz = gn(v,'Vz'), Iz = gn(v,'Iz')/1000, Il = gnOpt(v,'Iload',0)/1000;
        must(Vin > Vz, 'Vin debe ser mayor que Vz');
        var Itot = Iz+Il;
        must(Itot !== 0, 'La corriente total no puede ser 0');
        var Rs = (Vin-Vz)/Itot;
        return [{label:'Resistencia de serie (Rs)', value: fmt(Rs,2), unit:'Ω'},
                {label:'Potencia disipada en Rs', value: fmt(Rs*Itot*Itot,3), unit:'W'},
                {label:'Potencia disipada en el zener', value: fmt(Vz*Iz,3), unit:'W'}];
      }
    },
    {
      id:'frecuencia_resonancia', cat:'componentes', icono:'f₀', titulo:'Frecuencia de resonancia',
      info:'f₀ = 1 / (2π√(L·C)) — circuito LC serie/paralelo',
      fields:[
        {key:'L', label:'Inductancia', unit:'H', type:'number'},
        {key:'C', label:'Capacidad', unit:'F', type:'number'}
      ],
      compute:function(v){
        var L = gn(v,'L'), C = gn(v,'C');
        must(L > 0 && C > 0, 'L y C deben ser mayores que 0');
        return [{label:'Frecuencia de resonancia', value: fmt(1/(2*Math.PI*Math.sqrt(L*C)),2), unit:'Hz'}];
      }
    }
  ];

  /* ============================================================
     CATEGORÍA: TRANSFORMADORES Y POTENCIA
     ============================================================ */
  var TRANSFORMADORES = [
    {
      id:'devanado_transformador', cat:'transformadores', icono:'◈', titulo:'Devanado primario/secundario del transformador',
      info:'Np/Ns = Vp/Vs = Is/Ip (relación de transformación ideal)',
      fields:[
        {key:'Vp', label:'Tensión primario', unit:'V', type:'number'},
        {key:'Vs', label:'Tensión secundario', unit:'V', type:'number'},
        {key:'Np', label:'Nº de vueltas primario (Np, opcional)', unit:'', type:'number'},
        {key:'Ip', label:'Corriente primario (Ip, opcional)', unit:'A', type:'number'}
      ],
      compute:function(v){
        var Vp = gn(v,'Vp'), Vs = gn(v,'Vs');
        must(Vs !== 0, 'La tensión secundaria no puede ser 0');
        var relacion = Vp/Vs;
        var res = [{label:'Relación de transformación (Vp/Vs)', value: fmt(relacion,4), unit:''}];
        var Np = gnOpt(v,'Np',null);
        if(Np !== null) res.push({label:'Vueltas en el secundario (Ns)', value: fmt(Np/relacion,1), unit:''});
        var Ip = gnOpt(v,'Ip',null);
        if(Ip !== null) res.push({label:'Corriente en el secundario (Is)', value: fmt(Ip*relacion,3), unit:'A'});
        return res;
      }
    },
    {
      id:'correccion_factor_potencia', cat:'transformadores', icono:'cosφ', titulo:'Corrección del factor de potencia',
      info:'Qc = P·(tanφ1 − tanφ2). C = Qc / (2π·f·V²) [mono]; C = Qc / (2π·f·3·V²) [trifásico, condensadores en triángulo a tensión de línea]',
      fields:[
        {key:'P', label:'Potencia activa', unit:'kW', type:'number'},
        {key:'cosphi1', label:'cosφ actual', unit:'', type:'number'},
        {key:'cosphi2', label:'cosφ objetivo', unit:'', type:'number', def:0.95},
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'f', label:'Frecuencia', unit:'Hz', type:'number', def:50},
        {key:'tipo', label:'Tipo de suministro', type:'select', options:[
          {value:'monofasico', label:'Monofásico'}, {value:'trifasico', label:'Trifásico'}
        ], def:'trifasico'}
      ],
      compute:function(v){
        var P = gn(v,'P')*1000, cf1 = gn(v,'cosphi1'), cf2 = gn(v,'cosphi2'), V = gn(v,'V'), f = gn(v,'f'), tipo = gv(v,'tipo','trifasico');
        must(cf1 > 0 && cf1 <= 1 && cf2 > 0 && cf2 <= 1, 'Los cosφ deben estar entre 0 y 1');
        var tan1 = Math.sqrt(1/(cf1*cf1)-1), tan2 = Math.sqrt(1/(cf2*cf2)-1);
        var Qc = P*(tan1-tan2);
        must(Qc >= 0, 'El cosφ objetivo debe ser mayor que el actual');
        var den = tipo === 'trifasico' ? 2*Math.PI*f*3*V*V : 2*Math.PI*f*V*V;
        var C = Qc/den;
        return [
          {label:'Potencia reactiva a compensar (Qc)', value: fmt(Qc/1000,3), unit:'kvar'},
          {label:'Capacidad necesaria (por fase si es trifásico)', value: fmt(C*1e6,2), unit:'µF'}
        ];
      }
    },
    {
      id:'correccion_fp_transformadores', cat:'transformadores', icono:'cosφ', titulo:'Corrección del factor de potencia de transformadores en vacío',
      info:'Estimación de la batería de condensadores para compensar la energía reactiva de magnetización en vacío del transformador, a partir de su corriente de vacío (Io%) y potencia nominal',
      fields:[
        {key:'Sn', label:'Potencia nominal del transformador', unit:'kVA', type:'number'},
        {key:'Io_pct', label:'Corriente de vacío (Io%)', unit:'%', type:'number', def:2},
        {key:'V', label:'Tensión', unit:'V', type:'number'},
        {key:'f', label:'Frecuencia', unit:'Hz', type:'number', def:50}
      ],
      compute:function(v){
        var Sn = gn(v,'Sn')*1000, Io = gn(v,'Io_pct')/100, V = gn(v,'V'), f = gn(v,'f');
        var Qc = Sn*Io;
        var C = Qc/(2*Math.PI*f*3*V*V);
        return [
          {label:'Reactiva de magnetización estimada', value: fmt(Qc/1000,3), unit:'kvar'},
          {label:'Capacidad orientativa (por fase)', value: fmt(C*1e6,2), unit:'µF'}
        ];
      }
    },
    {
      id:'potencia_condensador_otra_tension', cat:'transformadores', icono:'⎓', titulo:'Potencia del condensador a una tensión diferente',
      info:'La potencia reactiva de un condensador escala con el cuadrado de la tensión: Q2 = Q1·(V2/V1)²',
      fields:[
        {key:'Q1', label:'Potencia reactiva nominal (Q1)', unit:'kvar', type:'number'},
        {key:'V1', label:'Tensión nominal (V1)', unit:'V', type:'number'},
        {key:'V2', label:'Nueva tensión (V2)', unit:'V', type:'number'}
      ],
      compute:function(v){
        var Q1 = gn(v,'Q1'), V1 = gn(v,'V1'), V2 = gn(v,'V2');
        must(V1 !== 0, 'V1 no puede ser 0');
        return [{label:'Potencia reactiva a la nueva tensión', value: fmt(Q1*Math.pow(V2/V1,2),3), unit:'kvar'}];
      }
    }
  ];

  /* ============================================================
     CATEGORÍA: UTILIDADES
     ============================================================ */
  var UTILIDADES = [
    {
      id:'duracion_bateria', cat:'utilidades', titulo:'Duración de la batería',
      info:'t = (Capacidad · Vbat · eficiencia) / Pconsumo',
      fields:[
        {key:'capacidad', label:'Capacidad de la batería', unit:'Ah', type:'number'},
        {key:'Vbat', label:'Tensión de la batería', unit:'V', type:'number'},
        {key:'potencia', label:'Potencia de consumo', unit:'W', type:'number'},
        {key:'eficiencia', label:'Eficiencia del sistema', unit:'%', type:'number', def:90}
      ],
      compute:function(v){
        var cap = gn(v,'capacidad'), Vbat = gn(v,'Vbat'), P = gn(v,'potencia'), ef = gnOpt(v,'eficiencia',90)/100;
        must(P !== 0, 'La potencia no puede ser 0');
        var t = (cap*Vbat*ef)/P;
        return [{label:'Duración estimada', value: fmt(t,2), unit:'horas'}];
      }
    },
    {
      id:'longitud_antena', cat:'utilidades', titulo:'Longitud de la antena',
      info:'Antena de cuarto de onda: L = c/(4·f). Antena de media onda: L = c/(2·f). c = 3×10⁸ m/s',
      fields:[
        {key:'f', label:'Frecuencia', unit:'MHz', type:'number'},
        {key:'tipo', label:'Tipo de antena', type:'select', options:[
          {value:'cuarto', label:'Cuarto de onda (λ/4)'}, {value:'media', label:'Media onda (λ/2)'}
        ], def:'cuarto'}
      ],
      compute:function(v){
        var f = gn(v,'f')*1e6, tipo = gv(v,'tipo','cuarto');
        must(f !== 0, 'La frecuencia no puede ser 0');
        var c = 3e8;
        var L = tipo === 'cuarto' ? c/(4*f) : c/(2*f);
        return [{label:'Longitud de la antena', value: fmt(L*100,2), unit:'cm'}];
      }
    },
    {
      id:'cctv_disco_duro', cat:'utilidades', titulo:'CCTV: dimensionamiento de disco duro',
      info:'Almacenamiento(GB) = bitrate(Mbps) × canales × horas/día × días de grabación / 8',
      fields:[
        {key:'bitrate', label:'Bitrate por cámara', unit:'Mbps', type:'number', def:4},
        {key:'canales', label:'Número de cámaras', unit:'', type:'number'},
        {key:'horas', label:'Horas de grabación al día', unit:'h', type:'number', def:24},
        {key:'dias', label:'Días de retención deseados', unit:'', type:'number', def:30}
      ],
      compute:function(v){
        var br = gn(v,'bitrate'), canales = gn(v,'canales'), horas = gnOpt(v,'horas',24), dias = gnOpt(v,'dias',30);
        var GB = (br*canales*horas*3600*dias)/(8*1000);
        return [{label:'Almacenamiento necesario', value: fmt(GB,1), unit:'GB'},
                {label:'Equivalente', value: fmt(GB/1000,2), unit:'TB'}];
      }
    },
    {
      id:'efecto_joule', cat:'utilidades', icono:'J', titulo:'Efecto Joule',
      info:'Q = I²·R·t — energía disipada en forma de calor por una resistencia',
      fields:[
        {key:'I', label:'Corriente', unit:'A', type:'number'},
        {key:'R', label:'Resistencia', unit:'Ω', type:'number'},
        {key:'t', label:'Tiempo', unit:'s', type:'number'}
      ],
      compute:function(v){
        var I = gn(v,'I'), R = gn(v,'R'), t = gn(v,'t');
        var Q = I*I*R*t;
        return [
          {label:'Energía disipada', value: fmt(Q,2), unit:'J'},
          {label:'Equivalente', value: fmt(Q/3600,4), unit:'Wh'},
          {label:'Equivalente', value: fmt(Q/4184,2), unit:'kcal'}
        ];
      }
    },
    {
      id:'sensores_temperatura', cat:'utilidades', titulo:'Sensores de temperatura (PT100/PT1000/Ni/Cu, NTC)',
      info:'Aproximación lineal R = R0·(1 + α·ΔT), válida en un rango moderado alrededor de 0°C',
      fields:[
        {key:'tipo', label:'Tipo de sensor', type:'select', options:[
          {value:'PT100', label:'PT100 (R0=100Ω, α=0.00385)'},
          {value:'PT1000', label:'PT1000 (R0=1000Ω, α=0.00385)'},
          {value:'Ni100', label:'Ni100 (R0=100Ω, α=0.00618)'},
          {value:'Cu10', label:'Cu10 (R0=10Ω, α=0.00427)'}
        ], def:'PT100'},
        {key:'R', label:'Resistencia medida', unit:'Ω', type:'number'}
      ],
      compute:function(v){
        var tabla = { PT100:{R0:100,a:0.00385}, PT1000:{R0:1000,a:0.00385}, Ni100:{R0:100,a:0.00618}, Cu10:{R0:10,a:0.00427} };
        var t = tabla[gv(v,'tipo','PT100')];
        var R = gn(v,'R');
        var temp = (R/t.R0 - 1)/t.a;
        return [{label:'Temperatura estimada', value: fmt(temp,1), unit:'°C'}];
      }
    },
    {
      id:'senal_analogica', cat:'utilidades', icono:'∿', titulo:'Valores de señal analógica (conversión 4-20mA / 0-10V)',
      info:'Escalado lineal entre el rango de la señal y el rango de ingeniería de la magnitud medida',
      fields:[
        {key:'senal_tipo', label:'Tipo de señal', type:'select', options:[
          {value:'4-20', label:'4–20 mA'}, {value:'0-20', label:'0–20 mA'}, {value:'0-10', label:'0–10 V'}
        ], def:'4-20'},
        {key:'senal_valor', label:'Valor actual de la señal', unit:'mA o V', type:'number'},
        {key:'ing_min', label:'Valor mínimo de la magnitud', unit:'', type:'number', def:0},
        {key:'ing_max', label:'Valor máximo de la magnitud', unit:'', type:'number', def:100}
      ],
      compute:function(v){
        var tipo = gv(v,'senal_tipo','4-20'), s = gn(v,'senal_valor'), min = gnOpt(v,'ing_min',0), max = gnOpt(v,'ing_max',100);
        var rango = { '4-20':{lo:4,hi:20}, '0-20':{lo:0,hi:20}, '0-10':{lo:0,hi:10} }[tipo];
        var pct = (s-rango.lo)/(rango.hi-rango.lo);
        var valorIng = min + pct*(max-min);
        return [{label:'Porcentaje de escala', value: fmt(pct*100,2), unit:'%'},
                {label:'Valor de ingeniería', value: fmt(valorIng,3), unit:''}];
      }
    }
  ];

  /* ============================================================
     CATEGORÍA: MATERIALES DE OBRA
     ============================================================ */
  var MATERIALES = [
    {
      id:'ladrillos_bloques', cat:'materiales', titulo:'Ladrillos / bloques necesarios',
      info:'Unidades = superficie de pared × piezas por m² × (1 + merma). Piezas/m² orientativas según tipo de fábrica.',
      fields:[
        {key:'area', label:'Superficie de pared', unit:'m²', type:'number'},
        {key:'tipo', label:'Tipo de pieza', type:'select', options:[
          {value:'50', label:'Ladrillo hueco doble (≈50 uds/m²)'},
          {value:'27', label:'Ladrillo perforado/tochana (≈27 uds/m²)'},
          {value:'12.5', label:'Bloque de hormigón 40×20×20 (≈12.5 uds/m²)'},
          {value:'9', label:'Bloque termoarcilla (≈9 uds/m²)'}
        ], def:'50'},
        {key:'merma', label:'Merma', unit:'%', type:'number', def:5}
      ],
      compute:function(v){
        var area = gn(v,'area'), piezasM2 = gn(v,'tipo'), merma = gnOpt(v,'merma',5);
        var uds = area*piezasM2*(1+merma/100);
        return [{label:'Piezas necesarias', value: fmt(Math.ceil(uds),0), unit:'uds'}];
      }
    },
    {
      id:'mortero_albanileria', cat:'materiales', titulo:'Mortero de albañilería',
      info:'kg = superficie × espesor(cm) × consumo por cm de espesor (orientativo ≈17 kg/m²/cm), con merma por mermado/derrame',
      fields:[
        {key:'area', label:'Superficie a asentar/enlucir', unit:'m²', type:'number'},
        {key:'espesor', label:'Espesor de la capa', unit:'cm', type:'number', def:1.5},
        {key:'consumo', label:'Consumo por cm de espesor', unit:'kg/m²/cm', type:'number', def:17},
        {key:'merma', label:'Merma por derrame/mermado', unit:'%', type:'number', def:10}
      ],
      compute:function(v){
        var area = gn(v,'area'), esp = gn(v,'espesor'), cons = gnOpt(v,'consumo',17), merma = gnOpt(v,'merma',10);
        var kg = area*esp*cons*(1+merma/100);
        return [{label:'Mortero necesario', value: fmt(kg,1), unit:'kg'},
                {label:'Sacos de 25 kg', value: fmt(Math.ceil(kg/25),0), unit:'sacos'}];
      }
    },
    {
      id:'cemento_arena', cat:'materiales', titulo:'Cemento y arena (dosificación)',
      info:'A partir del volumen total de mezcla y la proporción cemento:arena en volumen (densidades orientativas: cemento 1400 kg/m³, arena 1500 kg/m³), con merma por derrame',
      fields:[
        {key:'volumen', label:'Volumen total de mezcla', unit:'m³', type:'number'},
        {key:'proporcion', label:'Proporción cemento:arena', type:'select', options:[
          {value:'2', label:'1:2 (muy resistente)'}, {value:'3', label:'1:3 (habitual)'},
          {value:'4', label:'1:4'}, {value:'5', label:'1:5 (poco exigente)'}
        ], def:'3'},
        {key:'merma', label:'Merma por derrame', unit:'%', type:'number', def:5}
      ],
      compute:function(v){
        var vol = gn(v,'volumen'), r = gn(v,'proporcion'), merma = gnOpt(v,'merma',5);
        var volCemento = vol/(1+r)*(1+merma/100), volArena = vol*r/(1+r)*(1+merma/100);
        var kgCemento = volCemento*1400, kgArena = volArena*1500;
        return [
          {label:'Cemento', value: fmt(kgCemento,0), unit:'kg'},
          {label:'Sacos de cemento (25 kg)', value: fmt(Math.ceil(kgCemento/25),0), unit:'sacos'},
          {label:'Arena', value: fmt(kgArena,0), unit:'kg'}
        ];
      }
    },
    {
      id:'hormigon', cat:'materiales', titulo:'Hormigón necesario',
      info:'Volumen = largo × ancho × profundidad, con margen por irregularidades del encofrado/terreno. Cemento orientativo ≈300 kg/m³ para hormigón en masa tipo HM-20',
      fields:[
        {key:'largo', label:'Largo', unit:'m', type:'number'},
        {key:'ancho', label:'Ancho', unit:'m', type:'number'},
        {key:'profundidad', label:'Profundidad / espesor', unit:'m', type:'number'},
        {key:'merma', label:'Margen por encofrado/terreno irregular', unit:'%', type:'number', def:5}
      ],
      compute:function(v){
        var l = gn(v,'largo'), a = gn(v,'ancho'), p = gn(v,'profundidad'), merma = gnOpt(v,'merma',5);
        var vol = l*a*p*(1+merma/100);
        return [
          {label:'Volumen de hormigón', value: fmt(vol,3), unit:'m³'},
          {label:'Cemento orientativo (≈300 kg/m³)', value: fmt(vol*300,0), unit:'kg'}
        ];
      }
    },
    {
      id:'grava_arido', cat:'materiales', titulo:'Grava / árido necesario',
      info:'Volumen = largo × ancho × profundidad, con margen por asentamiento/irregularidades. Densidad orientativa del árido ≈1.5 t/m³',
      fields:[
        {key:'largo', label:'Largo', unit:'m', type:'number'},
        {key:'ancho', label:'Ancho', unit:'m', type:'number'},
        {key:'profundidad', label:'Profundidad de la capa', unit:'m', type:'number'},
        {key:'merma', label:'Margen por asentamiento', unit:'%', type:'number', def:10}
      ],
      compute:function(v){
        var l = gn(v,'largo'), a = gn(v,'ancho'), p = gn(v,'profundidad'), merma = gnOpt(v,'merma',10);
        var vol = l*a*p*(1+merma/100);
        return [
          {label:'Volumen de árido', value: fmt(vol,3), unit:'m³'},
          {label:'Peso orientativo (≈1.5 t/m³)', value: fmt(vol*1.5,2), unit:'t'}
        ];
      }
    },
    {
      id:'yeso_enlucido', cat:'materiales', titulo:'Yeso / enlucido',
      info:'kg ≈ superficie × espesor(mm) × 1 kg/m²/mm (regla orientativa habitual), con merma por derrame',
      fields:[
        {key:'area', label:'Superficie a enlucir', unit:'m²', type:'number'},
        {key:'espesor', label:'Espesor de la capa', unit:'mm', type:'number', def:15},
        {key:'merma', label:'Merma por derrame', unit:'%', type:'number', def:10}
      ],
      compute:function(v){
        var area = gn(v,'area'), esp = gn(v,'espesor'), merma = gnOpt(v,'merma',10);
        var kg = area*esp*(1+merma/100);
        return [{label:'Yeso necesario', value: fmt(kg,0), unit:'kg'},
                {label:'Sacos de 25 kg', value: fmt(Math.ceil(kg/25),0), unit:'sacos'}];
      }
    },
    {
      id:'pladur', cat:'materiales', titulo:'Pladur / placas de yeso laminado',
      info:'Placa estándar 1.2×2.4 m ≈2.88 m², con merma editable para cortes',
      fields:[
        {key:'area', label:'Superficie a cubrir (ambas caras si aplica)', unit:'m²', type:'number'},
        {key:'merma', label:'Merma para cortes', unit:'%', type:'number', def:10}
      ],
      compute:function(v){
        var area = gn(v,'area'), merma = gnOpt(v,'merma',10);
        var placas = Math.ceil((area*(1+merma/100))/2.88);
        return [
          {label:'Placas necesarias', value: fmt(placas,0), unit:'uds'},
          {label:'Perfilería orientativa', value: fmt(Math.round(area*0.9),0), unit:'m lineales'},
          {label:'Tornillería orientativa', value: fmt(Math.round(area*20),0), unit:'uds'}
        ];
      }
    },
    {
      id:'aislamiento', cat:'materiales', titulo:'Aislamiento (paneles / rollos)',
      info:'Nº de paquetes = superficie × (1 + merma) / superficie que cubre cada paquete',
      fields:[
        {key:'area', label:'Superficie a aislar', unit:'m²', type:'number'},
        {key:'cobertura', label:'Superficie que cubre cada rollo/panel', unit:'m²', type:'number', def:8},
        {key:'merma', label:'Merma por solapes/recortes', unit:'%', type:'number', def:5}
      ],
      compute:function(v){
        var area = gn(v,'area'), cob = gn(v,'cobertura'), merma = gnOpt(v,'merma',5);
        must(cob > 0, 'La cobertura debe ser mayor que 0');
        return [{label:'Rollos / paneles necesarios', value: fmt(Math.ceil((area*(1+merma/100))/cob),0), unit:'uds'}];
      }
    }
  ];

  /* ============================================================
     CATEGORÍA: PINTURA
     ============================================================ */
  var PINTURA = [
    {
      id:'superficie_pintura', cat:'pintura', titulo:'Superficie a pintar',
      info:'Área de paredes = perímetro × altura − huecos de puertas/ventanas. Techo opcional aparte.',
      fields:[
        {key:'largo', label:'Largo de la habitación', unit:'m', type:'number'},
        {key:'ancho', label:'Ancho de la habitación', unit:'m', type:'number'},
        {key:'alto', label:'Altura', unit:'m', type:'number', def:2.5},
        {key:'puertas', label:'Número de puertas', unit:'', type:'number', def:1},
        {key:'ventanas', label:'Número de ventanas', unit:'', type:'number', def:1},
        {key:'techo', label:'¿Pintar también el techo?', type:'select', options:[{value:'no',label:'No'},{value:'si',label:'Sí'}], def:'no'}
      ],
      compute:function(v){
        var l = gn(v,'largo'), a = gn(v,'ancho'), h = gn(v,'alto'), puertas = gnOpt(v,'puertas',0), ventanas = gnOpt(v,'ventanas',0), techo = gv(v,'techo','no');
        var perimetro = 2*(l+a);
        var areaParedes = Math.max(0, perimetro*h - puertas*1.6 - ventanas*1.2);
        var res = [{label:'Área de paredes', value: fmt(areaParedes,2), unit:'m²'}];
        if(techo === 'si') res.push({label:'Área de techo', value: fmt(l*a,2), unit:'m²'});
        return res;
      }
    },
    {
      id:'litros_pintura', cat:'pintura', titulo:'Litros de pintura necesarios',
      info:'Litros = superficie × nº de manos / rendimiento del producto, con margen para retoques',
      fields:[
        {key:'area', label:'Superficie a pintar', unit:'m²', type:'number'},
        {key:'rendimiento', label:'Rendimiento de la pintura', unit:'m²/litro', type:'number', def:6},
        {key:'manos', label:'Número de manos', unit:'', type:'number', def:2},
        {key:'merma', label:'Margen para retoques', unit:'%', type:'number', def:5}
      ],
      compute:function(v){
        var area = gn(v,'area'), rend = gnOpt(v,'rendimiento',6), manos = gnOpt(v,'manos',2), merma = gnOpt(v,'merma',5);
        must(rend > 0, 'El rendimiento debe ser mayor que 0');
        var litros = (area*manos)/rend*(1+merma/100);
        return [
          {label:'Litros necesarios', value: fmt(litros,2), unit:'L'},
          {label:'Botes de 4 L recomendados', value: fmt(Math.ceil(litros/4),0), unit:'uds'}
        ];
      }
    },
    {
      id:'coste_pintura', cat:'pintura', titulo:'Coste estimado de pintura',
      info:'Coste = litros necesarios × precio por litro',
      fields:[
        {key:'litros', label:'Litros necesarios', unit:'L', type:'number'},
        {key:'precio', label:'Precio por litro', unit:'€/L', type:'number'}
      ],
      compute:function(v){
        var litros = gn(v,'litros'), precio = gn(v,'precio');
        return [{label:'Coste estimado', value: fmt(litros*precio,2), unit:'€'}];
      }
    }
  ];

  /* ============================================================
     CATEGORÍA: SUELOS Y REVESTIMIENTOS
     ============================================================ */
  var SUELOS = [
    {
      id:'baldosas_azulejos', cat:'suelos', titulo:'Baldosas / azulejos necesarios',
      info:'Piezas = superficie × (1 + merma) / superficie de cada pieza',
      fields:[
        {key:'area', label:'Superficie a alicatar/pavimentar', unit:'m²', type:'number'},
        {key:'lado_cm', label:'Lado de la pieza (cuadrada)', unit:'cm', type:'number', def:33},
        {key:'piezas_caja', label:'Piezas por caja', unit:'', type:'number', def:11},
        {key:'merma', label:'Merma / rotura', unit:'%', type:'number', def:10}
      ],
      compute:function(v){
        var area = gn(v,'area'), lado = gn(v,'lado_cm')/100, pc = gnOpt(v,'piezas_caja',11), merma = gnOpt(v,'merma',10);
        var areaPieza = lado*lado;
        must(areaPieza > 0, 'El lado de la pieza debe ser mayor que 0');
        var piezas = Math.ceil((area*(1+merma/100))/areaPieza);
        return [
          {label:'Piezas necesarias', value: fmt(piezas,0), unit:'uds'},
          {label:'Cajas necesarias', value: fmt(Math.ceil(piezas/pc),0), unit:'cajas'}
        ];
      }
    },
    {
      id:'tarima_parquet', cat:'suelos', titulo:'Tarima / parquet necesario',
      info:'Superficie a comprar = superficie real × (1 + % de desperdicio)',
      fields:[
        {key:'area', label:'Superficie del suelo', unit:'m²', type:'number'},
        {key:'merma', label:'Desperdicio por cortes', unit:'%', type:'number', def:8}
      ],
      compute:function(v){
        var area = gn(v,'area'), merma = gnOpt(v,'merma',8);
        return [{label:'Superficie a comprar', value: fmt(area*(1+merma/100),2), unit:'m²'}];
      }
    },
    {
      id:'rodapie', cat:'suelos', titulo:'Rodapié necesario',
      info:'Metros = perímetro de la habitación − huecos de puertas, con margen de desperdicio',
      fields:[
        {key:'largo', label:'Largo de la habitación', unit:'m', type:'number'},
        {key:'ancho', label:'Ancho de la habitación', unit:'m', type:'number'},
        {key:'puertas', label:'Número de puertas', unit:'', type:'number', def:1},
        {key:'merma', label:'Merma', unit:'%', type:'number', def:10}
      ],
      compute:function(v){
        var l = gn(v,'largo'), a = gn(v,'ancho'), puertas = gnOpt(v,'puertas',0), merma = gnOpt(v,'merma',10);
        var perimetro = Math.max(0, 2*(l+a) - puertas*0.8);
        return [{label:'Rodapié necesario', value: fmt(perimetro*(1+merma/100),2), unit:'m'}];
      }
    },
    {
      id:'mortero_cola', cat:'suelos', titulo:'Mortero cola necesario',
      info:'kg = superficie × consumo por m² (según llana/tamaño de pieza), con merma por derrame',
      fields:[
        {key:'area', label:'Superficie a alicatar/pavimentar', unit:'m²', type:'number'},
        {key:'consumo', label:'Consumo', unit:'kg/m²', type:'number', def:4},
        {key:'merma', label:'Merma por derrame', unit:'%', type:'number', def:10}
      ],
      compute:function(v){
        var area = gn(v,'area'), cons = gnOpt(v,'consumo',4), merma = gnOpt(v,'merma',10);
        var kg = area*cons*(1+merma/100);
        return [{label:'Mortero cola necesario', value: fmt(kg,1), unit:'kg'},
                {label:'Sacos de 25 kg', value: fmt(Math.ceil(kg/25),0), unit:'sacos'}];
      }
    },
    {
      id:'juntas_alicatado', cat:'suelos', titulo:'Material de juntas necesario',
      info:'kg/m² ≈ ((L+A)/(L·A)) × espesor de pieza × ancho de junta × densidad del material, con merma por derrame',
      fields:[
        {key:'area', label:'Superficie alicatada', unit:'m²', type:'number'},
        {key:'lado_l', label:'Largo de la pieza', unit:'cm', type:'number', def:33},
        {key:'lado_a', label:'Ancho de la pieza', unit:'cm', type:'number', def:33},
        {key:'espesor_pieza', label:'Espesor de la pieza', unit:'mm', type:'number', def:8},
        {key:'ancho_junta', label:'Ancho de junta', unit:'mm', type:'number', def:3},
        {key:'densidad', label:'Densidad del material de juntas', unit:'kg/m³', type:'number', def:1600},
        {key:'merma', label:'Merma por derrame', unit:'%', type:'number', def:10}
      ],
      compute:function(v){
        var area = gn(v,'area'), L = gn(v,'lado_l')/100, A = gn(v,'lado_a')/100, esp = gn(v,'espesor_pieza')/1000, junta = gn(v,'ancho_junta')/1000, dens = gnOpt(v,'densidad',1600), merma = gnOpt(v,'merma',10);
        must(L > 0 && A > 0, 'Las dimensiones de la pieza deben ser mayores que 0');
        var kgM2 = ((L+A)/(L*A))*esp*junta*dens;
        var kg = kgM2*area*(1+merma/100);
        return [
          {label:'Consumo estimado', value: fmt(kgM2,3), unit:'kg/m²'},
          {label:'Material de juntas necesario', value: fmt(kg,2), unit:'kg'}
        ];
      }
    }
  ];

  /* ============================================================
     CATEGORÍA: FONTANERÍA
     ============================================================ */
  var FONTANERIA = [
    {
      id:'metros_tuberia', cat:'fontaneria', titulo:'Metros de tubería a comprar',
      info:'Total = longitud del recorrido × (1 + % de merma por conexiones y cortes)',
      fields:[
        {key:'longitud', label:'Longitud estimada del recorrido', unit:'m', type:'number'},
        {key:'merma', label:'Merma por conexiones/cortes', unit:'%', type:'number', def:10}
      ],
      compute:function(v){
        var l = gn(v,'longitud'), merma = gnOpt(v,'merma',10);
        return [{label:'Tubería a comprar', value: fmt(l*(1+merma/100),2), unit:'m'}];
      }
    },
    {
      id:'puntos_agua', cat:'fontaneria', titulo:'Puntos de agua recomendados',
      info:'Referencia orientativa de puntos de agua y desagüe habituales según tipo de estancia',
      fields:[
        {key:'estancia', label:'Tipo de estancia', type:'select', options:[
          {value:'bano', label:'Baño completo'}, {value:'aseo', label:'Aseo'},
          {value:'cocina', label:'Cocina'}, {value:'lavadero', label:'Lavadero'}
        ], def:'bano'}
      ],
      compute:function(v){
        var tabla = {
          bano: {agua:4, desague:3},
          aseo: {agua:2, desague:2},
          cocina: {agua:2, desague:2},
          lavadero: {agua:2, desague:2}
        };
        var t = tabla[gv(v,'estancia','bano')];
        return [
          {label:'Puntos de agua recomendados', value: fmt(t.agua,0), unit:''},
          {label:'Puntos de desagüe recomendados', value: fmt(t.desague,0), unit:''}
        ];
      }
    },
    {
      id:'diametro_tuberia', cat:'fontaneria', titulo:'Diámetro de tubería según caudal',
      info:'A partir del caudal y la velocidad recomendada del agua: d = √(4·Q / (π·v))',
      fields:[
        {key:'caudal', label:'Caudal', unit:'L/min', type:'number'},
        {key:'velocidad', label:'Velocidad recomendada', unit:'m/s', type:'number', def:1.5}
      ],
      compute:function(v){
        var Q = gn(v,'caudal')/60000, vel = gnOpt(v,'velocidad',1.5);
        must(vel > 0, 'La velocidad debe ser mayor que 0');
        var d = Math.sqrt((4*Q)/(Math.PI*vel));
        return [{label:'Diámetro interior necesario', value: fmt(d*1000,1), unit:'mm'}];
      }
    },
    {
      id:'pendiente_desague', cat:'fontaneria', titulo:'Pendiente de desagües',
      info:'Desnivel = longitud del tramo × pendiente (%). Pendiente recomendada habitual: 1-4%',
      fields:[
        {key:'longitud', label:'Longitud del tramo', unit:'m', type:'number'},
        {key:'pendiente', label:'Pendiente', unit:'%', type:'number', def:2}
      ],
      compute:function(v){
        var l = gn(v,'longitud'), p = gn(v,'pendiente');
        return [{label:'Desnivel necesario', value: fmt(l*p,1), unit:'cm'}];
      }
    },
    {
      id:'volumen_deposito', cat:'fontaneria', titulo:'Volumen de depósito de agua',
      info:'Volumen = consumo por persona y día × nº de personas × días de autonomía deseados',
      fields:[
        {key:'consumo', label:'Consumo por persona y día', unit:'L', type:'number', def:150},
        {key:'personas', label:'Número de personas', unit:'', type:'number'},
        {key:'dias', label:'Días de autonomía', unit:'', type:'number', def:1}
      ],
      compute:function(v){
        var c = gnOpt(v,'consumo',150), p = gn(v,'personas'), d = gnOpt(v,'dias',1);
        var litros = c*p*d;
        return [{label:'Volumen del depósito', value: fmt(litros,0), unit:'L'},
                {label:'Equivalente', value: fmt(litros/1000,2), unit:'m³'}];
      }
    },
    {
      id:'consumo_agua', cat:'fontaneria', titulo:'Consumo aproximado de agua',
      info:'Consumo diario = nº de personas × consumo medio por persona',
      fields:[
        {key:'personas', label:'Número de personas', unit:'', type:'number'},
        {key:'consumo', label:'Consumo medio por persona y día', unit:'L', type:'number', def:130}
      ],
      compute:function(v){
        var p = gn(v,'personas'), c = gnOpt(v,'consumo',130);
        var diario = p*c;
        return [
          {label:'Consumo diario', value: fmt(diario,0), unit:'L'},
          {label:'Consumo mensual', value: fmt((diario*30)/1000,2), unit:'m³'},
          {label:'Consumo anual', value: fmt((diario*365)/1000,2), unit:'m³'}
        ];
      }
    }
  ];

  /* ============================================================
     CATEGORÍA: REFORMAS (calculadora combinada)
     ============================================================ */
  var REFORMAS = [
    {
      id:'estimacion_reforma', cat:'reformas', titulo:'Calcula cuánto material necesitas para tu reforma',
      info:'Estimación orientativa de materiales para una estancia completa: suelo, paredes, adhesivo, juntas, pintura y rodapié, con un 10% de desperdicio.',
      fields:[
        {key:'estancia', label:'Tipo de estancia', type:'select', options:[
          {value:'bano', label:'Baño'}, {value:'cocina', label:'Cocina'}, {value:'salon', label:'Salón'},
          {value:'dormitorio', label:'Dormitorio'}, {value:'terraza', label:'Terraza'}
        ], def:'bano'},
        {key:'largo', label:'Largo de la estancia', unit:'m', type:'number'},
        {key:'ancho', label:'Ancho de la estancia', unit:'m', type:'number'},
        {key:'alto', label:'Altura', unit:'m', type:'number', def:2.5},
        {key:'puertas', label:'Número de puertas', unit:'', type:'number', def:1},
        {key:'lado_baldosa', label:'Lado de la baldosa (cuadrada)', unit:'cm', type:'number', def:33},
        {key:'piezas_caja', label:'Piezas por caja', unit:'', type:'number', def:11},
        {key:'rendimiento_pintura', label:'Rendimiento de la pintura', unit:'m²/L', type:'number', def:6},
        {key:'manos_pintura', label:'Manos de pintura', unit:'', type:'number', def:2}
      ],
      compute:function(v){
        var estancia = gv(v,'estancia','bano'), l = gn(v,'largo'), a = gn(v,'ancho'), h = gnOpt(v,'alto',2.5);
        var puertas = gnOpt(v,'puertas',1), lado = gn(v,'lado_baldosa')/100, pc = gnOpt(v,'piezas_caja',11);
        var rendPintura = gnOpt(v,'rendimiento_pintura',6), manos = gnOpt(v,'manos_pintura',2);
        var nombres = {bano:'Baño', cocina:'Cocina', salon:'Salón', dormitorio:'Dormitorio', terraza:'Terraza'};
        var merma = 0.10;
        var areaSuelo = l*a;
        var perimetro = 2*(l+a);
        var areaParedes = Math.max(0, perimetro*h - puertas*1.6);
        var areaPieza = lado*lado;
        must(areaPieza > 0, 'El lado de la baldosa debe ser mayor que 0');
        var piezas = Math.ceil((areaSuelo*(1+merma))/areaPieza);
        var cajas = Math.ceil(piezas/pc);
        var adhesivoKg = areaSuelo*4;
        var adhesivoSacos = Math.ceil(adhesivoKg/25);
        var juntaKg = areaSuelo*0.5;
        must(rendPintura > 0, 'El rendimiento de pintura debe ser mayor que 0');
        var pinturaLitros = (areaParedes*manos)/rendPintura;
        var rodapieM = Math.max(0, perimetro - puertas*0.8)*(1+merma);
        return [
          {label:'Estancia', value: nombres[estancia] || estancia, unit:''},
          {label:'Área de suelo', value: fmt(areaSuelo,2), unit:'m²'},
          {label:'Área de paredes', value: fmt(areaParedes,2), unit:'m²'},
          {label:'Baldosas necesarias', value: fmt(piezas,0), unit:'uds'},
          {label:'Cajas de baldosas', value: fmt(cajas,0), unit:'cajas'},
          {label:'Adhesivo / mortero cola', value: fmt(adhesivoSacos,0), unit:'sacos de 25 kg'},
          {label:'Material de juntas', value: fmt(juntaKg,1), unit:'kg'},
          {label:'Pintura para paredes', value: fmt(pinturaLitros,2), unit:'L'},
          {label:'Rodapié', value: fmt(rodapieM,2), unit:'m'},
          {label:'Desperdicio aplicado', value: fmt(merma*100,0), unit:'%'},
          {link:true, label:'¿Necesitas un profesional para esta obra? → Buscar en TodoOficios.es', href:'index.html'}
        ];
      }
    }
  ];

  /* ============================================================
     CATEGORÍA: GEOMETRÍA Y CONVERSORES
     ============================================================ */
  var UNID_LONGITUD = {m:1, cm:0.01, mm:0.001, km:1000, in:0.0254, ft:0.3048, yd:0.9144};
  var UNID_AREA = {'m2':1, 'cm2':0.0001, 'km2':1e6, ha:10000, 'ft2':0.092903};
  var UNID_VOLUMEN = {'m3':1, l:0.001, 'cm3':1e-6, 'ft3':0.0283168, galUS:0.00378541};
  function unidadesOpts(tabla){ return Object.keys(tabla).map(function(k){ return {value:k, label:k}; }); }

  var GEOMETRIA = [
    {
      id:'area_habitacion', cat:'geometria', titulo:'m² de una habitación',
      info:'Área = largo × ancho',
      fields:[{key:'largo', label:'Largo', unit:'m', type:'number'}, {key:'ancho', label:'Ancho', unit:'m', type:'number'}],
      compute:function(v){ return [{label:'Área', value: fmt(gn(v,'largo')*gn(v,'ancho'),2), unit:'m²'}]; }
    },
    {
      id:'area_pared', cat:'geometria', titulo:'m² de una pared',
      info:'Área = largo × altura',
      fields:[{key:'largo', label:'Largo de la pared', unit:'m', type:'number'}, {key:'alto', label:'Altura', unit:'m', type:'number'}],
      compute:function(v){ return [{label:'Área', value: fmt(gn(v,'largo')*gn(v,'alto'),2), unit:'m²'}]; }
    },
    {
      id:'volumen_habitacion', cat:'geometria', titulo:'m³ de una habitación',
      info:'Volumen = largo × ancho × alto',
      fields:[
        {key:'largo', label:'Largo', unit:'m', type:'number'}, {key:'ancho', label:'Ancho', unit:'m', type:'number'}, {key:'alto', label:'Alto', unit:'m', type:'number'}
      ],
      compute:function(v){ return [{label:'Volumen', value: fmt(gn(v,'largo')*gn(v,'ancho')*gn(v,'alto'),3), unit:'m³'}]; }
    },
    {
      id:'volumen_piscina', cat:'geometria', titulo:'Volumen de una piscina',
      info:'Rectangular: largo×ancho×profundidad media. Redonda: π×radio²×profundidad media',
      fields:[
        {key:'forma', label:'Forma', type:'select', options:[{value:'rectangular',label:'Rectangular'},{value:'redonda',label:'Redonda'}], def:'rectangular'},
        {key:'largo', label:'Largo (si rectangular)', unit:'m', type:'number'},
        {key:'ancho', label:'Ancho (si rectangular)', unit:'m', type:'number'},
        {key:'diametro', label:'Diámetro (si redonda)', unit:'m', type:'number'},
        {key:'profundidad', label:'Profundidad media', unit:'m', type:'number'}
      ],
      compute:function(v){
        var forma = gv(v,'forma','rectangular'), prof = gn(v,'profundidad');
        var vol;
        if(forma === 'rectangular'){ vol = gn(v,'largo')*gn(v,'ancho')*prof; }
        else { var d = gn(v,'diametro'); vol = Math.PI*Math.pow(d/2,2)*prof; }
        return [{label:'Volumen', value: fmt(vol,2), unit:'m³'}, {label:'Equivalente', value: fmt(vol*1000,0), unit:'litros'}];
      }
    },
    {
      id:'area_circulo', cat:'geometria', titulo:'Área de un círculo',
      info:'Área = π × radio²',
      fields:[{key:'radio', label:'Radio', unit:'m', type:'number'}],
      compute:function(v){ var r = gn(v,'radio'); return [{label:'Área', value: fmt(Math.PI*r*r,3), unit:'m²'}]; }
    },
    {
      id:'area_triangulo', cat:'geometria', titulo:'Área de un triángulo',
      info:'Área = (base × altura) / 2',
      fields:[{key:'base', label:'Base', unit:'m', type:'number'}, {key:'altura', label:'Altura', unit:'m', type:'number'}],
      compute:function(v){ return [{label:'Área', value: fmt((gn(v,'base')*gn(v,'altura'))/2,3), unit:'m²'}]; }
    },
    {
      id:'escaleras', cat:'geometria', titulo:'Cálculo de escaleras',
      info:'Nº de peldaños = altura total / contrahuella. Confort (regla de Blondel): 2×contrahuella + huella entre 57 y 64 cm',
      fields:[
        {key:'altura_total', label:'Altura total a subir', unit:'m', type:'number'},
        {key:'huella', label:'Huella (fondo del peldaño)', unit:'cm', type:'number', def:28},
        {key:'contrahuella', label:'Contrahuella (altura del peldaño)', unit:'cm', type:'number', def:18}
      ],
      compute:function(v){
        var alt = gn(v,'altura_total')*100, huella = gn(v,'huella'), contra = gn(v,'contrahuella');
        must(contra > 0, 'La contrahuella debe ser mayor que 0');
        var peldanos = Math.round(alt/contra);
        var blondel = 2*contra + huella;
        return [
          {label:'Número de peldaños', value: fmt(peldanos,0), unit:''},
          {label:'Longitud horizontal ocupada', value: fmt((peldanos-1)*huella/100,2), unit:'m'},
          {label:'Regla de Blondel (2c+h)', value: fmt(blondel,1), unit:'cm'},
          {label:'Confort', value: (blondel >= 57 && blondel <= 64) ? 'Dentro del rango cómodo (57-64cm)' : 'Fuera del rango cómodo habitual', unit:''}
        ];
      }
    },
    {
      id:'pendientes', cat:'geometria', titulo:'Cálculo de pendientes',
      info:'Pendiente(%) = desnivel / longitud horizontal × 100',
      fields:[
        {key:'desnivel', label:'Desnivel', unit:'m', type:'number'},
        {key:'longitud', label:'Longitud horizontal', unit:'m', type:'number'}
      ],
      compute:function(v){
        var d = gn(v,'desnivel'), l = gn(v,'longitud');
        must(l !== 0, 'La longitud no puede ser 0');
        return [
          {label:'Pendiente', value: fmt((d/l)*100,2), unit:'%'},
          {label:'Ángulo', value: fmt(Math.atan2(d,l)*180/Math.PI,2), unit:'°'}
        ];
      }
    },
    {
      id:'diagonales', cat:'geometria', titulo:'Longitud de diagonales',
      info:'2D: √(largo² + ancho²). 3D (opcional, con altura): √(largo² + ancho² + alto²)',
      fields:[
        {key:'largo', label:'Largo', unit:'m', type:'number'},
        {key:'ancho', label:'Ancho', unit:'m', type:'number'},
        {key:'alto', label:'Alto (opcional, para diagonal 3D)', unit:'m', type:'number'}
      ],
      compute:function(v){
        var l = gn(v,'largo'), a = gn(v,'ancho'), h = gnOpt(v,'alto',null);
        var res = [{label:'Diagonal (2D)', value: fmt(Math.sqrt(l*l+a*a),3), unit:'m'}];
        if(h !== null) res.push({label:'Diagonal (3D)', value: fmt(Math.sqrt(l*l+a*a+h*h),3), unit:'m'});
        return res;
      }
    },
    {
      id:'conversor_longitud', cat:'geometria', icono:'⇄', titulo:'Conversor de unidades de longitud',
      info:'Conversión entre metros, centímetros, milímetros, kilómetros, pulgadas, pies y yardas',
      fields:[
        {key:'valor', label:'Valor', unit:'', type:'number', def:1},
        {key:'origen', label:'Unidad de origen', type:'select', options: unidadesOpts(UNID_LONGITUD), def:'m'},
        {key:'destino', label:'Unidad de destino', type:'select', options: unidadesOpts(UNID_LONGITUD), def:'cm'}
      ],
      compute:function(v){
        var val = gn(v,'valor'), o = gv(v,'origen','m'), d = gv(v,'destino','cm');
        var res = val*UNID_LONGITUD[o]/UNID_LONGITUD[d];
        return [{label:'Resultado', value: fmt(res,6), unit:d}];
      }
    },
    {
      id:'conversor_area', cat:'geometria', icono:'⇄', titulo:'Conversor de unidades de área',
      info:'Conversión entre m², cm², km², hectáreas y pies cuadrados',
      fields:[
        {key:'valor', label:'Valor', unit:'', type:'number', def:1},
        {key:'origen', label:'Unidad de origen', type:'select', options: unidadesOpts(UNID_AREA), def:'m2'},
        {key:'destino', label:'Unidad de destino', type:'select', options: unidadesOpts(UNID_AREA), def:'ha'}
      ],
      compute:function(v){
        var val = gn(v,'valor'), o = gv(v,'origen','m2'), d = gv(v,'destino','ha');
        var res = val*UNID_AREA[o]/UNID_AREA[d];
        return [{label:'Resultado', value: fmt(res,6), unit:d}];
      }
    },
    {
      id:'conversor_volumen', cat:'geometria', icono:'⇄', titulo:'Conversor de unidades de volumen',
      info:'Conversión entre m³, litros, cm³, pies cúbicos y galones US',
      fields:[
        {key:'valor', label:'Valor', unit:'', type:'number', def:1},
        {key:'origen', label:'Unidad de origen', type:'select', options: unidadesOpts(UNID_VOLUMEN), def:'m3'},
        {key:'destino', label:'Unidad de destino', type:'select', options: unidadesOpts(UNID_VOLUMEN), def:'l'}
      ],
      compute:function(v){
        var val = gn(v,'valor'), o = gv(v,'origen','m3'), d = gv(v,'destino','l');
        var res = val*UNID_VOLUMEN[o]/UNID_VOLUMEN[d];
        return [{label:'Resultado', value: fmt(res,6), unit:d}];
      }
    }
  ];

  var CALCULADORAS = FUNDAMENTALES.concat(INSTALACION, COMPONENTES, TRANSFORMADORES, UTILIDADES, MATERIALES, PINTURA, SUELOS, FONTANERIA, REFORMAS, GEOMETRIA);

  /* Sinónimos de búsqueda: términos que el usuario puede escribir aunque no aparezcan
     literalmente en el título de la calculadora. */
  var SINONIMOS = {
    cuadro_mando_general: ['cuadro electrico', 'cuadro de luz', 'icp', 'magnetotermico', 'diferencial', 'automaticos', 'pia', 'protecciones'],
    dimensionamiento_conductores: ['cable', 'calibre de cable', 'seccion de cable', 'grosor de cable'],
    dimensionamiento_conductores_protecciones: ['cable', 'calibre de cable'],
    caida_tension: ['cable', 'voltaje que se pierde'],
    hormigon: ['concreto'],
    yeso_enlucido: ['escayola', 'guarnecido'],
    pladur: ['tabique', 'carton yeso', 'panel de yeso'],
    ladrillos_bloques: ['tabique', 'bloque de hormigon'],
    cemento_arena: ['mortero'],
    mortero_albanileria: ['mortero de cemento'],
    baldosas_azulejos: ['gres', 'alicatado', 'ceramica'],
    juntas_alicatado: ['lechada'],
    metros_tuberia: ['canerias', 'pvc', 'multicapa'],
    coste_pintura: ['gotele', 'presupuesto de pintura'],
    color_resistencia_bandas: ['codigo de colores resistencias'],
    puesta_tierra: ['toma de tierra'],
    estimacion_reforma: ['reforma integral', 'reforma de bano', 'reforma de cocina']
  };

  function coincideBusqueda(c, t){
    if(normaliza(c.titulo).indexOf(t) !== -1) return true;
    var alias = SINONIMOS[c.id];
    if(!alias) return false;
    return alias.some(function(a){ return normaliza(a).indexOf(t) !== -1; });
  }

  /* ============================================================
     MOTOR: renderizado y navegación
     ============================================================ */
  var elHome, elCat, elCalc, elSearch, elSearchResults, elBack, elBackLabel, elGate, elHero;

  function isRegistered(){
    // La cuenta (account:/client:) puede vivir solo en Supabase cuando el sitio
    // usa backend en la nube, así que basta con que exista el token de sesión local.
    try {
      if(localStorage.getItem('session-email')) return true;
      if(localStorage.getItem('session-email-client')) return true;
    } catch(e){}
    return false;
  }

  function showRegisterGate(){ if(elGate) elGate.classList.add('open'); }
  function hideRegisterGate(){ if(elGate) elGate.classList.remove('open'); }

  function isProfessionalLoggedIn(){
    try {
      return !!localStorage.getItem('session-email');
    } catch(e){ return false; }
  }

  /* ============================================================
     MATERIALES FAVORITOS: conexión mínima con Supabase (misma tabla
     kv_store y namespace que index.html) para que la lista de precios
     guardados sea la misma en las calculadoras y en el Panel de negocio.
     ============================================================ */
  var CLOUD_NAMESPACE = 'todooficios:v1';
  var cloudClient = null;
  var cloudEnabled = false;
  var cloudInitPromise = null;
  var materialesCache = [];
  var calcActualId = null;

  function proEmailActual(){
    try { return localStorage.getItem('session-email') || ''; } catch(e){ return ''; }
  }

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

  function cargarMaterialesFavoritos(){
    var email = proEmailActual();
    if(!email) return Promise.resolve([]);
    return cloudGet('materiales:'+email).then(function(raw){
      if(!raw) return [];
      try { var lista = JSON.parse(raw); return Array.isArray(lista) ? lista : []; } catch(e){ return []; }
    });
  }

  function guardarMaterialFavorito(nombre, unidad, precio){
    var email = proEmailActual();
    if(!email) return Promise.resolve(false);
    materialesCache = materialesCache.concat([{id:'m'+Date.now(), nombre:nombre, unidad:unidad||'ud', precio:precio||0}]);
    return cloudSet('materiales:'+email, JSON.stringify(materialesCache));
  }

  function chipsHTML(fieldKey){
    if(!materialesCache.length) return '';
    return '<span class="mat-chips">' + materialesCache.map(function(m){
      return '<span class="mat-chip" data-fill-key="' + fieldKey + '" data-fill-val="' + m.precio + '">' + m.nombre + ' · ' + fmt(m.precio,2) + ' €</span>';
    }).join('') + '</span>';
  }

  function refrescarChipsFavoritos(){
    if(!calcActualId || !elCalc) return;
    var calc = CALCULADORAS.filter(function(c){ return c.id === calcActualId; })[0];
    if(!calc) return;
    calc.fields.forEach(function(f){
      if(!(f.unit && f.unit.indexOf('€') !== -1)) return;
      var saveBtn = elCalc.querySelector('[data-save-fav-key="' + f.key + '"]');
      if(!saveBtn) return;
      var previo = saveBtn.previousElementSibling;
      if(previo && previo.classList.contains('mat-chips')) return;
      if(!materialesCache.length) return;
      saveBtn.insertAdjacentHTML('beforebegin', chipsHTML(f.key));
    });
  }

  function leerBorradorPresupuesto(){
    try {
      var proEmail = localStorage.getItem('session-email');
      if(!proEmail) return [];
      return JSON.parse(localStorage.getItem('presupuesto-draft:'+proEmail) || '[]');
    } catch(e){ return []; }
  }

  function guardarEnBorradorPresupuesto(concepto, importe){
    try {
      var proEmail = localStorage.getItem('session-email');
      if(!proEmail) return 0;
      var lista = leerBorradorPresupuesto();
      lista.push({id:'cd'+Date.now(), concepto:concepto, importe:importe||0});
      localStorage.setItem('presupuesto-draft:'+proEmail, JSON.stringify(lista));
      return lista.length;
    } catch(e){ return 0; }
  }

  function botonAnadirPresupuestoHTML(calc, res){
    if(!isProfessionalLoggedIn()) return '';
    var cat = CATEGORIAS.filter(function(c){ return c.id === calc.cat; })[0];
    if(cat && cat.grupo === 'electricidad' && !calc.contieneMaterial) return '';
    var relevantes = res.filter(function(r){ return !r.link; });
    if(!relevantes.length) return '';
    return '<button type="button" class="cec-add-budget-btn" id="cecAddBudget">➕ Añadir a un presupuesto</button>' +
      '<div class="cec-add-toast" id="cecAddToast" style="display:none;"></div>' +
      '<div class="cec-add-picker" id="cecAddPicker" style="display:none;">' +
        '<button type="button" class="cec-add-draft-btn" id="cecAddDraftBtn">Guardar para mi próximo presupuesto</button>' +
        '<div class="cec-add-picker-sep">o añade directamente a uno ya creado</div>' +
        '<div id="cecAddPickerList" class="cec-add-picker-list"><div class="cec-add-picker-loading">Cargando tus presupuestos…</div></div>' +
      '</div>';
  }

  function resumenPartida(calc, res){
    var relevantes = res.filter(function(r){ return !r.link; });
    var resumen = relevantes.map(function(r){ return r.label + ': ' + r.value + (r.unit ? ' ' + r.unit : ''); }).join(', ');
    var euroRow = relevantes.filter(function(r){ return r.unit === '€'; })[0];
    return {
      concepto: calc.titulo + ' — ' + resumen,
      importe: euroRow ? parseFloat(String(euroRow.value).replace(',', '.')) || 0 : 0
    };
  }

  function cargarNegocioCompleto(){
    var email = proEmailActual();
    if(!email) return Promise.resolve(null);
    return cloudGet('negocio:'+email).then(function(raw){
      if(!raw) return null;
      try { return JSON.parse(raw); } catch(e){ return null; }
    });
  }

  function guardarNegocioCompleto(negocio){
    var email = proEmailActual();
    if(!email) return Promise.resolve(false);
    return cloudSet('negocio:'+email, JSON.stringify(negocio));
  }

  function cargarPresupuestosPendientes(){
    return cargarNegocioCompleto().then(function(negocio){
      if(!negocio || !Array.isArray(negocio.presupuestos)) return [];
      return negocio.presupuestos
        .filter(function(p){ return !p.estado || p.estado === 'Pendiente'; })
        .slice().reverse();
    });
  }

  function anadirPartidaAPresupuestoExistente(presupuestoId, concepto, importe){
    return cargarNegocioCompleto().then(function(negocio){
      if(!negocio || !Array.isArray(negocio.presupuestos)) return null;
      var p = negocio.presupuestos.filter(function(x){ return x.id === presupuestoId; })[0];
      if(!p) return null;
      if(!Array.isArray(p.partidas)) p.partidas = [];
      p.partidas.push({descripcion: concepto, unidad:'ud', cantidad:1, precio: importe||0, coste:0});
      var subtotal = p.partidas.reduce(function(s,x){ return s + (Number(x.cantidad)||0)*(Number(x.precio)||0); }, 0);
      var ivaPct = Number(p.ivaPct)||0;
      var cuota = subtotal * ivaPct/100;
      var irpfPct = Number(p.irpfPct)||0;
      var irpfImporte = p.irpfAplica ? subtotal * irpfPct/100 : 0;
      var total = subtotal + cuota - irpfImporte;
      p.base = Math.round(subtotal*100)/100;
      p.cuota = Math.round(cuota*100)/100;
      p.irpfImporte = Math.round(irpfImporte*100)/100;
      p.total = Math.round(total*100)/100;
      return guardarNegocioCompleto(negocio).then(function(ok){ return ok ? p : null; });
    });
  }

  function fmtEUR(n){
    return (Number(n)||0).toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
  }

  function pickerListHTML(presupuestos){
    if(!presupuestos.length) return '<div class="cec-add-picker-empty">Todavía no tienes presupuestos pendientes creados.</div>';
    return presupuestos.map(function(p){
      return '<button type="button" class="cec-pp-opt" data-pid="' + escapeHtml(p.id) + '">' +
        '<span><span class="cec-pp-num">' + escapeHtml(p.numero) + '</span><span class="cec-pp-cli">' + escapeHtml(p.cliente) + '</span></span>' +
        '<span class="cec-pp-amt">' + fmtEUR(p.total) + '</span></button>';
    }).join('');
  }

  function normaliza(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }

  function cardHTML(icono, titulo, sub){
    return '<div class="cec-card" tabindex="0" role="button">' +
      '<div class="cec-card-icon">' + icono + '</div>' +
      '<div class="cec-card-title">' + titulo + '</div>' +
      (sub ? '<div class="cec-card-sub">' + sub + '</div>' : '') +
      '</div>';
  }

  function renderHome(){
    var html = '';
    GRUPOS.forEach(function(g){
      var cats = CATEGORIAS.filter(function(c){ return c.grupo === g.id; });
      if(cats.length === 0) return;
      var gridHTML = '<div class="cec-grid">';
      cats.forEach(function(c){
        var n = CALCULADORAS.filter(function(x){ return x.cat === c.id; }).length;
        gridHTML += '<div class="cec-card cec-cat" data-cat="' + c.id + '" tabindex="0" role="button">' +
          '<div class="cec-card-icon">' + catIconHTML(c, 40) + '</div>' +
          '<div class="cec-card-title">' + c.nombre + '</div>' +
          '<div class="cec-card-sub">' + c.desc + ' · ' + n + ' calculadoras</div></div>';
      });
      gridHTML += '</div>';
      if(g.colapsado){
        html += '<details class="cec-group cec-group-advanced"><summary class="cec-group-title">' + grupoIconHTML(g) + g.nombre + '</summary>' + gridHTML + '</details>';
      } else {
        html += '<div class="cec-group"><h2 class="cec-group-title">' + grupoIconHTML(g) + g.nombre + '</h2>' + gridHTML + '</div>';
      }
    });
    elHome.innerHTML = html;
    Array.prototype.forEach.call(elHome.querySelectorAll('[data-cat]'), function(node){
      node.addEventListener('click', function(){ goToCategory(node.getAttribute('data-cat')); });
      node.addEventListener('keydown', function(e){ if(e.key === 'Enter') goToCategory(node.getAttribute('data-cat')); });
    });
  }

  function renderCategoria(catId){
    var cat = CATEGORIAS.filter(function(c){ return c.id === catId; })[0];
    var lista = CALCULADORAS.filter(function(c){ return c.cat === catId; });
    var html = '<h2 class="cec-section-title">' + catIconHTML(cat, 28) + cat.nombre + '</h2><div class="cec-grid">';
    lista.forEach(function(c){ html += '<div class="cec-card" data-calc="' + c.id + '" tabindex="0" role="button">' +
      '<div class="cec-card-icon">' + calcIconHTML(c, 40) + '</div><div class="cec-card-title">' + c.titulo + '</div></div>'; });
    html += '</div>';
    elCat.innerHTML = html;
    Array.prototype.forEach.call(elCat.querySelectorAll('[data-calc]'), function(node){
      node.addEventListener('click', function(){ goToCalculadora(node.getAttribute('data-calc')); });
      node.addEventListener('keydown', function(e){ if(e.key === 'Enter') goToCalculadora(node.getAttribute('data-calc')); });
    });
  }

  function fieldHTML(f){
    var id = 'f_' + f.key;
    if(f.type === 'select'){
      var opciones = f.options.map(function(o){
        var sel = (f.def === o.value) ? ' selected' : '';
        return '<option value="' + o.value + '"' + sel + '>' + o.label + '</option>';
      }).join('');
      return '<label class="cec-field"><span>' + f.label + '</span><select id="' + id + '" data-key="' + f.key + '">' + opciones + '</select></label>';
    }
    if(f.type === 'text'){
      return '<label class="cec-field"><span>' + f.label + '</span><input type="text" id="' + id + '" data-key="' + f.key + '" value="' + (f.def !== undefined ? f.def : '') + '"></label>';
    }
    var esPrecio = f.unit && f.unit.indexOf('€') !== -1;
    var extra = '';
    if(esPrecio && isProfessionalLoggedIn()){
      extra = chipsHTML(f.key) + '<button type="button" class="calc-save-fav-link" data-save-fav-key="' + f.key + '">+ Guardar este precio como material favorito</button>';
    }
    return '<label class="cec-field"><span>' + f.label + (f.unit ? ' (' + f.unit + ')' : '') + '</span>' +
      '<input type="number" step="any" id="' + id + '" data-key="' + f.key + '" value="' + (f.def !== undefined ? f.def : '') + '">' + extra + '</label>';
  }

  function goToCategory(catId){
    if(!isRegistered()){ showRegisterGate(); return; }
    renderCategoria(catId);
    showView('cat');
    elBackLabel.textContent = 'Categorías';
    elBack.onclick = function(){ showView('home'); };
    history.replaceState(null, '', '#' + catId);
  }

  function goToCalculadora(calcId){
    if(!isRegistered()){ showRegisterGate(); return; }
    var calc = CALCULADORAS.filter(function(c){ return c.id === calcId; })[0];
    if(!calc) return;
    calcActualId = calc.id;
    var html = '<h2 class="cec-section-title">' + calcIconHTML(calc, 28) + calc.titulo + '</h2>' +
      (calc.info ? '<p class="cec-info">' + calc.info + '</p>' : '') +
      '<div class="cec-form">' + calc.fields.map(fieldHTML).join('') + '</div>' +
      '<div class="cec-result" id="cecResult"></div>';
    elCalc.innerHTML = html;
    elCalc.onclick = function(e){
      var chip = e.target.closest('.mat-chip');
      if(chip){
        var key = chip.getAttribute('data-fill-key');
        var input = document.getElementById('f_' + key);
        if(input){ input.value = chip.getAttribute('data-fill-val'); input.dispatchEvent(new Event('input', {bubbles:true})); }
        return;
      }
      var saveBtn = e.target.closest('.calc-save-fav-link');
      if(saveBtn){
        var fkey = saveBtn.getAttribute('data-save-fav-key');
        var fInput = document.getElementById('f_' + fkey);
        var precio = fInput ? parseFloat(fInput.value) : NaN;
        if(!fInput || !Number.isFinite(precio) || precio < 0){ window.alert('Escribe primero un precio válido en el campo.'); return; }
        var nombre = window.prompt('¿Cómo quieres llamar a este material?', calc.titulo);
        if(!nombre || !nombre.trim()) return;
        var fieldDef = calc.fields.filter(function(x){ return x.key === fkey; })[0];
        var unidad = (fieldDef && fieldDef.unit) ? fieldDef.unit.replace('€','').replace('/','').trim() : '';
        guardarMaterialFavorito(nombre.trim(), unidad || 'ud', precio).then(function(ok){
          if(ok) refrescarChipsFavoritos();
        });
      }
    };
    var inputs = elCalc.querySelectorAll('[data-key]');
    var ultimoResultado = [];
    function recalcular(){
      var values = {};
      Array.prototype.forEach.call(inputs, function(inp){ values[inp.getAttribute('data-key')] = inp.value; });
      var out = document.getElementById('cecResult');
      try {
        var res = calc.compute(values);
        ultimoResultado = res;
        out.innerHTML = res.map(function(r){
          if(r.link) return '<a class="cec-result-cta" href="' + r.href + '">' + r.label + '</a>';
          return '<div class="cec-result-row"><span>' + r.label + '</span><strong>' + r.value + (r.unit ? ' ' + r.unit : '') + '</strong></div>';
        }).join('') + botonAnadirPresupuestoHTML(calc, res);
        out.classList.remove('cec-error');
        var addBtn = document.getElementById('cecAddBudget');
        var picker = document.getElementById('cecAddPicker');
        var pickerListEl = document.getElementById('cecAddPickerList');
        var pickerLoaded = false;
        if(addBtn && picker){
          addBtn.addEventListener('click', function(){
            var open = picker.style.display !== 'none';
            picker.style.display = open ? 'none' : '';
            if(!open && !pickerLoaded){
              pickerLoaded = true;
              cargarPresupuestosPendientes().then(function(lista){
                if(pickerListEl) pickerListEl.innerHTML = pickerListHTML(lista);
              });
            }
          });
        }
        var draftBtn = document.getElementById('cecAddDraftBtn');
        if(draftBtn){
          draftBtn.addEventListener('click', function(){
            var partida = resumenPartida(calc, ultimoResultado);
            var n = guardarEnBorradorPresupuesto(partida.concepto, partida.importe);
            var toast = document.getElementById('cecAddToast');
            if(toast && n > 0){
              toast.style.display = '';
              toast.textContent = 'Añadido — llevas ' + n + (n === 1 ? ' partida guardada' : ' partidas guardadas') + ' para tu próximo presupuesto';
            }
            if(picker) picker.style.display = 'none';
          });
        }
        if(pickerListEl){
          pickerListEl.addEventListener('click', function(e){
            var opt = e.target.closest('.cec-pp-opt');
            if(!opt) return;
            var pid = opt.getAttribute('data-pid');
            opt.disabled = true;
            var partida = resumenPartida(calc, ultimoResultado);
            anadirPartidaAPresupuestoExistente(pid, partida.concepto, partida.importe).then(function(p){
              var toast = document.getElementById('cecAddToast');
              if(!toast) return;
              if(p){
                toast.style.display = '';
                toast.textContent = 'Añadida al presupuesto ' + p.numero + ' — ' + p.cliente + '. Nuevo total: ' + fmtEUR(p.total);
                if(picker) picker.style.display = 'none';
              } else {
                toast.style.display = '';
                toast.textContent = 'No se pudo añadir al presupuesto. Inténtalo de nuevo.';
                opt.disabled = false;
              }
            });
          });
        }
      } catch(e){
        out.innerHTML = '<div class="cec-error-msg">⚠ ' + e.message + '</div>';
        out.classList.add('cec-error');
      }
    }
    Array.prototype.forEach.call(inputs, function(inp){
      inp.addEventListener('input', recalcular);
      inp.addEventListener('change', recalcular);
    });
    recalcular();
    showView('calc');
    elBackLabel.textContent = CATEGORIAS.filter(function(c){ return c.id === calc.cat; })[0].nombre;
    elBack.onclick = function(){ goToCategory(calc.cat); };
    history.replaceState(null, '', '#calc-' + calc.id);
  }

  function showView(name){
    elHome.style.display = name === 'home' ? '' : 'none';
    elCat.style.display = name === 'cat' ? '' : 'none';
    elCalc.style.display = name === 'calc' ? '' : 'none';
    elBack.style.display = name === 'home' ? 'none' : '';
    if(elHero) elHero.style.display = name === 'calc' ? 'none' : '';
    window.scrollTo(0,0);
  }

  function renderBusqueda(term){
    var t = normaliza(term);
    if(!t){ elSearchResults.style.display = 'none'; elSearchResults.innerHTML=''; return; }
    var res = CALCULADORAS.filter(function(c){ return coincideBusqueda(c, t); }).slice(0, 20);
    if(res.length === 0){ elSearchResults.style.display=''; elSearchResults.innerHTML = '<div class="cec-no-results">Sin resultados</div>'; return; }
    elSearchResults.style.display = '';
    elSearchResults.innerHTML = res.map(function(c){
      return '<div class="cec-search-item" data-calc="' + c.id + '">' + calcIconHTML(c, 20) + c.titulo + '</div>';
    }).join('');
    Array.prototype.forEach.call(elSearchResults.querySelectorAll('[data-calc]'), function(node){
      node.addEventListener('click', function(){
        elSearch.value = '';
        elSearchResults.style.display = 'none';
        goToCalculadora(node.getAttribute('data-calc'));
      });
    });
  }

  function init(){
    elHome = document.getElementById('cecHome');
    elCat = document.getElementById('cecCat');
    elCalc = document.getElementById('cecCalc');
    elSearch = document.getElementById('cecSearch');
    elSearchResults = document.getElementById('cecSearchResults');
    elBack = document.getElementById('cecBack');
    elBackLabel = document.getElementById('cecBackLabel');
    elGate = document.getElementById('cecGate');
    elHero = document.getElementById('cecHero');
    renderHome();
    showView('home');
    elSearch.addEventListener('input', function(){ renderBusqueda(elSearch.value); });
    var gateClose = document.getElementById('cecGateClose');
    if(gateClose) gateClose.addEventListener('click', hideRegisterGate);
    if(elGate) elGate.addEventListener('click', function(e){ if(e.target === elGate) hideRegisterGate(); });

    var hash = location.hash.replace('#','');
    if(hash.indexOf('calc-') === 0) goToCalculadora(hash.slice(5));
    else if(hash) { var c = CATEGORIAS.filter(function(x){return x.id===hash;})[0]; if(c) goToCategory(hash); }

    if(isProfessionalLoggedIn()){
      cargarMaterialesFavoritos().then(function(lista){
        materialesCache = lista;
        refrescarChipsFavoritos();
      });
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
