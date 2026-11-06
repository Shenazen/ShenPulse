export function integrateAdminStorage(index){
 if(!index.includes("from './media-admin/service.mjs'"))index="import { createAdminStorage } from './media-admin/service.mjs'\n"+index;
 if(!index.includes('const adminStorageService ='))index=index.replace('const server = createServer(', 'const adminStorageService = createAdminStorage({requireAdmin: requireReleaseAdmin})\n\nconst server = createServer(');
 if(!index.includes("url.pathname === '/api/admin/storage'")){
  const anchor='    const url = requestUrl(request)';
  if(!index.includes(anchor))throw Error('Point de montage du stockage introuvable.');
  index=index.replace(anchor,anchor+`\n    if (url.pathname === '/api/admin/storage' && request.method === 'GET') {\n      sendJson(response, await adminStorageService.list(request, Object.fromEntries(url.searchParams)))\n      return\n    }\n    if (url.pathname === '/api/admin/storage/file' && request.method === 'POST') {\n      sendJson(response, await adminStorageService.file(request, await readJsonBody(request)))\n      return\n    }`);
 }
 if(!index.includes('const adminStorageService = createAdminStorage'))throw Error('Montage du stockage incomplet.');
 return index;
}
