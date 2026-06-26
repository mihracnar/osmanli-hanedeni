"use strict";
/* app.js — Osmanlı Soy Ağacı
   - TreeLayout (LastParents/Bus) → köşeli, kesişimsiz soy çizgileri
   - Eşler: padişahın SOLUNDA, alt alta (soy çizgilerine karışmaz)
   - Tahta geçiş: LeftSide → kavisli, eşlerle ÇAKIŞMAZ
*/

const $ = go.GraphObject.make;

const NW = { padisah:130, sehzade:106, sultan:106, es:110, ata:118 };
const NH = { padisah:52,  sehzade:40,  sultan:40,  es:28,  ata:40  };

/* ─── Renk ──────────────────────────────────────────────────────────── */
function nodeStyle(d) {
  if (d.tip === 'padisah') {
    const ps = PERIODS[periodOf(d.no)];
    return { fill: ps.fill, stroke: ps.stroke, text: ps.text };
  }
  if (d.tip === 'es')  return { fill: 'rgba(175,152,120,0.14)', stroke: 'rgba(175,152,120,0.60)', text: '#d7d2c2' };
  if (d.tip === 'ata') return { fill: '#1A2E4A', stroke: '#6BB4C2', text: '#d7d2c2' };
  return { fill: 'rgba(107,180,194,0.14)', stroke: '#4A9BAE', text: '#d7d2c2' };
}

/* ─── Diagram ───────────────────────────────────────────────────────── */
const diagram = $(go.Diagram, 'myDiagramDiv', {
  'undoManager.isEnabled': false,
  'animationManager.isEnabled': false,
  'toolManager.gestureBehavior': go.ToolManager.GestureZoom,
  maxScale: 4, minScale: 0.05,
  allowZoom: true,
  allowHorizontalScroll: true,
  allowVerticalScroll: true,
  padding: 100,
  'toolManager.hoverDelay': 80,

  layout: $(go.TreeLayout, {
    angle: 90,
    nodeSpacing: 160,
    layerSpacing: 120,
    layerStyle: go.TreeLayout.LayerUniform,
    treeStyle: go.TreeStyle.LastParents,
    alternateAngle: 90,
    alternateLayerSpacing: 75,
    alternateAlignment: go.TreeAlignment.Bus,
    alternateNodeSpacing: 160,
    isOngoing: false,
  }),
});

/* ─── Link: biyolojik soy — köşeli ─────────────────────────────────── */
diagram.linkTemplate =
  $(go.Link, {
    routing: go.Routing.Orthogonal,
    corner: 4,
    curve: go.Curve.JumpOver,
    selectable: false,
    layerName: 'Background',
  },
  $(go.Shape, { stroke: '#8A9BAE', strokeWidth: 2.8 })
  );

/* ─── Link: tahta geçişi — kavisli, SOLDAN çıkar ───────────────────── */
// Ortak succ şekil parçaları için helper
function succShapes() {
  return [
    /* halo */
    $(go.Shape, { isPanelMain: true, stroke: 'rgba(255,255,255,0.75)', strokeWidth: 3 }),
    /* çizgi */
    $(go.Shape, { isPanelMain: true, strokeWidth: 0.4, opacity: 0.70 },
      new go.Binding('stroke',          'tip', t => SUCC_STYLE[t].stroke),
      new go.Binding('strokeDashArray', 'tip', t => {
        const d = SUCC_STYLE[t].dash;
        return d ? d.split(',').map(Number) : null;
      }),
      new go.Binding('strokeWidth', 'tip', t => SUCC_STYLE[t].w)
    ),
    /* ok */
    $(go.Shape, { toArrow: 'Triangle', scale: 1.6, strokeWidth: 0 },
      new go.Binding('stroke', 'tip', t => SUCC_STYLE[t].stroke),
      new go.Binding('fill',   'tip', t => SUCC_STYLE[t].stroke)
    ),
    /* numara */
    $(go.Panel, 'Auto',
      { segmentIndex: NaN, segmentFraction: 0.5, alignmentFocus: go.Spot.Center },
      $(go.Shape, 'RoundedRectangle', { parameter1: 3, strokeWidth: 0 },
        new go.Binding('fill', 'tip', t => SUCC_STYLE[t].stroke)
      ),
      $(go.TextBlock, { font: 'bold 8px sans-serif', stroke: '#fff', margin: new go.Margin(1,3,1,3) },
        new go.Binding('text', 'idx', i => String(i + 1))
      )
    )
  ];
}

/* Dikey geçiş: sağdan çık, sola gir, Bezier */
diagram.linkTemplateMap.add('succ',
  $(go.Link, {
    curve: go.Curve.Bezier,
    isLayoutPositioned: false,
    isTreeLink: false,
    selectable: false,
    layerName: 'Foreground',
    computePoints: function() {
      // Bezier control pointleri: from altı → to üstü, yanlara eğik
      const fr = this.fromNode, to = this.toNode;
      if (!fr || !to) return go.Link.prototype.computePoints.call(this);
      const fb = fr.actualBounds, tb = to.actualBounds;
      const x1 = fb.centerX, y1 = fb.bottom;
      const x2 = tb.centerX, y2 = tb.top;
      const dy = (y2 - y1) * 0.45;
      const dx = (x2 - x1) * 0.3;
      const pts = new go.List(go.Point);
      pts.add(new go.Point(x1, y1));
      pts.add(new go.Point(x1 + dx, y1 + dy));
      pts.add(new go.Point(x2 - dx, y2 - dy));
      pts.add(new go.Point(x2, y2));
      this.points = pts;
      return true;
    }
  },
  ...succShapes()
  )
);

