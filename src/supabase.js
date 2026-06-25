export const SUPABASE_URL = 'https://pmnqnqvvudslifaxzemt.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtbnFucXZ2dWRzbGlmYXh6ZW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDIwMDksImV4cCI6MjA5NzkxODAwOX0.o870ExdfTSotDXA94s-l7-8IHnBnGBO6O-HaR00t1EM';

const H = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Prefer': 'return=representation',
};

const api = async (method, table, body=null, query='') => {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { const e = await res.text(); throw new Error(`${table}: ${e}`); }
  const t = await res.text(); return t ? JSON.parse(t) : [];
};

// ─── MAPPERS ─────────────────────────────────────────────────
const cEvent = e => ({ id:e.id, name:e.name, date:e.date, venue:e.venue, promoterName:e.promoter_name, promoterPhone:e.promoter_phone, ticketPrice:Number(e.ticket_price||0), totalTickets:e.total_tickets, commissionRate:Number(e.commission_rate||0.10), status:e.status, amountPaidToPromoter:Number(e.amount_paid_to_promoter||0), createdAt:e.created_at });
const sEvent = e => ({ ...(e.name&&{name:e.name}), ...(e.date&&{date:e.date}), ...(e.venue&&{venue:e.venue}), ...(e.promoterName!==undefined&&{promoter_name:e.promoterName}), ...(e.promoterPhone!==undefined&&{promoter_phone:e.promoterPhone}), ...(e.ticketPrice!==undefined&&{ticket_price:e.ticketPrice}), ...(e.totalTickets!==undefined&&{total_tickets:e.totalTickets}), ...(e.commissionRate!==undefined&&{commission_rate:e.commissionRate}), ...(e.status&&{status:e.status}), ...(e.amountPaidToPromoter!==undefined&&{amount_paid_to_promoter:e.amountPaidToPromoter}) });
const cCoord = c => ({ id:c.id, coordinatorId:c.coordinator_id, name:c.name, phone:c.phone, email:c.email, password:c.password, commissionRate:Number(c.commission_rate||0), status:c.status, mustChangePassword:c.must_change_password });
const sCoord = c => ({ ...(c.coordinatorId&&{coordinator_id:c.coordinatorId}), ...(c.name&&{name:c.name}), ...(c.phone!==undefined&&{phone:c.phone}), ...(c.email&&{email:c.email}), ...(c.password&&{password:c.password}), ...(c.commissionRate!==undefined&&{commission_rate:c.commissionRate}), ...(c.status&&{status:c.status}), ...(c.mustChangePassword!==undefined&&{must_change_password:c.mustChangePassword}) });
const cRep = r => ({ id:r.id, repId:r.rep_id, name:r.name, phone:r.phone, email:r.email, password:r.password, university:r.university, residentCommuter:r.resident_commuter, address:r.address, ceId:r.ce_id, status:r.status, mustChangePassword:r.must_change_password });
const sRep = r => ({ ...(r.repId&&{rep_id:r.repId}), ...(r.name&&{name:r.name}), ...(r.phone!==undefined&&{phone:r.phone}), ...(r.email&&{email:r.email}), ...(r.password&&{password:r.password}), ...(r.university!==undefined&&{university:r.university}), ...(r.residentCommuter!==undefined&&{resident_commuter:r.residentCommuter}), ...(r.address!==undefined&&{address:r.address}), ...(r.ceId!==undefined&&{ce_id:r.ceId}), ...(r.status&&{status:r.status}), ...(r.mustChangePassword!==undefined&&{must_change_password:r.mustChangePassword}) });
const cInv = i => ({ id:i.id, repId:i.rep_id, repName:i.rep_name, eventId:i.event_id, eventName:i.event_name, ticketsAllocated:i.tickets_allocated, ticketsSold:i.tickets_sold, ticketsRemaining:i.tickets_allocated-i.tickets_sold, ticketsReturned:i.tickets_returned||0, cashCollected:Number(i.cash_collected||0), confirmed:i.confirmed, confirmedAt:i.confirmed_at, status:i.status });
const cSale = s => ({ id:s.id, repId:s.rep_id, repName:s.rep_name, eventId:s.event_id, eventName:s.event_name, quantitySold:s.quantity_sold, ticketPrice:Number(s.ticket_price||0), totalValue:Number(s.total_value||0), paymentMethod:s.payment_method, dateSold:s.date_sold, weekNumber:s.week_number, customerName:s.customer_name, customerPhone:s.customer_phone, customerEmail:s.customer_email });
const cCE = c => ({ id:c.id, repId:c.rep_id, repName:c.rep_name, eventId:c.event_id, eventName:c.event_name, pointsPerTicket:c.points_per_ticket, ticketsSold:c.tickets_sold, pointsEarned:c.points_earned, status:c.status, paidAt:c.paid_at, paidBy:c.paid_by, ceId:c.ce_id });
const cCC = c => ({ id:c.id, coordinatorId:c.coordinator_id, coordinatorName:c.coordinator_name, eventId:c.event_id, eventName:c.event_name, commissionRate:Number(c.commission_rate||0), revenueBase:Number(c.revenue_base||0), amountDue:Number(c.amount_due||0), status:c.status, paidAt:c.paid_at, paidBy:c.paid_by });
const cReturn = r => ({ id:r.id, repId:r.rep_id, repName:r.rep_name, eventId:r.event_id, coordinatorId:r.coordinator_id, ticketsReturned:r.tickets_returned, returnedAt:r.returned_at, notes:r.notes, reassignedToRepId:r.reassigned_to_rep_id });

