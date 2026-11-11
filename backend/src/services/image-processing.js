import sharp from 'sharp';

export const imageStats = async (buffer) => {
  const { data, info } = await sharp(buffer).greyscale().raw().toBuffer({ resolveWithObject: true });
  let dark = 0;
  for (const value of data) if (value < 180) dark += 1;
  return { width: info.width, height: info.height, inkRatio: data.length ? dark / data.length : 0 };
};

export const cropImage = async (buffer, box) => {
  const metadata = await sharp(buffer).metadata();
  const left = Math.max(0, Math.min(metadata.width - 1, Math.floor(box.left)));
  const top = Math.max(0, Math.min(metadata.height - 1, Math.floor(box.top)));
  const width = Math.max(1, Math.min(metadata.width - left, Math.floor(box.width)));
  const height = Math.max(1, Math.min(metadata.height - top, Math.floor(box.height)));
  return sharp(buffer).extract({ left, top, width, height }).grayscale().normalize().png().toBuffer();
};

export const detectRasterLines = async (buffer, { threshold = 0.35 } = {}) => {
  const { data, info } = await sharp(buffer).greyscale().raw().toBuffer({ resolveWithObject: true });
  const horizontal = [];
  const vertical = [];
  for (let y = 0; y < info.height; y += 1) {
    let dark = 0;
    for (let x = 0; x < info.width; x += 1) if (data[y * info.width + x] < 160) dark += 1;
    if (dark / info.width >= threshold) horizontal.push(y);
  }
  for (let x = 0; x < info.width; x += 1) {
    let dark = 0;
    for (let y = 0; y < info.height; y += 1) if (data[y * info.width + x] < 160) dark += 1;
    if (dark / info.height >= threshold) vertical.push(x);
  }
  const group = (values) => values.reduce((groups, value) => {
    const current = groups.at(-1);
    if (current && value <= current.at(-1) + 2) current.push(value);
    else groups.push([value]);
    return groups;
  }, []).map((values) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
  return { horizontal: group(horizontal), vertical: group(vertical), width: info.width, height: info.height };
};