/* Kardeş geçişi: ÜSTTEN kavisli geç — eşlerin üstünden değil, node'ların üstünden */
diagram.linkTemplateMap.add('succ-sibling',
  $(go.Link, {
    curve: go.Curve.Bezier,
    isLayoutPositioned: false,
    isTreeLink: false,
    selectable: false,
    layerName: 'Foreground',
    computePoints: function() {
      const fr = this.fromNode, to = this.toNode;
      if (!fr || !to) return go.Link.prototype.computePoints.call(this);
      const fb = fr.actualBounds, tb = to.actualBounds;
      const x1 = fb.centerX, y1 = fb.top;
      const x2 = tb.centerX, y2 = tb.top;
      // Üstten yay: control pointler yukarıda
      const lift = Math.max(60, Math.abs(x2 - x1) * 0.5);
      const mx = (x1 + x2) / 2;
      const pts = new go.List(go.Point);
      pts.add(new go.Point(x1, y1));
      pts.add(new go.Point(x1, y1 - lift));
      pts.add(new go.Point(x2, y2 - lift));
      pts.add(new go.Point(x2, y2));
      this.points = pts;
      return true;
    }
  },
  /* halo */
  $(go.Shape, { isPanelMain: true, stroke: 'rgba(255,255,255,0.75)', strokeWidth: 3 }),
  /* çizgi */
  $(go.Shape, { isPanelMain: true, strokeWidth: 0.4, opacity: 0.70 },
    new go.Binding('stroke',          'tip', t => SUCC_STYLE[t].stroke),
    new go.Binding('strokeDashArray', 'tip', t => {
      const d = SUCC_STYLE[t].dash;
      return d ? d.split(',').map(Number) : null;
    }),
    new go.Binding('strokeWidth', 'tip', t => SUCC_STYLE[t].w)
  ),
  /* ok */
  $(go.Shape, { toArrow: 'Triangle', scale: 1.6, strokeWidth: 0 },
    new go.Binding('stroke', 'tip', t => SUCC_STYLE[t].stroke),
    new go.Binding('fill',   'tip', t => SUCC_STYLE[t].stroke)
  ),
  /* numara */
  $(go.Panel, 'Auto',
    { segmentIndex: NaN, segmentFraction: 0.5, alignmentFocus: go.Spot.Center },
    $(go.Shape, 'RoundedRectangle', { parameter1: 3, strokeWidth: 0 },
      new go.Binding('fill', 'tip', t => SUCC_STYLE[t].stroke)
    ),
    $(go.TextBlock, { font: 'bold 8px sans-serif', stroke: '#fff', margin: new go.Margin(1,3,1,3) },
      new go.Binding('text', 'idx', i => String(i + 1))
    )
  )
  )
);

/* ─── Link: eş bağı ─────────────────────────────────────────────────── */
diagram.linkTemplateMap.add('esbag',
  $(go.Link, {
    selectable: false,
    layerName: 'Background',
    isLayoutPositioned: false,
    routing: go.Routing.Orthogonal,
    corner: 4,
  },
  $(go.Shape, { stroke: 'rgba(175,152,120,0.50)', strokeWidth: 0.9, strokeDashArray: [4,3] })
  )
);

/* ─── Node template ─────────────────────────────────────────────────── */
diagram.nodeTemplate =
  $(go.Node, 'Auto', {
    locationSpot: go.Spot.Center,
    selectionAdorned: false,
    cursor: 'pointer',
  },
  {
    toolTip: $('Adornment', 'Auto',
      $(go.Shape, { fill: '#fffdf5', stroke: '#d0c9b6', parameter1: 6 }),
      $(go.Panel, 'Table', { margin: 8, defaultAlignment: go.Spot.Left },
        $(go.TextBlock,
          { row: 0, font: 'bold 12px sans-serif', margin: new go.Margin(0,0,4,0) },
          new go.Binding('text', 'ad')
        ),
        $(go.TextBlock,
          { row: 1, font: '11px sans-serif', stroke: '#666',
            wrap: go.TextBlock.Wrap, maxSize: new go.Size(230, NaN) },
          new go.Binding('text', '', d =>
            [d.baba ? 'Baba: ' + d.baba : '',
             d.anne ? 'Anne: ' + d.anne : '',
             d.not  ? d.not : ''].filter(Boolean).join('\n')
          )
        ),
        $(go.TextBlock,
          { row: 2, font: '11px sans-serif', stroke: '#555',
            wrap: go.TextBlock.Wrap, maxSize: new go.Size(230, NaN),
            margin: new go.Margin(4,0,0,0) },
          new go.Binding('text', 'ozet'),
          new go.Binding('visible', 'ozet', s => !!s)
        )
      )
    )
  },
  $(go.Shape, 'RoundedRectangle', { name: 'RECT', parameter1: 7 },
    new go.Binding('fill',        '', d => nodeStyle(d).fill),
    new go.Binding('stroke',      '', d => nodeStyle(d).stroke),
    new go.Binding('strokeWidth', 'tip', t => t === 'padisah' ? 1.6 : 0.9),
    new go.Binding('desiredSize', 'tip', t => new go.Size(NW[t]||106, NH[t]||40))
  ),
  $(go.Panel, 'Table', { margin: new go.Margin(3,4,3,4), defaultAlignment: go.Spot.Left },
    /* no rozeti */
    $(go.Panel, 'Auto',
      { row:0, column:0, alignment: go.Spot.TopLeft, margin: new go.Margin(1,2,0,0) },
      new go.Binding('visible', 'no', n => n != null),
      $(go.Shape, 'RoundedRectangle', { parameter1:3, strokeWidth:0 },
        new go.Binding('fill', '', d => nodeStyle(d).stroke)
      ),
      $(go.TextBlock, { font:'bold 8.5px sans-serif', stroke:'#fff', margin: new go.Margin(1,3,1,3) },
        new go.Binding('text', 'no', n => n != null ? String(n) : '')
      )
    ),
    /* isim */
    $(go.TextBlock,
      { row:0, column:1, font:'600 10px sans-serif', textAlign:'center',
        stretch: go.GraphObject.Horizontal,
        overflow: go.TextOverflow.Ellipsis, maxSize: new go.Size(100, NaN) },
      new go.Binding('text',   'ad', s => s.replace(/\s*\(.*?\)/g,' ').trim().slice(0,18)),
      new go.Binding('stroke', '', d => nodeStyle(d).text)
    ),
    /* yıl */
    $(go.TextBlock,
      { row:1, column:0, columnSpan:2, font:'7.5px sans-serif', textAlign:'center',
        stretch: go.GraphObject.Horizontal, stroke:'#999', margin: new go.Margin(1,0,0,0) },
      new go.Binding('text', '', d =>
        d.yil_d ? (d.yil_v ? `${d.yil_d}–${d.yil_v}` : `d.${d.yil_d}`) : ''
      ),
      new go.Binding('visible', '', d => !!d.yil_d && d.tip !== 'es')
    ),
    /* ikon */
    $(go.TextBlock,
      { row:0, column:0, font:'11px sans-serif', alignment: go.Spot.Left, margin: new go.Margin(2,0,0,3) },
      new go.Binding('text',    'tip', t => t==='es'?'♀':t==='ata'?'◆':''),
      new go.Binding('visible', 'tip', t => t==='es'||t==='ata'),
      new go.Binding('stroke',  '', d => nodeStyle(d).text)
    )
  )
  );

