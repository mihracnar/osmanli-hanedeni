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