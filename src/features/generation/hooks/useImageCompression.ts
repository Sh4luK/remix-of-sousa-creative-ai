export function useImageCompression() {
  const compressImage = (file: File, maxSizeBytes = 800 * 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Não foi possível carregar o contexto 2D do Canvas."));
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL("image/webp", 0.82);
        const byteCount = Math.ceil(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
        
        if (byteCount > maxSizeBytes) {
          reject(new Error("Imagem muito grande mesmo após compressão. Por favor, use uma foto de menor resolução."));
        } else {
          resolve(dataUrl);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Erro ao carregar imagem."));
      };
      
      img.src = url;
    });
  };

  return { compressImage };
}