// ─── EVENTS ──────────────────────────────────────────────────
export const eventsDB = {
  getAll: async () => (await api('GET','ct_events',null,'?order=date.desc')).map(cEvent),
  getById: async id => { const r=await api('GET','ct_events',null,`?id=eq.${id}`); return r[0]?cEvent(r[0]):null; },
  getActive: async () => (await api('GET','ct_events',null,'?status=neq.Closed&order=date.asc')).map(cEvent),
  create: async data => { const r=await api('POST','ct_events',sEvent(data)); return r[0]?cEvent(r[0]):null; },
  update: async (id,data) => { const r=await api('PATCH','ct_events',sEvent(data),`?id=eq.${id}`); return r[0]?cEvent(r[0]):null; },
  closeOut: async (id,amountPaid) => {
    const r=await api('PATCH','ct_events',{status:'Closed',amount_paid_to_promoter:amountPaid},`?id=eq.${id}`);
    // Mark all coordinator commissions as Due
    await api('PATCH','ct_coordinator_commissions',{status:'Due'},{},`?event_id=eq.${id}&status=eq.Pending`);
    return r[0]?cEvent(r[0]):null;
  },
};

// ─── COORDINATORS ─────────────────────────────────────────────
export const coordinatorsDB = {
  getAll: async () => (await api('GET','ct_coordinators',null,'?order=name.asc')).map(cCoord),
  getById: async id => { const r=await api('GET','ct_coordinators',null,`?id=eq.${id}`); return r[0]?cCoord(r[0]):null; },
  getByCoordinatorId: async cid => { const r=await api('GET','ct_coordinators',null,`?coordinator_id=eq.${cid}`); return r[0]?cCoord(r[0]):null; },
  create: async data => { const r=await api('POST','ct_coordinators',sCoord(data)); return r[0]?cCoord(r[0]):null; },
  update: async (id,data) => { const r=await api('PATCH','ct_coordinators',sCoord(data),`?id=eq.${id}`); return r[0]?cCoord(r[0]):null; },
  delete: async id => api('DELETE','ct_coordinators',null,`?id=eq.${id}`),
  changePassword: async (id,pw) => { const r=await api('PATCH','ct_coordinators',{password:pw,must_change_password:false},`?id=eq.${id}`); return r[0]?cCoord(r[0]):null; },
};