/* ─── Model ─────────────────────────────────────────────────────────── */
function buildModel() {
  const bioNodes = NODES
    .filter(n => n.tip !== 'es')
    .map(n => ({ key: n.id, parent: n.pid || undefined, ...n }));

  const esNodeData = NODES
    .filter(n => n.tip === 'es')
    .map(n => ({ key: n.id, isLayoutPositioned: false, ...n }));

  const bioLinks = NODES
    .filter(n => n.tip !== 'es' && n.pid)
    .map((n, i) => ({ key: 'bio-' + i, from: n.pid, to: n.id, category: '' }));

  const esLinks = NODES
    .filter(n => n.tip === 'es')
    .map(n => ({ key: 'esbag-' + n.id, from: n.sahi, to: n.id, category: 'esbag' }));

  // Kardeş geçişi tespiti: from ve to'nun ortak parent'ı varsa (aynı jenerasyon)
  // Bunu data'dan anlıyoruz: 'erkek' tip = kardeşten kardeşe
  // 'ogul' ve 'fetret' dikey, 'erkek' ve çoğu 'isyan' yatay
  const SIBLING_TIPS = new Set(['erkek']);
  // Bazı isyan geçişleri de kardeşten kardeşe (p15→p16, p16→p15, p15→p17, vs)
  // Bunları from/to parent kontrolüyle tespit et
  const parentOf = {};
  NODES.forEach(n => { if (n.pid) parentOf[n.id] = n.pid; });

  const succLinks = SUCCESSION.map((s, i) => {
    const isSibling = SIBLING_TIPS.has(s.tip) ||
      (parentOf[s.from] && parentOf[s.from] === parentOf[s.to]);
    return {
      key: 'succ-' + i, from: s.from, to: s.to,
      category: isSibling ? 'succ-sibling' : 'succ',
      tip: s.tip, idx: i,
    };
  });

  diagram.model = new go.GraphLinksModel({
    nodeKeyProperty: 'key',
    linkKeyProperty: 'key',
    nodeDataArray:   [...bioNodes, ...esNodeData],
    linkDataArray:   [...bioLinks, ...esLinks, ...succLinks],
  });
}

/* ─── Eşleri yerleştir: SAHİBİN SAĞINDA, alt alta ──────────────────── */
let overlaysDone = false;

