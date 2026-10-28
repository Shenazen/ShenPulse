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
  if(p==='/api/admin/agencies/review')return service.reviewAgency(request,b);
  if(p==='/api/admin/agencies/members/review')return service.reviewMember(request,b,true);
  throw Object.assign(new Error('Commande agence introuvable.'),{statusCode:404});
}