// ─── COORDINATOR EVENTS ───────────────────────────────────────
export const coordEventsDB = {
  getByCoordinator: async cid => (await api('GET','ct_coordinator_events',null,`?coordinator_id=eq.${cid}`)),
  getByEvent: async eid => (await api('GET','ct_coordinator_events',null,`?event_id=eq.${eid}`)),
  assign: async (coordinatorId,eventId) => { const r=await api('POST','ct_coordinator_events',{coordinator_id:coordinatorId,event_id:eventId}); return r[0]||null; },
  unassign: async (coordinatorId,eventId) => api('DELETE','ct_coordinator_events',null,`?coordinator_id=eq.${coordinatorId}&event_id=eq.${eventId}`),
};

// ─── REPS ─────────────────────────────────────────────────────
export const repsDB = {
  getAll: async () => (await api('GET','ct_reps',null,'?order=name.asc')).map(cRep),
  getById: async id => { const r=await api('GET','ct_reps',null,`?id=eq.${id}`); return r[0]?cRep(r[0]):null; },
  getByRepId: async rid => { const r=await api('GET','ct_reps',null,`?rep_id=eq.${rid}`); return r[0]?cRep(r[0]):null; },
  create: async data => { const r=await api('POST','ct_reps',sRep(data)); return r[0]?cRep(r[0]):null; },
  update: async (id,data) => { const r=await api('PATCH','ct_reps',sRep(data),`?id=eq.${id}`); return r[0]?cRep(r[0]):null; },
  delete: async id => api('DELETE','ct_reps',null,`?id=eq.${id}`),
  changePassword: async (id,pw) => { const r=await api('PATCH','ct_reps',{password:pw,must_change_password:false},`?id=eq.${id}`); return r[0]?cRep(r[0]):null; },
};

// ─── REP TICKET INVENTORY ─────────────────────────────────────
export const inventoryDB = {
  getAll: async () => (await api('GET','ct_rep_inventory',null,'?order=created_at.desc')).map(cInv),
  getByRep: async repId => (await api('GET','ct_rep_inventory',null,`?rep_id=eq.${repId}&order=created_at.desc`)).map(cInv),
  getByEvent: async eventId => (await api('GET','ct_rep_inventory',null,`?event_id=eq.${eventId}&order=rep_name.asc`)).map(cInv),
  getByRepAndEvent: async (repId,eventId) => { const r=await api('GET','ct_rep_inventory',null,`?rep_id=eq.${repId}&event_id=eq.${eventId}`); return r[0]?cInv(r[0]):null; },
  getActiveForRep: async repId => (await api('GET','ct_rep_inventory',null,`?rep_id=eq.${repId}&confirmed=eq.true&status=eq.Active`)).map(cInv),
  create: async data => { const r=await api('POST','ct_rep_inventory',{rep_id:data.repId,rep_name:data.repName,event_id:data.eventId,event_name:data.eventName,tickets_allocated:data.ticketsAllocated,tickets_sold:0,tickets_returned:0,cash_collected:0,confirmed:false,status:'Active'}); return r[0]?cInv(r[0]):null; },
  confirm: async id => { const r=await api('PATCH','ct_rep_inventory',{confirmed:true,confirmed_at:new Date().toISOString()},`?id=eq.${id}`); return r[0]?cInv(r[0]):null; },
  recordSale: async (id,qty,cash) => {
    const inv=await api('GET','ct_rep_inventory',null,`?id=eq.${id}`);
    if(!inv[0])return null;
    const r=await api('PATCH','ct_rep_inventory',{tickets_sold:inv[0].tickets_sold+qty,cash_collected:Number(inv[0].cash_collected)+cash},`?id=eq.${id}`);
    return r[0]?cInv(r[0]):null;
  },
  closeOutRep: async (id) => {
    const inv=await api('GET','ct_rep_inventory',null,`?id=eq.${id}`);
    if(!inv[0])return null;
    const remaining=inv[0].tickets_allocated-inv[0].tickets_sold;
    const r=await api('PATCH','ct_rep_inventory',{status:'Closed',tickets_returned:remaining},`?id=eq.${id}`);
    // Record return inventory
    if(remaining>0){
      await api('POST','ct_return_inventory',{rep_id:inv[0].rep_id,rep_name:inv[0].rep_name,event_id:inv[0].event_id,coordinator_id:null,tickets_returned:remaining,returned_at:new Date().toISOString()});
    }
    // Mark CE points as Due
    const ce=await api('GET','ct_ce_points',null,`?rep_id=eq.${inv[0].rep_id}&event_id=eq.${inv[0].event_id}`);
    if(ce[0])await api('PATCH','ct_ce_points',{status:'Due'},{},`?id=eq.${ce[0].id}`);
    return r[0]?cInv(r[0]):null;
  },
  reassign: async (fromRepId,toRepId,toRepName,eventId,qty) => {
    const from=await api('GET','ct_rep_inventory',null,`?rep_id=eq.${fromRepId}&event_id=eq.${eventId}`);
    if(!from[0])return null;
    await api('PATCH','ct_rep_inventory',{tickets_returned:from[0].tickets_returned-qty},`?id=eq.${from[0].id}`);
    const to=await api('GET','ct_rep_inventory',null,`?rep_id=eq.${toRepId}&event_id=eq.${eventId}`);
    if(to[0]){
      await api('PATCH','ct_rep_inventory',{tickets_allocated:to[0].tickets_allocated+qty},`?id=eq.${to[0].id}`);
    } else {
      const ev=await eventsDB.getById(eventId);
      await inventoryDB.create({repId:toRepId,repName:toRepName,eventId,eventName:ev?.name||'',ticketsAllocated:qty});
    }
    await api('PATCH','ct_return_inventory',{reassigned_to_rep_id:toRepId},{},`?rep_id=eq.${fromRepId}&event_id=eq.${eventId}&reassigned_to_rep_id=is.null`);
  },
};