diagram.addDiagramListener('InitialLayoutCompleted', () => {
  if (overlaysDone) return;
  overlaysDone = true;

  const GAP_X = 20;   // sahip sağ kenarından ilk eşe mesafe
  const GAP_Y = 8;    // aynı padişahın eşleri arasındaki boşluk
  const COL_W = NW.es + 12; // eş sütun genişliği (eş kutusu + sütunlar arası)
  const PAD_Y = 4;    // eşler arası dikey güvenlik payı

  // Yerleştirilmiş dikdörtgenleri tut: {x1,x2,y1,y2}
  const placed = [];

  // İki dikdörtgen çakışıyor mu?
  function overlaps(ax1, ax2, ay1, ay2) {
    return placed.some(r =>
      ax1 < r.x2 && ax2 > r.x1 &&
      ay1 < r.y2 && ay2 > r.y1
    );
  }

  // Bu Y bandı için ilk uygun X'i bul
  function findX(y1, y2, minX) {
    let x1 = minX;
    let x2 = x1 + NW.es;
    let tries = 0;
    while (overlaps(x1, x2, y1 - PAD_Y, y2 + PAD_Y) && tries < 40) {
      // Çakışan dikdörtgeni bul, onun sağına atla
      const hit = placed.find(r =>
        x1 < r.x2 && x2 > r.x1 &&
        (y1 - PAD_Y) < r.y2 && (y2 + PAD_Y) > r.y1
      );
      x1 = hit ? hit.x2 + 12 : x1 + COL_W;
      x2 = x1 + NW.es;
      tries++;
    }
    return x1;
  }

  // Eş gruplarını topla
  const esGroups = {};
  NODES.filter(n => n.tip === 'es').forEach(es => {
    if (!esGroups[es.sahi]) esGroups[es.sahi] = [];
    esGroups[es.sahi].push(es);
  });

  // Önce padişah node'larının sağ kenarına + eş gruplarının toplam yüksekliğine göre sırala
  // En solda olan (ob.right en küçük) sahipten başla ki çakışmalar önce küçük X'te çözülsün
  const groups = Object.entries(esGroups)
    .map(([sahiId, esler]) => {
      const owner = diagram.findNodeForKey(sahiId);
      if (!owner) return null;
      return { sahiId, esler, ob: owner.actualBounds };
    })
    .filter(Boolean)
    .sort((a, b) => a.ob.right - b.ob.right);

  diagram.startTransaction('place-spouses');

  groups.forEach(({ esler, ob }) => {
    esler.sort((a, b) => a.id < b.id ? -1 : 1);

    const totalH = esler.length * NH.es + (esler.length - 1) * GAP_Y;
    // Sahiple dikey ortalı
    const blockY1 = ob.centerY - totalH / 2;

    // Bu blok için çakışmasız X bul
    const x1 = findX(blockY1, blockY1 + totalH, ob.right + GAP_X);

    // Bloğu yerleştir
    esler.forEach((esData, i) => {
      const esNode = diagram.findNodeForKey(esData.id);
      if (!esNode) return;
      const cy = blockY1 + i * (NH.es + GAP_Y) + NH.es / 2;
      esNode.location = new go.Point(x1 + NW.es / 2, cy);
    });

    // Blok alanını kaydet
    placed.push({ x1, x2: x1 + NW.es, y1: blockY1 - PAD_Y, y2: blockY1 + totalH + PAD_Y });
  });

  diagram.commitTransaction('place-spouses');
  // zoomToFit yerine daha yakın başla
  const vw = diagram.viewportBounds.width;
  const sw = diagram.documentBounds.width;
  const vh = diagram.viewportBounds.height;
  const sh = diagram.documentBounds.height;
  const fitScale = Math.min(vw / sw, vh / sh);
  diagram.scale = fitScale * 2.8;  // daha yakın başla
  diagram.centerRect(diagram.documentBounds);
  buildFigPanel();
});

/* ─── Filtreler ─────────────────────────────────────────────────────── */
const F = {
  periods:     new Set(['kuruluş','yükseliş','duraklama','gerileme','çöküş']),
  succTypes:   new Set(['ogul','erkek','isyan','fetret']),
  showSucc: true, showEs: true, showSehzade: true,
};

function applyFilters() {
  diagram.startTransaction('filter');
  // Önce padişah görünürlüklerini hesapla (eşler buna bakacak)
  const padisahVis = {};
  diagram.nodes.each(n => {
    const d = n.data; if (!d || d.tip !== 'padisah') return;
    padisahVis[d.key] = F.periods.has(periodOf(d.no));
  });

  diagram.nodes.each(n => {
    const d = n.data; if (!d) return;
    let vis = true;
    if (d.tip === 'padisah') {
      vis = F.periods.has(periodOf(d.no));
    } else if (d.tip === 'es') {
      // Hem showEs filtresi hem de sahibinin dönemi
      if (!F.showEs) {
        vis = false;
      } else if (d.sahi && padisahVis[d.sahi] === false) {
        vis = false;  // sahibi gizli dönemde
      }
    } else if (d.tip === 'sehzade' || d.tip === 'sultan' || d.tip === 'kiz') {
      if (!F.showSehzade) vis = false;
    }
    n.visible = vis;
  });
  diagram.links.each(l => {
    const d = l.data; if (!d) return;
    if (d.category === 'succ' || d.category === 'succ-sibling')  l.visible = F.showSucc && F.succTypes.has(d.tip);
    if (d.category === 'esbag') l.visible = F.showEs;
    // category === '' (soy bağı) her zaman görünür
  });
  diagram.commitTransaction('filter');
}

/* ─── Detay paneli ──────────────────────────────────────────────────── */
function showDetail(d) {
  if (d.tip !== 'padisah') return;
  const ps = PERIODS[periodOf(d.no)];
  const badges = (d.badges || [])
    .map(b => `<span class="badge" style="background:${b.bg};color:${b.c}">${b.t}</span>`)
    .join('');
  const succLabel = {
    ogul:'Oğul — veraset', erkek:'Erkek kardeş (ekberiyet)',
    isyan:'İsyan / zorla',  fetret:'Fetret / iç savaş',
  };

  document.getElementById('detailBody').innerHTML = `
    <div class="dh">
      <img class="dimg" src="${d.img||''}" alt="${d.ad}"
           onerror="this.style.display='none'">
      <div>
        <div class="dorder" style="color:${ps.stroke}">${d.no}. padişah · ${ps.label} Dönemi</div>
        <h2 style="color:${ps.stroke}">${d.ad}</h2>
        <div class="dyears">${d.yil_d||''}–${d.yil_v||''}</div>
        <div class="badges">${badges}</div>
      </div>
    </div>
    <div class="drows">
      ${d.baba ? `<div class="drow"><b>Baba</b><span>${d.baba}</span></div>` : ''}
      ${d.anne ? `<div class="drow"><b>Anne</b><span>${d.anne}</span></div>` : ''}
      ${d.gecis_gelen ? `
        <div class="drow">
          <b>${succLabel[d.gecis_tip]||'Geliş'}</b>
          <span>${d.gecis_gelen}</span>
        </div>` : ''}
      ${d.gecis_giden ? `<div class="drow"><b>Gidiş</b><span>${d.gecis_giden}</span></div>` : ''}
      ${d.kardesler?.length
        ? `<div class="drow"><b>Kardeşler</b><span>${d.kardesler.join('<br>')}</span></div>` : ''}
      ${d.ozet ? `<div class="drow doz"><span>${d.ozet}</span></div>` : ''}
    </div>`;
  document.getElementById('detail').classList.remove('hidden');
}

