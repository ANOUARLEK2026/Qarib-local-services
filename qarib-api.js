/* Qarib data layer. Live mode needs config.js keys; otherwise the app stays in demo mode. */
(function(){
var C=window.QARIB_CONFIG||{};
var Q=window.Q={on:!!(C.SUPABASE_URL&&C.SUPABASE_ANON_KEY&&window.supabase),user:null,sb:null,pos:null,map:{}};
var X={
en:{si:"Sign in to continue",em:"Email",sc:"Send code",cd:"Code from your email",vf:"Verify",er:"Something went wrong. Try again.",out:"Sign out",del:"Delete my account and data",dq:"Delete your account permanently?",pend:"Submitted. Your profile appears after approval.",demo:"Demo mode: add your Supabase keys in config.js to go live."},
fr:{si:"Connectez-vous pour continuer",em:"E-mail",sc:"Envoyer le code",cd:"Code reçu par e-mail",vf:"Vérifier",er:"Une erreur est survenue. Réessayez.",out:"Se déconnecter",del:"Supprimer mon compte et mes données",dq:"Supprimer définitivement votre compte ?",pend:"Envoyé. Votre profil apparaîtra après validation.",demo:"Mode démo : ajoutez vos clés Supabase dans config.js."},
ar:{si:"سجّل الدخول للمتابعة",em:"البريد الإلكتروني",sc:"أرسل الرمز",cd:"الرمز من بريدك",vf:"تحقق",er:"حدث خطأ. حاول مرة أخرى.",out:"تسجيل الخروج",del:"حذف حسابي وبياناتي",dq:"حذف حسابك نهائيًا؟",pend:"تم الإرسال. سيظهر ملفك بعد الموافقة.",demo:"وضع تجريبي: أضف مفاتيح Supabase في config.js."}};
function x(k){return X[S.lang][k]}Q.x=x;
function nid(u){return parseInt(u.slice(0,8),16)}
function err(e){console.error(e);toast(x("er"))}
function g(f){return function(){if(Q.on&&Q.user)return f.apply(null,arguments)}}
function mp(r){var id=nid(r.id);Q.map[id]=r.id;
 return{id:id,uid:r.id,name:r.name,cat:r.category,price:r.base_price,yrs:r.years,km:r.distance_km==null?99:r.distance_km,av:r.available?1:0,ph:r.phone,ver:r.verified,jobs:0,st:r.status,
  r:Array.from({length:r.rating_count||0},function(){return{s:+r.rating_avg,c:""}})}}
function ev(p,k){Q.sb.from("provider_events").insert({provider_id:p.uid,kind:k}).then(function(){})}

Q.load=function(cb){
 function done(rows){S.data=rows.map(mp);cb()}
 function fb(){Q.sb.from("providers").select("*").eq("status","approved").limit(100).then(function(r){done(r.data||[])})}
 if(!navigator.geolocation)return fb();
 navigator.geolocation.getCurrentPosition(function(p){
  Q.pos={lat:p.coords.latitude,lng:p.coords.longitude};
  Q.sb.rpc("nearby_providers",{p_lat:Q.pos.lat,p_lng:Q.pos.lng,p_max_km:150,p_limit:100}).then(function(r){r.error?fb():done(r.data||[])})},fb,{timeout:5000,maximumAge:600000})};

Q.mine=function(cb){
 if(!Q.user)return cb();
 var u=Q.user.id,sb=Q.sb;
 Promise.all([sb.from("providers").select("*").eq("user_id",u).maybeSingle(),sb.from("contacts").select("provider_id").eq("user_id",u),sb.from("bookings").select("*").eq("user_id",u).order("created_at")]).then(function(a){
  var me=a[0].data;
  if(me){var p=mp(me);if(!S.data.some(function(z){return z.id==p.id}))S.data.push(p);S.me=p.id;
   [["view","vw"],["contact","ct"]].forEach(function(k){sb.from("provider_events").select("id",{count:"exact",head:true}).eq("provider_id",me.id).eq("kind",k[0]).then(function(r){p[k[1]]=r.count||0})})}
  S.contacted=(a[1].data||[]).map(function(c){return nid(c.provider_id)});
  S.bk=(a[2].data||[]).map(function(b){Q.map[nid(b.provider_id)]=b.provider_id;var d=new Date(b.starts_at);return{id:b.id,uid:b.id,p:nid(b.provider_id),d:b.starts_at.slice(0,10),h:("0"+d.getHours()).slice(-2)+":00",n:b.note||"",st:b.status}});
  cb()})};

Q.init=function(cb){
 if(!Q.on){var n=document.getElementById("note");if(n)n.insertAdjacentHTML("afterend",'<p class="note">⚠ '+x("demo")+'</p>');return cb()}
 Q.sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 S.data=[];S.bk=[];S.contacted=[];S.me=null;
 Q.sb.auth.getSession().then(function(r){Q.user=r.data.session&&r.data.session.user;Q.load(function(){Q.mine(cb)})})};

function login(fn){
 openSheet('<h2>'+x("si")+'</h2><div class="field"><label>'+x("em")+'</label><input id="qe" type="email" autocomplete="email"></div><button class="wa" id="qs">'+x("sc")+'</button><div id="qv"></div>');
 $("qs").onclick=function(){var e=$("qe").value.trim();if(!e)return;
  Q.sb.auth.signInWithOtp({email:e}).then(function(r){if(r.error)return err(r.error);
   $("qv").innerHTML='<div class="field"><label>'+x("cd")+'</label><input id="qc" inputmode="numeric" maxlength="8"></div><button class="wa" id="qk">'+x("vf")+'</button>';
   $("qk").onclick=function(){Q.sb.auth.verifyOtp({email:e,token:$("qc").value.trim(),type:"email"}).then(function(v){
    if(v.error)return err(v.error);Q.user=v.data.user;closeSheet();Q.mine(function(){shell();if(fn)fn()})})}})}}
Q.need=function(fn){if(!Q.on||Q.user)return fn();login(fn)};

Q.contact=g(function(p){Q.sb.from("contacts").upsert({user_id:Q.user.id,provider_id:p.uid},{onConflict:"user_id,provider_id",ignoreDuplicates:true}).then(function(r){if(!r.error&&S.contacted.indexOf(p.id)<0)S.contacted.push(p.id);ev(p,"contact")})});
Q.rev=function(p){if(!Q.on||p._rl||!p.uid)return;p._rl=1;ev(p,"view");
 Q.sb.from("reviews").select("*").eq("provider_id",p.uid).order("created_at").then(function(r){if(r.error)return;
  p.r=r.data.map(function(z){return{s:z.rating,c:z.comment||"",re:z.reply||"",rid:z.id}});
  if($("sheet").classList.contains("on"))profile(p.id);list()})};
Q.review=g(function(p,s,c){Q.sb.from("reviews").insert({provider_id:p.uid,user_id:Q.user.id,rating:s,comment:c}).then(function(r){if(r.error)err(r.error);p._rl=0;Q.rev(p)})});
Q.join=function(o){Q.need(function(){
 function go(la,ln){o.user_id=Q.user.id;o.lat=la;o.lng=ln;
  Q.sb.from("providers").insert(o).select().single().then(function(r){if(r.error)return err(r.error);var p=mp(r.data);S.data.push(p);S.me=p.id;closeSheet();toast(x("pend"));shell()})}
 if(Q.pos)go(Q.pos.lat,Q.pos.lng);else navigator.geolocation.getCurrentPosition(function(p){Q.pos={lat:p.coords.latitude,lng:p.coords.longitude};go(Q.pos.lat,Q.pos.lng)},function(){go(null,null)},{timeout:6000})})};
Q.book=g(function(p,b){Q.sb.from("bookings").insert({user_id:Q.user.id,provider_id:p.uid,starts_at:new Date(b.d+"T"+b.h+":00").toISOString(),note:b.n}).select().single().then(function(r){if(r.error)err(r.error);else b.uid=r.data.id})});
Q.bdel=g(function(id){S.bk.forEach(function(b){if(b.id==id&&b.uid)Q.sb.from("bookings").delete().eq("id",b.uid).then(function(){})})});
Q.bst=g(function(b,st){if(b.uid)Q.sb.from("bookings").update({status:st}).eq("id",b.uid).then(function(){})});
Q.req=g(function(c,d,b,u){Q.sb.from("requests").insert({user_id:Q.user.id,category:c,description:d,budget:b,urgency:u}).then(function(){})});
Q.upd=g(function(p,o){if(p.uid)Q.sb.from("providers").update(o).eq("id",p.uid).then(function(r){if(r.error)err(r.error)})});
Q.reply=g(function(r,v){if(r.rid)Q.sb.from("reviews").update({reply:v}).eq("id",r.rid).then(function(z){if(z.error)err(z.error)})});
Q.report=function(p){Q.need(function(){if(Q.on)Q.sb.from("reports").insert({reporter_id:Q.user.id,provider_id:p.uid}).then(function(){})})};

document.addEventListener("click",function(e){var d=e.target.closest("[data-act=out],[data-act=del],[data-act=in]");if(!d||!Q.on)return;
 if(d.dataset.act=="in")Q.need(function(){shell()});
 else if(d.dataset.act=="out")Q.sb.auth.signOut().then(function(){location.reload()});
 else if(confirm(x("dq")))Q.sb.rpc("delete_my_account").then(function(){return Q.sb.auth.signOut()}).then(function(){location.reload()})});
})();
