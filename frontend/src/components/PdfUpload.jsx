import { useRef, useState } from 'react';
import { formatFileSize, validatePdfFile } from '../services/pdf.js';

export function PdfUpload({ file, onFileChange, onRemove }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const selectFile = (candidate) => {
    const result = validatePdfFile(candidate);
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
        <span className="panel-note">Limite: 20 MB</span>
      </div>
      <div
        className={`drop-zone ${file ? 'drop-zone--selected' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="file-summary">
            <span className="file-icon" aria-hidden="true">PDF</span>
            <div>
              <strong>{file.name}</strong>
              <span>{formatFileSize(file.size)}</span>
            </div>
          </div>
        ) : (
          <>
            <span className="drop-zone__icon" aria-hidden="true">↑</span>
            <strong>Arraste um PDF para esta área</strong>
            <span>ou selecione um arquivo no seu computador</span>
          </>
        )}
        <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
          {file ? 'Substituir PDF' : 'Selecionar PDF'}
        </button>
        <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={handleInput} />
      </div>
      {file && (
        <div className="upload-success" role="status">
          PDF selecionado. A extração automática será disponibilizada em uma próxima etapa.
          <button className="text-button" type="button" onClick={() => { setError(''); onRemove(); }}>Remover arquivo</button>
        </div>
      )}
      {error && <p className="feedback feedback--error" role="alert">{error}</p>}
    </section>
  );
}