/* ─── Olaylar ───────────────────────────────────────────────────────── */
diagram.addDiagramListener('ObjectSingleClicked', e => {
  const part = e.subject.part;
  if (part instanceof go.Node && part.data) showDetail(part.data);
});
diagram.addDiagramListener('BackgroundSingleClicked', () => {
  document.getElementById('detail').classList.add('hidden');
});

/* ─── UI ────────────────────────────────────────────────────────────── */
document.getElementById('btnFit').onclick      = () => diagram.zoomToFit();
document.getElementById('btnZoomIn').onclick   = () => diagram.commandHandler.increaseZoom(1.25);
document.getElementById('btnZoomOut').onclick  = () => diagram.commandHandler.decreaseZoom(1.25);
// ── Panel toggle'ları ──────────────────────────────────────────────────────
const isMobile = () => window.innerWidth <= 680;

function initPanelStates() {
  const mobile = isMobile();

  // Filtre & lejant: panel-collapsed mantığı (header tıklanabilir, body açılır/kapanır)
  // Masaüstü: açık | Mobil: kapalı
  [
    { btnId:'btnToggleFilters', panelId:'filter-panel' },
    { btnId:'btnToggleLegend',  panelId:'legend'       },
  ].forEach(({ btnId, panelId }) => {
    const btn   = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) return;
    if (mobile) panel.classList.add('panel-collapsed');
    btn.addEventListener('click', () => {
      panel.classList.toggle('panel-collapsed');
    });
  });

  // Minimap: zoom butonu ile aç/kapat (mm-hidden class)
  const mmBtn  = document.getElementById('btnToggleMinimap');
  const mmWrap = document.getElementById('minimap-wrap');
  if (mmBtn && mmWrap) {
    if (mobile) {
      mmWrap.classList.add('mm-hidden');
      mmBtn.classList.remove('active');
    }
    mmBtn.addEventListener('click', function() {
      mmWrap.classList.toggle('mm-hidden');
      this.classList.toggle('active');
    });
  }
}

initPanelStates();
document.getElementById('detailClose').onclick = () =>
  document.getElementById('detail').classList.add('hidden');

// Soy bağı her zaman görünür — filtre yok
document.getElementById('togSucc').onchange   = e => { F.showSucc    = e.target.checked; applyFilters(); };
document.getElementById('togEs').onchange     = e => { F.showEs      = e.target.checked; applyFilters(); };
document.getElementById('togSeh').onchange    = e => { F.showSehzade = e.target.checked; applyFilters(); };

document.querySelectorAll('[data-succ]').forEach(cb => {
  cb.addEventListener('change', () => {
    cb.checked ? F.succTypes.add(cb.dataset.succ) : F.succTypes.delete(cb.dataset.succ);
    applyFilters();
  });
});
document.querySelectorAll('[data-period]').forEach(cb => {
  cb.addEventListener('change', () => {
    cb.checked ? F.periods.add(cb.dataset.period) : F.periods.delete(cb.dataset.period);
    applyFilters();
  });
});

/* ─── Mini harita (GoJS Overview) ───────────────────────────────────── */
$(go.Overview, 'minimap', {
  observed: diagram,
  contentAlignment: go.Spot.Center,
});

/* ─── Başlat ────────────────────────────────────────────────────────── */
buildModel();

