const cloneCalibration = (diagnostic) => ({
  pages: (diagnostic?.paginas || []).map((page) => ({
    pageNumber: page.page,
    relative: true,
    pageWidth: page.width,
    pageHeight: page.height,
    tables: (page.tables || []).filter((table) => table.bbox).map((table) => ({
      classCode: table.classCode || '',
      relative: true,
      bbox: { left: table.bbox.left / page.width, width: table.bbox.width / page.width },
      rows: (table.rows || []).map((row) => ({ ...row, top: row.top / page.height, bottom: row.bottom / page.height })),
    })),
  })),
});

const clampRelative = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function CalibrationPanel({ diagnostic, calibration, classOptions = [], onChange }) {
  if (!diagnostic?.paginas?.length) return null;
  const current = calibration || cloneCalibration(diagnostic);

  const changeTable = (pageNumber, tableIndex, field, value) => {
    const nextValue = field === 'classCode' ? value : clampRelative(value);
    const pages = current.pages.map((page) => page.pageNumber !== pageNumber ? page : {
      ...page,
      tables: page.tables.map((table, index) => index !== tableIndex ? table : field === 'classCode'
        ? { ...table, classCode: nextValue }
        : { ...table, bbox: { ...table.bbox, [field]: nextValue } }),
    });
    onChange({ ...current, pages });
  };

  const changeRow = (pageNumber, tableIndex, rowIndex, field, value) => {
    const pages = current.pages.map((page) => page.pageNumber !== pageNumber ? page : {
      ...page,
      tables: page.tables.map((table, index) => index !== tableIndex ? table : {
        ...table,
        rows: table.rows.map((row, index) => index !== rowIndex ? row : { ...row, [field]: clampRelative(value) }),
      }),
    });
    onChange({ ...current, pages });
  };

  const addTable = (pageNumber) => {
    const pages = current.pages.map((page) => page.pageNumber !== pageNumber ? page : {
      ...page,
      tables: [...page.tables, { classCode: '', relative: true, bbox: { left: 0, width: 1 }, rows: [] }],
    });
    onChange({ ...current, pages });
  };

  return (
    <section className="panel-card calibration-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Calibração visual</p><h2>Conferir regiões detectadas</h2></div>
        <span className="panel-note">Ajustes locais</span>
      </div>
      <p className="helper-text">A detecção usa coordenadas relativas (0 a 1) ao tamanho da página e não altera o PDF. Quando uma região não for encontrada, crie uma região manual, informe a turma e ajuste seus limites antes de processar novamente.</p>
      {current.pages.map((page) => (
        <div className="calibration-page" key={page.pageNumber}>
          <strong>Página {page.pageNumber}</strong>
          {page.tables.length > 0 ? (
            <div className="calibration-canvas" style={{ aspectRatio: `${page.pageWidth || 1} / ${page.pageHeight || 1}` }} aria-label={`Mapa estrutural da página ${page.pageNumber}`}>
              {page.tables.map((table, index) => (
                <div className="calibration-region" key={`${page.pageNumber}-${table.classCode || 'manual'}-${index}`} style={{ left: `${table.bbox.left * 100}%`, width: `${table.bbox.width * 100}%` }}>
                  <span>{table.classCode || 'Turma pendente'}</span>
                  {table.rows?.map((row, rowIndex) => <i key={`${row.posicao}-${rowIndex}`} style={{ top: `${row.top * 100}%`, height: `${Math.max(0, row.bottom - row.top) * 100}%` }} aria-hidden="true" />)}
                </div>
              ))}
            </div>
          ) : <p className="calibration-empty">Nenhuma região foi detectada automaticamente nesta página.</p>}
          {page.tables.map((table, index) => (
            <div className="calibration-table-wrap" key={`${page.pageNumber}-${table.classCode || 'manual'}-${index}`}>
              <div className="calibration-table">
                <label>Turma<input list={`calibration-classes-${page.pageNumber}`} value={table.classCode} placeholder="Ex.: 61 1" onChange={(event) => changeTable(page.pageNumber, index, 'classCode', event.target.value)} /></label>
                <label>Esquerda<input type="number" min="0" max="1" step="0.001" value={table.bbox.left} onChange={(event) => changeTable(page.pageNumber, index, 'left', event.target.value)} /></label>
                <label>Largura<input type="number" min="0" max="1" step="0.001" value={table.bbox.width} onChange={(event) => changeTable(page.pageNumber, index, 'width', event.target.value)} /></label>
              </div>
              {table.rows?.length > 0 && <details><summary>Ajustar linhas ({table.rows.length})</summary><div className="calibration-rows">{table.rows.map((row, rowIndex) => <div className="calibration-row" key={`${row.posicao}-${rowIndex}`}><span>Posição {row.posicao} · {row.inicio || 'início pendente'}</span><label>Topo<input type="number" min="0" max="1" step="0.001" value={row.top} onChange={(event) => changeRow(page.pageNumber, index, rowIndex, 'top', event.target.value)} /></label><label>Base<input type="number" min="0" max="1" step="0.001" value={row.bottom} onChange={(event) => changeRow(page.pageNumber, index, rowIndex, 'bottom', event.target.value)} /></label></div>)}</div></details>}
            </div>
          ))}
          <datalist id={`calibration-classes-${page.pageNumber}`}>{classOptions.map((classCode) => <option key={classCode} value={classCode} />)}</datalist>
          <button className="secondary-button" type="button" onClick={() => addTable(page.pageNumber)}>+ Adicionar região manual</button>
        </div>
      ))}
    </section>
  );
}
