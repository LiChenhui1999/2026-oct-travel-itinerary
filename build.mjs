import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';

const password = process.env.TRIP_PAGE_PASSWORD;
if (!password) throw new Error('Set TRIP_PAGE_PASSWORD before building.');

const escapeHtml = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const inline = (s) => escapeHtml(s).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
const source = readFileSync('2026-10-日本新加坡土耳其行程.md', 'utf8');
const ticket = readFileSync('2026-10-13-品川至博多新干线车票.png').toString('base64');
const lines = source.split(/\r?\n/);
let content = '';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  if (line.startsWith('# ')) content += `<h1>${inline(line.slice(2))}</h1>`;
  else if (line.startsWith('## ')) content += `<h2>${inline(line.slice(3))}</h2>`;
  else if (line.startsWith('- ')) {
    if (!lines[i - 1]?.trim().startsWith('- ')) content += '<ul>';
    content += `<li>${inline(line.slice(2))}</li>`;
    if (!lines[i + 1]?.trim().startsWith('- ')) content += '</ul>';
  } else if (line.startsWith('![')) {
    const alt = line.match(/^!\[(.*?)\]/)?.[1] ?? '车票';
    content += `<figure><img src="data:image/png;base64,${ticket}" alt="${escapeHtml(alt)}"><figcaption>${escapeHtml(alt)}</figcaption></figure>`;
  } else if (line.startsWith('|')) {
    if (!lines[i - 1]?.trim().startsWith('|')) content += '<div class="table-scroll"><table>';
    if (!/^\|[\s:|-]+\|$/.test(line)) {
      const cells = line.slice(1, -1).split('|').map(s => s.trim());
      const header = !lines[i - 1]?.trim().startsWith('|');
      content += `<tr>${cells.map(s => `<${header ? 'th' : 'td'}>${inline(s)}</${header ? 'th' : 'td'}>`).join('')}</tr>`;
    }
    if (!lines[i + 1]?.trim().startsWith('|')) content += '</table></div>';
  } else content += `<p>${inline(line)}</p>`;
}

const salt = randomBytes(16);
const iv = randomBytes(12);
const iterations = 600000;
const key = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
const payload = Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64');

const page = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>2026 年 10 月行程</title>
<style>
:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#203040;background:#f5f7fa}*{box-sizing:border-box}body{margin:0}.shell{max-width:940px;margin:auto;padding:28px 18px 64px}.lock{min-height:88vh;display:grid;place-items:center}.card{width:min(100%,390px);padding:30px;border-radius:20px;background:white;box-shadow:0 12px 40px #1c355015}.card h1{font-size:1.45rem;margin:0 0 10px}.card p{color:#607080;line-height:1.6}.card label{display:block;margin:22px 0 8px;font-weight:600}.card input{width:100%;padding:13px;border:1px solid #bdc8d3;border-radius:10px;font-size:1rem}.card button{width:100%;margin-top:14px;padding:13px;border:0;border-radius:10px;background:#145a93;color:white;font-size:1rem;font-weight:700}.error{color:#bd2635!important;min-height:1.6em}.trip{display:none}.trip h1{font-size:clamp(1.7rem,4vw,2.4rem);margin:0 0 28px}.trip h2{font-size:1.25rem;margin:32px 0 14px;padding-bottom:8px;border-bottom:2px solid #cbdbe8}.trip p,.trip li{line-height:1.7}.trip ul{padding-left:1.4em}.table-scroll{overflow:auto;background:white;border-radius:12px;border:1px solid #d9e2eb}.trip table{border-collapse:collapse;width:100%;min-width:640px}.trip th,.trip td{text-align:left;padding:12px;border-bottom:1px solid #e1e8ef;white-space:nowrap}.trip th{background:#eaf2f8}.trip figure{margin:24px 0}.trip img{display:block;width:100%;height:auto;border-radius:12px}.trip figcaption{margin-top:7px;color:#63768a;font-size:.9rem}
</style></head><body><main class="shell"><section id="lock" class="lock"><form class="card" id="form"><h1>2026 年 10 月行程</h1><p>输入密码查看行程和车票。</p><label for="password">访问密码</label><input id="password" type="password" inputmode="numeric" autocomplete="off" required autofocus><button type="submit">解锁</button><p class="error" id="error" aria-live="polite"></p></form></section><article id="trip" class="trip"></article></main>
<script>
const salt='${salt.toString('base64')}',iv='${iv.toString('base64')}',data='${payload}',rounds=${iterations};
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
document.getElementById('form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;button.textContent='正在解锁…';document.getElementById('error').textContent='';try{const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(document.getElementById('password').value),'PBKDF2',false,['deriveKey']);const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(salt),iterations:rounds,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['decrypt']);const html=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv)},key,bytes(data)));document.getElementById('trip').innerHTML=html;document.getElementById('trip').style.display='block';document.getElementById('lock').remove();window.scrollTo(0,0)}catch{document.getElementById('error').textContent='密码错误，请重试。';button.disabled=false;button.textContent='解锁'}});
</script></body></html>`;
writeFileSync('index.html', page);
console.log(`Generated index.html (${Math.round(Buffer.byteLength(page)/1024)} KiB)`);