/* ─── Figür Timeline Paneli (Sol) ─────────────────────────────────── */
const FIG_DATA = [
  // ── Veziriazam / Sadrazam
  {n:'Çandarlı Halil Paşa',       r:'Veziriazam',     s:1360,e:1387},
  {n:'Çandarlı Ali Paşa',         r:'Veziriazam',     s:1387,e:1406},
  {n:'Piri Mehmed Paşa',          r:'Veziriazam',     s:1518,e:1523},
  {n:'Makbul İbrahim Paşa',       r:'Veziriazam',     s:1523,e:1536},
  {n:'Lütfi Paşa',                r:'Veziriazam',     s:1539,e:1541},
  {n:'Rüstem Paşa',               r:'Veziriazam',     s:1544,e:1561},
  {n:'Sokullu Mehmed Paşa',       r:'Veziriazam',     s:1565,e:1579},
  {n:'Kuyucu Murat Paşa',         r:'Sadrazam',       s:1606,e:1611},
  {n:'Köprülü Mehmed Paşa',       r:'Sadrazam',       s:1656,e:1661},
  {n:'Köprülüzade Fazıl Ahmed',   r:'Sadrazam',       s:1661,e:1676},
  {n:'Merzifonlu Kara Mustafa',   r:'Sadrazam',       s:1676,e:1683},
  {n:'Köprülüzade Fazıl Mustafa', r:'Sadrazam',       s:1689,e:1691},
  {n:'Damad İbrahim Paşa',        r:'Sadrazam',       s:1718,e:1730},
  {n:'Mustafa Reşid Paşa',        r:'Sadrazam',       s:1846,e:1858},
  {n:'Ali Paşa',                  r:'Sadrazam',       s:1855,e:1871},
  {n:'Midhat Paşa',               r:'Sadrazam',       s:1872,e:1876},
  {n:'Kâmil Paşa',                r:'Sadrazam',       s:1885,e:1895},
  {n:'Talat Paşa',                r:'Sadrazam',       s:1917,e:1918},
  // ── Şeyhülislam
  {n:'Zenbilli Ali Efendi',       r:'Şeyhülislam',    s:1503,e:1526},
  {n:'Ebussuud Efendi',           r:'Şeyhülislam',    s:1545,e:1574},
  {n:'Çatalcalı Ali Efendi',      r:'Şeyhülislam',    s:1674,e:1686},
  // ── Kaptan-ı Derya
  {n:'Barbaros Hayreddin Paşa',   r:'Kaptan-ı Derya', s:1534,e:1546},
  {n:'Turgut Reis',               r:'Kaptan-ı Derya', s:1546,e:1565},
  {n:'Kılıç Ali Paşa',            r:'Kaptan-ı Derya', s:1571,e:1587},
  // ── Mimar
  {n:'Mimar Sinan',               r:'Mimar',          s:1539,e:1588},
  {n:'Mimar Mehmed Ağa',          r:'Mimar',          s:1588,e:1622},
  // ── Bilgin / Sanatçı
  {n:'Matrakçı Nasuh',            r:'Bilgin / Sanatçı',s:1520,e:1564},
  {n:'Katip Çelebi',              r:'Bilgin / Sanatçı',s:1630,e:1657},
  {n:'Evliya Çelebi',             r:'Bilgin / Sanatçı',s:1640,e:1682},
  {n:'Naima',                     r:'Bilgin / Sanatçı',s:1655,e:1716},
  {n:'İbrahim Müteferrika',       r:'Bilgin / Sanatçı',s:1720,e:1745},
  // ── İsyancı / Dönüm Noktası
  {n:'Şeyh Bedreddin',            r:'İsyancı',        s:1416,e:1416},
  {n:'Patrona Halil',             r:'İsyancı',        s:1730,e:1730},
  {n:'Kabakçı Mustafa',           r:'İsyancı',        s:1807,e:1808},
  {n:'Alemdar Mustafa Paşa',      r:'İsyancı',        s:1808,e:1808},
  {n:'Mustafa Celaleddin Paşa',   r:'Dönüm Noktası',  s:1860,e:1876},
];

const FIG_ROLE_C = {
  'Veziriazam':       '#C8B86A',
  'Sadrazam':         '#C8B86A',
  'Şeyhülislam':      '#4AAF9A',
  'Kaptan-ı Derya':   '#6BB4C2',
  'Mimar':            '#B87AAE',
  'Bilgin / Sanatçı': '#9FB8C4',
  'İsyancı':          '#D4735A',

};

// Yıl → GoJS Y koordinatı mapping (padişah node'larından)
let yearToY = null;

function buildYearMap() {
  const pts = [];
  diagram.nodes.each(n => {
    const d = n.data;
    if (!d || d.tip !== 'padisah' || !d.yil_d) return;
    pts.push({ year: d.yil_d, y: n.location.y });
    if (d.yil_v) pts.push({ year: d.yil_v, y: n.location.y + n.actualBounds.height });
  });
  pts.sort((a, b) => a.year - b.year);
  // Unique yıllar
  yearToY = pts.filter((p, i) => i === 0 || p.year !== pts[i-1].year);
}

function interpY(year) {
  if (!yearToY || !yearToY.length) return 0;
  if (year <= yearToY[0].year) return yearToY[0].y;
  const last = yearToY[yearToY.length - 1];
  if (year >= last.year) return last.y;
  for (let i = 0; i < yearToY.length - 1; i++) {
    const a = yearToY[i], b = yearToY[i + 1];
    if (year >= a.year && year <= b.year) {
      const t = (year - a.year) / (b.year - a.year);
      return a.y + t * (b.y - a.y);
    }
  }
  return 0;
}

// Sütun ataması — ardışıklar aynı sütunda, çakışanlar yan sütuna
const FIG_COL_W = 76, FIG_COL_PAD = 4;
function assignFigCols(figs) {
  // Rol bazlı gruplar: aynı rol → önce birbirine ardışık olanları aynı sütuna yerleştir
  // Strateji: role göre sırala, ardından zaman sırasına göre sütun ata
  // Ardışık: figs[i].e === figs[i+1].s (veya çok yakın, ±5 yıl)

  // Her figürü role göre grupla, sonra birleştirerek sırala
  const roleOrder = ['Veziriazam','Sadrazam','Şeyhülislam','Kaptan-ı Derya',
                     'Mimar','Bilgin / Sanatçı','İsyancı','Dönüm Noktası'];
  const sorted = [...figs].sort((a, b) => {
    const ra = roleOrder.indexOf(a.r), rb = roleOrder.indexOf(b.r);
    if (ra !== rb) return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
    return a.s - b.s;
  });

  // Sütunları role bazlı tahsis et: her rol için bir sütun başlat
  const roleCols = {}; // role -> col index
  const cols = [];    // col -> [{s,e,r}]

  sorted.forEach(f => {
    // Bu rol için bir sütun var mı?
    if (roleCols[f.r] === undefined) {
      roleCols[f.r] = cols.length;
      cols.push([]);
    }
    const preferred = roleCols[f.r];

    // Tercih edilen sütunda yer var mı?
    const colItems = cols[preferred];
    const last = colItems[colItems.length - 1];
    if (!last || f.s >= last.e - 2) {
      // Yer var — aynı sütun
      colItems.push(f);
      f._col = preferred;
    } else {
      // Çakışma var — yan sütun bul
      let found = false;
      for (let ci = 0; ci < cols.length; ci++) {
        if (ci === preferred) continue;
        const cl = cols[ci];
        const la = cl[cl.length - 1];
        if (!la || f.s >= la.e - 2) {
          cl.push(f); f._col = ci; found = true; break;
        }
      }
      if (!found) { f._col = cols.length; cols.push([f]); }
    }
  });

  // Orijinal sırayı koru (FIG_DATA sırası)
  figs.forEach(f => { if (f._col === undefined) f._col = 0; });
  return cols.length;
}