// ─── TICKET SALES ─────────────────────────────────────────────
export const salesDB = {
  getAll: async () => (await api('GET','ct_sales',null,'?order=date_sold.desc')).map(cSale),
  getByRep: async repId => (await api('GET','ct_sales',null,`?rep_id=eq.${repId}&order=date_sold.desc`)).map(cSale),
  getByEvent: async eventId => (await api('GET','ct_sales',null,`?event_id=eq.${eventId}&order=date_sold.desc`)).map(cSale),
  create: async data => {
    const now=new Date();
    const weekNum=Math.ceil(((now-new Date(now.getFullYear(),0,1))/86400000+1)/7);
    const r=await api('POST','ct_sales',{rep_id:data.repId,rep_name:data.repName,event_id:data.eventId,event_name:data.eventName,quantity_sold:data.quantitySold,ticket_price:data.ticketPrice,total_value:data.totalValue,payment_method:data.paymentMethod,date_sold:now.toISOString(),week_number:weekNum,customer_name:data.customerName||null,customer_phone:data.customerPhone||null,customer_email:data.customerEmail||null});
    if(r[0]){
      await inventoryDB.recordSale(data.inventoryId,data.quantitySold,data.totalValue);
      await cePointsDB.addSale(data.repId,data.eventId,data.eventName,data.quantitySold,data.pointsPerTicket,data.repName,data.ceId);
    }
    return r[0]?cSale(r[0]):null;
  },
};

