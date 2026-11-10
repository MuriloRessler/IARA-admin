import { useEffect, useState } from 'react';

export function PdfPreview({ file }) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <section className="panel-card pdf-preview" aria-labelledby="pdf-preview-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Documento original</p>
          <h2 id="pdf-preview-title">Pré-visualização do PDF</h2>
        </div>
      </div>
      {previewUrl ? (
        <iframe title={`Pré-visualização de ${file.name}`} src={previewUrl} />
      ) : (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">PDF</span>
          <strong>Nenhum PDF selecionado</strong>
          <p>Você ainda pode montar e conferir a grade manualmente.</p>
        </div>
      )}
    </section>
  );
}
