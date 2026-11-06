export async function handleAgencyRoute(service,request,url,readBody){
  const p=url.pathname,m=request.method;
  if(m==='GET' && p==='/api/agencies')return service.publicList();
  if(m==='GET' && p==='/api/agencies/dashboard')return service.dashboard(request);
  if(m==='GET' && p==='/api/admin/agencies')return service.dashboard(request,true);
  if(m!=='POST')throw Object.assign(new Error('Méthode non autorisée.'),{statusCode:405});
  const b=await readBody(request);
  if(p==='/api/agencies/save')return service.save(request,b);
  if(p==='/api/agencies/join')return service.join(request,b);
  if(p==='/api/agencies/leave')return service.leave(request);
  if(p==='/api/agencies/members/review')return service.reviewMember(request,b);
  if(p==='/api/agencies/invitation/rotate')return service.rotateCode(request,b);
  if(p==='/api/agencies/identity')return service.updateIdentity(request,b);
  const billingRoutes={'/api/agencies/pack/billing/preview':'preview','/api/agencies/pack/billing/checkout':'checkout','/api/agencies/pack/billing/sync':'sync','/api/agencies/pack/billing/abandon':'abandon','/api/agencies/pack/billing/change':'applyChange','/api/agencies/pack/billing/pending/cancel':'cancelPending','/api/agencies/pack/billing/cancel':'cancel','/api/agencies/pack/billing/resume':'resume','/api/agencies/pack/billing/portal':'portal'};
  if(billingRoutes[p]){if(!service.billing)throw Object.assign(new Error('Facturation groupée indisponible.'),{statusCode:503});return service.billing[billingRoutes[p]](request,b);}
  if(p==='/api/agencies/pack/preview')return service.packs.previewOwn(request,b);
  if(p==='/api/agencies/pack/selection')return service.packs.selectOwn(request,b);
  if(p==='/api/admin/agencies/packs/save')return service.packs.save(request,b);
  if(p==='/api/admin/agencies/packs/archive')return service.packs.archive(request,b);
  if(p==='/api/admin/agencies/packs/assign')return service.packs.assign(request,b);
  if(p==='/api/admin/agencies/packs/unassign')return service.packs.unassign(request,b);
  if(p==='/api/admin/agencies/packs/preview')return service.packs.preview(request,b);
  if(p==='/api/admin/agencies/review')return service.reviewAgency(request,b);
  if(p==='/api/admin/agencies/members/review')return service.reviewMember(request,b,true);
  throw Object.assign(new Error('Commande agence introuvable.'),{statusCode:404});
}
