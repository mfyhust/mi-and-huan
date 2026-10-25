// UI selection only; server-side runtime policy remains authoritative.
export function modelSelection(info={},value={}){
  const local=info.edition==='local',rules=value.source==='rules';
  const request=rules?{source:'rules'}:local?{}:value.source==='server'?{source:'server'}:value;
  return {request,enabled:!rules&&(local||!!(value.source==='session'?value.key:info.configured)),model:local?info.model:value.source==='session'?value.model:info.model};
}
