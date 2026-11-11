import { useRef, useState } from 'react';
import { formatFileSize, validateImportFile } from '../services/pdf.js';

const isPdf = (file) => file?.name?.toLowerCase().endsWith('.pdf');

export function PdfUpload({ file, onFileChange, onRemove }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const selectFile = (candidate) => {
    const result = validateImportFile(candidate);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError('');
    onFileChange(candidate);
  };

  const handleInput = (event) => {
    selectFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    selectFile(event.dataTransfer.files?.[0]);
  };

  return (
    <section className="panel-card" aria-labelledby="pdf-upload-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Arquivo local</p>
          <h2 id="pdf-upload-title">Importar horários</h2>
        </div>
        <span className="panel-note">HTML: 10 MB · PDF: 20 MB</span>
      </div>
      <div
        className={`drop-zone ${file ? 'drop-zone--selected' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="file-summary">
            <span className="file-icon" aria-hidden="true">{isPdf(file) ? 'PDF' : 'HTML'}</span>
            <div>
              <strong>{file.name}</strong>
              <span>{formatFileSize(file.size)}</span>
            </div>
          </div>
        ) : (
          <>
            <span className="drop-zone__icon" aria-hidden="true">↑</span>
            <strong>Arraste um HTML ou PDF para esta área</strong>
            <span>O HTML estruturado é o fluxo principal; o PDF permanece como alternativa.</span>
          </>
        )}
        <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
          {file ? 'Substituir arquivo' : 'Selecionar arquivo'}
        </button>
        <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf,text/html,.html,.htm" onChange={handleInput} />
      </div>
      {file && (
        <div className="upload-success" role="status">
          {isPdf(file) ? 'PDF selecionado para o fluxo secundário.' : 'HTML selecionado para importação estruturada.'}
          <button className="text-button" type="button" onClick={() => { setError(''); onRemove(); }}>Remover arquivo</button>
        </div>
      )}
      {error && <p className="feedback feedback--error" role="alert">{error}</p>}
    </section>
  );
}
