import { useRef, useState } from 'react';
import { formatFileSize, validateHtmlFile } from '../services/import-file.js';

export function HtmlUpload({ file, onFileChange, onRemove }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const selectFile = (candidate) => {
    const result = validateHtmlFile(candidate);
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
    <section className="panel-card" aria-labelledby="html-upload-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Arquivo local</p>
          <h2 id="html-upload-title">Importar horários</h2>
        </div>
        <span className="panel-note">HTML: 10 MB</span>
      </div>
      <div
        className={`drop-zone ${file ? 'drop-zone--selected' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="file-summary">
            <span className="file-icon" aria-hidden="true">HTML</span>
            <div>
              <strong>{file.name}</strong>
              <span>{formatFileSize(file.size)}</span>
            </div>
          </div>
        ) : (
          <>
            <span className="drop-zone__icon" aria-hidden="true">↑</span>
            <strong>Arraste um arquivo HTML para esta área</strong>
            <span>O HTML estruturado é o formato oficial para importar horários.</span>
          </>
        )}
        <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
          {file ? 'Substituir arquivo' : 'Selecionar arquivo'}
        </button>
        <input ref={inputRef} className="visually-hidden" type="file" accept=".html,.htm,text/html" onChange={handleInput} />
      </div>
      {file && (
        <div className="upload-success" role="status">
          HTML selecionado para importação estruturada.
          <button className="text-button" type="button" onClick={() => { setError(''); onRemove(); }}>Remover arquivo</button>
        </div>
      )}
      {error && <p className="feedback feedback--error" role="alert">{error}</p>}
    </section>
  );
}