// ─── CE POINTS ────────────────────────────────────────────────
export const cePointsDB = {
  getAll: async () => (await api('GET','ct_ce_points',null,'?order=created_at.desc')).map(cCE),
  getByRep: async repId => (await api('GET','ct_ce_points',null,`?rep_id=eq.${repId}&order=created_at.desc`)).map(cCE),
  getByEvent: async eventId => (await api('GET','ct_ce_points',null,`?event_id=eq.${eventId}&order=rep_name.asc`)).map(cCE),
  getOrCreate: async (repId,repName,eventId,eventName,pointsPerTicket,ceId) => {
    const ex=await api('GET','ct_ce_points',null,`?rep_id=eq.${repId}&event_id=eq.${eventId}`);
    if(ex[0])return cCE(ex[0]);
    const r=await api('POST','ct_ce_points',{rep_id:repId,rep_name:repName,event_id:eventId,event_name:eventName,points_per_ticket:pointsPerTicket,tickets_sold:0,points_earned:0,status:'Pending',ce_id:ceId});
    return r[0]?cCE(r[0]):null;
  },
  addSale: async (repId,eventId,eventName,qty,ppt,repName,ceId) => {
    const ex=await api('GET','ct_ce_points',null,`?rep_id=eq.${repId}&event_id=eq.${eventId}`);
    if(ex[0]){
      const newSold=ex[0].tickets_sold+qty;
      const r=await api('PATCH','ct_ce_points',{tickets_sold:newSold,points_earned:newSold*ex[0].points_per_ticket},`?id=eq.${ex[0].id}`);
      return r[0]?cCE(r[0]):null;
    } else {
      return cePointsDB.getOrCreate(repId,repName,eventId,eventName,ppt,ceId);
    }
  },
  markPaid: async (id,paidBy) => { const r=await api('PATCH','ct_ce_points',{status:'Paid',paid_at:new Date().toISOString(),paid_by:paidBy},`?id=eq.${id}`); return r[0]?cCE(r[0]):null; },
  markDue: async (repId,eventId) => { const r=await api('PATCH','ct_ce_points',{status:'Due'},{},`?rep_id=eq.${repId}&event_id=eq.${eventId}`); return r[0]?cCE(r[0]):null; },
};

// ─── COORDINATOR COMMISSIONS ──────────────────────────────────
export const coordCommissionsDB = {
  getAll: async () => (await api('GET','ct_coordinator_commissions',null,'?order=created_at.desc')).map(cCC),
  getByCoordinator: async cid => (await api('GET','ct_coordinator_commissions',null,`?coordinator_id=eq.${cid}&order=created_at.desc`)).map(cCC),
  getByEvent: async eid => (await api('GET','ct_coordinator_commissions',null,`?event_id=eq.${eid}&order=coordinator_name.asc`)).map(cCC),
  getOrCreate: async (coordinatorId,coordinatorName,eventId,eventName,commissionRate) => {
    const ex=await api('GET','ct_coordinator_commissions',null,`?coordinator_id=eq.${coordinatorId}&event_id=eq.${eventId}`);
    if(ex[0])return cCC(ex[0]);
    const r=await api('POST','ct_coordinator_commissions',{coordinator_id:coordinatorId,coordinator_name:coordinatorName,event_id:eventId,event_name:eventName,commission_rate:commissionRate,revenue_base:0,amount_due:0,status:'Pending'});
    return r[0]?cCC(r[0]):null;
  },
  updateRevenue: async (eventId) => {
    const sales=await salesDB.getByEvent(eventId);
    const ev=await eventsDB.getById(eventId);
    if(!ev)return;
    const grossRevenue=sales.reduce((s,x)=>s+x.totalValue,0);
    const campusTixCut=grossRevenue*ev.commissionRate;
    const coords=await coordCommissionsDB.getByEvent(eventId);
    for(const cc of coords){
      const amount=campusTixCut*cc.commissionRate;
      await api('PATCH','ct_coordinator_commissions',{revenue_base:campusTixCut,amount_due:amount},`?id=eq.${cc.id}`);
    }
  },
  markPaid: async (id,paidBy) => { const r=await api('PATCH','ct_coordinator_commissions',{status:'Paid',paid_at:new Date().toISOString(),paid_by:paidBy},`?id=eq.${id}`); return r[0]?cCC(r[0]):null; },
  markDue: async id => { const r=await api('PATCH','ct_coordinator_commissions',{status:'Due'},{},`?id=eq.${id}`); return r[0]?cCC(r[0]):null; },
};

// ─── RETURN INVENTORY ─────────────────────────────────────────
export const returnInventoryDB = {
  getByEvent: async eid => (await api('GET','ct_return_inventory',null,`?event_id=eq.${eid}&order=returned_at.desc`)).map(cReturn),
  getAll: async () => (await api('GET','ct_return_inventory',null,'?order=returned_at.desc')).map(cReturn),
};
