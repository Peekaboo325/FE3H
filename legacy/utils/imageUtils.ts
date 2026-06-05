
/**
 * 이미지를 1:1 비율로 중앙 크롭하고, 400x400px 크기의 WebP(0.85) 포맷으로 변환합니다.
 * (캐릭터 썸네일용 - PC 고해상도 대응)
 * @param file 업로드된 파일 객체
 * @returns Base64 인코딩된 문자열 (Promise) -> [Refactor] UI 호환성을 위해 DataURL 반환 유지, 저장은 DB 레이어에서 처리
 */
export const processCharacterImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
  
          // 1. 1:1 비율 중앙 크롭 계산
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
  
          // 2. 타겟 사이즈 설정 (400px for Retina/Desktop sharpness)
          const targetSize = 400;
          canvas.width = targetSize;
          canvas.height = targetSize;
  
          // 3. 그리기 (Resize & Crop)
          ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize);
  
          // 4. 압축 및 포맷 변환 (WebP, Quality 0.85)
          const dataUrl = canvas.toDataURL('image/webp', 0.85);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

/**
 * 프롬프트 전송용 이미지 압축
 * @param file 업로드된 파일 객체
 * @returns Base64 인코딩된 문자열 (Promise)
 */
export const compressPromptImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context not available')); return; }

        const MAX_SIZE = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/webp', 0.6));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

/**
 * [NEW] Blob/Object URL을 Base64 Data URL로 변환
 * (Gemini API 전송 및 JSON Export 용도)
 */
export const blobToDataUrl = async (blobUrlOrBlob: string | Blob): Promise<string> => {
    let blob: Blob;
    if (typeof blobUrlOrBlob === 'string') {
        const response = await fetch(blobUrlOrBlob);
        blob = await response.blob();
    } else {
        blob = blobUrlOrBlob;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * [NEW] Base64 Data URL을 Blob으로 변환
 * (IndexedDB 저장 및 Import 마이그레이션 용도)
 * iOS iframe 환경에서의 fetch(data:) 차단 이슈를 방지하기 위해 수동 변환 로직 사용
 */
export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    try {
        const parts = dataUrl.split(',');
        if (parts.length < 2) throw new Error('Invalid Data URL');
        
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        // Fallback to fetch if manual conversion fails
        console.warn("Manual DataURL conversion failed, falling back to fetch", e);
        const res = await fetch(dataUrl);
        return await res.blob();
    }
};
