// 업로드한 이미지를 브라우저에서 바로 줄이고 WebP로 변환한다.
// (별도 프로그램·서버 처리 없이, 캔버스로 그 자리에서 처리)
//   - 긴 변을 maxEdge(기본 600px)까지 축소
//   - WebP 데이터 URL 문자열로 돌려줌 → 그대로 인물 정보에 저장
export async function 이미지를_썸네일로(
  file: File,
  maxEdge = 600,
  quality = 0.85,
): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });

  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('이미지를 열지 못했습니다.'));
    i.src = dataUrl;
  });

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들지 못했습니다.');
  ctx.drawImage(img, 0, 0, w, h);

  // WebP로 변환 (풀컬러, 작은 용량). 미지원 환경이면 PNG로 자동 대체됨.
  return canvas.toDataURL('image/webp', quality);
}
