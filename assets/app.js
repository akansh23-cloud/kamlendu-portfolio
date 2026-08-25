(() => {
  'use strict';

  // Do not let Chrome restore a stale position inside the long sticky story.
  // Hash navigation still works normally.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const resetInitialScroll = () => { if (!location.hash) window.scrollTo(0, 0); };
  resetInitialScroll();
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // cursor / coordinate HUD
  const cursor = $('#cursorDot');
  const coords = $('#heroCoords');
  let mx = innerWidth/2, my = innerHeight/2;
  addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    if (cursor) cursor.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    if (coords) coords.textContent = `x:${String(Math.round(mx)).padStart(3,'0')} y:${String(Math.round(my)).padStart(3,'0')}`;
  }, {passive:true});
  addEventListener('pointerover', e => {
    document.body.classList.toggle('is-hover', !!e.target.closest('a,button,.project-orbit-card,.pipeline-part'));
  });

  // global scroll-reactive data fabric — chaos becomes structure as you move.
  // Scroll velocity disturbs the records; when motion slows they settle into the
  // next semantic layout: scatter → ingest → partitions → constellation → query → orbit.
  const hc = $('#heroCanvas');
  const hctx = hc.getContext('2d');
  let hw=0, hh=0, dpr=1, particles=[], sceneTargets=[], scrollKick=0, lastScrollY=scrollY;
  let currentSceneName='SCATTER', sceneMix=0;
  const sceneNames=['SCATTER','INGEST','PARTITION','CONSTELLATE','HARDMODE','QUERY','ORBIT','EGRESS'];
  const sceneColors=['73,214,255','73,214,255','84,243,173','180,156,255','255,102,122','73,214,255','255,189,90','84,243,173'];
  const seed = (n) => {
    const x=Math.sin(n*12.9898+78.233)*43758.5453;
    return x-Math.floor(x);
  };
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const smooth=t=>t*t*(3-2*t);
  const lerp=(a,b,t)=>a+(b-a)*t;

  function targetScatter(i, phase=0){
    return {x:(.03+seed(i*7+phase)*.94)*hw,y:(.04+seed(i*11+91+phase)*.92)*hh};
  }
  function targetIngest(i){
    const cols=6, c=i%cols, row=Math.floor(i/cols);
    const x=(.07+c*(.86/(cols-1)))*hw;
    const wave=((row%17)-8)*7 + Math.sin(row*.72+c)*18;
    return {x,y:hh*.5+wave};
  }
  function targetPartition(i){
    const partitions=6, part=i%partitions, q=Math.floor(i/partitions);
    const col=part%3,row=Math.floor(part/3);
    const boxW=hw*.235, boxH=hh*.255;
    const ox=hw*(.12+col*.31), oy=hh*(.20+row*.38);
    const gx=q%7, gy=Math.floor(q/7)%7;
    return {x:ox+(gx-3)*boxW/8,y:oy+(gy-3)*boxH/8};
  }
  function targetConstellation(i){
    const cluster=i%6, q=Math.floor(i/6), a=(cluster/6)*Math.PI*2-Math.PI/2;
    const cx=hw*.5+Math.cos(a)*Math.min(hw,hh)*.29;
    const cy=hh*.5+Math.sin(a)*Math.min(hw,hh)*.25;
    const ra=seed(q*17+cluster)*Math.PI*2, rr=12+seed(q*23+8)*74;
    return {x:cx+Math.cos(ra)*rr,y:cy+Math.sin(ra)*rr};
  }
  function targetHard(i){
    const cluster=i%5, q=Math.floor(i/5), a=(cluster/5)*Math.PI*2-Math.PI/2;
    const cx=hw*.5+Math.cos(a)*Math.min(hw,hh)*.27;
    const cy=hh*.5+Math.sin(a)*Math.min(hw,hh)*.23;
    const ra=seed(q*29+cluster)*Math.PI*2, rr=8+seed(q*41+17)*58;
    return {x:cx+Math.cos(ra)*rr,y:cy+Math.sin(ra)*rr};
  }
  function targetQuery(i){
    const cols=9, col=i%cols,row=Math.floor(i/cols)%22;
    const marginX=hw*.08, marginY=hh*.12;
    const cellW=(hw-marginX*2)/(cols-1), cellH=(hh-marginY*2)/21;
    const jitter=(seed(i*19)-.5)*5;
    return {x:marginX+col*cellW+jitter,y:marginY+row*cellH};
  }
  function targetOrbit(i){
    const rings=[.18,.29,.40], ring=i%3, q=Math.floor(i/3);
    const count=Math.ceil(Math.max(1,particles.length/3));
    const a=(q/count)*Math.PI*2 + ring*.62;
    const r=Math.min(hw,hh)*rings[ring];
    return {x:hw*.5+Math.cos(a)*r,y:hh*.5+Math.sin(a)*r};
  }
  function targetEgress(i){
    const lanes=12, lane=i%lanes,row=Math.floor(i/lanes);
    return {x:(.04+lane*(.92/(lanes-1)))*hw,y:hh*(.94-(row%18)/20)};
  }
  function buildSceneTargets(){
    sceneTargets=sceneNames.map(()=>[]);
    particles.forEach((_,i)=>{
      sceneTargets[0][i]=targetScatter(i,0);
      sceneTargets[1][i]=targetIngest(i);
      sceneTargets[2][i]=targetPartition(i);
      sceneTargets[3][i]=targetConstellation(i);
      sceneTargets[4][i]=targetHard(i);
      sceneTargets[5][i]=targetQuery(i);
      sceneTargets[6][i]=targetOrbit(i);
      sceneTargets[7][i]=targetScatter(i,333);
    });
  }
  function resizeHero(){
    dpr=Math.min(2,devicePixelRatio||1);hw=innerWidth;hh=innerHeight;
    hc.width=hw*dpr;hc.height=hh*dpr;hctx.setTransform(dpr,0,0,dpr,0,0);
    const count=RM?80:(hw<720?120:Math.min(320,Math.round(hw/5.5)));
    particles=Array.from({length:count},(_,i)=>{
      const t=targetScatter(i,0);
      return {x:t.x,y:t.y,vx:0,vy:0,r:.65+seed(i*31)*1.5,a:.14+seed(i*47)*.42,kind:i%7};
    });
    buildSceneTargets();
  }
  resizeHero();addEventListener('resize',resizeHero,{passive:true});

  function sceneStops(){
    const system=$('#system'),projects=$('#projects'),hard=$('#hardmode'),lab=$('#lab'),credentials=$('#credentials'),contact=$('#contact');
    return [
      {y:0,s:0},
      {y:Math.max(0,system.offsetTop-innerHeight*.35),s:1},
      {y:system.offsetTop+system.offsetHeight*.54,s:2},
      {y:projects.offsetTop-innerHeight*.28,s:3},
      {y:hard.offsetTop-innerHeight*.28,s:4},
      {y:lab.offsetTop-innerHeight*.28,s:5},
      {y:credentials.offsetTop-innerHeight*.28,s:6},
      {y:contact.offsetTop-innerHeight*.18,s:7}
    ];
  }
  function sceneState(){
    const y=scrollY+innerHeight*.42,st=sceneStops();
    let a=st[0],b=st[st.length-1];
    for(let i=0;i<st.length-1;i++){if(y>=st[i].y&&y<=st[i+1].y){a=st[i];b=st[i+1];break}}
    const raw=clamp((y-a.y)/Math.max(1,b.y-a.y),0,1);
    return {a:a.s,b:b.s,t:smooth(raw)};
  }
  addEventListener('scroll',()=>{
    const dy=scrollY-lastScrollY;lastScrollY=scrollY;
    const force=Math.min(1.8,Math.abs(dy)/70);
    scrollKick=Math.min(2.2,scrollKick+force*.55);
    // Actual displacement makes the data visibly scatter during quick navigation.
    if(force>.08&&!RM){
      for(let n=0;n<Math.min(particles.length,Math.ceil(particles.length*.45));n++){
        const p=particles[(n*13+Math.abs(Math.round(scrollY)))%particles.length];
        p.vx+=(seed(n+scrollY*.01)-.5)*force*8;
        p.vy+=(dy>0?1:-1)*(1+seed(n*5))*force*3.5;
      }
    }
  },{passive:true});

  function drawPipelineGeometry(alpha){
    if(alpha<.02)return;
    hctx.save();hctx.globalAlpha=alpha*.34;hctx.strokeStyle='rgba(73,214,255,.5)';hctx.lineWidth=1;
    const y=hh*.5;hctx.beginPath();hctx.moveTo(hw*.06,y);hctx.lineTo(hw*.94,y);hctx.stroke();
    for(let i=0;i<6;i++){const x=hw*(.07+i*(.86/5));hctx.strokeRect(x-25,y-24,50,48)}hctx.restore();
  }
  function drawPartitionGeometry(alpha){
    if(alpha<.02)return;hctx.save();hctx.globalAlpha=alpha*.28;hctx.strokeStyle='rgba(84,243,173,.48)';hctx.lineWidth=1;
    for(let p=0;p<6;p++){const c=p%3,r=Math.floor(p/3),x=hw*(.12+c*.31),y=hh*(.20+r*.38);hctx.strokeRect(x-hw*.12,y-hh*.13,hw*.24,hh*.26)}hctx.restore();
  }
  function drawQueryGeometry(alpha){
    if(alpha<.02)return;hctx.save();hctx.globalAlpha=alpha*.18;hctx.strokeStyle='rgba(73,214,255,.52)';
    for(let r=0;r<8;r++){const y=hh*(.16+r*.09);hctx.beginPath();hctx.moveTo(hw*.06,y);hctx.lineTo(hw*.94,y);hctx.stroke()}hctx.restore();
  }
  function drawOrbitGeometry(alpha){
    if(alpha<.02)return;hctx.save();hctx.globalAlpha=alpha*.22;hctx.strokeStyle='rgba(255,189,90,.5)';
    [0.18,.29,.40].forEach(r=>{hctx.beginPath();hctx.arc(hw*.5,hh*.5,Math.min(hw,hh)*r,0,Math.PI*2);hctx.stroke()});hctx.restore();
  }
  function drawHero(){
    hctx.clearRect(0,0,hw,hh);
    const state=sceneState(),t=state.t;
    const label=t<.5?sceneNames[state.a]:sceneNames[state.b];
    if(label!==currentSceneName){currentSceneName=label;const read=$('#fpsReadout');if(read)read.textContent=`${label.toLowerCase()} / live`;}
    sceneMix=t;scrollKick*=.91;
    const activeColor=sceneColors[t<.5?state.a:state.b];

    // Background geometry is faint and only appears while the data settles into a structure.
    const wa=1-t,wb=t;
    if(state.a===1)drawPipelineGeometry(wa);if(state.b===1)drawPipelineGeometry(wb);
    if(state.a===2)drawPartitionGeometry(wa);if(state.b===2)drawPartitionGeometry(wb);
    if(state.a===5)drawQueryGeometry(wa);if(state.b===5)drawQueryGeometry(wb);
    if(state.a===6)drawOrbitGeometry(wa);if(state.b===6)drawOrbitGeometry(wb);

    const pointerActive = innerWidth>720;
    for(let i=0;i<particles.length;i++){
      const p=particles[i],A=sceneTargets[state.a][i],B=sceneTargets[state.b][i];
      let tx=lerp(A.x,B.x,t),ty=lerp(A.y,B.y,t);
      // scroll turbulence breaks perfect structure, then spring physics reforms it.
      const turb=scrollKick*18;
      tx+=(seed(i*41+Math.round(scrollY/15))-.5)*turb;
      ty+=(seed(i*53+Math.round(scrollY/13))-.5)*turb;
      if(pointerActive){
        const dx=p.x-mx,dy=p.y-my,d=Math.hypot(dx,dy)||1,rep=Math.max(0,1-d/145);
        tx+=dx/d*rep*34;ty+=dy/d*rep*34;
      }
      p.vx+=(tx-p.x)*.024;p.vy+=(ty-p.y)*.024;p.vx*=.86;p.vy*=.86;p.x+=p.vx;p.y+=p.vy;
      const energy=Math.min(1,Math.hypot(p.vx,p.vy)/8+scrollKick*.2);
      const alpha=p.a*(.52+energy*.65);
      hctx.fillStyle=`rgba(${activeColor},${alpha})`;hctx.strokeStyle=`rgba(${activeColor},${alpha*.72})`;
      const size=p.r*(1+energy*.45);
      if(p.kind===0||p.kind===4){hctx.fillRect(p.x-size*2.1,p.y-size*.55,size*4.2,size*1.1)}
      else if(p.kind===1){hctx.strokeRect(p.x-size*1.7,p.y-size*1.7,size*3.4,size*3.4)}
      else if(p.kind===2){hctx.beginPath();hctx.arc(p.x,p.y,size,0,Math.PI*2);hctx.fill()}
      else if(p.kind===3){hctx.font=`${Math.max(5,5+size*2)}px monospace`;hctx.fillText(i%2?'1':'0',p.x,p.y)}
      else {hctx.beginPath();hctx.moveTo(p.x-size*2,p.y);hctx.lineTo(p.x+size*2,p.y);hctx.stroke()}
    }
    if(!RM)requestAnimationFrame(drawHero);
  }
  requestAnimationFrame(drawHero);

  // telemetry panel
  const tf=$('#telemetryFlow');
  const laneData=[[8,38,78,0],[15,78,67,-11],[4,122,83,5]];
  laneData.forEach(([l,t,w,rot],i)=>{const lane=document.createElement('div');lane.className='flow-lane';lane.style.cssText=`left:${l}%;top:${t}px;width:${w}%;transform:rotate(${rot}deg)`;lane.innerHTML='<i></i>';tf.append(lane)});
  [[12,34],[43,63],[72,32],[84,116]].forEach(([x,y])=>{const n=document.createElement('i');n.className='flow-node';n.style.cssText=`left:${x}%;top:${y}px`;tf.append(n)});
  const logLines=['checkpoint /stream/party_events <span class="ok">healthy</span>','iceberg maintenance / compact <span class="ok">scheduled</span>','governance / tokenization <span class="ok">enforced</span>'];
  $('#telemetryLog').innerHTML=logLines.map(x=>`<div>&gt; ${x}</div>`).join('');

  // sticky system story
  const sys=$('#systemMap');
  const sysStages=[
    {title:'Legacy estate. Real migration risk.',body:'On-premise Hadoop held the customer master-data workload. Migration means preserving continuity, integrity, and recovery—not simply copying files.',tags:['Hadoop','Ab Initio','ETL / ELT'],active:['hadoop']},
    {title:'Hydrate AWS without breaking trust.',body:'The platform moves into AWS storage and resiliency patterns while keeping the cutover governed and recoverable.',tags:['AWS','S3','DR / resiliency'],active:['hadoop','s3','spark']},
    {title:'Change becomes a stream.',body:'Spark Structured Streaming turns customer-change events into low-latency updates and cross-platform synchronization.',tags:['Spark Structured Streaming','PySpark','near-real-time'],active:['spark','resolve','token','quality']},
    {title:'The lakehouse becomes the source of confidence.',body:'Apache Iceberg brings table maintenance, compaction, snapshots, and reproducible reads; Databricks provides AWS-native compute.',tags:['Apache Iceberg','Databricks','compaction'],active:['resolve','token','quality','iceberg','databricks']},
    {title:'Serve it. Govern it. Let others trust it.',body:'Real-time APIs and governed Redshift products feed KYC, AML, onboarding, and regulatory reporting consumers.',tags:['REST APIs','Redshift','KYC / AML'],active:['iceberg','search','detail','redshift','kyc','aml','onboarding','reg']}
  ];
  const pos={hadoop:[5,14],s3:[5,66],spark:[28,39],resolve:[50,12],token:[50,39],quality:[50,66],iceberg:[72,28],databricks:[72,61],search:[87,10],detail:[87,34],redshift:[87,61],kyc:[93,78],aml:[78,84],onboarding:[60,84],reg:[42,84]};
  const labels={hadoop:'on_prem.hadoop',s3:'aws.s3',spark:'spark.streaming',resolve:'entity.resolution',token:'pii.tokenization',quality:'quality.gate',iceberg:'apache.iceberg',databricks:'databricks.aws',search:'party.search.api',detail:'party.detail.api',redshift:'governed.redshift',kyc:'kyc',aml:'aml',onboarding:'onboarding',reg:'reg.reporting'};
  Object.keys(pos).forEach(id=>{const [x,y]=pos[id];const n=document.createElement('div');n.className='sys-node';n.dataset.id=id;n.style.cssText=`left:${x}%;top:${y}%`;n.innerHTML=`<small>${id==='hadoop'||id==='s3'?'source':id==='spark'?'stream':id==='iceberg'||id==='databricks'?'lakehouse':id==='search'||id==='detail'||id==='redshift'?'serve':id==='kyc'||id==='aml'||id==='onboarding'||id==='reg'?'consumer':'process'}</small><b>${labels[id]}</b>`;sys.append(n)});
  const sedges=[['hadoop','spark'],['s3','spark'],['spark','resolve'],['spark','token'],['spark','quality'],['resolve','iceberg'],['token','iceberg'],['quality','iceberg'],['databricks','iceberg'],['iceberg','search'],['iceberg','detail'],['iceberg','redshift'],['search','kyc'],['search','aml'],['detail','onboarding'],['redshift','reg']];
  const edgeEls=[];
  function edgeGeom(){
    edgeEls.forEach(({el,a,b})=>{const A=$(`.sys-node[data-id="${a}"]`,sys),B=$(`.sys-node[data-id="${b}"]`,sys);if(!A||!B)return;const sr=sys.getBoundingClientRect(),ar=A.getBoundingClientRect(),br=B.getBoundingClientRect();const x1=ar.left-sr.left+ar.width/2,y1=ar.top-sr.top+ar.height/2,x2=br.left-sr.left+br.width/2,y2=br.top-sr.top+br.height/2;const dx=x2-x1,dy=y2-y1;el.style.left=x1+'px';el.style.top=y1+'px';el.style.width=Math.hypot(dx,dy)+'px';el.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;});
  }
  sedges.forEach(([a,b])=>{const e=document.createElement('div');e.className='sys-edge';e.innerHTML='<i></i>';sys.prepend(e);edgeEls.push({el:e,a,b})});
  setTimeout(edgeGeom,20);addEventListener('resize',edgeGeom);
  const pills=$('#stagePills');
  sysStages.forEach((s,i)=>{const p=document.createElement('span');p.textContent=`0${i+1} ${['legacy','hydrate','stream','lakehouse','serve'][i]}`;p.onclick=()=>scrollToSystemStep(i);pills.append(p)});
  function scrollToSystemStep(i){const sec=$('#system');const top=sec.offsetTop+(sec.offsetHeight-innerHeight)*(i/(sysStages.length-1));scrollTo({top,behavior:'smooth'})}
  let currentSys=-1;
  function updateSystem(){
    const sec=$('#system');const rect=sec.getBoundingClientRect();const max=sec.offsetHeight-innerHeight;const progress=Math.max(0,Math.min(1,-rect.top/max));const i=Math.min(sysStages.length-1,Math.floor(progress*sysStages.length));if(i===currentSys)return;currentSys=i;const s=sysStages[i];$('#systemTitle').textContent=s.title;$('#systemBody').textContent=s.body;$('#systemStep').textContent=String(i+1).padStart(2,'0');$$('.stage-pills span').forEach((p,j)=>p.classList.toggle('active',j===i));$$('.sys-node',sys).forEach(n=>{const idx=sysStages.findIndex(st=>st.active.includes(n.dataset.id));n.classList.toggle('on',s.active.includes(n.dataset.id));n.classList.toggle('done',idx>=0&&idx<i)});edgeEls.forEach(o=>o.el.classList.toggle('on',s.active.includes(o.a)&&s.active.includes(o.b)));
  }
  addEventListener('scroll',updateSystem,{passive:true});
  addEventListener('resize',updateSystem,{passive:true});
  // Browsers may restore scroll after scripts execute; re-sync state on pageshow and
  // again on the next frames so the visible stage and counter can never disagree.
  addEventListener('pageshow', () => {
    resetInitialScroll();
    requestAnimationFrame(() => { updateSystem(); edgeGeom(); });
    setTimeout(() => { updateSystem(); edgeGeom(); }, 120);
  });
  updateSystem();

  // project constellation
  const stage=$('#projectStage'),dossier=$('#projectDossier');let projectActive=0,dragStart=null;
  const projectColors=['rgba(84,243,173,.16)','rgba(180,156,255,.16)','rgba(255,189,90,.16)','rgba(73,214,255,.16)','rgba(255,114,184,.15)','rgba(110,220,255,.14)'];
  DB.projects.rows.forEach((p,i)=>{const c=document.createElement('div');c.className='project-orbit-card';c.dataset.i=i;c.style.setProperty('--project-glow',projectColors[i]);c.innerHTML=`<span class="num">PROJECT_${String(i+1).padStart(2,'0')}</span><h3>${esc(p.name)}</h3><p>${esc(p.type)}</p><span class="collab">${esc(p.collaboration)}</span>`;c.onclick=()=>{projectActive=i;renderProjects()};stage.append(c)});
  function renderProjects(){
    const cards=$$('.project-orbit-card',stage);const n=cards.length;cards.forEach((c,i)=>{let d=i-projectActive;if(d>n/2)d-=n;if(d<-n/2)d+=n;const abs=Math.abs(d);const x=d*260,y=abs*18,scale=Math.max(.68,1-abs*.11),rot=d*-8,op=Math.max(.16,1-abs*.25),z=10-abs;c.style.transform=`translate3d(${x}px,${y}px,${abs* -60}px) rotateY(${rot}deg) scale(${scale})`;c.style.opacity=op;c.style.zIndex=z;c.classList.toggle('active',d===0)});const p=DB.projects.rows[projectActive];$('#projectIndex').textContent=String(projectActive+1).padStart(2,'0');dossier.innerHTML=`<div><span class="type">${esc(p.type)}</span><h3>${esc(p.name)}</h3><p>${esc(p.what)}</p></div><div><span class="type">ENGINEERING FOCUS</span><p>${esc(p.focus||'System design, evidence, and operational correctness.')}</p><div class="arch-flow">${(p.architecture||[]).map((a,j)=>`${j?'<i>→</i>':''}<span>${esc(a)}</span>`).join('')}</div></div><div><span class="type">STACK / SIGNAL</span><div class="stack-tags">${(p.stack||[]).map(s=>`<span>${esc(s)}</span>`).join('')}</div><p>${esc(p.signal||'')}</p></div>`;
  }
  $('#projectPrev').onclick=()=>{projectActive=(projectActive-1+DB.projects.rows.length)%DB.projects.rows.length;renderProjects()};$('#projectNext').onclick=()=>{projectActive=(projectActive+1)%DB.projects.rows.length;renderProjects()};
  stage.addEventListener('wheel',e=>{e.preventDefault();projectActive=(projectActive+(e.deltaY>0?1:-1)+DB.projects.rows.length)%DB.projects.rows.length;renderProjects()},{passive:false});
  stage.addEventListener('pointerdown',e=>{dragStart=e.clientX;stage.setPointerCapture(e.pointerId)});stage.addEventListener('pointerup',e=>{if(dragStart===null)return;const d=e.clientX-dragStart;if(Math.abs(d)>45){projectActive=(projectActive+(d<0?1:-1)+DB.projects.rows.length)%DB.projects.rows.length;renderProjects()}dragStart=null});renderProjects();

  // HARD MODE — five production data-engineering simulations.
  // These are sandboxes based on documented engineering trade-offs, not incident claims.
  const hardChallenges=[
    {id:'stream',label:'Late Data / Exactly Once',hint:'event time · dedup · checkpoint',brief:'A customer-change stream contains duplicates and records arriving minutes late. Tune the watermark and fault-tolerance controls without dropping too much truth or letting state grow forever.'},
    {id:'schema',label:'Schema Evolution',hint:'contracts · compatibility',brief:'A producer wants to evolve a shared event schema while downstream consumers are still on older versions. Choose the compatibility contract that blocks dangerous changes without freezing delivery.'},
    {id:'entity',label:'Entity Resolution',hint:'fuzzy identity · false merges',brief:'Six customer records contain typos, aliases and conflicting fields. Build canonical identities. A false merge is worse than a missed merge, so similarity alone is not enough.'},
    {id:'iceberg',label:'Lakehouse Maintenance',hint:'small files · snapshots · manifests',brief:'A streaming Iceberg table has accumulated thousands of tiny files and snapshots. Optimize query planning and metadata without destroying rollback safety.'},
    {id:'migration',label:'Zero-Loss Migration',hint:'full load · CDC · reconcile · cutover',brief:'Move a live dataset to a new platform while writes continue. Sequence full load, CDC, validation and cutover so source and target converge before consumers switch.'}
  ];
  let hardActive=0;
  const hardState={stream:{watermark:5,checkpoint:true,idempotent:true},schema:{mode:'BACKWARD'},entity:{selected:new Set(),groups:[]},iceberg:{target:256,retention:7,manifests:true},migration:{step:0,penalty:0}};
  const hardRail=$('#hardRail'),hardSim=$('#hardSim'),hardFeedback=$('#hardFeedback');
  hardChallenges.forEach((c,i)=>{const b=document.createElement('button');b.className='hard-tab';b.innerHTML=`<i>${String(i+1).padStart(2,'0')}</i><div><strong>${esc(c.label)}</strong><span>${esc(c.hint)}</span></div>`;b.onclick=()=>{hardActive=i;renderHard()};hardRail.append(b)});
  const setHardFeedback=(text,tone='')=>{hardFeedback.className='hard-feedback'+(tone?' '+tone:'');hardFeedback.textContent=text};
  const setHardScore=(n)=>{$('#hardScore').textContent=n==null?'--':`${Math.max(0,Math.min(100,Math.round(n)))}/100`};

  function renderHard(){
    const c=hardChallenges[hardActive];$$('.hard-tab',hardRail).forEach((b,i)=>b.classList.toggle('active',i===hardActive));
    $('#hardEyebrow').textContent=`CHALLENGE_${String(hardActive+1).padStart(2,'0')}`;$('#hardTitle').textContent=c.label;$('#hardBrief').textContent=c.brief;setHardScore(null);setHardFeedback('Adjust the system, then run the simulation. The score rewards correctness first, then latency/cost.');
    if(c.id==='stream')renderStreamHard();if(c.id==='schema')renderSchemaHard();if(c.id==='entity')renderEntityHard();if(c.id==='iceberg')renderIcebergHard();if(c.id==='migration')renderMigrationHard();
  }

  // 01 — event-time / exactly-once sandbox
  const streamEvents=Array.from({length:30},(_,i)=>({id:i,minute:i*2,delay:[0,1,2,8,3,12,1,4,0,7,2,14,1,5,3,10,0,2,6,1,9,2,4,0,11,2,1,5,13,3][i],dup:[6,13,21,27].includes(i)}));
  function streamMetrics(){const st=hardState.stream;const included=streamEvents.filter(e=>e.delay<=st.watermark);const dropped=streamEvents.length-included.length;const dups=st.idempotent?0:included.filter(e=>e.dup).length;const replayRisk=st.checkpoint?0:3;const stateMB=Math.round(st.watermark*82+included.length*3.4);let score=100-Math.abs(st.watermark-10)*3-dups*10-replayRisk*10;if(st.watermark<7)score-=dropped*1.2;if(stateMB>1000)score-=(stateMB-1000)/20;return {included,dropped,dups,replayRisk,stateMB,score:Math.max(0,score)}}
  function renderStreamHard(){const st=hardState.stream,m=streamMetrics();hardSim.innerHTML=`<div class="hard-controls"><div class="hard-control"><label>EVENT-TIME WATERMARK <span class="value" id="wmValue">${st.watermark} min</span></label><input id="wmRange" type="range" min="1" max="15" value="${st.watermark}"/></div><div class="hard-control"><span class="ctl-label">CHECKPOINT / WAL</span><div class="hard-toggle"><button id="cpOn" class="${st.checkpoint?'on':''}">enabled</button><button id="cpOff" class="${!st.checkpoint?'on':''}">disabled</button></div></div><div class="hard-control"><span class="ctl-label">IDEMPOTENT SINK / DEDUP</span><div class="hard-toggle"><button id="idOn" class="${st.idempotent?'on':''}">enabled</button><button id="idOff" class="${!st.idempotent?'on':''}">disabled</button></div></div></div><div class="stream-viz" id="streamViz"><div class="stream-axis"></div><div class="stream-watermark" id="wmLine"></div></div><div class="metric-strip"><div><small>accepted events</small><b>${m.included.length}/${streamEvents.length}</b></div><div><small>dropped too late</small><b class="${m.dropped>5?'bad':m.dropped?'warn':'ok'}">${m.dropped}</b></div><div><small>duplicate writes</small><b class="${m.dups?'bad':'ok'}">${m.dups}</b></div><div><small>state footprint</small><b class="${m.stateMB>900?'warn':'ok'}">${m.stateMB} MB</b></div></div><div class="hard-actions"><button class="run" id="streamRun">RUN MICRO-BATCH</button><button id="streamReset">reset</button></div>`;
    const viz=$('#streamViz');streamEvents.forEach((e,i)=>{const d=document.createElement('i');d.className='evt'+(e.delay>st.watermark?' dropped':'')+(e.delay>=7?' late':'')+(e.dup?' dup':'');d.style.left=`${5+(e.minute/58)*90}%`;d.style.top=`${28+(seed(i*31)*58)}%`;d.title=`event ${i} · delay ${e.delay}m${e.dup?' · duplicate':''}`;viz.append(d)});$('#wmLine').style.left=`${10+(st.watermark/15)*78}%`;
    $('#wmRange').oninput=e=>{st.watermark=+e.target.value;renderStreamHard()};$('#cpOn').onclick=()=>{st.checkpoint=true;renderStreamHard()};$('#cpOff').onclick=()=>{st.checkpoint=false;renderStreamHard()};$('#idOn').onclick=()=>{st.idempotent=true;renderStreamHard()};$('#idOff').onclick=()=>{st.idempotent=false;renderStreamHard()};$('#streamReset').onclick=()=>{hardState.stream={watermark:5,checkpoint:true,idempotent:true};renderStreamHard()};$('#streamRun').onclick=()=>{const x=streamMetrics();setHardScore(x.score);const tone=x.score>=90?'good':x.score>=70?'warn':'bad';setHardFeedback(`accepted ${x.included.length}/${streamEvents.length} · dropped ${x.dropped} late · duplicate writes ${x.dups} · replay-risk events ${x.replayRisk} · state ${x.stateMB} MB. ${x.score>=90?'Strong balance: correctness is protected without keeping unbounded event-time state.':'Tune watermark, checkpointing and idempotency. Exactly-once is a system property, not a checkbox.'}`,tone)};
  }

  // 02 — schema compatibility sandbox
  const schemaChanges=[
    {name:'add optional middle_name',detail:'new nullable field',backward:true,full:true},
    {name:'delete required email',detail:'existing consumers still read it',backward:false,full:false},
    {name:'add required risk_tier',detail:'old records have no value/default',backward:false,full:false},
    {name:'add optional country_code',detail:'nullable enrichment field',backward:true,full:true}
  ];
  function schemaVerdicts(mode){return schemaChanges.map(c=>mode==='NONE'?true:(mode==='BACKWARD'?c.backward:c.full))}
  function renderSchemaHard(){const st=hardState.schema,v=schemaVerdicts(st.mode);hardSim.innerHTML=`<div class="schema-grid"><div class="hard-control"><span class="ctl-label">COMPATIBILITY CONTRACT</span><div class="compat-picker">${['NONE','BACKWARD','FULL','DISABLED'].map(m=>`<button class="compat-btn ${st.mode===m?'active':''}" data-mode="${m}">${m}</button>`).join('')}</div><div class="hard-actions"><button class="run" id="schemaRun">VALIDATE RELEASE</button></div></div><div class="schema-events">${schemaChanges.map((c,i)=>`<div class="schema-row"><div><strong>v${i+2} · ${esc(c.name)}</strong><span>${esc(c.detail)}</span></div><em class="${(st.mode==='DISABLED'?false:v[i])?'pass':'fail'}">${st.mode==='DISABLED'?'blocked':v[i]?'compatible':'rejected'}</em></div>`).join('')}</div></div>`;$$('.compat-btn',hardSim).forEach(b=>b.onclick=()=>{st.mode=b.dataset.mode;renderSchemaHard()});$('#schemaRun').onclick=()=>{let score=st.mode==='BACKWARD'?100:st.mode==='FULL'?96:st.mode==='DISABLED'?42:28;setHardScore(score);setHardFeedback(st.mode==='BACKWARD'?'Backward compatibility allows safe optional evolution while rejecting breaking deletions/required additions. This is the strongest default for this simulated consumer pattern.':st.mode==='FULL'?'Full compatibility is very safe here, but stricter than necessary for this producer/consumer rollout.':st.mode==='DISABLED'?'Versioning is frozen. Safe from change, but delivery is also frozen.':'NONE accepts every change—including ones that break older consumers. Fast deployment, weak contract.',score>=90?'good':score>=60?'warn':'bad')};}

  // 03 — entity resolution sandbox
  const entityRecords=[
    {id:'A1',name:'Kamlendu Kumar',email:'kamlendu.kumar@example.com',phone:'+91 62033 20570'},
    {id:'A2',name:'Kamalendu Kumar',email:'kamlendu.kumar@example.com',phone:'6203320570'},
    {id:'B1',name:'Akansh Mowar',email:'akansh.m@example.com',phone:'+91 98XX 441210'},
    {id:'B2',name:'A. Mowar',email:'akansh.m@example.com',phone:'98XX441210'},
    {id:'C1',name:'Kamal Kumar',email:'kamal.k@example.com',phone:'+91 62033 20571'},
    {id:'D1',name:'Akash Mehra',email:'akash.m@example.com',phone:'+91 98XX 441211'}
  ];
  function renderEntityHard(){const st=hardState.entity;hardSim.innerHTML=`<div class="entity-board">${entityRecords.map((r,i)=>`<button class="entity-card ${st.selected.has(i)?'selected':''} ${st.groups.some(g=>g.includes(i))?'merged':''}" data-i="${i}"><b>${r.id}</b><strong>${esc(r.name)}</strong><span>${esc(r.email)}<br>${esc(r.phone)}</span></button>`).join('')}</div><div class="entity-groups">${st.groups.map((g,i)=>`<span class="entity-group">ENTITY_${i+1}: ${g.map(x=>entityRecords[x].id).join(' + ')}</span>`).join('')||'<span class="entity-group" style="opacity:.35">no canonical groups yet</span>'}</div><div class="hard-actions"><button class="run" id="mergeEntity">MERGE SELECTED</button><button id="verifyEntity">VERIFY RESOLUTION</button><button id="resetEntity">reset</button></div>`;$$('.entity-card',hardSim).forEach(b=>b.onclick=()=>{const i=+b.dataset.i;if(st.selected.has(i))st.selected.delete(i);else st.selected.add(i);renderEntityHard()});$('#mergeEntity').onclick=()=>{const g=[...st.selected];if(g.length<2){setHardFeedback('Select at least two records to form a canonical entity.','warn');return}st.groups.push(g);st.selected.clear();renderEntityHard()};$('#resetEntity').onclick=()=>{hardState.entity={selected:new Set(),groups:[]};renderEntityHard()};$('#verifyEntity').onclick=()=>{const norm=st.groups.map(g=>[...g].sort((a,b)=>a-b).join(',')).sort();const correct=['0,1','2,3'];const falseMerge=st.groups.some(g=>g.some(x=>[4,5].includes(x))||g.length>2);let hits=correct.filter(x=>norm.includes(x)).length;let score=hits*45+(falseMerge?0:10)- (falseMerge?35:0);score=Math.max(0,score);setHardScore(score);setHardFeedback(score===100?'Correct: A1/A2 and B1/B2 collapse; C1 and D1 remain distinct. Shared identity evidence beats name similarity alone.':falseMerge?'False merge detected. In master data, collapsing two real people can be more damaging than leaving a duplicate unresolved.':'You found part of the canonical graph. Use multiple fields—email/phone plus name—not fuzzy name similarity alone.',score===100?'good':score>=55?'warn':'bad')};}

  // 04 — Iceberg maintenance sandbox
  const fileSizes=[8,12,18,22,31,44,56,9,14,17,26,35,41,63,72,15,19,28,37,48,61,7,11,16,24,33,45,58,76,92,124,166,210,248,305,366,422,498,534,610];
  function icebergMetrics(){const st=hardState.iceberg,total=fileSizes.reduce((a,b)=>a+b,0),after=Math.ceil(total/st.target),small=fileSizes.filter(x=>x<64).length,snapshots=st.retention*48;let score=100;if(st.target===128)score-=12;if(st.target===512)score-=4;if(st.retention<3)score-=35;else if(st.retention<7)score-=10;if(!st.manifests)score-=15;return {total,after,small,snapshots,score}}
  function renderIcebergHard(){const st=hardState.iceberg,m=icebergMetrics();hardSim.innerHTML=`<div class="hard-controls"><div class="hard-control"><label>COMPACTION TARGET <span class="value">${st.target} MB</span></label><input id="targetRange" type="range" min="128" max="512" step="128" value="${st.target}"></div><div class="hard-control"><label>SNAPSHOT RETENTION <span class="value">${st.retention} days</span></label><input id="retentionRange" type="range" min="1" max="30" value="${st.retention}"></div><div class="hard-control"><span class="ctl-label">REWRITE MANIFESTS</span><div class="hard-toggle"><button id="manOn" class="${st.manifests?'on':''}">enabled</button><button id="manOff" class="${!st.manifests?'on':''}">disabled</button></div></div></div><div class="file-viz" id="fileViz"><div class="file-target" data-label="target ${st.target} MB"></div>${fileSizes.map(x=>`<i class="file-bar ${x<64?'small':x>st.target*.7?'good':''}" style="height:${Math.max(3,Math.min(100,x/6.4))}%" title="${x} MB"></i>`).join('')}</div><div class="metric-strip"><div><small>input files</small><b>${fileSizes.length}</b></div><div><small>small files &lt;64MB</small><b class="bad">${m.small}</b></div><div><small>after compaction</small><b class="ok">~${m.after}</b></div><div><small>retained snapshots</small><b class="${st.retention<3?'bad':'ok'}">~${m.snapshots}</b></div></div><div class="hard-actions"><button class="run" id="iceRun">PLAN MAINTENANCE</button><button id="iceReset">reset</button></div>`;$('#fileViz .file-target').style.bottom=`${Math.min(88,st.target/6.4)}%`;$('#targetRange').oninput=e=>{st.target=+e.target.value;renderIcebergHard()};$('#retentionRange').oninput=e=>{st.retention=+e.target.value;renderIcebergHard()};$('#manOn').onclick=()=>{st.manifests=true;renderIcebergHard()};$('#manOff').onclick=()=>{st.manifests=false;renderIcebergHard()};$('#iceReset').onclick=()=>{hardState.iceberg={target:256,retention:7,manifests:true};renderIcebergHard()};$('#iceRun').onclick=()=>{const x=icebergMetrics();setHardScore(x.score);setHardFeedback(`~${x.small} small files collapse toward ~${x.after} larger data files. Snapshot retention is ${st.retention}d and manifest rewrite is ${st.manifests?'enabled':'disabled'}. ${x.score>=90?'Good balance: fewer file opens/metadata while preserving rollback history.':st.retention<3?'Retention is dangerously short for rollback/time-travel in this scenario.':'The table will work, but metadata/query planning remains unnecessarily expensive.'}`,x.score>=90?'good':x.score>=65?'warn':'bad')};}

  // 05 — migration cutover sequencing sandbox
  const migrationSteps=[
    {k:'full',label:'run full load'},{k:'cdc',label:'start CDC'},{k:'validate',label:'validate source ↔ target'},{k:'lag',label:'wait CDC lag ≈ 0'},{k:'freeze',label:'freeze source writes'},{k:'final',label:'final reconcile / hash'},{k:'cutover',label:'cut over consumers'}
  ];
  function migrationStats(step){const rows=['18.4M','18.4M','18.4M','18.4M','18.4M','18.4M','18.4M'];const target=['0','18.2M','18.35M','18.35M','18.40M','18.40M','18.40M','18.40M'];const lag=['n/a','n/a','42s','42s','0.4s','0s','0s','0s'];const mismatch=['n/a','n/a','pending','128','128','128','0','0'];return {source:rows[Math.min(step,6)],target:target[Math.min(step,7)],lag:lag[Math.min(step,7)],mismatch:mismatch[Math.min(step,7)]}}
  function renderMigrationHard(){const st=hardState.migration,m=migrationStats(st.step);hardSim.innerHTML=`<div class="migration-viz"><div class="migration-db"><small>SOURCE / LEGACY</small><h4>party_master</h4><div class="db-stat"><span>rows</span><b>${m.source}</b></div><div class="db-stat"><span>writes</span><b>${st.step>=5?'FROZEN':'LIVE'}</b></div></div><div class="migration-link">CDC<i></i><span>lag ${m.lag}</span></div><div class="migration-db"><small>TARGET / CLOUD</small><h4>party_lakehouse</h4><div class="db-stat"><span>rows</span><b>${m.target}</b></div><div class="db-stat"><span>mismatch</span><b>${m.mismatch}</b></div></div></div><div class="migration-actions">${migrationSteps.map((x,i)=>`<button class="migration-action ${i<st.step?'done':''}" data-step="${i}" ${i<st.step?'disabled':''}>${String(i+1).padStart(2,'0')} · ${x.label}</button>`).join('')}</div><div class="hard-actions"><button id="migrationReset">reset cutover</button></div>`;$$('.migration-action',hardSim).forEach(b=>b.onclick=()=>{const i=+b.dataset.step;if(i===st.step){st.step++;renderMigrationHard();if(st.step===migrationSteps.length){const score=Math.max(0,100-st.penalty);setHardScore(score);setHardFeedback('Cutover complete: full load → CDC → validation → lag drain → write freeze → final reconciliation → consumer switch. Source and target converge before traffic moves.',score>=90?'good':'warn')}else setHardFeedback(`Step ${String(st.step).padStart(2,'0')} committed. Continue only when the evidence for this gate is green.`,'good')}else{st.penalty+=12;b.classList.add('wrong');setHardScore(Math.max(0,100-st.penalty));setHardFeedback(`Unsafe sequence. “${migrationSteps[i].label}” is not the next gate. Migration correctness depends on ordering and evidence, not just copying rows.`,'bad')}});$('#migrationReset').onclick=()=>{hardState.migration={step:0,penalty:0};renderMigrationHard()};}

  renderHard();

  // pipeline builder game
  const answer=['S3 landing','Spark streaming','Entity + tokenization','Apache Iceberg','Party APIs'];
  const pool=['Party APIs','Apache Iceberg','S3 landing','Entity + tokenization','Spark streaming'];
  let selected=[];const slotBox=$('#pipelineSlots'),partBox=$('#pipelineParts');
  function renderPipeline(){
    slotBox.innerHTML=answer.map((_,i)=>`<button class="pipeline-slot ${selected[i]?'filled':''}" data-slot="${i}">${selected[i]?esc(selected[i]):`stage ${i+1}`}</button>`).join('');partBox.innerHTML=pool.map(p=>`<button class="pipeline-part ${selected.includes(p)?'used':''}" data-part="${esc(p)}">${esc(p)}</button>`).join('');
    $$('.pipeline-part',partBox).forEach(b=>b.onclick=()=>{const free=selected.length; if(free<answer.length){selected.push(b.dataset.part);renderPipeline();if(selected.length===answer.length)gradePipeline();}});$$('.pipeline-slot',slotBox).forEach(b=>b.onclick=()=>{const i=+b.dataset.slot;if(selected[i]){selected.splice(i,1);renderPipeline()}});
  }
  function gradePipeline(){let score=0;$$('.pipeline-slot',slotBox).forEach((b,i)=>{const ok=selected[i]===answer[i];b.classList.add(ok?'correct':'wrong');if(ok)score+=20});$('#pipelineScore').textContent=`${score} pts`;const sim=$('#pipelineSim');if(score===100){sim.className='pipeline-sim running success';sim.querySelector('span').textContent='architecture valid · packets flowing · governance preserved'}else{sim.className='pipeline-sim';sim.querySelector('span').textContent=`${score}/100 · click a stage to remove it and try again`}}
  $('#pipelineReset').onclick=()=>{selected=[];$('#pipelineScore').textContent='0 pts';$('#pipelineSim').className='pipeline-sim';$('#pipelineSim span').textContent='waiting for architecture…';renderPipeline()};$('#pipelineHint').onclick=()=>{const next=answer[selected.length];$('#pipelineSim span').textContent=`hint → stage ${selected.length+1} should be ${next}`};renderPipeline();

  // SQL console
  const sx=$('#sqlExamples');EXAMPLE_QUERIES.slice(0,5).forEach(q=>{const b=document.createElement('button');b.textContent=q.label;b.onclick=()=>{$('#sqlInput').value=q.sql;runSql()};sx.append(b)});
  function runSql(){const res=runQuery($('#sqlInput').value);$('#queryState').textContent=res.type==='error'?'syntax error':res.ms!=null?`${res.ms} ms`:'read only';const out=$('#sqlOutput');if(res.type==='table'){const cols=res.columns.map(c=>c.name);out.innerHTML=`<table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${res.rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(Array.isArray(r[c])?r[c].join(' · '):(r[c]??'NULL'))}</td>`).join('')}</tr>`).join('')}</tbody></table>`}else if(res.type==='error'){out.innerHTML=`<div class="err">ERROR → ${esc(res.text)}</div>`}else{out.innerHTML=`<div class="plan">${esc(res.text||'')}</div>`}}
  $('#sqlRun').onclick=runSql;$('#sqlInput').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')runSql()});runSql();

  // skill orbit canvas
  const sc=$('#skillCanvas'),sctx=sc.getContext('2d');const skillRows=DB.skills.rows;let sw=0,sh=0,sdpr=1,st=0;
  const skillColors={'Streaming & Processing':'#49d6ff','Lakehouse & Warehousing':'#54f3ad','AWS':'#ffbd5a','Pipelines & Migration':'#ff72b8','Governance & Interfaces':'#b49cff','Languages':'#9db0ff'};
  function resizeSkill(){const r=sc.parentElement.getBoundingClientRect();sw=r.width;sh=r.height;sdpr=Math.min(2,devicePixelRatio||1);sc.width=sw*sdpr;sc.height=sh*sdpr;sctx.setTransform(sdpr,0,0,sdpr,0,0)}resizeSkill();addEventListener('resize',resizeSkill);
  function drawSkills(){sctx.clearRect(0,0,sw,sh);st+=RM?0:.0025;const cx=sw/2,cy=sh/2;skillRows.forEach((s,i)=>{const ring=i%3;const count=[9,9,9][ring];const base=Math.floor(i/3);const radius=Math.min(sw,sh)*([.29,.39,.47][ring]);const a=(i/skillRows.length)*Math.PI*2+st*(ring%2?-.8:1)+(ring*.7);const x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;const text=s.skill;const w=Math.min(140,26+text.length*5.8);sctx.strokeStyle=(skillColors[s.category]||'#49d6ff')+'55';sctx.fillStyle='rgba(4,10,16,.9)';sctx.lineWidth=1;sctx.fillRect(x-w/2,y-11,w,22);sctx.strokeRect(x-w/2,y-11,w,22);sctx.fillStyle=(skillColors[s.category]||'#49d6ff');sctx.font='700 7px monospace';sctx.textAlign='center';sctx.fillText(text.length>20?text.slice(0,19)+'…':text,x,y+2.5)});if (!RM) requestAnimationFrame(drawSkills)}requestAnimationFrame(drawSkills);

  // credential ledger
  $('#certLedger').innerHTML=DB.certifications.rows.map((c,i)=>`<div class="cert-row"><i>${String(i+1).padStart(2,'0')}</i><div><strong>${esc(c.name)}</strong><span>${esc(c.issuer)}</span></div><em class="${c.status==='in progress'?'wip':''}">${esc(c.status)}</em></div>`).join('');

  // command palette
  const cmd=$('#command'),ci=$('#commandInput'),cr=$('#commandResults');let cmdSel=0;
  const cmdItems=[
    {t:'Live system',d:'architecture story',id:'system'},{t:'Project constellation',d:'6 collaborative builds',id:'projects'},{t:'Hard Mode',d:'5 production data simulations',id:'hardmode'},{t:'Data Engineer Lab',d:'pipeline + SQL',id:'lab'},{t:'Skill orbit',d:'stack + credentials',id:'credentials'},{t:'Contact Kamlendu',d:'email + résumé',id:'contact'},
    ...DB.projects.rows.map((p,i)=>({t:p.name,d:p.type,project:i,id:'projects'})),...DB.skills.rows.slice(0,20).map(s=>({t:s.skill,d:s.category,id:'credentials'}))
  ];
  function cmdOpen(v=true){cmd.classList.toggle('open',v);cmd.setAttribute('aria-hidden',String(!v));if(v){ci.value='';cmdSel=0;cmdRender();setTimeout(()=>ci.focus(),20)}}
  function cmdRender(){const q=ci.value.toLowerCase();const hits=cmdItems.filter(x=>(x.t+' '+x.d).toLowerCase().includes(q)).slice(0,10);cr.innerHTML=hits.map((x,i)=>`<button class="cmd-item ${i===cmdSel?'active':''}" data-i="${i}"><strong>${esc(x.t)}</strong><span>${esc(x.d)}</span></button>`).join('');$$('.cmd-item',cr).forEach((b,i)=>b.onclick=()=>cmdGo(hits[i]));cr._hits=hits}
  function cmdGo(x){if(!x)return;cmdOpen(false);document.getElementById(x.id)?.scrollIntoView({behavior:'smooth'});if(x.project!=null){projectActive=x.project;renderProjects()}}
  $('#cmdBtn').onclick=()=>cmdOpen(true);ci.addEventListener('input',()=>{cmdSel=0;cmdRender()});cmd.addEventListener('click',e=>{if(e.target===cmd)cmdOpen(false)});addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();cmdOpen(!cmd.classList.contains('open'))}if(e.key==='Escape')cmdOpen(false);if(cmd.classList.contains('open')){const h=cr._hits||[];if(e.key==='ArrowDown'){e.preventDefault();cmdSel=Math.min(h.length-1,cmdSel+1);cmdRender()}if(e.key==='ArrowUp'){e.preventDefault();cmdSel=Math.max(0,cmdSel-1);cmdRender()}if(e.key==='Enter'){e.preventDefault();cmdGo(h[cmdSel])}}});
})();