function buildFigPanel() {
  buildYearMap();
  if (!yearToY || !yearToY.length) return;

  const numCols = assignFigCols(FIG_DATA);
  const barAreaW = numCols * FIG_COL_W + FIG_COL_PAD * 2;
  const panelW   = 5 + 36 + barAreaW; // period strip + axis + bars

  const panel = document.getElementById('fig-panel');
  if (!panel) return;
  panel.style.width = panelW + 'px';

  // Canvas ve diğer panellerin left'ini ayarla
  const diagramDiv = document.getElementById('myDiagramDiv');
  if (diagramDiv) diagramDiv.style.left = panelW + 'px';
  const detail = document.getElementById('detail');
  if (detail) detail.style.left = (panelW + 14) + 'px';

  // Dönem renk şeritleri (period strip)
  const strip = document.getElementById('fig-period-strip');
  strip.innerHTML = '';
  strip.style.height = '100%';
  Object.values(PERIODS).forEach(p => {
    const y1 = interpY(p.s), y2 = interpY(p.e === p.s ? p.s + 1 : p.e);
    // Bu pikseller GoJS document space — sync'te güncellenir
    const el = document.createElement('div');
    el.className = 'period-band-strip';
    el.dataset.ys = p.s; el.dataset.ye = p.e; el.dataset.c = p.c;
    el.style.background = p.c;
    strip.appendChild(el);
  });

  // Zaman ekseni (axis)
  const axisInner = document.getElementById('fig-axis-inner');
  axisInner.innerHTML = '';
  // Dönem renkleri eksen arka planında
  Object.values(PERIODS).forEach(p => {
    const el = document.createElement('div');
    el.className = 'period-band-axis';
    el.dataset.ys = p.s; el.dataset.ye = p.e; el.dataset.c = p.c;
    el.style.background = p.c + '22';
    axisInner.appendChild(el);
  });
  // Yıl etiketleri ve tick'ler
  for (let y = 1300; y <= 1922; y += 25) {
    const major = y % 100 === 0, mid = y % 50 === 0 && !major;
    if (!major && !mid) continue;
    const yDoc = interpY(y);
    const tick = document.createElement('div');
    tick.className = 'ax-tick';
    tick.dataset.ydoc = yDoc;
    tick.style.cssText = `width:${major ? 10 : 5}px; opacity:${major ? 0.7 : 0.35};`;
    axisInner.appendChild(tick);
    const lbl = document.createElement('div');
    lbl.className = 'ax-year';
    lbl.dataset.ydoc = yDoc;
    lbl.style.cssText = `opacity:${major ? 1 : 0.5}; font-size:${major ? 9 : 7}px;`;
    lbl.textContent = y;
    axisInner.appendChild(lbl);
  }

  // Bar alanı: yüzyıl çizgileri
  const barsEl = document.getElementById('fig-bars');
  barsEl.innerHTML = '';
  for (let y = 1300; y <= 1922; y += 25) {
    const major = y % 100 === 0, mid = y % 50 === 0 && !major;
    if (!major && !mid) continue;
    const yDoc = interpY(y);
    const line = document.createElement('div');
    line.className = 'cent-line ' + (major ? 'maj' : 'min');
    line.dataset.ydoc = yDoc;
    barsEl.appendChild(line);
    if (major) {
      const lbl = document.createElement('div');
      lbl.className = 'cent-lbl';
      lbl.dataset.ydoc = yDoc;
      lbl.textContent = y;
      barsEl.appendChild(lbl);
    }
  }

  // Figür barları
  FIG_DATA.forEach((f, fi) => {
    const c = FIG_ROLE_C[f.r] || '#9FB8C4';
    f._yDocTop = interpY(f.s);
    f._yDocBot = interpY(f.e === f.s ? f.s + 2 : f.e);

    const bar = document.createElement('div');
    bar.className = 'fig-bar';
    bar.dataset.idx = fi;
    bar.style.cssText = `
      left:${FIG_COL_PAD + f._col * FIG_COL_W}px;
      width:${FIG_COL_W - FIG_COL_PAD}px;
    `;
    const inner = document.createElement('div');
    inner.className = 'fig-bar-inner';
    inner.style.cssText = `background:${c}18; box-shadow: inset 2px 0 0 ${c};`;
    inner.innerHTML = `
      <span class="fb-role" style="color:${c}">${f.r}</span>
      <span class="fb-name">${f.n}</span>
      <span class="fb-years">${f.s}–${f.e}</span>
    `;
    bar.appendChild(inner);

    const tt = document.getElementById('fig-tooltip');
    bar.addEventListener('mouseenter', () => {
      tt.querySelector('.tt-role').textContent = f.r;
      tt.querySelector('.tt-role').style.color  = c;
      tt.querySelector('.tt-name').textContent  = f.n;
      tt.querySelector('.tt-years').textContent = f.s + (f.e !== f.s ? '–' + f.e : '');
      tt.classList.add('on');
    });
    bar.addEventListener('mousemove', ev => {
      tt.style.left = (panelW + 8) + 'px';
      tt.style.top  = (ev.clientY - 50) + 'px';
    });
    bar.addEventListener('mouseleave', () => tt.classList.remove('on'));
    barsEl.appendChild(bar);
  });

  syncFigPanel();
}

