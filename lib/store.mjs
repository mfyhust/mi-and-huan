export class Store {
  constructor(db, space) { this.db = db; this.space = space; }
  row(r) { return r ? {...r, body: JSON.parse(r.body)} : null; }
  async get(id) { return this.row(await this.db.prepare('SELECT * FROM records WHERE id = ? AND space = ?').bind(id, this.space).first()); }
  async list(kind) {
    const result = await this.db.prepare('SELECT * FROM records WHERE space = ? AND kind = ? ORDER BY created DESC LIMIT 1500').bind(this.space, kind).all();
    return (result.results || []).map(r => this.row(r));
  }
  async listOwned(kind,owner,limit=1500) { const result=await this.db.prepare('SELECT * FROM records WHERE space = ? AND kind = ? AND owner = ? ORDER BY created DESC LIMIT ?').bind(this.space,kind,owner,Math.max(1,Math.min(1500,limit))).all();return (result.results||[]).map(r=>this.row(r)); }
  async count(kind,owner) { const row=await this.db.prepare('SELECT COUNT(*) AS total FROM records WHERE space = ? AND kind = ? AND owner = ?').bind(this.space,kind,owner).first();return Number(row?.total||0); }
  record(kind, owner, body, suffix) {
    const now = new Date().toISOString(), id = this.space + ':' + (suffix || crypto.randomUUID());
    return {id,space:this.space,kind,owner,body,version:1,created:now,updated:now};
  }
  async add(kind, owner, body, suffix) {
    const r=this.record(kind,owner,body,suffix),{id,created:now}=r;
    await this.db.prepare('INSERT INTO records (id,space,kind,owner,body,version,created,updated) VALUES (?,?,?,?,?,1,?,?)').bind(id,this.space,kind,owner,JSON.stringify(body),now,now).run();
    return r;
  }
  async addLimited(kind,owner,body,limit) {
    const r=this.record(kind,owner,body);
    const result=await this.db.prepare('INSERT INTO records (id,space,kind,owner,body,version,created,updated) SELECT ?,?,?,?,?,1,?,? WHERE (SELECT COUNT(*) FROM records WHERE space = ? AND kind = ? AND owner = ?) < ?').bind(r.id,r.space,r.kind,r.owner,JSON.stringify(r.body),r.created,r.updated,this.space,kind,owner,limit).run();
    if(!result.meta?.changes)throw Object.assign(new Error('当前账号照片配额已用完，请先用文字登记或联系组织者。'),{status:429});return r;
  }
  async save(record, body) {
    const updated = new Date().toISOString();
    const result = await this.db.prepare('UPDATE records SET body = ?, version = version + 1, updated = ? WHERE id = ? AND space = ? AND version = ?').bind(JSON.stringify(body),updated,record.id,this.space,record.version).run();
    if (!result.meta?.changes) throw Object.assign(new Error('信息刚刚发生变化，请刷新后重试。'), {status:409});
    return {...record,body,version:record.version+1,updated};
  }
  async remove(id) { await this.db.prepare('DELETE FROM records WHERE id = ? AND space = ?').bind(id,this.space).run(); }
  async saveMany(changes, additions=[]) {
    if(!changes.length){if(additions.length)throw new Error('Additions require a guarded transition');return [];}
    const ids=[...changes.map(c=>c.record.id),...additions.map(r=>r.id)];
    if(new Set(ids).size!==ids.length)throw new Error('Duplicate transition record');
    const conflict=()=>Object.assign(new Error('信息刚刚发生变化，请刷新后重试。'),{status:409});
    if(changes.some(c=>c.record.space!==this.space)||additions.some(r=>r.space!==this.space||r.version!==1))throw conflict();
    const updated=new Date().toISOString();
    // A unique gate is created only if ALL original versions still match. D1
    // serializes the batch transaction; an unrelated version increment cannot
    // impersonate an earlier successful statement. The gate never survives it.
    const gate=this.space+':transition:'+crypto.randomUUID();
    const guards=changes.map((_,n)=>`EXISTS(SELECT 1 FROM records AS g${n} WHERE g${n}.id = ? AND g${n}.space = ? AND g${n}.version = ?)`);
    const open=this.db.prepare('INSERT INTO records (id,space,kind,owner,body,version,created,updated) SELECT ?,?,?,?,?,1,?,? WHERE '+guards.join(' AND '))
      .bind(gate,this.space,'_transition','internal','{}',updated,updated,...changes.flatMap(c=>[c.record.id,this.space,c.record.version]));
    const updates=changes.map(({record,body})=>this.db.prepare('UPDATE records SET body = ?, version = version + 1, updated = ? WHERE id = ? AND space = ? AND version = ? AND EXISTS(SELECT 1 FROM records WHERE id = ? AND space = ? AND kind = ?)')
      .bind(JSON.stringify(body),updated,record.id,this.space,record.version,gate,this.space,'_transition'));
    const inserts=additions.map(r=>this.db.prepare('INSERT INTO records (id,space,kind,owner,body,version,created,updated) SELECT ?,?,?,?,?,1,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id = ? AND space = ? AND kind = ?)')
      .bind(r.id,this.space,r.kind,r.owner,JSON.stringify(r.body),r.created,r.updated,gate,this.space,'_transition'));
    const close=this.db.prepare('DELETE FROM records WHERE id = ? AND space = ? AND kind = ?').bind(gate,this.space,'_transition');
    const results=await this.db.batch([open,...updates,...inserts,close]);
    if(!results[0].meta?.changes)throw conflict();
    if(results.slice(1,-1).some(r=>r.meta?.changes!==1))throw new Error('批量更新结果异常，请检查数据库约束。');
    return changes.map(c=>({...c.record,body:c.body,version:c.record.version+1,updated}));
  }
  async clear() { await this.db.prepare('DELETE FROM records WHERE space = ?').bind(this.space).run(); }
}
