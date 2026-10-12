// أدوات MP3 بسيطة: تنظيف المقاطع (حذف ID3 وإطارات Xing/Info) وتوليد صمت مطابق لنفس الإعدادات
// الهدف: نلصق مقاطع كثيرة ورا بعض في ملف واحد يشتغل في أي تطبيق بودكاست

const BR_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BR_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export function parseHeader(b, i) {
  if (i + 4 > b.length || b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) return null;
  const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3;
  if (ver === 1 || layer !== 1) return null;           // Layer III فقط
  const bri = b[i + 2] >> 4, sri = (b[i + 2] >> 2) & 3;
  if (bri === 0 || bri === 15 || sri === 3) return null;
  const v1 = ver === 3, br = (v1 ? BR_V1 : BR_V2)[bri] * 1000, sr = SR[ver][sri];
  const pad = (b[i + 2] >> 1) & 1, mono = (b[i + 3] >> 6) === 3, crc = !(b[i + 1] & 1);
  const len = Math.floor((v1 ? 144 : 72) * br / sr) + pad;
  return { len, sr, samples: v1 ? 1152 : 576, side: v1 ? (mono ? 17 : 32) : (mono ? 9 : 17), crc, v1, mono };
}

function isInfoFrame(b, i, h) {
  const tag = o => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  const o = i + 4 + (h.crc ? 2 : 0) + h.side;
  if (o + 4 <= b.length && (tag(o) === 'Xing' || tag(o) === 'Info')) return true;
  return i + 40 <= b.length && tag(i + 36) === 'VBRI';
}

// يرجّع الإطارات الصوتية فقط، ملتصقة، مع عدد الإطارات ومعلومات الصيغة
export function cleanMp3(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  let i = 0;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {           // ID3v2
    const size = ((b[6] & 127) << 21) | ((b[7] & 127) << 14) | ((b[8] & 127) << 7) | (b[9] & 127);
    i = 10 + size + ((b[5] & 0x10) ? 10 : 0);
  }
  let end = b.length;
  if (end >= 128 && b[end - 128] === 0x54 && b[end - 127] === 0x41 && b[end - 126] === 0x47) end -= 128; // ID3v1
  const ranges = []; let total = 0, frames = 0, info = null;
  while (i < end) {
    const h = parseHeader(b, i);
    if (!h || i + h.len > end) { i++; continue; }
    // تأكد إن الإطار حقيقي: اللي بعده إطار أو نهاية الملف
    const nx = i + h.len;
    if (nx < end - 4 && !parseHeader(b, nx)) { i++; continue; }
    if (!info) info = h;
    if (h.sr === info.sr && h.mono === info.mono && h.v1 === info.v1 && !isInfoFrame(b, i, h)) {
      ranges.push([i, nx]); total += h.len; frames++;
    }
    i = nx;
  }
  const out = new Uint8Array(total); let o = 0;
  for (const [a, z] of ranges) { out.set(b.subarray(a, z), o); o += z - a; }
  if (!info) return { data: out, frames: 0, info: null };
  // نحفظ أول هيدر عشان نولّد صمت بنفس الصيغة
  const first = ranges.length ? b.subarray(ranges[0][0], ranges[0][0] + 4) : null;
  return { data: out, frames, info: { sr: info.sr, samples: info.samples, header: first ? Array.from(first) : null } };
}

// إطار صمت: نفس الهيدر بدون padding وبدون CRC، والباقي أصفار (part2_3_length = 0 يعني صمت)
export function silenceFrame(header) {
  const h = parseHeader(Uint8Array.from([header[0], header[1] | 1, header[2] & 0xFD, header[3]]), 0);
  const f = new Uint8Array(h.len);
  f[0] = header[0]; f[1] = header[1] | 1; f[2] = header[2] & 0xFD; f[3] = header[3];
  return { frame: f, seconds: h.samples / h.sr, len: h.len };
}

export function silenceFrames(header, seconds) {
  const { seconds: fs } = silenceFrame(header);
  return Math.max(1, Math.round(seconds / fs));
}