function syncFigPanel() {
  if (!yearToY || !yearToY.length) return;
  const panel = document.getElementById('fig-panel');
  if (!panel || panel.style.width === '0px') return;

  const sc  = diagram.scale;
  const pos = diagram.position;
  const HDR = 26; // header yüksekliği

  // Yardımcı: GoJS doc Y → panel-relative ekran Y
  function docToScreen(yDoc) {
    return (yDoc - pos.y) * sc;
  }

  // Dönem şeritleri (strip + axis)
  document.querySelectorAll('.period-band-strip, .period-band-axis').forEach(el => {
    const ys = parseFloat(el.dataset.ys), ye = parseFloat(el.dataset.ye);
    const y1 = docToScreen(interpY(ys));
    const y2 = docToScreen(interpY(ye));
    el.style.top    = y1 + 'px';
    el.style.height = Math.max(1, y2 - y1) + 'px';
  });

  // Axis tick ve etiketler
  document.querySelectorAll('#fig-axis-inner .ax-tick, #fig-axis-inner .ax-year').forEach(el => {
    const yDoc = parseFloat(el.dataset.ydoc);
    el.style.top = docToScreen(yDoc) + 'px';
  });

  // Yüzyıl çizgileri ve etiketleri
  document.querySelectorAll('#fig-bars .cent-line, #fig-bars .cent-lbl').forEach(el => {
    const yDoc = parseFloat(el.dataset.ydoc);
    el.style.top = (docToScreen(yDoc) + HDR) + 'px';
  });

  // Figür barları — min yükseklik + runtime çakışma önleme (yan sütun)
  const MIN_H = 32;
  const GAP   = 2;     // kutular arası min boşluk
  const COL_W_RT = FIG_COL_W - FIG_COL_PAD;  // çalışma zamanı sütun genişliği

  // 1. Önce her barın pozisyonunu hesapla (min yükseklik dahil)
  const barInfos = [];
  document.querySelectorAll('#fig-bars .fig-bar').forEach(bar => {
    const f = FIG_DATA[parseInt(bar.dataset.idx)];
    if (!f) return;
    const rawTop = docToScreen(f._yDocTop) + HDR;
    const rawBot = docToScreen(f._yDocBot) + HDR;
    const natural = rawBot - rawTop;
    const h = Math.max(MIN_H, natural);
    // Ortalama: kısa kutular gerçek merkezi etrafında genişler
    const midY = (rawTop + rawBot) / 2;
    const top  = midY - h / 2;
    barInfos.push({ bar, f, top, h, col: f._col });
  });

  // 2. Runtime çakışma kontrolü: aynı sütunda üst üste binen kutular
  //    → çakışanı bir sonraki boş sütuna taşı (sadece görsel, _col değişmez)
  //    Sütunlar: yerleşik kutular { col → [{top, bot}] }
  const rtCols = {};  // col -> [{top, bot}]
  function rtOverlaps(col, top, bot) {
    return (rtCols[col] || []).some(r => top < r.bot + GAP && bot > r.top - GAP);
  }
  function rtPlace(col, top, bot) {
    if (!rtCols[col]) rtCols[col] = [];
    rtCols[col].push({ top, bot });
  }

  // barları yukarıdan aşağıya sırala (önce üsttekiler)
  barInfos.sort((a, b) => a.top - b.top);

  // Mevcut sütun sayısı — JS ile hesaplanmış FIG_COL_W * numCols
  const existingCols = Math.max(...FIG_DATA.map(f => f._col)) + 1;

  barInfos.forEach(({ bar, f, top, h, col }) => {
    const bot = top + h;
    let assignedCol = col;

    // Orijinal sütunda yer var mı?
    if (rtOverlaps(assignedCol, top, bot)) {
      // Sırayla dene: önce orijinal sütunları, sonra yeni sütun ekle
      let found = false;
      for (let c = 0; c <= existingCols + 2; c++) {
        if (!rtOverlaps(c, top, bot)) {
          assignedCol = c;
          found = true;
          break;
        }
      }
    }
    rtPlace(assignedCol, top, bot);

    // Genişlik: panel genişliğini aşmaması için panelW'den hesapla
    bar.style.left   = (FIG_COL_PAD + assignedCol * FIG_COL_W) + 'px';
    bar.style.top    = top + 'px';
    bar.style.height = h + 'px';

    const inner = bar.querySelector('.fig-bar-inner');
    if (inner) {
      inner.querySelector('.fb-role').style.display  = h > 10 ? 'block' : 'none';
      inner.querySelector('.fb-name').style.display  = h > 20 ? 'block' : 'none';
      inner.querySelector('.fb-years').style.display = h > 38 ? 'block' : 'none';
    }
  });

  // Panel genişliğini güncelle (yeni sütunlar eklendiyse)
  const maxCol = Math.max(...Object.keys(rtCols).map(Number));
  const newBarW = (maxCol + 1) * FIG_COL_W + FIG_COL_PAD * 2;
  const panelEl = document.getElementById('fig-panel');
  if (panelEl) {
    const axisW = 5 + 36;  // period strip + axis
    const newW = axisW + newBarW;
    panelEl.style.width = newW + 'px';
    const diagramDiv = document.getElementById('myDiagramDiv');
    if (diagramDiv) diagramDiv.style.left = newW + 'px';
    const detail = document.getElementById('detail');
    if (detail) detail.style.left = (newW + 14) + 'px';
  }
}

diagram.addDiagramListener('ViewportBoundsChanged', syncFigPanel);