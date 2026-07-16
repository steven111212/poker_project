// ---------- zip ----------
async function readZip(buf) {
  const dv = new DataView(buf);
  let i = buf.byteLength - 22;
  while (i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
  if (i < 0) throw new Error("不是有效的 zip 檔");
  const count = dv.getUint16(i + 10, true);
  let off = dv.getUint32(i + 16, true);
  const files = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const cmtLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, off + 46, nameLen));
    const lnl = dv.getUint16(lho + 26, true), lel = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnl + lel;
    files.push({ name, method, data: buf.slice(start, start + csize) });
    off += 46 + nameLen + extraLen + cmtLen;
  }
  const out = [];
  for (const f of files) {
    if (!f.name.toLowerCase().endsWith(".txt")) continue;
    let bytes;
    if (f.method === 0) bytes = f.data;
    else if (f.method === 8) {
      const ds = new DecompressionStream("deflate-raw");
      bytes = await new Response(new Response(f.data).body.pipeThrough(ds)).arrayBuffer();
    } else continue;
    out.push({ name: f.name, text: new TextDecoder().decode(bytes) });
  }
  return out;
}
