function sha256(input) {
  const bytes = new TextEncoder().encode(input);
  const words = [];
  const bitLength = bytes.length * 8;

  for (let index = 0; index < bytes.length; index += 1) {
    words[index >> 2] =
      (words[index >> 2] || 0) | (bytes[index] << (24 - (index % 4) * 8));
  }
  words[bitLength >> 5] =
    (words[bitLength >> 5] || 0) | (0x80 << (24 - (bitLength % 32)));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  let [a, b, c, d, e, f, g, h] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotateRight = (value, shift) =>
    (value >>> shift) | (value << (32 - shift));

  for (let offset = 0; offset < words.length; offset += 16) {
    const schedule = words.slice(offset, offset + 16);
    for (let index = 16; index < 64; index += 1) {
      const sigma0 =
        rotateRight(schedule[index - 15], 7) ^
        rotateRight(schedule[index - 15], 18) ^
        (schedule[index - 15] >>> 3);
      const sigma1 =
        rotateRight(schedule[index - 2], 17) ^
        rotateRight(schedule[index - 2], 19) ^
        (schedule[index - 2] >>> 10);
      schedule[index] =
        (schedule[index - 16] + sigma0 + schedule[index - 7] + sigma1) | 0;
    }
    let [aa, bb, cc, dd, ee, ff, gg, hh] = [a, b, c, d, e, f, g, h];
    for (let index = 0; index < 64; index += 1) {
      const sigma1 =
        rotateRight(ee, 6) ^ rotateRight(ee, 11) ^ rotateRight(ee, 25);
      const choice = (ee & ff) ^ (~ee & gg);
      const temp1 =
        (hh + sigma1 + choice + constants[index] + schedule[index]) | 0;
      const sigma0 =
        rotateRight(aa, 2) ^ rotateRight(aa, 13) ^ rotateRight(aa, 22);
      const majority = (aa & bb) ^ (aa & cc) ^ (bb & cc);
      const temp2 = (sigma0 + majority) | 0;
      [hh, gg, ff, ee, dd, cc, bb, aa] = [
        gg,
        ff,
        ee,
        (dd + temp1) | 0,
        cc,
        bb,
        aa,
        (temp1 + temp2) | 0,
      ];
    }
    [a, b, c, d, e, f, g, h] = [
      (a + aa) | 0,
      (b + bb) | 0,
      (c + cc) | 0,
      (d + dd) | 0,
      (e + ee) | 0,
      (f + ff) | 0,
      (g + gg) | 0,
      (h + hh) | 0,
    ];
  }
  return new Uint8Array(
    [a, b, c, d, e, f, g, h].flatMap((word) =>
      [word >>> 24, word >>> 16, word >>> 8, word].map((value) => value & 255),
    ),
  );
}

function hlsToRgb(hue, lightness, saturation) {
  if (saturation === 0) return [lightness, lightness, lightness];
  const hueToRgb = (p, q, value) => {
    let normalized = value;
    if (normalized < 0) normalized += 1;
    if (normalized > 1) normalized -= 1;
    if (normalized < 1 / 6) return p + (q - p) * 6 * normalized;
    if (normalized < 1 / 2) return q;
    if (normalized < 2 / 3) return p + (q - p) * (2 / 3 - normalized) * 6;
    return p;
  };
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return [
    hueToRgb(p, q, hue + 1 / 3),
    hueToRgb(p, q, hue),
    hueToRgb(p, q, hue - 1 / 3),
  ];
}

export function getArticleTagPalette(tag) {
  const source = String(tag?.id || tag?.name || "tag");
  const digest = sha256(source);
  const hue = digest[0] / 255;
  const saturation = 0.45 + (digest[1] % 64) / 255;
  const lightness = 0.46 + (digest[2] % 32) / 255;
  const [red, green, blue] = hlsToRgb(hue, lightness, saturation).map(
    (channel) => Math.round(channel * 255),
  );
  return {
    "--article-tag-rgb": `${red}, ${green}, ${blue}`,
    "--article-tag-background": `rgba(${red}, ${green}, ${blue}, 0.14)`,
    "--article-tag-border": `rgba(${red}, ${green}, ${blue}, 0.34)`,
    "--article-tag-color": `rgb(${Math.max(red - 58, 0)}, ${Math.max(green - 58, 0)}, ${Math.max(blue - 58, 0)})`,
  };
}
